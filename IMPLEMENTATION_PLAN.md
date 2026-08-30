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

M0 through M26 and all review gates through `R-2610` are `COMPLETE`. The
released application baseline includes the approved domain, actors, adapters,
responsive UI, After Midnight design system backed by Mantine behind the
repository facade, accessibility, PWA, tests, GitHub Pages pipeline, operational
safeguards, multi-viewport UI/UX polish across desktop/mobile/narrow viewports,
baseline mobile ergonomics, and a provider-valid privacy-safe Gemini
compatibility probe backed by the official Google Gen AI SDK and a provider-
neutral receipt AI port, plus a user-gesture-safe native receipt source picker
for camera capture and existing-image selection, described by `SPEC.md`,
`DESIGN_SYSTEM.md`, and `AGENTS.md`. Receipt scan failures retain a safe
taxonomy and phase-specific operation diagnostics across image lifecycle,
provider, and normalization boundaries; cleanup cannot mask the primary failure.
Receipt reconciliation also aligns printed totals with the signed direction of
selected lines while preserving positive adjustment-only inflows. Gemini receipt
extraction instructions explicitly encode these signed amount rules, exclude
non-line totals, and require an arithmetic self-check. Receipt extraction now
transcribes printed signs at the provider boundary, carries an explicit economic
direction and bounded classification rationale, and applies ledger signs
deterministically in the domain before displaying that rationale during review.
M19 additionally makes receipt image replacement/removal and workflow discard
cancel active scans before ephemeral image cleanup, clearing stale scan failure
context. M20 additionally canonicalizes safe localized decimal transcription and
accepts harmless JSON fences before strict Gemini receipt-output validation,
while preserving reviewable category uncertainty. M21 additionally distinguishes
provider-output failures from persisted-data corruption and preserves
phase-specific Gemini diagnostics through the actor. Unusable provider responses
now use the dedicated `invalid-output` code, with bounded JSON, schema,
response, and mapping operation identifiers. M22 additionally distinguishes
positive bottle-deposit charges from explicit returns/refunds in Gemini
instructions and applies a narrow domain correction for misclassified
`PANT BURK` charges, keeping Coop receipt totals reconciled. M23 additionally
remediates visual, responsive, and ergonomic defects in the Add Choice Sheet
(`AddChoiceScreen`) and modal header actions across desktop, mobile, and narrow
viewports. Add Choice actions are streamlined into prominent full-width action
buttons with clear leading icons (`Plus` and `Search`) without verbose card
descriptions. Modal/drawer/sheet headers on mobile exempt icon buttons
(`.ds-icon-button`) from full-width stretching, keeping the close `X` button
pinned to the top-right inline with the title. The Add Choice bottom sheet
cleanly overlays bottom navigation with `z-index: var(--layer-overlay)` (40),
top rounded corners, and safe-area insets. M24 additionally ensures Add Choice
Sheet buttons stretch to 100% full span across modal and bottom sheet viewports
by setting `align="stretch"` on `Stack` and `width: 100%; display: flex;` on
full-width buttons. In `OrganizeScreen`, the hardcoded 3-item `.slice(0, 3)`
limit is removed, displaying all active projects and categories in full. Project
and category organization machines are also guarded with an explicit submission
flag (`isSubmittingRef`) to prevent stale actor results from closing editors
prematurely. M25 additionally makes receipt scan close and component teardown
cancellation-safe: the actor is canceled before the ephemeral image store is
cleared, preventing stale `receipt.image.resolve` references during route
changes, discard, reload, and active image replacement. Gemini settings
navigation retains its destination while teardown performs the cancellation.
Regression coverage exercises both the visible Close path and direct active-scan
unmount, including abort and image release verification. M26 additionally keeps
receipt-line descriptions visible in expanded expense groups while retaining the
receipt merchant as the group heading and the merchant-first fallback for
ordinary manual or incomplete legacy rows.

Detailed task, review, validation, worktree, deployment, and recovery history is
preserved in Git at commit `e10f111`, the last complete pre-pruning ledger. That
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

