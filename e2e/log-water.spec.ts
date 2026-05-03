import { test, expect, type Page } from "@playwright/test";

function uniqueEmail(label = "wtr") {
  return `e2e-${label}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.test`;
}

async function signupAndLogin(page: Page, email: string, password = "test1234abcd") {
  await page.goto("/signup");
  await page.getByLabel("Name").fill("Water E2E");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm password").fill(password);
  await page.getByRole("button", { name: /create account/i }).click();
  await page.waitForURL(/\/profile$/, { timeout: 30_000 });
}

test("quick-add water → custom amount → progress → delete", async ({ page }) => {
  await signupAndLogin(page, uniqueEmail());

  // Set a 2000 ml water goal so the progress bar is exercisable
  const goalRes = await page.context().request.patch("/api/goals", {
    data: {
      dailyCalories: 2000,
      dailyProteinG: 150,
      dailyCarbsG: 200,
      dailyFatG: 67,
      dailyWaterMl: 2000,
      sleepHoursTarget: 8,
      macroPreset: "balanced",
      targetWeightKg: null,
    },
  });
  expect(goalRes.status()).toBe(200);

  await page.goto("/log/water");
  await expect(page.getByRole("heading", { name: /Water log/i })).toBeVisible();

  // +250 ml quick-add
  await page.getByRole("button", { name: "+250 ml" }).click();
  await expect(page.getByText(/^250 ml/).first()).toBeVisible();
  await expect(page.getByText(/13% of daily goal/)).toBeVisible(); // 250/2000 = 12.5 → 13

  // +500 ml quick-add
  await page.getByRole("button", { name: "+500 ml" }).click();
  await expect(page.getByText(/^750 ml/).first()).toBeVisible();

  // Custom add: 100 ml → total 850 ml
  await page.getByLabel("Custom (ml)").fill("100");
  await page.getByRole("button", { name: /^Add custom$/ }).click();
  await expect(page.getByText(/^850 ml/).first()).toBeVisible();

  // Delete the 100 ml entry
  await page.getByRole("button", { name: /Delete water entry 100 ml/i }).click();
  await expect(page.getByText(/^750 ml/).first()).toBeVisible();
});

test("a user cannot delete another user's water entries (403)", async ({ browser, request }) => {
  const aCtx = await browser.newContext();
  const aPage = await aCtx.newPage();
  await signupAndLogin(aPage, uniqueEmail("ownerA"));
  const today = new Date().toISOString().slice(0, 10);
  const created = await aCtx.request.post("/api/logs/water", {
    data: { date: today, amountMl: 250 },
  });
  expect(created.status()).toBe(201);
  const { id } = (await created.json()) as { id: string };

  const bCtx = await browser.newContext();
  const bPage = await bCtx.newPage();
  await signupAndLogin(bPage, uniqueEmail("intruderB"));

  const bList = await bCtx.request
    .get(`/api/logs/water?date=${today}`)
    .then((r) => r.json() as Promise<{ entries: { id: string }[] }>);
  expect(bList.entries.find((e) => e.id === id)).toBeUndefined();

  const del = await bCtx.request.delete(`/api/logs/water/${id}`);
  expect(del.status()).toBe(403);

  const anon = await request.get(`/api/logs/water?date=${today}`);
  expect(anon.status()).toBe(401);

  const stillThere = await aCtx.request.get(`/api/logs/water?date=${today}`);
  const aBody = (await stillThere.json()) as { entries: { id: string; amountMl: number }[] };
  expect(aBody.entries.find((e) => e.id === id)?.amountMl).toBe(250);

  await aCtx.close();
  await bCtx.close();
});
