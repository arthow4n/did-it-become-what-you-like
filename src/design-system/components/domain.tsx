import { memo, useMemo } from "react";
import type { ReactNode } from "react";
import { Box as MantineBox } from "@mantine/core";
import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Minus,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { cx } from "./shared.ts";
import {
  Badge,
  Button,
  Card,
  Chip,
  DefinitionList,
  Heading,
  IconButton,
  Inline,
  List,
  ListRow,
  MoneyText,
  type MoneyTextProps,
  ResponsiveGrid,
  Section,
  Stack,
  Text,
} from "./primitives.tsx";
import { FormActions, FormLayout, StickyActionBar } from "./layout.tsx";
import {
  Checkbox,
  DecimalField,
  NativeDateField,
  SearchField,
  SecretField,
  SelectField,
  type SelectOption,
  TextField,
} from "./fields.tsx";
import { AdaptiveDialog, Disclosure } from "./dialogs.tsx";
import { EmptyState, InlineNotice } from "./feedback.tsx";

export function FilterBar(
  { children, className }: { children: ReactNode; className?: string },
) {
  return (
    <MantineBox
      className={cx("ds-filter-bar", className)}
      role="group"
      aria-label="Filters"
    >
      {children}
    </MantineBox>
  );
}

export function ActiveFilterChips(
  { filters }: {
    filters: Array<{ id: string; label: string; onRemove: () => void }>;
  },
) {
  return (
    <Inline gap={2}>
      {filters.map((filter) => (
        <Chip key={filter.id} onRemove={filter.onRemove}>{filter.label}</Chip>
      ))}
    </Inline>
  );
}

export type FilterSheetProps = {
  trigger: ReactNode;
  children: ReactNode | ((close: () => void) => ReactNode);
  title?: ReactNode;
  applyLabel?: string;
  onApply?: () => void;
  resetLabel?: string;
  onReset?: () => void;
  isOpen?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
};

