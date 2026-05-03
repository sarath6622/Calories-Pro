import { test, expect, type Page } from "@playwright/test";

function uniqueEmail(label = "ex") {
  return `e2e-${label}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.test`;
}

async function signupAndLogin(page: Page, email: string, password = "test1234abcd") {
  await page.goto("/signup");
  await page.getByLabel("Name").fill("Exercise E2E");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm password").fill(password);
  await page.getByRole("button", { name: /create account/i }).click();
  await page.waitForURL(/\/profile$/, { timeout: 30_000 });
}

test("log exercise → totals → delete", async ({ page }) => {
  await signupAndLogin(page, uniqueEmail());

  await page.goto("/log/exercise");
  await expect(page.getByRole("heading", { name: /Exercise log/i })).toBeVisible();

  await page.getByLabel("Calories burned").fill("250");
  await page.getByLabel("Note (optional)").fill("30 min run");
  await page.getByRole("button", { name: /^Log exercise$/ }).click();

  await expect(page.getByText(/250 kcal/).first()).toBeVisible();
  await expect(page.getByText("30 min run")).toBeVisible();

  // Add a second entry; totals must sum (F-EX-2)
  await page.getByLabel("Calories burned").fill("100");
  await page.getByRole("button", { name: /^Log exercise$/ }).click();
  await expect(page.getByText(/350 kcal/).first()).toBeVisible();

  // Delete the first
  await page.getByRole("button", { name: /Delete exercise entry 250 kcal/i }).click();
  await expect(page.getByText("30 min run")).toHaveCount(0);
  await expect(page.getByText(/100 kcal/).first()).toBeVisible();
});

test("a user cannot modify another user's exercise entries (403)", async ({ browser, request }) => {
  const aCtx = await browser.newContext();
  const aPage = await aCtx.newPage();
  await signupAndLogin(aPage, uniqueEmail("ownerA"));
  const today = new Date().toISOString().slice(0, 10);
  const created = await aCtx.request.post("/api/logs/exercise", {
    data: { date: today, caloriesBurned: 100, note: "A" },
  });
  expect(created.status()).toBe(201);
  const { id } = (await created.json()) as { id: string };

  const bCtx = await browser.newContext();
  const bPage = await bCtx.newPage();
  await signupAndLogin(bPage, uniqueEmail("intruderB"));

  // B cannot see A's entries on the same day
  const bList = await bCtx.request
    .get(`/api/logs/exercise?date=${today}`)
    .then((r) => r.json() as Promise<{ entries: { id: string }[] }>);
  expect(bList.entries.find((e) => e.id === id)).toBeUndefined();

  // B cannot patch
  const patch = await bCtx.request.patch(`/api/logs/exercise/${id}`, {
    data: { caloriesBurned: 999 },
  });
  expect(patch.status()).toBe(403);

  // B cannot delete
  const del = await bCtx.request.delete(`/api/logs/exercise/${id}`);
  expect(del.status()).toBe(403);

  // unauth → 401
  const anon = await request.get(`/api/logs/exercise?date=${today}`);
  expect(anon.status()).toBe(401);

  // A's entry survives
  const stillThere = await aCtx.request.get(`/api/logs/exercise?date=${today}`);
  const aBody = (await stillThere.json()) as {
    entries: { id: string; caloriesBurned: number }[];
  };
  expect(aBody.entries.find((e) => e.id === id)?.caloriesBurned).toBe(100);

  await aCtx.close();
  await bCtx.close();
});
