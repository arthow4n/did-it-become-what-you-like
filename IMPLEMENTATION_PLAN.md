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

M0 through M13 and all review gates through `R-1310` are `COMPLETE`. The
released application baseline includes the approved domain, actors, adapters,
responsive UI, After Midnight design system backed by Mantine behind the
repository facade, accessibility, PWA, tests, GitHub Pages pipeline, operational
safeguards, multi-viewport UI/UX polish across desktop/mobile/narrow viewports,
baseline mobile ergonomics, and a provider-valid privacy-safe Gemini
compatibility probe backed by the official Google Gen AI SDK and a provider-
neutral receipt AI port, plus a user-gesture-safe native receipt source picker
for camera capture and existing-image selection, described by `SPEC.md`,
`DESIGN_SYSTEM.md`, `AGENTS.md`, and previous milestones.

Detailed task, review, validation, worktree, deployment, and recovery history is
preserved in Git at commit `4aa0ada`, the last complete pre-pruning ledger. That
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

### M14 — Diagnosable receipt scan failures

Owner-approved outcome: keep the provider-neutral structured-output scan flow,
but preserve its safe failure taxonomy through the receipt actor and show a
shareable code (and bounded operation when available) beside the recovery
actions. Unknown failures must no longer collapse into an untraceable generic
banner, and no provider message, credential, image data, or prompt content may
cross into the UI or durable state.

| Task | Status | Dependency | Acceptance / evidence |
| --- | --- | --- | --- |
| M14-001 Trace and expose safe receipt failure diagnostics | COMPLETE | M13 | Receipt scan/validation fallbacks now retain safe operations, typed adapter codes are preserved, and the failure notice renders code plus operation without raw provider text. |
| M14-002 Regression coverage and targeted verification | COMPLETE | M14-001 | Actor/component tests pass 33/33; affected tests pass 150/150; receipt-review Playwright passes 1/1; check, format, lint, build, and diff checks pass. Pushed in `83fbff9`. |
| R-1410 Fresh read-only review | IN_PROGRESS | M14-002 | A fresh reviewer reports no severity 1–3 findings, or all findings are fixed and re-verified. |
| M14-FINAL Archive and hygiene | PENDING | R-1410 | Record exact evidence, archive completed M14 history, run the repository-hygiene procedure and its required final checks, commit, and push. |

The implementation owner must update this ledger after each task and review
gate. The M14-FINAL archive is the only point at which completed milestone
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

- **Active task / gate:** R-1410 (primary implementation owner: `/root`)
- **Pushed commit / HEAD:** `83fbff9` (M14 diagnostic implementation; M13
  review-complete history is preserved at `4aa0ada`)
- **Verification status:** M13 evidence remains valid. M14 focused actor/UI
  tests pass 33/33, affected tests pass 150/150, receipt-review Playwright
  passes 1/1, and `deno task check`, `deno task fmt:check`, `deno task lint`,
  `deno task build`, and `git diff --check` pass.
- **Active / preserved work:** M14 implementation and regression changes are
  pushed on `master`; the fresh read-only review is active and no transient
  hygiene artifacts were found.
- **Exact next action:** Complete the fresh read-only R-1410 review, resolve any
  severity 1–3 findings, and re-verify before archiving M14.

## Ready-to-Use Orchestration Prompt

```text
Read AGENTS.md, DESIGN_SYSTEM.md, and IMPLEMENTATION_PLAN.md. Confirm working
tree status on master, author the next milestone plan per
.agents/skills/implementation-planning/SKILL.md, obtain approval, and proceed
with implementation.
```
