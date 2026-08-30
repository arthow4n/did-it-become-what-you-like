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

test.describe("local-first-manual recovery seam", () => {
  test.use({ viewport: { width: 320, height: 568 } });

  test("local-first-null-draft shows an actionable retry and safe exit", async ({ isolatedContext }) => {
    const page = await isolatedContext.newPage();
    await page.goto("/");
    await page.getByRole("button", { name: /Create first project/ }).click();
    await page.getByRole("textbox", { name: "Project name" }).fill(
      "Recovery project",
    );
    await page.getByRole("button", { name: "Save project" }).click();
    await expect(page.getByRole("heading", { name: "Expenses", exact: true }))
      .toBeVisible();

    await page.evaluate(() =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open("did-it-become-what-you-like");
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const database = request.result;
          const transaction = database.transaction(
            "workflow-snapshots",
            "readwrite",
          );
          transaction.objectStore("workflow-snapshots").put({
            key: "workflow:manual-expense",
            value: {
              kind: "manual-expense-draft",
              version: 1,
              revision: 1,
              draft: "corrupt-draft",
            },
          });
          transaction.oncomplete = () => {
            database.close();
            resolve();
          };
          transaction.onerror = () => reject(transaction.error);
        };
      })
    );

    await page.getByRole("button", { name: "Manual" }).click();
    await expect(
      page.getByText("The expense form could not be opened"),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Retry opening expense" }))
      .toBeVisible();
    await page.getByRole("button", { name: "Retry opening expense" }).click();
    await expect(
      page.getByText("The expense form could not be opened"),
    ).toBeVisible();
    await page.getByRole("button", { name: "Back to expenses" }).click();
    await expect(page.getByRole("heading", { name: "Expenses", exact: true }))
      .toBeVisible();
  });
});
