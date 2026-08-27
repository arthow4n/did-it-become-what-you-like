import { type ChangeEvent, type ReactNode, useState } from "react";
import {
  Badge,
  Banner,
  Button,
  Card,
  Checkbox,
  ContentContainer,
  DefinitionList,
  Divider,
  EmptyState,
  ErrorState,
  FileField,
  Heading,
  Inline,
  InlineNotice,
  List,
  ListRow,
  PageHeader,
  Progress,
  RadioGroup,
  Section,
  Skeleton,
  Stack,
  StatusMessage,
  Text,
  TextArea,
  WorkflowProgress,
} from "../../design-system/index.ts";
import type { ConflictJsonValue } from "../../domain/conflict/types.ts";

export type TechnicalDetailsViewModel = {
  readonly recordId: string;
  readonly groupId: string;
  readonly parentRevisionIds: readonly string[];
  readonly candidateRevisionIds?: readonly string[];
};

export type ConflictCandidateViewModel = {
  readonly id: string;
  readonly revisionId: string;
  readonly value?: ConflictJsonValue;
  readonly valueLabel?: ReactNode;
  readonly deleted: boolean;
  readonly deviceLabel: string;
  readonly recordedAt: string;
  readonly recordedAtLabel?: string;
};

export type ConflictChoice =
  | { readonly kind: "candidate"; readonly candidateId: string }
  | { readonly kind: "custom" }
  | { readonly kind: "keep-edited" }
  | { readonly kind: "delete" };

export type ConflictGroupViewModel = {
  readonly id: string;
  readonly recordLabel: string;
  readonly recordTypeLabel: string;
  readonly fieldLabel: string;
  readonly kind: "same-field" | "delete-versus-edit";
  readonly candidates: readonly ConflictCandidateViewModel[];
  readonly selectedChoice?: ConflictChoice;
  readonly customValue: string;
  readonly customValueError?: string;
  readonly discardedEditedValues?: readonly ConflictJsonValue[];
  readonly technicalDetails?: TechnicalDetailsViewModel;
};

export type ConflictWorkflowPhase =
  | "loading"
  | "reviewing"
  | "saving"
  | "error"
  | "completed";

export type ConnectivityViewModel = "online" | "offline" | "reconnecting";

export type ConflictReviewViewModel = {
  readonly phase: ConflictWorkflowPhase;
  readonly connectivity: ConnectivityViewModel;
  readonly groups: readonly ConflictGroupViewModel[];
  readonly activeGroupId: string | null;
  readonly pane: "list" | "detail";
  readonly completedCount: number;
  readonly error?: {
    readonly message: string;
    readonly retryable: boolean;
  };
};

export type ConflictReviewScreenProps = {
  readonly viewModel: ConflictReviewViewModel;
  readonly onBack: () => void;
  readonly onOpenGroup: (groupId: string) => void;
  readonly onShowList: () => void;
  readonly onChooseCandidate: (candidateId: string) => void;
  readonly onCustomValueChange: (value: string) => void;
  readonly onChooseCustom: (value: string) => void;
  readonly onKeepEdited: () => void;
  readonly onDeleteRecord: () => void;
  readonly onSubmit: () => void;
  readonly onRetry: () => void;
};

function displayConflictValue(value: ConflictJsonValue | undefined): string {
  if (value === undefined || value === null) return "No value";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) return "Multiple values";
  return "Structured value";
}

function conflictProgressLabel(
  model: ConflictReviewViewModel,
  group: ConflictGroupViewModel | undefined,
): string {
  if (group === undefined) return "Conflict review";
  const current = Math.min(model.completedCount + 1, model.groups.length);
  return "Conflict " + current + " of " + model.groups.length;
}

