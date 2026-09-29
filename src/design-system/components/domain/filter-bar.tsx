import type { ReactNode } from "react";
import { Box as MantineBox } from "@mantine/core";
import { cx } from "../shared.ts";

export type FilterBarProps = {
  children: ReactNode;
  className?: string;
};

export function FilterBar(
  { children, className }: FilterBarProps,
) {
  return (
    <MantineBox
      className={cx("ds-filter-bar", className)}
      role="group"
      aria-label="Filters"
    >
      {children}
    </MantineBox>
  );
}
