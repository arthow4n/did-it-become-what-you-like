import { IDBKeyRange, indexedDB } from "fake-indexeddb";
import type { CausalSnapshot } from "../ports/sync.ts";
import { createDatasetChange, mergeCausalSnapshots } from "../sync/causal.ts";
import { deleteLocalRepositoryDatabase, openLocalRepository } from "./index.ts";
import { createReceiptManagementService } from "../../domain/receipt.ts";
import {
  DATASET_FORMAT,
  parseCurrentDataset,
  type PortableDataset,
  UNCATEGORIZED_CATEGORY_ID,
} from "../../domain/index.ts";

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

let databaseNumber = 0;

function databaseName(): string {
  databaseNumber += 1;
  return `did-it-become-what-you-like-m27-receipt-sync-${databaseNumber}`;
}

function receiptDataset(): PortableDataset {
  return parseCurrentDataset({
    schemaVersion: 1,
    format: DATASET_FORMAT,
    projects: [{
      schemaVersion: 1,
      type: "project",
      id: "project-receipt-sync",
      name: "Receipt sync",
      defaultCurrency: "SEK",
      archived: false,
    }],
    categories: [{
      schemaVersion: 1,
      type: "category",
      id: UNCATEGORIZED_CATEGORY_ID,
      name: "Uncategorized",
      sortOrder: 0,
      archived: false,
      system: true,
    }],
    expenses: [{
      schemaVersion: 1,
      type: "expense",
      id: "expense-receipt-sync",
      projectId: "project-receipt-sync",
      categoryId: UNCATEGORIZED_CATEGORY_ID,
      date: "2026-08-30",
      amount: "-10",
      currency: "SEK",
      description: "Bread",
      source: "receipt-line",
      receiptId: "receipt-sync",
      receiptLineId: "line-sync",
    }],
    receipts: [{
      schemaVersion: 1,
      type: "receipt",
      id: "receipt-sync",
      projectId: "project-receipt-sync",
      date: "2026-08-30",
      merchant: "Sync market",
      currency: "SEK",
      printedTotal: "-10",
    }],
    receiptPurchaseLines: [{
      schemaVersion: 1,
      type: "receipt-purchase-line",
      id: "line-sync",
      receiptId: "receipt-sync",
      projectId: "project-receipt-sync",
      categoryId: UNCATEGORIZED_CATEGORY_ID,
      description: "Bread",
      lineTotal: "-10",
    }],
    receiptAdjustments: [{
      schemaVersion: 1,
      type: "receipt-adjustment",
      id: "adjustment-sync",
      receiptId: "receipt-sync",
      projectId: "project-receipt-sync",
      categoryId: UNCATEGORIZED_CATEGORY_ID,
      description: "Discount",
      amount: "0",
      lineId: "line-sync",
    }],
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
  });
}

async function withRepository<T>(
  callback: (
    repository: Awaited<ReturnType<typeof openLocalRepository>>,
    name: string,
  ) => Promise<T>,
): Promise<T> {
  const name = databaseName();
  await deleteLocalRepositoryDatabase(name, indexedDB).catch(() => undefined);
  const repository = await openLocalRepository({
    databaseName: name,
    deviceId: "0123456789abcdef0123456789abcdef",
    indexedDB,
    keyRange: IDBKeyRange,
    now: () => "2026-08-30T12:00:00.000Z",
  });
  try {
    await repository.importDataset(JSON.stringify(receiptDataset()), "replace");
    return await callback(repository, name);
  } finally {
    repository.close();
    await deleteLocalRepositoryDatabase(name, indexedDB);
  }
}

Deno.test(
  "receipt-delete-sync: whole-receipt deletion removes aggregate records and writes complete tombstones",
  async () => {
    await withRepository(async (repository) => {
      const service = createReceiptManagementService(repository, {
        deviceId: "device-receipt-sync",
        now: () => "2026-08-30T12:01:00.000Z",
      });
      const result = await service.deleteReceipt("receipt-sync");
      assertEquals(result.deletedReceipt, true);
      const dataset = parseCurrentDataset(
        JSON.parse(await repository.exportDataset()),
      );
      assertEquals(dataset.receipts.length, 0);
      assertEquals(dataset.receiptPurchaseLines.length, 0);
      assertEquals(dataset.receiptAdjustments.length, 0);
      assertEquals(dataset.expenses.length, 0);
      assertEquals(
        dataset.tombstones.map((tombstone) => tombstone.targetId).sort(),
        [
          "adjustment-sync",
          "expense-receipt-sync",
          "line-sync",
          "receipt-sync",
        ],
      );
    });
  },
);

