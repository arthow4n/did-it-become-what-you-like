import { Buffer } from "node:buffer";
import { expect, test } from "./playwright.ts";

test.use({ viewport: { width: 390, height: 844 } });

const ONE_PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

test("receipt-review captures, scans with fake Gemini, and saves atomically", async ({ isolatedContext }) => {
  const page = await isolatedContext.newPage();
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
        request.url().includes(":generateContent?")
      ) {
        extractionAttempts++;
        if (extractionAttempts === 1) {
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
                    date: "2026-08-24",
                    lines: [{
                      amount: "-10",
                      categoryId: "category-uncategorized",
                      description: "Fake receipt item",
                      kind: "purchase",
                      selected: true,
                    }],
                    merchant: "Fake Receipt Market",
                    mismatch: null,
                    printedTotal: "-10",
                    schemaVersion: "receipt.v1",
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
  await page.getByRole("button", { name: "Add expense" }).click();
  await page.getByRole("button", { name: /Scan receipt with AI/ }).click();
  await expect(
    page.getByRole("heading", { name: "Before sending this receipt" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Continue to scan" }).click();
  await page.getByLabel("Receipt image file").setInputFiles({
    name: "receipt.png",
    mimeType: "image/png",
    buffer: ONE_PIXEL_PNG,
  });
  await expect(page.getByAltText("Selected receipt preview")).toBeVisible();
  await page.getByRole("button", { name: "Remove" }).click();
  await expect(page.getByAltText("Selected receipt preview")).toHaveCount(0);
  await expect.poll(() =>
    page.getByLabel("Receipt image file").evaluate((input) => ({
      value: input.value,
      fileCount: input.files?.length ?? 0,
    }))
  ).toEqual({ value: "", fileCount: 0 });
  await page.getByLabel("Receipt image file").setInputFiles({
    name: "receipt.png",
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
  await expect(page.getByText(/quota was exceeded/)).toBeVisible();
  await expect(page.getByText("provider-only-secret")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Retry" })).toBeDisabled();
  await expect.poll(() =>
    page.getByLabel("Receipt image file").evaluate((input) => ({
      value: input.value,
      fileCount: input.files?.length ?? 0,
    }))
  ).toEqual({ value: "", fileCount: 0 });
  await page.getByLabel("Receipt image file").setInputFiles({
    name: "receipt-retry.png",
    mimeType: "image/png",
    buffer: ONE_PIXEL_PNG,
  });
  await page.getByRole("button", { name: "Scan with AI" }).click();
  await expect(page.getByRole("heading", { name: "Review receipt" }))
    .toBeVisible();
  await expect(page.getByRole("heading", { name: "Fake Receipt Market" }))
    .toBeVisible();
  await expect(page.getByText("Fake receipt item")).toBeVisible();
  await page.getByRole("button", { name: "Save 1 selected entry" }).click();
  await expect(page.getByRole("heading", { name: "Expenses", exact: true }))
    .toBeVisible();
  await page.getByRole("button", { name: /Fake Receipt Market/ }).click();
  await expect(page.getByText("Fake Receipt Market").first()).toBeVisible();
  const receiptGroup = page.getByRole("region", {
    name: "Fake Receipt Market 2026-08-24",
  });
  await expect(receiptGroup).toBeVisible();
  await expect(
    receiptGroup.getByRole("button", {
      name: /Fake Receipt Market Uncategorized/,
    }),
  ).toBeVisible();

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
  const postRequests = requests.filter((request) => request.method === "POST");
  expect(postRequests).toHaveLength(2);
  const requestBody = JSON.parse(
    postRequests[postRequests.length - 1].body ?? "null",
  ) as {
    contents: Array<Record<string, unknown>>;
    generationConfig: Record<string, unknown>;
    systemInstruction: { parts: Array<{ text: string }> };
  };
  expect(Object.keys(requestBody).sort()).toEqual([
    "contents",
    "generationConfig",
    "systemInstruction",
  ]);
  expect(requestBody.contents).toHaveLength(2);
  expect(Object.keys(requestBody.contents[0])).toEqual(["text"]);
  expect(typeof requestBody.contents[0].text).toBe("string");
  expect(Object.keys(requestBody.contents[1])).toEqual(["inlineData"]);
  expect(requestBody.contents[1].inlineData).toEqual({
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
  const localStorageKeys = await page.evaluate(() => Object.keys(localStorage));
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
});
