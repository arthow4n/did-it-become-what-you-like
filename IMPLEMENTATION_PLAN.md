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
provider, and normalization boundaries; cleanup cannot mask the primary
failure. Receipt reconciliation also aligns printed totals with the signed
direction of selected lines while preserving positive adjustment-only inflows.
Gemini receipt extraction instructions explicitly encode these signed amount
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
bounded JSON, schema, response, and mapping operation identifiers.

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

## M22 — Receipt deposit-charge direction correction

### M22 authority, outcome, and non-goals

Correct receipt reconciliation when a model mistakes a positive bottle-deposit
charge (for example, Swedish `PANT BURK 2,00`) for a refund. The provider prompt
will distinguish charges from explicit returns, and the domain boundary will
apply the same narrow, deterministic correction before ledger signs and totals
are computed. This milestone does not change the provider-neutral port, add
tool calling, infer arbitrary model output, or alter ordinary purchase,
discount, or refund behavior.

Target dependency flow:

```text
features/app -> actors -> domain + adapter ports
                          `-> Gemini prompt guidance
```

### Mandatory single-agent execution rule

- One primary coding agent performs all planning reconciliation, edits, tests,
  fixes, commits, pushes, and checkpoint updates sequentially on `master`.
- Independent read-only reviewer subagents are used exclusively at the named
  review gate.
- Context compaction or session restarts require following the recovery
  checklist before editing.

### Locked boundary / design-system rules

1. Receipt amounts remain canonical decimal strings and all arithmetic continues
   to use the arbitrary-precision money helpers.
2. Product rows remain ledger outflows; explicit returns/refunds remain inflows.
3. A positive `PANT BURK`/bottle-deposit charge is an adjustment outflow; only
   explicit return/refund evidence or a printed negative amount is an inflow.
4. The provider boundary remains provider-neutral and structured-output only.
5. Existing rationale and uncertainty fields remain reviewable and bounded.
6. No feature or design-system UI imports or visual behavior change in M22.

### Restart and compaction recovery checklist

- [ ] Read `AGENTS.md`, this milestone section, and Current Checkpoint.
- [ ] Run `git status --short --branch`, `git log -n 20 --oneline`,
      `git branch -vv`, `git worktree list --porcelain`, and check remote sync.
- [ ] Verify test and working tree clean state before continuing.

### Dependency graph

```text
M22-001 -> M22-002 -> R-2210 -> M22-FINAL
```

#### M22-001 — Encode bottle-deposit charge semantics at the provider boundary

- **Status/dependencies:** `COMPLETE`; depends on M21.
- **Ownership:** `src/adapters/gemini/adapter.ts`, `src/domain/receipt.ts`,
  `SPEC.md`, `src/adapters/gemini/adapter.test.ts`.
- **Scope/non-goals:** Clarify Gemini instructions for positive bottle-deposit
  charges versus explicit returns/refunds. Add a narrow domain correction when
  an otherwise valid adjustment named `PANT BURK` is incorrectly marked as an
  inflow despite a non-negative printed amount, and replace its rationale with
  the corrected receipt evidence. Do not reinterpret generic adjustments or
  override an explicit return/refund/negative deposit.
- **Outputs/acceptance:** The photographed Coop receipt's two `PANT BURK`
  rows normalize to `-2` each and reconcile with the `-325.78` printed total;
  genuine refund/return adjustments retain positive signs.
- **Tests:** Domain unit tests for the correction and its exclusions; adapter
  prompt regression assertion.
- **Verification:** `deno fmt <changed>`, `deno lint <changed>`,
  `deno test --related=src/domain/receipt.ts`,
  `deno test --related=src/adapters/gemini/adapter.ts`, `git diff --check`.

#### M22-002 — Run affected receipt regression validation

- **Status/dependencies:** `COMPLETE`; depends on M22-001.
- **Ownership:** Test and verification outputs only; no production ownership.
- **Scope/non-goals:** Run the focused and affected suites and inspect the
  resulting reconciliation behavior. Do not broaden the milestone into UI
  redesign or provider migration.
- **Outputs/acceptance:** Focused domain/adapter tests and the repository's
  affected test selection pass with no new failures.
- **Tests:** `deno task test:affected` plus the focused commands from M22-001.
- **Verification:** `deno task fmt:check`, `deno task lint`, `deno task check`,
  `deno task test:affected`, `git diff --check`.

#### R-2210 — Fresh read-only receipt-sign review

- **Status/dependencies:** `READY`; depends on M22-002.
- **Reviewer role:** Fresh read-only subagent reviewer.
- **Audit scope:** Review the M22 diff, prompt/domain contract, correction
  exclusions, tests, and compliance with `AGENTS.md` and `SPEC.md`.
- **Remediation loop:** The primary agent fixes all severity 1–3 findings in
  bounded remediation commits and requests closure before archiving.

#### M22-FINAL — Milestone closure, ledger archiving, and repo hygiene pruning

- **Status/dependencies:** `PENDING`; depends on R-2210.
- **Ownership:** `IMPLEMENTATION_PLAN.md`, `SPEC.md`, and any M22 code/tests.
- **Scope/non-goals:** Record the pushed implementation and review evidence in
  Released Baseline, prune this detailed milestone, run the required
  `repo-hygiene-pruning` skill, and reset the active DAG. Do not delete product
  specifications or unrelated historical records.
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

- **Active task / gate:** `R-2210` (`READY`)
- **Pushed commit / HEAD:** `f820729` (M21 implementation; M22 changes are
  uncommitted and must be committed after validation)
- **Verification status:** M22-001 focused domain tests pass 8/8 and focused
  adapter tests pass 17/17; format, lint, and type checks pass. M21 focused
  adapter/actor/UI tests pass 77/77 and
  affected tests pass 279/279; check, format, lint, diff checks, build, and
  receipt-review Playwright pass. Fresh R-2100 review found no severity 1–3
  findings. M22 focused tests pass 8/8 domain and 17/17 adapter; affected
  tests pass 288/288; format, lint, and type checks pass.
  M19 focused actor/UI tests pass 20/20 and affected
  tests pass 128/128; check, format, lint, build, diff checks, and receipt-review
  Playwright pass 1/1. Fresh R-1900 review found no severity 1–3 findings.
  M18 affected tests pass 337/337, focused domain/client tests pass 8/8, and
  its final review found no severity 1–3 findings.
- **Active / preserved work:** Single primary agent on `master`; no worktree or
  delegated implementation worker; review artifacts remain outside the repo.
- **Exact next action:** Commit and push M22 implementation, then request the
  R-2210 read-only review.

## Ready-to-Use Orchestration Prompt

```text
Read AGENTS.md, DESIGN_SYSTEM.md, and IMPLEMENTATION_PLAN.md. Confirm working
tree status on master, author the next milestone plan per
.agents/skills/implementation-planning/SKILL.md, obtain approval, and proceed
with implementation.
```
