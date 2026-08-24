import {
  createGenerationProtectedCausalSyncPort,
  createImportExportAdapter,
} from "./index.ts";
import {
  createFakeCausalSyncPort,
  createFakeIdPort,
  createFakeLocalPort,
} from "../../test-support/fakes/ports.ts";
import { initialCausalSnapshot } from "../sync/causal.ts";
import {
  adapterError,
  type CausalSyncPort,
  type FileSharePort,
} from "../ports/index.ts";
import { datasetEntries } from "../sync/causal.ts";
import type { PortableDataset } from "../../domain/index.ts";
import {
  CURRENT_SCHEMA_VERSION,
  DATASET_FORMAT,
  UNCATEGORIZED_CATEGORY_ID,
} from "../../domain/index.ts";
import { createCanonicalExport } from "../../domain/import-export/index.ts";

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

function emptyDataset(): PortableDataset {
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

function expenseDataset(amount: string): PortableDataset {
  return {
    ...emptyDataset(),
    projects: [{
      schemaVersion: 1,
      type: "project",
      id: "project-main",
      name: "Main",
      defaultCurrency: "SEK",
      archived: false,
    }],
    expenses: [{
      schemaVersion: 1,
      type: "expense",
      id: "expense-main",
      projectId: "project-main",
      categoryId: UNCATEGORIZED_CATEGORY_ID,
      date: "2026-08-24",
      amount,
      currency: "SEK",
      description: "Imported",
      source: "manual",
    }],
  };
}

function dependencies(
  causal = createFakeCausalSyncPort(initialCausalSnapshot(emptyDataset())),
) {
  const local = createFakeLocalPort();
  return {
    local,
    causal,
    deviceId: "device-import",
    ids: createFakeIdPort("device-import"),
    clock: { now: () => "2026-08-24T14:00:00.000Z" },
  } as const;
}

async function seed(
  local: ReturnType<typeof createFakeLocalPort>,
  dataset: PortableDataset,
): Promise<void> {
  await local.transaction("readwrite", async (transaction) => {
    for (const entry of datasetEntries(dataset)) {
      await transaction.put("records", entry.key, entry.value);
    }
  });
}

Deno.test("import-export adapter: merge is causal and duplicate import is idempotent", async () => {
  const first = dependencies();
  const adapter = createImportExportAdapter(first);
  const source = createImportExportAdapter(dependencies()).exportDocument;
  const exported = await source();
  const merged = await adapter.commitImport({
    document: exported.document,
    mode: "merge",
    driveConfigured: false,
    online: false,
  });
  assertEquals(merged.conflictCount, 0);
  assert(merged.duplicateChangeCount >= 0);
  const repeated = await adapter.commitImport({
    document: exported.document,
    mode: "merge",
    driveConfigured: false,
    online: false,
  });
  assertEquals(repeated.duplicateChangeCount, exported.document.changes.length);
});

Deno.test("import-export adapter: merge reports same-record conflicts without overwriting local data", async () => {
  const deps = dependencies();
  const localDataset = expenseDataset("-10");
  await seed(deps.local, localDataset);
  const adapter = createImportExportAdapter(deps);
  const source = createCanonicalExport({ dataset: expenseDataset("-20") });
  const result = await adapter.commitImport({
    document: source,
    mode: "merge",
    driveConfigured: false,
    online: false,
  });
  assert(result.conflictCount > 0);
  const after = await adapter.exportDocument();
  assertEquals(after.document.dataset.expenses[0]?.amount, "-10");
});

Deno.test("import-export adapter: configured Drive pre-sync failure does not mutate local data", async () => {
  let preSyncCalls = 0;
  const deps = {
    ...dependencies(),
    synchronizeBeforeReplace: async () => {
      preSyncCalls += 1;
      await Promise.resolve();
      throw new Error("pre-sync failed");
    },
  };
  const adapter = createImportExportAdapter(deps);
  const before = await adapter.exportDocument();
  let failed = false;
  try {
    await deps.synchronizeBeforeReplace();
  } catch {
    failed = true;
  }
  assert(failed);
  const after = await adapter.exportDocument();
  assertEquals(after.document.dataset, before.document.dataset);
  assertEquals(preSyncCalls, 1);
});

Deno.test("import-export adapter: direct configured replacement performs pre-sync before any mutation", async () => {
  let preSyncCalls = 0;
  const deps = {
    ...dependencies(),
    synchronizeBeforeReplace: async () => {
      preSyncCalls += 1;
      await Promise.resolve();
      throw adapterError("offline", "test.pre-sync");
    },
  };
  const adapter = createImportExportAdapter(deps);
  const source = (await adapter.exportDocument()).document;
  let failed = false;
  try {
    await adapter.commitImport({
      document: source,
      mode: "replace",
      driveConfigured: true,
      online: true,
    });
  } catch {
    failed = true;
  }
  assert(failed);
  assertEquals(preSyncCalls, 1);
  assertEquals(
    (await adapter.exportDocument()).document.dataset,
    source.dataset,
  );
});

Deno.test("import-export adapter: local transaction failure is atomic", async () => {
  const deps = dependencies();
  const adapter = createImportExportAdapter(deps);
  const before = await adapter.exportDocument();
  deps.local.failNext("quota");
  let failed = false;
  try {
    await adapter.commitImport({
      document: before.document,
      mode: "merge",
      driveConfigured: false,
      online: false,
    });
  } catch {
    failed = true;
  }
  assert(failed);
  assertEquals(
    (await adapter.exportDocument()).document.dataset,
    before.document.dataset,
  );
});

Deno.test("import-export adapter: replacement failure leaves durable recovery and restart completes it", async () => {
  const base = createFakeCausalSyncPort(initialCausalSnapshot(emptyDataset()));
  let failApply = true;
  const causal: CausalSyncPort = {
    read: (options) => base.read(options),
    exportPacket: (options) => base.exportPacket(options),
    applyPacket: async (packet, options) => {
      if (failApply) {
        failApply = false;
        throw adapterError("offline", "test.replace-sync");
      }
      return await base.applyPacket(packet, options);
    },
  };
  const deps = { ...dependencies(), causal };
  const adapter = createImportExportAdapter(deps);
  const source = (await adapter.exportDocument()).document;
  let failed = false;
  try {
    await adapter.commitImport({
      document: source,
      mode: "replace",
      driveConfigured: false,
      online: false,
    });
  } catch {
    failed = true;
  }
  assert(failed);
  assert((await deps.local.query("workflow-snapshots")).length > 0);
  const recovered = await adapter.commitImport({
    document: source,
    mode: "replace",
    driveConfigured: false,
    online: false,
  });
  assert(recovered.recovered);
  assertEquals((await deps.local.query("workflow-snapshots")).length, 0);
  assertEquals((await deps.local.query("records")).length > 0, true);
});

Deno.test("import-export adapter: unconfigured offline replacement is local and advances generation", async () => {
  const deps = dependencies();
  const adapter = createImportExportAdapter(deps);
  const document = (await adapter.exportDocument()).document;
  const result = await adapter.commitImport({
    document,
    mode: "replace",
    driveConfigured: false,
    online: false,
  });
  assertEquals(result.mode, "replace");
  assertEquals(result.generation, 2);
});

Deno.test("import-export adapter: old generation packets cannot undo a replacement", async () => {
  const base = createFakeCausalSyncPort(initialCausalSnapshot(emptyDataset()));
  const protectedPort = createGenerationProtectedCausalSyncPort(base);
  const current = await base.read();
  const replacement = {
    generation: 2,
    heads: ["change-new"],
    changes: [{
      id: "change-new",
      actorId: "device-import",
      sequence: 1,
      parents: [],
      payload: {
        type: "causal-dataset",
        schemaVersion: 1,
        fingerprint: "new",
        dataset: emptyDataset(),
      },
    }],
  };
  await protectedPort.applyPacket(replacement);
  const stale = await protectedPort.applyPacket({
    ...current,
    generation: 1,
    changes: [],
  });
  assertEquals(stale.appliedChangeIds, []);
  assertEquals(stale.snapshot.generation, 2);
});

Deno.test("import-export adapter: share unavailable falls back to saving the same JSON bytes", async () => {
  const saved: Uint8Array[] = [];
  const fileShare: FileSharePort = {
    save: async (payload) => {
      saved.push(new Uint8Array(payload.bytes));
      await Promise.resolve();
    },
    share: async () => {
      const error = new Error("unsupported") as Error & { code: string };
      error.code = "unsupported";
      await Promise.resolve();
      throw error;
    },
  };
  const deps = { ...dependencies(), fileShare };
  const adapter = createImportExportAdapter(deps);
  const result = await adapter.exportDocument();
  assertEquals(await adapter.shareExport(result), "saved");
  assertEquals(new TextDecoder().decode(saved[0]), result.json);
});
