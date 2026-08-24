import { IDBKeyRange, indexedDB } from "fake-indexeddb";
import {
  deleteLocalRepositoryDatabase,
  LOCAL_DATABASE_VERSION,
  openLocalRepository,
} from "./index.ts";
import { isAdapterError } from "../ports/errors.ts";
import {
  CURRENT_SCHEMA_VERSION,
  DATASET_FORMAT,
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

async function rejectsWithCode(
  operation: Promise<unknown>,
  code: string,
): Promise<void> {
  try {
    await operation;
  } catch (error) {
    assert(isAdapterError(error));
    assertEquals(error.code, code);
    return;
  }
  throw new Error(`Expected adapter error ${code}`);
}

let testNumber = 0;

function databaseName(): string {
  testNumber += 1;
  return `did-it-become-what-you-like-l201-${testNumber}`;
}

async function withRepository<T>(
  run: (
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
    now: () => "2026-08-24T02:40:00.000Z",
  });
  try {
    return await run(repository, name);
  } finally {
    repository.close();
    await deleteLocalRepositoryDatabase(name, indexedDB);
  }
}

function expense(id: string, projectId = "project-1") {
  return {
    schemaVersion: 1 as const,
    type: "expense" as const,
    id,
    projectId,
    categoryId: UNCATEGORIZED_CATEGORY_ID,
    date: "2026-08-24",
    amount: "-10.9",
    currency: "SEK",
    description: "",
    source: "manual" as const,
  };
}

function datasetFixture() {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    format: DATASET_FORMAT,
    projects: [{
      schemaVersion: 1 as const,
      type: "project" as const,
      id: "project-1",
      name: "Local",
      defaultCurrency: "SEK",
      archived: false,
    }],
    categories: [{
      schemaVersion: 1 as const,
      type: "category" as const,
      id: UNCATEGORIZED_CATEGORY_ID,
      name: "Uncategorized",
      sortOrder: 0,
      archived: false,
      system: true,
    }],
    expenses: [expense("expense-1")],
    receipts: [],
    receiptPurchaseLines: [],
    receiptAdjustments: [],
    devices: [],
    tombstones: [],
    retirementMarkers: [],
    revisions: [],
    settings: {
      schemaVersion: 1 as const,
      type: "portable-settings" as const,
      id: "settings-portable",
      expenseDayBoundary: "03:00",
    },
  };
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function corruptDocument(name: string): Promise<void> {
  const database = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(name, LOCAL_DATABASE_VERSION);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  const transaction = database.transaction("repository-documents", "readwrite");
  await requestResult(
    transaction.objectStore("repository-documents").put({
      key: "current",
      schemaVersion: 1,
      savedAt: "2026-08-24T02:41:00.000Z",
      bytes: new Uint8Array([1, 2, 3, 4]),
    }),
  );
  await new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
  database.close();
}

async function clearProjectionStore(name: string): Promise<void> {
  const database = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(name, LOCAL_DATABASE_VERSION);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  const transaction = database.transaction(
    "repository-projections",
    "readwrite",
  );
  await requestResult(
    transaction.objectStore("repository-projections").clear(),
  );
  await new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
  database.close();
}

Deno.test("local-repository: fresh open, indexed query, Automerge load, and restart", async () => {
  await withRepository(async (repository, name) => {
    assertEquals(repository.databaseName, name);
    assertEquals((await repository.query("records")).length, 0);
    await repository.transaction("readwrite", async (transaction) => {
      await transaction.put("records", "expense-1", expense("expense-1"));
    });
    const indexed = await repository.query("records", {
      index: "projectId",
      equals: "project-1",
    });
    assertEquals(indexed.map((entry) => entry.key), ["expense-1"]);
    const document = await repository.loadDocument();
    assert(document.records['["records","expense-1"]'] !== undefined);
    repository.close();
    const restarted = await openLocalRepository({
      databaseName: name,
      deviceId: "0123456789abcdef0123456789abcdef",
      indexedDB,
      keyRange: IDBKeyRange,
    });
    try {
      assertEquals((await restarted.query("records")).length, 1);
      assert(
        (await restarted.loadDocument()).records['["records","expense-1"]'] !==
          undefined,
        "restart must hydrate the Automerge document",
      );
    } finally {
      restarted.close();
    }
  });
});

Deno.test("local-repository: multi-record transactions roll back without leaking errors", async () => {
  await withRepository(async (repository) => {
    const secret = "receipt-api-key-should-not-escape";
    await rejectsWithCode(
      repository.transaction("readwrite", async (transaction) => {
        await transaction.put(
          "records",
          "expense-rollback",
          expense("expense-rollback"),
        );
        throw new Error(secret);
      }),
      "unknown",
    );
    assertEquals((await repository.query("records")).length, 0);
    try {
      await repository.transaction("readwrite", () => {
        throw new Error(secret);
      });
    } catch (error) {
      assert(
        !String(error).includes(secret),
        "adapter failures must redact messages",
      );
    }
  });
});

