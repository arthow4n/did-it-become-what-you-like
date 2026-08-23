import { JsonSchema } from "./fake-sdk.ts";

export const GEMINI_IMAGE_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/heic",
  "image/heif",
] as const;

export const DEFAULT_BROWSER_IMAGE_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;

export const IMAGE_LIMITS = {
  inlineRequestBytes: 20_000_000,
  maxImageFilesPerRequest: 3_600,
  tilePixels: 768,
  lowResolutionPixels: 384,
  localPreparedMaxDimension: 4_096,
  localPreparedJpegQuality: 0.85,
} as const;

export interface ImageInput {
  bytes: Uint8Array;
  height: number;
  mimeType: string;
  width: number;
}

export interface MetadataStripResult {
  bytes: Uint8Array;
  metadataRemoved: boolean;
}

export interface PreparedImage extends ImageInput {
  metadataRemoved: boolean;
  preparation: "off" | "resize-compress";
}

export interface PreparationOperations {
  compress(bytes: Uint8Array, quality: number): Uint8Array;
  resize(input: ImageInput, maxDimension: number): ImageInput;
  stripMetadata(input: ImageInput): MetadataStripResult;
}

function isMetadataMarker(marker: number): boolean {
  return (marker >= 0xe0 && marker <= 0xef) || marker === 0xfe;
}

function readSegmentLength(bytes: Uint8Array, position: number): number {
  if (position + 1 >= bytes.length) {
    throw new Error("JPEG metadata segment has no length");
  }
  const length = (bytes[position] << 8) | bytes[position + 1];
  if (length < 2 || position + length > bytes.length) {
    throw new Error("JPEG metadata segment length is invalid");
  }
  return length;
}

/**
 * Losslessly removes JPEG APP0-APP15 and COM segments. The scan data is copied
 * opaque after SOS, so pixel bytes are not decoded, resized, or recompressed.
 */
export function stripJpegMetadata(bytes: Uint8Array): Uint8Array {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    throw new Error("metadata fixture is not a JPEG");
  }

  const kept: number[] = [0xff, 0xd8];
  let position = 2;
  while (position < bytes.length) {
    if (bytes[position] !== 0xff) {
      throw new Error("JPEG marker boundary is invalid");
    }
    while (position < bytes.length && bytes[position] === 0xff) {
      position += 1;
    }
    if (position >= bytes.length) {
      throw new Error("JPEG marker is truncated");
    }
    const marker = bytes[position];
    position += 1;

    if (marker === 0xd9) {
      kept.push(0xff, marker);
      break;
    }
    if (marker === 0xda) {
      // SOS's length belongs to the header; every remaining byte is scan data
      // up to the final EOI marker and must be copied without interpretation.
      const length = readSegmentLength(bytes, position);
      for (let index = position - 2; index < position + length; index += 1) {
        kept.push(bytes[index]);
      }
      for (let index = position + length; index < bytes.length; index += 1) {
        kept.push(bytes[index]);
      }
      break;
    }

    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7)) {
      kept.push(0xff, marker);
      continue;
    }

    const length = readSegmentLength(bytes, position);
    if (!isMetadataMarker(marker)) {
      kept.push(0xff, marker);
      for (let index = position; index < position + length; index += 1) {
        kept.push(bytes[index]);
      }
    }
    position += length;
  }

  return Uint8Array.from(kept);
}

export function scaleDimensions(
  width: number,
  height: number,
  maxDimension: number,
): { height: number; width: number } {
  if (width <= 0 || height <= 0 || maxDimension <= 0) {
    throw new Error("image dimensions must be positive");
  }
  const scale = Math.min(1, maxDimension / Math.max(width, height));
  return {
    height: Math.max(1, Math.round(height * scale)),
    width: Math.max(1, Math.round(width * scale)),
  };
}

export function prepareImage(
  input: ImageInput,
  enabled: boolean,
  operations: PreparationOperations,
): PreparedImage {
  const stripped = operations.stripMetadata(input);
  const sanitized: ImageInput = { ...input, bytes: stripped.bytes };
  if (!enabled) {
    return {
      ...sanitized,
      metadataRemoved: stripped.metadataRemoved,
      preparation: "off",
    };
  }

  const resized = operations.resize(
    sanitized,
    IMAGE_LIMITS.localPreparedMaxDimension,
  );
  return {
    ...resized,
    bytes: operations.compress(
      resized.bytes,
      IMAGE_LIMITS.localPreparedJpegQuality,
    ),
    metadataRemoved: stripped.metadataRemoved,
    preparation: "resize-compress",
  };
}

export const RECEIPT_SCHEMA_VERSION = "receipt.v1";

