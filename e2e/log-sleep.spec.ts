import { test, expect, type Page } from "@playwright/test";

function uniqueEmail(label = "slp") {
  return `e2e-${label}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.test`;
}

async function signupAndLogin(page: Page, email: string, password = "test1234abcd") {
  await page.goto("/signup");
  await page.getByLabel("Name").fill("Sleep E2E");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm password").fill(password);
  await page.getByRole("button", { name: /create account/i }).click();
  await page.waitForURL(/\/profile$/, { timeout: 30_000 });
}

test("log sleep crossing midnight → duration → entry list", async ({ page }) => {
  await signupAndLogin(page, uniqueEmail());

  await page.goto("/log/sleep");
  await expect(page.getByRole("heading", { name: /Sleep log/i })).toBeVisible();

  // Use a deterministic past date to avoid TZ flakiness with "today" boundaries.
  // 2026-05-02 23:30 → 2026-05-03 07:15 = 7h 45m
  await page.getByLabel("Wake date").fill("2026-05-03");
  await page.getByLabel("Bedtime").fill("2026-05-02T23:30");
  await page.getByLabel("Wake time").fill("2026-05-03T07:15");

  // The duration preview is computed client-side
  await expect(page.getByTestId("sleep-duration-preview")).toHaveText("7h 45m");

  // Quality: pick 4 stars (the default is 4, but click to be explicit)
  // The Rating component's stars are radio inputs labelled "1 Star", "2 Stars" etc.
  await page.getByRole("radio", { name: "4 Stars" }).check();

  await page.getByLabel("Note (optional)").fill("Late night work");
  await page.getByRole("button", { name: /^Log sleep$/ }).click();

  // The entry appears in the list with the same duration
  await expect(page.getByText(/7h 45m/)).toBeVisible();
  await expect(page.getByText("Late night work")).toBeVisible();

  // Delete the entry
  await page.getByRole("button", { name: /Delete sleep entry/i }).click();
  await expect(page.getByText(/Nothing logged yet/)).toBeVisible();
});

test("a user cannot read or modify another user's sleep entries (403)", async ({
  browser,
  request,
}) => {
  const aCtx = await browser.newContext();
  const aPage = await aCtx.newPage();
  await signupAndLogin(aPage, uniqueEmail("ownerA"));
  const wakeDate = "2026-05-03";
  const created = await aCtx.request.post("/api/logs/sleep", {
    data: {
      date: wakeDate,
      bedtime: "2026-05-02T23:00:00.000Z",
      wakeTime: "2026-05-03T07:00:00.000Z",
      quality: 4,
      note: "A",
    },
  });
  expect(created.status()).toBe(201);
  const { id, durationMinutes } = (await created.json()) as {
    id: string;
    durationMinutes: number;
  };
  expect(durationMinutes).toBe(8 * 60);

  const bCtx = await browser.newContext();
  const bPage = await bCtx.newPage();
  await signupAndLogin(bPage, uniqueEmail("intruderB"));

  const bList = await bCtx.request
    .get(`/api/logs/sleep?date=${wakeDate}`)
    .then((r) => r.json() as Promise<{ entries: { id: string }[] }>);
  expect(bList.entries.find((e) => e.id === id)).toBeUndefined();

  const patch = await bCtx.request.patch(`/api/logs/sleep/${id}`, {
    data: { quality: 1 },
  });
  expect(patch.status()).toBe(403);

  const del = await bCtx.request.delete(`/api/logs/sleep/${id}`);
  expect(del.status()).toBe(403);

  const anon = await request.get(`/api/logs/sleep?date=${wakeDate}`);
  expect(anon.status()).toBe(401);

  // The API also rejects an inverted bedtime/wakeTime POST with 400
  const bad = await aCtx.request.post("/api/logs/sleep", {
    data: {
      date: wakeDate,
      bedtime: "2026-05-03T08:00:00.000Z",
      wakeTime: "2026-05-03T07:00:00.000Z",
      quality: 3,
    },
  });
  expect(bad.status()).toBe(400);

  await aCtx.close();
  await bCtx.close();
});
