import { createExportActor, createImportActor } from "./index.ts";
import {
  createFakeCausalSyncPort,
  createFakeIdPort,
  createFakeLocalPort,
} from "../../test-support/fakes/ports.ts";
import { createImportExportAdapter } from "../../adapters/import-export/index.ts";
import { initialCausalSnapshot } from "../../adapters/sync/causal.ts";
import type { FileSharePort } from "../../adapters/ports/index.ts";
import {
  CURRENT_SCHEMA_VERSION,
  DATASET_FORMAT,
  type PortableDataset,
  UNCATEGORIZED_CATEGORY_ID,
} from "../../domain/index.ts";
import { waitFor } from "../../test-support/index.ts";

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

function dataset(): PortableDataset {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    format: DATASET_FORMAT,
    projects: [],
    categories: [{
      schemaVersion: 1,
      type: "category",
      id: UNCATEGORIZED_CATEGORY_ID,
      name: "Uncategorized",
      sortOrder: 0,
      archived: false,
      system: true,
    }],
    expenses: [],
    receipts: [],
    receiptPurchaseLines: [],
    receiptAdjustments: [],
    devices: [],
    tombstones: [],
    retirementMarkers: [],
    revisions: [],
    settings: {
      schemaVersion: 1,
      type: "portable-settings",
      id: "settings-portable",
      expenseDayBoundary: "03:00",
    },
  };
}

function setupAdapter(options: {
  readonly preSync?: () => Promise<void>;
  readonly fileShare?: FileSharePort;
} = {}) {
  const local = createFakeLocalPort();
  const causal = createFakeCausalSyncPort(initialCausalSnapshot(dataset()));
  const adapter = createImportExportAdapter({
    local,
    causal,
    deviceId: "device-import-actor",
    ids: createFakeIdPort("device-import-actor"),
    clock: { now: () => "2026-08-24T14:00:00.000Z" },
    ...(options.preSync === undefined
      ? {}
      : { synchronizeBeforeReplace: options.preSync }),
    ...(options.fileShare === undefined
      ? {}
      : { fileShare: options.fileShare }),
  });
  return { adapter, local, causal };
}

Deno.test("import actor: validates, previews, and commits merge through v5 states", async () => {
  const { adapter } = setupAdapter();
  const source = await adapter.exportDocument();
  const expectedPreview = adapter.previewImport(source.json);
  const actor = createImportActor({ adapter }).start();
  actor.send({
    type: "import.open",
    driveConfigured: false,
    online: false,
  });
  actor.send({ type: "import.file-selected", contents: source.json });
  await waitFor(() => actor.getSnapshot().value === "previewing", "no preview");
  assert(actor.getSnapshot().context.preview?.dataset !== undefined);
  assertEquals(
    {
      changeCount: actor.getSnapshot().context.preview?.changeCount,
      migrations: actor.getSnapshot().context.preview?.migrations,
      warnings: actor.getSnapshot().context.preview?.warnings,
      errors: actor.getSnapshot().context.preview?.errors,
    },
    {
      changeCount: expectedPreview.changeCount,
      migrations: expectedPreview.migrations,
      warnings: expectedPreview.warnings,
      errors: expectedPreview.errors,
    },
  );
  actor.send({ type: "import.choose-merge" });
  actor.send({ type: "import.commit" });
  await waitFor(
    () => actor.getSnapshot().status === "done",
    "import did not finish",
  );
  assertEquals(actor.getSnapshot().output?.status, "completed");
  actor.stop();
});

Deno.test("import actor: configured Drive offline blocks replace without commit", async () => {
  const { adapter } = setupAdapter();
  const source = await adapter.exportDocument();
  const actor = createImportActor({ adapter }).start();
  actor.send({ type: "import.open", driveConfigured: true, online: false });
  actor.send({ type: "import.file-selected", contents: source.json });
  await waitFor(() => actor.getSnapshot().value === "previewing", "no preview");
  actor.send({ type: "import.choose-replace" });
  actor.send({ type: "import.commit" });
  assert(actor.getSnapshot().value === "failed");
  assertEquals(actor.getSnapshot().context.error?.code, "offline");
  actor.stop();
});

Deno.test("import actor: preview tracks online and offline transitions", async () => {
  const { adapter } = setupAdapter({ preSync: () => Promise.resolve() });
  const source = await adapter.exportDocument();
  const actor = createImportActor({ adapter }).start();
  actor.send({ type: "import.open", driveConfigured: true, online: true });
  actor.send({ type: "import.file-selected", contents: source.json });
  await waitFor(() => actor.getSnapshot().value === "previewing", "no preview");

  actor.send({ type: "import.network.offline" });
  assert(actor.getSnapshot().context.online === false);
  actor.send({ type: "import.network.online" });
  assert(actor.getSnapshot().context.online === true);

  actor.send({ type: "import.choose-replace" });
  actor.send({ type: "import.commit" });
  await waitFor(
    () => actor.getSnapshot().status === "done",
    "online preview did not permit replacement",
  );
  assertEquals(actor.getSnapshot().output?.status, "completed");
  actor.stop();
});

