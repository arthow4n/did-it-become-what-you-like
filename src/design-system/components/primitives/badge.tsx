import type { CSSProperties, ReactNode } from "react";
import { Badge as MantineBadge } from "@mantine/core";
import { cx, type Tone, toneColors } from "../shared.ts";

export type BadgeProps = {
  children: ReactNode;
  tone?: Tone;
  className?: string;
  style?: CSSProperties;
};

export function Badge({
  children,
  tone = "info",
  className,
  style,
}: BadgeProps) {
  return (
    <MantineBadge
      component="span"
      color={toneColors[tone]}
      variant="light"
      size="md"
      radius="xl"
      className={cx("ds-badge", className)}
      data-tone={tone}
      style={style}
    >
      {children}
    </MantineBadge>
  );
}
