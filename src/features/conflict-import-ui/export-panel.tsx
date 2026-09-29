import {
  Button,
  ErrorState,
  Heading,
  Inline,
  InlineNotice,
  Section,
  Stack,
  StatusMessage,
  Text,
  WorkflowProgress,
} from "../../design-system/index.ts";
import type { ExportDelivery, ExportPanelProps } from "./types.ts";

export type { ExportDelivery, ExportPanelProps };

export function ExportPanel({
  viewModel,
  onExport,
  onRetry,
  onCancel,
}: ExportPanelProps) {
  const busy = viewModel.phase === "preparing" ||
    viewModel.phase === "delivering";
  return (
    <Section className="conflict-import-export-panel">
      <Stack gap={4}>
        <Stack gap={2}>
          <Heading level={2}>Export</Heading>
          <Text tone="secondary">
            Create a versioned JSON backup containing all synchronized projects
            and records.
          </Text>
        </Stack>
        {viewModel.phase === "error"
          ? (
            <ErrorState
              title="Export could not be completed"
              action={viewModel.error?.retryable
                ? <Button variant="secondary" onPress={onRetry}>Retry</Button>
                : undefined}
            >
              {viewModel.error?.message ?? "The backup could not be delivered."}
            </ErrorState>
          )
          : null}
        {viewModel.phase === "completed"
          ? (
            <StatusMessage tone="positive">
              {viewModel.delivery === "shared"
                ? "Backup shared successfully."
                : "Backup downloaded successfully."}
            </StatusMessage>
          )
          : null}
        {busy
          ? (
            <WorkflowProgress
              steps={["Prepare complete backup", "Download or share"]}
              current={viewModel.phase === "preparing" ? 0 : 1}
              status={viewModel.phase === "preparing"
                ? "Preparing complete backup"
                : "Delivering backup"}
              action={
                <Button variant="quiet" onPress={onCancel}>Cancel</Button>
              }
            />
          )
          : null}
        {viewModel.shareAvailability === "unavailable"
          ? (
            <InlineNotice tone="info" title="Download is always available">
              This browser cannot share files directly. Use the normal download
              action instead.
            </InlineNotice>
          )
          : null}
        <Inline gap={3}>
          <Button
            variant="primary"
            pending={busy}
            isDisabled={busy}
            onPress={() => onExport("download")}
          >
            Export complete backup
          </Button>
          {viewModel.shareAvailability === "available"
            ? (
              <Button
                variant="secondary"
                pending={busy && viewModel.phase === "delivering"}
                isDisabled={busy}
                onPress={() => onExport("share")}
              >
                Share backup
              </Button>
            )
            : null}
        </Inline>
      </Stack>
    </Section>
  );
}