Deno.test(
  "import actor: an offline replacement failure can recover when the network returns",
  async () => {
    const { adapter } = setupAdapter({ preSync: () => Promise.resolve() });
    const source = await adapter.exportDocument();
    const actor = createImportActor({ adapter }).start();
    actor.send({ type: "import.open", driveConfigured: true, online: true });
    actor.send({ type: "import.file-selected", contents: source.json });
    await waitFor(
      () => actor.getSnapshot().value === "previewing",
      "no preview",
    );
    actor.send({ type: "import.choose-replace" });
    actor.send({ type: "import.network.offline" });
    actor.send({ type: "import.commit" });
    assert(actor.getSnapshot().value === "failed");
    assert(actor.getSnapshot().context.online === false);
    actor.send({ type: "import.network.online" });
    assert(actor.getSnapshot().context.online === true);
    actor.send({ type: "import.retry" });
    await waitFor(
      () => actor.getSnapshot().value === "previewing",
      "replacement did not revalidate after reconnecting",
    );
    actor.send({ type: "import.choose-replace" });
    actor.send({ type: "import.commit" });
    await waitFor(
      () => actor.getSnapshot().status === "done",
      "replacement did not recover after reconnecting",
    );
    assertEquals(actor.getSnapshot().output?.status, "completed");
    actor.stop();
  },
);

Deno.test("import actor: validation failures retain bounded diagnostics", async () => {
  const { adapter } = setupAdapter();
  const actor = createImportActor({ adapter }).start();
  actor.send({
    type: "import.open",
    driveConfigured: false,
    online: true,
  });
  actor.send({ type: "import.file-selected", contents: "not-json" });
  await waitFor(() => actor.getSnapshot().value === "failed", "no failure");
  assertEquals(
    actor.getSnapshot().context.error?.operation,
    "import.json_syntax",
  );
  actor.stop();
});

Deno.test("import actor: successful online pre-sync is immediately followed by synchronized replacement", async () => {
  const order: string[] = [];
  const { adapter, causal } = setupAdapter({
    preSync: async () => {
      order.push("pre-sync");
      await Promise.resolve();
    },
  });
  const source = await adapter.exportDocument();
  const originalApply = causal.applyPacket;
  causal.applyPacket = async (packet, options) => {
    order.push("replace-sync");
    return await originalApply(packet, options);
  };
  const actor = createImportActor({ adapter }).start();
  actor.send({ type: "import.open", driveConfigured: true, online: true });
  actor.send({ type: "import.file-selected", contents: source.json });
  await waitFor(() => actor.getSnapshot().value === "previewing", "no preview");
  actor.send({ type: "import.choose-replace" });
  actor.send({ type: "import.commit" });
  await waitFor(
    () => actor.getSnapshot().status === "done",
    "replace did not finish",
  );
  assertEquals(order, ["pre-sync", "replace-sync"]);
  actor.stop();
});

Deno.test("import actor: replace cancellation aborts the pre-sync workflow", async () => {
  const { adapter } = setupAdapter({
    preSync: () => new Promise<void>(() => {}),
  });
  const source = await adapter.exportDocument();
  const actor = createImportActor({ adapter }).start();
  actor.send({ type: "import.open", driveConfigured: true, online: true });
  actor.send({ type: "import.file-selected", contents: source.json });
  await waitFor(() => actor.getSnapshot().value === "previewing", "no preview");
  actor.send({ type: "import.choose-replace" });
  actor.send({ type: "import.commit" });
  await waitFor(
    () => actor.getSnapshot().value === "preSyncing",
    "pre-sync did not start",
  );
  actor.send({ type: "import.cancel" });
  await waitFor(
    () => actor.getSnapshot().status === "done",
    "cancel did not finish",
  );
  assertEquals(actor.getSnapshot().output?.status, "cancelled");
  actor.stop();
});

Deno.test("export actor: share delivery uses adapter fallback and returns completed", async () => {
  let saved = 0;
  const fileShare: FileSharePort = {
    save: async () => {
      saved += 1;
      await Promise.resolve();
    },
    share: async () => {
      const error = new Error("unsupported") as Error & { code: string };
      error.code = "unsupported";
      await Promise.resolve();
      throw error;
    },
  };
  const { adapter } = setupAdapter({ fileShare });
  const actor = createExportActor({ adapter }).start();
  actor.send({ type: "export.request", share: true });
  await waitFor(
    () => actor.getSnapshot().status === "done",
    "export did not finish",
  );
  assertEquals(actor.getSnapshot().output?.status, "completed");
  assertEquals(saved, 1);
  actor.stop();
});
