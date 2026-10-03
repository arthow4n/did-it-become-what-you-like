import { List } from "../primitives.tsx";
import { ExpenseRow, type ExpenseViewModel } from "./expense-row.tsx";

export type ExpenseListProps = {
  expenses: ExpenseViewModel[];
  showDate?: boolean;
  onSelect?: (id: string) => void;
};

export function ExpenseList(
  { expenses, showDate = true, onSelect }: ExpenseListProps,
) {
  return (
    <List label="Expenses">
      {expenses.map((expense) => (
        <ExpenseRow
          key={expense.id}
          expense={expense}
          showDate={showDate}
          onSelect={onSelect}
        />
      ))}
    </List>
  );
}
