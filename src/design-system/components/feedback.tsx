import { useEffect, useId, useRef } from "react";
import type { CSSProperties, ReactNode } from "react";
import {
  Alert as MantineAlert,
  Box as MantineBox,
  List as MantineList,
  Paper as MantinePaper,
  Progress as MantineProgress,
  Skeleton as MantineSkeleton,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { cx, type Tone, toneColors } from "./shared.ts";
import { Badge, Heading, Inline, Stack, Text } from "./primitives.tsx";

export type BannerProps = {
  children: ReactNode;
  tone?: Tone;
  title?: ReactNode;
  action?: ReactNode;
  className?: string;
};

function NoticeContent({ children }: { children: ReactNode }) {
  return typeof children === "string" || typeof children === "number"
    ? <Text>{children}</Text>
    : <Text as="div">{children}</Text>;
}

function NoticeAlert(
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

export function Banner(
  { children, tone = "info", title, action, className }: BannerProps,
) {
  return (
    <NoticeAlert
      className={cx("ds-banner", className)}
      tone={tone}
      title={title}
      action={action}
      role="status"
    >
      {children}
    </NoticeAlert>
  );
}

export function InlineNotice(
  { children, tone = "info", title, action, className }: BannerProps,
) {
  return (
    <NoticeAlert
      className={cx("ds-inline-notice", className)}
      role={tone === "danger" ? "alert" : "status"}
      tone={tone}
      title={title}
      action={action}
    >
      {children}
    </NoticeAlert>
  );
}

export type ToastProps = Omit<BannerProps, "title" | "action"> & {
  onDismiss?: () => void;
};

export function Toast(
  { children, tone = "positive", onDismiss, className }: ToastProps,
) {
  const id = `ds-toast-${useId().replaceAll(":", "")}`;
  const dismissRef = useRef(onDismiss);
  const mountedRef = useRef(false);
  dismissRef.current = onDismiss;

  useEffect(() => {
    const data = {
      id,
      message: children,
      color: toneColors[tone],
      role: "status" as const,
      "aria-live": "polite" as const,
      allowClose: Boolean(onDismiss),
      withCloseButton: Boolean(onDismiss),
      closeButtonProps: { "aria-label": "Dismiss notification" },
      className: cx("ds-toast", "ds-status-message", className),
      classNames: {
        body: "ds-toast__content",
        closeButton: "ds-toast__dismiss",
      },
      "data-tone": tone,
      onClose: () => {
        if (mountedRef.current) dismissRef.current?.();
      },
    };
    if (mountedRef.current) notifications.update(data);
    else {
      notifications.show(data);
      mountedRef.current = true;
    }
  }, [children, className, id, onDismiss, tone]);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      notifications.hide(id);
    };
  }, [id]);

  return null;
}

export function StatusMessage(
  { children, tone = "info", className }: Omit<BannerProps, "title" | "action">,
) {
  return (
    <NoticeAlert
      className={cx("ds-status-message", className)}
      tone={tone}
      role="status"
      live="polite"
    >
      {children}
    </NoticeAlert>
  );
}

export type ProgressProps = {
  label: string;
  value?: number;
  indeterminate?: boolean;
  minValue?: number;
  maxValue?: number;
  className?: string;
};

export function Progress(
  {
    label,
    value,
    indeterminate = false,
    minValue = 0,
    maxValue = 100,
    className,
  }: ProgressProps,
) {
  const currentValue = value ?? minValue;
  const percentage = maxValue > minValue
    ? Math.min(
      100,
      Math.max(0, ((currentValue - minValue) / (maxValue - minValue)) * 100),
    )
    : 0;
  return (
    <div
      aria-label={label}
      className={cx("ds-progress", className)}
      data-indeterminate={indeterminate ? "true" : "false"}
      role="progressbar"
      aria-valuemin={minValue}
      aria-valuemax={maxValue}
      {...(indeterminate ? {} : {
        "aria-valuenow": currentValue,
        "aria-valuetext": `${Math.round(percentage)}%`,
      })}
    >
      <div
        className="ds-inline"
        style={{ justifyContent: "space-between" }}
      >
        <span>{label}</span>
        <span>
          {indeterminate ? "In progress" : `${Math.round(percentage)}%`}
        </span>
      </div>
      <MantineProgress.Root
        className="ds-progress__track"
        aria-hidden="true"
        transitionDuration={0}
      >
        <MantineProgress.Section
          value={indeterminate ? 35 : percentage}
          color="accent"
          className="ds-progress__bar"
          withAria={false}
          animated={false}
        />
      </MantineProgress.Root>
    </div>
  );
}

