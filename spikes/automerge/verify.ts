import * as Automerge from "automerge";
import { Repo } from "automerge-repo";
import { IndexedDBStorageAdapter } from "automerge-idb";
import { IDBKeyRange, indexedDB } from "fake-indexeddb";

Object.assign(globalThis, { IDBKeyRange, indexedDB });

const AUTOMERGE_VERSION = "3.4.1";
const REPO_VERSION = "2.6.0-alpha.3";
const INDEXEDDB_VERSION = "2.6.0-alpha.3";
const DATABASE_NAME = "did-it-become-what-you-like-f002-proof";
const GENERATION = "generation-1";
const INITIAL_RECORD_ID = "expense-001";
const BASE_ACTOR = "00000000000000000000000000000001";
const DEVICE_A_ACTOR = "0000000000000000000000000000000a";
const DEVICE_B_ACTOR = "0000000000000000000000000000000b";
const DEVICE_C_ACTOR = "0000000000000000000000000000000c";
const RESTORE_ACTOR = "0000000000000000000000000000000d";

type OperationKind = "create" | "edit" | "delete" | "resolve";
type ResolutionOutcome = "keep" | "delete" | "none";

interface RecordValue {
  id: string;
  generation: string;
  amount: string;
  currency: string;
  categoryId: string;
  description: string;
  deleted: boolean;
  tombstoneOpId: string;
}

interface Operation {
  opId: string;
  recordId: string;
  actor: string;
  kind: OperationKind;
  field: string;
  value: string;
  outcome: ResolutionOutcome;
  resolutionParents: string[];
  parents: string[];
  baseHeads: string[];
  record: RecordValue | null;
}

interface SyncDocument {
  generation: string;
  records: Record<string, RecordValue>;
  ops: Record<string, Operation>;
}

interface OperationInput {
  opId: string;
  recordId: string;
  actor: string;
  kind: OperationKind;
  field: string;
  value: string;
  outcome: ResolutionOutcome;
  resolutionParents: string[];
  record: RecordValue | null;
}

interface DetectedConflict {
  recordId: string;
  left: Operation;
  right: Operation;
  reason: "same-field" | "delete-versus-edit";
}

interface RetirementMarker {
  markerId: string;
  generation: string;
}

interface DeviceState {
  generation: string;
  retired: boolean;
  doc: Automerge.Doc<SyncDocument> | null;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (stableStringify(actual) !== stableStringify(expected)) {
    throw new Error(
      `${message}\nexpected: ${stableStringify(expected)}\nactual: ${
        stableStringify(actual)
      }`,
    );
  }
}

function cloneBytes(bytes: Uint8Array): Uint8Array {
  return new Uint8Array(bytes);
}

function canonicalDecimal(value: string): string {
  if (!/^-?\d+(?:\.\d+)?$/.test(value)) {
    throw new Error(`not a canonicalizable decimal: ${value}`);
  }

  const negative = value.startsWith("-");
  const unsigned = negative ? value.slice(1) : value;
  const [wholePart, fractionPart = ""] = unsigned.split(".");
  const whole = wholePart.replace(/^0+(?=\d)/, "");
  const fraction = fractionPart.replace(/0+$/, "");
  const magnitude = fraction.length > 0 ? `${whole}.${fraction}` : whole;
  return magnitude === "0" ? "0" : negative ? `-${magnitude}` : magnitude;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === "object") {
    const object = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(object)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalize(entry)]),
    );
  }
  return value;
}

