import type { CSSProperties } from "react";
import { Group as MantineGroup } from "@mantine/core";
import { cx, gapStyle, mantineSpacing } from "../shared.ts";
import type { StackProps } from "./stack.tsx";

export type InlineProps = StackProps & {
  justify?: CSSProperties["justifyContent"];
};

export function Inline({
  children,
  gap = 2,
  className,
  as: Tag = "div",
  justify,
  style,
  ref,
  role,
  "aria-label": ariaLabel,
  "aria-hidden": ariaHidden,
  "data-pane": dataPane,
}: InlineProps) {
  return (
    <MantineGroup
      component={Tag as "div"}
      ref={ref}
      role={role}
      aria-label={ariaLabel}
      aria-hidden={ariaHidden}
      data-pane={dataPane}
      gap={mantineSpacing(gap)}
      justify={justify}
      align="center"
      wrap="wrap"
      preventGrowOverflow={false}
      className={cx("ds-inline", className)}
      style={{ ...style, ...gapStyle(gap) }}
    >
      {children}
    </MantineGroup>
  );
}
