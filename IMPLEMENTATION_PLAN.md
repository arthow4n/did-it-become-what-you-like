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

## Current Checkpoint

- **Active task / gate:** None (Milestone M33 is `COMPLETE`).
- **Pushed commit / HEAD:** `a1802b8` —
  `fix(logic): address organization, destruction, and erase recovery edge cases`.
- **Verification status:** Full quality gate `deno task verify` passed cleanly
  (455 tests, production bundle, release verification, 0 vulnerabilities).
- **Active / preserved work:** Clean, synchronized `master`; no active worktrees
  or subagents.
- **Next action:** Stand by for the next approved milestone or instructions.
