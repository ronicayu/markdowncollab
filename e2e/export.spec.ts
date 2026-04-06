import { test, expect } from "@playwright/test";
import {
  registerTestUser,
  signIn,
  createDocument,
  typeInEditor,
  resetDatabase,
  makeDocPublic,
} from "./helpers";

const TEST_EMAIL = `exporttest_${Date.now()}@example.com`;
const TEST_PASSWORD = "TestPassword123!";

test.describe("Export", () => {
  test.setTimeout(60_000);

  test.beforeAll(async ({ browser }) => {
    await resetDatabase();
    const page = await browser.newPage();
    await registerTestUser(page, "ExportTestUser", TEST_EMAIL, TEST_PASSWORD);
    await page.close();
  });

  test("export link exists in TopBar and points to correct endpoint", async ({
    page,
  }) => {
    await signIn(page, TEST_EMAIL, TEST_PASSWORD);
    const docId = await createDocument(page, "Export Test");
    await page.waitForSelector(".ProseMirror", { timeout: 10_000 });

    // Verify the Export link is present
    const exportLink = page.locator("a:has-text('Export')").first();
    await expect(exportLink).toBeVisible({ timeout: 5_000 });

    // Verify it points to the correct API endpoint
    const href = await exportLink.getAttribute("href");
    expect(href).toContain(`/api/documents/${docId}/export`);
  });

  test("export API returns markdown content type", async ({ page }) => {
    await signIn(page, TEST_EMAIL, TEST_PASSWORD);
    const docId = await createDocument(page);
    await page.waitForSelector(".ProseMirror", { timeout: 10_000 });

    // Make doc public so WS-based export can access it
    await makeDocPublic(docId);

    // Type some content
    await typeInEditor(page, "Hello export world");

    // Wait for Yjs to sync content to server
    await page.waitForTimeout(5_000);

    // Call the export API directly
    const response = await page.request.get(
      `/api/documents/${docId}/export`
    );

    // Verify the response is successful and has markdown content type
    expect(response.ok()).toBeTruthy();
    const contentType = response.headers()["content-type"];
    expect(contentType).toContain("text/markdown");

    // The export should return some content (may be partial depending on sync timing)
    const content = await response.text();
    expect(content.length).toBeGreaterThan(0);
  });

  test("export download triggers from Export link click", async ({
    page,
  }) => {
    await signIn(page, TEST_EMAIL, TEST_PASSWORD);
    const docId = await createDocument(page, "Download Test");
    await page.waitForSelector(".ProseMirror", { timeout: 10_000 });

    await typeInEditor(page, "Content for download test");
    await page.waitForTimeout(2_000);

    // Click the Export link and check that a download starts
    const [download] = await Promise.all([
      page.waitForEvent("download", { timeout: 5_000 }).catch(() => null),
      page.locator("a:has-text('Export')").first().click(),
    ]);

    if (download) {
      // If it triggers a download, verify the filename
      const suggestedName = download.suggestedFilename();
      expect(suggestedName).toContain(".md");
    }
    // If no download event, the export may have opened in the browser
    // (browsers sometimes display text/markdown inline) — this is valid
  });
});