## M27 — Saved receipt management

### M27 authority, outcome, and non-goals

M27 adds the missing post-save workflow for opening a receipt, understanding its
reconciliation, editing receipt metadata and individual saved lines, and
deleting either one saved line or the entire receipt. The receipt parent,
purchase lines, adjustments, expense-list projections, local persistence, and
synchronized tombstones must remain one coherent domain aggregate throughout
every mutation.

Target dependency flow:

```text
expense receipt group / line -> saved-receipt detail actor -> receipt domain
                                                           -> local atomic port
                                                           -> sync tombstones
```

**Non-goals:** Re-running Gemini, retaining or restoring the source image,
adding receipt history/version browsing, changing manual-expense editing,
redesigning the expense list, adding bulk multi-receipt operations, or changing
the Drive synchronization protocol beyond using its existing record and
tombstone contracts.

Planning this milestone does not authorize implementation. `M27-001` must
capture and obtain owner approval for the remaining product decisions before
application code changes begin.

### Mandatory single-agent execution rule

- One primary coding agent performs reconciliation, edits, tests, fixes,
  commits, pushes, and checkpoint updates sequentially on `master`.
- Fresh read-only reviewer subagents are used only at the named review gates.
- No worker or worktree is opened unless this ledger is first amended with
  disjoint ownership, an integration owner, and merge/verification order.
- Context compaction with known clean state requires checkpoint and Git-status
  confirmation; an interrupted command, unknown ownership, or restarted session
  requires the full recovery checklist.

### Locked receipt-management and design-system rules

1. The saved receipt parent remains the source of merchant, occurred-at date and
   time, currency, and printed total; saved purchase lines and adjustments
   retain stable record IDs.
2. A receipt group exposes a clear `View receipt` action. Selecting a receipt
   line may open the same detail workflow focused on that line; it must not be
   routed through the manual-expense editor.
3. Receipt detail shows metadata, printed total, selected-line total,
   difference, purchase lines, and adjustments before destructive actions are
   offered.
4. Receipt, line, and adjustment mutations are local-first and atomic. The
   expense list must never observe a half-updated aggregate. Receipt-linked
   legacy or projection `Expense` records identified by `receiptId` or
   `receiptLineId` are part of that aggregate for mutation and validation.
5. Deleting a receipt tombstones the parent, every owned purchase line and
   adjustment, and every receipt-linked derived `Expense` record in one domain
   operation. A stale replay must not resurrect deleted records; a genuinely
   concurrent edit follows the existing conflict-review contract instead of
   being silently discarded.
6. Deleting or editing one line immediately recomputes reconciliation. A
   mismatch is reviewable and does not silently rewrite the printed total.
7. Final-line deletion, linked-adjustment handling, and undo behavior remain
   explicit owner decisions in `M27-001`; downstream tasks may not invent
   defaults. The current recommendation is: confirm and remove the empty parent
   when its final line is deleted, unlink but preserve independently meaningful
   adjustments when their purchase line is removed, and provide no undo after a
   committed synchronized deletion. Undo may be approved only with an explicit
   delayed-tombstone or tombstone-supersession contract and cross-device tests.
8. XState owns finite workflow modes and async mutation lifecycles. Components
   derive availability from actor state and do not duplicate `loading`,
   `saving`, `confirming`, or failure flags.
9. Feature and app files use only the repository design-system facade. M27
   reuses existing primitives and does not change a public facade contract
   without an impact inventory and ledger amendment.
10. Ordinary navigation, dialogs, expansion, and layout changes remain `0ms`;
    focus restoration, keyboard semantics, narrow/mobile layouts, and static
    reduced-motion feedback remain required.
11. `M27-001` must decide whether edits are staged or immediately committed and
    define dirty-state ownership, discard confirmation, reload restoration, and
    browser/back navigation behavior. Actor and UI tasks implement that single
    approved model rather than mixing both.