Deno.test(
  "receipt-delete-sync: stale replay cannot resurrect a deleted receipt aggregate",
  async () => {
    await withRepository(async (repository) => {
      const before = parseCurrentDataset(
        JSON.parse(await repository.exportDataset()),
      );
      const service = createReceiptManagementService(repository, {
        deviceId: "device-receipt-sync",
        now: () => "2026-08-30T12:01:00.000Z",
      });
      await service.deleteReceipt("receipt-sync");
      const after = parseCurrentDataset(
        JSON.parse(await repository.exportDataset()),
      );
      const base = createDatasetChange({
        id: "change-receipt-base",
        actorId: "device-receipt-a",
        sequence: 1,
        parents: [],
        dataset: before,
      });
      const deleted = createDatasetChange({
        id: "change-receipt-delete",
        actorId: "device-receipt-a",
        sequence: 2,
        parents: [base.id],
        dataset: after,
      });
      const stale = createDatasetChange({
        id: "change-receipt-stale",
        actorId: "device-receipt-b",
        sequence: 1,
        parents: [base.id],
        dataset: before,
      });
      const result = mergeCausalSnapshots(
        {
          generation: 1,
          heads: [deleted.id],
          changes: [base, deleted],
          dataset: after,
        },
        {
          generation: 1,
          heads: [stale.id],
          changes: [base, stale],
          dataset: before,
        },
      );
      assert(
        !result.snapshot.dataset.receipts.some((receipt) =>
          receipt.id === "receipt-sync"
        ),
      );
      assert(
        !result.snapshot.dataset.receiptPurchaseLines.some((line) =>
          line.id === "line-sync"
        ),
      );
      assert(
        !result.snapshot.dataset.expenses.some((expense) =>
          expense.id === "expense-receipt-sync"
        ),
      );
      assert(
        result.snapshot.dataset.tombstones.some((tombstone) =>
          tombstone.targetId === "receipt-sync"
        ),
      );
    });
  },
);

Deno.test(
  "receipt-delete-sync: concurrent child edit remains a reviewable conflict",
  () => {
    const before = receiptDataset();
    const edited = parseCurrentDataset({
      ...before,
      receiptPurchaseLines: before.receiptPurchaseLines.map((line) =>
        line.id === "line-sync"
          ? { ...line, description: "Edited bread" }
          : line
      ),
    });
    const deleted = parseCurrentDataset({
      ...before,
      receipts: [],
      receiptPurchaseLines: [],
      receiptAdjustments: [],
      expenses: [],
      tombstones: [
        ...before.tombstones,
        ...[
          ["receipt", "receipt-sync"],
          ["receipt-purchase-line", "line-sync"],
          ["receipt-adjustment", "adjustment-sync"],
          ["expense", "expense-receipt-sync"],
        ].map(([targetType, targetId]) => ({
          schemaVersion: 1,
          type: "tombstone" as const,
          id: `tombstone-${targetType}-${targetId}`,
          targetType,
          targetId,
          deletedAt: "2026-08-30T12:01:00.000Z",
          deletedBy: "device-receipt-a",
        })),
      ],
    });
    const base = createDatasetChange({
      id: "change-receipt-concurrent-base",
      actorId: "device-receipt-a",
      sequence: 1,
      parents: [],
      dataset: before,
    });
    const deleteChange = createDatasetChange({
      id: "change-receipt-concurrent-delete",
      actorId: "device-receipt-a",
      sequence: 2,
      parents: [base.id],
      dataset: deleted,
    });
    const editChange = createDatasetChange({
      id: "change-receipt-concurrent-edit",
      actorId: "device-receipt-b",
      sequence: 1,
      parents: [base.id],
      dataset: edited,
    });
    const result = mergeCausalSnapshots(
      {
        generation: 1,
        heads: [deleteChange.id],
        changes: [base, deleteChange],
        dataset: deleted,
      } satisfies CausalSnapshot,
      {
        generation: 1,
        heads: [editChange.id],
        changes: [base, editChange],
        dataset: edited,
      } satisfies CausalSnapshot,
    );
    assert(
      result.conflicts.some((conflict) =>
        conflict.recordId === "line-sync" &&
        (conflict.local === null || conflict.remote === null)
      ),
      "delete versus child edit must remain reviewable",
    );
  },
);
