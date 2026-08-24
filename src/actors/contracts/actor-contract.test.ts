import { createActor, fromPromise } from "xstate";
import {
  categoryMachine,
  conflictMachine,
  deleteEverywhereMachine,
  durableWorkflowMachine,
  type ExpenseFormEvent,
  expenseFormMachine,
  importMachine,
  projectDeletionMachine,
  projectMachine,
  receiptReviewMachine,
  type ReceiptScanEvent,
  receiptScanMachine,
  type SyncEvent,
  syncMachine,
  updateInstallMachine,
  workflowHostMachine,
} from "./index.ts";
import type {
  DeleteEverywhereProgress,
  DurableDraft,
  ExpenseDraft,
  ProjectDeletionOutput,
  ProjectDeletionTarget,
  ReceiptCommitInput,
  ReceiptCommitOutput,
  ReceiptReviewDraft,
  SyncRequest,
} from "./index.ts";

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

const draft: DurableDraft = {
  workflowId: "expense-form",
  revision: 1,
  payload: { amount: "10.9", currency: "SEK" },
};

const expenseDraft: ExpenseDraft = {
  projectId: "project-sweden",
  categoryId: "category-uncategorized",
  date: "2026-08-24",
  amount: "10.9",
  currency: "SEK",
  description: "",
};

const review: ReceiptReviewDraft = {
  parent: {
    projectId: "project-sweden",
    date: "2026-08-24",
    merchant: "Shop",
    currency: "SEK",
    printedTotal: "10",
  },
  lines: [],
  uncertainty: [],
  printedTotalMismatch: true,
};

const deletionTarget: ProjectDeletionTarget = {
  projectId: "project-sweden",
  projectName: "Sweden",
  expenseCount: 2,
  receiptCount: 1,
};

const progress: DeleteEverywhereProgress = {
  knownDeviceCount: 2,
  acknowledgedDeviceCount: 0,
  forcedDeviceCount: 0,
};

// Compile-time event payload contract checks.
const typedEvents = [
  { type: "expense.submit" } satisfies ExpenseFormEvent,
  {
    type: "receipt.scan",
    input: {
      image: {
        ephemeralId: "image-1",
        mediaType: "image/jpeg",
        byteLength: 10,
      },
      projectId: "project-sweden",
      currency: "SEK",
      locale: "en-SE",
      categoryCatalogue: [],
      model: "gemini-test",
      prepareImage: true,
    },
  } satisfies ReceiptScanEvent,
  {
    type: "sync.request",
    request: { reason: "manual" } satisfies SyncRequest,
  } satisfies SyncEvent,
];
assert(typedEvents.length === 3);

// @ts-expect-error Receipt scans cannot omit the ephemeral image request payload.
const invalidReceiptEvent: ReceiptScanEvent = { type: "receipt.scan" };
void invalidReceiptEvent;

Deno.test("actor-contract: expense guard keeps incomplete forms editable", () => {
  const actor = createActor(expenseFormMachine).start();
  actor.send({ type: "expense.open", draft: { ...expenseDraft, amount: "" } });
  actor.send({ type: "expense.submit" });

  assertEquals(actor.getSnapshot().value, "editing");
  assert(actor.getSnapshot().hasTag("dirty"));
  actor.stop();
});

Deno.test("actor-contract: receipt mismatch requires an explicit confirmation", () => {
  const reviewWithPendingCommit = receiptReviewMachine.provide({
    actors: {
      commitReceipt: fromPromise(
        ({ input }: { input: ReceiptCommitInput }) =>
          new Promise<ReceiptCommitOutput>(() => {
            void input;
          }),
      ),
    },
  });
  const actor = createActor(reviewWithPendingCommit).start();
  actor.send({ type: "receipt.review.open", review });
  actor.send({ type: "receipt.review.submit", confirmMismatch: false });
  assertEquals(actor.getSnapshot().value, "mismatch");

  actor.send({ type: "receipt.review.confirm-mismatch" });
  assertEquals(actor.getSnapshot().value, "saving");
  actor.stop();
});

Deno.test("actor-contract: project deletion requires exact confirmation text", () => {
  const deletionWithPendingCommit = projectDeletionMachine.provide({
    actors: {
      commitProjectDeletion: fromPromise(
        ({ input }: { input: ProjectDeletionTarget }) =>
          new Promise<ProjectDeletionOutput>(() => {
            void input;
          }),
      ),
    },
  });
  const actor = createActor(deletionWithPendingCommit).start();
  actor.send({
    type: "project-delete.open",
    target: deletionTarget,
    safetyExportRequired: false,
  });
  actor.send({ type: "project-delete.type-name", value: "sweden" });
  actor.send({ type: "project-delete.confirm" });
  assertEquals(actor.getSnapshot().value, "confirming");

  actor.send({ type: "project-delete.type-name", value: "Sweden" });
  actor.send({ type: "project-delete.confirm" });
  assertEquals(actor.getSnapshot().value, "deleting");
  actor.stop();
});

