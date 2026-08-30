import { expect, test } from "./playwright.ts";

test.describe("local-first-manual journey", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("local-first-manual saves a first local expense and restores it after reload", async ({ isolatedContext }) => {
    const page = await isolatedContext.newPage();
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "Start tracking expenses" }))
      .toBeVisible();
    await page.getByRole("button", { name: /Create first project/ }).click();
    await expect(page.getByRole("heading", { name: "Create project" }))
      .toBeVisible();

    await page.getByRole("textbox", { name: "Project name" }).fill(
      "Sweden project",
    );
    await page.getByRole("button", { name: "Save project" }).click();
    await expect(page.getByRole("heading", { name: "Expenses", exact: true }))
      .toBeVisible();

    await expect(page.getByRole("button", { name: "Expenses" }))
      .toBeVisible();
    await expect(page.getByRole("button", { name: "Scan" }))
      .toBeVisible();
    await expect(page.getByRole("button", { name: "Organize" }))
      .toBeVisible();
    await expect(page.getByRole("button", { name: "Settings" }))
      .toBeVisible();

    await page.getByRole("button", { name: "Manual" }).click();
    await expect(page.getByRole("heading", { name: "New expense", level: 1 }))
      .toBeVisible();

    await page.getByRole("textbox", { name: "Amount" }).fill("12.50");
    await page.getByRole("searchbox", { name: "Merchant" }).fill(
      "Local market",
    );
    await page.getByRole("button", { name: "Save and add another" }).click();
    await expect(page.getByRole("heading", { name: "New expense", level: 1 }))
      .toBeVisible();
    await expect(page.getByRole("textbox", { name: "Amount" })).toHaveValue("");

    await page.getByRole("textbox", { name: "Amount" }).fill("7.25");
    await page.getByRole("searchbox", { name: "Merchant" }).fill(
      "Second market",
    );
    await page.getByRole("button", { name: "Save expense" }).click();

    await expect(page.getByRole("heading", { name: "Expense saved" }))
      .toBeVisible();
    await page.getByRole("button", { name: "Continue to expenses" }).click();
    await expect(page.getByRole("heading", { name: "Expenses", exact: true }))
      .toBeVisible();
    await expect(page.getByText("Local market")).toBeVisible();
    await expect(page.getByText("Second market")).toBeVisible();
    await expect(
      page.getByLabel("Expenses").getByText("SEK -12.50", { exact: true }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Manual" }).click();
    await expect(page.getByRole("heading", { name: "New expense", level: 1 }))
      .toBeVisible();
    await page.goBack();
    await page.getByRole("button", { name: "Discard changes" }).click();
    await expect(page.getByRole("heading", { name: "Expenses", exact: true }))
      .toBeVisible();

    await page.reload();
    await expect(page.getByRole("heading", { name: "Expenses", exact: true }))
      .toBeVisible();
    await expect(page.getByText("Local market")).toBeVisible();
  });
});
