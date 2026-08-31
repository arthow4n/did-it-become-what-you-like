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

### Integrated validation

M34-005 integrated as 26888be and M34-006 as 9e078b2. The Pages quality
failure in run #426 was a real date-sensitive local-ui fixture defect, not an
expected Pages condition; the fixture correction preserved the default Today
assertion and explicitly selected its fixed test day. The final integrated
quality gate passed 484/484 tests plus formatting, lint, typecheck, build,
release verification, frozen audit, and diff checks. No provider calls or
network-enabled automated tests were used.

## M34-FINAL archive and hygiene record

R-3430 approved the complete M34 diff with no Severity 1–4 findings. The
required documentation/ledger and test/tooling hygiene audits found no safe
file deletions, no ghost references, no obsolete spikes, no task fragmentation,
no orphan support files, and no release-blocking test cleanup. They identified
and resolved only evidence-backed low-risk issues:

- added the pinned OpenRouter SDK to THIRD_PARTY_NOTICES.md;
- corrected stale compatibility, future-prompt, design-system mapping, and
  provider-specific wording in living documentation;
- replaced the duplicated design-system ARIA shim with the canonical
  test-support harness helper.

Large component-test refactors and stale historical test-description renames
were explicitly deferred because they are not safe release-scope changes.

## Current Checkpoint

- Active task/gate: M34-FINAL COMPLETE; M34 is released.
- Pre-pruning checkpoint: a21877a. Detailed task and review history is retained
  in Git history.
- Master is the integration owner branch and must remain synchronized with its
  upstream without force-pushes or unrelated overwrites.
- Final hygiene validation passed: design-system tests 31/31, deno task
  fmt:check (211 files), deno task lint (202 files), deno task typecheck, and
  git diff --check.
- No active M34 worker, reviewer, unresolved finding, dirty worktree, or
  unpushed M34 commit remains.
