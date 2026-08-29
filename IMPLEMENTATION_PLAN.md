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

M0 through M25 and all review gates through `R-2510` are `COMPLETE`. The
released application baseline includes the approved domain, actors, adapters,
responsive UI, After Midnight design system backed by Mantine behind the
repository facade, accessibility, PWA, tests, GitHub Pages pipeline, operational
safeguards, multi-viewport UI/UX polish across desktop/mobile/narrow viewports,
baseline mobile ergonomics, and a provider-valid privacy-safe Gemini
compatibility probe backed by the official Google Gen AI SDK and a provider-
neutral receipt AI port, plus a user-gesture-safe native receipt source picker
for camera capture and existing-image selection, described by `SPEC.md`,
`DESIGN_SYSTEM.md`, and `AGENTS.md`. Receipt scan failures retain a safe
taxonomy and phase-specific operation diagnostics across image lifecycle,
provider, and normalization boundaries; cleanup cannot mask the primary failure.
Receipt reconciliation also aligns printed totals with the signed direction of
selected lines while preserving positive adjustment-only inflows. Gemini receipt
extraction instructions explicitly encode these signed amount rules, exclude
non-line totals, and require an arithmetic self-check. Receipt extraction now
transcribes printed signs at the provider boundary, carries an explicit economic
direction and bounded classification rationale, and applies ledger signs
deterministically in the domain before displaying that rationale during review.
M19 additionally makes receipt image replacement/removal and workflow discard
cancel active scans before ephemeral image cleanup, clearing stale scan failure
context. M20 additionally canonicalizes safe localized decimal transcription and
accepts harmless JSON fences before strict Gemini receipt-output validation,
while preserving reviewable category uncertainty. M21 additionally distinguishes
provider-output failures from persisted-data corruption and preserves
phase-specific Gemini diagnostics through the actor. Unusable provider responses
now use the dedicated `invalid-output` code, with bounded JSON, schema,
response, and mapping operation identifiers. M22 additionally distinguishes
positive bottle-deposit charges from explicit returns/refunds in Gemini
instructions and applies a narrow domain correction for misclassified
`PANT BURK` charges, keeping Coop receipt totals reconciled. M23 additionally
remediates visual, responsive, and ergonomic defects in the Add Choice Sheet
(`AddChoiceScreen`) and modal header actions across desktop, mobile, and narrow
viewports. Add Choice actions are streamlined into prominent full-width action
buttons with clear leading icons (`Plus` and `Search`) without verbose card
descriptions. Modal/drawer/sheet headers on mobile exempt icon buttons
(`.ds-icon-button`) from full-width stretching, keeping the close `X` button
pinned to the top-right inline with the title. The Add Choice bottom sheet
cleanly overlays bottom navigation with `z-index: var(--layer-overlay)` (40),
top rounded corners, and safe-area insets. M24 additionally ensures Add Choice
Sheet buttons stretch to 100% full span across modal and bottom sheet viewports
by setting `align="stretch"` on `Stack` and `width: 100%; display: flex;` on
full-width buttons. In `OrganizeScreen`, the hardcoded 3-item `.slice(0, 3)`
limit is removed, displaying all active projects and categories in full. Project
and category organization machines are also guarded with an explicit submission
flag (`isSubmittingRef`) to prevent stale actor results from closing editors
prematurely.
M25 additionally makes receipt scan close and component teardown
cancellation-safe: the actor is canceled before the ephemeral image store is
cleared, preventing stale `receipt.image.resolve` references during route
changes, discard, reload, and active image replacement. Gemini settings
navigation retains its destination while teardown performs the cancellation.
Regression coverage exercises both the visible Close path and direct
active-scan unmount, including abort and image release verification.

Detailed task, review, validation, worktree, deployment, and recovery history is
preserved in Git at commit `e10f111`, the last complete pre-pruning ledger. That
history is evidence, not active instructions, and agents must not reconstruct it
in this live plan.

The active dependency flow remains:

```text
features/app -> src/design-system public contracts -> Mantine
                                                `-> small owned compositions
