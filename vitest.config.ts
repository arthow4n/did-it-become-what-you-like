import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "src/**/*{.test,_test}.{ts,tsx}",
      "scripts/tests/*_test.ts",
      "server/**/*.test.ts",
    ],
  },
});
