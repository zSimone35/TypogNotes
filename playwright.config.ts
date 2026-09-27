import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  use: { baseURL: "http://localhost:1420", browserName: "chromium" },
  webServer: { command: "npm run dev", url: "http://localhost:1420", reuseExistingServer: true },
});
