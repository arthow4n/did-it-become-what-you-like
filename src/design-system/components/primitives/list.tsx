import type { ReactNode } from "react";
import { List as MantineList } from "@mantine/core";
import { cx } from "../shared.ts";

export type ListProps = {
  children: ReactNode;
  label?: string;
  className?: string;
};

export function List({ children, label, className }: ListProps) {
  return (
    <MantineList
      className={cx("ds-list", className)}
      aria-label={label}
      listStyleType="none"
      withPadding={false}
    >
      {children}
    </MantineList>
  );
}
