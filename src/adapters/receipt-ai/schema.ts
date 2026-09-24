import { z } from "zod";

import {
  type CalendarDate,
  CalendarDateSchema,
  canonicalDecimal,
  CurrencyCodeSchema,
  type StableId,
  StableIdSchema,
  TimeOfDaySchema,
} from "../../domain/schema/primitives.ts";
import type {
  ReceiptExtractionDraft,
  ReceiptExtractionRequest,
} from "../ports/receipt-ai.ts";

export const RECEIPT_SCHEMA_VERSION = "receipt.v2" as const;
export const RECEIPT_SCHEMA_VERSION_NUMBER = 2 as const;
export const RECEIPT_INSTRUCTION_VERSION = "receipt-extraction-v8" as const;

const CanonicalDecimalTextSchema = z.string().regex(
  /^-?(0|[1-9]\d*)(\.\d+)?$/,
  "must be a canonical decimal string",
);

const ReceiptLineOutputSchema = z.strictObject({
  amount: CanonicalDecimalTextSchema,
  categoryId: StableIdSchema,
  description: z.string().trim().min(1).max(500),
  direction: z.enum(["outflow", "inflow"]),
  kind: z.enum(["purchase", "adjustment"]),
  rationale: z.string().trim().min(1).max(500),
  selected: z.boolean(),
  quantity: CanonicalDecimalTextSchema.nullable().optional(),
  unitPrice: CanonicalDecimalTextSchema.nullable().optional(),
  uncertainty: z.string().trim().min(1).max(1_000).nullable().optional(),
}).superRefine((line, context) => {
  // The provider wire schema cannot express this kind-specific relationship.
  // Keep the provider-neutral browser validator strict.
  if (
    line.kind === "adjustment" &&
    ((line.quantity !== undefined && line.quantity !== null) ||
      (line.unitPrice !== undefined && line.unitPrice !== null))
  ) {
    context.addIssue({
      code: "custom",
      path: ["kind"],
      message: "quantity and unitPrice are only valid for purchases",
    });
  }
});

/** The single runtime source of truth for every receipt provider. */
export const ReceiptOutputSchema = z.strictObject({
  currency: CurrencyCodeSchema,
  date: CalendarDateSchema.nullable().optional(),
  time: TimeOfDaySchema.nullable().optional(),
  lines: z.array(ReceiptLineOutputSchema),
  merchant: z.string().trim().max(500).nullable().optional(),
  mismatch: z.strictObject({
    difference: CanonicalDecimalTextSchema,
    explanation: z.string().trim().min(1).max(1_000),
  }).nullable(),
  printedTotal: CanonicalDecimalTextSchema,
  schemaVersion: z.literal(RECEIPT_SCHEMA_VERSION),
  uncertainty: z.array(z.string().trim().min(1).max(1_000)),
});

export type ReceiptOutput = z.infer<typeof ReceiptOutputSchema>;
export type ReceiptLineOutput = z.infer<typeof ReceiptLineOutputSchema>;

export type ReceiptOutputFailurePhase = "json" | "schema";

export class ReceiptOutputError extends Error {
  override readonly name = "ReceiptOutputError";

  constructor(
    readonly phase: ReceiptOutputFailurePhase,
    readonly details?: string,
  ) {
    super(
      details
        ? `Receipt output could not be validated (${phase}): ${details}`
        : "Receipt output could not be validated.",
    );
  }
}

export type ReceiptJsonSchema = Readonly<Record<string, unknown>>;

/** Strict provider-neutral JSON Schema generated from ReceiptOutputSchema. */
export const RECEIPT_JSON_SCHEMA: ReceiptJsonSchema = Object.freeze(
  z.toJSONSchema(ReceiptOutputSchema) as ReceiptJsonSchema,
);

/** Descriptive alias for provider adapters consuming the shared schema. */
export const RECEIPT_OUTPUT_JSON_SCHEMA = RECEIPT_JSON_SCHEMA;

/**
 * The shared receipt instruction. Providers may place the resulting prompt in
 * different wire fields, but may not alter this text or its version.
 */
