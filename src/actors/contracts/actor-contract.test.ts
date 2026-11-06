import { createActor, fromPromise } from "xstate";
import {
  categoryMachine,
  conflictMachine,
  deleteEverywhereMachine,
  importMachine,
  type ImportPreview,
  projectDeletionMachine,
  projectMachine,
  receiptReviewMachine,
  receiptScanMachine,
  syncMachine,
  updateInstallMachine,
} from "./index.ts";
import type {
  DeleteEverywhereProgress,
  ImportCommitOutput,
  ProjectDeletionOutput,
  ProjectDeletionTarget,
  ReceiptCommitInput,
  ReceiptCommitOutput,
  ReceiptReviewDraft,
  ReceiptScanInput,
  SyncRequest,
} from "./index.ts";
import { contractFailureFromError } from "./types.ts";

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

Deno.test("actor-contract: import diagnostics reject foreign operation text", () => {
  const secret = "AIza-direct-credential-response-text";
  const failure = contractFailureFromError(
    { code: "invalid-request", operation: secret },
    { code: "invalid", message: "Invalid import.", retryable: false },
    { diagnosticOperationOnly: true, preserveOperation: true },
  );
  assertEquals(failure, {
    code: "invalid-request",
    message: "The request was invalid.",
    retryable: false,
  });
});

import { settle } from "../../test-support/index.ts";

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

