import {
  CategorySchema,
  ExpenseSchema,
  ProjectSchema,
  ReceiptLineSchema,
  ReceiptParentSchema,
} from "../schema/records.ts";
import type {
  ConcurrentRecordInput,
  ConflictCandidate,
  ConflictCandidateProjection,
  ConflictGroup,
  ConflictGroupProjection,
  ConflictJsonObject,
  ConflictJsonValue,
  ConflictMergeResult,
  ConflictObservation,
  ConflictRecordType,
  ConflictResolutionRecord,
  ConflictResolutionRequest,
  ConflictResolutionResult,
  ConflictRevisionContext,
  ConflictState,
  ConflictStateProjection,
} from "./types.ts";

const NON_CONFLICT_RECORD_KEYS = new Set([
  "id",
  "type",
  "schemaVersion",
]);

const OPTIONAL_FIELDS = new Set([
  "time",
  "merchant",
  "color",
  "receiptId",
  "receiptLineId",
  "quantity",
  "unitPrice",
  "lineId",
]);

function compareCodeUnits(left: string, right: string): number {
  const length = Math.min(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const difference = left.charCodeAt(index) - right.charCodeAt(index);
    if (difference !== 0) return difference;
  }
  return left.length - right.length;
}

function canonicalValue(value: unknown): string {
  if (value === undefined) return "undefined";
  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalValue(entry)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => compareCodeUnits(left, right))
        .map(([key, entry]) =>
          `${JSON.stringify(key)}:${canonicalValue(entry)}`
        )
        .join(",")
    }}`;
  }
  return JSON.stringify(value);
}

function equalValue(left: unknown, right: unknown): boolean {
  return canonicalValue(left) === canonicalValue(right);
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function uniqueSorted(values: readonly string[]): readonly string[] {
  return [...new Set(values)].sort(compareCodeUnits);
}

function normalizedRecordType(value: string): ConflictRecordType {
  switch (value) {
    case "project":
    case "category":
    case "expense":
    case "receipt":
    case "receipt-line":
      return value;
    case "receipt-purchase-line":
    case "receipt-adjustment":
      return "receipt-line";
    default:
      throw new Error("Unsupported conflict record type.");
  }
}

function safeSegment(value: string): string {
  return value.replace(/[^A-Za-z0-9._~-]/g, "-");
}

function groupId(
  recordType: ConflictRecordType,
  recordId: string,
  field: string,
): string {
  return `conflict-${safeSegment(recordType)}-${safeSegment(recordId)}-${
    safeSegment(field)
  }`;
}

function revisionFallback(
  observation: ConflictObservation,
  side: "local" | "remote",
): ConflictRevisionContext {
  const revisionId = `${observation.conflictId}-${side}`;
  return {
    id: revisionId,
    deviceId: `${side}-device`,
    deviceLabel: side === "local" ? "This device" : "Other device",
    recordedAt: observation.recordedAt ?? "1970-01-01T00:00:00.000Z",
  };
}

function candidateFromObservation(
  observation: ConflictObservation,
  side: "local" | "remote",
  field: string,
): ConflictCandidate {
  const revision = side === "local"
    ? observation.localRevision ?? revisionFallback(observation, side)
    : observation.remoteRevision ?? revisionFallback(observation, side);
  const record = side === "local"
    ? observation.localRecord ?? revision.record
    : observation.remoteRecord ?? revision.record;
  const sideValue = side === "local" ? observation.local : observation.remote;
  const baseHasField = observation.baseRecord !== undefined &&
    Object.prototype.hasOwnProperty.call(observation.baseRecord, field);
  const deleted = side === "local"
    ? observation.localDeleted ??
      (sideValue === undefined &&
        ((field === "__record" && record === undefined) || baseHasField))
    : observation.remoteDeleted ??
      (sideValue === undefined &&
        ((field === "__record" && record === undefined) || baseHasField));
  const inputValue = side === "local" ? observation.local : observation.remote;
  const value = field === "__record" ? record : inputValue;
  return {
    id: `${observation.conflictId}-${side}`,
    revisionId: revision.id,
    ...(value === undefined ? {} : { value: clone(value) }),
    deleted,
    deviceId: revision.deviceId,
    deviceLabel: revision.deviceLabel,
    recordedAt: revision.recordedAt,
    ...(record === undefined ? {} : { record: clone(record) }),
  };
}

function groupFromObservation(
  observation: ConflictObservation,
  field: string,
): ConflictGroup {
  const recordType = normalizedRecordType(observation.recordType);
  const localRevision = observation.localRevision ??
    revisionFallback(observation, "local");
  const remoteRevision = observation.remoteRevision ??
    revisionFallback(observation, "remote");
  const localCandidate = candidateFromObservation(observation, "local", field);
  const remoteCandidate = candidateFromObservation(
    observation,
    "remote",
    field,
  );
  const parentRevisionIds = uniqueSorted([
    ...(observation.relatedChangeIds ?? []),
    localRevision.id,
    remoteRevision.id,
  ]);
  const candidates = [localCandidate, remoteCandidate].sort((left, right) =>
    compareCodeUnits(left.id, right.id)
  );
  const kind = candidates.some((candidate) => candidate.deleted) &&
      candidates.some((candidate) => !candidate.deleted)
    ? "delete-versus-edit"
    : "same-field";
  return {
    id: groupId(recordType, observation.recordId, field),
    recordType,
    recordId: observation.recordId,
    field,
    kind,
    candidates,
    parentRevisionIds: uniqueSorted([
      ...parentRevisionIds,
      ...candidates.map((candidate) => candidate.revisionId),
    ]),
    sourceConflictIds: [observation.conflictId].sort(compareCodeUnits),
    ...(observation.localRecord === undefined
      ? {}
      : { currentRecord: clone(observation.localRecord) }),
    ...(observation.baseRecord === undefined
      ? {}
      : { baseRecord: clone(observation.baseRecord) }),
  };
}

function fieldsForRecords(
  base: ConflictJsonObject | undefined,
  local: ConflictJsonObject | undefined,
  remote: ConflictJsonObject | undefined,
): readonly string[] {
  const fields = new Set<string>([
    ...Object.keys(base ?? {}),
    ...Object.keys(local ?? {}),
    ...Object.keys(remote ?? {}),
  ]);
  return [...fields].filter((field) => !NON_CONFLICT_RECORD_KEYS.has(field))
    .sort(compareCodeUnits);
}

function observationForField(
  input: ConcurrentRecordInput,
  field: string,
  local: ConflictJsonValue | undefined,
  remote: ConflictJsonValue | undefined,
): ConflictObservation {
  const baseHasField = input.baseRecord !== undefined &&
    Object.prototype.hasOwnProperty.call(input.baseRecord, field);
  return {
    conflictId: input.conflictId ??
      `causal-${input.recordType}-${input.recordId}-${field}`,
    recordType: input.recordType,
    recordId: input.recordId,
    field,
    ...(local === undefined ? {} : { local }),
    ...(remote === undefined ? {} : { remote }),
    localDeleted: local === undefined && baseHasField,
    remoteDeleted: remote === undefined && baseHasField,
    ...(input.localRecord === undefined
      ? {}
      : { localRecord: input.localRecord }),
    ...(input.remoteRecord === undefined
      ? {}
      : { remoteRecord: input.remoteRecord }),
    ...(input.baseRecord === undefined ? {} : { baseRecord: input.baseRecord }),
    ...(input.localRevision === undefined
      ? {}
      : { localRevision: input.localRevision }),
    ...(input.remoteRevision === undefined
      ? {}
      : { remoteRevision: input.remoteRevision }),
    ...(input.relatedChangeIds === undefined
      ? {}
      : { relatedChangeIds: input.relatedChangeIds }),
    ...(input.recordedAt === undefined ? {} : { recordedAt: input.recordedAt }),
  };
}

/**
 * Group S-402 observations by stable record and field. Candidate order is
 * deterministic but is never timestamp order and never implies a winner.
 */
export function groupConflictObservations(
  observations: readonly ConflictObservation[],
): readonly ConflictGroup[] {
  const grouped = new Map<string, ConflictGroup>();
  for (const observation of observations) {
    const field = observation.field ?? "__record";
    const next = groupFromObservation(observation, field);
    const existing = grouped.get(next.id);
    grouped.set(
      next.id,
      existing === undefined ? next : mergeConflictGroups(existing, next),
    );
  }
  return [...grouped.values()].sort((left, right) =>
    compareCodeUnits(left.id, right.id)
  );
}

/**
 * Accept the public S-402 conflict shape without editing that contract. When
 * S-402 has not included a field, complete-record payloads are expanded into
 * their changed fields; scalar payloads remain a record-level conflict.
 */
export function observationsFromSyncConflicts(
  conflicts: readonly {
    readonly id: string;
    readonly recordType: string;
    readonly recordId: string;
    readonly local?: unknown;
    readonly remote?: unknown;
    readonly relatedChangeIds?: readonly string[];
    readonly field?: string;
  }[],
): readonly ConflictObservation[] {
  const observations: ConflictObservation[] = [];
  for (const conflict of conflicts) {
    const local = isJsonValue(conflict.local) ? conflict.local : undefined;
    const remote = isJsonValue(conflict.remote) ? conflict.remote : undefined;
    const localRecord = asRecord(local);
    const remoteRecord = asRecord(remote);
    if (conflict.field !== undefined) {
      observations.push({
        conflictId: conflict.id,
        recordType: conflict.recordType,
        recordId: conflict.recordId,
        field: conflict.field,
        ...(local === undefined ? {} : { local }),
        ...(remote === undefined ? {} : { remote }),
        ...(localRecord === undefined ? {} : { localRecord }),
        ...(remoteRecord === undefined ? {} : { remoteRecord }),
        localDeleted: fieldIsAbsent(localRecord, remoteRecord, conflict.field),
        remoteDeleted: fieldIsAbsent(remoteRecord, localRecord, conflict.field),
        relatedChangeIds: conflict.relatedChangeIds,
      });
      continue;
    }
    if (localRecord !== undefined || remoteRecord !== undefined) {
      for (
        const field of fieldsForRecords(undefined, localRecord, remoteRecord)
      ) {
        if (equalValue(localRecord?.[field], remoteRecord?.[field])) continue;
        observations.push({
          conflictId: `${conflict.id}-${field}`,
          recordType: conflict.recordType,
          recordId: conflict.recordId,
          field,
          ...(localRecord?.[field] === undefined
            ? {}
            : { local: localRecord[field] }),
          ...(remoteRecord?.[field] === undefined
            ? {}
            : { remote: remoteRecord[field] }),
          localRecord,
          remoteRecord,
          localDeleted: fieldIsAbsent(localRecord, remoteRecord, field),
          remoteDeleted: fieldIsAbsent(remoteRecord, localRecord, field),
          relatedChangeIds: conflict.relatedChangeIds,
        });
      }
      continue;
    }
    observations.push({
      conflictId: conflict.id,
      recordType: conflict.recordType,
      recordId: conflict.recordId,
      field: "__record",
      ...(local === undefined ? {} : { local }),
      ...(remote === undefined ? {} : { remote }),
      relatedChangeIds: conflict.relatedChangeIds,
    });
  }
  return observations;
}

function isJsonValue(value: unknown): value is ConflictJsonValue {
  if (value === null) return true;
  if (
    typeof value === "string" || typeof value === "number" ||
    typeof value === "boolean"
  ) return true;
  if (Array.isArray(value)) return value.every(isJsonValue);
  if (typeof value !== "object") return false;
  return Object.values(value).every(isJsonValue);
}

function asRecord(
  value: ConflictJsonValue | undefined,
): ConflictJsonObject | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  return value as ConflictJsonObject;
}

function fieldIsAbsent(
  record: ConflictJsonObject | undefined,
  other: ConflictJsonObject | undefined,
  field: string,
): boolean {
  return record !== undefined && other !== undefined &&
    !Object.prototype.hasOwnProperty.call(record, field) &&
    Object.prototype.hasOwnProperty.call(other, field);
}

function mergeConflictCandidates(
  left: readonly ConflictCandidate[],
  right: readonly ConflictCandidate[],
): readonly ConflictCandidate[] {
  const candidates = new Map<string, ConflictCandidate>();
  for (const candidate of [...left, ...right]) {
    const existing = candidates.get(candidate.id);
    if (
      existing === undefined ||
      compareCodeUnits(canonicalValue(candidate), canonicalValue(existing)) < 0
    ) {
      candidates.set(candidate.id, clone(candidate));
    }
  }
  return [...candidates.values()].sort((a, b) => compareCodeUnits(a.id, b.id));
}

function chooseCanonicalRecord(
  left: ConflictJsonObject | undefined,
  right: ConflictJsonObject | undefined,
): ConflictJsonObject | undefined {
  if (left === undefined) return right === undefined ? undefined : clone(right);
  if (right === undefined) return clone(left);
  return canonicalValue(left) <= canonicalValue(right)
    ? clone(left)
    : clone(right);
}

export function mergeConflictGroups(
  left: ConflictGroup,
  right: ConflictGroup,
): ConflictGroup {
  const candidates = mergeConflictCandidates(left.candidates, right.candidates);
  return {
    id: left.id,
    recordType: left.recordType,
    recordId: left.recordId,
    field: left.field,
    kind: candidates.some((candidate) => candidate.deleted) &&
        candidates.some((candidate) => !candidate.deleted)
      ? "delete-versus-edit"
      : "same-field",
    candidates,
    parentRevisionIds: uniqueSorted([
      ...left.parentRevisionIds,
      ...right.parentRevisionIds,
      ...candidates.map((candidate) => candidate.revisionId),
    ]),
    sourceConflictIds: uniqueSorted([
      ...left.sourceConflictIds,
      ...right.sourceConflictIds,
    ]),
    ...(chooseCanonicalRecord(left.currentRecord, right.currentRecord) ===
        undefined
      ? {}
      : {
        currentRecord: chooseCanonicalRecord(
          left.currentRecord,
          right.currentRecord,
        ),
      }),
    ...(chooseCanonicalRecord(left.baseRecord, right.baseRecord) === undefined
      ? {}
      : {
        baseRecord: chooseCanonicalRecord(left.baseRecord, right.baseRecord),
      }),
  };
}

/**
 * Merge independent edits field-by-field and emit only genuine same-field or
 * delete-versus-edit groups. The local side remains the displayed working
 * record while no conflict is silently selected.
 */
export function mergeConcurrentRecords(
  input: ConcurrentRecordInput,
): ConflictMergeResult {
  const local = input.localRecord;
  const remote = input.remoteRecord;
  const base = input.baseRecord;
  if (equalValue(local, remote)) {
    return {
      mergedRecord: local === undefined ? undefined : clone(local),
      conflicts: [],
    };
  }
  if (local === undefined || remote === undefined) {
    const edited = local ?? remote;
    if (base === undefined) {
      return {
        mergedRecord: edited === undefined ? undefined : clone(edited),
        conflicts: [],
      };
    }
    if (equalValue(edited, base)) {
      return { mergedRecord: undefined, conflicts: [] };
    }
    const observation: ConflictObservation = {
      conflictId: input.conflictId ??
        `causal-${input.recordType}-${input.recordId}-__record`,
      recordType: input.recordType,
      recordId: input.recordId,
      field: "__record",
      ...(local === undefined ? {} : { local: local }),
      ...(remote === undefined ? {} : { remote: remote }),
      localDeleted: local === undefined,
      remoteDeleted: remote === undefined,
      ...(local === undefined ? {} : { localRecord: local }),
      ...(remote === undefined ? {} : { remoteRecord: remote }),
      ...(base === undefined ? {} : { baseRecord: base }),
      ...(input.localRevision === undefined
        ? {}
        : { localRevision: input.localRevision }),
      ...(input.remoteRevision === undefined
        ? {}
        : { remoteRevision: input.remoteRevision }),
      ...(input.relatedChangeIds === undefined
        ? {}
        : { relatedChangeIds: input.relatedChangeIds }),
      ...(input.recordedAt === undefined
        ? {}
        : { recordedAt: input.recordedAt }),
    };
    const group = groupFromObservation(observation, "__record");
    return {
      mergedRecord: local === undefined ? undefined : clone(local),
      conflicts: [group],
    };
  }

  const merged: Record<string, ConflictJsonValue> = clone(local);
  const conflicts: ConflictGroup[] = [];
  for (const field of fieldsForRecords(base, local, remote)) {
    const localValue = local[field];
    const remoteValue = remote[field];
    const baseValue = base?.[field];
    if (equalValue(localValue, remoteValue)) continue;
    if (equalValue(localValue, baseValue)) {
      if (remoteValue === undefined) delete merged[field];
      else merged[field] = clone(remoteValue);
      continue;
    }
    if (equalValue(remoteValue, baseValue)) continue;
    const observation = observationForField(
      input,
      field,
      localValue,
      remoteValue,
    );
    conflicts.push(groupFromObservation(observation, field));
  }
  const mergedRecord = merged as ConflictJsonObject;
  return {
    mergedRecord,
    conflicts: conflicts.map((conflict) => ({
      ...conflict,
      currentRecord: clone(mergedRecord),
    })),
  };
}

function schemaFor(recordType: ConflictRecordType) {
  switch (recordType) {
    case "project":
      return ProjectSchema;
    case "category":
      return CategorySchema;
    case "expense":
      return ExpenseSchema;
    case "receipt":
      return ReceiptParentSchema;
    case "receipt-line":
      return ReceiptLineSchema;
  }
}

function applyFieldValue(
  group: ConflictGroup,
  currentRecord: ConflictJsonObject,
  value: ConflictJsonValue,
): ConflictJsonObject {
  if (group.field === "__record") {
    const record = asRecord(value);
    if (record === undefined) {
      throw new Error("A record candidate is required for keep-edited.");
    }
    return clone(record);
  }
  const next: Record<string, ConflictJsonValue> = clone(currentRecord);
  if (value === null && OPTIONAL_FIELDS.has(group.field)) {
    delete next[group.field];
  } else {
    next[group.field] = clone(value);
  }
  return next;
}

function removeFieldValue(
  group: ConflictGroup,
  currentRecord: ConflictJsonObject,
): ConflictJsonObject {
  if (group.field === "__record") {
    throw new Error("A field is required for field deletion.");
  }
  const next: Record<string, ConflictJsonValue> = clone(currentRecord);
  delete next[group.field];
  return next;
}

function validateResolvedRecord(
  group: ConflictGroup,
  record: ConflictJsonObject,
): void {
  const parsed = schemaFor(group.recordType).safeParse(record);
  if (!parsed.success) throw new Error("The selected value is not valid.");
}

function chosenCandidate(
  group: ConflictGroup,
  request: ConflictResolutionRequest,
): ConflictCandidate {
  if (request.choice === "candidate") {
    const candidate = group.candidates.find((entry) =>
      entry.id === request.candidateId ||
      entry.revisionId === request.candidateId
    );
    if (candidate === undefined) throw new Error("Unknown conflict candidate.");
    return candidate;
  }
  if (request.choice === "keep-edited") {
    if (group.kind !== "delete-versus-edit") {
      throw new Error("Keep edited is only available for delete-versus-edit.");
    }
    const edited = group.candidates.filter((candidate) => !candidate.deleted);
    if (edited.length !== 1) {
      throw new Error("Choose an edited candidate explicitly.");
    }
    return edited[0];
  }
  throw new Error("A candidate is not selected.");
}

/** Create a resolution revision without consulting timestamps as a winner. */
export function resolveConflict(input: {
  readonly group: ConflictGroup;
  readonly request: ConflictResolutionRequest;
  readonly revisionId: string;
  readonly deviceId: string;
  readonly recordedAt: string;
  readonly currentRecord?: ConflictJsonObject;
}): ConflictResolutionResult {
  const { group, request } = input;
  const currentRecord = input.currentRecord ?? group.currentRecord;
  let deleted = false;
  let value: ConflictJsonValue | undefined;
  let record: ConflictJsonObject | undefined;
  if (request.choice === "delete") {
    if (group.field === "__record") {
      deleted = true;
    } else {
      if (currentRecord === undefined) {
        throw new Error("A complete record is required for field deletion.");
      }
      record = removeFieldValue(group, currentRecord);
      validateResolvedRecord(group, record);
    }
  } else if (request.choice === "custom") {
    if (currentRecord === undefined) {
      throw new Error("A complete record is required for a custom value.");
    }
    value = clone(request.value);
    record = applyFieldValue(group, currentRecord, request.value);
    validateResolvedRecord(group, record);
  } else {
    const candidate = chosenCandidate(group, request);
    const deletesRecord = candidate.deleted && group.field === "__record";
    deleted = deletesRecord;
    value = candidate.value === undefined ? undefined : clone(candidate.value);
    if (candidate.deleted && group.field !== "__record") {
      if (currentRecord === undefined) {
        throw new Error("A complete record is required for field deletion.");
      }
      record = removeFieldValue(group, currentRecord);
      validateResolvedRecord(group, record);
    } else if (!deleted) {
      if (group.field === "__record") {
        record = candidate.record ?? asRecord(candidate.value);
      } else if (currentRecord !== undefined && candidate.value !== undefined) {
        record = applyFieldValue(group, currentRecord, candidate.value);
      }
      if (record !== undefined) validateResolvedRecord(group, record);
      else throw new Error("A complete record is required for this candidate.");
    }
  }
  const revision: ConflictResolutionRecord["resolutionRevision"] = {
    type: "s403-conflict-resolution-revision",
    id: input.revisionId,
    recordType: group.recordType,
    recordId: group.recordId,
    field: group.field,
    parents: [...group.parentRevisionIds].sort(compareCodeUnits),
    deviceId: input.deviceId,
    recordedAt: input.recordedAt,
    choice: request.choice,
    ...(value === undefined ? {} : { value }),
    deleted,
    ...(record === undefined ? {} : { record }),
  };
  const tombstone = deleted
    ? {
      type: "s403-conflict-tombstone" as const,
      recordType: group.recordType,
      recordId: group.recordId,
      deletedAt: input.recordedAt,
      deletedBy: input.deviceId,
      resolutionRevisionId: input.revisionId,
      parentRevisionIds: [...group.parentRevisionIds].sort(compareCodeUnits),
    }
    : undefined;
  return {
    groupId: group.id,
    resolutionRevision: revision,
    ...(tombstone === undefined ? {} : { tombstone }),
    ...(record === undefined ? {} : { record }),
    alreadyResolved: false,
  };
}

function resolutionKey(resolution: ConflictResolutionRecord): string {
  return canonicalValue({
    choice: resolution.resolutionRevision.choice,
    value: resolution.resolutionRevision.value,
    deleted: resolution.resolutionRevision.deleted,
    record: resolution.resolutionRevision.record,
    id: resolution.resolutionRevision.id,
  });
}

export function chooseCanonicalResolution(
  left: ConflictResolutionRecord,
  right: ConflictResolutionRecord,
): ConflictResolutionRecord {
  return compareCodeUnits(resolutionKey(left), resolutionKey(right)) <= 0
    ? clone(left)
    : clone(right);
}

function groupIsResolved(
  group: ConflictGroup,
  resolution: ConflictResolutionRecord | undefined,
): boolean {
  if (resolution === undefined) return false;
  const parents = new Set(resolution.resolutionRevision.parents);
  return group.parentRevisionIds.every((parent) => parents.has(parent));
}

/** Merge durable conflict envelopes after a pull/resync deterministically. */
export function mergeConflictStates(
  left: ConflictState,
  right: ConflictState,
): ConflictState {
  const groups = new Map<string, ConflictGroup>();
  for (const group of [...left.groups, ...right.groups]) {
    const existing = groups.get(group.id);
    groups.set(
      group.id,
      existing === undefined
        ? clone(group)
        : mergeConflictGroups(existing, group),
    );
  }
  const resolutions = new Map<string, ConflictResolutionRecord>();
  for (const resolution of [...left.resolutions, ...right.resolutions]) {
    const existing = resolutions.get(resolution.groupId);
    resolutions.set(
      resolution.groupId,
      existing === undefined
        ? clone(resolution)
        : chooseCanonicalResolution(existing, resolution),
    );
  }
  const unresolved = [...groups.values()]
    .filter((group) => !groupIsResolved(group, resolutions.get(group.id)))
    .sort((a, b) => compareCodeUnits(a.id, b.id));
  const updatedAt = compareCodeUnits(
      left.progress.updatedAt,
      right.progress.updatedAt,
    ) >= 0
    ? left.progress.updatedAt
    : right.progress.updatedAt;
  return {
    type: "s403-conflict-state",
    version: 1,
    groups: unresolved,
    resolutions: [...resolutions.values()].sort((a, b) =>
      compareCodeUnits(a.groupId, b.groupId)
    ),
    progress: {
      phase: unresolved.length === 0 ? "resolved" : "reviewing",
      unresolvedCount: unresolved.length,
      completedCount: Math.max(
        left.progress.completedCount,
        right.progress.completedCount,
        resolutions.size,
      ),
      updatedAt,
    },
  };
}

/** Public conflict review projection: no record, device, or revision IDs. */
export function projectConflictState(
  state: ConflictState,
): ConflictStateProjection {
  const groups = [...state.groups].sort((a, b) => compareCodeUnits(a.id, b.id));
  return {
    groups: groups.map((group, groupIndex): ConflictGroupProjection => ({
      ordinal: groupIndex,
      recordType: group.recordType,
      field: group.field,
      kind: group.kind,
      candidates: group.candidates.map(
        (candidate, candidateIndex): ConflictCandidateProjection => ({
          ordinal: candidateIndex,
          ...(candidate.value === undefined ? {} : { value: candidate.value }),
          deleted: candidate.deleted,
          deviceLabel: candidate.deviceLabel,
          recordedAt: candidate.recordedAt,
        }),
      ),
      discardedEditedValues: group.candidates
        .filter((candidate) => !candidate.deleted)
        .map((candidate) => candidate.value)
        .filter((value): value is ConflictJsonValue => value !== undefined),
    })),
    unresolvedCount: state.groups.length,
    completedCount: state.progress.completedCount,
    phase: state.progress.phase,
  };
}
