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

    // Closed shared pickers must not mount complete hidden catalogues. Opening
    // still supports the keyboard, search, and all currencies with native scroll.
    const currency = page.getByRole("combobox", {
      name: "Currency",
      exact: true,
    });
    await expect(page.getByRole("option", { includeHidden: true })).toHaveCount(
      0,
    );
    await currency.focus();
    await expect(currency).toHaveAttribute("aria-expanded", "false");
    await currency.press("ArrowDown");
    await expect(currency).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByRole("option", { name: "USD", exact: true }))
      .toBeAttached();
    const options = page.locator(".ds-select-options:visible");
    expect(
      await options.evaluate((element) => getComputedStyle(element).overflowY),
    ).toBe("auto");
    await currency.fill("USD");
    await expect(page.getByRole("option", { name: "USD", exact: true }))
      .toBeVisible();
    await currency.press("ArrowDown");
    await currency.press("Enter");
    await expect(currency).toHaveValue("USD");
    await expect(page.getByRole("option", { includeHidden: true })).toHaveCount(
      0,
    );
    await currency.click();
    await currency.fill("SEK");
    await page.getByRole("option", { name: "SEK", exact: true }).click();
    await expect(currency).toHaveValue("SEK");

    await page.getByRole("textbox", { name: "Amount" }).fill("12.50");
    await page.getByRole("searchbox", { name: "Merchant" }).fill(
      "Local market",
    );
    await page.getByRole("button", { name: "Save expense" }).click();
    await expect(page.getByRole("heading", { name: "Expenses", exact: true }))
      .toBeVisible();
    await page.getByRole("button", { name: "Manual" }).click();
    await expect(page.getByRole("heading", { name: "New expense", level: 1 }))
      .toBeVisible();
    await expect(page.getByRole("textbox", { name: "Amount" })).toHaveValue("");

    await page.getByRole("textbox", { name: "Amount" }).fill("7.25");
    await page.getByRole("searchbox", { name: "Merchant" }).fill(
      "Second market",
    );
    await page.getByRole("button", { name: "Save expense" }).click();

    await expect(page.getByRole("heading", { name: "Expenses", exact: true }))
      .toBeVisible();
    await expect(page.getByText("Local market", { exact: true })).toBeVisible();
    await expect(page.getByText("Second market", { exact: true }))
      .toBeVisible();
    await expect(
      page.getByLabel("Expenses").getByText("SEK -12.50", { exact: true }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Manual" }).click();
    await expect(page.getByRole("heading", { name: "New expense", level: 1 }))
      .toBeVisible();
    await page.goBack();
    await expect(page.getByRole("heading", { name: "Expenses", exact: true }))
      .toBeVisible();
    await expect(page.getByRole("dialog", { name: "Unsaved changes" }))
      .toHaveCount(0);

    await page.getByRole("button", { name: "Manual" }).click();
    await expect(page.getByRole("textbox", { name: "Amount" })).toBeVisible();
    await page.getByRole("textbox", { name: "Amount" }).fill("2.00");
    await page.goBack();
    await expect(page.getByRole("dialog", { name: "Unsaved changes" }))
      .toBeVisible();
    await page.getByRole("button", { name: "Discard changes" }).click();
    await expect(page.getByRole("heading", { name: "Expenses", exact: true }))
      .toBeVisible();

    await page.getByRole("button", { name: "Manual" }).click();
    await expect(page.getByRole("textbox", { name: "Amount" })).toBeVisible();
    await page.getByRole("textbox", { name: "Amount" }).fill("3.00");
    await expect(page.getByRole("dialog", { name: "Unsaved changes" }))
      .toHaveCount(0);
    await page.getByRole("button", { name: "Expenses" }).click();
    await expect(page.getByRole("dialog", { name: "Unsaved changes" }))
      .toBeVisible();
    await page.getByRole("button", { name: "Discard changes" }).click();
    await expect(page.getByRole("heading", { name: "Expenses", exact: true }))
      .toBeVisible();

    await page.reload();
    await expect(page.getByRole("heading", { name: "Expenses", exact: true }))
      .toBeVisible();
    await expect(page.getByText("Local market", { exact: true })).toBeVisible();
  });
});
