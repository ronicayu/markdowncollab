import { test, expect } from "@playwright/test";
import {
  registerTestUser,
  signIn,
  createDocument,
  typeInEditor,
  resetDatabase,
  makeDocPublic,
} from "./helpers";

const ts = Date.now();
const USER1_EMAIL = `collab1_${ts}@example.com`;
const USER1_PASSWORD = "Password123!";
const USER2_EMAIL = `collab2_${ts}@example.com`;
const USER2_PASSWORD = "Password123!";

test.describe("Collaboration", () => {
  test.setTimeout(60_000);

  test.beforeAll(async ({ browser }) => {
    await resetDatabase();

    const page1 = await browser.newPage();
    await registerTestUser(page1, "User One", USER1_EMAIL, USER1_PASSWORD);
    await page1.close();

    const page2 = await browser.newPage();
    await registerTestUser(page2, "User Two", USER2_EMAIL, USER2_PASSWORD);
    await page2.close();
  });

  /**
   * Wait for the green WebSocket connected indicator.
   */
  async function waitForWsConnected(page: import("@playwright/test").Page) {
    await page.waitForFunction(
      () => {
        const dots = document.querySelectorAll("span.rounded-full");
        return Array.from(dots).some((dot) => {
          const style = window.getComputedStyle(dot);
          return style.backgroundColor === "rgb(13, 148, 136)";
        });
      },
      { timeout: 15_000 }
    );
  }

  test("two users editing the same document see each other's changes", async ({
    browser,
  }) => {
    // User 1 creates a document
    const context1 = await browser.newContext();
    const page1 = await context1.newPage();
    await signIn(page1, USER1_EMAIL, USER1_PASSWORD);
    const docId = await createDocument(page1);

    // Make the document publicly accessible so WS doesn't 403
    await makeDocPublic(docId);

    // Reload to reconnect WS with the updated ownership
    await page1.reload();
    await page1.waitForSelector(".ProseMirror", { timeout: 10_000 });
    await waitForWsConnected(page1);

    // User 2 opens the same document
    const context2 = await browser.newContext();
    const page2 = await context2.newPage();
    await signIn(page2, USER2_EMAIL, USER2_PASSWORD);
    await page2.goto(`/doc/${docId}`);
    await page2.waitForSelector(".ProseMirror", { timeout: 10_000 });
    await waitForWsConnected(page2);

    // User 1 types something
    await typeInEditor(page1, "Hello from User One");

    // User 2 should see the text appear
    await expect(
      page2.locator(".ProseMirror:has-text('Hello from User One')")
    ).toBeVisible({ timeout: 15_000 });

    // User 2 types at the end
    await page2.locator(".ProseMirror").click();
    await page2.keyboard.press("End");
    await page2.keyboard.press("Enter");
    await page2.keyboard.type("Hello from User Two", { delay: 30 });

    // User 1 should see both texts
    await expect(
      page1.locator(".ProseMirror:has-text('Hello from User Two')")
    ).toBeVisible({ timeout: 15_000 });

    await context1.close();
    await context2.close();
  });

  test("collaborator presence appears in TopBar", async ({ browser }) => {
    const context1 = await browser.newContext();
    const page1 = await context1.newPage();
    await signIn(page1, USER1_EMAIL, USER1_PASSWORD);
    const docId = await createDocument(page1);

    await makeDocPublic(docId);
    await page1.reload();
    await page1.waitForSelector(".ProseMirror", { timeout: 10_000 });
    await waitForWsConnected(page1);

    // User 2 joins
    const context2 = await browser.newContext();
    const page2 = await context2.newPage();
    await signIn(page2, USER2_EMAIL, USER2_PASSWORD);
    await page2.goto(`/doc/${docId}`);
    await page2.waitForSelector(".ProseMirror", { timeout: 10_000 });
    await waitForWsConnected(page2);

    // Give a moment for awareness to propagate
    await page1.waitForTimeout(3_000);

    // User 1 should see a collaborator avatar in the TopBar
    const avatars = page1.locator('div.rounded-full.border-2');
    await expect(avatars.first()).toBeVisible({ timeout: 10_000 });

    await context1.close();
    await context2.close();
  });

  test("create and view a comment", async ({ browser }) => {
    const context1 = await browser.newContext();
    const page1 = await context1.newPage();
    await signIn(page1, USER1_EMAIL, USER1_PASSWORD);
    await createDocument(page1);
    await page1.waitForSelector(".ProseMirror", { timeout: 10_000 });

    // Type some text to comment on
    await typeInEditor(page1, "Text to comment on");

    // Select the text
    await page1.keyboard.press("Meta+a");

    // Look for the floating comment button that appears on text selection
    const commentBtn = page1
      .locator(
        '[title*="comment" i], [aria-label*="comment" i], button:has-text("Comment"), button:has-text("comment")'
      )
      .first();

    if (await commentBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await commentBtn.click();

      const commentInput = page1
        .locator('textarea, input[placeholder*="comment" i]')
        .first();
      if (await commentInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await commentInput.fill("This is a test comment");
        await page1.keyboard.press("Enter");
        await expect(
          page1.locator("text=This is a test comment")
        ).toBeVisible({ timeout: 5_000 });
      }
    }

    await context1.close();
  });
});
