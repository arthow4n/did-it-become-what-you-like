import {
  Button,
  Inline,
  Stack,
  StatusDot,
  Text,
} from "../../design-system/index.ts";
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