export function buildReceiptPrompt(
  request: Pick<
    ReceiptExtractionRequest,
    "categories" | "locale" | "currency" | "documentType" | "today"
  >,
): string {
  const categories = request.categories.map((category) => ({
    id: category.id,
    name: category.name,
    ...(category.description ? { description: category.description } : {}),
  }));
  if (request.documentType === "menu") {
    return [
      `Extract the selected restaurant menu images into exactly schema ${RECEIPT_SCHEMA_VERSION}.`,
      `Instruction version: ${RECEIPT_INSTRUCTION_VERSION}.`,
      `Device locale: ${request.locale}.`,
      `Project default currency: ${request.currency}.`,
      `Active category catalogue (use an existing id only; never create a category): ${
        JSON.stringify(categories)
      }.`,
      "Document type: restaurant menu. The images show pages or sections of a food/drink menu.",
      "Extract every menu item, dish, meal, drink, or beverage with its printed unit price as a line item.",
      "Item price transcription rules: copy each numeric unit price exactly as printed; use a period as the decimal separator and omit digit-grouping separators; do not convert it to the owner's ledger sign.",
      "Every menu item has direction outflow and kind purchase.",
      "All extracted menu items must have selected set to false by default (the customer will opt in to only the items they ordered).",
      "For every menu item, set unitPrice to the printed price, quantity to '1', and amount to the printed unit price.",
      "For every line, provide a concise rationale (one short sentence) naming the menu section or evidence used for its category and direction.",
      "Do not invent items that are not on the menu. If an item has multiple sizes/prices, list them as distinct items (for example, 'Coffee (Regular)' and 'Coffee (Large)').",
      "If a restaurant or venue name is visible on the menu, set merchant to that name. If not visible, set merchant to 'Restaurant'.",
      `Restaurant menus do not print transaction totals, dates, or purchase times: set printedTotal to '0', set time to null, set mismatch to null, and set date to ${
        request.today
          ? `'${request.today}'`
          : "the current date based on the device locale"
      }.`,
      "Return JSON only and preserve uncertainty.",
    ].join("\n");
  }
  return [
    `Extract the selected receipt image into exactly schema ${RECEIPT_SCHEMA_VERSION}.`,
    `Instruction version: ${RECEIPT_INSTRUCTION_VERSION}.`,
    `Device locale: ${request.locale}.`,
    `Project default currency: ${request.currency}.`,
    `Active category catalogue (use an existing id only; never create a category): ${
      JSON.stringify(categories)
    }.`,
    "Amount transcription rules: copy each numeric amount exactly as printed, including a printed minus sign; use a period as the decimal separator and omit digit-grouping separators; do not convert it to the owner's ledger sign.",
    "Product-description transcription rule: omit a leading asterisk only when the receipt uses it as a retailer marker for a discount, offer, or loyalty condition (for example, `*Ostringar Mild Jal` becomes `Ostringar Mild Jal`). Preserve an asterisk whenever it is actually part of the printed product description, including an asterisk within a name; never remove asterisks mechanically.",
    "Every product or purchase line has direction outflow, even when the receipt prints no minus sign. Set kind to purchase.",
    "Discounts, refunds, cashback, and explicit bottle-deposit returns have direction inflow and kind adjustment because they reduce the amount owed. A positive PANT BURK/PANT bottle-deposit line printed beside purchased goods is a deposit charge, not a return: keep its printed amount and set direction outflow. Use inflow for a deposit only when the receipt explicitly says return/refund/återbetalning or prints a negative amount.",
    "Tips, fees, surcharges, and other extra charges have direction outflow and kind adjustment because they increase the amount owed.",
    "For every line, provide a concise rationale (one short sentence) naming the receipt evidence used for its category and direction. This is evidence, not hidden chain-of-thought.",
    "When a purchased line explicitly shows a quantity and unit price (for example, `2 st x 16,99`), populate quantity and unitPrice and set amount to the printed line total.",
    "When a store, merchant, or vendor name is printed on the receipt, set merchant to that name (for example, `IKEA`); if no merchant is visible, set merchant to null or an empty string.",
    "When a transaction or purchase date is printed on the receipt, set date in YYYY-MM-DD calendar-date format (for example, `2026-08-24`); if no date is visible on the receipt or the date is unclear, set date to null.",
    "When a transaction or purchase time is printed on the receipt, set time in 24-hour format HH:mm or HH:mm:ss (for example, `14:35`); if no time is visible on the receipt, set time to null.",
    "Do not return payment/tender amounts, subtotals, tax summaries, receipt totals, or quantity-only rows as line items; do not duplicate a product line for its quantity.",
    "Set printedTotal to the amount exactly as printed. Before returning JSON, use the direction field to verify every selected line contributes once to the owner's signed total; preserve a mismatch explanation when the image cannot be reconciled.",
    "Return JSON only and preserve uncertainty.",
  ].join("\n");
}

function isSchemaRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Models commonly transcribe locale-specific receipt decimals (for example
 * `33,08` or `1.234,56`) even though the transport contract uses canonical
 * decimal strings. Normalize only unambiguous decimal/grouping forms; all
 * other values remain untouched and are rejected by the strict schema below.
 */
function normalizeDecimalText(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const trimmed = value.trim().replace(/\u00a0/g, " ");
  const candidate = /^-?\d+(?:\.\d+)?$/.test(trimmed)
    ? trimmed
    : /^-?\d+,\d+$/.test(trimmed)
    ? trimmed.replace(",", ".")
    : /^-?\d{1,3}(?:[ .]\d{3})+,\d+$/.test(trimmed)
    ? trimmed.replace(/[ .]/g, "").replace(",", ".")
    : /^-?\d{1,3}(?:[ ,]\d{3})+\.\d+$/.test(trimmed)
    ? trimmed.replace(/[ ,]/g, "")
    : /^-?\d{1,3}(?: \d{3})+$/.test(trimmed)
    ? trimmed.replace(/ /g, "")
    : undefined;
  if (candidate === undefined) return value;
  try {
    return canonicalDecimal(candidate);
  } catch {
    return value;
  }
}

/**
 * Normalize model-produced time text (e.g. `9:05`, `14.35`, `2:35 PM`, or empty strings)
 * into canonical 24-hour TimeOfDay format before strict validation.
 */
function normalizeTimeText(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (
    trimmed === "" ||
    /^n\/?a$/i.test(trimmed) ||
    /^unknown$/i.test(trimmed) ||
    /^none$/i.test(trimmed) ||
    trimmed === "--:--"
  ) {
    return null;
  }
  const ampmMatch = /^(\d{1,2})[:.](\d{2})(?:[:.](\d{2}))?\s*(am|pm)$/i.exec(
    trimmed,
  );
  if (ampmMatch) {
    let hour = parseInt(ampmMatch[1], 10);
    const minute = ampmMatch[2];
    const second = ampmMatch[3];
    const period = ampmMatch[4].toLowerCase();
    if (hour >= 1 && hour <= 12) {
      if (period === "pm" && hour < 12) hour += 12;
      if (period === "am" && hour === 12) hour = 0;
      const hh = String(hour).padStart(2, "0");
      return second !== undefined
        ? `${hh}:${minute}:${second}`
        : `${hh}:${minute}`;
    }
  }
  const match = /^(\d{1,2})[:.](\d{2})(?:[:.](\d{2})(?:\.(\d{1,3}))?)?$/.exec(
    trimmed,
  );
  if (match) {
    const hour = parseInt(match[1], 10);
    if (hour >= 0 && hour <= 23) {
      const hh = String(hour).padStart(2, "0");
      const minute = match[2];
      const second = match[3];
      const ms = match[4];
      if (second !== undefined) {
        return ms !== undefined
          ? `${hh}:${minute}:${second}.${ms}`
          : `${hh}:${minute}:${second}`;
      }
      return `${hh}:${minute}`;
    }
  }
  return trimmed;
}

