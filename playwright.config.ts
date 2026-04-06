import { defineConfig, devices } from "@playwright/test";

const E2E_PORT = process.env.E2E_PORT || "3099";
const BASE_URL = `http://localhost:${E2E_PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [["html", { open: "never" }], ["list"]],
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "off",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: `PORT=${E2E_PORT} DATABASE_URL=file:./test.db node server/combined-server.mjs`,
    url: BASE_URL,
    reuseExistingServer: false,
    timeout: 30_000,
    env: {
      NODE_ENV: "test",
      PORT: E2E_PORT,
      DATABASE_URL: "file:./test.db",
      NEXTAUTH_SECRET: "test-secret-for-e2e",
      NEXTAUTH_URL: BASE_URL,
    },
  },
});