12. Editable receipt metadata is an allowlist approved in `M27-001`. Project
    reassignment is read-only unless the approved contract moves every child and
    derived record atomically. An existing archived category may remain during
    an unrelated line edit; a changed category must resolve to `Uncategorized`
    or an active existing category. Adjustment links must resolve within their
    allowed receipt scope.

### Restart and compaction recovery checklist

- [ ] Read `AGENTS.md`, `SPEC.md`, `DESIGN_SYSTEM.md`, this M27 section, and
      Current Checkpoint.
- [ ] Run `git status --short --branch`, `git log -n 20 --oneline`,
      `git branch -vv`, and `git worktree list --porcelain`; confirm upstream
      synchronization.
- [ ] Confirm no interrupted command, active worker, uncommitted change, or
      unpushed commit owns M27 files.
- [ ] Reconcile the recorded task status with repository and test evidence
      before changing it.

### M27 dependency graph

```text
M27-001 -> M27-002 -> R-2710
                         |
              M27-003 -> M27-004 -> R-2720
                                      |
                           M27-005 -> R-2730 -> M27-FINAL
```

#### M27-001 — Approve the saved-receipt product and interaction contract

- **Status/dependencies:** `COMPLETE`; depends only on the released M26
  baseline. Owner authorization to implement M27 is recorded by the repository
  owner instruction to implement the current milestone according to this plan.
- **Ownership:** `SPEC.md`, `DESIGN_SYSTEM.md`, `IMPLEMENTATION_PLAN.md`.
- **Scope/non-goals:** Specify the receipt-detail entry points, screen states,
  edit surfaces, confirmation copy and scope, completion destinations, error
  recovery, and narrow/mobile behavior. Inventory the actual route/shell, domain
  export, actor contract, sync, import/export, receipt-card, and design-system
  consumers before locking exact downstream ownership. Obtain explicit owner
  decisions for the editable metadata allowlist and project reassignment; staged
  versus immediate editing and dirty discard/reload/back behavior; final-line
  deletion; adjustments linked to a deleted purchase line; and whether deletion
  has no undo, delayed tombstones, or superseding tombstones. Do not change
  application code, choose new styling, or broaden manual-expense behavior.
- **Outputs/acceptance:** `SPEC.md` and `DESIGN_SYSTEM.md` describe one approved
  workflow and all cross-cutting loading, empty, mismatch, saving, deletion,
  failure, offline, dirty/discard, reload, focus, and authorization states. The
  impact inventory amends exact downstream ownership and verification commands.
  The inventory is: `src/features/local-ui.tsx` owns hash paths, shell routing,
  state refresh, dirty navigation, and receipt-group entry;
  `src/domain/receipt.ts` owns receipt aggregate validation and mutations;
  `src/domain/organization.ts` and `src/domain/schema/**` expose parsed
  aggregate state and record contracts; `src/adapters/local/**` owns atomic
  IndexedDB transactions and local tombstones; `src/adapters/sync/causal.ts`,
  `src/adapters/sync/coordinator.ts`, and conflict-domain tests prove causal
  replay and delete-versus-edit behavior; `src/domain/import-export/**` and
  `src/adapters/import-export/**` preserve portable receipt references;
  `src/actors/contracts/saved-receipt.ts` and `src/actors/saved-receipt.ts` own
  the detail lifecycle; and `src/design-system/components.tsx`,
  `src/features/receipt-ui.tsx`, `src/features/receipt-detail-ui.tsx`, and their
  tests own the facade-backed management composition.
  `src/domain/queries/expenses.ts` remains the single receipt-list projection
  and `e2e/receipt-review.spec.ts` is the only added critical browser journey.
  The plan records every decision above without ambiguity, including the sync
  semantics and the explicit no-undo contract. The approved contract is recorded
  in `SPEC.md` and `DESIGN_SYSTEM.md`.
- **Tests:** Documentation cross-reference and terminology inspection; no
  application tests.
- **Verification:** `deno fmt SPEC.md DESIGN_SYSTEM.md IMPLEMENTATION_PLAN.md`,
  `rg -n "saved receipt|receipt detail|final line|linked adjustment|undo|dirty|project reassignment|tombstone" SPEC.md DESIGN_SYSTEM.md IMPLEMENTATION_PLAN.md`,
  `git diff --check`.

