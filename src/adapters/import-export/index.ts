import {
  adapterError,
  type CausalApplyResult,
  type CausalChange,
  type CausalSnapshot,
  type CausalSyncPacket,
  type CausalSyncPort,
  type ClockPort,
  type FilePayload,
  type FileSharePort,
  type IdPort,
  type JsonValue,
  type LocalPort,
  type LocalTransaction,
  type OperationOptions,
  type SyncConflict,
} from "../ports/index.ts";
import {
  CANONICAL_EXPORT_FORMAT,
  type CanonicalExport,
  type CanonicalExportChange,
  createCanonicalExport,
  deduplicateImportedHistory,
  parseCanonicalExport,
  portableProjection,
  previewCanonicalImport,
  replacementGeneration,
  serializeCanonicalExport,
} from "../../domain/import-export/index.ts";
import type { PortableDataset, StableId } from "../../domain/index.ts";
import {
  CAUSAL_STATE_KEY,
  CAUSAL_STATE_VERSION,
  createDatasetChange,
  datasetEntries,
  datasetFingerprint,
  datasetFromEntries,
  emptyPortableDataset,
  initialCausalSnapshot,
  parseCausalSnapshot,
  readLocalDataset,
} from "../sync/causal.ts";
import { parseCurrentDataset } from "../../domain/schema/dataset.ts";

export const IMPORT_EXPORT_RECOVERY_KEY = "s404:replace-recovery";
export const IMPORT_EXPORT_FILE_NAME = "did-it-become-what-you-like.json";
export const IMPORT_EXPORT_MIME_TYPE = "application/json";

type CausalState = {
  readonly type: "s402-causal-state";
  readonly version: typeof CAUSAL_STATE_VERSION;
  readonly snapshot: CausalSnapshot;
};

type ReplacePacket = {
  readonly generation: number;
  readonly heads: readonly StableId[];
  readonly changes: readonly CausalChange[];
};

type ReplaceRecovery = {
  readonly type: "s404-replace-recovery";
  readonly version: 1;
  readonly phase: "prepared" | "local-committed";
  readonly backupDataset: PortableDataset;
  readonly backupSnapshot: CausalSnapshot;
  readonly targetDataset: PortableDataset;
  readonly packet: ReplacePacket;
};

export type ImportExportAdapterDependencies = {
  readonly local: LocalPort;
  readonly causal: CausalSyncPort;
  readonly deviceId: StableId;
  readonly ids: Pick<IdPort, "next">;
  readonly clock: Pick<ClockPort, "now">;
  readonly fileShare?: FileSharePort;
  /** The already-composed S-402 synchronization workflow. */
  readonly synchronizeBeforeReplace?: (
    options?: OperationOptions,
  ) => Promise<void>;
};

export type ImportCommitRequest = {
  readonly document: CanonicalExport;
  readonly mode: "merge" | "replace";
  readonly driveConfigured: boolean;
  readonly online: boolean;
  /** Set only by the actor after its successful pre-sync state. */
  readonly preSynced?: boolean;
};

export type ImportCommitResult = {
  readonly mode: "merge" | "replace";
  readonly generation: number;
  readonly conflictCount: number;
  readonly duplicateChangeCount: number;
  readonly recovered: boolean;
};

export type ExportResult = {
  readonly document: CanonicalExport;
  readonly json: string;
  readonly bytes: Uint8Array;
};

export type ShareResult = "shared" | "saved";

