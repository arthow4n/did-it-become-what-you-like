# Implementation Plan and Orchestration Ledger

## Status and Authority

This is the single source of truth for implementation sequencing, ownership,
verification, review, and resumable progress.

Product behavior remains authoritative in `SPEC.md`; shared visual and
interaction rules remain authoritative in `DESIGN_SYSTEM.md`; agent conduct
remains authoritative in `AGENTS.md`. This plan orders approved work and must
not silently reinterpret those documents.

### Status vocabulary

- `COMPLETE`: outputs exist, required tests and review passed, evidence is
  recorded, and the integrated commit is pushed.
- `READY`: every dependency is complete, but work has not begun.
- `PENDING`: a dependency is incomplete.
- `IN_PROGRESS`: exactly one integration owner is accountable for the task.
- `INTERRUPTED`: work may exist, but its previous agent/session is no longer
  reliably active; the checkpoint identifies recovery actions.
- `BLOCKED`: a concrete unresolved owner decision or failed prerequisite is
  recorded. Difficulty alone is not a blocker.

Task IDs and review-gate IDs are stable. Never renumber them after work begins.

## Released Baseline

M0 through M33 and all review gates through `R-3330` are `COMPLETE`. The
released application baseline delivers the approved local-first expense tracker,
receipt scanning and review, Google Drive synchronization, responsive After
Midnight facade, PWA runtime, five-tab navigation, and state-machine edge
handling described by `SPEC.md`, `DESIGN_SYSTEM.md`, and `AGENTS.md`. Detailed
historical ledgers remain in Git history at `a1802b8`.

## Architecture and ownership baseline

```text
features/app -> src/design-system public contracts -> Mantine
features/app -> actors -> domain + adapter ports
                                  |
                                  `-> receipt AI adapters
```

Feature/app files use only the repository design-system facade. Provider SDKs,
provider metadata/routing, and credential handling stay at adapter/composition
edges. Actors/domain code depend on narrow ports and do not know Gemini or
OpenRouter SDK types.

## Definition of done

Every implementation task has focused tests and exact validation evidence.
Task-level validation follows `AGENTS.md`. CI/CD remains release authority and
runs `deno task verify`; browser E2E/gallery checks remain separate,
risk-selected checks.

---

## M34 — OpenRouter Receipt-AI Provider and Provider-Neutral Receipt Configuration

### M34 authority, outcome, and non-goals

The owner explicitly approves adding OpenRouter as a second receipt-scanning
provider while preserving Gemini and simplifying the existing model-selection
experience. M34 must make receipt extraction genuinely provider-neutral: Gemini
and OpenRouter use the **same receipt instruction/prompt text, instruction
version, semantic output schema, runtime validator, normalization, parser, and
draft mapper**. Provider adapters may only translate those shared contracts into
the provider-specific request/schema wire shape.

The approved OpenRouter dependency coordinate is exactly
`npm:@openrouter/sdk@1.2.82`. Do not substitute `@openrouter/agent`,
`@openrouter/ai-sdk-provider`, OpenAI's SDK, a wrapper, a similarly named package,
or another version without recording a concrete incompatibility and reconciling
this plan.

The existing Gemini dependency remains the repository-pinned
`npm:@google/genai@2.19.0`. Its pinned SDK types expose `Model.supportedActions`;
use that metadata where available instead of inventing a compatibility probe.

Target dependency flow:

```text
features/app -> provider-aware receipt configuration/composition
             -> ReceiptAiPort
                |-> Gemini adapter     -> @google/genai@2.19.0
                `-> OpenRouter adapter -> @openrouter/sdk@1.2.82

shared receipt inference contract
  -> one instruction/prompt + version
  -> one semantic Zod output schema
  -> one parser/normalizer/draft mapper
       |-> Gemini-specific JSON-Schema reduction only where Google requires it
       `-> OpenRouter strict JSON-Schema request shape
