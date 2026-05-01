import { test, expect } from "@playwright/test";

function uniqueEmail() {
  return `e2e-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.test`;
}

test("signup -> profile edit -> sign out -> sign back in", async ({ page }) => {
  const email = uniqueEmail();
  const password = "test1234abcd";

  await page.goto("/signup");
  await page.getByLabel("Name").fill("Alex E2E");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm password").fill(password);
  await page.getByRole("button", { name: /create account/i }).click();

  await page.waitForURL(/\/profile$/, { timeout: 30_000 });
  await expect(page.getByRole("heading", { name: /your profile/i })).toBeVisible();

  await page.getByLabel("Name").fill("Alex Updated");
  await page.getByLabel("Timezone (IANA)").fill("Asia/Kolkata");
  await page.getByRole("button", { name: /save changes/i }).click();
  await expect(page.getByText("Profile saved.")).toBeVisible();

  await page.reload();
  await expect(page.getByLabel("Name")).toHaveValue("Alex Updated");
  await expect(page.getByLabel("Timezone (IANA)")).toHaveValue("Asia/Kolkata");

  await page.getByRole("button", { name: /sign out/i }).click();
  await page.waitForURL(/\/login$/);

  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/\/profile$/);
  await expect(page.getByLabel("Name")).toHaveValue("Alex Updated");
});

test("middleware redirects unauthenticated visits to /profile back to /login", async ({ page }) => {
  await page.goto("/profile");
  await expect(page).toHaveURL(/\/login\?callbackUrl=.*profile/);
});
