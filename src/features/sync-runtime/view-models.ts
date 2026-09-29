import type { createSyncActor } from "../../actors/sync/index.ts";
import type { createConflictActor } from "../../actors/conflict/index.ts";
import type {
  createExportActor,
  createImportActor,
} from "../../actors/import-export/index.ts";
import type { DriveAuthState } from "../../adapters/ports/index.ts";
import {
  groupConflictObservations,
  observationsFromSyncConflicts as expandSyncConflicts,
} from "../../domain/conflict/merge.ts";
import type {
  DeleteEverywhereFailureOperation,
  DeleteEverywhereProgressRecord,
} from "../../domain/destruction.ts";
import type {
  ConflictChoice,
  ConflictGroupViewModel,
  ConflictReviewViewModel,
  ExportViewModel,
  ImportPreviewViewModel,
  ImportViewModel,
  ReplacementConfirmation,
  SafetyExportStatus,
} from "../conflict-import-ui/index.ts";
import {
  type DiagnosticDeviceViewModel,
  type KnownDeviceViewModel,
  type SyncConnectionViewModel,
  type SyncNetworkMode,
  syncStatusCopy,
} from "../sync-ui/index.ts";
import type {
  DeleteEverywhereView,
  DestructionDeviceView,
  LocalEraseView,
} from "../destruction-ui.tsx";
import { requiresDriveAuthorization } from "./drive-config.ts";

export const AUTOMATIC_SYNC_COOLDOWN_MS = 60 * 60 * 1_000;

export type AutomaticSyncState = {
  readonly lastSuccessfulSyncAt: string | null;
  readonly pendingLocalChanges: boolean;
};

export const AUTOMATIC_SYNC_STATE_KEY = "did_it_automatic_sync_state";
export const EMPTY_AUTOMATIC_SYNC_STATE: AutomaticSyncState = {
  lastSuccessfulSyncAt: null,
  pendingLocalChanges: false,
};

export function automaticSyncDelay(
  lastSuccessfulSyncAt: string | null,
  now = Date.now(),
): number {
  if (lastSuccessfulSyncAt === null) return 0;
  const lastSuccessful = Date.parse(lastSuccessfulSyncAt);
  if (!Number.isFinite(lastSuccessful)) return 0;
  return Math.max(
    0,
    lastSuccessful + AUTOMATIC_SYNC_COOLDOWN_MS - now,
  );
}

export function readAutomaticSyncState(): AutomaticSyncState {
  try {
    const value = globalThis.localStorage?.getItem(AUTOMATIC_SYNC_STATE_KEY);
    if (value === null || value === undefined) {
      return EMPTY_AUTOMATIC_SYNC_STATE;
    }
    const parsed = JSON.parse(value) as Record<string, unknown>;
    return {
      lastSuccessfulSyncAt: typeof parsed.lastSuccessfulSyncAt === "string"
        ? parsed.lastSuccessfulSyncAt
        : null,
      pendingLocalChanges: parsed.pendingLocalChanges === true,
    };
  } catch {
    return EMPTY_AUTOMATIC_SYNC_STATE;
  }
}

export function writeAutomaticSyncState(state: AutomaticSyncState): void {
  try {
    globalThis.localStorage?.setItem(
      AUTOMATIC_SYNC_STATE_KEY,
      JSON.stringify(state),
    );
  } catch {
    // Automatic sync still works for this session when storage is unavailable.
  }
}

export function humanize(value: string): string {
  return value
    .replace(/[-_]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (character) => character.toUpperCase());
}

