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

M0 through M27 and all review gates through `R-2730` are `COMPLETE`. The
released application baseline includes the approved domain, actors, adapters,
responsive UI, After Midnight design system backed by Mantine behind the
repository facade, accessibility, PWA, tests, GitHub Pages pipeline,
operational safeguards, multi-viewport UI/UX polish across desktop/mobile/
narrow viewports, baseline mobile ergonomics, and a provider-valid privacy-safe
Gemini compatibility probe backed by the official Google Gen AI SDK and a
provider-neutral receipt AI port, plus a user-gesture-safe native receipt
source picker for camera capture and existing-image selection, described by
`SPEC.md`, `DESIGN_SYSTEM.md`, and `AGENTS.md`. Receipt scan failures retain a
safe taxonomy and phase-specific operation diagnostics across image lifecycle,
provider, and normalization boundaries; cleanup cannot mask the primary
failure. Receipt reconciliation also aligns printed totals with the signed
direction of selected lines while preserving positive adjustment-only inflows.
Gemini receipt-extraction instructions explicitly encode these signed amount
rules, exclude non-line totals, and require an arithmetic self-check. Receipt
extraction now transcribes printed signs at the provider boundary, carries an
explicit economic direction and bounded classification rationale, and applies
ledger signs deterministically in the domain before displaying that rationale
during review. M19 additionally makes receipt image replacement/removal and
workflow discard cancel active scans before ephemeral image cleanup, clearing
stale scan failure context. M20 additionally canonicalizes safe localized
decimal transcription and accepts harmless JSON fences before strict Gemini
receipt-output validation, while preserving reviewable category uncertainty.
M21 additionally distinguishes provider-output failures from persisted-data
corruption and preserves phase-specific Gemini diagnostics through the actor.
Unusable provider responses now use the dedicated `invalid-output` code, with
bounded JSON, schema, response, and mapping operation identifiers. M22
additionally distinguishes positive bottle-deposit charges from explicit
returns/refunds in Gemini instructions and applies a narrow domain correction
for misclassified `PANT BURK` charges, keeping Coop receipt totals reconciled.
M23 additionally remediates visual, responsive, and ergonomic defects in the
Add Choice Sheet (`AddChoiceScreen`) and modal header actions across desktop,
mobile, and narrow viewports. Add Choice actions are streamlined into
prominent full-width action buttons with clear leading icons (`Plus` and
`Search`) without verbose card descriptions. Modal/drawer/sheet headers on
mobile exempt icon buttons (`.ds-icon-button`) from full-width stretching,
keeping the close `X` button pinned to the top-right inline with the title. The
Add Choice bottom sheet cleanly overlays bottom navigation with
`z-index: var(--layer-overlay)` (40), top rounded corners, and safe-area
insets. M24 additionally ensures Add Choice Sheet buttons stretch to 100%
full span across modal and bottom sheet viewports by setting `align="stretch"`
on `Stack` and `width: 100%; display: flex;` on full-width buttons. In
`OrganizeScreen`, the hardcoded 3-item `.slice(0, 3)` limit is removed,
displaying all active projects and categories in full. Project and category
organization machines are also guarded with an explicit submission flag
(`isSubmittingRef`) to prevent stale actor results from closing editors
prematurely. M25 additionally makes receipt scan close and component teardown
cancellation-safe: the actor is canceled before the ephemeral image store is
cleared, preventing stale `receipt.image.resolve` references during route
changes, discard, reload, and active image replacement. Gemini settings
navigation retains its destination while teardown performs the cancellation.
Regression coverage exercises both the visible Close path and direct active-
scan unmount, including abort and image release verification. M26 additionally
keeps receipt-line descriptions visible in expanded expense groups while
retaining the receipt merchant as the group heading and the merchant-first
fallback for ordinary manual or incomplete legacy rows.

M27 additionally delivers the saved-receipt detail workflow: receipt groups
and lines open a dedicated detail route, where staged metadata and line edits
preserve stable IDs, recompute reconciliation, and retain approved archived
category behavior. Local mutations are atomic across the receipt aggregate,
linked adjustments, derived expense projections, and synchronized tombstones.
The workflow provides scoped line and whole-receipt deletion confirmations,
approved final-line/no-undo semantics, dirty/discard/reload/history protection,
retry-aware failures, focus restoration, and responsive saved-detail behavior.
The list projection refreshes after management changes, and whole-receipt
deletion remains absent after reload. Manual-expense editing and source-image
retention remain separate and unchanged.

