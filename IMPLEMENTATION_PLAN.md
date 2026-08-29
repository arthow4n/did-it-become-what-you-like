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

M0 through M14 and all review gates through `R-1410` are `COMPLETE`. The
released application baseline includes the approved domain, actors, adapters,
responsive UI, After Midnight design system backed by Mantine behind the
repository facade, accessibility, PWA, tests, GitHub Pages pipeline, operational
safeguards, multi-viewport UI/UX polish across desktop/mobile/narrow viewports,
baseline mobile ergonomics, and a provider-valid privacy-safe Gemini
compatibility probe backed by the official Google Gen AI SDK and a provider-
neutral receipt AI port, plus a user-gesture-safe native receipt source picker
for camera capture and existing-image selection, described by `SPEC.md`,
`DESIGN_SYSTEM.md`, and `AGENTS.md`. Receipt scan failures also retain a safe
error taxonomy and bounded operation diagnostic for reportable recovery.

Detailed task, review, validation, worktree, deployment, and recovery history is
preserved in Git at commit `14dd741`, the last complete pre-pruning ledger. That
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

### M15 — Phase-safe receipt scan failures

Owner-approved outcome: remove the remaining `unknown · receipt.scan` blind
spot by making image resolution and cleanup errors cross the receipt actor
boundary as safe, phase-specific failures. A cleanup failure must not mask the
actual extraction error, and no raw platform/provider text may reach the UI.

| Task | Status | Dependency | Acceptance / evidence |
| --- | --- | --- | --- |
| M15-001 Type raw image lifecycle failures and preserve primary errors | COMPLETE | M14 | Resolver, preparation, extraction, and normalization failures are converted to safe phase operations; cleanup cannot replace an earlier scan failure. |
| M15-002 Regression coverage and targeted verification | COMPLETE | M15-001 | Actor regression covers a raw resolver failure and cleanup masking a typed provider failure; affected tests 37/37, checks, format, lint, build, diff check, and receipt E2E 1/1 pass. |
| R-1510 Fresh read-only review | IN_PROGRESS | M15-002 | Fresh read-only review is required before archival. |
| M15-FINAL Archive and hygiene | PENDING | R-1510 | Record exact evidence, run repository-hygiene pruning, archive completed M15 history, commit, and push. |

The implementation owner must update this ledger after each task and review
gate. The M15-FINAL archive is the only point at which completed milestone
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

- **Active task / gate:** R-1510 (fresh read-only review pending; `/root` is
  integration owner)
- **Pushed commit / HEAD:** `9fb03c9` (M14 archive; M15 implementation pending)
- **Verification status:** M15 actor regression passes 6/6, affected tests pass
  37/37, receipt-review Playwright passes 1/1, and `deno task check`, `deno task
  fmt:check`, `deno task lint`, `deno task build`, and `git diff --check` pass.
- **Active / preserved work:** Single primary agent on `master`; M15 changes are
  ready for fresh read-only review, with no delegated workers or transient
  hygiene artifacts.
- **Exact next action:** Commit and push the M15 implementation, then complete
  R-1510 and archive the milestone after the review gate.

## Ready-to-Use Orchestration Prompt

```text
Read AGENTS.md, DESIGN_SYSTEM.md, and IMPLEMENTATION_PLAN.md. Confirm working
tree status on master, author the next milestone plan per
.agents/skills/implementation-planning/SKILL.md, obtain approval, and proceed
with implementation.
```