function asJsonValue(value: unknown): JsonValue {
  return value as JsonValue;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function causalState(value: unknown): CausalSnapshot | undefined {
  const object = asRecord(value);
  if (
    object?.type !== "s402-causal-state" ||
    object.version !== CAUSAL_STATE_VERSION ||
    object.snapshot === undefined
  ) return undefined;
  try {
    return parseCausalSnapshot(object.snapshot);
  } catch {
    throw adapterError("corrupt-data", "import-export.causal-state");
  }
}

function changeFromExport(change: CanonicalExportChange): CausalChange {
  return {
    id: change.id,
    actorId: change.actorId,
    sequence: change.sequence,
    parents: [...change.parents],
    payload: asJsonValue(change.payload),
  };
}

function changeForDataset(input: {
  readonly id: StableId;
  readonly actorId: StableId;
  readonly sequence: number;
  readonly parents: readonly StableId[];
  readonly dataset: PortableDataset;
}): CausalChange {
  return createDatasetChange(input);
}

function exportedChanges(
  snapshot: CausalSnapshot,
): readonly CanonicalExportChange[] {
  return snapshot.changes.map((change) => ({
    id: change.id,
    actorId: change.actorId,
    sequence: change.sequence,
    parents: [...change.parents],
    payload: change.payload as Record<string, unknown>,
  }));
}

function pendingSnapshotValue(snapshot: CausalSnapshot): JsonValue {
  const value: CausalState = {
    type: "s402-causal-state",
    version: CAUSAL_STATE_VERSION,
    snapshot: clone(snapshot),
  };
  return asJsonValue(value);
}

async function readPersistedSnapshot(
  local: LocalPort,
  fallback: CausalSnapshot,
  options?: OperationOptions,
): Promise<CausalSnapshot> {
  const value = await local.transaction(
    "readonly",
    (transaction) =>
      transaction.get<JsonValue>("sync-metadata", CAUSAL_STATE_KEY, options),
    options,
  );
  return value === undefined ? fallback : causalState(value) ?? (() => {
    throw adapterError("corrupt-data", "import-export.causal-state");
  })();
}

function appendLocalChange(
  snapshot: CausalSnapshot,
  dataset: PortableDataset,
  dependencies: Pick<ImportExportAdapterDependencies, "deviceId" | "ids">,
): CausalSnapshot {
  if (datasetFingerprint(snapshot.dataset) === datasetFingerprint(dataset)) {
    return snapshot;
  }
  const sequence = snapshot.changes.reduce(
    (maximum, change) =>
      change.actorId === dependencies.deviceId
        ? Math.max(maximum, change.sequence)
        : maximum,
    0,
  ) + 1;
  const change = changeForDataset({
    id: dependencies.ids.next("change"),
    actorId: dependencies.deviceId,
    sequence,
    parents: snapshot.heads,
    dataset,
  });
  return {
    generation: snapshot.generation,
    heads: [change.id],
    changes: [...snapshot.changes, change],
    dataset: clone(dataset),
  };
}

async function currentSnapshot(
  dependencies: ImportExportAdapterDependencies,
  options?: OperationOptions,
): Promise<CausalSnapshot> {
  const dataset = await readLocalDataset(dependencies.local, options);
  const persisted = await readPersistedSnapshot(
    dependencies.local,
    initialCausalSnapshot(dataset),
    options,
  );
  return appendLocalChange(persisted, dataset, dependencies);
}

async function replaceRecords(
  transaction: LocalTransaction,
  dataset: PortableDataset,
  options?: OperationOptions,
): Promise<void> {
  const existing = await transaction.query<JsonValue>("records", {}, options);
  for (const entry of existing) {
    await transaction.delete("records", entry.key, options);
  }
  for (const entry of datasetEntries(dataset)) {
    await transaction.put("records", entry.key, entry.value, options);
  }
}

async function persistDatasetAndSnapshot(
  transaction: LocalTransaction,
  dataset: PortableDataset,
  snapshot: CausalSnapshot,
  options?: OperationOptions,
): Promise<void> {
  await replaceRecords(transaction, dataset, options);
  await transaction.put(
    "sync-metadata",
    CAUSAL_STATE_KEY,
    pendingSnapshotValue(snapshot),
    options,
  );
}

function recoveryFromValue(value: unknown): ReplaceRecovery | undefined {
  const object = asRecord(value);
  if (
    object?.type !== "s404-replace-recovery" || object.version !== 1 ||
    (object.phase !== "prepared" && object.phase !== "local-committed")
  ) return undefined;
  if (
    object.backupDataset === undefined || object.backupSnapshot === undefined ||
    object.targetDataset === undefined || object.packet === undefined
  ) return undefined;
  try {
    const backupDataset = parseCanonicalExport(JSON.stringify({
      schemaVersion: 1,
      format: CANONICAL_EXPORT_FORMAT,
      generation: 1,
      heads: [],
      changes: [],
      dataset: object.backupDataset,
    })).document.dataset;
    const targetDataset = parseCanonicalExport(JSON.stringify({
      schemaVersion: 1,
      format: CANONICAL_EXPORT_FORMAT,
      generation: 1,
      heads: [],
      changes: [],
      dataset: object.targetDataset,
    })).document.dataset;
    const backupSnapshot = parseCausalSnapshot(object.backupSnapshot);
    const packetRecord = asRecord(object.packet);
    if (
      packetRecord === undefined ||
      typeof packetRecord.generation !== "number" ||
      !Array.isArray(packetRecord.heads) || !Array.isArray(packetRecord.changes)
    ) return undefined;
    return {
      type: "s404-replace-recovery",
      version: 1,
      phase: object.phase,
      backupDataset,
      backupSnapshot,
      targetDataset,
      packet: {
        generation: packetRecord.generation,
        heads: packetRecord.heads as StableId[],
        changes: packetRecord.changes as CausalChange[],
      },
    };
  } catch {
    throw adapterError("corrupt-data", "import-export.recovery");
  }
}

async function readRecovery(
  local: LocalPort,
  options?: OperationOptions,
): Promise<ReplaceRecovery | undefined> {
  const value = await local.transaction(
    "readonly",
    (transaction) =>
      transaction.get<JsonValue>(
        "workflow-snapshots",
        IMPORT_EXPORT_RECOVERY_KEY,
        options,
      ),
    options,
  );
  return value === undefined ? undefined : recoveryFromValue(value);
}

async function clearRecovery(
  local: LocalPort,
  options?: OperationOptions,
): Promise<void> {
  await local.transaction(
    "readwrite",
    (transaction) =>
      transaction.delete(
        "workflow-snapshots",
        IMPORT_EXPORT_RECOVERY_KEY,
        options,
      ),
    options,
  );
}

async function restorePreparedRecovery(
  dependencies: ImportExportAdapterDependencies,
  recovery: ReplaceRecovery,
  options?: OperationOptions,
): Promise<void> {
  await dependencies.local.transaction("readwrite", async (transaction) => {
    await persistDatasetAndSnapshot(
      transaction,
      recovery.backupDataset,
      recovery.backupSnapshot,
      options,
    );
    await transaction.delete(
      "workflow-snapshots",
      IMPORT_EXPORT_RECOVERY_KEY,
      options,
    );
  }, options);
}

export function createGenerationProtectedCausalSyncPort(
  base: CausalSyncPort,
): CausalSyncPort {
  // A higher generation is a replacement/adoption boundary, not another
  // causal branch. Keep retired history out of this composition's public
  // packet so it cannot be re-uploaded by an import retry or export.
  const retiredChangeIds = new Set<StableId>();

  const visibleSnapshot = (snapshot: CausalSnapshot): CausalSnapshot => ({
    ...clone(snapshot),
    heads: snapshot.heads.filter((head) => !retiredChangeIds.has(head)),
    changes: snapshot.changes.filter((change) =>
      !retiredChangeIds.has(change.id)
    ),
  });

  const visiblePacket = (packet: CausalSyncPacket): CausalSyncPacket => ({
    ...packet,
    heads: packet.heads.filter((head) => !retiredChangeIds.has(head)),
    changes: packet.changes.filter((change) =>
      !retiredChangeIds.has(change.id)
    ),
  });

  const adoptionPacket = (
    packet: CausalSyncPacket,
    current: CausalSnapshot,
  ): CausalSyncPacket => {
    const packetChangeIds = new Set(packet.changes.map((change) => change.id));
    return {
      ...packet,
      changes: packet.changes.map((change) =>
        change.parents.some((parent) => packetChangeIds.has(parent))
          ? clone(change)
          : { ...clone(change), parents: [...current.heads] }
      ),
    };
  };

  return {
    read: async (options) => visibleSnapshot(await base.read(options)),
    exportPacket: async (options) =>
      visiblePacket(await base.exportPacket(options)),
    applyPacket: async (packet, options): Promise<CausalApplyResult> => {
      const current = await base.read(options);
      if (packet.generation < current.generation) {
        return {
          snapshot: visibleSnapshot(current),
          appliedChangeIds: [],
          conflicts: [],
        };
      }
      if (packet.generation > current.generation) {
        for (const change of current.changes) retiredChangeIds.add(change.id);
        const result = await base.applyPacket(
          adoptionPacket(packet, current),
          options,
        );
        return {
          ...result,
          snapshot: visibleSnapshot(result.snapshot),
        };
      }
      const result = await base.applyPacket(packet, options);
      return { ...result, snapshot: visibleSnapshot(result.snapshot) };
    },
  };
}

async function recoverPending(
  dependencies: ImportExportAdapterDependencies,
  options?: OperationOptions,
): Promise<boolean> {
  const recovery = await readRecovery(dependencies.local, options);
  if (recovery === undefined) return false;
  if (recovery.phase === "prepared") {
    await restorePreparedRecovery(dependencies, recovery, options);
    return true;
  }
  const causal = createGenerationProtectedCausalSyncPort(dependencies.causal);
  await causal.applyPacket(recovery.packet, options);
  await clearRecovery(dependencies.local, options);
  return true;
}

function importChangeSet(
  current: CausalSnapshot,
  document: CanonicalExport,
  dependencies: Pick<ImportExportAdapterDependencies, "deviceId" | "ids">,
): {
  readonly incoming: CausalSnapshot;
  readonly duplicateChangeCount: number;
} {
  const currentChanges = current.changes.map((change) => ({
    id: change.id,
    actorId: change.actorId,
    sequence: change.sequence,
    parents: [...change.parents],
    payload: change.payload as Record<string, unknown>,
  }));
  const history = deduplicateImportedHistory(currentChanges, document.changes);
  if (document.changes.length > 0) {
    return {
      incoming: {
        generation: document.generation,
        heads: [...document.heads],
        changes: document.changes.map(changeFromExport),
        dataset: clone(document.dataset),
      },
      duplicateChangeCount: history.duplicateChangeCount,
    };
  }
  const imported = changeForDataset({
    id: dependencies.ids.next("change"),
    actorId: dependencies.deviceId,
    sequence: current.changes.reduce(
      (maximum, change) =>
        change.actorId === dependencies.deviceId
          ? Math.max(maximum, change.sequence)
          : maximum,
      0,
    ) + 1,
    parents: [],
    dataset: document.dataset,
  });
  return {
    incoming: {
      generation: document.generation,
      heads: [imported.id],
      changes: [imported],
      dataset: clone(document.dataset),
    },
    duplicateChangeCount: 0,
  };
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

function recordKey(value: unknown): string | undefined {
  const object = asRecord(value);
  return typeof object?.type === "string" && typeof object.id === "string"
    ? `${object.type}:${object.id}`
    : undefined;
}

function recordMap(dataset: PortableDataset): Map<string, JsonValue> {
  const values = [
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
  ] as JsonValue[];
  const result = new Map<string, JsonValue>();
  for (const value of values) {
    const key = recordKey(value);
    if (key !== undefined) result.set(key, value);
  }
  return result;
}

function datasetFromMap(values: Map<string, JsonValue>): PortableDataset {
  return datasetFromEntries(
    [...values.entries()].map(([key, value]) => ({ key, value })),
  );
}

function payloadDataset(change: CausalChange): PortableDataset {
  const payload = asRecord(change.payload);
  if (
    payload?.type !== "causal-dataset" ||
    payload.schemaVersion !== 1 ||
    payload.dataset === undefined ||
    payload.dataset === null ||
    typeof payload.dataset !== "object" ||
    Array.isArray(payload.dataset)
  ) throw adapterError("corrupt-data", "import-export.change-payload");
  try {
    return parseCurrentDataset(payload.dataset);
  } catch {
    throw adapterError("corrupt-data", "import-export.change-payload");
  }
}

function changeDepth(
  change: CausalChange,
  changes: ReadonlyMap<StableId, CausalChange>,
  visiting = new Set<StableId>(),
): number {
  if (visiting.has(change.id)) return 0;
  visiting.add(change.id);
  const depth = change.parents.reduce((maximum, parentId) => {
    const parent = changes.get(parentId);
    return parent === undefined
      ? maximum
      : Math.max(maximum, changeDepth(parent, changes, visiting));
  }, 0);
  visiting.delete(change.id);
  return depth + 1;
}

function parentDataset(
  change: CausalChange,
  changes: ReadonlyMap<StableId, CausalChange>,
): PortableDataset {
  const parent = change.parents
    .map((parentId) => changes.get(parentId))
    .find((candidate) => candidate !== undefined);
  return parent === undefined ? emptyPortableDataset() : payloadDataset(parent);
}

function conflict(
  change: CausalChange,
  record: Record<string, unknown> | undefined,
  field: string,
  local: JsonValue,
  remote: JsonValue,
  relatedChangeIds: readonly StableId[],
): SyncConflict {
  const recordId = typeof record?.id === "string" ? record.id : "unknown";
  const recordType = typeof record?.type === "string" ? record.type : "unknown";
  return {
    id: `${"import-conflict"}-${change.id}-${recordId}-${field}` as StableId,
    recordType,
    recordId: recordId as StableId,
    local,
    remote,
    relatedChangeIds: [...new Set([...relatedChangeIds, change.id])].sort(
      compareCodeUnits,
    ),
  };
}

function mergeImportedRecords(
  current: JsonValue | undefined,
  incoming: JsonValue | undefined,
  base: JsonValue | undefined,
  change: CausalChange,
  relatedChangeIds: readonly StableId[],
): {
  readonly value: JsonValue | undefined;
  readonly conflicts: readonly SyncConflict[];
} {
  if (equalJson(current, incoming)) return { value: current, conflicts: [] };
  if (current === undefined && base === undefined) {
    return { value: incoming, conflicts: [] };
  }
  if (incoming === undefined && base === undefined) {
    return { value: current, conflicts: [] };
  }
  if (equalJson(current, base)) return { value: incoming, conflicts: [] };
  if (equalJson(incoming, base)) return { value: current, conflicts: [] };

  const currentObject = asRecord(current);
  const incomingObject = asRecord(incoming);
  const baseObject = asRecord(base);
  if (currentObject && incomingObject) {
    const merged: Record<string, JsonValue> = {};
    const conflicts: SyncConflict[] = [];
    const keys = new Set([
      ...Object.keys(currentObject),
      ...Object.keys(incomingObject),
      ...(baseObject === undefined ? [] : Object.keys(baseObject)),
    ]);
    for (const key of [...keys].sort(compareCodeUnits)) {
      const fieldResult = mergeImportedRecords(
        currentObject[key] as JsonValue | undefined,
        incomingObject[key] as JsonValue | undefined,
        baseObject?.[key] as JsonValue | undefined,
        change,
        relatedChangeIds,
      );
      if (fieldResult.value !== undefined) merged[key] = fieldResult.value;
      if (!equalJson(fieldResult.value, incomingObject[key])) {
        const localValue = currentObject[key] as JsonValue | undefined;
        const remoteValue = incomingObject[key] as JsonValue | undefined;
        if (
          !equalJson(localValue, remoteValue) &&
          !equalJson(localValue, baseObject?.[key])
        ) {
          conflicts.push(
            conflict(
              change,
              currentObject,
              key,
              localValue ?? null,
              remoteValue ?? null,
              relatedChangeIds,
            ),
          );
        }
      }
      conflicts.push(...fieldResult.conflicts);
    }
    return { value: merged, conflicts };
  }
  return {
    value: current,
    conflicts: [],
  };
}

function mergeImportedSnapshots(
  current: CausalSnapshot,
  incoming: CausalSnapshot,
): {
  readonly snapshot: CausalSnapshot;
  readonly appliedChangeIds: readonly StableId[];
  readonly conflicts: readonly SyncConflict[];
} {
  const allChanges = new Map<StableId, CausalChange>();
  for (const change of [...current.changes, ...incoming.changes]) {
    if (!allChanges.has(change.id)) allChanges.set(change.id, clone(change));
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
  const conflicts: SyncConflict[] = [];
  const appliedChangeIds: StableId[] = [];
  const related = [...current.heads];
  for (const change of orderedIncoming) {
    const incomingMap = recordMap(payloadDataset(change));
    const currentMap = recordMap(dataset);
    const baseMap = recordMap(parentDataset(change, allChanges));
    const merged = new Map<string, JsonValue>();
    const keys = new Set([
      ...currentMap.keys(),
      ...incomingMap.keys(),
      ...baseMap.keys(),
    ]);
    for (const key of [...keys].sort(compareCodeUnits)) {
      const result = mergeImportedRecords(
        currentMap.get(key),
        incomingMap.get(key),
        baseMap.get(key),
        change,
        related,
      );
      if (result.value !== undefined) merged.set(key, result.value);
      conflicts.push(...result.conflicts);
    }
    dataset = datasetFromMap(merged);
    appliedChangeIds.push(change.id);
    related.push(change.id);
  }
  const changes = [...allChanges.values()].sort((left, right) =>
    compareCodeUnits(left.id, right.id)
  );
  const parentIds = new Set(changes.flatMap((change) => change.parents));
  return {
    snapshot: {
      generation: Math.max(current.generation, incoming.generation),
      heads: changes.map((change) => change.id).filter((id) =>
        !parentIds.has(id)
      )
        .sort(compareCodeUnits),
      changes,
      dataset,
    },
    appliedChangeIds,
    conflicts,
  };
}

async function commitMerge(
  dependencies: ImportExportAdapterDependencies,
  document: CanonicalExport,
  options?: OperationOptions,
): Promise<ImportCommitResult> {
  const current = await currentSnapshot(dependencies, options);
  const changeSet = importChangeSet(current, document, dependencies);
  const merged = mergeImportedSnapshots(current, changeSet.incoming);
  await dependencies.local.transaction("readwrite", async (transaction) => {
    await persistDatasetAndSnapshot(
      transaction,
      merged.snapshot.dataset,
      merged.snapshot,
      options,
    );
  }, options);
  return {
    mode: "merge",
    generation: merged.snapshot.generation,
    conflictCount: merged.conflicts.length,
    duplicateChangeCount: changeSet.duplicateChangeCount,
    recovered: false,
  };
}

async function writeRecovery(
  local: LocalPort,
  recovery: ReplaceRecovery,
  options?: OperationOptions,
): Promise<void> {
  await local.transaction(
    "readwrite",
    (transaction) =>
      transaction.put(
        "workflow-snapshots",
        IMPORT_EXPORT_RECOVERY_KEY,
        asJsonValue(recovery),
        options,
      ),
    options,
  );
}

async function commitReplace(
  dependencies: ImportExportAdapterDependencies,
  document: CanonicalExport,
  options?: OperationOptions,
): Promise<ImportCommitResult> {
  const current = await currentSnapshot(dependencies, options);
  const remote = await dependencies.causal.read(options);
  const generation = replacementGeneration(
    Math.max(current.generation, remote.generation),
    document.generation,
  );
  const sequence = current.changes.reduce(
    (maximum, change) =>
      change.actorId === dependencies.deviceId
        ? Math.max(maximum, change.sequence)
        : maximum,
    0,
  ) + 1;
  const replacement = changeForDataset({
    id: dependencies.ids.next("change"),
    actorId: dependencies.deviceId,
    sequence,
    parents: remote.heads,
    dataset: portableProjection(document.dataset),
  });
  const packet: ReplacePacket = {
    generation: generation.nextGeneration,
    heads: [replacement.id],
    changes: [replacement],
  };
  const recovery: ReplaceRecovery = {
    type: "s404-replace-recovery",
    version: 1,
    phase: "prepared",
    backupDataset: clone(current.dataset),
    backupSnapshot: clone(current),
    targetDataset: clone(document.dataset),
    packet,
  };
  await writeRecovery(dependencies.local, recovery, options);

  const localTarget: CausalSnapshot = {
    generation: generation.nextGeneration,
    heads: [replacement.id],
    // A replacement starts a new generation. Keeping prior-generation changes
    // here would let a later export re-upload the replaced history.
    changes: [replacement],
    dataset: clone(document.dataset),
  };
  await dependencies.local.transaction("readwrite", async (transaction) => {
    await persistDatasetAndSnapshot(
      transaction,
      document.dataset,
      localTarget,
      options,
    );
    await transaction.put(
      "workflow-snapshots",
      IMPORT_EXPORT_RECOVERY_KEY,
      asJsonValue({ ...recovery, phase: "local-committed" }),
      options,
    );
  }, options);

  const causal = createGenerationProtectedCausalSyncPort(dependencies.causal);
  await causal.applyPacket(packet, options);
  await clearRecovery(dependencies.local, options);
  return {
    mode: "replace",
    generation: generation.nextGeneration,
    conflictCount: 0,
    duplicateChangeCount: 0,
    recovered: false,
  };
}

export function createImportExportAdapter(
  dependencies: ImportExportAdapterDependencies,
) {
  const exportDocument = async (
    options?: OperationOptions,
  ): Promise<ExportResult> => {
    const snapshot = await currentSnapshot(dependencies, options);
    const document = createCanonicalExport({
      dataset: snapshot.dataset,
      generation: snapshot.generation,
      heads: snapshot.heads,
      changes: exportedChanges(snapshot),
      exportedAt: dependencies.clock.now(),
    });
    const json = serializeCanonicalExport(document);
    return { document, json, bytes: new TextEncoder().encode(json) };
  };

  const commitImport = async (
    request: ImportCommitRequest,
    options?: OperationOptions,
  ): Promise<ImportCommitResult> => {
    if (
      request.mode === "replace" && request.driveConfigured && !request.online
    ) {
      throw adapterError("offline", "import-export.replace-pre-sync");
    }
    if (
      request.mode === "replace" && request.driveConfigured &&
      request.preSynced !== true
    ) {
      await synchronizeBeforeReplace(options);
    }
    const recovered = await recoverPending(dependencies, options);
    const result = request.mode === "merge"
      ? await commitMerge(dependencies, request.document, options)
      : await commitReplace(dependencies, request.document, options);
    return { ...result, recovered };
  };

  const synchronizeBeforeReplace = async (
    options?: OperationOptions,
  ): Promise<void> => {
    if (dependencies.synchronizeBeforeReplace === undefined) {
      throw adapterError("invalid-request", "import-export.pre-sync");
    }
    await dependencies.synchronizeBeforeReplace(options);
  };

  const saveExport = async (
    result: ExportResult,
    options?: OperationOptions,
  ): Promise<void> => {
    if (dependencies.fileShare === undefined) {
      throw adapterError("unavailable", "import-export.file-share");
    }
    const payload: FilePayload = {
      name: IMPORT_EXPORT_FILE_NAME,
      mimeType: IMPORT_EXPORT_MIME_TYPE,
      bytes: new Uint8Array(result.bytes),
    };
    await dependencies.fileShare.save(payload, options);
  };

  const shareExport = async (
    result: ExportResult,
    options?: OperationOptions,
  ): Promise<ShareResult> => {
    if (dependencies.fileShare === undefined) {
      throw adapterError("unavailable", "import-export.file-share");
    }
    const payload: FilePayload = {
      name: IMPORT_EXPORT_FILE_NAME,
      mimeType: IMPORT_EXPORT_MIME_TYPE,
      bytes: new Uint8Array(result.bytes),
    };
    try {
      return await dependencies.fileShare.share({
        title: "Expense data export",
        file: payload,
      }, options);
    } catch (error) {
      const code = error && typeof error === "object" && "code" in error
        ? (error as { readonly code?: unknown }).code
        : undefined;
      if (code !== "unavailable" && code !== "unsupported") throw error;
      await dependencies.fileShare.save(payload, options);
      return "saved";
    }
  };

  return {
    exportDocument,
    previewImport: (json: string) => previewCanonicalImport(json),
    parseImport: (json: string) => parseCanonicalExport(json),
    commitImport,
    synchronizeBeforeReplace,
    saveExport,
    shareExport,
  };
}

export type ImportExportAdapter = ReturnType<typeof createImportExportAdapter>;
