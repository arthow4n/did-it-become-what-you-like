import {
  cloneElement,
  forwardRef,
  isValidElement,
  useId,
  useState,
} from "react";
import type {
  ChangeEvent,
  ComponentProps,
  CSSProperties,
  ElementType,
  KeyboardEvent,
  MouseEvent,
  ReactElement,
  ReactNode,
} from "react";
import {
  ChevronDown,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  Plus,
  X,
} from "lucide-react";
import {
  Accordion as MantineAccordion,
  ActionIcon as MantineActionIcon,
  Badge as MantineBadge,
  Button as MantineButton,
  Card as MantineCard,
  Checkbox as MantineCheckbox,
  Container as MantineContainer,
  Divider as MantineDivider,
  Drawer as MantineDrawer,
  Group as MantineGroup,
  Input as MantineInput,
  Menu as MantineMenu,
  Modal as MantineModal,
  Paper as MantinePaper,
  PasswordInput as MantinePasswordInput,
  Pill as MantinePill,
  Popover as MantinePopover,
  Radio as MantineRadio,
  RadioGroup as MantineRadioGroup,
  SegmentedControl as MantineSegmentedControl,
  Select as MantineSelect,
  SimpleGrid as MantineSimpleGrid,
  Stack as MantineStack,
  Switch as MantineSwitch,
  Text as MantineText,
  Textarea as MantineTextarea,
  TextInput as MantineTextInput,
  Title as MantineTitle,
  Tooltip as MantineTooltip,
} from "@mantine/core";
import {
  DateInput as MantineDateInput,
  TimeInput as MantineTimeInput,
} from "@mantine/dates";
import { Dropzone as MantineDropzone } from "@mantine/dropzone";
import { useMediaQuery } from "@mantine/hooks";
import {
  Button as AriaButton,
  ComboBox as AriaComboBox,
  Input as AriaInput,
  Label as AriaLabel,
  ListBox as AriaListBox,
  ListBoxItem as AriaListBoxItem,
  Popover as AriaPopover,
  ProgressBar as AriaProgressBar,
} from "react-aria-components";
export type Space = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
export type Tone = "neutral" | "positive" | "warning" | "danger" | "info";
export type ButtonVariant = "primary" | "secondary" | "quiet" | "danger";

function cx(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}

function gapStyle(gap: Space | undefined): CSSProperties | undefined {
  return gap === undefined
    ? undefined
    : { "--ds-gap": `var(--space-${gap})` } as CSSProperties;
}

export type AppFrameProps = {
  children: ReactNode;
  navigation?: ReactNode;
  className?: string;
};

export function AppFrame({ children, navigation, className }: AppFrameProps) {
  return (
    <div className={cx("ds-app-frame", className)}>
      {navigation
        ? <aside className="ds-app-frame__navigation">{navigation}</aside>
        : null}
      <main className="ds-app-frame__main">{children}</main>
    </div>
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
    <Tag className="ds-page-header">
      <div className="ds-page-header__title">
        {leading}
        <Stack gap={1}>
          {eyebrow ? <Text size="label" tone="muted">{eyebrow}</Text> : null}
          <Heading level={headingLevel}>{title}</Heading>
          {description ? <Text tone="secondary">{description}</Text> : null}
        </Stack>
      </div>
      <div className="ds-page-header__actions">
        {status}
        {actions}
      </div>
    </Tag>
  );
}

export type StackProps = {
  children: ReactNode;
  gap?: Space;
  className?: string;
  as?: ElementType;
  style?: CSSProperties;
};

function mantineSpacing(gap: Space): string {
  return `ds-${gap}`;
}

