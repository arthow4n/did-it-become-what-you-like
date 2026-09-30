import { memo } from "react";
import { Button, Stack } from "../primitives.tsx";
import { SearchField } from "../fields.tsx";

export type MerchantPickerProps = {
  value?: string;
  onValueChange?: (value: string) => void;
  isDisabled?: boolean;
  recentMerchants?: readonly string[];
};

export const MerchantPicker = memo(function MerchantPicker(
  { value, onValueChange, isDisabled, recentMerchants = [] }:
    MerchantPickerProps,
) {
  return (
    <Stack gap={2} className="ds-merchant-picker">
      <SearchField
        label="Merchant"
        value={value}
        onValueChange={onValueChange}
        isDisabled={isDisabled}
      />
      {recentMerchants.length > 0
        ? (
          <div
            className="ds-merchant-picker__chips"
            role="group"
            aria-label="Recent merchant suggestions"
          >
            {recentMerchants.map((merchant) => (
              <Button
                key={merchant}
                type="button"
                variant={merchant === value ? "primary" : "secondary"}
                isDisabled={isDisabled}
                className="ds-merchant-picker__chip"
                onPress={() => onValueChange?.(merchant)}
              >
                {merchant}
              </Button>
            ))}
          </div>
        )
        : null}
    </Stack>
  );
});
