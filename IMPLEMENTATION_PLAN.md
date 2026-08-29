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

M0 through M17 and all review gates through `R-1710` are `COMPLETE`. The
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
`PANT BURK` charges, keeping Coop receipt totals reconciled. The correction is
covered by focused domain/adapter tests and the affected suite.

Detailed task, review, validation, worktree, deployment, and recovery history is
preserved in Git at commit `d7c6a22`, the last complete pre-pruning ledger. That
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

## M23 — Add Choice Bottom Sheet & Modal Header UI/UX Remediation

### M23 authority, outcome, and non-goals

Remediate visual, responsive, and ergonomic defects in the Add Choice Sheet
(`AddChoiceScreen`) and modal header actions across Desktop (`1280×800`), Mobile
(`390×844`), and Narrow (`320×568`) viewports.

Specifically:
1. Simplify Add Choice actions from verbose, multi-line `ActionCard` descriptions
   into clean, prominent full-width action buttons with clear leading icons
   (`Plus` for "Add manually", `Search` for "Scan receipt with AI").
2. Fix modal/drawer/sheet header alignment on mobile: prevent generic
   `.ds-page-header__actions > button { width: 100% }` from forcing `IconButton`
   close triggers (`X`) to wrap below titles onto a centered line; pin the close
   icon button to the top-right inline with the title.
3. Ensure `.local-ui-overlay` covers the bottom navigation cleanly on mobile with
   `z-index: var(--layer-overlay)` (40), top rounded corners, backdrop blur, and
   proper bottom safe-area insets.

**Non-goals:**
- No changes to underlying business logic, state machines, or domain data
  contracts.
- No changes to offline scan guard behavior.
- No changes to manual expense form fields or validation.

### Mandatory single-agent execution rule

- One primary coding agent performs all planning reconciliation, edits, tests,
  fixes, commits, pushes, and checkpoint updates sequentially on `master`.
- Independent read-only reviewer subagents are used exclusively at named review
  gates.
- Context compaction or session restarts require following the recovery
  checklist before editing.

### Locked boundary / design-system rules

1. Files under `src/features/**` import only the design-system facade.
2. Semantic After Midnight tokens remain the visual source of truth.
3. All interactive touch targets must remain at least 44px.
4. Transitions remain `0ms` by default.
5. All checklist steps are executed sequentially with fast pre-commit gates,
   committed, and pushed to remote.

### Restart and compaction recovery checklist

- [ ] Read `AGENTS.md`, this milestone section, and Current Checkpoint.
- [ ] Run `git status --short --branch`, `git log -n 20 --oneline`,
      `git branch -vv`, `git worktree list --porcelain`, and check remote sync.
- [ ] Verify test and working tree clean state before continuing.

### Dependency Graph (DAG)

```text
M23-001 (Design system token & header action pinning)
   │
   ▼
M23-002 (AddChoiceScreen component & stylesheet remediation)
   │
   ▼
M23-003 (Visual re-capture & comprehensive multi-viewport verification)
   │
   ▼
R-2310 (Consolidated milestone review gate)
   │
   ▼
M23-FINAL (Milestone closure, ledger archiving, and repo hygiene pruning)
```

---

### M23 Task Definitions

#### M23-001 — Design system token & modal header action pinning

- **Status/dependencies:** `COMPLETE`; depends on baseline.
- **Ownership:** `src/design-system/tokens.css`, `src/design-system/styles.css`
- **Scope/non-goals:** Update mobile `.ds-page-header__actions` rules in
  `tokens.css` to exempt `.ds-icon-button` from `width: 100%` full-width
  stretching and ensure header actions containing only icon buttons preserve
  compact inline width. Ensure `.ds-button .mantine-Button-label` provides
  balanced inline alignment for leading icons and text.
- **Outputs/acceptance:** `.ds-icon-button` retains its standard touch size
  (`var(--control-height)`) and does not stretch or wrap across header rows on
  mobile viewports.
- **Tests:** 118 related component and design system tests pass.
- **Verification:** `deno fmt src/design-system/tokens.css`,
  `deno task test:affected`, `git diff --check`.

