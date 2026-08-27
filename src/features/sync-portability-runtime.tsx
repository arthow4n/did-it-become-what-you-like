import { useActor } from "@xstate/react";
import {
  type AnyActorLogic,
  createActor,
  type Snapshot,
  type SnapshotFrom,
} from "xstate";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  adapterError,
  type CausalSyncRecoveryPort,
  type DriveAuthState,
  type SecretStoragePort,
} from "../adapters/ports/index.ts";
import {
  type ConflictActorEvent,
  createConflictActor,
  createConflictMachine,
} from "../actors/conflict/index.ts";
import {
  createExportActor,
  createExportMachine,
  createImportActor,
  createImportMachine,
  type ExportEvent,
} from "../actors/import-export/index.ts";
import {
  createDefaultSyncDependencies,
  createSyncActor,
  createSyncMachine,
} from "../actors/sync/index.ts";
import {
  createDeleteEverywhereMachine,
  createLocalEraseMachine,
  deleteDriveGeneration,
  finalizeDeleteEverywhere,
  persistDeleteEverywhereSnapshot,
  persistLocalEraseSnapshot,
  publishDriveRetirement,
  recoverDeleteEverywhereSnapshot,
  recoverLocalEraseSnapshot,
} from "../actors/destruction.ts";
import type { ImportEvent } from "../actors/contracts/index.ts";
import { createImportExportAdapter } from "../adapters/import-export/index.ts";
import {
  createDriveCausalSyncPort,
  createInMemoryCausalSyncPort,
} from "../adapters/sync/causal.ts";
import {
  createDriveAdapter,
  createGoogleIdentityProvider,
  type DriveAdapter,
  type DriveIdentityProvider,
} from "../adapters/drive/index.ts";
import {
  deleteLocalRepositoryDatabase,
  type LocalRepository,
} from "../adapters/local/index.ts";
import { runCausalExchange } from "../adapters/sync/coordinator.ts";
import type { FileSharePort } from "../adapters/ports/index.ts";
import type { CausalSyncPort } from "../adapters/ports/index.ts";
import { type StableId, StableIdSchema } from "../domain/index.ts";
import { Stack } from "../design-system/index.ts";
import {
  clearDeleteEverywhereProgress,
  type DeleteEverywhereProgressPhase,
  type DeleteEverywhereProgressRecord,
  type DestructionStorage,
  isDestructionStorage,
  readDeleteEverywhereProgress,
  readLocalEraseGeminiKeyChoice,
  readLocalEraseProgress,
  writeDeleteEverywhereProgress,
} from "../domain/destruction.ts";
import { observationsFromSyncConflicts as expandSyncConflicts } from "../domain/conflict/merge.ts";
import {
  type ConflictChoice,
  type ConflictGroupViewModel,
  ConflictReviewScreen,
  type ConflictReviewViewModel,
  type ExportViewModel,
  ImportExportScreen,
  type ImportMode,
  type ImportPreviewViewModel,
  type ImportViewModel,
  type ReplacementConfirmation,
  type SafetyExportStatus,
} from "./conflict-import-ui/index.ts";
import {
  GlobalStatus as SyncGlobalStatus,
  GoogleDriveSyncScreen,
  isGlobalStatusActionable,
  KnownDevicesScreen,
  type KnownDeviceViewModel,
  type SyncConnectionViewModel,
  syncStatusCopy,
} from "./sync-ui/index.ts";
import {
  type DiagnosticDeviceViewModel,
  type SyncNetworkMode,
} from "./sync-ui/types.ts";
import {
  DataPrivacyScreen,
  type DeleteEverywhereView,
  type DestructionDeviceView,
  type LocalEraseView,
} from "./destruction-ui.tsx";

export type SyncPortabilityScreen =
  | "sync"
  | "devices"
  | "conflicts"
  | "import-export"
  | "privacy"
  | null;

type RuntimeIds = {
  readonly next: (kind: string) => StableId;
};

/**
 * Browser composition stays deliberately small: production can provide a
 * client ID alongside Google Identity Services, while deterministic browser
 * tests can inject the already-typed Drive and causal boundaries before the
 * app boots. No credential or live-service fallback is invented here.
 */
export type SyncRuntimeBoundary = {
  readonly drive?: DriveAdapter;
  readonly causal?: CausalSyncPort;
  readonly recovery?: CausalSyncRecoveryPort;
  readonly clientId?: string;
  readonly identity?: DriveIdentityProvider;
};

const SYNC_RUNTIME_BOUNDARY_KEY =
  "__DID_IT_BECAME_WHAT_YOU_LIKE_SYNC_BOUNDARY__";

function configuredRuntimeBoundary(): SyncRuntimeBoundary {
  const value = (globalThis as unknown as Record<string, unknown>)[
    SYNC_RUNTIME_BOUNDARY_KEY
  ];
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  const candidate = value as Record<string, unknown>;
  return {
    ...(candidate.drive === undefined
      ? {}
      : { drive: candidate.drive as DriveAdapter }),
    ...(candidate.causal === undefined
      ? {}
      : { causal: candidate.causal as CausalSyncPort }),
    ...(candidate.recovery === undefined
      ? {}
      : { recovery: candidate.recovery as CausalSyncRecoveryPort }),
    ...(typeof candidate.clientId === "string"
      ? { clientId: candidate.clientId }
      : {}),
    ...(candidate.identity === undefined
      ? {}
      : { identity: candidate.identity as DriveIdentityProvider }),
  };
}

function browserConfiguredClientId(): string | undefined {
  const env = (import.meta as unknown as {
    readonly env?: { readonly VITE_GOOGLE_CLIENT_ID?: unknown };
  }).env;
  return typeof env?.VITE_GOOGLE_CLIENT_ID === "string"
    ? env.VITE_GOOGLE_CLIENT_ID
    : undefined;
}

export function createConfiguredDriveAdapter(
  boundary: SyncRuntimeBoundary = configuredRuntimeBoundary(),
): DriveAdapter | null {
  if (boundary.drive !== undefined) return boundary.drive;
  const clientId = boundary.clientId ?? browserConfiguredClientId();
  if (clientId === undefined || clientId.trim().length === 0) return null;
  try {
    const identity = boundary.identity ?? createGoogleIdentityProvider();
    return createDriveAdapter({
      clientId,
      identity,
      isOnline: () => globalThis.navigator?.onLine !== false,
    });
  } catch {
    // Missing GIS or an invalid runtime-only configuration is an honest
    // unavailable boundary, not a reason to make local sync look connected.
    return null;
  }
}

function createRuntimeIds(): RuntimeIds {
  let sequence = 0;
  return {
    next: (kind) => {
      sequence += 1;
      const suffix = globalThis.crypto?.randomUUID?.() ??
        `${Date.now()}-${sequence}`;
      return StableIdSchema.parse(`${kind}-${suffix}`);
    },
  };
}

const runtimeClock = {
  now: () => new Date().toISOString(),
  delay: async (milliseconds: number, options?: { signal?: AbortSignal }) => {
    if (options?.signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }
    await new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
  },
};

