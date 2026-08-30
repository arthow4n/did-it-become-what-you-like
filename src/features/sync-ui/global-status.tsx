import {
  Button,
  Inline,
  Stack,
  StatusDot,
  Text,
} from "../../design-system/index.ts";
import { Cloud } from "lucide-react";
import { syncStatusCopy } from "./sync-status.ts";
import type { SyncConnectionViewModel } from "./types.ts";

export type GlobalStatusProps = {
  readonly view: SyncConnectionViewModel;
  readonly onOpenSync?: () => void;
};

/** Compact shell-facing connection summary. */
export function GlobalStatus({ view, onOpenSync }: GlobalStatusProps) {
  const copy = syncStatusCopy(view);
  const actionLabel = view.mode === "disconnected"
    ? "Open Google Drive synchronization"
    : "Open synchronization details";
  return (
    <Stack gap={1} className="sync-ui-global-status" role="status">
      <Inline gap={2} justify="space-between">
        <Inline gap={2}>
          <StatusDot tone={copy.tone}>{copy.label}</StatusDot>
          <Text tone="secondary" size="caption">{copy.detail}</Text>
        </Inline>
        {onOpenSync
          ? (
            <Button
              variant="quiet"
              onPress={() => onOpenSync()}
              aria-label={actionLabel}
            >
              Details
            </Button>
          )
          : null}
      </Inline>
    </Stack>
  );
}

export type SyncIndicatorCopy = {
  readonly label: string;
  readonly tone: "positive" | "info" | "warning" | "danger";
  readonly action: "reconnect" | "details";
};

export function syncIndicatorCopy(
  view: SyncConnectionViewModel,
): SyncIndicatorCopy {
  if (
    view.mode === "disconnected" ||
    (view.mode === "configured" && view.sync === "authorization-error")
  ) {
    return {
      label: "Local only · Tap to reconnect",
      tone: "warning",
      action: "reconnect",
    };
  }
  if (view.mode === "connecting") {
    return { label: "Syncing", tone: "info", action: "details" };
  }
  if (
    view.mode === "configured" &&
    (view.sync === "syncing" || view.sync === "recovering")
  ) {
    return { label: "Syncing", tone: "info", action: "details" };
  }
  if (
    view.mode === "configured" && view.sync === "synced" &&
    view.network === "online"
  ) {
    return { label: "Synced", tone: "positive", action: "details" };
  }
  if (view.mode === "configured" && view.network !== "online") {
    return { label: "Local only", tone: "warning", action: "details" };
  }
  return { label: "Sync needs attention", tone: "danger", action: "details" };
}

export function SyncStatusIndicator({
  view,
  onOpenSync,
  onReconnect,
}: {
  readonly view: SyncConnectionViewModel;
  readonly onOpenSync: () => void;
  readonly onReconnect: () => void;
}) {
  const copy = syncIndicatorCopy(view);
  const actionLabel = copy.action === "reconnect"
    ? "Reconnect Google Drive"
    : "Open synchronization details";
  return (
    <Button
      className="sync-ui-status-indicator"
      variant="quiet"
      onPress={copy.action === "reconnect" ? onReconnect : onOpenSync}
      aria-label={actionLabel}
      title={actionLabel}
    >
      <Cloud aria-hidden="true" size={16} />
      <StatusDot tone={copy.tone}>{copy.label}</StatusDot>
    </Button>
  );
}
