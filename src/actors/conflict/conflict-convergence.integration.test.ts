import { ConflictStore } from "./store.ts";
import type {
  ConflictJsonObject,
  ConflictObservation,
} from "../../domain/conflict/index.ts";
import {
  createFakeIdPort,
  createFakeLocalPort,
} from "../../test-support/fakes/ports.ts";
import { createTestClock } from "../../test-support/clock.ts";

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

const expense: ConflictJsonObject = {
  schemaVersion: 1,
  type: "expense",
  id: "expense-1",
  projectId: "project-1",
  categoryId: "category-uncategorized",
  date: "2026-08-24",
  amount: "-10",
  currency: "SEK",
  description: "Lunch",
  source: "manual",
};

function observation(): ConflictObservation {
  return {
    conflictId: "change-a",
    recordType: "expense",
    recordId: "expense-1",
    field: "amount",
    local: "-10",
    remote: "-20",
    localRecord: expense,
    remoteRecord: { ...expense, amount: "-20" },
    baseRecord: expense,
    localRevision: {
      id: "revision-local",
      deviceId: "device-local",
      deviceLabel: "Alpha",
      recordedAt: "2026-08-24T09:00:00.000Z",
      record: expense,
    },
    remoteRevision: {
      id: "revision-remote",
      deviceId: "device-remote",
      deviceLabel: "Beta",
      recordedAt: "2026-08-24T10:00:00.000Z",
      record: { ...expense, amount: "-20" },
    },
    relatedChangeIds: ["change-local", "change-remote"],
  };
}

async function seed(
  local: ReturnType<typeof createFakeLocalPort>,
): Promise<void> {
  await local.transaction("readwrite", async (transaction) => {
    await transaction.put("records", "expense-1", expense);
  });
}

function dependencies(prefix: string) {
  return {
    local: createFakeLocalPort(),
    deviceId: `device-${prefix}`,
    now: createTestClock("2026-08-24T12:00:00.000Z").nowIso,
    ids: createFakeIdPort(prefix),
  };
}

Deno.test("conflict-convergence: concurrent explicit resolutions converge to one durable result", async () => {
  const alpha = dependencies("alpha");
  const beta = dependencies("beta");
  await seed(alpha.local);
  await seed(beta.local);
  const alphaStore = new ConflictStore(alpha);
  const betaStore = new ConflictStore(beta);
  await alphaStore.ingest([observation()]);
  await betaStore.ingest([observation()]);
  const alphaGroup = (await alphaStore.load()).state.groups[0];
  const betaGroup = (await betaStore.load()).state.groups[0];
  await alphaStore.commit({
    groupId: alphaGroup.id,
    request: { choice: "candidate", candidateId: "change-a-local" },
  });
  await betaStore.commit({
    groupId: betaGroup.id,
    request: { choice: "candidate", candidateId: "change-a-remote" },
  });

  await alphaStore.reconcile((await betaStore.load()).state);
  await betaStore.reconcile((await alphaStore.load()).state);
  const alphaRecord = await alpha.local.query<ConflictJsonObject>(
    "records",
    {},
  );
  const betaRecord = await beta.local.query<ConflictJsonObject>("records", {});
  assertEquals(alphaRecord, betaRecord);
  assertEquals((await alphaStore.load()).state.groups, []);
  assertEquals((await betaStore.load()).state.groups, []);
  assert((await alphaStore.load()).state.resolutions.length >= 1);
});
