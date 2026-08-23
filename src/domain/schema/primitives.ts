import Big from "big.js";
import { z } from "zod";

export const CURRENT_SCHEMA_VERSION = 1 as const;
export const DATASET_FORMAT = "did-it-become-what-you-like/dataset" as const;
export const UNCATEGORIZED_CATEGORY_ID = "category-uncategorized" as const;

const STABLE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._~-]{0,127}$/;
const DECIMAL_PATTERN = /^-?(?:\d+)(?:\.\d+)?$/;
const CALENDAR_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,3})?)?$/;

export const StableIdSchema = z.string().regex(
  STABLE_ID_PATTERN,
  "must be a stable URL-safe identifier",
);
export type StableId = z.infer<typeof StableIdSchema>;

export const CalendarDateSchema = z.string().superRefine((value, ctx) => {
  const match = CALENDAR_DATE_PATTERN.exec(value);
  if (!match) {
    ctx.addIssue({
      code: "custom",
      message: "must use YYYY-MM-DD calendar-date format",
    });
    return;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    ctx.addIssue({ code: "custom", message: "must be a real calendar date" });
  }
});
export type CalendarDate = z.infer<typeof CalendarDateSchema>;

export const TimeOfDaySchema = z.string().regex(
  TIME_PATTERN,
  "must use HH:mm, HH:mm:ss, or HH:mm:ss.SSS local time format",
);
export type TimeOfDay = z.infer<typeof TimeOfDaySchema>;

export const ExpenseDayBoundarySchema = z.string().regex(
  /^(?:[01]\d|2[0-3]):[0-5]\d$/,
  "must use HH:mm local time format",
);

export const InstantSchema = z.string().superRefine((value, ctx) => {
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value) ||
    Number.isNaN(Date.parse(value))
  ) {
    ctx.addIssue({
      code: "custom",
      message: "must be an ISO-8601 UTC instant",
    });
  }
});

export const CurrencyCodeSchema = z.string().regex(
  /^[A-Z]{3}$/,
  "must be an uppercase ISO 4217-style three-letter code",
);
export type CurrencyCode = z.infer<typeof CurrencyCodeSchema>;

export const NonEmptyTextSchema = z.string().trim().min(1).max(500);
export const OptionalTextSchema = NonEmptyTextSchema.optional();

export const CanonicalDecimalSchema = z.string().superRefine((value, ctx) => {
  try {
    canonicalDecimal(value);
  } catch (error) {
    ctx.addIssue({ code: "custom", message: String(error) });
  }
}).transform(canonicalDecimal);
export type CanonicalDecimal = z.infer<typeof CanonicalDecimalSchema>;

export function canonicalDecimal(value: string): string {
  if (!DECIMAL_PATTERN.test(value)) {
    throw new Error(
      "must be a base-10 decimal string without exponent, plus sign, or whitespace",
    );
  }
  Big.strict = true;
  const normalized = new Big(value).toString();
  return normalized === "-0" ? "0" : normalized;
}

export const RevisionNumberSchema = z.number().int().nonnegative();
export const PositiveIntegerSchema = z.number().int().positive();

export function parseCanonicalDecimal(value: unknown): CanonicalDecimal {
  return CanonicalDecimalSchema.parse(value);
}
