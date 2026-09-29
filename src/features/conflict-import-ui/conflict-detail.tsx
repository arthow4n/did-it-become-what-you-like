import {
  Button,
  Card,
  Heading,
  Inline,
  InlineNotice,
  List,
  ListRow,
  Stack,
  StatusMessage,
  Text,
  TextArea,
} from "../../design-system/index.ts";
import { ConflictCandidateCard } from "./conflict-candidate-card.tsx";
import { type ConflictDetailProps, displayConflictValue } from "./types.ts";

export type { ConflictDetailProps };

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
