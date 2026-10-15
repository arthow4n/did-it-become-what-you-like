export type OnlineState = "online" | "offline";
export type OnlineStatusListener = (state: OnlineState) => void;

export interface OnlineStatusPort {
  current(): OnlineState;
  subscribe(listener: OnlineStatusListener): () => void;
}

/**
 * Checks whether the browser or runtime currently has network connectivity.
 * Verifies navigator.onLine and probes if necessary.
 */
export async function probeIsOnline(): Promise<boolean> {
  if (
    typeof globalThis.navigator !== "undefined" && globalThis.navigator.onLine
  ) {
    return true;
  }
  if (typeof globalThis.fetch === "function") {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2000);
      await globalThis.fetch(globalThis.location?.href ?? "/", {
        method: "HEAD",
        cache: "no-store",
        signal: controller.signal,
      });
      clearTimeout(timeout);
      return true;
    } catch {
      // Fetch probe failed
    }
  }
  return typeof globalThis.navigator === "undefined" ||
    globalThis.navigator.onLine !== false;
}
