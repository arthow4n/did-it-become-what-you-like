import {
  startTransition,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import type {
  ChangeEvent,
  ComponentProps,
  FocusEvent,
  KeyboardEvent,
  ReactNode,
  Ref,
} from "react";
import {
  ActionIcon as MantineActionIcon,
  Checkbox as MantineCheckbox,
  Input as MantineInput,
  PasswordInput as MantinePasswordInput,
  Radio as MantineRadio,
  RadioGroup as MantineRadioGroup,
  SegmentedControl as MantineSegmentedControl,
  Select as MantineSelect,
  Switch as MantineSwitch,
  Textarea as MantineTextarea,
  TextInput as MantineTextInput,
} from "@mantine/core";
import {
  DateInput as MantineDateInput,
  TimeInput as MantineTimeInput,
} from "@mantine/dates";
import { Dropzone as MantineDropzone } from "@mantine/dropzone";
import { useMergedRef } from "@mantine/hooks";
import { X } from "lucide-react";
import { cx } from "./shared.ts";
import { Icon } from "./primitives.tsx";

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
  validationBehavior?: ValidationBehavior;
  slot?: string;
};

type ValidationBehavior = "aria" | "native";

type ValidationAttributes = {
  required?: boolean;
  "aria-required"?: "true";
};

function validationAttributes(
  isRequired: boolean | undefined,
  validationBehavior: ValidationBehavior | undefined,
  supportsNativeValidation = true,
): ValidationAttributes {
  if (!isRequired) return {};
  if (validationBehavior === "aria" || !supportsNativeValidation) {
    return { "aria-required": "true" };
  }
  return { required: true };
}

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
  validationBehavior,
  slot,
  ...props
}: SharedTextFieldProps) {
  const mantineProps = props as unknown as ComponentProps<
    typeof MantineTextInput
  >;
  const validation = validationAttributes(isRequired, validationBehavior);
  return (
    <MantineTextInput
      {...mantineProps}
      label={label}
      placeholder={placeholder}
      description={description}
      error={error}
      {...validation}
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
    validationBehavior,
    slot,
    ...props
  }: TextAreaProps,
) {
  const mantineProps = props as unknown as ComponentProps<
    typeof MantineTextarea
  >;
  const validation = validationAttributes(isRequired, validationBehavior);
  return (
    <MantineTextarea
      {...mantineProps}
      label={label}
      placeholder={placeholder}
      description={description}
      error={error}
      {...validation}
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
    validationBehavior,
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
  const validation = validationAttributes(isRequired, validationBehavior);
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
      {...validation}
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
    validationBehavior,
    slot,
    ...props
  }: SecretFieldProps,
) {
  const [revealed, setRevealed] = useState(false);
  const mantineProps = props as unknown as ComponentProps<
    typeof MantinePasswordInput
  >;
  const validation = validationAttributes(isRequired, validationBehavior);
  return (
    <MantinePasswordInput
      {...mantineProps}
      label={label}
      placeholder={placeholder}
      description={description}
      error={error}
      {...validation}
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

export function DecimalField({
  value,
  defaultValue,
  onChange,
  onBlur,
  ...props
}: DecimalFieldProps) {
  const [localValue, setLocalValue] = useState(value ?? defaultValue ?? "");
  const pendingValuesRef = useRef(new Set<string>());

  useEffect(() => {
    const nextPropValue = value ?? "";
    if (pendingValuesRef.current.has(nextPropValue)) {
      pendingValuesRef.current.delete(nextPropValue);
      return;
    }
    pendingValuesRef.current.clear();
    setLocalValue(nextPropValue);
  }, [value]);

  const handleChange = useCallback((nextValue: string) => {
    pendingValuesRef.current.add(nextValue);
    setLocalValue(nextValue);
    startTransition(() => {
      onChange?.(nextValue);
    });
  }, [onChange]);

  const handleBlur = useCallback((event: FocusEvent<HTMLInputElement>) => {
    onBlur?.(event);
  }, [onBlur]);

  return (
    <TextField
      {...props}
      value={localValue}
      onChange={handleChange}
      onBlur={handleBlur}
      inputMode="decimal"
      type="text"
    />
  );
}

export type MoneyFieldProps = DecimalFieldProps & { currency: string };

export function MoneyField(
  { currency: _currency, ...props }: MoneyFieldProps,
) {
  return <DecimalField {...props} />;
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
    inputRef?: Ref<HTMLInputElement>;
    openRef?: Ref<() => void | undefined>;
    className?: string;
  };

export function FileField(
  {
    label,
    description,
    className,
    id,
    ref: publicRef,
    onChange,
    onReject,
    inputRef,
    openRef,
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
  const nativeInputRef = useMergedRef(inputRef, publicRef);
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
        openRef={openRef}
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
          ref: nativeInputRef,
          id: controlId,
          accept,
          capture,
          multiple,
          disabled,
        } as ComponentProps<"input">}
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
  searchable?: boolean;
  renderOption?: (option: SelectOption) => ReactNode;
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
  validationBehavior,
  isOpen,
  onOpenChange,
  slot,
  searchable = false,
  renderOption,
  ...props
}: SelectFieldProps) {
  const mantineProps = props as unknown as ComponentProps<typeof MantineSelect>;
  const validation = validationAttributes(isRequired, validationBehavior);
  const openState = isOpen === undefined ? {} : { dropdownOpened: isOpen };
  const selectedValue = value ??
    (selectedKey == null ? undefined : String(selectedKey));
  const defaultValue = explicitDefaultValue ??
    (defaultSelectedKey == null ? undefined : String(defaultSelectedKey));
  return (
    <MantineSelect
      {...mantineProps}
      {...openState}
      label={label}
      data={options.map((option) => ({
        value: option.id,
        label: option.label,
        disabled: option.disabled,
      }))}
      value={selectedValue}
      defaultValue={defaultValue}
      searchable={searchable}
      renderOption={renderOption
        ? ({ option }) => {
          const selected = options.find((candidate) =>
            candidate.id === String(option.value)
          );
          return renderOption(
            selected ?? {
              id: String(option.value),
              label: option.label,
              disabled: option.disabled,
            },
          );
        }
        : undefined}
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
      {...validation}
      aria-invalid={Boolean(error) || isInvalid ? "true" : undefined}
      onDropdownOpen={onOpenChange ? () => onOpenChange(true) : undefined}
      onDropdownClose={onOpenChange ? () => onOpenChange(false) : undefined}
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
  validationBehavior,
  slot,
  ...props
}: CheckboxProps) {
  const mantineProps = props as unknown as ComponentProps<
    typeof MantineCheckbox
  >;
  const validation = validationAttributes(isRequired, validationBehavior);
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
      {...validation}
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
    validationBehavior,
    name,
    slot,
    ...props
  }: RadioGroupProps,
) {
  const validation = validationAttributes(isRequired, validationBehavior);
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
      {...validation}
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
          required={validation.required}
          aria-required={validation["aria-required"]}
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
  validationBehavior,
  slot,
  ...props
}: SwitchProps) {
  const mantineProps = props as unknown as ComponentProps<typeof MantineSwitch>;
  const validation = validationAttributes(isRequired, validationBehavior);
  return (
    <MantineSwitch
      {...mantineProps}
      label={children}
      checked={isSelected}
      defaultChecked={defaultSelected}
      onChange={(event) => onChange?.(event.currentTarget.checked)}
      disabled={isDisabled}
      readOnly={isReadOnly}
      {...validation}
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
  isRequired?: boolean;
  isInvalid?: boolean;
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
    isRequired,
    isInvalid,
    name,
    slot,
    validationBehavior,
    ...props
  }: SegmentedControlProps,
) {
  const validation = validationAttributes(
    isRequired,
    validationBehavior,
    false,
  );
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
      {...validation}
      aria-invalid={isInvalid ? "true" : undefined}
      slot={slot ?? undefined}
      className={cx("ds-segmented-control", className)}
      data-full-width={fullWidth ? "true" : undefined}
    />
  );
}
