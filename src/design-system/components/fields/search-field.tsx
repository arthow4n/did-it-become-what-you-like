import { useState } from "react";
import type { ComponentProps, ReactNode } from "react";
import {
  ActionIcon as MantineActionIcon,
  TextInput as MantineTextInput,
} from "@mantine/core";
import { X } from "lucide-react";
import { cx } from "../shared.ts";
import { Icon } from "../primitives.tsx";
import { type FieldStateProps, validationAttributes } from "./shared.ts";

export type SearchFieldProps =
  & Omit<
    ComponentProps<"input">,
    | "children"
    | "className"
    | "defaultValue"
    | "onChange"
    | "type"
    | "value"
  >
  & {
    label: ReactNode;
    placeholder?: string;
    description?: ReactNode;
    value?: string;
    defaultValue?: string;
    onChange?: (value: string) => void;
    className?: string;
    onValueChange?: (value: string) => void;
  }
  & FieldStateProps;

export function SearchField(
  {
    label,
    placeholder,
    description,
    className,
    value,
    defaultValue,
    onValueChange,
    onChange,
    isDisabled,
    isReadOnly,
    isRequired,
    isInvalid,
    validationBehavior,
    slot,
    ...props
  }: SearchFieldProps,
) {
  const [uncontrolledValue, setUncontrolledValue] = useState(
    defaultValue ?? "",
  );
  const currentValue = value === undefined ? uncontrolledValue : value;
  const mantineProps = props as unknown as ComponentProps<
    typeof MantineTextInput
  >;
  const validation = validationAttributes(isRequired, validationBehavior);
  const handleValueChange = (nextValue: string) => {
    if (value === undefined) setUncontrolledValue(nextValue);
    onChange?.(nextValue);
    onValueChange?.(nextValue);
  };
  return (
    <MantineTextInput
      {...mantineProps}
      type="search"
      value={currentValue}
      label={label}
      placeholder={placeholder}
      description={description}
      {...validation}
      disabled={isDisabled}
      readOnly={isReadOnly}
      aria-invalid={isInvalid ? "true" : undefined}
      className={cx("ds-field", "ds-search-field", className)}
      data-empty={currentValue.length === 0 ? "true" : undefined}
      classNames={{ input: "ds-field-control ds-search-field__input" }}
      slot={slot ?? undefined}
      onChange={(event) => handleValueChange(event.currentTarget.value)}
      rightSectionPointerEvents="all"
      rightSection={
        <MantineActionIcon
          type="button"
          variant="subtle"
          color="accent"
          size="input-sm"
          className="ds-search-field__clear"
          aria-label="Clear search"
          onClick={() => handleValueChange("")}
        >
          <Icon>
            <X />
          </Icon>
        </MantineActionIcon>
      }
    />
  );
}