Deno.test("actor-contract: Delete Everywhere requires a second confirmation after declining export", () => {
  const deleteEverywhereWithPendingRetirement = deleteEverywhereMachine.provide(
    {
      actors: {
        publishRetirement: fromPromise(
          ({ input }: { input: number }) =>
            new Promise<void>(() => {
              void input;
            }),
        ),
      },
    },
  );
  const actor = createActor(deleteEverywhereWithPendingRetirement).start();
  actor.send({ type: "delete-everywhere.open", generation: 4, progress });
  actor.send({ type: "delete-everywhere.decline-safety-export" });
  actor.send({ type: "delete-everywhere.confirm" });
  assertEquals(actor.getSnapshot().value, "confirmingDecline");

  actor.send({ type: "delete-everywhere.confirm-decline" });
  actor.send({ type: "delete-everywhere.confirm" });
  assertEquals(actor.getSnapshot().value, "publishingRetirement");
  actor.stop();
});

Deno.test("actor-contract: persisted snapshots hydrate and resume the durable mode", () => {
  const original = createActor(durableWorkflowMachine, {
    input: { persistenceKey: "draft:expense-1", initialDraft: draft },
  }).start();
  assertEquals(original.getSnapshot().value, "editing");
  assert(original.getSnapshot().hasTag("dirty"));

  const persisted = original.getPersistedSnapshot();
  const restored = createActor(durableWorkflowMachine, {
    input: { persistenceKey: "draft:expense-1" },
    snapshot: persisted,
  }).start();
  assertEquals(restored.getSnapshot().value, "editing");
  assertEquals(restored.getSnapshot().context.draft, draft);

  restored.send({ type: "workflow.complete" });
  assertEquals(restored.getSnapshot().value, "completed");
  assertEquals(restored.getSnapshot().output, {
    status: "completed",
    revision: 1,
  });
  original.stop();
  restored.stop();
});

Deno.test("actor-contract: parent owns child completion", () => {
  const actor = createActor(workflowHostMachine).start();
  actor.send({ type: "host.open", draft });
  assertEquals(actor.getSnapshot().value, "active");
  actor.send({ type: "host.complete" });
  assertEquals(actor.getSnapshot().value, "completed");
  assertEquals(actor.getSnapshot().output?.status, "completed");
  actor.stop();
});

Deno.test("actor-contract: parent cancellation stops the durable child", () => {
  const actor = createActor(workflowHostMachine).start();
  actor.send({ type: "host.open", draft });
  actor.send({ type: "host.cancel" });
  assertEquals(actor.getSnapshot().value, "cancelled");
  assertEquals(actor.getSnapshot().output, { status: "cancelled" });
  actor.stop();
});

Deno.test("actor-contract: sync exposes conflict as a mode after its port completes", async () => {
  const syncWithFake = syncMachine.provide({
    actors: {
      syncTransport: fromPromise(({ input }: { input: SyncRequest }) =>
        Promise.resolve({
          lastSyncedAt: "2026-08-24T12:00:00Z",
          unresolvedConflictCount: input.reason === "manual" ? 1 : 0,
          pendingChangeCount: 0,
        })
      ),
    },
  });
  const actor = createActor(syncWithFake).start();
  actor.send({
    type: "sync.configure",
    accountEmail: "owner@example.test",
    online: true,
  });
  actor.send({ type: "sync.request", request: { reason: "manual" } });
  await Promise.resolve();
  await Promise.resolve();
  assertEquals(actor.getSnapshot().value, "conflict");
  assert(actor.getSnapshot().hasTag("conflict"));
  actor.stop();
});

Deno.test("actor-contract: forbidden workflow events are no-ops outside their owner states", () => {
  const expense = createActor(expenseFormMachine).start();
  expense.send({ type: "expense.submit" });
  assertEquals(expense.getSnapshot().value, "closed");

  const receipt = createActor(receiptScanMachine).start();
  receipt.send({ type: "receipt.use-manual" });
  assertEquals(receipt.getSnapshot().value, "idle");

  const project = createActor(projectMachine).start();
  project.send({
    type: "project.command",
    command: { type: "delete-empty", projectId: "project-sweden" },
  });
  assertEquals(project.getSnapshot().value, "closed");

  const category = createActor(categoryMachine).start();
  category.send({ type: "category.cancel" });
  assertEquals(category.getSnapshot().value, "closed");

  const sync = createActor(syncMachine).start();
  sync.send({ type: "sync.request", request: { reason: "manual" } });
  assertEquals(sync.getSnapshot().value, "unconfigured");

  const conflict = createActor(conflictMachine).start();
  conflict.send({ type: "conflict.submit" });
  assertEquals(conflict.getSnapshot().value, "idle");

  const importing = createActor(importMachine).start();
  importing.send({ type: "import.commit" });
  assertEquals(importing.getSnapshot().value, "idle");

  const deletion = createActor(projectDeletionMachine).start();
  deletion.send({ type: "project-delete.confirm" });
  assertEquals(deletion.getSnapshot().value, "idle");

  const everywhere = createActor(deleteEverywhereMachine).start();
  everywhere.send({ type: "delete-everywhere.confirm" });
  assertEquals(everywhere.getSnapshot().value, "idle");

  const update = createActor(updateInstallMachine).start();
  update.send({ type: "update.reload" });
  assertEquals(update.getSnapshot().value, "idle");

  expense.stop();
  receipt.stop();
  project.stop();
  category.stop();
  sync.stop();
  conflict.stop();
  importing.stop();
  deletion.stop();
  everywhere.stop();
  update.stop();
});