function TechnicalDetailsDisclosure({ details }: {
  readonly details: TechnicalDetailsViewModel;
}) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <Section className="conflict-import-technical-details">
      <Button
        variant="quiet"
        aria-expanded={isOpen}
        onPress={() => setIsOpen((current) => !current)}
      >
        Technical details (diagnostics)
      </Button>
      {isOpen
        ? (
          <Stack
            gap={3}
            className="conflict-import-technical-details__content"
            role="region"
            aria-label="Technical details (diagnostics)"
          >
            <DefinitionList
              items={[
                {
                  term: "Record ID",
                  description: <code>{details.recordId}</code>,
                },
                {
                  term: "Conflict group ID",
                  description: <code>{details.groupId}</code>,
                },
                {
                  term: "Parent revisions",
                  description: (
                    <code>
                      {details.parentRevisionIds.join(", ") || "None"}
                    </code>
                  ),
                },
                ...(details.candidateRevisionIds === undefined ? [] : [{
                  term: "Candidate revisions",
                  description: (
                    <code>
                      {details.candidateRevisionIds.join(", ") || "None"}
                    </code>
                  ),
                }]),
              ]}
            />
          </Stack>
        )
        : null}
    </Section>
  );
}

export type ConflictCandidateCardProps = {
  readonly candidate: ConflictCandidateViewModel;
  readonly ordinal: number;
  readonly selected: boolean;
  readonly interactive: boolean;
  readonly onChoose: () => void;
};

export function ConflictCandidateCard({
  candidate,
  ordinal,
  selected,
  interactive,
  onChoose,
}: ConflictCandidateCardProps) {
  const value = candidate.valueLabel ?? displayConflictValue(candidate.value);
  return (
    <Card
      as="div"
      className="conflict-import-candidate"
      data-selected={selected ? "true" : undefined}
    >
      <Stack gap={3}>
        <Inline justify="space-between" gap={2}>
          <Heading level={3} size="sm">Option {ordinal}</Heading>
          {selected ? <Badge tone="positive">Selected</Badge> : null}
        </Inline>
        <Text className="conflict-import-candidate__value">{value}</Text>
        {candidate.deleted
          ? <Badge tone="warning">Record deleted</Badge>
          : null}
        <Text size="label" tone="secondary">
          {candidate.deviceLabel} ·{" "}
          {candidate.recordedAtLabel ?? candidate.recordedAt}
        </Text>
        <Button
          variant="secondary"
          isDisabled={!interactive}
          aria-pressed={selected}
          onPress={onChoose}
        >
          {candidate.deleted ? "Choose deleted value" : "Choose this value"}
        </Button>
      </Stack>
    </Card>
  );
}

export type ConflictDetailProps = {
  readonly group: ConflictGroupViewModel;
  readonly phase: ConflictWorkflowPhase;
  readonly onChooseCandidate: (candidateId: string) => void;
  readonly onCustomValueChange: (value: string) => void;
  readonly onChooseCustom: (value: string) => void;
  readonly onKeepEdited: () => void;
  readonly onDeleteRecord: () => void;
  readonly onSubmit: () => void;
};

