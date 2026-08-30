# Implementation Plan and Orchestration Ledger

## Status and Authority

This is the single source of truth for implementation sequencing, ownership,
verification, review, and resumable progress.

Product behavior remains authoritative in `SPEC.md`; shared visual and
interaction rules remain authoritative in `DESIGN_SYSTEM.md`; agent conduct
remains authoritative in `AGENTS.md`. This plan orders that approved work and
must not silently reinterpret those documents.

### Status vocabulary

- `COMPLETE`: outputs exist, required tests and review passed, evidence is
  recorded, and the integrated commit is pushed.
- `READY`: every dependency is complete, but work has not begun.
- `PENDING`: a dependency is incomplete.
- `IN_PROGRESS`: exactly one integration owner is accountable for the task.
- `INTERRUPTED`: work may exist, but its previous agent/session is no longer
  reliably active; the checkpoint must identify recovery actions.
- `BLOCKED`: a concrete unresolved owner decision or failed prerequisite is
  recorded. Difficulty alone is not a blocker.

Task IDs and review-gate IDs are stable. Never renumber them after work begins.

## Released Baseline

M0 through M29 and all review gates through `R-2930` are complete. The
released application baseline includes the approved domain, XState actors,
adapter ports, local-first workflows, causal sync, responsive After Midnight
UI, the Mantine-backed design-system facade, accessibility, PWA behavior,
diagnostic taxonomy, receipt and organization safety, GitHub Pages delivery,
and the mobile/narrow viewport ergonomics described by `SPEC.md`,
`DESIGN_SYSTEM.md`, and `AGENTS.md`.

M29 specifically delivers:

- Receipt adjustment unlinking when review lines are deselected or removed,
  first-use redirection after project hydration, and in-form draft discard.
- Bounded diagnostics across import/export, Drive authorization/transport,
  and local IndexedDB boundaries, with stale Drive writes distinguished from
  upload failures.
- A discreet sync header indicator and reconnect path, contextual
  post-mutation local-save notices, fixed PWA install/update notices, quiet
  unsupported checks, and dirty-form reload protection.
- Category conflict feedback anchored to the name field, one-click persisted
  preference reset to `03:00`, and narrow-screen action rows with 44px
  controls and finger spacing.
- Release verification, responsive review, and hygiene review with no retained
  stale documents, spikes, redundant verification scripts, or dangling links.

The completed implementation and review history is preserved in Git at
pre-pruning ledger commit `84e7515`. That history is evidence, not active
instructions, and agents must not reconstruct the pruned M29 task ledger in
this live plan.

### M29 release evidence

The M29-FINAL release gate passed:

- `deno task check` passed TypeScript and repository script/E2E checks.
- `deno task lint` checked 200 files.
- `deno task fmt:check` checked 210 files.
- `git diff --check` passed.
- `deno task test:affected` selected no test modules because the code changes
  were already committed.
- The explicit release suite passed 71 tests with 0 failures:
  `deno test --allow-read --allow-write --allow-run --allow-env
  src/domain/tests/receipt_test.ts src/features/local-ui.test.tsx
  src/features/settings-pwa.test.tsx src/features/sync-ui/sync-ui.test.tsx`.
- The R-2920 closure review passed 88 focused UI/PWA tests and 5 Playwright
  journeys, with no horizontal overflow at 320x568, 390x844, or 1280x800.
- `deno task build` transformed 2,973 modules and generated the production
  manifest and service worker; the pre-archive artifact verified with version
  `0.1.0`, commit `84e7515`. After archiving, the artifact was rebuilt at
  `cb7a4de` and `deno task release:verify` passed with fresh hashes.
- The hygiene audit found no obsolete spikes, transient M29 documents,
  redundant verification scripts, inaccurate tasks, or dangling tracked
  Markdown links; no files required removal.

## Architecture and ownership baseline

The dependency boundaries remain:

```text
features/app -> src/design-system public contracts -> Mantine
                                                `-> small owned compositions
