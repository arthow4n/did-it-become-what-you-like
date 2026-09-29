import type { ReceiptImageRef } from "../../actors/contracts/index.ts";
import {
  type ImageInput,
  type PreparedImage,
  throwIfAborted,
} from "../../adapters/ports/index.ts";
import { fileMediaType, preEncodeImage } from "./image.ts";

export type ReceiptImageEntry = {
  readonly file: File;
  readonly previewUrl: string;
  rotation: number;
  prepared?: ImageInput;
  preparedRotation?: number;
  pendingPreparation?: Promise<ImageInput>;
  pendingAbortController?: AbortController;
};

export class ReceiptImageStore {
  readonly #entries = new Map<string, ReceiptImageEntry>();
  #preparationCache: WeakMap<ImageInput, PreparedImage> | null = null;

  setPreparationCache(
    cache: WeakMap<ImageInput, PreparedImage> | WeakMap<object, unknown>,
  ): void {
    this.#preparationCache = cache as WeakMap<ImageInput, PreparedImage>;
  }

  #startPreparation(entry: ReceiptImageEntry, degrees: number): void {
    if (entry.pendingAbortController) {
      entry.pendingAbortController.abort();
      entry.pendingAbortController = undefined;
      entry.pendingPreparation = undefined;
    }
    const controller = new AbortController();
    entry.pendingAbortController = controller;

