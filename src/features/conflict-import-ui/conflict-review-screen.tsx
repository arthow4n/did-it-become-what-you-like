import { useState } from "react";
import {
  Badge,
  Banner,
  Button,
  ContentContainer,
  DefinitionList,
  EmptyState,
  ErrorState,
  Heading,
  Inline,
  PageHeader,
  Progress,
  Section,
  Skeleton,
  Stack,
  Text,
} from "../../design-system/index.ts";
import { ConflictDetail } from "./conflict-detail.tsx";
import { ConflictList } from "./conflict-list.tsx";
import type {
  ConflictGroupViewModel,
  ConflictReviewScreenProps,
  ConflictReviewViewModel,
  TechnicalDetailsViewModel,
} from "./types.ts";

export type { ConflictReviewScreenProps };

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