#### M27-002 — Add atomic saved-receipt mutation contracts

- **Status/dependencies:** `COMPLETE`; depends on approved `M27-001` and the
  owner authorization recorded above. Atomic mutation services, derived
  projection maintenance, rollback coverage, and causal deletion coverage are
  implemented and pushed.
- **Ownership:** `src/domain/receipt.ts`, `src/domain/organization.ts`,
  `src/domain/index.ts`, `src/domain/schema/**`, `src/domain/tests/**`,
  `src/adapters/local/receipt-atomic.integration.test.ts`,
  `src/adapters/local/receipt-deletion-sync.integration.test.ts`,
  `src/adapters/import-export/import-export.integration.test.ts`.
- **Scope/non-goals:** Add ID-based receipt aggregate lookup and narrowly scoped
  metadata update, line update, line deletion, and whole-receipt deletion
  services. Implement the approved final-line, linked-adjustment, metadata,
  project, and deletion/undo rules with one atomic local transaction. Include
  receipt-linked derived `Expense` records in line and aggregate operations;
  keep retained projections coherent after edits. Preserve record schema and
  import/export compatibility. Distinguish stale replay from concurrent
  delete-versus-edit conflict, including child edits racing whole-receipt
  deletion. Do not put UI state in domain records, retain source images, alter
  Gemini extraction, or change general synchronization policy.
- **Outputs/acceptance:** Every operation either commits the complete aggregate
  mutation or leaves it unchanged; stable IDs survive edits; tombstones cover
  the approved parent, child, adjustment, and linked-derived-record scope;
  expense-list projections immediately show saved descriptions and updated
  amounts; validation permits an unchanged archived category but requires a
  changed assignment to be active/existing or `Uncategorized`, and rejects
  cross-receipt adjustment links; reconciliation is derived rather than
  duplicated. Stale replay remains deleted while a genuine concurrent edit
  produces the existing reviewable conflict. If undo is approved, its expiry,
  reload, synchronization, and cross-device result are defined and proven;
  otherwise no restore action is exposed after commit.
- **Tests:** Pure domain tests for metadata/line edits, individual and
  final-line deletion, mismatch recomputation, linked adjustments, missing/stale
  IDs, derived `Expense` cleanup/coherence, validation failures, and
  whole-receipt deletion; local-adapter integration tests for atomic rollback
  and tombstones; causal sync tests separating stale replay from concurrent
  parent/child edits; import/export and schema validation tests for zero
  dangling receipt references. Add the approved undo matrix only if undo
  survives `M27-001`.
- **Verification:**
  `deno fmt src/domain/receipt.ts src/domain/organization.ts src/domain/index.ts src/domain/schema src/domain/tests src/adapters/local/receipt-atomic.integration.test.ts src/adapters/local/receipt-deletion-sync.integration.test.ts src/adapters/import-export/import-export.integration.test.ts`,
  `deno lint src/domain/receipt.ts src/domain/organization.ts src/domain/index.ts src/domain/schema src/domain/tests src/adapters/local/receipt-atomic.integration.test.ts src/adapters/local/receipt-deletion-sync.integration.test.ts src/adapters/import-export/import-export.integration.test.ts`,
  `deno test --related=src/domain/receipt.ts`,
  `deno test --related=src/adapters/local/receipt-atomic.integration.test.ts`,
  `deno test src/adapters/local/receipt-deletion-sync.integration.test.ts src/adapters/import-export/import-export.integration.test.ts`,
  `deno task test:affected`, `git diff --check`.

#### R-2710 — Product contract and domain-boundary review

- **Status/dependencies:** `COMPLETE`; depends on `M27-002`.
- **Reviewer role:** Fresh read-only subagent reviewer.
- **Audit scope:** Approved product decisions, aggregate ownership, atomicity,
  stable-ID handling, adjustment and derived-`Expense` semantics, tombstone
  completeness, stale replay versus concurrent-edit conflict behavior,
  schema/import-export compatibility, approved undo semantics or explicit
  absence, and exact domain/adapter test evidence.
