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

M0 through M30 and all review gates through `R-3010` are complete. The released
application baseline includes the approved domain, XState actors, adapter ports,
local-first workflows, causal sync, responsive After Midnight UI, the
Mantine-backed design-system facade, accessibility, PWA behavior, diagnostic
taxonomy, receipt and organization safety, GitHub Pages delivery, and the
mobile/narrow viewport ergonomics described by `SPEC.md`, `DESIGN_SYSTEM.md`,
and `AGENTS.md`.

M29 and M30 specifically deliver:

- Receipt adjustment unlinking when review lines are deselected or removed,
  first-use redirection after project hydration, and in-form draft discard.
- Bounded diagnostics across import/export, Drive authorization/transport, and
  local IndexedDB boundaries, with stale Drive writes distinguished from upload
  failures.
- A discreet sync header indicator and reconnect path, contextual post-mutation
  local-save notices, fixed PWA install/update notices, quiet unsupported
  checks, and dirty-form reload protection.
- Category conflict feedback anchored to the name field, one-click persisted
  preference reset to `03:00`, and narrow-screen action rows with 44px controls
  and finger spacing.
- Receipt extraction now consolidates selected, confident duplicate purchase
  lines into quantity-aware review entries and sums repeated bottle-deposit
  charges while preserving receipt sign semantics and manual review safety.
- Release verification, responsive review, and hygiene review with no retained
  stale documents, spikes, redundant verification scripts, or dangling links.

The completed M29 implementation and review history is preserved in Git at
pre-pruning ledger commit `84e7515`. That history is evidence, not active
instructions, and agents must not reconstruct the pruned M29 task ledger in this
live plan.

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
  manifest and service worker; the pre-archive artifact verified with version
  `0.1.0`, commit `84e7515`. After archiving, the artifact was rebuilt at
  `cb7a4de` and `deno task release:verify` passed with fresh hashes.
- The hygiene audit found no obsolete spikes, transient M29 documents, redundant
  verification scripts, inaccurate tasks, or dangling tracked Markdown links; no
  files required removal.

### M30 release evidence

The M30 implementation commit `f8d0463` was pushed to `origin/master`. The
compact ledger archive was pushed as `a4d99ce`.

- `deno task check` passed.
- `deno task fmt:check` checked 210 files and passed.
- `deno task lint` checked 200 files and passed.
- Focused domain, adapter, actor, and review UI tests passed 69 tests.
- The permissioned affected graph passed 341 tests with 0 failures.
- `git diff --check` passed.
- The R-3010 fresh read-only re-check approved the implementation with no
  remaining severity 1–3 findings.
- The hygiene audit found only living/production documents and scripts, no
  dangling Markdown references, no stale M30 artifacts, and no files needing
  removal.

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

Critical browser seams are covered by the five approved E2E journeys in
`e2e/support/journeys.ts`, while domain and actor rules are not duplicated
across browser tests.

## Active dependency graph

```text
M31-001 -> M31-002 -> M31-003 -> R-3110 -> M31-FINAL
```

## M31 — 5-Tab Navigation Bar and Direct Creation Flow

### M31 authority, outcome, and non-goals

Deliver a uniform 5-item navigation tab bar across compact and expanded
viewports, providing direct scene transitions for `Expenses`, `Manual` expense
creation, `Scan` (AI receipt scanning), `Organize`, and `Settings`. Remove the
intermediate `/add` choice modal and remove the top "Add expense" header button
from the Expenses screen.

Target dependency flow:

```text
features/app -> src/design-system public contracts -> Mantine
                                                `-> small owned compositions
