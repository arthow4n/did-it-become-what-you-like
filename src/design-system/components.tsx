import { useId, useState } from "react";
import type {
  ComponentProps,
  CSSProperties,
  ElementType,
  ReactNode,
} from "react";
import {
  Check,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  LoaderCircle,
  Plus,
  X,
} from "lucide-react";
import {
  Button as AriaButton,
  Checkbox as AriaCheckbox,
  Dialog as AriaDialog,
  DialogTrigger as AriaDialogTrigger,
  Disclosure as AriaDisclosure,
  DisclosurePanel as AriaDisclosurePanel,
  FieldError as AriaFieldError,
  Input as AriaInput,
  Label as AriaLabel,
  ListBox as AriaListBox,
  ListBoxItem as AriaListBoxItem,
  Menu as AriaMenu,
  MenuItem as AriaMenuItem,
  MenuTrigger as AriaMenuTrigger,
  Modal as AriaModal,
  ModalOverlay as AriaModalOverlay,
  Popover as AriaPopover,
  ProgressBar as AriaProgressBar,
  Radio as AriaRadio,
  RadioGroup as AriaRadioGroup,
  SearchField as AriaSearchField,
  Select as AriaSelect,
  SelectValue as AriaSelectValue,
  Switch as AriaSwitch,
  Text as AriaText,
  TextArea as AriaTextArea,
  TextField as AriaTextField,
  Tooltip as AriaTooltip,
  TooltipTrigger as AriaTooltipTrigger,
} from "react-aria-components";
import type {
  ButtonProps as AriaButtonProps,
  CheckboxProps as AriaCheckboxProps,
  DisclosureProps as AriaDisclosureProps,
  ProgressBarProps as AriaProgressBarProps,
  RadioGroupProps as AriaRadioGroupProps,
  SearchFieldProps as AriaSearchFieldProps,
  SelectProps as AriaSelectProps,
  SwitchProps as AriaSwitchProps,
  TextFieldProps as AriaTextFieldProps,
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
        <div className="ds-stack" style={gapStyle(1)}>
          {eyebrow ? <Text size="label" tone="muted">{eyebrow}</Text> : null}
          <Heading level={headingLevel}>{title}</Heading>
          {description ? <Text tone="secondary">{description}</Text> : null}
        </div>
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
};

export function Stack({
  children,
  gap = 4,
  className,
  as: Tag = "div",
}: StackProps) {
  return (
    <Tag
      className={cx("ds-stack", className)}
      style={{ gap: `var(--space-${gap})` }}
    >
      {children}
    </Tag>
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
}: InlineProps) {
  return (
    <Tag
      className={cx("ds-inline", className)}
      style={{ gap: `var(--space-${gap})`, justifyContent: justify }}
    >
      {children}
    </Tag>
  );
}

export type ResponsiveGridProps = StackProps & { columns?: 1 | 2 | 3 };

export function ResponsiveGrid({
  children,
  gap = 4,
  className,
  as: Tag = "div",
  columns = 2,
}: ResponsiveGridProps) {
  return (
    <Tag
      className={cx("ds-responsive-grid", className)}
      data-columns={columns}
      style={{ gap: `var(--space-${gap})` }}
    >
      {children}
    </Tag>
  );
}

export type ContentContainerProps = {
  children: ReactNode;
  size?: "content" | "form" | "readable" | "review";
  className?: string;
};

export function ContentContainer({
  children,
  size = "content",
  className,
}: ContentContainerProps) {
  return (
    <div className={cx("ds-content-container", className)} data-size={size}>
      {children}
    </div>
  );
}

export type TextProps = {
  children: ReactNode;
  tone?: "primary" | "secondary" | "muted";
  size?: "body" | "caption" | "label";
  as?: ElementType;
  className?: string;
};

export function Text({
  children,
  tone = "primary",
  size = "body",
  as: Tag = "p",
  className,
}: TextProps) {
  return (
    <Tag className={cx("ds-text", className)} data-tone={tone} data-size={size}>
      {children}
    </Tag>
  );
}

