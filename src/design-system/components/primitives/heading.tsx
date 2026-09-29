import type { CSSProperties, ReactNode } from "react";
import { Title as MantineTitle } from "@mantine/core";
import { cx } from "../shared.ts";

export type HeadingProps = {
  children: ReactNode;
  size?: "sm" | "md" | "lg";
  level?: 1 | 2 | 3 | 4 | 5 | 6;
  className?: string;
  style?: CSSProperties;
};

export function Heading({
  children,
  size = "md",
  level = 2,
  className,
  style,
}: HeadingProps) {
  const mantineSize = {
    sm: "md",
    md: "lg",
    lg: "xl",
  }[size];
  return (
    <MantineTitle
      component={`h${level}`}
      order={level}
      size={mantineSize}
      className={cx("ds-heading", className)}
      data-size={size}
      style={style}
    >
      {children}
    </MantineTitle>
  );
}
