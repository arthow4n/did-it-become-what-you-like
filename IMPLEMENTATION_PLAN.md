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
stale scan failure context.

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

### M20 — Make Gemini receipt retries tolerate localized structured output

**Outcome:** Gemini receipt extraction accepts safe locale-specific decimal
transcription and a harmless JSON code fence while preserving strict schema
validation. Retries no longer fail solely because a Swedish/European receipt
uses comma decimals; malformed or hostile output remains rejected.

| Task | Status | Dependency | Acceptance / evidence |
| --- | --- | --- | --- |
| M20-001 Normalize safe provider output before strict receipt validation | COMPLETED | — | Canonicalize unambiguous comma/grouped decimals, accept fenced JSON, clarify prompt formatting, preserve strict rejection of invalid/extra fields |
| M20-002 Verify retry/output contract and archive checkpoint R-2000 | COMPLETED | M20-001 | Adapter tests pass 16/16; affected tests pass 56/56; check/format/lint/diff, build, receipt-review Playwright, and fresh review all pass |

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

- **Active task / gate:** M20-002 — verify retry/output contract and archive
  R-2000
- **Pushed commit / HEAD:** `571459d` (M19 implementation and archived plan)
- **Verification status:** M20 adapter tests pass 16/16 and affected tests pass
  56/56; check, format, lint, diff checks, build, and receipt-review Playwright
  pass. Fresh R-2000 review found no severity 1–3 findings.
  M19 focused actor/UI tests pass 20/20 and affected
  tests pass 128/128; check, format, lint, build, diff checks, and receipt-review
  Playwright pass 1/1. Fresh R-1900 review found no severity 1–3 findings.
  M18 affected tests pass 337/337, focused domain/client tests pass 8/8, and
  its final review found no severity 1–3 findings.
- **Active / preserved work:** Single primary agent on `master`; no worktree or
  delegated implementation worker; review artifacts remain outside the repo.
- **Exact next action:** Commit and push M20, then archive the completed ledger
  at R-2000.

## Ready-to-Use Orchestration Prompt

```text
Read AGENTS.md, DESIGN_SYSTEM.md, and IMPLEMENTATION_PLAN.md. Confirm working
tree status on master, author the next milestone plan per
.agents/skills/implementation-planning/SKILL.md, obtain approval, and proceed
with implementation.
```
