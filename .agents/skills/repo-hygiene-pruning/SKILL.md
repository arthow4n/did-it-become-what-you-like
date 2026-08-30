---
name: repo-hygiene-pruning
description: >-
  Standardized procedure for auditing, identifying, updating, and pruning stale
  documents, code-mirroring markdown files, obsolete spikes, redundant verification
  scripts, brittle test structures, copy-pasted test harnesses/shims, duplicate fake ports,
  and misleading test tasks across the repository.
---

# Repository Hygiene, Documentation & Test Tooling Pruning Workflow

This skill defines the standardized protocol for orchestrating repository
hygiene audits to discover and prune stale documentation, code-mirroring
markdown files, obsolete spike artifacts, tautological/brittle test structures,
copy-pasted test harnesses/shims, redundant fake ports, repetitive intra-suite
test cases, redundant E2E specs, and inaccurate task definitions.

---

## 1. Core Principles & Governance

1. **Code and Schemas Are the Source of Truth:**
   - Documentation must explain _intent, architecture, constraints, and
     boundaries_, not mechanically transcribe TypeScript types, barrel exports,
     or JSON shapes.
   - If a document merely mirrors code (e.g. listing actor names, port maps, or
     re-declaring export interfaces), **archive/delete it**. Code is
     self-documenting when typed strictly.
2. **Zero Dangling or Ghost References:**
   - When a spec, audit report, spike, or test is archived/pruned, search across
     the entire repository for references to that filename and update or remove
     them immediately. Never leave broken links or stale authority statements.
3. **Living Docs vs. Ephemeral Ledgers:**
   - Living documents (such as `SPEC.md`, `DESIGN_SYSTEM.md`,
     `IMPLEMENTATION_PLAN.md`) must remain compact, active guides.
   - Once a milestone or migration is complete, prune all intermediate task
     matrices, consumer import checklists, and temporary package proofs. The
     historical record remains queryable in Git history.
4. **Runtime & Boundary Tests over Brittle String Assertions & Tautological
   Checks:**
   - Verification scripts and unit tests must validate real runtime contracts,
     type safety, accessibility semantics, or built bundle artifacts.
   - Tests that merely assert hardcoded substring matches inside markdown/source
     files, or execute no-op runtime loops over compile-time boolean tuples,
     provide false confidence and create maintenance drag.
5. **Shared Test Harnesses & Parameterized Fixtures over Copy-Paste:**
   - Test harnesses, global shims (e.g. DOM/ARIA environment setups), async
     polling utilities, and fake ports belong in centralized `src/test-support/`
     modules rather than being duplicated across test files.
   - Verbose repetitive test cases testing variations of the same input/output
     rules should be consolidated into concise table-driven parameterizations.
6. **Mandatory `[archive]` Commit Tagging:**
   - Per `AGENTS.md`, any document, spike, ledger, or test structure deletion
     must be committed with `[archive]` in the commit message.
7. **Environment-Scoped & Risk-Bounded Verification:**
   - Never execute broad or heavy verification commands in environments or
     phases where they are irrelevant (e.g. running full test suites or browser
     visual captures during docs or hygiene pruning; running release provenance
     checks during local dev loops; executing heavy Playwright tests when only
     pure unit code changed).
   - Match checks to their required environment and impact boundary. During
     hygiene and doc pruning audits, run only syntax, typecheck, lint, and
     format checks (`deno task typecheck`, `deno task fmt:check`,
     `deno task lint`, `git diff --check`). Do not run heavy test suites or
     long-running browser tasks.

---

## 2. Orchestrated Multi-Agent Architecture

When performing a repository hygiene and pruning audit, the lead agent acts as
an **Orchestrator** dispatching two specialized subagents:

