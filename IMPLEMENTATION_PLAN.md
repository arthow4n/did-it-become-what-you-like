# Implementation Plan and Orchestration Ledger

## Status and Authority

This is the single source of truth for implementation sequencing, ownership,
verification, review, and resumable progress.

Product behavior remains authoritative in `SPEC.md`; shared visual and
interaction rules remain authoritative in `DESIGN_SYSTEM.md`; agent conduct
remains authoritative in `AGENTS.md`. This plan orders that approved work and
must not silently reinterpret those documents.

### Status vocabulary

- `COMPLETE`: outputs exist, required tests and review passed, evidence is
  recorded, and the integrated commit is pushed.
- `READY`: every dependency is complete, but work has not begun.
- `PENDING`: a dependency is incomplete.
- `IN_PROGRESS`: exactly one integration owner is accountable for the task.
- `INTERRUPTED`: work may exist, but its previous agent/session is no longer
  reliably active; the checkpoint must identify recovery actions.
- `BLOCKED`: a concrete unresolved owner decision or failed prerequisite is
  recorded. Difficulty alone is not a blocker.

Task IDs and review-gate IDs are stable. Never renumber them after work begins.

## Released Baseline

M0 through M33 and all review gates through `R-3330` are `COMPLETE`. The
released application baseline delivers the approved local-first expense tracker,
receipt scanning and review, Google Drive synchronization, responsive After
Midnight facade, PWA runtime, the five-tab navigation model, and complete state
machine event handling, non-destructive retry, and exit guard lifecycles
described by `SPEC.md`, `DESIGN_SYSTEM.md`, and `AGENTS.md`. Detailed milestone
ledgers and release evidence are archived in Git history at `a1802b8`.

## Architecture and ownership baseline

The dependency boundaries remain:

```text
features/app -> src/design-system public contracts -> Mantine
                                                `-> small owned compositions
