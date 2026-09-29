import * as Automerge from "@automerge/automerge";
import {
  ADAPTER_DIAGNOSTIC_OPERATIONS,
  type AdapterError,
  adapterError,
  isAdapterError,
  mapAdapterError,
} from "../ports/errors.ts";
import {
  cloneJson,
  type JsonObject,
  type JsonValue,
  type OperationOptions,
} from "../ports/common.ts";
import {
  LOCAL_COLLECTIONS,
  type LocalCollection,
  type LocalKey,
  type LocalPort,
} from "../ports/local.ts";
import {
  parseCurrentDataset,
  type PortableDataset,
} from "../../domain/index.ts";

export const LOCAL_DATABASE_NAME = "did-it-become-what-you-like";
export const LOCAL_DATABASE_VERSION = 2;
export const LOCAL_DOCUMENT_KEY = "current";
export const LOCAL_SCHEMA_VERSION = 1;

export const RECORD_STORE = "records";
export const SETTINGS_STORE = "settings";
export const SYNC_METADATA_STORE = "sync-metadata";
export const WORKFLOW_STORE = "workflow-snapshots";
export const PROJECTION_STORE = "repository-projections";
export const DOCUMENT_STORE = "repository-documents";
export const BACKUP_STORE = "repository-backups";

export const PUBLIC_STORES = [
  RECORD_STORE,
  SETTINGS_STORE,
  SYNC_METADATA_STORE,
  WORKFLOW_STORE,
] as const;

export const ALL_STORES = [
  ...PUBLIC_STORES,
  PROJECTION_STORE,
  DOCUMENT_STORE,
  BACKUP_STORE,
] as const;

export type PublicStoreName = typeof PUBLIC_STORES[number];

export type StoredEntry = {
  readonly key: string;
  readonly value: JsonValue;
};

export type LocalRevision = {
  readonly type: "local-revision";
  readonly collection: LocalCollection;
  readonly key: string;
  readonly revision: number;
  readonly deviceId: string;
  readonly recordedAt: string;
};

export type LocalTombstone = {
  readonly type: "local-tombstone";
  readonly collection: LocalCollection;
  readonly key: string;
  readonly revision: number;
  readonly deletedBy: string;
  readonly deletedAt: string;
};

export type LocalDocument = {
  readonly schemaVersion: number;
  readonly generation: number;
  readonly records: Record<string, JsonValue>;
  readonly tombstones: Record<string, LocalTombstone>;
};

export type StoredDocument = {
  readonly key: typeof LOCAL_DOCUMENT_KEY;
  readonly schemaVersion: number;
  readonly savedAt: string;
  readonly bytes: Uint8Array;
};

export type StoredBackup = {
  readonly id: string;
  readonly schemaVersion: number;
  readonly sequence: number;
  readonly savedAt: string;
  readonly bytes: Uint8Array;
};

export type ProjectionEntry = {
  readonly id: string;
  readonly collection: LocalCollection;
  readonly index: string;
  readonly value: string | number | boolean | null;
  readonly key: string;
};

export type LocalRecoveryState = {
  readonly recovered: boolean;
  readonly source: "backup" | "rebuild" | "none";
};

export type LocalRepositoryOptions = {
  readonly databaseName?: string;
  readonly deviceId?: string;
  readonly now?: () => string;
  readonly indexedDB?: IDBFactory;
  readonly keyRange?: typeof IDBKeyRange;
  /** Test-only failure injection; production callers should omit this. */
  readonly beforeRequest?: (operation: string) => void;
};

export type LocalRepository = LocalPort & {
  readonly databaseName: string;
  readonly deviceId: string;
  readonly recovery: LocalRecoveryState;
  subscribeRecords?(listener: () => void): () => void;
  loadDocument(): Promise<Automerge.Doc<LocalDocument>>;
  rebuildProjections(options?: OperationOptions): Promise<void>;
  exportDataset(options?: OperationOptions): Promise<string>;
  importDataset(
    json: string,
    mode: "merge" | "replace",
    options?: OperationOptions,
  ): Promise<PortableDataset>;
  close(): void;
};

