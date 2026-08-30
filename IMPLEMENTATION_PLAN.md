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

M0 through M32 and all review gates through `R-3210` are `COMPLETE`. The
released application baseline delivers the approved local-first expense tracker,
receipt scanning and review, Google Drive synchronization, responsive After
Midnight facade, PWA runtime, and the five-tab navigation model described by
`SPEC.md`, `DESIGN_SYSTEM.md`, and `AGENTS.md`. Detailed milestone ledgers and
release evidence are archived in Git history at `0d28f40`.

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

## M33 — Logic & State Machine Coupling Remediation

### M33 authority, outcome, and non-goals

Milestone M33 systematically fixes all state machine logic gaps, dropped events
in transient/error states, React mount race conditions, unsaved exit-guard blind
spots, and retry input resets identified during the logic audit.

Target dependency flow:

```text
src/features/** -> src/actors/** -> src/domain/** + src/adapters/ports/**
```

**Non-goals:**

- No visual redesigns or theme token changes in `tokens.css`.
- No modifications to the underlying Automerge CRDT synchronization format.
- No new external runtime or backend dependencies.

### Mandatory single-agent execution rule

- One primary coding agent performs all planning reconciliation, edits, tests,
  fixes, commits, pushes, and checkpoint updates sequentially on `master`.
- Independent read-only reviewer subagents are used exclusively at named review
  gates (`R-3310`, `R-3320`, `R-3330`).
- Context compaction or session restarts require following the recovery
  checklist before editing.

### Locked boundary / design-system rules

1. **Zero Silent Drops:** Every actionable control in the UI must correspond to
   a handled event in the active actor state.
2. **Actor as Single Source of Truth:** Form and workflow states remain in
   XState actors; React local state must not drift from actor snapshots.
3. **Non-Destructive Retry:** Retrying an operation must never erase
   user-entered input by reloading old storage state.
4. **Complete Exit Guards:** Every create and edit screen must expose dirty
   state to `DirtyExitGuard` and preserve target navigation on discard.
5. **Continuous Workflow Lifecycles:** Actors with built-in loop states must not
   be forcibly unmounted and remounted via key increments.

### Restart and compaction recovery checklist

- [ ] Read `AGENTS.md`, this milestone section, and Current Checkpoint.
- [ ] Run `git status --short --branch`, `git log -n 20 --oneline`,
      `git branch -vv`, and `git worktree list --porcelain`.
- [ ] Verify test and working tree clean state before continuing.

---

### Active dependency graph

```text
M33-001 -> M33-002 -> R-3310
                         |
M33-003 -> M33-004 -> R-3320
                         |
M33-005 -> M33-006 -> R-3330
                         |
                      M33-FINAL
```

---

### Tasks & Review Gates

#### M33-001 — Manual expense actor logic & mount race remediation

- **Status/dependencies:** `IN_PROGRESS`; depends on released baseline.
- **Ownership:** `src/actors/manual-expense.ts`, `src/features/local-ui.tsx`.
- **Scope/non-goals:**
  1. Fix the mount effect race condition in `ManualExpenseScreen` where
     concurrent `expense.hydrate` and `expense.open` dispatches cause a
     permanent loading state on empty draft hydration.
  2. Handle `expense.delete` in `persistingDraft`, `draftSaveFailed`, and
     `saveFailed` states.
  3. Handle `expense.merchant.choose` and `expense.merchant.clear` in
     `saveFailed`.
  4. Ensure `saveAnotherFailed` preserves current draft and permits editing.
  5. Scope local storage draft keys so editing an existing expense does not
     collide with or bleed into new expense creation drafts.
  6. Transition `saved` and `savedUndoFailed` cleanly to `savedOutput` on
     `onContinue`.
- **Outputs/acceptance:** Zero event drops during autosave or save failures;
  instant deterministic form opening; isolated create vs edit drafts.
- **Tests:** Add unit and actor regression tests in
  `src/actors/contracts/manual-expense-actor.test.ts` and component tests in
  `src/features/local-ui.test.tsx`.
- **Verification:**
  `deno test --related=src/actors/manual-expense.ts,src/features/local-ui.tsx`,
  `deno task typecheck`.

#### M33-002 — Navigation route typing, receipt scene association & continuous loop

- **Status/dependencies:** `PENDING`; depends on `M33-001`.
- **Ownership:** `src/features/local-ui.tsx`, `src/app/routing.ts`.
- **Scope/non-goals:**
  1. Add `"/expense/edit/${string}"` to `LocalUiPath` type union in
     `local-ui.tsx`, eliminating unsafe `as LocalUiPath` casts.
  2. Update `selectedNavigation` in `LocalUiRuntime` so `/receipt/detail/:id`
     associates with `expenses` tab instead of `scan` tab.
  3. Preserve the actor's internal continuous `savingForAnother` ->
     `openingAnother` lifecycle instead of unmounting the actor via
     `setManualFormKey`.
