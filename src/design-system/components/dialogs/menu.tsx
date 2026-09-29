import type { ReactNode } from "react";
import { Menu as MantineMenu } from "@mantine/core";

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
