import type { CSSProperties, ElementType, ReactNode } from "react";
import { Text as MantineText } from "@mantine/core";
import { cx } from "../shared.ts";

export type TextProps = {
  children: ReactNode;
  tone?: "primary" | "secondary" | "muted";
  size?: "body" | "caption" | "label";
  as?: ElementType;
  className?: string;
  style?: CSSProperties;
};

export function Text({
  children,
  tone = "primary",
  size = "body",
  as: Tag = "p",
  className,
  style,
}: TextProps) {
  const mantineSize = {
    body: "md",
    caption: "xs",
    label: "sm",
  }[size];
  return (
    <MantineText
      component={Tag as "div"}
      size={mantineSize}
      className={cx("ds-text", className)}
      data-tone={tone}
      data-size={size}
      style={style}
    >
      {children}
    </MantineText>
  );
}
