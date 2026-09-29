import { Box as MantineBox } from "@mantine/core";
import { cx } from "../shared.ts";
import { MoneyText, type MoneyTextProps, Text } from "../primitives.tsx";

export type MoneySummaryItem = {
  label: string;
  amount: string;
  currency: string;
  tone?: MoneyTextProps["tone"];
};

export type MoneySummaryProps = {
  items: MoneySummaryItem[];
  className?: string;
};

export function MoneySummary(
  { items, className }: MoneySummaryProps,
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