export type HeadingProps = {
  children: ReactNode;
  size?: "sm" | "md" | "lg";
  level?: 1 | 2 | 3 | 4 | 5 | 6;
  className?: string;
};

export function Heading({
  children,
  size = "md",
  level = 2,
  className,
}: HeadingProps) {
  const Tag = `h${level}` as keyof HTMLElementTagNameMap;
  return (
    <Tag className={cx("ds-heading", className)} data-size={size}>
      {children}
    </Tag>
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
  return `${currency} ${sign}${grouped || "0"}${
    fraction ? `.${fraction}` : ""
  }`;
}

export function MoneyText(
  { amount, currency, tone, className }: MoneyTextProps,
) {
  const stringAmount = String(amount);
  const resolvedTone = tone ??
    (stringAmount.startsWith("+") ||
        (!stringAmount.startsWith("-") && stringAmount !== "0")
      ? "positive"
      : stringAmount.startsWith("-")
      ? "negative"
      : "neutral");
  return (
    <span className={cx("ds-money", className)} data-tone={resolvedTone}>
      {formatMoney(amount, currency)}
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

export type ButtonProps = Omit<AriaButtonProps, "children" | "className"> & {
  children?: ReactNode;
  variant?: ButtonVariant;
  pending?: boolean;
  className?: string;
};

export function Button({
  children,
  variant = "primary",
  pending = false,
  className,
  isPending,
  ...props
}: ButtonProps) {
  return (
    <AriaButton
      {...props}
      isPending={pending || isPending}
      className={cx("ds-button", className)}
      data-variant={variant}
      data-pending={pending || isPending ? "true" : undefined}
      aria-busy={pending || isPending ? "true" : undefined}
    >
      {pending || isPending
        ? (
          <Icon>
            <LoaderCircle />
          </Icon>
        )
        : null}
      {children}
    </AriaButton>
  );
}

export type IconButtonProps = Omit<ButtonProps, "children"> & {
  icon: ReactNode;
  "aria-label": string;
};

export function IconButton(
  { icon, className, variant = "quiet", ...props }: IconButtonProps,
) {
  return (
    <Button
      {...props}
      variant={variant}
      className={cx("ds-icon-button", className)}
    >
      <Icon>{icon}</Icon>
    </Button>
  );
}

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
    <a
      {...props}
      className={cx("ds-link-button", className)}
      data-variant={variant}
    >
      {children}
    </a>
  );
}

export type ActionCardProps = Omit<ButtonProps, "children"> & {
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
};

export function ActionCard(
  { title, description, icon, ...props }: ActionCardProps,
) {
  return (
    <AriaButton {...props} className={cx("ds-action-card", props.className)}>
      {icon ? <Icon>{icon}</Icon> : null}
      <strong>{title}</strong>
      {description
        ? <span className="ds-action-card__description">{description}</span>
        : null}
    </AriaButton>
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
    <label
      className={cx("ds-field", className)}
      data-invalid={error ? "true" : undefined}
    >
      <label className="ds-field__label" htmlFor={controlId}>
        {label}{" "}
        {required ? <span className="ds-field__required">*</span> : null}
      </label>
      {children}
      {description
        ? <span className="ds-field__description">{description}</span>
        : null}
      {error
        ? <span className="ds-field__error" role="alert">{error}</span>
        : null}
    </label>
  );
}

type SharedTextFieldProps =
  & Omit<AriaTextFieldProps, "children" | "className">
  & {
    label: ReactNode;
    placeholder?: string;
    description?: ReactNode;
    error?: ReactNode;
    className?: string;
  };

export function TextField({
  label,
  placeholder,
  description,
  error,
  className,
  isInvalid,
  ...props
}: SharedTextFieldProps) {
  return (
    <AriaTextField
      {...props}
      isInvalid={Boolean(error) || isInvalid}
      className={cx("ds-field", className)}
    >
      <AriaLabel className="ds-field__label">{label}</AriaLabel>
      {props.isRequired ? <span className="ds-field__required">*</span> : null}
      <AriaInput className="ds-field-control" placeholder={placeholder} />
      {description
        ? (
          <AriaText slot="description" className="ds-field__description">
            {description}
          </AriaText>
        )
        : null}
      {error
        ? (
          <span role="alert">
            <AriaFieldError className="ds-field__error">
              {error}
            </AriaFieldError>
          </span>
        )
        : null}
    </AriaTextField>
  );
}

export type TextAreaProps =
  & Omit<AriaTextFieldProps, "children" | "className">
  & {
    label: ReactNode;
    placeholder?: string;
    description?: ReactNode;
    error?: ReactNode;
    className?: string;
  };

export function TextArea(
  { label, placeholder, description, error, className, ...props }:
    TextAreaProps,
) {
  return (
    <AriaTextField
      {...props}
      isInvalid={Boolean(error) || props.isInvalid}
      className={cx("ds-field", className)}
    >
      <AriaLabel className="ds-field__label">{label}</AriaLabel>
      <AriaTextArea className="ds-field-control" placeholder={placeholder} />
      {description
        ? (
          <AriaText slot="description" className="ds-field__description">
            {description}
          </AriaText>
        )
        : null}
      {error
        ? (
          <span role="alert">
            <AriaFieldError className="ds-field__error">
              {error}
            </AriaFieldError>
          </span>
        )
        : null}
    </AriaTextField>
  );
}

export type SearchFieldProps =
  & Omit<AriaSearchFieldProps, "children" | "className">
  & {
    label: ReactNode;
    placeholder?: string;
    description?: ReactNode;
    className?: string;
    onValueChange?: (value: string) => void;
  };

export function SearchField(
  { label, placeholder, description, className, onValueChange, ...props }:
    SearchFieldProps,
) {
  return (
    <AriaSearchField
      {...props}
      className={cx("ds-field", "ds-search-field", className)}
      onChange={onValueChange}
    >
      <AriaLabel className="ds-field__label">{label}</AriaLabel>
      <AriaInput className="ds-field-control" placeholder={placeholder} />
      <AriaButton
        className="ds-icon-button ds-search-field__clear"
        aria-label="Clear search"
      >
        <Icon>
          <X />
        </Icon>
      </AriaButton>
      {description
        ? (
          <AriaText slot="description" className="ds-field__description">
            {description}
          </AriaText>
        )
        : null}
    </AriaSearchField>
  );
}

export type SecretFieldProps = Omit<SharedTextFieldProps, "type"> & {
  revealLabel?: string;
};

export function SecretField(
  { revealLabel = "Show value", ...props }: SecretFieldProps,
) {
  const [revealed, setRevealed] = useState(false);
  return (
    <div className="ds-field">
      <TextField {...props} type={revealed ? "text" : "password"} />
      <Button
        type="button"
        variant="quiet"
        onPress={() => setRevealed((current) => !current)}
        aria-label={revealed ? "Hide value" : revealLabel}
      >
        {revealed ? "Hide" : revealLabel}
      </Button>
    </div>
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

export type NativeDateFieldProps =
  & Omit<ComponentProps<"input">, "type" | "className">
  & {
    label: ReactNode;
    description?: ReactNode;
    error?: ReactNode;
    className?: string;
  };

export function NativeDateField(
  { label, description, error, className, ...props }: NativeDateFieldProps,
) {
  const generatedId = useId();
  const controlId = props.id ?? generatedId;
  return (
    <Field
      label={label}
      description={description}
      error={error}
      controlId={controlId}
      className={className}
    >
      <input
        {...props}
        id={controlId}
        type="date"
        className="ds-field-control"
      />
    </Field>
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
  { label, description, error, className, ...props }: NativeTimeFieldProps,
) {
  const generatedId = useId();
  const controlId = props.id ?? generatedId;
  return (
    <Field
      label={label}
      description={description}
      error={error}
      controlId={controlId}
      className={className}
    >
      <input
        {...props}
        id={controlId}
        type="time"
        className="ds-field-control"
      />
    </Field>
  );
}

export type FileFieldProps =
  & Omit<ComponentProps<"input">, "type" | "className">
  & {
    label: ReactNode;
    description?: ReactNode;
    className?: string;
  };

export function FileField(
  { label, description, className, ...props }: FileFieldProps,
) {
  const generatedId = useId();
  const controlId = props.id ?? generatedId;
  return (
    <Field
      label={label}
      description={description}
      controlId={controlId}
      className={className}
    >
      <input
        {...props}
        id={controlId}
        type="file"
        className="ds-field-control"
      />
    </Field>
  );
}

export type SelectOption = { id: string; label: string; disabled?: boolean };

export type SelectFieldProps =
  & Omit<AriaSelectProps<object>, "children" | "className">
  & {
    label: ReactNode;
    options: SelectOption[];
    value?: string;
    onValueChange?: (value: string) => void;
    description?: ReactNode;
    error?: ReactNode;
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
  ...props
}: SelectFieldProps) {
  return (
    <AriaSelect
      {...props}
      selectedKey={value}
      onSelectionChange={(next) => {
        if (next !== null) onValueChange?.(String(next));
      }}
      isInvalid={Boolean(error) || props.isInvalid}
      className={cx("ds-field", className)}
    >
      <AriaLabel className="ds-field__label">{label}</AriaLabel>
      <AriaButton className="ds-select-trigger">
        <AriaSelectValue />
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
              isDisabled={option.disabled}
            >
              {option.label}
            </AriaListBoxItem>
          ))}
        </AriaListBox>
      </AriaPopover>
      {description
        ? (
          <AriaText slot="description" className="ds-field__description">
            {description}
          </AriaText>
        )
        : null}
      {error
        ? (
          <span role="alert">
            <AriaFieldError className="ds-field__error">
              {error}
            </AriaFieldError>
          </span>
        )
        : null}
    </AriaSelect>
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
        className="ds-inline"
        role="group"
        aria-label={String(label)}
        style={{ gap: "var(--space-2)" }}
      >
        {choices.map((choice) => (
          <button
            key={choice}
            type="button"
            aria-label={`Choose ${choice}`}
            aria-pressed={value === choice}
            disabled={isDisabled}
            onClick={() => onValueChange?.(choice)}
            style={{
              width: "var(--control-height)",
              height: "var(--control-height)",
              border: value === choice
                ? "3px solid var(--color-focus-ring)"
                : "2px solid var(--color-border-strong)",
              borderRadius: "50%",
              background: choice,
            }}
          />
        ))}
      </div>
    </Field>
  );
}

