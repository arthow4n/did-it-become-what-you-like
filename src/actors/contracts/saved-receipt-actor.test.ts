import { createActor } from "xstate";
import {
  type ReceiptAggregate,
  type ReceiptManagementService,
} from "../../domain/receipt.ts";
import { UNCATEGORIZED_CATEGORY_ID } from "../../domain/index.ts";
import { createSavedReceiptMachine } from "../saved-receipt.ts";

declare const Deno: {
  test(name: string, fn: () => void | Promise<void>): void;
};

function assert(
  condition: unknown,
  message = "Expected condition",
): asserts condition {
  if (!condition) throw new Error(message);
}

function assertEquals<T>(actual: T, expected: T): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

async function settle(): Promise<void> {
  for (let index = 0; index < 12; index += 1) await Promise.resolve();
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
}

async function waitForState(
  actor: { getSnapshot(): { value: unknown } },
  expected: string,
): Promise<void> {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    await settle();
    if (actor.getSnapshot().value === expected) return;
  }
  throw new Error(
    `Expected actor state ${expected}, got ${
      String(actor.getSnapshot().value)
    }`,
  );
}

const receiptId = "receipt-saved-actor";
const purchaseId = "line-saved-actor";
const adjustmentId = "adjustment-saved-actor";

const aggregate: ReceiptAggregate = {
  receipt: {
    schemaVersion: 1,
    type: "receipt",
    id: receiptId,
    projectId: "project-saved-actor",
    date: "2026-08-30",
    time: "18:30",
    merchant: "Actor market",
    currency: "SEK",
    printedTotal: "-8",
  },
  purchaseLines: [{
    schemaVersion: 1,
    type: "receipt-purchase-line",
    id: purchaseId,
    receiptId,
    projectId: "project-saved-actor",
    categoryId: UNCATEGORIZED_CATEGORY_ID,
    description: "Coffee",
    lineTotal: "-10",
  }],
  adjustments: [{
    schemaVersion: 1,
    type: "receipt-adjustment",
    id: adjustmentId,
    receiptId,
    projectId: "project-saved-actor",
    categoryId: UNCATEGORIZED_CATEGORY_ID,
    description: "Discount",
    amount: "2",
    lineId: purchaseId,
  }],
  derivedExpenses: [],
};

function createService(
  overrides: Partial<ReceiptManagementService> = {},
): ReceiptManagementService {
  return {
    get: overrides.get ?? (() => Promise.resolve(aggregate)),
    updateMetadata: overrides.updateMetadata ??
      (() => Promise.resolve(aggregate)),
    updateLine: overrides.updateLine ?? (() => Promise.resolve(aggregate)),
    deleteLine: overrides.deleteLine ??
      (() => Promise.resolve({ aggregate, deletedReceipt: false })),
    deleteReceipt: overrides.deleteReceipt ??
      (() => Promise.resolve({ deletedReceipt: true })),
  };
}

function start(service: ReceiptManagementService = createService()) {
  return createActor(createSavedReceiptMachine({ service }), {
    input: { receiptId },
  }).start();
}

Deno.test(
  "saved-receipt actor loads success and not-found outcomes and resets drafts on reload",
  async () => {
    const actor = start();
    await waitForState(actor, "ready");
    assertEquals(actor.getSnapshot().context.aggregate?.receipt.id, receiptId);
    assert(actor.getSnapshot().hasTag("ready"));

    actor.send({ type: "receipt.detail.edit-metadata" });
    actor.send({
      type: "receipt.detail.change-metadata",
      changes: {
        merchant: "Changed market",
        date: aggregate.receipt.date,
        time: aggregate.receipt.time ?? null,
        printedTotal: aggregate.receipt.printedTotal,
      },
    });
    assert(actor.getSnapshot().hasTag("dirty"));
    actor.send({ type: "receipt.detail.reload" });
    await waitForState(actor, "ready");
    assertEquals(actor.getSnapshot().context.metadataDraft, null);
    assertEquals(
      actor.getSnapshot().context.aggregate?.receipt.merchant,
      "Actor market",
    );
    actor.stop();

    const missing = start(
      createService({ get: () => Promise.resolve(undefined) }),
    );
    await waitForState(missing, "notFound");
    assertEquals(missing.getSnapshot().output?.status, "not-found");
    missing.stop();
  },
);

