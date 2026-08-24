import { assign, setup } from "xstate";
import { unwiredPort } from "./ports.ts";
import type {
  ContractFailure,
  ReceiptCommitInput,
  ReceiptCommitOutput,
  ReceiptReviewDraft,
  ReceiptScanInput,
  ReceiptScanOutput,
} from "./types.ts";

export type ReceiptScanEvent =
  | { readonly type: "receipt.open" }
  | { readonly type: "receipt.image-selected" }
  | { readonly type: "receipt.scan"; readonly input: ReceiptScanInput }
  | { readonly type: "receipt.retry"; readonly input: ReceiptScanInput }
  | { readonly type: "receipt.replace-image" }
  | { readonly type: "receipt.network.offline" }
  | { readonly type: "receipt.network.online" }
  | { readonly type: "receipt.cancel" }
  | { readonly type: "receipt.use-manual" };

type ReceiptScanContext = {
  readonly review: ReceiptReviewDraft | null;
  readonly error: ContractFailure | null;
};

function receiptInputFromEvent(event: ReceiptScanEvent): ReceiptScanInput {
  if (event.type === "receipt.scan" || event.type === "receipt.retry") {
    return event.input;
  }
  throw new Error("Receipt scan port requires an image input event.");
}

export type ReceiptScanOutputEvent =
  | { readonly status: "review-ready"; readonly review: ReceiptReviewDraft }
  | { readonly status: "cancelled" }
  | { readonly status: "manual-entry" };

const receiptScanSetup = setup({
  types: {
    context: {} as ReceiptScanContext,
    events: {} as ReceiptScanEvent,
    output: {} as ReceiptScanOutputEvent,
  },
  actors: {
    scanReceipt: unwiredPort<ReceiptScanInput, ReceiptScanOutput>(
      "Gemini receipt extraction",
    ),
    validateReceipt: unwiredPort<ReceiptReviewDraft, ReceiptReviewDraft>(
      "receipt structured-output validation",
    ),
  },
  guards: {
    prepareImage: ({ event }) =>
      event.type === "receipt.scan" && event.input.prepareImage,
  },
});

export const receiptScanMachine = receiptScanSetup.createMachine({
  id: "receipt-scan",
  initial: "idle",
  context: { review: null, error: null },
  states: {
    idle: {
      on: {
        "receipt.open": "selecting",
        "receipt.network.offline": "offline",
      },
    },
    selecting: {
      tags: ["selecting"],
      on: {
        "receipt.image-selected": "selected",
        "receipt.network.offline": "offline",
        "receipt.cancel": "cancelled",
      },
    },
    selected: {
      tags: ["image-selected"],
      on: {
        "receipt.scan": [
          { target: "preparing", guard: "prepareImage" },
          "requesting",
        ],
        "receipt.replace-image": "selecting",
        "receipt.network.offline": "offline",
        "receipt.cancel": "cancelled",
      },
    },
    offline: {
      tags: ["offline"],
      on: {
        "receipt.network.online": "selecting",
        "receipt.use-manual": "manualEntry",
        "receipt.cancel": "cancelled",
      },
    },
    preparing: {
      tags: ["preparing"],
      invoke: {
        src: "scanReceipt",
        input: ({ event }) => receiptInputFromEvent(event),
        onDone: {
          target: "validating",
          actions: assign({
            review: ({ event }) => event.output.review,
            error: () => null,
          }),
        },
        onError: {
          target: "failed",
          actions: assign({
            error: () => ({
              code: "scan-failed",
              message: "Receipt extraction failed.",
            }),
          }),
        },
      },
      on: { "receipt.cancel": "cancelled" },
    },
    requesting: {
      tags: ["requesting"],
      invoke: {
        src: "scanReceipt",
        input: ({ event }) => receiptInputFromEvent(event),
        onDone: {
          target: "validating",
          actions: assign({
            review: ({ event }) => event.output.review,
            error: () => null,
          }),
        },
        onError: {
          target: "failed",
          actions: assign({
            error: () => ({
              code: "scan-failed",
              message: "Receipt extraction failed.",
            }),
          }),
        },
      },
      on: { "receipt.cancel": "cancelled" },
    },
    validating: {
      tags: ["validating"],
      invoke: {
        src: "validateReceipt",
        input: ({ context }) => context.review!,
        onDone: {
          target: "reviewReady",
          actions: assign({
            review: ({ event }) => event.output,
            error: () => null,
          }),
        },
        onError: {
          target: "failed",
          actions: assign({
            error: () => ({
              code: "invalid-output",
              message: "Receipt output needs review or retry.",
            }),
          }),
        },
      },
      on: { "receipt.cancel": "cancelled" },
    },
    reviewReady: {
      tags: ["review-ready"],
      on: {
        "receipt.retry": {
          target: "requesting",
          actions: assign({ review: () => null, error: () => null }),
        },
        "receipt.use-manual": "manualEntry",
        "receipt.cancel": "cancelled",
      },
    },
    failed: {
      tags: ["error"],
      on: {
        "receipt.retry": {
          target: "requesting",
          actions: assign({ error: () => null }),
        },
        "receipt.replace-image": "selecting",
        "receipt.use-manual": "manualEntry",
        "receipt.cancel": "cancelled",
      },
    },
    manualEntry: { type: "final", output: () => ({ status: "manual-entry" }) },
    cancelled: { type: "final", output: () => ({ status: "cancelled" }) },
  },
});

