import type { CSSProperties, ReactNode } from "react";
import {
  Box as MantineBox,
  Container as MantineContainer,
  UnstyledButton as MantineUnstyledButton,
} from "@mantine/core";
import {
  ChevronRight,
  CircleAlert,
  CircleCheck,
  Plus,
  Sparkles,
} from "lucide-react";
import { cx } from "./shared.ts";
import {
  Heading,
  type HeadingProps,
  Icon,
  Stack,
  Text,
} from "./primitives.tsx";

export type AppFrameProps = {
  children: ReactNode;
  navigation?: ReactNode;
  className?: string;
};

export function AppFrame({ children, navigation, className }: AppFrameProps) {
  return (
    <MantineBox className={cx("ds-app-frame", className)}>
      {navigation
        ? (
          <MantineBox component="aside" className="ds-app-frame__navigation">
            {navigation}
          </MantineBox>
        )
        : null}
      <MantineBox component="main" className="ds-app-frame__main">
        {children}
      </MantineBox>
    </MantineBox>
  );
}

export type PageHeaderProps = {
  title: ReactNode;
  eyebrow?: ReactNode;
  description?: ReactNode;
  leading?: ReactNode;
  status?: ReactNode;
  actions?: ReactNode;
  as?: "header" | "div";
  headingLevel?: HeadingProps["level"];
};

export function PageHeader({
  title,
  eyebrow,
  description,
  leading,
  status,
  actions,
  headingLevel = 2,
  as: Tag = "header",
}: PageHeaderProps) {
  return (
    <MantineBox component={Tag} className="ds-page-header">
      <MantineBox component="div" className="ds-page-header__title">
        {leading}
        <Stack gap={1}>
          {eyebrow ? <Text size="label" tone="muted">{eyebrow}</Text> : null}
          <Heading level={headingLevel}>{title}</Heading>
          {description ? <Text tone="secondary">{description}</Text> : null}
        </Stack>
      </MantineBox>
      <MantineBox component="div" className="ds-page-header__actions">
        {status}
        {actions}
      </MantineBox>
    </MantineBox>
  );
}

export type ContentContainerProps = {
  children: ReactNode;
  size?: "content" | "form" | "readable" | "review";
  className?: string;
  style?: CSSProperties;
};

export function ContentContainer({
  children,
  size = "content",
  className,
  style,
}: ContentContainerProps) {
  const containerSize = {
    content: "var(--content-max)",
    form: "var(--form-max)",
    readable: "var(--readable-max)",
    review: "var(--review-max)",
  }[size];
  return (
    <MantineContainer
      component="div"
      size={containerSize}
      className={cx("ds-content-container", className)}
      data-size={size}
      style={style}
    >
      {children}
    </MantineContainer>
  );
}
export function StickyActionBar(
  { children, className }: { children: ReactNode; className?: string },
) {
  return (
    <MantineBox className={cx("ds-sticky-action-bar", className)}>
      {children}
    </MantineBox>
  );
}

export type NavigationItem = {
  id: string;
  label: string;
  icon?: ReactNode;
  selected?: boolean;
  action?: boolean;
  disabled?: boolean;
};

export function AppNavigation(
  { items, onSelect, label = "Application" }: {
    items: NavigationItem[];
    onSelect?: (id: string) => void;
    label?: string;
  },
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

export function FormLayout(
  { children, className }: { children: ReactNode; className?: string },
) {
  return (
    <MantineBox className={cx("ds-form-layout", className)}>
      <Stack gap={5}>{children}</Stack>
    </MantineBox>
  );
}

export function FormActions(
  { children, className }: { children: ReactNode; className?: string },
) {
  return (
    <MantineBox className={cx("ds-form-actions", className)}>
      {children}
    </MantineBox>
  );
}

export type AppNavigationIconSet = {
  expenses?: ReactNode;
  manual?: ReactNode;
  scan?: ReactNode;
  organize?: ReactNode;
  settings?: ReactNode;
};

export function DefaultNavigation(
  { selected = "expenses", onSelect, icons = {} }: {
    selected?: string;
    onSelect?: (id: string) => void;
    icons?: AppNavigationIconSet;
  },
) {
  return (
    <AppNavigation
      items={[
        {
          id: "expenses",
          label: "Expenses",
          icon: icons.expenses ?? <CircleCheck />,
          selected: selected === "expenses",
        },
        {
          id: "manual",
          label: "Manual",
          icon: icons.manual ?? <Plus />,
          selected: selected === "manual",
        },
        {
          id: "scan",
          label: "Scan",
          icon: icons.scan ?? <Sparkles />,
          selected: selected === "scan",
        },
        {
          id: "organize",
          label: "Organize",
          icon: icons.organize ?? <ChevronRight />,
          selected: selected === "organize",
        },
        {
          id: "settings",
          label: "Settings",
          icon: icons.settings ?? <CircleAlert />,
          selected: selected === "settings",
        },
      ]}
      onSelect={onSelect}
    />
  );
}
