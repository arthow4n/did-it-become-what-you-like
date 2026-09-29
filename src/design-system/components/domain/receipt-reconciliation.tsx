import type { ReactNode } from "react";
import { Card, DefinitionList, MoneyText } from "../primitives.tsx";
import { InlineNotice } from "../feedback.tsx";

export type ReceiptReconciliationProps = {
  printed: string;
  selected: string;
  difference: string;
  currency: string;
  printedLabel?: ReactNode;
  selectedLabel?: ReactNode;
  mismatchMessage?: ReactNode;
};

export function ReceiptReconciliation(
  {
    printed,
    selected,
    difference,
    currency,
    printedLabel = "Receipt total",
    selectedLabel = "Selected lines",
    mismatchMessage = "The selected lines do not yet match the printed total.",
  }: ReceiptReconciliationProps,
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
