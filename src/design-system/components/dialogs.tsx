import { cloneElement, isValidElement, useEffect, useState } from "react";
import type { KeyboardEvent, MouseEvent, ReactElement, ReactNode } from "react";
import {
  Accordion as MantineAccordion,
  Drawer as MantineDrawer,
  Menu as MantineMenu,
  Modal as MantineModal,
  Popover as MantinePopover,
  Tooltip as MantineTooltip,
} from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { ChevronRight } from "lucide-react";
import { type ButtonVariant, cx } from "./shared.ts";
import { Button, Icon, Inline, Stack, StatusDot, Text } from "./primitives.tsx";
import { FormActions } from "./layout.tsx";
import { SelectField, type SelectOption, TextField } from "./fields.tsx";

function openableTrigger(
  trigger: ReactNode,
  onOpen: () => void,
): ReactNode {
  if (!isValidElement(trigger)) return trigger;
  const triggerProps = trigger.props as {
    onClick?: (event: MouseEvent<HTMLElement>) => void;
    onKeyDown?: (event: KeyboardEvent<HTMLElement>) => void;
  };
  type TriggerElementProps = {
    onClick?: (event: MouseEvent<HTMLElement>) => void;
    onKeyDown?: (event: KeyboardEvent<HTMLElement>) => void;
    [key: string]: unknown;
  };
  return cloneElement(trigger as ReactElement<TriggerElementProps>, {
    onClick: (event: MouseEvent<HTMLElement>) => {
      triggerProps.onClick?.(event);
      if (!event.defaultPrevented) onOpen();
    },
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
      triggerProps.onKeyDown?.(event);
      if (
        !event.defaultPrevented &&
        (event.key === "Enter" || event.key === " ")
      ) {
        onOpen();
      }
    },
  });
}

function useOpenState(
  value: boolean | undefined,
  onChange: ((open: boolean) => void) | undefined,
): [boolean, (open: boolean) => void] {
  const [uncontrolled, setUncontrolled] = useState(value ?? false);
  const open = value ?? uncontrolled;
  const setOpen = (next: boolean) => {
    if (value === undefined) setUncontrolled(next);
    onChange?.(next);
  };
  return [open, setOpen];
}

export type DisclosureProps = {
  title: ReactNode;
  children: ReactNode;
  className?: string;
  isExpanded?: boolean;
  defaultExpanded?: boolean;
  onExpandedChange?: (isExpanded: boolean) => void;
};

export function Disclosure(
  {
    title,
    children,
    className,
    isExpanded,
    defaultExpanded,
    onExpandedChange,
  }: DisclosureProps,
) {
  return (
    <MantineAccordion
      className={cx("ds-disclosure", className)}
      value={isExpanded === undefined
        ? undefined
        : isExpanded
        ? "disclosure"
        : null}
      defaultValue={defaultExpanded ? "disclosure" : undefined}
      onChange={(value) => onExpandedChange?.(value === "disclosure")}
      chevron={
        <Icon>
          <ChevronRight />
        </Icon>
      }
      chevronPosition="right"
      disableChevronRotation
      transitionDuration={0}
      order={3}
      classNames={{
        control: "ds-disclosure__trigger",
        panel: "ds-disclosure__panel",
      }}
    >
      <MantineAccordion.Item value="disclosure">
        <MantineAccordion.Control>{title}</MantineAccordion.Control>
        <MantineAccordion.Panel>{children}</MantineAccordion.Panel>
      </MantineAccordion.Item>
    </MantineAccordion>
  );
}

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

export type ConfirmDialogProps = Omit<AdaptiveDialogProps, "children"> & {
  description: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  confirmVariant?: ButtonVariant;
  cancelLabel?: string;
  onCancel?: () => void;
};

export function ConfirmDialog({
  description,
  confirmLabel,
  onConfirm,
  confirmVariant = "primary",
  cancelLabel = "Cancel",
  onCancel,
  ...props
}: ConfirmDialogProps) {
  return (
    <AdaptiveDialog {...props}>
      {(close) => (
        <Stack gap={5}>
          <Text>{description}</Text>
          <FormActions>
            <Button
              variant="secondary"
              onPress={() => {
                onCancel?.();
                close();
              }}
            >
              {cancelLabel}
            </Button>
            <Button
              variant={confirmVariant}
              onPress={() => {
                onConfirm();
                close();
              }}
            >
              {confirmLabel}
            </Button>
          </FormActions>
        </Stack>
      )}
    </AdaptiveDialog>
  );
}

export type DeleteAndReassignProps = {
  trigger: ReactNode;
  title: ReactNode;
  description: ReactNode;
  replacementOptions: SelectOption[];
  defaultReplacementId: string;
  affectedCount: number;
  onConfirm: (replacementCategoryId: string) => void;
  confirmLabel?: string;
  cancelLabel?: string;
  onCancel?: () => void;
};

/**
 * The shared destructive category workflow keeps replacement selection and
 * confirmation in one accessible adaptive dialog. The actor still owns the
 * resulting atomic command; this component only binds the controlled choice.
 */
