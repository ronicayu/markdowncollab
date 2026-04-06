import { type Page, expect } from "@playwright/test";

/**
 * Register a new test user via the sign-in page (Register tab) and return credentials.
 */
export async function registerTestUser(
  page: Page,
  name = `TestUser_${Date.now()}`,
  email = `test_${Date.now()}@example.com`,
  password = "TestPassword123!"
): Promise<{ name: string; email: string; password: string }> {
  await page.goto("/auth/signin");
  await page.waitForLoadState("networkidle");

  // Click "Register" tab
  await page.click("button:has-text('Register')");

  // Fill registration form (inputs use placeholder, not name)
  await page.fill('input[placeholder="Your name"]', name);
  await page.fill('input[placeholder="Email"]', email);
  await page.fill('input[placeholder="Password"]', password);
  await page.click('button[type="submit"]');

  // Wait for redirect after registration + auto sign-in
  await page.waitForURL("/", { timeout: 15_000 });

  return { name, email, password };
}

/**
 * Sign in with existing credentials.
 */
export async function signIn(
  page: Page,
  email: string,
  password: string
): Promise<void> {
  await page.goto("/auth/signin");
  await page.waitForLoadState("networkidle");

  // Make sure we're on the Sign in tab (not Register)
  const signInTab = page.locator("button:has-text('Sign in')").first();
  await signInTab.click();

  // Fill in credentials
  await page.fill('input[placeholder="Email"]', email);
  await page.fill('input[placeholder="Password"]', password);
  await page.click('button[type="submit"]');

  // Wait for redirect to home page
  await page.waitForURL("/", { timeout: 15_000 });
}

/**
 * Sign out the current user.
 */
export async function signOut(page: Page): Promise<void> {
  const signOutBtn = page.locator("button:has-text('Sign out')").first();
  if (await signOutBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await signOutBtn.click();
  }
  await page.waitForLoadState("networkidle");
}

/**
 * Create a new document and navigate to it.
 * The home page has a "New Document" button that opens a template picker modal.
 * Returns the document ID from the URL.
 */
export async function createDocument(
  page: Page,
  title?: string
): Promise<string> {
  await page.goto("/");
  await page.waitForLoadState("networkidle");

  // Click "New Document" button to open template picker
  await page.click("button:has-text('New Document')");

  // Wait for template picker modal
  await page.waitForSelector('[data-testid="template-picker-backdrop"]', {
    timeout: 5_000,
  });

  // Click the "Blank" template (first option, or the one with "Blank" text)
  const blankBtn = page.locator("button:has-text('Blank')").first();
  await blankBtn.click();

  // Wait for navigation to doc page
  await page.waitForURL(/\/doc\//, { timeout: 10_000 });

  const url = page.url();
  const docId = url.split("/doc/")[1]?.split("?")[0] || "";

  if (title) {
    // Clear and type the new title in the TopBar title input
    const titleInput = page.locator(
      'input.font-semibold'
    ).first();
    await titleInput.fill(title);
    await titleInput.press("Enter");
    // Wait for the title to be saved
    await page.waitForTimeout(500);
  }

  return docId;
}

/**
 * Get text content from the Tiptap editor.
 */
export async function getEditorContent(page: Page): Promise<string> {
  return page
    .locator(".ProseMirror")
    .textContent()
    .then((t) => (t || "").trim());
}

/**
 * Type text into the Tiptap editor.
 */
export async function typeInEditor(
  page: Page,
  text: string
): Promise<void> {
  await page.locator(".ProseMirror").click();
  await page.keyboard.type(text, { delay: 30 });
}

/**
 * Wait for Yjs sync to complete (check for "Connected" indicator).
 */
export async function waitForSync(page: Page): Promise<void> {
  await expect(page.locator("text=Connected")).toBeVisible({ timeout: 10_000 });
}

/**
 * Reset the test database between test suites.
 */
export async function resetDatabase(): Promise<void> {
  const { execSync } = await import("child_process");
  execSync(
    "DATABASE_URL=file:./test.db npx prisma db push --force-reset --accept-data-loss",
    {
      cwd: process.cwd(),
      stdio: "pipe",
    }
  );
}