export function ConflictDetail({
  group,
  phase,
  onChooseCandidate,
  onCustomValueChange,
  onChooseCustom,
  onKeepEdited,
  onDeleteRecord,
  onSubmit,
}: ConflictDetailProps) {
  const interactive = phase === "reviewing" || phase === "error";
  const choice = group.selectedChoice;
  const customMissing = group.customValue.trim().length === 0;
  const customError = group.customValueError ??
    (customMissing ? "Enter a different value before choosing it." : undefined);
  const hasChoice = choice !== undefined;
  const isCustomChoice = choice?.kind === "custom";

  return (
    <Stack gap={5} className="conflict-import-detail">
      <Stack gap={2}>
        <Heading level={2}>{group.recordLabel}</Heading>
        <Text tone="secondary">
          {group.recordTypeLabel} · Conflicting field: {group.fieldLabel}
        </Text>
      </Stack>

      {group.kind === "delete-versus-edit"
        ? (
          <InlineNotice tone="warning" title="Delete versus edit">
            One device deleted this record while another device edited it.
            Choose explicitly which outcome to keep.
          </InlineNotice>
        )
        : null}

      <Stack gap={3} className="conflict-import-candidates">
        {group.candidates.map((candidate, index) => (
          <ConflictCandidateCard
            key={candidate.id}
            candidate={candidate}
            ordinal={index + 1}
            selected={choice?.kind === "candidate" &&
              choice.candidateId === candidate.id}
            interactive={interactive && group.kind === "same-field"}
            onChoose={() => onChooseCandidate(candidate.id)}
          />
        ))}
      </Stack>

      {group.kind === "delete-versus-edit"
        ? (
          <Card as="div" className="conflict-import-delete-choice">
            <Stack gap={3}>
              <Heading level={3} size="sm">Choose record outcome</Heading>
              <Text tone="secondary">
                Deleting the record discards the edited values listed below.
              </Text>
              {group.discardedEditedValues?.length
                ? (
                  <List
                    label="Discarded edited values"
                    className="conflict-import-discarded-values"
                  >
                    {group.discardedEditedValues.map((value, index) => (
                      <ListRow key={index}>
                        {displayConflictValue(value)}
                      </ListRow>
                    ))}
                  </List>
                )
                : (
                  <Text tone="muted">
                    No edited field values were supplied.
                  </Text>
                )}
              <Inline gap={3}>
                <Button
                  variant="secondary"
                  isDisabled={!interactive}
                  aria-pressed={choice?.kind === "keep-edited"}
                  onPress={onKeepEdited}
                >
                  Keep edited record
                </Button>
                <Button
                  variant="danger"
                  isDisabled={!interactive}
                  aria-pressed={choice?.kind === "delete"}
                  onPress={onDeleteRecord}
                >
                  Delete record
                </Button>
              </Inline>
            </Stack>
          </Card>
        )
        : (
          <Card as="div" className="conflict-import-custom-choice">
            <Stack gap={3}>
              <Heading level={3} size="sm">Choose a different value</Heading>
              <TextArea
                label={"Custom " + group.fieldLabel}
                value={group.customValue}
                error={customError}
                isDisabled={!interactive}
                onChange={onCustomValueChange}
              />
              <Button
                variant="secondary"
                isDisabled={!interactive || customError !== undefined}
                aria-pressed={isCustomChoice}
                onPress={() => onChooseCustom(group.customValue)}
              >
                Use this different value
              </Button>
            </Stack>
          </Card>
        )}

      {phase === "saving"
        ? (
          <StatusMessage tone="info">
            Saving this resolution locally before moving to the next conflict.
          </StatusMessage>
        )
        : null}

      <Inline justify="end" gap={3}>
        <Button
          variant="primary"
          pending={phase === "saving"}
          isDisabled={!interactive || !hasChoice}
          onPress={onSubmit}
        >
          Save and review next
        </Button>
      </Inline>
    </Stack>
  );
}

export type ConflictListProps = {
  readonly groups: readonly ConflictGroupViewModel[];
  readonly activeGroupId: string | null;
  readonly onOpenGroup: (groupId: string) => void;
};

export function ConflictList({
  groups,
  activeGroupId,
  onOpenGroup,
}: ConflictListProps) {
  return (
    <List label="Unresolved conflicts" className="conflict-import-list">
      {groups.map((group, index) => (
        <ListRow key={group.id}>
          <Button
            variant="quiet"
            className="conflict-import-list__button"
            data-selected={activeGroupId === group.id ? "true" : undefined}
            aria-current={activeGroupId === group.id ? "true" : undefined}
            onPress={() => onOpenGroup(group.id)}
          >
            <Stack gap={1}>
              <Inline justify="space-between" gap={2}>
                <strong>{group.recordLabel}</strong>
                <Text size="label" tone="muted">{index + 1}</Text>
              </Inline>
              <Text size="label" tone="secondary">
                {group.fieldLabel} · {group.recordTypeLabel}
              </Text>
            </Stack>
          </Button>
        </ListRow>
      ))}
    </List>
  );
}