#### M23-002 — AddChoiceScreen component & stylesheet remediation

- **Status/dependencies:** `COMPLETE`; depends on `M23-001`.
- **Ownership:** `src/features/local-ui.tsx`, `src/features/local-ui.css`
- **Scope/non-goals:** Refactor `AddChoiceScreen` to replace verbose `ActionCard`
  elements with clean, prominent, full-width `Button` primitives (`variant="primary"`
  for "Add manually" with `Plus` icon, and `variant="secondary"` for "Scan receipt with AI"
  with `Search` icon). Add dedicated header styling to `.local-ui-add-choice` to
  guarantee single-row title and close button alignment. Ensure bottom sheet
  overlay sits at `z-index: var(--layer-overlay)` with safe-area padding at the
  bottom.
- **Outputs/acceptance:** Clean, unbloated Add Choice bottom sheet across
  Desktop, Mobile, and Narrow viewports. Close button pinned to top-right.
  Prominent full-width action buttons with clear icons.
- **Tests:** 19 related `local-ui.test.tsx` tests pass (including offline guard,
  focus trap, and keyboard navigation tests).
- **Verification:** `deno fmt src/features/local-ui.tsx src/features/local-ui.css`,
  `deno lint src/features/local-ui.tsx`, `deno task test:affected`,
  `git diff --check`.

#### M23-003 — Visual re-capture & comprehensive multi-viewport verification

- **Status/dependencies:** `READY`; depends on `M23-002`.
- **Ownership:** `scripts/audit-capture.ts`, `e2e/audit/ui-audit-capture.spec.ts`
- **Scope/non-goals:** Run full visual capture across Desktop (`1280×800`), Mobile
  (`390×844`), and Narrow (`320×568`) viewports into `ui-audit-round-2/screenshots`.
  Inspect `04-add-choice-sheet` and all modal/dialog screens to confirm visual
  fidelity. Run affected unit, component, a11y, build, and E2E suites.
- **Outputs/acceptance:** All 3 capture viewports pass with clean visual
  evidence. All test suites pass.
- **Tests:** `deno task test:affected`, `deno task a11y:gallery`, `deno task build`,
  `deno task test:e2e`.
- **Verification:** `deno task audit:capture ui-audit-round-2/screenshots`.

#### R-2310 — Consolidated milestone review gate

- **Status/dependencies:** `PENDING`; depends on `M23-003`.
- **Reviewer role:** Fresh read-only subagent reviewer.
- **Audit scope:** Diffs across M23-001 through M23-003, token usage, facade
  boundary, multi-viewport screenshot matrix, and test evidence.
- **Remediation loop:** Primary agent fixes all severity 1–3 findings before
  closing the milestone.

#### M23-FINAL — Milestone closure, ledger archiving, and repo hygiene pruning

- **Status/dependencies:** `PENDING`; depends on `R-2310`.
- **Ownership:** `IMPLEMENTATION_PLAN.md`, `DESIGN_SYSTEM.md`, `SPEC.md`
- **Scope/non-goals:** Prune completed M23 task details into the Released
  Baseline; record the preserved Git commit hash. Clean up transient audit
  directories and run `repo-hygiene-pruning` skill to verify repository hygiene.
- **Outputs/acceptance:** Clean, compact `IMPLEMENTATION_PLAN.md` with updated
  Released Baseline; zero dead markdown links; clean working tree.
- **Commit:** Committed with `[archive]` in the commit message per `AGENTS.md`.

---

## Current Checkpoint

- **Active task / gate:** `M23-003` (`READY`)
- **Pushed commit / HEAD:** `73f17ef`
- **Verification status:** M23-002 component and styles refactored; all 19 local-ui tests pass.
- **Active / preserved work:** Single primary agent on `master`.
- **Exact next action:** Execute `M23-003` (Visual re-capture & comprehensive multi-viewport verification).

## Ready-to-Use Orchestration Prompt

```text
Read AGENTS.md, DESIGN_SYSTEM.md, and IMPLEMENTATION_PLAN.md. Proceed sequentially
with M23-001 on master, run fast pre-commit verification, commit, push, and update
the checkpoint ledger.
```
