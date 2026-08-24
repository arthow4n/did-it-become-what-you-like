# Canonical portable export

S-404 exports use the JSON object format
`did-it-become-what-you-like/portable-export`, schema version **1**:

```json
{
  "schemaVersion": 1,
  "format": "did-it-become-what-you-like/portable-export",
  "exportedAt": "2026-08-24T14:00:00.000Z",
  "generation": 3,
  "heads": ["change-current"],
  "changes": [],
  "dataset": {}
}
```

`dataset` is the lossless synchronized dataset documented by
`src/domain/schema/SCHEMA.md`. `generation`, `heads`, and `changes` preserve
causal correctness and stable-history deduplication. A legacy dataset-shaped
JSON document is accepted and migrated through the existing v0-to-v1 registry;
it is treated as generation 1 with no causal changes. A future schema version,
malformed JSON, unknown envelope fields, invalid references, and invalid causal
history are rejected before any local mutation.

The projection contains no API key, selected model, image-preparation setting,
last-selected project, workflow draft, receipt image, CSV, or opaque database
bytes. Export/share writes UTF-8 JSON as a `.json` file with MIME type
`application/json`. Share fallback saves the same bytes when the browser share
adapter reports that sharing is unavailable.
