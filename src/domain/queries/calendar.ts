import { type CalendarDate, CalendarDateSchema } from "../schema/index.ts";
import type { CalendarPeriodUnit, ExpensePeriod } from "./types.ts";

type PeriodBounds = {
  readonly start: CalendarDate;
  readonly end: CalendarDate;
};

function compareCodeUnits(left: string, right: string): number {
  const length = Math.min(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const difference = left.charCodeAt(index) - right.charCodeAt(index);
    if (difference !== 0) return difference;
  }
  return left.length - right.length;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function assertYear(year: number): void {
  if (!Number.isInteger(year) || year < 1 || year > 9999) {
    throw new Error("calendar year must be an integer from 1 through 9999");
  }
}

function assertMonth(month: number): void {
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error("calendar month must be an integer from 1 through 12");
  }
}

function makeDate(year: number, month: number, day: number): CalendarDate {
  const value = `${String(year).padStart(4, "0")}-${pad(month)}-${pad(day)}`;
  return CalendarDateSchema.parse(value);
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function periodBoundsForUnit(
  unit: CalendarPeriodUnit,
  date: CalendarDate,
): PeriodBounds {
  const [yearText, monthText] = date.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  if (unit === "day") return { start: date, end: date };
  if (unit === "month") {
    return {
      start: makeDate(year, month, 1),
      end: makeDate(year, month, daysInMonth(year, month)),
    };
  }
  return {
    start: makeDate(year, 1, 1),
    end: makeDate(year, 12, 31),
  };
}

/**
 * Returns the stored calendar date for a local wall-clock instant. The
 * boundary is intentionally evaluated with local Date getters; the result is
 * a stable calendar date string and is never converted from a record's date.
 */
export function expenseDateForLocalNow(
  now: Date,
  boundary: string,
): CalendarDate {
  if (Number.isNaN(now.getTime())) throw new Error("now must be a valid date");
  const boundaryMatch = /^(\d{2}):(\d{2})$/.exec(boundary);
  if (!boundaryMatch) throw new Error("expense-day boundary must use HH:mm");
  const boundaryHour = Number(boundaryMatch[1]);
  const boundaryMinute = Number(boundaryMatch[2]);
  if (boundaryHour > 23 || boundaryMinute > 59) {
    throw new Error("expense-day boundary must use a valid local time");
  }

  const localDate = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );
  const beforeBoundary = now.getHours() * 60 + now.getMinutes() <
    boundaryHour * 60 + boundaryMinute;
  if (beforeBoundary) localDate.setDate(localDate.getDate() - 1);
  return makeDate(
    localDate.getFullYear(),
    localDate.getMonth() + 1,
    localDate.getDate(),
  );
}

export function boundsForPeriod(
  period: ExpensePeriod,
  boundary: string,
): PeriodBounds {
  if (period.kind === "current") {
    const date = expenseDateForLocalNow(period.now, boundary);
    return periodBoundsForUnit(period.unit, date);
  }
  if (period.kind === "day") {
    CalendarDateSchema.parse(period.date);
    return { start: period.date, end: period.date };
  }
  assertYear(period.year);
  if (period.kind === "month") {
    assertMonth(period.month);
    return periodBoundsForUnit(
      "month",
      makeDate(period.year, period.month, 1),
    );
  }
  return periodBoundsForUnit("year", makeDate(period.year, 1, 1));
}

export function calendarDateInBounds(
  date: CalendarDate,
  bounds: PeriodBounds,
): boolean {
  CalendarDateSchema.parse(date);
  return compareCodeUnits(date, bounds.start) >= 0 &&
    compareCodeUnits(date, bounds.end) <= 0;
}

export function isCalendarDate(value: string): value is CalendarDate {
  return CalendarDateSchema.safeParse(value).success;
}

export function formatCalendarDate(
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
