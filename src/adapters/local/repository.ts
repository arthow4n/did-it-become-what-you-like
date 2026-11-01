import * as Automerge from "@automerge/automerge";
import {
  adapterError,
  isAdapterError,
  mapAdapterError,
} from "../ports/errors.ts";
import {
  assertValidRetryPolicy,
  cloneJson,
  type JsonValue,
  type OperationOptions,
  throwIfAborted,
} from "../ports/common.ts";
import type {
  LocalCollection,
  LocalEntry,
  LocalKey,
  LocalQuery,
  LocalTransaction,
  LocalTransactionMode,
} from "../ports/local.ts";
import {
  exportDataset as exportPortableDataset,
  migrateToCurrent,
  type PortableDataset,
} from "../../domain/index.ts";
import {
  ALL_STORES,
  applyRecordChanges,
  assertCollection,
  assertKey,
  BACKUP_STORE,
  datasetRecords,
  defaultDeviceId,
  deleteProjectionsForValue,
  DOCUMENT_STORE,
  documentBytes,
  documentFromEntries,
  emptyDocument,
  idbDone,
  loadAutomergeDocument,
  LOCAL_DATABASE_NAME,
  LOCAL_DOCUMENT_KEY,
  LOCAL_SCHEMA_VERSION,
  localDatasetFromEntries,
  type LocalDocument,
  type LocalRecoveryState,
  type LocalRepository,
  type LocalRepositoryOptions,
  type LocalRevision,
  type LocalTombstone,
  mapIndexedDbError,
  type MutableTransactionContext,
  openDatabase,
  PROJECTION_STORE,
  type ProjectionEntry,
  publicStore,
  readAllEntries,
  readRevision,
  RECORD_STORE,
  request,
  revisionKey,
  safeDatabaseName,
  sortEntries,
  type StoredBackup,
  type StoredDocument,
  type StoredEntry,
  SYNC_METADATA_STORE,
  toJsonObject,
  tombstoneKey,
  writeProjection,
} from "./schema.ts";

export class IndexedDbLocalRepository implements LocalRepository {
  readonly databaseName: string;
  readonly deviceId: string;
  private readonly database: IDBDatabase;
  private readonly options: LocalRepositoryOptions;
  private closed = false;
  private readonly recordListeners = new Set<() => void>();
  private cachedDocument:
    | {
      readonly bytes: Uint8Array;
      readonly document: Automerge.Doc<LocalDocument>;
    }
    | undefined;

  private resolveAutomergeDocument(
    bytes: Uint8Array,
    operation: string,
  ): Automerge.Doc<LocalDocument> {
    const cached = this.cachedDocument;
    if (
      cached &&
      cached.bytes.byteLength === bytes.byteLength &&
      cached.bytes.every((byte, index) => byte === bytes[index])
    ) {
      return Automerge.clone(cached.document);
    }
    const loaded = loadAutomergeDocument(bytes, operation);
    this.cachedDocument = {
      bytes: new Uint8Array(bytes),
      document: Automerge.clone(loaded),
    };
    return loaded;
  }

  private setCachedDocument(
    bytes: Uint8Array,
    document: Automerge.Doc<LocalDocument>,
  ): void {
    this.cachedDocument = {
      bytes: new Uint8Array(bytes),
      document: Automerge.clone(document),
    };
  }

