// Deterministic fakes resolve most operations synchronously while preserving
// the asynchronous port contracts; require-await would add no behavior here.
// deno-lint-ignore-file require-await

import {
  adapterError,
  type AdapterErrorCode,
  type CausalApplyResult,
  type CausalSnapshot,
  type CausalSyncPort,
  type CausalSyncRecoveryPort,
  type ClockPort,
  cloneJson,
  type DriveAuthorizationPort,
  type DriveAuthSession,
  type DriveAuthState,
  type DriveFile,
  type DriveTransportPort,
  type DriveWriteRequest,
  type FilePayload,
  type FileSelectionPort,
  type FileSharePort,
  type IdKind,
  type IdPort,
  type ImageInput,
  type ImagePreparationOptions,
  type ImagePreparationPort,
  type JsonValue,
  type LocalCollection,
  type LocalEntry,
  type LocalPort,
  type LocalQuery,
  type LocalTransaction,
  type LocalTransactionMode,
  type OnlineState,
  type OnlineStatusListener,
  type OnlineStatusPort,
  type OperationOptions,
  type ReceiptAiModel,
  type ReceiptAiModelQuery,
  type ReceiptAiPort,
  type ReceiptExtractionDraft,
  type ReceiptExtractionRequest,
  type SecretName,
  type SecretStoragePort,
  SecretValue,
  type SharePayload,
  type SyncConflict,
  type UpdateCheckOutput,
  type UpdateInstallPort,
  type UpdateState,
} from "../../adapters/ports/index.ts";
import {
  CURRENT_SCHEMA_VERSION,
  DATASET_FORMAT,
  type PortableDataset,
  type StableId,
  StableIdSchema,
} from "../../domain/index.ts";

export type FakeScenario = {
  readonly offline?: boolean;
  readonly quota?: boolean;
  readonly conflict?: boolean;
  readonly corrupt?: boolean;
  readonly partialTransport?: boolean;
};

export type FakeControls = {
  setScenario(scenario: FakeScenario): void;
  failNext(code: AdapterErrorCode): void;
  clearFailures(): void;
};

type MutableScenario = {
  offline: boolean;
  quota: boolean;
  conflict: boolean;
  corrupt: boolean;
  partialTransport: boolean;
};

function createControls(operation: string): ControlsWithScenario {
  let scenario: MutableScenario = {
    offline: false,
    quota: false,
    conflict: false,
    corrupt: false,
    partialTransport: false,
  };
  let nextFailure: AdapterErrorCode | undefined;

  return {
    setScenario: (next) => {
      scenario = { ...scenario, ...next };
    },
    failNext: (code) => {
      nextFailure = code;
    },
    clearFailures: () => {
      nextFailure = undefined;
      scenario = {
        offline: false,
        quota: false,
        conflict: false,
        corrupt: false,
        partialTransport: false,
      };
    },
    check: (options) => {
      if (options?.signal?.aborted) throw adapterError("aborted", operation);
      if (nextFailure) {
        const code = nextFailure;
        nextFailure = undefined;
        throw adapterError(code, operation);
      }
      if (scenario.offline) throw adapterError("offline", operation);
      if (scenario.quota) throw adapterError("quota", operation);
      if (scenario.corrupt) throw adapterError("corrupt-data", operation);
      if (scenario.partialTransport) {
        throw adapterError("partial-transport", operation);
      }
    },
    get scenario(): MutableScenario {
      return scenario;
    },
  };
}

type ControlsWithScenario = FakeControls & {
  readonly scenario: MutableScenario;
  check(options?: OperationOptions): void;
};

function stableId(value: string): StableId {
  return StableIdSchema.parse(value);
}

function cloneBytes(bytes: Uint8Array): Uint8Array {
  return new Uint8Array(bytes);
}

function emptyDataset(): PortableDataset {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    format: DATASET_FORMAT,
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
    settings: {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      type: "portable-settings",
      id: "settings-portable",
      expenseDayBoundary: "03:00",
    },
  };
}

export type FakeLocalPort = LocalPort & FakeControls & {
  readonly operations: readonly string[];
};

