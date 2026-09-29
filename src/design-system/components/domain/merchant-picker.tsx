import { SearchField } from "../fields.tsx";

export type MerchantPickerProps = {
  value?: string;
  onValueChange?: (value: string) => void;
  isDisabled?: boolean;
};

export function MerchantPicker(
  { value, onValueChange, isDisabled }: MerchantPickerProps,
) {
  return (
    <SearchField
      label="Merchant"
      value={value}
      onValueChange={onValueChange}
      isDisabled={isDisabled}
    />
  );
}
