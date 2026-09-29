import type { ChangeEvent } from "react";
import {
  Banner,
  Button,
  ErrorState,
  FileField,
  Heading,
  Inline,
  InlineNotice,
  Section,
  Stack,
  StatusMessage,
  Text,
  WorkflowProgress,
} from "../../design-system/index.ts";
import { ImportModeChoice } from "./import-mode-choice.tsx";
import { ImportPreview } from "./import-preview.tsx";
import { SafetyExportStep } from "./safety-export-step.tsx";
import type { ImportPanelProps, ImportWorkflowPhase } from "./types.ts";

export type { ImportPanelProps };

function importProgressStep(phase: ImportWorkflowPhase): number {
  if (phase === "choosing") return 0;
  if (phase === "validating") return 1;
  if (phase === "preview") return 2;
  return 3;
}

export function ImportPanel({
  viewModel,
  onFileSelected,
  onModeChange,
  onSafetyExport,
  onSafetyExportRetry,
  onReplacementConfirmationChange,
  onCommit,
  onRetry,
  onReviewConflicts,
  onCancel,
}: ImportPanelProps) {
  const busy = viewModel.phase === "validating" ||
    viewModel.phase === "pre-syncing" || viewModel.phase === "saving";
  const replacing = viewModel.mode === "replace";
  const blockedByPreview = viewModel.preview?.errors.length !== 0;
  const blockedBySafety = replacing &&
    (viewModel.safetyExport !== "ready" ||
      viewModel.replacementConfirmation !== "confirmed");
  const blockedByPreSync = replacing && viewModel.drive === "configured" &&
    viewModel.connectivity === "offline";
  const commitDisabled = busy || !viewModel.mode || blockedByPreview ||
    blockedBySafety || blockedByPreSync || viewModel.phase !== "preview";

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) onFileSelected(file);
  };

  return (
    <Section className="conflict-import-import-panel">
      <Stack gap={5}>
        <Stack gap={2}>
          <Heading level={2}>Import</Heading>
          <Text tone="secondary">
            Choose a versioned JSON backup. It is validated and previewed before
            any current data changes.
          </Text>
        </Stack>

        {viewModel.phase === "idle" || viewModel.phase === "choosing"
          ? (
            <FileField
              label="Choose JSON backup"
              description="Only the canonical JSON export format is accepted."
              accept="application/json,.json"
              onChange={handleFileChange}
            />
          )
          : null}

        {viewModel.fileName
          ? (
            <StatusMessage tone="info">
              Selected file: {viewModel.fileName}
            </StatusMessage>
          )
          : null}

        {busy
          ? (
            <WorkflowProgress
              steps={[
                "Choose JSON backup",
                "Validate and migrate",
                "Preview and choose mode",
                "Commit import",
              ]}
              current={importProgressStep(viewModel.phase)}
              status={viewModel.phase === "validating"
                ? "Validating JSON backup"
                : viewModel.phase === "pre-syncing"
                ? "Synchronizing before replacement"
                : "Saving import locally"}
              action={
                <Button variant="quiet" onPress={onCancel}>Cancel</Button>
              }
            />
          )
          : null}

        {viewModel.connectivity === "offline"
          ? (
            <Banner tone="warning" title="Offline">
              Merge remains available offline. Replacement with Drive configured
              waits for a successful pre-sync when you reconnect.
            </Banner>
          )
          : viewModel.connectivity === "reconnecting"
          ? (
            <Banner tone="info" title="Reconnecting">
              Keep this import open while Drive reconnects before replacement.
            </Banner>
          )
          : null}

        {viewModel.preview
          ? <ImportPreview preview={viewModel.preview} />
          : null}

        {viewModel.phase === "preview" && viewModel.preview
          ? (
            <>
              <ImportModeChoice
                value={viewModel.mode}
                disabled={busy || blockedByPreview}
                onChange={onModeChange}
              />
              {replacing
                ? (
                  <Stack gap={4} className="conflict-import-replace-warning">
                    <InlineNotice
                      tone="danger"
                      title="Replace all current data"
                    >
                      This destructive action creates a new dataset generation
                      and removes current records after a safety export. It
                      cannot be undone from this screen.
                    </InlineNotice>
                    <SafetyExportStep
                      status={viewModel.safetyExport}
                      confirmation={viewModel.replacementConfirmation}
                      errorMessage={viewModel.safetyExportError}
                      onExport={onSafetyExport}
                      onRetry={onSafetyExportRetry}
                      onConfirmationChange={onReplacementConfirmationChange}
                    />
                    {blockedByPreSync
                      ? (
                        <InlineNotice
                          tone="warning"
                          title="Online pre-sync required"
                        >
                          Drive is configured, so replacement waits for a
                          successful online pre-sync. No data has changed.
                        </InlineNotice>
                      )
                      : null}
                  </Stack>
                )
                : (
                  <InlineNotice tone="info" title="Recommended">
                    Merge is the prominent safe choice and works offline.
                  </InlineNotice>
                )}
              {viewModel.mode === null
                ? (
                  <InlineNotice tone="warning">
                    Choose merge or replace before committing this import.
                  </InlineNotice>
                )
                : null}
              <Inline justify="end" gap={3}>
                <Button variant="quiet" onPress={onCancel}>Cancel</Button>
                <Button
                  variant={replacing ? "danger" : "primary"}
                  pending={busy}
                  isDisabled={commitDisabled}
                  onPress={onCommit}
                >
                  {replacing
                    ? "Replace all current data"
                    : "Merge into current data"}
                </Button>
              </Inline>
            </>
          )
          : null}

        {viewModel.phase === "error"
          ? (
            <ErrorState
              title="Import could not continue"
              action={viewModel.error?.retryable
                ? (
                  <Button variant="secondary" onPress={onRetry}>
                    Retry validation
                  </Button>
                )
                : undefined}
            >
              {viewModel.error?.message ??
                "The selected backup could not be imported."}
            </ErrorState>
          )
          : null}

        {viewModel.phase === "conflict"
          ? (
            <InlineNotice
              tone="warning"
              title="Import committed with conflicts"
            >
              The imported data is saved. Review {viewModel.conflictCount}{" "}
              resulting{" "}
              {viewModel.conflictCount === 1 ? "conflict" : "conflicts"}.
              <Button variant="secondary" onPress={onReviewConflicts}>
                Review conflicts
              </Button>
            </InlineNotice>
          )
          : null}

        {viewModel.phase === "completed"
          ? (
            <StatusMessage tone="positive">
              {viewModel.generation === undefined
                ? "Import completed."
                : "Import completed as dataset generation " +
                  viewModel.generation + "."}
            </StatusMessage>
          )
          : null}
      </Stack>
    </Section>
  );
}