Deno.test("local-repository: concurrent offline commits converge locally", async () => {
  await withRepository(async (repository) => {
    await Promise.all([
      repository.transaction("readwrite", async (transaction) => {
        await transaction.put("records", "expense-a", expense("expense-a"));
      }),
      repository.transaction("readwrite", async (transaction) => {
        await transaction.put("records", "expense-b", expense("expense-b"));
      }),
    ]);
    assertEquals(
      (await repository.query("records")).map((entry) => entry.key),
      ["expense-a", "expense-b"],
    );
    assertEquals(
      Object.keys((await repository.loadDocument()).records).length,
      2,
    );
  });
});

Deno.test("local-repository: every supported dataset migration fixture is atomic", async () => {
  await withRepository(async (repository) => {
    const current = datasetFixture();
    const legacy = { ...current, schemaVersion: 0, format: undefined };
    await repository.importDataset(JSON.stringify(legacy), "replace");
    const migrated = JSON.parse(await repository.exportDataset()) as {
      schemaVersion: number;
      settings: { expenseDayBoundary: string };
    };
    assertEquals(migrated.schemaVersion, 1);
    assertEquals(migrated.settings.expenseDayBoundary, "03:00");

    await repository.importDataset(JSON.stringify(current), "merge");
    await rejectsWithCode(
      repository.importDataset(
        JSON.stringify({ ...current, schemaVersion: 99 }),
        "replace",
      ),
      "invalid-request",
    );
    assertEquals(JSON.parse(await repository.exportDataset()).schemaVersion, 1);
  });
});

Deno.test("local-repository: corruption restores the latest valid backup and projections", async () => {
  const name = databaseName();
  await deleteLocalRepositoryDatabase(name, indexedDB).catch(() => undefined);
  const repository = await openLocalRepository({
    databaseName: name,
    deviceId: "0123456789abcdef0123456789abcdef",
    indexedDB,
    keyRange: IDBKeyRange,
  });
  await repository.transaction("readwrite", async (transaction) => {
    await transaction.put("records", "expense-old", expense("expense-old"));
  });
  await repository.transaction("readwrite", async (transaction) => {
    await transaction.put("records", "expense-new", expense("expense-new"));
  });
  repository.close();
  await corruptDocument(name);
  const recovered = await openLocalRepository({
    databaseName: name,
    deviceId: "0123456789abcdef0123456789abcdef",
    indexedDB,
    keyRange: IDBKeyRange,
  });
  try {
    assertEquals(recovered.recovery, { recovered: true, source: "backup" });
    assertEquals((await recovered.query("records")).map((entry) => entry.key), [
      "expense-old",
    ]);
    assertEquals(
      (await recovered.query("records", {
        index: "projectId",
        equals: "project-1",
      })).map((entry) => entry.key),
      ["expense-old"],
    );
  } finally {
    recovered.close();
    await deleteLocalRepositoryDatabase(name, indexedDB);
  }
});

Deno.test("local-repository: quota/failure injection leaves prior records intact", async () => {
  const name = databaseName();
  await deleteLocalRepositoryDatabase(name, indexedDB).catch(() => undefined);
  let fail = false;
  const repository = await openLocalRepository({
    databaseName: name,
    deviceId: "0123456789abcdef0123456789abcdef",
    indexedDB,
    keyRange: IDBKeyRange,
    beforeRequest: (operation) => {
      if (fail && operation === "local.value.put") {
        throw new Error("quota receipt secret");
      }
    },
  });
  try {
    await repository.transaction("readwrite", async (transaction) => {
      await transaction.put("records", "stable", expense("stable"));
    });
    fail = true;
    await rejectsWithCode(
      repository.transaction("readwrite", async (transaction) => {
        await transaction.put("records", "failed", expense("failed"));
      }),
      "unknown",
    );
    fail = false;
    assertEquals(
      (await repository.query("records")).map((entry) => entry.key),
      ["stable"],
    );
  } finally {
    repository.close();
    await deleteLocalRepositoryDatabase(name, indexedDB);
  }
});

Deno.test("local-repository: revisions and tombstones survive restart", async () => {
  await withRepository(async (repository) => {
    await repository.transaction("readwrite", async (transaction) => {
      await transaction.put("records", "deletable", expense("deletable"));
      await transaction.delete("records", "deletable");
    });
    assertEquals((await repository.query("records")).length, 0);
    const tombstones = await repository.query("sync-metadata", {
      index: "type",
      equals: "local-tombstone",
    });
    assertEquals(tombstones.map((entry) => entry.key), [
      "tombstone:records:deletable",
    ]);
    const document = await repository.loadDocument();
    assert(document.tombstones['["records","deletable"]'] !== undefined);
  });
});

Deno.test("local-repository: projection rebuild is deterministic", async () => {
  await withRepository(async (repository, name) => {
    await repository.transaction("readwrite", async (transaction) => {
      await transaction.put("records", "expense-b", expense("expense-b"));
      await transaction.put("records", "expense-a", expense("expense-a"));
    });
    await clearProjectionStore(name);
    assertEquals(
      (await repository.query("records", {
        index: "projectId",
        equals: "project-1",
      })).length,
      0,
    );
    await repository.rebuildProjections();
    assertEquals(
      (await repository.query("records", {
        index: "projectId",
        equals: "project-1",
      })).map((entry) => entry.key),
      ["expense-a", "expense-b"],
    );
  });
});
