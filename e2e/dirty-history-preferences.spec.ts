import { Buffer } from "node:buffer";
import { expect, test } from "./playwright.ts";

test.use({ viewport: { width: 390, height: 844 } });

const ONE_PIXEL_PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

async function createProject(
  page: import("@playwright/test").Page,
): Promise<void> {
  await page.goto("/");
  await page.getByRole("button", { name: /Create first project/ }).click();
  await page.getByRole("textbox", { name: "Project name" }).fill(
    "History project",
  );
  await page.getByRole("button", { name: "Save project" }).click();
  await expect(page.getByRole("heading", { name: "Expenses", exact: true }))
    .toBeVisible();
}

test("dirty manual and receipt history keeps input through Back and discards explicitly", async ({ isolatedContext }) => {
  const page = await isolatedContext.newPage();
  await createProject(page);

  await page.getByRole("button", { name: "Add expense" }).click();
  await page.getByRole("button", { name: /Add manually/ }).click();
  await page.getByRole("textbox", { name: "Amount" }).fill("12.50");
  await page.goBack();
  await expect(page.getByRole("dialog", { name: "Unsaved changes" }))
    .toBeVisible();
  await expect(page.getByRole("textbox", { name: "Amount" })).toHaveValue(
    "12.5",
  );
  await page.getByRole("button", { name: "Keep editing" }).click();
  await expect(page.getByRole("textbox", { name: "Amount" })).toHaveValue(
    "12.5",
  );
  await page.goBack();
  await page.getByRole("button", { name: "Discard changes" }).click();
  await expect(page.getByRole("dialog", { name: "Add an expense" }))
    .toBeVisible();

  await page.getByRole("button", { name: /Scan receipt with AI/ }).click();
  await page.getByRole("button", { name: "Continue to scan" }).click();
  await page.getByLabel("Receipt image file").setInputFiles({
    name: "history-receipt.png",
    mimeType: "image/png",
    buffer: Buffer.from(ONE_PIXEL_PNG, "base64"),
  });
  await expect(page.getByAltText("Selected receipt preview")).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("dialog", { name: "Unsaved changes" }))
    .toBeVisible();
  await expect(page.getByLabel("Receipt image file")).toHaveJSProperty(
    "files.length",
    1,
  );
  await page.getByRole("button", { name: "Keep editing" }).click();
  await expect(page.getByAltText("Selected receipt preview")).toBeVisible();
  await page.goBack();
  await page.getByRole("button", { name: "Discard changes" }).click();
  await expect(page.getByRole("dialog", { name: "Add an expense" }))
    .toBeVisible();
  await expect(page.getByAltText("Selected receipt preview")).toHaveCount(0);
});

test("dirty Preferences uses the shared bottom-navigation decision and preserves or discards its time", async ({ isolatedContext }) => {
  const page = await isolatedContext.newPage();
  await createProject(page);

  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("listitem").filter({ hasText: "Preferences" })
    .getByRole("button", { name: "Open" }).click();
  const input = page.getByLabel("Expense-day boundary");
  await expect(input).toHaveValue("03:00");
  await page.getByRole("main").getByRole("button", { name: "Settings" })
    .click();
  await expect(page.getByRole("heading", { name: "Settings", exact: true }))
    .toBeVisible();
  await page.goBack();
  await expect(input).toHaveValue("03:00");
  await input.fill("04:30");

  await page.goForward();
  await expect(page.getByRole("dialog", { name: "Unsaved changes" }))
    .toBeVisible();
  await expect(input).toHaveValue("04:30");
  await page.getByRole("button", { name: "Keep editing" }).click();
  await expect(input).toHaveValue("04:30");

  await page.getByRole("button", { name: "Expenses" }).click();
  await expect(page.getByRole("dialog", { name: "Unsaved changes" }))
    .toBeVisible();
  await page.getByRole("button", { name: "Keep editing" }).click();
  await expect(input).toHaveValue("04:30");

  await page.getByRole("button", { name: "Expenses" }).click();
  await page.getByRole("button", { name: "Discard changes" }).click();
  await expect(page.getByRole("heading", { name: "Expenses", exact: true }))
    .toBeVisible();

  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("listitem").filter({ hasText: "Preferences" })
    .getByRole("button", { name: "Open" }).click();
  await expect(page.getByLabel("Expense-day boundary")).toHaveValue("03:00");
});
