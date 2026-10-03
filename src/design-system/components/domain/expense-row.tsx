import { Button, ListRow, MoneyText, Stack, Text } from "../primitives.tsx";

export type ExpenseViewModel = {
  id: string;
  merchant?: string;
  description?: string;
  category: string;
  amount: string;
  currency: string;
  date?: string;
  time?: string;
};

export type ExpenseRowProps = {
  expense: ExpenseViewModel;
  showDate?: boolean;
  onSelect?: (id: string) => void;
};

export function ExpenseRow(
  { expense, showDate = true, onSelect }: ExpenseRowProps,
) {
  const primaryText = expense.description?.trim() || expense.merchant?.trim() ||
    "Untitled expense";
  const hasDistinctMerchant = Boolean(
    expense.merchant?.trim() && expense.description?.trim() &&
      expense.merchant?.trim() !== expense.description?.trim(),
  );
  const shouldRenderDate = showDate && Boolean(expense.date);

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
            {expense.category}
          </Text>
          {shouldRenderDate
            ? (
              <Text size="label" tone="secondary">
                {expense.date}
                {expense.time ? ` · ${expense.time}` : ""}
              </Text>
            )
            : null}
        </Stack>
      </Button>
    </ListRow>
  );
}
