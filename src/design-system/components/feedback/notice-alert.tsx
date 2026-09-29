import type { ReactNode } from "react";
import { Alert as MantineAlert } from "@mantine/core";
import { type Tone, toneColors } from "../shared.ts";
import { Stack, Text } from "../primitives.tsx";

export type BannerProps = {
  children: ReactNode;
  tone?: Tone;
  title?: ReactNode;
  action?: ReactNode;
  className?: string;
};

export function NoticeContent({ children }: { children: ReactNode }) {
  return typeof children === "string" || typeof children === "number"
    ? <Text>{children}</Text>
    : <Text as="div">{children}</Text>;
}

export function NoticeAlert(
  {
    children,
    tone,
    title,
    action,
    className,
    role,
    live,
  }: BannerProps & { role: "alert" | "status"; live?: "polite" },
) {
  return (
    <MantineAlert
      className={className}
      color={toneColors[tone ?? "info"]}
      variant="light"
      radius="md"
      title={title}
      data-tone={tone}
      role={role}
      aria-live={live}
    >
      <Stack gap={2}>
        <NoticeContent>{children}</NoticeContent>
        {action}
      </Stack>
    </MantineAlert>
  );
}
