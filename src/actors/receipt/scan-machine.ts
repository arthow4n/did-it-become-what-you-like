import { fromPromise } from "xstate";
import {
  adapterError,
  type AdapterErrorCode,
  type ImageInput,
  type ImagePreparationPort,
  isAdapterError,
  type ReceiptAiPort,
} from "../../adapters/ports/index.ts";
import {
  RECEIPT_INSTRUCTION_VERSION,
  RECEIPT_SCHEMA_VERSION_NUMBER,
} from "../../adapters/receipt-ai/schema.ts";
import {
  isReceiptDomainError,
  normalizeReceiptExtractionDraft,
  type ReceiptReviewDraft,
  validateReceiptReviewDraft,
} from "../../domain/receipt.ts";
import type {
  ReceiptImageRef,
  ReceiptScanInput,
  ReceiptScanOutput,
} from "../contracts/index.ts";
import { receiptScanMachine } from "../contracts/receipt.ts";
import type { CalendarDate, StableId } from "../../domain/index.ts";

export type ReceiptImageResolver = (
  image: ReceiptImageRef,
  signal?: AbortSignal,
) => Promise<ImageInput>;

export type ReceiptScanMachineDependencies = {
  readonly ai: ReceiptAiPort;
  readonly imagePreparation: ImagePreparationPort;
  readonly resolveImage: ReceiptImageResolver;
  /**
   * Called after each attempt so the owner can discard derived image bytes.
   * Interactive owners may retain their ephemeral source for Retry until the
   * scan UI performs terminal cleanup.
   */
  readonly releaseImage?: (image: ReceiptImageRef) => void | Promise<void>;
  readonly nextLineId?: () => StableId;
};

export type ReceiptScanInputLike = ReceiptScanInput;

function defaultLineId(): StableId {
  const value = globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random()}`;
  return `receipt-line-${value}`;
}

function scanStepError(
  error: unknown,
  code: AdapterErrorCode,
  operation: string,
): unknown {
  if (isAdapterError(error)) return error;
  if (isReceiptDomainError(error)) {
    // Keep the domain taxonomy while assigning a bounded scan-phase
    // operation. The contract boundary supplies the safe message and retry
    // policy for this plain shape.
    return { code: error.code, operation };
  }
  return adapterError(code, operation);
}

async function extractReview(
  dependencies: ReceiptScanMachineDependencies,
  input: ReceiptScanInput,
  signal: AbortSignal,
): Promise<ReceiptScanOutput> {
  let output: ReceiptScanOutput | undefined;
  let failure: unknown;
  let failed = false;
  const imageRefs = input.images && input.images.length > 0
    ? input.images
    : input.image
    ? [input.image]
    : [];
  if (imageRefs.length === 0) {
    throw scanStepError(
      new Error("No receipt image selected."),
      "invalid-request",
      "receipt.image.resolve",
    );
  }
  try {
    const preparedImages: Awaited<
      ReturnType<ImagePreparationPort["prepare"]>
    >[] = [];
    for (const ref of imageRefs) {
      let image: ImageInput;
      try {
        image = await dependencies.resolveImage(ref, signal);
      } catch (error) {
        throw scanStepError(error, "not-found", "receipt.image.resolve");
      }

      let prepared: Awaited<ReturnType<ImagePreparationPort["prepare"]>>;
      try {
        prepared = await dependencies.imagePreparation.prepare(image, {
          enabled: input.prepareImage,
          signal,
        });
      } catch (error) {
        throw scanStepError(error, "invalid-request", "image.prepare");
      }
      preparedImages.push(prepared);
    }

    const now = new Date();
    const today = input.today ?? (
      `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${
        String(now.getDate()).padStart(2, "0")
      }` as CalendarDate
    );

    let draft: Awaited<ReturnType<ReceiptAiPort["extractReceipt"]>>;
    try {
      draft = await dependencies.ai.extractReceipt({
        modelId: input.model,
        image: preparedImages[0]!,
        images: preparedImages,
        documentType: input.scanMode ?? "receipt",
        schemaVersion: RECEIPT_SCHEMA_VERSION_NUMBER,
        instructionVersion: RECEIPT_INSTRUCTION_VERSION,
        categories: input.categoryCatalogue,
        locale: input.locale,
        currency: input.currency,
        today,
      }, { signal });
    } catch (error) {
      throw scanStepError(error, "unknown", "receipt.ai.extract");
    }

    let review: ReceiptReviewDraft;
    try {
      review = normalizeReceiptExtractionDraft(draft, {
        projectId: input.projectId,
        currency: input.currency,
        categoryCatalogue: input.categoryCatalogue,
        nextId: dependencies.nextLineId ?? defaultLineId,
        scanMode: input.scanMode,
        today,
      });
    } catch (error) {
      throw scanStepError(error, "invalid-request", "receipt.normalize");
    }
    output = { review, scanMode: input.scanMode ?? "receipt" };
  } catch (error) {
    failed = true;
    failure = error;
  }

  for (const ref of imageRefs) {
    try {
      await dependencies.releaseImage?.(ref);
    } catch (error) {
      // A best-effort cleanup failure must never hide the actionable failure
      // from image resolution, preparation, extraction, or normalization.
      if (!failed) {
        failed = true;
        failure = scanStepError(error, "unknown", "receipt.image.release");
      }
    }
  }

  if (failed) throw failure;
  return output!;
}

/**
 * Injects the A-301 image/Gemini ports and browser-side review validation into
 * the locked scan lifecycle. Derived image data is released after every
 * attempt; the interactive owner controls terminal cleanup of its ephemeral
 * source so a failed scan can be retried.
 */
export function createReceiptScanMachine(
  dependencies: ReceiptScanMachineDependencies,
) {
  return receiptScanMachine.provide({
    actors: {
      scanReceipt: fromPromise(
        async (
          { input, signal }: { input: ReceiptScanInput; signal: AbortSignal },
        ) => await extractReview(dependencies, input, signal),
      ),
      validateReceipt: fromPromise(
        ({ input }: { input: ReceiptReviewDraft }) =>
          Promise.resolve(validateReceiptReviewDraft(input)),
      ),
    },
  });
}
