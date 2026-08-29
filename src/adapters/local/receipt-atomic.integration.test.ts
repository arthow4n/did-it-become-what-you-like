import { IDBKeyRange, indexedDB } from "fake-indexeddb";
import { adapterError, isAdapterError } from "../ports/errors.ts";
import { UNCATEGORIZED_CATEGORY_ID } from "../../domain/index.ts";
import {
  createReceiptCommitService,
  createReceiptManagementService,
  type ReceiptReviewDraft,
} from "../../domain/receipt.ts";
import { createProjectCategoryService } from "../../domain/organization.ts";
import { deleteLocalRepositoryDatabase, openLocalRepository } from "./index.ts";

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

let sequence = 0;
function databaseName(): string {
  sequence += 1;
  return `did-it-become-what-you-like-a302-receipt-${sequence}`;
}

const project = {
  schemaVersion: 1 as const,
  type: "project" as const,
  id: "project-receipt-integration",
  name: "Receipt integration",
  defaultCurrency: "SEK" as const,
  archived: false,
};

const review: ReceiptReviewDraft = {
  parent: {
    projectId: project.id,
    date: "2026-08-24",
    time: "18:30",
    merchant: "Integration market",
    currency: "SEK",
    printedTotal: "-9",
  },
  lines: [{
    type: "purchase",
    id: "receipt-line-integration-purchase",
    description: "Bread",
    categoryId: UNCATEGORIZED_CATEGORY_ID,
    quantity: "1",
    unitPrice: "10",
    lineTotal: "-10",
    selected: true,
    uncertain: false,
  }, {
    type: "adjustment",
    id: "receipt-line-integration-refund",
    description: "Bottle return",
    categoryId: UNCATEGORIZED_CATEGORY_ID,
    amount: "1",
    lineId: "receipt-line-integration-purchase",
    selected: true,
    uncertain: false,
  }],
  uncertainty: [],
  printedTotalMismatch: false,
};

async function withRepository<T>(
  run: (
    repository: Awaited<ReturnType<typeof openLocalRepository>>,
    service: ReturnType<typeof createProjectCategoryService>,
  ) => Promise<T>,
  beforeRequest?: (operation: string) => void,
): Promise<T> {
  const name = databaseName();
  await deleteLocalRepositoryDatabase(name, indexedDB).catch(() => undefined);
  const repository = await openLocalRepository({
    databaseName: name,
    deviceId: "0123456789abcdef0123456789abcdef",
    indexedDB,
    keyRange: IDBKeyRange,
    now: () => "2026-08-24T12:00:00.000Z",
    ...(beforeRequest === undefined ? {} : { beforeRequest }),
  });
  const service = createProjectCategoryService(repository, {
    deviceId: "device-receipt-integration",
    now: () => "2026-08-24T12:00:00.000Z",
  });
  try {
    return await run(repository, service);
  } finally {
    repository.close();
    await deleteLocalRepositoryDatabase(name, indexedDB);
  }
}

Deno.test("receipt-atomic integration: parent, signed lines, links, and parent-only time survive restart", async () => {
  await withRepository(async (repository, organization) => {
    await organization.commitProject({ type: "create", project });
    const commit = createReceiptCommitService(repository, {
      nextId: (kind) =>
        kind === "receipt" ? "receipt-integration" : "receipt-generated",
    });
    const result = await commit.commit({ review, confirmMismatch: false });
    assertEquals(result.receipt.time, "18:30");
    assertEquals(result.purchaseLines[0]?.lineTotal, "-10");
    assertEquals(result.adjustments[0]?.amount, "1");
    assertEquals(result.adjustments[0]?.lineId, result.purchaseLines[0]?.id);
    assert(!("time" in result.purchaseLines[0]!));
    assertEquals(
      (await repository.query("records", { index: "type", equals: "receipt" }))
        .length,
      1,
    );
    assertEquals(
      (await repository.query("records", {
        index: "type",
        equals: "receipt-purchase-line",
      })).length,
      1,
    );
    assertEquals(
      (await repository.query("records", {
        index: "type",
        equals: "receipt-adjustment",
      })).length,
      1,
    );
  });
});

Deno.test("receipt-atomic integration: a write failure aborts the whole receipt transaction", async () => {
  let lineWrites = 0;
  let injectFailure = false;
  await withRepository(async (repository, organization) => {
    await organization.commitProject({
      type: "create",
      project: { ...project, id: "project-receipt-rollback" },
    });
    const rollbackReview = {
      ...review,
      parent: { ...review.parent, projectId: "project-receipt-rollback" },
    };
    const commit = createReceiptCommitService(repository, {
      nextId: (kind) =>
        kind === "receipt" ? "receipt-rollback" : "receipt-rollback-generated",
    });
    injectFailure = true;
    try {
      await commit.commit({ review: rollbackReview, confirmMismatch: false });
    } catch (error) {
      assert(isAdapterError(error));
      assertEquals(error.code, "quota");
    }
    assertEquals(
      (await repository.query("records", { index: "type", equals: "receipt" }))
        .length,
      0,
    );
    assertEquals(
      (await repository.query("records", {
        index: "type",
        equals: "receipt-purchase-line",
      })).length,
      0,
    );
    assertEquals(
      (await repository.query("records", {
        index: "type",
        equals: "receipt-adjustment",
      })).length,
      0,
    );
  }, (operation) => {
    if (injectFailure && operation === "local.value.put") {
      lineWrites += 1;
      if (lineWrites === 2) {
        throw adapterError("quota", "receipt.rollback-test");
      }
    }
  });
});

Deno.test(
  "receipt-atomic integration: management deletion rolls back parent and children together",
  async () => {
    let injectFailure = false;
    await withRepository(async (repository, organization) => {
      await organization.commitProject({ type: "create", project });
      const commit = createReceiptCommitService(repository, {
        nextId: (kind) =>
          kind === "receipt"
            ? "receipt-management-rollback"
            : "receipt-management-line",
      });
      await commit.commit({ review, confirmMismatch: false });
      const management = createReceiptManagementService(repository, {
        deviceId: "device-receipt-integration",
        now: () => "2026-08-24T12:00:00.000Z",
      });
      injectFailure = true;
      try {
        await management.deleteReceipt("receipt-management-rollback");
      } catch (error) {
        assert(isAdapterError(error));
        assertEquals(error.code, "quota");
      }
      assertEquals(
        (await repository.query("records", {
          index: "type",
          equals: "receipt",
        }))
          .length,
        1,
      );
      assertEquals(
        (await repository.query("records", {
          index: "type",
          equals: "receipt-purchase-line",
        })).length,
        1,
      );
      assertEquals(
        (await repository.query("records", {
          index: "type",
          equals: "tombstone",
        })).length,
        0,
      );
    }, (operation) => {
      if (injectFailure && operation === "local.tombstone.put") {
        throw adapterError("quota", "receipt.management-rollback");
      }
    });
  },
);
