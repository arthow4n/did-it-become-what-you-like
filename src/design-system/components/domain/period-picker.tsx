import { CalendarClock, ChevronLeft, ChevronRight } from "lucide-react";
import { IconButton, Inline, Stack, Text } from "../primitives.tsx";
import { NativeDateField, SelectField } from "../fields.tsx";

export type PeriodPickerProps = {
  value?: string;
  onValueChange?: (value: string) => void;
  customKind?: "day" | "month" | "year";
  customDate?: string;
  onCustomKindChange?: (value: "day" | "month" | "year") => void;
  onCustomDateChange?: (value: string) => void;
  periodLabel?: string;
  previousLabel?: string;
  nextLabel?: string;
  onPrevious?: () => void;
  onNext?: () => void;
  onReturnToCurrent?: () => void;
  returnToCurrentLabel?: string;
  isNextDisabled?: boolean;
};

export function PeriodPicker({
  value,
  onValueChange,
  customKind = "day",
  customDate = "",
  onCustomKindChange,
  onCustomDateChange,
  periodLabel,
  previousLabel,
  nextLabel,
  onPrevious,
  onNext,
  onReturnToCurrent,
  returnToCurrentLabel,
  isNextDisabled = false,
}: PeriodPickerProps) {
  const showsNavigator = Boolean(
    periodLabel && previousLabel && nextLabel && onPrevious && onNext,
  );
  return (
    <Stack gap={2} className="ds-period-picker">
      {showsNavigator
        ? (
          <div className="ds-period-picker__navigator">
            <SelectField
              className="ds-period-picker__mode"
              label="Period"
              value={value}
              onValueChange={(next) => onValueChange?.(next)}
              options={[
                { id: "today", label: "Day" },
                { id: "month", label: "Month" },
                { id: "year", label: "Year" },
                { id: "custom", label: "Custom" },
              ]}
            />
            <IconButton
              icon={<ChevronLeft />}
              aria-label={previousLabel!}
              variant="secondary"
              onPress={onPrevious}
            />
            <Text className="ds-period-picker__label">{periodLabel}</Text>
            {returnToCurrentLabel
              ? (
                <IconButton
                  icon={<CalendarClock size={18} />}
                  aria-label={returnToCurrentLabel}
                  title={returnToCurrentLabel}
                  variant="quiet"
                  isDisabled={!onReturnToCurrent}
                  onPress={onReturnToCurrent}
                />
              )
              : null}
            <IconButton
              icon={<ChevronRight />}
              aria-label={nextLabel!}
              variant="secondary"
              isDisabled={isNextDisabled}
              onPress={onNext}
            />
          </div>
        )
        : (
          <SelectField
            label="Period"
            value={value}
            onValueChange={(next) => onValueChange?.(next)}
            options={[
              { id: "today", label: "Day" },
              { id: "month", label: "Month" },
              { id: "year", label: "Year" },
              { id: "custom", label: "Custom" },
            ]}
          />
        )}
      {value === "custom"
        ? (
          <Inline gap={2}>
            <SelectField
              label="Custom period type"
              options={[
                { id: "day", label: "Day" },
                { id: "month", label: "Month" },
                { id: "year", label: "Year" },
              ]}
              value={customKind}
              onValueChange={(next) =>
                onCustomKindChange?.(next as "day" | "month" | "year")}
            />
            <NativeDateField
              label="Custom calendar date"
              value={customDate}
              onChange={(event) => onCustomDateChange?.(event.target.value)}
              description="Day uses the date; month and year use its calendar period."
            />
          </Inline>
        )
        : null}
    </Stack>
  );
}
