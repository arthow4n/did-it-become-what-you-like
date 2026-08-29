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

M0 through M24 and all review gates through `R-2410` are `COMPLETE`. The
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
cleanly overlays bottom navigation with `z-index: var(--layer-overlay)` (40), top
rounded corners, and safe-area insets. M24 additionally ensures Add Choice Sheet
buttons stretch to 100% full span across modal and bottom sheet viewports by
setting `align="stretch"` on `Stack` and `width: 100%; display: flex;` on
full-width buttons. In `OrganizeScreen`, the hardcoded 3-item `.slice(0, 3)` limit
is removed, displaying all active projects and categories in full. Project and
category organization machines are also guarded with an explicit submission
flag (`isSubmittingRef`) to prevent stale actor results from closing editors
prematurely.

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

## Active Milestone

No active milestone is currently open. M24 was completed in implementation
commits `88aa65e`, `4a0ee93`, and `289f0d1`, checkpointed in `e10f111`, and
reviewed with no severity 1–3 findings in `R-2410`. Its detailed task ledger
remains available in Git history.

---

## Current Checkpoint

- **Active task / gate:** None (M24 complete and archived)
- **Pushed commit / HEAD:** `origin/master` (M24 implementation, review, and plan archive
  are pushed; branch is clean)
- **Verification status:** M24 full button span and complete Organize hub
  categories display verified across desktop (`1280×800`), mobile (`390×844`),
  and narrow (`320×568`) viewports in `ui-audit-round-3/screenshots`. 118
  design-system/component tests pass; 20 `local-ui.test.tsx` tests pass; gallery
  a11y checks pass 3/3; production build succeeds; full Playwright E2E suite
  passes 9/9. Independent review `R-2410` approved with zero findings.
- **Active / preserved work:** Single primary agent on `master`; no worktree or
  delegated implementation worker; review artifacts remain outside the repo.
- **Exact next action:** Author the next approved milestone plan before making
  further application changes.

## Ready-to-Use Orchestration Prompt

```text
Read AGENTS.md, DESIGN_SYSTEM.md, and IMPLEMENTATION_PLAN.md. Confirm working
tree status on master, author the next milestone plan per
.agents/skills/implementation-planning/SKILL.md, obtain approval, and proceed
with implementation.
```
