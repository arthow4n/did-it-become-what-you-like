import type { ReactNode } from "react";
import { Paper as MantinePaper } from "@mantine/core";
import { type Tone } from "../shared.ts";
import { Inline, Stack, Text } from "../primitives.tsx";

export type StatusPanelProps = {
  title: ReactNode;
  detail?: ReactNode;
  tone?: Tone;
  action?: ReactNode;
};

export function StatusPanel(
  { title, detail, tone = "info", action }: StatusPanelProps,
) {
  return (
    <MantinePaper
      className="ds-status-panel"
      data-tone={tone}
      withBorder={false}
      shadow="none"
    >
      <Inline justify="space-between">
        <Stack gap={1}>
          <strong>{title}</strong>
          {detail ? <Text tone="secondary">{detail}</Text> : null}
        </Stack>
        {action}
      </Inline>
    </MantinePaper>
  );
}