- **Remediation loop:** The primary agent fixes every severity 1–3 finding in
  bounded commits, reruns risk-selected affected verification, records exact
  evidence, and obtains review closure before opening `M27-003`.
- **Implementation evidence before review:** `deno task check`, focused receipt
  domain/local integration tests (18 passed), and `deno task test:affected` (298
  passed, 0 failed) pass at the M27-002 commit; `git diff --check` passes.
- **Initial review findings:** Anscombe’s fresh read-only review found seven
  issues: tombstone ID collisions and overlong generated IDs, deleted-ID reuse,
  incomplete linked-derived-`Expense` validation/projection, archived categories
  accepted during new receipt commit, missing receipt-specific import/export
  fixtures, and a stale/format-unclean checkpoint. The review also confirmed the
  covered stale-replay/concurrent-child conflict behavior.
- **Remediation:** In progress. Tombstone IDs now use bounded fingerprints with
  transaction preflight collision checks; tombstoned IDs are reserved; derived
  expense ownership/source and legacy line matching are validated and projected;
  archived categories are rejected for new receipt lines; domain and adapter
  receipt round-trip fixtures are added; focused remediation tests currently
  pass (36 passed, 0 failed).
- **Closure review follow-up:** Carver’s fresh closure review confirmed the
  other six remediation areas and found one remaining severity 2 edge case:
  tombstone preflight still permitted collision with another record in the same
  deletion set, which could overwrite a previously written tombstone. The
  checkpoint was also stale. The preflight is now strict for every existing
  generated ID, and the checkpoint is being corrected with the next remediation
  commit.
- **Closure evidence:** Pasteur’s final fresh read-only review at `a2bfd90`
  found no functional severity 1–3 findings; the only remaining observation was
  stale checkpoint text, corrected below. The exact risk-selected gate passed
  with `deno task check`, the focused receipt/domain/local/import-export suites
  (36 passed, 0 failed), formatting, lint, and `git diff --check`. `R-2710` is
  closed.

#### M27-003 — Model the saved-receipt detail actor

- **Status/dependencies:** `COMPLETE`; depends on closed `R-2710`.
- **Ownership:** `src/actors/saved-receipt.ts`,
  `src/actors/contracts/saved-receipt.ts`, `src/actors/contracts/index.ts`,
  `src/actors/contracts/ports.ts`, `src/actors/contracts/types.ts`,
  `src/actors/contracts/saved-receipt-actor.test.ts`.
- **Scope/non-goals:** Add a focused XState v5 actor for loading one saved
  receipt and coordinating edit, confirmation, mutation, retry, and completion
  lifecycles through domain/adapter ports. Keep finite modes in states, durable
  receipt data in context, derived reconciliation outside duplicated booleans,
  and one-request/one-result mutations in named promise actors. Model the
  approved staged/immediate editing contract, dirty/discard/reload/back guards,
  and deletion completion semantics explicitly. Do not expand the existing
  receipt-scan actor or introduce a second persistence layer.
- **Outputs/acceptance:** The machine has explicit loading, ready/editing,
  confirming-line-delete, confirming-receipt-delete, mutating, failure, and
  completed outcomes (nested states may consolidate equivalent modes). Domain
  events carry record IDs and edited values directly. Cancellation prevents a
  late mutation result from reopening a closed screen, errors preserve a safe
  retry target, and UI consumers can rely on `matches`, tags, and `can` rather
  than manual flags. Dirty state is owned once, navigation cannot silently lose
  staged edits, and reload behavior matches the approved persistence contract.
- **Tests:** Actor tests cover load success/not-found, metadata and line edit,
  both deletion confirmations, cancellation, retryable failure, stale IDs,
  final-line outcome, dirty edit/discard confirmation, back/browser navigation,
  reload restoration or intentional reset, and emitted completion/navigation
  intent.
