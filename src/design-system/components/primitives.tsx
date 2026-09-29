import { forwardRef } from "react";
import type {
  ComponentProps,
  CSSProperties,
  ElementType,
  MouseEvent,
  ReactNode,
  Ref,
} from "react";
import {
  ActionIcon as MantineActionIcon,
  Badge as MantineBadge,
  Box as MantineBox,
  Button as MantineButton,
  Card as MantineCard,
  Divider as MantineDivider,
  Group as MantineGroup,
  List as MantineList,
  Paper as MantinePaper,
  Pill as MantinePill,
  SimpleGrid as MantineSimpleGrid,
  Stack as MantineStack,
  Text as MantineText,
  Title as MantineTitle,
} from "@mantine/core";
import { X } from "lucide-react";
import {
  type ButtonVariant,
  cx,
  gapStyle,
  mantineSpacing,
  type Space,
  type Tone,
} from "./shared.ts";

export type StackProps = {
  children: ReactNode;
  gap?: Space;
  className?: string;
  as?: ElementType;
  style?: CSSProperties;
  ref?: Ref<HTMLDivElement>;
  role?: ComponentProps<"div">["role"];
  "aria-label"?: string;
  "aria-hidden"?: boolean | "true" | "false";
  "data-pane"?: string;
};

export function Stack({
  children,
  gap = 4,
  className,
  as: Tag = "div",
  style,
  ref,
  role,
  "aria-label": ariaLabel,
  "aria-hidden": ariaHidden,
  "data-pane": dataPane,
}: StackProps) {
  return (
    <MantineStack
      component={Tag as "div"}
      ref={ref}
      role={role}
      aria-label={ariaLabel}
      aria-hidden={ariaHidden}
      data-pane={dataPane}
      align="stretch"
      gap={mantineSpacing(gap)}
      className={cx("ds-stack", className)}
      style={{ ...style, ...gapStyle(gap) }}
    >
      {children}
    </MantineStack>
  );
}

export type InlineProps = StackProps & {
  justify?: CSSProperties["justifyContent"];
};

export function Inline({
  children,
  gap = 2,
  className,
  as: Tag = "div",
  justify,
  style,
  ref,
  role,
  "aria-label": ariaLabel,
  "aria-hidden": ariaHidden,
  "data-pane": dataPane,
}: InlineProps) {
  return (
    <MantineGroup
      component={Tag as "div"}
      ref={ref}
      role={role}
      aria-label={ariaLabel}
      aria-hidden={ariaHidden}
      data-pane={dataPane}
      gap={mantineSpacing(gap)}
      justify={justify}
      align="center"
      wrap="wrap"
      preventGrowOverflow={false}
      className={cx("ds-inline", className)}
      style={{ ...style, ...gapStyle(gap) }}
    >
      {children}
    </MantineGroup>
  );
}

export type ResponsiveGridProps = StackProps & { columns?: 1 | 2 | 3 };

export function ResponsiveGrid({
  children,
  gap = 4,
  className,
  as: Tag = "div",
  columns = 2,
  style,
  ref,
  role,
  "aria-label": ariaLabel,
  "aria-hidden": ariaHidden,
  "data-pane": dataPane,
}: ResponsiveGridProps) {
  return (
    <MantineSimpleGrid
      component={Tag as "div"}
      ref={ref}
      role={role}
      aria-label={ariaLabel}
      aria-hidden={ariaHidden}
      data-pane={dataPane}
      cols={columns}
      spacing={mantineSpacing(gap)}
      className={cx("ds-responsive-grid", className)}
      data-columns={columns}
      style={{ ...style, ...gapStyle(gap) }}
    >
      {children}
    </MantineSimpleGrid>
  );
}

export type TextProps = {
  children: ReactNode;
  tone?: "primary" | "secondary" | "muted";
  size?: "body" | "caption" | "label";
  as?: ElementType;
  className?: string;
  style?: CSSProperties;
};

