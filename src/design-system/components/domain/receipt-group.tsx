import {
  Button,
  Inline,
  MoneyText,
  type MoneyTextProps,
  Stack,
  Text,
} from "../primitives.tsx";
import { Disclosure } from "../dialogs.tsx";
import { ExpenseList } from "./expense-list.tsx";
import type { ExpenseViewModel } from "./expense-row.tsx";

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
  // Receipt groups already identify the merchant and date in their heading.
  // Each expanded line should therefore lead with its item description and omit
  // redundant date rendering; retain a merchant fallback for incomplete
  // legacy/gallery rows.
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
        <ExpenseList
          expenses={lineExpenses}
          showDate={false}
          onSelect={onSelectLine}
        />
      </Stack>
    </Disclosure>
  );
}
