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

export type CurrencyPickerProps = {
  label?: ReactNode;
  options: SelectOption[];
  value?: string;
  onValueChange?: (value: string) => void;
  isDisabled?: boolean;
};

export function CurrencyPicker(
  { label = "Currency", options, value, onValueChange, isDisabled }:
    CurrencyPickerProps,
) {
  const currencyOptions = currencyOptionsWithIso(options, value);
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
}
