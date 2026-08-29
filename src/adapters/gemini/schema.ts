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
} from "../ports/receipt-ai.ts";

export const RECEIPT_SCHEMA_VERSION = "receipt.v2" as const;
export const RECEIPT_SCHEMA_VERSION_NUMBER = 2 as const;
export const RECEIPT_INSTRUCTION_VERSION = "receipt-extraction-v3" as const;

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

function isSchemaRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const GOOGLE_JSON_SCHEMA_KEYWORDS = new Set([
  "type",
  "properties",
  "required",
  "additionalProperties",
  "enum",
  "format",
  "items",
  "prefixItems",
  "minItems",
  "maxItems",
  "minimum",
  "maximum",
  "title",
  "description",
]);

/** Reduce generated JSON Schema to Google's documented structured-output subset. */
function toGoogleJsonSchema(value: unknown): unknown {
  if (!isSchemaRecord(value)) return value;

  const alternatives = Array.isArray(value.anyOf) ? value.anyOf : undefined;
  if (alternatives?.length === 2) {
    const nullIndex = alternatives.findIndex((candidate) =>
      isSchemaRecord(candidate) && candidate.type === "null"
    );
    if (nullIndex !== -1) {
      const nonNull = toGoogleJsonSchema(alternatives[1 - nullIndex]);
      if (isSchemaRecord(nonNull) && typeof nonNull.type === "string") {
        return { ...nonNull, type: [nonNull.type, "null"] };
      }
    }
  }

  const result: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (key === "const") {
      result.enum = [entry];
    } else if (key === "properties" && isSchemaRecord(entry)) {
      result.properties = Object.fromEntries(
        Object.entries(entry).map(([name, schema]) => [
          name,
          toGoogleJsonSchema(schema),
        ]),
      );
    } else if (key === "items") {
      result.items = toGoogleJsonSchema(entry);
    } else if (key === "prefixItems" && Array.isArray(entry)) {
      result.prefixItems = entry.map(toGoogleJsonSchema);
    } else if (key === "additionalProperties" && isSchemaRecord(entry)) {
      result.additionalProperties = toGoogleJsonSchema(entry);
    } else if (GOOGLE_JSON_SCHEMA_KEYWORDS.has(key)) {
      result[key] = entry;
    }
  }
  return result;
}

/**
 * Google receives its documented JSON Schema subset derived from the same Zod
 * object that performs strict browser validation. Provider-unsupported lexical
 * constraints remain enforced locally after generation.
 */
export const RECEIPT_JSON_SCHEMA: GeminiJsonSchema = Object.freeze(
  toGoogleJsonSchema(z.toJSONSchema(ReceiptOutputSchema)) as GeminiJsonSchema,
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
    date: output.date,
    printedTotal: output.printedTotal,
    lines: output.lines.map((line) => ({
      description: line.description,
      amount: line.amount,
      categoryId: line.categoryId,
      kind: line.kind,
      direction: line.direction,
      selected: line.selected,
      rationale: line.rationale,
      ...(line.uncertainty === undefined
        ? {}
        : { uncertainty: line.uncertainty }),
    })),
    uncertainty: output.uncertainty,
    mismatches: mismatchText(output),
  };
}
