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

M0 through M28 and all review gates through `R-2830` are `COMPLETE`. The
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

M28 additionally fixes persisted category color edits, adds atomic saved
receipt purchase-line and adjustment mutations with linked expense
projections, and delivers the saved-receipt detail add-line dialogs with
staged retry/discard behavior and focus return. Expenses now interleaves
standalone records and receipt groups with deterministic `(date, time, id)`
ordering in both directions and displays every filtered category total. Manual
expense deletion finalizes cleanly, exposes retry/keep recovery on failure,
and shows `Expense deleted.` when returning to the list. The M28 UI also uses
the approved responsive wide list/context composition and places destructive
receipt actions after receipt context and reconciliation.

M28 release evidence is preserved at pre-pruning ledger commit `993e5ed`.
`deno task fmt:check` checked 209 files, `deno task lint` checked 199 files,
`deno task check`, `git diff --check`, and the explicit release suite passed.
The release suite command
`deno test --allow-read --allow-write --allow-run --allow-env src/domain/tests/project_category_test.ts src/domain/tests/receipt_test.ts src/actors/contracts/project-category-actor.test.ts src/actors/contracts/saved-receipt-actor.test.ts src/features/local-ui.test.tsx src/features/receipt-detail-ui.test.tsx`
passed 63 tests with 0 failures. `deno task test:affected` selected no test
modules because the changes were already committed. The initial standard E2E
run reported 8 passed and one order-sensitive `receipt-review` timeout;
`deno x -p npm:@playwright/test@1.62.1 playwright test e2e/receipt-review.spec.ts --config=e2e/playwright.config.ts`
then passed 1 test in 18.5 seconds, and the combined relevant command for
`e2e/receipt-review.spec.ts e2e/local-first-manual.spec.ts` passed 3 tests in
35.0 seconds. Fresh R-2820 closure review approved with no severity-1 through
severity-4 findings. The hygiene audit found no obsolete spikes, transient
M28 documents, redundant verification scripts, or dangling Markdown links;
the detailed M28 task and review ledger is intentionally pruned from this
file and remains queryable at `993e5ed`. Post-pruning hygiene checks
`deno task fmt:check`, `deno task lint`, `deno task check`, and
`git diff --check` passed; the tracked-document and cross-reference audit
found no deletions or dangling links requiring further synchronization.

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

#### R-2830 — Final M28 Milestone Review & Release Gate

- **Status/dependencies:** `COMPLETE`; depends on the archived M28 release
  validation.
- **Reviewer role:** Fresh read-only reviewer subagent.
- **Audit scope:** Audit the M28 implementation commits, release evidence,
  archived plan state, and compliance with `SPEC.md`, `DESIGN_SYSTEM.md`, and
  `AGENTS.md`.
- **Output:** Approval to activate M29-001.
- **Review log:** Fresh read-only review approved R-2830 with no severity-1
  through severity-4 findings. It verified archive lineage, 0 dangling local
  Markdown links, 0 prohibited facade imports, the 63-test release suite, and
  all 9 repository E2E journeys passing at `fbc0165`.

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

- **Status/dependencies:** `COMPLETE`; depends on `R-2830` (completion of M28).
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

- **Status/dependencies:** `COMPLETE`; depends on `M29-001`.
- **Ownership:** `src/adapters/ports/errors.ts`, `src/domain/import-export/types.ts`, `src/domain/import-export/format.ts`, `src/adapters/drive/adapter.ts`, `src/adapters/local/index.ts`, `src/actors/import-export/machine.ts`.
- **Scope/non-goals:**
  - Introduce bounded operation diagnostics for Import/Export: `import.json_syntax`, `import.schema_version`, `import.record_validation`, `import.migration_failure`.
  - Introduce bounded operation diagnostics for Drive: `drive.auth.popup_closed`, `drive.auth.access_denied`, `drive.transport.upload_failed`, `drive.transport.quota_exceeded`.
  - Introduce bounded operation diagnostics for Local IndexedDB: `local.quota_exceeded`, `local.db_blocked`, `local.tx_abort`.
  - Non-goals: Do not expose sensitive token or payload details in diagnostic operation strings.
