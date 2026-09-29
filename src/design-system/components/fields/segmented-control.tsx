import type { ComponentProps } from "react";
import { SegmentedControl as MantineSegmentedControl } from "@mantine/core";
import { cx } from "../shared.ts";
import { type SelectOption, validationAttributes } from "./shared.ts";

export type SegmentedOption = SelectOption & { description?: string };

export type SegmentedControlProps = {
  label: string;
  options: SegmentedOption[];
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  isDisabled?: boolean;
  isReadOnly?: boolean;
  isRequired?: boolean;
  isInvalid?: boolean;
  validationBehavior?: "aria" | "native";
  name?: string;
  id?: string;
  slot?: string;
  fullWidth?: boolean;
  className?: string;
};

export function SegmentedControl(
  {
    label,
    options,
    fullWidth,
    className,
    value,
    defaultValue,
    onChange,
    isDisabled,
    isReadOnly,
    isRequired,
    isInvalid,
    name,
    slot,
    validationBehavior,
    ...props
  }: SegmentedControlProps,
) {
  const validation = validationAttributes(
    isRequired,
    validationBehavior,
    false,
  );
  return (
    <MantineSegmentedControl
      {...(props as unknown as ComponentProps<typeof MantineSegmentedControl>)}
      data={options.map((option) => ({
        value: option.id,
        label: option.label,
        disabled: option.disabled,
      }))}
      value={value ?? undefined}
      defaultValue={defaultValue ?? undefined}
      onChange={onChange}
      disabled={isDisabled}
      readOnly={isReadOnly}
      name={name}
      fullWidth={fullWidth}
      aria-label={label}
      {...validation}
      aria-invalid={isInvalid ? "true" : undefined}
      slot={slot ?? undefined}
      className={cx("ds-segmented-control", className)}
      data-full-width={fullWidth ? "true" : undefined}
    />
  );
}
