import { assign, fromPromise, setup } from "xstate";
import type {
  GeminiModelAndExtractionPort,
  ImageInput,
  ImagePreparationPort,
  LocalPort,
} from "../adapters/ports/index.ts";
import {
  RECEIPT_INSTRUCTION_VERSION,
  RECEIPT_SCHEMA_VERSION_NUMBER,
} from "../adapters/gemini/schema.ts";
import {
  addReceiptLine,
  createReceiptCommitService,
  editReceiptLine,
  editReceiptParent,
  isReceiptDomainError,
  normalizeReceiptExtractionDraft,
  parseDurableReceiptReview,
  type ReceiptCommitResult,
  type ReceiptDraftLine,
  type ReceiptReviewDraft,
  removeReceiptLine,
  setReceiptLineSelected,
  toDurableReceiptReview,
  validateReceiptReviewDraft,
} from "../domain/receipt.ts";
import type {
  ContractFailure,
  ReceiptCommitInput,
  ReceiptImageRef,
  ReceiptReviewEvent,
  ReceiptReviewOutputEvent,
  ReceiptScanInput,
  ReceiptScanOutput,
} from "./contracts/index.ts";
import { receiptScanMachine } from "./contracts/receipt.ts";
import { contractFailureFromError } from "./contracts/types.ts";
import type { StableId } from "../domain/index.ts";
import type { OrganizationStore } from "../domain/organization.ts";
import type { JsonValue } from "../adapters/ports/common.ts";

export type ReceiptImageResolver = (
  image: ReceiptImageRef,
  signal?: AbortSignal,
) => Promise<ImageInput>;

export type ReceiptScanMachineDependencies = {
  readonly gemini: GeminiModelAndExtractionPort;
  readonly imagePreparation: ImagePreparationPort;
  readonly resolveImage: ReceiptImageResolver;
  readonly releaseImage?: (image: ReceiptImageRef) => void | Promise<void>;
  readonly nextLineId?: () => StableId;
};