- **Outputs/acceptance:** Type-safe routing; contextual tab highlight during
  saved receipt inspection; seamless "Save and add another" without remount
  flicker.
- **Tests:** Update `src/features/local-ui.test.tsx` and
  `src/app/routing.test.ts`.
- **Verification:**
  `deno test --related=src/features/local-ui.tsx,src/app/routing.ts`,
  `deno task typecheck`.

#### R-3310 — Batch 1 review gate (Manual expense & routing safety)

- **Status/dependencies:** `PENDING`; depends on `M33-001`, `M33-002`.
- **Reviewer role:** Fresh read-only subagent reviewer.
- **Audit scope:** Diffs from `M33-001` and `M33-002`, `manualExpenseMachine`
  event coverage, mount lifecycle tests, route typing, and exit guard wiring.
- **Remediation loop:** Fix all findings in bounded commits before opening
  Batch 2.

---

#### M33-003 — Receipt scanning & review actor event handling & discard navigation

- **Status/dependencies:** `PENDING`; depends on `R-3310`.
- **Ownership:** `src/actors/contracts/receipt.ts`, `src/actors/receipt.ts`,
  `src/features/receipt-ui.tsx`.
- **Scope/non-goals:**
  1. Accept `receipt.scan` in `selecting` state of `receiptScanMachine`.
  2. Handle network offline/online events across all active scanning states.
  3. Handle line selections, line edits, line additions, line removals, and
     parent metadata changes in `failed` state of `receiptReviewMachine`.
  4. Ensure `cleared` state in `receiptReviewMachine` has safe fallback
     transitions.
  5. Fix `ReceiptReviewScreen` discard flow so `onClose()` invokes
     `finishDirtyNavigation()` and preserves the user's pending destination.
  6. Derive `dirty` status from `snapshot.hasTag("dirty")` instead of local
     React `useState(changed)`.
- **Outputs/acceptance:** Robust scanning and review state machines with zero
  unhandled line edits on failure; preserved navigation destinations on discard.
- **Tests:** Add actor tests in `src/actors/contracts/receipt-actor.test.ts` and
  UI tests in `src/features/receipt-ui.test.tsx`.
- **Verification:**
  `deno test --related=src/actors/receipt.ts,src/features/receipt-ui.tsx`,
  `deno task typecheck`.

#### M33-004 — Saved receipt detail actor recovery & dirty tag accuracy

- **Status/dependencies:** `PENDING`; depends on `M33-003`.
- **Ownership:** `src/actors/contracts/saved-receipt.ts`,
  `src/actors/saved-receipt.ts`, `src/features/receipt-detail-ui.tsx`.
- **Scope/non-goals:**
  1. Make `notFound` a non-terminal state in `savedReceiptDetailMachine` that
     accepts `receipt.detail.reload` and `receipt.detail.open`.
  2. Add `receipt.detail.cancel-edit` handler to `failure` state.
  3. Tag `failure` state as `dirty` when uncommitted metadata/line mutations
     failed.
  4. Fix false-dirty evaluation on line deletion failures in
     `ReceiptDetailScreen`.
- **Outputs/acceptance:** Resumable receipt detail actor; clean error recovery
  and accurate exit guards.
- **Tests:** Add tests in `src/actors/contracts/saved-receipt-actor.test.ts` and
  `src/features/receipt-detail-ui.test.tsx`.
- **Verification:**
  `deno test --related=src/actors/saved-receipt.ts,src/features/receipt-detail-ui.tsx`,
  `deno task typecheck`.

#### R-3320 — Batch 2 review gate (Receipt scanning & saved receipt detail)

- **Status/dependencies:** `PENDING`; depends on `M33-003`, `M33-004`.
- **Reviewer role:** Fresh read-only subagent reviewer.
- **Audit scope:** Diffs from `M33-003` and `M33-004`, receipt actor tests,
  discard navigation preservation, and error recovery contracts.
- **Remediation loop:** Fix all findings in bounded commits before opening
  Batch 3.

---

#### M33-005 — Project & category manager exit guards & archived deletion