    const promise = (async () => {
      try {
        const result = await preEncodeImage(
          entry.file,
          degrees,
          controller.signal,
        );
        if (entry.pendingAbortController === controller) {
          entry.prepared = result;
          entry.preparedRotation = degrees;
          entry.pendingPreparation = undefined;
          entry.pendingAbortController = undefined;
          this.#preparationCache?.set(result, {
            ...result,
            metadataSanitized: true,
            preparationApplied: true,
          });
        }
        return result;
      } catch (error) {
        if (entry.pendingAbortController === controller) {
          entry.pendingPreparation = undefined;
          entry.pendingAbortController = undefined;
        }
        throw error;
      }
    })();

    promise.catch(() => {});
    entry.pendingPreparation = promise;
  }

  add(file: File): ReceiptImageRef & {
    readonly previewUrl: string;
    readonly rotation: number;
  } {
    const ephemeralId = `receipt-image-${
      globalThis.crypto?.randomUUID?.() ??
        `${Date.now()}-${Math.random()}`
    }`;
    const previewUrl = URL.createObjectURL(file);
    const entry: ReceiptImageEntry = {
      file,
      previewUrl,
      rotation: 0,
    };
    this.#entries.set(ephemeralId, entry);
    this.#startPreparation(entry, 0);
    return {
      ephemeralId,
      mediaType: fileMediaType(file),
      byteLength: file.size,
      previewUrl,
      rotation: 0,
    };
  }

  getFile(ref: ReceiptImageRef): File | undefined {
    return this.#entries.get(ref.ephemeralId)?.file;
  }

  getRotation(ref: ReceiptImageRef): number {
    return this.#entries.get(ref.ephemeralId)?.rotation ?? 0;
  }

  isPrepared(ref: ReceiptImageRef): boolean {
    const entry = this.#entries.get(ref.ephemeralId);
    return Boolean(
      entry?.prepared && entry.preparedRotation === entry.rotation,
    );
  }

  rotate(
    ref: ReceiptImageRef,
    degrees: 90 | -90,
  ): ReceiptImageRef & {
    readonly previewUrl: string;
    readonly rotation: number;
  } {
    const entry = this.#entries.get(ref.ephemeralId);
    if (!entry) {
      throw new Error("The selected receipt image is no longer available.");
    }
    const nextRotation = ((entry.rotation + degrees) % 360 + 360) % 360;
    entry.rotation = nextRotation;
    if (entry.preparedRotation !== nextRotation) {
      entry.prepared?.bytes.fill(0);
      entry.prepared = undefined;
      entry.preparedRotation = undefined;
    }
    this.#startPreparation(entry, nextRotation);
    return {
      ephemeralId: ref.ephemeralId,
      mediaType: fileMediaType(entry.file),
      byteLength: entry.file.size,
      previewUrl: entry.previewUrl,
      rotation: nextRotation,
    };
  }

  async resolve(
    ref: ReceiptImageRef,
    signal?: AbortSignal,
  ): Promise<ImageInput> {
    throwIfAborted(signal);
    const entry = this.#entries.get(ref.ephemeralId);
    if (!entry) {
      throw new Error("The selected receipt image is no longer available.");
    }

    if (entry.prepared && entry.preparedRotation === entry.rotation) {
      const output: ImageInput = {
        bytes: entry.prepared.bytes.slice(),
        mimeType: entry.prepared.mimeType,
        width: entry.prepared.width,
        height: entry.prepared.height,
      };
      this.#preparationCache?.set(output, {
        ...output,
        metadataSanitized: true,
        preparationApplied: true,
      });
      return output;
    }

    if (
      entry.pendingPreparation && !entry.pendingAbortController?.signal.aborted
    ) {
      try {
        if (signal) {
          const onAbort = () => {
            entry.pendingAbortController?.abort();
          };
          signal.addEventListener("abort", onAbort, { once: true });
          try {
            await entry.pendingPreparation;
          } finally {
            signal.removeEventListener("abort", onAbort);
          }
        } else {
          await entry.pendingPreparation;
        }
      } catch {
        // Fall through to immediate execution below
      }
      throwIfAborted(signal);
      if (entry.prepared && entry.preparedRotation === entry.rotation) {
        const output: ImageInput = {
          bytes: entry.prepared.bytes.slice(),
          mimeType: entry.prepared.mimeType,
          width: entry.prepared.width,
          height: entry.prepared.height,
        };
        this.#preparationCache?.set(output, {
          ...output,
          metadataSanitized: true,
          preparationApplied: true,
        });
        return output;
      }
    }

    throwIfAborted(signal);
    const result = await preEncodeImage(entry.file, entry.rotation, signal);
    entry.prepared = result;
    entry.preparedRotation = entry.rotation;
    const output: ImageInput = {
      bytes: result.bytes.slice(),
      mimeType: result.mimeType,
      width: result.width,
      height: result.height,
    };
    this.#preparationCache?.set(output, {
      ...output,
      metadataSanitized: true,
      preparationApplied: true,
    });
    return output;
  }

  release(ref: ReceiptImageRef): void {
    this.remove(ref);
  }

  /**
   * Discard decoded bytes after an attempt while retaining the ephemeral file
   * and preview URL for an in-session retry.
   */
  releaseForRetry(ref: ReceiptImageRef): void {
    const entry = this.#entries.get(ref.ephemeralId);
    if (!entry) return;
    entry.pendingAbortController?.abort();
    entry.pendingAbortController = undefined;
    entry.pendingPreparation = undefined;
    if (entry.prepared) {
      entry.prepared.bytes.fill(0);
      entry.prepared = undefined;
      entry.preparedRotation = undefined;
    }
  }

  remove(ref: ReceiptImageRef): void {
    const entry = this.#entries.get(ref.ephemeralId);
    if (!entry) return;
    entry.pendingAbortController?.abort();
    entry.pendingAbortController = undefined;
    entry.pendingPreparation = undefined;
    URL.revokeObjectURL(entry.previewUrl);
    if (entry.prepared) {
      entry.prepared.bytes.fill(0);
      entry.prepared = undefined;
      entry.preparedRotation = undefined;
    }
    this.#entries.delete(ref.ephemeralId);
  }

  clear(): void {
    for (const entry of this.#entries.values()) {
      entry.pendingAbortController?.abort();
      URL.revokeObjectURL(entry.previewUrl);
      if (entry.prepared) {
        entry.prepared.bytes.fill(0);
      }
    }
    this.#entries.clear();
  }
}
