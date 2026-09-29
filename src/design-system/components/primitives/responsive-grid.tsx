import { SimpleGrid as MantineSimpleGrid } from "@mantine/core";
import { cx, gapStyle, mantineSpacing } from "../shared.ts";
import type { StackProps } from "./stack.tsx";

export type ResponsiveGridProps = StackProps & { columns?: 1 | 2 | 3 };

export function ResponsiveGrid({
  children,
  gap = 4,
  className,
  as: Tag = "div",
  columns = 2,
  style,
  ref,
  role,
  "aria-label": ariaLabel,
  "aria-hidden": ariaHidden,
  "data-pane": dataPane,
}: ResponsiveGridProps) {
  return (
    <MantineSimpleGrid
      component={Tag as "div"}
      ref={ref}
      role={role}
      aria-label={ariaLabel}
      aria-hidden={ariaHidden}
      data-pane={dataPane}
      cols={columns}
      spacing={mantineSpacing(gap)}
      className={cx("ds-responsive-grid", className)}
      data-columns={columns}
      style={{ ...style, ...gapStyle(gap) }}
    >
      {children}
    </MantineSimpleGrid>
  );
}
