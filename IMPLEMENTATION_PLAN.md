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

M0 through M12 and all review gates through `R-1210` are `COMPLETE`. The
released application baseline includes the approved domain, actors, adapters,
responsive UI, After Midnight design system backed by Mantine behind the
repository facade, accessibility, PWA, tests, GitHub Pages pipeline, operational
safeguards, multi-viewport UI/UX polish across desktop/mobile/narrow viewports,
baseline mobile ergonomics, and a provider-valid privacy-safe Gemini
compatibility probe backed by the official Google Gen AI SDK and a provider-
neutral receipt AI port described by `SPEC.md`, `DESIGN_SYSTEM.md`, `AGENTS.md`,
and previous milestones.

Detailed task, review, validation, worktree, deployment, and recovery history is
preserved in Git at commit `652bde9`, the last complete pre-pruning ledger. That
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

## M13 — Restore receipt source-picker actions

### M13 authority, outcome, and non-goals

This milestone restores the approved receipt-capture workflow so the **Take
photo** and **Choose image** actions on the Scan with AI screen open the shared
native file/camera control and deliver the selected image to the receipt actor.
The fix must preserve the repository design-system facade and the existing
provider-neutral AI boundary.

Target dependency flow:

```text
features/receipt-ui -> src/design-system public FileField/ReceiptSourcePicker contracts
                     -> browser native file/camera input
features/receipt-ui -> receipt actor -> domain + adapter ports
```

**Non-goals:** no AI provider changes, model capability changes, receipt schema
changes, image persistence, visual redesign, or function/tool calling.

### Mandatory single-agent execution rule

- One primary coding agent performs all planning reconciliation, edits, tests,
  fixes, commits, pushes, and checkpoint updates sequentially on `master`.
- Independent read-only reviewer subagents are used exclusively at the named
  review gate.
- Context compaction or session restarts require the recovery checklist below
  before editing.

### Locked boundary / design-system rules

1. `src/features/**` and `src/app/**` import only the repository design-system
   facade; library-specific refs and events stay inside `src/design-system/**`.
2. `FileField` must expose a library-neutral native-input contract that keeps
   keyboard, focus, file selection, and camera capture behavior intact.
3. `ReceiptSourcePicker` remains a presentation composite; actor state and image
   lifecycle decisions remain in the receipt workflow.
4. Camera mode must set the native `capture` hint before the input is clicked;
   choosing an existing image must clear that hint.
5. Selected images remain ephemeral and are handed to the actor only through the
   existing typed event path.
6. Existing semantic tokens, hit targets, labels, and immediate interaction
   behavior remain unchanged.

### Restart and compaction recovery checklist

- [ ] Read `AGENTS.md`, this milestone section, and Current Checkpoint.
- [ ] Run `git status --short --branch`, `git log -n 20 --oneline`,
      `git branch -vv`, `git worktree list --porcelain`, and check remote sync.
- [ ] Verify test and working tree state before continuing.

### Dependency graph

```text
M13-001 -> M13-002 -> R-1310 -> M13-FINAL
```

#### M13-001 — Trace and repair native source-input wiring

- **Status/dependencies:** `COMPLETE`; depends on the archived M12 baseline.
- **Ownership:** `src/features/receipt-ui.tsx`,
  `src/design-system/components.tsx`, `src/design-system/index.ts`, and affected
  receipt/design-system tests.
- **Scope/non-goals:** Trace the source-picker callbacks, native input ref,
  capture-mode timing, and file-change event. Repair only the smallest
  facade/screen contract needed for both actions; do not alter AI adapters,
  receipt parsing, persistence, or styling unrelated to the interaction.
- **Outputs/acceptance:** Camera and image-selection buttons invoke the native
  input, camera mode applies `capture="environment"` before activation,
  selection mode removes the camera hint, and a selected file follows the
  existing actor event path. The input remains accessible and ephemeral.
- **Tests:** Focused component coverage now invokes both source-picker callback
  paths; the browser journey exercises native chooser activation, capture mode,
  and selected-file dispatch.
