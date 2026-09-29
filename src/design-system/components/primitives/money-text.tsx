import { cx } from "../shared.ts";

export type MoneyTextProps = {
  amount: string | number;
  currency: string;
  tone?: "neutral" | "positive" | "negative";
  className?: string;
};

export function formatMoney(amount: string | number, currency: string): string {
  const raw = String(amount).trim();
  const sign = raw.startsWith("-") ? "-" : raw.startsWith("+") ? "+" : "";
  const unsigned = raw.replace(/^[+-]/, "");
  const [integer = "0", fraction] = unsigned.split(".");
  const grouped = integer.replace(/^0+(?=\d)/, "").replace(
    /\B(?=(\d{3})+(?!\d))/g,
    ",",
  );
  const formattedFraction = fraction !== undefined
    ? (fraction.length === 1 ? `${fraction}0` : fraction)
    : "";
  return `${currency} ${sign}${grouped || "0"}${
    formattedFraction ? `.${formattedFraction}` : ""
  }`;
}

export function MoneyText(
  { amount, currency, tone, className }: MoneyTextProps,
) {
  const stringAmount = String(amount);
  const normalizedAmount = stringAmount.trim();
  const resolvedTone = tone ??
    (normalizedAmount.startsWith("+") ||
        (!normalizedAmount.startsWith("-") && normalizedAmount !== "0")
      ? "positive"
      : normalizedAmount.startsWith("-")
      ? "negative"
      : "neutral");
  const displayAmount = resolvedTone === "positive" &&
      !normalizedAmount.startsWith("+") &&
      !normalizedAmount.startsWith("-") &&
      /[1-9]/.test(normalizedAmount)
    ? `+${normalizedAmount}`
    : normalizedAmount;
  return (
    <span className={cx("ds-money", className)} data-tone={resolvedTone}>
      {formatMoney(displayAmount, currency)}
    </span>
  );
}
