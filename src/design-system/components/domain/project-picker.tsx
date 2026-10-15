import { memo } from "react";
import { SelectField, type SelectOption } from "../fields.tsx";

export type ProjectPickerProps = {
  options: SelectOption[];
  value?: string;
  onValueChange?: (value: string) => void;
  className?: string;
  isDisabled?: boolean;
};

export const ProjectPicker = memo(function ProjectPicker(
  { options, value, onValueChange, className, isDisabled }: ProjectPickerProps,
) {
  return (
    <SelectField
      label="Project"
      options={options}
      value={value}
      onValueChange={onValueChange}
      className={className}
      isDisabled={isDisabled}
    />
  );
});