function stableStringify(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function record(
  id: string,
  amount: string,
  description: string,
  categoryId = "uncategorized",
): RecordValue {
  return {
    id,
    generation: GENERATION,
    amount: canonicalDecimal(amount),
    currency: "SEK",
    categoryId,
    description,
    deleted: false,
    tombstoneOpId: "",
  };
}

function initialDocumentData(): SyncDocument {
  return {
    generation: GENERATION,
    records: {
      [INITIAL_RECORD_ID]: record(INITIAL_RECORD_ID, "-10.90", "Coffee"),
    },
    ops: {},
  };
}

function baseDocument(): Automerge.Doc<SyncDocument> {
  let doc = Automerge.init<SyncDocument>({ actor: BASE_ACTOR });
  doc = Automerge.change(doc, {
    message: "initialize synthetic dataset",
    time: 0,
  }, (draft) => {
    draft.generation = GENERATION;
    draft.records = {
      [INITIAL_RECORD_ID]: record(INITIAL_RECORD_ID, "-10.90", "Coffee"),
    };
    draft.ops = {};
  });
  return doc;
}

function branch(
  doc: Automerge.Doc<SyncDocument>,
  actor: string,
): Automerge.Doc<SyncDocument> {
  return Automerge.clone(doc, { actor });
}

function applyOperation(
  doc: Automerge.Doc<SyncDocument>,
  input: OperationInput,
): Automerge.Doc<SyncDocument> {
  const operation: Operation = {
    ...input,
    parents: Object.keys(doc.ops).sort(),
    baseHeads: [...Automerge.getHeads(doc)].sort(),
  };

  return Automerge.change(
    doc,
    { message: `operation:${input.opId}`, time: 0 },
    (draft) => {
      draft.ops[input.opId] = operation;

      if (input.kind === "create") {
        if (input.record === null) {
          throw new Error(
            "create operation needs a record",
          );
        }
        draft.records[input.recordId] = input.record;
        return;
      }

      const target = draft.records[input.recordId];
      if (target === undefined) return;

      if (input.kind === "edit" && input.field.length > 0) {
        if (input.field === "amount") {
          target.amount = canonicalDecimal(
            input.value,
          );
        } else if (input.field === "description") {
          target.description = input.value;
        } else if (input.field === "categoryId") {
          target
            .categoryId = input.value;
        }
        return;
      }

      if (input.kind === "delete") {
        target.deleted = true;
        target.tombstoneOpId = input.opId;
        return;
      }

      if (input.kind === "resolve") {
        if (input.field.length > 0) {
          if (input.field === "amount") {
            target.amount = canonicalDecimal(input.value);
          } else if (input.field === "description") {
            target.description = input.value;
          } else if (input.field === "categoryId") {
            target.categoryId = input.value;
          }
        }
        target.deleted = input.outcome === "delete";
        target.tombstoneOpId = input.outcome === "delete" ? input.opId : "";
      }
    },
  );
}

function operationIsAncestor(
  ancestorId: string,
  descendant: Operation,
  operations: Map<string, Operation>,
): boolean {
  const pending = [...descendant.parents];
  const visited = new Set<string>();
  while (pending.length > 0) {
    const currentId = pending.pop();
    if (currentId === undefined || visited.has(currentId)) continue;
    if (currentId === ancestorId) return true;
    visited.add(currentId);
    const current = operations.get(currentId);
    if (current !== undefined) pending.push(...current.parents);
  }
  return false;
}

function unresolvedConflicts(
  doc: Automerge.Doc<SyncDocument>,
): DetectedConflict[] {
  const operations = new Map(Object.entries(doc.ops));
  const values = [...operations.values()].sort((left, right) =>
    left.opId.localeCompare(right.opId)
  );
  const resolutions = values.filter((operation) =>
    operation.kind === "resolve"
  );
  const conflicts: DetectedConflict[] = [];

  const resolved = (left: Operation, right: Operation): boolean =>
    resolutions.some((resolution) =>
      resolution.resolutionParents.includes(left.opId) &&
      resolution.resolutionParents.includes(right.opId)
    );

  for (let index = 0; index < values.length; index += 1) {
    for (
      let otherIndex = index + 1;
      otherIndex < values.length;
      otherIndex += 1
    ) {
      const left = values[index];
      const right = values[otherIndex];
      if (left.kind === "resolve" || right.kind === "resolve") continue;
      if (left.recordId !== right.recordId || resolved(left, right)) continue;
      if (
        operationIsAncestor(left.opId, right, operations) ||
        operationIsAncestor(right.opId, left, operations)
      ) {
        continue;
      }

      const sameField = left.kind === "edit" && right.kind === "edit" &&
        left.field === right.field && left.value !== right.value;
      const deleteVersusEdit =
        (left.kind === "delete" && right.kind === "edit") ||
        (right.kind === "delete" && left.kind === "edit");
      if (sameField || deleteVersusEdit) {
        conflicts.push({
          recordId: left.recordId,
          left,
          right,
          reason: sameField ? "same-field" : "delete-versus-edit",
        });
      }
    }
  }
  return conflicts;
}

interface ExportProjection {
  schemaVersion: 1;
  generation: string;
  records: Record<string, RecordValue>;
}

function exportProjection(doc: Automerge.Doc<SyncDocument>): ExportProjection {
  const records = Object.fromEntries(
    Object.entries(doc.records)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([id, value]) => [id, { ...value }]),
  );
  return { schemaVersion: 1, generation: doc.generation, records };
}

