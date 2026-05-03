import { test, expect, type Page, type APIRequestContext } from "@playwright/test";

function uniqueEmail(label = "log") {
  return `e2e-${label}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.test`;
}

async function signupAndLogin(page: Page, email: string, password = "test1234abcd") {
  await page.goto("/signup");
  await page.getByLabel("Name").fill("Log E2E");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm password").fill(password);
  await page.getByRole("button", { name: /create account/i }).click();
  await page.waitForURL(/\/profile$/, { timeout: 30_000 });
}

async function createFoodViaApi(
  request: APIRequestContext,
  overrides: Partial<{
    name: string;
    caloriesPerServing: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
  }> = {},
): Promise<{ id: string; name: string }> {
  const body = {
    name: overrides.name ?? `Food-${Date.now()}-${Math.random()}`,
    brand: null,
    servingSize: 100,
    servingUnit: "g",
    caloriesPerServing: overrides.caloriesPerServing ?? 100,
    macrosPerServing: {
      proteinG: overrides.proteinG ?? 5,
      carbsG: overrides.carbsG ?? 10,
      fatG: overrides.fatG ?? 2,
      fiberG: null,
      sugarG: null,
    },
    isFavorite: false,
  };
  const res = await request.post("/api/foods", { data: body });
  expect(res.status()).toBe(201);
  return (await res.json()) as { id: string; name: string };
}

test("log food → totals → edit servings → delete", async ({ page }) => {
  await signupAndLogin(page, uniqueEmail());

  // seed one food
  const food = await createFoodViaApi(page.context().request, {
    name: "TestEgg",
    caloriesPerServing: 78,
    proteinG: 6.3,
    carbsG: 0.6,
    fatG: 5.3,
  });

  await page.goto("/log/food");
  await expect(page.getByRole("heading", { name: /Daily food log/i })).toBeVisible();

  // The Add buttons are per-meal-section (aria-label "Add to Breakfast" etc.).
  await page.getByRole("button", { name: "Add to Breakfast" }).click();
  const addDialog = page.getByRole("dialog");
  await expect(addDialog).toBeVisible();
  await addDialog.getByLabel("Search foods").fill("TestEgg");
  await addDialog.getByRole("button", { name: /TestEgg/ }).click();
  await addDialog.getByLabel("Servings").fill("2");
  await addDialog.getByRole("button", { name: /^Log food$/ }).click();
  await expect(addDialog).toBeHidden();

  // 2 servings × 78 = 156 kcal
  await expect(page.getByText(/156 kcal/).first()).toBeVisible();
  await expect(page.getByText("TestEgg · 2.00 ×")).toBeVisible();

  // Edit servings to 3 → 234 kcal
  await page.getByRole("button", { name: /Edit servings for TestEgg/i }).click();
  const editDialog = page.getByRole("dialog");
  await expect(editDialog).toBeVisible();
  await editDialog.getByLabel("Servings").fill("3");
  await editDialog.getByRole("button", { name: /^Save$/ }).click();
  await expect(editDialog).toBeHidden();
  await expect(page.getByText(/234 kcal/).first()).toBeVisible();

  // Delete
  await page.getByRole("button", { name: /Delete TestEgg/i }).click();
  await expect(page.getByText("TestEgg · 3.00 ×")).toHaveCount(0);
});

