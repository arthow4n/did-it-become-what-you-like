import { DecimalField, type DecimalFieldProps } from "./decimal-field.tsx";

export type MoneyFieldProps = DecimalFieldProps & { currency: string };

export function MoneyField(
  { currency: _currency, ...props }: MoneyFieldProps,
) {
  return <DecimalField {...props} />;
}