function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

function shuffled<T>(items: readonly T[], seed: number): T[] {
  const result = [...items];
  const nextRandom = random(seed);
  for (let index = result.length - 1; index > 0; index -= 1) {
    const otherIndex = Math.floor(nextRandom() * (index + 1));
    [result[index], result[otherIndex]] = [result[otherIndex], result[index]];
  }
  return result;
}

function replayChanges(
  base: Automerge.Doc<SyncDocument>,
  changes: readonly Automerge.Change[],
  seed: number,
): Automerge.Doc<SyncDocument> {
  let doc = Automerge.clone(base, { actor: RESTORE_ACTOR });
  for (const change of shuffled(changes, seed)) {
    [doc] = Automerge.applyChanges(doc, [change]);
  }
  return doc;
}

function changedFields(
  base: Automerge.Doc<SyncDocument>,
  doc: Automerge.Doc<SyncDocument>,
): Automerge.Change[] {
  return Automerge.getChanges(base, doc);
}

class FakeDrive {
  private readonly bundles = new Map<string, Uint8Array>();
  private readonly changes = new Map<string, Uint8Array[]>();
  private retirement: RetirementMarker | null = null;

  uploadBundle(generation: string, binary: Uint8Array): void {
    this.assertWritable(generation);
    this.bundles.set(generation, cloneBytes(binary));
  }

  downloadBundle(generation: string): Uint8Array {
    const binary = this.bundles.get(generation);
    if (binary === undefined) {
      throw new Error(`missing fake Drive bundle ${generation}`);
    }
    return cloneBytes(binary);
  }

  appendChanges(
    generation: string,
    changes: readonly Automerge.Change[],
  ): void {
    this.assertWritable(generation);
    const existing = this.changes.get(generation) ?? [];
    existing.push(...changes.map(cloneBytes));
    this.changes.set(generation, existing);
  }

  downloadChanges(generation: string): Uint8Array[] {
    return (this.changes.get(generation) ?? []).map(cloneBytes);
  }

  publishRetirement(marker: RetirementMarker): void {
    this.retirement = { ...marker };
  }

  readRetirement(): RetirementMarker | null {
    return this.retirement === null ? null : { ...this.retirement };
  }

  private assertWritable(generation: string): void {
    if (this.retirement?.generation === generation) {
      throw new Error(`generation ${generation} is retired`);
    }
  }
}

async function guardAndUpload(
  device: DeviceState,
  drive: FakeDrive,
): Promise<"retired" | "uploaded"> {
  const marker = await drive.readRetirement();
  if (marker?.generation === device.generation) {
    device.retired = true;
    device.doc = null;
    return "retired";
  }
  if (device.doc === null) throw new Error("device has no local document");
  await drive.uploadBundle(device.generation, Automerge.save(device.doc));
  return "uploaded";
}

