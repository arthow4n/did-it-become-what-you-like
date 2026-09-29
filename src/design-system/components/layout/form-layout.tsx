import type { ReactNode } from "react";
import { Box as MantineBox } from "@mantine/core";
import { cx } from "../shared.ts";
import { Stack } from "../primitives.tsx";

export type FormLayoutProps = {
  children: ReactNode;
  className?: string;
};

export function FormLayout(
  { children, className }: FormLayoutProps,
) {
  return (
    <MantineBox className={cx("ds-form-layout", className)}>
      <Stack gap={5}>{children}</Stack>
    </MantineBox>
  );
}
