import {
  adapterError,
  type CausalApplyResult,
  type CausalChange,
  type CausalSnapshot,
  type CausalSyncPort,
  cloneJson,
  type DriveFile,
  type DriveTransportPort,
  type JsonValue,
  type LocalPort,
  type OperationOptions,
} from "../ports/index.ts";
import {
  CURRENT_SCHEMA_VERSION,
  DATASET_FORMAT,
  exportDataset,
  parseCurrentDataset,
  type PortableDataset,
  type StableId,
  StableIdSchema,
  UNCATEGORIZED_CATEGORY_ID,
} from "../../domain/index.ts";

export const CAUSAL_SYNC_SCHEMA_VERSION = 1 as const;
export const CAUSAL_SYNC_FILE_NAME = "__did-it-become-what-you-like.sync.json";

const EMPTY_DATASET = {
  schemaVersion: CURRENT_SCHEMA_VERSION,
  format: DATASET_FORMAT,
  projects: [],
  categories: [{
    schemaVersion: CURRENT_SCHEMA_VERSION,
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
    schemaVersion: CURRENT_SCHEMA_VERSION,
    type: "portable-settings",
    id: "settings-portable",
    expenseDayBoundary: "03:00",
  },
} satisfies PortableDataset;

export type CausalDatasetPayload = {
  readonly type: "causal-dataset";
  readonly schemaVersion: typeof CAUSAL_SYNC_SCHEMA_VERSION;
  readonly dataset: PortableDataset;
  readonly fingerprint: string;
};

export type CausalConflict = {
  readonly conflict: {
    readonly id: StableId;
    readonly recordType: string;
    readonly recordId: StableId;
    readonly local: JsonValue;
    readonly remote: JsonValue;
    readonly relatedChangeIds: readonly StableId[];
  };
  readonly field: string;
};

export type CausalMergeResult = {
  readonly snapshot: CausalSnapshot;
  readonly appliedChangeIds: readonly StableId[];
  readonly conflicts: readonly CausalConflict["conflict"][];
};

export type RetirementReader = {
  readonly readRetirementMarker: (
    options?: OperationOptions,
  ) => Promise<unknown | undefined>;
};

export type DriveCausalSyncOptions = {
  readonly drive: DriveTransportPort & RetirementReader;
  readonly fileName?: string;
  readonly initialSnapshot?: CausalSnapshot;
};

export type InMemoryCausalSyncOptions = {
  readonly initialSnapshot?: CausalSnapshot;
  readonly beforeOperation?: (
    operation: "read" | "apply",
    options?: OperationOptions,
  ) => Promise<void>;
};

type JsonRecord = { readonly [key: string]: JsonValue };

type CausalEnvelope = {
  readonly schemaVersion: typeof CAUSAL_SYNC_SCHEMA_VERSION;
  readonly type: "causal-sync-envelope";
  readonly snapshot: CausalSnapshot;
};

function asJsonValue(value: unknown): JsonValue {
  return value as JsonValue;
}

function asJsonRecord(value: unknown): JsonRecord | undefined {
  return value !== null && typeof value === "object" &&
      !Array.isArray(value)
    ? value as JsonRecord
    : undefined;
}

function equalJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function compareCodeUnits(left: string, right: string): number {
  const length = Math.min(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const difference = left.charCodeAt(index) - right.charCodeAt(index);
    if (difference !== 0) return difference;
  }
  return left.length - right.length;
}

function safeId(value: unknown, operation: string): StableId {
  try {
    return StableIdSchema.parse(value);
  } catch {
    throw adapterError("corrupt-data", operation);
  }
}

function cloneSnapshot(snapshot: CausalSnapshot): CausalSnapshot {
  return structuredClone(snapshot);
}

export function emptyPortableDataset(): PortableDataset {
  return structuredClone(EMPTY_DATASET);
}

export function datasetFingerprint(dataset: PortableDataset): string {
  try {
    return exportDataset(dataset);
  } catch {
    return JSON.stringify(dataset);
  }
}

function recordKey(value: unknown): string | undefined {
  const object = asJsonRecord(value);
  if (typeof object?.type !== "string" || typeof object.id !== "string") {
    return undefined;
  }
  return `${object.type}:${object.id}`;
}

function datasetValues(dataset: PortableDataset): readonly JsonValue[] {
  return [
    ...dataset.projects,
    ...dataset.categories,
    ...dataset.expenses,
    ...dataset.receipts,
    ...dataset.receiptPurchaseLines,
    ...dataset.receiptAdjustments,
    ...dataset.devices,
    ...dataset.tombstones,
    ...dataset.retirementMarkers,
    ...dataset.revisions,
    dataset.settings,
  ] as readonly JsonValue[];
}

export function datasetFromEntries(
  entries: readonly { readonly key: string; readonly value: JsonValue }[],
): PortableDataset {
  const values = entries.map((entry) => entry.value);
  const grouped: Record<string, JsonValue[]> = {
    projects: [],
    categories: [],
    expenses: [],
    receipts: [],
    receiptPurchaseLines: [],
    receiptAdjustments: [],
    devices: [],
    tombstones: [],
    retirementMarkers: [],
    revisions: [],
  };
  let settings: JsonValue | undefined;
  for (const value of values) {
    const object = asJsonRecord(value);
    const type = object?.type;
    if (type === "portable-settings") {
      settings = value;
      continue;
    }
    const group = type === "project"
      ? "projects"
      : type === "category"
      ? "categories"
      : type === "expense"
      ? "expenses"
      : type === "receipt"
      ? "receipts"
      : type === "receipt-purchase-line"
      ? "receiptPurchaseLines"
      : type === "receipt-adjustment"
      ? "receiptAdjustments"
      : type === "device"
      ? "devices"
      : type === "tombstone"
      ? "tombstones"
      : type === "retirement-marker"
      ? "retirementMarkers"
      : type === "revision"
      ? "revisions"
      : undefined;
    if (group !== undefined) grouped[group].push(value);
  }
  if (
    !grouped.categories.some((value) =>
      asJsonRecord(value)?.id === UNCATEGORIZED_CATEGORY_ID
    )
  ) {
    grouped.categories.push(EMPTY_DATASET.categories[0]);
  }
  if (settings === undefined) {
    settings = EMPTY_DATASET.settings;
  }
  const candidate = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    format: DATASET_FORMAT,
    ...grouped,
    settings,
  };
  try {
    return parseCurrentDataset(candidate);
  } catch {
    throw adapterError("corrupt-data", "sync.local-dataset");
  }
}