M27 release evidence is preserved at implementation commit `94bfcbb`, with
R-2720 closed against `2334c19` and R-2730 reviewed at `6a05ecf` against
released baseline `2131d28`. The selected receipt/domain/actor/UI/atomic
adapter command passed 44 tests with 0 failures:
`deno test --allow-read --allow-write --allow-run --allow-env src/domain/tests/receipt_test.ts src/actors/contracts/saved-receipt-actor.test.ts src/features/local-ui.test.tsx src/features/receipt-detail-ui.test.tsx src/adapters/local/receipt-atomic.integration.test.ts`.
`deno task test:affected` reported no affected test modules because the
implementation was already committed. `deno task test:e2e --
e2e/receipt-review.spec.ts` passed all 9 configured repository journeys in 2.3
minutes, including saved-receipt save, reopen, line edit/delete, projection,
whole-receipt deletion, reload, focus, and `390x844`, `320x568`, and `1280x800`
responsive assertions. `deno task check`, `deno task lint`,
`deno task fmt:check`, and `git diff --check` passed. Fresh R-2730 review found
no severity-1, severity-2, or severity-3 findings and no actionable severity-4
findings.

Detailed task, review, validation, worktree, deployment, and recovery history
through M27 is preserved in Git at commit `6a05ecf`, the last complete
pre-pruning ledger. That history is evidence, not active instructions, and
agents must not reconstruct it in this live plan.

The active dependency flow remains:

```text
features/app -> src/design-system public contracts -> Mantine
                                                `-> small owned compositions
features/app -> actors -> domain + adapter ports
```

---

## M28 — CRUD Completeness, Category Mutation Fixes, Saved Receipt Line Management, & Feed Polish

### M28 authority, outcome, and non-goals

Milestone M28 remediates CRUD gaps, silent mutation bugs, and list ordering defects discovered during the full application audit following M27:

1. **Category Color Mutation Fix:** Restores category color updating in the domain, actor, and `CategoryManager` UI so that user edits to category colors persist instead of being silently discarded.
2. **Saved Receipt Add Line / Adjustment Mutation:** Extends `ReceiptManagementService`, the saved receipt actor, and `ReceiptDetailScreen` to allow adding new purchase lines and adjustments to an existing saved receipt.
3. **Unified Chronological Feed in Expenses:** Interleaves standalone expenses and receipt groups into a unified chronological timeline on `ExpensesScreen` based on record date/time and sort order (newest/oldest).
4. **Category Breakdown Display:** Removes the hardcoded 3-item cutoff (`.slice(0, 3)`) in `ExpensesScreen` category breakdown, ensuring all categories with expenses in the selected period are displayed.
5. **Standalone Expense Deletion Feedback:** Emits a clear application toast notification when a standalone manual expense is deleted, matching saved-receipt feedback.

Target dependency flow:

```text
features/app -> src/design-system public contracts -> Mantine
                                                `-> small owned compositions
features/app -> actors -> domain + adapter ports
```

**Non-goals:**
- Manual non-AI multi-item receipt creation workflow (deferred to a future dedicated receipt-entry milestone).
- Cross-project or cross-currency receipt aggregate reassignment (explicitly deferred beyond MVP in `SPEC.md`).
- Multi-currency automatic conversion or live exchange-rate fetching.
- Visual theme alterations or breaking design-system facade modifications.

### Mandatory single-agent execution rule

- One primary coding agent performs all planning reconciliation, edits, tests,
  fixes, commits, pushes, and checkpoint updates sequentially on `master`.
- Independent read-only reviewer subagents are used exclusively at named review
  gates (`R-2810`, `R-2820`, `R-2830`).
- Context compaction or session restarts require following the recovery
  checklist before editing.

### Locked boundary / design-system rules

1. **Domain Transaction Atomicity:** Category and receipt mutations must remain transactional and atomic within `OrganizationStore` / IndexedDB transactions.
2. **Facade Integrity:** Feature files must continue to import only repository design-system facade primitives; direct `@mantine/*` imports in `src/features/**` remain prohibited.
3. **Deterministic Timelines:** Chronological interleaving must sort records by `(date, time, id)` consistently in both newest-first and oldest-first modes.
4. **Zero State Machine Regression:** XState machines continue to own all validation, staging, retry, and dirty state.
5. **Reduced-Motion & Instant Transitions:** Transitions remain `0ms` without decorative motion.

### Restart and compaction recovery checklist

- [ ] Read `AGENTS.md`, this milestone section, and Current Checkpoint.
- [ ] Run `git status --short --branch`, `git log -n 20 --oneline`,
      `git branch -vv`, `git worktree list --porcelain`, and check remote sync.
- [ ] Verify test and working tree clean state before continuing.

---

### Dependency Graph (DAG)

```text
M28-001 (Category Color Mutation Fix)
   |
   v
M28-002 (Saved Receipt Add Line / Adjustment Service & Actor)
   |
   v
 R-2810 (Domain & Actor CRUD Review Gate)
   |
   v
M28-003 (Saved Receipt Detail UI Add Line & Adjustment Dialog)
   |
   v
M28-004 (Expenses Unified Chronological Feed & Breakdown Polish)
   |
   v
M28-005 (Standalone Expense Deletion Toast Feedback)
   |
   v
 R-2820 (UI & Workflow Polish Review Gate)
   |
   v
M28-FINAL (Milestone Release Verification & Regression Pass)
   |
   v
 R-2830 (Final Milestone Review & Release Gate)
```

