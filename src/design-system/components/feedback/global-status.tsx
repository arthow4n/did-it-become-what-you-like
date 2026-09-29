import type { ReactNode } from "react";
import type { Tone } from "../shared.ts";
import { StatusPanel } from "./status-panel.tsx";

export type GlobalStatusProps = {
  status:
    | "offline"
    | "reconnecting"
    | "syncing"
    | "conflict"
    | "error"
    | "synced";
  detail?: ReactNode;
  action?: ReactNode;
};

const globalStatusCopy: Record<
  GlobalStatusProps["status"],
  { label: string; tone: Tone }
> = {
  offline: { label: "Offline", tone: "warning" },
  reconnecting: { label: "Reconnecting", tone: "warning" },
  syncing: { label: "Syncing", tone: "info" },
  conflict: { label: "Conflicts need review", tone: "warning" },
  error: { label: "Sync error", tone: "danger" },
  synced: { label: "Synced", tone: "positive" },
};

export function GlobalStatus({ status, detail, action }: GlobalStatusProps) {
  const copy = globalStatusCopy[status];
  return (
    <StatusPanel
      title={copy.label}
      detail={detail}
      tone={copy.tone}
      action={action}
    />
  );
}