export function datasetEntries(
  dataset: PortableDataset,
): readonly { readonly key: string; readonly value: JsonValue }[] {
  return datasetValues(dataset).map((value) => {
    const object = asJsonRecord(value);
    if (typeof object?.id !== "string") {
      throw adapterError("invalid-request", "sync.dataset-entry");
    }
    return { key: object.id, value };
  });
}

export const CAUSAL_STATE_KEY = "s402:causal-snapshot";
export const CAUSAL_STATE_VERSION = 1 as const;

export type PersistedCausalState = {
  readonly type: "s402-causal-state";
  readonly version: typeof CAUSAL_STATE_VERSION;
  readonly snapshot: CausalSnapshot;
};

export function initialCausalSnapshot(
  dataset: PortableDataset = emptyPortableDataset(),
): CausalSnapshot {
  return {
    generation: 1,
    heads: [],
    changes: [],
    dataset: cloneJson(dataset),
  };
}

export async function readLocalDataset(
  local: LocalPort,
  options?: OperationOptions,
): Promise<PortableDataset> {
  const entries = await local.query<JsonValue>("records", {}, options);
  return datasetFromEntries(entries);
}

export async function writeLocalDataset(
  local: LocalPort,
  dataset: PortableDataset,
  options?: OperationOptions,
): Promise<void> {
  const entries = datasetEntries(dataset);
  await local.transaction("readwrite", async (transaction) => {
    const existing = await transaction.query<JsonValue>("records", {}, options);
    for (const entry of existing) {
      await transaction.delete("records", entry.key, options);
    }
    for (const entry of entries) {
      await transaction.put("records", entry.key, entry.value, options);
    }
  }, options);
}

export function createDatasetChange(input: {
  readonly id: StableId;
  readonly actorId: StableId;
  readonly sequence: number;
  readonly parents: readonly StableId[];
  readonly dataset: PortableDataset;
}): CausalChange {
  const payload: CausalDatasetPayload = {
    type: "causal-dataset",
    schemaVersion: CAUSAL_SYNC_SCHEMA_VERSION,
    dataset: input.dataset,
    fingerprint: datasetFingerprint(input.dataset),
  };
  return {
    id: input.id,
    actorId: input.actorId,
    sequence: input.sequence,
    parents: [...input.parents],
    payload: asJsonValue(payload),
  };
}

