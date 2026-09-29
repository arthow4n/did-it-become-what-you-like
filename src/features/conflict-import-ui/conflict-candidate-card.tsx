import {
  Badge,
  Button,
  Card,
  Heading,
  Inline,
  Stack,
  Text,
} from "../../design-system/index.ts";
import {
  type ConflictCandidateCardProps,
  displayConflictValue,
} from "./types.ts";

export type { ConflictCandidateCardProps };

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