export function ConflictReviewScreen({
  viewModel,
  onBack,
  onOpenGroup,
  onShowList,
  onChooseCandidate,
  onCustomValueChange,
  onChooseCustom,
  onKeepEdited,
  onDeleteRecord,
  onSubmit,
  onRetry,
}: ConflictReviewScreenProps) {
  const activeGroup = viewModel.groups.find((group) =>
    group.id === viewModel.activeGroupId
  );
  const heading = conflictProgressLabel(viewModel, activeGroup);

  return (
    <ContentContainer size="review" className="conflict-import-ui">
      <Stack gap={5}>
        <PageHeader
          title="Conflicts"
          headingLevel={1}
          description={heading}
          leading={<Button variant="quiet" onPress={onBack}>Back</Button>}
          status={
            <Badge tone={viewModel.groups.length ? "warning" : "positive"}>
              {viewModel.groups.length
                ? viewModel.groups.length + " unresolved"
                : "All clear"}
            </Badge>
          }
        />

        {viewModel.connectivity === "offline"
          ? (
            <Banner tone="warning" title="Offline">
              Resolutions are saved locally and will sync when you reconnect.
            </Banner>
          )
          : viewModel.connectivity === "reconnecting"
          ? (
            <Banner tone="info" title="Reconnecting">
              Local conflict work remains available while Drive reconnects.
            </Banner>
          )
          : null}

        {viewModel.phase === "loading"
          ? (
            <Stack gap={4} aria-label="Loading conflicts">
              <Progress label="Loading conflicts" indeterminate />
              <Stack
                gap={3}
                className="conflict-import-loading-blocks"
                aria-hidden="true"
              >
                <Skeleton />
                <Skeleton />
                <Skeleton />
              </Stack>
            </Stack>
          )
          : viewModel.phase === "completed" || viewModel.groups.length === 0
          ? (
            <EmptyState title="No conflicts need review">
              Resolved conflicts stay recorded locally and will continue through
              ordinary synchronization.
            </EmptyState>
          )
          : (
            <>
              {viewModel.phase === "error"
                ? (
                  <ErrorState
                    title="Conflict review needs attention"
                    action={viewModel.error?.retryable
                      ? (
                        <Button variant="secondary" onPress={onRetry}>
                          Retry
                        </Button>
                      )
                      : undefined}
                  >
                    {viewModel.error?.message ??
                      "The conflict workflow could not continue."}
                  </ErrorState>
                )
                : null}
              <Stack
                gap={5}
                className="conflict-import-master-detail"
                data-pane={viewModel.pane}
              >
                <Section className="conflict-import-list-pane">
                  <Stack gap={3}>
                    <Inline justify="space-between" gap={2}>
                      <Heading level={2} size="sm">Unresolved records</Heading>
                      <Text size="label" tone="muted">
                        {viewModel.groups.length} remaining
                      </Text>
                    </Inline>
                    <ConflictList
                      groups={viewModel.groups}
                      activeGroupId={viewModel.activeGroupId}
                      onOpenGroup={onOpenGroup}
                    />
                  </Stack>
                </Section>
                <Section className="conflict-import-detail-pane">
                  {activeGroup
                    ? (
                      <Stack gap={4}>
                        <Button
                          variant="quiet"
                          className="conflict-import-mobile-back"
                          onPress={onShowList}
                        >
                          Back to conflict list
                        </Button>
                        <ConflictDetail
                          group={activeGroup}
                          phase={viewModel.phase}
                          onChooseCandidate={onChooseCandidate}
                          onCustomValueChange={onCustomValueChange}
                          onChooseCustom={onChooseCustom}
                          onKeepEdited={onKeepEdited}
                          onDeleteRecord={onDeleteRecord}
                          onSubmit={onSubmit}
                        />
                        {activeGroup.technicalDetails
                          ? (
                            <TechnicalDetailsDisclosure
                              details={activeGroup.technicalDetails}
                            />
                          )
                          : null}
                      </Stack>
                    )
                    : (
                      <EmptyState title="Choose a conflict">
                        Select an unresolved record to review its competing
                        values.
                      </EmptyState>
                    )}
                </Section>
              </Stack>
            </>
          )}
      </Stack>
    </ContentContainer>
  );
}

export type ExportDelivery = "download" | "share";
export type ExportWorkflowPhase =
  | "idle"
  | "preparing"
  | "delivering"
  | "completed"
  | "error";

export type ExportViewModel = {
  readonly phase: ExportWorkflowPhase;
  readonly shareAvailability: "available" | "unavailable";
  readonly delivery?: "downloaded" | "shared";
  readonly error?: {
    readonly message: string;
    readonly retryable: boolean;
  };
};

export type ExportPanelProps = {
  readonly viewModel: ExportViewModel;
  readonly onExport: (delivery: ExportDelivery) => void;
  readonly onRetry: () => void;
  readonly onCancel: () => void;
};

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

