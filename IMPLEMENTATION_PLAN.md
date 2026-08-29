# Implementation Plan and Orchestration Ledger

## Status and Authority

This is the single source of truth for implementation sequencing, ownership,
verification, review, and resumable progress.

Product behavior remains authoritative in `SPEC.md`; shared visual and
interaction rules remain authoritative in `DESIGN_SYSTEM.md`; agent conduct
remains authoritative in `AGENTS.md`. This plan orders that approved work and
must not silently reinterpret those documents. A discovered contradiction is a
blocked specification issue, not permission to choose whichever text is easier.

### Status vocabulary

- `COMPLETE`: outputs exist, required tests and review passed, evidence is
  recorded, and the integrated commit is pushed.
- `READY`: every dependency is complete, but work has not begun.
- `PENDING`: a dependency is incomplete.
- `IN_PROGRESS`: exactly one integration owner is accountable for the task.
- `INTERRUPTED`: work may exist, but its previous agent/session is no longer
  reliably active. The Current Checkpoint must identify the branch/worktree,
  last known evidence, and exact recovery action. This is resumable state, not a
  product blocker.
- `BLOCKED`: a concrete unresolved owner decision or failed prerequisite is
  recorded. Difficulty alone is not a blocker.

Task IDs and review-gate IDs are stable. Never renumber them after work begins.

### Released Baseline

M0 through M11 and all review gates through `R-1110` are `COMPLETE`. The
released application baseline includes the approved domain, actors, adapters,
responsive UI, After Midnight design system backed by Mantine behind the
repository facade, accessibility, PWA, tests, GitHub Pages pipeline, operational
safeguards, multi-viewport UI/UX polish across desktop/mobile/narrow viewports,
baseline mobile ergonomics, and a provider-valid privacy-safe Gemini
compatibility probe described by `SPEC.md`, `DESIGN_SYSTEM.md`, `AGENTS.md`, and
previous milestones.

Detailed task, review, validation, worktree, deployment, and recovery history is
preserved in Git at commit `b89bb15`, the last complete pre-pruning ledger. That
history is evidence, not active instructions, and agents must not reconstruct it
in this live plan.

The active dependency flow remains:

```text
features/app -> src/design-system public contracts -> Mantine
                                                `-> small owned compositions
features/app -> actors -> domain + adapter ports
```

---

## Active Milestone

## M12 — Provider-neutral receipt AI and official Google Gen AI SDK

### M12 authority, outcome, and non-goals

The owner approved structured-output-only receipt extraction, migration of the
Google boundary to the official `@google/genai` package, and a deliberately
small provider-neutral application port so a future OpenRouter adapter can be
selected without changing receipt actors or domain logic.

Target dependency flow:

```text
receipt UI/actor -> ReceiptAiPort -> GoogleGenAiReceiptAdapter -> @google/genai
                              `-> future OpenRouter adapter
```

**Non-goals:** function calling, a provider-selection UI, OpenRouter itself,
generic agent/tool infrastructure, or changes to receipt business rules.

### Dependency graph

```text
M12-001 -> M12-002 -> M12-003 -> R-1210 -> M12-FINAL
```

#### M12-001 — Establish provider-neutral receipt AI port and pin SDK

- **Status/dependencies:** `COMPLETE`; no dependencies.
- **Ownership:** `src/adapters/ports/receipt-ai.ts`, actor/fake/contract
  consumers, `deno.json`, `deno.lock`, `THIRD_PARTY_NOTICES.md`.
- **Scope/non-goals:** Make receipt workflows depend on provider-neutral model,
  capability, query, result, and port contracts; pin `@google/genai`. Do not add
  provider orchestration or selection state.
- **Outputs/acceptance:** Receipt actors accept any `ReceiptAiPort`; no Google
  SDK type crosses the port.
- **Tests:** Port/fake and receipt actor contract tests.
- **Verification:** Changed-file format/lint, related tests,
  `deno task test:affected`, and `git diff --check`.