---

### Standardized Task Definitions

#### M28-001 — Category Color Mutation Fix in Domain, Actor, and CategoryManager

- **Status/dependencies:** `COMPLETE`; depends on baseline `2131d28`.
- **Ownership:** `src/domain/organization.ts`, `src/actors/project-category.ts`, `src/features/local-ui.tsx`, `src/domain/tests/project_category_test.ts`, `src/actors/contracts/project-category-actor.test.ts`, `src/features/local-ui.test.tsx`.
- **Scope/non-goals:**
  - Update `CategoryOrganizationCommand` to include color updates on category edit (e.g. `{ type: "edit"; categoryId: StableId; name: string; color?: string }` or update `rename` to support color).
  - Update `service.commitCategory()` to update the category's `color` attribute in the store while preserving schema validation and case-insensitive unique naming. Explicitly support color removal/clearing (removing `color` property when undefined).
  - Update `CategoryManager` in `src/features/local-ui.tsx` so that `submitEditor` sends the selected `color` when editing existing categories.
  - Non-goals: Do not alter project organization commands or category ordering contracts.
- **Outputs/acceptance:**
  - Editing a category in `CategoryManager` with a new color persists across reloads and is reflected in the category catalogue.
  - Updating a category name without altering color preserves the existing color.
  - Clearing color unsets `color` from the stored category record correctly.
- **Tests:**
  - Pure domain unit tests in `src/domain/tests/project_category_test.ts`.
  - Actor contract tests in `src/actors/contracts/project-category-actor.test.ts`.
  - UI component tests in `src/features/local-ui.test.tsx`.
- **Verification:** `deno fmt src/domain/organization.ts src/actors/project-category.ts src/features/local-ui.tsx`, `deno lint src/domain/organization.ts src/actors/project-category.ts src/features/local-ui.tsx`, `deno test --related=src/domain/organization.ts --related=src/actors/project-category.ts --related=src/features/local-ui.tsx`, `git diff --check`.

---

#### M28-002 — Saved Receipt Add Line / Adjustment Mutation in Domain and Actor

- **Status/dependencies:** `COMPLETE`; depends on `M28-001`.
- **Ownership:** `src/domain/receipt.ts`, `src/actors/contracts/saved-receipt.ts`, `src/actors/saved-receipt.ts`, `src/domain/tests/receipt_test.ts`, `src/actors/contracts/saved-receipt-actor.test.ts`.
- **Scope/non-goals:**
  - Add `addLine(receiptId: StableId, lineChanges: ReceiptLineChanges): Promise<ReceiptAggregate>` to `ReceiptManagementService` in `src/domain/receipt.ts`.
  - Atomically generate stable line and expense IDs, parse signed canonical decimal amounts, create the `ReceiptPurchaseLine` or `ReceiptAdjustment`, create the linked `Expense` projection, and write both to the `records` collection.
  - Recompute reconciliation and validate that adjustment links reference an existing purchase line on the same receipt aggregate.
  - Extend `SavedReceiptMutation` with `{ kind: "add-line"; receiptId: StableId; changes: ReceiptLineChanges }` in `src/actors/contracts/saved-receipt.ts` and wire through `savedReceiptDetailMachine`.
  - Non-goals: Do not allow modifying receipt currency or project ID.
- **Outputs/acceptance:**
  - `addLine` atomically appends purchase lines and adjustments to the saved receipt aggregate.
  - Reconciliation recalculates accurately with newly added lines.
  - Derived expense projections for added lines are written atomically.
- **Tests:**
  - Domain tests in `src/domain/tests/receipt_test.ts`.
  - Actor contract tests in `src/actors/contracts/saved-receipt-actor.test.ts`.
- **Verification:** `deno fmt src/domain/receipt.ts src/actors/saved-receipt.ts src/actors/contracts/saved-receipt.ts`, `deno lint src/domain/receipt.ts src/actors/saved-receipt.ts src/actors/contracts/saved-receipt.ts`, `deno test --related=src/domain/receipt.ts --related=src/actors/saved-receipt.ts`, `git diff --check`.

---

#### R-2810 — Domain & Actor CRUD Review Gate

- **Status/dependencies:** `IN_PROGRESS`; depends on `M28-001`, `M28-002`.
- **Reviewer role:** Fresh read-only reviewer subagent.
- **Audit scope:** Diffs in `src/domain/organization.ts`, `src/domain/receipt.ts`, `src/actors/project-category.ts`, and `src/actors/saved-receipt.ts`. Verify transaction atomicity, signed canonical decimal arithmetic, schema validation, and test coverage.
- **Remediation loop:** Primary implementer resolves any findings in bounded commits before opening next batch.
- **Review log:** Initial fresh read-only review was not approved for S2
  failed add-line discard navigation and S3 missing mid-transaction rollback
  coverage. Remediation adds `add-line` to the failure-state pending editable
  guard and UI mutation classifier, plus projection-write rollback coverage.
  Rerun passed 24 scoped tests with 0 failures; closure review is pending.

