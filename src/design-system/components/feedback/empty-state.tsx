import type { ReactNode } from "react";
import { Paper as MantinePaper } from "@mantine/core";
import { cx } from "../shared.ts";
import { Heading, Stack, Text } from "../primitives.tsx";

export type EmptyStateProps = {
  title: ReactNode;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
};

export function EmptyState(
  { title, children, action, className }: EmptyStateProps,
) {
  return (
    <MantinePaper
      component="section"
      className={cx("ds-empty-state", className)}
      withBorder={false}
      shadow="none"
    >
      <Stack gap={3}>
        <Heading size="sm">{title}</Heading>
        <Text>{children}</Text>
        {action}
      </Stack>
    </MantinePaper>
  );
}
