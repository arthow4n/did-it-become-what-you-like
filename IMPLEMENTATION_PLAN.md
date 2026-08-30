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

M0 through M29 and all review gates through `R-2920` are complete. The
released application baseline includes the approved domain, XState actors,
adapter ports, local-first workflows, causal sync, responsive After Midnight
UI, the Mantine-backed design-system facade, accessibility, PWA behavior,
diagnostic taxonomy, receipt and organization safety, GitHub Pages delivery,
and the mobile/narrow viewport ergonomics described by `SPEC.md`,
`DESIGN_SYSTEM.md`, and `AGENTS.md`.

M29 specifically delivers:

- Receipt adjustment unlinking when review lines are deselected or removed,
  first-use redirection after project hydration, and in-form draft discard.
- Bounded diagnostics across import/export, Drive authorization/transport,
  and local IndexedDB boundaries, with stale Drive writes distinguished from
  upload failures.
- A discreet sync header indicator and reconnect path, contextual
  post-mutation local-save notices, fixed PWA install/update notices, quiet
  unsupported checks, and dirty-form reload protection.
- Category conflict feedback anchored to the name field, one-click persisted
  preference reset to `03:00`, and narrow-screen action rows with 44px
  controls and finger spacing.
- Release verification, responsive review, and hygiene review with no retained
  stale documents, spikes, redundant verification scripts, or dangling links.

The completed implementation and review history is preserved in Git at
pre-pruning ledger commit `84e7515`. That history is evidence, not active
instructions, and agents must not reconstruct the pruned M29 task ledger in
this live plan.

### M29 release evidence

The M29-FINAL release gate passed:

- `deno task check` passed TypeScript and repository script/E2E checks.
- `deno task lint` checked 200 files.
- `deno task fmt:check` checked 210 files.
- `git diff --check` passed.
- `deno task test:affected` selected no test modules because the code changes
  were already committed.
- The explicit release suite passed 71 tests with 0 failures:
  `deno test --allow-read --allow-write --allow-run --allow-env
  src/domain/tests/receipt_test.ts src/features/local-ui.test.tsx
  src/features/settings-pwa.test.tsx src/features/sync-ui/sync-ui.test.tsx`.
- The R-2920 closure review passed 88 focused UI/PWA tests and 5 Playwright
  journeys, with no horizontal overflow at 320x568, 390x844, or 1280x800.
- `deno task build` transformed 2,973 modules and generated the production
  manifest and service worker; `deno task release:verify` passed with
  version `0.1.0`, commit `84e7515`, and verified artifact hashes.
- The hygiene audit found no obsolete spikes, transient M29 documents,
  redundant verification scripts, inaccurate tasks, or dangling tracked
  Markdown links; no files required removal.

## Architecture and ownership baseline

The dependency boundaries remain:

```text
features/app -> src/design-system public contracts -> Mantine
                                                `-> small owned compositions
features/app -> actors -> domain + adapter ports
```

Files under `src/features/**` and `src/app/**` use only the repository
design-system facade. Mantine-specific implementation, provider mapping, and
library customization stay in `src/design-system/**`. Durable workflow and
form state remains in XState actors; product composites remain repository-owned
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

Critical browser seams are covered by the five approved E2E journeys in
`e2e/support/journeys.ts`, while domain and actor rules are not duplicated
across browser tests.

## Active dependency graph

```text
M0..M29 implementation and R-2920 review (COMPLETE)
   |
   v
R-2930 final milestone review (IN_PROGRESS)
   |
   v
next milestone planning (after R-2930 approval)
```

## R-2930 — Final M29 Review and Release Gate

- **Status:** `IN_PROGRESS`; the implementation, release validation,
  responsive review, and archive are complete.
- **Reviewer:** Fresh read-only reviewer subagent.
- **Scope:** Verify M29 history, release evidence, compact plan archive,
  hygiene results, and compliance with `SPEC.md`, `DESIGN_SYSTEM.md`, and
  `AGENTS.md`.
- **Remediation:** Any finding must be fixed in a bounded commit, rerun only
  the affected checks, and update this checkpoint before completion.
- **Output:** Approval closes M29 and permits the next milestone plan.

## Interruption and recovery protocol

After a restart, rate limit, lost session, or interrupted command:

1. Read `AGENTS.md`, `SPEC.md`, `DESIGN_SYSTEM.md`, this plan, and the
   current checkpoint.
2. Audit `master`, its upstream, every branch and worktree, uncommitted
   changes, unpushed commits, and any stale `IN_PROGRESS` ownership:
   `git status --short --branch`, `git log -n 20 --oneline`,
   `git branch -vv`, and `git worktree list --porcelain`.
3. Reconcile recorded evidence with the repository and rerun only the next
   dependency-ready validation. Preserve all work; never infer completion from
   a checklist or commit alone.

## Current Checkpoint

- **Active gate:** `R-2930` (`IN_PROGRESS`).
- **Repository:** `master` is clean and synchronized at the archive commit
  that follows pre-pruning ledger `84e7515`.
- **M29 implementation:** complete and pushed; R-2910 and R-2920 approved.
- **M29-FINAL:** complete; release and hygiene evidence is recorded above.
- **Next action:** Dispatch the fresh read-only R-2930 review. On approval, mark
  R-2930 complete, update the released baseline to include all M29 gates, and
  push the final plan checkpoint.

## Ready-to-use orchestration prompt

```text
Act as the integration owner for the active R-2930 gate. Read AGENTS.md,
SPEC.md, DESIGN_SYSTEM.md, and IMPLEMENTATION_PLAN.md. Audit the current
master/upstream/worktree state and the compact M29 release evidence. Use a
fresh read-only reviewer for R-2930, preserve all existing work, update this
checkpoint after approval, and initialize a new dependency-ordered milestone
only after the product owner approves its requirements and design.
```
