import { join } from "node:path";
import { expect, test as base } from "@playwright/test";
import type { BrowserContext } from "@playwright/test";
import { createIsolatedBrowserState } from "./support/browser-state.ts";
import { writeRedactedTrace } from "./support/redacted-trace.ts";

export const test = base.extend<{ isolatedContext: BrowserContext }>({
  isolatedContext: async ({ browser }, use, testInfo) => {
    const state = await createIsolatedBrowserState(
      testInfo.title,
      testInfo.outputPath(),
    );
    const context = await browser.newContext({
      storageState: state.storageState,
      viewport: testInfo.project.use.viewport,
    });
    const blockedExternalUrls: string[] = [];
    await context.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      const local = url.protocol === "http:" &&
        url.hostname === "127.0.0.1" && url.port === "5173";
      if (!local && (url.protocol === "http:" || url.protocol === "https:")) {
        blockedExternalUrls.push(`${url.origin}${url.pathname}`);
        await route.abort("blockedbyclient");
        return;
      }
      await route.continue();
    });
    try {
      await use(context);
    } finally {
      const failed = testInfo.status !== testInfo.expectedStatus;
      if (failed) {
        for (const [index, page] of context.pages().entries()) {
          await page.screenshot({
            path: join(state.artifactDirectory, `failure-${index + 1}.png`),
            fullPage: true,
            animations: "disabled",
          }).catch(() => undefined);
        }
        await writeRedactedTrace(
          join(state.artifactDirectory, "failure.json"),
          {
            test: testInfo.title,
            status: testInfo.status,
            expectedStatus: testInfo.expectedStatus,
            blockedExternalUrls,
            errors: testInfo.errors.map((error) => ({
              message: error.message,
              stack: error.stack,
            })),
          },
        );
      }
      await context.close();
    }
  },
});

export { expect };
