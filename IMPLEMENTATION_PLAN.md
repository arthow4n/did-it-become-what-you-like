# Implementation Plan and Orchestration Ledger

## Status and Authority

This is the single source of truth for milestone sequencing, ownership,
verification, review, and resumable progress. Product behavior remains
authoritative in SPEC.md; visual and interaction rules remain authoritative in
DESIGN_SYSTEM.md; agent conduct remains authoritative in AGENTS.md.

The detailed M34 task, review, and recovery ledger was completed before this
archive at checkpoint a21877a and remains available in Git history. This
released form intentionally retains the durable architecture and acceptance
baseline, not completed task matrices or worker prompts.

## Released Baseline

M0 through M34 and all review gates through R-3430 are COMPLETE. The released
application delivers the approved local-first expense tracker, receipt
scanning and review, Google Drive synchronization, responsive After Midnight
facade, PWA runtime, five-tab navigation, and state-machine edge handling
described by SPEC.md and DESIGN_SYSTEM.md.

## Architecture and ownership baseline

```text
features/app -> repository design-system facade -> Mantine
features/app -> actors -> domain + adapter ports
                                  |
                                  `-> receipt AI adapters

shared receipt inference contract
  -> one instruction/prompt + version
  -> one semantic Zod schema and runtime validator
  -> one parser, normalizer, and draft mapper
       |-> Gemini wire/schema translation only
       `-> OpenRouter wire/request translation only
```

Feature and app files use only the repository design-system facade. Provider
SDKs, metadata, routing, and credentials stay at adapter/composition edges;
actors and domain code depend on narrow provider-neutral ports.

## M34 — OpenRouter Receipt-AI Provider and Provider-Neutral Configuration

M34 is released with OpenRouter receipt scanning alongside Gemini and a shared
provider-neutral receipt pipeline. Both providers use the same instruction
text, instruction version, semantic output schema, local Zod validation,
parser, normalization, and draft mapping. Adapters translate only provider
wire formats.

Exact dependencies are npm:@google/genai@2.19.0 and
npm:@openrouter/sdk@1.2.82. Pinned SDK types remain final authority for request
field spelling; no substitute SDK or version was introduced.

### Discovery and routing

- Gemini model discovery uses Model.supportedActions when present and requires
  generateContent; absent metadata remains a candidate. It performs no probe
  inference and has no static structured-output allowlist.
- OpenRouter model discovery sends the pinned metadata filters for structured
  outputs/response format, image/text input, and text output, adds the ZDR
  filter when enabled, and verifies returned capabilities client-side.
- OpenRouter scans send the exact selected model, strict JSON Schema,
  provider.requireParameters = true, the shared prompt first, and one in-memory
  base64 image_url second. They never send model fallback arrays or auto-router
  aliases; ordinary same-model provider fallback remains enabled.
- Preferred provider is Automatic by default and otherwise uses the returned
  endpoint routing tag. ZDR and deny-data-collection are independent device-
  local controls; each can reduce route availability. Invalid preferences reset
  to Automatic with an explanatory notice.

### Privacy, storage, and compatibility removal

- Receipt images and provider credentials remain ephemeral/device-local and are
  never uploaded, synced, or exported. Local Erase removes both receipt-AI
  keys only when selected; ordinary project deletion preserves them.
- Gemini and OpenRouter disclosures identify their provider boundaries and
  explain ZDR and data-collection controls separately.
- ReceiptAiPort.testConfiguration, ReceiptAiConfigurationResult, synthetic
  inference, compatibility buttons/statuses/evidence, and compatibility-only
  key-revision state are removed. Refresh and settings changes never infer.

## Current Checkpoint

- Active task/gate: All planned milestones through M34 are COMPLETE; application
  is released.
- Current HEAD checkpoint: eb032b2. Detailed task, review, and milestone
  execution history is retained in Git history.
- Master is the integration owner branch and remains synchronized with its
  upstream without force-pushes or unrelated overwrites.
- Repository hygiene: clean formatted files, linting passing, strict typecheck
  passing, and git diff --check clean.
- No active milestone worker, reviewer, unresolved finding, or unpushed commit
  remains.
