import { expect, test } from "./playwright.ts";

for (
  const viewport of [
    { width: 1280, height: 800 },
    { width: 390, height: 844 },
    { width: 320, height: 568 },
  ]
) {
  test(`category management creates persistent categories without overflow at ${viewport.width}px`, async ({ isolatedContext }) => {
    const page = await isolatedContext.newPage();
    await page.setViewportSize(viewport);
    await page.goto("/");
    await page.getByRole("button", { name: /Create first project/ }).click();
    await page.getByRole("textbox", { name: "Project name" }).fill("Personal");
    await page.getByRole("button", { name: "Save project" }).click();
    await page.getByRole("heading", { name: "Expenses", exact: true })
      .waitFor();
    await page.getByRole("button", { name: "Organize", exact: true }).click();
    await page.getByText("Categories", { exact: true }).click();

    await page.getByRole("button", { name: "Create category" }).click();
    await expect(page.getByRole("heading", { name: "Create category" }))
      .toBeVisible();
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    const names = [
      "Food",
      "Household essentials and groceries for the entire family",
      "AnUnbrokenCategoryNameThatMustWrapWithoutCrushingItsActionsOrOverflowing",
    ];
    for (const name of names) {
      await page.getByRole("button", { name: "Create category" }).click();
      await page.getByRole("textbox", { name: "Category name" }).fill(name);
      await page.getByRole("button", { name: "Save category" }).click();
      await expect(page.getByRole("heading", { name: "Organize", exact: true }))
        .toBeVisible();
      await expect(page.getByText(name, { exact: true })).toBeVisible();
    }
    await page.reload();
    for (const name of names) {
      await expect(page.getByText(name, { exact: true })).toBeVisible();
      const row = page.getByRole("group", {
        name: `Actions for ${name}`,
        exact: true,
      });
      const actions = await row.getByRole("button").all();
      for (const action of actions) {
        const box = await action.boundingBox();
        expect(box).not.toBeNull();
        expect(box!.width).toBeGreaterThanOrEqual(44);
        expect(box!.height).toBeGreaterThanOrEqual(44);
        expect(box!.x).toBeGreaterThanOrEqual(0);
        expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
      }
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth))
      .toBeLessThanOrEqual(viewport.width);
    if (viewport.width < 720) {
      const create = await page.getByRole("button", { name: "Create category" })
        .boundingBox();
      const search = await page.getByRole("searchbox", {
        name: "Search categories",
      }).boundingBox();
      expect(create!.width).toBeCloseTo(search!.width, 0);
    }
    const builtInName = page.getByText("Uncategorized", { exact: true });
    const builtInHeight = await builtInName.evaluate((element) => ({
      height: element.getBoundingClientRect().height,
      lineHeight: Number.parseFloat(getComputedStyle(element).lineHeight),
    }));
    expect(builtInHeight.height).toBeLessThanOrEqual(
      builtInHeight.lineHeight + 1,
    );
    await page.screenshot({
      path: `/tmp/categories-${viewport.width}.png`,
      fullPage: true,
    });
    await page.getByRole("button", { name: "Edit Food", exact: true }).click();
    await page.getByRole("textbox", { name: "Category name" }).fill(
      "Food and drinks",
    );
    await page.getByRole("button", { name: "Save category" }).click();
    await expect(page.getByText("Food and drinks", { exact: true }))
      .toBeVisible();
  });
}

test("form input keeps keyboard traversal and immediate edits responsive", async ({ isolatedContext }) => {
  const page = await isolatedContext.newPage();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: /Create first project/ }).click();
  await page.getByRole("textbox", { name: "Project name" }).fill("Personal");
  await page.getByRole("button", { name: "Save project" }).click();
  await page.getByRole("button", { name: "Manual", exact: true }).click();
  const amount = page.getByRole("textbox", { name: "Amount", exact: true });
  await amount.pressSequentially("12.50");
  await amount.press("Tab");
  const currency = page.getByRole("combobox", { name: "Currency" });
  await expect(currency).toBeFocused();
  await expect(currency).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByRole("listbox")).toHaveCount(0);
  await currency.press("ArrowDown");
  await expect(currency).toHaveAttribute("aria-expanded", "true");
  await currency.press("Escape");
  await currency.press("Tab");
  const merchant = page.getByRole("searchbox", { name: "Merchant" });
  await expect(merchant).toBeFocused();
  await merchant.pressSequentially("Corner store ");
  const description = page.getByRole("textbox", {
    name: "Description (optional)",
  });
  await description.pressSequentially("Weekly groceries");
  await expect(amount).toHaveValue("12.50");
  await expect(merchant).toHaveValue("Corner store ");
  await page.getByRole("button", { name: "Organize", exact: true }).click();
  await page.getByRole("button", { name: "Discard changes", exact: true })
    .click();
  await page.getByText("Categories", { exact: true }).click();
  await page.getByRole("button", { name: "Create category", exact: true })
    .click();
  const name = page.getByRole("textbox", { name: "Category name" });
  await name.pressSequentially("Food and drinks");
  const matching = page.getByRole("textbox", {
    name: "AI matching description (optional)",
  });
  await matching.pressSequentially("Coffee, bread and pantry items");
  await name.focus();
  await name.press("End");
  await name.pressSequentially(" weekly");
  await expect(matching).toHaveValue("Coffee, bread and pantry items");
  await name.press("Enter");
  await expect(page.getByText("Food and drinks weekly", { exact: true }))
    .toBeVisible();
  await page.getByRole("button", {
    name: "Edit Food and drinks weekly",
    exact: true,
  }).click();
  await expect(matching).toHaveValue("Coffee, bread and pantry items");
});
