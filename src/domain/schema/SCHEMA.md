# Portable domain schema

The canonical portable dataset is schema version **1** and uses the format
`did-it-become-what-you-like/dataset`. `src/domain/schema/` is the runtime
source of truth: the Zod 4 objects there validate the JSON shape and expose the
TypeScript types used by the domain.

The portable export contains:

- stable-ID `projects` and globally shared `categories`;
- signed canonical-decimal `expenses`;
- independently editable `receipts`, `receiptPurchaseLines`, and
  `receiptAdjustments`;
- `devices`, `tombstones`, `retirementMarkers`, and `revisions`; and
- synchronized `settings.expenseDayBoundary`.

Every persisted decimal is a base-10 string. Leading and trailing redundant
zeros normalize through `CanonicalDecimalSchema`; no JavaScript number or
implicit minor-unit integer is accepted. Outflows are negative and inflows are
positive. `big.js` performs arithmetic in strict mode, and this schema does not
perform cross-currency conversion.

References use immutable stable IDs rather than names. Dataset validation
rejects unknown project/category/receipt references, cross-project receipt
children, duplicate IDs, duplicate active category names, and invalid category
tombstone replacements. The `Uncategorized` system category is mandatory and
cannot be archived or renamed.

Receipt images, Gemini API keys, selected Gemini models, image-preparation
preferences, last-selected project, workflow drafts, and other device-local
settings are intentionally absent from portable exports. Images are ephemeral
inference inputs and must never enter this schema.

## Migration policy

`src/domain/migrations/index.ts` is the centralized migration registry. The
registry currently contains an explicit v0-to-v1 compatibility migration that
adds the v1 format, arrays, and default portable expense-day boundary before
normal validation. Future migrations must be ordered, atomic at the import
boundary, and tested from every supported source version.

**Down migrations are intentionally unsupported.** Exports remain lossless at
the current version; importing an unknown future version fails clearly.

`exportDataset` sorts records by stable ID and object keys before serializing.
`importDataset` parses JSON, applies the registry, validates all references, and
returns the canonical current version.
