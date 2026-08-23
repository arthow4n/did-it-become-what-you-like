/// <reference path="./deno.d.ts" />

import { installAgentBrowser } from "./browser/installer.ts";

const installed = await installAgentBrowser();
const playwright = await new Deno.Command(Deno.execPath(), {
  args: [
    "x",
    "-p",
    "npm:@playwright/test@1.62.1",
    "playwright",
    "install",
    "chromium",
  ],
  stdout: "inherit",
  stderr: "inherit",
}).output();

if (playwright.code !== 0) {
  throw new Error(
    `Playwright Chromium installation exited ${playwright.code}.`,
  );
}
console.log(
  `Installed visual pair for ${installed.platform} and Playwright Chromium.`,
);