function datasetPayload(
  change: CausalChange,
  operation: string,
): CausalDatasetPayload {
  const object = asJsonRecord(change.payload);
  if (
    object?.type !== "causal-dataset" ||
    object.schemaVersion !== CAUSAL_SYNC_SCHEMA_VERSION ||
    typeof object.fingerprint !== "string" ||
    object.dataset === null || typeof object.dataset !== "object" ||
    Array.isArray(object.dataset)
  ) {
    throw adapterError("corrupt-data", operation);
  }
  try {
    return {
      type: "causal-dataset",
      schemaVersion: CAUSAL_SYNC_SCHEMA_VERSION,
      dataset: parseCurrentDataset(object.dataset),
      fingerprint: object.fingerprint,
    };
  } catch {
    throw adapterError("corrupt-data", operation);
  }
}

function recordMap(dataset: PortableDataset): Map<string, JsonValue> {
  const result = new Map<string, JsonValue>();
  for (const value of datasetValues(dataset)) {
    const key = recordKey(value);
    if (key !== undefined) result.set(key, value);
  }
  return result;
}

function datasetFromMap(values: Map<string, JsonValue>): PortableDataset {
  const grouped: Record<string, JsonValue[]> = {
    projects: [],
    categories: [],
    expenses: [],
    receipts: [],
    receiptPurchaseLines: [],
    receiptAdjustments: [],
    devices: [],
    tombstones: [],
    retirementMarkers: [],
    revisions: [],
  };
  let settings: JsonValue | undefined;
  for (
    const value of [...values.values()].sort((left, right) =>
      compareCodeUnits(recordKey(left) ?? "", recordKey(right) ?? "")
    )
  ) {
    const object = asJsonRecord(value);
    const type = object?.type;
    if (type === "portable-settings") {
      settings = value;
      continue;
    }
    const group = type === "project"
      ? "projects"
      : type === "category"
      ? "categories"
      : type === "expense"
      ? "expenses"
      : type === "receipt"
      ? "receipts"
      : type === "receipt-purchase-line"
      ? "receiptPurchaseLines"
      : type === "receipt-adjustment"
      ? "receiptAdjustments"
      : type === "device"
      ? "devices"
      : type === "tombstone"
      ? "tombstones"
      : type === "retirement-marker"
      ? "retirementMarkers"
      : type === "revision"
      ? "revisions"
      : undefined;
    if (group !== undefined) grouped[group].push(value);
  }
  if (
    !grouped.categories.some((value) =>
      asJsonRecord(value)?.id === UNCATEGORIZED_CATEGORY_ID
    )
  ) grouped.categories.push(EMPTY_DATASET.categories[0]);
  if (settings === undefined) settings = EMPTY_DATASET.settings;
  const candidate = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    format: DATASET_FORMAT,
    ...grouped,
    settings: settings as PortableDataset["settings"],
  };
  try {
    return parseCurrentDataset(candidate);
  } catch {
    throw adapterError("corrupt-data", "sync.dataset-merge");
  }
}

function conflictId(
  changeId: StableId,
  recordId: StableId,
  field: string,
): StableId {
  return StableIdSchema.parse(`conflict-${changeId}-${recordId}-${field}`);
}

function recordConflict(
  change: CausalChange,
  current: JsonValue | undefined,
  incoming: JsonValue | undefined,
  field: string,
  relatedChangeIds: readonly StableId[],
): CausalConflict["conflict"] {
  const currentObject = asJsonRecord(current);
  const incomingObject = asJsonRecord(incoming);
  const recordId = safeId(
    currentObject?.id ?? incomingObject?.id,
    "sync.conflict.id",
  );
  return {
    id: conflictId(change.id, recordId, field),
    recordType: String(
      currentObject?.type ?? incomingObject?.type ?? "unknown",
    ),
    recordId,
    local: current === undefined ? null : current,
    remote: incoming === undefined ? null : incoming,
    relatedChangeIds: [...new Set([...relatedChangeIds, change.id])].sort(
      compareCodeUnits,
    ),
  };
}

