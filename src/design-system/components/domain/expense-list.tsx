import { List } from "../primitives.tsx";
import { ExpenseRow, type ExpenseViewModel } from "./expense-row.tsx";

export type ExpenseListProps = {
  expenses: ExpenseViewModel[];
  onSelect?: (id: string) => void;
};

export function ExpenseList(
  { expenses, onSelect }: ExpenseListProps,
) {
  return (
    <List label="Expenses">
      {expenses.map((expense) => (
        <ExpenseRow key={expense.id} expense={expense} onSelect={onSelect} />
      ))}
    </List>
  );
}
