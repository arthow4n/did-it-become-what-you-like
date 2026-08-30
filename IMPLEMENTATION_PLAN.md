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

The approved OpenRouter integration uses the npm package **exactly
`@openrouter/sdk`**. Do not substitute another OpenRouter SDK, provider wrapper,
or similarly named community package. The implementing agent must verify the
current `@openrouter/sdk` request/response types against OpenRouter's official
TypeScript SDK documentation before coding and pin the chosen compatible package
version in `deno.json` and `deno.lock` using the repository's dependency
conventions.

Target dependency flow:

```text
features/app -> provider-aware receipt configuration/composition
             -> ReceiptAiPort
                |-> Gemini adapter -> @google/genai
                `-> OpenRouter adapter -> @openrouter/sdk

features/app -> actors -> domain + adapter ports
features/app -> src/design-system public contracts -> Mantine
```

**Non-goals:** replacing Gemini; adding automatic provider/model fallback;
background inference; server-side credential storage; synchronizing or exporting
API keys/provider selections; retaining receipt images; changing the receipt
review/domain model; adding unrelated model providers; changing Drive sync;
introducing a backend; or redesigning the visual system. Do not add a new
shared design-system component unless the existing facade cannot express an
approved provider-selection interaction cleanly.

### Mandatory single-agent execution rule

- One primary coding agent performs all plan reconciliation, edits, tests,
  fixes, commits, pushes, and checkpoint updates sequentially on `master`.
- Fresh read-only reviewer subagents are used only at the named M34 review
  gates. They do not modify the repository.
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
5. OpenRouter requests must require the selected model/provider route to support
   image input and the structured-output parameters needed by the receipt
   contract. Do not silently substitute another model.
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

### Restart and compaction recovery checklist

- [ ] Read `AGENTS.md`, `SPEC.md`, `DESIGN_SYSTEM.md`, this M34 section, and
      Current Checkpoint.
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
  sync/export formats.
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
  compliance with `AGENTS.md` and `DESIGN_SYSTEM.md`.
- **Remediation loop:** primary agent fixes all severity 1–3 findings in focused
  commits, reruns only affected evidence, records findings/resolutions here, and
  obtains reviewer closure before starting M34-003.

#### M34-003 — Official OpenRouter SDK client and `ReceiptAiPort` adapter

- **Status/dependencies:** `PENDING`; depends on `R-3410`.
- **Ownership:** `deno.json`, `deno.lock`, new
  `src/adapters/openrouter/{client,adapter,index}.ts` and focused tests; shared
  receipt-inference helpers only when a provider-neutral defect is discovered.
- **Scope/non-goals:** pin the npm package exactly `@openrouter/sdk`; do not use
  or substitute a different OpenRouter SDK/provider package. Isolate the
  official SDK construction/types in `client.ts`, analogous to the existing
  Google SDK edge; implement `ReceiptAiPort.listModels`, `testConfiguration`,
  and `extractReceipt`. Use OpenRouter model metadata for
  image/text/structured-output evidence and use the synthetic 1x1 image probe
  when metadata is insufficient. Construct receipt input as prompt text followed
  by an `image_url` base64 data URL. Request strict JSON-Schema structured output
  using the full shared schema and use the SDK/provider routing option that
  requires requested parameters when supported by the current SDK. Do not enable
  model fallbacks.
- **Outputs/acceptance:** OpenRouter model IDs/display names/capabilities map into
  `ReceiptAiModel`; incompatible or missing models cannot scan; successful
  structured output passes the shared local validator before becoming a draft;
  `AbortSignal` reaches the SDK HTTP request; provider failures map to the
  existing redacted adapter taxonomy, including malformed request, auth,
  credits/payment or quota exhaustion, rate limit, oversized/unprocessable
  input, missing model, and provider/service unavailability where distinguishable.
- **Tests:** SDK wrapper construction/request tests; model listing/capability
  mapping; pagination if exposed by the current API; synthetic configuration
  pass/fail; exact multimodal request ordering and base64 data URL; strict
  structured-output request; valid output; malformed/missing/non-JSON output;
  abort propagation; redacted error taxonomy; zero real network calls.
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
- **Audit scope:** M34-003..004 diffs; official SDK usage against its pinned
  types/documentation; structured-output and image request correctness;
  cancellation/error redaction; no hidden fallback/retry semantics; provider
  registry ownership; settings/quick-setup accessibility; design-system facade
  compliance; test sufficiency and no live-network tests.
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
  through OpenRouter to the selected routed model/provider; do not imply a
  direct-only vendor path. Generalize Local Erase from a Gemini-only key choice
  to removing receipt-scanning API keys and remove both provider keys when
  selected, while safely honoring/migrating the legacy erase-choice state.
  Project deletion continues to leave unrelated API credentials intact.
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
- **Audit scope:** complete M34 diff from its planning base; all locked rules;
  spec/implementation consistency; migration compatibility; provider-neutral
  architecture; SDK/structured-output correctness; privacy/redaction; Local
  Erase semantics; affected/full validation evidence; browser coverage scope;
  Git cleanliness and pushed-commit state.
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
- **Pushed commit / HEAD:** the M34 planning commit on top of `b2eefd4` is the
  current remote `master`; resolve its exact SHA during implementation recovery
  with `git rev-parse HEAD` rather than assuming the archived M33 hash.
- **Verification status:** planning-only change; no application code changed and
  no runtime test evidence is claimed. The implementing agent starts M34 with
  M34-001's focused validation contract.
- **Active / preserved work:** no M34 implementation owner has started work in
  this ledger. Before editing, reconcile the local checkout, upstream `master`,
  branches/worktrees, and uncommitted work as required by `AGENTS.md`.
- **Exact next action:** primary coding agent reads the authoritative docs and
  M34, performs the restart/recovery checklist, marks `M34-001` `IN_PROGRESS`,
  then implements only M34-001 and records/pushes its evidence before M34-002.

## Ready-to-Use Orchestration Prompt

```text
Act as the single primary coding agent for M34 — OpenRouter Receipt-AI Provider
in the checked-out did-it-become-what-you-like repository.

