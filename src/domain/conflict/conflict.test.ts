import {
  emptyConflictState,
  groupConflictObservations,
  mergeConcurrentRecords,
  mergeConflictStates,
  observationsFromSyncConflicts,
  projectConflictState,
  resolveConflict,
} from "./index.ts";
import type {
  ConflictGroup,
  ConflictJsonObject,
  ConflictObservation,
  ConflictResolutionRecord,
  ConflictState,
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

const baseExpense: ConflictJsonObject = {
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

function revision(
  id: string,
  deviceId: string,
  deviceLabel: string,
  recordedAt: string,
  record?: ConflictJsonObject,
) {
  return {
    id,
    deviceId,
    deviceLabel,
    recordedAt,
    ...(record ? { record } : {}),
  };
}

function sameFieldObservation(): ConflictObservation {
  return {
    conflictId: "change-a",
    recordType: "expense",
    recordId: "expense-1",
    field: "amount",
    local: "-10",
    remote: "-20",
    localRecord: baseExpense,
    remoteRecord: { ...baseExpense, amount: "-20" },
    baseRecord: baseExpense,
    localRevision: revision(
      "revision-a",
      "device-a",
      "Alpha phone",
      "2026-08-24T09:00:00.000Z",
      baseExpense,
    ),
    remoteRevision: revision(
      "revision-b",
      "device-b",
      "Beta laptop",
      "2026-08-24T08:00:00.000Z",
      { ...baseExpense, amount: "-20" },
    ),
    relatedChangeIds: ["change-a", "change-b"],
  };
}

function stateWith(
  group: ConflictGroup,
  resolutions: readonly ConflictResolutionRecord[] = [],
): ConflictState {
  const state = emptyConflictState("2026-08-24T10:00:00.000Z");
  return {
    ...state,
    groups: [group],
    resolutions,
    progress: {
      ...state.progress,
      phase: "reviewing",
      unresolvedCount: 1,
    },
  };
}

Deno.test("conflict: independent field edits auto-merge without a conflict", () => {
  const local = { ...baseExpense, amount: "-11" };
  const remote = { ...baseExpense, description: "Dinner" };
  const result = mergeConcurrentRecords({
    recordType: "expense",
    recordId: "expense-1",
    baseRecord: baseExpense,
    localRecord: local,
    remoteRecord: remote,
  });
  assertEquals(result.conflicts, []);
  assertEquals(result.mergedRecord, {
    ...baseExpense,
    amount: "-11",
    description: "Dinner",
  });
});

Deno.test("conflict: an absent field versus an edited field is delete-versus-edit", () => {
  const base = { ...baseExpense, merchant: "Cafe" };
  const local: ConflictJsonObject = { ...base };
  delete (local as Record<string, unknown>).merchant;
  const remote = { ...base, merchant: "Diner" };
  const result = mergeConcurrentRecords({
    recordType: "expense",
    recordId: "expense-1",
    baseRecord: base,
    localRecord: local,
    remoteRecord: remote,
    localRevision: revision(
      "field-delete",
      "device-a",
      "Alpha",
      "2026-08-24T09:00:00.000Z",
      local,
    ),
    remoteRevision: revision(
      "field-edit",
      "device-b",
      "Beta",
      "2026-08-24T10:00:00.000Z",
      remote,
    ),
  });
  const group = result.conflicts[0];
  assertEquals(group.field, "merchant");
  assertEquals(group.kind, "delete-versus-edit");
  const deletedCandidate = group.candidates.find((candidate) =>
    candidate.deleted
  );
  assert(deletedCandidate !== undefined);
  const keepDeleted = resolveConflict({
    group,
    request: { choice: "candidate", candidateId: deletedCandidate.id },
    revisionId: "field-resolution-delete",
    deviceId: "device-owner",
    recordedAt: "2026-08-24T12:00:00.000Z",
  });
  assertEquals(keepDeleted.record?.merchant, undefined);
  assertEquals(keepDeleted.tombstone, undefined);
  const keepEdited = resolveConflict({
    group,
    request: { choice: "keep-edited" },
    revisionId: "field-resolution-edit",
    deviceId: "device-owner",
    recordedAt: "2026-08-24T12:01:00.000Z",
  });
  assertEquals(keepEdited.record?.merchant, "Diner");
});

Deno.test("conflict: S-402 complete-record observations retain field deletion candidates", () => {
  const local: ConflictJsonObject = { ...baseExpense };
  const remote = { ...baseExpense, merchant: "Diner" };
  const observations = observationsFromSyncConflicts([{
    id: "s402-record-conflict",
    recordType: "expense",
    recordId: "expense-1",
    local,
    remote,
    relatedChangeIds: ["parent-local", "parent-remote"],
  }]);
  const group = groupConflictObservations(observations)[0];
  assertEquals(group.field, "merchant");
  assertEquals(group.kind, "delete-versus-edit");
  assertEquals(
    group.candidates.filter((candidate) => candidate.deleted).length,
    1,
  );
  const deletedCandidate = group.candidates.find((candidate) =>
    candidate.deleted
  );
  assert(deletedCandidate !== undefined);
  const resolved = resolveConflict({
    group,
    request: { choice: "candidate", candidateId: deletedCandidate.id },
    revisionId: "s402-field-delete-resolution",
    deviceId: "device-owner",
    recordedAt: "2026-08-24T12:02:00.000Z",
  });
  assertEquals(resolved.record?.merchant, undefined);
  assertEquals(resolved.tombstone, undefined);
});

Deno.test("conflict: same-field observations group neutrally with device and time context", () => {
  const first = sameFieldObservation();
  const second: ConflictObservation = {
    ...first,
    conflictId: "change-c",
    local: "-30",
    localRevision: revision(
      "revision-c",
      "device-c",
      "Gamma tablet",
      "2026-08-24T07:00:00.000Z",
    ),
    remoteRevision: revision(
      "revision-d",
      "device-d",
      "Delta desktop",
      "2026-08-24T11:00:00.000Z",
    ),
  };
  const groups = groupConflictObservations([first, second]);
  assertEquals(groups.length, 1);
  assertEquals(groups[0].kind, "same-field");
  assertEquals(groups[0].candidates.map((candidate) => candidate.value), [
    "-10",
    "-20",
    "-30",
    "-20",
  ]);
  assertEquals(groups[0].candidates[0].deviceLabel, "Alpha phone");
  assertEquals(groups[0].candidates[0].recordedAt, "2026-08-24T09:00:00.000Z");
  assert(groups[0].parentRevisionIds.includes("change-b"));
  assert(groups[0].parentRevisionIds.includes("revision-d"));
});

Deno.test("conflict: candidate and custom choices validate the complete record", () => {
  const group = groupConflictObservations([sameFieldObservation()])[0];
  const candidate = resolveConflict({
    group,
    request: { choice: "candidate", candidateId: "change-a-remote" },
    revisionId: "resolution-candidate",
    deviceId: "device-owner",
    recordedAt: "2026-08-24T12:00:00.000Z",
  });
  assertEquals(candidate.record?.amount, "-20");
  const custom = resolveConflict({
    group,
    request: { choice: "custom", value: "-25" },
    revisionId: "resolution-custom",
    deviceId: "device-owner",
    recordedAt: "2026-08-24T12:01:00.000Z",
  });
  assertEquals(custom.record?.amount, "-25");
});

Deno.test("conflict: delete-versus-edit exposes both explicit outcomes", () => {
  const edited = { ...baseExpense, amount: "-12" };
  const merge = mergeConcurrentRecords({
    recordType: "expense",
    recordId: "expense-1",
    baseRecord: baseExpense,
    localRecord: undefined,
    remoteRecord: edited,
    localRevision: revision(
      "delete-parent",
      "device-a",
      "Alpha",
      "2026-08-24T09:00:00.000Z",
    ),
    remoteRevision: revision(
      "edit-parent",
      "device-b",
      "Beta",
      "2026-08-24T08:00:00.000Z",
      edited,
    ),
  });
  const group = merge.conflicts[0];
  assertEquals(group.kind, "delete-versus-edit");
  const keep = resolveConflict({
    group,
    request: { choice: "keep-edited" },
    revisionId: "resolution-keep",
    deviceId: "device-owner",
    recordedAt: "2026-08-24T12:00:00.000Z",
  });
  assertEquals(keep.record?.amount, "-12");
  const remove = resolveConflict({
    group,
    request: { choice: "delete" },
    revisionId: "resolution-delete",
    deviceId: "device-owner",
    recordedAt: "2026-08-24T12:01:00.000Z",
  });
  assertEquals(remove.record, undefined);
  assertEquals(remove.tombstone?.parentRevisionIds, group.parentRevisionIds);
});

Deno.test("conflict: receipt-line fields use the same explicit workflow", () => {
  const line: ConflictJsonObject = {
    schemaVersion: 1,
    type: "receipt-purchase-line",
    id: "line-1",
    receiptId: "receipt-1",
    projectId: "project-1",
    categoryId: "category-uncategorized",
    description: "Coffee",
    lineTotal: "-4",
  };
  const group = groupConflictObservations([{
    conflictId: "line-change",
    recordType: "receipt-purchase-line",
    recordId: "line-1",
    field: "description",
    local: "Coffee",
    remote: "Tea",
    localRecord: line,
    remoteRecord: { ...line, description: "Tea" },
    localRevision: revision(
      "line-a",
      "device-a",
      "Alpha",
      "2026-08-24T09:00:00.000Z",
    ),
    remoteRevision: revision(
      "line-b",
      "device-b",
      "Beta",
      "2026-08-24T10:00:00.000Z",
    ),
  }])[0];
  assertEquals(group.recordType, "receipt-line");
  const result = resolveConflict({
    group,
    request: { choice: "custom", value: "Green tea" },
    revisionId: "line-resolution",
    deviceId: "owner",
    recordedAt: "2026-08-24T11:00:00.000Z",
  });
  assertEquals(result.record?.description, "Green tea");
});

Deno.test("conflict: projections omit opaque IDs and timestamps do not select a winner", () => {
  const group = groupConflictObservations([sameFieldObservation()])[0];
  const state = stateWith(group);
  const projection = projectConflictState(state);
  const serialized = JSON.stringify(projection);
  assert(!serialized.includes("expense-1"));
  assert(!serialized.includes("revision-a"));
  assert(!serialized.includes("device-a"));
  assertEquals(
    projection.groups[0].candidates.map((candidate) => candidate.deviceLabel),
    [
      "Alpha phone",
      "Beta laptop",
    ],
  );
});

Deno.test("conflict: concurrent explicit resolutions converge without timestamp ordering", () => {
  const group = groupConflictObservations([sameFieldObservation()])[0];
  const first = resolveConflict({
    group,
    request: { choice: "candidate", candidateId: "change-a-local" },
    revisionId: "resolution-z",
    deviceId: "device-z",
    recordedAt: "2026-08-24T01:00:00.000Z",
  });
  const second = resolveConflict({
    group,
    request: { choice: "candidate", candidateId: "change-a-remote" },
    revisionId: "resolution-a",
    deviceId: "device-a",
    recordedAt: "2026-08-24T23:00:00.000Z",
  });
  const merged = mergeConflictStates(
    stateWith(group, [
      {
        groupId: first.groupId,
        resolutionRevision: first.resolutionRevision,
      },
    ]),
    stateWith(group, [
      {
        groupId: second.groupId,
        resolutionRevision: second.resolutionRevision,
      },
    ]),
  );
  assertEquals(merged.groups, []);
  assertEquals(merged.resolutions.length, 1);
  assertEquals(merged.resolutions[0].resolutionRevision.id, "resolution-a");
});