features/app -> actors -> domain + adapter ports
```

**Non-goals:**

- Custom primary/secondary floating action button styling in the tab bar. All 5
  tabs follow standard, uniform scene navigation item styling (selected vs
  inactive).
- Adding parallel one-off UI components outside `src/design-system/**`.
- Changing persisted data schemas, XState actor core business rules, or backend
  ports.

### Mandatory single-agent execution rule

- One primary coding agent performs all planning reconciliation, edits, tests,
  fixes, commits, pushes, and checkpoint updates sequentially on `master`.
- Independent read-only reviewer subagents are used exclusively at named review
  gates.
- Context compaction or session restarts require following the recovery
  checklist before editing.

### Locked boundary / design-system rules

1. All 5 navigation items use standard `AppNavigation` item styling with
   semantic `selected` state without non-standard action button overrides.
2. The facade boundary in `src/features/**` and `src/app/**` must not import
   `@mantine/*`.
3. Motion transitions remain `0ms`.
4. Compact screens (`< 720px`) fit 5 items cleanly with touch targets >= 44px
   (`--target-min`).
5. Focus management cleanly restores focus upon screen transitions.

### Restart and compaction recovery checklist

- [ ] Read `AGENTS.md`, this milestone section, and Current Checkpoint.
- [ ] Run `git status --short --branch`, `git log -n 20 --oneline`,
      `git branch -vv`, `git worktree list --porcelain`, and check remote sync.
- [ ] Verify test and working tree clean state before continuing.

---

### M31 Tasks

#### M31-001 — Update Design System Navigation Facade (5 Tabs)

- **Status/dependencies:** `COMPLETE`; depends on baseline.
- **Ownership:** `src/design-system/components.tsx`,
  `src/design-system/tokens.css`, `src/design-system/gallery.tsx`,
  `src/design-system/design-system.test.tsx`.
- **Scope/non-goals:**
  - Update `AppNavigationIconSet` to support `expenses`, `manual`, `scan`,
    `organize`, `settings`.
  - Update `DefaultNavigation` to output 5 items: `expenses` (Expenses),
    `manual` (Manual), `scan` (Scan), `organize` (Organize), `settings`
    (Settings).
  - Verify layout in `tokens.css` for 5 items across compact (`< 720px`) and
    desktop navigation.
  - Update gallery and design-system tests.
- **Outputs/acceptance:** `DefaultNavigation` renders 5 accessible tabs with
  appropriate default icons and `aria-current="page"` when selected.
- **Tests:** `src/design-system/design-system.test.tsx`.
- **Verification:** `deno fmt src/design-system/`,
  `deno lint src/design-system/`,
  `deno test --allow-read --allow-env src/design-system/design-system.test.tsx`,
  `git diff --check`.

#### M31-002 — Remove Expenses Header Button & Wire 5-Tab Navigation in Shell

- **Status/dependencies:** `COMPLETE`; depends on `M31-001`.
- **Ownership:** `src/features/local-ui.tsx`, `src/features/local-ui.test.tsx`.
- **Scope/non-goals:**
  - Remove `actions={<Button data-expenses-add="true" ...>Add expense</Button>}`
    from `PageHeader` in `ExpensesScreen`.
  - Wire 5-tab selection and routing in `LocalUiRuntime`:
    - `expenses` -> `/expenses`
    - `manual` -> `/expense/new`
    - `scan` -> `/receipt/scan`
    - `organize` -> `/organize`
    - `settings` -> `/settings`
  - Active route resolution:
    - `/expenses` & `/first-use` -> `expenses`
    - `/expense/new`, `/expense/edit/*` -> `manual`
    - `/receipt/scan`, `/receipt/review`, `/receipt/detail/*` -> `scan`
    - `/organize`, `/projects`, `/categories` -> `organize`
    - `/settings/*` -> `settings`
  - Remove/retire `AddChoiceScreen` and intermediate `/add` modal; redirect
    `/add` to `/expense/new`.
  - Update `local-ui.test.tsx` tests.
- **Outputs/acceptance:** Header is clean without "Add expense" button; clicking
  tabs transitions directly to manual expense or receipt scan scenes; test suite
  passes.
- **Tests:** `src/features/local-ui.test.tsx`.
- **Verification:** `deno fmt src/features/`, `deno lint src/features/`,
  `deno test --allow-read --allow-write --allow-env src/features/local-ui.test.tsx`,
  `git diff --check`.

#### M31-003 — Align E2E Journeys and Audit Captures

- **Status/dependencies:** `COMPLETE`; depends on `M31-002`.
- **Ownership:** `e2e/local-first-manual.spec.ts`, `e2e/receipt-review.spec.ts`,
  `e2e/dirty-history-preferences.spec.ts`, `e2e/offline-update.spec.ts`,
  `e2e/audit/ui-audit-capture.spec.ts`.
- **Scope/non-goals:**
  - Update E2E tests to navigate directly via the `Manual` and `Scan` tabs
    instead of the removed `Add expense` button / modal.
  - Verify all 5 journeys and audit capture pass cleanly.
- **Outputs/acceptance:** All E2E journeys and audit tests pass.
- **Tests:** `e2e/local-first-manual.spec.ts`, `e2e/receipt-review.spec.ts`,
  `e2e/dirty-history-preferences.spec.ts`, `e2e/offline-update.spec.ts`.
- **Verification:** `deno fmt e2e/`, `deno lint e2e/`, `deno task test:e2e`,
  `git diff --check`.

---

### R-3110 — M31 Independent Review Gate

- **Status/dependencies:** `IN_PROGRESS`; depends on `M31-003`.
- **Reviewer role:** Fresh read-only subagent reviewer.
- **Audit scope:** Audit diffs, 5-tab responsive navigation, removal of `/add`
  modal and header button, test suite, and compliance with `SPEC.md`,
  `DESIGN_SYSTEM.md`, and `AGENTS.md`.
- **Remediation loop:** Fix any severity 1–3 findings before marking complete.

---

### M31-FINAL — Milestone Finalization & Archive

- **Status/dependencies:** `PENDING`; depends on `R-3110`.
- **Scope:** Full verification run, release artifact build, and compact plan
  archive per `AGENTS.md` and `SKILL.md`.

---

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

- **Active task / gate:** `R-3110` (`IN_PROGRESS`)
- **Repository:** `master` has working tree changes for M31-001, M31-002, and
  M31-003.
- **M31-001 evidence:** Complete. `DefaultNavigation` and `AppNavigationIconSet`
  updated to 5 items (`Expenses`, `Manual`, `Scan`, `Organize`, `Settings`) with
  standard scene tab semantics. All 35 design system tests passed.
- **M31-002 evidence:** Complete. Expenses header action button removed;
  5-tab navigation active-route resolution and handler wired; `AddChoiceScreen`
  and `/add` choice modal retired; 27 local-ui tests passed with 0 failures; 139
  affected graph tests passed.
- **M31-003 evidence:** Complete. E2E journeys updated to use direct tab
  navigation; all 9 Playwright tests passed; visual audit capture passed across
  all 3 viewports (1280x800, 390x844, 320x568).
- **Next action:** Invoke fresh read-only reviewer for `R-3110`.