function createBrowserFileShare(): FileSharePort {
  const save = async (payload: {
    readonly name: string;
    readonly mimeType: string;
    readonly bytes: Uint8Array;
  }): Promise<void> => {
    if (
      globalThis.document === undefined ||
      globalThis.URL?.createObjectURL === undefined
    ) {
      throw { code: "unavailable" };
    }
    const blob = new Blob([payload.bytes.slice().buffer as ArrayBuffer], {
      type: payload.mimeType,
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = payload.name;
    anchor.click();
    URL.revokeObjectURL(url);
    await Promise.resolve();
  };

  return {
    save,
    share: async (payload) => {
      const share = globalThis.navigator?.share;
      if (typeof share !== "function" || payload.file === undefined) {
        throw { code: "unsupported" };
      }
      const file = new File(
        [payload.file.bytes.slice().buffer as ArrayBuffer],
        payload.file.name,
        { type: payload.file.mimeType },
      );
      if (
        typeof globalThis.navigator.canShare === "function" &&
        !globalThis.navigator.canShare({ files: [file] })
      ) {
        throw { code: "unsupported" };
      }
      await share.call(globalThis.navigator, {
        title: payload.title,
        files: [file],
      });
      return "shared";
    },
  };
}

async function saveDestructionSafetyExport(json: string): Promise<void> {
  const bytes = new TextEncoder().encode(json);
  await createBrowserFileShare().save({
    name: "did-it-become-what-you-like-delete-everywhere-safety.json",
    mimeType: "application/json",
    bytes,
  });
}

function destructionStorage(): DestructionStorage | undefined {
  try {
    return isDestructionStorage(globalThis.localStorage)
      ? globalThis.localStorage
      : undefined;
  } catch {
    return undefined;
  }
}

function useRestartableActor<TLogic extends AnyActorLogic>(
  logic: TLogic,
  restartKey: number,
  initialSnapshot?: Snapshot<unknown>,
): [SnapshotFrom<TLogic>, ReturnType<typeof createActor<TLogic>>["send"]] {
  const actor = useMemo(
    () =>
      createActor(
        logic,
        initialSnapshot === undefined
          ? undefined
          : ({ snapshot: initialSnapshot } as never),
      ),
    [initialSnapshot, logic, restartKey],
  );
  useEffect(() => {
    actor.start();
    return () => {
      actor.stop();
    };
  }, [actor]);
  const subscribe = useCallback(
    (listener: () => void) => {
      const subscription = actor.subscribe(listener);
      return () => subscription.unsubscribe();
    },
    [actor],
  );
  const getSnapshot = useCallback(() => actor.getSnapshot(), [actor]);
  return [
    useSyncExternalStore(subscribe, getSnapshot, getSnapshot),
    actor.send,
  ];
}

function humanize(value: string): string {
  return value
    .replace(/[-_]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (character) => character.toUpperCase());
}

export function requiresDriveAuthorization(
  accountEmail: string | null,
  driveStatus: DriveAuthState | null,
): boolean {
  return accountEmail !== null && driveStatus !== "authorized";
}

function syncViewFromSnapshot(
  snapshot: ReturnType<typeof createSyncActor> extends infer Actor
    ? Actor extends { getSnapshot: () => infer Snapshot } ? Snapshot : never
    : never,
  driveStatus: DriveAuthState | null = "authorized",
  recoveryAvailable = false,
): SyncConnectionViewModel {
  const context = snapshot.context;
  if (snapshot.matches("hydrating") || snapshot.matches("configuring")) {
    return { mode: "connecting" };
  }
  if (
    snapshot.matches("accountSwitchConfirmation") &&
    context.accountEmail !== null && context.pendingAccountEmail !== null
  ) {
    return {
      mode: "account-switch-confirmation",
      currentAccountEmail: context.accountEmail,
      requestedAccountEmail: context.pendingAccountEmail,
    };
  }
  if (context.accountEmail === null) return { mode: "disconnected" };

  let sync:
    | "synced"
    | "syncing"
    | "conflict"
    | "authorization-error"
    | "recovering"
    | "retryable-error"
    | "error"
    | "retired" = "synced";
  if (snapshot.matches("recovering")) sync = "recovering";
  else if (snapshot.matches("synchronizing")) sync = "syncing";
  else if (snapshot.matches("conflict")) sync = "conflict";
  else if (snapshot.matches("retryableError")) sync = "retryable-error";
  else if (snapshot.matches("error")) sync = "error";
  else if (snapshot.matches("retired")) sync = "retired";
  if (
    requiresDriveAuthorization(context.accountEmail, driveStatus) ||
    context.error?.code === "unauthorized" ||
    context.error?.code === "forbidden"
  ) sync = "authorization-error";

  return {
    mode: "configured",
    accountEmail: context.accountEmail,
    network: context.online ? "online" : "offline",
    sync,
    lastSyncedAt: context.lastSyncedAt,
    pendingChangeCount: context.pendingChangeCount,
    unresolvedConflictCount: context.unresolvedConflictCount,
    ...(context.error === null ? {} : { message: context.error.message }),
    ...(context.error === null ? {} : { errorCode: context.error.code }),
    ...(context.error?.operation === undefined
      ? {}
      : { diagnosticOperation: context.error.operation }),
    recoveryAvailable: recoveryAvailable &&
      context.error?.code === "corrupt-data",
  };
}

type SyncCompletionSnapshot = {
  readonly value: unknown;
  readonly context: { readonly lastSyncedAt: string | null };
};

export function completedSyncTimestamp(
  snapshot: SyncCompletionSnapshot,
): string | null {
  if (
    snapshot.context.lastSyncedAt === null ||
    (snapshot.value !== "idle" && snapshot.value !== "conflict")
  ) {
    return null;
  }
  return snapshot.context.lastSyncedAt;
}

export function requestLocalShellRefreshAfterSync(
  snapshot: SyncCompletionSnapshot,
  handled: { current: string | null },
  onRefresh: () => void,
): void {
  const completedAt = completedSyncTimestamp(snapshot);
  if (completedAt === null || handled.current === completedAt) return;
  handled.current = completedAt;
  onRefresh();
}

function settingsSyncSummary(view: SyncConnectionViewModel): string {
  const label = syncStatusCopy(view).label;
  return view.mode === "configured" && view.lastSyncedAt !== null
    ? `${label} · ${view.lastSyncedAt}`
    : label;
}

export function formatApproximateLastSeen(
  value: string,
  now = Date.now(),
): string {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return "recently";
  const elapsed = Math.max(0, now - timestamp);
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (elapsed < minute) return "just now";
  if (elapsed < hour) {
    const count = Math.floor(elapsed / minute);
    return `${count} minute${count === 1 ? "" : "s"} ago`;
  }
  if (elapsed < day) {
    const count = Math.floor(elapsed / hour);
    return `${count} hour${count === 1 ? "" : "s"} ago`;
  }
  if (elapsed < 2 * day) return "yesterday";
  const count = Math.floor(elapsed / day);
  return `${count} days ago`;
}

export function deviceViewModels(
  ordinary: readonly {
    readonly stableKey?: string;
    readonly label: string;
    readonly lastSeenAt: string;
    readonly acknowledged: boolean;
    readonly current: boolean;
  }[],
  diagnostic: readonly DiagnosticDeviceViewModel[],
): {
  readonly devices: readonly KnownDeviceViewModel[];
  readonly technical: readonly DiagnosticDeviceViewModel[];
} {
  const devices = ordinary.map((device, index) => ({
    // The registry exposes the same order in both projections today, but the
    // diagnostic ID is carried through as the identity so callbacks never
    // reverse-map a reordered row by position.
    stableKey: device.stableKey ?? diagnostic[index]?.id ?? `device-${index}`,
    label: device.label,
    lastSeenAt: formatApproximateLastSeen(device.lastSeenAt),
    current: device.current,
    retirementAcknowledgement: device.acknowledged
      ? "acknowledged" as const
      : "pending" as const,
  }));
  return {
    devices,
    technical: diagnostic.map((device) => ({
      ...device,
      lastSeenAt: device.lastSeenAt,
      exactLastSeenAt: device.lastSeenAt,
    })),
  };
}

function connectivityFor(
  online: boolean,
): SyncNetworkMode {
  return online && globalThis.navigator?.onLine !== false
    ? "online"
    : "offline";
}

function conflictViewFromSnapshot(
  snapshot: ReturnType<typeof createConflictActor> extends infer Actor
    ? Actor extends { getSnapshot: () => infer Snapshot } ? Snapshot : never
    : never,
  customValues: Readonly<Record<string, string>>,
  online: boolean,
  pane: "list" | "detail",
): ConflictReviewViewModel {
  const context = snapshot.context;
  const groups: ConflictGroupViewModel[] = context.state.groups.map((group) => {
    const selection = context.selection?.groupId === group.id
      ? context.selection
      : undefined;
    const selectedChoice: ConflictChoice | undefined = selection === undefined
      ? undefined
      : selection.choice === "candidate"
      ? { kind: "candidate", candidateId: selection.candidateId }
      : { kind: selection.choice };
    return {
      id: group.id,
      recordLabel: humanize(group.recordType) + " record",
      recordTypeLabel: humanize(group.recordType),
      fieldLabel: humanize(group.field),
      kind: group.kind,
      candidates: group.candidates.map((candidate) => ({
        id: candidate.id,
        revisionId: candidate.revisionId,
        value: candidate.value,
        deleted: candidate.deleted,
        deviceLabel: candidate.deviceLabel,
        recordedAt: candidate.recordedAt,
      })),
      selectedChoice,
      customValue: customValues[group.id] ??
        (selection?.choice === "custom" && typeof selection.value === "string"
          ? selection.value
          : ""),
      discardedEditedValues: group.kind === "delete-versus-edit"
        ? group.candidates.filter((candidate) => !candidate.deleted).flatMap(
          (candidate) => candidate.value === undefined ? [] : [candidate.value],
        )
        : undefined,
      technicalDetails: {
        recordId: group.recordId,
        groupId: group.id,
        parentRevisionIds: group.parentRevisionIds,
        candidateRevisionIds: group.candidates.map((candidate) =>
          candidate.revisionId
        ),
      },
    };
  });

  const phase = snapshot.matches("loading") || snapshot.matches("reconciling")
    ? "loading" as const
    : snapshot.matches("persisting") || snapshot.matches("committing")
    ? "saving" as const
    : snapshot.matches("failed")
    ? "error" as const
    : snapshot.matches("resolved")
    ? "completed" as const
    : "reviewing" as const;
  return {
    phase,
    connectivity: connectivityFor(online),
    groups,
    activeGroupId: context.activeGroupId,
    pane,
    completedCount: context.state.progress.completedCount,
    ...(context.error === null ? {} : {
      error: {
        message: context.error.message,
        retryable: context.error.retryable,
      },
    }),
  };
}

function importPreviewFromContext(
  preview: {
    readonly schemaVersion: number;
    readonly projectCount: number;
    readonly categoryCount: number;
    readonly expenseCount: number;
    readonly receiptCount: number;
    readonly migrationRequired: boolean;
    readonly changeCount?: number;
    readonly migrations?: readonly string[];
    readonly warnings?: readonly string[];
    readonly errors?: readonly string[];
  } | null,
  error: { readonly message: string } | null,
): ImportPreviewViewModel | null {
  if (preview === null) return null;
  return {
    schemaVersion: preview.schemaVersion,
    migration:
      preview.migrationRequired || (preview.migrations?.length ?? 0) > 0
        ? "required"
        : "not-required",
    projectCount: preview.projectCount,
    categoryCount: preview.categoryCount,
    expenseCount: preview.expenseCount,
    receiptCount: preview.receiptCount,
    changeCount: preview.changeCount ?? 0,
    migrations: preview.migrations ?? [],
    warnings: preview.warnings ?? [],
    errors: [
      ...(preview.errors ?? []),
      ...(error === null ? [] : [error.message]),
    ],
  };
}

function importViewFromSnapshot(
  snapshot: ReturnType<typeof createImportActor> extends infer Actor
    ? Actor extends { getSnapshot: () => infer Snapshot } ? Snapshot : never
    : never,
  syncView: SyncConnectionViewModel,
  fileName: string | undefined,
  safetyExport: SafetyExportStatus,
  safetyExportError: string | undefined,
  replacementConfirmation: ReplacementConfirmation,
): ImportViewModel {
  const context = snapshot.context;
  const phase = snapshot.matches("validating")
    ? "validating" as const
    : snapshot.matches("previewing")
    ? "preview" as const
    : snapshot.matches("preSyncing")
    ? "pre-syncing" as const
    : snapshot.matches("committing")
    ? "saving" as const
    : snapshot.matches("conflict")
    ? "conflict" as const
    : snapshot.matches("completed")
    ? "completed" as const
    : snapshot.matches("failed")
    ? "error" as const
    : snapshot.matches("choosing")
    ? "choosing" as const
    : "idle" as const;
  return {
    phase,
    connectivity: syncView.mode === "configured"
      ? syncView.network
      : connectivityFor(true),
    drive: syncView.mode === "configured" ? "configured" : "not-configured",
    fileName,
    preview: importPreviewFromContext(context.preview, context.error),
    mode: context.mode,
    safetyExport,
    safetyExportError,
    replacementConfirmation,
    conflictCount: context.result?.conflictCount ?? 0,
    generation: context.result?.generation,
    ...(context.error === null ? {} : {
      error: {
        message: context.error.message,
        retryable: context.error.retryable,
      },
    }),
  };
}

function exportViewFromSnapshot(
  snapshot: ReturnType<typeof createExportActor> extends infer Actor
    ? Actor extends { getSnapshot: () => infer Snapshot } ? Snapshot : never
    : never,
): ExportViewModel {
  const context = snapshot.context;
  const phase = snapshot.matches("exporting")
    ? "preparing" as const
    : snapshot.matches("delivering")
    ? "delivering" as const
    : snapshot.matches("completed")
    ? "completed" as const
    : snapshot.matches("failed")
    ? "error" as const
    : "idle" as const;
  return {
    phase,
    shareAvailability: typeof globalThis.navigator?.share === "function"
      ? "available"
      : "unavailable",
    ...(context.delivery === "shared" ? { delivery: "shared" as const } : {}),
    ...(context.delivery === "saved"
      ? { delivery: "downloaded" as const }
      : {}),
    ...(context.error === null ? {} : {
      error: {
        message: context.error.message,
        retryable: context.error.retryable,
      },
    }),
  };
}

export function observationsFromSyncConflicts(
  conflicts: readonly {
    readonly id: string;
    readonly recordType: string;
    readonly recordId: string;
    readonly local: unknown;
    readonly remote: unknown;
    readonly relatedChangeIds: readonly string[];
  }[],
) {
  return expandSyncConflicts(conflicts);
}

function localEraseViewFromSnapshot(snapshot: {
  readonly value: unknown;
  readonly context: {
    readonly removeGeminiApiKey: boolean;
    readonly error: { readonly message: string } | null;
  };
}): LocalEraseView {
  const phase = snapshot.value;
  return {
    phase: phase === "reviewing"
      ? "reviewing"
      : phase === "persistingChoice"
      ? "saving"
      : phase === "erasingLocal"
      ? "erasing"
      : phase === "removingKey"
      ? "removing-key"
      : phase === "failed"
      ? "failed"
      : phase === "completed"
      ? "completed"
      : "idle",
    removeGeminiApiKey: snapshot.context.removeGeminiApiKey,
    ...(snapshot.context.error === null
      ? {}
      : { error: snapshot.context.error.message }),
  };
}

function deleteEverywherePhaseFromValue(
  value: unknown,
): DeleteEverywhereView["phase"] {
  switch (value) {
    case "reviewing":
      return "reviewing";
    case "exporting":
      return "exporting";
    case "confirmingDecline":
      return "confirming-decline";
    case "confirming":
      return "confirming";
    case "persistingRetirement":
    case "publishingRetirement":
      return "publishing-retirement";
    case "persistingDriveDeletion":
    case "deletingDrive":
      return "deleting-drive";
    case "persistingLocalErasure":
    case "erasingLocal":
      return "erasing-local";
    case "persistingAwaitingDevices":
    case "awaitingDevices":
      return "awaiting-devices";
    case "persistingForcedFinalization":
    case "forcedFinalization":
      return "forced-finalization";
    case "failed":
      return "failed";
    case "persistingCompletion":
    case "completed":
      return "completed";
    default:
      return "idle";
  }
}

function deleteEverywhereViewFromSnapshot(snapshot: {
  readonly value: unknown;
  readonly context: {
    readonly generation: number;
    readonly progress: {
      readonly knownDeviceCount: number;
      readonly acknowledgedDeviceCount: number;
      readonly forcedDeviceCount: number;
    };
    readonly safetyExported: boolean;
    readonly safetyDeclined: boolean;
    readonly declineConfirmed: boolean;
    readonly error: { readonly message: string } | null;
  };
}): DeleteEverywhereView {
  const phase = deleteEverywherePhaseFromValue(snapshot.value);
  return {
    phase,
    safetyExported: snapshot.context.safetyExported,
    safetyDeclined: snapshot.context.safetyDeclined,
    declineConfirmed: snapshot.context.declineConfirmed,
    generation: snapshot.context.generation,
    knownDeviceCount: snapshot.context.progress.knownDeviceCount,
    acknowledgedDeviceCount: snapshot.context.progress.acknowledgedDeviceCount,
    forcedDeviceCount: snapshot.context.progress.forcedDeviceCount,
    ...(snapshot.context.error === null
      ? {}
      : { error: snapshot.context.error.message }),
    revoking: false,
  };
}

function deleteEverywhereViewFromProgress(
  progress: DeleteEverywhereProgressRecord,
): DeleteEverywhereView {
  return {
    phase: progress.phase,
    safetyExported: progress.safetyExported,
    safetyDeclined: progress.safetyDeclined,
    declineConfirmed: progress.declineConfirmed,
    generation: progress.generation,
    knownDeviceCount: progress.knownDeviceCount,
    acknowledgedDeviceCount: progress.acknowledgedDeviceCount,
    forcedDeviceCount: progress.forcedDeviceCount,
    revoking: false,
  };
}

export function SyncPortabilityRuntime({
  repository,
  screen,
  onNavigate,
  onNotice,
  secretStorage,
  onLocalErased,
  onSyncSummary,
  onSyncCompleted,
  children,
}: {
  readonly repository: LocalRepository;
  readonly screen: SyncPortabilityScreen;
  readonly onNavigate: (path: string) => void;
  readonly onNotice: (message: string) => void;
  readonly secretStorage: SecretStoragePort;
  readonly onLocalErased?: (scope: "local" | "everywhere") => void;
  readonly onSyncSummary?: (summary: string) => void;
  readonly onSyncCompleted?: () => void;
  readonly children: ReactNode;
}) {
  const ids = useMemo(createRuntimeIds, []);
  const runtimeBoundary = useMemo(configuredRuntimeBoundary, []);
  const driveAdapter = useMemo(
    () => createConfiguredDriveAdapter(runtimeBoundary),
    [runtimeBoundary],
  );
  const causal = useMemo(
    () =>
      runtimeBoundary.causal ??
        (driveAdapter === null
          ? createInMemoryCausalSyncPort()
          : createDriveCausalSyncPort({ drive: driveAdapter })),
    [driveAdapter, runtimeBoundary.causal],
  );
  const clock = runtimeClock;
  const syncDependencies = useMemo(
    () =>
      createDefaultSyncDependencies({
        local: repository,
        causal,
        recovery: runtimeBoundary.recovery ??
          ("resetRemoteSyncFile" in causal
            ? causal as CausalSyncRecoveryPort
            : undefined),
        deviceId: StableIdSchema.parse(repository.deviceId),
        ids,
        clock,
        initialNetwork: globalThis.navigator?.onLine === false
          ? "offline"
          : "online",
      }),
    [causal, ids, repository, runtimeBoundary.recovery],
  );
  const importAdapter = useMemo(
    () =>
      createImportExportAdapter({
        local: repository,
        causal,
        deviceId: StableIdSchema.parse(repository.deviceId),
        ids,
        clock,
        fileShare: createBrowserFileShare(),
        // Replace import is explicitly gated by a completed pull-before-push
        // exchange. Keep this composition at the runtime boundary so the
        // import actor cannot commit a configured replacement while Drive is
        // stale or unreachable.
        synchronizeBeforeReplace: async (options) => {
          if (driveAdapter === null) {
            throw { code: "invalid-request" };
          }
          const result = await runCausalExchange(
            {
              local: syncDependencies.local,
              remote: syncDependencies.causal,
              deviceId: syncDependencies.deviceId,
              ids: syncDependencies.ids,
              now: syncDependencies.clock.now,
              deviceRecords: syncDependencies.registry.portableDevices,
            },
            options,
          );
          await syncDependencies.registry.merge(
            result.snapshot.dataset.devices,
          );
          await syncDependencies.registry.touch();
        },
      }),
    [causal, driveAdapter, ids, repository, syncDependencies],
  );
  const syncMachine = useMemo(() => createSyncMachine(syncDependencies), [
    syncDependencies,
  ]);
  const conflictMachine = useMemo(
    () =>
      createConflictMachine({
        local: repository,
        deviceId: repository.deviceId,
        now: clock.now,
        ids,
      }),
    [ids, repository],
  );
  const [importWorkflowGeneration, setImportWorkflowGeneration] = useState(0);
  const [exportWorkflowGeneration, setExportWorkflowGeneration] = useState(0);
  const [safetyWorkflowGeneration, setSafetyWorkflowGeneration] = useState(0);
  const importMachine = useMemo(
    () => createImportMachine({ adapter: importAdapter }),
    [importAdapter, importWorkflowGeneration],
  );
  const exportMachine = useMemo(
    () => createExportMachine({ adapter: importAdapter }),
    [exportWorkflowGeneration, importAdapter],
  );
  const safetyExportMachine = useMemo(
    () => createExportMachine({ adapter: importAdapter }),
    [importAdapter, safetyWorkflowGeneration],
  );
  const [syncSnapshot, sendSync] = useActor(syncMachine, {
    input: syncDependencies,
  });
  const [conflictSnapshot, sendConflict] = useActor(conflictMachine, {
    input: {},
  });
  const [importSnapshot, sendImport] = useActor(importMachine);
  const [exportSnapshot, sendExport] = useActor(exportMachine);
  const [safetySnapshot, sendSafetyExport] = useActor(safetyExportMachine);
  const storage = useMemo(destructionStorage, []);
  const [localEraseRecovery] = useState(() => {
    if (storage === undefined) return undefined;
    try {
      return readLocalEraseProgress(storage);
    } catch {
      // The local erase dialog will remain available for a fresh, explicit
      // attempt if its redacted recovery record is corrupt or unavailable.
      return undefined;
    }
  });
  const localEraseMachine = useMemo(
    () =>
      createLocalEraseMachine({
        storage,
        now: clock.now,
        eraseLocalDataset: async () => {
          if (driveAdapter?.status() === "authorized") {
            await driveAdapter.disconnect();
          }
          sendSync({ type: "sync.disconnect" });
          const databaseName = repository.databaseName;
          repository.close();
          await deleteLocalRepositoryDatabase(databaseName);
        },
        removeGeminiApiKey: async () => {
          await secretStorage.remove("gemini-api-key");
        },
      }),
    [driveAdapter, repository, secretStorage, sendSync, storage],
  );
  const localEraseInitialSnapshot = useMemo(
    () =>
      localEraseRecovery === undefined
        ? undefined
        : recoverLocalEraseSnapshot(localEraseMachine, localEraseRecovery),
    [localEraseMachine, localEraseRecovery],
  );
  const [localEraseSnapshot, sendLocalErase] = useRestartableActor(
    localEraseMachine,
    0,
    localEraseInitialSnapshot,
  );
  const [deleteEverywhereGeneration, setDeleteEverywhereGeneration] = useState(
    0,
  );
  const [deleteEverywhereRecovery] = useState<
    DeleteEverywhereProgressRecord | undefined
  >(
    () => {
      try {
        return storage === undefined
          ? undefined
          : readDeleteEverywhereProgress(storage);
      } catch {
        return undefined;
      }
    },
  );
  const deleteEverywhereMachine = useMemo(
    () =>
      createDeleteEverywhereMachine({
        createSafetyExport: async () => await repository.exportDataset(),
        saveSafetyExport: saveDestructionSafetyExport,
        persistProgress: (progress) =>
          writeDeleteEverywhereProgress(progress, storage),
        now: clock.now,
        publishRetirement: async (generation) => {
          if (driveAdapter === null || driveAdapter.status() !== "authorized") {
            throw adapterError("unauthorized", "destruction.retirement");
          }
          await publishDriveRetirement(driveAdapter, generation);
          sendSync({ type: "sync.retire" });
        },
        deleteDriveGeneration: async (generation) => {
          if (driveAdapter === null) {
            throw adapterError("unauthorized", "destruction.drive-delete");
          }
          await deleteDriveGeneration(driveAdapter, generation);
        },
        eraseLocalDataset: async () => {
          const databaseName = repository.databaseName;
          repository.close();
          await deleteLocalRepositoryDatabase(databaseName);
        },
      }),
    [deleteEverywhereGeneration, driveAdapter, repository, sendSync, storage],
  );
  const deleteEverywhereInitialSnapshot = useMemo(
    () =>
      deleteEverywhereRecovery === undefined
        ? undefined
        : recoverDeleteEverywhereSnapshot(
          deleteEverywhereMachine,
          deleteEverywhereRecovery,
        ),
    [deleteEverywhereMachine, deleteEverywhereRecovery],
  );
  const [deleteEverywhereSnapshot, sendDeleteEverywhere] = useRestartableActor(
    deleteEverywhereMachine,
    deleteEverywhereGeneration,
    deleteEverywhereGeneration === 0
      ? deleteEverywhereInitialSnapshot
      : undefined,
  );
  const [deleteEverywhereRevoking, setDeleteEverywhereRevoking] = useState(
    false,
  );
  const [deleteEverywhereRevocationError, setDeleteEverywhereRevocationError] =
    useState<string>();
  const [deleteFinalizationRetry, setDeleteFinalizationRetry] = useState(0);
  const [deleteOpenRequested, setDeleteOpenRequested] = useState(false);
  const [localGeneration, setLocalGeneration] = useState(1);
  const localEraseHandled = useRef(false);
  const deleteFinalizationHandled = useRef(false);
  const recoveryReinitializeTarget = useRef<
    DeleteEverywhereProgressPhase | null
  >(null);
  const [customValues, setCustomValues] = useState<Record<string, string>>({});
  const [conflictPane, setConflictPane] = useState<"list" | "detail">("list");
  const [fileName, setFileName] = useState<string>();
  const [replacementConfirmation, setReplacementConfirmation] = useState<
    ReplacementConfirmation
  >(
    "unconfirmed",
  );
  const [pendingImportContents, setPendingImportContents] = useState<
    string | null
  >(null);
  const [pendingExportRequest, setPendingExportRequest] = useState<
    ExportEvent | null
  >(null);
  const previousScreen = useRef<SyncPortabilityScreen>(null);
  const lastResolvedConflict = useRef<string | null>(null);
  const deviceProjectionVersion = useSyncExternalStore(
    syncDependencies.registry.subscribe,
    syncDependencies.registry.revision,
    syncDependencies.registry.revision,
  );
  const syncView = syncViewFromSnapshot(
    syncSnapshot,
    driveAdapter?.status() ?? null,
    syncDependencies.recovery !== undefined,
  );
  const handledSyncCompletion = useRef<string | null>(null);

  useEffect(() => {
    onSyncSummary?.(settingsSyncSummary(syncView));
  }, [onSyncSummary, syncView]);

  useEffect(() => {
    requestLocalShellRefreshAfterSync(
      syncSnapshot,
      handledSyncCompletion,
      () => onSyncCompleted?.(),
    );
  }, [onSyncCompleted, syncSnapshot]);

  useEffect(() => {
    const onOffline = () => sendSync({ type: "sync.network.offline" });
    const onOnline = () => sendSync({ type: "sync.network.online" });
    globalThis.addEventListener("offline", onOffline);
    globalThis.addEventListener("online", onOnline);
    return () => {
      globalThis.removeEventListener("offline", onOffline);
      globalThis.removeEventListener("online", onOnline);
    };
  }, [sendSync]);

  useEffect(() => {
    const previous = previousScreen.current;
    if (previous === "import-export" && screen !== "import-export") {
      sendImport({ type: "import.cancel" });
      sendExport({ type: "export.cancel" });
      sendSafetyExport({ type: "export.cancel" });
      setPendingImportContents(null);
      setPendingExportRequest(null);
    }
    if (screen === "import-export" && previous !== "import-export") {
      // Terminal XState actors are intentionally replaced at the workflow
      // boundary. This makes route re-entry deterministic and also clears the
      // safety-export confirmation tied to the previous selected file.
      setImportWorkflowGeneration((generation) => generation + 1);
      setExportWorkflowGeneration((generation) => generation + 1);
      setSafetyWorkflowGeneration((generation) => generation + 1);
      setFileName(undefined);
      setPendingImportContents(null);
      setPendingExportRequest(null);
      setReplacementConfirmation("unconfirmed");
    }
    previousScreen.current = screen;
  }, [screen, sendExport, sendImport, sendSafetyExport]);

  useEffect(() => {
    if (screen === "import-export" && importSnapshot.matches("idle")) {
      sendImport({
        type: "import.open",
        driveConfigured: syncView.mode === "configured",
        online: globalThis.navigator?.onLine !== false,
      });
    }
  }, [importSnapshot, screen, sendImport, syncView.mode]);

  useEffect(() => {
    if (
      pendingImportContents !== null &&
      importSnapshot.matches("choosing")
    ) {
      sendImport({
        type: "import.file-selected",
        contents: pendingImportContents,
      });
      setPendingImportContents(null);
    }
  }, [importSnapshot, pendingImportContents, sendImport]);

  useEffect(() => {
    if (pendingExportRequest !== null && exportSnapshot.matches("idle")) {
      sendExport(pendingExportRequest);
      setPendingExportRequest(null);
    }
  }, [exportSnapshot, pendingExportRequest, sendExport]);

  useEffect(() => {
    if (
      syncSnapshot.context.conflicts.length > 0 &&
      conflictSnapshot.matches("idle")
    ) {
      sendConflict({
        type: "conflict.refresh",
        observations: observationsFromSyncConflicts(
          syncSnapshot.context.conflicts,
        ),
      });
    }
  }, [conflictSnapshot, sendConflict, syncSnapshot]);

  useEffect(() => {
    const result = conflictSnapshot.context.result;
    if (!conflictSnapshot.matches("resolved") || result === null) return;
    const resolutionId = result.resolutionRevision.id;
    if (lastResolvedConflict.current === resolutionId) return;
    lastResolvedConflict.current = resolutionId;
    // The conflict actor has reached its resolved state only after its local
    // commit succeeded. A failed commit therefore leaves the sync banner and
    // conflict count untouched.
    sendSync({ type: "sync.resolve-conflicts" });
  }, [conflictSnapshot, sendSync]);

  const deviceProjection = useMemo(
    () => {
      const portableDevices = syncDependencies.registry.portableDevices();
      return deviceViewModels(
        syncDependencies.registry.ordinaryProjection().map((device, index) => ({
          ...device,
          stableKey: portableDevices[index]?.id ?? `device-${index}`,
        })),
        syncDependencies.registry.diagnosticProjection().map((device) => ({
          stableKey: device.id,
          label: device.label,
          lastSeenAt: device.lastSeenAt,
          current: device.current,
          retirementAcknowledgement: device.acknowledged
            ? "acknowledged" as const
            : "pending" as const,
          id: device.id,
          exactLastSeenAt: device.lastSeenAt,
        })),
      );
    },
    [deviceProjectionVersion, syncDependencies],
  );

  useEffect(() => {
    let active = true;
    void repository.loadDocument().then((document) => {
      if (
        active && Number.isSafeInteger(document.generation) &&
        document.generation > 0
      ) {
        setLocalGeneration(document.generation);
      }
    }).catch(() => undefined);
    return () => {
      active = false;
    };
  }, [repository]);

  useEffect(() => {
    if (deleteEverywhereSnapshot.matches("cancelled")) {
      try {
        clearDeleteEverywhereProgress(storage);
      } catch {
        onNotice(
          "Delete Everywhere cancellation could not clear saved progress safely.",
        );
      }
      return;
    }
    try {
      persistDeleteEverywhereSnapshot(
        deleteEverywhereSnapshot,
        clock.now,
        storage,
      );
    } catch {
      onNotice("Delete Everywhere progress could not be persisted safely.");
    }
  }, [clock, deleteEverywhereSnapshot, onNotice, storage]);

  useEffect(() => {
    const recovery = deleteEverywhereRecovery;
    if (
      recovery === undefined || deleteEverywhereGeneration !== 0 ||
      !deleteEverywhereSnapshot.matches("idle") ||
      recoveryReinitializeTarget.current !== null
    ) return;
    const interrupted = recovery.phase === "exporting" ||
      recovery.phase === "publishing-retirement" ||
      recovery.phase === "deleting-drive" ||
      recovery.phase === "erasing-local";
    if (!interrupted) return;
    recoveryReinitializeTarget.current = recovery.phase;
    sendDeleteEverywhere({
      type: "delete-everywhere.open",
      generation: recovery.generation,
      progress: {
        knownDeviceCount: recovery.knownDeviceCount,
        acknowledgedDeviceCount: recovery.acknowledgedDeviceCount,
        forcedDeviceCount: recovery.forcedDeviceCount,
      },
    });
    if (recovery.safetyDeclined && recovery.declineConfirmed) {
      sendDeleteEverywhere({
        type: "delete-everywhere.decline-safety-export",
      });
      sendDeleteEverywhere({ type: "delete-everywhere.confirm-decline" });
    } else {
      // Re-exporting on recovery is safe and keeps the export boundary
      // complete even if the original browser stopped during delivery.
      sendDeleteEverywhere({ type: "delete-everywhere.export-safety" });
    }
  }, [
    deleteEverywhereGeneration,
    deleteEverywhereRecovery,
    deleteEverywhereSnapshot,
    sendDeleteEverywhere,
  ]);

  useEffect(() => {
    const target = recoveryReinitializeTarget.current;
    if (target === null) return;
    if (
      target === "exporting" && deleteEverywhereSnapshot.matches("exporting")
    ) {
      recoveryReinitializeTarget.current = null;
      return;
    }
    if (!deleteEverywhereSnapshot.matches("confirming")) return;
    if (
      target === "publishing-retirement" || target === "deleting-drive" ||
      target === "erasing-local"
    ) {
      recoveryReinitializeTarget.current = null;
      sendDeleteEverywhere({ type: "delete-everywhere.confirm" });
    }
  }, [deleteEverywhereSnapshot, sendDeleteEverywhere]);

  useEffect(() => {
    try {
      persistLocalEraseSnapshot(localEraseSnapshot, clock.now, storage);
    } catch {
      onNotice("Local erase recovery could not be saved safely.");
    }
  }, [clock, localEraseSnapshot, onNotice, storage]);

  useEffect(() => {
    if (!localEraseSnapshot.matches("completed") || localEraseHandled.current) {
      return;
    }
    localEraseHandled.current = true;
    onLocalErased?.("local");
  }, [localEraseSnapshot, onLocalErased]);

  useEffect(() => {
    if (
      !deleteEverywhereSnapshot.matches("awaitingDevices") &&
      !deleteEverywhereSnapshot.matches("forcedFinalization")
    ) return;
    const acknowledged = deviceProjection.devices.filter((device) =>
      device.retirementAcknowledgement === "acknowledged"
    ).length;
    if (
      acknowledged !==
        deleteEverywhereSnapshot.context.progress.acknowledgedDeviceCount
    ) {
      sendDeleteEverywhere({
        type: "delete-everywhere.device-ack",
        count: acknowledged,
      });
    }
  }, [
    deleteEverywhereSnapshot,
    deviceProjection.devices,
    sendDeleteEverywhere,
  ]);

  useEffect(() => {
    if (
      !deleteEverywhereSnapshot.matches("completed") ||
      deleteFinalizationHandled.current
    ) return;
    deleteFinalizationHandled.current = true;
    if (driveAdapter === null || storage === undefined) {
      setDeleteEverywhereRevocationError(
        "Cloud retirement completed, but final authorization cleanup is unavailable.",
      );
      return;
    }
    setDeleteEverywhereRevoking(true);
    void finalizeDeleteEverywhere(
      driveAdapter,
      deleteEverywhereSnapshot.context.progress,
      storage,
      () => {
        // The actor has already gated entry to completed, but keep this
        // finalization boundary explicit: revocation must never follow a
        // failed or unavailable durable-progress write.
        persistDeleteEverywhereSnapshot(
          deleteEverywhereSnapshot,
          clock.now,
          storage,
        );
      },
    ).then(() => {
      setDeleteEverywhereRevoking(false);
      onLocalErased?.("everywhere");
    }).catch(() => {
      setDeleteEverywhereRevoking(false);
      setDeleteEverywhereRevocationError(
        "Cloud retirement completed, but Google authorization could not be revoked. Do not reconnect this account until it is revoked.",
      );
    });
  }, [
    deleteEverywhereSnapshot,
    deleteFinalizationRetry,
    driveAdapter,
    onLocalErased,
    storage,
  ]);

  const localEraseView = localEraseViewFromSnapshot(localEraseSnapshot);
  const deleteEverywhereView = deleteEverywhereSnapshot.matches("idle") &&
      deleteEverywhereRecovery !== undefined
    ? deleteEverywhereViewFromProgress(deleteEverywhereRecovery)
    : deleteEverywhereViewFromSnapshot(deleteEverywhereSnapshot);
  const destructionDevices: DestructionDeviceView[] = deviceProjection.devices
    .map(
      (device) => ({
        stableKey: device.stableKey,
        label: device.label,
        lastSeenAt: device.lastSeenAt,
        current: device.current,
        acknowledged: device.retirementAcknowledgement === "acknowledged",
      }),
    );
  const safetyStatus: SafetyExportStatus =
    safetySnapshot.matches("exporting") ||
      safetySnapshot.matches("delivering")
      ? "exporting"
      : safetySnapshot.matches("completed")
      ? "ready"
      : safetySnapshot.matches("failed")
      ? "error"
      : "not-started";
  const conflictView = conflictViewFromSnapshot(
    conflictSnapshot,
    customValues,
    syncSnapshot.context.online,
    conflictPane,
  );
  const importView = importViewFromSnapshot(
    importSnapshot,
    syncView,
    fileName,
    safetyStatus,
    safetySnapshot.context.error?.message,
    replacementConfirmation,
  );
  const exportView = exportViewFromSnapshot(exportSnapshot);

  const sendConflictEvent = (event: ConflictActorEvent) => sendConflict(event);
  const sendImportEvent = (event: ImportEvent) => sendImport(event);
  const sendExportEvent = (event: ExportEvent) => sendExport(event);

  const syncAfterAuthorization = useRef(false);
  useEffect(() => {
    if (syncAfterAuthorization.current && syncSnapshot.matches("idle")) {
      syncAfterAuthorization.current = false;
      sendSync({ type: "sync.request", request: { reason: "reconnect" } });
    }
  }, [sendSync, syncSnapshot]);

  const authorizeDrive = (reconnect = false) => {
    if (driveAdapter === null) {
      onNotice(
        "Google Drive is unavailable until OAuth client configuration is provided.",
      );
      return;
    }
    syncAfterAuthorization.current = true;
    const authorizationOptions = reconnect
      ? { prompt: "" as const }
      : undefined;
    void driveAdapter.authorize(authorizationOptions).then((session) => {
      sendSync({
        type: "sync.configure",
        accountEmail: session.accountId,
        online: globalThis.navigator?.onLine !== false,
      });
    }).catch(() => {
      syncAfterAuthorization.current = false;
      onNotice(
        "Google Drive authorization was cancelled or unavailable. Local data remains available.",
      );
    });
  };

  const requestExport = (delivery: "download" | "share") => {
    const event: ExportEvent = {
      type: "export.request",
      share: delivery === "share",
    };
    if (
      exportSnapshot.matches("completed") ||
      exportSnapshot.matches("cancelled") ||
      exportSnapshot.matches("failed")
    ) {
      setExportWorkflowGeneration((generation) => generation + 1);
      setPendingExportRequest(event);
      return;
    }
    sendExportEvent(event);
  };

  const selectImportFile = (file: File) => {
    setFileName(file.name);
    void file.text().then((contents) => {
      const terminal = importSnapshot.matches("completed") ||
        importSnapshot.matches("cancelled") ||
        importSnapshot.matches("failed");
      if (terminal) {
        setImportWorkflowGeneration((generation) => generation + 1);
        setSafetyWorkflowGeneration((generation) => generation + 1);
        setReplacementConfirmation("unconfirmed");
        setPendingImportContents(contents);
        return;
      }
      sendImportEvent({ type: "import.file-selected", contents });
    }).catch(() => onNotice("The selected backup could not be read."));
  };

  const closeImportExport = () => {
    sendImport({ type: "import.cancel" });
    sendExport({ type: "export.cancel" });
    sendSafetyExport({ type: "export.cancel" });
    onNavigate("/settings");
  };

  const openLocalErase = () => {
    localEraseHandled.current = false;
    const removeGeminiApiKey = storage === undefined
      ? true
      : readLocalEraseGeminiKeyChoice(storage);
    if (
      localEraseSnapshot.matches("completed") ||
      localEraseSnapshot.matches("cancelled")
    ) {
      sendLocalErase({ type: "local-erase.reset" });
      sendLocalErase({ type: "local-erase.open", removeGeminiApiKey });
      return;
    }
    sendLocalErase({ type: "local-erase.open", removeGeminiApiKey });
  };

  const openDeleteEverywhere = () => {
    deleteFinalizationHandled.current = false;
    const knownDeviceCount = Math.max(1, destructionDevices.length);
    const acknowledgedDeviceCount = Math.min(
      knownDeviceCount,
      destructionDevices.filter((device) => device.acknowledged).length,
    );
    if (
      deleteEverywhereSnapshot.matches("completed") ||
      deleteEverywhereSnapshot.matches("cancelled") ||
      deleteEverywhereSnapshot.matches("failed")
    ) {
      setDeleteEverywhereGeneration((generation) => generation + 1);
      setDeleteOpenRequested(true);
      return;
    }
    sendDeleteEverywhere({
      type: "delete-everywhere.open",
      generation: localGeneration,
      progress: {
        knownDeviceCount,
        acknowledgedDeviceCount,
        forcedDeviceCount: 0,
      },
    });
  };

  useEffect(() => {
    if (!deleteOpenRequested || !deleteEverywhereSnapshot.matches("idle")) {
      return;
    }
    setDeleteOpenRequested(false);
    const knownDeviceCount = Math.max(1, destructionDevices.length);
    sendDeleteEverywhere({
      type: "delete-everywhere.open",
      generation: localGeneration,
      progress: {
        knownDeviceCount,
        acknowledgedDeviceCount: Math.min(
          knownDeviceCount,
          destructionDevices.filter((device) => device.acknowledged).length,
        ),
        forcedDeviceCount: 0,
      },
    });
  }, [
    deleteEverywhereSnapshot,
    deleteOpenRequested,
    destructionDevices,
    localGeneration,
    sendDeleteEverywhere,
  ]);

  const cancelLocalErase = () => {
    sendLocalErase({ type: "local-erase.cancel" });
  };

  const cancelDeleteEverywhere = () => {
    sendDeleteEverywhere({ type: "delete-everywhere.cancel" });
  };

  const retryDeleteEverywhereFinalization = () => {
    deleteFinalizationHandled.current = false;
    setDeleteEverywhereRevocationError(undefined);
    setDeleteFinalizationRetry((retry) => retry + 1);
  };

  const content = screen === "sync"
    ? (
      <GoogleDriveSyncScreen
        view={syncView}
        knownDeviceCount={deviceProjection.devices.length}
        onConnect={() => authorizeDrive()}
        onRetry={() => sendSync({ type: "sync.retry" })}
        onRecoverCorruptData={() =>
          sendSync({ type: "sync.recover-corrupt-data" })}
        onSyncNow={() =>
          sendSync({ type: "sync.request", request: { reason: "manual" } })}
        onOpenConflicts={() => onNavigate("/settings/conflicts")}
        onManageDevices={() => onNavigate("/settings/devices")}
        onSwitchAccount={() => authorizeDrive()}
        onConfirmAccountSwitch={() =>
          sendSync({ type: "sync.account.confirm" })}
        onCancelAccountSwitch={() => sendSync({ type: "sync.account.cancel" })}
        onDisconnect={() => {
          if (driveAdapter === null) {
            sendSync({ type: "sync.disconnect" });
            return;
          }
          void driveAdapter.disconnect().then(() => {
            sendSync({ type: "sync.disconnect" });
          }).catch(() => onNotice("Google Drive could not be disconnected."));
        }}
        onReconnect={() => authorizeDrive(true)}
        onBack={() => onNavigate("/settings")}
      />
    )
    : screen === "devices"
    ? (
      <KnownDevicesScreen
        devices={deviceProjection.devices}
        technicalDetails={deviceProjection.technical}
        onRename={async (device) => {
          const diagnostic = deviceProjection.technical.find((candidate) =>
            candidate.id === device.stableKey
          );
          if (diagnostic === undefined) return;
          try {
            await syncDependencies.registry.rename(diagnostic.id, device.label);
          } catch {
            onNotice("This device name could not be saved.");
          }
        }}
        onAcknowledgeRetirement={async (device) => {
          const diagnostic = deviceProjection.technical.find((candidate) =>
            candidate.id === device.stableKey
          );
          if (diagnostic === undefined) return;
          try {
            await syncDependencies.registry.acknowledge(diagnostic.id);
          } catch {
            onNotice("This device retirement could not be acknowledged.");
          }
        }}
        onBack={() => onNavigate("/settings/sync")}
      />
    )
    : screen === "conflicts"
    ? (
      <ConflictReviewScreen
        viewModel={conflictView}
        onBack={() => onNavigate("/settings/sync")}
        onOpenGroup={(groupId) => {
          setConflictPane("detail");
          sendConflictEvent({ type: "conflict.open", groupId });
        }}
        onShowList={() => setConflictPane("list")}
        onChooseCandidate={(candidateId) =>
          sendConflictEvent({ type: "conflict.choose-candidate", candidateId })}
        onCustomValueChange={(value) => {
          const groupId = conflictSnapshot.context.activeGroupId;
          if (groupId !== null) {
            setCustomValues((current) => ({ ...current, [groupId]: value }));
          }
        }}
        onChooseCustom={(value) =>
          sendConflictEvent({ type: "conflict.choose-custom", value })}
        onKeepEdited={() => sendConflictEvent({ type: "conflict.keep-edited" })}
        onDeleteRecord={() =>
          sendConflictEvent({ type: "conflict.delete-record" })}
        onSubmit={() => sendConflictEvent({ type: "conflict.submit" })}
        onRetry={() => sendConflictEvent({ type: "conflict.retry" })}
      />
    )
    : screen === "import-export"
    ? (
      <ImportExportScreen
        exportModel={exportView}
        importModel={importView}
        onBack={closeImportExport}
        onExport={requestExport}
        onRetryExport={() => sendExportEvent({ type: "export.retry" })}
        onCancelExport={() => sendExportEvent({ type: "export.cancel" })}
        onFileSelected={selectImportFile}
        onModeChange={(mode: ImportMode) =>
          sendImportEvent({
            type: mode === "merge"
              ? "import.choose-merge"
              : "import.choose-replace",
          })}
        onSafetyExport={() =>
          sendSafetyExport({ type: "export.request", share: false })}
        onSafetyExportRetry={() => sendSafetyExport({ type: "export.retry" })}
        onReplacementConfirmationChange={setReplacementConfirmation}
        onCommit={() => sendImportEvent({ type: "import.commit" })}
        onRetryImport={() => sendImportEvent({ type: "import.retry" })}
        onReviewConflicts={() => onNavigate("/settings/conflicts")}
        onCancelImport={closeImportExport}
      />
    )
    : screen === "privacy"
    ? (
      <DataPrivacyScreen
        connected={syncView.mode === "configured"}
        localErase={localEraseView}
        deleteEverywhere={{
          ...deleteEverywhereView,
          revoking: deleteEverywhereRevoking,
          ...(deleteEverywhereRevocationError === undefined
            ? {}
            : { error: deleteEverywhereRevocationError }),
        }}
        devices={destructionDevices}
        onBack={() => onNavigate("/settings")}
        onDisconnect={() => {
          if (driveAdapter === null) {
            sendSync({ type: "sync.disconnect" });
            return;
          }
          void driveAdapter.disconnect().then(() => {
            sendSync({ type: "sync.disconnect" });
          }).catch(() => onNotice("Google Drive could not be disconnected."));
        }}
        onOpenLocalErase={openLocalErase}
        onLocalEraseChoice={(removeGeminiApiKey) =>
          sendLocalErase({ type: "local-erase.choice", removeGeminiApiKey })}
        onConfirmLocalErase={() =>
          sendLocalErase({ type: "local-erase.confirm" })}
        onRetryLocalErase={() => sendLocalErase({ type: "local-erase.retry" })}
        onCancelLocalErase={cancelLocalErase}
        onOpenDeleteEverywhere={openDeleteEverywhere}
        onSafetyExport={() =>
          sendDeleteEverywhere({ type: "delete-everywhere.export-safety" })}
        onDeclineSafetyExport={() =>
          sendDeleteEverywhere({
            type: "delete-everywhere.decline-safety-export",
          })}
        onConfirmDecline={() =>
          sendDeleteEverywhere({ type: "delete-everywhere.confirm-decline" })}
        onConfirmDeleteEverywhere={() =>
          sendDeleteEverywhere({ type: "delete-everywhere.confirm" })}
        onForceFinalize={() =>
          sendDeleteEverywhere({ type: "delete-everywhere.force-finalize" })}
        onRetryDeleteEverywhere={() =>
          sendDeleteEverywhere({ type: "delete-everywhere.retry" })}
        onRetryFinalization={retryDeleteEverywhereFinalization}
        onCancelDeleteEverywhere={cancelDeleteEverywhere}
      />
    )
    : children;

  const showShellStatus = screen !== "sync" &&
    isGlobalStatusActionable(syncView);

  return (
    <>
      {showShellStatus
        ? (
          <Stack gap={1} className="sync-ui-shell-status">
            <SyncGlobalStatus
              view={syncView}
              onOpenSync={() => onNavigate("/settings/sync")}
            />
          </Stack>
        )
        : null}
      {content}
    </>
  );
}
