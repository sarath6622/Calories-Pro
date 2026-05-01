import { test, expect, type APIRequestContext } from "@playwright/test";

function uniqueEmail(label = "foods") {
  return `e2e-${label}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.test`;
}

async function signupAndLogin(
  page: import("@playwright/test").Page,
  email: string,
  password = "test1234abcd",
) {
  await page.goto("/signup");
  await page.getByLabel("Name").fill("Foods E2E");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm password").fill(password);
  await page.getByRole("button", { name: /create account/i }).click();
  await page.waitForURL(/\/profile$/, { timeout: 30_000 });
}

test("create -> search -> favorite -> edit -> delete", async ({ page }) => {
  await signupAndLogin(page, uniqueEmail());

  // Create
  await page.goto("/foods/new");
  await page.getByLabel("Name").fill("Boiled egg");
  await page.getByLabel("Brand (optional)").fill("Local farm");
  await page.getByLabel("Serving size").fill("50");
  await page.getByLabel("Calories per serving (kcal)").fill("78");
  await page.getByLabel("Protein (g)").fill("6.3");
  await page.getByLabel("Carbs (g)").fill("0.6");
  await page.getByLabel("Fat (g)").fill("5.3");
  await page.getByRole("button", { name: /add food/i }).click();
  await page.waitForURL(/\/foods$/);
  await expect(page.getByText("Boiled egg")).toBeVisible();

  // Add a second food we can search-filter against
  await page.goto("/foods/new");
  await page.getByLabel("Name").fill("Brown rice");
  await page.getByLabel("Serving size").fill("100");
  await page.getByLabel("Calories per serving (kcal)").fill("123");
  await page.getByLabel("Protein (g)").fill("2.6");
  await page.getByLabel("Carbs (g)").fill("25");
  await page.getByLabel("Fat (g)").fill("1");
  await page.getByRole("button", { name: /add food/i }).click();
  await page.waitForURL(/\/foods$/);

  // Search filters case-insensitively (F-FOOD-3)
  await page.getByRole("textbox", { name: /Search foods/i }).fill("egg");
  await expect(page.getByText("Boiled egg")).toBeVisible();
  await expect(page.getByText("Brown rice")).not.toBeVisible();
  await page.getByRole("textbox", { name: /Search foods/i }).fill("");

  // Favorite (F-FOOD-5)
  await page.getByRole("button", { name: "Mark as favorite" }).first().click();
  // Tab to Favorites and confirm exactly one card is visible
  await page.getByRole("tab", { name: "Favorites" }).click();
  await expect(page.getByRole("button", { name: "Unfavorite" })).toBeVisible();
  await page.getByRole("tab", { name: "All" }).click();

  // Edit (F-FOOD-2)
  await page.getByRole("link", { name: /Edit Boiled egg/i }).click();
  await page.waitForURL(/\/foods\/.+\/edit$/);
  await page.getByLabel("Calories per serving (kcal)").fill("80");
  await page.getByRole("button", { name: /save changes/i }).click();
  await page.waitForURL(/\/foods$/);
  await expect(page.getByText(/80 kcal per 50 g/)).toBeVisible();

  // Delete with confirm
  await page.getByRole("button", { name: /Delete Boiled egg/i }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: /^Delete$/ }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText("Boiled egg")).toHaveCount(0);
});

test("a user cannot read or modify another user's food (403)", async ({ browser, request }) => {
  // user A creates a food via the API
  const aCtx = await browser.newContext();
  const aPage = await aCtx.newPage();
  const aEmail = uniqueEmail("ownerA");
  await signupAndLogin(aPage, aEmail);
  await aPage.goto("/foods/new");
  await aPage.getByLabel("Name").fill("PrivateFoodA");
  await aPage.getByLabel("Serving size").fill("100");
  await aPage.getByLabel("Calories per serving (kcal)").fill("200");
  await aPage.getByLabel("Protein (g)").fill("10");
  await aPage.getByLabel("Carbs (g)").fill("20");
  await aPage.getByLabel("Fat (g)").fill("5");
  await aPage.getByRole("button", { name: /add food/i }).click();
  await aPage.waitForURL(/\/foods$/);

  // pull the id from user A's session API
  const aRequest: APIRequestContext = aCtx.request;
  const aFoods = await aRequest
    .get("/api/foods?filter=all")
    .then((r) => r.json() as Promise<{ foods: { id: string; name: string }[] }>);
  const target = aFoods.foods.find((f) => f.name === "PrivateFoodA");
  expect(target).toBeTruthy();
  const targetId = target!.id;

  // user B signs in in a fresh context
  const bCtx = await browser.newContext();
  const bPage = await bCtx.newPage();
  await signupAndLogin(bPage, uniqueEmail("intruderB"));
  const bRequest: APIRequestContext = bCtx.request;

  // GET another user's food -> 403
  const getRes = await bRequest.get(`/api/foods/${targetId}`);
  expect(getRes.status()).toBe(403);

  // PATCH another user's food -> 403
  const patchRes = await bRequest.patch(`/api/foods/${targetId}`, {
    data: { name: "hacked" },
  });
  expect(patchRes.status()).toBe(403);

  // DELETE another user's food -> 403
  const delRes = await bRequest.delete(`/api/foods/${targetId}`);
  expect(delRes.status()).toBe(403);

  // unauthenticated request -> 401
  const anonRes = await request.get(`/api/foods/${targetId}`);
  expect(anonRes.status()).toBe(401);

  // user A's food should still exist and be intact
  const stillThere = await aRequest.get(`/api/foods/${targetId}`);
  expect(stillThere.status()).toBe(200);
  const body = (await stillThere.json()) as { name: string };
  expect(body.name).toBe("PrivateFoodA");

  await aCtx.close();
  await bCtx.close();
});