export const RECEIPT_JSON_SCHEMA: JsonSchema = {
  additionalProperties: false,
  properties: {
    currency: { type: "string" },
    date: { type: "string" },
    lines: {
      items: {
        additionalProperties: false,
        properties: {
          amount: { type: "string" },
          categoryId: { type: "string" },
          description: { type: "string" },
          kind: { enum: ["purchase", "adjustment"], type: "string" },
          selected: { type: "boolean" },
        },
        required: ["amount", "categoryId", "description", "kind", "selected"],
        type: "object",
      },
      type: "array",
    },
    merchant: { type: "string" },
    mismatch: {
      additionalProperties: false,
      properties: {
        difference: { type: "string" },
        explanation: { type: "string" },
      },
      required: ["difference", "explanation"],
      type: ["object", "null"],
    },
    printedTotal: { type: "string" },
    schemaVersion: { enum: [RECEIPT_SCHEMA_VERSION], type: "string" },
    uncertainty: { items: { type: "string" }, type: "array" },
  },
  required: [
    "currency",
    "date",
    "lines",
    "merchant",
    "mismatch",
    "printedTotal",
    "schemaVersion",
    "uncertainty",
  ],
  type: "object",
};

export interface ReceiptLine {
  amount: string;
  categoryId: string;
  description: string;
  kind: "adjustment" | "purchase";
  selected: boolean;
}

export interface ReceiptDraft {
  currency: string;
  date: string;
  lines: ReceiptLine[];
  merchant: string;
  mismatch: null | { difference: string; explanation: string };
  printedTotal: string;
  schemaVersion: typeof RECEIPT_SCHEMA_VERSION;
  uncertainty: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`receipt output field ${field} must be a non-empty string`);
  }
  return value;
}

function requireDecimal(value: unknown, field: string): string {
  const decimal = requireString(value, field);
  if (!/^-?(0|[1-9]\d*)(\.\d+)?$/.test(decimal)) {
    throw new Error(`receipt output field ${field} is not a canonical decimal`);
  }
  return decimal;
}

export function validateReceiptOutput(value: unknown): ReceiptDraft {
  if (!isRecord(value)) throw new Error("receipt output must be an object");
  const keys = Object.keys(value).sort();
  const expected = [
    "currency",
    "date",
    "lines",
    "merchant",
    "mismatch",
    "printedTotal",
    "schemaVersion",
    "uncertainty",
  ];
  if (
    keys.length !== expected.length ||
    keys.some((key, index) => key !== expected[index])
  ) {
    throw new Error("receipt output contains missing or unexpected fields");
  }
  if (value.schemaVersion !== RECEIPT_SCHEMA_VERSION) {
    throw new Error("receipt output schema version is unsupported");
  }
  if (!Array.isArray(value.lines)) {
    throw new Error("receipt lines must be an array");
  }
  const lines: ReceiptLine[] = value.lines.map((line, index) => {
    if (!isRecord(line)) {
      throw new Error(`receipt line ${index} must be an object`);
    }
    const lineKeys = Object.keys(line).sort();
    if (lineKeys.join(",") !== "amount,categoryId,description,kind,selected") {
      throw new Error(`receipt line ${index} contains unexpected fields`);
    }
    const kind = line.kind;
    if (kind !== "purchase" && kind !== "adjustment") {
      throw new Error(`receipt line ${index} has an invalid kind`);
    }
    if (typeof line.selected !== "boolean") {
      throw new Error(`receipt line ${index} selected must be boolean`);
    }
    return {
      amount: requireDecimal(line.amount, `lines[${index}].amount`),
      categoryId: requireString(line.categoryId, `lines[${index}].categoryId`),
      description: requireString(
        line.description,
        `lines[${index}].description`,
      ),
      kind,
      selected: line.selected,
    };
  });
  let mismatch: ReceiptDraft["mismatch"] = null;
  if (value.mismatch !== null) {
    if (!isRecord(value.mismatch)) {
      throw new Error("receipt mismatch must be null or object");
    }
    mismatch = {
      difference: requireDecimal(
        value.mismatch.difference,
        "mismatch.difference",
      ),
      explanation: requireString(
        value.mismatch.explanation,
        "mismatch.explanation",
      ),
    };
  }
  if (
    !Array.isArray(value.uncertainty) ||
    value.uncertainty.some((item) => typeof item !== "string")
  ) {
    throw new Error("receipt uncertainty must be a string array");
  }
  return {
    currency: requireString(value.currency, "currency"),
    date: requireString(value.date, "date"),
    lines,
    merchant: requireString(value.merchant, "merchant"),
    mismatch,
    printedTotal: requireDecimal(value.printedTotal, "printedTotal"),
    schemaVersion: RECEIPT_SCHEMA_VERSION,
    uncertainty: [...value.uncertainty],
  };
}

export function parseAndValidateReceiptOutput(text: string): ReceiptDraft {
  let value: unknown;
  try {
    value = JSON.parse(text) as unknown;
  } catch {
    throw new Error("Gemini structured output was not valid JSON");
  }
  return validateReceiptOutput(value);
}
