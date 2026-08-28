/// <reference path="./deno.d.ts" />

const targetDir = Deno.args[0] ||
  `ui-audit-${new Date().toISOString().slice(0, 10)}/screenshots`;

console.log(`[UI/UX Audit] Starting visual capture into: ${targetDir}`);

const command = new Deno.Command(Deno.execPath(), {
  args: [
    "x",
    "-p",
    "npm:@playwright/test@1.62.1",
    "playwright",
    "test",
    "--config=e2e/playwright.audit.config.ts",
  ],
  env: {
    AUDIT_OUTPUT_DIR: targetDir,
  },
  stdout: "inherit",
  stderr: "inherit",
});

const result = await command.output();
if (result.code !== 0) {
  console.error(`[UI/UX Audit] Visual capture failed with code ${result.code}`);
  Deno.exit(result.code);
}

console.log(
  `[UI/UX Audit] Visual capture completed successfully: ${targetDir}`,
);
