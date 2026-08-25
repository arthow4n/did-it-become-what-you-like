import type { Tone } from "../../design-system/index.ts";
import type { ConfiguredSyncMode, SyncConnectionViewModel } from "./types.ts";

export type SyncStatusCopy = {
  readonly label: string;
  readonly tone: Tone;
  readonly detail: string;
};

function configuredCopy(
  view: Extract<SyncConnectionViewModel, { mode: "configured" }>,
): SyncStatusCopy {
  if (view.sync === "retired") {
    return {
      label: "Dataset retired",
      tone: "danger",
      detail: view.message ??
        "This device must not upload to the retired dataset.",
    };
  }
  if (view.sync === "authorization-error") {
    return {
      label: "Authorization needed",
      tone: "danger",
      detail: view.message ??
        "Authorize Google Drive again on this page to resume synchronization. Local data stays on this device.",
    };
  }
  if (view.sync === "conflict") {
    return {
      label: "Conflicts need review",
      tone: "warning",
      detail: `${view.unresolvedConflictCount} unresolved conflict${
        view.unresolvedConflictCount === 1 ? "" : "s"
      } remain.`,
    };
  }
  if (view.sync === "retryable-error") {
    return {
      label: "Sync needs attention",
      tone: "danger",
      detail: view.message ?? "Synchronization can be retried.",
    };
  }
  if (view.sync === "error") {
    return {
      label: "Sync error",
      tone: "danger",
      detail: view.message ?? "Synchronization did not complete.",
    };
  }
  if (view.network === "offline") {
    return {
      label: "Offline",
      tone: "warning",
      detail: "Local changes stay saved and will sync when you reconnect.",
    };
  }
  if (view.network === "reconnecting") {
    return {
      label: "Reconnecting",
      tone: "warning",
      detail: "Waiting for the connection before synchronization continues.",
    };
  }
  if (view.sync === "syncing") {
    return {
      label: "Syncing",
      tone: "info",
      detail: "Pulling remote changes before uploading local changes.",
    };
  }
  if (view.sync === "recovering") {
    return {
      label: "Repairing sync",
      tone: "warning",
      detail:
        "Removing the malformed hidden Drive sync file before syncing local data again.",
    };
  }
  return {
    label: "Synced",
    tone: "positive",
    detail: "Automatic synchronization is available.",
  };
}

export function syncStatusCopy(view: SyncConnectionViewModel): SyncStatusCopy {
  if (view.mode === "disconnected") {
    return {
      label: "Not connected",
      tone: "info",
      detail: "Connect Google Drive to synchronize this dataset.",
    };
  }
  if (view.mode === "connecting") {
    return {
      label: "Connecting",
      tone: "info",
      detail: "Connecting to Google Drive.",
    };
  }
  if (view.mode === "account-switch-confirmation") {
    return {
      label: "Account switch needs confirmation",
      tone: "warning",
      detail:
        `Switch from ${view.currentAccountEmail} to ${view.requestedAccountEmail} only with explicit confirmation.`,
    };
  }
  return configuredCopy(view);
}

export function configuredModeLabel(mode: ConfiguredSyncMode): string {
  switch (mode) {
    case "synced":
      return "Synced";
    case "syncing":
      return "Syncing";
    case "recovering":
      return "Repairing sync";
    case "conflict":
      return "Conflicts need review";
    case "authorization-error":
      return "Authorization needed";
    case "retryable-error":
      return "Sync needs attention";
    case "error":
      return "Sync error";
    case "retired":
      return "Dataset retired";
  }
}

export function canSyncNow(
  view: Extract<SyncConnectionViewModel, { mode: "configured" }>,
): boolean {
  return view.network === "online" &&
    view.sync !== "syncing" &&
    view.sync !== "recovering" &&
    view.sync !== "authorization-error" &&
    view.sync !== "retryable-error" &&
    view.sync !== "error" &&
    view.sync !== "retired";
}

export function syncNowDisabledReason(
  view: Extract<SyncConnectionViewModel, { mode: "configured" }>,
): string | undefined {
  if (view.network === "offline") {
    return "Manual sync becomes available when you are online.";
  }
  if (view.network === "reconnecting") {
    return "Manual sync becomes available after reconnecting.";
  }
  if (view.sync === "syncing" || view.sync === "recovering") {
    return "Synchronization recovery is already in progress.";
  }
  if (view.sync === "authorization-error") {
    return "Reconnect Google Drive before synchronizing.";
  }
  if (view.sync === "retryable-error" || view.sync === "error") {
    return "Retry the failed synchronization first.";
  }
  if (view.sync === "retired") {
    return "This dataset is retired and cannot receive new uploads.";
  }
  return undefined;
}
