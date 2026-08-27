# Implementation Plan and Orchestration Ledger

## Status and Authority

This is the single source of truth for implementation sequencing, ownership,
verification, review, and resumable progress. It does not authorize
implementation. No application code, spike, dependency, or deployment task may
begin until the repository owner explicitly starts implementation in a later
session.

Product behavior remains authoritative in `SPEC.md`; screen behavior and
cross-cutting UI states remain authoritative in `UI_SPEC.md`; shared visual and
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

## Released Baseline

M0 through M8 and all review gates through `R-850` are `COMPLETE`. The released
application baseline includes the approved domain, actors, adapters, responsive
UI, After Midnight design system backed by Mantine behind the repository facade,
accessibility, PWA, tests, GitHub Pages pipeline, and operational safeguards
described by `SPEC.md`, `UI_SPEC.md`, `DESIGN_SYSTEM.md`, and `AGENTS.md`.

Detailed task, review, validation, worktree, deployment, and recovery history is
preserved in Git at commit `46eb5eb`, the last complete pre-pruning ledger. That
history is evidence, not active instructions, and agents must not reconstruct it
in this live plan.

The active dependency flow remains:

```text
features/app -> src/design-system public contracts -> Mantine
                                                `-> small owned compositions
features/app -> actors -> domain + adapter ports
```

## Definition of Done

The application is complete and releasable only when all of the following are
true:

1. Every planned task and review gate through the active milestone is
   `COMPLETE`; no required behavior is represented only by a TODO, mock in
   production, skipped test, or undocumented manual step.
2. `deno task verify` passes from a clean clone using the pinned Deno and
   lockfile state. Its test phase runs each discovered Deno test module once;
   the gate must not follow the umbrella test task by rerunning its overlapping
   component, integration, domain, or actor subsets. The approved E2E journeys
   also pass at the final gate.
3. The approved E2E journeys pass with deterministic fake external services.
   Lower-layer suites prove merge, retry, cancellation, migration, deletion, and
   validation detail without duplicating them in E2E.
4. `agent-browser` Chromium inspection covers the component gallery and every
   approved screen at `320x568`, `390x844`, and `1280x800` where relevant,
   including keyboard, accessibility tree, empty/loading/offline/error/conflict,
   large-value/long-label, and destructive states. Findings are fixed and
   rechecked; screenshots containing secrets or personal data are forbidden.
5. WCAG 2.2 AA requirements in the specifications pass automated and manual
   checks. Ordinary transitions remain `0ms`; functional progress remains
   understandable with reduced motion.
6. A production build works under the repository base path, hash-route refresh,
   repository-scoped service worker, offline relaunch, explicit update reload,
   and clean IndexedDB persistence across page reloads.

## Active Dependency Graph

```text
(No active milestone in progress. Awaiting next approved milestone.)
```

## Validation, Commit, and Push Policy

- For ordinary work, format and lint changed files, run
  `deno task test:affected`, add only the narrowest explicit check for relevant
  non-import effects, and run `git diff --check`. Use
  `deno test --related=<path>` when a known source file needs direct coverage.
- Deno graph selection cannot prove CSS, HTML, generated assets, build or
  deployment configuration, service-worker behavior, or external browser
  journeys. Add only the build, gallery, browser, schema, Pages, CI, or focused
  E2E check capable of detecting the changed behavior.
- Batch coherent UI gallery, accessibility, build, browser, and E2E checks at
  the next named review gate. Run an earlier targeted visual check only when
  waiting would be unsafe.
- `deno task verify` is reserved for final milestone release gates or a
  genuinely unbounded cross-cutting change. Never run it and then repeat its
  constituent or overlapping subset commands against the same commit.
- Reviewers may trust exact green evidence for the same commit and rerun only
  risk-selected checks. After fixes, rerun affected validation; repeat a full
  gate only for shared or cross-cutting changes.
- Inspect every diff for scope, secrets, and generated noise. Commit and push
  only coherent green work. Keep commits focused, never force-push, and update
  Current Checkpoint after each completed task or review/fix gate.

## Interruption and Recovery Protocol

Use the short path after ordinary context compaction when the same primary-agent
session continues, Git was known clean, no command, push, or reviewer was
interrupted, and no external state could have changed:

1. Re-read the active task and Current Checkpoint.
2. Run `git status --short --branch`.
3. Continue only if both still match recorded state.

Use the full path after a lost session, machine restart, failed or interrupted
command/push, reviewer disappearance, dirty or unexpected Git state, upstream
change, or any ownership/evidence uncertainty:

```text
git status --short --branch
git log --oneline --decorate -n 20
git branch -vv
git worktree list --porcelain
git rev-list --left-right --count origin/master...master
```

When network is available, run `git fetch --prune origin` and repeat the
upstream comparison. Inspect every discovered branch/worktree, staged and
unstaged diff, unintegrated commit, active process/reviewer, and recorded
validation. Preserve all work: never reset, discard, stash, overwrite, or
duplicate uncertain changes. Actual Git and test evidence wins over checklist
state. Update Current Checkpoint with reconciled HEAD/upstream, task, work,
evidence, and one exact next action before resuming edits.

Recovery is complete only when every discovered change is assigned exactly once,
no implementation agent is active concurrently, the ledger matches Git/test
evidence, and the next action is dependency-safe.

## Review and Fix Protocol

1. The primary agent implements one dependency-ready task with tests and
   risk-based validation, inspects the diff, commits, pushes, and records exact
   evidence.
2. At named review gates (`R-xxx`), one fresh read-only reviewer independently
   checks the completed batch. It reports `APPROVE` or `BLOCK`, severity,
   file/line evidence, commands/results, and minimal fixes.
3. Severity 1 risks data loss, security, privacy, or a core flow; severity 2
   violates an approved requirement or architecture/test contract; severity 3 is
   contained quality, accessibility, or maintainability; severity 4 is optional
   polish. Severity 1–3 findings must be fixed unless the owner explicitly
   accepts them.
4. The primary agent alone fixes findings and reruns affected checks. A fresh
   closure reviewer is required when the gate says so or when fixes materially
   changed what the original reviewer inspected. Downstream work remains
   `PENDING` until the gate is approved, committed, pushed, and recorded.

## Current Checkpoint

- **Plan state:** Baseline M0 through M8 and all review gates through `R-850`
  are `COMPLETE`.
- **Reconciled branch/upstream:** `master` is aligned with `origin/master`.
- **Owner authorization:** M8 Mantine migration is complete and closed. Awaiting
  next owner request or milestone proposal.
- **Worktree state:** Repository is clean with no unmerged worktrees.
- **Verification status:** Canonical verification is green at commit `46eb5eb`.
- **Active / interrupted work:** None. No implementation or review agent is
  assigned, no worktree is active, and working tree is clean.
- **Exact next action:** Await next user instruction or feature milestone
  planning.

Every checkpoint update records task status, HEAD/upstream and unpushed commits,
exact validation evidence, active or preserved work/reviewers, blockers or
recovery notes, and one exact next action.

## Ready-to-Use Orchestration Prompt

```text
Act as the single primary coding agent for the next authorized milestone. Read
AGENTS.md and this plan completely, then read the authoritative
specification/design documents and applicable skills named by the active task.
Reconcile Current Checkpoint using the short or full recovery path. Preserve all
unexpected work and trust repository evidence over checklist state.

Confirm explicit implementation authorization. If absent, stop. If present,
continue exactly one dependency-ready task using the execution, boundary,
validation, commit, and checkpoint policies. Never use an implementation
sub-agent, advisor, parallel task, or uncoordinated worktree. Use one fresh
read-only agent only at the named review gates; the primary agent alone fixes
findings.

Keep product behavior and facade contracts stable, keep XState authoritative,
run risk-selected tests/checks without duplicate gates, commit and push green
increments, and update Current Checkpoint after each task or gate. If a genuine
owner decision is required, preserve safe work, record the exact blocker and
recovery action, and ask one concise decision batch.
```