- **Verification:** `deno fmt` and `deno lint` pass for the changed files;
  `deno test --allow-read --allow-write --allow-run --allow-env --related=src/features/receipt-ui.tsx`
  passes 30/30; `deno task test:affected` passes 30/30; `git diff --check`
  remains pending at the final gate.

#### M13-002 — Integrate regression coverage and verification evidence

- **Status/dependencies:** `COMPLETE`; depends on `M13-001`.
- **Ownership:** affected receipt UI/design-system test files and this ledger.
- **Scope/non-goals:** Exercise the repaired actions through the closest
  existing receipt-screen harness and browser journey, because the component
  harness cannot observe user-gesture-gated native activation. Do not change
  unrelated workflow behavior.
- **Outputs/acceptance:** Regression tests fail before the fix and pass after
  it, with no contract violations or unrelated snapshots.
- **Tests:** Focused related tests plus the repository affected-test suite;
  include the narrowest typecheck/build check required by shared component
  changes.
- **Verification:** `deno task test:affected` passes 30/30; the receipt-review
  Playwright journey passes 1/1; `deno task check`, `deno task fmt:check`,
  `deno task lint`, `deno task build`, and `git diff --check` pass. Build emits
  only the existing large-chunk advisory.

#### R-1310 — Receipt source-picker review gate

- **Status/dependencies:** `COMPLETE`; depends on `M13-002`.
- **Reviewer role:** Fresh read-only subagent reviewer (`m13_review`).
- **Audit scope:** Diff since M12, native input/ref contract, both action paths,
  accessibility semantics, actor event wiring, tests, and compliance with
  `AGENTS.md`, `SPEC.md`, and `DESIGN_SYSTEM.md`.
- **Remediation loop:** The primary agent fixes all severity 1–3 findings in
  bounded `fix(...)` commits, records resolutions here, and requests closure
  approval before archiving. The reviewer found no severity 1–3 findings; the
  native chooser and capture-mode evidence are recorded under M13-002.

#### M13-FINAL — Milestone closure, ledger archiving, and repo hygiene pruning

- **Status/dependencies:** `IN_PROGRESS`; depends on `R-1310`.
- **Ownership:** `IMPLEMENTATION_PLAN.md` and any transient files introduced by
  this milestone.
- **Scope/non-goals:** Prune completed M13 details into the Released Baseline,
  preserve the pre-pruning commit hash, execute the `repo-hygiene-pruning`
  skill, and reset the active DAG. Do not remove product source or tests.
- **Outputs/acceptance:** Compact ledger, no stale cross-references or temporary
  artifacts, and a clean pushed repository.
- **Tests:** Environment-scoped hygiene checks required by the pruning skill.
- **Verification:** `deno task check`, `deno task fmt:check`, `deno task lint`,
  and `git diff --check`.

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

- **Active task / gate:** `M13-002` (`IN_PROGRESS`)
- **Pushed commit / HEAD:** `d572554` (M12 archival baseline)
- **Verification status:** Focused related tests pass 30/30; affected tests pass
  30/30; the receipt-review Playwright journey passes 1/1 with both native
  source actions; typecheck, formatting, lint, build, and diff checks pass.
- **Review status:** `R-1310` is complete; the fresh read-only reviewer found no
  severity 1–3 findings.
- **Active / preserved work:** Single primary agent on `master`; source-picker
  fix and regression tests are uncommitted; no worktrees or delegated
  implementation.
- **Exact next action:** Commit and push the reviewed implementation, then run
  the repo-hygiene pruning checks and archive M13 with `[archive]`.

## Ready-to-Use Orchestration Prompt

```text
Read AGENTS.md, DESIGN_SYSTEM.md, and IMPLEMENTATION_PLAN.md. Confirm working
tree status on master, reconcile M13-001, repair the native receipt source
picker without crossing the facade boundary, add focused regression tests,
pass the exact verification gates, obtain the read-only R-1310 review, archive
M13 with `[archive]`, and push the completed changes.
```