export type ReceiptReviewEvent =
  | {
    readonly type: "receipt.review.open";
    readonly review: ReceiptReviewDraft;
  }
  | {
    readonly type: "receipt.review.change";
    readonly review: ReceiptReviewDraft;
  }
  | {
    readonly type: "receipt.review.submit";
    readonly confirmMismatch: boolean;
  }
  | { readonly type: "receipt.review.confirm-mismatch" }
  | { readonly type: "receipt.review.retry" }
  | { readonly type: "receipt.review.discard" }
  | { readonly type: "receipt.review.cancel" };

export type ReceiptReviewOutputEvent =
  | { readonly status: "saved"; readonly result: ReceiptCommitOutput }
  | { readonly status: "discarded" }
  | { readonly status: "cancelled" };

type ReceiptReviewContext = {
  readonly review: ReceiptReviewDraft | null;
  readonly result: ReceiptCommitOutput | null;
  readonly error: ContractFailure | null;
};

const receiptReviewSetup = setup({
  types: {
    context: {} as ReceiptReviewContext,
    events: {} as ReceiptReviewEvent,
    output: {} as ReceiptReviewOutputEvent,
  },
  actors: {
    commitReceipt: unwiredPort<ReceiptCommitInput, ReceiptCommitOutput>(
      "atomic receipt commit",
    ),
  },
  guards: {
    mismatchConfirmed: ({ context, event }) =>
      event.type === "receipt.review.submit" &&
      (!context.review?.printedTotalMismatch || event.confirmMismatch),
    hasMismatch: ({ context }) => Boolean(context.review?.printedTotalMismatch),
  },
});

export const receiptReviewMachine = receiptReviewSetup.createMachine({
  id: "receipt-review",
  initial: "closed",
  context: { review: null, result: null, error: null },
  states: {
    closed: {
      on: {
        "receipt.review.open": {
          target: "ready",
          actions: assign({
            review: ({ event }) => event.review,
            result: () => null,
            error: () => null,
          }),
        },
      },
    },
    ready: {
      tags: ["review-ready"],
      on: {
        "receipt.review.change": {
          target: "editing",
          actions: assign({
            review: ({ event }) => event.review,
            error: () => null,
          }),
        },
        "receipt.review.submit": [
          { target: "saving", guard: "mismatchConfirmed" },
          { target: "mismatch", guard: "hasMismatch" },
          "saving",
        ],
        "receipt.review.discard": "discarded",
        "receipt.review.cancel": "cancelled",
      },
    },
    editing: {
      tags: ["dirty"],
      on: {
        "receipt.review.change": {
          actions: assign({
            review: ({ event }) => event.review,
            error: () => null,
          }),
        },
        "receipt.review.submit": [
          { target: "saving", guard: "mismatchConfirmed" },
          { target: "mismatch", guard: "hasMismatch" },
          "saving",
        ],
        "receipt.review.discard": "discarded",
        "receipt.review.cancel": "cancelled",
      },
    },
    mismatch: {
      tags: ["warning"],
      on: {
        "receipt.review.confirm-mismatch": "saving",
        "receipt.review.change": {
          target: "editing",
          actions: assign({ review: ({ event }) => event.review }),
        },
        "receipt.review.discard": "discarded",
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
          target: "saved",
          actions: assign({
            result: ({ event }) => event.output,
            error: () => null,
          }),
        },
        onError: {
          target: "failed",
          actions: assign({
            error: () => ({
              code: "save-failed",
              message: "Receipt was not saved.",
            }),
          }),
        },
      },
      on: { "receipt.review.cancel": "cancelled" },
    },
    failed: {
      tags: ["error"],
      on: {
        "receipt.review.retry": "saving",
        "receipt.review.change": {
          target: "editing",
          actions: assign({ review: ({ event }) => event.review }),
        },
        "receipt.review.discard": "discarded",
        "receipt.review.cancel": "cancelled",
      },
    },
    saved: {
      type: "final",
      output: ({ context }) => ({ status: "saved", result: context.result! }),
    },
    discarded: { type: "final", output: () => ({ status: "discarded" }) },
    cancelled: { type: "final", output: () => ({ status: "cancelled" }) },
  },
});
