import { Buffer } from "node:buffer";
import { expect, test } from "./playwright.ts";

const ONE_PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

test("receipt-review captures, scans with fake Gemini, and saves atomically", async ({ isolatedContext }) => {
  const page = await isolatedContext.newPage();
  const requests: Array<{ method: string; url: string; body?: string }> = [];
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
  await page.getByRole("button", { name: "Scan with AI" }).click();
  await expect(page.getByRole("dialog", { name: "Set up Gemini" }))
    .toBeVisible();
  await page.getByRole("textbox", { name: "API key" }).fill(
    "AIza.fake-e2e-key",
  );
  await page.getByRole("button", { name: "Save and continue" }).click();
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
  await expect(
    page.getByRole("group", { name: /Fake Receipt Market/ }).getByText(
      "Fake Receipt Market",
    ),
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
