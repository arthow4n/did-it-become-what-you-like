import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const targetDir = process.argv[2] ||
  `ui-audit-${new Date().toISOString().slice(0, 10)}/screenshots`;
const playwright = createRequire(import.meta.url).resolve(
  "@playwright/test/cli",
);

console.log(`[UI/UX Audit] Starting visual capture into: ${targetDir}`);
const result = spawnSync(process.execPath, [
  playwright,
  "test",
  "--config=e2e/playwright.audit.config.ts",
], {
  env: { ...process.env, AUDIT_OUTPUT_DIR: targetDir },
  stdio: "inherit",
});
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
console.log(
  `[UI/UX Audit] Visual capture completed successfully: ${targetDir}`,
);