function deleteDatabase(name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onerror = () =>
      reject(request.error ?? new Error(`failed to delete ${name}`));
  });
}

function testStableIdsAndDecimalStrings(): void {
  const doc = baseDocument();
  const saved = doc.records[INITIAL_RECORD_ID];
  assert(saved !== undefined, "initial stable record is present");
  assert(
    saved.id === INITIAL_RECORD_ID,
    "record identity is an immutable stable ID",
  );
  assert(
    typeof saved.amount === "string",
    "amount is persisted as a decimal string",
  );
  assert(
    saved.amount === "-10.9",
    "decimal strings normalize redundant zeroes",
  );
  assert(
    canonicalDecimal("0001.2500") === "1.25",
    "decimal normalization is deterministic",
  );
  assert(canonicalDecimal("-0.00") === "0", "negative zero is normalized");
  let rejected = false;
  try {
    canonicalDecimal("1e3");
  } catch {
    rejected = true;
  }
  assert(rejected, "exponential Number-like input is rejected");
}

function testConcurrentIndependentEdits(): void {
  const base = baseDocument();
  const deviceA = applyOperation(branch(base, DEVICE_A_ACTOR), {
    opId: "a-description",
    recordId: INITIAL_RECORD_ID,
    actor: DEVICE_A_ACTOR,
    kind: "edit",
    field: "description",
    value: "Coffee at branch A",
    outcome: "none",
    resolutionParents: [],
    record: null,
  });
  const deviceB = applyOperation(branch(base, DEVICE_B_ACTOR), {
    opId: "b-category",
    recordId: INITIAL_RECORD_ID,
    actor: DEVICE_B_ACTOR,
    kind: "edit",
    field: "categoryId",
    value: "transport",
    outcome: "none",
    resolutionParents: [],
    record: null,
  });
  const merged = Automerge.merge(deviceA, deviceB);
  const mergedRecord = merged.records[INITIAL_RECORD_ID];
  assert(mergedRecord !== undefined, "merged record remains present");
  assert(
    mergedRecord.description === "Coffee at branch A",
    "independent description edit survives",
  );
  assert(
    mergedRecord.categoryId === "transport",
    "independent category edit survives",
  );
  assert(
    unresolvedConflicts(merged).length === 0,
    "independent fields do not need resolution",
  );
}

function testSameFieldConflicts(): void {
  const base = baseDocument();
  const deviceA = applyOperation(branch(base, DEVICE_A_ACTOR), {
    opId: "a-category",
    recordId: INITIAL_RECORD_ID,
    actor: DEVICE_A_ACTOR,
    kind: "edit",
    field: "categoryId",
    value: "groceries",
    outcome: "none",
    resolutionParents: [],
    record: null,
  });
  const deviceB = applyOperation(branch(base, DEVICE_B_ACTOR), {
    opId: "b-category",
    recordId: INITIAL_RECORD_ID,
    actor: DEVICE_B_ACTOR,
    kind: "edit",
    field: "categoryId",
    value: "household",
    outcome: "none",
    resolutionParents: [],
    record: null,
  });
  const merged = Automerge.merge(deviceA, deviceB);
  const conflicts = Automerge.getConflicts(
    merged.records[INITIAL_RECORD_ID],
    "categoryId",
  );
  assert(conflicts !== undefined, "Automerge exposes same-field candidates");
  assert(
    Object.values(conflicts).includes("groceries"),
    "candidate A remains inspectable",
  );
  assert(
    Object.values(conflicts).includes("household"),
    "candidate B remains inspectable",
  );
  const detected = unresolvedConflicts(merged);
  assert(
    detected.length === 1 && detected[0].reason === "same-field",
    "application conflict grouping is deterministic",
  );
}