export function Text({
  children,
  tone = "primary",
  size = "body",
  as: Tag = "p",
  className,
  style,
}: TextProps) {
  const mantineSize = {
    body: "md",
    caption: "xs",
    label: "sm",
  }[size];
  return (
    <MantineText
      component={Tag as "div"}
      size={mantineSize}
      className={cx("ds-text", className)}
      data-tone={tone}
      data-size={size}
      style={style}
    >
      {children}
    </MantineText>
  );
}

export type HeadingProps = {
  children: ReactNode;
  size?: "sm" | "md" | "lg";
  level?: 1 | 2 | 3 | 4 | 5 | 6;
  className?: string;
  style?: CSSProperties;
};

export function Heading({
  children,
  size = "md",
  level = 2,
  className,
  style,
}: HeadingProps) {
  const mantineSize = {
    sm: "md",
    md: "lg",
    lg: "xl",
  }[size];
  return (
    <MantineTitle
      component={`h${level}`}
      order={level}
      size={mantineSize}
      className={cx("ds-heading", className)}
      data-size={size}
      style={style}
    >
      {children}
    </MantineTitle>
  );
}

export type MoneyTextProps = {
  amount: string | number;
  currency: string;
  tone?: "neutral" | "positive" | "negative";
  className?: string;
};

export function formatMoney(amount: string | number, currency: string): string {
  const raw = String(amount).trim();
  const sign = raw.startsWith("-") ? "-" : raw.startsWith("+") ? "+" : "";
  const unsigned = raw.replace(/^[+-]/, "");
  const [integer = "0", fraction] = unsigned.split(".");
  const grouped = integer.replace(/^0+(?=\d)/, "").replace(
    /\B(?=(\d{3})+(?!\d))/g,
    ",",
  );
  const formattedFraction = fraction !== undefined
    ? (fraction.length === 1 ? `${fraction}0` : fraction)
    : "";
  return `${currency} ${sign}${grouped || "0"}${
    formattedFraction ? `.${formattedFraction}` : ""
  }`;
}

export function MoneyText(
  { amount, currency, tone, className }: MoneyTextProps,
) {
  const stringAmount = String(amount);
  const normalizedAmount = stringAmount.trim();
  const resolvedTone = tone ??
    (normalizedAmount.startsWith("+") ||
        (!normalizedAmount.startsWith("-") && normalizedAmount !== "0")
      ? "positive"
      : normalizedAmount.startsWith("-")
      ? "negative"
      : "neutral");
  const displayAmount = resolvedTone === "positive" &&
      !normalizedAmount.startsWith("+") &&
      !normalizedAmount.startsWith("-") &&
      /[1-9]/.test(normalizedAmount)
    ? `+${normalizedAmount}`
    : normalizedAmount;
  return (
    <span className={cx("ds-money", className)} data-tone={resolvedTone}>
      {formatMoney(displayAmount, currency)}
    </span>
  );
}

export type DateTextProps = {
  value: string;
  className?: string;
};

export function DateText({ value, className }: DateTextProps) {
  return (
    <time className={cx("ds-text", className)} dateTime={value}>{value}</time>
  );
}

export type IconProps = {
  children: ReactNode;
  label?: string;
  size?: number;
  className?: string;
};

export function Icon({ children, label, size = 20, className }: IconProps) {
  return (
    <span
      className={cx("ds-icon", className)}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      style={{ width: size, height: size, display: "inline-flex" }}
    >
      {children}
    </span>
  );
}

export type ButtonProps =
  & Omit<ComponentProps<"button">, "children" | "className" | "onClick">
  & {
    children?: ReactNode;
    variant?: ButtonVariant;
    pending?: boolean;
    isDisabled?: boolean;
    isPending?: boolean;
    fullWidth?: boolean;
    onPress?: (event: MouseEvent<HTMLButtonElement>) => void;
    slot?: string;
    className?: string;
  };

const mantineButtonVariants: Record<
  ButtonVariant,
  "filled" | "outline" | "subtle"
> = {
  primary: "filled",
  secondary: "outline",
  quiet: "subtle",
  danger: "filled",
};