function mergeRecords(
  current: JsonRecord,
  incoming: JsonRecord,
  base: JsonRecord | undefined,
  change: CausalChange,
  relatedChangeIds: readonly StableId[],
): {
  readonly value: JsonRecord;
  readonly conflicts: readonly CausalConflict["conflict"][];
} {
  const keys = new Set<string>([
    ...Object.keys(current),
    ...Object.keys(incoming),
    ...(base === undefined ? [] : Object.keys(base)),
  ]);
  const merged: Record<string, JsonValue> = {};
  const conflicts: CausalConflict["conflict"][] = [];
  for (const key of [...keys].sort(compareCodeUnits)) {
    const currentValue = current[key];
    const incomingValue = incoming[key];
    const baseValue = base?.[key];
    if (equalJson(currentValue, incomingValue)) {
      if (currentValue !== undefined) merged[key] = currentValue;
      continue;
    }
    if (equalJson(currentValue, baseValue)) {
      if (incomingValue !== undefined) merged[key] = incomingValue;
      continue;
    }
    if (equalJson(incomingValue, baseValue)) {
      if (currentValue !== undefined) merged[key] = currentValue;
      continue;
    }
    if (currentValue !== undefined) merged[key] = currentValue;
    conflicts.push(
      recordConflict(
        change,
        currentValue,
        incomingValue,
        key,
        relatedChangeIds,
      ),
    );
  }
  return { value: merged, conflicts };
}

function mergeDatasets(
  current: PortableDataset,
  incoming: PortableDataset,
  base: PortableDataset,
  change: CausalChange,
  relatedChangeIds: readonly StableId[],
): {
  readonly dataset: PortableDataset;
  readonly conflicts: readonly CausalConflict["conflict"][];
} {
  const currentMap = recordMap(current);
  const incomingMap = recordMap(incoming);
  const baseMap = recordMap(base);
  const merged = new Map<string, JsonValue>();
  const conflicts: CausalConflict["conflict"][] = [];
  const keys = new Set<string>([
    ...currentMap.keys(),
    ...incomingMap.keys(),
    ...baseMap.keys(),
  ]);
  for (const key of [...keys].sort(compareCodeUnits)) {
    const currentValue = currentMap.get(key);
    const incomingValue = incomingMap.get(key);
    const baseValue = baseMap.get(key);
    if (equalJson(currentValue, incomingValue)) {
      if (currentValue !== undefined) merged.set(key, currentValue);
      continue;
    }
    if (currentValue === undefined && baseValue === undefined) {
      if (incomingValue !== undefined) merged.set(key, incomingValue);
      continue;
    }
    if (incomingValue === undefined && baseValue === undefined) {
      if (currentValue !== undefined) merged.set(key, currentValue);
      continue;
    }
    if (equalJson(currentValue, baseValue)) {
      if (incomingValue !== undefined) merged.set(key, incomingValue);
      continue;
    }
    if (equalJson(incomingValue, baseValue)) {
      if (currentValue !== undefined) merged.set(key, currentValue);
      continue;
    }
    const currentObject = asJsonRecord(currentValue);
    const incomingObject = asJsonRecord(incomingValue);
    const baseObject = asJsonRecord(baseValue);
    if (currentObject && incomingObject) {
      const result = mergeRecords(
        currentObject,
        incomingObject,
        baseObject,
        change,
        relatedChangeIds,
      );
      merged.set(key, result.value as JsonValue);
      conflicts.push(...result.conflicts);
      continue;
    }
    if (currentValue !== undefined) merged.set(key, currentValue);
    conflicts.push(
      recordConflict(
        change,
        currentValue,
        incomingValue,
        "__record",
        relatedChangeIds,
      ),
    );
  }
  return { dataset: datasetFromMap(merged), conflicts };
}

function changeDepth(
  change: CausalChange,
  changes: ReadonlyMap<StableId, CausalChange>,
  visiting = new Set<StableId>(),
): number {
  if (visiting.has(change.id)) return 0;
  visiting.add(change.id);
  const parentDepth = change.parents.reduce((maximum, parentId) => {
    const parent = changes.get(parentId);
    return parent === undefined
      ? maximum
      : Math.max(maximum, changeDepth(parent, changes, visiting));
  }, 0);
  visiting.delete(change.id);
  return parentDepth + 1;
}

function parentDataset(
  change: CausalChange,
  changes: ReadonlyMap<StableId, CausalChange>,
): PortableDataset {
  const parent = change.parents
    .map((parentId) => changes.get(parentId))
    .find((candidate) => candidate !== undefined);
  return parent === undefined
    ? emptyPortableDataset()
    : datasetPayload(parent, "sync.parent-payload").dataset;
}

