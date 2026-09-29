import type { ReactNode } from "react";
import { Box as MantineBox } from "@mantine/core";
import { Heading, type HeadingProps, Stack, Text } from "../primitives.tsx";

export type PageHeaderProps = {
  title: ReactNode;
  eyebrow?: ReactNode;
  description?: ReactNode;
  leading?: ReactNode;
  status?: ReactNode;
  actions?: ReactNode;
  as?: "header" | "div";
  headingLevel?: HeadingProps["level"];
};

export function PageHeader({
  title,
  eyebrow,
  description,
  leading,
  status,
  actions,
  headingLevel = 2,
  as: Tag = "header",
}: PageHeaderProps) {
  return (
    <MantineBox component={Tag} className="ds-page-header">
      <MantineBox component="div" className="ds-page-header__title">
        {leading}
        <Stack gap={1}>
          {eyebrow ? <Text size="label" tone="muted">{eyebrow}</Text> : null}
          <Heading level={headingLevel}>{title}</Heading>
          {description ? <Text tone="secondary">{description}</Text> : null}
        </Stack>
      </MantineBox>
      <MantineBox component="div" className="ds-page-header__actions">
        {status}
        {actions}
      </MantineBox>
    </MantineBox>
  );
}