Deno.test(
  "saved-receipt actor stages metadata and line edits until explicit save",
  async () => {
    let metadataSaves = 0;
    let lineSaves = 0;
    const editedAggregate: ReceiptAggregate = {
      ...aggregate,
      receipt: { ...aggregate.receipt, merchant: "Saved market" },
    };
    const service = createService({
      updateMetadata: () => {
        metadataSaves += 1;
        return Promise.resolve(editedAggregate);
      },
      updateLine: () => {
        lineSaves += 1;
        return Promise.resolve(aggregate);
      },
    });
    const actor = start(service);
    await waitForState(actor, "ready");
    actor.send({ type: "receipt.detail.edit-metadata" });
    assert(actor.getSnapshot().hasTag("editing"));
    assert(!actor.getSnapshot().hasTag("dirty"));
    actor.send({
      type: "receipt.detail.change-metadata",
      changes: {
        merchant: "Saved market",
        date: aggregate.receipt.date,
        time: aggregate.receipt.time ?? null,
        printedTotal: aggregate.receipt.printedTotal,
      },
    });
    assert(actor.getSnapshot().hasTag("dirty"));
    assertEquals(metadataSaves, 0);
    actor.send({ type: "receipt.detail.save-metadata" });
    assert(actor.getSnapshot().hasTag("mutating"));
    assert(!actor.getSnapshot().can({ type: "receipt.detail.save-metadata" }));
    await waitForState(actor, "ready");
    assertEquals(metadataSaves, 1);
    assertEquals(
      actor.getSnapshot().context.aggregate?.receipt.merchant,
      "Saved market",
    );

    actor.send({ type: "receipt.detail.edit-line", lineId: purchaseId });
    actor.send({
      type: "receipt.detail.change-line",
      changes: {
        type: "purchase",
        description: "Tea",
        categoryId: UNCATEGORIZED_CATEGORY_ID,
        lineTotal: "-4",
      },
    });
    assert(actor.getSnapshot().hasTag("dirty"));
    actor.send({ type: "receipt.detail.save-line" });
    await waitForState(actor, "ready");
    assertEquals(lineSaves, 1);
    actor.stop();
  },
);

Deno.test(
  "saved-receipt actor confirms line and whole-receipt deletion with final outcomes",
  async () => {
    const actor = start(createService({
      deleteLine: () =>
        Promise.resolve({
          aggregate: {
            ...aggregate,
            purchaseLines: [],
          },
          deletedReceipt: false,
          deletedLineId: purchaseId,
        }),
    }));
    await waitForState(actor, "ready");
    actor.send({
      type: "receipt.detail.request-line-delete",
      lineId: purchaseId,
    });
    assert(actor.getSnapshot().matches("confirmingLineDelete"));
    actor.send({ type: "receipt.detail.cancel-delete" });
    assert(actor.getSnapshot().matches("ready"));
    actor.send({
      type: "receipt.detail.request-line-delete",
      lineId: purchaseId,
    });
    actor.send({ type: "receipt.detail.confirm-line-delete" });
    await waitForState(actor, "ready");
    assertEquals(actor.getSnapshot().context.aggregate?.purchaseLines, []);
    actor.stop();

    const deleted = start();
    await waitForState(deleted, "ready");
    deleted.send({ type: "receipt.detail.request-receipt-delete" });
    assert(deleted.getSnapshot().matches("confirmingReceiptDelete"));
    deleted.send({ type: "receipt.detail.confirm-receipt-delete" });
    await waitForState(deleted, "completed");
    const deletedOutput = deleted.getSnapshot().output;
    assert(deletedOutput?.status === "deleted");
    assertEquals(deletedOutput.receiptId, receiptId);
    deleted.stop();

    const finalLine = start(createService({
      deleteLine: () =>
        Promise.resolve({ deletedReceipt: true, deletedLineId: purchaseId }),
    }));
    await waitForState(finalLine, "ready");
    finalLine.send({
      type: "receipt.detail.request-line-delete",
      lineId: purchaseId,
    });
    finalLine.send({ type: "receipt.detail.confirm-line-delete" });
    await waitForState(finalLine, "completed");
    const finalLineOutput = finalLine.getSnapshot().output;
    assert(finalLineOutput?.status === "deleted");
    assertEquals(finalLineOutput.deletedLineId, purchaseId);
    finalLine.stop();
  },
);