export type MutableDocument = {
  schemaVersion: number;
  generation: number;
  records: Record<string, JsonValue>;
  tombstones: Record<string, LocalTombstone>;
};

export type MutableTransactionContext = {
  document: Automerge.Doc<LocalDocument>;
  backupWritten: boolean;
  backupSequence: number;
};

export function assertCollection(collection: LocalCollection): void {
  if (!(LOCAL_COLLECTIONS as readonly string[]).includes(collection)) {
    throw adapterError("invalid-request", "local.collection");
  }
}

export function assertKey(key: LocalKey): void {
  if (typeof key !== "string") {
    throw adapterError("invalid-request", "local.key");
  }
}

export function publicStore(collection: LocalCollection): PublicStoreName {
  assertCollection(collection);
  return collection;
}

export function identity(collection: LocalCollection, key: string): string {
  return JSON.stringify([collection, key]);
}

export function defaultDeviceId(): string {
  return globalThis.crypto?.randomUUID?.() ??
    `device-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function automergeActorId(deviceId: string): string {
  const hexadecimal = deviceId.replace(/[^0-9a-f]/gi, "").toLowerCase();
  return (hexadecimal || "0").padEnd(32, "0").slice(0, 32);
}

export function safeDatabaseName(name: string): string {
  if (
    name !== LOCAL_DATABASE_NAME &&
    !name.startsWith(`${LOCAL_DATABASE_NAME}-`)
  ) {
    throw adapterError("invalid-request", "local.database-name");
  }
  return name;
}

export function emptyDocument(deviceId: string): Automerge.Doc<LocalDocument> {
  return Automerge.from<LocalDocument>({
    schemaVersion: LOCAL_SCHEMA_VERSION,
    generation: 1,
    records: {},
    tombstones: {},
  }, { actor: automergeActorId(deviceId) });
}

export function changeDocument(
  document: Automerge.Doc<LocalDocument>,
  message: string,
  operation: (draft: MutableDocument) => void,
): Automerge.Doc<LocalDocument> {
  return Automerge.change(document, message, (draft: unknown) => {
    operation(draft as unknown as MutableDocument);
  });
}

export function request<T>(
  idbRequest: IDBRequest<T>,
  operation: string,
  beforeRequest?: (operation: string) => void,
): Promise<T> {
  try {
    beforeRequest?.(operation);
  } catch (error) {
    return Promise.reject(
      isAdapterError(error) ? error : mapIndexedDbError(error, operation),
    );
  }
  return new Promise<T>((resolve, reject) => {
    idbRequest.onsuccess = () => resolve(idbRequest.result);
    idbRequest.onerror = () => {
      reject(mapIndexedDbError(idbRequest.error, operation));
    };
  });
}

export function mapIndexedDbError(
  error: unknown,
  operation: string,
): AdapterError {
  const name = error && typeof error === "object" && "name" in error
    ? (error as { name?: unknown }).name
    : undefined;
  switch (name) {
    case "AbortError":
      return adapterError("aborted", operation);
    case "QuotaExceededError":
      return adapterError(
        "quota",
        ADAPTER_DIAGNOSTIC_OPERATIONS.localQuotaExceeded,
      );
    case "ConstraintError":
      return adapterError("conflict", operation);
    case "DataError":
    case "TypeMismatchError":
      return adapterError("invalid-request", operation);
    case "VersionError":
      return adapterError("unsupported", operation);
    case "InvalidStateError":
    case "NotFoundError":
      return adapterError("unavailable", operation);
    default:
      return mapAdapterError(error, operation);
  }
}

export function idbDone(
  transaction: IDBTransaction,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () =>
      reject(
        mapIndexedDbError(
          transaction.error,
          ADAPTER_DIAGNOSTIC_OPERATIONS.localTransactionAbort,
        ),
      );
    transaction.onerror = () =>
      reject(
        mapIndexedDbError(
          transaction.error,
          ADAPTER_DIAGNOSTIC_OPERATIONS.localTransactionAbort,
        ),
      );
  });
}

export function createStores(database: IDBDatabase, oldVersion: number): void {
  if (oldVersion < 1) {
    for (const storeName of PUBLIC_STORES) {
      database.createObjectStore(storeName, { keyPath: "key" });
    }
  }
  if (oldVersion < 2) {
    const projections = database.createObjectStore(PROJECTION_STORE, {
      keyPath: "id",
    });
    projections.createIndex(
      "lookup",
      ["collection", "index", "value"],
      { unique: false },
    );
    projections.createIndex("by-collection", "collection", {
      unique: false,
    });
    database.createObjectStore(DOCUMENT_STORE, { keyPath: "key" });
    const backups = database.createObjectStore(BACKUP_STORE, {
      keyPath: "id",
    });
    backups.createIndex("by-sequence", "sequence", { unique: true });
  }
}

export function openDatabase(
  factory: IDBFactory,
  name: string,
  beforeRequest?: (operation: string) => void,
): Promise<IDBDatabase> {
  let openRequest: IDBOpenDBRequest;
  try {
    beforeRequest?.("local.database.open");
    openRequest = factory.open(name, LOCAL_DATABASE_VERSION);
  } catch (error) {
    return Promise.reject(
      isAdapterError(error)
        ? error
        : mapIndexedDbError(error, "local.database.open"),
    );
  }
  return new Promise<IDBDatabase>((resolve, reject) => {
    openRequest.onupgradeneeded = (event) => {
      try {
        createStores(
          openRequest.result,
          (event as IDBVersionChangeEvent).oldVersion,
        );
      } catch (error) {
        reject(mapAdapterError(error, "local.database.migrate"));
      }
    };
    openRequest.onsuccess = () => {
      const database = openRequest.result;
      database.onversionchange = () => database.close();
      resolve(database);
    };
    openRequest.onerror = () =>
      reject(mapIndexedDbError(openRequest.error, "local.database.open"));
    openRequest.onblocked = () =>
      reject(
        adapterError(
          "unavailable",
          ADAPTER_DIAGNOSTIC_OPERATIONS.localDbBlocked,
        ),
      );
  });
}

export function toJsonObject(value: unknown): JsonObject | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  return value as JsonObject;
}

export function projectionValue(
  value: JsonValue,
  index: string,
): string | number | boolean | null | undefined {
  const object = toJsonObject(value);
  const indexed = object?.[index];
  if (
    indexed === null || typeof indexed === "string" ||
    typeof indexed === "number" || typeof indexed === "boolean"
  ) return indexed;
  return undefined;
}

export function projectionId(
  collection: LocalCollection,
  index: string,
  value: string | number | boolean | null,
  key: string,
): string {
  return JSON.stringify([collection, index, value, key]);
}

export async function readAllEntries(
  store: IDBObjectStore,
  operation: string,
  beforeRequest?: (operation: string) => void,
): Promise<StoredEntry[]> {
  const values = await request(
    store.getAll(),
    operation,
    beforeRequest,
  ) as StoredEntry[];
  return values.map((entry) => ({
    key: entry.key,
    value: cloneJson(entry.value),
  }));
}

export function sortEntries(entries: StoredEntry[]): StoredEntry[] {
  return entries.sort((left, right) => left.key.localeCompare(right.key, "en"));
}

export function revisionKey(collection: LocalCollection, key: string): string {
  return `revision:${collection}:${key}`;
}

export function tombstoneKey(collection: LocalCollection, key: string): string {
  return `tombstone:${collection}:${key}`;
}

export function nextRevision(value: JsonValue | undefined): number {
  const object = toJsonObject(value);
  const revision = object?.revision;
  return typeof revision === "number" && Number.isSafeInteger(revision) &&
      revision >= 0
    ? revision + 1
    : 1;
}

export async function readRevision(
  transaction: IDBTransaction,
  collection: LocalCollection,
  key: string,
  options: LocalRepositoryOptions,
): Promise<number> {
  const entry = await request(
    transaction.objectStore(SYNC_METADATA_STORE).get(
      revisionKey(collection, key),
    ),
    "local.revision.get",
    options.beforeRequest,
  ) as StoredEntry | undefined;
  return nextRevision(entry?.value);
}

export async function writeProjection(
  transaction: IDBTransaction,
  collection: LocalCollection,
  key: string,
  value: JsonValue,
  options: LocalRepositoryOptions,
): Promise<void> {
  const store = transaction.objectStore(PROJECTION_STORE);
  const object = toJsonObject(value);
  if (!object) return;
  for (const [index] of Object.entries(object)) {
    const scalar = projectionValue(value, index);
    if (scalar === undefined) continue;
    const entry: ProjectionEntry = {
      id: projectionId(collection, index, scalar, key),
      collection,
      index,
      value: scalar,
      key,
    };
    await request(
      store.put(entry),
      "local.projection.put",
      options.beforeRequest,
    );
  }
}

export async function deleteProjections(
  transaction: IDBTransaction,
  collection: LocalCollection,
  key: string,
  options: LocalRepositoryOptions,
): Promise<void> {
  const store = transaction.objectStore(PROJECTION_STORE);
  const entries = await request(
    store.index("by-collection").getAll(collection),
    "local.projection.list",
    options.beforeRequest,
  ) as ProjectionEntry[];
  for (const entry of entries) {
    if (entry.key === key) {
      await request(
        store.delete(entry.id),
        "local.projection.delete",
        options.beforeRequest,
      );
    }
  }
}

export function updateDocument(
  document: Automerge.Doc<LocalDocument>,
  collection: LocalCollection,
  key: string,
  value: JsonValue | undefined,
  tombstone: LocalTombstone | undefined,
): Automerge.Doc<LocalDocument> {
  if (collection !== RECORD_STORE) return document;
  const recordKey = identity(collection, key);
  return changeDocument(
    document,
    value === undefined ? "delete record" : "put record",
    (draft) => {
      if (value === undefined) {
        delete draft.records[recordKey];
        if (tombstone) draft.tombstones[recordKey] = tombstone;
      } else {
        draft.records[recordKey] = cloneJson(value);
      }
    },
  );
}

export function documentBytes(
  document: Automerge.Doc<LocalDocument>,
): Uint8Array {
  return new Uint8Array(Automerge.save(document));
}

export function loadAutomergeDocument(
  bytes: Uint8Array,
  operation: string,
): Automerge.Doc<LocalDocument> {
  try {
    const document = Automerge.load<LocalDocument>(bytes);
    if (
      document.schemaVersion !== LOCAL_SCHEMA_VERSION ||
      !document.records || !document.tombstones
    ) {
      throw new Error("unsupported local document");
    }
    return document;
  } catch {
    throw adapterError("corrupt-data", operation);
  }
}

export function documentFromEntries(
  entries: readonly StoredEntry[],
  deviceId: string,
): Automerge.Doc<LocalDocument> {
  let document = emptyDocument(deviceId);
  const records: Record<string, JsonValue> = {};
  for (const entry of sortEntries([...entries])) {
    records[identity(RECORD_STORE, entry.key)] = cloneJson(entry.value);
  }
  document = changeDocument(document, "rebuild local document", (draft) => {
    draft.records = records;
  });
  return document;
}

export function localDatasetFromEntries(
  entries: readonly StoredEntry[],
): PortableDataset {
  const groups: Record<string, unknown[]> = {
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
  let settings: unknown;
  for (const entry of entries) {
    const object = toJsonObject(entry.value);
    const type = object?.type;
    if (type === "portable-settings") {
      settings = entry.value;
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
    if (group && group in groups) groups[group].push(entry.value);
  }
  if (settings === undefined) {
    throw adapterError("corrupt-data", "local.dataset.export");
  }
  try {
    return parseCurrentDataset({
      schemaVersion: LOCAL_SCHEMA_VERSION,
      format: "did-it-become-what-you-like/dataset",
      ...groups,
      settings,
    });
  } catch {
    throw adapterError("corrupt-data", "local.dataset.export");
  }
}

export function datasetRecords(dataset: PortableDataset): StoredEntry[] {
  const values: JsonValue[] = [
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
  return values.map((value) => {
    const object = toJsonObject(value);
    const key = typeof object?.id === "string" ? object.id : undefined;
    if (!key) throw adapterError("invalid-request", "local.dataset.import");
    return { key, value: cloneJson(value) };
  });
}