function testTombstones(): void {
  const base = baseDocument();
  const deleted = applyOperation(branch(base, DEVICE_A_ACTOR), {
    opId: "a-delete",
    recordId: INITIAL_RECORD_ID,
    actor: DEVICE_A_ACTOR,
    kind: "delete",
    field: "",
    value: "",
    outcome: "none",
    resolutionParents: [],
    record: null,
  });
  const merged = Automerge.merge(base, deleted);
  const deletedRecord = merged.records[INITIAL_RECORD_ID];
  assert(
    deletedRecord !== undefined && deletedRecord.deleted,
    "logical deletion keeps a synchronized tombstone",
  );
  assert(
    deletedRecord.tombstoneOpId === "a-delete",
    "tombstone retains its causal operation ID",
  );
  assert(
    Object.keys(exportProjection(merged).records).includes(INITIAL_RECORD_ID),
    "export retains tombstone state",
  );
}

function testDeleteVersusEdit(): void {
  const base = baseDocument();
  const deleteBranch = applyOperation(branch(base, DEVICE_A_ACTOR), {
    opId: "a-delete-v-edit",
    recordId: INITIAL_RECORD_ID,
    actor: DEVICE_A_ACTOR,
    kind: "delete",
    field: "",
    value: "",
    outcome: "none",
    resolutionParents: [],
    record: null,
  });
  const editBranch = applyOperation(branch(base, DEVICE_B_ACTOR), {
    opId: "b-edit-v-delete",
    recordId: INITIAL_RECORD_ID,
    actor: DEVICE_B_ACTOR,
    kind: "edit",
    field: "amount",
    value: "-11.25",
    outcome: "none",
    resolutionParents: [],
    record: null,
  });
  const merged = Automerge.merge(deleteBranch, editBranch);
  const mergedRecord = merged.records[INITIAL_RECORD_ID];
  assert(
    mergedRecord.deleted && mergedRecord.amount === "-11.25",
    "Automerge preserves tombstone and concurrent edit data",
  );
  assert(
    Automerge.getConflicts(mergedRecord, "deleted") === undefined,
    "delete-versus-edit is not a native same-field conflict",
  );
  const conflicts = unresolvedConflicts(merged);
  assert(
    conflicts.length === 1 && conflicts[0].reason === "delete-versus-edit",
    "causal operation metadata detects delete-versus-edit",
  );
}

function testResolutionRevision(): void {
  const base = baseDocument();
  const deleted = applyOperation(branch(base, DEVICE_A_ACTOR), {
    opId: "a-resolution-delete",
    recordId: INITIAL_RECORD_ID,
    actor: DEVICE_A_ACTOR,
    kind: "delete",
    field: "",
    value: "",
    outcome: "none",
    resolutionParents: [],
    record: null,
  });
  const edited = applyOperation(branch(base, DEVICE_B_ACTOR), {
    opId: "b-resolution-edit",
    recordId: INITIAL_RECORD_ID,
    actor: DEVICE_B_ACTOR,
    kind: "edit",
    field: "amount",
    value: "-12.00",
    outcome: "none",
    resolutionParents: [],
    record: null,
  });
  const conflictDoc = Automerge.merge(deleted, edited);
  const resolution = applyOperation(conflictDoc, {
    opId: "resolution-keep-edit",
    recordId: INITIAL_RECORD_ID,
    actor: DEVICE_C_ACTOR,
    kind: "resolve",
    field: "amount",
    value: "-12",
    outcome: "keep",
    resolutionParents: ["a-resolution-delete", "b-resolution-edit"],
    record: null,
  });
  const resolvedRecord = resolution.records[INITIAL_RECORD_ID];
  assert(
    resolvedRecord !== undefined && !resolvedRecord.deleted,
    "keep resolution restores the edited record",
  );
  assert(
    resolvedRecord.amount === "-12",
    "resolution writes the chosen canonical value",
  );
  assert(
    unresolvedConflicts(resolution).length === 0,
    "resolved candidates no longer appear as unresolved",
  );
  const resolutionOp = resolution.ops["resolution-keep-edit"];
  assert(
    resolutionOp !== undefined,
    "resolution is a durable Automerge revision",
  );
  assertEqual(
    resolutionOp.resolutionParents,
    ["a-resolution-delete", "b-resolution-edit"],
    "resolution references every conflicting parent",
  );
  assert(
    Automerge.getChanges(conflictDoc, resolution).length > 0,
    "resolution advances revision history",
  );
}

