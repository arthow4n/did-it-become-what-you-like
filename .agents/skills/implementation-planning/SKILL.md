---
name: implementation-planning
description: >-
  Standardized procedure for converting feature requests, technical epics, or
  UI/UX audit remediation into a dependency-ordered, contract-gated
  IMPLEMENTATION_PLAN.md milestone ledger, including lifecycle archiving.
---

# Implementation Plan Authoring & Milestone Lifecycle Workflow

This skill defines the standardized procedure for converting any approved
feature specification, architecture refactoring, technical epic, or UI/UX audit
remediation checklist into an executable, dependency-ordered milestone ledger in
`IMPLEMENTATION_PLAN.md`. It also specifies the mandatory lifecycle archiving
protocol for completed milestones.

---

## 1. Core Principles & Governance

1. **Single Source of Truth:** `IMPLEMENTATION_PLAN.md` is the sole living
   authority for implementation sequencing, task ownership, review gates, and
   resumable checkpoints. Never scatter live planning across multiple files.
2. **Authority & Authorization:** Writing or updating the implementation plan
   does **not** imply implementation authorization. Per `AGENTS.md`, no
   application code, dependency, or spike work may begin until the repository
   owner explicitly approves starting implementation.
3. **Strict Status Vocabulary:** Every task and review gate uses only these
   stable states:
   - `COMPLETE`: outputs exist, required tests/reviews passed, evidence
     recorded, and integrated commit is pushed.
   - `READY`: all prerequisites and preceding review gates are complete; ready
     to begin.
   - `PENDING`: one or more prerequisites or preceding gates are incomplete.
   - `IN_PROGRESS`: exactly one integration owner is actively working on the
     task.
   - `INTERRUPTED`: work exists but session was interrupted; resumable state
     recorded in Current Checkpoint.
   - `BLOCKED`: concrete unresolved blocker or owner decision recorded.
4. **Single Primary Implementer:** Implementation within a milestone is strictly
   sequential on `master` by a single primary coding agent. Parallel workers and
   worktrees are prohibited unless explicitly isolated and coordinated by the
   plan.
5. **Independent Read-Only Review Gates:** Review gates between task batches are
   evaluated by fresh, read-only reviewer subagents who audit diffs and tests
   without modifying code.

---

## 2. Milestone Plan Structure & Anatomy

When adding or converting a task into an `IMPLEMENTATION_PLAN.md` milestone,
structure the milestone using the canonical sections below:

### A. Milestone Header & Authority Boundary

````markdown
## M<N> — <Milestone Title>

### M<N> authority, outcome, and non-goals

<Clear statement of what this milestone achieves, the library/technology
approved, and the target architectural dependency flow.>

Target dependency flow:

```text
features/app -> src/design-system public contracts -> Mantine
                                                `-> small owned compositions
features/app -> actors -> domain + adapter ports
```
````

**Non-goals:** <Explicit list of features, refactors, state changes, or UI
themes that are strictly out of scope.>

### Mandatory single-agent execution rule

- One primary coding agent performs all planning reconciliation, edits, tests,
  fixes, commits, pushes, and checkpoint updates sequentially on `master`.
- Independent read-only reviewer subagents are used exclusively at named review
  gates.
- Context compaction or session restarts require following the recovery
  checklist before editing.

### Locked boundary / design-system rules

<List of 5–10 locked acceptance rules, e.g. facade boundaries, token fidelity,
XState durability, transition 0ms constraints, zero business-rule drift.>

### Restart and compaction recovery checklist

- [ ] Read `AGENTS.md`, this milestone section, and Current Checkpoint.
- [ ] Run `git status --short --branch`, `git log -n 20 --oneline`,
      `git branch -vv`, `git worktree list --porcelain`, and check remote sync.
- [ ] Verify test and working tree clean state before continuing.

`````
---

### B. Dependency Graph (DAG)

Organize tasks into small 2–3 task batches followed by an independent review gate:

```text
M<N>-001 -> M<N>-002 -> R-<N>10
                           |
M<N>-003 -> M<N>-004 -> R-<N>20
                           |
M<N>-005 -> M<N>-006 -> R-<N>30
```

> [!TIP]
> **UI/UX Audit Batched Review Exception:** When planning a UI/UX or visual audit
> remediation milestone, consolidate review gates into a **single comprehensive
> milestone review gate at the end** (e.g. `M<N>-001 -> ... -> M<N>-005 -> R-<N>10 -> M<N>-FINAL`).
> Interconnected CSS, layout, and component adjustments are best audited holistically
> against the complete multi-viewport screenshot matrix in one pass, avoiding
> unnecessary subagent latency at intermediate steps.`

---

### C. Standardized Task Definition Schema

Every task must use this invariant 6-part contract block:

```markdown
#### M<N>-<XXX> — <Descriptive Task Title>

- **Status/dependencies:** `PENDING` / `READY` / `IN_PROGRESS` / `COMPLETE`;
  depends on `...`.
- **Ownership:** `<exact file and directory globs touched>` (e.g.
  `src/design-system/components.tsx`, `src/features/local-ui.css`).
- **Scope/non-goals:**
  <Precise description of code changes. Explicitly state non-goals and what must NOT be changed.>
- **Outputs/acceptance:** <Concrete deliverables, public API contracts, token
  usage, accessibility requirements.>
- **Tests:** <Pure unit, actor, component, or adapter tests required to prove
  correctness.>
