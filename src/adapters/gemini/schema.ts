import { z } from "zod";

import {
  type ReceiptJsonSchema,
  ReceiptOutputSchema,
} from "../receipt-ai/schema.ts";

export type GeminiJsonSchema = ReceiptJsonSchema;

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

function isSchemaRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

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
 * Google receives its documented JSON Schema subset derived from the same
 * provider-neutral Zod object that performs strict browser validation.
 */
export const RECEIPT_JSON_SCHEMA: GeminiJsonSchema = Object.freeze(
  toGoogleJsonSchema(z.toJSONSchema(ReceiptOutputSchema)) as GeminiJsonSchema,
);

/** Google-wire schema; semantic fields remain owned by the shared schema. */
export const GEMINI_RECEIPT_JSON_SCHEMA = RECEIPT_JSON_SCHEMA;

// Keep the existing Gemini module surface as a re-export while the actual
// prompt, validator, parser, normalizer, and mapper live above the provider
// boundary.
export {
  buildReceiptPrompt,
  mapReceiptOutputToDraft,
  normalizeReceiptOutput,
  parseReceiptOutput,
  RECEIPT_INSTRUCTION_VERSION,
  RECEIPT_SCHEMA_VERSION,
  RECEIPT_SCHEMA_VERSION_NUMBER,
  ReceiptOutputError,
  validateReceiptOutput,
} from "../receipt-ai/schema.ts";
export type {
  ReceiptLineOutput,
  ReceiptOutput,
  ReceiptOutputFailurePhase,
} from "../receipt-ai/schema.ts";