- **Verification:**
  `deno fmt src/actors/saved-receipt.ts src/actors/contracts/saved-receipt.ts src/actors/contracts/index.ts src/actors/contracts/ports.ts src/actors/contracts/types.ts src/actors/contracts/saved-receipt-actor.test.ts`,
  `deno lint src/actors/saved-receipt.ts src/actors/contracts/saved-receipt.ts src/actors/contracts/index.ts src/actors/contracts/ports.ts src/actors/contracts/types.ts src/actors/contracts/saved-receipt-actor.test.ts`,
  `deno test src/actors/contracts/saved-receipt-actor.test.ts`,
  `deno task test:affected`, `git diff --check`.

- **Closure evidence:** The focused actor suite passed with 5 passed and 0
  failed. `deno task check`, targeted format/lint, and `git diff --check`
  passed; `deno task test:affected` passed with 135 passed and 0 failed. The
  actor implementation and tests were pushed in `2b38a96`.

#### M27-004 — Add receipt-detail navigation and management UI

- **Status/dependencies:** `COMPLETE`; depends on completed `M27-003`.
- **Ownership:** `src/features/local-ui.tsx`, `src/features/local-ui.css`,
  `src/features/local-ui.test.tsx`, `src/features/receipt-ui.tsx`,
  `src/features/receipt-ui.test.tsx`, `src/features/receipt-detail-ui.tsx`,
  `src/features/receipt-detail-ui.test.tsx`,
  `src/actors/contracts/root-shell.ts`,
  `src/actors/contracts/shell-actor.test.ts`, and, only if approved by the
  `M27-001` impact inventory, `src/design-system/components.tsx`,
  `src/design-system/design-system.test.tsx`,
  `src/design-system/public-api.test.ts`, and `DESIGN_SYSTEM.md` for the
  approved facade variant documentation.
- **Scope/non-goals:** Wire receipt groups and saved lines to the dedicated
  detail workflow, render the approved metadata/reconciliation/line hierarchy,
  and expose edit and destructive actions with approved confirmations, progress,
  failure recovery, dirty/discard/back behavior, completion navigation, and the
  approved post-deletion behavior. Reuse repository facade primitives; if the
  review-oriented `ReceiptLineCard` cannot represent saved management without a
  misleading selection checkbox, add the smallest product-oriented facade
  variant after the required impact inventory. Do not make the whole expanded
  group an ambiguous click target, route receipt lines through manual-expense
  UI, or redesign unrelated expense cards.
- **Outputs/acceptance:** `View receipt` is discoverable by pointer and
  keyboard; line activation can focus the matching detail row; back/close
  restores a sensible focus target; destructive controls state their exact
  scope; repeated submits are impossible while mutating; the detail view is
  usable at desktop, mobile, and narrow widths without hidden actions or
  bottom-navigation overlap; saved descriptions remain visible after returning
  to the list.
- **Tests:** Component tests for group/line entry, focused-line routing,
  accessible headings and action names, metadata/line editing, both deletion
  dialogs, focus restoration, disabled/in-flight behavior, mismatch updates,
  error retry, dirty discard/back/reload behavior, approved post-deletion
  behavior, and manual-expense regression. If a facade contract changes, cover
  its public API and review-versus-management variants.
- **Verification:**
  `deno fmt src/features/local-ui.tsx src/features/local-ui.css src/features/local-ui.test.tsx src/features/receipt-ui.tsx src/features/receipt-ui.test.tsx src/features/receipt-detail-ui.tsx src/features/receipt-detail-ui.test.tsx src/actors/contracts/root-shell.ts src/actors/contracts/shell-actor.test.ts`,
  `deno lint src/features/local-ui.tsx src/features/local-ui.test.tsx src/features/receipt-ui.tsx src/features/receipt-ui.test.tsx src/features/receipt-detail-ui.tsx src/features/receipt-detail-ui.test.tsx src/actors/contracts/root-shell.ts src/actors/contracts/shell-actor.test.ts`,
  `deno test src/features/local-ui.test.tsx src/features/receipt-ui.test.tsx src/features/receipt-detail-ui.test.tsx src/actors/contracts/shell-actor.test.ts`,
  `deno task test:affected`, `git diff --check`.