async function testTwoDeviceConvergenceAndOfflineReplay(
  seed: number,
): Promise<void> {
  const base = baseDocument();
  const deviceA = applyOperation(branch(base, DEVICE_A_ACTOR), {
    opId: "a-offline-description",
    recordId: INITIAL_RECORD_ID,
    actor: DEVICE_A_ACTOR,
    kind: "edit",
    field: "description",
    value: "offline A",
    outcome: "none",
    resolutionParents: [],
    record: null,
  });
  const deviceB = applyOperation(branch(base, DEVICE_B_ACTOR), {
    opId: "b-offline-category",
    recordId: INITIAL_RECORD_ID,
    actor: DEVICE_B_ACTOR,
    kind: "edit",
    field: "categoryId",
    value: "travel",
    outcome: "none",
    resolutionParents: [],
    record: null,
  });
  const mergedAThenB = Automerge.merge(deviceA, deviceB);
  const mergedBThenA = Automerge.merge(deviceB, deviceA);
  assertEqual(
    exportProjection(mergedAThenB),
    exportProjection(mergedBThenA),
    "two-device projections converge",
  );
  assertEqual(
    [...Automerge.getHeads(mergedAThenB)].sort(),
    [...Automerge.getHeads(mergedBThenA)].sort(),
    "two-device causal heads converge",
  );

  const drive = new FakeDrive();
  await drive.appendChanges(GENERATION, changedFields(base, deviceA));
  await drive.appendChanges(GENERATION, changedFields(base, deviceB));
  const replay = replayChanges(
    base,
    await drive.downloadChanges(GENERATION),
    seed,
  );
  assertEqual(
    exportProjection(replay),
    exportProjection(mergedAThenB),
    "offline changes replay after reconnect",
  );
}

async function testExportProjectionAndFakeDrive(): Promise<void> {
  const base = baseDocument();
  const changed = applyOperation(branch(base, DEVICE_A_ACTOR), {
    opId: "export-edit",
    recordId: INITIAL_RECORD_ID,
    actor: DEVICE_A_ACTOR,
    kind: "edit",
    field: "amount",
    value: "-99.90",
    outcome: "none",
    resolutionParents: [],
    record: null,
  });
  const projection = exportProjection(changed);
  assert(
    projection.schemaVersion === 1,
    "export has an explicit schema version",
  );
  assert(
    !stableStringify(projection).includes("export-edit"),
    "export projection excludes CRDT operation metadata",
  );
  assert(
    stableStringify(projection).includes('"amount":"-99.9"'),
    "export preserves canonical decimal strings",
  );

  const drive = new FakeDrive();
  await drive.uploadBundle(GENERATION, Automerge.save(changed));
  const restored = Automerge.load<SyncDocument>(
    await drive.downloadBundle(GENERATION),
    { actor: RESTORE_ACTOR },
  );
  assertEqual(
    exportProjection(restored),
    projection,
    "fake Drive binary round trip restores the projection",
  );
}