- **Outputs/acceptance:**
  - Import, Drive, and Local DB errors carry structured `operation` identifiers, making logs and notices specific and actionable.
- **Tests:**
  - Domain, actor, and adapter contract/integration tests in `src/domain/import-export/import-export.test.ts`, `src/actors/import-export/import-export-actor.test.ts`, `src/adapters/ports/contract.test.ts`, `src/adapters/drive/adapter.integration.test.ts`, and `src/adapters/local/local-repository.test.ts`.
- **Verification:** `deno fmt`/`deno lint` on the changed diagnostic sources and tests, `deno check src/adapters/drive/adapter.ts src/adapters/local/index.ts src/actors/import-export/machine.ts src/domain/import-export/format.ts`, `deno test --allow-read --allow-write --allow-run --allow-env src/domain/import-export/import-export.test.ts src/adapters/import-export/import-export.integration.test.ts src/adapters/ports/contract.test.ts src/actors/import-export/import-export-actor.test.ts src/adapters/drive/adapter.integration.test.ts src/adapters/local/local-repository.test.ts` (56 passed), and `git diff --check`.

---

#### R-2910 — Domain, Actor & Diagnostic Review Gate

- **Status/dependencies:** `COMPLETE`; depends on `M29-001`, `M29-002`.
- **Reviewer role:** Fresh read-only reviewer subagent.
- **Audit scope:** Diffs across `receipt.ts`, `local-ui.tsx`, and adapter error mappings. Verify unlinking logic, routing redirects, and diagnostic taxonomy safety.
- **Remediation loop:** Initial review found two S2 findings and one S3 plan-drift finding. The primary implementer corrected Drive preflight operation labeling, restricted import diagnostic preservation to the finite allowlist, and reconciled paths/tests in bounded commits. Fresh closure review approved with no findings.
- **Evidence:** Closure review against `fb7016d..96e271e` verified a clean synchronized repository, 79 focused tests passed, 13-file format check passed, lint/typecheck passed, and `git diff --check` passed.

---

#### M29-003 — Discreet Sync Status & Background Reconnect Header UX

- **Status/dependencies:** `COMPLETE`; depends on `R-2910`.
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
- **Verification:** `deno fmt`/`deno lint` on the changed sync/runtime/UI sources and tests, `deno check src/features/sync-portability-runtime.tsx src/features/local-ui.tsx src/features/receipt-ui.tsx`, `deno test --allow-read --allow-write --allow-run --allow-env src/features/sync-ui/sync-ui.test.tsx src/features/local-ui.test.tsx src/features/receipt-ui.test.tsx` (56 passed), and `git diff --check`.

---

#### M29-004 — PWA Update & Reload Banner Resilience

- **Status/dependencies:** `COMPLETE`; depends on `M29-003`.
- **Ownership:** `src/features/settings-pwa.tsx`, `src/features/settings-pwa.css`, `src/actors/contracts/update-install.ts`, `src/app/pwa.ts`, `src/actors/contracts/update-install.test.ts`, `src/app/pwa.test.ts`, `src/features/settings-pwa.test.tsx`.
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
- **Verification:** `deno fmt`/`deno lint` on the changed PWA sources and tests, `deno check src/app/pwa.ts src/features/settings-pwa.tsx src/actors/contracts/update-install.ts`, `deno test --allow-read --allow-write --allow-run --allow-env src/app/pwa.test.ts src/actors/contracts/update-install.test.ts src/features/settings-pwa.test.tsx` (17 passed), and `git diff --check`.

---

#### M29-005 — Form Conflict Field Anchoring, Preference Reset & Touch Target Polish

- **Status/dependencies:** `IN_PROGRESS`; depends on `M29-004`.
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