test("snapshot is preserved when the source food is edited later (PRD §4.3)", async ({ page }) => {
  await signupAndLogin(page, uniqueEmail("snapshot"));

  const food = await createFoodViaApi(page.context().request, {
    name: "SnapEgg",
    caloriesPerServing: 100,
    proteinG: 10,
    carbsG: 0,
    fatG: 0,
  });

  await page.goto("/log/food");
  await page.getByRole("button", { name: "Add to Breakfast" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Search foods").fill("SnapEgg");
  await dialog.getByRole("button", { name: /SnapEgg/ }).click();
  await dialog.getByLabel("Servings").fill("1");
  await dialog.getByRole("button", { name: /^Log food$/ }).click();
  await expect(dialog).toBeHidden();

  // seed value: 1 × 100 kcal = 100 kcal
  await expect(page.getByText(/100 kcal/).first()).toBeVisible();

  // Edit the underlying food: change calories to 999. The historical entry must NOT shift.
  const patchRes = await page.context().request.patch(`/api/foods/${food.id}`, {
    data: { caloriesPerServing: 999 },
  });
  expect(patchRes.status()).toBe(200);

  await page.reload();
  // Still 100 kcal — the snapshot froze the value at log time
  await expect(page.getByText(/100 kcal/).first()).toBeVisible();
  await expect(page.getByText(/999 kcal/)).toHaveCount(0);

  // And the underlying food was actually changed (not a UI stale-cache illusion)
  const refetch = await page.context().request.get(`/api/foods/${food.id}`);
  const body = (await refetch.json()) as { caloriesPerServing: number };
  expect(body.caloriesPerServing).toBe(999);
});

test("logging bumps food.timesLogged and lastLoggedAt (F-LOG-3)", async ({ page }) => {
  await signupAndLogin(page, uniqueEmail("counters"));

  const food = await createFoodViaApi(page.context().request, { name: "CountFood" });

  // Pre-condition
  let getRes = await page.context().request.get(`/api/foods/${food.id}`);
  let body = (await getRes.json()) as { timesLogged: number; lastLoggedAt: string | null };
  expect(body.timesLogged).toBe(0);
  expect(body.lastLoggedAt).toBeNull();

  // Log it twice
  for (let i = 0; i < 2; i++) {
    const res = await page.context().request.post("/api/logs/food", {
      data: {
        foodId: food.id,
        date: new Date().toISOString().slice(0, 10),
        mealType: "breakfast",
        servings: 1,
      },
    });
    expect(res.status()).toBe(201);
  }

  getRes = await page.context().request.get(`/api/foods/${food.id}`);
  body = (await getRes.json()) as { timesLogged: number; lastLoggedAt: string | null };
  expect(body.timesLogged).toBe(2);
  expect(body.lastLoggedAt).not.toBeNull();
});

test("a user cannot read or modify another user's log entries (403)", async ({ browser, request }) => {
  // user A creates a food + logs it
  const aCtx = await browser.newContext();
  const aPage = await aCtx.newPage();
  await signupAndLogin(aPage, uniqueEmail("ownerA"));
  const aRequest = aCtx.request;
  const food = await createFoodViaApi(aRequest, { name: "PrivateLogA" });
  const today = new Date().toISOString().slice(0, 10);
  const logRes = await aRequest.post("/api/logs/food", {
    data: { foodId: food.id, date: today, mealType: "breakfast", servings: 1 },
  });
  expect(logRes.status()).toBe(201);
  const logBody = (await logRes.json()) as { id: string };
  const entryId = logBody.id;

  // user B in a fresh context
  const bCtx = await browser.newContext();
  const bPage = await bCtx.newPage();
  await signupAndLogin(bPage, uniqueEmail("intruderB"));
  const bRequest = bCtx.request;

  // GET listing for the same date returns B's (empty) list, never A's entries
  const bList = await bRequest
    .get(`/api/logs/food?date=${today}`)
    .then((r) => r.json() as Promise<{ entries: { id: string }[] }>);
  expect(bList.entries.find((e) => e.id === entryId)).toBeUndefined();

  // PATCH another user's entry -> 403
  const patchRes = await bRequest.patch(`/api/logs/food/${entryId}`, {
    data: { servings: 99 },
  });
  expect(patchRes.status()).toBe(403);

  // DELETE another user's entry -> 403
  const delRes = await bRequest.delete(`/api/logs/food/${entryId}`);
  expect(delRes.status()).toBe(403);

  // unauth -> 401
  const anonRes = await request.get(`/api/logs/food?date=${today}`);
  expect(anonRes.status()).toBe(401);

  // A's entry survived
  const stillThere = await aRequest.get(`/api/logs/food?date=${today}`);
  const aBody = (await stillThere.json()) as { entries: { id: string; servings: number }[] };
  const aEntry = aBody.entries.find((e) => e.id === entryId);
  expect(aEntry?.servings).toBe(1);

  await aCtx.close();
  await bCtx.close();
});
