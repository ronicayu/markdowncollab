import { test, expect } from "@playwright/test";
import {
  registerTestUser,
  signIn,
  createDocument,
  resetDatabase,
} from "./helpers";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";

const TEST_EMAIL = `r15_${Date.now()}@example.com`;
const TEST_PASSWORD = "TestPassword123!";

test.describe("R15 Features", () => {
  test.setTimeout(60_000);

  test.beforeAll(async ({ browser }) => {
    await resetDatabase();
    const page = await browser.newPage();
    await registerTestUser(page, "R15TestUser", TEST_EMAIL, TEST_PASSWORD);
    await page.close();
  });

  test.beforeEach(async ({ page }) => {
    await signIn(page, TEST_EMAIL, TEST_PASSWORD);
  });

  test("can import a markdown file", async ({ page }) => {
    // Create a temporary .md file for import
    const tmpDir = os.tmpdir();
    const tmpFile = path.join(tmpDir, `test-import-${Date.now()}.md`);
    fs.writeFileSync(tmpFile, "# Imported Heading\n\nImported body text.");

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // The import input is hidden; set the file directly via the file chooser
    const fileInput = page.locator('input[type="file"][accept*=".md"]');
    await fileInput.setInputFiles(tmpFile);

    // Wait for the import API call to complete and redirect to the new doc
    await page.waitForResponse(
      (resp) =>
        resp.url().includes("/api/documents/import") && resp.status() === 200,
      { timeout: 10_000 }
    );

    // After import the app redirects to the new document editor
    await page.waitForURL(/\/doc\//, { timeout: 10_000 });
    expect(page.url()).toContain("/doc/");

    // Clean up temp file
    fs.unlinkSync(tmpFile);
  });

  test("can bulk select and delete documents", async ({ page }) => {
    // Create two test documents
    await createDocument(page, "BulkDelete_A");
    await page.goto("/");
    await createDocument(page, "BulkDelete_B");
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Verify both documents are visible
    await expect(page.locator("text=BulkDelete_A")).toBeVisible({ timeout: 5_000 });
    await expect(page.locator("text=BulkDelete_B")).toBeVisible({ timeout: 5_000 });

    // Select both documents via their checkboxes
    const checkboxA = page
      .locator("a:has-text('BulkDelete_A')")
      .locator("..")
      .locator("..")
      .locator('input[type="checkbox"]');
    const checkboxB = page
      .locator("a:has-text('BulkDelete_B')")
      .locator("..")
      .locator("..")
      .locator('input[type="checkbox"]');

    await checkboxA.check();
    await checkboxB.check();

    // Verify bulk action bar appears with correct count
    await expect(page.locator("text=2 selected")).toBeVisible({ timeout: 3_000 });

    // Click the bulk Delete button
    const deleteBtn = page.locator("button:has-text('Delete')").first();
    await deleteBtn.click();

    // Wait for delete API calls to complete
    await page.waitForResponse(
      (resp) => resp.url().includes("/api/documents") && resp.request().method() === "DELETE",
      { timeout: 10_000 }
    );

    // Verify documents are removed from the list
    await expect(page.locator("text=BulkDelete_A")).not.toBeVisible({ timeout: 5_000 });
    await expect(page.locator("text=BulkDelete_B")).not.toBeVisible({ timeout: 5_000 });
  });

  test("can pin and unpin a document", async ({ page }) => {
    const docId = await createDocument(page, "PinTestDoc");
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Verify the document is visible
    await expect(page.locator("text=PinTestDoc")).toBeVisible({ timeout: 5_000 });

    // Click the pin button on the document
    const pinBtn = page.locator('button[title="Pin document"]').first();
    await pinBtn.click();

    // Wait for pin API to return { pinned: true }
    const pinResponse = await page.waitForResponse(
      (resp) => resp.url().includes(`/api/documents/${docId}/pin`) && resp.status() === 200,
      { timeout: 5_000 }
    );
    const pinData = await pinResponse.json();
    expect(pinData.pinned).toBe(true);

    // Button title should now say "Unpin document"
    await expect(page.locator('button[title="Unpin document"]').first()).toBeVisible({
      timeout: 3_000,
    });

    // Click again to unpin
    const unpinBtn = page.locator('button[title="Unpin document"]').first();
    await unpinBtn.click();

    // Wait for unpin API to return { pinned: false }
    const unpinResponse = await page.waitForResponse(
      (resp) => resp.url().includes(`/api/documents/${docId}/pin`) && resp.status() === 200,
      { timeout: 5_000 }
    );
    const unpinData = await unpinResponse.json();
    expect(unpinData.pinned).toBe(false);

    // Button title should revert to "Pin document"
    await expect(page.locator('button[title="Pin document"]').first()).toBeVisible({
      timeout: 3_000,
    });
  });

  test("search returns results with snippets", async ({ page }) => {
    // Create documents with distinct names for search
    await createDocument(page, "SearchTarget_Unique789");
    await page.goto("/");
    await createDocument(page, "OtherDoc_Unrelated999");
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Type in search box
    const searchInput = page.locator('input[placeholder="Search documents..."]');
    await searchInput.fill("SearchTarget_Unique789");

    // Wait for debounced search API response
    await page.waitForResponse(
      (resp) => resp.url().includes("/api/documents") && resp.url().includes("search"),
      { timeout: 10_000 }
    );

    // Verify matching result appears
    await expect(page.locator("text=SearchTarget_Unique789")).toBeVisible({ timeout: 5_000 });

    // Verify unrelated document is not shown
    await expect(page.locator("text=OtherDoc_Unrelated999")).not.toBeVisible({ timeout: 3_000 });

    // Verify result count text is displayed
    await expect(
      page.locator("text=/\\d+ results? for/")
    ).toBeVisible({ timeout: 5_000 });
  });

  test("sidebars collapse on mobile viewport", async ({ page }) => {
    const docId = await createDocument(page);
    await page.waitForSelector(".ProseMirror", { timeout: 10_000 });

    // Set viewport to mobile dimensions (iPhone X)
    await page.setViewportSize({ width: 375, height: 812 });

    // Wait for layout to re-render after viewport change
    await page.waitForTimeout(500);

    // Sidebars should not be visible on mobile (they auto-collapse at < 768px)
    const outlineSidebar = page.locator('[class*="OutlineSidebar"], [data-testid="outline-sidebar"]');
    const commentSidebar = page.locator('[class*="CommentSidebar"], [data-testid="comment-sidebar"]');

    // Sidebars should be hidden (not visible) on mobile
    if (await outlineSidebar.count() > 0) {
      await expect(outlineSidebar.first()).not.toBeVisible({ timeout: 3_000 });
    }
    if (await commentSidebar.count() > 0) {
      await expect(commentSidebar.first()).not.toBeVisible({ timeout: 3_000 });
    }

    // Verify mobile toolbar appears at bottom (MobileToolbar has md:hidden class, visible on mobile)
    const mobileToolbar = page.locator(".mobile-toolbar-bar, .md\\:hidden.fixed.bottom-0");
    await expect(mobileToolbar.first()).toBeVisible({ timeout: 5_000 });
  });
});
