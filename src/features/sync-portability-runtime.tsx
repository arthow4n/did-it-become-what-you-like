import { useActor } from "@xstate/react";
import { type ReactNode, useEffect, useMemo, useState } from "react";
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
import type { ImportEvent } from "../actors/contracts/index.ts";
import { createImportExportAdapter } from "../adapters/import-export/index.ts";
import { createInMemoryCausalSyncPort } from "../adapters/sync/causal.ts";
import type { FileSharePort } from "../adapters/ports/index.ts";
import { type StableId, StableIdSchema } from "../domain/index.ts";
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
  KnownDevicesScreen,
  type KnownDeviceViewModel,
  type SyncConnectionViewModel,
} from "./sync-ui/index.ts";
import {
  type DiagnosticDeviceViewModel,
  type SyncNetworkMode,
} from "./sync-ui/types.ts";

export type SyncPortabilityScreen =
  | "sync"
  | "devices"
  | "conflicts"
  | "import-export"
  | null;

type RuntimeIds = {
  readonly next: (kind: string) => StableId;
};

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

function humanize(value: string): string {
  return value
    .replace(/[-_]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (character) => character.toUpperCase());
}

function syncViewFromSnapshot(
  snapshot: ReturnType<typeof createSyncActor> extends infer Actor
    ? Actor extends { getSnapshot: () => infer Snapshot } ? Snapshot : never
    : never,
): SyncConnectionViewModel {
  const context = snapshot.context;
  if (snapshot.matches("hydrating") || snapshot.matches("configuring")) {
    return { mode: "connecting" };
  }
  if (context.accountEmail === null) return { mode: "disconnected" };

  let sync:
    | "synced"
    | "syncing"
    | "conflict"
    | "authorization-error"
    | "retryable-error"
    | "error"
    | "retired" = "synced";
  if (snapshot.matches("synchronizing")) sync = "syncing";
  else if (snapshot.matches("conflict")) sync = "conflict";
  else if (snapshot.matches("retryableError")) sync = "retryable-error";
  else if (snapshot.matches("error")) sync = "error";
  else if (snapshot.matches("retired")) sync = "retired";

  return {
    mode: "configured",
    accountEmail: context.accountEmail,
    network: context.online ? "online" : "offline",
    sync,
    lastSyncedAt: context.lastSyncedAt,
    pendingChangeCount: context.pendingChangeCount,
    unresolvedConflictCount: context.unresolvedConflictCount,
    ...(context.error === null ? {} : { message: context.error.message }),
  };
}