const importPreview: ImportPreview = {
  dataset: {} as ImportPreview["dataset"],
  schemaVersion: 1,
  projectCount: 1,
  categoryCount: 1,
  expenseCount: 0,
  receiptCount: 0,
  migrationRequired: false,
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

Deno.test(
  "actor-contract: project deletion gates confirmation on required safety export",
  async () => {
    let exportCalls = 0;
    let commitCalls = 0;
    const deletionWithPorts = projectDeletionMachine.provide({
      actors: {
        exportSafety: fromPromise(
          ({ input }: { input: ProjectDeletionTarget }) => {
            void input;
            exportCalls += 1;
            return Promise.resolve("safety-export.json");
          },
        ),
        commitProjectDeletion: fromPromise(
          ({ input }: { input: ProjectDeletionTarget }) => {
            void input;
            commitCalls += 1;
            return new Promise<ProjectDeletionOutput>(() => {});
          },
        ),
      },
    });
    const actor = createActor(deletionWithPorts).start();
    actor.send({
      type: "project-delete.open",
      target: deletionTarget,
      safetyExportRequired: true,
    });
    actor.send({ type: "project-delete.type-name", value: "Sweden" });
    assertEquals(actor.getSnapshot().value, "reviewing");

    actor.send({ type: "project-delete.confirm" });
    assertEquals(actor.getSnapshot().value, "reviewing");
    assertEquals(commitCalls, 0);

    actor.send({ type: "project-delete.export-safety" });
    assertEquals(actor.getSnapshot().value, "exporting");
    await settle();
    assertEquals(exportCalls, 1);
    assertEquals(actor.getSnapshot().value, "confirming");

    actor.send({ type: "project-delete.confirm" });
    assertEquals(actor.getSnapshot().value, "deleting");
    assertEquals(commitCalls, 1);
    actor.stop();
  },
);

Deno.test("actor-contract: Delete Everywhere requires a second confirmation after declining export", () => {
  const deleteEverywhereWithPendingRetirement = deleteEverywhereMachine.provide(
    {
      actors: {
        persistProgress: fromPromise(
          () => new Promise<void>(() => {}),
        ),
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
  assertEquals(actor.getSnapshot().value, "persistingRetirement");
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

Deno.test("actor-contract: sync exposes retryability from typed failures", async () => {
  const secret = "test-gemini-api-key-D102-credential-shaped-error";
  const syncWithFailure = syncMachine.provide({
    actors: {
      syncTransport: fromPromise(({ input }: { input: SyncRequest }) => {
        void input;
        return Promise.reject({
          name: "AdapterError",
          code: "offline",
          message: `Temporary failure with credential ${secret}`,
          retry: "when-online",
        });
      }),
    },
  });
  const actor = createActor(syncWithFailure).start();
  actor.send({
    type: "sync.configure",
    accountEmail: "owner@example.test",
    online: true,
  });
  actor.send({ type: "sync.request", request: { reason: "manual" } });
  await settle();

  assertEquals(actor.getSnapshot().value, "retryableError");
  assertEquals(actor.getSnapshot().context.error, {
    code: "offline",
    message: "This operation is unavailable offline.",
    retryable: true,
  });
  assert(actor.getSnapshot().hasTag("retryable"));
  assert(actor.getSnapshot().can({ type: "sync.retry" }));

  actor.send({ type: "sync.retry" });
  assertEquals(actor.getSnapshot().value, "synchronizing");
  actor.stop();
});

Deno.test("actor-contract: sync rejects non-retryable shaped failures without secret retention", async () => {
  const secret = "test-gemini-api-key-D102-unauthorized-secret";
  const syncWithFailure = syncMachine.provide({
    actors: {
      syncTransport: fromPromise(({ input }: { input: SyncRequest }) => {
        void input;
        return Promise.reject({
          code: "unauthorized",
          message: `Authorization failed with ${secret}`,
          retry: "backoff",
        });
      }),
    },
  });
  const actor = createActor(syncWithFailure).start();
  actor.send({
    type: "sync.configure",
    accountEmail: "owner@example.test",
    online: true,
  });
  actor.send({ type: "sync.request", request: { reason: "manual" } });
  await settle();

  assertEquals(actor.getSnapshot().value, "error");
  assertEquals(actor.getSnapshot().context.error, {
    code: "unauthorized",
    message: "Authorization is required for this operation.",
    retryable: false,
  });
  assert(!actor.getSnapshot().hasTag("retryable"));
  assert(!actor.getSnapshot().can({ type: "sync.retry" }));
  const failure = actor.getSnapshot().context.error;
  assert(failure !== null);
  assert(!failure.message.includes(secret));
  actor.stop();
});

Deno.test(
  "actor-contract: sync keeps retired failures non-retryable despite hostile retry metadata",
  async () => {
    const secret = "test-gemini-api-key-D102-retired-secret";
    const syncWithFailure = syncMachine.provide({
      actors: {
        syncTransport: fromPromise(({ input }: { input: SyncRequest }) => {
          void input;
          return Promise.reject({
            code: "retired",
            message: `Retired dataset response included ${secret}`,
            retryable: true,
            retry: "backoff",
          });
        }),
      },
    });
    const actor = createActor(syncWithFailure).start();
    actor.send({
      type: "sync.configure",
      accountEmail: "owner@example.test",
      online: true,
    });
    actor.send({ type: "sync.request", request: { reason: "manual" } });
    await settle();

    assertEquals(actor.getSnapshot().value, "error");
    assertEquals(actor.getSnapshot().context.error, {
      code: "retired",
      message: "This dataset has been retired.",
      retryable: false,
    });
    assert(!actor.getSnapshot().hasTag("retryable"));
    assert(!actor.getSnapshot().can({ type: "sync.retry" }));
    const failure = actor.getSnapshot().context.error;
    assert(failure !== null);
    assert(!failure.message.includes(secret));
    actor.stop();
  },
);

Deno.test("actor-contract: receipt scan preserves typed quota failures", async () => {
  const scanInput: ReceiptScanInput = {
    image: {
      ephemeralId: "image-quota",
      mediaType: "image/jpeg",
      byteLength: 12,
    },
    projectId: "project-sweden",
    currency: "SEK",
    locale: "en-SE",
    categoryCatalogue: [],
    model: "gemini-test",
    prepareImage: false,
  };
  const receiptWithFailure = receiptScanMachine.provide({
    actors: {
      scanReceipt: fromPromise(({ input }: { input: ReceiptScanInput }) => {
        void input;
        return Promise.reject({
          name: "AdapterError",
          code: "quota",
          message: "The adapter storage or service quota was exceeded.",
          retry: "backoff",
        });
      }),
    },
  });
  const actor = createActor(receiptWithFailure).start();
  actor.send({ type: "receipt.open" });
  actor.send({ type: "receipt.image-selected" });
  actor.send({ type: "receipt.scan", input: scanInput });
  await settle();

  assertEquals(actor.getSnapshot().value, "failed");
  assertEquals(actor.getSnapshot().context.error, {
    code: "quota",
    message: "Storage or service quota was exceeded.",
    retryable: true,
    operation: "receipt.scan",
  });
  actor.stop();
});

Deno.test(
  "actor-contract: receipt scan exposes safe typed and unknown diagnostics",
  async () => {
    const scanInput: ReceiptScanInput = {
      image: {
        ephemeralId: "image-diagnostics",
        mediaType: "image/jpeg",
        byteLength: 12,
      },
      projectId: "project-sweden",
      currency: "SEK",
      locale: "en-SE",
      categoryCatalogue: [],
      model: "gemini-test",
      prepareImage: false,
    };

    const typed = receiptScanMachine.provide({
      actors: {
        scanReceipt: fromPromise(({ input }: { input: ReceiptScanInput }) => {
          void input;
          return Promise.reject({
            code: "invalid-request",
            message: "provider secret must not cross the actor boundary",
            operation: "gemini.extract",
          });
        }),
      },
    });
    const typedActor = createActor(typed).start();
    typedActor.send({ type: "receipt.open" });
    typedActor.send({ type: "receipt.image-selected" });
    typedActor.send({ type: "receipt.scan", input: scanInput });
    await settle();
    assertEquals(typedActor.getSnapshot().context.error, {
      code: "invalid-request",
      message: "The request was invalid.",
      retryable: false,
      operation: "gemini.extract",
    });
    typedActor.stop();

    const validationSecret = "gemini-provider-secret-validation";
    const validating = receiptScanMachine.provide({
      actors: {
        scanReceipt: fromPromise(({ input }: { input: ReceiptScanInput }) => {
          void input;
          return Promise.resolve({ review });
        }),
        validateReceipt: fromPromise(
          ({ input }: { input: ReceiptReviewDraft }) => {
            void input;
            return Promise.reject(new Error(validationSecret));
          },
        ),
      },
    });
    const validatingActor = createActor(validating).start();
    validatingActor.send({ type: "receipt.open" });
    validatingActor.send({ type: "receipt.image-selected" });
    validatingActor.send({ type: "receipt.scan", input: scanInput });
    await settle();
    assertEquals(validatingActor.getSnapshot().context.error, {
      code: "invalid",
      message: "Receipt output needs review or retry.",
      retryable: false,
      operation: "receipt.validate",
    });
    const validationFailure = validatingActor.getSnapshot().context.error;
    assert(validationFailure !== null);
    assert(!JSON.stringify(validationFailure).includes(validationSecret));
    validatingActor.stop();

    const secret = "gemini-provider-secret-diagnostics";
    const unknown = receiptScanMachine.provide({
      actors: {
        scanReceipt: fromPromise(({ input }: { input: ReceiptScanInput }) => {
          void input;
          return Promise.reject(new Error(secret));
        }),
      },
    });
    const unknownActor = createActor(unknown).start();
    unknownActor.send({ type: "receipt.open" });
    unknownActor.send({ type: "receipt.image-selected" });
    unknownActor.send({ type: "receipt.scan", input: scanInput });
    await settle();
    assertEquals(unknownActor.getSnapshot().context.error, {
      code: "unknown",
      message: "Receipt extraction failed.",
      retryable: true,
      operation: "receipt.scan",
    });
    const failure = unknownActor.getSnapshot().context.error;
    assert(failure !== null);
    assert(!JSON.stringify(failure).includes(secret));
    unknownActor.stop();
  },
);

Deno.test("actor-contract: import requires a mode and online replace pre-sync", async () => {
  const importWithPorts = importMachine.provide({
    actors: {
      validateImport: fromPromise(({ input }: { input: string }) => {
        void input;
        return Promise.resolve(importPreview);
      }),
      synchronizeBeforeReplace: fromPromise(() => new Promise<void>(() => {})),
      commitImport: fromPromise(
        () => new Promise<ImportCommitOutput>(() => {}),
      ),
    },
  });

  const missingMode = createActor(importWithPorts).start();
  missingMode.send({
    type: "import.open",
    driveConfigured: true,
    online: true,
  });
  missingMode.send({ type: "import.file-selected", contents: "{}" });
  await settle();
  assertEquals(missingMode.getSnapshot().value, "previewing");
  missingMode.send({ type: "import.commit" });
  assertEquals(missingMode.getSnapshot().value, "previewing");
  missingMode.stop();

  const offlineReplace = createActor(importWithPorts).start();
  offlineReplace.send({
    type: "import.open",
    driveConfigured: true,
    online: false,
  });
  offlineReplace.send({ type: "import.file-selected", contents: "{}" });
  await settle();
  offlineReplace.send({ type: "import.choose-replace" });
  offlineReplace.send({ type: "import.commit" });
  assertEquals(offlineReplace.getSnapshot().value, "failed");
  assertEquals(offlineReplace.getSnapshot().context.error?.code, "offline");
  offlineReplace.stop();

  const onlineReplace = createActor(importWithPorts).start();
  onlineReplace.send({
    type: "import.open",
    driveConfigured: true,
    online: true,
  });
  onlineReplace.send({ type: "import.file-selected", contents: "{}" });
  await settle();
  onlineReplace.send({ type: "import.choose-replace" });
  onlineReplace.send({ type: "import.commit" });
  assertEquals(onlineReplace.getSnapshot().value, "preSyncing");
  onlineReplace.stop();
});

Deno.test("actor-contract: Delete Everywhere reports forced devices truthfully", async () => {
  const deleteWithPorts = deleteEverywhereMachine.provide({
    actors: {
      persistProgress: fromPromise(() => Promise.resolve()),
      publishRetirement: fromPromise(() => Promise.resolve()),
      deleteDriveGeneration: fromPromise(() => Promise.resolve()),
      eraseLocalDataset: fromPromise(() => Promise.resolve()),
    },
  });
  const actor = createActor(deleteWithPorts).start();
  actor.send({
    type: "delete-everywhere.open",
    generation: 4,
    progress: {
      knownDeviceCount: 4,
      acknowledgedDeviceCount: 1,
      forcedDeviceCount: 0,
    },
  });
  actor.send({ type: "delete-everywhere.decline-safety-export" });
  actor.send({ type: "delete-everywhere.confirm-decline" });
  actor.send({ type: "delete-everywhere.confirm" });
  await settle();
  assertEquals(actor.getSnapshot().value, "awaitingDevices");

  actor.send({ type: "delete-everywhere.force-finalize" });
  await settle();
  assertEquals(actor.getSnapshot().value, "forcedFinalization");
  assertEquals(actor.getSnapshot().context.progress.forcedDeviceCount, 3);
  actor.send({ type: "delete-everywhere.confirm" });
  await settle();
  assertEquals(actor.getSnapshot().output, {
    status: "completed",
    result: { generation: 4, forcedDeviceCount: 3 },
  });
  actor.stop();
});

Deno.test("actor-contract: saved and discarded receipt contexts clear drafts", async () => {
  const receiptWithCommit = receiptReviewMachine.provide({
    actors: {
      commitReceipt: fromPromise(
        ({ input }: { input: ReceiptCommitInput }) => {
          void input;
          return Promise.resolve({
            receipt: {} as ReceiptCommitOutput["receipt"],
            purchaseLines: [] as ReceiptCommitOutput["purchaseLines"],
            adjustments: [] as ReceiptCommitOutput["adjustments"],
          });
        },
      ),
    },
  });
  const savedReceipt = createActor(receiptWithCommit).start();
  savedReceipt.send({ type: "receipt.review.open", review });
  savedReceipt.send({
    type: "receipt.review.submit",
    confirmMismatch: true,
  });
  await settle();
  assertEquals(savedReceipt.getSnapshot().value, "saved");
  assertEquals(savedReceipt.getSnapshot().context.review, null);
  savedReceipt.stop();

  const discardedReceipt = createActor(receiptReviewMachine).start();
  discardedReceipt.send({ type: "receipt.review.open", review });
  discardedReceipt.send({ type: "receipt.review.discard" });
  assertEquals(discardedReceipt.getSnapshot().context.review, null);
  discardedReceipt.stop();
});

Deno.test("actor-contract: forbidden workflow events are no-ops outside their owner states", () => {
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
