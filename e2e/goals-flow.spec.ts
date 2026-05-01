import { test, expect } from "@playwright/test";

function uniqueEmail() {
  return `e2e-goals-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.test`;
}

test("set profile basics on /profile, then compute and save goals on /settings", async ({
  page,
}) => {
  const email = uniqueEmail();
  const password = "test1234abcd";

  await page.goto("/signup");
  await page.getByLabel("Name").fill("Goals E2E");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm password").fill(password);
  await page.getByRole("button", { name: /create account/i }).click();
  await page.waitForURL(/\/profile$/, { timeout: 30_000 });

  // fill profile so BMR/TDEE can compute
  await page.getByLabel("Date of birth").fill("1990-01-01");
  await page.getByLabel("Sex").click();
  await page.getByRole("option", { name: "male", exact: true }).click();
  await page.getByLabel("Height (cm)").fill("175");
  await page.getByLabel("Weight (kg)").fill("70");
  await page.getByLabel("Activity level").click();
  await page.getByRole("option", { name: /Moderate/i }).click();
  await page.getByRole("button", { name: /save changes/i }).click();
  await expect(page.getByText("Profile saved.")).toBeVisible();

  // settings — TDEE preview should be visible
  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: /Settings/i })).toBeVisible();
  await expect(page.getByText(/BMR \(Mifflin-St Jeor\)/i)).toBeVisible();
  const useButton = page.getByRole("button", { name: /Use \d+ kcal as my goal/i });
  await expect(useButton).toBeVisible();
  await useButton.click();

  // calorie goal field should now be > 0
  const calories = page.getByLabel("Daily calories (kcal)");
  await expect(calories).not.toHaveValue("0");

  // change preset to high protein and save
  await page.getByLabel("Macro split").click();
  await page.getByRole("option", { name: /High protein/i }).click();

  // apply default water
  await page.getByRole("button", { name: /Use 35 ml\/kg/i }).click();
  await expect(page.getByLabel("Daily water (ml)")).toHaveValue("2450");

  await page.getByRole("button", { name: /Save goals/i }).click();
  await expect(page.getByText("Goals saved.")).toBeVisible();

  // reload — values should persist
  await page.reload();
  await expect(page.getByLabel("Daily water (ml)")).toHaveValue("2450");
});

test("settings disables 'Use 35 ml/kg' shortcut when weight is missing", async ({ page }) => {
  const email = uniqueEmail();
  const password = "test1234abcd";

  await page.goto("/signup");
  await page.getByLabel("Name").fill("Goals Nudge");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm password").fill(password);
  await page.getByRole("button", { name: /create account/i }).click();
  await page.waitForURL(/\/profile$/);

  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: /Settings/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /Use 35 ml\/kg/i })).toBeDisabled();
});