export function createFakeLocalPort(): FakeLocalPort {
  const controls = createControls("local");
  const stores = new Map<LocalCollection, Map<string, JsonValue>>();
  const operations: string[] = [];
  for (
    const collection of [
      "records",
      "settings",
      "sync-metadata",
      "workflow-snapshots",
    ] as const
  ) stores.set(collection, new Map());

  const makeTransaction = (
    mode: LocalTransactionMode,
    working: Map<LocalCollection, Map<string, JsonValue>>,
  ): LocalTransaction => {
    const checkWrite = (): void => {
      if (mode === "readonly") {
        throw adapterError("forbidden", "local.write-in-readonly");
      }
    };
    const tx: LocalTransaction = {
      get: async <T extends JsonValue = JsonValue>(
        collection: LocalCollection,
        key: string,
        options?: OperationOptions,
      ): Promise<T | undefined> => {
        controls.check(options);
        operations.push(`get:${collection}:${key}`);
        const value = working.get(collection)?.get(key);
        return value === undefined ? undefined : cloneJson(value) as T;
      },
      put: async (collection, key, value, options) => {
        controls.check(options);
        checkWrite();
        operations.push(`put:${collection}:${key}`);
        working.get(collection)?.set(key, cloneJson(value));
      },
      delete: async (collection, key, options) => {
        controls.check(options);
        checkWrite();
        operations.push(`delete:${collection}:${key}`);
        working.get(collection)?.delete(key);
      },
      query: async <T extends JsonValue = JsonValue>(
        collection: LocalCollection,
        query: LocalQuery = {},
        options?: OperationOptions,
      ): Promise<readonly LocalEntry<T>[]> => {
        controls.check(options);
        operations.push(`query:${collection}`);
        const result: LocalEntry<T>[] = [];
        for (const [key, value] of working.get(collection) ?? []) {
          const indexedValue = value && typeof value === "object" &&
              !Array.isArray(value)
            ? value[query.index ?? ""]
            : undefined;
          if (query.equals !== undefined && indexedValue !== query.equals) {
            continue;
          }
          result.push({ key, value: cloneJson(value) as T });
          if (query.limit !== undefined && result.length >= query.limit) break;
        }
        return result;
      },
    };
    return tx;
  };

  const api: FakeLocalPort = {
    transaction: async (mode, work, options) => {
      controls.check(options);
      operations.push(`transaction:${mode}`);
      const working = new Map<LocalCollection, Map<string, JsonValue>>();
      for (const [collection, store] of stores) {
        working.set(
          collection,
          new Map(
            [...store.entries()].map(([key, value]) => [key, cloneJson(value)]),
          ),
        );
      }
      const result = await work(makeTransaction(mode, working));
      if (mode === "readwrite") {
        for (const [collection, store] of working) {
          stores.set(collection, store);
        }
      }
      return result;
    },
    query: async (collection, query, options) =>
      api.transaction(
        "readonly",
        (transaction) => transaction.query(collection, query, options),
        options,
      ),
    operations,
    setScenario: controls.setScenario,
    failNext: controls.failNext,
    clearFailures: controls.clearFailures,
  };
  return api;
}

export type FakeCausalSyncPort =
  & CausalSyncPort
  & CausalSyncRecoveryPort
  & FakeControls
  & {
    setSnapshot(snapshot: CausalSnapshot): void;
    readonly resetCount: number;
  };

export function createFakeCausalSyncPort(
  initial: CausalSnapshot = {
    generation: 1,
    heads: [],
    changes: [],
    dataset: emptyDataset(),
  },
): FakeCausalSyncPort {
  const controls = createControls("causal-sync");
  let snapshot = structuredClone(initial);
  let resetCount = 0;
  const api: FakeCausalSyncPort = {
    read: async (options) => {
      controls.check(options);
      return structuredClone(snapshot);
    },
    exportPacket: async (options) => {
      controls.check(options);
      return {
        generation: snapshot.generation,
        heads: [...snapshot.heads],
        changes: snapshot.changes.map((change) => ({
          ...change,
          parents: [...change.parents],
          payload: cloneJson(change.payload),
        })),
      };
    },
    applyPacket: async (packet, options): Promise<CausalApplyResult> => {
      controls.check(options);
      const applied = packet.changes.filter((change) =>
        !snapshot.changes.some((existing) => existing.id === change.id)
      );
      const conflicts: SyncConflict[] = controls.scenario.conflict
        ? [{
          id: stableId("conflict-0001"),
          recordType: "expense",
          recordId: stableId("expense-0001"),
          local: { amount: "-1" },
          remote: { amount: "-2" },
          relatedChangeIds: applied.map((change) => change.id),
        }]
        : [];
      snapshot = {
        ...snapshot,
        generation: Math.max(snapshot.generation, packet.generation),
        heads: [...packet.heads],
        changes: [...snapshot.changes, ...applied],
      };
      return {
        snapshot: structuredClone(snapshot),
        appliedChangeIds: applied.map((change) => change.id),
        conflicts,
      };
    },
    resetRemoteSyncFile: async (options) => {
      controls.check(options);
      resetCount += 1;
      snapshot = structuredClone(initial);
    },
    setSnapshot: (next) => {
      snapshot = structuredClone(next);
    },
    setScenario: controls.setScenario,
    failNext: controls.failNext,
    clearFailures: controls.clearFailures,
    get resetCount(): number {
      return resetCount;
    },
  };
  return api;
}