- **Verification:** `<exact fast commands>`, e.g.: `deno fmt <changed>`,
  `deno lint <changed>`, `deno task test:affected`, `git diff --check`.
```

---

### D. Review Gate Schema (`R-xxx`)

Every review checkpoint must specify:

```markdown
#### R-<N>XX — <Batch Review Gate Title>

- **Status/dependencies:** `PENDING` / `READY` / `COMPLETE`; depends on
  `M<N>-XXX`.
- **Reviewer role:** Fresh read-only subagent reviewer (e.g., `Confucius`,
  `Darwin`).
- **Audit scope:** Diffs since preceding gate, contract boundaries, test suite
  results, visual inspection, and compliance with `AGENTS.md` and
  `DESIGN_SYSTEM.md`.
- **Remediation loop:** Primary agent fixes all severity 1–3 findings in bounded
  remediation commits (`fix(...): ...`), logs resolutions in the ledger, and
  requests closure approval before opening the next batch.
```

---

### E. Current Checkpoint Ledger & Orchestration Prompt

The plan concludes with a live checkpoint block updated after every completed or
interrupted task:

````markdown
## Current Checkpoint

- **Active task / gate:** `M<N>-XXX` (`STATUS`)
- **Pushed commit / HEAD:** `<commit-hash>`
- **Verification status:** Exact command outputs and passing test counts.
- **Active / preserved work:** Notes on active workers or clean branch status.
- **Exact next action:** Single next step to execute upon resumption.

## Ready-to-Use Orchestration Prompt

```text
Act as the single primary coding agent for M<N>...
```
`````

````
---

## 3. Mandatory Milestone Step: Lifecycle Archiving & Pruning

### Why Archiving is Required
As milestones are executed, `IMPLEMENTATION_PLAN.md` accumulates extensive task
specifications, reviewer logs, and remediation records. Once a milestone is
fully completed, verified, and approved:
- The live implementation plan must be **pruned** to remain lean, fast to read,
  and free of stale checklist ambiguity.
- The detailed historical records remain permanently queryable in Git history.

### The Archival Task in the Plan
**Every milestone plan must include a final task / step for lifecycle archiving.**
For example:
```markdown
#### M<N>-FINAL — Milestone closure and ledger archiving

- **Status/dependencies:** `PENDING`; depends on final review gate `R-<N>XX`.
- **Ownership:** `IMPLEMENTATION_PLAN.md`.
- **Scope/non-goals:** Prune completed milestone task details into the Released
  Baseline; record the preserved Git commit hash; reset active DAG for upcoming work.
- **Outputs/acceptance:** Clean, compact `IMPLEMENTATION_PLAN.md` preserving all
  essential sections.
- **Commit:** Committed with `[archive]` in the commit message per `AGENTS.md`.
````

### How to Structure the Archived Baseline

When executing the archival step, preserve these essential core sections:

1. **Title & Status/Authority:** Top governance and status vocabulary remain
   intact.
2. **Released Baseline:** Update this section to summarize all completed
   milestones:
   ```markdown
   ## Released Baseline

   M0 through M<N> and all review gates through `R-<N>XX` are `COMPLETE`. The
   released application baseline includes the approved domain, actors, adapters,
   responsive UI, design system, accessibility, PWA, tests, and operational
   safeguards described by `SPEC.md`, `UI_SPEC.md`, `DESIGN_SYSTEM.md`, and
   `AGENTS.md`.

   Detailed task, review, validation, worktree, deployment, and recovery history is
   preserved in Git at commit `<PRE_PRUNING_COMMIT_HASH>`, the last complete
   pre-pruning ledger. That history is evidence, not active instructions, and
   agents must not reconstruct it in this live plan.
   ```
3. **Architecture & Ownership Baseline:** Preserved directory boundaries and
   port rules.
4. **Definition of Done:** Preserved full DoD verification commands.
5. **Active Dependency Graph:** Cleared or initialized for the next planned
   milestone.
6. **Current Checkpoint:** Clean checkpoint noting that all milestones through
   `M<N>` are complete and the repository is clean at
   `<PRE_PRUNING_COMMIT_HASH>`.

### Commit Message Requirement

Per `AGENTS.md`, any document deletion or planning ledger archiving must include
`[archive]` in the commit message:

```bash
git commit -am "docs(plan): [archive] prune completed M<N> implementation history" && git push origin master
```

---

## 4. Step-by-Step Conversion Procedure

When converting a feature request, technical epic, or UI/UX audit report into an
implementation plan:

1. **Analyze Requirements & Blast Radius:** Ingest the spec diffs or audit
   findings. Identify affected files, components, and contract boundaries.
2. **Define Milestone Envelope:** Draft outcome, explicit non-goals, and
   boundary rules.
3. **Decompose into Workstream Batches:** Group items into pairs or 3-task
   batches with natural integration boundaries.
4. **Add Staged Review Gates:** Place an `R-xxx` gate after each batch requiring
   a fresh read-only subagent review.
5. **Author 6-Part Task Specs:** Fill out Status, Ownership, Scope/non-goals,
   Outputs, Tests, and Verification for each task.
6. **Add Milestone Archival Step:** Include the final `M<N>-FINAL` archiving
   task.
7. **Write to `IMPLEMENTATION_PLAN.md`:** Replace or append to the ledger
   without scattering plans across other files.
8. **Checkpoint & Wait for Authorization:** Set initial checkpoint to `READY` on
   the first task, present the plan summary to the user, and wait for explicit
   owner authorization before writing application code.