function defaultLineId(): StableId {
  const value = globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random()}`;
  return `receipt-line-${value}`;
}

async function extractReview(
  dependencies: ReceiptScanMachineDependencies,
  input: ReceiptScanInput,
  signal: AbortSignal,
): Promise<ReceiptScanOutput> {
  try {
    const image = await dependencies.resolveImage(input.image, signal);
    const prepared = await dependencies.imagePreparation.prepare(image, {
      enabled: input.prepareImage,
      signal,
    });
    const draft = await dependencies.gemini.extractReceipt({
      modelId: input.model,
      image: prepared,
      schemaVersion: RECEIPT_SCHEMA_VERSION_NUMBER,
      instructionVersion: RECEIPT_INSTRUCTION_VERSION,
      categories: input.categoryCatalogue,
      locale: input.locale,
      currency: input.currency,
    }, { signal });
    const review = normalizeReceiptExtractionDraft(draft, {
      projectId: input.projectId,
      currency: input.currency,
      categoryCatalogue: input.categoryCatalogue,
      nextId: dependencies.nextLineId ?? defaultLineId,
    });
    return { review };
  } finally {
    await dependencies.releaseImage?.(input.image);
  }
}

/**
 * Injects the A-301 image/Gemini ports and browser-side review validation into
 * the locked scan lifecycle. The ephemeral image is available only to the
 * invoked request and is released on success, failure, or cancellation.
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

export type ReceiptReviewActorFailure =
  | ContractFailure
  | {
    readonly code:
      | "invalid"
      | "mismatch"
      | "not-found"
      | "conflict"
      | "corrupt-data";
    readonly message: string;
    readonly retryable: false;
  };

function actorFailure(
  error: unknown,
  fallback: ContractFailure,
): ReceiptReviewActorFailure {
  if (isReceiptDomainError(error)) {
    return { code: error.code, message: error.message, retryable: false };
  }
  return contractFailureFromError(error, fallback);
}

type ReceiptReviewFailureOperation = "hydrate" | "persist" | "save" | "clear";

export type ReceiptReviewActorContext = {
  readonly persistenceKey: string;
  readonly review: ReceiptReviewDraft | null;
  readonly result: ReceiptCommitResult | null;
  readonly outcome: ReceiptReviewOutputEvent | null;
  readonly error: ReceiptReviewActorFailure | null;
  readonly persistenceRevision: number;
  readonly failureOperation: ReceiptReviewFailureOperation | null;
};

export type ReceiptReviewActorInput = {
  readonly persistenceKey?: string;
};

export type ReceiptReviewActorEvent =
  | ReceiptReviewEvent
  | { readonly type: "receipt.review.hydrate" }
  | {
    readonly type: "receipt.review.select-line";
    readonly lineId: StableId;
    readonly selected: boolean;
  }
  | {
    readonly type: "receipt.review.edit-line";
    readonly line: ReceiptDraftLine;
  }
  | {
    readonly type: "receipt.review.add-line";
    readonly line: ReceiptDraftLine;
  }
  | { readonly type: "receipt.review.remove-line"; readonly lineId: StableId }
  | {
    readonly type: "receipt.review.change-parent";
    readonly parent: ReceiptReviewDraft["parent"];
  };

export type ReceiptReviewActorDependencies = {
  readonly local: LocalPort;
  readonly organization?: OrganizationStore;
  readonly commit?: {
    commit(request: ReceiptCommitInput): Promise<ReceiptCommitResult>;
  };
  readonly persistenceKey?: string;
};

type PersistInput = {
  readonly key: string;
  readonly review: ReceiptReviewDraft;
  readonly revision: number;
};

function asJsonValue(value: unknown): JsonValue {
  return value as JsonValue;
}

function localCommit(
  dependencies: ReceiptReviewActorDependencies,
) {
  if (dependencies.commit) return dependencies.commit;
  if (!dependencies.organization) {
    throw new Error("Receipt review requires an atomic organization store.");
  }
  return createReceiptCommitService(dependencies.organization);
}

/**
 * Durable review actor. It persists only validated structured review data in
 * the local workflow-snapshot collection; commit and explicit discard clear
 * that snapshot after the terminal operation.
 */
export function createReceiptReviewMachine(
  dependencies: ReceiptReviewActorDependencies,
) {
  const commit = localCommit(dependencies);
  const reviewSetup = setup({
    types: {
      context: {} as ReceiptReviewActorContext,
      events: {} as ReceiptReviewActorEvent,
      output: {} as ReceiptReviewOutputEvent,
      input: {} as ReceiptReviewActorInput | undefined,
    },
    actors: {
      hydrateReview: fromPromise(
        async ({ input }: { input: { readonly key: string } }) => {
          const value = await dependencies.local.transaction(
            "readonly",
            (transaction) =>
              transaction.get<JsonValue>("workflow-snapshots", input.key),
          );
          return value === undefined ? null : parseDurableReceiptReview(value);
        },
      ),
      persistReview: fromPromise(
        async ({ input }: { input: PersistInput }) => {
          const snapshot = toDurableReceiptReview(input.review, input.revision);
          await dependencies.local.transaction(
            "readwrite",
            (transaction) =>
              transaction.put(
                "workflow-snapshots",
                input.key,
                asJsonValue(snapshot),
              ),
          );
          return snapshot.revision;
        },
      ),
      clearReview: fromPromise(
        async ({ input }: { input: { readonly key: string } }) => {
          await dependencies.local.transaction(
            "readwrite",
            (transaction) =>
              transaction.delete("workflow-snapshots", input.key),
          );
        },
      ),
      commitReceipt: fromPromise(
        async ({ input }: { input: ReceiptCommitInput }) =>
          await commit.commit(input),
      ),
    },
    guards: {
      hasMismatch: ({ context }) =>
        Boolean(context.review?.printedTotalMismatch),
      noMismatch: ({ context }) => !context.review?.printedTotalMismatch,
      hasSavedOutcome: ({ context }) => context.outcome?.status === "saved",
      hasDiscardedOutcome: ({ context }) =>
        context.outcome?.status === "discarded",
      retryHydrate: ({ context }) => context.failureOperation === "hydrate",
      retryPersist: ({ context }) => context.failureOperation === "persist",
      retrySave: ({ context }) => context.failureOperation === "save",
      retryClear: ({ context }) => context.failureOperation === "clear",
    },
  });

  return reviewSetup.createMachine({
    id: "receipt-review-durable",
    initial: "closed",
    context: ({ input }) => ({
      persistenceKey: input?.persistenceKey ?? dependencies.persistenceKey ??
        "workflow:receipt-review",
      review: null,
      result: null,
      outcome: null,
      error: null,
      persistenceRevision: 0,
      failureOperation: null,
    }),
    states: {
      closed: {
        on: {
          "receipt.review.hydrate": "hydrating",
          "receipt.review.open": {
            target: "persisting",
            actions: assign({
              review: ({ event }) => validateReceiptReviewDraft(event.review),
              result: () => null,
              outcome: () => null,
              error: () => null,
              failureOperation: () => "persist" as const,
            }),
          },
        },
      },
      hydrating: {
        tags: ["loading"],
        invoke: {
          src: "hydrateReview",
          input: ({ context }) => ({ key: context.persistenceKey }),
          onDone: [
            {
              target: "persisted",
              guard: ({ event }) => event.output !== null,
              actions: assign({
                review: ({ event }) => event.output!.review,
                persistenceRevision: ({ event }) => event.output!.revision,
                error: () => null,
                failureOperation: () => null,
              }),
            },
            {
              target: "closed",
              actions: assign({
                review: () => null,
                error: () => null,
                failureOperation: () => null,
              }),
            },
          ],
          onError: {
            target: "failed",
            actions: assign({
              error: ({ event }) =>
                actorFailure(event.error, {
                  code: "corrupt-data",
                  message: "Unable to restore the receipt review.",
                  retryable: true,
                }),
              failureOperation: () => "hydrate" as const,
            }),
          },
        },
      },
      persisting: {
        tags: ["saving"],
        invoke: {
          src: "persistReview",
          input: ({ context }) => ({
            key: context.persistenceKey,
            review: context.review!,
            revision: context.persistenceRevision + 1,
          }),
          onDone: {
            target: "persisted",
            actions: assign({
              persistenceRevision: ({ event }) => event.output,
              error: () => null,
              failureOperation: () => null,
            }),
          },
          onError: {
            target: "failed",
            actions: assign({
              error: ({ event }) =>
                actorFailure(event.error, {
                  code: "unknown",
                  message: "Unable to save the receipt review draft.",
                  retryable: true,
                }),
              failureOperation: () => "persist" as const,
            }),
          },
        },
      },
      persisted: {
        tags: ["review-ready"],
        on: {
          "receipt.review.change": {
            target: "persisting",
            actions: assign({
              review: ({ event }) => validateReceiptReviewDraft(event.review),
              error: () => null,
              failureOperation: () => "persist" as const,
            }),
          },
          "receipt.review.select-line": {
            target: "persisting",
            actions: assign({
              review: ({ context, event }) =>
                setReceiptLineSelected(
                  context.review!,
                  event.lineId,
                  event.selected,
                ),
              error: () => null,
              failureOperation: () => "persist" as const,
            }),
          },
          "receipt.review.edit-line": {
            target: "persisting",
            actions: assign({
              review: ({ context, event }) =>
                editReceiptLine(context.review!, event.line),
              error: () => null,
              failureOperation: () => "persist" as const,
            }),
          },
          "receipt.review.add-line": {
            target: "persisting",
            actions: assign({
              review: ({ context, event }) =>
                addReceiptLine(context.review!, event.line),
              error: () => null,
              failureOperation: () => "persist" as const,
            }),
          },
          "receipt.review.remove-line": {
            target: "persisting",
            actions: assign({
              review: ({ context, event }) =>
                removeReceiptLine(context.review!, event.lineId),
              error: () => null,
              failureOperation: () => "persist" as const,
            }),
          },
          "receipt.review.change-parent": {
            target: "persisting",
            actions: assign({
              review: ({ context, event }) =>
                editReceiptParent(context.review!, event.parent),
              error: () => null,
              failureOperation: () => "persist" as const,
            }),
          },
          "receipt.review.submit": [
            { target: "saving", guard: "noMismatch" },
            {
              target: "saving",
              guard: ({ event }) =>
                event.type === "receipt.review.submit" && event.confirmMismatch,
            },
            { target: "mismatch", guard: "hasMismatch" },
          ],
          "receipt.review.confirm-mismatch": {
            target: "saving",
            guard: "hasMismatch",
          },
          "receipt.review.discard": {
            target: "clearing",
            actions: assign({
              outcome: () => ({ status: "discarded" } as const),
              review: () => null,
              error: () => null,
              failureOperation: () => "clear" as const,
            }),
          },
          "receipt.review.cancel": "cancelled",
        },
      },
      mismatch: {
        tags: ["warning"],
        on: {
          "receipt.review.confirm-mismatch": "saving",
          "receipt.review.submit": {
            target: "saving",
            guard: ({ event }) =>
              event.type === "receipt.review.submit" && event.confirmMismatch,
          },
          "receipt.review.change": {
            target: "persisting",
            actions: assign({
              review: ({ event }) => validateReceiptReviewDraft(event.review),
              error: () => null,
              failureOperation: () => "persist" as const,
            }),
          },
          "receipt.review.select-line": {
            target: "persisting",
            actions: assign({
              review: ({ context, event }) =>
                setReceiptLineSelected(
                  context.review!,
                  event.lineId,
                  event.selected,
                ),
              error: () => null,
              failureOperation: () => "persist" as const,
            }),
          },
          "receipt.review.edit-line": {
            target: "persisting",
            actions: assign({
              review: ({ context, event }) =>
                editReceiptLine(context.review!, event.line),
              error: () => null,
              failureOperation: () => "persist" as const,
            }),
          },
          "receipt.review.add-line": {
            target: "persisting",
            actions: assign({
              review: ({ context, event }) =>
                addReceiptLine(context.review!, event.line),
              error: () => null,
              failureOperation: () => "persist" as const,
            }),
          },
          "receipt.review.remove-line": {
            target: "persisting",
            actions: assign({
              review: ({ context, event }) =>
                removeReceiptLine(context.review!, event.lineId),
              error: () => null,
              failureOperation: () => "persist" as const,
            }),
          },
          "receipt.review.change-parent": {
            target: "persisting",
            actions: assign({
              review: ({ context, event }) =>
                editReceiptParent(context.review!, event.parent),
              error: () => null,
              failureOperation: () => "persist" as const,
            }),
          },
          "receipt.review.discard": {
            target: "clearing",
            actions: assign({
              outcome: () => ({ status: "discarded" } as const),
              review: () => null,
              error: () => null,
              failureOperation: () => "clear" as const,
            }),
          },
          "receipt.review.cancel": "cancelled",
        },
      },
      saving: {
        tags: ["saving"],
        invoke: {
          src: "commitReceipt",
          input: ({ context }) => ({
            review: context.review!,
            confirmMismatch: true,
          }),
          onDone: {
            target: "clearing",
            actions: assign({
              result: ({ event }) => event.output,
              outcome: ({ event }) => ({
                status: "saved",
                result: event.output,
              }),
              review: () => null,
              error: () => null,
              failureOperation: () => "clear" as const,
            }),
          },
          onError: {
            target: "failed",
            actions: assign({
              error: ({ event }) =>
                actorFailure(event.error, {
                  code: "unknown",
                  message: "Receipt was not saved.",
                  retryable: true,
                }),
              failureOperation: () => "save" as const,
            }),
          },
        },
      },
      clearing: {
        tags: ["clearing", "saving"],
        invoke: {
          src: "clearReview",
          input: ({ context }) => ({ key: context.persistenceKey }),
          onDone: "cleared",
          onError: {
            target: "failed",
            actions: assign({
              error: ({ event }) =>
                actorFailure(event.error, {
                  code: "unknown",
                  message: "Receipt review cleanup failed.",
                  retryable: true,
                }),
              failureOperation: () => "clear" as const,
            }),
          },
        },
      },
      cleared: {
        always: [
          { target: "saved", guard: "hasSavedOutcome" },
          { target: "discarded", guard: "hasDiscardedOutcome" },
        ],
      },
      failed: {
        tags: ["error"],
        on: {
          "receipt.review.retry": [
            { target: "hydrating", guard: "retryHydrate" },
            { target: "persisting", guard: "retryPersist" },
            { target: "saving", guard: "retrySave" },
            { target: "clearing", guard: "retryClear" },
          ],
          "receipt.review.change": {
            target: "persisting",
            actions: assign({
              review: ({ event }) => validateReceiptReviewDraft(event.review),
              error: () => null,
              failureOperation: () => "persist" as const,
            }),
          },
          "receipt.review.discard": {
            target: "clearing",
            actions: assign({
              outcome: () => ({ status: "discarded" } as const),
              review: () => null,
              error: () => null,
              failureOperation: () => "clear" as const,
            }),
          },
          "receipt.review.cancel": "cancelled",
        },
      },
      saved: {
        type: "final",
        output: ({ context }) => ({ status: "saved", result: context.result! }),
      },
      discarded: {
        type: "final",
        output: () => ({ status: "discarded" }),
      },
      cancelled: {
        type: "final",
        output: () => ({ status: "cancelled" }),
      },
    },
  });
}

export type ReceiptScanInputLike = ReceiptScanInput;