export type CheckboxProps =
  & Omit<AriaCheckboxProps, "children" | "className">
  & {
    children: ReactNode;
    className?: string;
  };

export function Checkbox({ children, className, ...props }: CheckboxProps) {
  return (
    <AriaCheckbox {...props} className={cx("ds-checkbox", className)}>
      {({ isSelected }) => (
        <>
          <span className="ds-checkbox__indicator" aria-hidden="true">
            {isSelected ? <Check size={16} /> : null}
          </span>
          <span>{children}</span>
        </>
      )}
    </AriaCheckbox>
  );
}

export type RadioGroupProps =
  & Omit<AriaRadioGroupProps, "children" | "className">
  & {
    label: ReactNode;
    options: SelectOption[];
    className?: string;
  };

export function RadioGroup(
  { label, options, className, ...props }: RadioGroupProps,
) {
  return (
    <AriaRadioGroup {...props} className={cx("ds-field", className)}>
      <AriaLabel className="ds-field__label">{label}</AriaLabel>
      <div className="ds-stack" style={{ gap: "var(--space-1)" }}>
        {options.map((option) => (
          <AriaRadio
            key={option.id}
            value={option.id}
            isDisabled={option.disabled}
            className="ds-radio"
          >
            {({ isSelected }) => (
              <>
                <span className="ds-radio__indicator" aria-hidden="true">
                  {isSelected
                    ? (
                      <span
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: "50%",
                          background: "currentColor",
                        }}
                      />
                    )
                    : null}
                </span>
                <span>{option.label}</span>
              </>
            )}
          </AriaRadio>
        ))}
      </div>
    </AriaRadioGroup>
  );
}