export function DeleteAndReassign({
  trigger,
  title,
  description,
  replacementOptions,
  defaultReplacementId,
  affectedCount,
  onConfirm,
  confirmLabel = "Delete and reassign",
  cancelLabel = "Cancel",
  onCancel,
}: DeleteAndReassignProps) {
  const [replacementId, setReplacementId] = useState(defaultReplacementId);
  return (
    <AdaptiveDialog
      trigger={trigger}
      title={title}
      onOpenChange={(open) => {
        if (open) setReplacementId(defaultReplacementId);
      }}
    >
      {(close) => (
        <Stack gap={5}>
          <Text>{description}</Text>
          <Text tone="secondary">
            {affectedCount} {affectedCount === 1 ? "expense" : "expenses"}{" "}
            reference this category across every project.
          </Text>
          <SelectField
            label="Replacement category"
            options={replacementOptions}
            value={replacementId}
            onValueChange={setReplacementId}
          />
          <FormActions>
            <Button
              variant="secondary"
              onPress={() => {
                onCancel?.();
                close();
              }}
            >
              {cancelLabel}
            </Button>
            <Button
              variant="danger"
              isDisabled={!replacementId}
              onPress={() => {
                onConfirm(replacementId);
                close();
              }}
            >
              {confirmLabel}
            </Button>
          </FormActions>
        </Stack>
      )}
    </AdaptiveDialog>
  );
}

export type DangerDialogProps = ConfirmDialogProps & {
  phrase?: string;
  cancelLabel?: string;
  onCancel?: () => void;
};

export function DangerDialog(
  {
    phrase,
    description,
    onConfirm,
    cancelLabel = "Cancel",
    onCancel,
    onOpenChange,
    ...props
  }: DangerDialogProps,
) {
  const [typed, setTyped] = useState("");
  const requiresPhrase = Boolean(phrase);
  useEffect(() => {
    if (props.isOpen) setTyped("");
  }, [props.isOpen]);
  return (
    <AdaptiveDialog
      {...props}
      onOpenChange={(open) => {
        if (open) setTyped("");
        onOpenChange?.(open);
      }}
    >
      {(close) => (
        <Stack gap={5}>
          <Inline>
            <StatusDot tone="danger">Destructive action</StatusDot>
          </Inline>
          <Text>{description}</Text>
          {phrase
            ? (
              <TextField
                label={`Type ${phrase} to confirm`}
                value={typed}
                onChange={setTyped}
              />
            )
            : null}
          <FormActions>
            <Button
              variant="secondary"
              onPress={() => {
                onCancel?.();
                close();
              }}
            >
              {cancelLabel}
            </Button>
            <Button
              variant="danger"
              isDisabled={requiresPhrase && typed !== phrase}
              onPress={() => {
                onConfirm();
                close();
              }}
            >
              {props.confirmLabel}
            </Button>
          </FormActions>
        </Stack>
      )}
    </AdaptiveDialog>
  );
}

export type PopoverProps = {
  trigger: ReactNode;
  children: ReactNode;
  label?: string;
  className?: string;
};

export function Popover({ trigger, children, label, className }: PopoverProps) {
  return (
    <MantinePopover
      returnFocus
      trapFocus
      transitionProps={{ duration: 0, exitDuration: 0 }}
      zIndex="var(--layer-overlay)"
    >
      <MantinePopover.Target>{trigger}</MantinePopover.Target>
      <MantinePopover.Dropdown
        aria-label={label}
        className={cx("ds-popover", className)}
      >
        {children}
      </MantinePopover.Dropdown>
    </MantinePopover>
  );
}

export type MenuItem = { id: string; label: string; disabled?: boolean };

export function Menu({
  trigger,
  items,
  label = "Actions",
  onAction,
}: {
  trigger: ReactNode;
  items: MenuItem[];
  label?: string;
  onAction?: (id: string) => void;
}) {
  return (
    <MantineMenu
      trapFocus={false}
      returnFocus
      withinPortal={false}
      withInitialFocusPlaceholder={false}
      transitionProps={{ duration: 0, exitDuration: 0 }}
      zIndex="var(--layer-overlay)"
    >
      <MantineMenu.Target>{trigger}</MantineMenu.Target>
      <MantineMenu.Dropdown className="ds-menu" aria-label={label}>
        {items.map((item) => (
          <MantineMenu.Item
            key={item.id}
            disabled={item.disabled}
            className="ds-menu-item"
            onClick={() => onAction?.(item.id)}
          >
            {item.label}
          </MantineMenu.Item>
        ))}
      </MantineMenu.Dropdown>
    </MantineMenu>
  );
}

export function Tooltip(
  { trigger, children, label }: {
    trigger: ReactNode;
    children: ReactNode;
    label?: string;
  },
) {
  return (
    <MantineTooltip
      label={children}
      aria-label={label}
      classNames={{ tooltip: "ds-popover" }}
      transitionProps={{ duration: 0, exitDuration: 0 }}
      events={{ hover: true, focus: true, touch: false }}
    >
      {trigger}
    </MantineTooltip>
  );
}
