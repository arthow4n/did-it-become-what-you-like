import type { ReactNode } from "react";
import { Popover as MantinePopover } from "@mantine/core";
import { cx } from "../shared.ts";

export type PopoverProps = {
  trigger: ReactNode;
  children: ReactNode;
  label?: string;
  className?: string;
};

export function Popover({ trigger, children, label, className }: PopoverProps) {
  return (
    <MantinePopover
      returnFocus
      trapFocus
      transitionProps={{ duration: 0, exitDuration: 0 }}
      zIndex="var(--layer-overlay)"
    >
      <MantinePopover.Target>{trigger}</MantinePopover.Target>
      <MantinePopover.Dropdown
        aria-label={label}
        className={cx("ds-popover", className)}
      >
        {children}
      </MantinePopover.Dropdown>
    </MantinePopover>
  );
}
