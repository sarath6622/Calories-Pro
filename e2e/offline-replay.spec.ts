import { test, expect, type Page } from "@playwright/test";

/**
 * Phase 8 — F-PWA-4 / F-PWA-5 end-to-end replay flow.
 *
 * Plot: user logs water while offline → entry is queued in IndexedDB →
 * connectivity returns → orchestrator drains the queue via /api/sync/replay
 * → entry appears in `GET /api/logs/water` with `syncedFromOffline: true`.
 *
 * We use Playwright's `context.setOffline(true)` to force the page into
 * offline mode. With `next-pwa` disabled in dev (the config sets
 * `disable: NODE_ENV === "development"`), this exercises the queue + replay
 * path directly without a service worker in the loop, which is exactly what
 * we want to test in isolation. Service-worker behaviour is covered by the
 * Lighthouse PWA-score check in the CI build.
 */
function uniqueEmail(label = "off") {
  return `e2e-${label}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.test`;
}

async function signupAndLogin(page: Page, email: string, password = "test1234abcd") {
  await page.goto("/signup");
  await page.getByLabel("Name").fill("Offline E2E");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm password").fill(password);
  await page.getByRole("button", { name: /create account/i }).click();
  await page.waitForURL(/\/profile$/, { timeout: 30_000 });
}

test("F-PWA-4/5: water entry logged offline syncs on reconnect with syncedFromOffline=true", async ({
  page,
  context,
}) => {
  await signupAndLogin(page, uniqueEmail());

  await page.goto("/log/water");
  await expect(page.getByRole("heading", { name: /Water log/i })).toBeVisible();
  // Ensure the page's initial queries (listQuery, goalsQuery) have settled —
  // both run with `cache: "no-store"`, so kicking them off after going offline
  // would just produce console noise and slow the test down. Wait for the
  // "Nothing logged yet" empty-state to confirm the list has loaded.
  await expect(page.getByText(/Nothing logged yet/i)).toBeVisible();

  // Go offline. The Playwright API simulates the browser's online/offline
  // signals AND drops outbound network requests, which is exactly the contract
  // `tryOnlineOrEnqueue` keys off.
  await context.setOffline(true);

  // Click +250 ml. The mutation is wrapped in `tryOnlineOrEnqueue`, which sees
  // navigator.onLine === false and writes to IndexedDB instead of the network.
  await page.getByRole("button", { name: "+250 ml" }).click();

  // Poll the IndexedDB queue from the page context until it sees the new row.
  // Polling rather than a single-shot `evaluate` avoids racing against the async
  // chain inside `tryOnlineOrEnqueue` (open DB → write → resolve → push toast).
  // The toast can appear before the IDB write fully commits to other connections.
  async function readQueue(): Promise<
    Array<{ id: string; type: string; payload: unknown; retries: number }>
  > {
    return page.evaluate(
      () =>
        new Promise<Array<{ id: string; type: string; payload: unknown; retries: number }>>(
          (resolve) => {
            const req = indexedDB.open("caloriespro-offline");
            req.onerror = () => resolve([]);
            req.onsuccess = () => {
              const db = req.result;
              if (!db.objectStoreNames.contains("queue")) {
                resolve([]);
                return;
              }
              const tx = db.transaction("queue", "readonly");
              const all = tx.objectStore("queue").getAll();
              all.onsuccess = () =>
                resolve(
                  (
                    all.result as Array<{
                      id: string;
                      type: string;
                      payload: unknown;
                      retries: number;
                    }>
                  ).map((e) => ({
                    id: e.id,
                    type: e.type,
                    payload: e.payload,
                    retries: e.retries,
                  })),
                );
              all.onerror = () => resolve([]);
            };
          },
        ),
    );
  }

  await expect.poll(async () => (await readQueue()).length, {
    timeout: 10_000,
    intervals: [100, 200, 400],
  }).toBe(1);
  const queuedEntries = await readQueue();
  expect(queuedEntries[0]?.type).toBe("water");
  expect(queuedEntries[0]?.payload).toMatchObject({ amountMl: 250 });
  expect(queuedEntries[0]?.retries).toBe(0);

  // Reconnect. The orchestrator's `online` listener fires immediately and drains.
  await context.setOffline(false);

  // Wait for the synced-toast to appear (or the queue to empty).
  await expect.poll(
    async () =>
      await page.evaluate(async () => {
        return new Promise<number>((resolve) => {
          const req = indexedDB.open("caloriespro-offline");
          req.onsuccess = () => {
            const db = req.result;
            const tx = db.transaction("queue", "readonly");
            const count = tx.objectStore("queue").count();
            count.onsuccess = () => resolve(count.result);
          };
          req.onerror = () => resolve(-1);
        });
      }),
    { timeout: 15_000, intervals: [200, 500, 1000] },
  ).toBe(0);

  // Server-side verification: the API now lists the entry with syncedFromOffline=true.
  const today = new Date().toISOString().slice(0, 10);
  const list = await page.context().request.get(`/api/logs/water?date=${today}`);
  expect(list.status()).toBe(200);
  const body = (await list.json()) as {
    entries: { amountMl: number; syncedFromOffline: boolean; clientId: string | null }[];
  };
  expect(body.entries).toHaveLength(1);
  expect(body.entries[0]?.amountMl).toBe(250);
  expect(body.entries[0]?.syncedFromOffline).toBe(true);
  expect(body.entries[0]?.clientId).toMatch(/^[0-9a-f-]{36}$/i);
});

