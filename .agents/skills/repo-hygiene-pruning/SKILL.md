---
name: repo-hygiene-pruning
description: >-
  Standardized procedure for auditing, identifying, updating, and pruning stale
  documents, code-mirroring markdown files, obsolete spikes, redundant verification
  scripts, and misleading test tasks across the repository.
---

# Repository Hygiene, Documentation & Tooling Pruning Workflow

This skill defines the standardized protocol for auditing the codebase to
discover and prune stale documentation, code-mirroring markdown files, obsolete
spike artifacts, redundant verification scripts, and inaccurate task
definitions.

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
   - When a spec, audit report, or spike is archived/pruned, search across the
     entire repository for references to that filename and update or remove them
     immediately. Never leave broken links or stale authority statements.
3. **Living Docs vs. Ephemeral Ledgers:**
   - Living documents (such as `SPEC.md`, `DESIGN_SYSTEM.md`,
     `IMPLEMENTATION_PLAN.md`) must remain compact, active guides.
   - Once a milestone or migration is complete, prune all intermediate task
     matrices, consumer import checklists, and temporary package proofs. The
     historical record remains queryable in Git history.
4. **Runtime & Boundary Tests over Brittle String Assertions:**
   - Verification scripts should validate real runtime contracts, type safety,
     accessibility, or build artifacts.
   - Scripts that merely assert hardcoded substring matches inside markdown
     files provide false confidence and create maintenance drag.
5. **Mandatory `[archive]` Commit Tagging:**
   - Per `AGENTS.md`, any document, spike, or ledger deletion must be committed
     with `[archive]` in the commit message.
6. **Environment-Scoped & Risk-Bounded Verification:**
   - Never execute broad or heavy verification commands in environments or
     phases where they are irrelevant (e.g. running full test suites or browser
     visual captures during docs or hygiene pruning; running release provenance
     checks during local dev loops; executing heavy Playwright tests when only
     pure unit code changed).
   - Match checks to their required environment and impact boundary. During
     hygiene and doc pruning audits, run only syntax, typecheck, lint, and
     format checks (`deno task check`, `deno task fmt:check`, `deno task lint`,
     `git diff --check`). Do not run tests or long-running browser tasks.

---

## 2. Eight Audit Dimensions

When conducting a repository hygiene and pruning audit, systematically evaluate
against these 8 pillars:

### Dimension A: Dangling References & Ghost Documents

- **What to look for:**
  - References to deleted/archived specs (e.g. `UI_SPEC.md`).
  - Authority statements pointing to transient audit reports (e.g.
    `UI_UX_AUDIT_REPORT_*.md`).
  - Stale commit hashes in `IMPLEMENTATION_PLAN.md` or release docs.
- **How to audit:**
  - Search for `.md` mentions across all files (`grep_search` for `\.md\b`).
  - Verify that every referenced file exists in the working tree.

### Dimension B: Code-Mirroring Documentation

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

### Dimension C: Stale Ephemeral Ledgers in Living Documents

- **What to look for:**
  - Multi-page tables in `DESIGN_SYSTEM.md` or `SPEC.md` listing every symbol
    export, feature file import, or pre-migration library mapping from past
    milestones.
  - Detailed task progress checklists from completed milestones left inside
    `IMPLEMENTATION_PLAN.md`.
- **Remediation:**
  - Prune the tables from the working tree.
  - Retain only high-level architectural patterns (e.g. facade wrapper classes)
    and clean baseline statements citing the last pre-pruning commit hash.

### Dimension D: Obsolete Spikes & Temporary Proof Artifacts

- **What to look for:**
  - Standalone spike directories (e.g. `spikes/toolchain/`, `spikes/m8-proof/`).
  - Standalone spike build configs (`vite.*.config.ts`), dummy `index.html`, or
    custom `tsconfig.json`.
  - Proof entries (`*-compatibility-proof.tsx`, `*-entry.tsx`, `*.html`).
  - Standalone spike test suites testing temporary proof themes or dummy
    counters.
- **Remediation:**
  - Once the library/feature is integrated in production with real component,
    boundary, and browser tests, completely delete the `spikes/` directory with
    `git rm -r`.
  - Clean up `deno.json` (`build`, `check`, `test`, `lint`, `fmt:check`),
    `tsconfig.app.json`, `e2e/playwright.config.ts`, and boundary scripts
    (`scripts/verify-design-system-boundary.ts`) referencing the deleted spikes.