```

**Non-goals:** replacing Gemini; maintaining a manual “Test configuration” /
“Compatible” button; synthetic 1x1 inference probes; compatibility-evidence
caches; model fallback arrays; automatic model/router aliases; background
inference; server-side credential storage; syncing/exporting provider API keys or
provider-specific settings; retaining receipt images; changing accepted receipt
records; adding unrelated model providers; changing Drive sync; introducing a
backend; or redesigning the visual system.

OpenRouter may use ordinary provider failover for the **same exact selected
model**. A preferred provider is a preference, not an exclusive provider lock:
when selected, put it first in provider routing while leaving normal same-model
provider fallback enabled. Never fall back to another model.

### Mandatory single-agent execution rule

- One primary integration owner works sequentially on `master`.
- If orchestration and coding workers are separate, dispatch exactly one
  write-enabled implementation worker for exactly one dependency-ready task at a
  time. Do not dispatch the next task until the current task is integrated,
  validated, pushed, and checkpointed.
- Fresh read-only reviewers are used only at named review gates.
- Do not create parallel worktrees/workers unless this plan is explicitly
  amended with disjoint ownership and merge order.
- Follow `AGENTS.md` waiting rules: do not poll long-running commands/reviewers or
  perform speculative work while awaiting them.

### Locked M34 product and architecture rules

1. `ReceiptAiPort` remains the only actor/domain-facing receipt-inference
   boundary. Provider choice, SDK types, routing, and credentials stay outside
   actors/domain logic.
2. Gemini and OpenRouter use one shared receipt prompt/instruction string and
   version. Do not fork wording by provider. The adapters may place the exact
   same string in different provider-specific request fields only.
3. Gemini and OpenRouter use one semantic output schema/runtime validator and one
   parser/normalizer/draft mapper. A Google-specific JSON-Schema subset transform
   may remove unsupported schema keywords but may not change semantic fields or
   acceptance rules.
4. Remove `ReceiptAiPort.testConfiguration`, `ReceiptAiConfigurationResult`, the
   synthetic compatibility call, compatibility-test buttons/statuses, and
   persisted key-revision/compatibility-evidence state. Do not replace them with
   another billable probe.
5. Model discovery performs the strongest **metadata-only prefilter** that each
   provider exposes. The picker shows candidates; it does not claim a user-run
   test has proven them compatible.
6. OpenRouter model discovery must prefilter for receipt requirements using the
   pinned SDK's `GetModelsRequest`: at minimum
   `supportedParameters: "structured_outputs,response_format"`,
   `inputModalities: "image,text"`, and `outputModalities: "text"`; when the
   user enables ZDR, also send `zdr: "true"`. Client-side filtering must still
   verify returned metadata includes image input, text output, and both
   `structured_outputs` and `response_format` so behavior does not depend on
   ambiguous server filter semantics.
7. Gemini model discovery uses `Model.supportedActions` from
   `@google/genai@2.19.0`: when the field is present, exclude models that do not
   include `generateContent`. If `supportedActions` is absent, do not invent an
   unsupported/compatible verdict; keep the model as a candidate. Do not hardcode
   a static Gemini model allowlist from documentation.
8. The model UI for **both providers** must clearly state that receipt scanning
   requires a model that accepts image input and supports structured outputs /
   JSON-Schema-constrained output. OpenRouter can prefilter these strongly;
   Gemini's list metadata cannot prove every requirement. An unsupported model
   therefore fails only on the real explicit Scan-with-AI request, with a normal
   actionable provider error and no saved data.
9. OpenRouter extraction always sends one exact user-selected `model` slug,
   strict JSON-Schema structured output, and the SDK equivalent of
   `provider.requireParameters = true`. Never send `models`, a model fallback
   array, or an auto-router model.
10. OpenRouter receipt input is prompt text first plus one in-memory base64
    `image_url` data URL. Never upload a receipt image to make it public.
11. OpenRouter settings include three device-local routing/privacy controls:
    - **Preferred provider:** `Automatic` by default; otherwise one endpoint/
      provider tag valid for the selected model. Send it as first preference via
      `provider.order: [tag]`; keep same-model fallback enabled.
    - **Require Zero Data Retention (ZDR):** checkbox, default off. When checked,
      set `provider.zdr = true`, include `zdr: "true"` in model discovery, and
      restrict preferred-provider choices to ZDR-capable endpoints where the SDK
      metadata API can prove that.
    - **Deny provider data collection:** checkbox, default off. When checked, set
      `provider.dataCollection = "deny"`. When unchecked, omit the field rather
      than overriding the user's OpenRouter account/default routing policy.
12. ZDR and data-collection controls are independent because OpenRouter documents
    them as different routing constraints. The UI must explain that either can
    reduce eligible provider endpoints and may make a selected model/provider
    unavailable.
13. Preferred-provider options come from the pinned SDK's endpoint metadata for
    the selected OpenRouter model. Use `endpoints.list({author, slug})`; show the
    provider display name and use the returned endpoint/provider `tag` as the
    stored routing identifier. Filter options to endpoints whose
    `supportedParameters` contain both `structured_outputs` and
    `response_format`. When ZDR is enabled, intersect with the SDK's ZDR endpoint
    list by stable endpoint identity rather than guessing from provider names.
14. If a saved preferred provider is not valid after model change, endpoint
    refresh, or privacy-filter change, reset it to `Automatic` and explain that
    the previous preference is unavailable. Do not silently substitute a
    different preferred provider.
15. API keys, active provider, per-provider model selection, OpenRouter routing
    preferences, and image-preparation choice are device-local only and excluded
    from Drive sync/export. Keep the existing Gemini localStorage API-key key
    literal unchanged for migration compatibility.
16. Receipt inference remains explicit-action-only. Model refresh, provider
    refresh, provider switch, privacy checkbox changes, app startup, and network
    restoration must never submit a receipt inference request.
17. A failed/invalid provider response saves no receipt/expense records. Local
    validation is mandatory even after provider-side structured-output
    enforcement.
18. Feature/app files never import Mantine, `@openrouter/sdk`, or
    `@google/genai` directly. Reuse `src/design-system/**` and centralized
    `src/test-support/**` contracts.
19. Do not enable OpenRouter SDK debug logging. Do not log keys, authorization
    headers, receipt images, prompts, or raw sensitive provider payloads/errors.

### M34 mandatory reference map

This map is executable guidance. A worker prompt must include the current task
block, all relevant locked rules, and the exact reference rows below. Workers
must not receive only a task title.

#### Repository authorities

1. **`AGENTS.md`**
   - `Git Workflow`: focused commits, automatic push, no force-push or unrelated
     overwrites.
   - `UI and Implementation Workflow`: explicit implementation authority,
     checkpoint reconciliation, tests per task, `src/test-support/**`, risk-based
     validation, reviewer behavior, and waiting rules.
   - `Design-system facade boundary`: feature/app code imports only the
     repository-owned UI facade.
   - **Applies to:** every M34 task/review.

2. **`SPEC.md`**
   - `Product Principles`: local-first/private-by-default behavior.
   - `Required Product Capabilities > Invoice-Assisted Entry`: receipt
     itemization, ephemeral images, review-before-save, explicit inference,
     outbound data allowlist, schema-constrained output, no silent model change,
     image preparation, and failure semantics.
   - `Local Browser Storage`: provider credentials/models/preferences are
     device-local, not browser secrets, not synced/exported, and missing-key
     setup stays in-place.
   - Deletion/erase rules: ordinary project deletion does not remove unrelated
     provider credentials; explicit privacy erase owns credential removal.
   - **M34-001 must amend the old Gemini-only “configuration test” language** to
     the metadata-prefilter + real-scan-error policy defined above.

3. **`DESIGN_SYSTEM.md`**
   - `Foundation Decisions`, `Ownership Boundary`, and `Design-system facade
     boundary`: React/XState ownership and facade-only provider-neutral UI.
   - Token/responsive/layout/form/overlay rules: reuse existing field,
     checkbox, select/typeahead, status, and quick-setup patterns.
   - **Applies to:** M34-004/M34-005 and R-3420/R-3430.

4. **`.agents/skills/implementation-planning/SKILL.md`**
   - Governance/status vocabulary, six-part task contracts, review gates,
     checkpoint updates, and M34-FINAL archive/hygiene procedure.
   - **Applies to:** orchestrator/ledger behavior, not product semantics.

#### Existing implementation contracts

- `src/adapters/ports/receipt-ai.ts`: remove the configuration-test contract;
  preserve provider-neutral list/extract boundaries.
- `src/adapters/gemini/client.ts`: external-SDK wrapper pattern and model listing.
- `src/adapters/gemini/adapter.ts`: extraction/error/abort/image-erasure semantics;
  delete synthetic compatibility probing; reuse only provider-specific mapping.
- `src/adapters/gemini/schema.ts`: move provider-neutral prompt/schema/parser/
  mapper out; retain only Google's schema conversion where required.
- `src/adapters/gemini/secrets.ts`, `src/adapters/ports/secrets.ts`: preserve
  `SecretValue` redaction and the existing Gemini key literal; add OpenRouter.
- `src/domain/schema/records.ts`: migrate device settings and remove active
  compatibility-evidence/key-revision fields. Legacy stored fields may be read
  and discarded/ignored safely; do not carry them forward as product state.
- `src/features/receipt-ui.tsx`, `src/features/local-ui.tsx`: remove
  test/compatible UI and add provider/model/routing/privacy configuration.
- `src/features/sync-portability-runtime.tsx`: generalize Local Erase for both
  receipt-AI keys.
- `src/test-support/**`: reuse existing harnesses/fake ports.

#### Google references and the decision each owns

1. `https://googleapis.github.io/js-genai/release_docs/interfaces/types.Model.html`
   - Current `@google/genai` `Model` exposes `supportedActions?: string[]`.
   - **Use for:** model metadata shape; pinned `@google/genai@2.19.0` source/types
     remain final authority for this repo.

2. `https://ai.google.dev/api/models`
   - The Models API documents generation-method/action metadata such as
     `generateContent`.
   - **Use for:** filter out models that explicitly lack `generateContent`.
     Absence of stronger metadata is not permission to run a synthetic test.

3. `https://ai.google.dev/gemini-api/docs/structured-output`
   - Documents Gemini JSON-Schema structured output, supported schema subset,
     supported model families, and the recommendation to validate output in the
     application.
   - **Use for:** preserve Google's schema-constrained request path and local
     validation. Do not copy its current model table into source as a static
     allowlist; model availability changes dynamically.

#### OpenRouter references and the decision each owns

1. **Client SDK overview**
   `https://openrouter.ai/docs/client-sdks/typescript/overview`
   - Package identity and top-level SDK use. M34 uses `@openrouter/sdk`, not the
     Agent SDK.

2. **Chat SDK**
   `https://openrouter.ai/docs/client-sdks/typescript/sdks/chat/README`
   - `chat.send`, request/fetch options, abort/retry/error mechanics, and optional
     tree-shaken imports from the same package.
   - Do not enable extra SDK retry semantics unless existing app behavior calls
     for them.

3. **Models SDK / Models API**
   `https://openrouter.ai/docs/client-sdks/typescript/sdks/models/README`
   `https://openrouter.ai/docs/api/api-reference/models/get-models`
   `https://openrouter.ai/docs/guides/overview/models`
   - Model listing/pagination and metadata filters.
   - Pinned `@openrouter/sdk@1.2.82` generated `GetModelsRequest` exposes
     `supportedParameters`, `inputModalities`, `outputModalities`, `providers`,
     and `zdr`.
   - **Use for:** server-side model prefilter plus client-side verification. Use
     `models.list()`, not `listForUser()`/OAuth account plumbing.

4. **Image inputs**
   `https://openrouter.ai/docs/guides/overview/multimodal/image-understanding`
   - Text + `image_url`, with base64 data URLs for local/private images.

5. **Structured outputs**
   `https://openrouter.ai/docs/guides/features/structured-outputs`
   - `response_format` JSON Schema with strict mode; provider endpoint support is
     parameter-specific; local validation remains necessary.

6. **Provider routing**
   `https://openrouter.ai/docs/guides/routing/provider-selection`
   - `order` expresses provider preference, `allow_fallbacks` controls same-model
     provider fallback, and `require_parameters` excludes endpoints that cannot
     honor requested parameters.
   - **M34 policy:** preferred provider -> `order: [tag]`; leave same-model
     fallback enabled; always require request parameters; never use model
     fallback arrays.

7. **Endpoint metadata**
   Pinned SDK references:
   `https://github.com/OpenRouterTeam/typescript-sdk/blob/v1.2.82/src/models/operations/listendpoints.ts`
   `https://github.com/OpenRouterTeam/typescript-sdk/blob/v1.2.82/docs/models/publicendpoint.mdx`
   `https://github.com/OpenRouterTeam/typescript-sdk/blob/v1.2.82/src/models/operations/listendpointszdr.ts`
   - `endpoints.list({author, slug})` returns endpoints with `providerName`,
     routing `tag`, and `supportedParameters`.
   - ZDR endpoint listing returns endpoint metadata that can be intersected with
     a selected model's endpoints.
   - **Use for:** preferred-provider dropdown and ZDR-aware filtering without
     probe requests.

8. **Privacy / provider data policy / ZDR**
   `https://openrouter.ai/docs/guides/privacy/data-collection`
   `https://openrouter.ai/docs/guides/privacy/provider-logging`
   `https://openrouter.ai/docs/guides/features/zdr`
   - OpenRouter prompt retention and downstream-provider policies are distinct.
   - `provider.dataCollection = "deny"` and `provider.zdr = true` are separate
     constraints and can reduce endpoint availability.
   - **Use for:** checkbox behavior and truthful disclosure.

9. **Model fallbacks**
   `https://openrouter.ai/docs/guides/routing/model-fallbacks`
   - Documents the `models` fallback array.
   - **Use only as a negative reference:** M34 must not use it.

10. **Exact package provenance**
    `https://www.npmjs.com/package/@openrouter/sdk`
    - Package/version provenance. Do not enable SDK debug logging.

### Delegation packet rule

When delegating any M34 task, the orchestrator must provide:

1. exact task ID/title/status/dependencies and ownership paths;
2. the task's full Scope/non-goals, Outputs/acceptance, Tests, Verification;
3. every Locked M34 rule relevant to the task;
4. the task-specific reference rows and exact URLs/paths;
5. authority ordering: `SPEC.md` = product, `AGENTS.md` = process,
   `DESIGN_SYSTEM.md` = UI boundary, pinned SDK types = exact wire/type spelling;
6. instructions to inspect current code/tests before adding abstractions;
7. instructions to report changed files, commands/results, uncertainty, and
   commit SHA;
8. an explicit prohibition on starting the next task, broadening scope, adding a
   compatibility probe, changing dependency versions, or silently deciding a
   product ambiguity.

A real authority conflict is `BLOCKED` with evidence. A worker must not guess.

### Restart and recovery checklist

- [ ] Read `AGENTS.md`, relevant `SPEC.md`/`DESIGN_SYSTEM.md` sections, this M34
      section, and Current Checkpoint.
- [ ] Read the current task's reference rows; reopen external docs rather than
      relying on memory for SDK fields.
- [ ] Run `git status --short --branch`, `git log -n 20 --oneline`,
      `git branch -vv`, and `git worktree list --porcelain`; reconcile local
      `master` with upstream before editing.
- [ ] Preserve all unrelated/uncommitted/unpushed work.
- [ ] Confirm the recorded checkpoint/test evidence against actual repository
      state before resuming.

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

#### M34-001 — Product contract, port simplification, and device-settings migration

- **Status/dependencies:** `COMPLETE`; no M34 dependency. Integrated on `master`
  and pushed as `b08d4d7` after worker commit review and validation.
- **Ownership:** `SPEC.md`, `src/adapters/ports/receipt-ai.ts`,
  `src/adapters/ports/secrets.ts`, `src/domain/schema/records.ts`, focused
  settings/schema tests and the smallest settings serialization helpers needed.
- **Scope/non-goals:**
  - Amend `SPEC.md` from Gemini-only configuration to provider-aware Gemini +
    OpenRouter receipt scanning.
  - Replace the configuration-test requirement with metadata-only model
    prefiltering plus actionable errors from the real explicit scan request.
  - Remove `ReceiptAiConfigurationResult` and `ReceiptAiPort.testConfiguration`.
  - Define one active receipt provider (`gemini | openrouter`), per-provider
    selected model, and OpenRouter `preferredProviderTag`, `requireZdr`, and
    `denyProviderDataCollection` device-local settings.
  - Defaults: existing users migrate to Gemini; ZDR off; deny-data-collection
    off; preferred provider `Automatic`/unset.
  - Remove active `geminiKeyRevision` / `geminiCompatibilityEvidence` (and any
    generalized replacement). Legacy persisted fields may be tolerated and
    discarded but must not remain product state.
  - Generalize `SecretName` for Gemini and OpenRouter keys without moving secrets
    into IndexedDB/settings.
  - Do not change portable dataset/sync/export schemas.
- **Outputs/acceptance:** old Gemini selection/key storage remains usable; new
  device settings round-trip; no compatibility-evidence state remains; privacy
  routing settings are OpenRouter-only and device-local; `SPEC.md` explicitly
  says both providers require image + structured output, model lists prefilter
  where metadata permits, and no manual compatibility test exists.
- **Tests:** legacy settings migration; new settings round trips; defaults;
  invalid provider/preference rejection; old compatibility fields ignored/dropped;
  secret-name/redaction regression.
- **Verification:** format/lint changed TS; focused schema/settings tests;
  `deno task test:affected`; `git diff --check`; manually review `SPEC.md` against
  M34 locked rules.

#### M34-002 — Shared receipt prompt/schema core and Gemini metadata filtering

- **Status/dependencies:** `COMPLETE`; depends on `M34-001`. Integrated on
  `master` and pushed as `6ff9fc5` after worker commit review and validation.
- **Ownership:** `src/adapters/gemini/{adapter,schema,client}.ts`, their tests,
  new provider-neutral `src/adapters/receipt-ai/**`, and port helpers only where
  required.
- **Scope/non-goals:**
  - Extract the exact receipt instruction/prompt text and instruction-version
    constant into the shared module. Gemini must consume that exact shared text;
    do not retain a Gemini-specific copy.
  - Extract semantic Zod receipt output schema, normalization, parser, and draft
    mapper into the shared module.
  - Keep only Google's required JSON-Schema conversion/subset logic in Gemini.
  - Delete Gemini's synthetic 1x1 configuration probe and all
    `testConfiguration`/compatibility-evidence plumbing.
  - During Gemini model listing, if `supportedActions` is present require
    `generateContent`; exclude models that explicitly lack it. If absent, retain
    the model as an unproven candidate. Preserve safe lifecycle/name filtering.
  - Do not hardcode Google's current structured-output model table into source.
- **Outputs/acceptance:** Gemini extraction behavior is otherwise unchanged;
  shared prompt/schema/parser have one source of truth; model refresh performs no
  inference; candidate models explicitly lacking `generateContent` disappear;
  no compatibility-test API/status remains.
- **Tests:** prompt identity/version; shared schema/parser/mapper; Google schema
  reduction; Gemini model filtering for supportedActions present/absent;
  extraction/error/abort/image-erasure regressions; assertions that refresh does
  not call generateContent.
- **Verification:** format/lint; focused shared/Gemini tests;
  `deno task test:affected`; `git diff --check`.

#### R-3410 — Shared contract and compatibility-test removal review

- **Status/dependencies:** `COMPLETE`; depends on `M34-002`. Initial review found
  two bounded findings; remediation was integrated and pushed as `abb4457`, with
  the fixture cleanup pushed as `e320493`.
- **Reviewer role:** fresh read-only architecture/contracts reviewer.
- **Audit scope:** M34-001..002; `SPEC.md`; removal of testConfiguration,
  synthetic probes, compatibility evidence, and stale UI-facing contracts;
  exact shared prompt/schema ownership; Gemini supportedActions filtering;
  migration safety; secret boundaries; `AGENTS.md` compliance.
- **Remediation loop:** primary owner fixes severity 1–3 findings, reruns affected
  validation, records resolution, and obtains closure before M34-003.
- **Review evidence:** initial verdict `APPROVE WITH FINDINGS`; closure audit
  verdict `APPROVE` with no residual severity 1–3 findings. Compatibility
  handlers, statuses, buttons, and E2E expectations now proceed directly to the
  real scan. Gemini preserves absent metadata as `undefined` and filters only
  explicit `supportedActions` values lacking `generateContent`. The parent shell
  also clears its project-creation dirty state before navigating to expenses.
  Legacy fixture naming was cleaned up in `e320493`.
- **Validation evidence:** `deno task fmt:check` passed (206 files); `deno task
  lint` passed (197 files); `deno task typecheck` passed; `deno task
  test:affected` passed (382/382); focused Gemini test passed (17/17); isolated
  receipt E2E passed (1/1, 23.5s) using an alternate local port because the
  default Playwright config reused an unrelated Vite server already bound to
  5173; `git diff --check` passed. No provider calls were made.

#### M34-003 — OpenRouter SDK adapter, model prefilter, endpoint metadata, and routing

- **Status/dependencies:** `COMPLETE`; depends on `R-3410`. Integrated on
  `master` and pushed as `79463b5` after worker review and integrated validation.
- **Ownership:** `deno.json`, `deno.lock`, new
  `src/adapters/openrouter/{client,adapter,index}.ts` and focused tests; shared
  receipt module only for a proven provider-neutral defect.
- **Scope/non-goals:**
  - Pin exactly `npm:@openrouter/sdk@1.2.82`.
  - Isolate SDK construction/types in `client.ts`; no SDK imports in features.
  - Implement `ReceiptAiPort.listModels` and `extractReceipt`; there is no
    `testConfiguration` method.
  - Model discovery uses SDK `models.list()` with request filters:
    `supportedParameters: "structured_outputs,response_format"`,
    `inputModalities: "image,text"`, `outputModalities: "text"`, and
    `zdr: "true"` only when ZDR is enabled. Consume pagination as exposed by the
    pinned SDK. Client-side recheck image/text modalities plus both supported
    parameters before returning candidates.
  - Implement endpoint discovery for a selected model with
    `endpoints.list({author, slug})`; map `providerName`, `tag`, and
    `supportedParameters`; retain only endpoints supporting
    `structured_outputs` + `response_format`.
  - If ZDR is enabled, intersect those provider options with the pinned SDK's ZDR
    endpoint list by stable model/endpoint identity.
  - Extraction sends shared prompt text first, base64 `image_url` second, strict
    JSON Schema, one exact selected model, and provider routing containing
    `requireParameters: true`; add `order: [preferredProviderTag]` when set;
    add `zdr: true` and/or `dataCollection: "deny"` when selected. Do not send
    model fallbacks. Keep same-model provider fallback enabled/default.
  - Map SDK/provider errors into existing redacted taxonomy; no debug logging.
- **Outputs/acceptance:** OpenRouter picker receives only metadata-qualified
  receipt candidates; ZDR narrows model/provider discovery; preferred provider
  metadata is available without inference; all routing/privacy controls reach
  real scan requests; provider output passes shared local validation.
- **Tests:** exact SDK construction; model query filter arguments and pagination;
  client-side metadata filtering; ZDR model filtering; endpoint mapping/filtering;
  ZDR endpoint intersection; preferred provider `order`; dataCollection deny;
  requireParameters; one-model invariant/no `models`; base64 multimodal ordering;
  strict response schema; valid/invalid output; abort; redacted errors; zero live
  network.
- **Verification:** lockfile update through repo's Deno/npm workflow;
  format/lint; focused OpenRouter tests; `deno task typecheck`;
  `deno task test:affected`; `git diff --check`.
- **Implementation evidence:** the adapter uses only the exact pinned SDK
  through `client.ts`, consumes model pages, applies server and client metadata
  filters, exposes structured-output endpoint metadata, intersects the pinned
  ZDR endpoint list by `modelId` + `tag`, and emits one exact-model chat request
  with shared prompt text, base64 image input, strict JSON Schema, and the
  required provider privacy/routing fields. No model fallback array or SDK debug
  logging is present.
- **Validation evidence:** worker reported focused OpenRouter tests 14/14 and
  affected tests 475/475; integrated focused tests `deno test
  --allow-read --allow-write --allow-run --allow-env
  src/adapters/openrouter/client.test.ts src/adapters/openrouter/adapter.test.ts`
  passed 14/14; `deno task fmt:check` passed (211 files); `deno task lint` passed
  (202 files); `deno task typecheck` passed; `git diff --check` passed. No live
  provider calls were made.

#### M34-004 — Provider-aware settings and scan setup UI without compatibility testing

- **Status/dependencies:** `COMPLETE`; depends on `M34-003`. Integrated on
  `master` and pushed as `fe8b9a7` after worker review and integrated
  validation.
- **Ownership:** `src/features/receipt-ui.tsx`,
  `src/features/receipt-ui.test.tsx`, `src/features/local-ui.tsx`,
  `src/features/local-ui.test.tsx`, composition wiring, and
  `src/design-system/**` only if an existing facade contract truly cannot express
  the approved controls.
- **Scope/non-goals:**
  - Replace Gemini-only settings/status/quick setup with receipt-provider UI.
  - Provider choice: Gemini / OpenRouter.
  - For both providers: API key controls, model refresh/typeahead selection,
    image-preparation preference, and helper text saying receipt scanning needs a
    model with image input and structured-output/JSON-Schema support.
  - Remove every `Test`, `Test configuration`, `Compatible`, `Needs test`, and
    compatibility-evidence control/status. Model refresh is metadata discovery,
    not inference.
  - OpenRouter-only controls: preferred provider selector (`Automatic` +
    filtered endpoint options), `Require Zero Data Retention (ZDR)` checkbox,
    and `Deny provider data collection` checkbox.
  - Changing OpenRouter model/checkboxes refreshes or invalidates provider
    options as needed. If saved preference is no longer valid, reset to Automatic
    with an explanatory notice.
  - Preserve/redirect `/settings/gemini` to provider-neutral receipt settings.
  - No settings change may invoke receipt extraction.
- **Outputs/acceptance:** either provider configures independently; switching
  providers restores its own model/settings; quick setup preserves selected
  receipt; OpenRouter privacy/provider preferences are understandable and
  device-local; no compatibility-test UI remains anywhere.
- **Tests:** provider switch; legacy route; model refresh; Gemini filtered model
  candidates; OpenRouter filtered candidates; no test button/status; requirement
  helper copy; preferred provider selection/reset; ZDR/data-collection toggles;
  quick setup; offline state; assertion that settings/model/provider refresh
  never call `extractReceipt`.
- **Verification:** format/lint; `deno task test:affected`; focused component tests
  as needed; targeted browser/gallery check only if changed overlay/focus/
  navigation behavior requires it; `git diff --check`.
- **Implementation evidence:** provider-neutral scan setup and settings now
  select Gemini or OpenRouter independently, preserve each provider's model and
  key, expose OpenRouter endpoint/ZDR/data-collection controls, and reset stale
  preferred-provider choices with an explanatory notice. Refresh and provider
  changes remain metadata/UI operations and do not call extraction. The shared
  requirement copy describes image input plus structured-output/JSON-Schema
  support, and no compatibility-test controls remain.
- **Validation evidence:** integrated focused component/design-system tests
  passed 88/88 (20 receipt UI, 37 local UI, 31 design-system); `deno task
  fmt:check` passed (211 files); `deno task lint` passed (202 files);
  `deno task typecheck` passed; `deno task build` passed (with the existing
  large-chunk warning); `git diff --check` passed. No provider calls were made.

#### R-3420 — SDK routing and provider UX review

- **Status/dependencies:** `IN_PROGRESS`; depends on `M34-004`. Initial fresh
  review returned `APPROVE WITH FINDINGS`; remediation is required before
  closure and M34-005.
- **Reviewer role:** fresh read-only OpenRouter/UI reviewer.
- **Audit scope:** exact package/version; pinned SDK type usage; OpenRouter model
  prefilter arguments; client-side structured-output/image verification;
  endpoint/provider discovery; ZDR intersection; preferred-provider routing;
  dataCollection/ZDR/requireParameters request semantics; no model fallback;
  no compatibility probe/button; shared prompt; UI facade/accessibility;
  no live-network tests or debug logging.
- **Remediation loop:** primary owner fixes severity 1–3 findings and obtains
  reviewer closure before M34-005.
- **Initial review findings:** four severity-2 findings: Local Erase still
  removes only the Gemini key; `openrouter/auto` is accepted instead of being
  rejected as an auto-router model; settings refreshes can apply stale
  asynchronous state; and an in-flight scan model refresh can cross provider
  boundaries after a provider switch. The reviewer found no authority conflict,
  made no edits, and made no provider calls.

#### M34-005 — Secrets, disclosure, and privacy erase generalization

- **Status/dependencies:** `PENDING`; depends on `R-3420`.
- **Ownership:** provider-neutral secret adapter extraction if needed,
  `src/adapters/gemini/secrets.ts`, destruction actor/domain/contracts/tests,
  `src/features/destruction-ui.tsx`, `src/features/sync-portability-runtime.tsx`,
  receipt disclosure/settings copy, focused tests.
- **Scope/non-goals:**
  - Preserve old Gemini localStorage secret key and add separate OpenRouter key.
  - Disclosure for Gemini identifies Google Gemini; disclosure for OpenRouter
    states the allowed receipt payload goes through OpenRouter to a routed
    provider endpoint serving the selected model.
  - Explain ZDR and deny-data-collection controls accurately and independently;
    do not promise a policy that is not enabled.
  - Generalize Local Erase's Gemini-key option to receipt-scanning API keys and
    remove both provider keys only when chosen. Ordinary project deletion leaves
    them intact.
- **Outputs/acceptance:** keys remain redacted/device-local; disclosure keeps the
  existing outbound data allowlist/explicit-action guarantee; routing/privacy
  wording matches actual settings; destruction semantics do not drift.
- **Tests:** secret compatibility/redaction; Gemini/OpenRouter disclosure under
  checkbox combinations; Local Erase both keys/retry/legacy preference;
  project-deletion non-removal.
- **Verification:** format/lint; focused tests; `deno task test:affected`;
  `git diff --check`; targeted browser check only if privacy/erase interaction
  requires it.

#### M34-006 — Integrated acceptance and release preflight

- **Status/dependencies:** `PENDING`; depends on `M34-005`.
- **Ownership:** focused integration/E2E seams only where lower-level tests cannot
  prove wiring; release-verification/doc corrections; no unrelated cleanup.
- **Scope/non-goals:** prove provider selection -> metadata-filtered model list ->
  optional OpenRouter provider/privacy routing -> explicit scan -> shared
  validated receipt review, all with deterministic external-boundary fakes.
- **Outputs/acceptance:** Gemini and OpenRouter reach the same shared receipt
  review contract; no compatibility-test path exists; settings refresh makes no
  inference; OpenRouter routing controls are wired; no credential/image sync or
  persistence regression; full quality gate passes.
- **Tests:** one minimal browser/component integration seam if required; existing
  critical receipt review journey; no real provider calls/credentials.
- **Verification:** risk-selected checks first, then exactly one final
  `deno task verify`; run `deno task test:e2e` only for an actually changed
  browser seam. Record exact results and avoid duplicate umbrella constituent
  runs.

#### R-3430 — Final M34 release-candidate review

- **Status/dependencies:** `PENDING`; depends on `M34-006`.
- **Reviewer role:** fresh read-only release reviewer.
- **Audit scope:** entire M34 diff; repo authorities; shared prompt/schema;
  removal of compatibility testing/evidence; Gemini `supportedActions` filter;
  OpenRouter structured-output/model/ZDR prefilter; endpoint/provider routing;
  ZDR/data-collection UI/request behavior; secret/privacy/erase boundaries;
  final validation evidence and clean pushed Git state.
- **Remediation loop:** resolve all severity 1–3 findings; rerun only affected
  validation plus full quality gate if shared/cross-cutting code changed after
  the recorded preflight; obtain closure before M34-FINAL.

#### M34-FINAL — Milestone closure, ledger archive, and repo hygiene

- **Status/dependencies:** `PENDING`; depends on `R-3430`.
- **Ownership:** `IMPLEMENTATION_PLAN.md`, `SPEC.md`, `DESIGN_SYSTEM.md` only if
  reviewed design docs changed, and files identified by repo-hygiene audit.
- **Scope/non-goals:** record final pre-pruning commit, fold M34 into Released
  Baseline, prune completed M34 task/review/evidence detail, run
  `.agents/skills/repo-hygiene-pruning/SKILL.md`, remove only proven-obsolete
  migration/test scaffolding, audit Markdown references. Do not reopen product
  decisions.
- **Outputs/acceptance:** compact living plan, M0–M34 released, detailed history
  preserved in Git, no stale ownership/temp artifacts, clean synchronized
  `master`.
- **Tests/verification:** for archival/hygiene run `deno task typecheck`,
  `deno task fmt:check`, `deno task lint`, `git diff --check`; if executable code
  is pruned run the narrow relevant tests. Commit plan/doc archival with
  `[archive]` per `AGENTS.md` and push.

---

## Current Checkpoint

- **Active task / gate:** `R-3420` (`IN_PROGRESS`, remediation after initial
  review findings).
- **Planning base:** M34-001, M34-002, R-3410, remediation, and M34-003 are
  integrated and pushed on remote `master`; M34-004 is integrated and pushed as
  `fe8b9a7`.
- **Verification status:** R-3410 closure audit approved with no residual
  severity 1–3 findings; post-remediation `deno task test:affected`: 382/382
  passed; focused Gemini test: 17/17 passed; integrated M34-003 OpenRouter tests:
  14/14 passed; `deno task fmt:check`: passed (211 files); `deno task lint`:
  passed (202 files); `deno task typecheck`: passed; M34-004 focused
  component/design-system tests: 88/88 passed; `deno task build` passed;
  isolated receipt E2E: 1/1 passed; `git diff --check`: passed. The first
  default E2E attempt was invalidated before app startup because Playwright
  reused an unrelated server on port 5173; no provider calls were made.
- **Active / preserved work:** no active M34 implementation worker. Existing
  unrelated worktrees contain preserved untracked progress files and are not
  touched.
- **Reference checkpoint:** the required OpenRouter docs and the v1.2.82 pinned
  SDK sources were read. The installed SDK confirms camelCase request types that
  serialize to the required wire fields: `supportedParameters`,
  `inputModalities`, `outputModalities`, `zdr`, `provider.requireParameters`,
  `provider.dataCollection`, and `responseFormat.jsonSchema`; endpoint methods
  are `endpoints.list({author, slug})` and `endpoints.listZdrEndpoints()`.
- **Exact next action:** commit and push this findings checkpoint, then dispatch
  exactly one write-enabled remediation worker for the four R-3420 findings.
  Do not begin M34-005 until the fixes are integrated, validated, and a fresh
  read-only R-3420 closure review approves them.

## Ready-to-Use Orchestration Prompt

```text
Act as the single primary orchestrator/integration owner for M34 in the checked-
out did-it-become-what-you-like repository. If orchestrator and coding workers
are separate, use exactly one write-enabled worker for one dependency-ready task
at a time and remain the sole checkpoint/integration owner.

OWNER-APPROVED OUTCOME:
Add OpenRouter receipt scanning alongside Gemini and simplify model configuration.
Both providers MUST reuse one exact provider-neutral receipt prompt/instruction,
instruction version, semantic output schema, runtime validator, parser,
normalizer, and draft mapper. Provider adapters translate only wire format.

EXACT DEPENDENCIES:
- OpenRouter: `npm:@openrouter/sdk@1.2.82` exactly.
- Existing Gemini: `npm:@google/genai@2.19.0`.
Do not substitute SDKs or versions without a concrete incompatibility and plan
reconciliation.

REMOVE THE OLD COMPATIBILITY FEATURE:
- Remove `ReceiptAiPort.testConfiguration` and `ReceiptAiConfigurationResult`.
- Remove synthetic 1x1 compatibility inference.
- Remove Test configuration / Compatible / Needs test buttons and statuses.
- Remove persisted compatibility evidence and key-revision state used only for
  that feature.
- Do not replace these with another probe. Model refresh must not perform
  inference.

MODEL DISCOVERY POLICY:
- Both UIs say receipt scanning requires image input and structured-output /
  JSON-Schema support.
- Gemini: use pinned `Model.supportedActions`; when present require
  `generateContent`. If absent, keep the model as a candidate. Do not hardcode a
  static structured-output model allowlist and do not probe it.
- OpenRouter: call `models.list()` with
  `supportedParameters: "structured_outputs,response_format"`,
  `inputModalities: "image,text"`, `outputModalities: "text"`; if ZDR is
  enabled add `zdr: "true"`. Then client-side verify the returned metadata still
  has image input, text output, `structured_outputs`, and `response_format`.

OPENROUTER ROUTING/UI POLICY:
- Selected model is exact; never send `models` fallback arrays or auto routers.
- Every scan uses strict JSON Schema and `provider.requireParameters = true`
  (use exact pinned SDK casing/types).
- Settings add:
  1. Preferred provider: Automatic by default. Populate from
     `endpoints.list({author, slug})`, filter endpoints for structured_outputs +
     response_format; store the returned routing tag. If selected send
     `provider.order: [tag]`; keep same-model provider fallback enabled.
  2. Require ZDR checkbox, default off. If on, send `provider.zdr = true`,
     prefilter models with `zdr: "true"`, and intersect preferred-provider
     options with the SDK ZDR endpoint list.
  3. Deny provider data collection checkbox, default off. If on send
     `provider.dataCollection = "deny"`; if off omit the field.
- Explain that ZDR and data-collection filters are separate and can reduce route
  availability.
- If model/privacy changes invalidate a preferred provider, reset to Automatic
  with an explanatory notice; never silently choose another preference.

OPENROUTER RECEIPT REQUEST:
- Same shared prompt as Gemini, text first.
- One in-memory base64 `image_url` data URL second; never public-upload receipt.
- Strict shared JSON Schema; still run shared local Zod validation.
- Exact selected model only, plus routing/privacy settings above.
- No debug logging and no real provider calls in automated tests.

AUTHORITIES:
- `SPEC.md`: product/privacy/storage behavior. Focus Product Principles,
  Invoice-Assisted Entry, Local Browser Storage, deletion/erase behavior.
- `AGENTS.md`: git, sequential planning, tests, validation, reviewer/waiting,
  design-system-facade process.
- `DESIGN_SYSTEM.md`: UI facade/accessibility/responsive/form patterns.
- `.agents/skills/implementation-planning/SKILL.md`: task/gate/checkpoint/archive
  lifecycle.
- `IMPLEMENTATION_PLAN.md` M34: sequencing, locked rules, references, exact task
  acceptance/tests/verification.
- Pinned SDK types are final authority for TypeScript request-field spelling.

REQUIRED EXTERNAL REFERENCES:
Google:
- https://googleapis.github.io/js-genai/release_docs/interfaces/types.Model.html
- https://ai.google.dev/api/models
- https://ai.google.dev/gemini-api/docs/structured-output
OpenRouter:
- https://openrouter.ai/docs/client-sdks/typescript/overview
- https://openrouter.ai/docs/client-sdks/typescript/sdks/chat/README
- https://openrouter.ai/docs/client-sdks/typescript/sdks/models/README
- https://openrouter.ai/docs/api/api-reference/models/get-models
- https://openrouter.ai/docs/guides/overview/models
- https://openrouter.ai/docs/guides/overview/multimodal/image-understanding
- https://openrouter.ai/docs/guides/features/structured-outputs
- https://openrouter.ai/docs/guides/routing/provider-selection
- https://openrouter.ai/docs/guides/privacy/data-collection
- https://openrouter.ai/docs/guides/privacy/provider-logging
- https://openrouter.ai/docs/guides/features/zdr
- https://openrouter.ai/docs/guides/routing/model-fallbacks (negative reference)
Pinned SDK endpoint references:
- https://github.com/OpenRouterTeam/typescript-sdk/blob/v1.2.82/src/models/operations/listendpoints.ts
- https://github.com/OpenRouterTeam/typescript-sdk/blob/v1.2.82/docs/models/publicendpoint.mdx
- https://github.com/OpenRouterTeam/typescript-sdk/blob/v1.2.82/src/models/operations/listendpointszdr.ts

Before editing, read AGENTS.md, relevant SPEC/DESIGN_SYSTEM sections, the planning
skill, complete M34, Current Checkpoint, and the current task references. Run the
recovery checklist and confirm M34-001 is next.

For every delegated task, give the worker the complete task contract + relevant
locked rules + exact references. A worker must report changed files, exact test/
verification results, uncertainty, and commit SHA, and must not start the next
task.

Work sequentially on master. Complete/push/checkpoint each task before advancing.
Use fresh read-only reviewers only at R-3410, R-3420, R-3430. Do not poll or do
speculative work while waiting. Never force-push or overwrite unrelated work.
If authorities genuinely conflict, record BLOCKED evidence instead of guessing.
Complete R-3430 and M34-FINAL, including [archive] pruning/hygiene, before
calling M34 released.
```
