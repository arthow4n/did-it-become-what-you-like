import { expect, test } from "./playwright.ts";

test("receipt preprocessing runs in a worker and cancels on discard", async ({ isolatedContext }) => {
  const page = await isolatedContext.newPage();
  await page.goto("/did-it-become-what-you-like/");
  const workers: string[] = [];
  page.on("worker", (worker) => workers.push(worker.url()));
  const result = await page.evaluate(async () => {
    const modulePath =
      "/did-it-become-what-you-like/src/features/receipt-ui/image-preparation.ts";
    const { prepareReceiptImage } = await import(modulePath);
    const canvas = document.createElement("canvas");
    canvas.width = 6000;
    canvas.height = 3000;
    canvas.getContext("2d")!.fillRect(0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve) =>
      canvas.toBlob((value) => resolve(value!), "image/png")
    );
    const file = new File([blob], "large-receipt.png", { type: "image/png" });
    const image = await prepareReceiptImage(file, 90);
    const controller = new AbortController();
    const cancelled = prepareReceiptImage(file, 0, controller.signal);
    controller.abort();
    let abortCode: unknown;
    try {
      await cancelled;
    } catch (error) {
      abortCode = (error as { code?: string }).code;
    }
    // Use the same native async path as both provider adapters.
    const encodingPath =
      "/did-it-become-what-you-like/src/adapters/receipt-ai/image-encoding.ts";
    const { encodeImageBase64 } = await import(encodingPath);
    const encoded = await encodeImageBase64(image.bytes);
    return {
      width: image.width,
      height: image.height,
      mimeType: image.mimeType,
      bytes: image.bytes.length,
      abortCode,
      encodedBytes: atob(encoded).length,
    };
  });
  expect(
    workers.filter((url) => url.includes("image-preparation.worker")).length,
  ).toBeGreaterThanOrEqual(1);
  expect(result).toMatchObject({
    width: 2048,
    height: 4096,
    mimeType: "image/jpeg",
    abortCode: "aborted",
  });
  expect(result.bytes).toBeGreaterThan(0);
  expect(result.encodedBytes).toBe(result.bytes);
});
