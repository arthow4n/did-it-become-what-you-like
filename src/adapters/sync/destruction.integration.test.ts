import { IDBKeyRange, indexedDB } from "fake-indexeddb";
import {
  adapterError,
  type DriveFile,
  isAdapterError,
} from "../ports/index.ts";
import { createDriveCausalSyncPort } from "./causal.ts";
import {
  deleteDriveGeneration,
  publishDriveRetirement,
} from "../../actors/destruction.ts";
import {
  deleteLocalRepositoryDatabase,
  openLocalRepository,
} from "../local/index.ts";

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

function driveFixture() {
  const calls: string[] = [];
  let marker: {
    readonly schemaVersion: 1;
    readonly type: "retirement-marker";
    readonly generation: string;
  } | undefined;
  const files = new Map<string, DriveFile>([
    ["sync.json", {
      id: "sync",
      name: "sync.json",
      body: "financial",
      etag: "1",
      updatedAt: "2026-08-24T18:00:00.000Z",
    }],
    ["other.json", {
      id: "other",
      name: "other.json",
      body: "financial-2",
      etag: "2",
      updatedAt: "2026-08-24T18:00:00.000Z",
    }],
  ]);
  const drive = {
    publishRetirementMarker: (next: typeof marker) => {
      calls.push("publish-retirement");
      marker = next;
      return Promise.resolve({
        id: "retirement",
        name: "__did-it-become-what-you-like.retirement.json",
        body: JSON.stringify(next),
        etag: "3",
        updatedAt: "2026-08-24T18:00:00.000Z",
      });
    },
    listAppData: () => {
      calls.push("list");
      return Promise.resolve([...files.values()]);
    },
    deleteAppData: (name: string) => {
      calls.push(`delete:${name}`);
      files.delete(name);
      return Promise.resolve();
    },
    readRetirementMarker: () => Promise.resolve(marker),
    readAppData: () => Promise.resolve(undefined),
    writeAppData: () => {
      return Promise.reject(adapterError("retired", "test.upload"));
    },
  };
  return { calls, files, drive };
}

Deno.test("retirement publication precedes Drive generation deletion and leaves only the minimal marker", async () => {
  const fixture = driveFixture();
  await publishDriveRetirement(fixture.drive, 12);
  await deleteDriveGeneration(fixture.drive, 12);
  assertEquals(fixture.calls, [
    "publish-retirement",
    "list",
    "delete:sync.json",
    "delete:other.json",
  ]);
  assert(fixture.files.size === 0);
  assert(JSON.stringify(fixture.drive).indexOf("financial") === -1);
});

Deno.test("retirement failure can be retried without re-publishing a different generation", async () => {
  const fixture = driveFixture();
  await publishDriveRetirement(fixture.drive, 13);
  let failed = true;
  const deleting = {
    listAppData: () => fixture.drive.listAppData(),
    deleteAppData: (name: string, etag?: string) => {
      void etag;
      if (failed) {
        failed = false;
        return Promise.reject(adapterError("unavailable", "test.drive-delete"));
      }
      return fixture.drive.deleteAppData(name);
    },
  };
  let rejected = false;
  try {
    await deleteDriveGeneration(deleting, 13);
  } catch (error) {
    rejected = isAdapterError(error) && error.code === "unavailable";
  }
  assert(rejected);
  await deleteDriveGeneration(deleting, 13);
  assert(
    fixture.calls.filter((call) => call === "publish-retirement").length === 1,
  );
});

Deno.test("retirement marker blocks an old-device reconnect before upload", async () => {
  const fixture = driveFixture();
  await publishDriveRetirement(fixture.drive, 14);
  const causal = createDriveCausalSyncPort({ drive: fixture.drive });
  let rejected = false;
  try {
    await causal.applyPacket({ generation: 14, heads: [], changes: [] });
  } catch (error) {
    rejected = isAdapterError(error) && error.code === "retired";
  }
  assert(rejected, "retired devices must be blocked before any upload");
  assert(!fixture.calls.some((call) => call.startsWith("delete:")));
});

Deno.test("retirement local erasure removes the IndexedDB database and allows explicit reinitialization", async () => {
  const databaseName = "did-it-become-what-you-like-x502-recovery";
  await deleteLocalRepositoryDatabase(databaseName, indexedDB).catch(() =>
    undefined
  );
  const repository = await openLocalRepository({
    databaseName,
    deviceId: "0123456789abcdef0123456789abcdef",
    indexedDB,
    keyRange: IDBKeyRange,
    now: () => "2026-08-24T18:00:00.000Z",
  });
  await repository.transaction("readwrite", async (transaction) => {
    await transaction.put("records", "financial-record", {
      type: "expense",
      amount: "-99",
    });
  });
  repository.close();
  await deleteLocalRepositoryDatabase(databaseName, indexedDB);
  const fresh = await openLocalRepository({
    databaseName,
    deviceId: "0123456789abcdef0123456789abcdef",
    indexedDB,
    keyRange: IDBKeyRange,
    now: () => "2026-08-24T18:01:00.000Z",
  });
  assertEquals(await fresh.query("records"), []);
  fresh.close();
  await deleteLocalRepositoryDatabase(databaseName, indexedDB);
});
