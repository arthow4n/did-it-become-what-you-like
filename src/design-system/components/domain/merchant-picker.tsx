import { memo, useCallback } from "react";
import type { FocusEventHandler } from "react";
import { Button, Stack } from "../primitives.tsx";
import { SearchField } from "../fields.tsx";

export type MerchantPickerProps = {
  value?: string;
  onValueChange?: (value: string) => void;
  onBlur?: FocusEventHandler<HTMLInputElement>;
  isDisabled?: boolean;
  recentMerchants?: readonly string[];
};

const MerchantChip = memo(function MerchantChip({
  merchant,
  isSelected,
  isDisabled,
  onSelect,
}: {
  merchant: string;
  isSelected: boolean;
  isDisabled?: boolean;
  onSelect?: (merchant: string) => void;
}) {
  const handlePress = useCallback(() => {
    onSelect?.(merchant);
  }, [merchant, onSelect]);
  return (
    <Button
      type="button"
      variant={isSelected ? "primary" : "secondary"}
      isDisabled={isDisabled}
      className="ds-merchant-picker__chip"
      onPress={handlePress}
    >
      {merchant}
    </Button>
  );
});

export const MerchantPicker = memo(function MerchantPicker(
  { value, onValueChange, onBlur, isDisabled, recentMerchants = [] }:
    MerchantPickerProps,
) {
  return (
    <Stack gap={2} className="ds-merchant-picker">
      <SearchField
        label="Merchant"
        value={value}
        onValueChange={onValueChange}
        onBlur={onBlur}
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
              <MerchantChip
                key={merchant}
                merchant={merchant}
                isSelected={merchant === value}
                isDisabled={isDisabled}
                onSelect={onValueChange}
              />
            ))}
          </div>
        )
        : null}
    </Stack>
  );
});