async function testGenerationRetirementPreventsResurrection(): Promise<void> {
  const base = baseDocument();
  const oldDevice: DeviceState = {
    generation: GENERATION,
    retired: false,
    doc: applyOperation(branch(base, DEVICE_B_ACTOR), {
      opId: "old-device-edit",
      recordId: INITIAL_RECORD_ID,
      actor: DEVICE_B_ACTOR,
      kind: "edit",
      field: "description",
      value: "must not resurrect",
      outcome: "none",
      resolutionParents: [],
      record: null,
    }),
  };
  const drive = new FakeDrive();
  await drive.uploadBundle(GENERATION, Automerge.save(base));
  const marker: RetirementMarker = {
    markerId: "retirement-001",
    generation: GENERATION,
  };
  await drive.publishRetirement(marker);
  const markerText = stableStringify(marker);
  assert(
    !markerText.includes(INITIAL_RECORD_ID) && !markerText.includes("-10.9"),
    "retirement marker contains no financial payload",
  );
  assertEqual(
    await guardAndUpload(oldDevice, drive),
    "retired",
    "old device observes retirement before upload",
  );
  assert(
    oldDevice.retired && oldDevice.doc === null,
    "retired device erases its local generation before stopping",
  );
  let attemptedResurrectionFailed = false;
  try {
    await drive.uploadBundle(GENERATION, Automerge.save(base));
  } catch {
    attemptedResurrectionFailed = true;
  }
  assert(
    attemptedResurrectionFailed,
    "fake Drive rejects uploads for a retired generation",
  );
}

async function testIndexedDbRestart(): Promise<void> {
  await deleteDatabase(DATABASE_NAME);
  const repo = new Repo({
    network: [],
    storage: new IndexedDBStorageAdapter(DATABASE_NAME),
  });
  const handle = repo.create<SyncDocument>(initialDocumentData());
  handle.change((draft) => {
    const target = draft.records[INITIAL_RECORD_ID];
    if (target === undefined) throw new Error("restart fixture record missing");
    target.description = "survives restart";
  });
  await repo.flush([handle.documentId]);

  const databases = await indexedDB.databases();
  assert(
    databases.some((database) => database.name === DATABASE_NAME),
    "IndexedDB database is repository-namespaced",
  );

  const restartedRepo = new Repo({
    network: [],
    storage: new IndexedDBStorageAdapter(DATABASE_NAME),
  });
  const restoredHandle = await restartedRepo.find<SyncDocument>(handle.url);
  const restored = restoredHandle.doc();
  assert(
    restored !== undefined,
    "restart loads a ready document from IndexedDB",
  );
  assert(
    restored.records[INITIAL_RECORD_ID]?.description === "survives restart",
    "restart restores persisted changes",
  );
  await repo.shutdown();
  await restartedRepo.shutdown();
  await deleteDatabase(DATABASE_NAME);
}

function testRandomizedOperationOrdering(
  seed: number,
  rounds: number,
): void {
  for (let round = 0; round < rounds; round += 1) {
    const base = baseDocument();
    const suffix = `${seed}-${round}`;
    let deviceA = applyOperation(branch(base, DEVICE_A_ACTOR), {
      opId: `a-${suffix}-amount`,
      recordId: INITIAL_RECORD_ID,
      actor: DEVICE_A_ACTOR,
      kind: "edit",
      field: "amount",
      value: "-11.10",
      outcome: "none",
      resolutionParents: [],
      record: null,
    });
    deviceA = applyOperation(deviceA, {
      opId: `a-${suffix}-description`,
      recordId: INITIAL_RECORD_ID,
      actor: DEVICE_A_ACTOR,
      kind: "edit",
      field: "description",
      value: `A-${round}`,
      outcome: "none",
      resolutionParents: [],
      record: null,
    });
    const deviceB = applyOperation(branch(base, DEVICE_B_ACTOR), {
      opId: `b-${suffix}-category`,
      recordId: INITIAL_RECORD_ID,
      actor: DEVICE_B_ACTOR,
      kind: "edit",
      field: "categoryId",
      value: `category-${round}`,
      outcome: "none",
      resolutionParents: [],
      record: null,
    });
    const deviceC = applyOperation(branch(base, DEVICE_C_ACTOR), {
      opId: `c-${suffix}-amount`,
      recordId: INITIAL_RECORD_ID,
      actor: DEVICE_C_ACTOR,
      kind: "edit",
      field: "amount",
      value: "-12.20",
      outcome: "none",
      resolutionParents: [],
      record: null,
    });
    const expected = Automerge.merge(
      Automerge.merge(deviceA, deviceB),
      deviceC,
    );
    const allChanges = [
      ...changedFields(base, deviceA),
      ...changedFields(base, deviceB),
      ...changedFields(base, deviceC),
    ];
    const replay = replayChanges(base, allChanges, seed + round * 17);
    assertEqual(
      exportProjection(replay),
      exportProjection(expected),
      `randomized round ${round} converges`,
    );
    assertEqual(
      [...Automerge.getHeads(replay)].sort(),
      [...Automerge.getHeads(expected)].sort(),
      `randomized round ${round} preserves causal heads`,
    );
  }
}

