import { memo, useMemo } from "react";
import type { ReactNode } from "react";
import { cx } from "../shared.ts";
import { Button, Stack } from "../primitives.tsx";
import { SelectField, type SelectOption } from "../fields.tsx";

export type CategoryPickerProps = {
  label?: ReactNode;
  categories: SelectOption[];
  value?: string;
  onValueChange?: (value: string) => void;
  error?: ReactNode;
  description?: ReactNode;
  isDisabled?: boolean;
  isRequired?: boolean;
  recentCategoryIds?: string[];
  maxQuickChips?: number;
  className?: string;
};

export const CategoryPicker = memo(function CategoryPicker({
  label = "Category",
  categories,
  value,
  onValueChange,
  error,
  description,
  isDisabled,
  isRequired,
  recentCategoryIds = [],
  maxQuickChips = 15,
  className,
}: CategoryPickerProps) {
  const quickOptions = useMemo(() => {
    const activeCategories = categories.filter((c) => !c.disabled);
    const result: SelectOption[] = [];
    const addedIds = new Set<string>();

    for (const id of recentCategoryIds) {
      const match = activeCategories.find((c) => c.id === id);
      if (match && !addedIds.has(match.id)) {
        result.push(match);
        addedIds.add(match.id);
        if (result.length >= maxQuickChips) break;
      }
    }

    if (result.length < maxQuickChips) {
      for (const cat of activeCategories) {
        if (!addedIds.has(cat.id)) {
          result.push(cat);
          addedIds.add(cat.id);
          if (result.length >= maxQuickChips) break;
        }
      }
    }

    return result;
  }, [categories, recentCategoryIds, maxQuickChips]);

  return (
    <Stack gap={2} className={cx("ds-category-picker", className)}>
      <SelectField
        label={label}
        options={categories}
        value={value}
        onValueChange={onValueChange}
        searchable
        placeholder="Search or select category"
        error={error}
        description={description}
        isDisabled={isDisabled}
        isRequired={isRequired}
      />
      {quickOptions.length > 0
        ? (
          <div
            className="ds-category-picker__chips"
            role="group"
            aria-label="Quick category suggestions"
          >
            {quickOptions.map((opt) => (
              <Button
                key={opt.id}
                type="button"
                variant={opt.id === value ? "primary" : "secondary"}
                isDisabled={isDisabled}
                className="ds-category-picker__chip"
                onPress={() => onValueChange?.(opt.id)}
              >
                {opt.label}
              </Button>
            ))}
          </div>
        )
        : null}
    </Stack>
  );
});