export function Skeleton(
  { className, style }: { className?: string; style?: CSSProperties },
) {
  return (
    <MantineSkeleton
      className={cx("ds-skeleton", className)}
      aria-hidden="true"
      animate={false}
      style={style}
    />
  );
}

export function EmptyState(
  { title, children, action, className }: {
    title: ReactNode;
    children: ReactNode;
    action?: ReactNode;
    className?: string;
  },
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

export function ErrorState(
  { title, children, action, className }: {
    title: ReactNode;
    children: ReactNode;
    action?: ReactNode;
    className?: string;
  },
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

export type GlobalStatusProps = {
  status:
    | "offline"
    | "reconnecting"
    | "syncing"
    | "conflict"
    | "error"
    | "synced";
  detail?: ReactNode;
  action?: ReactNode;
};

const globalStatusCopy: Record<
  GlobalStatusProps["status"],
  { label: string; tone: Tone }
> = {
  offline: { label: "Offline", tone: "warning" },
  reconnecting: { label: "Reconnecting", tone: "warning" },
  syncing: { label: "Syncing", tone: "info" },
  conflict: { label: "Conflicts need review", tone: "warning" },
  error: { label: "Sync error", tone: "danger" },
  synced: { label: "Synced", tone: "positive" },
};

export function GlobalStatus({ status, detail, action }: GlobalStatusProps) {
  const copy = globalStatusCopy[status];
  return (
    <StatusPanel
      title={copy.label}
      detail={detail}
      tone={copy.tone}
      action={action}
    />
  );
}

export function ErrorSummary(
  { title = "Check the highlighted fields", errors, className }: {
    title?: ReactNode;
    errors: Array<{ id?: string; message: ReactNode }>;
    className?: string;
  },
) {
  return (
    <MantineBox
      className={cx("ds-error-summary", className)}
      role="alert"
      tabIndex={-1}
    >
      <strong>{title}</strong>
      <MantineList className="ds-error-summary__list" listStyleType="disc">
        {errors.map((error, index) => (
          <MantineList.Item key={error.id ?? index}>
            {error.message}
          </MantineList.Item>
        ))}
      </MantineList>
    </MantineBox>
  );
}

export function DraftStatus(
  { state, detail, action }: {
    state: "clean" | "dirty" | "saving" | "saved" | "failed";
    detail?: ReactNode;
    action?: ReactNode;
  },
) {
  const copy: Record<typeof state, { label: string; tone: Tone }> = {
    clean: { label: "No unsaved changes", tone: "neutral" },
    dirty: { label: "Unsaved changes", tone: "warning" },
    saving: { label: "Saving locally", tone: "info" },
    saved: { label: "Saved", tone: "positive" },
    failed: { label: "Save failed", tone: "danger" },
  };
  return (
    <StatusPanel
      title={copy[state].label}
      detail={detail}
      tone={copy[state].tone}
      action={action}
    />
  );
}

export function StatusPanel(
  { title, detail, tone = "info", action }: {
    title: ReactNode;
    detail?: ReactNode;
    tone?: Tone;
    action?: ReactNode;
  },
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

export function WorkflowProgress(
  { steps, current, status, action }: {
    steps: string[];
    current: number;
    status?: ReactNode;
    action?: ReactNode;
  },
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