- **Status/dependencies:** `PENDING`; depends on `R-3320`.
- **Ownership:** `src/features/local-ui.tsx`, `src/actors/project-category.ts`.
- **Scope/non-goals:**
  1. Wire `onDirtyChange` in `ProjectManager` and `CategoryManager` so
     uncommitted project/category creations and edits are protected by
     `DirtyExitGuard`.
  2. Allow direct deletion of archived empty and populated projects from the
     `Archived projects` disclosure list.
  3. Guard against null context state in `selectProjectOrganizationActions` and
     `selectCategoryOrganizationActions`.
  4. Synchronize `shellSnapshot.context.projectState` with React `state` to
     prevent dual-state divergence on background refresh.
- **Outputs/acceptance:** Complete exit-guard protection on organization forms;
  direct archived project deletion; robust selector contracts.
- **Tests:** Update `src/features/local-ui.test.tsx` and
  `src/actors/contracts/project-category-actor.test.ts`.
- **Verification:**
  `deno test --related=src/actors/project-category.ts,src/features/local-ui.tsx`,
  `deno task typecheck`.

#### M33-006 — Preferences retry, sync & lifecycle saga remediation

- **Status/dependencies:** `PENDING`; depends on `M33-005`.
- **Ownership:** `src/actors/preferences.ts`, `src/features/settings-pwa.tsx`,
  `src/actors/contracts/deletion.ts`, `src/actors/destruction.ts`,
  `src/actors/sync/machine.ts`, `src/actors/import-export/machine.ts`.
- **Scope/non-goals:**
  1. Fix `preferencesMachine` `failed` state so `preferences.retry` re-executes
     the save mutation rather than reloading storage and wiping user input.
  2. Fix `deleteEverywhereMachine` retry logic in `failed` state to resume from
     the specific failed step rather than resetting to Step 1.
  3. Ensure `localEraseMachine` cancellation after key removal failure honestly
     reflects that local DB erasure was already committed.
  4. Fix `syncMachine` conflict resolution to avoid over-clearing newly arrived
     concurrent conflicts.
  5. Handle network online/offline events in `importMachine` `previewing` state.
- **Outputs/acceptance:** Non-destructive preferences retry; accurate step-based
  saga resumption; robust conflict resolution and import preview.
- **Tests:** Add tests in `src/actors/preferences.test.ts`,
  `src/actors/contracts/destruction-actor.test.ts`,
  `src/actors/sync/sync-actor.test.ts`, and
  `src/actors/import-export/import-export-actor.test.ts`.
- **Verification:**
  `deno test --related=src/actors/preferences.ts,src/actors/destruction.ts,src/actors/sync/machine.ts,src/actors/import-export/machine.ts`,
  `deno task typecheck`.

#### R-3330 — Batch 3 review gate (Organization, preferences & sagas)

- **Status/dependencies:** `PENDING`; depends on `M33-005`, `M33-006`.
- **Reviewer role:** Fresh read-only subagent reviewer.
- **Audit scope:** Diffs from `M33-005` and `M33-006`, saga resumption,
  preferences retry tests, and full integration review.
- **Remediation loop:** Fix all findings in bounded commits before final
  archive.

---

#### M33-FINAL — Milestone closure, ledger archiving, and repo hygiene pruning

- **Status/dependencies:** `PENDING`; depends on `R-3330`.
- **Ownership:** `IMPLEMENTATION_PLAN.md`, `DESIGN_SYSTEM.md`, `SPEC.md`.
- **Scope/non-goals:**
  1. Run full quality gate `deno task verify` and record clean release evidence.
  2. Prune completed milestone task details into the Released Baseline; record
     the preserved Git commit hash.
  3. Execute the `repo-hygiene-pruning` skill to verify zero dangling markdown
     references or obsolete test shims.
  4. Reset active DAG for upcoming work.
- **Outputs/acceptance:** Clean, compact `IMPLEMENTATION_PLAN.md` with updated
  released baseline and verified CI quality gate.
- **Commit:** Committed with `[archive]` in the commit message per `AGENTS.md`.

---

## Current Checkpoint

- **Active task / gate:** `M33-001` (`IN_PROGRESS`)
- **Repository:** Clean, synchronized `master` reconciled at `3acdbd3`; no M33
  work or active ownership existed before recovery.
- **Next action:** Implement the audited manual-expense actor and screen
  regressions, then run the task's focused validation.

---

## Ready-to-Use Orchestration Prompt

```text
Act as the single primary coding agent for Milestone M33 in IMPLEMENTATION_PLAN.md.
Follow the recovery checklist, read AGENTS.md, IMPLEMENTATION_PLAN.md, and the
logic-audit-workflow skill in .agents/skills/logic-audit-workflow/SKILL.md.
Begin execution with task M33-001 (Manual expense actor logic & mount race remediation),
author targeted actor/component tests, run verification, update the checkpoint ledger,
and commit once verified.
```
