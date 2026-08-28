# Implementation Plan and Orchestration Ledger

## Status and Authority

This is the single source of truth for implementation sequencing, ownership,
verification, review, and resumable progress.

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

### Released Baseline

M0 through M9 and all review gates through `R-910` are `COMPLETE`. The released
application baseline includes the approved domain, actors, adapters, responsive
UI, After Midnight design system backed by Mantine behind the repository facade,
accessibility, PWA, tests, GitHub Pages pipeline, operational safeguards, and
the baseline mobile ergonomics described by `SPEC.md`, `DESIGN_SYSTEM.md`,
`AGENTS.md`, and previous milestones.

Detailed task, review, validation, worktree, deployment, and recovery history is
preserved in Git at commit `7b39023`, the last complete pre-pruning ledger. That
history is evidence, not active instructions, and agents must not reconstruct it
in this live plan.

The active dependency flow remains:

```text
features/app -> src/design-system public contracts -> Mantine
                                                `-> small owned compositions
features/app -> actors -> domain + adapter ports
```

---

## M10 — UI/UX Audit Remediation & Multi-Viewport Polish

### M10 authority, outcome, and non-goals

This milestone remediates all critical and major visual, typographic, dialog,
and responsive ergonomics defects discovered during the multi-viewport visual
audit across Desktop (`1280×800`), Mobile (`390×844`), and Narrow (`320×568`).

Target dependency flow:

```text
features/app -> src/design-system public contracts -> Mantine
                                                `-> small owned compositions
features/app -> actors -> domain + adapter ports
```

**Non-goals:** No changes to underlying Automerge data models, XState workflow
machines, Drive sync protocols, or Gemini schema extraction contracts.

### Mandatory single-agent execution rule

- One primary coding agent performs all planning reconciliation, edits, tests,
  fixes, commits, pushes, and checkpoint updates sequentially on `master`.
- Independent read-only reviewer subagents are used exclusively at named review
  gates.
- Context compaction or session restarts require following the recovery
  checklist before editing.

### Locked boundary / design-system rules

1. Design-system facade boundary remains strictly enforced: `src/features/**`
   and `src/app/**` import only from `src/design-system`.
2. After Midnight semantic tokens in `tokens.css` remain the sole visual source
   of truth.
3. Ordinary transitions remain `0ms`.
4. Multi-viewport verification across Desktop (`1280×800`), Mobile (`390×844`),
   and Narrow (`320×568`) is required.

### Restart and compaction recovery checklist

- [ ] Read `AGENTS.md`, this milestone section, and Current Checkpoint.
- [ ] Run `git status --short --branch`, `git log -n 20 --oneline`,
      `git branch -vv`, `git worktree list --porcelain`, and check remote sync.
- [ ] Verify test and working tree clean state before continuing.

---

### Dependency Graph (DAG)

```text
M10-001 -> M10-002 -> M10-003 -> M10-004 -> M10-005 -> M10-006 -> R-1010 -> M10-FINAL
```

---

### M10 Task Specs

#### M10-001 — Resilient project & category card secondary actions layout (FIX-01)

- **Status/dependencies:** `COMPLETE`; depends on baseline.
- **Ownership:** `src/features/local-ui.css`, `src/features/local-ui.tsx`,
  `src/features/local-ui.test.tsx`
- **Scope/non-goals:** Update `.local-ui-card-actions--grid` so that secondary
  action buttons wrap cleanly with dynamic minmax/flex wrap, preventing label
  truncation (`Move down` -> `Move dowr`, `Delete empty` -> `elete emp1`) on
  mobile (`390px`) and narrow (`320px`) viewports. Non-goals: Do not change card
  data bindings or actor actions.
- **Outputs/acceptance:** Project and category card action buttons never
  truncate, squash, or clip labels across all viewports.
- **Tests:** `src/features/local-ui.test.tsx` (19 passing tests)
- **Verification:** `deno fmt src/features/local-ui.css`,
  `deno test src/features/local-ui.test.tsx`, `git diff --check`.

#### M10-002 — Word-wrapping & text overflow discipline in lists & breakdowns (FIX-02)

- **Status/dependencies:** `READY`; depends on `M10-001`.
- **Ownership:** `src/design-system/tokens.css`, `src/design-system/components.tsx`,
  `src/design-system/design-system.test.tsx`
- **Scope/non-goals:** In `tokens.css`, replace `overflow-wrap: anywhere` with
  `overflow-wrap: break-word; word-break: normal;` on `.ds-list-row__main`,
  `.ds-list-row__main > .ds-button .mantine-Button-label`, and
  `.ds-list-row__main > *`. Non-goals: Do not alter money number nowrap formatting.
- **Outputs/acceptance:** Category names such as `Uncategorized` render on a
  single line or break only at whitespace boundaries without mid-word character breaks.
- **Tests:** `src/design-system/design-system.test.tsx`
- **Verification:** `deno fmt src/design-system/tokens.css src/design-system/components.tsx`,
  `deno lint src/design-system/components.tsx`,
  `deno test --allow-read --allow-write --allow-run --allow-env --related=src/design-system/components.tsx`,
  `git diff --check`.

#### M10-003 — FilterSheet dialog action footer (FIX-03)

- **Status/dependencies:** `PENDING`; depends on `M10-002`.
- **Ownership:** `src/design-system/components.tsx`, `src/features/local-ui.tsx`,
  `src/design-system/design-system.test.tsx`, `src/features/local-ui.test.tsx`
- **Scope/non-goals:** Add an explicit dialog action footer to `FilterSheet` with
  primary `[ Apply filters ]` (or `[ Done ]`) and quiet `[ Reset filters ]`
  buttons for accessible dialog closing and filter application.