function invokePress(
  onPress: ButtonProps["onPress"],
  event: MouseEvent<HTMLButtonElement>,
): void {
  onPress?.(event);
}

type InjectedClickProps = {
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      children,
      variant = "primary",
      pending = false,
      fullWidth,
      className,
      onPress,
      isDisabled,
      isPending,
      slot,
      ...props
    },
    ref,
  ) {
    const isBusy = pending || Boolean(isPending);
    const injectedOnClick = (props as ButtonProps & InjectedClickProps).onClick;
    return (
      <MantineButton
        {...props}
        ref={ref}
        fullWidth={fullWidth}
        variant={mantineButtonVariants[variant]}
        color={variant === "danger" ? "negative" : "accent"}
        disabled={isDisabled}
        loading={isBusy}
        slot={slot ?? undefined}
        onClick={(event) => {
          injectedOnClick?.(event);
          invokePress(onPress, event);
        }}
        className={cx("ds-button", className)}
        data-variant={variant}
        data-full-width={fullWidth ? "true" : undefined}
        data-pending={isBusy ? "true" : undefined}
        aria-busy={isBusy ? "true" : undefined}
      >
        {children}
      </MantineButton>
    );
  },
);

export type IconButtonProps = Omit<ButtonProps, "children"> & {
  icon: ReactNode;
  "aria-label": string;
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton(
    {
      icon,
      className,
      variant = "quiet",
      pending = false,
      onPress,
      isDisabled,
      isPending,
      slot,
      ...props
    },
    ref,
  ) {
    const isBusy = pending || Boolean(isPending);
    const injectedOnClick = (props as IconButtonProps & InjectedClickProps)
      .onClick;
    return (
      <MantineActionIcon
        {...props}
        ref={ref}
        variant={variant === "secondary"
          ? "outline"
          : variant === "danger"
          ? "light"
          : mantineButtonVariants[variant]}
        color={variant === "danger" ? "negative" : "accent"}
        disabled={isDisabled}
        loading={isBusy}
        slot={slot ?? undefined}
        onClick={(event) => {
          injectedOnClick?.(event);
          invokePress(onPress, event);
        }}
        className={cx("ds-icon-button", className)}
        data-variant={variant}
        data-pending={isBusy ? "true" : undefined}
        aria-busy={isBusy ? "true" : undefined}
      >
        {icon}
      </MantineActionIcon>
    );
  },
);

export type LinkButtonProps = Omit<ComponentProps<"a">, "className"> & {
  children: ReactNode;
  variant?: ButtonVariant;
  className?: string;
};

export function LinkButton({
  children,
  variant = "secondary",
  className,
  ...props
}: LinkButtonProps) {
  return (
    <MantineButton
      {...props}
      component="a"
      variant={mantineButtonVariants[variant]}
      color={variant === "danger" ? "negative" : "accent"}
      className={cx("ds-link-button", className)}
      data-variant={variant}
    >
      {children}
    </MantineButton>
  );
}

export type ActionCardProps = Omit<ButtonProps, "children"> & {
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
};

export function ActionCard(
  {
    title,
    description,
    icon,
    pending = false,
    onPress,
    isDisabled,
    isPending,
    slot,
    ...props
  }: ActionCardProps,
) {
  const isBusy = pending || Boolean(isPending);
  const injectedOnClick =
    (props as ActionCardProps & InjectedClickProps).onClick;
  return (
    <MantineButton
      {...props}
      variant="default"
      component="button"
      disabled={isDisabled}
      loading={isBusy}
      slot={slot ?? undefined}
      onClick={(event) => {
        injectedOnClick?.(event);
        invokePress(onPress, event);
      }}
      className={cx("ds-action-card", props.className)}
      data-pending={isBusy ? "true" : undefined}
      aria-busy={isBusy ? "true" : undefined}
    >
      {icon ? <Icon>{icon}</Icon> : null}
      <strong>{title}</strong>
      {description
        ? <span className="ds-action-card__description">{description}</span>
        : null}
    </MantineButton>
  );
}

