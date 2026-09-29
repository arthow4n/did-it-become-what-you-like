import { cloneElement, isValidElement, useState } from "react";
import type { KeyboardEvent, MouseEvent, ReactElement, ReactNode } from "react";

export function openableTrigger(
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

export function useOpenState(
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
