# Implementation Plan and Orchestration Ledger

## Status and Authority

This is the single source of truth for implementation sequencing, ownership,
verification, review, and resumable progress. It does not authorize
implementation. No application code, spike, dependency, or deployment task may
begin until the repository owner explicitly starts implementation in a later
session.

Product behavior remains authoritative in `SPEC.md`; screen behavior and
cross-cutting UI states remain authoritative in
`UI_UX_AUDIT_REPORT_2026_08_28.md`; shared visual and interaction rules remain
authoritative in `DESIGN_SYSTEM.md`; agent conduct remains authoritative in
`AGENTS.md`. This plan orders that approved work and must not silently
reinterpret those documents. A discovered contradiction is a blocked
specification issue, not permission to choose whichever text is easier.

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

## Released Baseline

M0 through M8 and all review gates through `R-850` are `COMPLETE`. The released
application baseline includes the approved domain, actors, adapters, responsive
UI, After Midnight design system backed by Mantine behind the repository facade,
accessibility, PWA, tests, GitHub Pages pipeline, and operational safeguards
described by `SPEC.md`, `DESIGN_SYSTEM.md`, and `AGENTS.md`.

Detailed task, review, validation, worktree, deployment, and recovery history is
preserved in Git at commit `46eb5eb`, the last complete pre-pruning ledger. That
history is evidence, not active instructions, and agents must not reconstruct it
in this live plan.

The active dependency flow remains:

```text
features/app -> src/design-system public contracts -> Mantine
                                                `-> small owned compositions
features/app -> actors -> domain + adapter ports
```

## Definition of Done

The application is complete and releasable only when all of the following are
true:

1. Every planned task and review gate through the active milestone is
   `COMPLETE`; no required behavior is represented only by a TODO, mock in
   production, skipped test, or undocumented manual step.
2. `deno task verify` passes from a clean clone using the pinned Deno and
   lockfile state. Its test phase runs each discovered Deno test module once;
   the gate must not follow the umbrella test task by rerunning its overlapping
   component, integration, domain, or actor subsets. The approved E2E journeys
   also pass at the final gate.
3. The approved E2E journeys pass with deterministic fake external services.
   Lower-layer suites prove merge, retry, cancellation, migration, deletion, and
   validation detail without duplicating them in E2E.
4. Visual verification covers the component gallery and every approved screen at
   `320x568`, `390x844`, and `1280x800`, including keyboard, accessibility tree,
   empty/loading/offline/error/conflict, large-value/long-label, and destructive
   states. Findings are fixed and rechecked; screenshots containing secrets or
   personal data are forbidden.
5. WCAG 2.2 AA requirements in the specifications pass automated and manual
   checks. Ordinary transitions remain `0ms`; functional progress remains
   understandable with reduced motion.
6. A production build works under the repository base path, hash-route refresh,
   repository-scoped service worker, offline relaunch, explicit update reload,
   and clean IndexedDB persistence across page reloads.

### Active Dependency Graph

```text
M9-001 -> M9-002 -> M9-003 -> M9-004 -> M9-005 -> R-910 -> M9-FINAL
```

---

## M9 — Mobile Form Ergonomics, Button Spanning & Viewport Polish

### M9 authority, outcome, and non-goals

**Outcome:** Resolve all high- and medium-severity form UI ergonomics, button
spanning (full-width vs. awkward natural width), viewport text-wrapping bugs,
and layout clearance defects identified in the 2026-08-28 UI/UX audit report
across Desktop (`1280x800`), Mobile (`390x844`), and Narrow Mobile (`320x568`).

Target dependency flow:

```text
features/app -> src/design-system public contracts -> Mantine
                                                `-> small owned compositions
features/app -> actors -> domain + adapter ports
```

**Non-goals:**

- Changing business logic, storage schema, encryption, sync protocol, or XState
  actor machines.
- Adding decorative transitions, animations, or non-semantic visual noise.
- Bypassing the `src/design-system/**` facade boundary.

### Mandatory single-agent execution rule

