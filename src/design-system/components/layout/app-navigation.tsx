import type { ReactNode } from "react";
import {
  Box as MantineBox,
  UnstyledButton as MantineUnstyledButton,
} from "@mantine/core";
import { Icon } from "../primitives.tsx";

export type NavigationItem = {
  id: string;
  label: string;
  icon?: ReactNode;
  selected?: boolean;
  action?: boolean;
  disabled?: boolean;
};

export type AppNavigationProps = {
  items: NavigationItem[];
  onSelect?: (id: string) => void;
  label?: string;
};

export function AppNavigation(
  { items, onSelect, label = "Application" }: AppNavigationProps,
) {
  return (
    <MantineBox component="nav" className="ds-navigation" aria-label={label}>
      {items.map((item) => (
        <MantineUnstyledButton
          key={item.id}
          type="button"
          className="ds-navigation__item"
          disabled={item.disabled}
          data-selected={item.selected ? "true" : undefined}
          data-action={item.action ? "true" : undefined}
          aria-current={item.selected ? "page" : undefined}
          aria-disabled={item.disabled ? "true" : undefined}
          onClick={() => onSelect?.(item.id)}
        >
          {item.icon ? <Icon>{item.icon}</Icon> : null}
          <span>{item.label}</span>
        </MantineUnstyledButton>
      ))}
    </MantineBox>
  );
}
