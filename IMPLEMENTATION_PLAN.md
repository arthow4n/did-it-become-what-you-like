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
rules, exclude non-line totals, and require an arithmetic self-check.

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

### M18 — Raw receipt signs and classification rationale

**Outcome:** Receipt providers transcribe numeric amounts with the sign shown
on the receipt. The provider-neutral boundary also returns a bounded rationale
and an explicit economic direction for each line. Domain normalization remains
the single place that converts those raw values into the app's signed ledger
convention, so a provider swap (for example, Gemini to OpenRouter) does not
duplicate sign logic. Reviewers can see why a line's category and direction
were inferred without exposing provider transport details.

**Contract decisions:**

- `amount` in `ReceiptExtractionDraft` and Gemini JSON is the canonical numeric
  transcription as printed, including a printed minus sign when present.
- `direction` is `outflow` or `inflow`; purchases must be outflows, while
  credits such as discounts/refunds are inflows and fees/surcharges are
  outflows.
- `rationale` is required, concise, and bounded per line. It explains the
  category and direction evidence; it is distinct from `uncertainty`, which
  still controls whether a line starts selected.
- The domain applies absolute-value sign normalization from `direction`, then
  recomputes receipt totals and mismatch fields as before.

| Task | Status | Dependency | Acceptance / evidence |
| --- | --- | --- | --- |
| M18-001 Update provider-neutral and Gemini structured contracts for raw amounts, direction, and rationale | COMPLETE | — | `ReceiptExtractionDraft` and Gemini `receipt.v2` require raw line direction/rationale; mapping remains provider-neutral; prompt and adapter fixtures assert the new contract |
| M18-002 Normalize deterministic ledger signs and persist/display bounded rationale | COMPLETE | M18-001 | Domain applies absolute-value signs by direction, fails closed on missing/contradictory metadata, persists a bounded `classificationReason`, and the review line card displays it; domain and UI tests cover the path |
| M18-003 Verification and review gate R-1800 | IN_PROGRESS | M18-001, M18-002 | Affected tests, formatter/lint/check/build, receipt review journey, diff check, fresh read-only review; archive plan and push |

The integration owner is the primary agent on `master`; no worktree split is
needed because the contract and domain/UI changes are intentionally sequenced.

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

- **Active task / gate:** M18-003 / R-1800 verification and review
- **Pushed commit / HEAD:** `69f0780` (M17 implementation and review-complete
  archived ledger); M18 changes remain uncommitted on `master` until R-1800
  closes.
- **Verification status:** M18 affected tests pass 337/337, focused domain/client
  tests pass 8/8, receipt-review Playwright passes 1/1, and check, format, lint,
  build, and diff checks pass. Fresh R-1800 review found only two S3 issues;
  both were fixed by requiring classification rationale at normalization and
  aligning its 500-character bound.
- **Active / preserved work:** Single primary agent on `master`; no worktree or
  delegated implementation worker; review artifacts remain outside the repo.
- **Exact next action:** Run final hygiene audit, commit the focused M18 change
  with the archived plan, and push `master`.

## Ready-to-Use Orchestration Prompt

```text
Read AGENTS.md, DESIGN_SYSTEM.md, and IMPLEMENTATION_PLAN.md. Confirm working
tree status on master, author the next milestone plan per
.agents/skills/implementation-planning/SKILL.md, obtain approval, and proceed
with implementation.
```