- **Active task / gate:** `R-2910` (`IN_PROGRESS`)
- **Released baseline:** M0 through M28 and all review gates through `R-2830`
  are complete and pushed on `master`.
- **Verification status:** M28 release validation passed format (209 files),
  lint (199 files), typecheck, diff checks, the explicit 63-test domain/actor/
  UI release suite, and the relevant 3-test `receipt-review` plus
  `local-first-manual` E2E pair. `deno task test:affected` selected no test
  modules because all changes were already committed. The M28 ledger and
  hygiene audit were archived at pre-pruning commit `993e5ed`; no obsolete
  spikes, transient M28 documents, redundant verification scripts, or dangling
  Markdown links were found. M29-001 and M29-002 are now complete; R-2910 is
  active.
- **Active / preserved work:** Clean master working tree after the archive
  edit; no worker or worktree owns unintegrated M28 changes.
- **M29-001 completion evidence:** Receipt deselection and deletion now clear
  dependent adjustment links before validation; first-use routing redirects to
  expenses after projects appear; hydrated manual drafts expose the actor's
  existing discard confirmation in-form. `deno fmt src/domain/receipt.ts
  src/domain/tests/receipt_test.ts src/features/local-ui.tsx
  src/features/local-ui.test.tsx src/features/receipt-ui.test.tsx` passed;
  `deno lint src/domain/receipt.ts src/domain/tests/receipt_test.ts
  src/features/local-ui.tsx src/features/local-ui.test.tsx
  src/features/receipt-ui.test.tsx` passed; `deno check src/domain/receipt.ts
  src/features/local-ui.tsx src/features/receipt-ui.test.tsx` passed;
  `deno test --allow-read --allow-write --allow-run --allow-env
  src/domain/tests/receipt_test.ts src/actors/contracts/receipt-actor.test.ts
  src/features/local-ui.test.tsx src/features/receipt-ui.test.tsx` passed (61
  passed, 0 failed); `git diff --check` passed.
- **M29-002 completion evidence:** Import diagnostics now distinguish JSON
  syntax, schema version, record validation, and migration failures; Drive
  authorization, upload, and quota failures use bounded operation labels; and
  IndexedDB quota, blocked-open, and transaction-abort branches retain bounded
  diagnostics. `deno fmt src/adapters/ports/errors.ts
  src/domain/import-export/types.ts src/domain/import-export/format.ts
  src/actors/import-export/machine.ts src/adapters/drive/adapter.ts
  src/adapters/local/index.ts src/domain/import-export/import-export.test.ts
  src/actors/import-export/import-export-actor.test.ts
  src/adapters/ports/contract.test.ts
  src/adapters/drive/adapter.integration.test.ts
  src/adapters/local/local-repository.test.ts` passed; the corresponding
  `deno lint` and `deno check` commands passed; and
  `deno test --allow-read --allow-write --allow-run --allow-env
  src/domain/import-export/import-export.test.ts
  src/adapters/import-export/import-export.integration.test.ts
  src/adapters/ports/contract.test.ts
  src/actors/import-export/import-export-actor.test.ts
  src/adapters/drive/adapter.integration.test.ts
  src/adapters/local/local-repository.test.ts` passed (56 passed, 0 failed).
  `git diff --check` passed.
- **Exact next action:** Run the fresh read-only R-2910 review over receipt
  safety, first-use routing, and diagnostic operation mappings.

## Ready-to-Use Orchestration Prompt

```text
Act as the single primary coding agent for M29 after completing R-2830. Read AGENTS.md, SPEC.md, DESIGN_SYSTEM.md, and IMPLEMENTATION_PLAN.md. Check git status, verify clean working tree, and resume at M29-001. Follow single-agent sequential commit cadence, record exact test commands and outputs, update IMPLEMENTATION_PLAN.md after each task, dispatch read-only reviewer subagents at named review gates (R-2910, R-2920, R-2930), and stop when the milestones are complete or if blocked.
```
