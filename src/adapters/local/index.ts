import * as Automerge from "@automerge/automerge";
import {
  type AdapterError,
  adapterError,
  isAdapterError,
  mapAdapterError,
} from "../ports/errors.ts";
import {
  assertValidRetryPolicy,
  cloneJson,
  type JsonObject,
  type JsonValue,
  type OperationOptions,
  throwIfAborted,
} from "../ports/common.ts";
import {
  LOCAL_COLLECTIONS,
  type LocalCollection,
  type LocalEntry,
  type LocalKey,
  type LocalPort,
  type LocalQuery,
  type LocalTransaction,
  type LocalTransactionMode,
} from "../ports/local.ts";
import {
  exportDataset as exportPortableDataset,
  migrateToCurrent,
  parseCurrentDataset,
  type PortableDataset,
} from "../../domain/index.ts";

export const LOCAL_DATABASE_NAME = "did-it-become-what-you-like";
export const LOCAL_DATABASE_VERSION = 2;
export const LOCAL_DOCUMENT_KEY = "current";
export const LOCAL_SCHEMA_VERSION = 1;

const RECORD_STORE = "records";
const SETTINGS_STORE = "settings";
const SYNC_METADATA_STORE = "sync-metadata";
const WORKFLOW_STORE = "workflow-snapshots";
const PROJECTION_STORE = "repository-projections";
const DOCUMENT_STORE = "repository-documents";
const BACKUP_STORE = "repository-backups";

const PUBLIC_STORES = [
  RECORD_STORE,
  SETTINGS_STORE,
  SYNC_METADATA_STORE,
  WORKFLOW_STORE,
] as const;
const ALL_STORES = [
  ...PUBLIC_STORES,
  PROJECTION_STORE,
  DOCUMENT_STORE,
  BACKUP_STORE,
] as const;

type PublicStoreName = typeof PUBLIC_STORES[number];

type StoredEntry = {
  readonly key: string;
  readonly value: JsonValue;
};