#### M12-002 — Implement official Google Gen AI receipt adapter

- **Status/dependencies:** `COMPLETE`; depends on `M12-001`.
- **Ownership:** `src/adapters/gemini/**` and adapter tests.
- **Scope/non-goals:** Replace the handwritten browser REST client with an
  `@google/genai`-backed adapter, keeping model discovery, real synthetic image
  testing, structured JSON output, error redaction, aborts, and local Zod
  validation. Do not use function calling.
- **Outputs/acceptance:** SDK owns Google request serialization; capable Gemini
  structured-output models pass the configuration probe.
- **Tests:** SDK-boundary fake-client tests for listing, structured requests,
  capability results, failures, cleanup, and hostile responses.
- **Verification:** Changed-file format/lint, direct adapter tests,
  `deno task test:affected`, and `git diff --check`.

#### M12-003 — Wire default Google provider at the application edge

- **Status/dependencies:** `COMPLETE`; depends on `M12-002`.
- **Ownership:** `src/features/receipt-ui.tsx` and affected component tests.
- **Scope/non-goals:** Instantiate the Google SDK adapter only in default
  dependency composition and remove raw REST/fetch code. Preserve dependency
  injection for alternate `ReceiptAiPort` implementations.
- **Outputs/acceptance:** Feature/application code contains no handcrafted
  Google GenerateContent or model-list request serialization.
- **Tests:** Default composition and affected component/actor wiring tests.
- **Verification:** Changed-file format/lint, related tests,
  `deno task test:affected`, `deno task build`, and `git diff --check`.

#### R-1210 — Receipt AI provider-boundary review gate

- **Status/dependencies:** `COMPLETE`; depends on `M12-003`.
- **Reviewer role:** Fresh read-only reviewer subagent.
- **Audit scope:** Provider neutrality, SDK usage, browser safety boundary,
  structured-output-only behavior, secrets/privacy, tests, build, and docs.
- **Remediation loop:** Primary agent fixes all severity 1–3 findings and reruns
  risk-selected validation before closure.

#### M12-FINAL — Milestone closure and ledger archiving

- **Status/dependencies:** `IN_PROGRESS`; depends on `R-1210`.
- **Ownership:** `IMPLEMENTATION_PLAN.md` and hygiene documents only.
- **Scope/non-goals:** Preserve M12 history, compact the live ledger, and run
  repository hygiene without application changes.
- **Outputs/acceptance:** M12 is summarized in Released Baseline with no stale
  task detail or dangling references.
- **Tests:** Documentation-scoped hygiene checks.
- **Verification:** Hygiene workflow commands and `git diff --check`.

### Locked boundary / design-system rules

1. Design-system facade boundary remains strictly enforced: `src/features/**`
   and `src/app/**` import only from `src/design-system`.
2. After Midnight semantic tokens in `tokens.css` remain the sole visual source
   of truth.
3. Ordinary transitions remain `0ms`.
4. Multi-viewport verification across Desktop (`1280×800`), Mobile (`390×844`),
   and Narrow (`320×568`) is required.

---

## Current Checkpoint

- **Active task / gate:** `M12-FINAL` (`IN_PROGRESS`)
- **Pushed commit / HEAD:** `65fc788` (pre-M12 baseline)
- **Verification status:** R-1210 found no severity 1–3 issues. Focused tests
  pass 21/21; affected tests pass 358/358; `deno task check`, format/lint,
  production PWA build, and `git diff --check` pass. Abort forwarding was added
  to the reviewed SDK wrapper test.
- **Active / preserved work:** Single primary agent on `master`; no worktrees or
  delegated implementation.
- **Exact next action:** Commit and push M12 implementation, then archive this
  milestone and run repository hygiene.

## Ready-to-Use Orchestration Prompt

```text
Read AGENTS.md and IMPLEMENTATION_PLAN.md. Reconcile M12's checkpoint with Git,
then resume the next dependency-ready M12 task as the single primary agent.
```
