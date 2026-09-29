import type { ComponentProps, ReactNode } from "react";
import { Textarea as MantineTextarea } from "@mantine/core";
import { cx } from "../shared.ts";
import { type FieldStateProps, validationAttributes } from "./shared.ts";

export type TextAreaProps =
  & Omit<
    ComponentProps<"textarea">,
    | "children"
    | "className"
    | "defaultValue"
    | "onChange"
    | "value"
  >
  & {
    label: ReactNode;
    placeholder?: string;
    description?: ReactNode;
    error?: ReactNode;
    value?: string;
    defaultValue?: string;
    onChange?: (value: string) => void;
    className?: string;
  }
  & FieldStateProps;

export function TextArea(
  {
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
  }: TextAreaProps,
) {
  const mantineProps = props as unknown as ComponentProps<
    typeof MantineTextarea
  >;
  const validation = validationAttributes(isRequired, validationBehavior);
  return (
    <MantineTextarea
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
