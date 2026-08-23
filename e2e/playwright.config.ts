import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "..",
  testMatch: ["e2e/**/*.spec.ts", "spikes/toolchain/e2e/**/*.spec.ts"],
  timeout: 30_000,
  workers: 1,
  fullyParallel: false,
  reporter: "line",
  outputDir: "../.e2e-artifacts/playwright",
  use: {
    headless: true,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
});
