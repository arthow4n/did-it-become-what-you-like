import { expect, test } from "./playwright.ts";
import { ONE_PIXEL_PNG } from "./support/fixtures.ts";

test(
  "receipt-review captures, scans with fake Gemini, and saves atomically",
  async ({ isolatedContext }) => {
    test.setTimeout(60_000);
    const page = await isolatedContext.newPage();
    await page.setViewportSize({ width: 390, height: 844 });
    // Keep the fake receipt inside the app's default "Today" period, whatever
    // month or year the browser happens to run in.
    const receiptDate = await page.evaluate(() =>
      new Date().toISOString().slice(0, 10)
    );
    const requests: Array<{ method: string; url: string; body?: string }> = [];
    let extractionAttempts = 0;
    await page.route(
      "https://generativelanguage.googleapis.com/**",
      async (route) => {
        const request = route.request();
        requests.push({
          method: request.method(),
          url: request.url(),
          ...(request.postData() ? { body: request.postData()! } : {}),
        });
        if (request.method() === "GET" && request.url().includes("/models?")) {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              models: [{
                name: "models/fake-gemini-compatible",
                baseModelId: "fake-gemini-compatible",
                displayName: "Fake Gemini Compatible",
                supportedGenerationMethods: ["generateContent"],
                inputModalities: ["image"],
                supportedResponseFormats: ["application/json"],
              }],
            }),
          });
          return;
        }
        if (
          request.method() === "POST" &&
          request.url().includes(":generateContent")
        ) {
          const body = request.postData() ?? "";
          const syntheticConfiguration = body.includes(
            "Return one valid synthetic receipt.v2 object",
          );
          if (!syntheticConfiguration) extractionAttempts++;
          if (!syntheticConfiguration && extractionAttempts === 1) {
            await route.fulfill({
              status: 429,
              contentType: "application/json",
              body: JSON.stringify({
                error: {
                  message: "provider-only-secret",
                  status: "RESOURCE_EXHAUSTED",
                },
              }),
            });
            return;
          }
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              candidates: [{
                content: {
                  parts: [{
                    text: JSON.stringify({
                      currency: "SEK",
                      date: receiptDate,
                      lines: [{
                        amount: "10",
                        categoryId: "category-uncategorized",
                        description: "Fake receipt item",
                        direction: "outflow",
                        kind: "purchase",
                        rationale:
                          "The visible product row is a purchase outflow.",
                        selected: true,
                      }, {
                        amount: "5",
                        categoryId: "category-uncategorized",
                        description: "Second fake item",
                        direction: "outflow",
                        kind: "purchase",
                        rationale:
                          "The second visible product row is a purchase outflow.",
                        selected: true,
                      }],
                      merchant: "Fake Receipt Market",
                      mismatch: null,
                      printedTotal: "15",
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

    await page.goto("/");
    await page.getByRole("button", { name: /Create first project/ }).click();
    await page.getByRole("textbox", { name: "Project name" }).fill(
      "Receipt project",
    );
    await page.getByRole("button", { name: "Save project" }).click();
    await page.getByRole("button", { name: "Scan" }).click();
    await expect(
      page.getByRole("heading", { name: "Before sending this receipt" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Continue to scan" }).click();
    const chooseImageDialog = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "Choose image" }).click();
    const chooseImage = await chooseImageDialog;
    expect(await chooseImage.element().getAttribute("capture")).toBeNull();
    await chooseImage.setFiles({
      name: "receipt.png",
      mimeType: "image/png",
      buffer: ONE_PIXEL_PNG,
    });
    await expect(page.getByAltText("Selected receipt preview")).toBeVisible();
    await page.getByRole("button", { name: "Remove" }).click();
    await expect(page.getByAltText("Selected receipt preview")).toHaveCount(0);
    await expect.poll(() =>
      page.getByLabel("Receipt image file").evaluate((element) => {
        const input = element as HTMLInputElement;
        return {
          value: input.value,
          fileCount: input.files?.length ?? 0,
        };
      })
    ).toEqual({ value: "", fileCount: 0 });
    const cameraDialog = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "Take photo" }).click();
    const camera = await cameraDialog;
    expect(await camera.element().getAttribute("capture")).toBe("environment");
    await camera.setFiles({
      name: "receipt.png",
      mimeType: "image/png",
      buffer: ONE_PIXEL_PNG,
    });
    await expect(page.getByAltText("Selected receipt preview")).toBeVisible();

    // The scan owns only an in-memory image, so discarding a guarded tab
    // transition must leave immediately and must not strand the navigation
    // dialog or the scan actor.
    await page.getByRole("button", { name: "Expenses", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Unsaved changes" }))
      .toBeVisible();
    await page.getByRole("button", { name: "Discard changes" }).click();
    await expect(page.getByRole("heading", { name: "Expenses", exact: true }))
      .toBeVisible();
    await page.getByRole("button", { name: "Scan", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Before sending this receipt" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Continue to scan" }).click();
    const imageAfterDiscardDialog = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "Choose image" }).click();
    const imageAfterDiscard = await imageAfterDiscardDialog;
    await imageAfterDiscard.setFiles({
      name: "receipt-after-discard.png",
      mimeType: "image/png",
      buffer: ONE_PIXEL_PNG,
    });
    await expect(page.getByAltText("Selected receipt preview")).toBeVisible();
    await page.getByRole("button", { name: "Scan with AI" }).click();
    await expect(page.getByRole("dialog", { name: "Set up Gemini" }))
      .toBeVisible();
    await page.getByRole("textbox", { name: "API key" }).fill(
      "e2e-test-placeholder",
    );
    await page.getByRole("button", { name: "Save and continue" }).click();
    const modelPicker = page.getByRole("combobox", { name: "Model" });
    await expect(modelPicker).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Hide options" }),
    ).toBeVisible();
    await modelPicker.fill("Fake Gemini Compatible");
    await expect(
      page.getByRole("option", { name: /Fake Gemini Compatible/ }),
    ).toBeVisible();
    await page.getByRole("option", { name: /Fake Gemini Compatible/ }).click();
    await page.getByRole("button", { name: "Test configuration" }).click();
    await expect(page.getByText(/quota was exceeded/)).toBeVisible();
    await expect(page.getByText("Error code: quota")).toBeVisible();
    await expect(page.getByText("Operation: gemini.extract")).toBeVisible();
    await expect(page.getByText("provider-only-secret")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Retry" })).toBeEnabled();
    await expect.poll(() =>
      page.getByLabel("Receipt image file").evaluate((element) => {
        const input = element as HTMLInputElement;
        return {
          value: input.value,
          fileCount: input.files?.length ?? 0,
        };
      })
    ).toMatchObject({ fileCount: 1 });
    await page.getByRole("button", { name: "Retry" }).click();
    await expect(page.getByRole("heading", { name: "Review receipt" }))
      .toBeVisible();
    await expect(page.getByRole("heading", { name: "Fake Receipt Market" }))
      .toBeVisible();
    await expect(page.getByText("Fake receipt item")).toBeVisible();
    await expect(page.getByText("Second fake item")).toBeVisible();
    await page.getByRole("button", { name: "Save 2 selected entries" }).click();
    await expect(page.getByRole("heading", { name: "Expenses", exact: true }))
      .toBeVisible();
    await expect(page.getByText("Fake Receipt Market").first()).toBeVisible();
    const receiptGroup = page.locator("[data-receipt-group-id]");
    const ensureReceiptGroupExpanded = async () => {
      const viewReceipt = receiptGroup.getByRole("button", {
        name: "View receipt",
      });
      if (!(await viewReceipt.isVisible())) {
        await receiptGroup.getByRole("button", {
          name: /Fake Receipt Market/,
        }).click();
      }
      await expect(viewReceipt).toBeVisible();
    };
    await expect(receiptGroup).toBeVisible();
    await ensureReceiptGroupExpanded();

    await receiptGroup.getByRole("button", { name: "View receipt" }).click();
    await expect(
      page.getByRole("heading", { name: "Fake Receipt Market", level: 1 }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Back to expenses" }).click();
    await expect(page.getByRole("heading", { name: "Expenses", exact: true }))
      .toBeVisible();
    await expect.poll(() =>
      page.evaluate(() =>
        document.activeElement?.closest<HTMLElement>("[data-receipt-group-id]")
          ?.dataset.receiptGroupId ??
          document.activeElement?.getAttribute("data-receipt-view")
      )
    ).toBeTruthy();
    await ensureReceiptGroupExpanded();
    const reopenedGroup = page.locator("[data-receipt-group-id]");
    await reopenedGroup.getByRole("button", {
      name: /Fake receipt item Uncategorized/,
    }).click();
    await expect(
      page.getByRole("heading", { name: "Fake Receipt Market", level: 1 }),
    ).toBeVisible();
    await expect.poll(() =>
      page.evaluate(() =>
        document.activeElement?.getAttribute("data-receipt-line-id")
      )
    ).toBeTruthy();

    const focusedLine = page.locator("[data-receipt-line-id]").filter({
      hasText: "Fake receipt item",
    }).first();
    await focusedLine.getByRole("button", { name: "Edit" }).click();
    const lineEditor = page.getByRole("dialog", { name: "Edit receipt line" });
    await expect(lineEditor).toBeVisible();
    await lineEditor.getByLabel("Description").fill(
      "Updated fake receipt item",
    );
    await lineEditor.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Updated fake receipt item")).toBeVisible();

    await page.getByRole("button", { name: "Back to expenses" }).click();
    await expect(page.getByRole("heading", { name: "Expenses", exact: true }))
      .toBeVisible();
    await ensureReceiptGroupExpanded();
    await expect(page.getByText("Updated fake receipt item")).toBeVisible();
    await expect(page.getByText("Second fake item")).toBeVisible();

    const managedGroup = page.locator("[data-receipt-group-id]");
    await managedGroup.getByRole("button", {
      name: /Updated fake receipt item Uncategorized/,
    }).click();
    await expect(
      page.getByRole("heading", { name: "Fake Receipt Market", level: 1 }),
    ).toBeVisible();
    const updatedLine = page.locator("[data-receipt-line-id]").filter({
      hasText: "Updated fake receipt item",
    }).first();
    await updatedLine.getByRole("button", { name: "Remove" }).click();
    const lineDeleteDialog = page.getByRole("dialog", {
      name: "Delete this line?",
    });
    await expect(lineDeleteDialog).toContainText(
      "This removes only this purchase line",
    );
    await lineDeleteDialog.getByRole("button", { name: "Delete line" }).click();
    await expect(page.getByText("Updated fake receipt item")).toHaveCount(0);
    await expect(page.getByText("Second fake item")).toBeVisible();

    await page.getByRole("button", { name: "Back to expenses" }).click();
    await ensureReceiptGroupExpanded();
    await expect(page.getByText("Second fake item")).toBeVisible();
    const finalGroup = page.locator("[data-receipt-group-id]");
    await finalGroup.getByRole("button", { name: "View receipt" }).click();
    await page.getByRole("button", { name: "Delete receipt" }).click();
    const receiptDeleteDialog = page.getByRole("dialog", {
      name: "Delete this receipt?",
    });
    await expect(receiptDeleteDialog).toContainText(
      "every purchase line and adjustment",
    );
    await receiptDeleteDialog.getByRole("button", {
      name: "Delete receipt",
    }).click();
    await expect(page.getByRole("heading", { name: "Expenses", exact: true }))
      .toBeVisible();
    await expect(page.getByText("Receipt deleted.")).toBeVisible();
    await page.reload();
    await expect(page.getByRole("heading", { name: "Expenses", exact: true }))
      .toBeVisible();
    await expect(page.getByText("Second fake item")).toHaveCount(0);
    await expect(page.locator("[data-receipt-group-id]")).toHaveCount(0);

    expect(requests.length).toBeGreaterThanOrEqual(2);
    expect(
      requests.every((request) =>
        request.url.startsWith(
          "https://generativelanguage.googleapis.com/v1beta/",
        ) &&
        (request.method === "GET" || request.method === "POST")
      ),
    ).toBe(true);
    expect(requests.some((request) => request.method === "POST")).toBe(true);
    expect(
      requests.every((request) =>
        !request.url.includes("expense") && !request.url.includes("project")
      ),
    ).toBe(true);
    const postRequests = requests.filter((request) =>
      request.method === "POST"
    );
    expect(postRequests).toHaveLength(3);
    const requestBody = JSON.parse(
      postRequests[postRequests.length - 1].body ?? "null",
    ) as {
      contents: Array<{
        parts: Array<Record<string, unknown>>;
        role: string;
      }>;
      generationConfig: Record<string, unknown>;
      systemInstruction: { parts: Array<{ text: string }> };
    };
    expect(Object.keys(requestBody).sort()).toEqual([
      "contents",
      "generationConfig",
      "systemInstruction",
    ]);
    expect(requestBody.contents).toHaveLength(1);
    expect(requestBody.contents[0].role).toBe("user");
    expect(requestBody.contents[0].parts).toHaveLength(2);
    expect(Object.keys(requestBody.contents[0].parts[0])).toEqual(["text"]);
    expect(typeof requestBody.contents[0].parts[0].text).toBe("string");
    expect(Object.keys(requestBody.contents[0].parts[1])).toEqual([
      "inlineData",
    ]);
    expect(requestBody.contents[0].parts[1].inlineData).toEqual({
      data: expect.any(String),
      mimeType: "image/jpeg",
    });
    expect(requestBody.systemInstruction.parts).toHaveLength(1);
    expect(requestBody.systemInstruction.parts[0].text).toContain(
      "category-uncategorized",
    );
    expect(requestBody.systemInstruction.parts[0].text).toContain("SEK");
    expect(JSON.stringify(requestBody)).not.toContain("e2e-test-placeholder");
    expect(JSON.stringify(requestBody)).not.toContain("Receipt project");
    expect(await page.locator('input[type="file"]').count()).toBe(0);
    const localStorageKeys = await page.evaluate(() =>
      Object.keys(localStorage)
    );
    expect(
      localStorageKeys.some((key) =>
        key.includes("did-it-become-what-you-like:v1")
      ),
    ).toBe(true);
    const workflowSnapshot = await page.evaluate(async () => {
      const database = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open("did-it-become-what-you-like");
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
      });
      const value = await new Promise<unknown>((resolve, reject) => {
        const transaction = database.transaction(
          "workflow-snapshots",
          "readonly",
        );
        const request = transaction.objectStore("workflow-snapshots").get(
          "workflow:receipt-review",
        );
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
      });
      database.close();
      return value;
    });
    expect(workflowSnapshot).toBeUndefined();
  },
);