---

#### M28-003 — Saved Receipt Detail UI Add Line & Adjustment Dialog

- **Status/dependencies:** `PENDING`; depends on `R-2810`.
- **Ownership:** `src/features/receipt-detail-ui.tsx`, `src/design-system/components.tsx`, `src/features/receipt-detail-ui.test.tsx`.
- **Scope/non-goals:**
  - In `ReceiptDetailScreen`, add prominent `Add purchase line` and `Add adjustment` actions to the respective section headers or lists.
  - Wire opening `ReceiptLineEditor` in creation mode with appropriate default values and category selection.
  - Wire submission to send `receipt.detail.add-line` to `savedReceiptDetailMachine`, supporting dirty checking, discard, and retry.
  - Non-goals: Do not alter existing edit line or delete line workflows.
- **Outputs/acceptance:**
  - Users can click to add purchase lines and adjustments directly within `ReceiptDetailScreen`.
  - Staged adding recomputes reconciliation before saving.
  - Focus returns to the newly added line upon successful commit.
- **Tests:**
  - Component tests in `src/features/receipt-detail-ui.test.tsx`.
- **Verification:** `deno fmt src/features/receipt-detail-ui.tsx`, `deno lint src/features/receipt-detail-ui.tsx`, `deno test --related=src/features/receipt-detail-ui.tsx`, `git diff --check`.

---

#### M28-004 — Expenses Unified Chronological Feed & Breakdown Polish

- **Status/dependencies:** `PENDING`; depends on `M28-003`.
- **Ownership:** `src/features/local-ui.tsx`, `src/domain/queries/expenses.ts`, `src/features/local-ui.test.tsx`, `src/domain/tests/queries_test.ts`.
- **Scope/non-goals:**
  - In `ExpensesScreen`, construct a unified chronological feed that interleaves standalone expenses and `ReceiptGroup` cards based on their effective date and time.
  - Respect the user's selected sort order (`newest` or `oldest`) with deterministic tie-breaking.
  - In `ExpensesScreen:L645`, remove the hardcoded `.slice(0, 3)` limit on `result.categoryBreakdown` to display all active categories with spending in the period.
  - Non-goals: Do not change the underlying `queryExpenses` data contracts or filter parameters.
- **Outputs/acceptance:**
  - Standalone expenses and receipt groups appear sorted chronologically together rather than in two disjoint vertical sections.
  - Category breakdown displays all categories with spending in the filtered view.
- **Tests:**
  - Component tests in `src/features/local-ui.test.tsx`.
  - Query sorting tests in `src/domain/tests/queries_test.ts`.
- **Verification:** `deno fmt src/features/local-ui.tsx src/domain/queries/expenses.ts`, `deno lint src/features/local-ui.tsx src/domain/queries/expenses.ts`, `deno test --related=src/features/local-ui.tsx --related=src/domain/queries/expenses.ts`, `git diff --check`.

---

#### M28-005 — Standalone Expense Deletion Toast Feedback

- **Status/dependencies:** `PENDING`; depends on `M28-004`.
- **Ownership:** `src/features/local-ui.tsx`, `src/features/local-ui.test.tsx`.
- **Scope/non-goals:**
  - In `LocalUiRuntime` (`ManualExpenseScreen` onClosed / onSaved handler), check if the manual expense workflow completed with status `"deleted"` and trigger `setAppNotice("Expense deleted.")`.
  - Ensure the toast displays cleanly when returning to the `/expenses` list view.
  - Non-goals: Do not modify the existing `SavedExpenseCompletionScreen` undo flow for newly saved expenses.
- **Outputs/acceptance:**
  - Deleting a standalone expense shows a visible confirmation toast upon returning to the expense list.
- **Tests:**
  - UI component test in `src/features/local-ui.test.tsx`.
- **Verification:** `deno fmt src/features/local-ui.tsx`, `deno lint src/features/local-ui.tsx`, `deno test --related=src/features/local-ui.tsx`, `git diff --check`.

---

#### R-2820 — UI & Workflow Polish Review Gate

- **Status/dependencies:** `PENDING`; depends on `M28-003`, `M28-004`, `M28-005`.
- **Reviewer role:** Fresh read-only reviewer subagent.
- **Audit scope:** Diffs across `src/features/receipt-detail-ui.tsx` and `src/features/local-ui.tsx`. Verify unified feed ordering, add-line interaction, category breakdown expansion, and toast behavior across mobile and desktop viewports.
- **Remediation loop:** Primary implementer resolves any findings in bounded commits before opening release gate.

