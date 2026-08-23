/// <reference path="./deno.d.ts" />

const path = "src/domain/schema/SCHEMA.md";
const document = await Deno.readTextFile(path);

for (
  const required of [
    "schema version **1**",
    "CanonicalDecimalSchema",
    "receiptPurchaseLines",
    "receiptAdjustments",
    "Uncategorized",
    "Migration policy",
    "**Down migrations are intentionally unsupported.**",
    "Gemini API keys",
  ]
) {
  if (!document.includes(required)) {
    throw new Error(
      `${path} is missing required canonical-schema statement: ${required}`,
    );
  }
}

console.log("Domain schema documentation verification passed.");
