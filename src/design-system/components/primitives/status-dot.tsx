import { Badge as MantineBadge } from "@mantine/core";
import { cx, toneColors } from "../shared.ts";
import type { BadgeProps } from "./badge.tsx";

export type StatusDotProps = BadgeProps;

export function StatusDot(
  { children, tone = "info", className, style }: StatusDotProps,
) {
  return (
    <MantineBadge
      component="span"
      color={toneColors[tone]}
      variant="light"
      size="md"
      radius="xl"
      className={cx("ds-status-dot", className)}
      data-tone={tone}
      style={style}
    >
      {children}
    </MantineBadge>
  );
}
