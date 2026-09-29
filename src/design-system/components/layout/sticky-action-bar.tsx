import type { ReactNode } from "react";
import { Box as MantineBox } from "@mantine/core";
import { cx } from "../shared.ts";

export type StickyActionBarProps = {
  children: ReactNode;
  className?: string;
};

export function StickyActionBar(
  { children, className }: StickyActionBarProps,
) {
  return (
    <MantineBox className={cx("ds-sticky-action-bar", className)}>
      {children}
    </MantineBox>
  );
}
