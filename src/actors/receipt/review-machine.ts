import { assign, fromPromise, setup } from "xstate";
import type { LocalPort } from "../../adapters/ports/index.ts";
import type { JsonValue } from "../../adapters/ports/common.ts";
import {
  addReceiptLine,
  createReceiptCommitService,
  editReceiptLine,
  editReceiptParent,
  isReceiptDomainError,
  parseDurableReceiptReview,
  type ReceiptCommitResult,
  type ReceiptDraftLine,
  type ReceiptReviewDraft,
  receiptSelectedTotal,
  removeReceiptLine,
  setReceiptLineQuantity,
  setReceiptLineSelected,
  toDurableReceiptReview,
  validateReceiptReviewDraft,
} from "../../domain/receipt.ts";
import type {
  ContractFailure,
  ReceiptCommitInput,
  ReceiptReviewEvent,
  ReceiptReviewOutputEvent,
} from "../contracts/index.ts";
import { contractFailureFromError } from "../contracts/types.ts";
import { moneyCompare } from "../../domain/money/index.ts";
import type { StableId } from "../../domain/index.ts";
import type { OrganizationStore } from "../../domain/organization.ts";

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
    readonly operation?: string;
  };

export function actorFailure(
  error: unknown,
  fallback: ContractFailure,
): ReceiptReviewActorFailure {
  if (isReceiptDomainError(error)) {
    return {
      code: error.code,
      message: error.message,
      retryable: false,
      ...(fallback.operation === undefined
        ? {}
        : { operation: fallback.operation }),
    };
  }
  return contractFailureFromError(error, fallback, { preserveOperation: true });
}

export type ReceiptReviewFailureOperation =
  | "hydrate"
  | "persist"
  | "save"
  | "clear";

export type ReceiptReviewActorContext = {
  readonly persistenceKey: string;
  /** A new review used only when no durable draft exists yet. */
  readonly seedReview: ReceiptReviewDraft | null;
  readonly review: ReceiptReviewDraft | null;
  readonly result: ReceiptCommitResult | null;
  readonly outcome: ReceiptReviewOutputEvent | null;
  readonly error: ReceiptReviewActorFailure | null;
  readonly persistenceRevision: number;
  readonly failureOperation: ReceiptReviewFailureOperation | null;
};