  subscribeRecords(listener: () => void): () => void {
    this.recordListeners.add(listener);
    return () => {
      this.recordListeners.delete(listener);
    };
  }
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
    const done = idbDone(transaction);
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
          const loaded = loadAutomergeDocument(
            documentEntry.bytes,
            "local.document.load",
          );
          this.setCachedDocument(documentEntry.bytes, loaded);
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
    const done = idbDone(transaction);
    try {
      const current = await request(
        transaction.objectStore(DOCUMENT_STORE).get(LOCAL_DOCUMENT_KEY),
        "local.document.recheck",
        this.options.beforeRequest,
      );
      if (!current) {
        const bytes = documentBytes(document);
        const value: StoredDocument = {
          key: LOCAL_DOCUMENT_KEY,
          schemaVersion: LOCAL_SCHEMA_VERSION,
          savedAt: this.now(),
          bytes,
        };
        await request(
          transaction.objectStore(DOCUMENT_STORE).put(value),
          "local.document.initialize",
          this.options.beforeRequest,
        );
        this.setCachedDocument(bytes, document);
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
    const done = idbDone(transaction);
    try {
      const bytes = documentBytes(document);
      const value: StoredDocument = {
        key: LOCAL_DOCUMENT_KEY,
        schemaVersion: LOCAL_SCHEMA_VERSION,
        savedAt: this.now(),
        bytes,
      };
      await request(
        transaction.objectStore(DOCUMENT_STORE).put(value),
        "local.document.recover",
        this.options.beforeRequest,
      );
      this.setCachedDocument(bytes, document);
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
    if (collection === RECORD_STORE) {
      await this.backupCurrent(transaction, context);
    }
    const { revision, previousValue: previousRevisionValue } =
      await readRevision(
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
    const previousEntry = revision > 1
      ? await request(
        store.get(key),
        "local.projection.previous-get",
        this.options.beforeRequest,
      ) as StoredEntry | undefined
      : undefined;
    const entry: StoredEntry = { key, value: cloneJson(value) };
    await request(
      store.put(entry),
      "local.value.put",
      this.options.beforeRequest,
    );
    await deleteProjectionsForValue(
      transaction,
      collection,
      key,
      previousEntry?.value,
      this.options,
    );
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
    await deleteProjectionsForValue(
      transaction,
      SYNC_METADATA_STORE,
      revisionKey(collection, key),
      previousRevisionValue,
      this.options,
    );
    await writeProjection(
      transaction,
      SYNC_METADATA_STORE,
      revisionKey(collection, key),
      revisionValue,
      this.options,
    );
    if (collection === RECORD_STORE) {
      context.recordChanges.push({
        key,
        value,
        tombstone: undefined,
      });
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
    if (collection === RECORD_STORE) {
      await this.backupCurrent(transaction, context);
    }
    const { revision, previousValue: previousRevisionValue } =
      await readRevision(
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
    const store = transaction.objectStore(publicStore(collection));
    const previousEntry = revision > 1
      ? await request(
        store.get(key),
        "local.projection.previous-get",
        this.options.beforeRequest,
      ) as StoredEntry | undefined
      : undefined;
    await request(
      store.delete(key),
      "local.value.delete",
      this.options.beforeRequest,
    );
    await deleteProjectionsForValue(
      transaction,
      collection,
      key,
      previousEntry?.value,
      this.options,
    );
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
    await deleteProjectionsForValue(
      transaction,
      SYNC_METADATA_STORE,
      revisionKey(collection, key),
      previousRevisionValue,
      this.options,
    );
    await writeProjection(
      transaction,
      SYNC_METADATA_STORE,
      revisionKey(collection, key),
      revisionValue,
      this.options,
    );
    const syncStore = transaction.objectStore(SYNC_METADATA_STORE);
    const previousTombstone = revision > 1
      ? await request(
        syncStore.get(tombstoneKey(collection, key)),
        "local.projection.previous-get",
        this.options.beforeRequest,
      ) as StoredEntry | undefined
      : undefined;
    await request(
      syncStore.put(
        {
          key: tombstoneKey(collection, key),
          value: tombstone,
        } satisfies StoredEntry,
      ),
      "local.tombstone.put",
      this.options.beforeRequest,
    );
    await deleteProjectionsForValue(
      transaction,
      SYNC_METADATA_STORE,
      tombstoneKey(collection, key),
      previousTombstone?.value,
      this.options,
    );
    await writeProjection(
      transaction,
      SYNC_METADATA_STORE,
      tombstoneKey(collection, key),
      tombstone,
      this.options,
    );
    if (collection === RECORD_STORE) {
      context.recordChanges.push({
        key,
        value: undefined,
        tombstone,
      });
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
    const done = idbDone(idbTransaction);
    let recordsChanged = false;
    const context: MutableTransactionContext = {
      document: emptyDocument(this.deviceId),
      recordChanges: [],
      backupWritten: false,
      backupSequence: 0,
    };
    let documentLoading: Promise<void> | undefined;
    const loadDocumentForWrite = (): Promise<void> => {
      documentLoading ??= (async () => {
        const current = await request(
          idbTransaction.objectStore(DOCUMENT_STORE).get(LOCAL_DOCUMENT_KEY),
          "local.document.get",
          this.options.beforeRequest,
        ) as StoredDocument | undefined;
        if (current) {
          context.document = this.resolveAutomergeDocument(
            current.bytes,
            "local.document.load",
          );
        }
      })();
      return documentLoading;
    };
    try {
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
          if (collection === "records") {
            await loadDocumentForWrite();
            recordsChanged = true;
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
          if (collection === "records") {
            await loadDocumentForWrite();
            recordsChanged = true;
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
      let committedBytes: Uint8Array | undefined;
      if (recordsChanged) {
        context.document = applyRecordChanges(
          context.document,
          context.recordChanges,
        );
        committedBytes = documentBytes(context.document);
        await request(
          idbTransaction.objectStore(DOCUMENT_STORE).put(
            {
              key: LOCAL_DOCUMENT_KEY,
              schemaVersion: LOCAL_SCHEMA_VERSION,
              savedAt: this.now(),
              bytes: committedBytes,
            } satisfies StoredDocument,
          ),
          "local.document.put",
          this.options.beforeRequest,
        );
      }
      await done;
      if (recordsChanged && committedBytes) {
        this.setCachedDocument(committedBytes, context.document);
      }
      if (recordsChanged && options?.origin !== "sync") {
        // A subscriber failure cannot turn an already committed save into a
        // reported transaction failure.
        for (const listener of this.recordListeners) queueMicrotask(listener);
      }
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
    const done = idbDone(transaction);
    try {
      const current = await request(
        transaction.objectStore(DOCUMENT_STORE).get(LOCAL_DOCUMENT_KEY),
        "local.document.load",
        this.options.beforeRequest,
      ) as StoredDocument | undefined;
      await done;
      return current
        ? this.resolveAutomergeDocument(current.bytes, "local.document.load")
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
    const done = idbDone(idbTransaction);
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
    this.cachedDocument = undefined;
    this.recordListeners.clear();
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