export type ChipProps = {
  children: ReactNode;
  onRemove?: () => void;
  className?: string;
  style?: CSSProperties;
};

export function Chip({ children, onRemove, className, style }: ChipProps) {
  return (
    <MantinePill
      component="span"
      size="md"
      radius="xl"
      className={cx("ds-chip", className)}
      style={style}
    >
      {children}
      {onRemove
        ? (
          <IconButton
            aria-label={`Remove ${String(children)}`}
            icon={<X size={16} />}
            onPress={onRemove}
            className="ds-chip__remove"
          />
        )
        : null}
    </MantinePill>
  );
}

export type BadgeProps = {
  children: ReactNode;
  tone?: Tone;
  className?: string;
  style?: CSSProperties;
};

const toneColors: Record<Tone, string> = {
  neutral: "surface2",
  positive: "positive",
  warning: "warning",
  danger: "danger",
  info: "info",
};

export function Badge({
  children,
  tone = "info",
  className,
  style,
}: BadgeProps) {
  return (
    <MantineBadge
      component="span"
      color={toneColors[tone]}
      variant="light"
      size="md"
      radius="xl"
      className={cx("ds-badge", className)}
      data-tone={tone}
      style={style}
    >
      {children}
    </MantineBadge>
  );
}

export type StatusDotProps = BadgeProps;

export function StatusDot(
  { children, tone = "info", className, style }: StatusDotProps,
) {
  return (
    <MantineBadge
      component="span"
      color={toneColors[tone]}
      variant="light"
      size="md"
      radius="xl"
      className={cx("ds-status-dot", className)}
      data-tone={tone}
      style={style}
    >
      {children}
    </MantineBadge>
  );
}

export type CardProps = {
  children: ReactNode;
  className?: string;
  as?: ElementType;
  style?: CSSProperties;
};

export function Card({
  children,
  className,
  as: Tag = "article",
  style,
}: CardProps) {
  return (
    <MantineCard
      component={Tag as "div"}
      withBorder
      padding="ds-4"
      radius="md"
      shadow="none"
      className={cx("ds-card", className)}
      style={style}
    >
      {children}
    </MantineCard>
  );
}

export function Section(
  { children, className, as: Tag = "section", style }: CardProps,
) {
  return (
    <MantinePaper
      component={Tag as "div"}
      withBorder
      radius="md"
      shadow="none"
      className={cx("ds-section", className)}
      style={style}
    >
      {children}
    </MantinePaper>
  );
}

export function Divider({
  className,
  style,
}: { className?: string; style?: CSSProperties }) {
  return (
    <MantineDivider
      component="hr"
      className={cx("ds-divider", className)}
      style={style}
    />
  );
}

export type ListProps = {
  children: ReactNode;
  label?: string;
  className?: string;
};

export function List({ children, label, className }: ListProps) {
  return (
    <MantineList
      className={cx("ds-list", className)}
      aria-label={label}
      listStyleType="none"
      withPadding={false}
    >
      {children}
    </MantineList>
  );
}

export type ListRowProps = {
  children: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
  className?: string;
};

export function ListRow(
  { children, leading, trailing, className }: ListRowProps,
) {
  return (
    <MantineBox component="li" className={cx("ds-list-row", className)}>
      {leading}
      <MantineBox component="div" className="ds-list-row__main">
        {children}
      </MantineBox>
      {trailing}
    </MantineBox>
  );
}

export type DefinitionListProps = {
  items: Array<{ term: ReactNode; description: ReactNode }>;
  className?: string;
};

export function DefinitionList({ items, className }: DefinitionListProps) {
  return (
    <MantineBox component="dl" className={cx("ds-definition-list", className)}>
      {items.map((item, index) => (
        <MantineBox key={index} component="div" style={{ display: "contents" }}>
          <dt>{item.term}</dt>
          <dd>{item.description}</dd>
        </MantineBox>
      ))}
    </MantineBox>
  );
}
