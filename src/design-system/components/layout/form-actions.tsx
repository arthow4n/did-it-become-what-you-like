import type { ReactNode } from "react";
import { Box as MantineBox } from "@mantine/core";
import { cx } from "../shared.ts";

export type FormActionsProps = {
  children: ReactNode;
  className?: string;
};

export function FormActions(
  { children, className }: FormActionsProps,
) {
  return (
    <MantineBox className={cx("ds-form-actions", className)}>
      {children}
    </MantineBox>
  );
}