```text
                  ┌────────────────────────────────────────┐
                  │    Primary Orchestrator (Lead Agent)    │
                  └───────────────────┬────────────────────┘
                                      │
           ┌──────────────────────────┴──────────────────────────┐
           ▼                                                     ▼
┌──────────────────────────────────────┐      ┌──────────────────────────────────────┐
│  Section 1: Docs & Ledger Pruning    │      │  Section 2: Test & Tooling Pruning   │
├──────────────────────────────────────┤      ├──────────────────────────────────────┤
│ • Dangling references & ghost docs   │      │ • Tautological & type-only tests     │
│ • Code-mirroring markdown & schemas  │      │ • Source AST / string-scraping tests │
│ • Stale migration & import matrices  │      │ • Milestone-named & spike artifacts  │
│ • Obsolete spikes & proof entries    │      │ • Redundant micro E2E specs          │
│ • Brittle doc-string matchers        │      │ • Copy-pasted harnesses & shims      │
│                                      │      │ • Parallel / redundant fake ports    │
│                                      │      │ • Repetitive intra-suite test blocks │
│                                      │      │ • deno.json task target flaws        │
└──────────────────────────────────────┘      └──────────────────────────────────────┘
                                      │
                                      ▼
                  ┌────────────────────────────────────────┐
                  │ Lead Agent Reconciliation & Validation │
                  │  (check, lint, fmt:check, [archive])   │
                  └────────────────────────────────────────┘
```

---

## 3. Section 1: Documentation, Ledger & Spike Pruning

The Section 1 subagent audits all markdown files, spike directories, and
doc-level verification scripts against these dimensions:

### Dimension 1A: Dangling References & Ghost Documents

- **What to look for:**
  - References to deleted/archived specs (e.g. `UI_SPEC.md`).
  - Authority statements pointing to transient audit reports (e.g.
    `UI_UX_AUDIT_REPORT_*.md`).
  - Stale commit hashes in `IMPLEMENTATION_PLAN.md` or release docs.
- **How to audit:**
  - Search for `.md` mentions across all files (`grep_search` for `\.md\b`).
  - Verify that every referenced file exists in the working tree.

### Dimension 1B: Code-Mirroring Documentation

- **What to look for:**
  - Markdown files that duplicate TypeScript interfaces (e.g. export envelopes,
    Zod schemas).
  - Architecture diagrams or topologies that only list file trees, actor ports,
    or exported symbols without unique design rules.
  - Manual inventories that duplicate programmatic runtime arrays (e.g. static
    E2E journey lists vs. `APPROVED_JOURNEYS` in code).
- **Remediation:**
  - Delete with `git rm`. Rely on TypeScript types, Zod schemas, and
    unit/contract tests as the living authority.

### Dimension 1C: Stale Ephemeral Ledgers in Living Documents

- **What to look for:**
  - Multi-page tables in `DESIGN_SYSTEM.md` or `SPEC.md` listing every symbol
    export, feature file import, or pre-migration library mapping from past
    milestones.
  - Detailed task progress checklists from completed milestones left inside
    `IMPLEMENTATION_PLAN.md`.
- **Remediation:**
  - Prune the tables from the working tree.
  - Retain only high-level architectural patterns and clean baseline statements
    citing the last pre-pruning commit hash.

### Dimension 1D: Obsolete Spikes & Temporary Proof Artifacts

- **What to look for:**
  - Standalone spike directories (e.g. `spikes/toolchain/`, `spikes/m8-proof/`).
  - Standalone spike build configs (`vite.*.config.ts`), dummy `index.html`, or
    custom `tsconfig.json`.
  - Proof entries (`*-compatibility-proof.tsx`, `*-entry.tsx`, `*.html`).
- **Remediation:**
  - Once the feature/library is integrated into production with real component,
    boundary, and browser tests, completely delete the `spikes/` directory with
    `git rm -r`.
  - Clean up `deno.json`, `tsconfig.app.json`, and boundary scripts.

### Dimension 1E: Brittle String & Marketing Matchers in Verification Scripts