### Dimension E: Redundant & Low-Value Verification Scripts

- **What to look for:**
  - **Doc string matchers:** Scripts asserting that specific words exist in a
    markdown file (e.g. `verify-schema-docs.ts`).
  - **Dummy tool wrappers:** Scripts serving dummy HTML strings
    (`<h1>Smoke</h1>`) to test if a browser can launch, when comprehensive
    production browser tests already run in the test suite.
  - **Compiler version checkers:** Scripts running `tsc --version` or checking
    intentional syntax error fixtures when `deno task check` already typechecks
    the real codebase.
  - **Duplicate test commands / Standalone verify scripts:** Standalone CLI
    scripts that can be standard Deno tests (e.g. design system boundary or CI
    workflow policy tests).
  - **Overlapping build validators:** Multiple scripts inspecting `dist/`
    separately when one consolidated `release:verify` suffices.
- **Remediation:**
  - Consolidate post-build artifact checks into `scripts/verify-release.ts`.
  - Convert static/boundary verifications into standard unit tests
    (`src/design-system/boundary.test.ts`, `scripts/tests/ci_test.ts`).
  - Streamline `deno task verify` to run only meaningful, high-signal checks.

### Dimension F: Inaccurate & Misleading Task Definitions

- **What to look for:**
  - Tasks named after critical application subsystems that actually point to
    dummy fixtures (e.g. `test:actor` pointing to a 2-state counter spike
    instead of `src/actors/`).
  - Tasks pointing to deleted paths or stale flags.
- **Remediation:**
  - Repoint the task to the real source directory (e.g.
    `"test:actor": "deno test ... src/actors"`).

### Dimension G: E2E Test Suite Separation & Transient Visual Capture Isolation

- **What to look for:**
  - **Visual audit exploration tests placed in standard E2E directories:**
    Screenshot scripts (e.g. `ui-audit-capture.spec.ts`) placed in `e2e/` where
    Playwright's default glob (`e2e/**/*.spec.ts`) executes them on every
    `deno task test:e2e` or `deno task verify`. This creates unwanted screenshot
    folders on every dev run and adds 30–60s of test latency.
  - **Hardcoded past audit dates:** Screenshot scripts hardcoding output folders
    like `ui-audit-2026-08-28/round-2-screenshots/`.
  - **Heavy browser tests for trivial assertions:** Playwright tests (e.g.
    `journey-boundaries.spec.ts`) booting a full headless browser just to count
    the length of an in-memory TypeScript array that already has a module-load
    assertion.
- **Remediation:**
  - Move on-demand visual audit captures to a dedicated CLI runner (e.g.
    `scripts/audit-capture.ts`) with a dedicated Playwright configuration (e.g.
    `e2e/playwright.audit.config.ts`) and test directory (`e2e/audit/`).
  - Exclude audit capture specs from the standard E2E configuration using
    `testIgnore: ["e2e/audit/**"]`.
  - Expose a dedicated on-demand task in `deno.json`:
    `"audit:capture": "deno run -A scripts/audit-capture.ts"` that accepts a
    dynamic target directory (or defaults to current date).
  - Prune browser-based array counting tests in favor of pure unit/module
    assertions.

### Dimension H: Environment-Irrelevant and Unbounded Verification Tasks

- **What to look for:**
  - Running full test suites or browser captures during doc pruning, hygiene
    audits, or formatting passes where no runtime code changed.
  - Calling release provenance checks (`release:verify`) during local component
    iterations.
  - Mechanically running the composite `verify` task and immediately rerunning
    its constituent suites against the same commit without a stated risk reason.
- **Remediation & Scope Boundaries:**
  - **Hygiene & Doc Pruning:** Run only syntax, typecheck, lint, and formatting
    validation (`deno task check`, `deno task fmt:check`, `deno task lint`,
    `git diff --check`). Do not run tests or launch browser tasks.
  - **Fast Dev / Component Loop:** Run `deno test --changed` and targeted
    lint/format.
  - **Pre-Commit / Integration Gate:** Run affected
    actor/domain/adapter/component suites (`deno task test`).
  - **UI / Accessibility Checkpoint:** Run `a11y:gallery` after visual changes.
  - **Release / CI Gate:** Run `release:verify` after `build` at deployment
    boundary or release verification.
  - **On-Demand Audits:** Run `audit:capture` separately on demand.