features/app -> actors -> domain + adapter ports
```

---

## M26 — Preserve receipt line descriptions in expense lists

### M26 authority, outcome, and non-goals

Receipt review and persisted receipt lines already contain the correct item
descriptions. This milestone ensures the expense-list presentation keeps those
line descriptions visible instead of using the receipt merchant as every line's
title. Plain manual expenses continue to prefer their merchant. No receipt
schema, extraction prompt, sign handling, or migration changes are in scope.

Target dependency flow:

```text
receipt query view model -> receipt-group presentation -> expense row title
```

### Mandatory single-agent execution rule

- One primary coding agent performs planning reconciliation, edits, tests,
  fixes, commits, pushes, and checkpoint updates sequentially on `master`.
- A fresh read-only reviewer is used at the named review gate.

### Dependency graph

```text
M26-001 -> M26-002 -> R-2610 -> M26-FINAL
```

#### M26-001 — Prefer line descriptions inside receipt groups

- **Status/dependencies:** `COMPLETE`; depends on M25.
- **Ownership:** `src/design-system/components.tsx`.
- **Scope/non-goals:** Map grouped receipt lines so `ExpenseRow` renders each
  saved line description while the surrounding group retains the merchant.
  Preserve merchant-first titles for ordinary manual expense rows and do not
  alter persisted records or query semantics.
- **Outputs/acceptance:** A receipt group headed by its merchant displays each
  line's description (for example, `BROCCOLI`), with no merchant duplication.
- **Tests:** Component regression for receipt-group title precedence; existing
  expense-row rendering remains covered.
- **Verification:** `deno fmt <changed>`, `deno lint <changed>`,
  `deno test --related=src/features/local-ui.tsx`, `git diff --check`.

#### M26-002 — Verify import-to-list mapping

- **Status/dependencies:** `COMPLETE`; depends on M26-001.
- **Ownership:** `src/design-system/design-system.test.tsx`.
- **Scope/non-goals:** Exercise the imported receipt review shape through the
  list presentation and guard manual merchant fallback. Do not duplicate
  receipt extraction or persistence tests.
- **Outputs/acceptance:** Tests fail if line descriptions are replaced by the
  receipt merchant, while manual expense presentation remains unchanged.
- **Tests:** Focused component suites and repository affected selection.
- **Verification:** `deno task test:affected`, `deno task fmt:check`,
  `deno task lint`, `deno task check`, `git diff --check`.

#### R-2610 — Fresh read-only receipt-list review

- **Status/dependencies:** `IN_PROGRESS`; depends on M26-002.
- **Reviewer role:** Fresh read-only subagent reviewer.
- **Audit scope:** Review title precedence, receipt grouping semantics, manual
  fallback behavior, tests, and compliance with `AGENTS.md` and
  `DESIGN_SYSTEM.md`.
- **Remediation loop:** The primary agent fixes all severity 1–3 findings in
  bounded commits and requests closure before archiving.

#### M26-FINAL — Milestone closure, ledger archiving, and repo hygiene pruning

- **Status/dependencies:** `PENDING`; depends on R-2610.
- **Ownership:** `IMPLEMENTATION_PLAN.md` and M26 code/tests.
- **Scope/non-goals:** Record the pushed implementation and review evidence in
  Released Baseline, prune this detailed milestone, run repo-hygiene checks,
  and reset the active DAG. Do not remove living product specifications.
- **Outputs/acceptance:** Compact plan, clean workspace, and `[archive]` commit.
- **Tests:** Plan-pruning environment checks after implementation tests pass.
- **Verification:** `deno task check`, `deno task fmt:check`, `deno task lint`,
  `git diff --check`.

## Current Checkpoint

- **Active task / gate:** `R-2610` (`IN_PROGRESS`)
- **Pushed commit / HEAD:** `77e7808` (M26 implementation and component
  regression are pushed; independent review is pending)
- **Verification status:** M26 design-system suite passes 34/34 and the affected
  test selection passes 121/121. The focused receipt/local UI suites remain
  33/33, the receipt actor suite remains 8/8, and type check, lint, formatting,
  and diff checks pass. Investigation confirms persisted receipt-line
  descriptions are preserved by the domain query; the defect was receipt-group
  title presentation.
- **Active / preserved work:** Single primary agent on `master`; no worktree or
  delegated implementation worker; review artifacts remain outside the repo.
- **Exact next action:** Complete the fresh R-2610 review, remediate any Sev1–3
  findings, then archive M26.

## Ready-to-Use Orchestration Prompt

```text
Read AGENTS.md, DESIGN_SYSTEM.md, and IMPLEMENTATION_PLAN.md. Confirm working
tree status on master, author the next milestone plan per
.agents/skills/implementation-planning/SKILL.md, obtain approval, and proceed
with implementation.
```