async function testBrowserBundle(): Promise<void> {
  const spikeDirectory = new URL(".", import.meta.url).pathname;
  const repositoryRoot = new URL("../../", import.meta.url).pathname;
  const outputDirectory = await Deno.makeTempDir({
    prefix: "f002-automerge-bundle-",
  });
  const outputFile = `${outputDirectory}/browser.js`;
  try {
    const command = new Deno.Command(Deno.execPath(), {
      args: [
        "bundle",
        "--config",
        `${spikeDirectory}browser-deno.json`,
        "--platform",
        "browser",
        "--no-check",
        "--output",
        outputFile,
        `${spikeDirectory}browser-fixture.ts`,
      ],
      cwd: repositoryRoot,
      stdout: "piped",
      stderr: "piped",
    });
    const result = await command.output();
    const stderr = new TextDecoder().decode(result.stderr);
    assert(result.success, `browser bundle failed: ${stderr}`);
    const bundle = await Deno.readTextFile(outputFile);
    assert(bundle.length > 0, "browser bundle is non-empty");
  } finally {
    await Deno.remove(outputDirectory, { recursive: true });
  }
}

function argument(name: string, fallback: number): number {
  const prefix = `--${name}=`;
  const value = Deno.args.find((argumentValue) =>
    argumentValue.startsWith(prefix)
  );
  if (value === undefined) return fallback;
  const parsed = Number(value.slice(prefix.length));
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`invalid ${name}: ${value}`);
  }
  return parsed;
}

async function run(): Promise<void> {
  const seed = argument("seed", 20260823);
  const rounds = argument("rounds", 32);
  console.log(`F-002 Automerge ${AUTOMERGE_VERSION} / Repo ${REPO_VERSION}`);
  console.log(
    `IndexedDB adapter ${INDEXEDDB_VERSION}; randomized seed ${seed}; rounds ${rounds}`,
  );

  const tests: Array<[string, () => void | Promise<void>]> = [
    ["stable IDs and decimal strings", testStableIdsAndDecimalStrings],
    ["concurrent independent edits", testConcurrentIndependentEdits],
    ["same-field conflicts", testSameFieldConflicts],
    ["tombstones", testTombstones],
    ["delete-versus-edit", testDeleteVersusEdit],
    ["resolution revisions", testResolutionRevision],
    [
      "two-device convergence and offline replay",
      () => testTwoDeviceConvergenceAndOfflineReplay(seed),
    ],
    [
      "export projection and fake Drive round trip",
      testExportProjectionAndFakeDrive,
    ],
    [
      "generation retirement prevents resurrection",
      testGenerationRetirementPreventsResurrection,
    ],
    ["IndexedDB persistence and restart", testIndexedDbRestart],
    ["browser bundle", testBrowserBundle],
    [
      "randomized operation ordering",
      () => testRandomizedOperationOrdering(seed, rounds),
    ],
  ];

  let failures = 0;
  for (const [name, test] of tests) {
    try {
      await test();
      console.log(`PASS ${name}`);
    } catch (error) {
      failures += 1;
      console.error(
        `FAIL ${name}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
  if (failures > 0) throw new Error(`${failures} compatibility checks failed`);
  console.log(`PASS all ${tests.length} compatibility checks`);
}

if (import.meta.main) await run();
