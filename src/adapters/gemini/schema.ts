import { z } from "zod";

import {
  CalendarDateSchema,
  CurrencyCodeSchema,
  type StableId,
  StableIdSchema,
} from "../../domain/schema/primitives.ts";
import type {
  ReceiptExtractionDraft,
  ReceiptExtractionRequest,
} from "../ports/gemini.ts";

export const RECEIPT_SCHEMA_VERSION = "receipt.v1" as const;
export const RECEIPT_SCHEMA_VERSION_NUMBER = 1 as const;
export const RECEIPT_INSTRUCTION_VERSION = "receipt-extraction-v1" as const;

const CanonicalDecimalTextSchema = z.string().regex(
  /^-?(0|[1-9]\d*)(\.\d+)?$/,
  "must be a canonical decimal string",
);

const ReceiptLineOutputSchema = z.strictObject({
  amount: CanonicalDecimalTextSchema,
  categoryId: StableIdSchema,
  description: z.string().trim().min(1).max(500),
  kind: z.enum(["purchase", "adjustment"]),
  selected: z.boolean(),
  uncertainty: z.string().trim().min(1).max(1_000).optional(),
});

/** The single runtime source of truth for Gemini's structured response. */
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

export type GeminiJsonSchema = Readonly<Record<string, unknown>>;

/**
 * Gemini receives the JSON Schema generated from the same Zod object that
 * validates the browser response. The extra `$schema` declaration is harmless
 * to Gemini and documents the generated dialect for test/fake clients.
 */
export const RECEIPT_JSON_SCHEMA: GeminiJsonSchema = Object.freeze(
  z.toJSONSchema(ReceiptOutputSchema) as GeminiJsonSchema,
);

function assertOutputSemantics(output: ReceiptOutput): ReceiptOutput {
  // The generated schema covers shape and lexical forms. These explicit
  // runtime checks keep the browser boundary strict if the validator changes.
  if (!CurrencyCodeSchema.safeParse(output.currency).success) {
    throw new Error("receipt output currency is invalid");
  }
  if (!CalendarDateSchema.safeParse(output.date).success) {
    throw new Error("receipt output date is invalid");
  }
  return output;
}

/** Validate untrusted model text without exposing the raw text in an error. */
export function validateReceiptOutput(value: unknown): ReceiptOutput {
  const result = ReceiptOutputSchema.safeParse(value);
  if (!result.success) throw new Error("receipt output failed validation");
  return assertOutputSemantics(result.data);
}

export function parseReceiptOutput(text: string): ReceiptOutput {
  let value: unknown;
  try {
    value = JSON.parse(text) as unknown;
  } catch {
    throw new Error("receipt output was not valid JSON");
  }
  return validateReceiptOutput(value);
}

function mismatchText(output: ReceiptOutput): readonly string[] {
  return output.mismatch === null
    ? []
    : [`${output.mismatch.difference}: ${output.mismatch.explanation}`];
}

/**
 * Convert the complete validated response to the stable adapter port shape.
 * Receipt actor-specific fields remain owned by A-302; no model field is
 * allowed to create a category or cross the port as an unvalidated value.
 */
export function mapReceiptOutputToDraft(
  output: ReceiptOutput,
  request: Pick<ReceiptExtractionRequest, "categories">,
): ReceiptExtractionDraft {
  const categories = new Set<StableId>(
    request.categories.map((category) => category.id),
  );
  for (const line of output.lines) {
    if (!categories.has(line.categoryId)) {
      throw new Error("receipt output referenced an unknown category");
    }
  }

  return {
    merchant: output.merchant,
    currency: output.currency,
    printedTotal: output.printedTotal,
    lines: output.lines.map((line) => ({
      description: line.description,
      amount: line.amount,
      categoryId: line.categoryId,
      ...(line.uncertainty === undefined
        ? {}
        : { uncertainty: line.uncertainty }),
    })),
    mismatches: mismatchText(output),
  };
}