export type SwitchProps = Omit<AriaSwitchProps, "children" | "className"> & {
  children: ReactNode;
  className?: string;
};

export function Switch({ children, className, ...props }: SwitchProps) {
  return (
    <AriaSwitch {...props} className={cx("ds-switch", className)}>
      {() => (
        <>
          <span className="ds-switch__indicator" aria-hidden="true">
            <span className="ds-switch__thumb" />
          </span>
          <span>{children}</span>
        </>
      )}
    </AriaSwitch>
  );
}

export type SegmentedOption = SelectOption & { description?: string };

export type SegmentedControlProps =
  & Omit<AriaRadioGroupProps, "children" | "className">
  & {
    label: string;
    options: SegmentedOption[];
    className?: string;
  };

export function SegmentedControl(
  { label, options, className, ...props }: SegmentedControlProps,
) {
  return (
    <AriaRadioGroup
      {...props}
      aria-label={label}
      className={cx("ds-segmented-control", className)}
    >
      {options.map((option) => (
        <AriaRadio
          key={option.id}
          value={option.id}
          isDisabled={option.disabled}
        >
          {option.label}
        </AriaRadio>
      ))}
    </AriaRadioGroup>
  );
}

export type ChipProps = {
  children: ReactNode;
  onRemove?: () => void;
  className?: string;
};

