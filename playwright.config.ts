import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: "list",
  timeout: 60000,
  use: {
    baseURL: "http://localhost:3099",
    trace: "on-first-retry",
  },
  webServer: {
    command: "PORT=3099 pnpm start",
    url: "http://localhost:3099",
    reuseExistingServer: true,
    timeout: 120000,
  },
});