- One primary coding agent performs all planning reconciliation, edits, tests,
  fixes, commits, pushes, and checkpoint updates sequentially on `master`.
- One independent read-only reviewer subagent is used at the consolidated review
  gate `R-910`.
- Context compaction or session restarts require following the recovery
  checklist before editing.

### Locked boundary / design-system rules

1. All feature code imports exclusively from `src/design-system/**`. Never
   import `@mantine/*` or external component libraries directly in
   `src/features/**`.
2. Semantic After Midnight tokens remain authoritative.
3. Ordinary interactions remain `0ms`; motion is restricted to approved
   functional progress indicators.
4. Primary form action buttons on mobile screens (`< 720px`) span 100% full
   width.
5. In vertical form button stacks on mobile, the primary action renders on top
   and secondary/cancel renders below.
6. Horizontal segmented controls and toolbars must not overflow the viewport on
   narrow (`320px`) screens.

### Restart and compaction recovery checklist

- [ ] Read `AGENTS.md`, this milestone section, and Current Checkpoint.
- [ ] Run `git status --short --branch`, `git log -n 20 --oneline`,
      `git branch -vv`, `git worktree list --porcelain`, and check remote sync.
- [ ] Verify test and working tree clean state before continuing.

---

### Tasks & Review Gates

#### M9-001 — Manual Expense Form Mobile Field Ergonomics & Action Spanning

- **Status/dependencies:** `READY`; depends on baseline M8.
- **Ownership:** `src/features/local-ui.tsx`, `src/features/local-ui.css`.
- **Scope/non-goals:**
  - Audit reference: `mobile-06-manual-expense-populated.png`,
    `narrow-06-manual-expense-populated.png`, `mobile-10-expense-edit.png`.
  - Refactor `ExpenseForm` layout on mobile (`< 720px`) so that `Amount` and
    `Currency` are paired side-by-side in a single responsive row
    (`min-width: 0`), with Amount taking flexible space and Currency taking
    compact fixed width (~96px).
  - Pair `Date` (~60%) and `Time (optional)` (~40%) side-by-side in a single
    responsive row on mobile viewports instead of stacking as separate full-page
    rows.
  - Ensure the `Delete this expense` button in `ManualExpenseScreen` spans 100%
    full width on mobile inside its confirmation container rather than floating
    with natural width.
  - Ensure `Save expense` and `Save and add another` buttons maintain full-width
    spanning with clear vertical hierarchy.
  - Fix Cancel action handler in `ProjectManager` and `CategoryManager` to call
    `setEditor(null)` so canceling editing returns to the list view without
    requiring the back button.
  - Non-goals: Do not alter expense validation rules or XState actor state
    machine.
- **Outputs/acceptance:**
  - Amount and Currency form fields sit side-by-side cleanly without horizontal
    overflow on 390px and 320px viewports.
  - Date and Time form fields sit side-by-side cleanly on mobile viewports.
  - `Delete this expense` is a full-width danger action on mobile.
  - Cancel button in project/category editors correctly exits editing mode.
- **Tests:** `src/features/local-ui.test.tsx`, `e2e/local-first-manual.spec.ts`.
- **Verification:**
  `deno fmt src/features/local-ui.tsx src/features/local-ui.css`,
  `deno lint src/features/local-ui.tsx`, `deno task test:affected`,
  `git diff --check`.

#### M9-002 — Expenses Screen Header, FilterBar, ListRow Word-Wrap & Project Badge

- **Status/dependencies:** `PENDING`; depends on `M9-001`.
- **Ownership:** `src/features/local-ui.tsx`, `src/features/local-ui.css`,
  `src/design-system/tokens.css`, `src/design-system/components.tsx`.
