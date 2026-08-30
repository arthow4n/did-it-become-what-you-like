import type { ReceiptAiCapability } from "../ports/receipt-ai.ts";

/** Capabilities a receipt-scanning model is expected to provide. */
export const REQUIRED_RECEIPT_AI_CAPABILITIES: readonly ReceiptAiCapability[] =
  [
    "image-input",
    "content-generation",
    "structured-output",
  ];