- **What to look for:**
  - Scripts or tests asserting that arbitrary marketing phrases, promotional
    copy, or headings exist in markdown files or compiled production bundle
    assets (e.g. asserting specific marketing slogans or vibe-coding copy in
    `scripts/verify-release.ts`).
- **Remediation:**
  - Prune non-structural copy string matchers. Retain only structural build
    artifact validation (CSP allowlist, bundle hashes, secret leakage, license
    notices, manifest schema, and functional exports).

---

## 4. Section 2: Test, Verification & Tooling Task Pruning

The Section 2 subagent audits test suites, test support harnesses, E2E specs,
and tooling task definitions against these dimensions:

### Dimension 2A: Tautological & Type-Only Runtime Tests

- **What to look for:**
  - Tests statically defining compile-time boolean tuples (e.g.
    `const contractChecks: ContractChecks = [true, true, ...]`) and running
    `contractChecks.every(Boolean)` inside a `Deno.test`.
  - Tests asserting `typeof Component !== 'undefined'` for statically imported
    symbols already validated by `tsc` / `deno check`.
- **Remediation:**
  - Prune no-op runtime test cases. Rely on `deno task typecheck` / `tsc` for
    type-level contract validation.

### Dimension 2B: Source-Code Text & AST-Scraping Regex Matchers

- **What to look for:**
  - Tests reading `.ts` / `.tsx` source code via `Deno.readTextFile` to
    regex-match JSX tags (e.g. `renderSource.includes("<ColorChoiceField")`)
    rather than rendering components in a harness.
  - Fragile custom regex parsers attempting to emulate TypeScript AST type
    visibility checks.
- **Remediation:**
  - Replace source-text scraping with standard component harness tests or
    multi-viewport gallery verification (`deno task a11y:gallery`).

### Dimension 2C: Milestone-Named & Proof Subprocess Tooling Tests

- **What to look for:**
  - Test files retaining historical milestone/spike names (e.g.
    `scripts/tests/f005_tooling_test.ts`, `scripts/tests/foundation_test.ts`).
  - Artificial test scripts whose sole purpose is throwing an intentional error
    to test exit codes (e.g. `e2e/support/intentional-failure.ts`).
  - Production application tests (e.g. routing, PWA) placed inside
    `scripts/tests/` duplicating tests in `src/app/`.
- **Remediation:**
  - Prune intentional-failure spikes.
  - Colocate real application tests in `src/app/` (e.g.
    `src/app/routing.test.ts`).
  - Rename remaining valid tooling tests to functional names (e.g.
    `scripts/tests/browser_installer_test.ts`).

### Dimension 2D: Redundant Micro E2E Specs Overlapping Gallery/Actor Suites

- **What to look for:**
  - Heavy Playwright E2E specs booting a full browser to assert a single CSS
    bounding-box calculation (e.g. `responsive-filters.spec.ts`) when responsive
    layout and overflow are already validated across 3 viewports in
    `scripts/verify-gallery.ts` and component tests.
  - E2E specs testing state machine transitions (e.g. unsaved changes dialogs,
    dirty back/forward history) that are already exhaustively proven in XState
    actor unit tests and covered in critical journey specs.
- **Remediation:**
  - Prune redundant micro-specs to keep E2E coverage focused strictly on the
    approved critical user journeys (local-first manual, receipt review, sync
    portability/conflicts, offline update).

### Dimension 2E: Stale Migration Proof Assertions in Boundary Tests

- **What to look for:**
  - Boundary tests reading `deno.lock` or `deno.json` as text to check that a
    superseded library (e.g. `react-aria-components` from Milestone 8) is
    absent.
- **Remediation:**
  - Prune completed migration string assertions. Retain active architectural
    boundaries (e.g. Mantine facade isolation).

### Dimension 2F: Task Target Flaws, Redundant Sub-Commands & Task Fragmentation

