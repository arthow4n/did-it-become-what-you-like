import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "..",
  testMatch: ["e2e/audit/**/*.spec.ts"],
  webServer: {
    command: "deno task dev --host 127.0.0.1",
    url: "http://127.0.0.1:5173/did-it-become-what-you-like/",
    reuseExistingServer: true,
    timeout: 30_000,
  },
  timeout: 90_000,
  workers: 1,
  fullyParallel: false,
  reporter: "line",
  outputDir: "../.e2e-artifacts/playwright-audit",
  use: {
    headless: true,
    baseURL: "http://127.0.0.1:5173/did-it-become-what-you-like/",
  },
});
