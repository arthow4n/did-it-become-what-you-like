import type { CSSProperties, ReactNode } from "react";
import { Container as MantineContainer } from "@mantine/core";
import { cx } from "../shared.ts";

export type ContentContainerProps = {
  children: ReactNode;
  size?: "content" | "form" | "readable" | "review";
  className?: string;
  style?: CSSProperties;
};

export function ContentContainer({
  children,
  size = "content",
  className,
  style,
}: ContentContainerProps) {
  const containerSize = {
    content: "var(--content-max)",
    form: "var(--form-max)",
    readable: "var(--readable-max)",
    review: "var(--review-max)",
  }[size];
  return (
    <MantineContainer
      component="div"
      size={containerSize}
      className={cx("ds-content-container", className)}
      data-size={size}
      style={style}
    >
      {children}
    </MantineContainer>
  );
}