The owner has explicitly authorized this implementation: add the official
OpenRouter TypeScript SDK as a second receipt-scanning provider while preserving
Gemini. The npm package name is exactly `@openrouter/sdk`. Do not install or
substitute a different OpenRouter SDK, provider wrapper, or similarly named
package. Do not interpret plan authoring as the implementation itself; execute
M34 now according to its dependency graph and gates.

Before editing:
1. Read AGENTS.md, SPEC.md, DESIGN_SYSTEM.md,
   .agents/skills/implementation-planning/SKILL.md, and the complete M34 section
   of IMPLEMENTATION_PLAN.md.
2. Follow M34's restart/compaction recovery checklist. Reconcile local master
   with upstream and preserve any unrelated/uncommitted work.
3. Confirm M34-001 is the next dependency-ready task and mark only that task
   IN_PROGRESS in the ledger.

Execution rules:
- Work sequentially on master as the single primary implementer.
- Finish the current task's code/tests/verification, commit and push it, then
  update the ledger with exact evidence before advancing.
- Use fresh read-only reviewer subagents only at R-3410, R-3420, and R-3430.
  While a reviewer or long command is running, stop and await the reactive
  completion notification; do not poll rapidly or launch speculative work.
- Use the official OpenRouter TypeScript SDK from npm package `@openrouter/sdk`
  and no substitute package. Follow its official documentation and the actual
  pinned `@openrouter/sdk` package types; do not guess request shapes.
- Preserve ReceiptAiPort as the receipt actor/domain boundary. Keep provider
  choice, API keys, SDK construction, and routing at the app/adapter edge.
- Never make real Gemini/OpenRouter calls from automated tests and never place a
  real API key in source, fixtures, logs, screenshots, or test output.
- Do not silently substitute models or add fallback routing. OpenRouter must use
  the user-selected model and require the receipt request's needed parameters.
- Reuse one shared receipt instruction/runtime validator/draft mapper across
  Gemini and OpenRouter. Validate every model response locally before review.
- Keep receipt images ephemeral and API keys device-local/redacted.
- Use the existing design-system facade and centralized test infrastructure.
- Record exact commands/results. Use risk-selected task validation and one final
  deno task verify at M34-006 as specified; do not mechanically duplicate test
  runs.
- Automatically commit and push completed work according to AGENTS.md; never
  force-push or overwrite unrelated work.
- Complete R-3430 and M34-FINAL, including [archive] ledger pruning and repository
  hygiene, before declaring the milestone released.
```