- **Scope/non-goals:**
  - Audit reference: `mobile-08-expenses-populated.png`,
    `narrow-08-expenses-populated.png`, `mobile-12-manage-projects.png`.
  - Fix text wrapping in `.ds-list-row` and category breakdown rows so long
    category names (e.g. "Uncategorized") never break awkwardly across multiple
    lines (`"Uncat / egori / zed"`).
  - Add `min-width: 0`, `word-break: normal`, and `overflow-wrap: anywhere` to
    list row text containers.
  - Fix badge sizing and container constraints to prevent truncating `"CURRENT"`
    to `"CURR..."` on mobile project cards.
  - On mobile (`< 720px`), format `[ + Add expense ]` as a prominent full-width
    action or seamlessly integrated header action.
  - Make the Period Segmented Control scrollable horizontally
    (`overflow-x: auto`) or wrap cleanly on narrow (`320px`) screens so segments
    are never clipped.
  - Pair the `Find` input and `[ Filters ]` trigger button on mobile so Filters
    is not floating as an isolated natural-width button with trailing
    whitespace.
- **Outputs/acceptance:**
  - Category breakdown rows wrap full words without character fragmentation.
  - Project status badge displays `"CURRENT"` cleanly without truncation.
  - Period segmented control scrolls smoothly without clipping on 320px screens.
  - Filter bar controls form a balanced, compact responsive grid on mobile.
- **Tests:** `src/features/local-ui.test.tsx`,
  `src/features/local-ui-filters.test.tsx`,
  `src/design-system/components.test.tsx`.
- **Verification:** `deno fmt src/features/ src/design-system/`, `deno lint`,
  `deno task test:affected`, `git diff --check`.

#### M9-003 — Project & Category Manager Mobile Cards & Header Actions

- **Status/dependencies:** `PENDING`; depends on `M9-002`.
- **Ownership:** `src/features/local-ui.tsx`, `src/features/local-ui.css`.
- **Scope/non-goals:**
  - Audit reference: `mobile-12-manage-projects.png`,
    `mobile-14-manage-projects-multi.png`, `mobile-15-manage-categories.png`.
  - Make `[ + Create project ]` and `[ + Create category ]` header action
    buttons span full-width on mobile viewports.
  - Refactor project and category list cards on mobile into a clean 2-tier
    layout: primary status/switch button on top, followed by a tidy secondary
    action grid (`Edit`, `Move up`, `Move down`, `Archive`, `Delete empty`),
    eliminating chaotic inline wrapping.
- **Outputs/acceptance:**
  - Create buttons span full width on mobile.
  - Project and category list cards have predictable, structured button grids
    that do not wrap erratically on 390px and 320px viewports.
- **Tests:** `src/features/local-ui.test.tsx`.
- **Verification:**
  `deno fmt src/features/local-ui.tsx src/features/local-ui.css`,
  `deno lint src/features/local-ui.tsx`, `deno task test:affected`,
  `git diff --check`.

#### M9-004 — Receipt Flow Action Spanning, Clearance & Dialog Action Hierarchy

- **Status/dependencies:** `PENDING`; depends on `M9-003`.
- **Ownership:** `src/features/receipt-ui.tsx`, `src/design-system/tokens.css`,
  `src/design-system/components.tsx`, `src/features/destruction-ui.tsx`,
  `src/features/settings-pwa.tsx`.
- **Scope/non-goals:**
  - Audit reference: `mobile-18-receipt-scan-options.png`,
    `mobile-20d-receipt-review.png`, `mobile-24-settings-privacy.png`,
    `mobile-22-settings-preferences.png`.
  - In `.ds-sticky-action-bar` on mobile (`< 720px`), primary actions
    (`[ Scan with AI ]`, `[ Save selected entries ]`) span 100% full width
    instead of sitting right-aligned with natural width.
  - Format `[ Add missing line ]` as a clean full-width secondary button on
    mobile.
  - Structure receipt image pickers (`Take photo`, `Choose image`, `Remove`) in
    a balanced responsive row on mobile.
  - Update `.ds-app-frame__main` bottom padding calculation to ensure all
    content and action buttons (such as "Delete everywhere" on
    `DataPrivacyScreen`) fully clear the fixed bottom navigation bar plus safe
    area on mobile devices.
  - Standardize vertical button stacking order in `FormActions` on mobile:
    Primary action on TOP, Secondary/Cancel action on BOTTOM, preventing
    inverted button layouts in dialogs and preferences.
