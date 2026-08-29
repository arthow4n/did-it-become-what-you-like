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

M0 through M23 and all review gates through `R-2310` are `COMPLETE`. The
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
cleanly overlays bottom navigation with `z-index: var(--layer-overlay)` (40), top
rounded corners, and safe-area insets.

Detailed task, review, validation, worktree, deployment, and recovery history is
preserved in Git at commit `de0793f`, the last complete pre-pruning ledger. That
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

## M24 — Full-Span Choice Buttons & Organize All-Categories Hub Remediation

### M24 authority, outcome, and non-goals

Remediate two confirmed UI/UX defects:
1. **Full-Span Choice Buttons:** Ensure choice buttons on `AddChoiceScreen`
   ("Add manually" and "Scan receipt with AI") stretch to 100% full span across
   the bottom sheet / modal card rather than shrinking to fit-content width, by
   enforcing `align="stretch"` in design-system `Stack` and `width: 100%; display: flex;`
   on `data-full-width="true"` buttons and overlay actions.
2. **Organize Hub Complete Category & Project Display:** In `OrganizeScreen`,
   remove the hardcoded `.slice(0, 3)` limitation so that all active categories
   (e.g., 4 custom categories plus Uncategorized = 5 total) and all active
   projects are fully displayed in the Organize Hub.

**Non-goals:**
- No changes to underlying business logic, state machines, or domain data
  contracts.
- No changes to category deletion, reassignment, or project switching rules.

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
M24-001 (Design system Stack stretch & fullWidth button expansion)
   │
   ▼
M24-002 (AddChoiceScreen full-span CSS & OrganizeScreen all-categories fix)
   │
   ▼
M24-003 (Visual re-capture & comprehensive multi-viewport verification)
   │
   ▼
R-2410 (Consolidated milestone review gate)
   │
   ▼
M24-FINAL (Milestone closure, ledger archiving, and repo hygiene pruning)
```

---

### M24 Task Definitions

#### M24-001 — Design system Stack stretch & fullWidth button expansion

- **Status/dependencies:** `COMPLETE`; depends on baseline.
- **Ownership:** `src/design-system/components.tsx`, `src/design-system/tokens.css`
- **Scope/non-goals:** Set `align="stretch"` on `MantineStack` inside `Stack`
  component and configure `.ds-stack` with `align-items: stretch; width: 100%;`.
  Ensure `.ds-button[data-full-width="true"]` has `width: 100%; display: flex;`.
- **Outputs/acceptance:** Stacks stretch their full-width children by default
  unless overridden. Buttons with `fullWidth` fill their parent container width.
- **Tests:** 118 affected design system and component tests pass.
- **Verification:** `deno fmt src/design-system/components.tsx src/design-system/tokens.css`,
  `deno lint src/design-system/components.tsx`, `deno task test:affected`,
  `git diff --check`.

#### M24-002 — AddChoiceScreen full-span CSS & OrganizeScreen all-categories fix

- **Status/dependencies:** `READY`; depends on `M24-001`.
- **Ownership:** `src/features/local-ui.tsx`, `src/features/local-ui.css`, `src/features/local-ui.test.tsx`
- **Scope/non-goals:** In `local-ui.css`, ensure `.local-ui-add-choice__actions`
  and `.local-ui-add-choice__button` have explicit `width: 100%; display: flex;`.
  In `local-ui.tsx`, remove the arbitrary `.slice(0, 3)` limit in `OrganizeScreen`
  for both `projects` and `categories`. Add component tests verifying that all 5
  categories render in the Organize Hub.
- **Outputs/acceptance:** Add choice action buttons stretch to full container
  width. Organize Hub displays all active categories and projects without
  truncation.
- **Tests:** `deno test --related=src/features/local-ui.tsx` passes with new
  all-categories test assertions.
- **Verification:** `deno fmt src/features/local-ui.tsx src/features/local-ui.css src/features/local-ui.test.tsx`,
  `deno lint src/features/local-ui.tsx src/features/local-ui.test.tsx`,
  `deno task test:affected`, `git diff --check`.

#### M24-003 — Visual re-capture & comprehensive multi-viewport verification

- **Status/dependencies:** `PENDING`; depends on `M24-002`.
- **Ownership:** `scripts/audit-capture.ts`, `e2e/audit/ui-audit-capture.spec.ts`
- **Scope/non-goals:** Run full visual capture across Desktop (`1280×800`), Mobile
  (`390×844`), and Narrow (`320×568`) viewports. Inspect `04-add-choice-sheet`
  and `11-organize-hub` to confirm full button span and complete category list.
  Run affected unit, component, a11y, build, and E2E suites.
- **Outputs/acceptance:** All 3 capture viewports pass with clean visual
  evidence. All test suites pass.
- **Tests:** `deno task test:affected`, `deno task a11y:gallery`, `deno task build`,
  `deno task test:e2e`.
- **Verification:** `deno task audit:capture ui-audit-round-3/screenshots`.

#### R-2410 — Consolidated milestone review gate

- **Status/dependencies:** `PENDING`; depends on `M24-003`.
- **Reviewer role:** Fresh read-only subagent reviewer.
- **Audit scope:** Diffs across M24-001 through M24-003, token usage, facade
  boundary, multi-viewport screenshot matrix, and test evidence.
- **Remediation loop:** Primary agent fixes all severity 1–3 findings before
  closing the milestone.

#### M24-FINAL — Milestone closure, ledger archiving, and repo hygiene pruning

- **Status/dependencies:** `PENDING`; depends on `R-2410`.
- **Ownership:** `IMPLEMENTATION_PLAN.md`, `DESIGN_SYSTEM.md`, `SPEC.md`
- **Scope/non-goals:** Prune completed M24 task details into the Released
  Baseline; record the preserved Git commit hash. Clean up transient audit
  directories and run `repo-hygiene-pruning` skill to verify repository hygiene.
- **Outputs/acceptance:** Clean, compact `IMPLEMENTATION_PLAN.md` with updated
  Released Baseline; zero dead markdown links; clean working tree.
- **Commit:** Committed with `[archive]` in the commit message per `AGENTS.md`.

---

## Current Checkpoint

- **Active task / gate:** `M24-002` (`READY`)
- **Pushed commit / HEAD:** `0fa3115`
- **Verification status:** M24-001 design system Stack stretch and full-width button styles pass 118 component tests.
- **Active / preserved work:** Single primary agent on `master`.
- **Exact next action:** Execute `M24-002` (AddChoiceScreen full-span CSS & OrganizeScreen all-categories fix).

## Ready-to-Use Orchestration Prompt

```text
Read AGENTS.md, DESIGN_SYSTEM.md, and IMPLEMENTATION_PLAN.md. Proceed sequentially
with M24-001 on master, run fast pre-commit verification, commit, push, and update
the checkpoint ledger.
```
