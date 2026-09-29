import type { ReactNode } from "react";
import { Box as MantineBox, List as MantineList } from "@mantine/core";
import { Badge, Stack } from "../primitives.tsx";
import { Progress } from "./progress.tsx";

export type WorkflowProgressProps = {
  steps: string[];
  current: number;
  status?: ReactNode;
  action?: ReactNode;
};

export function WorkflowProgress(
  { steps, current, status, action }: WorkflowProgressProps,
) {
  return (
    <Stack gap={4}>
      <Progress
        label={status ? String(status) : "Workflow progress"}
        value={steps.length ? ((current + 1) / steps.length) * 100 : 0}
      />
      <MantineList
        type="ordered"
        className="ds-list"
        aria-label="Workflow steps"
        listStyleType="none"
        withPadding={false}
      >
        {steps.map((step, index) => (
          <MantineBox
            component="li"
            key={step}
            className="ds-list-row"
            data-current={index === current ? "true" : undefined}
          >
            <span>{index + 1}. {step}</span>
            {index < current
              ? <Badge tone="positive">Complete</Badge>
              : index === current
              ? <Badge tone="info">Current</Badge>
              : <Badge>Next</Badge>}
          </MantineBox>
        ))}
      </MantineList>
      {action}
    </Stack>
  );
}
