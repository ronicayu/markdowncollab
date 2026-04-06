import { test, expect } from "@playwright/test";
import {
  registerTestUser,
  signIn,
  createDocument,
  resetDatabase,
} from "./helpers";

const TEST_EMAIL = `doctest_${Date.now()}@example.com`;
const TEST_PASSWORD = "TestPassword123!";

test.describe("Document Management", () => {
  test.beforeAll(async ({ browser }) => {
    await resetDatabase();
    const page = await browser.newPage();
    await registerTestUser(page, "DocTestUser", TEST_EMAIL, TEST_PASSWORD);
    await page.close();
  });

  test.beforeEach(async ({ page }) => {
    await signIn(page, TEST_EMAIL, TEST_PASSWORD);
  });

  test("create a new document", async ({ page }) => {
    const docId = await createDocument(page);
    expect(docId).toBeTruthy();
    expect(page.url()).toContain(`/doc/${docId}`);
  });

  test("rename a document via TopBar input", async ({ page }) => {
    const docId = await createDocument(page);

    // Wait for editor to load
    await page.waitForSelector(".ProseMirror", { timeout: 10_000 });

    // Find the title input in the TopBar (the one near the MC breadcrumb)
    const titleInput = page.locator("input.font-semibold").first();
    await titleInput.click();
    await titleInput.fill("Renamed Document");
    await titleInput.press("Enter");

    // Wait for the API call to complete
    await page.waitForTimeout(1500);

    // Navigate back to document list
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Verify the renamed document appears
    await expect(page.locator("text=Renamed Document")).toBeVisible({
      timeout: 5_000,
    });
  });

  test("duplicate a document", async ({ page }) => {
    await createDocument(page, "Original Doc");
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Hover over the document to reveal the action buttons
    const docRow = page.locator("text=Original Doc").first();
    await docRow.hover();

    // Click duplicate button
    const duplicateBtn = page.locator('[title="Duplicate document"]').first();
    await duplicateBtn.click();

    // Verify the copy appears
    await expect(page.locator("text=Original Doc (copy)")).toBeVisible({
      timeout: 5_000,
    });
  });

  test("delete a document", async ({ page }) => {
    await createDocument(page, "Doc To Delete");
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Wait for the document to appear in the list
    await expect(page.locator("text=Doc To Delete")).toBeVisible({ timeout: 5_000 });

    // Hover over the document row to reveal action buttons
    const docLink = page.locator("a:has-text('Doc To Delete')").first();
    await docLink.hover();

    // Click delete button
    const deleteBtn = page.locator('[title="Delete document"]').first();
    await deleteBtn.click();

    // Confirm deletion in modal
    const confirmBtn = page.locator("button.bg-red-500:has-text('Delete')");
    await confirmBtn.click();

    // Verify document is gone
    await expect(page.locator("text=Doc To Delete")).not.toBeVisible({
      timeout: 5_000,
    });
  });

  test("search documents", async ({ page }) => {
    await createDocument(page, "Searchable Alpha");
    await page.goto("/");
    await createDocument(page, "Searchable Beta");
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Type in search box
    await page.fill('input[placeholder="Search documents..."]', "Alpha");

    // Should see Alpha, not Beta
    await expect(page.locator("text=Searchable Alpha")).toBeVisible();
    await expect(page.locator("text=Searchable Beta")).not.toBeVisible();
  });

  test("sort documents by name", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Click sort toggle button (shows current sort, e.g. "Date")
    const sortBtn = page.locator('button:has-text("Date")').first();
    await sortBtn.click();

    // After clicking, should toggle to "Name"
    await expect(page.locator('button:has-text("Name")').first()).toBeVisible({
      timeout: 3_000,
    });
  });
});
