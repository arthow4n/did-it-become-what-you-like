import { expect, test } from "./playwright.ts";

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

  await page.getByRole("button", { name: "Add expense" }).click();
  await expect(page.getByRole("dialog", { name: "Add an expense" }))
    .toBeVisible();
  await page.getByRole("button", { name: /Add manually/ }).click();
  await expect(page.getByRole("heading", { name: "New expense" }))
    .toBeVisible();

  await page.getByRole("textbox", { name: "Amount" }).fill("12.50");
  await page.getByRole("searchbox", { name: "Merchant" }).fill("Local market");
  await page.getByRole("button", { name: "Save expense" }).click();

  await expect(page.getByRole("heading", { name: "Expenses", exact: true }))
    .toBeVisible();
  await expect(page.getByText("Local market")).toBeVisible();
  await expect(
    page.getByLabel("Expenses").getByText("SEK -12.5", { exact: true }),
  ).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { name: "Expenses", exact: true }))
    .toBeVisible();
  await expect(page.getByText("Local market")).toBeVisible();
});