- **Outputs/acceptance:**
  - Sticky bottom action bars in receipt scan and review span 100% full width on
    mobile.
  - Bottom navigation bar never obscures content or action buttons on any
    screen.
  - All dialogs and forms display Primary action on top and Cancel/Secondary
    below on mobile.
- **Tests:** `src/features/receipt-ui.test.tsx`,
  `src/features/destruction-ui.test.tsx`, `src/features/settings-pwa.test.tsx`,
  `src/design-system/components.test.tsx`.
- **Verification:** `deno fmt src/features/ src/design-system/`, `deno lint`,
  `deno task test:affected`, `git diff --check`.

#### M9-005 — Canonical Visual Verification Suite & Visual Audit Gate

- **Status/dependencies:** `PENDING`; depends on `M9-004`.
- **Ownership:** `e2e/ui-audit-capture.spec.ts`.
- **Scope/non-goals:**
  - Execute full Playwright visual capture suite across Desktop (`1280x800`),
    Mobile (`390x844`), and Narrow Mobile (`320x568`).
  - Visually inspect all 96 screenshots against baseline audit findings to
    verify zero regressions and 100% remediation.
  - Run full `deno task verify` to prove end-to-end correctness.
- **Outputs/acceptance:**
  - 96 green visual screenshots with remediated forms, full-width buttons,
    resilient text wrapping, and proper bottom navigation clearance.
  - Full `deno task verify` passes without errors.
- **Tests:** `deno task verify`, `deno task test:e2e`.
- **Verification:** `deno task verify`, `git diff --check`.

#### R-910 — Comprehensive Milestone Review Gate: M9 Form Ergonomics & Polish

- **Status/dependencies:** `PENDING`; depends on `M9-005`.
- **Reviewer role:** Fresh read-only subagent reviewer (`Socrates`).
- **Audit scope:** Comprehensive independent audit of all M9 commits (`M9-001`
  through `M9-005`), verification logs, visual artifacts across all 3 viewports,
  and compliance with `DESIGN_SYSTEM.md` and `AGENTS.md`.
- **Remediation loop:** Primary agent fixes all severity 1–3 findings and
  secures final approval before archiving.

---

#### M9-FINAL — Milestone Closure & Ledger Archiving

- **Status/dependencies:** `PENDING`; depends on `R-910`.
- **Ownership:** `IMPLEMENTATION_PLAN.md`.
- **Scope/non-goals:**
  - Prune completed M9 task details into the Released Baseline.
  - Record the preserved Git commit hash.
  - Reset Active Dependency Graph.
- **Outputs/acceptance:**
  - Compact, clean `IMPLEMENTATION_PLAN.md` ready for future work.
- **Commit:** Committed with `[archive]` prefix per `AGENTS.md`.
- **Verification:**
  `git commit -am "docs(plan): [archive] prune completed M9 milestone" && git push origin master`.

---

## Validation, Commit, and Push Policy

- For ordinary work, format and lint changed files, run
  `deno task test:affected`, add only the narrowest explicit check for relevant
  non-import effects, and run `git diff --check`. Use
  `deno test --related=<path>` when a known source file needs direct coverage.
- Deno graph selection cannot prove CSS, HTML, generated assets, build or
  deployment configuration, service-worker behavior, or external browser
  journeys. Add only the build, gallery, browser, schema, Pages, CI, or focused
  E2E check capable of detecting the changed behavior.
- Batch coherent UI gallery, accessibility, build, browser, and E2E checks at
  the next named review gate. Run an earlier targeted visual check only when
  waiting would be unsafe.
- `deno task verify` is reserved for final milestone release gates or a
  genuinely unbounded cross-cutting change. Never run it and then repeat its
  constituent or overlapping subset commands against the same commit.
- Reviewers may trust exact green evidence for the same commit and rerun only
  risk-selected checks. After fixes, rerun affected validation; repeat a full
  gate only for shared or cross-cutting changes.
