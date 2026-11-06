import { adapterError, throwIfAborted } from "../ports/index.ts";

/** Use native asynchronous encoding rather than building a JS string per byte. */
export async function encodeImageBase64(
  bytes: Uint8Array,
  signal?: AbortSignal,
): Promise<string> {
  throwIfAborted(signal);
  if (typeof FileReader === "function") {
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      const cleanup = () => signal?.removeEventListener("abort", abort);
      const abort = () => {
        reader.abort();
        cleanup();
        reject(adapterError("aborted", "receipt.image.encode"));
      };
      reader.onload = () => {
        cleanup();
        const result = String(reader.result);
        resolve(result.slice(result.indexOf(",") + 1));
      };
      reader.onerror = () => {
        cleanup();
        reject(adapterError("invalid-request", "receipt.image.encode"));
      };
      signal?.addEventListener("abort", abort, { once: true });
      try {
        reader.readAsDataURL(new Blob([bytes.slice().buffer as ArrayBuffer]));
      } catch (error) {
        cleanup();
        reject(error);
      }
    });
  }
  // Non-browser adapters/tests have no FileReader. Prefer the native binary
  // encoder when present, retaining a bounded fallback for older runtimes.
  const native = bytes as Uint8Array & { toBase64?: () => string };
  if (native.toBase64) return native.toBase64();
  const chunks: string[] = [];
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    chunks.push(
      String.fromCharCode(...bytes.subarray(offset, offset + 0x8000)),
    );
    if (offset % 0x40000 === 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      throwIfAborted(signal);
    }
  }
  return btoa(chunks.join(""));
}
