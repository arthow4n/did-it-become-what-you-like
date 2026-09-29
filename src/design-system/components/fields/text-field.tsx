import type { ComponentProps } from "react";
import { TextInput as MantineTextInput } from "@mantine/core";
import { cx } from "../shared.ts";
import { type SharedTextFieldProps, validationAttributes } from "./shared.ts";

export function TextField({
  label,
  placeholder,
  description,
  error,
  className,
  onChange,
  isDisabled,
  isReadOnly,
  isRequired,
  isInvalid,
  validationBehavior,
  slot,
  ...props
}: SharedTextFieldProps) {
  const mantineProps = props as unknown as ComponentProps<
    typeof MantineTextInput
  >;
  const validation = validationAttributes(isRequired, validationBehavior);
  return (
    <MantineTextInput
      {...mantineProps}
      label={label}
      placeholder={placeholder}
      description={description}
      error={error}
      {...validation}
      disabled={isDisabled}
      readOnly={isReadOnly}
      slot={slot ?? undefined}
      aria-invalid={Boolean(error) || isInvalid ? "true" : undefined}
      onChange={(event) => onChange?.(event.currentTarget.value)}
      className={cx("ds-field", className)}
      classNames={{ input: "ds-field-control" }}
    />
  );
}
