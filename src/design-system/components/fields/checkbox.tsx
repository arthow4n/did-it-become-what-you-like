import type { ComponentProps, ReactNode } from "react";
import { Checkbox as MantineCheckbox } from "@mantine/core";
import { cx } from "../shared.ts";
import { validationAttributes } from "./shared.ts";

export type CheckboxProps =
  & Omit<
    ComponentProps<"input">,
    | "type"
    | "children"
    | "className"
    | "checked"
    | "defaultChecked"
    | "disabled"
    | "onChange"
    | "readOnly"
    | "required"
  >
  & {
    children: ReactNode;
    className?: string;
    isSelected?: boolean;
    defaultSelected?: boolean;
    isIndeterminate?: boolean;
    onChange?: (selected: boolean) => void;
    isDisabled?: boolean;
    isReadOnly?: boolean;
    isRequired?: boolean;
    isInvalid?: boolean;
    validationBehavior?: "aria" | "native";
    slot?: string;
  };

export function Checkbox({
  children,
  className,
  isSelected,
  defaultSelected,
  isIndeterminate,
  onChange,
  isDisabled,
  isReadOnly,
  isRequired,
  isInvalid,
  validationBehavior,
  slot,
  ...props
}: CheckboxProps) {
  const mantineProps = props as unknown as ComponentProps<
    typeof MantineCheckbox
  >;
  const validation = validationAttributes(isRequired, validationBehavior);
  return (
    <MantineCheckbox
      {...mantineProps}
      label={children}
      checked={isSelected}
      defaultChecked={defaultSelected}
      indeterminate={isIndeterminate}
      onChange={(event) => onChange?.(event.currentTarget.checked)}
      disabled={isDisabled}
      readOnly={isReadOnly}
      {...validation}
      aria-invalid={isInvalid ? "true" : undefined}
      slot={slot ?? undefined}
      className={cx("ds-checkbox", className)}
    />
  );
}
