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

M0 through M31 and all review gates through `R-3110` are complete. The released
application baseline includes the approved domain, XState actors, adapter ports,
local-first workflows, causal sync, responsive After Midnight UI, the
Mantine-backed design-system facade, accessibility, PWA behavior, diagnostic
taxonomy, receipt and organization safety, GitHub Pages delivery, the 5-tab
uniform navigation bar, and the mobile/narrow viewport ergonomics described by
`SPEC.md`, `DESIGN_SYSTEM.md`, and `AGENTS.md`.

M30 and M31 specifically deliver:

- Receipt extraction consolidates selected, confident duplicate purchase lines
  into quantity-aware review entries and sums repeated bottle-deposit charges
  while preserving receipt sign semantics and manual review safety.
- A uniform 5-item navigation tab bar (`Expenses`, `Manual`, `Scan`, `Organize`,
  `Settings`) providing direct scene transitions with accessible
  `aria-current="page"` selected states across compact mobile (<720px) and
  desktop rails.
- Removal of the intermediate `/add` modal dialog and top "Add expense" header
  button on the Expenses screen.
- Direct routing to manual expense creation (`/expense/new`) and AI receipt
  scanning (`/receipt/scan`) while preserving in-flight dirty workflow exit
  protection (`DirtyExitGuard`).

### Release validation evidence

The released baseline implementation (pushed to `origin/master`, baseline commit
`b1d01fc`) satisfies all architectural and verification requirements:

- `deno task check` passed TypeScript and repository checks with 0 errors.
- `deno task fmt:check` checked 210 files and passed.
- `deno task lint` checked 200 files and passed.
- `git diff --check` passed.
- The full test suite passed with 0 failures: `deno task test`.
- `deno task build` transformed production assets.
- `deno task release:verify` passed for version `0.1.0`.
- E2E critical user journeys passed via Playwright (`deno task test:e2e`).
- UI audit capture passed across all 3 viewports (1280x800, 390x844, 320x568).
- Independent read-only review approved the implementation with 0 findings and
  verified 100% facade boundary compliance (0 `@mantine/*` imports in
  `src/features/**` or `src/app/**`).

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
appropriate actor/domain/adapter/component coverage, a clean working tree, and
the following repository checks as risk requires:

```text
deno task fmt:check
deno task lint
deno task check
deno task test
deno task build
deno task release:verify
deno audit --frozen
git diff --check
```

Critical browser seams are covered by the approved Playwright E2E journeys in
`e2e/`, while domain and actor rules are not duplicated across browser tests.

## Active dependency graph

```text
M0..M31 implementation, R-3110 review, and M31-FINAL archive (COMPLETE)
M32 scan exit and compact-dialog remediation (COMPLETE)
```

### M32 — Scan exit and compact-dialog remediation: COMPLETE

- The receipt-scan primary action now recovers a selected image from a
  transient `idle` or `selecting` actor state rather than becoming a no-op.
- Discarding a scan-owned memory-only image navigates immediately; screen
  teardown cancels any active request before the image is released.
- Mobile confirmation sheets are content-sized and use the standard full-width
  destructive action layout. Scan work now uses one concise status panel;
  preparation copy, percentages, and three-step progress UI are removed.
- Evidence: `deno task test:affected` (40 tests),
  `deno task test:e2e --grep 'receipt-review captures'` (1 browser journey),
  `deno task check`, `deno task a11y:gallery`, `deno task build`, and the
  three-viewport audit capture all passed.

## Interruption and recovery protocol

After a restart, rate limit, lost session, or interrupted command:

1. Read `AGENTS.md`, `SPEC.md`, `DESIGN_SYSTEM.md`, this plan, and the current
   checkpoint.
2. Audit `master`, its upstream, every branch and worktree, uncommitted changes,
   unpushed commits, and any stale `IN_PROGRESS` ownership:
   `git status --short --branch`, `git log -n 20 --oneline`, `git branch -vv`,
   and `git worktree list --porcelain`.
3. Reconcile recorded evidence with the repository and rerun only the next
   dependency-ready validation. Preserve all work; never infer completion from a
   checklist or commit alone.

## Current Checkpoint

- **Active task / gate:** None; M32 is complete.
- **Repository:** `master` contains the M32 scan exit and compact-dialog
  remediation; commit/push is the final handoff action.
- **M32 delivery:** selected receipt scans recover from transient actor reset,
  guarded scan discard returns to the chosen tab, confirmation sheets remain
  compact on mobile, and scan progress is concise rather than step-based.
- **Next action:** None; ready for the next request.