---

#### M28-FINAL — Milestone Release Verification, Hygiene Pruning & Archival

- **Status/dependencies:** `PENDING`; depends on `R-2820`.
- **Ownership:** Repository-wide test, verification, and hygiene suites.
- **Scope/non-goals:**
  - Run full repository validation: typecheck (`deno task check`), lint (`deno task lint`), format check (`deno task fmt:check`), diff check (`git diff --check`), affected tests (`deno task test:affected`), and relevant E2E journeys.
  - Execute standard lifecycle archiving and `repo-hygiene-pruning` protocol per `.agents/skills/implementation-planning/SKILL.md`: summarize completed tasks into `Released Baseline`, prune the live milestone ledger, verify all markdown links, and commit with `[archive]`.
  - Record exact commands, passing test counts, and release evidence.
- **Outputs/acceptance:**
  - Zero test failures, zero lint/formatting issues, clean Git working directory.
  - Completed milestone ledger archived cleanly into `Released Baseline`.
- **Verification:** `deno task check && deno task lint && deno task fmt:check && git diff --check && deno test --allow-read --allow-write --allow-run --allow-env src/domain/tests/project_category_test.ts src/domain/tests/receipt_test.ts src/actors/contracts/project-category-actor.test.ts src/actors/contracts/saved-receipt-actor.test.ts src/features/local-ui.test.tsx src/features/receipt-detail-ui.test.tsx`.

---

---

#### R-2830 — Final Milestone Review & Release Gate

- **Status/dependencies:** `PENDING`; depends on `M28-FINAL`.
- **Reviewer role:** Fresh read-only reviewer subagent.
- **Audit scope:** Audit all M28 commits, test evidence, documentation updates, and compliance with `SPEC.md`, `DESIGN_SYSTEM.md`, and `AGENTS.md`.
- **Outputs:** Approval for milestone completion and integration onto `master`.

---

## M29 — Sync Ergonomics, PWA Resilience, Diagnostic Taxonomy & Flow Safety

### M29 authority, outcome, and non-goals

Milestone M29 improves application ergonomics, eliminates disruptive layout shifts, adds diagnostic error codes, and fixes state transition safety across sync, PWA, and form workflows:

1. **Discreet Sync Status & Background Reconnect UX:** Replaces intrusive full-width top-of-screen Drive warning banners on reload with a quiet header sync indicator (`☁️` status pill/icon) and contextual post-mutation notices ("Saved locally. Reconnect Google Drive to sync.").
2. **PWA Update & Reload Notification Resilience:** Moves root layout update banners to floating toasts or Settings/About badges, prevents layout shift on window focus/tab switches, and eliminates spurious dev-mode update check failures.
3. **Receipt Review Adjustment Unlink Safety:** Automatically unlinks adjustment references (`adjustment.lineId = undefined`) when a linked purchase line is unchecked or removed during receipt review draft editing, preventing commit validation failures.
4. **First-Use & Draft Route Safety:** Adds a reactive redirect from `/first-use` to `/expenses` once projects are hydrated from background sync or backup import; adds an in-form "Discard draft" CTA in `ManualExpenseScreen`.
5. **Diagnostic Error Taxonomy:** Standardizes structured `operation` diagnostic codes across Drive Sync (`drive.auth.*`, `drive.transport.*`), JSON Backup Import (`import.json_syntax`, `import.schema_version`, `import.record_validation`, `import.migration_failure`), and Local IndexedDB (`local.quota_exceeded`, `local.db_blocked`, `local.tx_abort`).
6. **Form & Preference Polish:** Anchors category name conflict errors directly to `TextField`'s `error` prop in `CategoryManager`; adds a "Reset to default (03:00)" button in `PreferencesScreen`; ensures minimum 44px touch target spacing on narrow mobile viewports.

Target dependency flow:

```text
features/app -> src/design-system public contracts -> Mantine
                                                `-> small owned compositions