features/app -> actors -> domain + adapter ports
```

Files under `src/features/**` and `src/app/**` use only the repository
design-system facade. Mantine-specific implementation, provider mapping, and
library customization stay in `src/design-system/**`. Durable workflow and
form state remains in XState actors; product composites remain repository-owned
compositions. Domain code depends on narrow adapter ports, never browser or
library internals. Local mutations remain available when sync or network state
is unavailable.

## Definition of done

A release candidate must have focused tests for every implementation task,
appropriate actor/domain/adapter/component coverage, a clean working tree, and
the following repository checks as risk requires:

```text
deno task fmt:check
deno task lint
deno task check
deno task test
deno task build
deno task release:verify
deno audit --frozen
git diff --check
```

Critical browser seams are covered by the five approved E2E journeys in
`e2e/support/journeys.ts`, while domain and actor rules are not duplicated
across browser tests.

## Active dependency graph

```text
M0..M29 implementation and R-2930 review (COMPLETE)
   |
   v
M30-001 -> M30-002 -> R-3010 -> M30-FINAL
```

## M30 — Receipt extraction line consolidation

### M30 authority, outcome, and non-goals

M30 adds a domain-owned post-extraction normalization pass so repeated,
confidently equivalent receipt lines are represented once in review. Quantity
and unit-price data are derived for consolidated purchase lines; repeated
bottle-deposit adjustments remain adjustments and are summed rather than being
changed into ordinary purchases.

Target dependency flow:

```text
provider extraction -> domain normalization -> receipt review actor -> review UI
```

**Non-goals:** making prompt-only deduplication the source of truth, changing
receipt sign semantics, changing persisted adjustment semantics, or adding a
second UI state layer. The provider contract may carry explicit quantity data,
but domain post-processing remains authoritative for duplicate lines.

### Mandatory single-agent execution rule

- One primary coding agent performs all planning reconciliation, edits, tests,
  fixes, commits, pushes, and checkpoint updates sequentially on `master`.
- Independent read-only reviewer subagents are used exclusively at named
  review gates.
- Context compaction or session restarts require following the recovery
  checklist before editing.

### Locked boundary / design-system rules

- Consolidation stays in `src/domain/receipt.ts`, after untrusted extraction
  values are validated and ledger signs are normalized.
- Explicit provider quantity/unit-price fields remain optional, strict,
  provider-neutral, and are accepted only for purchase lines.
- Only confident, selected lines with matching semantic identity and amount may
  consolidate.
- Purchase consolidation preserves the existing purchase quantity/unit-price
  contract; bottle-deposit charges remain adjustment lines.
- Existing receipt totals, mismatch detection, selection behavior, and durable
  actor contracts remain unchanged.
- No feature or app file imports a component library directly.

### Restart and compaction recovery checklist

- [ ] Read `AGENTS.md`, this milestone section, and Current Checkpoint.
- [ ] Run `git status --short --branch`, `git log -n 20 --oneline`,
      `git branch -vv`, `git worktree list --porcelain`, and check remote sync.
- [ ] Verify test and working tree state before continuing.

#### M30-001 — Normalize repeated extracted lines

- **Status/dependencies:** `COMPLETE`; depends on M29 and R-2930.
- **Ownership:** `src/domain/receipt.ts`, `src/domain/money/index.ts`,
  `src/domain/tests/receipt_test.ts`, `src/domain/tests/domain_test.ts`,
  `src/adapters/ports/receipt-ai.ts`, `src/adapters/gemini/schema.ts`.
- **Scope/non-goals:** Add a bounded post-extraction consolidation pass. Merge
  only selected, non-uncertain lines with matching normalized descriptions,
  categories, kinds, and amounts; retain the first stable identity and
  provenance fields. Set quantity and positive unit price for consolidated
  purchases and sum repeated bottle-deposit charge adjustments. Do not alter
  persisted schemas or manual edits; explicit provider quantity/unit-price
  fields are preserved for purchases.
- **Outputs/acceptance:** The two equivalent `PANT BURK` charges in the
  supplied Coop receipt become one `SEK -4` adjustment; equivalent purchases
  become one line with quantity and unit price; unsafe or non-equivalent lines
  remain distinct.
- **Tests:** Domain unit tests cover purchase consolidation, explicit quantity
  preservation, adjustment consolidation, charge/return separation,
  amount/description/category safety, and selection/uncertainty preservation.
- **Verification:** The focused domain command passed with 27 tests:
  `deno test --allow-read --allow-write --allow-run --allow-env
  src/domain/tests/domain_test.ts src/domain/tests/receipt_test.ts`.
  `deno task check` and `git diff --check` passed. A prior bare related-test
  attempt selected the full graph without the repository permission flags and
  reported 21 environment/permission failures; the permissioned affected
  command passed below.

#### M30-002 — Reconcile adapter and review integration

- **Status/dependencies:** `COMPLETE`; depends on M30-001.
- **Ownership:** `src/adapters/gemini/adapter.ts`,
  `src/adapters/gemini/schema.ts`, `src/adapters/gemini/adapter.test.ts`,
  `src/adapters/ports/receipt-ai.ts`, `src/actors/contracts/receipt-actor.test.ts`,
  `src/features/receipt-ui.test.tsx`, `IMPLEMENTATION_PLAN.md`.
- **Scope/non-goals:** Carry optional explicit quantity/unit-price data through
  the provider-neutral extraction contract and verify the existing review
  components render consolidated quantity/unit-price data. Do not move
  durable workflow state into the adapter or UI.
- **Outputs/acceptance:** Adapter extraction returns provider-neutral quantity
  data; the actor receives normalized lines without duplicate cards; the review
  card renders `quantity × unit price`.
- **Tests:** Focused adapter and receipt review tests, plus the affected test
  selection command.
- **Verification:** The complete focused M30 command passed with 69 tests:
  `deno test --allow-read --allow-write --allow-run --allow-env
  src/domain/tests/domain_test.ts src/domain/tests/receipt_test.ts
  src/adapters/gemini/adapter.test.ts
  src/actors/contracts/receipt-actor.test.ts
  src/features/receipt-ui.test.tsx`. The permissioned affected command
  `deno test --allow-read --allow-write --allow-run --allow-env --changed
  --quiet` passed with 341 tests; `deno task check` and `git diff --check`
  passed.

#### R-3010 — Receipt consolidation review gate

- **Status/dependencies:** `COMPLETE`; depends on M30-002.
- **Reviewer role:** Fresh read-only reviewer subagent.
- **Audit scope:** Diff since R-2930, domain safety rules, test evidence,
  provider-boundary preservation, receipt totals, and compliance with
  `AGENTS.md`, `SPEC.md`, and `DESIGN_SYSTEM.md`.
- **Remediation loop:** The primary agent fixes all severity 1–3 findings in
  bounded remediation commits, reruns affected validation, and records the
  resolution here before closure.
- **Review evidence:** The initial review found and the primary agent fixed
  negative PANT direction normalization, explicit quantity/unit-price
  transport, actor/UI coverage, and stale prompt exclusions. Follow-up found
  and the primary agent fixed quantity-only unit-price derivation, restored
  provider kind-specific validation, and the remaining stale plan statements.
  The final fresh read-only reviewer re-check approved the milestone with no
  remaining severity 1–3 findings.

#### M30-FINAL — Milestone closure and ledger archiving

- **Status/dependencies:** `IN_PROGRESS`; depends on R-3010.
- **Ownership:** `IMPLEMENTATION_PLAN.md`.
- **Scope/non-goals:** Record final exact verification and pushed commit,
  prune the completed M30 task history into Released Baseline, and run the
  repository-hygiene pruning procedure. No application behavior changes.
- **Outputs/acceptance:** Compact live plan with M30 release evidence and a
  clean synchronized repository. Any archival commit must include `[archive]`.
- **Tests:** `deno task check`, `deno task fmt:check`, `deno task lint`, and
  `git diff --check` during plan pruning, plus the release checks required by
  the final review gate.
- **Verification:** Exact commands and results recorded in this ledger.

## R-2930 — Final M29 Review and Release Gate

- **Status:** `COMPLETE`; the implementation, release validation, responsive
  review, and archive are complete.
- **Reviewer:** Fresh read-only reviewer subagent.
- **Scope:** Verify M29 history, release evidence, compact plan archive,
  hygiene results, and compliance with `SPEC.md`, `DESIGN_SYSTEM.md`, and
  `AGENTS.md`.
- **Remediation:** Initial review found stale release-artifact provenance because
  the ignored `dist` directory had been built before the archive commit. The
  primary implementer rebuilt at archive head `cb7a4de` and reran
  `deno task release:verify`, which passed. Any further finding must be fixed
  in a bounded commit, rerun only the affected checks, and update this checkpoint
  before completion.
- **Output:** Fresh read-only review approved M29 and permits the next milestone
  plan.
- **Review evidence:** `master`, upstream, and `origin/master` were synchronized;
  artifact provenance verified at `f4ccb85`; typecheck, 200-file lint, 210-file
  format check, frozen audit, diff check, facade boundary checks (2 passed), and
  Markdown hygiene (12 tracked documents, 6 local links, 0 missing targets) all
  passed. The reviewer found no findings and preserved all historical worktrees.

## Interruption and recovery protocol

After a restart, rate limit, lost session, or interrupted command:

1. Read `AGENTS.md`, `SPEC.md`, `DESIGN_SYSTEM.md`, this plan, and the
   current checkpoint.
2. Audit `master`, its upstream, every branch and worktree, uncommitted
   changes, unpushed commits, and any stale `IN_PROGRESS` ownership:
   `git status --short --branch`, `git log -n 20 --oneline`,
   `git branch -vv`, and `git worktree list --porcelain`.
3. Reconcile recorded evidence with the repository and rerun only the next
   dependency-ready validation. Preserve all work; never infer completion from
   a checklist or commit alone.

## Current Checkpoint

- **Active task / gate:** `M30-FINAL` (`IN_PROGRESS`).
- **Repository:** `master` remains at the clean synchronized baseline
  `601257d`; the M30 implementation and plan updates are currently in the
  working tree pending the integration commit and push.
- **M29 implementation:** complete and pushed; R-2910, R-2920, and R-2930
  approved.
- **M29-FINAL:** complete; release and hygiene evidence is recorded above.
- **R-2930 closure evidence:** Fresh read-only review approved with no findings.
  It verified the archive-head release artifact, repository checks, frozen audit,
  facade boundary, Markdown links, compact plan, and preservation of unrelated
  historical worktrees.
- **M30 checkpoint:** Requirements and implementation authorization were
  approved in the product-owner request. Domain blast-radius inspection found
  the existing quantity fields and review rendering are reusable.
- **M30 implementation evidence:** M30-001 and M30-002 are complete in the
  working tree. The post-extraction normalizer consolidates selected,
  confident equal lines, derives quantity/unit price for repeated purchases,
  and sums repeated bottle-deposit adjustments without changing persisted
  schemas. The provider-neutral port and Gemini schema now carry optional
  purchase-only quantity/unit-price fields.
- **R-3010 closure evidence:** Fresh read-only re-check approved with no
  remaining severity 1–3 findings. Focused validation passed 69 tests and the
  permissioned affected graph passed 341 tests; full format and lint checks
  passed.
- **Next action:** Commit and push the implementation, then run the required
  hygiene/archive closeout and record the final synchronized checkpoint.

## Ready-to-use orchestration prompt

```text
Act as the integration owner for M30. Read AGENTS.md, SPEC.md,
DESIGN_SYSTEM.md, and IMPLEMENTATION_PLAN.md. Reconcile master/upstream and
worktree state, complete M30-001 and M30-002 sequentially, use a fresh
read-only reviewer at R-3010, record exact evidence, and close the milestone
with the required [archive] ledger update without disturbing unrelated
worktrees.
```
