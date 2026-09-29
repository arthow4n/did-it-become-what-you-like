import type { ComponentProps, ReactNode } from "react";
import { Switch as MantineSwitch } from "@mantine/core";
import { cx } from "../shared.ts";
import { validationAttributes } from "./shared.ts";

export type SwitchProps = {
  children: ReactNode;
  className?: string;
  isSelected?: boolean;
  defaultSelected?: boolean;
  onChange?: (selected: boolean) => void;
  isDisabled?: boolean;
  isReadOnly?: boolean;
  isRequired?: boolean;
  isInvalid?: boolean;
  validationBehavior?: "aria" | "native";
  slot?: string;
};

export function Switch({
  children,
  className,
  isSelected,
  defaultSelected,
  onChange,
  isDisabled,
  isReadOnly,
  isRequired,
  isInvalid,
  validationBehavior,
  slot,
  ...props
}: SwitchProps) {
  const mantineProps = props as unknown as ComponentProps<typeof MantineSwitch>;
  const validation = validationAttributes(isRequired, validationBehavior);
  return (
    <MantineSwitch
      {...mantineProps}
      label={children}
      checked={isSelected}
      defaultChecked={defaultSelected}
      onChange={(event) => onChange?.(event.currentTarget.checked)}
      disabled={isDisabled}
      readOnly={isReadOnly}
      {...validation}
      aria-invalid={isInvalid ? "true" : undefined}
      slot={slot ?? undefined}
      className={cx("ds-switch", className)}
    />
  );
}