features/app -> actors -> domain + adapter ports
```

**Non-goals:**
- Persisting OAuth refresh tokens in durable browser storage (prohibited by security architecture and GIS client model in `SPEC.md`).
- Replacing IndexedDB or Automerge causal sync engines.
- Adding complex background push notification infrastructure.
- Modifying released visual design tokens.

### Mandatory single-agent execution rule

- One primary coding agent performs all planning reconciliation, edits, tests,
  fixes, commits, pushes, and checkpoint updates sequentially on `master`.
- Independent read-only reviewer subagents are used exclusively at named review
  gates (`R-2910`, `R-2920`, `R-2930`).
- Context compaction or session restarts require following the recovery
  checklist before editing.

### Locked boundary / design-system rules

1. **Local-First Authority:** Local mutations and browsing must never be blocked or degraded by sync or network state.
2. **Zero Layout Shift:** Background state transitions (update checks, sync re-auth) must not cause sudden layout jumping.
3. **Safe Operation Diagnostics:** Diagnostic strings must be bounded and non-sensitive.
4. **Durability & Dirty Protection:** PWA reload prompts must remain blocked while forms are dirty.
5. **Reduced-Motion & Instant Transitions:** Transitions remain `0ms` without decorative motion.

### Restart and compaction recovery checklist

- [ ] Read `AGENTS.md`, this milestone section, and Current Checkpoint.
- [ ] Run `git status --short --branch`, `git log -n 20 --oneline`,
      `git branch -vv`, `git worktree list --porcelain`, and check remote sync.
- [ ] Verify test and working tree clean state before continuing.

---

### Dependency Graph (DAG)

```text
M29-001 (Receipt Review Unlink Safety & First-Use Route Safety)
   |
   v
M29-002 (Diagnostic Error Taxonomy across Drive, Import & Local DB)
   |
   v
 R-2910 (Domain, Actor & Diagnostic Review Gate)
   |
   v
M29-003 (Discreet Sync Status & Background Reconnect Header UX)
   |
   v
M29-004 (PWA Update & Reload Banner Resilience)
   |
   v
M29-005 (Form Conflict Anchoring, Preference Reset & Touch Target Polish)
   |
   v
 R-2920 (UI, Ergonomics & PWA Review Gate)
   |
   v
M29-FINAL (Milestone Release Verification, Hygiene Pruning & Archival)
   |
   v
 R-2930 (Final Milestone Review & Release Gate)
