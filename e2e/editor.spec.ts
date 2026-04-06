import { test, expect } from "@playwright/test";
import {
  registerTestUser,
  signIn,
  createDocument,
  typeInEditor,
  getEditorContent,
  resetDatabase,
} from "./helpers";

const TEST_EMAIL = `editortest_${Date.now()}@example.com`;
const TEST_PASSWORD = "TestPassword123!";

test.describe("Editor Core", () => {
  test.beforeAll(async ({ browser }) => {
    await resetDatabase();
    const page = await browser.newPage();
    await registerTestUser(page, "EditorTestUser", TEST_EMAIL, TEST_PASSWORD);
    await page.close();
  });

  test.beforeEach(async ({ page }) => {
    await signIn(page, TEST_EMAIL, TEST_PASSWORD);
    await createDocument(page);
    // Wait for editor to be ready
    await page.waitForSelector(".ProseMirror", { timeout: 10_000 });
  });

  test("type text and verify content", async ({ page }) => {
    await typeInEditor(page, "Hello, world!");

    const content = await getEditorContent(page);
    expect(content).toContain("Hello, world!");
  });

  test("apply bold formatting", async ({ page }) => {
    await typeInEditor(page, "bold text");

    // Select all text
    await page.keyboard.press("Meta+a");
    // Apply bold
    await page.keyboard.press("Meta+b");

    // Verify bold is applied
    const hasBold = await page.locator(".ProseMirror strong").isVisible();
    expect(hasBold).toBeTruthy();
  });

  test("apply italic formatting", async ({ page }) => {
    await typeInEditor(page, "italic text");

    await page.keyboard.press("Meta+a");
    await page.keyboard.press("Meta+i");

    const hasItalic = await page.locator(".ProseMirror em").isVisible();
    expect(hasItalic).toBeTruthy();
  });

  test("create a heading via toolbar", async ({ page }) => {
    await typeInEditor(page, "My Heading");

    // Select all text
    await page.keyboard.press("Meta+a");

    // Click H1 button in toolbar (has label "Heading 1")
    const h1Button = page.locator('button[title*="Heading 1"]').first();
    await h1Button.click();

    // Verify heading exists in editor
    const hasH1 = await page.locator(".ProseMirror h1").isVisible();
    expect(hasH1).toBeTruthy();
  });

  test("use slash command menu", async ({ page }) => {
    // Click into the editor
    await page.locator(".ProseMirror").click();

    // Type slash to trigger the menu
    await page.keyboard.type("/");

    // Wait for slash command menu to appear (it contains buttons with data-selected attribute)
    await expect(
      page.locator('[data-selected="true"]').first()
    ).toBeVisible({
      timeout: 3_000,
    });

    // Verify it shows slash command items like "Heading 1"
    await expect(page.locator("text=Heading 1")).toBeVisible();
  });

  test("undo and redo", async ({ page }) => {
    await typeInEditor(page, "first text");
    const contentBefore = await getEditorContent(page);
    expect(contentBefore).toContain("first text");

    // Undo
    await page.keyboard.press("Meta+z");

    // Redo
    await page.keyboard.press("Meta+Shift+z");
    const contentAfterRedo = await getEditorContent(page);
    expect(contentAfterRedo).toContain("first text");
  });
});