export function FilterSheet(
  {
    trigger,
    children,
    title = "Filters",
    applyLabel = "Apply filters",
    onApply,
    resetLabel = "Reset filters",
    onReset,
    isOpen,
    onOpenChange,
  }: FilterSheetProps,
) {
  return (
    <AdaptiveDialog
      trigger={trigger}
      title={title}
      isOpen={isOpen}
      onOpenChange={onOpenChange}
    >
      {(close) => (
        <Stack gap={4}>
          {typeof children === "function" ? children(close) : children}
          <FormActions>
            {onReset
              ? (
                <Button
                  variant="quiet"
                  onPress={() => {
                    onReset();
                    close();
                  }}
                >
                  {resetLabel}
                </Button>
              )
              : null}
            <Button
              variant="primary"
              onPress={() => {
                onApply?.();
                close();
              }}
            >
              {applyLabel}
            </Button>
          </FormActions>
        </Stack>
      )}
    </AdaptiveDialog>
  );
}

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
}: {
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
}) {
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

export function ProjectPicker(
  { options, value, onValueChange, className, isDisabled }: {
    options: SelectOption[];
    value?: string;
    onValueChange?: (value: string) => void;
    className?: string;
    isDisabled?: boolean;
  },
) {
  return (
    <SelectField
      label="Project"
      options={options}
      value={value}
      onValueChange={onValueChange}
      className={className}
      isDisabled={isDisabled}
    />
  );
}

export function CurrencyPicker(
  { label = "Currency", options, value, onValueChange, isDisabled }: {
    label?: ReactNode;
    options: SelectOption[];
    value?: string;
    onValueChange?: (value: string) => void;
    isDisabled?: boolean;
  },
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

export function MerchantPicker(
  { value, onValueChange, isDisabled }: {
    value?: string;
    onValueChange?: (value: string) => void;
    isDisabled?: boolean;
  },
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

export type MoneySummaryItem = {
  label: string;
  amount: string;
  currency: string;
  tone?: MoneyTextProps["tone"];
};

export function MoneySummary(
  { items, className }: { items: MoneySummaryItem[]; className?: string },
) {
  return (
    <MantineBox
      className={cx("ds-money-summary", className)}
      role="group"
      aria-label="Money summary"
    >
      {items.map((item) => (
        <MantineBox
          component="div"
          className="ds-money-summary__value"
          key={item.label}
        >
          <Text tone="secondary" size="label">{item.label}</Text>
          <MoneyText
            amount={item.amount}
            currency={item.currency}
            tone={item.tone}
          />
        </MantineBox>
      ))}
    </MantineBox>
  );
}

export type CategoryTotal = {
  id: string;
  name: string;
  amount: string;
  currency: string;
};

export function CategoryBreakdown(
  { categories, onSelect, onViewAll }: {
    categories: CategoryTotal[];
    onSelect?: (id: string) => void;
    onViewAll?: () => void;
  },
) {
  return (
    <Section>
      <Inline justify="space-between">
        <Heading size="sm">By category</Heading>
        {onViewAll
          ? <Button variant="quiet" onPress={onViewAll}>View all</Button>
          : null}
      </Inline>
      <List label="Category totals">
        {categories.map((category) => (
          <ListRow
            key={category.id}
            trailing={
              <MoneyText
                amount={category.amount}
                currency={category.currency}
              />
            }
          >
            <Button
              variant="quiet"
              onPress={() => onSelect?.(category.id)}
            >
              {category.name}
            </Button>
          </ListRow>
        ))}
      </List>
    </Section>
  );
}

export type ExpenseViewModel = {
  id: string;
  merchant?: string;
  description?: string;
  category: string;
  amount: string;
  currency: string;
  date: string;
  time?: string;
};

export function ExpenseRow(
  { expense, onSelect }: {
    expense: ExpenseViewModel;
    onSelect?: (id: string) => void;
  },
) {
  const primaryText = expense.description?.trim() || expense.merchant?.trim() ||
    "Untitled expense";
  const hasDistinctMerchant = Boolean(
    expense.merchant?.trim() && expense.description?.trim() &&
      expense.merchant?.trim() !== expense.description?.trim(),
  );

  return (
    <ListRow
      trailing={
        <MoneyText
          amount={expense.amount}
          currency={expense.currency}
          tone={expense.amount.startsWith("-") ? "negative" : "positive"}
        />
      }
    >
      <Button
        variant="quiet"
        className="ds-expense-row__trigger"
        onPress={() => onSelect?.(expense.id)}
      >
        <Stack gap={1}>
          <strong>{primaryText}</strong>
          {hasDistinctMerchant
            ? (
              <Text size="label" tone="secondary">
                {expense.merchant}
              </Text>
            )
            : null}
          <Text size="label" tone="secondary">
            {expense.category} · {expense.date}
            {expense.time ? ` · ${expense.time}` : ""}
          </Text>
        </Stack>
      </Button>
    </ListRow>
  );
}

export function ExpenseList(
  { expenses, onSelect }: {
    expenses: ExpenseViewModel[];
    onSelect?: (id: string) => void;
  },
) {
  return (
    <List label="Expenses">
      {expenses.map((expense) => (
        <ExpenseRow key={expense.id} expense={expense} onSelect={onSelect} />
      ))}
    </List>
  );
}

export type ReceiptGroupProps = {
  merchant: string;
  date: string;
  lines: ExpenseViewModel[];
  total: MoneyTextProps;
  /** Opens the receipt lines on first render without controlling later changes. */
  defaultExpanded?: boolean;
  onSelectLine?: (id: string) => void;
  onViewReceipt?: () => void;
};

export function ReceiptGroup(
  {
    merchant,
    date,
    lines,
    total,
    defaultExpanded,
    onSelectLine,
    onViewReceipt,
  }: ReceiptGroupProps,
) {
  // Receipt groups already identify the merchant in their heading. Each
  // expanded line should therefore lead with its item description; retain a
  // merchant fallback for incomplete legacy/gallery rows.
  const lineExpenses = lines.map((line) =>
    line.description?.trim() ? { ...line, merchant: undefined } : line
  );
  return (
    <Disclosure
      defaultExpanded={defaultExpanded}
      title={
        <Inline>
          <strong>{merchant}</strong>
          <Text tone="secondary">{date}</Text>
        </Inline>
      }
    >
      <Stack gap={3}>
        <MoneyText {...total} />
        {onViewReceipt
          ? (
            <Button
              variant="secondary"
              data-receipt-view="true"
              onPress={onViewReceipt}
            >
              View receipt
            </Button>
          )
          : null}
        <ExpenseList expenses={lineExpenses} onSelect={onSelectLine} />
      </Stack>
    </Disclosure>
  );
}

export function ReceiptReconciliation(
  {
    printed,
    selected,
    difference,
    currency,
    printedLabel = "Receipt total",
    selectedLabel = "Selected lines",
    mismatchMessage = "The selected lines do not yet match the printed total.",
  }: {
    printed: string;
    selected: string;
    difference: string;
    currency: string;
    printedLabel?: ReactNode;
    selectedLabel?: ReactNode;
    mismatchMessage?: ReactNode;
  },
) {
  return (
    <Card>
      <DefinitionList
        items={[{
          term: printedLabel,
          description: <MoneyText amount={printed} currency={currency} />,
        }, {
          term: selectedLabel,
          description: <MoneyText amount={selected} currency={currency} />,
        }, {
          term: "Difference",
          description: (
            <MoneyText
              amount={difference}
              currency={currency}
              tone={difference === "0" ? "positive" : "negative"}
            />
          ),
        }]}
      />
      {difference !== "0"
        ? (
          <InlineNotice tone="warning" title="Review totals before saving">
            {mismatchMessage}
          </InlineNotice>
        )
        : null}
    </Card>
  );
}

export function ReceiptSourcePicker(
  {
    preview,
    previews,
    onTakePhoto,
    onChooseImage,
    onRemove,
    emptyTitle = "No receipt selected",
    emptyDescription =
      "Choose an image or PDF, or take a photo to preview it before sending.",
    takePhotoLabel = "Take photo",
    chooseImageLabel = "Choose image",
  }: {
    preview?: ReactNode;
    previews?: readonly ReactNode[];
    onTakePhoto?: () => void;
    onChooseImage?: () => void;
    onRemove?: () => void;
    emptyTitle?: string;
    emptyDescription?: ReactNode;
    takePhotoLabel?: ReactNode;
    chooseImageLabel?: ReactNode;
  },
) {
  const hasPreviews = previews && previews.length > 0;
  return (
    <Stack gap={4}>
      {hasPreviews
        ? (
          <ResponsiveGrid columns={previews.length === 1 ? 1 : 2} gap={3}>
            {previews}
          </ResponsiveGrid>
        )
        : preview
        ? <Card>{preview}</Card>
        : (
          <EmptyState title={emptyTitle}>
            {emptyDescription}
          </EmptyState>
        )}
      <div className="ds-receipt-source-picker__actions">
        <div className="ds-receipt-source-picker__primary-actions">
          <Button variant="secondary" onPress={onTakePhoto}>
            {takePhotoLabel}
          </Button>
          <Button variant="secondary" onPress={onChooseImage}>
            {chooseImageLabel}
          </Button>
        </div>
        {(preview || hasPreviews) && onRemove
          ? <Button variant="quiet" onPress={onRemove}>Remove</Button>
          : null}
      </div>
    </Stack>
  );
}

export type ReceiptMetadataViewModel = {
  merchant?: string;
  date: string;
  time?: string;
  currency: string;
  printedTotal: string;
};

export function ReceiptMetadata(
  { metadata, onEdit, totalLabel = "Receipt total" }: {
    metadata: ReceiptMetadataViewModel;
    onEdit?: () => void;
    totalLabel?: ReactNode;
  },
) {
  const merchantName = metadata.merchant?.trim();
  return (
    <Card as="section">
      <Inline justify="space-between">
        <Stack gap={1}>
          {merchantName
            ? <Heading size="sm">{merchantName}</Heading>
            : (
              <Inline gap={2}>
                <Heading size="sm">No merchant</Heading>
                <Badge tone="warning">Not filled</Badge>
              </Inline>
            )}
          <Text tone="secondary">
            {metadata.date}
            {metadata.time ? ` · ${metadata.time}` : ""} · {metadata.currency}
          </Text>
        </Stack>
        {onEdit
          ? (
            <IconButton
              icon={<Pencil size={18} />}
              aria-label="Edit"
              variant="quiet"
              onPress={onEdit}
            />
          )
          : null}
      </Inline>
      <Inline justify="space-between">
        <Text tone="secondary">{totalLabel}</Text>
        <MoneyText
          amount={metadata.printedTotal}
          currency={metadata.currency}
        />
      </Inline>
    </Card>
  );
}

export type ReceiptLineViewModel = {
  id: string;
  type: "purchase" | "adjustment";
  description: string;
  category: string;
  amount: string;
  selected: boolean;
  uncertain: boolean;
  selectionReason?: string;
  classificationReason?: string;
  quantity?: string;
  unitPrice?: string;
  linkedLineDescription?: string;
};

export function ReceiptLineCard(
  {
    line,
    currency,
    mode = "review",
    isDisabled,
    onSelectedChange,
    onQuantityChange,
    onEdit,
    editControl,
    categoryControl,
    onRemove,
  }: {
    line: ReceiptLineViewModel;
    currency: string;
    mode?: "review" | "management" | "manual" | "menu";
    isDisabled?: boolean;
    onSelectedChange?: (selected: boolean) => void;
    onQuantityChange?: (quantity: string) => void;
    onEdit?: () => void;
    editControl?: ReactNode;
    categoryControl?: ReactNode;
    onRemove?: () => void;
  },
) {
  return (
    <Card as="section">
      <Inline justify="space-between">
        {mode === "management" || mode === "manual"
          ? <strong>{line.description || "Unclear item"}</strong>
          : (
            <Checkbox
              isSelected={line.selected}
              isDisabled={isDisabled}
              onChange={onSelectedChange}
            >
              <strong>{line.description || "Unclear item"}</strong>
            </Checkbox>
          )}
        <MoneyText
          amount={line.amount}
          currency={currency}
          tone={line.amount.startsWith("-") ? "negative" : "positive"}
        />
      </Inline>
      <Inline justify="space-between">
        <Stack gap={1}>
          {categoryControl ?? <Text tone="secondary">{line.category}</Text>}
          {line.quantity || line.unitPrice
            ? (
              <Text size="label" tone="muted">
                {line.quantity ?? "?"} × {line.unitPrice ?? "?"}
              </Text>
            )
            : null}
          {line.linkedLineDescription
            ? (
              <Text size="label" tone="secondary">
                Linked to {line.linkedLineDescription}
              </Text>
            )
            : null}
        </Stack>
        <Inline gap={1}>
          {onQuantityChange && line.type === "purchase"
            ? (
              <Inline gap={1} className="ds-quantity-stepper">
                <IconButton
                  icon={<Minus size={16} />}
                  aria-label={`Decrease quantity of ${
                    line.description || "item"
                  }`}
                  variant="quiet"
                  isDisabled={isDisabled || !line.selected}
                  onPress={() => {
                    const current = parseInt(line.quantity ?? "1", 10);
                    if (isNaN(current) || current <= 1) {
                      onSelectedChange?.(false);
                      onQuantityChange("0");
                    } else {
                      onQuantityChange(String(current - 1));
                    }
                  }}
                />
                <Text
                  style={{
                    minWidth: "1.25rem",
                    textAlign: "center",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {line.selected ? (line.quantity ?? "1") : "0"}
                </Text>
                <IconButton
                  icon={<Plus size={16} />}
                  aria-label={`Increase quantity of ${
                    line.description || "item"
                  }`}
                  variant="quiet"
                  isDisabled={isDisabled}
                  onPress={() => {
                    if (!line.selected) {
                      onSelectedChange?.(true);
                      onQuantityChange(
                        line.quantity && line.quantity !== "0"
                          ? line.quantity
                          : "1",
                      );
                    } else {
                      const current = parseInt(line.quantity ?? "1", 10);
                      onQuantityChange(
                        String(isNaN(current) ? 1 : current + 1),
                      );
                    }
                  }}
                />
              </Inline>
            )
            : null}
          {editControl}
          {editControl === undefined && onEdit
            ? (
              <IconButton
                icon={<Pencil size={18} />}
                aria-label="Edit"
                variant="quiet"
                isDisabled={isDisabled}
                onPress={onEdit}
              />
            )
            : null}
          {onRemove
            ? (
              <IconButton
                icon={<Trash2 size={18} />}
                aria-label="Remove"
                variant="quiet"
                isDisabled={isDisabled}
                onPress={onRemove}
              />
            )
            : null}
        </Inline>
      </Inline>
      {line.uncertain
        ? (
          <InlineNotice tone="warning" title="Review this line">
            {line.selectionReason ??
              "The extraction was uncertain. Check the details before selecting it."}
          </InlineNotice>
        )
        : null}
      {line.classificationReason
        ? (
          <Text size="label" tone="muted">
            AI classification: {line.classificationReason}
          </Text>
        )
        : null}
    </Card>
  );
}

export type ReceiptLineEditorValue = {
  type: "purchase" | "adjustment";
  description: string;
  categoryId: string;
  amount: string;
  quantity?: string;
  unitPrice?: string;
  lineId?: string;
};

export function ReceiptLineEditor(
  { value, categories, linkOptions = [], onChange, manual = false }: {
    value: ReceiptLineEditorValue;
    categories: SelectOption[];
    linkOptions?: SelectOption[];
    onChange: (value: ReceiptLineEditorValue) => void;
    manual?: boolean;
  },
) {
  return (
    <Stack gap={4}>
      <TextField
        label="Description"
        isRequired
        value={value.description}
        onChange={(description) => onChange({ ...value, description })}
      />
      <CategoryPicker
        label="Category"
        categories={categories}
        value={value.categoryId}
        onValueChange={(categoryId) => onChange({ ...value, categoryId })}
      />
      <DecimalField
        label={manual
          ? value.type === "adjustment" ? "Adjustment" : "Amount paid"
          : value.type === "adjustment"
          ? "Signed adjustment"
          : "Line total"}
        value={value.amount}
        onChange={(amount) => onChange({ ...value, amount })}
        description={manual
          ? "Enter the positive amount paid for this item."
          : "Enter the signed amount exactly as printed."}
      />
      {value.type === "purchase"
        ? (
          <Inline>
            <DecimalField
              label="Quantity (optional)"
              value={value.quantity ?? ""}
              onChange={(quantity) => onChange({ ...value, quantity })}
            />
            <TextField
              label="Unit price (optional)"
              value={value.unitPrice ?? ""}
              onChange={(unitPrice) => onChange({ ...value, unitPrice })}
              inputMode="decimal"
              type="text"
              description="Preserve the printed unit price when known."
            />
          </Inline>
        )
        : (
          <SelectField
            label="Link to purchase (optional)"
            options={[
              { id: "", label: "Receipt-wide adjustment" },
              ...linkOptions,
            ]}
            value={value.lineId ?? ""}
            onValueChange={(lineId) =>
              onChange({ ...value, lineId: lineId || undefined })}
          />
        )}
    </Stack>
  );
}

export type ModelViewModel = SelectOption & {
  reason?: string;
};

export function ModelPicker(
  { options, value, onValueChange, disabled = false }: {
    options: ModelViewModel[];
    value?: string;
    onValueChange?: (value: string) => void;
    disabled?: boolean;
  },
) {
  return (
    <SelectField
      label="Model"
      options={options.map((option) => ({
        id: option.id,
        label: option.label,
        disabled: option.disabled,
      }))}
      value={value}
      onValueChange={onValueChange}
      isDisabled={disabled}
      searchable
      placeholder="Search models"
      className="ds-model-picker"
      renderOption={(option) => {
        const model = options.find((candidate) => candidate.id === option.id);
        return (
          <Stack gap={1}>
            <span>{option.label}</span>
            <Text size="label" tone="secondary">
              {model?.reason ?? ""}
            </Text>
          </Stack>
        );
      }}
    />
  );
}

export function ReceiptQuickSetup(
  {
    providerName,
    providerDisclosure,
    value,
    onChange,
    onSave,
    error,
    busy,
    showHeading = true,
    autoFocus = false,
  }: {
    providerName: string;
    providerDisclosure?: ReactNode;
    value: string;
    onChange: (value: string) => void;
    onSave: () => void;
    error?: string;
    busy?: boolean;
    showHeading?: boolean;
    autoFocus?: boolean;
  },
) {
  return (
    <Card as="section">
      <Stack gap={4}>
        {showHeading
          ? <Heading size="sm">Set up {providerName}</Heading>
          : null}
        <SecretField
          label="API key"
          autoFocus={autoFocus}
          value={value}
          onChange={onChange}
          description="Stored on this device. It is not a browser secret and can be read by code running on this origin."
          error={error}
        />
        <InlineNotice tone="warning" title="Before you continue">
          The selected receipt image, extraction schema and instructions, active
          category IDs and names, device locale, and project currency code are
          sent to {providerName}. {providerDisclosure}{" "}
          Expense history, project names, Drive data, other device details, and
          sync metadata are excluded. The image is used only for this scan and
          is not uploaded publicly or stored by this app.
        </InlineNotice>
        <FormActions>
          <Button
            pending={busy}
            isDisabled={busy || value.trim().length === 0}
            onPress={onSave}
          >
            Save and continue
          </Button>
        </FormActions>
      </Stack>
    </Card>
  );
}

export function ExpenseForm(
  { children, status, actions, stickyActions = false }: {
    children?: ReactNode;
    status?: ReactNode;
    actions?: ReactNode;
    stickyActions?: boolean;
  },
) {
  return (
    <FormLayout>
      {status}
      {children}
      {actions
        ? (stickyActions
          ? (
            <StickyActionBar className="ds-form-actions--sticky">
              {actions}
            </StickyActionBar>
          )
          : <FormActions>{actions}</FormActions>)
        : null}
    </FormLayout>
  );
}