```

---

### Standardized Task Definitions

#### M29-001 — Receipt Review Adjustment Unlink Safety & First-Use Routing Safety

- **Status/dependencies:** `PENDING`; depends on `R-2830` (completion of M28).
- **Ownership:** `src/domain/receipt.ts`, `src/actors/receipt.ts`, `src/features/local-ui.tsx`, `src/domain/tests/receipt_test.ts`, `src/features/local-ui.test.tsx`.
- **Scope/non-goals:**
  - In `src/domain/receipt.ts`, update `setReceiptLineSelected()` and `removeReceiptLine()` to automatically clear `lineId` (`adjustment.lineId = undefined`) on any adjustment referencing an unselected or removed purchase line.
  - In `src/features/local-ui.tsx`, add a reactive routing effect so that when `path === "/first-use"` and `state.projects.length > 0`, navigation automatically redirects to `/expenses`.
  - In `ManualExpenseScreen`, add an in-form "Discard draft" action on `DraftStatus` when a hydrated draft is present.
  - Non-goals: Do not alter saved receipt detail workflows (which already unlink adjustments).
- **Outputs/acceptance:**
  - Unchecking or removing a purchase line during review unlinks dependent adjustments and commits cleanly without throwing `invalid`.
  - Syncing or restoring a backup from the first-use screen immediately takes the user to `/expenses` once projects exist.
  - Restored manual expense drafts can be discarded cleanly within the form.
- **Tests:**
  - Unit tests in `src/domain/tests/receipt_test.ts`.
  - Component tests in `src/features/local-ui.test.tsx` and `src/features/receipt-ui.test.tsx`.
- **Verification:** `deno fmt src/domain/receipt.ts src/actors/receipt.ts src/features/local-ui.tsx`, `deno lint src/domain/receipt.ts src/actors/receipt.ts src/features/local-ui.tsx`, `deno test --related=src/domain/receipt.ts --related=src/features/local-ui.tsx`, `git diff --check`.

---

#### M29-002 — Diagnostic Error Taxonomy Across Drive, Import/Export, and Local DB

- **Status/dependencies:** `PENDING`; depends on `M29-001`.
- **Ownership:** `src/adapters/ports/types.ts`, `src/adapters/import-export/index.ts`, `src/adapters/drive/adapter.ts`, `src/adapters/local/index.ts`, `src/actors/contracts/types.ts`.
- **Scope/non-goals:**
  - Introduce bounded operation diagnostics for Import/Export: `import.json_syntax`, `import.schema_version`, `import.record_validation`, `import.migration_failure`.
  - Introduce bounded operation diagnostics for Drive: `drive.auth.popup_closed`, `drive.auth.access_denied`, `drive.transport.upload_failed`, `drive.transport.quota_exceeded`.
  - Introduce bounded operation diagnostics for Local IndexedDB: `local.quota_exceeded`, `local.db_blocked`, `local.tx_abort`.
  - Non-goals: Do not expose sensitive token or payload details in diagnostic operation strings.
- **Outputs/acceptance:**
  - Import, Drive, and Local DB errors carry structured `operation` identifiers, making logs and notices specific and actionable.
- **Tests:**
  - Unit and adapter contract tests in `src/test-support/fakes/adapter-contract.test.ts`, `src/domain/import-export/import-export.test.ts`.
- **Verification:** `deno fmt src/adapters/import-export/index.ts src/adapters/drive/adapter.ts src/adapters/local/index.ts`, `deno lint src/adapters/import-export/index.ts src/adapters/drive/adapter.ts src/adapters/local/index.ts`, `deno test --related=src/adapters/import-export/index.ts --related=src/adapters/drive/adapter.ts`, `git diff --check`.

---

#### R-2910 — Domain, Actor & Diagnostic Review Gate

- **Status/dependencies:** `PENDING`; depends on `M29-001`, `M29-002`.
- **Reviewer role:** Fresh read-only reviewer subagent.
- **Audit scope:** Diffs across `receipt.ts`, `local-ui.tsx`, and adapter error mappings. Verify unlinking logic, routing redirects, and diagnostic taxonomy safety.
- **Remediation loop:** Primary implementer resolves any findings in bounded commits before opening next batch.

---

#### M29-003 — Discreet Sync Status & Background Reconnect Header UX

- **Status/dependencies:** `PENDING`; depends on `R-2910`.
- **Ownership:** `src/features/sync-portability-runtime.tsx`, `src/features/sync-ui/`, `src/features/local-ui.tsx`, `src/features/local-ui.css`.
- **Scope/non-goals:**
  - Remove intrusive top-of-screen Drive warning banners on page reload when local data is healthy.
  - Add a discreet sync status indicator / icon in the header (or next to project selector) reflecting sync state (`Synced`, `Syncing`, `Local only · Tap to reconnect`).
  - Surface non-blocking toasts when an expense/receipt is saved while Drive authentication is expired ("Saved locally. Reconnect Google Drive to sync.").
  - Keep 1-click reconnect available directly via GIS popup with `login_hint`.
  - Non-goals: Do not alter conflict review or device retirement screen workflows.
- **Outputs/acceptance:**
  - Refreshing the page with configured Drive does not push the UI down with giant warning banners.
  - Header sync indicator accurately reflects state and allows 1-click reconnect.
  - New local entries prompt contextual sync notices only after mutation.
- **Tests:**
  - Component tests in `src/features/local-ui.test.tsx` and `src/features/sync-ui/sync-ui.test.tsx`.
- **Verification:** `deno fmt src/features/sync-portability-runtime.tsx src/features/local-ui.tsx`, `deno lint src/features/sync-portability-runtime.tsx src/features/local-ui.tsx`, `deno test --related=src/features/sync-portability-runtime.tsx --related=src/features/local-ui.tsx`, `git diff --check`.

---

#### M29-004 — PWA Update & Reload Banner Resilience

- **Status/dependencies:** `PENDING`; depends on `M29-003`.
- **Ownership:** `src/features/settings-pwa.tsx`, `src/actors/contracts/update-install.ts`, `src/app/pwa.ts`, `src/features/settings-pwa.test.tsx`.
- **Scope/non-goals:**
  - Prevent `PwaRuntime` from injecting layout-shifting banners at the root of the document tree.
  - Present `Update ready` notices as non-shifting floating toasts or badges in Settings → About.
  - In dev mode or unsupported browser contexts, ensure `updateInstallMachine` stays in `idle` / `up-to-date` rather than transitioning to `failed` and logging spurious errors.
  - Preserve form dirty protection so reload offers are never triggered while active input exists.
  - Non-goals: Do not alter Service Worker caching or registration lifecycles.
- **Outputs/acceptance:**
  - Focusing or reloading the tab never causes sudden layout jumps from PWA update banners.
  - Non-prod environments avoid `Update status could not be checked` errors.
- **Tests:**
  - Component and actor tests in `src/features/settings-pwa.test.tsx` and `src/actors/contracts/update-install.test.ts`.
- **Verification:** `deno fmt src/features/settings-pwa.tsx src/app/pwa.ts`, `deno lint src/features/settings-pwa.tsx src/app/pwa.ts`, `deno test --related=src/features/settings-pwa.tsx --related=src/app/pwa.ts`, `git diff --check`.

---

#### M29-005 — Form Conflict Field Anchoring, Preference Reset & Touch Target Polish

- **Status/dependencies:** `PENDING`; depends on `M29-004`.
- **Ownership:** `src/features/local-ui.tsx`, `src/features/settings-pwa.tsx`, `src/features/local-ui.css`, `src/features/local-ui.test.tsx`.
- **Scope/non-goals:**
  - In `CategoryManager`, anchor duplicate category name conflict errors directly to the `TextField`'s `error` prop (matching `ProjectManager`).
  - In `PreferencesScreen`, add a `Reset to default (03:00)` CTA button.
  - In `local-ui.css`, ensure `.local-ui-card-actions--grid` maintains minimum 44px touch target height and row spacing on narrow `< 360px` screens.
  - Non-goals: Do not alter project or category sorting order rules.
- **Outputs/acceptance:**
  - Inline error appears under the name input on category collision.
  - Preferences can be reset to 03:00 with one click.
  - Touch targets on small screens wrap with proper finger spacing.
- **Tests:**
  - Component tests in `src/features/local-ui.test.tsx` and `src/features/settings-pwa.test.tsx`.
- **Verification:** `deno fmt src/features/local-ui.tsx src/features/settings-pwa.tsx src/features/local-ui.css`, `deno lint src/features/local-ui.tsx src/features/settings-pwa.tsx src/features/local-ui.css`, `deno test --related=src/features/local-ui.tsx --related=src/features/settings-pwa.tsx`, `git diff --check`.

---

#### R-2920 — UI, Ergonomics & PWA Review Gate

- **Status/dependencies:** `PENDING`; depends on `M29-003`, `M29-004`, `M29-005`.
- **Reviewer role:** Fresh read-only reviewer subagent.
- **Audit scope:** Diffs across sync UI, PWA runtime, CategoryManager, and PreferencesScreen across mobile and desktop viewports.
- **Remediation loop:** Primary implementer resolves any findings in bounded commits before opening release gate.

---

#### M29-FINAL — Milestone Release Verification, Hygiene Pruning & Archival

- **Status/dependencies:** `PENDING`; depends on `R-2920`.
- **Ownership:** Repository-wide test, verification, and hygiene suites.
- **Scope/non-goals:**
  - Run full repository validation: typecheck (`deno task check`), lint (`deno task lint`), format check (`deno task fmt:check`), diff check (`git diff --check`), affected tests (`deno task test:affected`), and relevant E2E journeys.
  - Execute standard lifecycle archiving and `repo-hygiene-pruning` protocol per `.agents/skills/implementation-planning/SKILL.md`: summarize completed tasks into `Released Baseline`, prune the live milestone ledger, verify all markdown links, and commit with `[archive]`.
  - Record exact commands, passing test counts, and release evidence.
- **Outputs/acceptance:**
  - Zero test failures, zero lint/formatting issues, clean Git working directory.
  - Completed milestone ledger archived cleanly into `Released Baseline`.
- **Verification:** `deno task check && deno task lint && deno task fmt:check && git diff --check && deno test --allow-read --allow-write --allow-run --allow-env src/domain/tests/receipt_test.ts src/features/local-ui.test.tsx src/features/settings-pwa.test.tsx src/features/sync-ui/sync-ui.test.tsx`.

---

#### R-2930 — Final Milestone Review & Release Gate

- **Status/dependencies:** `PENDING`; depends on `M29-FINAL`.
- **Reviewer role:** Fresh read-only reviewer subagent.
- **Audit scope:** Audit all M29 commits, test evidence, documentation updates, and compliance with `SPEC.md`, `DESIGN_SYSTEM.md`, and `AGENTS.md`.
- **Outputs:** Approval for milestone completion and integration onto `master`.

---

## Current Checkpoint

- **Active task / gate:** `R-2810` (`IN_PROGRESS`)
- **Released baseline:** M0 through M27 and all review gates through `R-2730`
  are complete and pushed on `master`.
- **Verification status:** M28-001 passed formatting, lint, diff checks, and
  the scoped command `deno test --allow-read --allow-write --allow-run
  --allow-env src/domain/tests/project_category_test.ts
  src/actors/contracts/project-category-actor.test.ts
  src/features/local-ui.test.tsx` with 36 tests passed and 0 failed. M28-002
  is now active. M28-002 passed formatting, lint, typecheck, diff checks, and
  the scoped command `deno test --allow-read --allow-write --allow-run
  --allow-env src/domain/tests/receipt_test.ts
  src/actors/contracts/saved-receipt-actor.test.ts
  src/features/receipt-detail-ui.test.tsx` with 23 tests passed and 0 failed.
  R-2810 remediation then passed the same scoped command with 24 tests passed
  and 0 failed, along with formatting, lint, typecheck, and diff checks. R-2810
  closure is pending. M29 remains staged as dependent follow-up.
- **Active / preserved work:** Clean master working tree.
- **Exact next action:** Dispatch a fresh read-only R-2810 reviewer for the
  category and saved-receipt domain/actor diffs; remediate any findings before
  starting M28-003.

## Ready-to-Use Orchestration Prompt

```text
Act as the single primary coding agent for M28 and M29. Read AGENTS.md, SPEC.md, DESIGN_SYSTEM.md, and IMPLEMENTATION_PLAN.md. Check git status, verify clean working tree, and start execution with task M28-001. Follow single-agent sequential commit cadence, record exact test commands and outputs, update IMPLEMENTATION_PLAN.md after each task, dispatch read-only reviewer subagents at named review gates (R-2810, R-2820, R-2830, R-2910, R-2920, R-2930), and stop when milestones are complete or if blocked.
```