export type DriveRequestObservation = {
  readonly operation: "list" | "read" | "write" | "delete";
  readonly name?: string;
  readonly bodyLength?: number;
};

export type FakeDrivePorts =
  & DriveAuthorizationPort
  & DriveTransportPort
  & FakeControls
  & {
    readonly requests: readonly DriveRequestObservation[];
  };

export function createFakeDrivePorts(
  now: ClockPort = createFakeClockPort(),
  ids: IdPort = createFakeIdPort("drive"),
): FakeDrivePorts {
  const controls = createControls("drive");
  let authState: DriveAuthState = "signed-out";
  const files = new Map<string, DriveFile>();
  const requests: DriveRequestObservation[] = [];
  const session: DriveAuthSession = {
    accountId: "fake-account",
    scopes: ["appDataFolder"],
  };
  const requireAuth = (): void => {
    if (authState !== "authorized") throw adapterError("unauthorized", "drive");
  };
  const api: FakeDrivePorts = {
    status: () => authState,
    authorize: async (options) => {
      controls.check(options);
      authState = "authorized";
      return session;
    },
    disconnect: async (options) => {
      controls.check(options);
      authState = "signed-out";
    },
    deleteEverywhere: async (options) => {
      controls.check(options);
      requireAuth();
      files.clear();
    },
    listAppData: async (options) => {
      controls.check(options);
      requireAuth();
      requests.push({ operation: "list" });
      return [...files.values()].map((file) => ({ ...file }));
    },
    readAppData: async (name, options) => {
      controls.check(options);
      requireAuth();
      requests.push({ operation: "read", name });
      const file = files.get(name);
      return file ? { ...file } : undefined;
    },
    writeAppData: async (request: DriveWriteRequest, options) => {
      controls.check(options);
      requireAuth();
      requests.push({
        operation: "write",
        name: request.name,
        bodyLength: request.body.length,
      });
      const current = files.get(request.name);
      if (
        controls.scenario.conflict ||
        (request.expectedEtag !== undefined &&
          request.expectedEtag !== current?.etag)
      ) {
        throw adapterError("conflict", "drive.write");
      }
      const next: DriveFile = {
        id: current?.id ?? ids.next("workflow"),
        name: request.name,
        body: request.body,
        etag: ids.next("change"),
        updatedAt: now.now(),
      };
      files.set(request.name, next);
      return { ...next };
    },
    deleteAppData: async (name, expectedEtag, options) => {
      controls.check(options);
      requireAuth();
      requests.push({ operation: "delete", name });
      const current = files.get(name);
      if (!current) throw adapterError("not-found", "drive.delete");
      if (expectedEtag !== undefined && expectedEtag !== current.etag) {
        throw adapterError("conflict", "drive.delete");
      }
      files.delete(name);
    },
    requests,
    setScenario: controls.setScenario,
    failNext: controls.failNext,
    clearFailures: controls.clearFailures,
  };
  return api;
}

export type GeminiRequestObservation = {
  readonly modelId: string;
  readonly locale: string;
  readonly currency: string;
  readonly categoryIds: readonly string[];
  readonly imageByteLength: number;
};

export type FakeGeminiPort = ReceiptAiPort & FakeControls & {
  readonly requests: readonly GeminiRequestObservation[];
  pauseNext(): void;
  releasePaused(): void;
};

const FAKE_MODELS: readonly ReceiptAiModel[] = [
  {
    id: "fake-gemini-compatible",
    displayName: "Fake Gemini Compatible",
    lifecycle: "active",
    capabilities: {
      "image-input": true,
      "content-generation": true,
      "structured-output": true,
    },
  },
  {
    id: "fake-gemini-needs-test",
    displayName: "Fake Gemini Needs Test",
    lifecycle: "active",
    capabilities: {
      "image-input": true,
      "content-generation": true,
      "structured-output": false,
    },
  },
];

const defaultDraft: ReceiptExtractionDraft = {
  merchant: "Fake Merchant",
  currency: "SEK",
  date: "2026-08-24",
  printedTotal: "-10",
  lines: [{
    description: "Fake item",
    amount: "-10",
    categoryId: stableId("category-uncategorized"),
    kind: "purchase",
    selected: true,
  }],
  uncertainty: [],
  mismatches: [],
};

