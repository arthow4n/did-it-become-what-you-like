import { expect, test } from "./playwright.ts";

test.use({ viewport: { width: 390, height: 844 } });

const PWA_BOUNDARY_KEY = "__DID_IT_BECAME_WHAT_YOU_LIKE_PWA_BOUNDARY__";

async function installFakePwaBoundary(
  page: import("@playwright/test").Page,
): Promise<void> {
  await page.addInitScript(({ boundaryKey }) => {
    let installCalls = 0;
    let reloadCalls = 0;
    const updateListeners: Array<(state: string) => void> = [];
    const updateInstallPort = {
      state: () => "current",
      subscribe: (listener: (state: string) => void) => {
        updateListeners.push(listener);
        return () => undefined;
      },
      check: () =>
        Promise.resolve({
          status: "update-ready",
          version: "e2e-build",
        }),
      install: () => {
        installCalls++;
        return Promise.resolve();
      },
      reload: () => {
        reloadCalls++;
        return Promise.resolve();
      },
    };
    const globals = globalThis as unknown as Record<string, unknown>;
    globals[boundaryKey] = {
      installAvailable: true,
      updateInstallPort,
      updateListeners,
      get installCalls() {
        return installCalls;
      },
      get reloadCalls() {
        return reloadCalls;
      },
    };
  }, { boundaryKey: PWA_BOUNDARY_KEY });
}

async function createProject(
  page: import("@playwright/test").Page,
): Promise<void> {
  await page.goto("/");
  await page.getByRole("button", { name: /Create first project/ }).click();
  await page.getByRole("textbox", { name: "Project name" }).fill(
    "Offline update project",
  );
  await page.getByRole("button", { name: "Save project" }).click();
  await expect(page.getByRole("heading", { name: "Expenses", exact: true }))
    .toBeVisible();
}

test("offline-update keeps local launch, install fallback, update readiness, and dirty input safe", async ({ isolatedContext }) => {
  const page = await isolatedContext.newPage();
  await installFakePwaBoundary(page);
  await createProject(page);

  await page.getByRole("button", { name: "Manual" }).click();
  await page.getByRole("textbox", { name: "Amount" }).fill("12.50");
  await page.getByRole("searchbox", { name: "Merchant" }).fill(
    "Offline market",
  );
  await page.getByRole("button", { name: "Save expense" }).click();
  await expect(page.getByRole("heading", { name: "Expense saved" }))
    .toBeVisible();
  await expect(page.getByRole("button", { name: "Later" })).toBeVisible();
  await page.getByRole("button", { name: "Later" }).click();

  await page.goto("/#/settings/about");
  await expect(page.getByRole("heading", { name: "About" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Install app" })).toBeVisible();
  await page.getByRole("button", { name: "Install app" }).click();
  await expect.poll(() =>
    page.evaluate((key) => {
      const boundary =
        (globalThis as unknown as Record<string, unknown>)[key] as {
          installCalls?: number;
        };
      return boundary.installCalls;
    }, PWA_BOUNDARY_KEY)
  ).toBe(1);

  await page.context().setOffline(true);
  await page.evaluate(() => globalThis.dispatchEvent(new Event("offline")));
  await expect(page.getByText("Update check unavailable offline"))
    .toBeVisible();
  await expect(page.getByRole("heading", { name: "About" })).toBeVisible();

  await page.context().setOffline(false);
  await page.evaluate(() => globalThis.dispatchEvent(new Event("online")));
  await page.goto("/#/settings/about");
  await page.getByRole("button", { name: "Check for updates" }).click();
  await expect(page.getByText("Update ready").first()).toBeVisible();

  await page.evaluate(() => globalThis.location.hash = "#/expense/new");
  await expect(page.getByRole("heading", { name: "New expense" }))
    .toBeVisible();
  await page.getByRole("textbox", { name: "Amount" }).fill("9.99");
  await expect(
    page.getByText("Save or discard unsaved changes before reloading."),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Reload to update" }).first(),
  ).toBeDisabled();
  await expect(
    page.getByText("Save or discard unsaved changes before reloading."),
  ).toBeVisible();
  await expect.poll(() =>
    page.evaluate((key) => {
      const boundary =
        (globalThis as unknown as Record<string, unknown>)[key] as {
          reloadCalls?: number;
        };
      return boundary.reloadCalls;
    }, PWA_BOUNDARY_KEY)
  ).toBe(0);
});
