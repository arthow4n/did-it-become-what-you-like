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

M0 through M10 and all review gates through `R-1010` are `COMPLETE`. The
released application baseline includes the approved domain, actors, adapters,
responsive UI, After Midnight design system backed by Mantine behind the
repository facade, accessibility, PWA, tests, GitHub Pages pipeline, operational
safeguards, multi-viewport UI/UX polish across desktop/mobile/narrow viewports,
and the baseline mobile ergonomics described by `SPEC.md`, `DESIGN_SYSTEM.md`,
`AGENTS.md`, and previous milestones.

Detailed task, review, validation, worktree, deployment, and recovery history is
preserved in Git at commit `987ab83`, the last complete pre-pruning ledger. That
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

## M11 — Gemini compatibility probe correctness

### M11 authority, outcome, and non-goals

The owner explicitly authorized investigation and repair of Gemini models being
incorrectly rejected by **Test configuration**. M11 makes the synthetic probe
send a real privacy-safe image matching its declared MIME type and preserves the
existing key, quota, schema, model-lifecycle, and capability semantics.

**Non-goals:** changing receipt extraction prompts or schemas, hard-coding a
model allowlist, weakening structured-output validation, or changing UI styling.

### Dependency graph

```text
M11-001 -> R-1110 -> M11-FINAL
```

#### M11-001 — Repair and regress Gemini synthetic image validation

- **Status/dependencies:** `COMPLETE`; no dependencies.
- **Ownership:** `src/adapters/gemini/adapter.ts`,
  `src/adapters/gemini/adapter.test.ts`, `IMPLEMENTATION_PLAN.md`.
- **Scope/non-goals:** Replace the invalid text-as-JPEG probe with minimal valid
  image bytes and add a provider-faithful regression test. Do not relax the
  required image, content-generation, or structured-output capability gate.
- **Outputs/acceptance:** Models whose metadata is incomplete can pass the
  synthetic configuration test when they accept real image input and the receipt
  schema; malformed synthetic media cannot regress silently.
- **Tests:** Gemini adapter unit regression that decodes and validates the
  probe's inline media before returning a valid structured response.
- **Verification:**
  `deno fmt src/adapters/gemini/adapter.ts
  src/adapters/gemini/adapter.test.ts IMPLEMENTATION_PLAN.md`,
  `deno lint src/adapters/gemini/adapter.ts
  src/adapters/gemini/adapter.test.ts`,
  `deno test --related=src/adapters/gemini/adapter.ts`,
  `deno task test:affected`, `git diff --check`.

#### R-1110 — Gemini probe repair review gate

- **Status/dependencies:** `COMPLETE`; depends on `M11-001`.
- **Reviewer role:** Fresh read-only reviewer subagent.
- **Audit scope:** M11 adapter/test diff, exact validation evidence, provider
  payload correctness, error taxonomy, secret and real-receipt privacy.
- **Remediation loop:** The primary agent fixes all severity 1–3 findings and
  reruns only affected validation before closing the gate.

#### M11-FINAL — Milestone closure and ledger archiving

- **Status/dependencies:** `IN_PROGRESS`; depends on `R-1110`.
- **Ownership:** `IMPLEMENTATION_PLAN.md` and repository hygiene documents only.
- **Scope/non-goals:** Preserve the completed M11 history in Git, compact the
  live ledger, and run the repository-hygiene workflow. No application changes.
- **Outputs/acceptance:** M11 is summarized in Released Baseline and transient
  task detail is pruned without dangling documentation references.
- **Tests:** Documentation formatting and reference checks from the hygiene
  workflow.
- **Verification:** Commands required by the repository-hygiene workflow and
  `git diff --check`.

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

- **Active task / gate:** `M11-FINAL` (`IN_PROGRESS`)
- **Pushed commit / HEAD:** `c8c5898` (pre-M11 baseline)
- **Verification status:** M11-001 passes fmt/lint, direct related tests (40),
  affected tests (40), and `git diff --check`. R-1110's sole severity-3 test
  finding was remediated by matching the full reviewed valid PNG fixture; no
  severity 1–2 findings.
- **Active / preserved work:** Single primary agent on `master`; no worktrees or
  delegated implementation.
- **Exact next action:** Commit and push M11-001, then execute M11-FINAL ledger
  archiving and repository hygiene.

## Ready-to-Use Orchestration Prompt

```text
Read AGENTS.md and IMPLEMENTATION_PLAN.md. Reconcile M11's checkpoint with Git,
then resume the next dependency-ready M11 task as the single primary agent.
```
