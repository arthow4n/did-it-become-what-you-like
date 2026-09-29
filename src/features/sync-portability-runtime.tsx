import { useActor } from "@xstate/react";
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
  getAdapterErrorDiagnostic,
  type SecretStoragePort,
} from "../adapters/ports/index.ts";
import {
  type ConflictActorEvent,
  createConflictMachine,
} from "../actors/conflict/index.ts";
import {
  createExportMachine,
  createImportMachine,
  type ExportEvent,
} from "../actors/import-export/index.ts";
import {
  createDefaultSyncDependencies,
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
import type { DriveAdapter } from "../adapters/drive/index.ts";
import {
  deleteLocalRepositoryDatabase,
  type LocalRepository,
} from "../adapters/local/index.ts";
import { runCausalExchange } from "../adapters/sync/coordinator.ts";
import { StableIdSchema } from "../domain/index.ts";
import {
  clearDeleteEverywhereProgress,
  type DeleteEverywhereProgressPhase,
  type DeleteEverywhereProgressRecord,
  readDeleteEverywhereProgress,
  readLocalEraseProgress,
  readLocalEraseReceiptAiKeysChoice,
  writeDeleteEverywhereProgress,
} from "../domain/destruction.ts";
import {
  type ReplacementConfirmation,
  type SafetyExportStatus,
} from "./conflict-import-ui/index.ts";
import { SyncStatusProvider } from "./sync-ui/index.ts";
import { type DestructionDeviceView } from "./destruction-ui.tsx";

import type { SyncPortabilityScreen } from "./sync-runtime/index.ts";
export type { SyncPortabilityScreen };
export * from "./sync-runtime/index.ts";
import {
  automaticSyncDelay,
  browserConfiguredSyncServerUrl,
  configuredRuntimeBoundary,
  conflictIdsForResolutions,
  conflictViewFromSnapshot,
  createBrowserFileShare,
  createConfiguredDriveAdapter,
  createRuntimeIds,
  deleteEverywhereProgressForDevices,
  deleteEverywhereRecoveryPassedLocalErase,
  deleteEverywhereViewFromProgress,
  deleteEverywhereViewFromSnapshot,
  destructionStorage,
  deviceViewModels,
  exportViewFromSnapshot,
  importViewFromSnapshot,
  localEraseViewFromSnapshot,
  observationsFromSyncConflicts,
  readAutomaticSyncState,
  reconnectAuthorizationOptions,
  requestLocalShellRefreshAfterSync,
  runtimeClock,
  saveDestructionSafetyExport,
  settingsSyncSummary,
  SyncPortabilityScreenHost,
  syncViewFromSnapshot,
  useRestartableActor,
  writeAutomaticSyncState,
} from "./sync-runtime/index.ts";

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

  const returnedFromPersistedAuth = useRef(
    typeof globalThis.location !== "undefined" &&
      new URL(globalThis.location.href).searchParams.get("sync_connected") ===
        "persisted",
  );

  const [connectionMode, setConnectionMode] = useState<"persisted" | "direct">(
    () => {
      if (typeof globalThis.location !== "undefined") {
        const url = new URL(globalThis.location.href);
        if (url.searchParams.get("sync_connected") === "persisted") {
          return "persisted";
        }
        try {
          const saved = globalThis.localStorage?.getItem(
            "did_it_drive_connection_mode",
          );
          if (saved === "persisted" || saved === "direct") return saved;
        } catch {
          // ignore
        }
      }
      return "persisted";
    },
  );

  const [syncServerUrl, setSyncServerUrl] = useState<string>(() => {
    if (typeof globalThis.localStorage !== "undefined") {
      try {
        const saved = globalThis.localStorage.getItem("did_it_sync_server_url");
        if (saved) return saved;
      } catch {
        // ignore
      }
    }
    return browserConfiguredSyncServerUrl() ?? "";
  });

  const [syncError, setSyncError] = useState<string | null>(() => {
    if (typeof globalThis.location !== "undefined") {
      const url = new URL(globalThis.location.href);
      const err = url.searchParams.get("sync_error");
      if (err) {
        if (err === "unauthorized_account") {
          const email = url.searchParams.get("email") ?? "Unknown";
          return `Access Denied: Google account "${email}" is not authorized on this sync server. Add this email to ALLOWED_GOOGLE_EMAILS on the server to permit synchronization.`;
        }
        if (err === "missing_refresh_token") {
          return "Google did not return a refresh token. Please remove this app from https://myaccount.google.com/permissions and reconnect.";
        }
        if (err === "token_exchange_failed") {
          return "Sync server failed to exchange authorization code with Google. Check server GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.";
        }
        if (err === "profile_fetch_failed") {
          return "Failed to fetch Google profile. Please try reconnecting.";
        }
        return `Authorization error: ${err}`;
      }
    }
    return null;
  });

  const handleConnectionModeChange = useCallback(
    (nextMode: "persisted" | "direct") => {
      setConnectionMode(nextMode);
      try {
        globalThis.localStorage?.setItem(
          "did_it_drive_connection_mode",
          nextMode,
        );
      } catch {
        // ignore
      }
    },
    [],
  );

  const handleSyncServerUrlChange = useCallback(
    (nextUrl: string) => {
      setSyncServerUrl(nextUrl);
      try {
        globalThis.localStorage?.setItem("did_it_sync_server_url", nextUrl);
      } catch {
        // ignore
      }
    },
    [],
  );

  useEffect(() => {
    if (typeof globalThis.location === "undefined") return;
    const url = new URL(globalThis.location.href);
    let changed = false;
    if (url.searchParams.has("sync_connected")) {
      url.searchParams.delete("sync_connected");
      changed = true;
    }
    if (url.searchParams.has("sync_error")) {
      url.searchParams.delete("sync_error");
      changed = true;
    }
    if (url.searchParams.has("email")) {
      url.searchParams.delete("email");
      changed = true;
    }
    if (changed) {
      globalThis.history?.replaceState(null, "", url.toString());
    }
  }, []);

  const driveAdapter = useMemo(
    () =>
      createConfiguredDriveAdapter(
        runtimeBoundary,
        connectionMode,
        syncServerUrl,
      ),
    [runtimeBoundary, connectionMode, syncServerUrl],
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
  const [automaticSyncState, setAutomaticSyncState] = useState(
    readAutomaticSyncState,
  );
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
        removeReceiptAiKeys: async () => {
          await secretStorage.remove("gemini-api-key");
          await secretStorage.remove("openrouter-api-key");
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
  const deleteEverywhereLocalEraseHandled = useRef(
    deleteEverywhereRecovery !== undefined &&
      deleteEverywhereRecoveryPassedLocalErase(deleteEverywhereRecovery),
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
  const localEraseHandled = useRef(
    localEraseRecovery?.phase === "failed" &&
      localEraseRecovery.failureOperation === "erase-local",
  );
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
  const seenResolutionIds = useRef<Set<string>>(new Set());
  const resolvedConflictIds = useRef<Set<string>>(new Set());
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
    const onOffline = () => {
      sendSync({ type: "sync.network.offline" });
      sendImport({ type: "import.network.offline" });
    };
    const onOnline = () => {
      sendSync({ type: "sync.network.online" });
      sendImport({ type: "import.network.online" });
    };
    globalThis.addEventListener("offline", onOffline);
    globalThis.addEventListener("online", onOnline);
    return () => {
      globalThis.removeEventListener("offline", onOffline);
      globalThis.removeEventListener("online", onOnline);
    };
  }, [sendImport, sendSync]);

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
      (conflictSnapshot.matches("idle") ||
        conflictSnapshot.matches("resolved"))
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
    if (result === null) return;
    const resolutionId = result.resolutionRevision.id;
    if (seenResolutionIds.current.has(resolutionId)) return;
    seenResolutionIds.current.add(resolutionId);
    for (
      const conflictId of conflictIdsForResolutions(
        syncSnapshot.context.conflicts,
        [{
          groupId: result.groupId,
          parentRevisionIds: result.resolutionRevision.parents,
        }],
      )
    ) {
      resolvedConflictIds.current.add(conflictId);
    }
    if (!conflictSnapshot.matches("resolved")) return;
    const conflictIds = [...resolvedConflictIds.current];
    resolvedConflictIds.current.clear();
    if (conflictIds.length === 0) return;
    // The conflict actor has reached its resolved state only after its local
    // commit succeeded. A failed commit therefore leaves the sync banner and
    // conflict count untouched.
    sendSync({
      type: "sync.resolve-conflicts",
      conflictIds,
    });
    sendSync({
      type: "sync.request",
      request: { reason: "local-change" },
    });
  }, [conflictSnapshot, sendSync, syncSnapshot]);

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
    const recoveredEraseFailure = localEraseRecovery?.phase === "failed" &&
      localEraseRecovery.failureOperation === "erase-local";
    const requiresShellReload = localEraseSnapshot.matches("partial") ||
      (localEraseSnapshot.matches("failed") &&
        localEraseSnapshot.context.failureOperation === "erase-local");
    if (
      (!localEraseSnapshot.matches("completed") && !requiresShellReload) ||
      localEraseHandled.current || recoveredEraseFailure
    ) {
      return;
    }
    localEraseHandled.current = true;
    onLocalErased?.("local");
  }, [localEraseRecovery, localEraseSnapshot, onLocalErased]);

  useEffect(() => {
    const failureState = deleteEverywhereSnapshot.context.failureState;
    const localEraseFailed = deleteEverywhereSnapshot.matches("failed") &&
      (failureState === "erasingLocal" ||
        failureState === "persistingAwaitingDevices" ||
        failureState === "persistingForcedFinalization" ||
        failureState === "persistingCompletion");
    const localEraseBoundaryReached =
      deleteEverywhereSnapshot.matches("persistingAwaitingDevices") ||
      deleteEverywhereSnapshot.matches("awaitingDevices") ||
      deleteEverywhereSnapshot.matches("persistingForcedFinalization") ||
      deleteEverywhereSnapshot.matches("forcedFinalization") ||
      deleteEverywhereSnapshot.matches("persistingCompletion") ||
      deleteEverywhereSnapshot.matches("completed") || localEraseFailed;
    if (
      !localEraseBoundaryReached || deleteEverywhereLocalEraseHandled.current
    ) return;
    deleteEverywhereLocalEraseHandled.current = true;
    onLocalErased?.("everywhere");
  }, [deleteEverywhereSnapshot, onLocalErased]);

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

  const [localCommitVersion, setLocalCommitVersion] = useState(0);
  const syncStartCommitVersion = useRef<number | null>(null);
  const handledAutomaticSyncCompletion = useRef<string | null>(null);
  useEffect(() =>
    repository.subscribeRecords?.(() => {
      setAutomaticSyncState((current) => {
        const pendingState = {
          ...current,
          pendingLocalChanges: true,
        };
        writeAutomaticSyncState(pendingState);
        return pendingState;
      });
      setLocalCommitVersion((version) => version + 1);
    }), [repository]);

  useEffect(() => {
    if (
      syncSnapshot.matches("synchronizing") &&
      syncStartCommitVersion.current === null
    ) {
      syncStartCommitVersion.current = localCommitVersion;
    }
    const completedAt = syncSnapshot.context.lastSyncedAt;
    if (
      completedAt === null ||
      completedAt === handledAutomaticSyncCompletion.current
    ) return;
    handledAutomaticSyncCompletion.current = completedAt;
    const nextState = {
      lastSuccessfulSyncAt: completedAt,
      pendingLocalChanges: syncStartCommitVersion.current !== null &&
        localCommitVersion > syncStartCommitVersion.current,
    };
    writeAutomaticSyncState(nextState);
    setAutomaticSyncState(nextState);
    syncStartCommitVersion.current = syncSnapshot.matches("synchronizing")
      ? localCommitVersion
      : null;
  }, [localCommitVersion, syncSnapshot]);

  // Import/destruction own their exchange boundaries. A save during an exchange
  // remains pending until idle; reconciliation writes do not emit local commits.
  const automaticSyncAllowed = syncSnapshot.matches("idle") &&
    screen !== "import-export" && screen !== "privacy" &&
    driveAdapter?.status() === "authorized";

  const syncAfterAuthorization = useRef(false);
  const launchedAdapter = useRef<DriveAdapter | null>(null);
  useEffect(() => {
    if (!automaticSyncAllowed || driveAdapter === null) return;
    const launchRequested = syncAfterAuthorization.current ||
      launchedAdapter.current !== driveAdapter;
    if (launchRequested) {
      launchedAdapter.current = driveAdapter;
      syncAfterAuthorization.current = false;
    }
    const delay = automaticSyncDelay(
      automaticSyncState.lastSuccessfulSyncAt,
    );
    if (
      delay === 0 && (launchRequested || automaticSyncState.pendingLocalChanges)
    ) {
      sendSync({
        type: "sync.request",
        request: {
          reason: automaticSyncState.pendingLocalChanges
            ? "local-change"
            : "launch",
        },
      });
      return;
    }
    if (!automaticSyncState.pendingLocalChanges) return;
    const timer = setTimeout(() => {
      sendSync({ type: "sync.request", request: { reason: "local-change" } });
    }, delay);
    return () => clearTimeout(timer);
  }, [automaticSyncAllowed, automaticSyncState, driveAdapter, sendSync]);

  const authorizeDrive = useCallback(
    (
      reconnect = false,
      silent = false,
      modeOverride?: "persisted" | "direct",
    ) => {
      const adapter =
        modeOverride !== undefined && modeOverride !== connectionMode
          ? createConfiguredDriveAdapter(
            runtimeBoundary,
            modeOverride,
            syncServerUrl,
          )
          : driveAdapter;
      if (adapter === null) {
        if (!silent) {
          onNotice(
            "Google Drive is unavailable until OAuth client configuration is provided.",
          );
        }
        return;
      }
      syncAfterAuthorization.current = true;
      const authorizationOptions = reconnect
        ? reconnectAuthorizationOptions(syncView)
        : undefined;
      void adapter.authorize(authorizationOptions).then((session) => {
        setSyncError(null);
        sendSync({
          type: "sync.configure",
          accountEmail: session.accountId,
          online: globalThis.navigator?.onLine !== false,
        });
      }).catch((err: unknown) => {
        syncAfterAuthorization.current = false;
        const diagnostic = getAdapterErrorDiagnostic(err);
        let detail = diagnostic ||
          (err instanceof Error
            ? err.message
            : typeof err === "object" && err !== null && "operation" in err
            ? `${(err as { operation: string }).operation}`
            : "Google Drive authorization failed");
        if (
          detail.includes("No active session cookie") ||
          detail.includes("401")
        ) {
          detail =
            "No active sync session. Please tap 'Connect Google Drive' to sign in with your Google account.";
        }
        setSyncError(detail);
        if (!silent) {
          onNotice(
            `Google Drive authorization failed: ${detail}. Local data remains available.`,
          );
        }
      });
    },
    [
      driveAdapter,
      onNotice,
      sendSync,
      syncView,
      connectionMode,
      runtimeBoundary,
      syncServerUrl,
    ],
  );

  const handleConnect = useCallback(
    (mode: "persisted" | "direct" = connectionMode) => {
      if (mode === "persisted") {
        setConnectionMode("persisted");
        try {
          globalThis.localStorage?.setItem(
            "did_it_drive_connection_mode",
            "persisted",
          );
        } catch {
          // ignore
        }
        const rawServerUrl = (syncServerUrl || browserConfiguredSyncServerUrl())
          .trim();
        if (!rawServerUrl || rawServerUrl.length === 0) {
          onNotice("Please specify a valid Sync Server URL before connecting.");
          return;
        }
        let serverUrl = rawServerUrl.replace(/\/+$/, "");
        if (
          !serverUrl.startsWith("http://") && !serverUrl.startsWith("https://")
        ) {
          serverUrl = `https://${serverUrl}`;
        }
        try {
          globalThis.localStorage?.setItem(
            "did_it_drive_connection_mode",
            "persisted",
          );
          globalThis.localStorage?.setItem(
            "did_it_sync_server_url",
            serverUrl,
          );
        } catch {
          // ignore
        }
        const returnTo = globalThis.location?.href ?? "";
        if (globalThis.location) {
          globalThis.location.href =
            `${serverUrl}/auth/google-drive/login?return_to=${
              encodeURIComponent(returnTo)
            }`;
        }
      } else {
        setConnectionMode("direct");
        try {
          globalThis.localStorage?.setItem(
            "did_it_drive_connection_mode",
            "direct",
          );
        } catch {
          // ignore
        }
        authorizeDrive(false, false, "direct");
      }
    },
    [connectionMode, syncServerUrl, onNotice, authorizeDrive],
  );

  const handleReconnect = useCallback(() => {
    if (connectionMode === "persisted") {
      handleConnect("persisted");
    } else {
      authorizeDrive(true, false);
    }
  }, [connectionMode, handleConnect, authorizeDrive]);

  useEffect(() => {
    if (connectionMode !== "persisted" || driveAdapter === null) return;
    if (returnedFromPersistedAuth.current) {
      returnedFromPersistedAuth.current = false;
      authorizeDrive(false, false);
      return;
    }
    if (
      syncView.mode === "configured" &&
      driveAdapter.status() !== "authorized"
    ) {
      authorizeDrive(true, true);
    }
  }, [connectionMode, driveAdapter, syncView.mode, authorizeDrive]);

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
    const removeReceiptAiKeys = storage === undefined
      ? true
      : readLocalEraseReceiptAiKeysChoice(storage);
    if (
      localEraseSnapshot.matches("completed") ||
      localEraseSnapshot.matches("cancelled")
    ) {
      sendLocalErase({ type: "local-erase.reset" });
      sendLocalErase({ type: "local-erase.open", removeReceiptAiKeys });
      return;
    }
    sendLocalErase({ type: "local-erase.open", removeReceiptAiKeys });
  };

  const openDeleteEverywhere = () => {
    deleteFinalizationHandled.current = false;
    const progress = deleteEverywhereProgressForDevices(destructionDevices);
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
      progress,
    });
  };

  useEffect(() => {
    if (!deleteOpenRequested || !deleteEverywhereSnapshot.matches("idle")) {
      return;
    }
    setDeleteOpenRequested(false);
    const progress = deleteEverywhereProgressForDevices(destructionDevices);
    sendDeleteEverywhere({
      type: "delete-everywhere.open",
      generation: localGeneration,
      progress,
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

  const content = (
    <SyncPortabilityScreenHost
      screen={screen}
      syncView={syncView}
      deviceProjection={deviceProjection}
      connectionMode={connectionMode}
      syncServerUrl={syncServerUrl}
      syncError={syncError}
      handleConnectionModeChange={handleConnectionModeChange}
      handleSyncServerUrlChange={handleSyncServerUrlChange}
      handleConnect={handleConnect}
      sendSync={sendSync}
      driveAdapter={driveAdapter}
      handleReconnect={handleReconnect}
      onNavigate={onNavigate}
      onNotice={onNotice}
      syncDependencies={syncDependencies}
      conflictView={conflictView}
      onOpenConflictGroup={(groupId) => {
        setConflictPane("detail");
        sendConflictEvent({ type: "conflict.open", groupId });
      }}
      onShowConflictList={() => setConflictPane("list")}
      onChooseConflictCandidate={(candidateId) =>
        sendConflictEvent({ type: "conflict.choose-candidate", candidateId })}
      onConflictCustomValueChange={(value) => {
        const groupId = conflictSnapshot.context.activeGroupId;
        if (groupId !== null) {
          setCustomValues((current) => ({ ...current, [groupId]: value }));
        }
      }}
      onChooseConflictCustom={(value) =>
        sendConflictEvent({ type: "conflict.choose-custom", value })}
      onKeepConflictEdited={() =>
        sendConflictEvent({ type: "conflict.keep-edited" })}
      onDeleteConflictRecord={() =>
        sendConflictEvent({ type: "conflict.delete-record" })}
      onSubmitConflict={() => sendConflictEvent({ type: "conflict.submit" })}
      onRetryConflict={() => sendConflictEvent({ type: "conflict.retry" })}
      exportView={exportView}
      importView={importView}
      onRequestExport={requestExport}
      onRetryExport={() => sendExportEvent({ type: "export.retry" })}
      onCancelExport={() => sendExportEvent({ type: "export.cancel" })}
      selectImportFile={selectImportFile}
      sendImportEvent={sendImportEvent}
      sendSafetyExport={sendSafetyExport}
      setReplacementConfirmation={setReplacementConfirmation}
      closeImportExport={closeImportExport}
      localEraseView={localEraseView}
      deleteEverywhereView={deleteEverywhereView}
      deleteEverywhereRevoking={deleteEverywhereRevoking}
      deleteEverywhereRevocationError={deleteEverywhereRevocationError}
      destructionDevices={destructionDevices}
      openLocalErase={openLocalErase}
      sendLocalErase={sendLocalErase}
      cancelLocalErase={cancelLocalErase}
      openDeleteEverywhere={openDeleteEverywhere}
      sendDeleteEverywhere={sendDeleteEverywhere}
      retryDeleteEverywhereFinalization={retryDeleteEverywhereFinalization}
      cancelDeleteEverywhere={cancelDeleteEverywhere}
    >
      {children}
    </SyncPortabilityScreenHost>
  );

  return (
    <>
      <SyncStatusProvider
        value={{
          view: syncView,
          onOpenSync: () => onNavigate("/settings/sync"),
          onReconnect: handleReconnect,
          notifyLocalMutation: () => {
            if (
              syncView.mode === "configured" &&
              syncView.sync === "authorization-error"
            ) {
              onNotice("Saved locally. Reconnect Google Drive to sync.");
            }
          },
        }}
      >
        {content}
      </SyncStatusProvider>
    </>
  );
}
