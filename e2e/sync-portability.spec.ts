import { expect, test } from "./playwright.ts";
import type { Page } from "@playwright/test";

const BOUNDARY_KEY = "__DID_IT_BECAME_WHAT_YOU_LIKE_SYNC_BOUNDARY__";

async function installFakeDrive(
  page: Page,
  options: { readonly withConflict?: boolean } = {},
): Promise<void> {
  await page.addInitScript(({ boundaryKey, withConflict }) => {
    let authorizationCount = 0;
    let writeCount = 0;
    let conflictReturned = false;
    const files = new Map<string, {
      readonly id: string;
      readonly name: string;
      readonly body: string;
      readonly etag: string;
      readonly updatedAt: string;
    }>();
    const emptyDataset = {
      schemaVersion: 1,
      format: "did-it-become-what-you-like.dataset",
      projects: [],
      categories: [],
      expenses: [],
      receipts: [],
      receiptPurchaseLines: [],
      receiptAdjustments: [],
      devices: [],
      tombstones: [],
      retirementMarkers: [],
      revisions: [],
      settings: {
        schemaVersion: 1,
        type: "portable-settings",
        id: "settings-portable",
        expenseDayBoundary: "03:00",
      },
    };
    const emptySnapshot = () => ({
      generation: 0,
      heads: [],
      changes: [],
      dataset: emptyDataset,
    });
    const conflictRecord = {
      schemaVersion: 1,
      type: "expense",
      id: "expense-conflict",
      projectId: "project-conflict",
      categoryId: "category-uncategorized",
      date: "2026-08-24",
      amount: "-10",
      currency: "SEK",
      description: "Conflict item",
      source: "manual",
    };
    const causal = {
      read: () => Promise.resolve(emptySnapshot()),
      exportPacket: () =>
        Promise.resolve({ generation: 0, heads: [], changes: [] }),
      applyPacket: (packet: {
        readonly generation: number;
        readonly heads: readonly string[];
        readonly changes: readonly unknown[];
      }) => {
        const conflicts = withConflict && !conflictReturned
          ? (() => {
            conflictReturned = true;
            return [{
              id: "conflict-routed",
              recordType: "expense",
              recordId: "expense-conflict",
              local: { ...conflictRecord, merchant: "Local market" },
              remote: { ...conflictRecord, merchant: "Remote market" },
              relatedChangeIds: ["change-local", "change-remote"],
            }];
          })()
          : [];
        return Promise.resolve({
          snapshot: {
            generation: packet.generation,
            heads: packet.heads,
            changes: packet.changes,
            dataset: emptyDataset,
          },
          appliedChangeIds: [],
          conflicts,
        });
      },
    };
    const drive = {
      status: () => "signed-out",
      authorize: () => {
        authorizationCount += 1;
        return Promise.resolve({
          accountId: authorizationCount === 1
            ? "first@example.com"
            : "second@example.com",
          scopes: ["appDataFolder"],
        });
      },
      disconnect: () => Promise.resolve(),
      deleteEverywhere: () => Promise.resolve(),
      readRetirementMarker: () => Promise.resolve(undefined),
      listAppData: () => Promise.resolve([...files.values()]),
      readAppData: (name: string) => Promise.resolve(files.get(name)),
      writeAppData: (request: {
        readonly name: string;
        readonly body: string;
        readonly expectedEtag?: string;
      }) => {
        const current = files.get(request.name);
        if (
          request.expectedEtag !== undefined &&
          request.expectedEtag !== current?.etag
        ) {
          return Promise.reject({ code: "conflict" });
        }
        writeCount += 1;
        const file = {
          id: current?.id ?? `fake-file-${writeCount}`,
          name: request.name,
          body: request.body,
          etag: `fake-etag-${writeCount}`,
          updatedAt: new Date().toISOString(),
        };
        files.set(request.name, file);
        return Promise.resolve(file);
      },
      deleteAppData: (name: string) => {
        files.delete(name);
        return Promise.resolve();
      },
    };
    const globals = globalThis as unknown as Record<string, unknown>;
    globals[boundaryKey] = { drive, causal };
  }, {
    boundaryKey: BOUNDARY_KEY,
    withConflict: options.withConflict === true,
  });
}

async function createProject(page: Page, name: string): Promise<void> {
  await page.goto("/");
  await page.getByRole("button", { name: /Create first project/ }).click();
  await page.getByRole("textbox", { name: "Project name" }).fill(name);
  await page.getByRole("button", { name: "Save project" }).click();
  await expect(page.getByRole("heading", { name: "Expenses", exact: true }))
    .toBeVisible();
}

test("drive-reconnect routes authorization, account switching, sync, and reconnect through the fake Drive boundary", async ({ isolatedContext }) => {
  const page = await isolatedContext.newPage();
  await installFakeDrive(page);
  await createProject(page, "Drive journey project");
  await page.goto("/#/settings/sync");

  await page.getByRole("button", { name: "Connect Google Drive" }).click();
  await expect(page.getByText("first@example.com")).toBeVisible();
  await expect(page.getByText("Status: Synced")).toBeVisible();
  await page.getByRole("button", { name: "Sync now" }).click();
  await expect(page.getByRole("button", { name: "Sync now" })).toBeEnabled();

  await page.getByRole("button", { name: "Switch Google account" }).click();
  await expect(page.getByText("second@example.com", { exact: true }))
    .toBeVisible();
  await expect(page.getByRole("button", { name: "Switch account" }))
    .toBeVisible();
  await page.getByRole("button", { name: "Switch account" }).click();
  await expect(page.getByText("second@example.com", { exact: true }))
    .toBeVisible();

  await page.getByRole("button", { name: "Disconnect this device" }).click();
  await expect(page.getByRole("button", { name: "Connect Google Drive" }))
    .toBeVisible();
  await page.getByRole("button", { name: "Connect Google Drive" }).click();
  await expect(page.getByText("second@example.com", { exact: true }))
    .toBeVisible();
});

test("conflict-resolution routes field candidates and clears the global banner only after local resolution", async ({ isolatedContext }) => {
  const page = await isolatedContext.newPage();
  await installFakeDrive(page, { withConflict: true });
  await createProject(page, "Conflict journey project");
  await page.goto("/#/settings/sync");
  await page.getByRole("button", { name: "Connect Google Drive" }).click();
  await expect(page.getByText("first@example.com")).toBeVisible();
  await page.getByRole("button", { name: "Sync now" }).click();
  await expect(page.getByText("Conflicts need review")).toBeVisible();

  await page.goto("/#/settings/conflicts");
  await page.getByRole("button", { name: /Expense record/ }).click();
  await expect(page.getByText("Conflicting field: Merchant")).toBeVisible();
  await expect(page.getByRole("button", { name: "Choose this value" }))
    .toHaveCount(2);
  await page.getByRole("button", { name: "Choose this value" }).first().click();
  await page.getByRole("button", { name: "Save and review next" }).click();
  await expect(page.getByText("No conflicts need review")).toBeVisible();

  await page.goto("/#/settings/sync");
  await expect(page.getByText("Connected account")).toBeVisible();
  await expect(page.getByText("Conflicts need review")).toHaveCount(0);
});