export function createFakeGeminiPort(
  draft: ReceiptExtractionDraft = defaultDraft,
): FakeGeminiPort {
  const controls = createControls("gemini");
  const requests: GeminiRequestObservation[] = [];
  let paused = false;
  let pendingResolve: (() => void) | undefined;
  const waitIfPaused = (signal: AbortSignal | undefined): Promise<void> => {
    if (!paused) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const abort = (): void => {
        signal?.removeEventListener("abort", abort);
        reject(adapterError("aborted", "gemini.extract"));
      };
      signal?.addEventListener("abort", abort, { once: true });
      pendingResolve = () => {
        signal?.removeEventListener("abort", abort);
        resolve();
      };
    });
  };
  const api: FakeGeminiPort = {
    listModels: async (query: ReceiptAiModelQuery, options) => {
      controls.check(options);
      return FAKE_MODELS.filter((model) =>
        query.requiredCapabilities.every((capability) =>
          model.capabilities[capability]
        )
      );
    },
    testConfiguration: async (modelId, query, options) => {
      controls.check(options);
      const model = FAKE_MODELS.find((candidate) => candidate.id === modelId);
      const missingCapabilities = query.requiredCapabilities.filter((
        capability,
      ) => !model?.capabilities[capability]);
      if (!model) return { status: "incompatible", missingCapabilities };
      if (missingCapabilities.length > 0) {
        return { status: "needs-test", model, missingCapabilities };
      }
      return { status: "compatible", model };
    },
    extractReceipt: async (
      request: ReceiptExtractionRequest,
      options?: OperationOptions,
    ) => {
      controls.check(options);
      const model = FAKE_MODELS.find((candidate) =>
        candidate.id === request.modelId
      );
      if (!model) throw adapterError("not-found", "gemini.extract");
      if (!model.capabilities["structured-output"]) {
        throw adapterError("unsupported", "gemini.extract");
      }
      requests.push({
        modelId: request.modelId,
        locale: request.locale,
        currency: request.currency,
        categoryIds: request.categories.map((category) => category.id),
        imageByteLength: request.image.bytes.byteLength,
      });
      await waitIfPaused(options?.signal);
      return structuredClone(draft);
    },
    requests,
    pauseNext: () => {
      paused = true;
    },
    releasePaused: () => {
      paused = false;
      pendingResolve?.();
      pendingResolve = undefined;
    },
    setScenario: controls.setScenario,
    failNext: controls.failNext,
    clearFailures: controls.clearFailures,
  };
  return api;
}

export type FakeImagePreparationPort = ImagePreparationPort & FakeControls & {
  readonly calls: readonly { enabled: boolean; byteLength: number }[];
};

export function createFakeImagePreparationPort(): FakeImagePreparationPort {
  const controls = createControls("image.prepare");
  const calls: Array<{ enabled: boolean; byteLength: number }> = [];
  return {
    prepare: async (input: ImageInput, options: ImagePreparationOptions) => {
      controls.check(options);
      calls.push({
        enabled: options.enabled,
        byteLength: input.bytes.byteLength,
      });
      return {
        bytes: cloneBytes(input.bytes),
        mimeType: input.mimeType,
        width: input.width,
        height: input.height,
        metadataSanitized: true,
        preparationApplied: options.enabled,
      };
    },
    calls,
    setScenario: controls.setScenario,
    failNext: controls.failNext,
    clearFailures: controls.clearFailures,
  };
}

export function createFakeOnlineStatusPort(
  initial: OnlineState = "online",
): OnlineStatusPort & { set(state: OnlineState): void } {
  let state = initial;
  const listeners = new Set<OnlineStatusListener>();
  return {
    current: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    set: (next) => {
      state = next;
      for (const listener of listeners) listener(state);
    },
  };
}

export function createFakeClockPort(
  initial = "2026-08-24T00:00:00.000Z",
): ClockPort & { advance(milliseconds: number): void } {
  let milliseconds = Date.parse(initial);
  if (!Number.isFinite(milliseconds)) {
    throw new Error("Invalid fake clock value.");
  }
  return {
    now: () => new Date(milliseconds).toISOString(),
    delay: async (duration, options) => {
      if (options?.signal?.aborted) {
        throw adapterError("aborted", "clock.delay");
      }
      if (!Number.isFinite(duration) || duration < 0) {
        throw new Error("Fake clock duration must be non-negative.");
      }
      milliseconds += duration;
    },
    advance: (duration) => {
      if (!Number.isFinite(duration) || duration < 0) {
        throw new Error("Invalid fake clock advance.");
      }
      milliseconds += duration;
    },
  };
}

