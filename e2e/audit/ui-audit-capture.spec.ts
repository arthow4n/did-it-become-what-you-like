import { Buffer } from "node:buffer";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";
import { expect, test } from "../playwright.ts";

const ONE_PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

const AUDIT_DIR = process.env.AUDIT_OUTPUT_DIR ||
  join(Deno.cwd(), "ui-audit", "screenshots");
mkdirSync(AUDIT_DIR, { recursive: true });

const VIEWPORTS = [
  { name: "desktop", width: 1280, height: 800 },
  { name: "mobile", width: 390, height: 844 },
  { name: "narrow", width: 320, height: 568 },
] as const;

for (const vp of VIEWPORTS) {
  test.describe(`Visual capture - ${vp.name} (${vp.width}x${vp.height})`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test(`capture all canonical screens on ${vp.name}`, async ({ isolatedContext }) => {
      test.setTimeout(90000);
      const page = await isolatedContext.newPage();
      await page.setViewportSize({ width: vp.width, height: vp.height });

      // Route Gemini API
      await page.route(
        "https://generativelanguage.googleapis.com/**",
        async (route) => {
          const req = route.request();
          if (req.method() === "GET" && req.url().includes("/models?")) {
            await route.fulfill({
              status: 200,
              contentType: "application/json",
              body: JSON.stringify({
                models: [{
                  name: "models/gemini-2.5-flash",
                  baseModelId: "gemini-2.5-flash",
                  displayName: "Gemini 2.5 Flash",
                  supportedGenerationMethods: ["generateContent"],
                  inputModalities: ["image"],
                  supportedResponseFormats: ["application/json"],
                }],
              }),
            });
            return;
          }
          if (
            req.method() === "POST" && req.url().includes(":generateContent?")
          ) {
            await route.fulfill({
              status: 200,
              contentType: "application/json",
              body: JSON.stringify({
                candidates: [{
                  content: {
                    parts: [{
                      text: JSON.stringify({
                        currency: "SEK",
                        date: "2026-08-28",
                        lines: [{
                          amount: "120.00",
                          categoryId: "category-uncategorized",
                          description: "Lunch Special",
                          direction: "outflow",
                          kind: "purchase",
                          rationale:
                            "The visible lunch item is a purchase outflow.",
                          selected: true,
                        }],
                        merchant: "Downtown Cafe",
                        mismatch: null,
                        printedTotal: "120.00",
                        schemaVersion: "receipt.v2",
                        uncertainty: [],
                      }),
                    }],
                  },
                }],
              }),
            });
            return;
          }
          await route.fulfill({ status: 404, body: "Not found" });
        },
      );

      const snap = async (name: string) => {
        const filePath = join(AUDIT_DIR, `${vp.name}-${name}.png`);
        await page.screenshot({ path: filePath, fullPage: true });
      };

      // 1. First-use
      await page.goto("/");
      await expect(
        page.getByRole("heading", { name: "Start tracking expenses" }),
      ).toBeVisible();
      await snap("01-first-use");

      // 2. Create project dialog
      await page.getByRole("button", { name: /Create first project/ }).click();
      await expect(page.getByRole("heading", { name: "Create project" }))
        .toBeVisible();
      await snap("02-create-project-modal");

      // Fill and save project
      await page.getByRole("textbox", { name: "Project name" }).fill(
        "Personal Budget",
      );
      await snap("02b-create-project-filled");
      await page.getByRole("button", { name: "Save project" }).click();

      // 3. Expenses screen empty
      await expect(page.getByRole("heading", { name: "Expenses", exact: true }))
        .toBeVisible();
      await snap("03-expenses-empty");

      // 4. Add Choice Sheet
      await page.getByRole("button", { name: "Add expense" }).click();
      await expect(page.getByRole("dialog", { name: "Add an expense" }))
        .toBeVisible();
      await snap("04-add-choice-sheet");

      // 5. Manual Expense Form (Empty)
      await page.getByRole("button", { name: /Add manually/ }).click();
      await expect(page.getByRole("heading", { name: "New expense", level: 1 }))
        .toBeVisible();
      await snap("05-manual-expense-empty");

      // 6. Manual Expense Form (Populated)
      await page.getByRole("textbox", { name: "Amount" }).fill("450.00");
      await page.getByRole("searchbox", { name: "Merchant" }).fill(
        "Nordic Market",
      );
      await page.getByRole("textbox", { name: "Description" }).fill(
        "Weekly grocery shopping",
      );
      await snap("06-manual-expense-populated");

      // Save expense & add another
      await page.getByRole("button", { name: "Save and add another" }).click();
      await expect(page.getByRole("heading", { name: "New expense", level: 1 }))
        .toBeVisible();
      await expect(page.getByRole("textbox", { name: "Amount" })).toHaveValue(
        "",
      );

      // Add a second expense
      await page.getByRole("textbox", { name: "Amount" }).fill("85.50");
      await page.getByRole("searchbox", { name: "Merchant" }).fill(
        "Espresso House",
      );
      await page.getByRole("button", { name: "Save expense" }).click();

      // Saved expense completion screen
      await expect(page.getByRole("heading", { name: "Expense saved" }))
        .toBeVisible();
      await snap("07-saved-expense-completion");
      await page.getByRole("button", { name: "Continue to expenses" }).click();

      // 8. Expenses Populated
      await expect(page.getByRole("heading", { name: "Expenses", exact: true }))
        .toBeVisible();
      await snap("08-expenses-populated");

      // 9. Expenses FilterSheet
      await page.getByRole("button", { name: /Filters/ }).click();
      await expect(page.getByRole("dialog", { name: "Filters" })).toBeVisible();
      await snap("09-expenses-filters-dialog");
      await page.keyboard.press("Escape");

      // 10. Expense Edit Screen
      await page.getByRole("button", { name: /Nordic Market/ }).click();
      await expect(page.getByRole("heading", { name: "Edit expense" }))
        .toBeVisible();
      await snap("10-expense-edit");
      await page.getByRole("button", { name: "Close" }).click();

      // 11. Organize Screen
      await page.goto("/#organize");
      await expect(page.getByRole("heading", { name: "Organize" }))
        .toBeVisible();
      await snap("11-organize-hub");

      // 12. Manage Projects Screen
      await page.getByRole("button", { name: "Manage projects" }).click();
      await expect(page.getByRole("heading", { name: "Manage projects" }))
        .toBeVisible();
      await snap("12-manage-projects");

      // 13. Project Edit Mode
      await page.getByRole("button", { name: "Edit" }).first().click();
      await expect(page.getByRole("heading", { name: "Edit project" }))
        .toBeVisible();
      await snap("13-project-editor");
      await page.getByRole("button", { name: "Back" }).click();

      // 14. Project Delete Dialog
      // First create a second project so we can delete the empty one or test deletion
      await page.getByRole("button", { name: "Create project" }).click();
      await page.getByRole("textbox", { name: "Project name" }).fill(
        "Trip to Tokyo",
      );
      await page.getByRole("button", { name: "Save project" }).click();
      await expect(page.getByRole("heading", { name: "Manage projects" }))
        .toBeVisible();
      await snap("14-manage-projects-multi");

      // 15. Manage Categories Screen
      await page.goto("/#categories");
      await expect(page.getByRole("heading", { name: "Manage categories" }))
        .toBeVisible();
      await snap("15-manage-categories");

      // 16. Create Category Editor
      await page.getByRole("button", { name: "Create category" }).click();
      await expect(page.getByRole("heading", { name: "Create category" }))
        .toBeVisible();
      await snap("16-category-editor");
      await page.getByRole("button", { name: "Back" }).click();

      // 17. Receipt Scan Initial Screen
      await page.goto("/#receipt/scan");
      await expect(page.getByRole("heading", { name: "Scan receipt" }))
        .toBeVisible();
      await snap("17-receipt-scan-initial");

      // Handle disclosure if shown
      const continueBtn = page.getByRole("button", {
        name: "Continue to scan",
      });
      if (await continueBtn.isVisible()) {
        await snap("17b-receipt-scan-disclosure");
        await continueBtn.click();
      }

      // 18. Receipt Scan with Options Open
      await page.getByRole("button", { name: "Options" }).click();
      await snap("18-receipt-scan-options");

      // 19. Receipt with Image Selected & Quick Setup Dialog
      await page.getByLabel("Receipt image file").setInputFiles({
        name: "receipt.png",
        mimeType: "image/png",
        buffer: ONE_PIXEL_PNG,
      });
      await expect(page.getByAltText("Selected receipt preview")).toBeVisible();
      await snap("19-receipt-scan-image-selected");

      await page.getByRole("button", { name: "Scan with AI" }).click();
      // Quick setup modal opens if no key
      await expect(page.getByRole("dialog", { name: "Set up Gemini" }))
        .toBeVisible();
      await snap("20-gemini-quick-setup-modal");

      // Fill API key
      await page.getByRole("textbox", { name: "API key" }).fill(
        "fake-api-key-12345",
      );
      await snap("20b-gemini-quick-setup-filled");
      await page.getByRole("button", { name: "Save and continue" }).click();

      // Select model
      await page.getByRole("combobox", { name: "Model" }).click();
      await page.getByRole("option", { name: /Gemini 2.5 Flash/ }).click();
      await page.getByRole("button", { name: "Scan with AI" }).click();

      // 20d. Receipt Review Screen
      await expect(page.getByRole("heading", { name: "Review receipt" }))
        .toBeVisible();
      await snap("20d-receipt-review");

      // Edit receipt parent metadata dialog
      await page.getByRole("button", { name: "Edit" }).first().click();
      await expect(page.getByRole("dialog", { name: "Edit receipt details" }))
        .toBeVisible();
      await snap("20e-receipt-metadata-editor");
      await page.getByRole("button", { name: "Cancel" }).click();

      // Edit receipt line dialog
      await page.getByRole("button", { name: "Edit" }).nth(1).click();
      await expect(page.getByRole("dialog", { name: "Edit receipt line" }))
        .toBeVisible();
      await snap("20f-receipt-line-editor");
      await page.getByRole("button", { name: "Cancel" }).click();

      // 21. Settings Screens
      await page.goto("/#settings");
      await expect(page.getByRole("heading", { name: "Settings", exact: true }))
        .toBeVisible();
      await snap("21-settings-hub");

      // Preferences Screen
      await page.goto("/#settings/preferences");
      await expect(page.getByRole("heading", { name: "Preferences" }))
        .toBeVisible();
      await snap("22-settings-preferences");

      // Sync Screen
      await page.goto("/#settings/sync");
      await snap("23-settings-sync");

      // Privacy / Destruction Screen
      await page.goto("/#settings/privacy");
      await expect(page.getByRole("heading", { name: "Data and privacy" }))
        .toBeVisible();
      await snap("24-settings-privacy");

      // Local erase dialog
      await page.getByRole("button", { name: /Delete this device's data/ })
        .click();
      await expect(
        page.getByRole("dialog", { name: "Delete this device's data?" }),
      ).toBeVisible();
      await snap("25-local-erase-dialog");
      await page.getByRole("button", { name: "Cancel" }).click();

      // About Screen
      await page.goto("/#settings/about");
      await expect(page.getByRole("heading", { name: "About" })).toBeVisible();
      await snap("26-settings-about");

      // Gemini Settings Screen
      await page.goto("/#settings/gemini");
      await expect(
        page.getByRole("heading", { name: "Gemini receipt scanning" }),
      ).toBeVisible();
      await snap("27-settings-gemini");

      // 28. Gallery
      await page.goto("src/design-system/gallery.html");
      await page.waitForLoadState("networkidle");
      await snap("28-design-system-gallery");
    });
  });
}