- **Closure evidence:** The focused UI, shell, and design-system suite passed
  with 74 passed and 0 failed; the affected graph passed with 229 passed and 0
  failed. `deno task fmt:check`, `deno task lint`, `deno task check`, and
  `git diff --check` passed. The named visual checkpoint passed
  `deno task a11y:gallery` across narrow, phone, and desktop viewports with
  screenshot/tree/axe inspection, and `deno task build` completed successfully
  with the existing large-chunk warning. The implementation was pushed in
  `6737367`.

#### R-2720 — Actor, UI, accessibility, and responsive review

- **Status/dependencies:** `IN_PROGRESS`; depends on completed `M27-004`.
- **Reviewer role:** Fresh read-only subagent reviewer.
- **Audit scope:** XState v5 lifecycle correctness, facade-boundary compliance,
  route/event wiring, destructive scope clarity, focus and keyboard semantics,
  failure/retry, dirty/discard/reload/back behavior, approved deletion/undo
  semantics, receipt/manual-expense separation, any facade impact, and targeted
  desktop/mobile/narrow visual evidence.
- **Remediation loop:** The primary agent fixes every severity 1–3 finding in
  bounded commits, reruns affected actor/component checks and only the visual
  checks implicated by a fix, records evidence, and obtains review closure
  before `M27-005`.
- **Review finding record:** Fresh read-only review found no severity-1
  findings, but identified eight severity-2/3 issues requiring remediation:
  discard confirmation dropped the dirty tag and unload/history protection;
  detail exit had no focus restoration; saved-detail responsive evidence was
  missing; in-place receipt-ID changes could retain the old actor; retryability
  metadata was ignored; archived categories were offered for selection; mobile
  destructive actions were not stacked; and line actions remained visually
  enabled during mutation. The review also recorded no finding for the XState
  lifecycle, deletion scope, receipt/manual-expense separation, or facade
  boundary. Remediation is in progress before this gate can close.
- **Closure review finding record:** The first closure pass confirmed those
  fixes and found three remaining issues: the custom E2E fixture ignored the
  spec viewport; repeated browser Back could leave history ahead of a dirty
  detail screen; and directly opened detail routes lacked an exit focus target.
  These are the active remediation items for this gate.
- **Final closure remediation record:** A subsequent fresh review found one
  remaining severity-2 edge case: final receipt deletion could focus a stale
  list heading before the asynchronous state refresh exposed the available Add
  expense action. Deletion now uses a dedicated Add expense focus target; the
  final fresh closure review is pending.

#### M27-005 — Prove the saved-receipt management journey

- **Status/dependencies:** `PENDING`; depends on closed `R-2720`.
- **Ownership:** `e2e/receipt-review.spec.ts`, `e2e/support/journeys.ts`,
  `e2e/support/fake-services.ts`,
  `src/adapters/local/receipt-atomic.integration.test.ts`,
  `IMPLEMENTATION_PLAN.md`.
- **Scope/non-goals:** Extend the existing critical receipt journey only far
  enough to prove save, reopen, line edit/delete, list projection, and
  whole-receipt deletion and its approved completion behavior across the
  browser-to-actor-to-adapter seams. Record a focused desktop/mobile/narrow
  review matrix. Do not duplicate domain transition combinations already covered
  below E2E or turn fake Drive into a claim about live Google Drive behavior.
- **Outputs/acceptance:** One bounded E2E journey proves that a saved receipt is
  manageable after leaving review and that committed deletion is reflected after
  reload in the fake synchronized path. Causal stale-replay versus
  concurrent-edit combinations remain in sync adapter integration tests rather
  than becoming a second E2E synchronization journey. Exact commands, counts,
  screenshots where needed, and any environment limitation are recorded in the
  ledger.
- **Tests:** Critical Playwright journey plus receipt-domain, actor, component,
  and local atomic regression suites selected by risk; full verification only if
  cross-cutting impact cannot be bounded or an unexpected broad failure requires
  it.