- **What to look for:**
  - Fragmented or overlapping subsystem slice tasks in `deno.json` (e.g.
    `test:unit`, `test:domain`, `test:actor`, `test:integration`,
    `test:component`) that duplicate `test` and `test:affected`.
  - Redundant sub-step installer tasks (e.g. `playwright:install`) that
    duplicate composite multi-browser setup commands (`browser:install`).
  - Tasks hardcoding brittle lists of 20+ individual script/e2e files in
    `deno check`.
- **Remediation:**
  - Prune redundant subsystem slice and sub-installer tasks. Standardize on
    `test:affected` (for targeted graph-based changed tests) and `test` (for
    repository-wide test execution).
  - Streamline `check` arguments.

### Dimension 2G: Copy-Pasted Test Harnesses, Window Shims & Polling Helpers

- **What to look for:**
  - Test files repeatedly copying multi-line global window/ARIA shims (e.g.
    `withAriaGlobals` duplicating DOM/CSS global setup across feature tests)
    instead of centralizing them in `src/test-support/component-harness.tsx`.
  - Re-implementation of event-loop settling and actor state waiting utilities
    (`settle()`, `waitForValue()`, `waitForState()`) scattered across actor and
    adapter integration tests.
- **Remediation:**
  - Centralize DOM/ARIA window shimming inside
    `src/test-support/component-harness.tsx` and reuse it across all UI test
    suites.
  - Colocate shared async actor settlement and state-waiting helpers inside
    `src/test-support/` modules.

### Dimension 2H: Parallel Fakes & Zero-Import Orphan Support Files

- **What to look for:**
  - Standalone fake port implementations (e.g. `src/test-support/fake-drive.ts`,
    `src/test-support/fake-gemini.ts`) that duplicate or overlap canonical fake
    ports in `src/test-support/fakes/ports.ts`.
  - Zero-import orphan helper files or unused re-export facades in
    `e2e/support/` or `src/test-support/` (e.g. `fake-services.ts`, unimported
    static lists such as `journeys.ts`).
- **Remediation:**
  - Search for consumer imports of each support file across `src/`, `e2e/`, and
    `scripts/`.
  - Delete unimported orphan files with `git rm`.
  - Standardize all consumers on canonical fake port factories in
    `src/test-support/fakes/` and prune the redundant parallel implementations.

### Dimension 2I: Intra-Suite Repetitive Test Cases & Table-Driven Consolidation

- **What to look for:**
  - Multiple 30-40 line test cases repeating identical record construction and
    execution steps merely to test minor input permutations (such as decimal
    formatting variations, sign adjustments, or single-field invalidation).
- **Remediation:**
  - Refactor repetitive unit cases into concise table-driven parameterized tests
    over shared domain fixtures.

---

## 5. Step-by-Step Execution Protocol

```text
[Phase 1: Orchestrator Pre-Flight & Discovery]
         │
         ├─────────────────────────────────────────┐
         ▼                                         ▼
[Phase 2A: Section 1 Subagent]            [Phase 2B: Section 2 Subagent]
(Docs, Spikes, Ledgers, References)       (Tests, Verification, Tasks, Tooling)
         │                                         │
         └────────────────────┬────────────────────┘
                              │
                              ▼
[Phase 3: Orchestrator Reconciliation & Coordinated File Pruning]
                              │
                              ▼
[Phase 4: Living Doc, Config & Task Synchronization]
                              │
                              ▼
[Phase 5: Format, Diff Verification, Commit & Push]
```

### Phase 1: Orchestrator Pre-Flight & Discovery

1. List all tracked markdown documents:
   ```bash
   git ls-files "*.md"
   ```
2. List all scripts, test suites, and spikes:
   ```bash
   git ls-files "scripts/*" "spikes/*" "e2e/*" "src/**/*.test.*" "src/**/tests/*"
   ```

### Phase 2: Parallel Subagent Dispatch

1. **Dispatch Section 1 Subagent:** Task with evaluating all markdown files,
   audit reports, living doc tables, spikes, and doc matchers against Dimensions
   1A–1E.
