import { InlineNotice, RadioGroup, Stack } from "../../design-system/index.ts";
import type { ImportMode, ImportModeChoiceProps } from "./types.ts";

export type { ImportMode, ImportModeChoiceProps };

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
        Keeps existing data and resolves any conflicts.
      </InlineNotice>
      <InlineNotice tone="danger" title="Replace is destructive">
        Replaces all current data with this backup file.
      </InlineNotice>
    </Stack>
  );
}
