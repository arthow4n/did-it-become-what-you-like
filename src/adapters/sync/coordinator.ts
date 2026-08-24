import {
  adapterError,
  type CausalSnapshot,
  type CausalSyncPort,
  type IdPort,
  type JsonValue,
  type LocalPort,
  type LocalTransaction,
  type OperationOptions,
  type SyncConflict,
} from "../ports/index.ts";
import type { Device, PortableDataset, StableId } from "../../domain/index.ts";
import {
  CAUSAL_STATE_KEY,
  CAUSAL_STATE_VERSION,
  createDatasetChange,
  datasetEntries,
  datasetFingerprint,
  datasetFromEntries,
  initialCausalSnapshot,
  mergeCausalSnapshots,
  parseCausalSnapshot,
  type PersistedCausalState,
  readLocalDataset,
} from "./causal.ts";

export type CausalExchangeOptions = {
  readonly local: LocalPort;
  readonly remote: CausalSyncPort;
  readonly deviceId: StableId;
  readonly ids: Pick<IdPort, "next">;
  readonly now: () => string;
  readonly deviceRecords?: () => readonly Device[];
};

export type CausalExchangeResult = {
  readonly snapshot: CausalSnapshot;
  readonly lastSyncedAt: string;
  readonly pendingChangeCount: number;
  readonly conflicts: readonly SyncConflict[];
  readonly pulledChangeIds: readonly StableId[];
  readonly pushedChangeIds: readonly StableId[];
};

function asJsonValue(value: unknown): JsonValue {
  return value as JsonValue;
}

function asObject(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function parsePersistedState(value: unknown): CausalSnapshot {
  const object = asObject(value);
  if (
    object?.type !== "s402-causal-state" ||
    object.version !== CAUSAL_STATE_VERSION ||
    object.snapshot === undefined
  ) {
    throw adapterError("corrupt-data", "sync.causal-state");
  }
  return parseCausalSnapshot(object.snapshot);
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
  return value === undefined ? fallback : parsePersistedState(value);
}

async function persistSnapshot(
  transaction: LocalTransaction,
  snapshot: CausalSnapshot,
  options?: OperationOptions,
): Promise<void> {
  const value: PersistedCausalState = {
    type: "s402-causal-state",
    version: CAUSAL_STATE_VERSION,
    snapshot: structuredClone(snapshot),
  };
  await transaction.put(
    "sync-metadata",
    CAUSAL_STATE_KEY,
    asJsonValue(value),
    options,
  );
}

function appendLocalChange(
  snapshot: CausalSnapshot,
  dataset: PortableDataset,
  deviceId: StableId,
  ids: Pick<IdPort, "next">,
): CausalSnapshot {
  if (datasetFingerprint(snapshot.dataset) === datasetFingerprint(dataset)) {
    return snapshot;
  }
  const sequence = snapshot.changes.reduce(
    (maximum, change) =>
      change.actorId === deviceId
        ? Math.max(maximum, change.sequence)
        : maximum,
    0,
  ) + 1;
  const change = createDatasetChange({
    id: ids.next("change"),
    actorId: deviceId,
    sequence,
    parents: snapshot.heads,
    dataset,
  });
  return {
    generation: snapshot.generation,
    heads: [change.id],
    changes: [...snapshot.changes, change],
    dataset: structuredClone(dataset),
  };
}

function pendingCount(
  snapshot: CausalSnapshot,
  remote: CausalSnapshot,
): number {
  const remoteIds = new Set(remote.changes.map((change) => change.id));
  return snapshot.changes.filter((change) => !remoteIds.has(change.id)).length;
}

function withDeviceRecords(
  dataset: PortableDataset,
  deviceRecords: readonly Device[] | undefined,
): PortableDataset {
  if (deviceRecords === undefined) return dataset;
  const devices = new Map<StableId, Device>();
  for (const device of dataset.devices) devices.set(device.id, device);
  for (const device of deviceRecords) {
    devices.set(device.id, structuredClone(device));
  }
  return { ...dataset, devices: [...devices.values()] };
}

async function reconcileLocalTransaction(
  options: CausalExchangeOptions,
  baseSnapshot: CausalSnapshot,
  remoteSnapshot: CausalSnapshot,
  operationOptions?: OperationOptions,
): Promise<CausalSnapshot> {
  let reconciled = baseSnapshot;
  await options.local.transaction("readwrite", async (transaction) => {
    const entries = await transaction.query<JsonValue>(
      "records",
      {},
      operationOptions,
    );
    const currentDataset = withDeviceRecords(
      datasetFromEntries(entries),
      options.deviceRecords?.(),
    );
    const currentSnapshot = appendLocalChange(
      baseSnapshot,
      currentDataset,
      options.deviceId,
      options.ids,
    );
    const merged = mergeCausalSnapshots(currentSnapshot, remoteSnapshot);
    reconciled = merged.snapshot;
    const nextEntries = datasetEntries(reconciled.dataset);
    for (const entry of entries) {
      await transaction.delete("records", entry.key, operationOptions);
    }
    for (const entry of nextEntries) {
      await transaction.put(
        "records",
        entry.key,
        entry.value,
        operationOptions,
      );
    }
    await persistSnapshot(transaction, reconciled, operationOptions);
  }, operationOptions);
  return reconciled;
}

export async function runCausalExchange(
  options: CausalExchangeOptions,
  operationOptions?: OperationOptions,
): Promise<CausalExchangeResult> {
  const localDataset = withDeviceRecords(
    await readLocalDataset(options.local, operationOptions),
    options.deviceRecords?.(),
  );
  let localSnapshot = await readPersistedSnapshot(
    options.local,
    initialCausalSnapshot(),
    operationOptions,
  );
  localSnapshot = appendLocalChange(
    localSnapshot,
    localDataset,
    options.deviceId,
    options.ids,
  );
  await options.local.transaction(
    "readwrite",
    (transaction) =>
      persistSnapshot(transaction, localSnapshot, operationOptions),
    operationOptions,
  );

  // This is deliberately a separate read from the upload. The remote state
  // is always observed before a packet containing local changes is pushed.
  const remoteBefore = await options.remote.read(operationOptions);
  const pulled = remoteBefore.changes
    .filter((change) =>
      !localSnapshot.changes.some((known) => known.id === change.id)
    )
    .map((change) => change.id);
  const pulledLocal = await reconcileLocalTransaction(
    options,
    localSnapshot,
    remoteBefore,
    operationOptions,
  );
  const upload = await options.remote.applyPacket(
    {
      generation: pulledLocal.generation,
      heads: pulledLocal.heads,
      changes: pulledLocal.changes.map((change) => structuredClone(change)),
    },
    operationOptions,
  );
  const finalSnapshot = await reconcileLocalTransaction(
    options,
    pulledLocal,
    upload.snapshot,
    operationOptions,
  );
  const conflicts = [
    ...upload.conflicts,
  ];
  return {
    snapshot: finalSnapshot,
    lastSyncedAt: options.now(),
    pendingChangeCount: pendingCount(finalSnapshot, upload.snapshot),
    conflicts,
    pulledChangeIds: pulled,
    pushedChangeIds: upload.appliedChangeIds,
  };
}
