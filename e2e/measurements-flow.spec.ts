import { test, expect, type Page } from "@playwright/test";

function uniqueEmail(label = "bm") {
  return `e2e-${label}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.test`;
}

async function signupAndLogin(page: Page, email: string, password = "test1234abcd") {
  await page.goto("/signup");
  await page.getByLabel("Name").fill("BM E2E");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm password").fill(password);
  await page.getByRole("button", { name: /create account/i }).click();
  await page.waitForURL(/\/profile$/, { timeout: 30_000 });
}

test("log measurement → cards page shows latest + delta vs previous", async ({
  page,
  browser,
}) => {
  const ctx = page.context();
  await signupAndLogin(page, uniqueEmail());

  // Seed an earlier weight via the API so the second log produces a real delta.
  const earlier = await ctx.request.post("/api/measurements", {
    data: { date: "2026-04-15", weightKg: 72 },
  });
  expect(earlier.status()).toBe(201);

  // Log today's entry through the UI form
  await page.goto("/measurements/new");
  await expect(page.getByRole("heading", { name: /Log measurements/i })).toBeVisible();
  await page.getByLabel("Date").fill("2026-05-01");
  await page.getByLabel("Weight (kg)").fill("70");
  await page.getByLabel("Chest").fill("100");
  await page.getByRole("button", { name: /^Save measurement$/ }).click();

  // Cards page
  await page.waitForURL(/\/measurements$/);
  await expect(page.getByRole("heading", { name: /Body measurements/i })).toBeVisible();

  // Weight: latest 70, previous 72 → delta -2 kg.
  const weightCard = page.getByTestId("metric-card-weightKg");
  await expect(weightCard).toContainText("70 kg");
  await expect(page.getByTestId("metric-delta-weightKg")).toContainText("−2");
  await expect(page.getByTestId("metric-delta-weightKg")).toContainText("kg");

  // Chest: only 1 entry (today) → "First entry".
  const chestCard = page.getByTestId("metric-card-chest");
  await expect(chestCard).toContainText("100 cm");
  await expect(page.getByTestId("metric-delta-chest")).toContainText(/First entry/);

  // History view: weight series should chart 2 points without erroring.
  await page.getByRole("link", { name: /History/i }).click();
  await page.waitForURL(/\/measurements\/history$/);
  await page.getByLabel("Time range").getByRole("button", { name: "All" }).click();
  await expect(page.getByTestId("history-chart-weightKg")).toBeVisible();

  // The cross-user 403 + invalid POST coverage is in the second test.
  const _unused = browser; // keep parameter so the signature matches the second test
});

test("measurements API: cross-user 403, no-metrics 400, body-fat range 400", async ({
  browser,
  request,
}) => {
  const aCtx = await browser.newContext();
  const aPage = await aCtx.newPage();
  await signupAndLogin(aPage, uniqueEmail("ownerA"));

  const created = await aCtx.request.post("/api/measurements", {
    data: { date: "2026-05-01", weightKg: 70, measurementsCm: { chest: 100 } },
  });
  expect(created.status()).toBe(201);
  const { id } = (await created.json()) as { id: string };

  // No-metrics POST → 400 (a date alone is not a measurement).
  const empty = await aCtx.request.post("/api/measurements", {
    data: { date: "2026-05-02", note: "skipped" },
  });
  expect(empty.status()).toBe(400);

  // Out-of-range body-fat → 400.
  const badBf = await aCtx.request.post("/api/measurements", {
    data: { date: "2026-05-02", bodyFatPercent: 150 },
  });
  expect(badBf.status()).toBe(400);

  // Cross-user attacks
  const bCtx = await browser.newContext();
  const bPage = await bCtx.newPage();
  await signupAndLogin(bPage, uniqueEmail("intruderB"));

  const bList = (await bCtx.request.get("/api/measurements").then((r) => r.json())) as {
    entries: { id: string }[];
  };
  expect(bList.entries.find((e) => e.id === id)).toBeUndefined();

  const patch = await bCtx.request.patch(`/api/measurements/${id}`, {
    data: { weightKg: 1 },
  });
  expect(patch.status()).toBe(403);

  const del = await bCtx.request.delete(`/api/measurements/${id}`);
  expect(del.status()).toBe(403);

  const anon = await request.get("/api/measurements");
  expect(anon.status()).toBe(401);

  // A's entry survives intact.
  const stillThere = (await aCtx.request.get("/api/measurements").then((r) => r.json())) as {
    entries: { id: string; weightKg: number; measurementsCm: { chest: number } }[];
  };
  const found = stillThere.entries.find((e) => e.id === id);
  expect(found?.weightKg).toBe(70);
  expect(found?.measurementsCm.chest).toBe(100);

  await aCtx.close();
  await bCtx.close();
});
