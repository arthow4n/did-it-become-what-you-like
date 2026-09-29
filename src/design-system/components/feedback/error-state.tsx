import type { ReactNode } from "react";
import { Alert as MantineAlert } from "@mantine/core";
import { cx } from "../shared.ts";
import { Heading, Stack, Text } from "../primitives.tsx";

export type ErrorStateProps = {
  title: ReactNode;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
};

export function ErrorState(
  { title, children, action, className }: ErrorStateProps,
) {
  return (
    <MantineAlert
      className={cx("ds-error-state", className)}
      color="danger"
      variant="light"
      radius="md"
      data-tone="danger"
      role="alert"
    >
      <Stack gap={3}>
        <Heading size="sm">{title}</Heading>
        <Text>{children}</Text>
        {action}
      </Stack>
    </MantineAlert>
  );
}