- Inspect every diff for scope, secrets, and generated noise. Commit and push
  only coherent green work. Keep commits focused, never force-push, and update
  Current Checkpoint after each completed task or review/fix gate.

## Interruption and Recovery Protocol

Use the short path after ordinary context compaction when the same primary-agent
session continues, Git was known clean, no command, push, or reviewer was
interrupted, and no external state could have changed:

1. Re-read the active task and Current Checkpoint.
2. Run `git status --short --branch`.
3. Continue only if both still match recorded state.

Use the full path after a lost session, machine restart, failed or interrupted
command/push, reviewer disappearance, dirty or unexpected Git state, upstream
change, or any ownership/evidence uncertainty:

```text
git status --short --branch
git log --oneline --decorate -n 20
git branch -vv
git worktree list --porcelain
git rev-list --left-right --count origin/master...master
```

When network is available, run `git fetch --prune origin` and repeat the
upstream comparison. Inspect every discovered branch/worktree, staged and
unstaged diff, unintegrated commit, active process/reviewer, and recorded
validation. Preserve all work: never reset, discard, stash, overwrite, or
duplicate uncertain changes. Actual Git and test evidence wins over checklist
state. Update Current Checkpoint with reconciled HEAD/upstream, task, work,
evidence, and one exact next action before resuming edits.

Recovery is complete only when every discovered change is assigned exactly once,
no implementation agent is active concurrently, the ledger matches Git/test
evidence, and the next action is dependency-safe.

## Review and Fix Protocol

1. The primary agent implements one dependency-ready task with tests and
   risk-based validation, inspects the diff, commits, pushes, and records exact
   evidence.
2. At named review gates (`R-xxx`), one fresh read-only reviewer independently
   checks the completed batch. It reports `APPROVE` or `BLOCK`, severity,
   file/line evidence, commands/results, and minimal fixes.
3. Severity 1 risks data loss, security, privacy, or a core flow; severity 2
   violates an approved requirement or architecture/test contract; severity 3 is
   contained quality, accessibility, or maintainability; severity 4 is optional
   polish. Severity 1–3 findings must be fixed unless the owner explicitly
   accepts them.
4. The primary agent alone fixes findings and reruns affected checks. A fresh
   closure reviewer is required when the gate says so or when fixes materially
   changed what the original reviewer inspected. Downstream work remains
   `PENDING` until the gate is approved, committed, pushed, and recorded.

## Current Checkpoint

- **Active task / gate:** `M9-001` (`READY`)
- **Pushed commit / HEAD:** `6741270`
- **Verification status:** UI/UX audit report complete; 96 visual capture
  screenshots green in `ui-audit-2026-08-28/round-1-screenshots/`.
- **Active / preserved work:** Working tree clean on `master`, aligned with
  `origin/master`.
- **Exact next action:** Await explicit owner authorization to start M9
  implementation, then execute `M9-001`.

## Ready-to-Use Orchestration Prompt

```text
Act as the single primary coding agent for Milestone 9 (M9: Mobile Form Ergonomics,
Button Spanning & Viewport Polish). Read AGENTS.md and IMPLEMENTATION_PLAN.md completely,
then read the authoritative UI_UX_AUDIT_REPORT_2026_08_28.md, DESIGN_SYSTEM.md, and applicable
skills named by the active task. Reconcile Current Checkpoint using the short recovery path.

Confirm explicit implementation authorization. If absent, stop. If present, begin
with M9-001 (Manual Expense Form Mobile Field Ergonomics & Pairing). Implement one
dependency-ready task at a time using the execution, boundary, validation, commit, and
checkpoint policies. Never use parallel implementation agents or uncoordinated worktrees.
Use one fresh read-only agent only at named review gates (R-910, R-920, R-930, R-940); the
primary agent alone fixes findings.

Keep product behavior and facade contracts stable, keep XState authoritative, run
risk-selected tests without duplicate gates, commit and push green increments, and update
Current Checkpoint after each completed task or gate.
```
