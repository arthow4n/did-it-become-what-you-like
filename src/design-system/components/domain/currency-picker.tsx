import { memo, useMemo } from "react";
import type { ReactNode } from "react";
import { SelectField, type SelectOption } from "../fields.tsx";

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

const ISO_CURRENCY_OPTIONS: readonly SelectOption[] = (() => {
  const intlWithCurrencyValues = Intl as typeof Intl & {
    supportedValuesOf?: (key: string) => string[];
  };
  const codes = intlWithCurrencyValues.supportedValuesOf?.("currency") ??
    FALLBACK_ISO_CURRENCY_CODES;
  return codes.map((code) => ({ id: code, label: code }));
})();

function buildBaseCurrencyOptions(
  options: SelectOption[],
): { list: SelectOption[]; ids: Set<string> } {
  const byId = new Map<string, SelectOption>();
  for (const option of options) byId.set(option.id, option);
  for (const option of ISO_CURRENCY_OPTIONS) {
    if (!byId.has(option.id)) byId.set(option.id, option);
  }
  return { list: [...byId.values()], ids: new Set(byId.keys()) };
}

export type CurrencyPickerProps = {
  label?: ReactNode;
  options: SelectOption[];
  value?: string;
  onValueChange?: (value: string) => void;
  isDisabled?: boolean;
};

export const CurrencyPicker = memo(function CurrencyPicker(
  { label = "Currency", options, value, onValueChange, isDisabled }:
    CurrencyPickerProps,
) {
  const base = useMemo(() => buildBaseCurrencyOptions(options), [options]);
  const currencyOptions = useMemo(() => {
    if (!value || base.ids.has(value)) return base.list;
    return [
      ...options,
      { id: value, label: value },
      ...ISO_CURRENCY_OPTIONS.filter((opt) =>
        opt.id !== value && !options.some((o) => o.id === opt.id)
      ),
    ];
  }, [base, options, value]);
  return (
    <SelectField
      label={label}
      options={currencyOptions}
      value={value}
      onValueChange={onValueChange}
      searchable
      placeholder="Search ISO currency"
      className="ds-currency-picker"
      isDisabled={isDisabled}
    />
  );
});