type LocalRevision = {
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

type StoredDocument = {
  readonly key: typeof LOCAL_DOCUMENT_KEY;
  readonly schemaVersion: number;
  readonly savedAt: string;
  readonly bytes: Uint8Array;
};

type StoredBackup = {
  readonly id: string;
  readonly schemaVersion: number;
  readonly sequence: number;
  readonly savedAt: string;
  readonly bytes: Uint8Array;
};

type ProjectionEntry = {
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

type MutableDocument = {
  schemaVersion: number;
  generation: number;
  records: Record<string, JsonValue>;
  tombstones: Record<string, LocalTombstone>;
};

type MutableTransactionContext = {
  document: Automerge.Doc<LocalDocument>;
  backupWritten: boolean;
  backupSequence: number;
};

function assertCollection(collection: LocalCollection): void {
  if (!(LOCAL_COLLECTIONS as readonly string[]).includes(collection)) {
    throw adapterError("invalid-request", "local.collection");
  }
}

function assertKey(key: LocalKey): void {
  if (typeof key !== "string") {
    throw adapterError("invalid-request", "local.key");
  }
}

function publicStore(collection: LocalCollection): PublicStoreName {
  assertCollection(collection);
  return collection;
}

function identity(collection: LocalCollection, key: string): string {
  return JSON.stringify([collection, key]);
}

function defaultDeviceId(): string {
  return globalThis.crypto?.randomUUID?.() ??
    `device-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function automergeActorId(deviceId: string): string {
  const hexadecimal = deviceId.replace(/[^0-9a-f]/gi, "").toLowerCase();
  return (hexadecimal || "0").padEnd(32, "0").slice(0, 32);
}

function safeDatabaseName(name: string): string {
  if (
    name !== LOCAL_DATABASE_NAME &&
    !name.startsWith(`${LOCAL_DATABASE_NAME}-`)
  ) {
    throw adapterError("invalid-request", "local.database-name");
  }
  return name;
}

function emptyDocument(deviceId: string): Automerge.Doc<LocalDocument> {
  return Automerge.from<LocalDocument>({
    schemaVersion: LOCAL_SCHEMA_VERSION,
    generation: 1,
    records: {},
    tombstones: {},
  }, { actor: automergeActorId(deviceId) });
}

function changeDocument(
  document: Automerge.Doc<LocalDocument>,
  message: string,
  operation: (draft: MutableDocument) => void,
): Automerge.Doc<LocalDocument> {
  return Automerge.change(document, message, (draft: unknown) => {
    operation(draft as unknown as MutableDocument);
  });
}

function request<T>(
  idbRequest: IDBRequest<T>,
  operation: string,
  beforeRequest?: (operation: string) => void,
): Promise<T> {
  try {
    beforeRequest?.(operation);
  } catch (error) {
    return Promise.reject(
      isAdapterError(error) ? error : mapAdapterError(error, operation),
    );
  }
  return new Promise<T>((resolve, reject) => {
    idbRequest.onsuccess = () => resolve(idbRequest.result);
    idbRequest.onerror = () => {
      reject(mapIndexedDbError(idbRequest.error, operation));
    };
  });
}

function mapIndexedDbError(error: unknown, operation: string): AdapterError {
  const name = error && typeof error === "object" && "name" in error
    ? (error as { name?: unknown }).name
    : undefined;
  switch (name) {
    case "AbortError":
      return adapterError("aborted", operation);
    case "QuotaExceededError":
      return adapterError("quota", operation);
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

function idbDone(
  transaction: IDBTransaction,
  operation: string,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () =>
      reject(mapIndexedDbError(transaction.error, operation));
    transaction.onerror = () =>
      reject(mapIndexedDbError(transaction.error, operation));
  });
}

function createStores(database: IDBDatabase, oldVersion: number): void {
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

function openDatabase(
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
      reject(adapterError("unavailable", "local.database.open"));
  });
}

function toJsonObject(value: unknown): JsonObject | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  return value as JsonObject;
}

function projectionValue(
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

function projectionId(
  collection: LocalCollection,
  index: string,
  value: string | number | boolean | null,
  key: string,
): string {
  return JSON.stringify([collection, index, value, key]);
}

async function readAllEntries(
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

function sortEntries(entries: StoredEntry[]): StoredEntry[] {
  return entries.sort((left, right) => left.key.localeCompare(right.key, "en"));
}

function revisionKey(collection: LocalCollection, key: string): string {
  return `revision:${collection}:${key}`;
}

function tombstoneKey(collection: LocalCollection, key: string): string {
  return `tombstone:${collection}:${key}`;
}

function nextRevision(value: JsonValue | undefined): number {
  const object = toJsonObject(value);
  const revision = object?.revision;
  return typeof revision === "number" && Number.isSafeInteger(revision) &&
      revision >= 0
    ? revision + 1
    : 1;
}

async function readRevision(
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

async function writeProjection(
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

async function deleteProjections(
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

function updateDocument(
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

function documentBytes(document: Automerge.Doc<LocalDocument>): Uint8Array {
  return new Uint8Array(Automerge.save(document));
}

function loadAutomergeDocument(
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

function documentFromEntries(
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

function localDatasetFromEntries(
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

function datasetRecords(dataset: PortableDataset): StoredEntry[] {
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

class IndexedDbLocalRepository implements LocalRepository {
  readonly databaseName: string;
  readonly deviceId: string;
  private readonly database: IDBDatabase;
  private readonly options: LocalRepositoryOptions;
  private closed = false;
  private recoveryState: LocalRecoveryState = {
    recovered: false,
    source: "none",
  };

  private constructor(
    database: IDBDatabase,
    options: LocalRepositoryOptions,
  ) {
    this.database = database;
    this.options = options;
    this.databaseName = safeDatabaseName(
      options.databaseName ?? LOCAL_DATABASE_NAME,
    );
    this.deviceId = options.deviceId ?? defaultDeviceId();
  }

  get recovery(): LocalRecoveryState {
    return this.recoveryState;
  }

  static async open(options: LocalRepositoryOptions): Promise<LocalRepository> {
    const name = safeDatabaseName(options.databaseName ?? LOCAL_DATABASE_NAME);
    const factory = options.indexedDB ?? globalThis.indexedDB;
    if (!factory) throw adapterError("unavailable", "local.database.open");
    const database = await openDatabase(factory, name, options.beforeRequest);
    const repository = new IndexedDbLocalRepository(database, options);
    try {
      await repository.hydrate();
      return repository;
    } catch (error) {
      database.close();
      throw isAdapterError(error)
        ? error
        : mapAdapterError(error, "local.database.hydrate");
    }
  }

  private ensureOpen(): void {
    if (this.closed) throw adapterError("unavailable", "local.database.closed");
  }

  private async hydrate(): Promise<void> {
    this.ensureOpen();
    const transaction = this.database.transaction(
      [...ALL_STORES],
      "readonly",
    );
    const done = idbDone(transaction, "local.database.hydrate");
    let documentEntry: StoredDocument | undefined;
    let records: StoredEntry[] = [];
    let recoveryCandidate: {
      backup: StoredBackup;
      document: Automerge.Doc<LocalDocument>;
    } | undefined;
    try {
      documentEntry = await request(
        transaction.objectStore(DOCUMENT_STORE).get(LOCAL_DOCUMENT_KEY),
        "local.document.get",
        this.options.beforeRequest,
      ) as StoredDocument | undefined;
      records = await readAllEntries(
        transaction.objectStore(RECORD_STORE),
        "local.records.hydrate",
        this.options.beforeRequest,
      );
      if (documentEntry) {
        try {
          loadAutomergeDocument(documentEntry.bytes, "local.document.load");
        } catch {
          const backups = await request(
            transaction.objectStore(BACKUP_STORE).getAll(),
            "local.backup.list",
            this.options.beforeRequest,
          ) as StoredBackup[];
          recoveryCandidate = backups
            .sort((left, right) => right.sequence - left.sequence)
            .map((backup) => {
              try {
                return {
                  backup,
                  document: loadAutomergeDocument(
                    backup.bytes,
                    "local.backup.load",
                  ),
                };
              } catch {
                return undefined;
              }
            })
            .find((candidate) => candidate !== undefined);
          if (!recoveryCandidate) {
            throw adapterError("corrupt-data", "local.document.load");
          }
        }
      }
      await done;
    } catch (error) {
      try {
        transaction.abort();
      } catch {
        // The transaction may already have aborted.
      }
      await done.catch(() => undefined);
      throw isAdapterError(error)
        ? error
        : mapAdapterError(error, "local.database.hydrate");
    }
    if (!documentEntry) {
      const document = documentFromEntries(records, this.deviceId);
      await this.persistInitialDocument(document);
      return;
    }
    if (recoveryCandidate) {
      await this.recoverDocument(
        recoveryCandidate.document,
        recoveryCandidate.backup,
      );
    }
  }

  private async persistInitialDocument(
    document: Automerge.Doc<LocalDocument>,
  ): Promise<void> {
    const transaction = this.database.transaction(
      [...ALL_STORES],
      "readwrite",
    );
    const done = idbDone(transaction, "local.document.initialize");
    try {
      const current = await request(
        transaction.objectStore(DOCUMENT_STORE).get(LOCAL_DOCUMENT_KEY),
        "local.document.recheck",
        this.options.beforeRequest,
      );
      if (!current) {
        const value: StoredDocument = {
          key: LOCAL_DOCUMENT_KEY,
          schemaVersion: LOCAL_SCHEMA_VERSION,
          savedAt: this.now(),
          bytes: documentBytes(document),
        };
        await request(
          transaction.objectStore(DOCUMENT_STORE).put(value),
          "local.document.initialize",
          this.options.beforeRequest,
        );
      }
    } catch (error) {
      try {
        transaction.abort();
      } catch {
        // The transaction may already have aborted.
      }
      await done.catch(() => undefined);
      throw isAdapterError(error)
        ? error
        : mapAdapterError(error, "local.document.initialize");
    }
    await done;
  }

  private async recoverDocument(
    document: Automerge.Doc<LocalDocument>,
    backup: StoredBackup,
  ): Promise<void> {
    const transaction = this.database.transaction(
      [...ALL_STORES],
      "readwrite",
    );
    const done = idbDone(transaction, "local.document.recover");
    try {
      const value: StoredDocument = {
        key: LOCAL_DOCUMENT_KEY,
        schemaVersion: LOCAL_SCHEMA_VERSION,
        savedAt: this.now(),
        bytes: documentBytes(document),
      };
      await request(
        transaction.objectStore(DOCUMENT_STORE).put(value),
        "local.document.recover",
        this.options.beforeRequest,
      );
      await request(
        transaction.objectStore(RECORD_STORE).clear(),
        "local.records.recover-clear",
        this.options.beforeRequest,
      );
      await request(
        transaction.objectStore(PROJECTION_STORE).clear(),
        "local.projections.recover-clear",
        this.options.beforeRequest,
      );
      for (const [recordKey, rawRecord] of Object.entries(document.records)) {
        const record = rawRecord as unknown as JsonValue;
        let decoded: unknown;
        try {
          decoded = JSON.parse(recordKey) as unknown;
        } catch {
          throw adapterError("corrupt-data", "local.document.recover");
        }
        if (
          !Array.isArray(decoded) || decoded.length !== 2 ||
          decoded[0] !== RECORD_STORE || typeof decoded[1] !== "string"
        ) {
          throw adapterError("corrupt-data", "local.document.recover");
        }
        const key = decoded[1];
        await request(
          transaction.objectStore(RECORD_STORE).put(
            {
              key,
              value: cloneJson(record),
            } satisfies StoredEntry,
          ),
          "local.records.recover-put",
          this.options.beforeRequest,
        );
        await writeProjection(
          transaction,
          RECORD_STORE,
          key,
          record,
          this.options,
        );
      }
      await request(
        transaction.objectStore(SYNC_METADATA_STORE).put(
          {
            key: "local-recovery",
            value: {
              type: "local-recovery",
              source: "backup",
              sequence: backup.sequence,
              recoveredAt: this.now(),
            },
          } satisfies StoredEntry,
        ),
        "local.recovery.record",
        this.options.beforeRequest,
      );
    } catch (error) {
      try {
        transaction.abort();
      } catch {
        // The transaction may already have aborted.
      }
      await done.catch(() => undefined);
      throw isAdapterError(error)
        ? error
        : mapAdapterError(error, "local.document.recover");
    }
    await done;
    this.recoveryState = { recovered: true, source: "backup" };
  }

  private now(): string {
    return this.options.now?.() ?? new Date().toISOString();
  }

  private async backupCurrent(
    transaction: IDBTransaction,
    context: MutableTransactionContext,
  ): Promise<void> {
    if (context.backupWritten) return;
    const current = await request(
      transaction.objectStore(DOCUMENT_STORE).get(LOCAL_DOCUMENT_KEY),
      "local.document.backup-read",
      this.options.beforeRequest,
    ) as StoredDocument | undefined;
    context.backupWritten = true;
    if (!current) return;
    const backups = await request(
      transaction.objectStore(BACKUP_STORE).getAll(),
      "local.backup.sequence",
      this.options.beforeRequest,
    ) as StoredBackup[];
    const sequence = backups.reduce(
      (maximum, backup) => Math.max(maximum, backup.sequence),
      0,
    ) + 1;
    context.backupSequence = sequence;
    const backup: StoredBackup = {
      id: `backup-${sequence}`,
      schemaVersion: LOCAL_SCHEMA_VERSION,
      sequence,
      savedAt: current.savedAt,
      bytes: new Uint8Array(current.bytes),
    };
    await request(
      transaction.objectStore(BACKUP_STORE).put(backup),
      "local.backup.write",
      this.options.beforeRequest,
    );
    if (backups.length >= 5) {
      const oldest = [...backups].sort((left, right) =>
        left.sequence - right.sequence
      )[0];
      if (oldest) {
        await request(
          transaction.objectStore(BACKUP_STORE).delete(oldest.id),
          "local.backup.prune",
          this.options.beforeRequest,
        );
      }
    }
  }

  private async writeValue(
    transaction: IDBTransaction,
    context: MutableTransactionContext,
    collection: LocalCollection,
    key: string,
    value: JsonValue,
    options: OperationOptions | undefined,
  ): Promise<void> {
    throwIfAborted(options?.signal);
    assertValidRetryPolicy(
      options?.retry ?? { maxAttempts: 1, directive: "never" },
    );
    await this.backupCurrent(transaction, context);
    const revision = await readRevision(
      transaction,
      collection,
      key,
      this.options,
    );
    const recordedAt = this.now();
    const revisionValue: LocalRevision = {
      type: "local-revision",
      collection,
      key,
      revision,
      deviceId: this.deviceId,
      recordedAt,
    };
    const store = transaction.objectStore(publicStore(collection));
    const entry: StoredEntry = { key, value: cloneJson(value) };
    await request(
      store.put(entry),
      "local.value.put",
      this.options.beforeRequest,
    );
    await deleteProjections(transaction, collection, key, this.options);
    await writeProjection(transaction, collection, key, value, this.options);
    await request(
      transaction.objectStore(SYNC_METADATA_STORE).put(
        {
          key: revisionKey(collection, key),
          value: revisionValue,
        } satisfies StoredEntry,
      ),
      "local.revision.put",
      this.options.beforeRequest,
    );
    await deleteProjections(
      transaction,
      SYNC_METADATA_STORE,
      revisionKey(collection, key),
      this.options,
    );
    await writeProjection(
      transaction,
      SYNC_METADATA_STORE,
      revisionKey(collection, key),
      revisionValue,
      this.options,
    );
    context.document = updateDocument(
      context.document,
      collection,
      key,
      value,
      undefined,
    );
    if (collection === RECORD_STORE) {
      await request(
        transaction.objectStore(DOCUMENT_STORE).put(
          {
            key: LOCAL_DOCUMENT_KEY,
            schemaVersion: LOCAL_SCHEMA_VERSION,
            savedAt: recordedAt,
            bytes: documentBytes(context.document),
          } satisfies StoredDocument,
        ),
        "local.document.put",
        this.options.beforeRequest,
      );
    }
  }

  private async deleteValue(
    transaction: IDBTransaction,
    context: MutableTransactionContext,
    collection: LocalCollection,
    key: string,
    options: OperationOptions | undefined,
  ): Promise<void> {
    throwIfAborted(options?.signal);
    assertValidRetryPolicy(
      options?.retry ?? { maxAttempts: 1, directive: "never" },
    );
    await this.backupCurrent(transaction, context);
    const revision = await readRevision(
      transaction,
      collection,
      key,
      this.options,
    );
    const deletedAt = this.now();
    const tombstone: LocalTombstone = {
      type: "local-tombstone",
      collection,
      key,
      revision,
      deletedBy: this.deviceId,
      deletedAt,
    };
    await request(
      transaction.objectStore(publicStore(collection)).delete(key),
      "local.value.delete",
      this.options.beforeRequest,
    );
    await deleteProjections(transaction, collection, key, this.options);
    await request(
      transaction.objectStore(SYNC_METADATA_STORE).put(
        {
          key: revisionKey(collection, key),
          value: {
            type: "local-revision",
            collection,
            key,
            revision,
            deviceId: this.deviceId,
            recordedAt: deletedAt,
          } satisfies LocalRevision,
        } satisfies StoredEntry,
      ),
      "local.revision.put",
      this.options.beforeRequest,
    );
    const revisionValue: LocalRevision = {
      type: "local-revision",
      collection,
      key,
      revision,
      deviceId: this.deviceId,
      recordedAt: deletedAt,
    };
    await deleteProjections(
      transaction,
      SYNC_METADATA_STORE,
      revisionKey(collection, key),
      this.options,
    );
    await writeProjection(
      transaction,
      SYNC_METADATA_STORE,
      revisionKey(collection, key),
      revisionValue,
      this.options,
    );
    await request(
      transaction.objectStore(SYNC_METADATA_STORE).put(
        {
          key: tombstoneKey(collection, key),
          value: tombstone,
        } satisfies StoredEntry,
      ),
      "local.tombstone.put",
      this.options.beforeRequest,
    );
    await deleteProjections(
      transaction,
      SYNC_METADATA_STORE,
      tombstoneKey(collection, key),
      this.options,
    );
    await writeProjection(
      transaction,
      SYNC_METADATA_STORE,
      tombstoneKey(collection, key),
      tombstone,
      this.options,
    );
    context.document = updateDocument(
      context.document,
      collection,
      key,
      undefined,
      tombstone,
    );
    if (collection === RECORD_STORE) {
      await request(
        transaction.objectStore(DOCUMENT_STORE).put(
          {
            key: LOCAL_DOCUMENT_KEY,
            schemaVersion: LOCAL_SCHEMA_VERSION,
            savedAt: deletedAt,
            bytes: documentBytes(context.document),
          } satisfies StoredDocument,
        ),
        "local.document.put",
        this.options.beforeRequest,
      );
    }
  }

  private async makeTransaction(
    mode: LocalTransactionMode,
    work: (transaction: LocalTransaction) => Promise<unknown>,
    options?: OperationOptions,
  ): Promise<unknown> {
    this.ensureOpen();
    throwIfAborted(options?.signal);
    assertValidRetryPolicy(
      options?.retry ?? { maxAttempts: 1, directive: "never" },
    );
    const idbTransaction = this.database.transaction(
      [...ALL_STORES],
      mode,
    );
    const done = idbDone(idbTransaction, "local.transaction");
    let document = emptyDocument(this.deviceId);
    try {
      const current = await request(
        idbTransaction.objectStore(DOCUMENT_STORE).get(LOCAL_DOCUMENT_KEY),
        "local.document.get",
        this.options.beforeRequest,
      ) as StoredDocument | undefined;
      if (current) {
        document = loadAutomergeDocument(current.bytes, "local.document.load");
      }
      const context: MutableTransactionContext = {
        document,
        backupWritten: false,
        backupSequence: 0,
      };
      const localTransaction: LocalTransaction = {
        get: async <T extends JsonValue = JsonValue>(
          collection: LocalCollection,
          key: LocalKey,
          operationOptions?: OperationOptions,
        ): Promise<T | undefined> => {
          assertCollection(collection);
          assertKey(key);
          throwIfAborted(operationOptions?.signal ?? options?.signal);
          const entry = await request(
            idbTransaction.objectStore(publicStore(collection)).get(key),
            "local.value.get",
            this.options.beforeRequest,
          ) as StoredEntry | undefined;
          return entry === undefined ? undefined : cloneJson(entry.value) as T;
        },
        put: async <T extends JsonValue>(
          collection: LocalCollection,
          key: LocalKey,
          value: T,
          operationOptions?: OperationOptions,
        ): Promise<void> => {
          assertCollection(collection);
          assertKey(key);
          if (mode === "readonly") {
            throw adapterError("forbidden", "local.write-in-readonly");
          }
          await this.writeValue(
            idbTransaction,
            context,
            collection,
            key,
            value,
            { ...options, ...operationOptions },
          );
        },
        delete: async (
          collection: LocalCollection,
          key: LocalKey,
          operationOptions?: OperationOptions,
        ): Promise<void> => {
          assertCollection(collection);
          assertKey(key);
          if (mode === "readonly") {
            throw adapterError("forbidden", "local.write-in-readonly");
          }
          await this.deleteValue(
            idbTransaction,
            context,
            collection,
            key,
            { ...options, ...operationOptions },
          );
        },
        query: <T extends JsonValue = JsonValue>(
          collection: LocalCollection,
          query: LocalQuery = {},
          operationOptions?: OperationOptions,
        ): Promise<readonly LocalEntry<T>[]> => {
          assertCollection(collection);
          throwIfAborted(operationOptions?.signal ?? options?.signal);
          return this.queryInTransaction<T>(
            idbTransaction,
            collection,
            query,
          );
        },
      };
      const result = await work(localTransaction);
      await done;
      return result;
    } catch (error) {
      try {
        idbTransaction.abort();
      } catch {
        // The transaction may already have aborted.
      }
      await done.catch(() => undefined);
      throw isAdapterError(error)
        ? error
        : mapAdapterError(error, "local.transaction");
    }
  }

  private async queryInTransaction<T extends JsonValue>(
    transaction: IDBTransaction,
    collection: LocalCollection,
    query: LocalQuery,
  ): Promise<readonly LocalEntry<T>[]> {
    const store = transaction.objectStore(publicStore(collection));
    let entries: StoredEntry[];
    if (query.index !== undefined && query.equals !== undefined) {
      const indexStore = transaction.objectStore(PROJECTION_STORE);
      const keyRange = this.options.keyRange ?? globalThis.IDBKeyRange;
      if (!keyRange) throw adapterError("unavailable", "local.query.index");
      const projections = await request(
        indexStore.index("lookup").getAll(
          keyRange.only([collection, query.index, query.equals]),
        ),
        "local.projection.query",
        this.options.beforeRequest,
      ) as ProjectionEntry[];
      const result: LocalEntry<T>[] = [];
      for (
        const projection of projections.sort((left, right) =>
          left.key.localeCompare(right.key, "en")
        )
      ) {
        const entry = await request(
          store.get(projection.key),
          "local.value.query",
          this.options.beforeRequest,
        ) as StoredEntry | undefined;
        if (entry) {
          result.push({ key: entry.key, value: cloneJson(entry.value) as T });
        }
      }
      return query.limit === undefined ? result : result.slice(0, query.limit);
    }
    entries = sortEntries(
      await readAllEntries(
        store,
        "local.value.query",
        this.options.beforeRequest,
      ),
    );
    if (query.index !== undefined) {
      entries = entries.filter((entry) => {
        const object = toJsonObject(entry.value);
        return object?.[query.index as string] !== undefined;
      });
    }
    const result = entries.map((entry) => ({
      key: entry.key,
      value: cloneJson(entry.value) as T,
    }));
    return query.limit === undefined ? result : result.slice(0, query.limit);
  }

  transaction<T>(
    mode: LocalTransactionMode,
    work: (transaction: LocalTransaction) => Promise<T>,
    options?: OperationOptions,
  ): Promise<T> {
    return this.makeTransaction(mode, work, options) as Promise<T>;
  }

  query<T extends JsonValue = JsonValue>(
    collection: LocalCollection,
    query?: LocalQuery,
    options?: OperationOptions,
  ): Promise<readonly LocalEntry<T>[]> {
    return this.transaction(
      "readonly",
      (transaction) => transaction.query<T>(collection, query, options),
      options,
    );
  }

  async loadDocument(): Promise<Automerge.Doc<LocalDocument>> {
    this.ensureOpen();
    const transaction = this.database.transaction([...ALL_STORES], "readonly");
    const done = idbDone(transaction, "local.document.load");
    try {
      const current = await request(
        transaction.objectStore(DOCUMENT_STORE).get(LOCAL_DOCUMENT_KEY),
        "local.document.load",
        this.options.beforeRequest,
      ) as StoredDocument | undefined;
      await done;
      return current
        ? loadAutomergeDocument(current.bytes, "local.document.load")
        : emptyDocument(this.deviceId);
    } catch (error) {
      try {
        transaction.abort();
      } catch {
        // The transaction may already have aborted.
      }
      await done.catch(() => undefined);
      throw isAdapterError(error)
        ? error
        : mapAdapterError(error, "local.document.load");
    }
  }

  async rebuildProjections(options?: OperationOptions): Promise<void> {
    this.ensureOpen();
    throwIfAborted(options?.signal);
    const idbTransaction = this.database.transaction(
      [...ALL_STORES],
      "readwrite",
    );
    const done = idbDone(idbTransaction, "local.projection.rebuild");
    try {
      const entries = await readAllEntries(
        idbTransaction.objectStore(RECORD_STORE),
        "local.projection.rebuild-read",
        this.options.beforeRequest,
      );
      await request(
        idbTransaction.objectStore(PROJECTION_STORE).clear(),
        "local.projection.clear",
        this.options.beforeRequest,
      );
      for (const entry of sortEntries(entries)) {
        await writeProjection(
          idbTransaction,
          RECORD_STORE,
          entry.key,
          entry.value,
          this.options,
        );
      }
      await done;
    } catch (error) {
      try {
        idbTransaction.abort();
      } catch {
        // The transaction may already have aborted.
      }
      await done.catch(() => undefined);
      throw isAdapterError(error)
        ? error
        : mapAdapterError(error, "local.projection.rebuild");
    }
  }

  async exportDataset(options?: OperationOptions): Promise<string> {
    const entries = await this.query<JsonValue>(RECORD_STORE, {}, options);
    return exportPortableDataset(localDatasetFromEntries(entries));
  }

  async importDataset(
    json: string,
    mode: "merge" | "replace",
    options?: OperationOptions,
  ): Promise<PortableDataset> {
    let dataset: PortableDataset;
    try {
      dataset = migrateToCurrent(JSON.parse(json) as unknown);
    } catch {
      throw adapterError("invalid-request", "local.dataset.import");
    }
    const entries = datasetRecords(dataset);
    await this.transaction("readwrite", async (transaction) => {
      if (mode === "replace") {
        const existing = await transaction.query<JsonValue>(
          RECORD_STORE,
          {},
          options,
        );
        for (const entry of existing) {
          await transaction.delete(RECORD_STORE, entry.key, options);
        }
      }
      for (const entry of entries) {
        await transaction.put(RECORD_STORE, entry.key, entry.value, options);
      }
    }, options);
    return dataset;
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.database.close();
  }
}

export function openLocalRepository(
  options: LocalRepositoryOptions = {},
): Promise<LocalRepository> {
  return IndexedDbLocalRepository.open(options);
}

export const createLocalRepository = openLocalRepository;

export function deleteLocalRepositoryDatabase(
  databaseName = LOCAL_DATABASE_NAME,
  factory: IDBFactory = globalThis.indexedDB,
): Promise<void> {
  safeDatabaseName(databaseName);
  if (!factory) {
    return Promise.reject(adapterError("unavailable", "local.database.delete"));
  }
  return new Promise<void>((resolve, reject) => {
    const request = factory.deleteDatabase(databaseName);
    request.onsuccess = () => resolve();
    request.onerror = () =>
      reject(mapIndexedDbError(request.error, "local.database.delete"));
    request.onblocked = () =>
      reject(adapterError("unavailable", "local.database.delete"));
  });
}

export function localErrorCode(error: unknown): string {
  return isAdapterError(error) ? error.code : "unknown";
}
