import { useEffect, useId, useRef } from "react";
import { notifications } from "@mantine/notifications";
import { cx, toneColors } from "../shared.ts";
import type { BannerProps } from "./notice-alert.tsx";

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