export function Chip({ children, onRemove, className }: ChipProps) {
  return (
    <span className={cx("ds-chip", className)}>
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
    </span>
  );
}

export type BadgeProps = {
  children: ReactNode;
  tone?: Tone;
  className?: string;
};

export function Badge({ children, tone = "info", className }: BadgeProps) {
  return (
    <span className={cx("ds-badge", className)} data-tone={tone}>
      {children}
    </span>
  );
}

export type StatusDotProps = BadgeProps;

export function StatusDot(
  { children, tone = "info", className }: StatusDotProps,
) {
  return (
    <span className={cx("ds-status-dot", className)} data-tone={tone}>
      {children}
    </span>
  );
}

export type CardProps = {
  children: ReactNode;
  className?: string;
  as?: ElementType;
};

export function Card({ children, className, as: Tag = "article" }: CardProps) {
  return <Tag className={cx("ds-card", className)}>{children}</Tag>;
}

export function Section(
  { children, className, as: Tag = "section" }: CardProps,
) {
  return <Tag className={cx("ds-section", className)}>{children}</Tag>;
}

export function Divider({ className }: { className?: string }) {
  return <hr className={cx("ds-divider", className)} />;
}

export type DisclosureProps =
  & Omit<AriaDisclosureProps, "children" | "className">
  & {
    title: ReactNode;
    children: ReactNode;
    className?: string;
  };

