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

M0 through M15 and all review gates through `R-1510` are `COMPLETE`. The
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
provider, and normalization boundaries; cleanup cannot mask the primary
failure.

Detailed task, review, validation, worktree, deployment, and recovery history is
preserved in Git at commit `7007904`, the last complete pre-pruning ledger. That
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

### M16 — Signed receipt-total reconciliation

Owner-approved outcome: keep receipt parent totals and signed lines in the same
monetary direction so reconciliation compares like with like. A printed receipt
total is normalized to the direction implied by its selected lines: purchase
outflows become negative while adjustment-only/inflow receipts remain positive.
The fix must preserve arbitrary-precision arithmetic and must not alter generic
expense or adjustment semantics.

| Task | Status | Dependency | Acceptance / evidence |
| --- | --- | --- | --- |
| M16-001 Normalize receipt parent totals by line direction | COMPLETE | M15 | Extracted and edited totals align with selected purchase or adjustment direction before mismatch arithmetic; raw purchase totals are handled consistently by total helpers. |
| M16-002 Regression coverage and targeted verification | COMPLETE | M16-001 | Domain sign regression passes 3/3; affected tests pass 274/274; type, format, lint, build, diff, and receipt E2E checks pass. |
| R-1610 Fresh read-only review | IN_PROGRESS | M16-002 | Initial review finding on adjustment-only inflows was fixed; a fresh read-only re-review is required before archival. |
| M16-FINAL Archive and hygiene | PENDING | R-1610 | Record exact evidence, run repository-hygiene pruning, archive completed M16 history, commit, and push. |

The implementation owner must update this ledger after each task and review
gate. The M16-FINAL archive is the only point at which completed milestone
history may be pruned from this live plan.

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

- **Active task / gate:** R-1610 (fresh read-only re-review pending; `/root` is
  integration owner)
- **Pushed commit / HEAD:** `9f4e108` (M16 planning checkpoint; sign-direction
  remediation pending)
- **Verification status:** M15 evidence remains valid. M16 domain sign tests
  pass 3/3, affected tests pass 274/274, receipt-review Playwright passes 1/1,
  and check, format, lint, build, and diff checks pass.
- **Active / preserved work:** Single primary agent on `master`; M16 planning is
  reconciled before implementation, with no delegated workers or transient
  hygiene artifacts.
- **Exact next action:** Commit and push the sign-direction remediation, then
  complete the fresh R-1610 re-review before archiving M16.

## Ready-to-Use Orchestration Prompt

```text
Read AGENTS.md, DESIGN_SYSTEM.md, and IMPLEMENTATION_PLAN.md. Confirm working
tree status on master, author the next milestone plan per
.agents/skills/implementation-planning/SKILL.md, obtain approval, and proceed
with implementation.
```