Deno.test(
  "saved-receipt actor preserves retry targets, rejects stale lines, and cancels late mutations",
  async () => {
    let loads = 0;
    const retryLoad = start(createService({
      get: () => {
        loads += 1;
        return loads === 1
          ? Promise.reject({ code: "offline" })
          : Promise.resolve(aggregate);
      },
    }));
    await waitForState(retryLoad, "failure");
    assertEquals(retryLoad.getSnapshot().context.error?.code, "offline");
    assert(retryLoad.getSnapshot().context.error?.retryable === true);
    retryLoad.send({ type: "receipt.detail.retry" });
    await waitForState(retryLoad, "ready");
    retryLoad.stop();

    const stale = start();
    await waitForState(stale, "ready");
    stale.send({ type: "receipt.detail.edit-line", lineId: "line-missing" });
    await waitForState(stale, "notFound");
    stale.stop();

    let resolveMutation: ((value: ReceiptAggregate) => void) | undefined;
    const cancelled = start(createService({
      updateMetadata: () =>
        new Promise<ReceiptAggregate>((resolve) => {
          resolveMutation = resolve;
        }),
    }));
    await waitForState(cancelled, "ready");
    cancelled.send({ type: "receipt.detail.edit-metadata" });
    cancelled.send({
      type: "receipt.detail.change-metadata",
      changes: {
        merchant: "Pending market",
        date: aggregate.receipt.date,
        time: aggregate.receipt.time ?? null,
        printedTotal: aggregate.receipt.printedTotal,
      },
    });
    cancelled.send({ type: "receipt.detail.save-metadata" });
    assert(cancelled.getSnapshot().matches("mutating"));
    cancelled.send({ type: "receipt.detail.cancel" });
    assert(cancelled.getSnapshot().matches("cancelled"));
    resolveMutation?.(aggregate);
    await settle();
    assert(cancelled.getSnapshot().matches("cancelled"));
    cancelled.stop();
  },
);

Deno.test(
  "saved-receipt actor guards dirty back and browser navigation with discard intent",
  async () => {
    const actor = start();
    await waitForState(actor, "ready");
    actor.send({ type: "receipt.detail.edit-line", lineId: adjustmentId });
    actor.send({
      type: "receipt.detail.change-line",
      changes: {
        type: "adjustment",
        description: "Changed discount",
        categoryId: UNCATEGORIZED_CATEGORY_ID,
        amount: "1",
        lineId: purchaseId,
      },
    });
    actor.send({
      type: "receipt.detail.back",
      destination: "/expenses",
    });
    assert(actor.getSnapshot().matches("confirmingDiscard"));
    actor.send({ type: "receipt.detail.keep-editing" });
    assert(actor.getSnapshot().matches("lineDirty"));
    actor.send({
      type: "receipt.detail.navigate",
      destination: "/settings",
    });
    assert(actor.getSnapshot().matches("confirmingDiscard"));
    actor.send({ type: "receipt.detail.discard-changes" });
    assert(actor.getSnapshot().matches("completed"));
    assertEquals(actor.getSnapshot().output, {
      status: "discarded",
      destination: "/settings",
    });
    actor.stop();

    const externallyDiscarded = start();
    await waitForState(externallyDiscarded, "ready");
    externallyDiscarded.send({
      type: "receipt.detail.edit-line",
      lineId: adjustmentId,
    });
    externallyDiscarded.send({
      type: "receipt.detail.change-line",
      changes: {
        type: "adjustment",
        description: "Discarded change",
        categoryId: UNCATEGORIZED_CATEGORY_ID,
        amount: "1",
        lineId: purchaseId,
      },
    });
    externallyDiscarded.send({ type: "receipt.detail.discard-changes" });
    assert(externallyDiscarded.getSnapshot().matches("ready"));
    assertEquals(externallyDiscarded.getSnapshot().context.lineDraft, null);
    externallyDiscarded.stop();

    const clean = start();
    await waitForState(clean, "ready");
    clean.send({ type: "receipt.detail.back" });
    assertEquals(clean.getSnapshot().output, {
      status: "navigated",
      destination: "/expenses",
    });
    clean.stop();
  },
);