- **Outputs/acceptance:** Filters dialog renders clear, accessible bottom action
  buttons across mobile and desktop viewports.
- **Tests:** `src/design-system/design-system.test.tsx`,
  `src/features/local-ui.test.tsx`
- **Verification:** `deno fmt src/design-system/components.tsx src/features/local-ui.tsx`,
  `deno lint src/design-system/components.tsx src/features/local-ui.tsx`,
  `deno test --allow-read --allow-write --allow-run --allow-env --related=src/design-system/components.tsx`,
  `git diff --check`.

#### M10-004 — Standardized PageHeader leading navigation affordances (FIX-04)

- **Status/dependencies:** `PENDING`; depends on `M10-003`.
- **Ownership:** `src/features/receipt-ui.tsx`, `src/features/settings-pwa.tsx`,
  `src/features/receipt-ui.test.tsx`, `src/features/settings-pwa.test.tsx`
- **Scope/non-goals:** Replace unstyled text back/close triggers on receipt and
  settings subpages with accessible `IconButton` or styled navigation buttons
  providing minimum 44px hit targets.
- **Outputs/acceptance:** All header back/close controls use consistent icon
  affordances and spacing from `<h1>`.
- **Tests:** `src/features/receipt-ui.test.tsx`,
  `src/features/settings-pwa.test.tsx`
- **Verification:** `deno fmt src/features/receipt-ui.tsx src/features/settings-pwa.tsx`,
  `deno lint src/features/receipt-ui.tsx src/features/settings-pwa.tsx`,
  `deno test --allow-read --allow-write --allow-run --allow-env --related=src/features/receipt-ui.tsx`,
  `git diff --check`.

#### M10-005 — Period picker resiliency & modal scrim polish (FIX-05)

- **Status/dependencies:** `PENDING`; depends on `M10-004`.
- **Ownership:** `src/features/local-ui.css`, `src/design-system/tokens.css`
- **Scope/non-goals:** Ensure segmented control period picker tabs on 320px
  screens scroll smoothly without clipping (`overflow-x: auto; scrollbar-width: none;`).
  Enhance `.local-ui-overlay` with backdrop scrim opacity `rgb(0 0 0 / 75%)` and
  `backdrop-filter: blur(4px)`.
- **Outputs/acceptance:** No segmented tab clipping on 320px viewports; modals
  have clean backdrop scrim separation.
- **Tests:** `src/features/local-ui.test.tsx`
- **Verification:** `deno fmt src/features/local-ui.css src/design-system/tokens.css`,
  `deno task test:affected`, `git diff --check`.

#### M10-006 — Visual re-capture, regression testing & multi-viewport proof (FIX-06)

- **Status/dependencies:** `PENDING`; depends on `M10-005`.
- **Ownership:** `e2e/ui-audit-capture.spec.ts`
- **Scope/non-goals:** Update gallery navigation path in
  `e2e/ui-audit-capture.spec.ts`. Re-run visual capture script across Desktop,
  Mobile, and Narrow viewports. Confirm all visual defects are resolved.
- **Outputs/acceptance:** 102 refreshed screenshots in
  `ui-audit-2026-08-28/round-1-screenshots/` showing zero visual defects.
- **Tests:** `deno task test:e2e --grep "Visual capture"`, `deno task a11y:gallery`,
  `deno task build`.
- **Verification:** `deno task test:e2e --grep "Visual capture"`,
  `deno task a11y:gallery`, `deno task build`.

---

#### R-1010 — Comprehensive M10 Milestone Review Gate

- **Status/dependencies:** `PENDING`; depends on `M10-006`.
- **Reviewer role:** Fresh read-only subagent reviewer (`research` or `self`).
- **Audit scope:** Diffs across `M10-001` through `M10-006`, design-system
  boundary compliance, multi-viewport screenshot verification across all 10
  journeys, passing test suites, and compliance with `AGENTS.md` and `DESIGN_SYSTEM.md`.
- **Remediation loop:** Primary agent fixes all severity 1–3 findings in bounded
  remediation commits (`fix(...): ...`), logs resolutions in the ledger, and
  requests closure approval before opening `M10-FINAL`.

---

#### M10-FINAL — Milestone closure and ledger archiving

- **Status/dependencies:** `PENDING`; depends on final review gate `R-1010`.
- **Ownership:** `IMPLEMENTATION_PLAN.md`, `UI_UX_AUDIT_REPORT_2026_08_28.md`
- **Scope/non-goals:** Prune completed milestone task details into the Released
  Baseline; record the preserved Git commit hash; archive (remove from working tree)
  transient audit report `UI_UX_AUDIT_REPORT_2026_08_28.md` and local screenshot
  directories; reset active DAG for upcoming work.
- **Outputs/acceptance:** Clean, compact `IMPLEMENTATION_PLAN.md` preserving all
  essential sections; workspace freed of transient audit documents.
- **Commit:** Committed with `[archive]` in the commit message per `AGENTS.md`.

---

## Current Checkpoint

- **Active task / gate:** `M10-002` (`READY`)
- **Pushed commit / HEAD:** In progress (`M10-001` completed)
- **Verification status:** `M10-001` passed (`deno fmt`, `deno test src/features/local-ui.test.tsx` 19/19 passed, `git diff --check`).
- **Active / preserved work:** Working tree on `master`.
- **Exact next action:** Implement `M10-002` (Word-wrapping & text overflow discipline in lists & breakdowns).

## Ready-to-Use Orchestration Prompt

```text
Act as the single primary coding agent for M10. Implement M10-001 through M10-006, run R-1010 review gate, and perform M10-FINAL archiving per AGENTS.md.
```
