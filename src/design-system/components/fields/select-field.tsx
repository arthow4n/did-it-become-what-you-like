import { memo, startTransition, useCallback, useMemo } from "react";
import type { ComponentProps, ReactNode } from "react";
import { defaultOptionsFilter, Select as MantineSelect } from "@mantine/core";
import { useOpenState } from "../dialogs/shared.ts";
import { cx } from "../shared.ts";
import { type SelectOption, validationAttributes } from "./shared.ts";

const SELECT_COMBOBOX_PROPS = {
  withinPortal: false,
  // Retain the empty listbox so Mantine can establish its ARIA/keyboard target
  // before opening; the filter below omits its expensive option subtree.
  keepMounted: true,
  transitionProps: { duration: 0, exitDuration: 0 },
} as const;
const SELECT_CLASS_NAMES = {
  input: "ds-field-control ds-select-trigger",
  options: "ds-select-options",
} as const;

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

export const SelectField = memo(function SelectField({
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
  const [opened, setOpened] = useOpenState(isOpen, onOpenChange);
  const filter = useCallback<
    NonNullable<ComponentProps<typeof MantineSelect>["filter"]>
  >(
    (input) => opened ? defaultOptionsFilter(input) : [],
    [opened],
  );
  const selectedValue = value ??
    (selectedKey == null ? undefined : String(selectedKey));
  const defaultValue = explicitDefaultValue ??
    (defaultSelectedKey == null ? undefined : String(defaultSelectedKey));
  const data = useMemo(
    () =>
      options.map((option) => ({
        value: option.id,
        label: option.label,
        disabled: option.disabled,
      })),
    [options],
  );
  return (
    <MantineSelect
      {...mantineProps}
      dropdownOpened={opened}
      label={label}
      data={data}
      value={selectedValue}
      defaultValue={defaultValue}
      searchable={searchable}
      withScrollArea={false}
      filter={filter}
      openOnFocus={false}
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
      onDropdownOpen={() => startTransition(() => setOpened(true))}
      onDropdownClose={() => setOpened(false)}
      slot={slot ?? undefined}
      comboboxProps={SELECT_COMBOBOX_PROPS}
      className={cx("ds-field", className)}
      classNames={SELECT_CLASS_NAMES}
    />
  );
});
