import type { ReactNode } from "react";
import { Drawer as MantineDrawer, Modal as MantineModal } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { cx } from "../shared.ts";
import { Stack } from "../primitives.tsx";
import { openableTrigger, useOpenState } from "./shared.ts";

export type AdaptiveDialogProps = {
  trigger: ReactNode;
  title: ReactNode;
  children: ReactNode | ((close: () => void) => ReactNode);
  closeLabel?: string;
  isDismissable?: boolean;
  isOpen?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
  className?: string;
};

export function AdaptiveDialog({
  trigger,
  title,
  children,
  closeLabel = "Close",
  isDismissable = true,
  isOpen,
  onOpenChange,
  className,
}: AdaptiveDialogProps) {
  const isWide = useMediaQuery("(min-width: 45em)", false);
  const [opened, setOpened] = useOpenState(isOpen, onOpenChange);
  const close = () => setOpened(false);
  const dialogChildren = typeof children === "function"
    ? children(close)
    : children;
  const content = <Stack gap={4}>{dialogChildren}</Stack>;
  const triggerNode = openableTrigger(trigger, () => setOpened(true));
  const commonProps = {
    opened,
    onClose: close,
    closeOnClickOutside: isDismissable,
    closeOnEscape: isDismissable,
    withOverlay: true,
    withCloseButton: true,
    closeButtonProps: { "aria-label": closeLabel },
    transitionProps: { duration: 0, exitDuration: 0 },
    zIndex: "var(--layer-overlay)",
    overlayProps: { className: "ds-overlay-backdrop" },
    "aria-hidden": !opened,
    "data-dialog-layout": "adaptive",
  } as const;
  return (
    <>
      {triggerNode}
      {isWide
        ? (
          <MantineModal
            {...commonProps}
            title={title}
            classNames={{ content: cx("ds-dialog", className) }}
          >
            {content}
          </MantineModal>
        )
        : (
          <MantineDrawer
            {...commonProps}
            position="bottom"
            size="auto"
            title={title}
            classNames={{ content: cx("ds-dialog", className) }}
          >
            {content}
          </MantineDrawer>
        )}
    </>
  );
}
