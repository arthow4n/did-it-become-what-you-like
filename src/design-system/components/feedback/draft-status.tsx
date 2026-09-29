import type { ReactNode } from "react";
import type { Tone } from "../shared.ts";
import { StatusPanel } from "./status-panel.tsx";

export type DraftStatusProps = {
  state: "clean" | "dirty" | "saving" | "saved" | "failed";
  detail?: ReactNode;
  action?: ReactNode;
};

export function DraftStatus(
  { state, detail, action }: DraftStatusProps,
) {
  const copy: Record<typeof state, { label: string; tone: Tone }> = {
    clean: { label: "No unsaved changes", tone: "neutral" },
    dirty: { label: "Unsaved changes", tone: "warning" },
    saving: { label: "Saving locally", tone: "info" },
    saved: { label: "Saved", tone: "positive" },
    failed: { label: "Save failed", tone: "danger" },
  };
  return (
    <StatusPanel
      title={copy[state].label}
      detail={detail}
      tone={copy[state].tone}
      action={action}
    />
  );
}