export function Disclosure(
  { title, children, className, ...props }: DisclosureProps,
) {
  return (
    <AriaDisclosure {...props} className={cx("ds-disclosure", className)}>
      <AriaButton slot="trigger" className="ds-disclosure__trigger">
        <span>{title}</span>
        <Icon>
          <ChevronRight />
        </Icon>
      </AriaButton>
      <AriaDisclosurePanel className="ds-disclosure__panel">
        {children}
      </AriaDisclosurePanel>
    </AriaDisclosure>
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
  children: ReactNode;
  closeLabel?: string;
  isDismissable?: boolean;
  className?: string;
};

export function AdaptiveDialog({
  trigger,
  title,
  children,
  closeLabel = "Close",
  isDismissable = true,
  className,
}: AdaptiveDialogProps) {
  return (
    <AriaDialogTrigger>
      {trigger}
      <AriaModalOverlay
        className="ds-overlay-backdrop"
        isDismissable={isDismissable}
      >
        <AriaModal className={cx("ds-dialog", className)}>
          <AriaDialog
            aria-label={String(title)}
            data-dialog-layout="adaptive"
          >
            {({ close }) => (
              <Stack gap={4}>
                <Inline justify="space-between">
                  <Heading>{title}</Heading>
                  <IconButton
                    aria-label={closeLabel}
                    icon={<X />}
                    onPress={close}
                  />
                </Inline>
                {children}
              </Stack>
            )}
          </AriaDialog>
        </AriaModal>
      </AriaModalOverlay>
    </AriaDialogTrigger>
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
      <Stack gap={5}>
        <Text>{description}</Text>
        <Inline justify="end">
          <Button variant={confirmVariant} onPress={onConfirm}>
            {confirmLabel}
          </Button>
        </Inline>
      </Stack>
    </AdaptiveDialog>
  );
}

export type DangerDialogProps = ConfirmDialogProps & { phrase?: string };

export function DangerDialog(
  { phrase, description, onConfirm, ...props }: DangerDialogProps,
) {
  const [typed, setTyped] = useState("");
  const requiresPhrase = Boolean(phrase);
  return (
    <AdaptiveDialog {...props}>
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
        <Inline justify="end">
          <Button
            variant="danger"
            isDisabled={requiresPhrase && typed !== phrase}
            onPress={onConfirm}
          >
            {props.confirmLabel}
          </Button>
        </Inline>
      </Stack>
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
    <AriaDialogTrigger>
      {trigger}
      <AriaPopover className={cx("ds-popover", className)}>
        <AriaDialog aria-label={label}>{children}</AriaDialog>
      </AriaPopover>
    </AriaDialogTrigger>
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
    <AriaMenuTrigger>
      {trigger}
      <AriaPopover className="ds-menu">
        <AriaMenu aria-label={label}>
          {items.map((item) => (
            <AriaMenuItem
              key={item.id}
              id={item.id}
              textValue={item.label}
              isDisabled={item.disabled}
              className="ds-menu-item"
              onAction={() => onAction?.(item.id)}
            >
              {item.label}
            </AriaMenuItem>
          ))}
        </AriaMenu>
      </AriaPopover>
    </AriaMenuTrigger>
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
    <AriaTooltipTrigger>
      {trigger}
      <AriaTooltip className="ds-popover" aria-label={label}>
        {children}
      </AriaTooltip>
    </AriaTooltipTrigger>
  );
}

export type BannerProps = {
  children: ReactNode;
  tone?: Tone;
  title?: ReactNode;
  action?: ReactNode;
  className?: string;
};

export function Banner(
  { children, tone = "info", title, action, className }: BannerProps,
) {
  return (
    <div className={cx("ds-banner", className)} data-tone={tone} role="status">
      <Stack gap={2}>
        {title ? <strong>{title}</strong> : null}
        <Text>{children}</Text>
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
        <Text>{children}</Text>
        {action}
      </Stack>
    </div>
  );
}

export function Toast(
  { children, tone = "positive", className }: Omit<
    BannerProps,
    "title" | "action"
  >,
) {
  return (
    <div
      className={cx("ds-toast", "ds-status-message", className)}
      data-tone={tone}
      role="status"
      aria-live="polite"
    >
      {children}
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

export type ProgressProps =
  & Omit<AriaProgressBarProps, "className" | "children">
  & {
    label: string;
    value?: number;
    indeterminate?: boolean;
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
  return <Inline justify="end" className={className}>{children}</Inline>;
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

export function PeriodPicker(
  { value, onValueChange }: {
    value?: string;
    onValueChange?: (value: string) => void;
  },
) {
  return (
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
  );
}

export function ProjectPicker(
  { options, value, onValueChange }: {
    options: SelectOption[];
    value?: string;
    onValueChange?: (value: string) => void;
  },
) {
  return (
    <SelectField
      label="Project"
      options={options}
      value={value}
      onValueChange={onValueChange}
    />
  );
}

export function CurrencyPicker(
  { options, value, onValueChange }: {
    options: SelectOption[];
    value?: string;
    onValueChange?: (value: string) => void;
  },
) {
  return (
    <SelectField
      label="Currency"
      options={options}
      value={value}
      onValueChange={onValueChange}
    />
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
      <Button variant="quiet" onPress={() => onSelect?.(expense.id)}>
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