test("F-PWA-5: replaying the same UUID twice does not double-create (idempotency)", async ({
  browser,
}) => {
  // Sign up via the UI to get an authenticated context, then drive the API
  // directly — this is faster than a UI loop and isolates the dedup logic.
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await signupAndLogin(page, uniqueEmail("idem"));

  const today = new Date().toISOString().slice(0, 10);
  const clientId = "11111111-1111-4111-8111-111111111111"; // fixed v4 UUID

  const replay1 = await ctx.request.post("/api/sync/replay", {
    data: {
      items: [
        {
          id: clientId,
          type: "water",
          payload: { date: today, amountMl: 333 },
        },
      ],
    },
  });
  expect(replay1.status()).toBe(200);
  const r1 = (await replay1.json()) as {
    results: Array<{ id: string; status: string; serverId?: string }>;
  };
  expect(r1.results[0]?.status).toBe("created");
  const serverId = r1.results[0]?.serverId;

  // Send the SAME client UUID again — the partial unique index makes this safe.
  const replay2 = await ctx.request.post("/api/sync/replay", {
    data: {
      items: [
        {
          id: clientId,
          type: "water",
          payload: { date: today, amountMl: 333 },
        },
      ],
    },
  });
  expect(replay2.status()).toBe(200);
  const r2 = (await replay2.json()) as {
    results: Array<{ id: string; status: string; serverId?: string }>;
  };
  expect(r2.results[0]?.status).toBe("duplicate");
  expect(r2.results[0]?.serverId).toBe(serverId);

  // Confirm only one entry exists for the day.
  const list = await ctx.request.get(`/api/logs/water?date=${today}`);
  const body = (await list.json()) as { entries: unknown[] };
  expect(body.entries).toHaveLength(1);

  await ctx.close();
});

test("F-PWA-5: anon /api/sync/replay → 401, malformed batch → 400", async ({
  browser,
  request,
}) => {
  const anon = await request.post("/api/sync/replay", {
    data: { items: [{ id: "00000000-0000-4000-8000-000000000000", type: "water", payload: {} }] },
  });
  expect(anon.status()).toBe(401);

  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await signupAndLogin(page, uniqueEmail("badbatch"));

  // Empty items array → 400.
  const empty = await ctx.request.post("/api/sync/replay", { data: { items: [] } });
  expect(empty.status()).toBe(400);

  // Unknown queue type → 400.
  const badType = await ctx.request.post("/api/sync/replay", {
    data: {
      items: [
        {
          id: "22222222-2222-4222-8222-222222222222",
          type: "not_real",
          payload: { foo: 1 },
        },
      ],
    },
  });
  expect(badType.status()).toBe(400);

  // Bad UUID → 400.
  const badId = await ctx.request.post("/api/sync/replay", {
    data: {
      items: [{ id: "not-a-uuid", type: "water", payload: { date: "2026-05-03", amountMl: 250 } }],
    },
  });
  expect(badId.status()).toBe(400);

  await ctx.close();
});
