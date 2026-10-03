import { useMemo } from "react";
import { Stack, Text } from "../primitives.tsx";
import { SelectField, type SelectOption } from "../fields.tsx";

export type ModelViewModel = SelectOption & {
  reason?: string;
};

export type ModelPickerProps = {
  options: ModelViewModel[];
  value?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
};

export function ModelPicker(
  { options, value, onValueChange, disabled = false }: ModelPickerProps,
) {
  const effectiveOptions = useMemo(() => {
    if (value && !options.some((candidate) => candidate.id === value)) {
      return [
        {
          id: value,
          label: value.replace(/^models\//, ""),
        },
        ...options,
      ];
    }
    return options;
  }, [options, value]);

  return (
    <SelectField
      label="Model"
      options={effectiveOptions.map((option) => ({
        id: option.id,
        label: option.label,
        disabled: option.disabled,
      }))}
      value={value}
      onValueChange={onValueChange}
      isDisabled={disabled}
      searchable
      placeholder="Search models"
      className="ds-model-picker"
      renderOption={(option) => {
        const model = effectiveOptions.find((candidate) =>
          candidate.id === option.id
        );
        return (
          <Stack gap={1}>
            <span>{option.label}</span>
            <Text size="label" tone="secondary">
              {model?.reason ?? ""}
            </Text>
          </Stack>
        );
      }}
    />
  );
}
