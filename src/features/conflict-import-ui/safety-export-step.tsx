import {
  Button,
  Checkbox,
  Heading,
  InlineNotice,
  Section,
  Stack,
  Text,
} from "../../design-system/index.ts";
import type { SafetyExportStepProps } from "./types.ts";

export type { SafetyExportStepProps };

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
              I've backed up my data and confirm replacing all current data.
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