export type ReceiptReviewActorInput = {
  readonly persistenceKey?: string;
  readonly initialReview?: ReceiptReviewDraft;
  /** Hydrate an existing durable draft before falling back to initialReview. */
  readonly restoreExisting?: boolean;
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
    readonly type: "receipt.review.set-line-quantity";
    readonly lineId: StableId;
    readonly quantity: string;
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

export type PersistInput = {
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
        Boolean(
          context.review?.printedTotalMismatch &&
            moneyCompare(context.review.parent.printedTotal, "0") !== 0,
        ),
      noMismatch: ({ context }) =>
        !context.review?.printedTotalMismatch ||
        moneyCompare(context.review.parent.printedTotal, "0") === 0,
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
      seedReview: input?.initialReview
        ? validateReceiptReviewDraft(input.initialReview)
        : null,
      review: input?.restoreExisting
        ? null
        : input?.initialReview
        ? validateReceiptReviewDraft(input.initialReview)
        : null,
      result: null,
      outcome: null,
      error: null,
      persistenceRevision: 0,
      failureOperation: null,
    }),
    states: {
      closed: {
        always: [
          {
            target: "hydrating",
            guard: ({ context }) =>
              context.review === null && context.seedReview !== null,
          },
          {
            target: "persisting",
            guard: ({ context }) => context.review !== null,
          },
        ],
        on: {
          "receipt.review.hydrate": "hydrating",
          "receipt.review.open": {
            target: "persisting",
            actions: assign({
              review: ({ event }) => validateReceiptReviewDraft(event.review),
              result: () => null,
              outcome: () => null,
              error: () => null,
              failureOperation: () => null,
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
              target: "persisting",
              guard: ({ context }) => context.seedReview !== null,
              actions: assign({
                review: ({ context }) => context.seedReview,
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
                  operation: "receipt.review.hydrate",
                }),
              failureOperation: () => "hydrate" as const,
            }),
          },
        },
      },
      persisting: {
        tags: ["saving", "dirty"],
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
                  operation: "receipt.review.persist",
                }),
              failureOperation: () => "persist" as const,
            }),
          },
        },
        on: {
          "receipt.review.change": {
            target: "persisting",
            reenter: true,
            actions: assign({
              review: ({ event }) => validateReceiptReviewDraft(event.review),
              error: () => null,
            }),
          },
          "receipt.review.select-line": {
            target: "persisting",
            reenter: true,
            actions: assign({
              review: ({ context, event }) =>
                setReceiptLineSelected(
                  context.review!,
                  event.lineId,
                  event.selected,
                ),
              error: () => null,
            }),
          },
          "receipt.review.set-line-quantity": {
            target: "persisting",
            reenter: true,
            actions: assign({
              review: ({ context, event }) =>
                setReceiptLineQuantity(
                  context.review!,
                  event.lineId,
                  event.quantity,
                ),
              error: () => null,
            }),
          },
          "receipt.review.edit-line": {
            target: "persisting",
            reenter: true,
            actions: assign({
              review: ({ context, event }) =>
                editReceiptLine(context.review!, event.line),
              error: () => null,
            }),
          },
          "receipt.review.add-line": {
            target: "persisting",
            reenter: true,
            actions: assign({
              review: ({ context, event }) =>
                addReceiptLine(context.review!, event.line),
              error: () => null,
            }),
          },
          "receipt.review.remove-line": {
            target: "persisting",
            reenter: true,
            actions: assign({
              review: ({ context, event }) =>
                removeReceiptLine(context.review!, event.lineId),
              error: () => null,
            }),
          },
          "receipt.review.change-parent": {
            target: "persisting",
            reenter: true,
            actions: assign({
              review: ({ context, event }) =>
                editReceiptParent(context.review!, event.parent),
              error: () => null,
            }),
          },
        },
      },
      persisted: {
        tags: ["review-ready", "dirty"],
        on: {
          "receipt.review.change": {
            target: "persisting",
            actions: assign({
              review: ({ event }) => validateReceiptReviewDraft(event.review),
              error: () => null,
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
            }),
          },
          "receipt.review.set-line-quantity": {
            target: "persisting",
            actions: assign({
              review: ({ context, event }) =>
                setReceiptLineQuantity(
                  context.review!,
                  event.lineId,
                  event.quantity,
                ),
              error: () => null,
            }),
          },
          "receipt.review.edit-line": {
            target: "persisting",
            actions: assign({
              review: ({ context, event }) =>
                editReceiptLine(context.review!, event.line),
              error: () => null,
            }),
          },
          "receipt.review.add-line": {
            target: "persisting",
            actions: assign({
              review: ({ context, event }) =>
                addReceiptLine(context.review!, event.line),
              error: () => null,
            }),
          },
          "receipt.review.remove-line": {
            target: "persisting",
            actions: assign({
              review: ({ context, event }) =>
                removeReceiptLine(context.review!, event.lineId),
              error: () => null,
            }),
          },
          "receipt.review.change-parent": {
            target: "persisting",
            actions: assign({
              review: ({ context, event }) =>
                editReceiptParent(context.review!, event.parent),
              error: () => null,
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
              error: () => null,
              failureOperation: () => "clear" as const,
            }),
          },
          "receipt.review.cancel": "cancelled",
        },
      },
      mismatch: {
        tags: ["warning", "dirty"],
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
            }),
          },
          "receipt.review.set-line-quantity": {
            target: "persisting",
            actions: assign({
              review: ({ context, event }) =>
                setReceiptLineQuantity(
                  context.review!,
                  event.lineId,
                  event.quantity,
                ),
              error: () => null,
            }),
          },
          "receipt.review.edit-line": {
            target: "persisting",
            actions: assign({
              review: ({ context, event }) =>
                editReceiptLine(context.review!, event.line),
              error: () => null,
            }),
          },
          "receipt.review.add-line": {
            target: "persisting",
            actions: assign({
              review: ({ context, event }) =>
                addReceiptLine(context.review!, event.line),
              error: () => null,
            }),
          },
          "receipt.review.remove-line": {
            target: "persisting",
            actions: assign({
              review: ({ context, event }) =>
                removeReceiptLine(context.review!, event.lineId),
              error: () => null,
            }),
          },
          "receipt.review.change-parent": {
            target: "persisting",
            actions: assign({
              review: ({ context, event }) =>
                editReceiptParent(context.review!, event.parent),
              error: () => null,
            }),
          },
          "receipt.review.discard": {
            target: "clearing",
            actions: assign({
              outcome: () => ({ status: "discarded" } as const),
              error: () => null,
              failureOperation: () => "clear" as const,
            }),
          },
          "receipt.review.cancel": "cancelled",
        },
      },
      saving: {
        tags: ["saving", "dirty"],
        invoke: {
          src: "commitReceipt",
          input: ({ context }) => {
            const review = context.review!;
            if (moneyCompare(review.parent.printedTotal, "0") === 0) {
              const selectedTotal = receiptSelectedTotal(review);
              return {
                review: editReceiptParent(review, {
                  ...review.parent,
                  printedTotal: selectedTotal,
                }),
                confirmMismatch: true,
              };
            }
            return {
              review,
              confirmMismatch: true,
            };
          },
          onDone: {
            target: "clearing",
            actions: assign({
              result: ({ event }) => event.output,
              outcome: ({ event }) => ({
                status: "saved",
                result: event.output,
              }),
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
                  operation: "receipt.review.save",
                }),
              failureOperation: () => "save" as const,
            }),
          },
        },
      },
      clearing: {
        tags: ["clearing", "saving", "dirty"],
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
                  operation: "receipt.review.clear",
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
          "cancelled",
        ],
      },
      failed: {
        tags: ["error", "dirty"],
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
          "receipt.review.set-line-quantity": {
            target: "persisting",
            actions: assign({
              review: ({ context, event }) =>
                setReceiptLineQuantity(
                  context.review!,
                  event.lineId,
                  event.quantity,
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
