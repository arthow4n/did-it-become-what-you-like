import { useId } from "react";
import type { ComponentProps, ReactNode } from "react";
import { DateInput as MantineDateInput } from "@mantine/dates";
import { cx } from "../shared.ts";
import { emitInputChange, inputValue } from "./shared.ts";

export type NativeDateFieldProps =
  & Omit<ComponentProps<"input">, "type" | "className">
  & {
    label: ReactNode;
    description?: ReactNode;
    error?: ReactNode;
    className?: string;
  };

export function NativeDateField(
  {
    label,
    description,
    error,
    className,
    id,
    value,
    defaultValue,
    onChange,
    ...props
  }: NativeDateFieldProps,
) {
  const generatedId = useId();
  const controlId = id ?? generatedId;
  const dateValue = inputValue(value);
  const dateDefaultValue = inputValue(defaultValue);
  return (
    <MantineDateInput
      label={label}
      description={description}
      error={error}
      required={props.required}
      id={controlId}
      value={dateValue}
      defaultValue={dateDefaultValue}
      onChange={(nextValue) => emitInputChange(onChange, nextValue ?? "")}
      valueFormat="YYYY-MM-DD"
      className={cx("ds-field", className)}
      classNames={{ input: "ds-field-control" }}
      {...(props as unknown as ComponentProps<typeof MantineDateInput>)}
    />
  );
}