---

## 3. Step-by-Step Execution Protocol

```
[Phase 1: Repository Discovery & Cross-Reference Audit]
         │
         ▼
[Phase 2: Redundancy & Value Classification]
         │
         ▼
[Phase 3: Coordinated File Removal & Script Pruning]
         │
         ▼
[Phase 4: Living Doc & Config Synchronization]
         │
         ▼
[Phase 5: Format, Diff Verification, Commit & Push]
```

### Phase 1: Repository Discovery & Cross-Reference Audit

1. List all tracked markdown documents:
   ```bash
   git ls-files "*.md"
   ```
2. List all scripts and toolchain spikes:
   ```bash
   git ls-files "scripts/*" "spikes/*" "vite.*"
   ```
3. Audit cross-references for missing files:
   - Search for `.md` in all tracked files to catch ghost references.

### Phase 2: Redundancy & Value Classification

Categorize candidates using the 8 dimensions:

- **Code-mirroring doc:** Archive/Delete.
- **Stale migration ledger in living doc:** Prune.
- **Obsolete spike / compatibility proof:** Archive/Delete.
- **Redundant verify script / dummy test:** Prune script and task.
- **Misleading task definition:** Fix target path.
- **Unbounded / irrelevant verify command:** Re-scope to appropriate phase.

### Phase 3: Coordinated File Removal & Script Pruning

1. Delete redundant documents and scripts using `git rm`:
   ```bash
   git rm <redundant-docs> <obsolete-scripts> <spike-files>
   ```

### Phase 4: Living Doc & Config Synchronization

1. **Update `deno.json`:**
   - Remove deleted tasks and prune `fmt:check`, `lint`, and `check` argument
     lists.
   - Fix target paths for real test suites (e.g. `test:actor`).
   - Remove deleted tasks from the composite `verify` task.
2. **Update `tsconfig.*.json`:**
   - Remove deleted config files or spike entries from `include`.
3. **Update Living Documents:**
   - In `IMPLEMENTATION_PLAN.md`: update authority references and HEAD commit
     hash.
   - In `SPEC.md` / `DESIGN_SYSTEM.md` / `AGENTS.md`: replace dangling links
     with current living documents.
   - In `RELEASE.md`: update the local release checklist to match current tasks.

### Phase 5: Format, Diff Verification, Commit & Push

1. Format and check syntax on changed files (do NOT run heavy test suites for
   hygiene changes):
   ```bash
   deno task fmt:check
   deno task lint
   deno task check
   git diff --check
   ```
2. Review staged changes:
   ```bash
   git status --short --branch
   git diff --stat
   ```
3. Commit with `[archive]` tag per `AGENTS.md` and push:
   ```bash
   git commit -am "chore(hygiene): [archive] prune redundant documents, obsolete verify scripts, and fix task targets" && git push origin master
   ```

---

## 4. Quick Reference Checklist

Before closing a pruning audit, confirm:

- [ ] No `.md` file merely transcribes TypeScript types or schemas.
- [ ] No ghost links exist to previously deleted documents (`UI_SPEC.md`, old
      audit reports).
- [ ] `IMPLEMENTATION_PLAN.md` has no obsolete authority statements and reflects
      the latest HEAD commit.
- [ ] `DESIGN_SYSTEM.md` is free of ephemeral M8/M9 migration matrices.
- [ ] No verify scripts test arbitrary text substrings in markdown.
- [ ] `test:actor` (and similar domain test tasks) run real application code in
      `src/**`.
- [ ] Visual audit screenshot capture scripts are isolated in `e2e/audit/` /
      `scripts/audit-capture.ts` and excluded from regular `test:e2e`.
- [ ] No unrelated verify commands or heavy test suites are executed in
      irrelevant environments or phases (e.g. test suites during hygiene/doc
      pruning).
- [ ] All deleted files were committed with `[archive]` in the commit message.