export function createFakeIdPort(
  prefix = "fake",
): IdPort & { count(): number } {
  let sequence = 0;
  const normalized =
    prefix.replace(/[^a-z0-9-]/gi, "-").replace(/^-+|-+$/g, "") || "fake";
  return {
    next: (kind: IdKind) =>
      stableId(
        `${normalized}-${kind}-${String(++sequence).padStart(4, "0")}`,
      ),
    count: () => sequence,
  };
}

export type FakeFileSharePort =
  & FileSelectionPort
  & FileSharePort
  & FakeControls
  & {
    readonly saved: readonly FilePayload[];
    readonly shared: readonly SharePayload[];
    setSelection(payload: FilePayload | undefined): void;
  };

export function createFakeFileSharePort(): FakeFileSharePort {
  const controls = createControls("file-share");
  let selection: FilePayload | undefined;
  const saved: FilePayload[] = [];
  const shared: SharePayload[] = [];
  return {
    pickImage: async (options) => {
      controls.check(options);
      return selection && { ...selection, bytes: cloneBytes(selection.bytes) };
    },
    save: async (payload, options) => {
      controls.check(options);
      saved.push({ ...payload, bytes: cloneBytes(payload.bytes) });
    },
    share: async (payload, options) => {
      controls.check(options);
      shared.push(payload);
      return "shared";
    },
    saved,
    shared,
    setSelection: (payload) => {
      selection = payload && { ...payload, bytes: cloneBytes(payload.bytes) };
    },
    setScenario: controls.setScenario,
    failNext: controls.failNext,
    clearFailures: controls.clearFailures,
  };
}

export function createFakeUpdateInstallPort(
  initial: UpdateState = "current",
): UpdateInstallPort & FakeControls & {
  canInstall(): boolean;
  subscribeInstall(listener: (available: boolean) => void): () => void;
  setInstallAvailable(available: boolean): void;
  readonly reloadCount: number;
  setState(state: UpdateState): void;
  setUpdate(version?: string): void;
} {
  const controls = createControls("update-install");
  let state = initial;
  let installAvailable = false;
  let reloadCount = 0;
  const listeners = new Set<(value: UpdateState) => void>();
  const installListeners = new Set<(available: boolean) => void>();
  return {
    state: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    check: async (options): Promise<UpdateCheckOutput> => {
      controls.check(options);
      if (state === "update-available") {
        return { status: "update-ready", version: "fake-update" };
      }
      state = "current";
      for (const listener of listeners) listener(state);
      return { status: "up-to-date" };
    },
    install: async (options) => {
      controls.check(options);
      state = "installing";
    },
    reload: async (options) => {
      controls.check(options);
      reloadCount++;
    },
    setState: (next) => {
      state = next;
      for (const listener of listeners) listener(state);
    },
    setUpdate: (version = "fake-update") => {
      void version;
      state = "update-available";
      for (const listener of listeners) listener(state);
    },
    canInstall: () => installAvailable,
    subscribeInstall: (listener) => {
      installListeners.add(listener);
      return () => installListeners.delete(listener);
    },
    setInstallAvailable: (available) => {
      installAvailable = available;
      for (const listener of installListeners) listener(available);
    },
    get reloadCount() {
      return reloadCount;
    },
    setScenario: controls.setScenario,
    failNext: controls.failNext,
    clearFailures: controls.clearFailures,
  };
}

export type FakeSecretStoragePort = SecretStoragePort & FakeControls & {
  readonly audit: readonly {
    operation: string;
    name: SecretName;
    value: string;
  }[];
};

export function createFakeSecretStoragePort(): FakeSecretStoragePort {
  const controls = createControls("secret-storage");
  const values = new Map<SecretName, SecretValue>();
  const audit: Array<{ operation: string; name: SecretName; value: string }> =
    [];
  const record = (operation: string, name: SecretName): void => {
    audit.push({ operation, name, value: "[REDACTED]" });
  };
  return {
    get: async (name, options) => {
      controls.check(options);
      record("get", name);
      return values.get(name);
    },
    set: async (name, value, options) => {
      controls.check(options);
      values.set(name, value);
      record("set", name);
    },
    remove: async (name, options) => {
      controls.check(options);
      values.delete(name);
      record("remove", name);
    },
    audit,
    setScenario: controls.setScenario,
    failNext: controls.failNext,
    clearFailures: controls.clearFailures,
  };
}
