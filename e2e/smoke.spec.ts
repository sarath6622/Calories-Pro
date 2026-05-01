import { test, expect } from "@playwright/test";

test("/ redirects unauthenticated visitors to the login page", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();
});
