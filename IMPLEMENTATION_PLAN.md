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

## Current Checkpoint

- **Active task / gate:** None. M27 and R-2730 are complete; there is no active
  implementation or review work.
- **Released baseline:** M0 through M27 and all review gates through `R-2730`
  are complete and pushed on `master`; the M27 release evidence is recorded
  above.
- **Verification status:** The final M27 selected suites, complete configured
  E2E run, typecheck, lint, formatting, and diff checks all passed as recorded
  above. No M27 worker or worktree owns repository changes.
- **Recovery rule:** A future milestone must add its own dependency-ordered
  section and update this checkpoint before implementation begins. The prior
  M27 ledger remains recoverable from Git history.
