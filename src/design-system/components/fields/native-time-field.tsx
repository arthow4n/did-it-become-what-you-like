import { useId } from "react";
import type { ComponentProps, ReactNode } from "react";
import { TimeInput as MantineTimeInput } from "@mantine/dates";
import { cx } from "../shared.ts";
import { inputValue } from "./shared.ts";

export type NativeTimeFieldProps =
  & Omit<ComponentProps<"input">, "type" | "className">
  & {
    label: ReactNode;
    description?: ReactNode;
    error?: ReactNode;
    className?: string;
  };

export function NativeTimeField(
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
  }: NativeTimeFieldProps,
) {
  const generatedId = useId();
  const controlId = id ?? generatedId;
  const timeValue = inputValue(value);
  const timeDefaultValue = inputValue(defaultValue);
  return (
    <MantineTimeInput
      label={label}
      description={description}
      error={error}
      required={props.required}
      id={controlId}
      value={timeValue}
      defaultValue={timeDefaultValue}
      onChange={onChange}
      className={cx("ds-field", className)}
      classNames={{ input: "ds-field-control" }}
      {...(props as unknown as ComponentProps<typeof MantineTimeInput>)}
    />
  );
}