export type ImportPreviewViewModel = {
  readonly schemaVersion: number;
  readonly migration: "not-required" | "required";
  readonly projectCount: number;
  readonly categoryCount: number;
  readonly expenseCount: number;
  readonly receiptCount: number;
  readonly changeCount: number;
  readonly migrations: readonly string[];
  readonly warnings: readonly string[];
  readonly errors: readonly string[];
};

export type ImportPreviewProps = {
  readonly preview: ImportPreviewViewModel;
};

export function ImportPreview({ preview }: ImportPreviewProps) {
  const counts = [
    { term: "Projects", description: String(preview.projectCount) },
    { term: "Categories", description: String(preview.categoryCount) },
    { term: "Expenses", description: String(preview.expenseCount) },
    { term: "Receipts", description: String(preview.receiptCount) },
    { term: "Causal changes", description: String(preview.changeCount) },
    {
      term: "Migrations",
      description: preview.migrations.length
        ? preview.migrations.join(", ")
        : "None",
    },
  ];
  return (
    <Card as="section" className="conflict-import-preview">
      <Stack gap={4}>
        <Stack gap={2}>
          <Heading level={2}>Validated JSON backup</Heading>
          <Text tone="secondary">
            Schema {preview.schemaVersion} · {preview.migration === "required"
              ? "migration required"
              : "no migration needed"}
          </Text>
        </Stack>
        <DefinitionList items={counts} />
        {preview.warnings.length
          ? (
            <InlineNotice tone="warning" title="Review these warnings">
              <List label="Import warnings">
                {preview.warnings.map((warning) => (
                  <ListRow key={warning}>{warning}</ListRow>
                ))}
              </List>
            </InlineNotice>
          )
          : null}
        {preview.errors.length
          ? (
            <ErrorState title="This backup cannot be imported">
              {preview.errors.join(" ")}
            </ErrorState>
          )
          : null}
      </Stack>
    </Card>
  );
}

export type ImportMode = "merge" | "replace";

export type ImportModeChoiceProps = {
  readonly value: ImportMode | null;
  readonly disabled: boolean;
  readonly onChange: (mode: ImportMode) => void;
};

export function ImportModeChoice({
  value,
  disabled,
  onChange,
}: ImportModeChoiceProps) {
  return (
    <Stack gap={3} className="conflict-import-mode-choice">
      <RadioGroup
        label="Choose import mode"
        options={[
          { id: "merge", label: "Merge into current data" },
          { id: "replace", label: "Replace all current data" },
        ]}
        value={value ?? undefined}
        isDisabled={disabled}
        onChange={(next) => onChange(next as ImportMode)}
      />
      <InlineNotice tone="info" title="Recommended: merge">
        Merge keeps the current dataset, works offline, and sends any resulting
        conflicts through Conflict Review.
      </InlineNotice>
      <InlineNotice tone="danger" title="Replace is destructive">
        Replace creates a new dataset generation and removes current records
        after the required safety checks.
      </InlineNotice>
    </Stack>
  );
}

export type SafetyExportStatus =
  | "not-started"
  | "exporting"
  | "ready"
  | "error";
export type ReplacementConfirmation = "unconfirmed" | "confirmed";

export type SafetyExportStepProps = {
  readonly status: SafetyExportStatus;
  readonly confirmation: ReplacementConfirmation;
  readonly errorMessage?: string;
  readonly onExport: () => void;
  readonly onRetry: () => void;
  readonly onConfirmationChange: (
    confirmation: ReplacementConfirmation,
  ) => void;
};

export function SafetyExportStep({
  status,
  confirmation,
  errorMessage,
  onExport,
  onRetry,
  onConfirmationChange,
}: SafetyExportStepProps) {
  return (
    <Section className="conflict-import-safety-export">
      <Stack gap={3}>
        <Heading level={3} size="sm">Safety export before replacement</Heading>
        <Text>
          Export a complete JSON backup before replacing current data. This is
          the recovery copy if replacement is interrupted or not what you
          expected.
        </Text>
        {status === "error"
          ? (
            <InlineNotice tone="danger" title="Safety export failed">
              {errorMessage ?? "The safety export was not completed."}
              <Button variant="secondary" onPress={onRetry}>
                Retry safety export
              </Button>
            </InlineNotice>
          )
          : null}
        {status === "ready"
          ? (
            <Checkbox
              isSelected={confirmation === "confirmed"}
              onChange={(selected) =>
                onConfirmationChange(selected ? "confirmed" : "unconfirmed")}
            >
              I have a complete safety export and understand that replacement
              removes current data.
            </Checkbox>
          )
          : null}
        {status !== "ready"
          ? (
            <Button
              variant="secondary"
              pending={status === "exporting"}
              isDisabled={status === "exporting"}
              onPress={onExport}
            >
              {status === "exporting"
                ? "Creating safety export"
                : "Create safety export"}
            </Button>
          )
          : null}
      </Stack>
    </Section>
  );
}