features/app -> actors -> domain + adapter ports
```

Files under `src/features/**` and `src/app/**` use only the repository
design-system facade. Mantine-specific implementation, provider mapping, and
library customization stay in `src/design-system/**`. Durable workflow and form
state remains in XState actors; product composites remain repository-owned
compositions. Domain code depends on narrow adapter ports, never browser or
library internals. Local mutations remain available when sync or network state
is unavailable.

## Definition of done

A release candidate must have focused tests for every implementation task,
appropriate actor/domain/adapter/component coverage, and a clean working tree.
Task-level validation follows the risk-based policy in `AGENTS.md`. CI/CD is the
release authority: the pushed candidate must pass CI's canonical quality gate
before deployment. That gate runs `deno task verify`. Browser E2E and gallery
verification remain separate, risk-selected checks rather than implied parts of
that gate.

Critical browser seams are covered by the approved Playwright E2E journeys in
`e2e/`, while domain and actor rules are not duplicated across browser tests.

---

## M34 — OpenRouter Receipt-AI Provider

### M34 authority, outcome, and non-goals

The owner has explicitly approved adding the official OpenRouter TypeScript SDK
as an additional receipt-scanning provider while preserving Gemini. M34 makes
provider choice a deliberate device-local configuration concern, keeps the
receipt workflow behind the existing provider-neutral `ReceiptAiPort`, and
shares extraction instructions, runtime validation, and draft mapping across
providers instead of cloning the Gemini implementation.

The approved dependency coordinate is **exactly
`npm:@openrouter/sdk@1.2.82`**. The package name is `@openrouter/sdk`; do not
substitute `@openrouter/agent`, `@openrouter/ai-sdk-provider`, the OpenAI SDK, a
provider wrapper, or a similarly named community package. `1.2.82` is the
version selected when M34 was planned. If that exact version exposes a concrete
Deno/browser incompatibility, record the evidence and stop at M34-003 for plan
reconciliation rather than silently changing package or version.

The implementing agent must verify request/response shapes against the pinned
`@openrouter/sdk@1.2.82` TypeScript types and the official OpenRouter documents
listed below. The pinned package types are the final authority for TypeScript
identifier/casing details when generated documentation examples differ.

Target dependency flow:

```text
features/app -> provider-aware receipt configuration/composition
             -> ReceiptAiPort
                |-> Gemini adapter -> @google/genai
                `-> OpenRouter adapter -> @openrouter/sdk

features/app -> actors -> domain + adapter ports
features/app -> src/design-system public contracts -> Mantine
```

**Non-goals:** replacing Gemini; falling back to a different model, using a
`models` fallback array, or using an automatic model/router alias; background
inference; server-side credential storage; synchronizing or exporting API
keys/provider selections; retaining receipt images; changing the receipt
review/domain model; adding unrelated model providers; changing Drive sync;
introducing a backend; or redesigning the visual system. OpenRouter may perform
its ordinary routing among provider endpoints that serve the one exact model
selected by the owner; M34 does not add custom provider ordering or a different
model fallback. Do not add a new shared design-system component unless the
existing facade cannot express an approved provider-selection interaction
cleanly.

### Mandatory single-agent execution rule

- One primary coding agent performs all plan reconciliation, edits, tests,
  fixes, commits, pushes, and checkpoint updates sequentially on `master`.
- Fresh read-only reviewer subagents are used only at the named M34 review
  gates. They do not modify the repository.
- If the runtime structurally separates an orchestrator from coding workers,
  delegate exactly one dependency-ready implementation task to exactly one
  write-enabled worker at a time. The orchestrator must not concurrently edit
  overlapping files or dispatch the next implementation worker before the
  current task is integrated, verified, pushed, and checkpointed.
- Do not create worktrees or parallel implementation workers for M34 unless this
  plan is explicitly amended with disjoint ownership and one integration owner.
- While commands or reviewer subagents are running, follow `AGENTS.md`: do not
  poll rapidly or launch speculative parallel work.

### Locked M34 boundary rules

1. `ReceiptAiPort` remains the actor/domain-facing inference boundary. Provider
   selection and credential handling stay at the adapter/composition/UI edge.
2. Gemini remains supported and existing Gemini credentials/model selection must
   survive migration without changing the current Gemini localStorage key.
3. OpenRouter receipt images use an in-memory base64 data URL sent directly in
   the model request; no temporary public upload or durable image storage is
   permitted.
4. Both providers reuse one provider-neutral receipt extraction instruction,
   strict runtime output validator, normalization rules, and draft mapper.
   Provider-specific JSON-Schema transforms may exist only where an API requires
   them.
5. OpenRouter requests use exactly the owner-selected model slug and must require
   routed endpoints to support every parameter the receipt request needs. Never
   send a `models` fallback array, switch to another model, or use an automatic
   model/router alias. Normal OpenRouter routing between endpoints serving that
   same model is allowed.
6. Model metadata is evidence, not final compatibility proof. Where metadata
   cannot prove every required capability, use the existing real 1x1 synthetic
   image configuration probe without owner receipt/expense data.
7. API keys remain `SecretValue`s, device-local only, redacted from diagnostics,
   and excluded from IndexedDB datasets, Drive sync, imports/exports, logs, and
   user-visible raw provider errors.
8. Receipt inference remains explicit-action-only. Provider setup, model refresh,
   route changes, application startup, and network restoration must not trigger
   a receipt inference request.
9. Existing offline/manual-entry/review/save semantics remain unchanged. A
   failed or invalid provider response persists no accepted receipt or expense.
10. Feature/app code continues to use only the repository design-system facade;
    no direct Mantine imports are introduced outside `src/design-system/**`.
11. Do not turn documentation examples into new product policy. In particular,
    `provider.dataCollection` and `provider.zdr` affect provider availability and
    privacy routing. Leave them unset unless M34-001 explicitly adds an approved
    requirement to `SPEC.md`; use the privacy docs to make disclosure truthful,
    not to invent a stricter or looser policy.
12. Do not enable SDK debug logging in application or tests. Provider errors,
    request headers, API keys, prompts, and receipt content must not be dumped to
    console merely to simplify integration debugging.

### M34 mandatory reference map

This section exists so an orchestrator or worker does not have to infer which
parts of large documents matter. Read the references assigned to the current
task before editing. Do not delegate a worker only a task title: its prompt must
include the task block, the relevant rows below, the locked M34 rules, and the
exact acceptance/tests/verification requirements.

#### Repository authorities and how to use them

1. **`AGENTS.md`**
   - `Git Workflow`: commit and push each completed task; never force-push or
     overwrite unrelated work.
   - `UI and Implementation Workflow`: implementation authorization, checkpoint
     reconciliation, one source-of-truth plan, task test requirements,
     centralized `src/test-support/**` reuse, risk-based validation, reviewer
     behavior, and the no-speculative-work rule while commands/subagents run.
   - `Design-system facade boundary`: feature/app files never import Mantine or
     another component library directly.
   - **Use for:** every task, every review gate, every commit/push decision.

2. **`SPEC.md`**
   - `Product Principles`: preserve local-first behavior and private-by-default
     handling.
   - `Required Product Capabilities > Invoice-Assisted Entry`: preserve receipt
     itemization, ephemeral source images, user review before save, explicit
     Scan-with-AI-only inference, capability validation, structured output,
     no silent model substitution, failure semantics, image preparation, and the
     strict outbound receipt-data allowlist.
   - `Local Browser Storage`: API key/model/image-preparation settings remain
     device-local, keys are not browser secrets, they are not synced/exported,
     removing a key disables only AI scanning, and missing-key setup stays
     in-place without losing the selected receipt.
   - Project/deletion and Local Erase requirements: deleting an ordinary project
     must not remove unrelated receipt-AI credentials; explicit privacy erasure
     owns credential removal.
   - **Use for:** M34-001 product wording/migration contract, M34-002 extraction
     invariants, M34-004 UI behavior, M34-005 disclosure/erase semantics, and
     all final reviews. If code or an external doc suggests behavior that
     conflicts with `SPEC.md`, product behavior follows `SPEC.md` unless the
     owner explicitly approves a spec change.

3. **`DESIGN_SYSTEM.md`**
   - `Foundation Decisions`: React/XState ownership, accessible repository-owned
     facade, pinned browser dependencies, and After Midnight styling source of
     truth.
   - `Ownership Boundary` and `Design-system facade boundary`: components do not
     call providers or own business state; screens bind actors/ports and reuse
     facade components.
   - `Theme Tokens`, responsive-layout rules, layout/sizing discipline, and
     existing field/button/overlay patterns: use these when adding provider
     selection, secret input, model picker, status/error copy, or quick setup.
   - **Use for:** M34-004 and any UI touched in M34-005; R-3420 and R-3430.
     Inspect `src/design-system/index.ts` plus existing relevant components before
     adding or changing any facade contract.

4. **`.agents/skills/implementation-planning/SKILL.md`**
   - `Core Principles & Governance`: one living plan, strict statuses, one
     primary writer, fresh read-only review gates.
   - `Standardized Task Definition Schema` and `Review Gate Schema`: do not
     weaken or skip task acceptance/evidence when delegating.
   - `Current Checkpoint Ledger & Orchestration Prompt`: update checkpoint after
     each completed/blocked/interrupted task.
   - `Mandatory Milestone Step: Lifecycle Archiving & Pruning`: M34-FINAL must
     archive/prune the ledger and run repo hygiene with an `[archive]` commit.
   - **Use for:** orchestrator behavior and ledger maintenance, not application
     product decisions.

5. **Existing code contracts — read before refactoring them**
   - `src/adapters/ports/receipt-ai.ts`: preserve this provider-neutral actor/
     domain port rather than introducing OpenRouter into actor/domain code.
   - `src/adapters/gemini/client.ts`: pattern for isolating an external SDK behind
     a narrow local browser client.
   - `src/adapters/gemini/adapter.ts`: current capability mapping, synthetic
     configuration proof, extraction flow, abort/image-erasure behavior, and
     redacted provider-error mapping. Reuse semantics; do not clone provider-
     neutral prompt/schema/parser code into OpenRouter.
   - `src/adapters/gemini/schema.ts`: identify which output schema/parser/mapper
     pieces are provider-neutral and which Google JSON-Schema reduction is
     provider-specific.
   - `src/adapters/gemini/secrets.ts` and `src/adapters/ports/secrets.ts`:
     preserve the current Gemini localStorage key and `SecretValue` redaction.
   - `src/domain/schema/records.ts`: migrate Gemini-specific device-local model/
     compatibility state without changing portable dataset formats.
   - `src/features/receipt-ui.tsx`, `src/features/local-ui.tsx`, and
     `src/features/sync-portability-runtime.tsx`: current Gemini-specific
     composition, settings route/copy, quick setup, and Local Erase seams to
     generalize.
   - `src/test-support/**`: reuse the existing harnesses/fake ports; do not create
     parallel test infrastructure.

#### Official OpenRouter references and the implementation decision each one owns

1. **TypeScript SDK overview** —
   `https://openrouter.ai/docs/client-sdks/typescript/overview`
   - Confirms the official package is `@openrouter/sdk`, it is ESM-only, and the
     normal client entry point is `OpenRouter`.
   - **Use for:** dependency/package identity and top-level SDK shape only.
     Ignore links/examples for `@openrouter/agent`; M34 is a Client SDK
     integration, not an agent/tool-loop integration.

2. **TypeScript SDK Chat reference** —
   `https://openrouter.ai/docs/client-sdks/typescript/sdks/chat/README`
   - Defines `chat.send`, non-streaming/streaming responses, request options,
     `fetchOptions`, retry configuration, SDK error classes/status codes, and
     the optional `OpenRouterCore` + standalone-function form for improved tree
     shaking.
   - **Use for:** M34-003 request execution, `AbortSignal` propagation through
     request/fetch options, browser bundle choice, and provider-error mapping.
     Do not enable SDK retries merely because an option exists; existing app
     retry semantics remain authoritative. `OpenRouterCore` is allowed only as
     an import/tree-shaking choice from the same exact `@openrouter/sdk` package.

3. **TypeScript SDK Models reference** —
   `https://openrouter.ai/docs/client-sdks/typescript/sdks/models/README`
   - Defines `models.list()` and its async pagination. The current
     `listForUser()` API uses a separate bearer security parameter and is not the
     M34 credential flow.
   - **Use for:** M34-003 model enumeration. Use `models.list()` and consume every
     required page. Do not switch to `listForUser()` or add OAuth/bearer account
     plumbing unless this plan is explicitly amended.

4. **Models capability guide / API fields** —
   `https://openrouter.ai/docs/guides/overview/models`
   and `https://openrouter.ai/docs/api/api-reference/models/get-models`
   - Defines model IDs, `architecture.input_modalities`, output modalities,
     `supported_parameters`, and server-side filters.
   - **Use for:** map image input + text output + structured-output evidence into
     `ReceiptAiModel`. A useful metadata candidate has image input and the
     structured-output/response-format parameters needed by the receipt call.
     Metadata is still not proof of endpoint-level support, so preserve the
     synthetic configuration test.

5. **Image Inputs** —
   `https://openrouter.ai/docs/guides/overview/multimodal/image-understanding`
   - Defines multimodal chat input, recommends text before image content, and
     supports a base64 data URL for local/private images.
   - **Use for:** M34-003 receipt request construction. Send the instruction text
     first, then one `image_url` content item containing the in-memory prepared
     receipt as `data:<mime>;base64,<bytes>`. Never upload the image to obtain a
     public URL.

6. **Structured Outputs** —
   `https://openrouter.ai/docs/guides/features/structured-outputs`
   - Defines `response_format` / JSON Schema with `strict: true`, explains that
     support is provider-endpoint-specific, and directs callers to require
     parameters when routing.
   - **Use for:** M34-003 extraction and synthetic compatibility proof. Send the
     provider-neutral receipt JSON Schema in strict structured-output mode and
     still parse/validate the returned content locally with the shared Zod
     runtime schema; never trust provider-side enforcement alone.

7. **Provider Routing** —
   `https://openrouter.ai/docs/guides/routing/provider-selection`
   - Defines `require_parameters` semantics (SDK casing may be
     `requireParameters`) plus same-model provider routing controls.
   - **Use for:** set the pinned SDK's equivalent of
     `provider.requireParameters = true` for receipt extraction and synthetic
     configuration calls. Send exactly one `model` slug. Do not send `models`,
     use an auto-router model, or manually substitute a second model. Leave
     provider ordering/fallback policy at OpenRouter defaults unless a later
     approved spec requirement says otherwise.

8. **OpenRouter privacy/data handling** —
   `https://openrouter.ai/docs/guides/privacy/data-collection`,
   `https://openrouter.ai/docs/guides/privacy/provider-logging`, and
   `https://openrouter.ai/docs/guides/features/zdr`
   - Explain OpenRouter-side prompt retention choices, downstream provider
     logging/training variability, request-level data-policy routing, and ZDR.
   - **Use for:** M34-001/M34-005 truthful disclosure and privacy tests. The app
     must say that receipt payload goes through OpenRouter to a routed provider
     endpoint for the selected model. These docs do **not** by themselves
     authorize setting `dataCollection: "deny"` or `zdr: true`; those options
     can reduce endpoint/model availability and require explicit product-policy
     approval in `SPEC.md`.

9. **Exact npm package record** —
   `https://www.npmjs.com/package/@openrouter/sdk`
   - Confirms package identity/version and warns that SDK debug logging can emit
     sensitive authentication/request information.
   - **Use for:** dependency provenance only. M34 pins
     `npm:@openrouter/sdk@1.2.82`; never turn on `debugLogger` or
     `OPENROUTER_DEBUG` in the app/tests.

#### Task-to-reference routing for orchestrators/workers

- **M34-001:** read `SPEC.md` Product Principles, Invoice-Assisted Entry, Local
  Browser Storage, deletion/erase requirements; `AGENTS.md` implementation
  workflow; OpenRouter privacy/data-handling docs. This task defines product and
  migration contracts only; do not start SDK integration here.
- **M34-002:** read `SPEC.md` Invoice-Assisted Entry; `receipt-ai.ts`;
  `gemini/{adapter,schema}.ts` and their tests. This task extracts shared
  inference semantics without making OpenRouter network calls.
- **R-3410:** review M34-001/002 against the repo authorities and shared-code
  contract; external OpenRouter request-shape docs are not yet a reason to alter
  product behavior.
- **M34-003:** read all OpenRouter references 1–7 and 9 plus
  `gemini/client.ts`, `gemini/adapter.ts`, the shared receipt module, and adapter
  error contracts. This is the only task that should decide concrete SDK request
  shapes, model pagination, abort wiring, structured-output fields, and error
  class/status mapping.
- **M34-004:** read `DESIGN_SYSTEM.md` Foundation/Ownership/Facade/responsive
  rules; `AGENTS.md` UI workflow; `SPEC.md` setup/model-selection behavior; and
  current receipt/local UI code. UI must consume provider ports/registry; it must
  not import `@openrouter/sdk` or reproduce adapter logic.
- **R-3420:** review the pinned SDK usage against OpenRouter references 1–7 and 9,
  and review UI against `SPEC.md`/`DESIGN_SYSTEM.md`. Reject undocumented SDK
  assumptions, alternative packages, live-network tests, and direct Mantine
  imports.
- **M34-005:** read `SPEC.md` privacy/storage/delete semantics, current secrets/
  destruction/runtime code, and OpenRouter privacy references 8–9. This task
  handles disclosure/secrets/erase only; do not modify extraction request shape
  except for a proven privacy-contract bug.
- **M34-006:** read `AGENTS.md` validation/test-support rules and the complete M34
  acceptance contract. Prove integration with fakes at the external boundary;
  do not use real provider credentials/network.
- **R-3430:** audit the complete M34 diff against every repository authority and
  the exact OpenRouter reference set above, then verify that any implementation
  choice not directly specified by them is either a narrow internal detail or a
  recorded owner-approved decision.
- **M34-FINAL:** follow only the implementation-planning and repo-hygiene skills
  plus `AGENTS.md` archive rules; do not reopen provider/product design while
  pruning completed history.

### Delegation packet rule for a less-capable worker

Whenever an orchestrator delegates an M34 implementation task, the worker prompt
must contain, verbatim or equivalently complete:

1. the exact task ID/title/status/dependency and ownership paths;
2. that task's Scope/non-goals, Outputs/acceptance, Tests, and Verification;
3. all Locked M34 boundary rules that can affect the task;
4. the task-to-reference row above plus the exact referenced URLs/paths;
5. a statement that `SPEC.md` owns product behavior, `AGENTS.md` owns process,
   `DESIGN_SYSTEM.md` owns UI boundaries, and pinned `@openrouter/sdk@1.2.82`
   types own TypeScript request-field spelling/casing;
6. instructions to inspect existing code/tests before creating new abstractions;
7. instructions to report changed files, exact commands/results, remaining
   uncertainty, and the commit SHA back to the orchestrator;
8. instructions not to start the next task, broaden scope, change package/version,
   invent privacy policy, or silently resolve a product ambiguity.

A worker that encounters a real conflict between these authorities must report
it as a blocker with exact evidence. It must not guess.

### Restart and compaction recovery checklist

- [ ] Read `AGENTS.md`, `SPEC.md`, `DESIGN_SYSTEM.md`, this M34 section, and
      Current Checkpoint.
- [ ] Read the mandatory reference rows assigned to the next task; for M34-003,
      reopen the official OpenRouter URLs rather than relying on memory.
- [ ] Run `git status --short --branch`, `git log -n 20 --oneline`,
      `git branch -vv`, and `git worktree list --porcelain`; reconcile local
      `master` with its upstream before editing.
- [ ] Audit any uncommitted/unpushed work and preserve it; never reset or
      overwrite unrelated changes.
- [ ] Confirm the last recorded task/review evidence against the actual commit
      and test state before resuming.

### M34 dependency graph

```text
M34-001 -> M34-002 -> R-3410
                         |
                      M34-003 -> M34-004 -> R-3420
                                               |
                                            M34-005 -> M34-006 -> R-3430
                                                                     |
                                                                M34-FINAL
```

#### M34-001 — Provider-aware product and device-local configuration contract

- **Status/dependencies:** `READY`; no M34 dependency.
- **Ownership:** `SPEC.md`, `src/adapters/ports/secrets.ts`,
  `src/adapters/ports/receipt-ai.ts` only if a provider-neutral contract type is
  required, `src/domain/schema/records.ts`, device-settings read/write and
  focused migration tests in `src/features/receipt-ui.tsx` /
  `src/features/receipt-ui.test.tsx` or a smaller extracted settings module if
  that materially improves ownership.
- **Scope/non-goals:** amend the approved Invoice-Assisted Entry specification
  from Gemini-only to Gemini + OpenRouter; define device-local provider choice,
  provider-scoped selected model/key revision/compatibility evidence, truthful
  provider-specific disclosure requirements, and receipt-key erase semantics.
  Generalize `SecretName` for both API keys. Introduce a backward-compatible
  device-settings representation and migration from existing
  `selectedGeminiModel`, `geminiKeyRevision`, and
  `geminiCompatibilityEvidence`. Do not change portable dataset settings or
  sync/export formats. Do not invent ZDR/data-collection routing policy; if the
  owner has not explicitly approved such a policy, keep those request controls
  unset and make disclosure accurate instead.
- **Outputs/acceptance:** existing Gemini device settings load into the new
  representation with Gemini selected and no lost compatibility evidence;
  provider switches keep each provider's model/evidence isolated; legacy
  persisted values remain readable; no secret value enters the migrated
  settings object.
- **Tests:** schema/migration tests for legacy Gemini-only settings, new
  provider-aware settings, invalid provider/configuration rejection,
  provider-scoped evidence, and read/write round trips.
- **Verification:** format/lint changed TypeScript; `deno test --related=` for
  directly changed settings/schema sources or `deno task test:affected` as
  appropriate; `git diff --check`; review `SPEC.md` diff for consistency with
  the existing privacy and local-first requirements.

#### M34-002 — Provider-neutral receipt inference core and Gemini regression

- **Status/dependencies:** `PENDING`; depends on `M34-001`.
- **Ownership:** `src/adapters/gemini/schema.ts`,
  `src/adapters/gemini/adapter.ts`, their tests, plus a new provider-neutral
  receipt-inference module under `src/adapters/receipt-ai/**` (or equivalently
  narrow shared adapter location) and its focused tests.
- **Scope/non-goals:** extract the shared receipt output Zod schema, decimal
  normalization, output parsing/validation, `ReceiptExtractionDraft` mapping,
  extraction instruction, synthetic receipt request fixture, and other truly
  provider-neutral helpers from Gemini. Retain a Gemini-specific generated JSON
  Schema transform only for Google's supported subset. Do not alter receipt
  semantics or weaken local validation to accommodate either provider.
- **Outputs/acceptance:** one runtime source of truth validates both providers;
  OpenRouter can consume a full standards-compatible JSON Schema derived from
  that source; Gemini still receives its supported subset and all existing
  Gemini success/failure mappings remain behaviorally equivalent.
- **Tests:** shared validator/parser/mapping tests; schema-equivalence regression
  tests where applicable; Gemini extraction, compatibility-probe, invalid-output,
  abort, image-erasure, and error-mapping regressions.
- **Verification:** format/lint changed files; focused related tests for the new
  shared module and Gemini adapter; `deno task test:affected`; `git diff --check`.

#### R-3410 — Configuration and shared-inference boundary review

- **Status/dependencies:** `PENDING`; depends on `M34-002`.
- **Reviewer role:** fresh read-only architecture/contracts reviewer subagent.
- **Audit scope:** M34-001..002 diffs; `SPEC.md` alignment; migration safety;
  secret boundaries; absence of provider concepts in actors/domain business
  logic; single-source receipt schema/prompt/mapping; Gemini regression evidence;
  compliance with `AGENTS.md`, `DESIGN_SYSTEM.md`, and the M34 reference map.
- **Remediation loop:** primary agent fixes all severity 1–3 findings in focused
  commits, reruns only affected evidence, records findings/resolutions here, and
  obtains reviewer closure before starting M34-003.

#### M34-003 — Official OpenRouter SDK client and `ReceiptAiPort` adapter

- **Status/dependencies:** `PENDING`; depends on `R-3410`.
- **Ownership:** `deno.json`, `deno.lock`, new
  `src/adapters/openrouter/{client,adapter,index}.ts` and focused tests; shared
  receipt-inference helpers only when a provider-neutral defect is discovered.
- **Scope/non-goals:** pin exactly `npm:@openrouter/sdk@1.2.82`; do not use or
  substitute another OpenRouter SDK/provider package or another version without
  a recorded plan reconciliation. Isolate official SDK construction/types in
  `client.ts`, analogous to the existing Google SDK edge; implement
  `ReceiptAiPort.listModels`, `testConfiguration`, and `extractReceipt`. Use
  `models.list()` and its async pagination, not `listForUser()`. Use model
  metadata for image/text/structured-output evidence and the synthetic 1x1 image
  probe when metadata is insufficient. Construct receipt input as prompt text
  followed by an `image_url` base64 data URL. Request strict JSON-Schema
  structured output using the full shared schema and set the pinned SDK's
  equivalent of `provider.requireParameters = true`. Send exactly one selected
  `model` slug; do not send a `models` fallback array or auto-router alias.
- **Outputs/acceptance:** OpenRouter model IDs/display names/capabilities map into
  `ReceiptAiModel`; incompatible or missing models cannot scan; successful
  structured output passes the shared local validator before becoming a draft;
  `AbortSignal` reaches the SDK HTTP request through supported request/fetch
  options; provider failures map to the existing redacted adapter taxonomy,
  including malformed request, auth, credits/payment or quota exhaustion, rate
  limit, oversized/unprocessable input, missing model, and provider/service
  unavailability where distinguishable. No SDK debug logging is enabled.
- **Tests:** SDK wrapper construction/request tests; `models.list()` pagination;
  capability mapping; synthetic configuration pass/fail; exact multimodal
  request ordering and base64 data URL; strict structured-output request;
  `requireParameters`; exactly one selected model; valid output;
  malformed/missing/non-JSON output; abort propagation; redacted error taxonomy;
  zero real network calls.
- **Verification:** update lockfile using the repository's normal Deno/npm flow;
  format/lint; focused OpenRouter tests; `deno task typecheck` because a new SDK
  boundary is introduced; `deno task test:affected`; `git diff --check`.

#### M34-004 — Provider registry, settings UI, and in-place scan setup

- **Status/dependencies:** `PENDING`; depends on `M34-003`.
- **Ownership:** `src/features/receipt-ui.tsx`,
  `src/features/receipt-ui.test.tsx`, `src/features/local-ui.tsx`,
  `src/features/local-ui.test.tsx`, adapter composition imports, and
  `src/design-system/**` only if an existing facade contract cannot express the
  approved UI without a deliberate reviewed extension.
- **Scope/non-goals:** compose Gemini and OpenRouter over shared secret storage;
  keep the receipt actor wired to exactly one active `ReceiptAiPort`; replace
  Gemini-only settings/status/quick-setup presentation with provider-aware
  receipt-scanning configuration; expose Gemini/OpenRouter provider selection,
  active provider key controls, active provider model refresh/test, and the
  existing image-preparation preference. Prefer a provider-neutral settings
  route such as `/settings/receipt-ai`; preserve or redirect the legacy
  `/settings/gemini` route so existing navigation/deep links do not break. Do
  not trigger inference while switching providers or refreshing configuration.
  Feature/UI files must not import `@openrouter/sdk`; they consume provider ports
  and composition contracts only.
- **Outputs/acceptance:** either provider can be configured independently;
  switching providers restores that provider's own valid selection/evidence;
  missing key/model setup can occur in-place without losing the selected receipt;
  all scan/status/error copy names the active provider rather than universally
  saying Gemini; selected models are never silently substituted.
- **Tests:** component tests for provider selection, per-provider key/model state,
  legacy route compatibility, settings summary, model refresh/test, quick setup
  with an already-selected receipt, provider switch during setup, offline state,
  and explicit-action-only inference. Reuse centralized component harnesses and
  fake ports.
- **Verification:** format/lint changed files; `deno task test:affected`; focused
  component tests if import-graph selection is insufficient; targeted gallery or
  browser check only if focus/navigation/overlay behavior changed; `git diff --check`.

#### R-3420 — OpenRouter adapter and provider UX review

- **Status/dependencies:** `PENDING`; depends on `M34-004`.
- **Reviewer role:** fresh read-only provider-integration/UI reviewer subagent.
- **Audit scope:** M34-003..004 diffs; exact `@openrouter/sdk@1.2.82` dependency;
  official SDK usage against the mandatory reference map and pinned types;
  `models.list()` pagination; structured-output/image request correctness;
  `requireParameters`; single-model invariant; cancellation/error redaction;
  absence of SDK debug logging, hidden model substitution, or invented retry/
  privacy policy; provider registry ownership; settings/quick-setup
  accessibility; design-system facade compliance; test sufficiency and no
  live-network tests.
- **Remediation loop:** primary agent fixes all severity 1–3 findings in focused
  commits, reruns affected validation, records resolutions here, and obtains
  reviewer closure before M34-005.

#### M34-005 — Disclosure, shared secret storage, and privacy erase generalization

- **Status/dependencies:** `PENDING`; depends on `R-3420`.
- **Ownership:** `src/adapters/gemini/secrets.ts`, a provider-neutral secrets
  adapter location if extracted, `src/actors/destruction.ts`, destruction
  contracts/tests, `src/domain/destruction.ts`, `src/features/destruction-ui.tsx`,
  `src/features/sync-portability-runtime.tsx`, receipt disclosure/settings copy,
  and focused tests. Preserve the existing Gemini storage key literal.
- **Scope/non-goals:** make localStorage secret handling provider-neutral while
  retaining existing Gemini credential compatibility and adding an independent
  OpenRouter key. Generalize receipt disclosure to truthfully identify the
  active provider. For OpenRouter, state that the allowed payload is sent
  through OpenRouter to a routed provider endpoint serving the selected model;
  do not imply a direct-only vendor path or make guarantees stronger than the
  approved request controls. Generalize Local Erase from a Gemini-only key
  choice to removing receipt-scanning API keys and remove both provider keys
  when selected, while safely honoring/migrating the legacy erase-choice state.
  Project deletion continues to leave unrelated API credentials intact. Do not
  add `dataCollection`/ZDR routing in this task unless M34-001 explicitly put
  that approved policy into `SPEC.md`.
- **Outputs/acceptance:** both secrets are redacted and isolated; old Gemini key
  remains readable after the extraction; OpenRouter gets a separate
  repository-namespaced key; disclosure retains the existing data allowlist and
  explicit-action requirement; Local Erase removes both keys only when chosen;
  delete-everywhere/project deletion semantics outside that choice do not drift.
- **Tests:** secret-store compatibility/redaction tests; receipt disclosure tests
  for Gemini and OpenRouter; local-erase actor/domain/runtime/UI tests for both
  credentials, retry/partial-failure behavior, legacy choice migration, and
  project-deletion non-removal.
- **Verification:** format/lint; focused adapter/destruction/component tests;
  `deno task test:affected`; `git diff --check`; targeted browser check only for
  changed privacy/erase dialog interaction that component tests cannot prove.

#### M34-006 — Integrated receipt-provider acceptance and release preflight

- **Status/dependencies:** `PENDING`; depends on `M34-005`.
- **Ownership:** focused integration/E2E tests under `src/**` and `e2e/**` only
  where a browser seam cannot be proven below E2E; documentation corrections
  discovered during integration; no unrelated cleanup.
- **Scope/non-goals:** prove the end-to-end dependency wiring without contacting
  Gemini or OpenRouter live. Cover provider configuration -> model compatibility
  -> receipt scan request -> validated review draft using deterministic fakes at
  the external SDK/network edge. Keep E2E deliberately small and do not repeat
  domain/adapter assertions already covered below the browser layer.
- **Outputs/acceptance:** Gemini regression path passes; OpenRouter path reaches
  the same receipt review contract; provider changes do not alter manual/offline
  behavior; no credential/image persistence or export regression; repository
  quality gate passes on the integrated candidate.
- **Tests:** one focused browser/component integration seam for provider selection
  and scan where warranted; existing critical receipt review journey; any
  release-verification assertion needed to ensure the new dependency bundles
  correctly. No live API credentials or calls.
- **Verification:** risk-selected focused checks first, then exactly one final
  `deno task verify` on the integrated candidate because M34 changes dependency,
  lockfile, shared configuration, persistence, adapters, and UI. Run
  `deno task test:e2e` only for the deliberately selected browser seam if M34
  changes behavior covered there. Record exact commands/results and do not rerun
  an umbrella command's constituent suites without a stated risk reason.

#### R-3430 — Final M34 release-candidate review

- **Status/dependencies:** `PENDING`; depends on `M34-006`.
- **Reviewer role:** fresh read-only final release reviewer subagent.
- **Audit scope:** complete M34 diff from its planning base; all locked rules and
  mandatory reference-map decisions; spec/implementation consistency; migration
  compatibility; provider-neutral architecture; exact package/version and SDK
  correctness; privacy/redaction; Local Erase semantics; affected/full
  validation evidence; browser coverage scope; Git cleanliness and pushed-commit
  state.
- **Remediation loop:** primary agent resolves every severity 1–3 finding,
  reruns only risk-affected checks plus the full quality gate if shared/cross-cutting
  code changed after its recorded run, pushes the corrected candidate, and
  obtains reviewer closure before M34-FINAL.

#### M34-FINAL — Milestone closure, ledger archiving, and repo hygiene pruning

- **Status/dependencies:** `PENDING`; depends on `R-3430`.
- **Ownership:** `IMPLEMENTATION_PLAN.md`, `SPEC.md`, `DESIGN_SYSTEM.md` only if
  M34 introduced reviewed design-system documentation changes, and files
  identified by the repository-hygiene audit.
- **Scope/non-goals:** preserve the final pre-pruning M34 commit hash and concise
  released behavior; fold M34 into Released Baseline; prune completed M34 task,
  review, temporary evidence, and migration-only prose from the living ledger;
  run `.agents/skills/repo-hygiene-pruning/SKILL.md`; remove temporary spikes or
  obsolete migration scaffolding only when proven safe; verify no dangling
  Markdown references. Do not reopen completed product decisions or perform
  unrelated refactors.
- **Outputs/acceptance:** compact living `IMPLEMENTATION_PLAN.md` with M0 through
  M34 released, durable detailed history preserved in Git, no stale `IN_PROGRESS`
  ownership, no temporary M34 artifacts, clean synchronized `master`.
- **Tests:** no new behavior tests required for pure archival; if hygiene removes
  executable code/configuration, run the narrow checks capable of detecting that
  change.
- **Verification:** per the planning skill's archival procedure, run
  `deno task typecheck`, `deno task fmt:check`, `deno task lint`, and
  `git diff --check` for the pruning commit; use `[archive]` in the commit
  message for plan/document deletion or archival work; push the completed
  archive commit.

---

## Current Checkpoint

- **Active task / gate:** `M34-001` (`READY`).
- **Planning base:** remote `master` at `b2eefd4` —
  `docs(agents): add instruction to avoid speculative actions while waiting for commands or subagents`.
- **Pushed commit / HEAD:** the M34 planning/reference commits on top of
  `b2eefd4` are the current remote `master`; resolve the exact SHA during
  implementation recovery with `git rev-parse HEAD` rather than assuming the
  archived M33 hash.
- **Verification status:** planning-only changes; no application code changed and
  no runtime test evidence is claimed. The implementing agent starts M34 with
  M34-001's focused validation contract.
- **Active / preserved work:** no M34 implementation owner has started work in
  this ledger. Before editing, reconcile the local checkout, upstream `master`,
  branches/worktrees, and uncommitted work as required by `AGENTS.md`.
- **Exact next action:** primary orchestrator/implementer reads the authoritative
  docs, M34 mandatory reference map, and M34-001 delegation row; performs the
  restart/recovery checklist; marks `M34-001` `IN_PROGRESS`; then executes or
  delegates only M34-001 and records/pushes its evidence before M34-002.

## Ready-to-Use Orchestration Prompt

```text
Act as the single primary orchestrator/integration owner for M34 — OpenRouter
Receipt-AI Provider in the checked-out did-it-become-what-you-like repository.
If your environment separates orchestrator and worker agents, use exactly one
write-enabled implementation worker at a time and remain the sole integration/
checkpoint owner.

The owner has explicitly authorized this implementation: add the official
OpenRouter TypeScript Client SDK as a second receipt-scanning provider while
preserving Gemini.

DEPENDENCY IDENTITY — DO NOT GUESS:
- Exact Deno/npm dependency coordinate: `npm:@openrouter/sdk@1.2.82`.
- Package name: `@openrouter/sdk`.
- Do NOT use `@openrouter/agent`, `@openrouter/ai-sdk-provider`, OpenAI's SDK,
  another provider wrapper, another similarly named package, or another version
  without recording a concrete incompatibility and reconciling the plan.

AUTHORITIES — DO NOT GUESS:
- `SPEC.md` owns product behavior and privacy/storage semantics. For M34, focus
  on Product Principles, Required Product Capabilities > Invoice-Assisted Entry,
  Local Browser Storage, and deletion/erase behavior.
- `AGENTS.md` owns git, planning, testing/verification, reviewer, waiting, and
  design-system-facade process rules.
- `DESIGN_SYSTEM.md` owns UI composition/facade/responsive/accessibility rules;
  focus on Foundation Decisions, Ownership Boundary, Design-system facade
  boundary, tokens/layout/sizing, and existing input/overlay patterns.
- `.agents/skills/implementation-planning/SKILL.md` owns milestone lifecycle,
  task/review schema, checkpointing, and final archive/hygiene behavior.
- `IMPLEMENTATION_PLAN.md` M34 owns sequencing, task scope/non-goals,
  acceptance, tests, verification, and the mandatory reference map.
- Pinned `@openrouter/sdk@1.2.82` TypeScript types own exact SDK field/type
  spelling and casing if generated docs/examples disagree.

OFFICIAL OPENROUTER DOCUMENTS — READ THE ROWS RELEVANT TO THE CURRENT TASK:
1. Client SDK overview:
   https://openrouter.ai/docs/client-sdks/typescript/overview
2. TypeScript Chat SDK reference:
   https://openrouter.ai/docs/client-sdks/typescript/sdks/chat/README
3. TypeScript Models SDK reference:
   https://openrouter.ai/docs/client-sdks/typescript/sdks/models/README
4. Models capability/API fields:
   https://openrouter.ai/docs/guides/overview/models
   https://openrouter.ai/docs/api/api-reference/models/get-models
5. Image inputs:
   https://openrouter.ai/docs/guides/overview/multimodal/image-understanding
6. Structured outputs:
   https://openrouter.ai/docs/guides/features/structured-outputs
7. Provider routing:
   https://openrouter.ai/docs/guides/routing/provider-selection
8. Privacy/data handling:
   https://openrouter.ai/docs/guides/privacy/data-collection
   https://openrouter.ai/docs/guides/privacy/provider-logging
   https://openrouter.ai/docs/guides/features/zdr
9. Exact npm package record:
   https://www.npmjs.com/package/@openrouter/sdk

The M34 mandatory reference map explains exactly what each document is allowed
to decide. Follow that mapping instead of browsing examples and inferring new
product behavior.

Before editing:
1. Read AGENTS.md, the relevant SPEC.md and DESIGN_SYSTEM.md sections,
   .agents/skills/implementation-planning/SKILL.md, the complete M34 section,
   Current Checkpoint, and the task-to-reference row for the next task.
2. Follow M34's restart/compaction recovery checklist. Reconcile local master
   with upstream and preserve any unrelated/uncommitted work.
3. Confirm M34-001 is the next dependency-ready task and mark only that task
   IN_PROGRESS in the ledger.
4. If delegating to a worker, build its prompt using the M34 Delegation packet
   rule. Never send only a task title or a vague summary.

Execution rules:
- Work sequentially on master. One implementation task, one write-enabled worker
  at most, one integration/checkpoint owner.
- Finish the current task's code/tests/verification, commit and push it, then
  update the ledger with exact evidence before advancing.
- A worker must not start the next task. It reports changed files, exact command
  results, remaining uncertainty, and commit SHA to the orchestrator.
- Use fresh read-only reviewer subagents only at R-3410, R-3420, and R-3430.
  While a reviewer or long command is running, stop and await the reactive
  completion notification; do not poll rapidly or launch speculative work.
- Preserve ReceiptAiPort as the receipt actor/domain boundary. Keep provider
  choice, API keys, SDK construction, and routing at the app/adapter edge.
- In M34-003, use `models.list()` with required pagination. `listForUser()` uses
  a different bearer-security flow and is out of scope.
- In OpenRouter receipt/synthetic calls, send one exact selected `model` slug,
  strict JSON-Schema structured output, and the pinned SDK equivalent of
  `provider.requireParameters = true`.
- Never send a `models` fallback array, use an automatic model/router alias, or
  silently select another model. Normal OpenRouter routing among endpoints that
  serve the same selected model is allowed; do not invent custom provider-order
  policy.
- Construct receipt multimodal content as instruction text first, followed by
  one base64 `image_url` data URL. Never upload a receipt image to make it public.
- Always validate provider output locally through the shared Zod schema before
  creating review state.
- Do not set `provider.dataCollection` or `provider.zdr` merely because examples
  show them. Those are product/privacy policy choices; leave them unset unless
  M34-001 explicitly records owner-approved behavior in SPEC.md.
- Never enable OpenRouter SDK debug logging. Never make real Gemini/OpenRouter
  calls from automated tests and never place a real API key in source, fixtures,
  logs, screenshots, or test output.
- Reuse one shared receipt instruction/runtime validator/draft mapper across
  Gemini and OpenRouter. Do not clone the Gemini adapter wholesale.
- Keep receipt images ephemeral and API keys device-local/redacted and excluded
  from sync/export.
- Feature/app code must use the existing design-system facade and must not import
  `@openrouter/sdk` or Mantine directly.
- Use centralized `src/test-support/**` infrastructure. Record exact commands/
  results. Use risk-selected task validation and one final `deno task verify` at
  M34-006; do not mechanically duplicate test runs.
- Automatically commit and push completed work according to AGENTS.md; never
  force-push or overwrite unrelated work.
- If authorities conflict or a required product decision is genuinely missing,
  report a BLOCKED item with exact evidence. Do not guess.
- Complete R-3430 and M34-FINAL, including [archive] ledger pruning and repository
  hygiene, before declaring the milestone released.
```
