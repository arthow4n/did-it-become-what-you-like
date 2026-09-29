import type { CSSProperties, ElementType, ReactNode } from "react";
import { Card as MantineCard } from "@mantine/core";
import { cx } from "../shared.ts";

export type CardProps = {
  children: ReactNode;
  className?: string;
  as?: ElementType;
  style?: CSSProperties;
};

export function Card({
  children,
  className,
  as: Tag = "article",
  style,
}: CardProps) {
  return (
    <MantineCard
      component={Tag as "div"}
      withBorder
      padding="ds-4"
      radius="md"
      shadow="none"
      className={cx("ds-card", className)}
      style={style}
    >
      {children}
    </MantineCard>
  );
}