function mergeConflictList(
  conflicts: readonly CausalConflict["conflict"][],
): readonly CausalConflict["conflict"][] {
  const unique = new Map<StableId, CausalConflict["conflict"]>();
  for (const conflict of conflicts) unique.set(conflict.id, conflict);
  return [...unique.values()].sort((left, right) =>
    compareCodeUnits(left.id, right.id)
  );
}

function headsFor(changes: readonly CausalChange[]): readonly StableId[] {
  const parentIds = new Set(changes.flatMap((change) => change.parents));
  return changes.map((change) => change.id)
    .filter((id) => !parentIds.has(id))
    .sort(compareCodeUnits);
}

export function mergeCausalSnapshots(
  current: CausalSnapshot,
  incoming: CausalSnapshot,
): CausalMergeResult {
  const allChanges = new Map<StableId, CausalChange>();
  for (const change of [...current.changes, ...incoming.changes]) {
    if (!allChanges.has(change.id)) {
      allChanges.set(change.id, structuredClone(change));
    }
  }
  const orderedIncoming = incoming.changes
    .filter((change) =>
      !current.changes.some((known) => known.id === change.id)
    )
    .sort((left, right) => {
      const depth = changeDepth(left, allChanges) -
        changeDepth(right, allChanges);
      return depth === 0 ? compareCodeUnits(left.id, right.id) : depth;
    });
  let dataset = current.dataset;
  const conflicts: CausalConflict["conflict"][] = [];
  const appliedChangeIds: StableId[] = [];
  const related = [...current.heads];
  for (const change of orderedIncoming) {
    const payload = datasetPayload(change, "sync.change-payload");
    const base = parentDataset(change, allChanges);
    const merged = mergeDatasets(
      dataset,
      payload.dataset,
      base,
      change,
      related,
    );
    dataset = merged.dataset;
    conflicts.push(...merged.conflicts);
    appliedChangeIds.push(change.id);
    related.push(change.id);
  }
  const changes = [...allChanges.values()].sort((left, right) =>
    compareCodeUnits(left.id, right.id)
  );
  return {
    snapshot: {
      generation: Math.max(current.generation, incoming.generation),
      heads: headsFor(changes),
      changes,
      dataset,
    },
    appliedChangeIds,
    conflicts: mergeConflictList(conflicts),
  };
}

function parseChange(value: unknown, operation: string): CausalChange {
  const object = asJsonRecord(value);
  if (
    object === undefined ||
    typeof object.actorId !== "string" ||
    !Array.isArray(object.parents) ||
    !object.parents.every((parent) => typeof parent === "string") ||
    typeof object.sequence !== "number" ||
    !Number.isSafeInteger(object.sequence) || object.sequence < 1 ||
    object.payload === null || typeof object.payload !== "object" ||
    Array.isArray(object.payload)
  ) {
    throw adapterError("corrupt-data", operation);
  }
  return {
    id: safeId(object.id, operation),
    actorId: safeId(object.actorId, operation),
    sequence: object.sequence,
    parents: object.parents.map((parent) => safeId(parent, operation)),
    payload: object.payload as JsonValue,
  };
}

