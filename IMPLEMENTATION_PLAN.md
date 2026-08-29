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

M0 through M24 and all review gates through `R-2410` are `COMPLETE`. The
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
prematurely.

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

## M25 — Receipt image lifecycle cleanup

### M25 authority, outcome, and non-goals

Ensure an ephemeral receipt image is never removed while the scan actor can
still resolve it. Closing the scan, replacing an image, discard navigation, and
component teardown must cancel active invocations before clearing the in-memory
store. A remounted scan starts with no stale image or failure context. This
milestone does not persist receipt images, change Gemini extraction semantics,
or redesign the receipt UI.

Target dependency flow:

```text
features/app -> receipt actor lifecycle -> ephemeral image store
```

### Mandatory single-agent execution rule

- One primary coding agent performs all planning reconciliation, edits, tests,
  fixes, commits, pushes, and checkpoint updates sequentially on `master`.
- Independent read-only reviewer subagents are used exclusively at the named
  review gate.
- Context compaction or session restarts require following the recovery
  checklist before editing.

### Locked boundary / design-system rules

1. Image bytes and object URLs remain memory-only and are released on terminal
   cleanup.
2. Active scan invokes are canceled before their image refs are removed.
3. Retry retains only the current in-session source; remounts never restore it.
4. The scan actor remains the authority for cancellation and finite workflow
   state; UI code must not invent a parallel scan state machine.
5. Provider-neutral ports and typed `receipt.image.resolve` diagnostics remain
   unchanged.
6. No visual tokens, layout, or navigation styling changes in M25.

### Restart and compaction recovery checklist

- [ ] Read `AGENTS.md`, this milestone section, and Current Checkpoint.
- [ ] Run `git status --short --branch`, `git log -n 20 --oneline`,
      `git branch -vv`, `git worktree list --porcelain`, and check remote sync.
- [ ] Verify test and working tree clean state before continuing.

### Dependency graph

```text
M25-001 -> M25-002 -> R-2510 -> M25-FINAL
```

#### M25-001 — Make scan teardown cancellation-safe

- **Status/dependencies:** `READY`; depends on M24.
- **Ownership:** `src/features/receipt-ui.tsx`,
  `src/actors/contracts/receipt.ts`.
- **Scope/non-goals:** Cancel the receipt scan actor before the parent close
  path clears the image store, and centralize the screen's terminal cleanup so
  close, discard, and unmount cannot race an image resolver. Preserve existing
  replacement/retry behavior and do not persist image refs.
- **Outputs/acceptance:** Closing or discarding during preparing/requesting/
  validating cannot surface `receipt.image.resolve not-found`; a new scan after
  remount starts cleanly.
- **Tests:** Actor cancellation/teardown tests and a receipt scan screen test
  for close/discard ordering.
- **Verification:** `deno fmt <changed>`, `deno lint <changed>`,
  `deno test --related=src/features/receipt-ui.tsx`,
  `deno test --related=src/actors/contracts/receipt.ts`, `git diff --check`.

#### M25-002 — Cover stale-reference regressions

- **Status/dependencies:** `PENDING`; depends on M25-001.
- **Ownership:** `src/features/receipt-ui.test.tsx`,
  `src/actors/contracts/receipt-actor.test.ts`.
- **Scope/non-goals:** Exercise the exact failed-scan, choose-another-image,
  retry, discard, and remount sequences. Do not add browser-only timing hacks or
  broaden error taxonomy.
- **Outputs/acceptance:** Tests prove old refs are not resolved after cleanup,
  replacement uses the new ref, and retry only works with a retained source.
- **Tests:** Focused actor/UI suites and the repository affected selection.
- **Verification:** `deno task test:affected`, `deno task fmt:check`,
  `deno task lint`, `deno task check`, `git diff --check`.

#### R-2510 — Fresh read-only image lifecycle review

- **Status/dependencies:** `PENDING`; depends on M25-002.
- **Reviewer role:** Fresh read-only subagent reviewer.
- **Audit scope:** Review cancellation ordering, cleanup idempotence, remount
  behavior, stale-ref tests, and compliance with `AGENTS.md` and
  `DESIGN_SYSTEM.md`.
- **Remediation loop:** The primary agent fixes all severity 1–3 findings in
  bounded remediation commits and requests closure before archiving.

#### M25-FINAL — Milestone closure, ledger archiving, and repo hygiene pruning

- **Status/dependencies:** `PENDING`; depends on R-2510.
- **Ownership:** `IMPLEMENTATION_PLAN.md` and M25 code/tests.
- **Scope/non-goals:** Record the pushed implementation and review evidence in
  Released Baseline, prune this detailed milestone, run the required
  `repo-hygiene-pruning` skill, and reset the active DAG. Do not remove living
  product specifications or unrelated historical records.
- **Outputs/acceptance:** Compact plan, clean workspace, no dangling markdown
  links, and archive commit marked `[archive]`.
- **Tests:** Plan-pruning environment checks only after implementation tests
  have passed.
- **Verification:** `deno task check`, `deno task fmt:check`, `deno task lint`,
  `git diff --check`.

### Locked boundary / design-system rules

1. Design-system facade boundary remains strictly enforced: `src/features/**`
   and `src/app/**` import only from `src/design-system`.
2. After Midnight semantic tokens in `tokens.css` remain the sole visual source
   of truth.
3. Ordinary transitions remain `0ms`.
4. Multi-viewport verification across Desktop (`1280×800`), Mobile (`390×844`),
   and Narrow (`320×568`) is required.

---

## Current Checkpoint

- **Active task / gate:** `M25-001` (`IN_PROGRESS`)
- **Pushed commit / HEAD:** `776e42a` (M24 implementation, review, and plan
  archive; M25 changes are uncommitted)
- **Verification status:** M24 full button span and complete Organize hub
  categories display verified across desktop (`1280×800`), mobile (`390×844`),
  and narrow (`320×568`) viewports in `ui-audit-round-3/screenshots`. 118
  design-system/component tests pass; 20 `local-ui.test.tsx` tests pass; gallery
  a11y checks pass 3/3; production build succeeds; full Playwright E2E suite
  passes 9/9. Independent review `R-2410` approved with zero findings. M25
  investigation is pending implementation.
- **Active / preserved work:** Single primary agent on `master`; no worktree or
  delegated implementation worker; review artifacts remain outside the repo.
- **Exact next action:** Reconcile the image teardown path, then implement and
  test cancellation-safe cleanup.

## Ready-to-Use Orchestration Prompt

```text
Read AGENTS.md, DESIGN_SYSTEM.md, and IMPLEMENTATION_PLAN.md. Confirm working
tree status on master, author the next milestone plan per
.agents/skills/implementation-planning/SKILL.md, obtain approval, and proceed
with implementation.
```
