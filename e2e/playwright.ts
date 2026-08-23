import { expect, test as base } from "@playwright/test";
import type { BrowserContext } from "@playwright/test";
import { createIsolatedBrowserState } from "./support/browser-state.ts";

export const test = base.extend<{ isolatedContext: BrowserContext }>({
  isolatedContext: async ({ browser }, use, testInfo) => {
    const state = await createIsolatedBrowserState(testInfo.title);
    const context = await browser.newContext({
      storageState: state.storageState,
    });
    await use(context);
    await context.close();
  },
});

export { expect };