export function parseCausalSnapshot(value: unknown): CausalSnapshot {
  const object = asJsonRecord(value);
  if (
    object === undefined || typeof object.generation !== "number" ||
    !Number.isSafeInteger(object.generation) || object.generation < 1 ||
    !Array.isArray(object.heads) ||
    !object.heads.every((head) => typeof head === "string") ||
    !Array.isArray(object.changes) || object.dataset === null ||
    typeof object.dataset !== "object" || Array.isArray(object.dataset)
  ) {
    throw adapterError("corrupt-data", "sync.snapshot");
  }
  try {
    return {
      generation: object.generation,
      heads: object.heads.map((head) => safeId(head, "sync.snapshot")),
      changes: object.changes.map((change) =>
        parseChange(change, "sync.snapshot")
      ),
      dataset: parseCurrentDataset(object.dataset),
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AdapterError") throw error;
    throw adapterError("corrupt-data", "sync.snapshot");
  }
}

function initialSnapshot(
  snapshot: CausalSnapshot | undefined,
): CausalSnapshot {
  return snapshot === undefined
    ? {
      generation: 1,
      heads: [],
      changes: [],
      dataset: emptyPortableDataset(),
    }
    : cloneSnapshot(snapshot);
}

function envelopeBody(snapshot: CausalSnapshot): string {
  const envelope: CausalEnvelope = {
    schemaVersion: CAUSAL_SYNC_SCHEMA_VERSION,
    type: "causal-sync-envelope",
    snapshot,
  };
  return JSON.stringify(envelope);
}

function parseEnvelope(body: string): CausalSnapshot {
  try {
    const parsed = JSON.parse(body) as unknown;
    const object = asJsonRecord(parsed);
    if (
      object?.schemaVersion !== CAUSAL_SYNC_SCHEMA_VERSION ||
      object.type !== "causal-sync-envelope"
    ) throw new Error("invalid envelope");
    return parseCausalSnapshot(object.snapshot);
  } catch (error) {
    if (error instanceof Error && error.name === "AdapterError") throw error;
    throw adapterError("corrupt-data", "sync.remote-envelope");
  }
}

export function createDriveCausalSyncPort(
  options: DriveCausalSyncOptions,
): CausalSyncPort {
  const fileName = options.fileName ?? CAUSAL_SYNC_FILE_NAME;
  let knownFile: DriveFile | undefined;
  const readRemote = async (
    operationOptions?: OperationOptions,
  ): Promise<CausalSnapshot> => {
    const marker = await options.drive.readRetirementMarker(operationOptions);
    if (marker !== undefined) throw adapterError("retired", "sync.remote-read");
    const file = await options.drive.readAppData(fileName, operationOptions);
    knownFile = file;
    return file === undefined
      ? initialSnapshot(options.initialSnapshot)
      : parseEnvelope(file.body);
  };

  return {
    read: readRemote,
    exportPacket: async (operationOptions) => {
      const snapshot = await readRemote(operationOptions);
      return {
        generation: snapshot.generation,
        heads: [...snapshot.heads],
        changes: snapshot.changes.map((change) => structuredClone(change)),
      };
    },
    applyPacket: async (
      packet,
      operationOptions,
    ): Promise<CausalApplyResult> => {
      const remote = await readRemote(operationOptions);
      const incoming: CausalSnapshot = {
        generation: packet.generation,
        heads: packet.heads,
        changes: packet.changes,
        dataset: remote.dataset,
      };
      const merged = mergeCausalSnapshots(remote, incoming);
      const written = await options.drive.writeAppData({
        name: fileName,
        body: envelopeBody(merged.snapshot),
        ...(knownFile === undefined ? {} : { expectedEtag: knownFile.etag }),
      }, operationOptions);
      knownFile = written;
      return {
        snapshot: cloneSnapshot(merged.snapshot),
        appliedChangeIds: merged.appliedChangeIds,
        conflicts: merged.conflicts,
      };
    },
  };
}

export type InMemoryCausalSyncPort = CausalSyncPort & {
  readonly setSnapshot: (snapshot: CausalSnapshot) => void;
  readonly retire: () => void;
};

export function createInMemoryCausalSyncPort(
  options: InMemoryCausalSyncOptions = {},
): InMemoryCausalSyncPort {
  let snapshot = initialSnapshot(options.initialSnapshot);
  let retired = false;
  const before = async (
    operation: "read" | "apply",
    operationOptions?: OperationOptions,
  ): Promise<void> => {
    if (operationOptions?.signal?.aborted) {
      throw adapterError("aborted", `sync.in-memory.${operation}`);
    }
    await options.beforeOperation?.(operation, operationOptions);
  };
  return {
    read: async (operationOptions) => {
      await before("read", operationOptions);
      if (retired) throw adapterError("retired", "sync.in-memory.read");
      return cloneSnapshot(snapshot);
    },
    exportPacket: async (operationOptions) => {
      const current = await before("read", operationOptions).then(() => {
        if (retired) throw adapterError("retired", "sync.in-memory.export");
        return cloneSnapshot(snapshot);
      });
      return {
        generation: current.generation,
        heads: [...current.heads],
        changes: current.changes.map((change) => structuredClone(change)),
      };
    },
    applyPacket: async (packet, operationOptions) => {
      await before("apply", operationOptions);
      if (retired) throw adapterError("retired", "sync.in-memory.apply");
      const merged = mergeCausalSnapshots(snapshot, {
        generation: packet.generation,
        heads: packet.heads,
        changes: packet.changes,
        dataset: snapshot.dataset,
      });
      snapshot = merged.snapshot;
      return {
        snapshot: cloneSnapshot(snapshot),
        appliedChangeIds: merged.appliedChangeIds,
        conflicts: merged.conflicts,
      };
    },
    setSnapshot: (next) => snapshot = cloneSnapshot(next),
    retire: () => retired = true,
  };
}
