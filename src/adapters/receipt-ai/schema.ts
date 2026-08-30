import { z } from "zod";

import {
  CalendarDateSchema,
  canonicalDecimal,
  CurrencyCodeSchema,
  type StableId,
  StableIdSchema,
} from "../../domain/schema/primitives.ts";
import type {
  ReceiptExtractionDraft,
  ReceiptExtractionRequest,
} from "../ports/receipt-ai.ts";

export const RECEIPT_SCHEMA_VERSION = "receipt.v2" as const;
export const RECEIPT_SCHEMA_VERSION_NUMBER = 2 as const;
export const RECEIPT_INSTRUCTION_VERSION = "receipt-extraction-v6" as const;

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
  quantity: CanonicalDecimalTextSchema.optional(),
  unitPrice: CanonicalDecimalTextSchema.optional(),
  uncertainty: z.string().trim().min(1).max(1_000).optional(),
}).superRefine((line, context) => {
  // The provider wire schema cannot express this kind-specific relationship.
  // Keep the provider-neutral browser validator strict.
  if (
    line.kind === "adjustment" &&
    (line.quantity !== undefined || line.unitPrice !== undefined)
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
  date: CalendarDateSchema,
  lines: z.array(ReceiptLineOutputSchema),
  merchant: z.string().trim().min(1).max(500),
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

  constructor(readonly phase: ReceiptOutputFailurePhase) {
    super("Receipt output could not be validated.");
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
    "categories" | "locale" | "currency"
  >,
): string {
  const categories = request.categories.map((category) => ({
    id: category.id,
    name: category.name,
  }));
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

/** Normalize model-produced localized decimal text before strict validation. */
export function normalizeReceiptOutput(value: unknown): unknown {
  if (!isSchemaRecord(value)) return value;
  const lines = Array.isArray(value.lines)
    ? value.lines.map((line) =>
      isSchemaRecord(line)
        ? {
          ...line,
          amount: normalizeDecimalText(line.amount),
          quantity: normalizeDecimalText(line.quantity),
          unitPrice: normalizeDecimalText(line.unitPrice),
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
  return {
    ...value,
    printedTotal: normalizeDecimalText(value.printedTotal),
    lines,
    mismatch,
  };
}

function assertOutputSemantics(output: ReceiptOutput): ReceiptOutput {
  // Keep explicit semantic checks at the shared boundary if the validator
  // implementation changes independently of the generated JSON Schema.
  if (!CurrencyCodeSchema.safeParse(output.currency).success) {
    throw new Error("receipt output currency is invalid");
  }
  if (!CalendarDateSchema.safeParse(output.date).success) {
    throw new Error("receipt output date is invalid");
  }
  return output;
}

/** Validate untrusted model output without exposing raw provider text. */
export function validateReceiptOutput(value: unknown): ReceiptOutput {
  const result = ReceiptOutputSchema.safeParse(value);
  if (!result.success) throw new ReceiptOutputError("schema");
  try {
    return assertOutputSemantics(result.data);
  } catch {
    throw new ReceiptOutputError("schema");
  }
}

/** Parse provider text, accepting only a JSON value or one fenced JSON block. */
export function parseReceiptOutput(text: string): ReceiptOutput {
  let value: unknown;
  try {
    value = JSON.parse(text) as unknown;
  } catch {
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)?.[1];
    if (fenced === undefined) throw new ReceiptOutputError("json");
    try {
      value = JSON.parse(fenced) as unknown;
    } catch {
      throw new ReceiptOutputError("json");
    }
  }
  return validateReceiptOutput(normalizeReceiptOutput(value));
}

function mismatchText(output: ReceiptOutput): readonly string[] {
  return output.mismatch === null
    ? []
    : [`${output.mismatch.difference}: ${output.mismatch.explanation}`];
}

/** Convert the validated provider-neutral response to the receipt port draft. */
export function mapReceiptOutputToDraft(
  output: ReceiptOutput,
  request: Pick<ReceiptExtractionRequest, "categories">,
): ReceiptExtractionDraft {
  const categories = new Set<StableId>(
    request.categories.map((category) => category.id),
  );

  return {
    merchant: output.merchant,
    currency: output.currency,
    date: output.date,
    printedTotal: output.printedTotal,
    lines: output.lines.map((line) => {
      const categoryAvailable = categories.has(line.categoryId);
      const uncertainty = categoryAvailable ? line.uncertainty : [
        line.uncertainty,
        "The suggested category is unavailable; review the category.",
      ].filter((item): item is string => item !== undefined).join(" ");
      const common = {
        description: line.description,
        amount: line.amount,
        categoryId: line.categoryId,
        direction: line.direction,
        selected: line.selected,
        rationale: line.rationale,
        ...(uncertainty === undefined ? {} : { uncertainty }),
      };
      return line.kind === "purchase"
        ? {
          ...common,
          kind: line.kind,
          ...(line.quantity === undefined ? {} : { quantity: line.quantity }),
          ...(line.unitPrice === undefined
            ? {}
            : { unitPrice: line.unitPrice }),
        }
        : { ...common, kind: line.kind };
    }),
    uncertainty: output.uncertainty,
    mismatches: mismatchText(output),
  };
}