function isValidCalendarDate(
  year: number,
  month: number,
  day: number,
): boolean {
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/**
 * Normalize model-produced date text (e.g. `24/09/2026`, `2026.09.24`, `24 Sep 2026`, ISO strings,
 * or empty strings/placeholders) into canonical `YYYY-MM-DD` CalendarDate format before strict validation.
 */
function normalizeDateText(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (
    trimmed === "" ||
    /^n\/?a$/i.test(trimmed) ||
    /^unknown$/i.test(trimmed) ||
    /^none$/i.test(trimmed) ||
    trimmed === "--" ||
    trimmed === "----"
  ) {
    return null;
  }
  // 1. ISO 8601 with optional time: e.g. "2026-09-24", "2026-09-24T14:35:00Z", "2026-09-24 14:35"
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/.exec(trimmed);
  if (isoMatch) {
    const y = parseInt(isoMatch[1], 10);
    const m = parseInt(isoMatch[2], 10);
    const d = parseInt(isoMatch[3], 10);
    if (isValidCalendarDate(y, m, d)) {
      return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
    }
    return null;
  }
  // 2. YYYY/MM/DD or YYYY.MM.DD
  const ymdMatch = /^(\d{4})[./](\d{1,2})[./](\d{1,2})$/.exec(trimmed);
  if (ymdMatch) {
    const y = parseInt(ymdMatch[1], 10);
    const m = parseInt(ymdMatch[2], 10);
    const d = parseInt(ymdMatch[3], 10);
    if (isValidCalendarDate(y, m, d)) {
      return `${ymdMatch[1]}-${String(m).padStart(2, "0")}-${
        String(d).padStart(2, "0")
      }`;
    }
    return null;
  }
  // 3. DD/MM/YYYY or DD.MM.YYYY or DD-MM-YYYY
  const dmyMatch = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/.exec(trimmed);
  if (dmyMatch) {
    const p1 = parseInt(dmyMatch[1], 10);
    const p2 = parseInt(dmyMatch[2], 10);
    const y = parseInt(dmyMatch[3], 10);
    if (p1 > 12 && p2 <= 12 && isValidCalendarDate(y, p2, p1)) {
      return `${y}-${String(p2).padStart(2, "0")}-${
        String(p1).padStart(2, "0")
      }`;
    }
    if (p2 > 12 && p1 <= 12 && isValidCalendarDate(y, p1, p2)) {
      return `${y}-${String(p1).padStart(2, "0")}-${
        String(p2).padStart(2, "0")
      }`;
    }
    if (isValidCalendarDate(y, p2, p1)) {
      return `${y}-${String(p2).padStart(2, "0")}-${
        String(p1).padStart(2, "0")
      }`;
    }
    if (isValidCalendarDate(y, p1, p2)) {
      return `${y}-${String(p1).padStart(2, "0")}-${
        String(p2).padStart(2, "0")
      }`;
    }
    return null;
  }
  // 4. Two digit year: YY-MM-DD or DD/MM/YY
  const shortMatch = /^(\d{2})([./-])(\d{1,2})\2(\d{1,2})$/.exec(trimmed);
  if (shortMatch) {
    const p1 = parseInt(shortMatch[1], 10);
    const sep = shortMatch[2];
    const p2 = parseInt(shortMatch[3], 10);
    const p3 = parseInt(shortMatch[4], 10);
    if (sep === "/") {
      if (p3 >= 20 && p3 <= 35 && isValidCalendarDate(2000 + p3, p2, p1)) {
        return `${2000 + p3}-${String(p2).padStart(2, "0")}-${
          String(p1).padStart(2, "0")
        }`;
      }
    } else {
      if (p1 >= 20 && p1 <= 35 && isValidCalendarDate(2000 + p1, p2, p3)) {
        return `${2000 + p1}-${String(p2).padStart(2, "0")}-${
          String(p3).padStart(2, "0")
        }`;
      }
    }
  }
  // 5. English textual dates: e.g. "24 Sep 2026", "September 24, 2026", "24-Sep-2026"
  const parsedTime = Date.parse(trimmed.replace(/-/g, " "));
  if (!isNaN(parsedTime)) {
    const parsed = new Date(parsedTime);
    const y = parsed.getFullYear();
    const m = parsed.getMonth() + 1;
    const d = parsed.getDate();
    if (y >= 2000 && y <= 2100 && isValidCalendarDate(y, m, d)) {
      return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    }
  }
  return null;
}

/** Normalize model-produced localized decimal, date, merchant, and time text before strict validation. */
export function normalizeReceiptOutput(value: unknown): unknown {
  if (!isSchemaRecord(value)) return value;
  const lines = Array.isArray(value.lines)
    ? value.lines.map((line) =>
      isSchemaRecord(line)
        ? {
          ...line,
          amount: normalizeDecimalText(line.amount),
          quantity: line.quantity == null
            ? null
            : normalizeDecimalText(line.quantity),
          unitPrice: line.unitPrice == null
            ? null
            : normalizeDecimalText(line.unitPrice),
          uncertainty: line.uncertainty == null ? null : line.uncertainty,
        }
        : line
    )
    : value.lines;
  const mismatch = isSchemaRecord(value.mismatch)
    ? {
      ...value.mismatch,
      difference: normalizeDecimalText(value.mismatch.difference),
    }
    : value.mismatch;
  const merchant = typeof value.merchant === "string"
    ? value.merchant.trim()
    : value.merchant == null
    ? null
    : value.merchant;
  return {
    ...value,
    date: normalizeDateText(value.date),
    merchant,
    printedTotal: normalizeDecimalText(value.printedTotal),
    time: normalizeTimeText(value.time),
    lines,
    mismatch,
  };
}

function assertOutputSemantics(output: ReceiptOutput): ReceiptOutput {
  // Keep explicit semantic checks at the shared boundary if the validator
  // implementation changes independently of the generated JSON Schema.
  if (!CurrencyCodeSchema.safeParse(output.currency).success) {
    throw new Error(
      `currency "${output.currency}" is not a valid 3-letter currency code`,
    );
  }
  if (
    output.date !== undefined &&
    output.date !== null &&
    !CalendarDateSchema.safeParse(output.date).success
  ) {
    throw new Error(
      `date "${output.date}" is not a valid YYYY-MM-DD calendar date`,
    );
  }
  if (
    output.time !== undefined &&
    output.time !== null &&
    !TimeOfDaySchema.safeParse(output.time).success
  ) {
    throw new Error(`time "${output.time}" is not a valid 24-hour time`);
  }
  return output;
}

/** Validate untrusted model output without exposing raw provider text. */
export function validateReceiptOutput(value: unknown): ReceiptOutput {
  const result = ReceiptOutputSchema.safeParse(value);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`)
      .join("; ");
    throw new ReceiptOutputError("schema", details);
  }
  try {
    return assertOutputSemantics(result.data);
  } catch (error) {
    const details = error instanceof Error ? error.message : String(error);
    throw new ReceiptOutputError("schema", details);
  }
}

/** Parse provider text, accepting only a JSON value or one fenced JSON block. */
export function parseReceiptOutput(text: string): ReceiptOutput {
  let value: unknown;
  try {
    value = JSON.parse(text) as unknown;
  } catch {
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)?.[1];
    if (fenced === undefined) {
      throw new ReceiptOutputError(
        "json",
        "AI response did not contain valid JSON",
      );
    }
    try {
      value = JSON.parse(fenced) as unknown;
    } catch (error) {
      const details = error instanceof Error
        ? error.message
        : "JSON syntax error";
      throw new ReceiptOutputError("json", details);
    }
  }
  return validateReceiptOutput(normalizeReceiptOutput(value));
}

function mismatchText(output: ReceiptOutput): readonly string[] {
  return output.mismatch === null
    ? []
    : [`${output.mismatch.difference}: ${output.mismatch.explanation}`];
}

function defaultToday(): CalendarDate {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}` as CalendarDate;
}

/** Convert the validated provider-neutral response to the receipt port draft. */
export function mapReceiptOutputToDraft(
  output: ReceiptOutput,
  request: Pick<
    ReceiptExtractionRequest,
    "categories" | "documentType" | "today"
  >,
): ReceiptExtractionDraft {
  const categories = new Set<StableId>(
    request.categories.map((category) => category.id),
  );
  const isMenu = request.documentType === "menu";
  const effectiveDate = isMenu && request.today
    ? request.today
    : (output.date ?? request.today ?? defaultToday());
  const uncertainty = output.date == null && !isMenu
    ? [
      ...output.uncertainty,
      "The receipt date was missing or unclear; defaulted to today.",
    ]
    : output.uncertainty;

  return {
    merchant: output.merchant?.trim() ? output.merchant.trim() : undefined,
    currency: output.currency,
    date: effectiveDate,
    ...(output.time ? { time: output.time } : {}),
    printedTotal: isMenu ? "0" : output.printedTotal,
    lines: output.lines.map((line) => {
      const categoryAvailable = categories.has(line.categoryId);
      const uncertainty = line.uncertainty == null
        ? undefined
        : line.uncertainty;
      const effectiveUncertainty = categoryAvailable ? uncertainty : [
        uncertainty,
        "The suggested category is unavailable; review the category.",
      ].filter((item): item is string => item !== undefined).join(" ");
      const common = {
        description: line.description,
        amount: line.amount,
        categoryId: line.categoryId,
        direction: line.direction,
        selected: line.selected,
        rationale: line.rationale,
        ...(effectiveUncertainty === undefined ||
            effectiveUncertainty.trim().length === 0
          ? {}
          : { uncertainty: effectiveUncertainty }),
      };
      return line.kind === "purchase"
        ? {
          ...common,
          kind: line.kind,
          ...(line.quantity == null ? {} : { quantity: line.quantity }),
          ...(line.unitPrice == null ? {} : { unitPrice: line.unitPrice }),
        }
        : { ...common, kind: line.kind };
    }),
    uncertainty,
    mismatches: mismatchText(output),
  };
}