export type ImportWorkflowPhase =
  | "idle"
  | "choosing"
  | "validating"
  | "preview"
  | "pre-syncing"
  | "saving"
  | "conflict"
  | "completed"
  | "error";

export type ImportViewModel = {
  readonly phase: ImportWorkflowPhase;
  readonly connectivity: ConnectivityViewModel;
  readonly drive: "configured" | "not-configured";
  readonly fileName?: string;
  readonly preview: ImportPreviewViewModel | null;
  readonly mode: ImportMode | null;
  readonly safetyExport: SafetyExportStatus;
  readonly safetyExportError?: string;
  readonly replacementConfirmation: ReplacementConfirmation;
  readonly conflictCount: number;
  readonly generation?: number;
  readonly error?: {
    readonly message: string;
    readonly retryable: boolean;
  };
};

export type ImportPanelProps = {
  readonly viewModel: ImportViewModel;
  readonly onFileSelected: (file: File) => void;
  readonly onModeChange: (mode: ImportMode) => void;
  readonly onSafetyExport: () => void;
  readonly onSafetyExportRetry: () => void;
  readonly onReplacementConfirmationChange: (
    confirmation: ReplacementConfirmation,
  ) => void;
  readonly onCommit: () => void;
  readonly onRetry: () => void;
  readonly onReviewConflicts: () => void;
  readonly onCancel: () => void;
};

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

export type ImportExportScreenProps = {
  readonly exportModel: ExportViewModel;
  readonly importModel: ImportViewModel;
  readonly onBack: () => void;
  readonly onExport: (delivery: ExportDelivery) => void;
  readonly onRetryExport: () => void;
  readonly onCancelExport: () => void;
  readonly onFileSelected: (file: File) => void;
  readonly onModeChange: (mode: ImportMode) => void;
  readonly onSafetyExport: () => void;
  readonly onSafetyExportRetry: () => void;
  readonly onReplacementConfirmationChange: (
    confirmation: ReplacementConfirmation,
  ) => void;
  readonly onCommit: () => void;
  readonly onRetryImport: () => void;
  readonly onReviewConflicts: () => void;
  readonly onCancelImport: () => void;
};

export function ImportExportScreen({
  exportModel,
  importModel,
  onBack,
  onExport,
  onRetryExport,
  onCancelExport,
  onFileSelected,
  onModeChange,
  onSafetyExport,
  onSafetyExportRetry,
  onReplacementConfirmationChange,
  onCommit,
  onRetryImport,
  onReviewConflicts,
  onCancelImport,
}: ImportExportScreenProps) {
  return (
    <ContentContainer size="readable" className="conflict-import-ui">
      <Stack gap={5}>
        <PageHeader
          title="Import & export"
          headingLevel={1}
          description="Portable JSON data"
          leading={<Button variant="quiet" onPress={onBack}>Back</Button>}
        />
        <ExportPanel
          viewModel={exportModel}
          onExport={onExport}
          onRetry={onRetryExport}
          onCancel={onCancelExport}
        />
        <Divider />
        <ImportPanel
          viewModel={importModel}
          onFileSelected={onFileSelected}
          onModeChange={onModeChange}
          onSafetyExport={onSafetyExport}
          onSafetyExportRetry={onSafetyExportRetry}
          onReplacementConfirmationChange={onReplacementConfirmationChange}
          onCommit={onCommit}
          onRetry={onRetryImport}
          onReviewConflicts={onReviewConflicts}
          onCancel={onCancelImport}
        />
      </Stack>
    </ContentContainer>
  );
}
