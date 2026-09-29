import type { ComponentProps, ReactNode } from "react";
import type { DriveAdapter } from "../../adapters/drive/index.ts";
import type {
  SyncActorDependencies,
  SyncActorEvent,
} from "../../actors/sync/index.ts";
import type { ImportEvent } from "../../actors/contracts/index.ts";
import type { ExportEvent } from "../../actors/import-export/index.ts";
import type { LocalEraseEvent } from "../../actors/destruction.ts";
import type { DeleteEverywhereEvent } from "../../actors/contracts/deletion.ts";
import {
  ConflictReviewScreen,
  ImportExportScreen,
  type ImportMode,
  type ReplacementConfirmation,
} from "../conflict-import-ui/index.ts";
import { GoogleDriveSyncScreen, KnownDevicesScreen } from "../sync-ui/index.ts";
import {
  DataPrivacyScreen,
  type DestructionDeviceView,
} from "../destruction-ui.tsx";

export type SyncPortabilityScreen =
  | "none"
  | "sync"
  | "devices"
  | "conflicts"
  | "import-export"
  | "privacy"
  | null;

export type SyncPortabilityScreenHostProps = {
  readonly screen: SyncPortabilityScreen;
  readonly children: ReactNode;
  readonly syncView: ComponentProps<typeof GoogleDriveSyncScreen>["view"];
  readonly deviceProjection: {
    readonly devices: ComponentProps<typeof KnownDevicesScreen>["devices"];
    readonly technical: ComponentProps<
      typeof KnownDevicesScreen
    >["technicalDetails"];
  };
  readonly connectionMode: "persisted" | "direct";
  readonly syncServerUrl: string;
  readonly syncError: string | null;
  readonly handleConnectionModeChange: (
    nextMode: "persisted" | "direct",
  ) => void;
  readonly handleSyncServerUrlChange: (url: string) => void;
  readonly handleConnect: (mode?: "persisted" | "direct") => void;
  readonly sendSync: (event: SyncActorEvent) => void;
  readonly driveAdapter: DriveAdapter | null;
  readonly handleReconnect: () => void;
  readonly onNavigate: (path: string) => void;
  readonly onNotice: (message: string) => void;
  readonly syncDependencies: SyncActorDependencies;
  readonly conflictView: ComponentProps<
    typeof ConflictReviewScreen
  >["viewModel"];
  readonly onOpenConflictGroup: (groupId: string) => void;
  readonly onShowConflictList: () => void;
  readonly onChooseConflictCandidate: (candidateId: string) => void;
  readonly onConflictCustomValueChange: (value: string) => void;
  readonly onChooseConflictCustom: (value: string) => void;
  readonly onKeepConflictEdited: () => void;
  readonly onDeleteConflictRecord: () => void;
  readonly onSubmitConflict: () => void;
  readonly onRetryConflict: () => void;
  readonly exportView: ComponentProps<typeof ImportExportScreen>["exportModel"];
  readonly importView: ComponentProps<typeof ImportExportScreen>["importModel"];
  readonly onRequestExport: (delivery: "download" | "share") => void;
  readonly onRetryExport: () => void;
  readonly onCancelExport: () => void;
  readonly selectImportFile: (file: File) => void;
  readonly sendImportEvent: (event: ImportEvent) => void;
  readonly sendSafetyExport: (event: ExportEvent) => void;
  readonly setReplacementConfirmation: (
    confirmation: ReplacementConfirmation,
  ) => void;
  readonly closeImportExport: () => void;
  readonly localEraseView: ComponentProps<
    typeof DataPrivacyScreen
  >["localErase"];
  readonly deleteEverywhereView: ComponentProps<
    typeof DataPrivacyScreen
  >["deleteEverywhere"];
  readonly deleteEverywhereRevoking: boolean;
  readonly deleteEverywhereRevocationError: string | undefined;
  readonly destructionDevices: readonly DestructionDeviceView[];
  readonly openLocalErase: () => void;
  readonly sendLocalErase: (event: LocalEraseEvent) => void;
  readonly cancelLocalErase: () => void;
  readonly openDeleteEverywhere: () => void;
  readonly sendDeleteEverywhere: (event: DeleteEverywhereEvent) => void;
  readonly retryDeleteEverywhereFinalization: () => void;
  readonly cancelDeleteEverywhere: () => void;
};