export function Stack({
  children,
  gap = 4,
  className,
  as: Tag = "div",
  style,
}: StackProps) {
  return (
    <MantineStack
      component={Tag as "div"}
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
}: InlineProps) {
  return (
    <MantineGroup
      component={Tag as "div"}
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
}: ResponsiveGridProps) {
  return (
    <MantineSimpleGrid
      component={Tag as "div"}
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

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      children,
      variant = "primary",
      pending = false,
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

export type FieldProps = {
  label: ReactNode;
  children: ReactNode;
  description?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  controlId?: string;
  className?: string;
};

export function Field(
  { label, children, description, error, required, controlId, className }:
    FieldProps,
) {
  return (
    <MantineInput.Wrapper
      id={controlId}
      label={label}
      description={description}
      error={error}
      required={required}
      labelElement={controlId ? "label" : "div"}
      className={cx("ds-field", className)}
      data-invalid={error ? "true" : undefined}
    >
      {children}
    </MantineInput.Wrapper>
  );
}

type FieldStateProps = {
  isDisabled?: boolean;
  isReadOnly?: boolean;
  isRequired?: boolean;
  isInvalid?: boolean;
  validationBehavior?: "aria" | "native";
  slot?: string;
};

type SharedTextFieldProps =
  & Omit<
    ComponentProps<"input">,
    | "children"
    | "className"
    | "defaultValue"
    | "onChange"
    | "value"
  >
  & {
    label: ReactNode;
    placeholder?: string;
    description?: ReactNode;
    error?: ReactNode;
    value?: string;
    defaultValue?: string;
    onChange?: (value: string) => void;
    className?: string;
  }
  & FieldStateProps;

export function TextField({
  label,
  placeholder,
  description,
  error,
  className,
  onChange,
  isDisabled,
  isReadOnly,
  isRequired,
  isInvalid,
  validationBehavior: _validationBehavior,
  slot,
  ...props
}: SharedTextFieldProps) {
  const mantineProps = props as unknown as ComponentProps<
    typeof MantineTextInput
  >;
  return (
    <MantineTextInput
      {...mantineProps}
      label={label}
      placeholder={placeholder}
      description={description}
      error={error}
      required={isRequired}
      disabled={isDisabled}
      readOnly={isReadOnly}
      slot={slot ?? undefined}
      aria-invalid={Boolean(error) || isInvalid ? "true" : undefined}
      onChange={(event) => onChange?.(event.currentTarget.value)}
      className={cx("ds-field", className)}
      classNames={{ input: "ds-field-control" }}
    />
  );
}

export type TextAreaProps =
  & Omit<
    ComponentProps<"textarea">,
    | "children"
    | "className"
    | "defaultValue"
    | "onChange"
    | "value"
  >
  & {
    label: ReactNode;
    placeholder?: string;
    description?: ReactNode;
    error?: ReactNode;
    value?: string;
    defaultValue?: string;
    onChange?: (value: string) => void;
    className?: string;
  }
  & FieldStateProps;

export function TextArea(
  {
    label,
    placeholder,
    description,
    error,
    className,
    onChange,
    isDisabled,
    isReadOnly,
    isRequired,
    isInvalid,
    validationBehavior: _validationBehavior,
    slot,
    ...props
  }: TextAreaProps,
) {
  const mantineProps = props as unknown as ComponentProps<
    typeof MantineTextarea
  >;
  return (
    <MantineTextarea
      {...mantineProps}
      label={label}
      placeholder={placeholder}
      description={description}
      error={error}
      required={isRequired}
      disabled={isDisabled}
      readOnly={isReadOnly}
      slot={slot ?? undefined}
      aria-invalid={Boolean(error) || isInvalid ? "true" : undefined}
      onChange={(event) => onChange?.(event.currentTarget.value)}
      className={cx("ds-field", className)}
      classNames={{ input: "ds-field-control" }}
    />
  );
}

export type SearchFieldProps =
  & Omit<
    ComponentProps<"input">,
    | "children"
    | "className"
    | "defaultValue"
    | "onChange"
    | "type"
    | "value"
  >
  & {
    label: ReactNode;
    placeholder?: string;
    description?: ReactNode;
    value?: string;
    defaultValue?: string;
    onChange?: (value: string) => void;
    className?: string;
    onValueChange?: (value: string) => void;
  }
  & FieldStateProps;

export function SearchField(
  {
    label,
    placeholder,
    description,
    className,
    value,
    defaultValue,
    onValueChange,
    onChange,
    isDisabled,
    isReadOnly,
    isRequired,
    isInvalid,
    validationBehavior: _validationBehavior,
    slot,
    ...props
  }: SearchFieldProps,
) {
  const [uncontrolledValue, setUncontrolledValue] = useState(
    defaultValue ?? "",
  );
  const currentValue = value === undefined ? uncontrolledValue : value;
  const mantineProps = props as unknown as ComponentProps<
    typeof MantineTextInput
  >;
  const handleValueChange = (nextValue: string) => {
    if (value === undefined) setUncontrolledValue(nextValue);
    onChange?.(nextValue);
    onValueChange?.(nextValue);
  };
  return (
    <MantineTextInput
      {...mantineProps}
      type="search"
      value={currentValue}
      label={label}
      placeholder={placeholder}
      description={description}
      required={isRequired}
      disabled={isDisabled}
      readOnly={isReadOnly}
      aria-invalid={isInvalid ? "true" : undefined}
      className={cx("ds-field", "ds-search-field", className)}
      data-empty={currentValue.length === 0 ? "true" : undefined}
      classNames={{ input: "ds-field-control ds-search-field__input" }}
      slot={slot ?? undefined}
      onChange={(event) => handleValueChange(event.currentTarget.value)}
      rightSectionPointerEvents="all"
      rightSection={
        <MantineActionIcon
          type="button"
          variant="subtle"
          color="accent"
          size="input-sm"
          className="ds-search-field__clear"
          aria-label="Clear search"
          onClick={() => handleValueChange("")}
        >
          <Icon>
            <X />
          </Icon>
        </MantineActionIcon>
      }
    />
  );
}

export type SecretFieldProps = Omit<SharedTextFieldProps, "type"> & {
  revealLabel?: string;
};

export function SecretField(
  {
    label,
    placeholder,
    description,
    error,
    className,
    revealLabel = "Show value",
    onChange,
    isDisabled,
    isReadOnly,
    isRequired,
    isInvalid,
    validationBehavior: _validationBehavior,
    slot,
    ...props
  }: SecretFieldProps,
) {
  const [revealed, setRevealed] = useState(false);
  const mantineProps = props as unknown as ComponentProps<
    typeof MantinePasswordInput
  >;
  return (
    <MantinePasswordInput
      {...mantineProps}
      label={label}
      placeholder={placeholder}
      description={description}
      error={error}
      required={isRequired}
      disabled={isDisabled}
      readOnly={isReadOnly}
      visible={revealed}
      onVisibilityChange={setRevealed}
      visibilityToggleButtonProps={{
        "aria-label": revealed ? "Hide value" : revealLabel,
        className: "ds-secret-field__toggle",
        tabIndex: 0,
        onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => {
          if (event.key === "Enter") {
            event.preventDefault();
            setRevealed((current) => !current);
          }
        },
      }}
      aria-invalid={Boolean(error) || isInvalid ? "true" : undefined}
      onChange={(event) => onChange?.(event.currentTarget.value)}
      className={cx("ds-field", "ds-secret-field", className)}
      classNames={{ input: "ds-field-control ds-secret-field__input" }}
      slot={slot ?? undefined}
    />
  );
}

export type DecimalFieldProps = Omit<
  SharedTextFieldProps,
  "inputMode" | "type"
>;

export function DecimalField(props: DecimalFieldProps) {
  return <TextField {...props} inputMode="decimal" type="text" />;
}

export type MoneyFieldProps = DecimalFieldProps & { currency: string };

export function MoneyField(
  { currency, description, ...props }: MoneyFieldProps,
) {
  return (
    <TextField
      {...props}
      inputMode="decimal"
      type="text"
      description={description ??
        `Amount in ${currency}. Choose Spent or Money back separately.`}
    />
  );
}

function inputValue(
  value: ComponentProps<"input">["value"],
): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (Array.isArray(value)) return value[0];
  return String(value);
}

function emitInputChange(
  onChange: ComponentProps<"input">["onChange"],
  value: string,
): void {
  const input = { value };
  onChange?.(
    { currentTarget: input, target: input } as ChangeEvent<HTMLInputElement>,
  );
}

function emitFileChange(
  onChange: ComponentProps<"input">["onChange"],
  files: readonly File[],
): void {
  const fileList = files as unknown as FileList;
  onChange?.({
    currentTarget: { files: fileList },
    target: { files: fileList },
  } as ChangeEvent<HTMLInputElement>);
}

const fileExtensionMimeTypes: Record<string, string> = {
  ".csv": "text/csv",
  ".gif": "image/gif",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".json": "application/json",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".webp": "image/webp",
};

function dropzoneAcceptFor(
  accept: string | undefined,
): Record<string, string[]> | undefined {
  if (!accept) return undefined;
  const result: Record<string, string[]> = {};
  for (const entry of accept.split(",").map((value) => value.trim())) {
    if (!entry) continue;
    if (entry.includes("/")) {
      result[entry] ??= [];
      continue;
    }
    if (entry.startsWith(".")) {
      const mimeType = fileExtensionMimeTypes[entry.toLowerCase()] ??
        "application/octet-stream";
      result[mimeType] ??= [];
      result[mimeType].push(entry);
    }
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

export type NativeDateFieldProps =
  & Omit<ComponentProps<"input">, "type" | "className">
  & {
    label: ReactNode;
    description?: ReactNode;
    error?: ReactNode;
    className?: string;
  };

export function NativeDateField(
  {
    label,
    description,
    error,
    className,
    id,
    value,
    defaultValue,
    onChange,
    ...props
  }: NativeDateFieldProps,
) {
  const generatedId = useId();
  const controlId = id ?? generatedId;
  const dateValue = inputValue(value);
  const dateDefaultValue = inputValue(defaultValue);
  return (
    <MantineDateInput
      label={label}
      description={description}
      error={error}
      required={props.required}
      id={controlId}
      value={dateValue}
      defaultValue={dateDefaultValue}
      onChange={(nextValue) => emitInputChange(onChange, nextValue ?? "")}
      valueFormat="YYYY-MM-DD"
      className={cx("ds-field", className)}
      classNames={{ input: "ds-field-control" }}
      {...(props as unknown as ComponentProps<typeof MantineDateInput>)}
    />
  );
}

export type NativeTimeFieldProps =
  & Omit<ComponentProps<"input">, "type" | "className">
  & {
    label: ReactNode;
    description?: ReactNode;
    error?: ReactNode;
    className?: string;
  };

export function NativeTimeField(
  {
    label,
    description,
    error,
    className,
    id,
    value,
    defaultValue,
    onChange,
    ...props
  }: NativeTimeFieldProps,
) {
  const generatedId = useId();
  const controlId = id ?? generatedId;
  const timeValue = inputValue(value);
  const timeDefaultValue = inputValue(defaultValue);
  return (
    <MantineTimeInput
      label={label}
      description={description}
      error={error}
      required={props.required}
      id={controlId}
      value={timeValue}
      defaultValue={timeDefaultValue}
      onChange={onChange}
      className={cx("ds-field", className)}
      classNames={{ input: "ds-field-control" }}
      {...(props as unknown as ComponentProps<typeof MantineTimeInput>)}
    />
  );
}

export type FileFieldProps =
  & Omit<ComponentProps<"input">, "type" | "className">
  & {
    label: ReactNode;
    description?: ReactNode;
    onReject?: (files: File[]) => void;
    className?: string;
  };

export function FileField(
  {
    label,
    description,
    className,
    id,
    onChange,
    onReject,
    accept,
    capture,
    multiple,
    disabled,
    ...props
  }: FileFieldProps,
) {
  const generatedId = useId();
  const controlId = id ?? generatedId;
  const dropzoneAccept = dropzoneAcceptFor(accept);
  const [hasRejection, setHasRejection] = useState(false);
  return (
    <Field
      label={label}
      description={description}
      error={hasRejection
        ? <span role="alert">That file type is not accepted.</span>
        : undefined}
      controlId={controlId}
      className={className}
    >
      <MantineDropzone
        accept={dropzoneAccept}
        multiple={multiple}
        disabled={disabled}
        onDrop={(files) => {
          setHasRejection(false);
          emitFileChange(onChange, files);
        }}
        onReject={(rejections) => {
          setHasRejection(true);
          onReject?.(rejections.map(({ file }) => file as File));
        }}
        className="ds-file-dropzone"
        inputProps={{
          ...props,
          id: controlId,
          accept,
          capture,
          multiple,
          disabled,
        }}
      >
        <MantineDropzone.Accept>
          <span className="ds-dropzone__prompt">
            Release to choose this file
          </span>
        </MantineDropzone.Accept>
        <MantineDropzone.Reject>
          <span className="ds-dropzone__prompt">
            That file type is not accepted
          </span>
        </MantineDropzone.Reject>
        <MantineDropzone.Idle>
          <span className="ds-dropzone__prompt">
            Choose a file or drop it here
          </span>
        </MantineDropzone.Idle>
      </MantineDropzone>
    </Field>
  );
}

export type SelectOption = { id: string; label: string; disabled?: boolean };

export type SelectFieldProps = {
  label: ReactNode;
  options: SelectOption[];
  value?: string;
  defaultValue?: string;
  selectedKey?: string | number | null;
  defaultSelectedKey?: string | number | null;
  onValueChange?: (value: string) => void;
  onSelectionChange?: (value: string) => void;
  description?: ReactNode;
  error?: ReactNode;
  isDisabled?: boolean;
  isReadOnly?: boolean;
  isRequired?: boolean;
  isInvalid?: boolean;
  isOpen?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
  validationBehavior?: "aria" | "native";
  slot?: string;
  id?: string;
  name?: string;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
};

export function SelectField({
  label,
  options,
  value,
  onValueChange,
  description,
  error,
  className,
  selectedKey,
  defaultSelectedKey,
  defaultValue: explicitDefaultValue,
  onSelectionChange,
  isDisabled,
  isReadOnly,
  isRequired,
  isInvalid,
  validationBehavior: _validationBehavior,
  isOpen: _isOpen,
  onOpenChange: _onOpenChange,
  slot,
  ...props
}: SelectFieldProps) {
  const mantineProps = props as unknown as ComponentProps<typeof MantineSelect>;
  const selectedValue = value ??
    (selectedKey == null ? undefined : String(selectedKey));
  const defaultValue = explicitDefaultValue ??
    (defaultSelectedKey == null ? undefined : String(defaultSelectedKey));
  return (
    <MantineSelect
      {...mantineProps}
      label={label}
      data={options.map((option) => ({
        value: option.id,
        label: option.label,
        disabled: option.disabled,
      }))}
      value={selectedValue}
      defaultValue={defaultValue}
      onChange={(nextValue) => {
        if (nextValue !== null) {
          onValueChange?.(String(nextValue));
          onSelectionChange?.(String(nextValue));
        }
      }}
      description={description}
      error={error}
      disabled={isDisabled}
      readOnly={isReadOnly}
      required={isRequired}
      aria-invalid={Boolean(error) || isInvalid ? "true" : undefined}
      slot={slot ?? undefined}
      comboboxProps={{ withinPortal: false }}
      className={cx("ds-field", className)}
      classNames={{ input: "ds-field-control ds-select-trigger" }}
    />
  );
}

export type ColorChoiceFieldProps = {
  label: ReactNode;
  value?: string;
  onValueChange?: (value: string) => void;
  choices?: string[];
  description?: ReactNode;
  isDisabled?: boolean;
};

export function ColorChoiceField({
  label,
  value,
  onValueChange,
  choices = ["#78DCCA", "#8FC8F8", "#F0C674", "#FF9E9E"],
  description,
  isDisabled = false,
}: ColorChoiceFieldProps) {
  return (
    <Field label={label} description={description}>
      <div
        className="ds-color-choice-group"
        role="group"
        aria-label={String(label)}
      >
        {choices.map((choice) => (
          <button
            key={choice}
            type="button"
            className="ds-color-choice__swatch"
            aria-label={`Choose ${choice}`}
            aria-pressed={value === choice}
            disabled={isDisabled}
            onClick={() => onValueChange?.(choice)}
            style={{
              background: choice,
              boxShadow: value === choice
                ? "0 0 0 2px var(--color-canvas), 0 0 0 4px var(--color-focus-ring)"
                : undefined,
            }}
          />
        ))}
        <label className="ds-color-choice__custom">
          <span>Custom</span>
          <input
            type="color"
            aria-label={"Choose custom " + String(label)}
            value={value ?? choices[0] ?? "#78DCCA"}
            disabled={isDisabled}
            onChange={(event) => onValueChange?.(event.currentTarget.value)}
          />
        </label>
      </div>
    </Field>
  );
}

export type CheckboxProps =
  & Omit<
    ComponentProps<"input">,
    | "type"
    | "children"
    | "className"
    | "checked"
    | "defaultChecked"
    | "disabled"
    | "onChange"
    | "readOnly"
    | "required"
  >
  & {
    children: ReactNode;
    className?: string;
    isSelected?: boolean;
    defaultSelected?: boolean;
    isIndeterminate?: boolean;
    onChange?: (selected: boolean) => void;
    isDisabled?: boolean;
    isReadOnly?: boolean;
    isRequired?: boolean;
    isInvalid?: boolean;
    validationBehavior?: "aria" | "native";
    slot?: string;
  };

export function Checkbox({
  children,
  className,
  isSelected,
  defaultSelected,
  isIndeterminate,
  onChange,
  isDisabled,
  isReadOnly,
  isRequired,
  isInvalid,
  validationBehavior: _validationBehavior,
  slot,
  ...props
}: CheckboxProps) {
  const mantineProps = props as unknown as ComponentProps<
    typeof MantineCheckbox
  >;
  return (
    <MantineCheckbox
      {...mantineProps}
      label={children}
      checked={isSelected}
      defaultChecked={defaultSelected}
      indeterminate={isIndeterminate}
      onChange={(event) => onChange?.(event.currentTarget.checked)}
      disabled={isDisabled}
      readOnly={isReadOnly}
      required={isRequired}
      aria-invalid={isInvalid ? "true" : undefined}
      slot={slot ?? undefined}
      className={cx("ds-checkbox", className)}
    />
  );
}

export type RadioGroupProps = {
  label: ReactNode;
  options: SelectOption[];
  description?: ReactNode;
  error?: ReactNode;
  className?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  isDisabled?: boolean;
  isReadOnly?: boolean;
  isRequired?: boolean;
  isInvalid?: boolean;
  validationBehavior?: "aria" | "native";
  name?: string;
  id?: string;
  slot?: string;
};

export function RadioGroup(
  {
    label,
    options,
    description,
    error,
    className,
    value,
    defaultValue,
    onChange,
    isDisabled,
    isReadOnly,
    isRequired,
    isInvalid,
    validationBehavior: _validationBehavior,
    name,
    slot,
    ...props
  }: RadioGroupProps,
) {
  return (
    <MantineRadioGroup
      {...(props as unknown as ComponentProps<typeof MantineRadioGroup>)}
      label={label}
      description={description}
      error={error}
      value={value ?? undefined}
      defaultValue={defaultValue ?? undefined}
      onChange={onChange}
      disabled={isDisabled}
      readOnly={isReadOnly}
      required={isRequired}
      aria-invalid={Boolean(error) || isInvalid ? "true" : undefined}
      name={name}
      slot={slot ?? undefined}
      className={cx("ds-field", className)}
    >
      {options.map((option) => (
        <MantineRadio
          key={option.id}
          value={option.id}
          label={option.label}
          disabled={option.disabled}
          className="ds-radio"
        />
      ))}
    </MantineRadioGroup>
  );
}

export type SwitchProps = {
  children: ReactNode;
  className?: string;
  isSelected?: boolean;
  defaultSelected?: boolean;
  onChange?: (selected: boolean) => void;
  isDisabled?: boolean;
  isReadOnly?: boolean;
  isRequired?: boolean;
  isInvalid?: boolean;
  validationBehavior?: "aria" | "native";
  slot?: string;
};

export function Switch({
  children,
  className,
  isSelected,
  defaultSelected,
  onChange,
  isDisabled,
  isReadOnly,
  isRequired,
  isInvalid,
  validationBehavior: _validationBehavior,
  slot,
  ...props
}: SwitchProps) {
  const mantineProps = props as unknown as ComponentProps<typeof MantineSwitch>;
  return (
    <MantineSwitch
      {...mantineProps}
      label={children}
      checked={isSelected}
      defaultChecked={defaultSelected}
      onChange={(event) => onChange?.(event.currentTarget.checked)}
      disabled={isDisabled}
      readOnly={isReadOnly}
      required={isRequired}
      aria-invalid={isInvalid ? "true" : undefined}
      slot={slot ?? undefined}
      className={cx("ds-switch", className)}
    />
  );
}

export type SegmentedOption = SelectOption & { description?: string };

export type SegmentedControlProps = {
  label: string;
  options: SegmentedOption[];
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  isDisabled?: boolean;
  isReadOnly?: boolean;
  validationBehavior?: "aria" | "native";
  name?: string;
  id?: string;
  slot?: string;
  fullWidth?: boolean;
  className?: string;
};

export function SegmentedControl(
  {
    label,
    options,
    fullWidth,
    className,
    value,
    defaultValue,
    onChange,
    isDisabled,
    isReadOnly,
    name,
    slot,
    validationBehavior: _validationBehavior,
    ...props
  }: SegmentedControlProps,
) {
  return (
    <MantineSegmentedControl
      {...(props as unknown as ComponentProps<typeof MantineSegmentedControl>)}
      data={options.map((option) => ({
        value: option.id,
        label: option.label,
        disabled: option.disabled,
      }))}
      value={value ?? undefined}
      defaultValue={defaultValue ?? undefined}
      onChange={onChange}
      disabled={isDisabled}
      readOnly={isReadOnly}
      name={name}
      fullWidth={fullWidth}
      aria-label={label}
      slot={slot ?? undefined}
      className={cx("ds-segmented-control", className)}
      data-full-width={fullWidth ? "true" : undefined}
    />
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

export type ListProps = {
  children: ReactNode;
  label?: string;
  className?: string;
};

export function List({ children, label, className }: ListProps) {
  return (
    <ul className={cx("ds-list", className)} aria-label={label}>{children}</ul>
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
    <li className={cx("ds-list-row", className)}>
      {leading}
      <div className="ds-list-row__main">{children}</div>
      {trailing}
    </li>
  );
}

export type DefinitionListProps = {
  items: Array<{ term: ReactNode; description: ReactNode }>;
  className?: string;
};

export function DefinitionList({ items, className }: DefinitionListProps) {
  return (
    <dl className={cx("ds-definition-list", className)}>
      {items.map((item, index) => (
        <div key={index} style={{ display: "contents" }}>
          <dt>{item.term}</dt>
          <dd>{item.description}</dd>
        </div>
      ))}
    </dl>
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
    "aria-label": String(title),
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
};

export function ConfirmDialog({
  description,
  confirmLabel,
  onConfirm,
  confirmVariant = "primary",
  ...props
}: ConfirmDialogProps) {
  return (
    <AdaptiveDialog {...props}>
      {(close) => (
        <Stack gap={5}>
          <Text>{description}</Text>
          <Inline justify="end">
            <Button
              variant={confirmVariant}
              onPress={() => {
                onConfirm();
                close();
              }}
            >
              {confirmLabel}
            </Button>
          </Inline>
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
          <Inline justify="end">
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
          </Inline>
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
    ...props
  }: DangerDialogProps,
) {
  const [typed, setTyped] = useState("");
  const requiresPhrase = Boolean(phrase);
  return (
    <AdaptiveDialog {...props}>
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
          <Inline justify="end" gap={2}>
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
          </Inline>
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
      trapFocus
      returnFocus
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

export function Banner(
  { children, tone = "info", title, action, className }: BannerProps,
) {
  return (
    <div className={cx("ds-banner", className)} data-tone={tone} role="status">
      <Stack gap={2}>
        {title ? <strong>{title}</strong> : null}
        <NoticeContent>{children}</NoticeContent>
        {action}
      </Stack>
    </div>
  );
}

export function InlineNotice(
  { children, tone = "info", title, action, className }: BannerProps,
) {
  return (
    <div
      className={cx("ds-inline-notice", className)}
      data-tone={tone}
      role={tone === "danger" ? "alert" : "status"}
    >
      <Stack gap={2}>
        {title ? <strong>{title}</strong> : null}
        <NoticeContent>{children}</NoticeContent>
        {action}
      </Stack>
    </div>
  );
}

export type ToastProps = Omit<BannerProps, "title" | "action"> & {
  onDismiss?: () => void;
};

export function Toast(
  { children, tone = "positive", onDismiss, className }: ToastProps,
) {
  return (
    <div
      className={cx("ds-toast", "ds-status-message", className)}
      data-tone={tone}
      role="status"
      aria-live="polite"
    >
      <div className="ds-toast__content">{children}</div>
      {onDismiss
        ? (
          <button
            type="button"
            className="ds-toast__dismiss"
            aria-label="Dismiss notification"
            onClick={onDismiss}
          >
            <Icon size={16}>
              <X />
            </Icon>
          </button>
        )
        : null}
    </div>
  );
}

export function StatusMessage(
  { children, tone = "info", className }: Omit<BannerProps, "title" | "action">,
) {
  return (
    <div
      className={cx("ds-status-message", className)}
      data-tone={tone}
      role="status"
      aria-live="polite"
    >
      {children}
    </div>
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
  { label, value, indeterminate, className, ...props }: ProgressProps,
) {
  return (
    <AriaProgressBar
      {...props}
      value={indeterminate ? undefined : value}
      aria-label={label}
      className={cx("ds-progress", className)}
      data-indeterminate={indeterminate ? "true" : "false"}
    >
      {({ percentage, valueText }) => (
        <>
          <div
            className="ds-inline"
            style={{ justifyContent: "space-between" }}
          >
            <span>{label}</span>
            <span>
              {indeterminate
                ? "In progress"
                : valueText ?? `${Math.round(percentage ?? 0)}%`}
            </span>
          </div>
          <div className="ds-progress__track" aria-hidden="true">
            <div
              className="ds-progress__bar"
              style={indeterminate
                ? undefined
                : { width: `${percentage ?? 0}%` }}
            />
          </div>
        </>
      )}
    </AriaProgressBar>
  );
}

export function Skeleton(
  { className, style }: { className?: string; style?: CSSProperties },
) {
  return (
    <div
      className={cx("ds-skeleton", className)}
      aria-hidden="true"
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
    <div className={cx("ds-empty-state", className)}>
      <Stack gap={3}>
        <Heading size="sm">{title}</Heading>
        <Text>{children}</Text>
        {action}
      </Stack>
    </div>
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
    <div className={cx("ds-error-state", className)} role="alert">
      <Stack gap={3}>
        <Heading size="sm">{title}</Heading>
        <Text>{children}</Text>
        {action}
      </Stack>
    </div>
  );
}

export function StickyActionBar(
  { children, className }: { children: ReactNode; className?: string },
) {
  return <div className={cx("ds-sticky-action-bar", className)}>{children}
  </div>;
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
    <nav className="ds-navigation" aria-label={label}>
      {items.map((item) => (
        <AriaButton
          key={item.id}
          className="ds-navigation__item"
          isDisabled={item.disabled}
          data-selected={item.selected ? "true" : undefined}
          data-action={item.action ? "true" : undefined}
          aria-current={item.selected ? "page" : undefined}
          onPress={() => onSelect?.(item.id)}
        >
          {item.icon ? <Icon>{item.icon}</Icon> : null}
          <span>{item.label}</span>
        </AriaButton>
      ))}
    </nav>
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

export function FormLayout(
  { children, className }: { children: ReactNode; className?: string },
) {
  return (
    <div className={cx("ds-form-layout", className)}>
      <Stack gap={5}>{children}</Stack>
    </div>
  );
}

export function FormActions(
  { children, className }: { children: ReactNode; className?: string },
) {
  return <div className={cx("ds-form-actions", className)}>{children}</div>;
}

export function ErrorSummary(
  { title = "Check the highlighted fields", errors, className }: {
    title?: ReactNode;
    errors: Array<{ id?: string; message: ReactNode }>;
    className?: string;
  },
) {
  return (
    <div
      className={cx("ds-error-summary", className)}
      role="alert"
      tabIndex={-1}
    >
      <strong>{title}</strong>
      <ul>
        {errors.map((error, index) => (
          <li key={error.id ?? index}>{error.message}</li>
        ))}
      </ul>
    </div>
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

export function FilterBar(
  { children, className }: { children: ReactNode; className?: string },
) {
  return (
    <div
      className={cx("ds-filter-bar", className)}
      role="group"
      aria-label="Filters"
    >
      {children}
    </div>
  );
}

export function ActiveFilterChips(
  { filters }: {
    filters: Array<{ id: string; label: string; onRemove: () => void }>;
  },
) {
  return (
    <Inline gap={2}>
      {filters.map((filter) => (
        <Chip key={filter.id} onRemove={filter.onRemove}>{filter.label}</Chip>
      ))}
    </Inline>
  );
}

export function FilterSheet(
  { trigger, children }: { trigger: ReactNode; children: ReactNode },
) {
  return (
    <AdaptiveDialog trigger={trigger} title="Filters">
      {children}
    </AdaptiveDialog>
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
    <div className="ds-status-panel" data-tone={tone}>
      <Inline justify="space-between">
        <Stack gap={1}>
          <strong>{title}</strong>
          {detail ? <Text tone="secondary">{detail}</Text> : null}
        </Stack>
        {action}
      </Inline>
    </div>
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
      <ol className="ds-list" aria-label="Workflow steps">
        {steps.map((step, index) => (
          <li
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
          </li>
        ))}
      </ol>
      {action}
    </Stack>
  );
}

export function PeriodPicker({
  value,
  onValueChange,
  customKind = "day",
  customDate = "",
  onCustomKindChange,
  onCustomDateChange,
}: {
  value?: string;
  onValueChange?: (value: string) => void;
  customKind?: "day" | "month" | "year";
  customDate?: string;
  onCustomKindChange?: (value: "day" | "month" | "year") => void;
  onCustomDateChange?: (value: string) => void;
}) {
  return (
    <Stack gap={2}>
      <SegmentedControl
        label="Period"
        value={value}
        onChange={(next) => onValueChange?.(next)}
        options={[
          { id: "today", label: "Today" },
          { id: "month", label: "This month" },
          { id: "year", label: "This year" },
          { id: "custom", label: "Custom" },
        ]}
      />
      {value === "custom"
        ? (
          <Inline gap={2}>
            <SelectField
              label="Custom period type"
              options={[
                { id: "day", label: "Day" },
                { id: "month", label: "Month" },
                { id: "year", label: "Year" },
              ]}
              value={customKind}
              onValueChange={(next) =>
                onCustomKindChange?.(next as "day" | "month" | "year")}
            />
            <NativeDateField
              label="Custom calendar date"
              value={customDate}
              onChange={(event) => onCustomDateChange?.(event.target.value)}
              description="Day uses the date; month and year use its calendar period."
            />
          </Inline>
        )
        : null}
    </Stack>
  );
}

const FALLBACK_ISO_CURRENCY_CODES = [
  "AUD",
  "CAD",
  "CHF",
  "CNY",
  "DKK",
  "EUR",
  "GBP",
  "HKD",
  "INR",
  "JPY",
  "NOK",
  "NZD",
  "SEK",
  "SGD",
  "USD",
  "TWD",
];

function isoCurrencyOptions(): SelectOption[] {
  const intlWithCurrencyValues = Intl as typeof Intl & {
    supportedValuesOf?: (key: string) => string[];
  };
  const codes = intlWithCurrencyValues.supportedValuesOf?.("currency") ??
    FALLBACK_ISO_CURRENCY_CODES;
  return codes.map((code) => ({ id: code, label: code }));
}

function currencyOptionsWithIso(
  options: SelectOption[],
  value?: string,
): SelectOption[] {
  const byId = new Map<string, SelectOption>();
  for (const option of options) byId.set(option.id, option);
  if (value && !byId.has(value)) byId.set(value, { id: value, label: value });
  for (const option of isoCurrencyOptions()) {
    if (!byId.has(option.id)) byId.set(option.id, option);
  }
  return [...byId.values()];
}

export function ProjectPicker(
  { options, value, onValueChange, className }: {
    options: SelectOption[];
    value?: string;
    onValueChange?: (value: string) => void;
    className?: string;
  },
) {
  return (
    <SelectField
      label="Project"
      options={options}
      value={value}
      onValueChange={onValueChange}
      className={className}
    />
  );
}

export function CurrencyPicker(
  { label = "Currency", options, value, onValueChange }: {
    label?: ReactNode;
    options: SelectOption[];
    value?: string;
    onValueChange?: (value: string) => void;
  },
) {
  const currencyOptions = currencyOptionsWithIso(options, value);
  return (
    <AriaComboBox
      selectedKey={value}
      onSelectionChange={(next) => {
        if (next !== null) onValueChange?.(String(next));
      }}
      className="ds-field ds-search-field ds-currency-picker"
      allowsEmptyCollection
    >
      <AriaLabel className="ds-field__label">{label}</AriaLabel>
      <div className="ds-field-control-wrap">
        <AriaInput
          className="ds-field-control ds-search-field__input"
          placeholder="Search ISO currency"
        />
        <AriaButton
          className="ds-icon-button ds-search-field__clear"
          aria-label="Show currency options"
        >
          <Icon>
            <ChevronDown />
          </Icon>
        </AriaButton>
      </div>
      <AriaPopover className="ds-popover">
        <AriaListBox>
          {currencyOptions.map((option) => (
            <AriaListBoxItem
              key={option.id}
              id={option.id}
              textValue={option.label}
              isDisabled={option.disabled}
              className="ds-menu-item"
            >
              {option.label}
            </AriaListBoxItem>
          ))}
        </AriaListBox>
      </AriaPopover>
    </AriaComboBox>
  );
}

export function MerchantPicker(
  { value, onValueChange, suggestions = [] }: {
    value?: string;
    onValueChange?: (value: string) => void;
    suggestions?: string[];
  },
) {
  return (
    <SearchField
      label="Merchant"
      value={value}
      onValueChange={onValueChange}
      description={suggestions.length
        ? `Suggestions available: ${suggestions.join(", ")}`
        : undefined}
    />
  );
}

export type MoneySummaryItem = {
  label: string;
  amount: string;
  currency: string;
  tone?: MoneyTextProps["tone"];
};

export function MoneySummary(
  { items, className }: { items: MoneySummaryItem[]; className?: string },
) {
  return (
    <div
      className={cx("ds-money-summary", className)}
      role="group"
      aria-label="Money summary"
    >
      {items.map((item) => (
        <div className="ds-money-summary__value" key={item.label}>
          <Text tone="secondary" size="label">{item.label}</Text>
          <MoneyText
            amount={item.amount}
            currency={item.currency}
            tone={item.tone}
          />
        </div>
      ))}
    </div>
  );
}

export type CategoryTotal = {
  id: string;
  name: string;
  amount: string;
  currency: string;
};

export function CategoryBreakdown(
  { categories, onSelect, onViewAll }: {
    categories: CategoryTotal[];
    onSelect?: (id: string) => void;
    onViewAll?: () => void;
  },
) {
  return (
    <Section>
      <Inline justify="space-between">
        <Heading size="sm">By category</Heading>
        {onViewAll
          ? <Button variant="quiet" onPress={onViewAll}>View all</Button>
          : null}
      </Inline>
      <List label="Category totals">
        {categories.map((category) => (
          <li className="ds-list-row" key={category.id}>
            <Button
              variant="quiet"
              onPress={() =>
                onSelect?.(category.id)}
            >
              {category.name}
            </Button>
            <MoneyText amount={category.amount} currency={category.currency} />
          </li>
        ))}
      </List>
    </Section>
  );
}

export type ExpenseViewModel = {
  id: string;
  merchant?: string;
  description?: string;
  category: string;
  amount: string;
  currency: string;
  date: string;
  time?: string;
};

export function ExpenseRow(
  { expense, onSelect }: {
    expense: ExpenseViewModel;
    onSelect?: (id: string) => void;
  },
) {
  return (
    <ListRow
      trailing={
        <MoneyText
          amount={expense.amount}
          currency={expense.currency}
          tone={expense.amount.startsWith("-") ? "negative" : "positive"}
        />
      }
    >
      <Button
        variant="quiet"
        className="ds-expense-row__trigger"
        onPress={() => onSelect?.(expense.id)}
      >
        <Stack gap={1}>
          <strong>
            {expense.merchant || expense.description || "Untitled expense"}
          </strong>
          <Text size="label" tone="secondary">
            {expense.category} · {expense.date}
            {expense.time ? ` · ${expense.time}` : ""}
          </Text>
        </Stack>
      </Button>
    </ListRow>
  );
}

export function ExpenseList(
  { expenses, onSelect }: {
    expenses: ExpenseViewModel[];
    onSelect?: (id: string) => void;
  },
) {
  return (
    <List label="Expenses">
      {expenses.map((expense) => (
        <ExpenseRow key={expense.id} expense={expense} onSelect={onSelect} />
      ))}
    </List>
  );
}

export type ReceiptGroupProps = {
  merchant: string;
  date: string;
  lines: ExpenseViewModel[];
  total: MoneyTextProps;
  onSelectLine?: (id: string) => void;
};

export function ReceiptGroup(
  { merchant, date, lines, total, onSelectLine }: ReceiptGroupProps,
) {
  return (
    <Disclosure
      title={
        <Inline>
          <strong>{merchant}</strong>
          <Text tone="secondary">{date}</Text>
        </Inline>
      }
    >
      <Stack gap={3}>
        <MoneyText {...total} />
        <ExpenseList expenses={lines} onSelect={onSelectLine} />
      </Stack>
    </Disclosure>
  );
}

export function ReceiptReconciliation(
  { printed, selected, difference, currency }: {
    printed: string;
    selected: string;
    difference: string;
    currency: string;
  },
) {
  return (
    <Card>
      <DefinitionList
        items={[{
          term: "Receipt total",
          description: <MoneyText amount={printed} currency={currency} />,
        }, {
          term: "Selected lines",
          description: <MoneyText amount={selected} currency={currency} />,
        }, {
          term: "Difference",
          description: (
            <MoneyText
              amount={difference}
              currency={currency}
              tone={difference === "0" ? "positive" : "negative"}
            />
          ),
        }]}
      />
      {difference !== "0"
        ? (
          <InlineNotice tone="warning" title="Review totals before saving">
            The selected lines do not yet match the printed total.
          </InlineNotice>
        )
        : null}
    </Card>
  );
}

export function ReceiptSourcePicker(
  { preview, onTakePhoto, onChooseImage, onRemove }: {
    preview?: ReactNode;
    onTakePhoto?: () => void;
    onChooseImage?: () => void;
    onRemove?: () => void;
  },
) {
  return (
    <Stack gap={4}>
      {preview
        ? <Card>{preview}</Card>
        : (
          <EmptyState title="No receipt selected">
            Choose an image or take a photo to preview it before sending.
          </EmptyState>
        )}
      <Inline>
        <Button variant="secondary" onPress={onTakePhoto}>Take photo</Button>
        <Button variant="secondary" onPress={onChooseImage}>
          Choose image
        </Button>
        {preview
          ? <Button variant="quiet" onPress={onRemove}>Remove</Button>
          : null}
      </Inline>
    </Stack>
  );
}

export type ReceiptMetadataViewModel = {
  merchant?: string;
  date: string;
  currency: string;
  printedTotal: string;
};

export function ReceiptMetadata(
  { metadata, onEdit }: {
    metadata: ReceiptMetadataViewModel;
    onEdit?: () => void;
  },
) {
  return (
    <Card as="section">
      <Inline justify="space-between">
        <Stack gap={1}>
          <Heading size="sm">{metadata.merchant || "Receipt"}</Heading>
          <Text tone="secondary">
            {metadata.date} · {metadata.currency}
          </Text>
        </Stack>
        {onEdit ? <Button variant="quiet" onPress={onEdit}>Edit</Button> : null}
      </Inline>
      <Inline justify="space-between">
        <Text tone="secondary">Receipt total</Text>
        <MoneyText
          amount={metadata.printedTotal}
          currency={metadata.currency}
        />
      </Inline>
    </Card>
  );
}

export type ReceiptLineViewModel = {
  id: string;
  type: "purchase" | "adjustment";
  description: string;
  category: string;
  amount: string;
  selected: boolean;
  uncertain: boolean;
  selectionReason?: string;
  quantity?: string;
  unitPrice?: string;
  linkedLineDescription?: string;
};

export function ReceiptLineCard(
  { line, currency, onSelectedChange, onEdit, editControl, onRemove }: {
    line: ReceiptLineViewModel;
    currency: string;
    onSelectedChange?: (selected: boolean) => void;
    onEdit?: () => void;
    editControl?: ReactNode;
    onRemove?: () => void;
  },
) {
  return (
    <Card as="section">
      <Inline justify="space-between">
        <Checkbox
          isSelected={line.selected}
          onChange={onSelectedChange}
        >
          <strong>{line.description || "Unclear item"}</strong>
        </Checkbox>
        <MoneyText
          amount={line.amount}
          currency={currency}
          tone={line.amount.startsWith("-") ? "negative" : "positive"}
        />
      </Inline>
      <Inline justify="space-between">
        <Stack gap={1}>
          <Text tone="secondary">{line.category}</Text>
          {line.quantity || line.unitPrice
            ? (
              <Text size="label" tone="muted">
                {line.quantity ?? "?"} × {line.unitPrice ?? "?"}
              </Text>
            )
            : null}
          {line.linkedLineDescription
            ? (
              <Text size="label" tone="secondary">
                Linked to {line.linkedLineDescription}
              </Text>
            )
            : null}
        </Stack>
        <Inline>
          {editControl}
          {editControl === undefined && onEdit
            ? <Button variant="quiet" onPress={onEdit}>Edit</Button>
            : null}
          {onRemove
            ? <Button variant="quiet" onPress={onRemove}>Remove</Button>
            : null}
        </Inline>
      </Inline>
      {line.uncertain
        ? (
          <InlineNotice tone="warning" title="Review this line">
            {line.selectionReason ??
              "The extraction was uncertain. Check the details before selecting it."}
          </InlineNotice>
        )
        : null}
    </Card>
  );
}

export type ReceiptLineEditorValue = {
  type: "purchase" | "adjustment";
  description: string;
  categoryId: string;
  amount: string;
  quantity?: string;
  unitPrice?: string;
  lineId?: string;
};

export function ReceiptLineEditor(
  { value, categories, linkOptions = [], onChange }: {
    value: ReceiptLineEditorValue;
    categories: SelectOption[];
    linkOptions?: SelectOption[];
    onChange: (value: ReceiptLineEditorValue) => void;
  },
) {
  return (
    <Stack gap={4}>
      <TextField
        label="Description"
        isRequired
        value={value.description}
        onChange={(description) => onChange({ ...value, description })}
      />
      <SelectField
        label="Category"
        options={categories}
        value={value.categoryId}
        onValueChange={(categoryId) => onChange({ ...value, categoryId })}
      />
      <TextField
        label={value.type === "adjustment" ? "Signed adjustment" : "Line total"}
        value={value.amount}
        onChange={(amount) => onChange({ ...value, amount })}
        inputMode="decimal"
        type="text"
        description="Enter the signed amount exactly as printed."
      />
      {value.type === "purchase"
        ? (
          <Inline>
            <DecimalField
              label="Quantity (optional)"
              value={value.quantity ?? ""}
              onChange={(quantity) => onChange({ ...value, quantity })}
            />
            <TextField
              label="Unit price (optional)"
              value={value.unitPrice ?? ""}
              onChange={(unitPrice) => onChange({ ...value, unitPrice })}
              inputMode="decimal"
              type="text"
              description="Preserve the printed unit price when known."
            />
          </Inline>
        )
        : (
          <SelectField
            label="Link to purchase (optional)"
            options={[
              { id: "", label: "Receipt-wide adjustment" },
              ...linkOptions,
            ]}
            value={value.lineId ?? ""}
            onValueChange={(lineId) =>
              onChange({ ...value, lineId: lineId || undefined })}
          />
        )}
    </Stack>
  );
}

export type GeminiModelViewModel = SelectOption & {
  status: "Compatible" | "Incompatible" | "Needs test";
  reason?: string;
};

export function ModelPicker(
  { options, value, onValueChange, disabled = false }: {
    options: GeminiModelViewModel[];
    value?: string;
    onValueChange?: (value: string) => void;
    disabled?: boolean;
  },
) {
  return (
    <AriaComboBox
      selectedKey={value}
      onSelectionChange={(next) => {
        if (next !== null) onValueChange?.(String(next));
      }}
      isDisabled={disabled}
      className="ds-field ds-search-field ds-model-picker"
      allowsEmptyCollection
    >
      <AriaLabel className="ds-field__label">Model</AriaLabel>
      <AriaInput
        className="ds-field-control"
        placeholder="Search models"
      />
      <AriaButton
        className="ds-icon-button ds-search-field__clear"
        aria-label="Show model options"
      >
        <Icon>
          <ChevronDown />
        </Icon>
      </AriaButton>
      <AriaPopover className="ds-popover">
        <AriaListBox>
          {options.map((option) => (
            <AriaListBoxItem
              key={option.id}
              id={option.id}
              textValue={option.label}
              isDisabled={option.disabled || option.status === "Incompatible"}
              className="ds-menu-item"
            >
              <Stack gap={1}>
                <span>{option.label}</span>
                <Text size="label" tone="secondary">
                  {option.status}
                  {option.reason ? ` · ${option.reason}` : ""}
                </Text>
              </Stack>
            </AriaListBoxItem>
          ))}
        </AriaListBox>
      </AriaPopover>
    </AriaComboBox>
  );
}

export function GeminiQuickSetup(
  {
    value,
    onChange,
    onSave,
    error,
    busy,
    showHeading = true,
    autoFocus = false,
  }: {
    value: string;
    onChange: (value: string) => void;
    onSave: () => void;
    error?: string;
    busy?: boolean;
    showHeading?: boolean;
    autoFocus?: boolean;
  },
) {
  return (
    <Card as="section">
      <Stack gap={4}>
        {showHeading ? <Heading size="sm">Set up Gemini</Heading> : null}
        <SecretField
          label="API key"
          autoFocus={autoFocus}
          value={value}
          onChange={onChange}
          description="Stored on this device. It is not a browser secret and can be read by code running on this origin."
          error={error}
        />
        <InlineNotice tone="warning" title="Before you continue">
          The selected receipt image, extraction schema and instructions, active
          category IDs and names, device locale, and project currency code are
          sent to Google Gemini. Expense history, project names, Drive data,
          other device details, and sync metadata are excluded.
        </InlineNotice>
        <FormActions>
          <Button
            pending={busy}
            isDisabled={busy || value.trim().length === 0}
            onPress={onSave}
          >
            Save and continue
          </Button>
        </FormActions>
      </Stack>
    </Card>
  );
}

export function GeminiConfigurationTest(
  { state, onTest }: {
    state: "idle" | "testing" | "passed" | "failed";
    onTest: () => void;
  },
) {
  const copy = state === "passed"
    ? "Configuration passed on this device."
    : state === "failed"
    ? "Configuration needs attention. Check the key and compatible model."
    : state === "testing"
    ? "Testing the key and selected model…"
    : "Test the key and selected model without sending a real receipt.";
  return (
    <StatusPanel
      title="Test configuration"
      detail={copy}
      tone={state === "passed"
        ? "positive"
        : state === "failed"
        ? "danger"
        : "info"}
      action={
        <Button
          variant="secondary"
          pending={state === "testing"}
          isDisabled={state === "testing"}
          onPress={onTest}
        >
          Test configuration
        </Button>
      }
    />
  );
}

export function ExpenseForm(
  { children, status, actions }: {
    children?: ReactNode;
    status?: ReactNode;
    actions?: ReactNode;
  },
) {
  return (
    <FormLayout>
      {status}
      {children}
      {actions ? <FormActions>{actions}</FormActions> : null}
    </FormLayout>
  );
}

export type AppNavigationIconSet = {
  expenses?: ReactNode;
  add?: ReactNode;
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
        { id: "add", label: "Add", icon: icons.add ?? <Plus />, action: true },
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
