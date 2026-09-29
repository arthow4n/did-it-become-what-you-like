import type { ReactNode } from "react";
import { Tooltip as MantineTooltip } from "@mantine/core";

export function Tooltip(
  { trigger, children, label }: {
    trigger: ReactNode;
    children: ReactNode;
    label?: string;
  },
) {
  return (
    <MantineTooltip
      label={children}
      aria-label={label}
      classNames={{ tooltip: "ds-popover" }}
      transitionProps={{ duration: 0, exitDuration: 0 }}
      events={{ hover: true, focus: true, touch: false }}
    >
      {trigger}
    </MantineTooltip>
  );
}
