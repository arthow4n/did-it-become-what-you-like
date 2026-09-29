import type { ComponentProps, ReactNode } from "react";
import { Select as MantineSelect } from "@mantine/core";
import { cx } from "../shared.ts";
import { type SelectOption, validationAttributes } from "./shared.ts";

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