function deviceViewModels(
  ordinary: readonly {
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
    stableKey: `device-${index}`,
    label: device.label,
    lastSeenAt: device.lastSeenAt,
    current: device.current,
    retirementAcknowledgement: device.acknowledged
      ? "acknowledged" as const
      : "pending" as const,
  }));
  return { devices, technical: diagnostic };
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
  } | null,
  error: { readonly message: string } | null,
): ImportPreviewViewModel | null {
  if (preview === null) return null;
  return {
    schemaVersion: preview.schemaVersion,
    migration: preview.migrationRequired ? "required" : "not-required",
    projectCount: preview.projectCount,
    categoryCount: preview.categoryCount,
    expenseCount: preview.expenseCount,
    receiptCount: preview.receiptCount,
    changeCount: 0,
    warnings: [],
    errors: error === null ? [] : [error.message],
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

function observationsFromSyncConflicts(
  conflicts: readonly {
    readonly id: string;
    readonly recordType: string;
    readonly recordId: string;
    readonly local: unknown;
    readonly remote: unknown;
    readonly relatedChangeIds: readonly string[];
  }[],
) {
  return conflicts.map((conflict) => ({
    conflictId: conflict.id,
    recordType: conflict.recordType,
    recordId: conflict.recordId,
    field: "value",
    local: conflict.local as never,
    remote: conflict.remote as never,
    relatedChangeIds: conflict.relatedChangeIds,
  }));
}

export function SyncPortabilityRuntime({
  repository,
  screen,
  onNavigate,
  onNotice,
  children,
}: {
  readonly repository:
    & Parameters<typeof createDefaultSyncDependencies>[0]["local"]
    & {
      readonly deviceId: string;
    };
  readonly screen: SyncPortabilityScreen;
  readonly onNavigate: (path: string) => void;
  readonly onNotice: (message: string) => void;
  readonly children: ReactNode;
}) {
  const ids = useMemo(createRuntimeIds, []);
  const causal = useMemo(() => createInMemoryCausalSyncPort(), []);
  const clock = runtimeClock;
  const syncDependencies = useMemo(
    () =>
      createDefaultSyncDependencies({
        local: repository,
        causal,
        deviceId: StableIdSchema.parse(repository.deviceId),
        ids,
        clock,
        initialNetwork: globalThis.navigator?.onLine === false
          ? "offline"
          : "online",
      }),
    [causal, ids, repository],
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
      }),
    [causal, ids, repository],
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
  const importMachine = useMemo(
    () => createImportMachine({ adapter: importAdapter }),
    [importAdapter],
  );
  const exportMachine = useMemo(
    () => createExportMachine({ adapter: importAdapter }),
    [importAdapter],
  );
  const safetyExportMachine = useMemo(
    () => createExportMachine({ adapter: importAdapter }),
    [importAdapter],
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
  const [customValues, setCustomValues] = useState<Record<string, string>>({});
  const [conflictPane, setConflictPane] = useState<"list" | "detail">("list");
  const [fileName, setFileName] = useState<string>();
  const [replacementConfirmation, setReplacementConfirmation] = useState<
    ReplacementConfirmation
  >(
    "unconfirmed",
  );
  const [deviceProjectionVersion, setDeviceProjectionVersion] = useState(0);
  const syncView = syncViewFromSnapshot(syncSnapshot);

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

  const deviceProjection = useMemo(
    () =>
      deviceViewModels(
        syncDependencies.registry.ordinaryProjection(),
        syncDependencies.registry.diagnosticProjection().map((device) => ({
          stableKey: device.id,
          label: device.label,
          lastSeenAt: device.lastSeenAt,
          current: device.current,
          retirementAcknowledgement: device.acknowledged
            ? "acknowledged" as const
            : "pending" as const,
          id: device.id,
        })),
      ),
    [deviceProjectionVersion, syncDependencies],
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

  const content = screen === "sync"
    ? (
      <GoogleDriveSyncScreen
        view={syncView}
        knownDeviceCount={deviceProjection.devices.length}
        onConnect={() =>
          onNotice(
            "Google Drive connection will be enabled when account authorization is configured.",
          )}
        onRetry={() => sendSync({ type: "sync.retry" })}
        onSyncNow={() =>
          sendSync({ type: "sync.request", request: { reason: "manual" } })}
        onOpenConflicts={() => onNavigate("/settings/conflicts")}
        onManageDevices={() => onNavigate("/settings/devices")}
        onSwitchAccount={() =>
          onNotice(
            "Account switching will be available after Drive authorization.",
          )}
        onDisconnect={() => sendSync({ type: "sync.disconnect" })}
        onReconnect={() =>
          onNotice("Reconnect will be available after Drive authorization.")}
        onBack={() => onNavigate("/settings")}
      />
    )
    : screen === "devices"
    ? (
      <KnownDevicesScreen
        devices={deviceProjection.devices}
        technicalDetails={deviceProjection.technical}
        onRename={async (device) => {
          const index = deviceProjection.devices.indexOf(device);
          const diagnostic =
            syncDependencies.registry.diagnosticProjection()[index];
          if (diagnostic === undefined) return;
          try {
            await syncDependencies.registry.rename(diagnostic.id, device.label);
            setDeviceProjectionVersion((version) => version + 1);
          } catch {
            onNotice("This device name could not be saved.");
          }
        }}
        onAcknowledgeRetirement={async (device) => {
          const index = deviceProjection.devices.indexOf(device);
          const diagnostic =
            syncDependencies.registry.diagnosticProjection()[index];
          if (diagnostic === undefined) return;
          try {
            await syncDependencies.registry.acknowledge(diagnostic.id);
            setDeviceProjectionVersion((version) => version + 1);
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
        onBack={() => onNavigate("/settings")}
        onExport={(delivery) =>
          sendExportEvent({
            type: "export.request",
            share: delivery === "share",
          })}
        onRetryExport={() => sendExportEvent({ type: "export.retry" })}
        onCancelExport={() => sendExportEvent({ type: "export.cancel" })}
        onFileSelected={(file) => {
          setFileName(file.name);
          void file.text().then((contents) => {
            sendImportEvent({ type: "import.file-selected", contents });
          }).catch(() => onNotice("The selected backup could not be read."));
        }}
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
        onCancelImport={() => onNavigate("/settings")}
      />
    )
    : children;

  return (
    <>
      <div className="sync-ui-shell-status">
        <SyncGlobalStatus
          view={syncView}
          onOpenSync={() => onNavigate("/settings/sync")}
        />
      </div>
      {content}
    </>
  );
}
