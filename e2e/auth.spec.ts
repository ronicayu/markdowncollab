import { test, expect } from "@playwright/test";
import { registerTestUser, signIn, signOut, resetDatabase } from "./helpers";

// Use a fixed email/password so tests don't depend on shared mutable state
const TEST_EMAIL = `authtest_${Date.now()}@example.com`;
const TEST_PASSWORD = "TestPassword123!";
const TEST_NAME = "AuthTestUser";

test.describe("Authentication", () => {
  test.beforeAll(async () => {
    await resetDatabase();
  });

  test("register a new account", async ({ page }) => {
    await page.goto("/auth/signin");
    await page.waitForLoadState("networkidle");

    // Click "Register" tab
    await page.click("button:has-text('Register')");

    // Fill registration form
    await page.fill('input[placeholder="Your name"]', TEST_NAME);
    await page.fill('input[placeholder="Email"]', TEST_EMAIL);
    await page.fill('input[placeholder="Password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');

    // After registration + auto sign-in, should be on the home page
    await page.waitForURL("/", { timeout: 15_000 });
    await expect(page).toHaveURL("/");
  });

  test("sign in with email and password", async ({ page }) => {
    await signIn(page, TEST_EMAIL, TEST_PASSWORD);

    // Should see the document list page heading
    await expect(page.getByRole("heading", { name: "All Documents" })).toBeVisible({
      timeout: 10_000,
    });
  });

  test("sign out", async ({ page }) => {
    await signIn(page, TEST_EMAIL, TEST_PASSWORD);
    await signOut(page);

    // Should see sign-in button (either in sidebar or mobile header)
    await expect(
      page.locator("button:has-text('Sign in')").first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test("redirect to sign-in when accessing doc without auth", async ({
    page,
  }) => {
    // Clear cookies to ensure no session
    await page.context().clearCookies();

    // Try to access a doc page directly
    await page.goto("/doc/some-fake-id");
    await page.waitForLoadState("networkidle");

    // Should see sign-in UI or be redirected to signin page
    const url = page.url();
    const hasSignIn =
      url.includes("signin") ||
      (await page
        .locator("button:has-text('Sign in')")
        .first()
        .isVisible()
        .catch(() => false));
    expect(hasSignIn).toBeTruthy();
  });
});
