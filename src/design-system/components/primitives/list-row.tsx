import type { ReactNode } from "react";
import { Box as MantineBox } from "@mantine/core";
import { cx } from "../shared.ts";

export type ListRowProps = {
  children: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
  className?: string;
};

export function ListRow(
  { children, leading, trailing, className }: ListRowProps,
) {
  return (
    <MantineBox component="li" className={cx("ds-list-row", className)}>
      {leading}
      <MantineBox component="div" className="ds-list-row__main">
        {children}
      </MantineBox>
      {trailing}
    </MantineBox>
  );
}