2. **Dispatch Section 2 Subagent:** Task with evaluating all test files, test
   support fixtures, E2E specs, and `deno.json` task targets against Dimensions
   2A–2I.

### Phase 3: Orchestrator Reconciliation & Coordinated File Pruning

1. Review findings from both subagents to ensure zero cross-cutting breakage.
2. Delete identified obsolete documents, spikes, intentional-failure fixtures,
   and redundant test specs using `git rm`:
   ```bash
   git rm <redundant-docs> <obsolete-spikes> <redundant-tests>
   ```
3. Refactor/rename valid tooling tests or colocate app tests into `src/app/`.

### Phase 4: Living Doc, Config & Task Synchronization

1. **Update `deno.json`:**
   - Remove redundant slice tasks (`test:unit`, `test:domain`, `test:actor`,
     `test:integration`, `test:component`) and standardize on `test` and
     `test:affected`.
   - Clean up argument lists in `check`, `lint`, `fmt:check`.
   - Ensure composite `verify` references only active tasks.
2. **Update `tsconfig.*.json`:**
   - Remove deleted entries or obsolete spike paths.
3. **Update Living Documents:**
   - In `IMPLEMENTATION_PLAN.md`: update authority references and HEAD commit
     hash.
   - In `SPEC.md` / `DESIGN_SYSTEM.md` / `AGENTS.md`: replace dangling links.
   - In `RELEASE.md`: synchronize release checklists with current task names.

### Phase 5: Format, Diff Verification, Commit & Push

1. Format and check syntax on changed files (do NOT run heavy test suites for
   hygiene/pruning changes):
   ```bash
   deno task fmt:check
   deno task lint
   deno task typecheck
   git diff --check
   ```
2. Review staged changes:
   ```bash
   git status --short --branch
   git diff --stat
   ```
3. Commit with `[archive]` tag per `AGENTS.md` and push:
   ```bash
   git commit -am "chore(hygiene): [archive] prune redundant documents, obsolete spikes, brittle test structures, and fix task targets" && git push origin master
   ```

---

## 6. Quick Reference Checklist

Before closing a pruning audit, confirm:

- [ ] No `.md` file merely transcribes TypeScript types or schemas.
- [ ] No ghost links exist to previously deleted documents (`UI_SPEC.md`, old
      audit reports).
- [ ] `IMPLEMENTATION_PLAN.md` has no obsolete authority statements and reflects
      the latest HEAD commit.
- [ ] `DESIGN_SYSTEM.md` is free of ephemeral migration matrices.
- [ ] No verify scripts test arbitrary text substrings or promotional marketing
      slogans in markdown files or compiled bundle assets.
- [ ] No runtime tests execute tautological loops over compile-time boolean
      tuples.
- [ ] No tests scrape `.ts`/`.tsx` source files with regex to verify component
      tags.
- [ ] No milestone-named spike tests (`f005_*`, `intentional-failure`) remain in
      the codebase.
- [ ] Redundant micro E2E tests are pruned in favor of multi-viewport gallery
      and actor tests.
- [ ] Zero-import orphan helper files in `e2e/support/` or `src/test-support/`
      are pruned.
- [ ] Shared DOM/ARIA shims and polling utilities are centralized in
      `src/test-support/` rather than copy-pasted across feature tests.
- [ ] Redundant standalone fake ports are pruned in favor of canonical fakes in
      `src/test-support/fakes/`.
- [ ] Verbose repetitive intra-suite unit tests are consolidated into
      parameterized table tests.
- [ ] Redundant subsystem test slice and sub-installer tasks in `deno.json` are
      pruned in favor of `test`, `test:affected`, and composite installers.
- [ ] Visual audit screenshot capture scripts remain isolated in `e2e/audit/` /
      `scripts/audit-capture.ts`.
- [ ] No unrelated verify commands or heavy test suites are executed in
      irrelevant environments.
- [ ] All deleted files were committed with `[archive]` in the commit message.
