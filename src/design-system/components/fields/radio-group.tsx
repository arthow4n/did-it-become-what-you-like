import type { ComponentProps, ReactNode } from "react";
import {
  Radio as MantineRadio,
  RadioGroup as MantineRadioGroup,
} from "@mantine/core";
import { cx } from "../shared.ts";
import { type SelectOption, validationAttributes } from "./shared.ts";

export type RadioGroupProps = {
  label: ReactNode;
  options: SelectOption[];
  description?: ReactNode;
  error?: ReactNode;
  className?: string;
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
};

export function RadioGroup(
  {
    label,
    options,
    description,
    error,
    className,
    value,
    defaultValue,
    onChange,
    isDisabled,
    isReadOnly,
    isRequired,
    isInvalid,
    validationBehavior,
    name,
    slot,
    ...props
  }: RadioGroupProps,
) {
  const validation = validationAttributes(isRequired, validationBehavior);
  return (
    <MantineRadioGroup
      {...(props as unknown as ComponentProps<typeof MantineRadioGroup>)}
      label={label}
      description={description}
      error={error}
      value={value ?? undefined}
      defaultValue={defaultValue ?? undefined}
      onChange={onChange}
      disabled={isDisabled}
      readOnly={isReadOnly}
      {...validation}
      aria-invalid={Boolean(error) || isInvalid ? "true" : undefined}
      name={name}
      slot={slot ?? undefined}
      className={cx("ds-field", className)}
    >
      {options.map((option) => (
        <MantineRadio
          key={option.id}
          value={option.id}
          label={option.label}
          disabled={option.disabled}
          required={validation.required}
          aria-required={validation["aria-required"]}
          className="ds-radio"
        />
      ))}
    </MantineRadioGroup>
  );
}