export function SyncPortabilityScreenHost({
  screen,
  children,
  syncView,
  deviceProjection,
  connectionMode,
  syncServerUrl,
  syncError,
  handleConnectionModeChange,
  handleSyncServerUrlChange,
  handleConnect,
  sendSync,
  driveAdapter,
  handleReconnect,
  onNavigate,
  onNotice,
  syncDependencies,
  conflictView,
  onOpenConflictGroup,
  onShowConflictList,
  onChooseConflictCandidate,
  onConflictCustomValueChange,
  onChooseConflictCustom,
  onKeepConflictEdited,
  onDeleteConflictRecord,
  onSubmitConflict,
  onRetryConflict,
  exportView,
  importView,
  onRequestExport,
  onRetryExport,
  onCancelExport,
  selectImportFile,
  sendImportEvent,
  sendSafetyExport,
  setReplacementConfirmation,
  closeImportExport,
  localEraseView,
  deleteEverywhereView,
  deleteEverywhereRevoking,
  deleteEverywhereRevocationError,
  destructionDevices,
  openLocalErase,
  sendLocalErase,
  cancelLocalErase,
  openDeleteEverywhere,
  sendDeleteEverywhere,
  retryDeleteEverywhereFinalization,
  cancelDeleteEverywhere,
}: SyncPortabilityScreenHostProps) {
  if (screen === "sync") {
    return (
      <GoogleDriveSyncScreen
        view={syncView}
        knownDeviceCount={deviceProjection.devices.length}
        connectionMode={connectionMode}
        syncServerUrl={syncServerUrl}
        syncError={syncError}
        onConnectionModeChange={handleConnectionModeChange}
        onSyncServerUrlChange={handleSyncServerUrlChange}
        onConnect={handleConnect}
        onRetry={() => sendSync({ type: "sync.retry" })}
        onRecoverCorruptData={() =>
          sendSync({ type: "sync.recover-corrupt-data" })}
        onSyncNow={() =>
          sendSync({ type: "sync.request", request: { reason: "manual" } })}
        onOpenConflicts={() => onNavigate("/settings/conflicts")}
        onManageDevices={() => onNavigate("/settings/devices")}
        onSwitchAccount={() => handleConnect(connectionMode)}
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
        onReconnect={handleReconnect}
        onBack={() => onNavigate("/settings")}
      />
    );
  }

  if (screen === "devices") {
    return (
      <KnownDevicesScreen
        devices={deviceProjection.devices}
        technicalDetails={deviceProjection.technical}
        onRename={async (device) => {
          const diagnostic = deviceProjection.technical?.find((candidate) =>
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
          const diagnostic = deviceProjection.technical?.find((candidate) =>
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
    );
  }

  if (screen === "conflicts") {
    return (
      <ConflictReviewScreen
        viewModel={conflictView}
        onBack={() => onNavigate("/settings/sync")}
        onOpenGroup={onOpenConflictGroup}
        onShowList={onShowConflictList}
        onChooseCandidate={onChooseConflictCandidate}
        onCustomValueChange={onConflictCustomValueChange}
        onChooseCustom={onChooseConflictCustom}
        onKeepEdited={onKeepConflictEdited}
        onDeleteRecord={onDeleteConflictRecord}
        onSubmit={onSubmitConflict}
        onRetry={onRetryConflict}
      />
    );
  }

  if (screen === "import-export") {
    return (
      <ImportExportScreen
        exportModel={exportView}
        importModel={importView}
        onBack={closeImportExport}
        onExport={onRequestExport}
        onRetryExport={onRetryExport}
        onCancelExport={onCancelExport}
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
    );
  }

  if (screen === "privacy") {
    return (
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
        onLocalEraseChoice={(removeReceiptAiKeys: boolean) =>
          sendLocalErase({ type: "local-erase.choice", removeReceiptAiKeys })}
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
    );
  }

  return <>{children}</>;
}
