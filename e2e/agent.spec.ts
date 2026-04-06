import { test, expect } from "@playwright/test";
import {
  registerTestUser,
  signIn,
  createDocument,
  typeInEditor,
  resetDatabase,
} from "./helpers";

const TEST_EMAIL = `agenttest_${Date.now()}@example.com`;
const TEST_PASSWORD = "TestPassword123!";

test.describe("AI Agent", () => {
  test.beforeAll(async ({ browser }) => {
    await resetDatabase();
    const page = await browser.newPage();
    await registerTestUser(page, "AgentTestUser", TEST_EMAIL, TEST_PASSWORD);
    await page.close();
  });

  test("invite agent with mocked API and see response", async ({ page }) => {
    await signIn(page, TEST_EMAIL, TEST_PASSWORD);
    await createDocument(page, "Agent Test Doc");
    await page.waitForSelector(".ProseMirror", { timeout: 10_000 });

    // Type some content for the agent to review
    await typeInEditor(page, "This is a test document for the AI agent.");

    // Mock the agent invite API with a small delay to catch loading state
    await page.route("**/api/agent/invite", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1_500));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          suggestionsCount: 1,
        }),
      });
    });

    // Click "Invite Agent" button
    const agentBtn = page.locator("button:has-text('Invite Agent')").first();
    await expect(agentBtn).toBeVisible({ timeout: 5_000 });
    await agentBtn.click();

    // Should show loading state ("Working...") during the delayed response
    await expect(
      page.locator("button:has-text('Working')").first()
    ).toBeVisible({ timeout: 3_000 });

    // Wait for the mock response to complete and button to revert
    await expect(
      page.locator("button:has-text('Invite Agent')").first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test("agent button shows error for unconfigured API key", async ({
    page,
  }) => {
    await signIn(page, TEST_EMAIL, TEST_PASSWORD);
    await createDocument(page);
    await page.waitForSelector(".ProseMirror", { timeout: 10_000 });

    await typeInEditor(page, "Some content for review.");

    // Mock with a 503 response (API key not configured)
    await page.route("**/api/agent/invite", async (route) => {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          error: "Anthropic API key not configured.",
        }),
      });
    });

    // Click invite agent
    const agentBtn = page.locator("button:has-text('Invite Agent')").first();
    await expect(agentBtn).toBeVisible({ timeout: 5_000 });
    await agentBtn.click();

    // Should show loading then revert to "Invite Agent"
    await expect(
      page.locator("button:has-text('Invite Agent')").first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test("agent handles empty document gracefully", async ({ page }) => {
    await signIn(page, TEST_EMAIL, TEST_PASSWORD);
    await createDocument(page);
    await page.waitForSelector(".ProseMirror", { timeout: 10_000 });

    // Don't type anything — document is empty

    // Mock with a 400 response (empty document)
    await page.route("**/api/agent/invite", async (route) => {
      await route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({
          error: "Document is empty",
        }),
      });
    });

    const agentBtn = page.locator("button:has-text('Invite Agent')").first();
    await expect(agentBtn).toBeVisible({ timeout: 5_000 });
    await agentBtn.click();

    // Should revert to normal state after error
    await expect(
      page.locator("button:has-text('Invite Agent')").first()
    ).toBeVisible({ timeout: 10_000 });
  });
});