- **Verification:** `deno task test:affected`,
  `deno test src/domain/tests/receipt_test.ts src/actors/contracts/saved-receipt-actor.test.ts src/features/local-ui.test.tsx src/features/receipt-detail-ui.test.tsx src/adapters/local/receipt-atomic.integration.test.ts`,
  `deno task test:e2e -- e2e/receipt-review.spec.ts`, `deno task check`,
  `deno task lint`, `deno task fmt:check`, `git diff --check`.

#### R-2730 — M27 final implementation and journey review

- **Status/dependencies:** `PENDING`; depends on `M27-005`.
- **Reviewer role:** Fresh read-only subagent reviewer.
- **Audit scope:** Complete M27 diff since the released baseline, closure of
  prior findings, product-decision fidelity, aggregate deletion safety,
  accessibility and responsive evidence, regression risk, exact verification,
  and absence of source-image retention or unrelated feature drift.
- **Remediation loop:** The primary agent resolves every severity 1–3 finding,
  reruns only risk-selected validation unless a shared fix requires a broader
  gate, records final evidence and pushed commits, and requests closure before
  archive.

#### M27-FINAL — Milestone closure, ledger archiving, and repository pruning

- **Status/dependencies:** `PENDING`; depends on closed `R-2730`.
- **Ownership:** `IMPLEMENTATION_PLAN.md`, `SPEC.md`, `DESIGN_SYSTEM.md`, and
  transient M27-only documentation or verification artifacts, if any.
- **Scope/non-goals:** Prune this completed milestone into Released Baseline,
  preserve the last complete pre-pruning commit in Git history, execute
  `.agents/skills/repo-hygiene-pruning/SKILL.md`, remove obsolete M27-only
  artifacts and dangling Markdown references, and reset the active DAG. Do not
  delete durable product requirements, reusable tests, or implementation.
- **Outputs/acceptance:** A compact live ledger with M27 release behavior and
  exact evidence preserved; no stale active status, code-mirroring notes,
  temporary scripts, or broken Markdown references remain.
- **Tests:** Documentation/reference inspection plus environment-scoped
  formatting, check, and lint; no duplicate browser journey solely for archive.
- **Verification:** `deno task check`, `deno task fmt:check`, `deno task lint`,
  `rg -n '\\[[^]]+\\]\\([^)]*\\.md' --glob '*.md'`, `git diff --check`.
- **Commit:** Use an `[archive]` commit message and push it to `origin/master`.

## Current Checkpoint

- **Active task / gate:** `R-2720` (`IN_PROGRESS`; R-2710 is closed)
- **Pushed implementation baseline:** `6737367`; M27-004 is complete and the
  fresh actor/UI/accessibility review is the current gate.
- **Verification status:** R-2710 closure evidence is `deno task check`, focused
  receipt/domain/local/import-export suites (36 passed, 0 failed), formatting,
  lint, and `git diff --check`; the pre-remediation M27-002 affected suite
  remains 306 passed, 0 failed.
- **Active / preserved work:** Single primary agent on `master`; no M27 worker
  or worktree. The M27-002 implementation and review checkpoint are being
  preserved on the primary branch.
- **Exact next action:** Remediate the recorded R-2720 severity-2/3 findings,
  rerun the implicated actor/component/browser checks, and obtain fresh review
  closure before opening M27-005.

## Ready-to-Use Orchestration Prompt

```text
Act as the single primary coding agent for M27. Read AGENTS.md, SPEC.md,
DESIGN_SYSTEM.md, and IMPLEMENTATION_PLAN.md; run the recovery checklist and
confirm master/upstream state. Do not implement until the owner explicitly
authorizes M27 and approves the M27-001 product decisions. Then mark only the
current dependency-ready task IN_PROGRESS, execute tasks sequentially, record
exact verification and pushed commits after each task, use fresh read-only
reviewers only at R-2710/R-2720/R-2730, remediate severity 1–3 findings before
advancing, and finish with M27-FINAL archive and repository pruning.
```
