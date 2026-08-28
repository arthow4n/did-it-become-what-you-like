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

---

## 2. Six Audit Dimensions

When conducting a repository hygiene and pruning audit, systematically evaluate
against these 6 pillars:

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
  - Standalone spike configs (`vite.*.config.ts`, `spikes/toolchain/`).
  - Proof entries (`*-compatibility-proof.tsx`, `*-entry.tsx`, `*.html`).
  - Standalone spike test suites testing temporary proof themes.
- **Remediation:**
  - Once the library/feature is integrated in production with real component,
    boundary, and browser tests, remove the isolated spike configs and proof
    files.
  - Clean up `tsconfig.json` and `deno.json` entries referencing the deleted
    spikes.

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
  - **Duplicate test commands:** Tasks running a single test file that is
    already included in `deno task test`.
- **Remediation:**
  - Remove the unhelpful script from `scripts/` or `spikes/`.
  - Remove its task entry and `deno check` reference in `deno.json`.
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

Categorize candidates using the 6 dimensions:

- **Code-mirroring doc:** Archive/Delete.
- **Stale migration ledger in living doc:** Prune.
- **Obsolete spike / compatibility proof:** Archive/Delete.
- **Redundant verify script / dummy test:** Prune script and task.
- **Misleading task definition:** Fix target path.

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

1. Format and check syntax on changed files:
   ```bash
   deno fmt <changed-files>
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
- [ ] All deleted files were committed with `[archive]` in the commit message.
