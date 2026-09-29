import type {
  ComponentProps,
  CSSProperties,
  ElementType,
  ReactNode,
  Ref,
} from "react";
import { Stack as MantineStack } from "@mantine/core";
import { cx, gapStyle, mantineSpacing, type Space } from "../shared.ts";

export type StackProps = {
  children: ReactNode;
  gap?: Space;
  className?: string;
  as?: ElementType;
  style?: CSSProperties;
  ref?: Ref<HTMLDivElement>;
  role?: ComponentProps<"div">["role"];
  "aria-label"?: string;
  "aria-hidden"?: boolean | "true" | "false";
  "data-pane"?: string;
};

export function Stack({
  children,
  gap = 4,
  className,
  as: Tag = "div",
  style,
  ref,
  role,
  "aria-label": ariaLabel,
  "aria-hidden": ariaHidden,
  "data-pane": dataPane,
}: StackProps) {
  return (
    <MantineStack
      component={Tag as "div"}
      ref={ref}
      role={role}
      aria-label={ariaLabel}
      aria-hidden={ariaHidden}
      data-pane={dataPane}
      align="stretch"
      gap={mantineSpacing(gap)}
      className={cx("ds-stack", className)}
      style={{ ...style, ...gapStyle(gap) }}
    >
      {children}
    </MantineStack>
  );
}