export type SyncCompletionSnapshot = {
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

export function settingsSyncSummary(view: SyncConnectionViewModel): string {
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

export function deleteEverywhereProgressForDevices(
  devices: readonly Pick<DestructionDeviceView, "acknowledged">[],
): {
  readonly knownDeviceCount: number;
  readonly acknowledgedDeviceCount: number;
  readonly forcedDeviceCount: number;
} {
  const knownDeviceCount = Math.max(1, devices.length);
  return {
    knownDeviceCount,
    acknowledgedDeviceCount: Math.min(
      knownDeviceCount,
      devices.filter((device) => device.acknowledged).length,
    ),
    forcedDeviceCount: 0,
  };
}

export function connectivityFor(
  online: boolean,
): SyncNetworkMode {
  return online && globalThis.navigator?.onLine !== false
    ? "online"
    : "offline";
}

export function syncViewFromSnapshot(
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

export function conflictViewFromSnapshot(
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

export function importPreviewFromContext(
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

export function importViewFromSnapshot(
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
    conflictCount: 0,
    ...(context.error === null ? {} : {
      error: {
        message: context.error.message,
        retryable: context.error.retryable,
      },
    }),
  };
}

export function exportViewFromSnapshot(
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

export function conflictIdsForResolution(
  conflicts: readonly {
    readonly id: string;
    readonly recordType: string;
    readonly recordId: string;
    readonly local: unknown;
    readonly remote: unknown;
    readonly relatedChangeIds: readonly string[];
  }[],
  groupId: string,
  parentRevisionIds: readonly string[],
): readonly string[] {
  const parents = new Set(parentRevisionIds);
  return conflicts.filter((conflict) => {
    const groups = groupConflictObservations(
      observationsFromSyncConflicts([conflict]),
    );
    const resolvedGroup = groups.find((group) => group.id === groupId);
    return resolvedGroup !== undefined &&
      resolvedGroup.parentRevisionIds.every((parent) => parents.has(parent));
  }).map((conflict) => conflict.id);
}

export function conflictIdsForResolutions(
  conflicts: Parameters<typeof conflictIdsForResolution>[0],
  resolutions: readonly {
    readonly groupId: string;
    readonly parentRevisionIds: readonly string[];
  }[],
): readonly string[] {
  const ids = new Set<string>();
  for (const resolution of resolutions) {
    for (
      const conflictId of conflictIdsForResolution(
        conflicts,
        resolution.groupId,
        resolution.parentRevisionIds,
      )
    ) {
      ids.add(conflictId);
    }
  }
  return [...ids];
}

export function localEraseViewFromSnapshot(snapshot: {
  readonly value: unknown;
  readonly context: {
    readonly removeReceiptAiKeys: boolean;
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
      : phase === "partial"
      ? "partial"
      : phase === "completed"
      ? "completed"
      : "idle",
    removeReceiptAiKeys: snapshot.context.removeReceiptAiKeys,
    ...(snapshot.context.error === null
      ? {}
      : { error: snapshot.context.error.message }),
  };
}

export function deleteEverywherePhaseFromValue(
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

export function deleteEverywhereFailureIsCancelable(
  operation: DeleteEverywhereFailureOperation | null | undefined,
): boolean {
  return operation === undefined || operation === null ||
    operation === "exporting" || operation === "persistingRetirement";
}

export function deleteEverywhereRecoveryPassedLocalErase(
  progress: DeleteEverywhereProgressRecord,
): boolean {
  if (
    progress.phase === "awaiting-devices" ||
    progress.phase === "forced-finalization" ||
    progress.phase === "completed"
  ) return true;
  return progress.phase === "failed" && (
    progress.failureOperation === "erasingLocal" ||
    progress.failureOperation === "persistingAwaitingDevices" ||
    progress.failureOperation === "persistingForcedFinalization" ||
    progress.failureOperation === "persistingCompletion"
  );
}

export function deleteEverywhereViewFromSnapshot(snapshot: {
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
    readonly failureState: DeleteEverywhereFailureOperation | null;
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
    cancelable: deleteEverywhereFailureIsCancelable(
      snapshot.context.failureState,
    ),
    revoking: false,
  };
}

export function deleteEverywhereViewFromProgress(
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
    cancelable: deleteEverywhereFailureIsCancelable(
      progress.failureOperation,
    ),
    revoking: false,
  };
}
