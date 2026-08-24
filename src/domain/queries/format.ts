import {
  type CalendarDate,
  CalendarDateSchema,
  type CanonicalDecimal,
  canonicalDecimal,
  type CurrencyCode,
} from "../schema/index.ts";

function decimalParts(value: CanonicalDecimal): {
  sign: "" | "-";
  integer: string;
  fraction: string;
} {
  const canonical = canonicalDecimal(value);
  const sign = canonical.startsWith("-") ? "-" : "";
  const unsigned = canonical.replace(/^-/, "");
  const [integer = "0", fraction = ""] = unsigned.split(".");
  return { sign, integer, fraction };
}

/** Formats a canonical decimal without converting it through Number. */
export function formatDecimal(value: CanonicalDecimal): string {
  const { sign, integer, fraction } = decimalParts(value);
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${sign}${grouped}${fraction ? `.${fraction}` : ""}`;
}

/** Formats a signed amount in the same code-first form used by the UI. */
export function formatMoney(
  amount: CanonicalDecimal,
  currency: CurrencyCode,
): string {
  return `${currency} ${formatDecimal(amount)}`;
}

/** A calendar date formatter that cannot shift the stored date by timezone. */
export function formatStoredCalendarDate(
  date: CalendarDate,
  locale = "en-US",
): string {
  CalendarDateSchema.parse(date);
  const [year, month, day] = date.split("-").map(Number);
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}
