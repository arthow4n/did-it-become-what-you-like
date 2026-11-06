import type { ImageInput } from "../../adapters/ports/image.ts";
import { throwIfAborted } from "../../adapters/ports/common.ts";
import { preEncodeImage } from "./image.ts";

export type ImagePreparationReply =
  | { readonly image: ImageInput }
  | { readonly error: string };

/** One worker per active preparation; cancellation releases its canvas/bytes. */
export function prepareReceiptImage(
  file: File,
  degrees: number,
  signal?: AbortSignal,
): Promise<ImageInput> {
  throwIfAborted(signal);
  // Older browsers retain the existing canvas path. OffscreenCanvas alone
  // does not move work off the UI thread; the canvas must live in a worker.
  if (
    typeof Worker !== "function" ||
    typeof OffscreenCanvas !== "function" ||
    typeof createImageBitmap !== "function"
  ) {
    return preEncodeImage(file, degrees, signal);
  }
  return new Promise((resolve, reject) => {
    const worker = new Worker(
      new URL("./image-preparation.worker.ts", import.meta.url),
      { type: "module" },
    );
    const cleanup = () => {
      signal?.removeEventListener("abort", abort);
      worker.terminate();
    };
    const abort = () => {
      cleanup();
      try {
        throwIfAborted(signal);
      } catch (error) {
        reject(error);
      }
    };
    signal?.addEventListener("abort", abort, { once: true });
    worker.onmessage = (event: MessageEvent<ImagePreparationReply>) => {
      cleanup();
      if ("image" in event.data) resolve(event.data.image);
      else reject(new Error(event.data.error));
    };
    worker.onerror = (event) => {
      event.preventDefault();
      cleanup();
      reject(
        new Error("Receipt image preparation failed. Select the image again."),
      );
    };
    worker.onmessageerror = () => {
      cleanup();
      reject(new Error("The prepared receipt image could not be read."));
    };
    try {
      // File is immutable and structured-cloned without reading it into a
      // main-thread byte array. The worker transfers the prepared buffer back.
      worker.postMessage({ file, degrees });
    } catch (error) {
      cleanup();
      reject(error);
    }
  });
}
