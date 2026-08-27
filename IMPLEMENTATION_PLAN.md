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

M0 through M7 and the final `R-700` release gate are `COMPLETE`. The released
application baseline includes the approved domain, actors, adapters, responsive
UI, accessibility, PWA, tests, GitHub Pages pipeline, and operational safeguards
described by `SPEC.md`, `UI_SPEC.md`, `DESIGN_SYSTEM.md`, and `AGENTS.md`.

Detailed task, review, validation, worktree, deployment, and recovery history is
preserved in Git at commit `49bd69c`, the last complete pre-pruning ledger. That
history is evidence, not active instructions, and agents must not reconstruct it
in this live plan.

The active dependency flow remains:

```text
features/app -> src/design-system public contracts -> maintained UI library
                                                `-> owned domain compositions
features/app -> actors -> domain + adapter ports
```

## Active Dependency Graph

```text
M8-001 -> M8-002 -> R-810
                       |
M8-003 -> M8-004 -> R-820
                       |
M8-005 -> M8-006 -> R-830
                       |
M8-007 -> M8-008 -> R-840
                       |
M8-009 -> M8-010 -> R-850
```

Only the first task whose dependencies and preceding review gate are complete
may become `IN_PROGRESS`. Task and gate IDs are stable and must not be
renumbered after work starts.

## M8 — Mantine Design-System Migration

### M8 authority, outcome, and non-goals

This milestone replaces repository-written low-level component behavior with
maintained Mantine components behind the existing `src/design-system` facade.
The repository owner approved Mantine as the selected library and has now
explicitly authorized migration implementation. The primary agent must still
follow the ordered tasks, single-agent rule, review gates, and non-goals below.

The target dependency flow is:

```text
features/app -> src/design-system public contracts -> Mantine
                                                `-> small owned compositions
```

The migration is complete only when feature and app code still depend on the
repository facade, Mantine owns applicable interaction behavior and baseline
rendering, approved After Midnight semantics and appearance remain intact, and
React Aria Components plus superseded CSS are removed.

Non-goals: redesigning screens, changing product behavior, replacing XState,
adopting Mantine Form as workflow state, introducing light-theme UI, replacing
native date/time/file/camera behavior without evidence, changing the five E2E
journeys, or exposing Mantine as an application-level dependency.

### Mandatory single-agent execution rule

- One primary coding agent performs all M8 planning reconciliation, edits,
  tests, fixes, commits, pushes, and checkpoint updates sequentially on
  `master`. Do not dispatch implementation workers or advisors, do not create
  implementation worktrees, and do not run overlapping migration tasks.
- A fresh separate agent is permitted only at `R-810`, `R-820`, `R-830`,
  `R-840`, and `R-850`, and is a read-only reviewer. It may inspect source,
  diffs, tests, and browser output, but it must not edit, commit, push, create a
  worktree, or delegate. The primary agent alone resolves findings.
- If no independent reviewer is available, stop at the review gate and record it
  as `BLOCKED`; do not self-approve or continue into the next group.
- Context compaction or a new primary-agent session does not permit a second
  concurrent implementer. The resumed agent first follows the recovery checklist
  below, then continues the one `IN_PROGRESS` item or the next dependency-ready
  item.

### Locked design-system boundary rules

These rules are acceptance criteria for every M8 task and must be added to
`AGENTS.md` and `DESIGN_SYSTEM.md` by `M8-001` before component migration:

1. Files under `src/features/**` and `src/app/**` must not import `@mantine/*`,
   `react-aria-components`, or another component library. They import only the
   repository design-system facade.
2. Public design-system types, props, refs, callback signatures, and exports
   must not expose Mantine-specific types or objects. Translate library events
   internally and retain product-oriented contracts such as `onPress`, `tone`,
   and repository variants unless a reviewed contract change is unavoidable.
3. Semantic After Midnight tokens remain the visual source of truth. Map them
   into `MantineProvider` and component defaults; do not replace them with raw
   Mantine palette indexes in feature code.
4. Screens may not use Mantine `styles`, `classNames`, CSS selectors, or
   provider APIs. Library-specific customization stays inside
   `src/design-system/**`.
5. XState actors remain the authority for durable form and workflow state.
   Mantine may own ephemeral component interaction state, but Mantine Form is
   not introduced as a second business-state layer.
6. Native date, time, file, and camera controls remain native where approved.
   They use the same facade-level field contract and Mantine-compatible
   presentation.
7. Product/domain composites such as expense, receipt, conflict, sync,
   destructive, and Gemini patterns remain repository-owned compositions. They
   must be assembled from facade primitives backed by Mantine rather than copied
   library internals.
8. Do not copy Mantine source into the repository. Prefer public, documented
   Mantine APIs and pin all dependencies through `deno.json`/`deno.lock`.
9. Ordinary interaction and layout transitions remain `0ms`; only approved
   functional progress motion is allowed, with equivalent reduced-motion
   feedback.
10. A facade contract may change only after an impact inventory identifies all
    consumers and tests, the change is recorded in this ledger, and the
    preceding or immediately following review gate approves it.

### Restart and compaction recovery checklist for M8

Before any M8 edit, including after context compaction, a lost session, restart,
failed push, or interrupted validation, the primary agent checks these items in
order and records material discrepancies in **Current Checkpoint**:

If context was compacted but the same agent session continues, Git was known
clean, no command/push/reviewer was interrupted, and no branch/worktree state
could have changed, use the short recovery path: reread the M8 task and Current
Checkpoint, run `git status --short --branch`, and continue. Use the full list
below whenever any repository, process, ownership, or evidence state is
uncertain.

- [ ] Read `AGENTS.md` and this entire M8 section, including the current task,
      latest completed review gate, and Current Checkpoint.
- [ ] Read `UI_SPEC.md`, `DESIGN_SYSTEM.md`, and the public exports and tests in
      `src/design-system/**`; read feature files only as required by the current
      task's impact inventory.
- [ ] Run `git status --short --branch`, `git log --oneline --decorate -n 20`,
      `git branch -vv`, `git worktree list --porcelain`, and
      `git rev-list --left-right --count origin/master...master`.
- [ ] When network is available, run `git fetch --prune origin`, repeat the
      upstream comparison, and integrate remote changes safely without force.
- [ ] Confirm that no implementation/review sub-agent is active and that no M8
      worktree or branch contains unintegrated work. Preserve and reconcile any
      unexpected work; never reset, discard, stash, or duplicate it.
- [ ] Compare the recorded task status with the actual diff, commits, dependency
      state, tests, gallery, and build. Actual repository evidence wins over
      checklist state.
- [ ] If a task was `IN_PROGRESS`, resume that exact task and first rerun any
      missing or stale focused checks. Otherwise select only the first `READY`
      item whose dependencies and prior review gate are complete.
- [ ] Update Current Checkpoint before editing if HEAD/upstream, task status,
      tests, active processes, or next action differs from the ledger.

### Per-task execution and evidence checklist

Apply this checklist to `M8-001` through `M8-010` without exception:

- [ ] Mark exactly one task `IN_PROGRESS` and update Current Checkpoint before
      editing; all later tasks remain `PENDING`.
- [ ] Inventory owned files, affected facade exports, consumer count, locked
      contracts, and explicit non-goals.
- [ ] Add or update the cheapest boundary/contract regression test with the
      behavior change; do not postpone tests to cleanup. Do not duplicate
      Mantine's upstream accessibility or primitive-state test suite. A small
      integration smoke may verify that the pinned package works in this
      repository, but repository tests must focus on facade-owned translation,
      product contracts, custom styling, and actor/event wiring.
- [ ] Implement only the current task and keep application imports on the
      facade.
- [ ] Format and lint changed files, run `deno task test:affected`, add only the
      explicit check needed for non-import effects, and run `git diff --check`.
      Use `deno test --related=<path>` for a known source file when it gives
      clearer coverage.
- [ ] Do not run the complete component, gallery, build, E2E, browser, or
      repository verification matrix for an ordinary task. CSS, HTML, generated
      assets, provider/configuration behavior, and browser-only interaction need
      an explicit targeted check because Deno's module graph cannot observe
      them.
- [ ] Defer the coherent batch's full gallery/accessibility, build, and
      `agent-browser` matrix to its next named `R-8*` checkpoint. Run an earlier
      targeted visual check only for a newly changed focus, overlay, navigation,
      responsive, or other unsafe-to-defer behavior.
- [ ] Inspect `git diff`, `git diff --check`, and library-import searches for
      leaked Mantine/React Aria usage, unrelated edits, generated noise, and
      secrets.
- [ ] Commit and push the focused green task to `master`; record commit hash,
      exact commands and exit results, any targeted browser evidence,
      unavailable checks, and next task in Current Checkpoint.
- [ ] Mark the task `COMPLETE` only after its integrated commit is pushed and
      all required evidence is recorded. Never use a failing WIP commit as a
      checkpoint.

### Ordered migration checklist and ledger

#### M8-001 — Freeze facade contracts and encode migration governance

- **Status/dependencies:** `COMPLETE`; plan/governance work was authorized by
  the owner's request to work autonomously on the M8 migration plan. Runtime
  migration implementation remains unauthorized and was out of scope for this
  task; depends on completed `R-700`.
- **Owned scope:** `AGENTS.md`, `DESIGN_SYSTEM.md`, `IMPLEMENTATION_PLAN.md`,
  and contract/inventory documentation or tests under `src/design-system/**`; no
  runtime implementation.
- [x] Add the locked boundary rules above to `AGENTS.md` as permanent agent
      rules and revise `DESIGN_SYSTEM.md` from repository-owned React Aria
      implementation to repository-facade/Mantine implementation.
- [x] Inventory every public export in `src/design-system/index.ts`, every
      consumer, and every React Aria primitive currently wrapped.
- [x] Classify each facade export as a direct Mantine wrapper, small facade
      composition, domain composite, or approved native control, and record its
      target Mantine/public-browser primitive.
- [x] Freeze the current public contract with compile-time/API tests and
      component behavior tests for representative props, callbacks, refs,
      labels, validation, focus, and controlled values.
- [x] Record any proposed facade change as an explicit impact item; default to
      preserving all application-facing contracts and screen markup.
- **Focused verification:** `deno task test:affected`; documentation/import
  searches; changed-file format/lint; `git diff --check`.
- **Evidence:** commit `3726591` is pushed to `origin/master`. `deno task
  test:affected` passed (1 test); direct design-system tests plus the new API
  test passed (18 tests); `deno check --config deno.json
  src/design-system/public-api.test.ts` passed; `deno fmt --check
  src/design-system/public-api.test.ts` and `deno lint
  src/design-system/public-api.test.ts` passed; the facade boundary search
  found no component-library imports in `src/features/**` or `src/app/**`;
  the export scan found all 151 public declarations named in
  `DESIGN_SYSTEM.md`; and `git diff --check` passed.
- **Acceptance:** governance is durable outside this plan, the migration matrix
  has no unclassified export, and no runtime/dependency/generated-asset/
  styling change occurred.

#### M8-002 — Prove and pin Mantine compatibility

- **Status/dependencies:** `COMPLETE`; depends on completed `M8-001`.
- **Owned scope:** `deno.json`, `deno.lock`, isolated compatibility proof/tests,
  minimal test-only provider support, and the newly requested date/time/file
  candidate proof; no production facade conversion.
- [x] Verify the current stable Mantine release and the documented
      `@mantine/dates` `DateInput`/`TimeInput`, core `FileInput`, and
      `@mantine/dropzone` APIs against pinned React 19.2, strict TypeScript 7,
      Deno npm resolution, Vite production build, happy-dom component tests,
      and Chromium.
- [x] Prove `MantineProvider`, CSS imports/layers, dark theme, controlled input,
      date/time/file values, Dropzone keyboard activation and accepted/rejected
      drops, camera capture attributes, modal focus restoration/portal, select
      keyboard behavior, notification, reduced motion, and tree-shaken
      production build.
- [x] Extend the isolated proof to the preferred date/time/file controls while
      retaining explicit native fallbacks in the migration contract.
- [x] Measure and record baseline versus the extended proof build CSS/JS sizes;
      size growth is evidence for review, not permission to use private imports.
- [x] Pin only the packages required by the approved mapping. The lockfile now
      includes core, hooks, notifications, dates, and dropzone plus their
      required transitive packages; `@mantine/form` was not added.
- **Focused verification:** the eight-test compatibility smoke is intentionally
  an integration check, not a duplicate Mantine accessibility suite. `deno test
  --allow-read --allow-write --allow-run --allow-env
  src/design-system/mantine-compatibility.test.tsx` passed (8 tests);
  `deno task test:affected` passed (340 tests); `deno task test:component`
  passed (102 tests); `deno task check`, `deno task lint`, and
  `deno task fmt:check` passed; `deno task build` passed for the application
  and toolchain; and `deno task verify:mantine-compatibility` passed with one
  tree-shaken proof entry. Chromium proof at the isolated Vite URL passed date
  and time values, camera capture attributes, controlled input,
  ArrowDown/Enter selection, modal open/Escape close, and notification
  rendering; screenshot inspection and `agent-browser errors` found no page
  errors. The unchanged application build measured 1,038,625 JavaScript bytes
  and 30,076 CSS bytes (284.90 kB and 5.78 kB gzip); the extended proof
  measured 513,589 JavaScript bytes and 281,376 CSS bytes (154.11 kB and 41.48
  kB gzip).
- **Acceptance:** all required behavior, including the preferred date/time/file
  candidates or documented native fallbacks, works through public Mantine APIs;
  no `@mantine/form` dependency or production facade conversion is added.

#### R-810 — Governance and compatibility review checkpoint

- **Status/dependencies:** `COMPLETE`; depends on `M8-001`, `M8-002`.
- **Reviewer:** `01a0408a-8fb5-7c31-8f3d-9f6824436a65` (`Linnaeus`) completed
  the fresh read-only review of M8-002 at pushed HEAD `27771ff` and returned
  `APPROVE`; the plan-only descendant `cc292db` is clean and aligned.
- [x] Fresh read-only reviewer checks the inventory, locked facade, dependency
      choices, Deno/Vite/React compatibility, focused facade-boundary proof,
      styling strategy, bundle evidence, and absence of premature production
      changes. The reviewer must distinguish repository wiring/contract checks
      from Mantine's upstream accessibility coverage and must not require a
      duplicate upstream primitive test suite.
- [x] Reviewer reports `APPROVE`, no findings at severities 1–4, and exact
      commands/results. The report confirmed `deno test ...
      mantine-compatibility.test.tsx` (8 passed), `deno task check`, `deno task
      lint` (205 files), `deno task fmt:check` (221 files), compatibility
      artifact verification (513,589 JS bytes and 281,376 CSS bytes),
      `git diff --check`, Chromium behavior proof, no feature-layer Mantine or
      React Aria import leakage, and no `@mantine/form` dependency.
- [x] Primary agent resolved every severity 1–3 finding (none were reported),
      reran the recorded compatibility matrix, committed, pushed, and recorded
      closure before `M8-003`.
- [x] Review evidence explicitly treats the compatibility checks as focused
      repository/facade integration smokes and leaves generic Mantine
      accessibility and primitive behavior to Mantine's upstream test suite.
- **Gate acceptance:** no unresolved severity 1–3 finding and full compatibility
  proof is green.

#### M8-003 — Introduce provider, theme mapping, and structural primitives

- **Status/dependencies:** `PENDING`; depends on approved `R-810`.
- **Owned scope:** app provider composition and design-system tokens/layout/
  typography primitives only.
- [ ] Add one facade-owned provider entry and map After Midnight color,
      typography, spacing, radius, focus, control-height, z-index, and `0ms`
      motion contracts into Mantine defaults while preserving semantic CSS
      tokens for product styles.
- [ ] Convert `ContentContainer`, `Stack`, `Inline`, `ResponsiveGrid`, `Text`,
      `Heading`, `Card`, `Section`, `Divider`, `Icon`, `Badge`, `Chip`, and
      `StatusDot` to Mantine-backed wrappers where the matrix specifies.
- [ ] Preserve intrinsic/full-width rules, money nowrap/tabular behavior,
      long-text flex protection, compact grids, and semantic HTML.
- [ ] Keep feature markup and imports unchanged unless a pre-recorded contract
      exception was approved at `R-810`.
- **Focused verification:** affected tests, changed-file format/lint, and a
  targeted gallery smoke only if a structural behavior cannot safely wait for
  `R-820`.
- **Acceptance:** structural gallery fixtures match approved semantics with no
  duplicate provider, palette leak, transition, or layout regression.

#### M8-004 — Migrate buttons and field controls

- **Status/dependencies:** `PENDING`; depends on `M8-003`.
- **Owned scope:** facade button/link/action and input/choice components plus
  their tests and gallery fixtures.
- [ ] Convert `Button`, `IconButton`, `LinkButton`, and `ActionCard`,
      translating `onPress`, variants, loading/disabled state, refs, and
      accessible names internally.
- [ ] Convert `Field`, `TextField`, `TextArea`, `SearchField`, `SecretField`,
      `DecimalField`, `MoneyField`, `SelectField`, `ColorChoiceField`,
      `Checkbox`, `RadioGroup`, `Switch`, and `SegmentedControl`.
- [ ] Convert `NativeDateField`, `NativeTimeField`, and `FileField` to the
      preferred Mantine `DateInput`, `TimeInput`, and Dropzone/FileInput facade
      implementations after M8-002 proves value, accessibility, keyboard, and
      capture compatibility; retain native controls only as explicit fallbacks.
- [ ] Test facade-owned controlled updates, callback translation,
      validation/error association, clear/reveal behavior, decimal strings,
      date/time/file value adaptation, Dropzone acceptance/rejection and
      camera capture, plus any custom compact-overflow or styling rules. Use
      Mantine's upstream accessibility/primitive behavior as coverage rather
      than reproducing its generic role, focus-ring, and keyboard test suite;
      retain only a small integration smoke where it detects a repository
      wiring risk.
- **Focused verification:** affected tests, changed-file format/lint, and a
  targeted keyboard/focus smoke only for behavior unsafe to defer to `R-820`.
- **Acceptance:** screens retain facade contracts and no field relies on
  feature-owned Mantine styling or a second form-state authority.

#### R-820 — Foundation and controls review checkpoint

- **Status/dependencies:** `PENDING`; depends on `M8-003`, `M8-004`.
- [ ] Fresh read-only reviewer audits provider/theme boundaries, public API
      compatibility, semantic markup, focus/error behavior, native controls,
      intrinsic sizing, mobile overflow, motion, tests, and visual evidence.
- [ ] From the recorded pre-`M8-003` base commit, run affected tests once with
      `deno test --allow-read --allow-write --allow-run --allow-env
      --changed=<recorded-pre-M8-003-base-commit>`,
      then run one gallery accessibility check, one production build, and one
      agent-browser keyboard/form/layout matrix at all three viewports for the
      combined `M8-003`/`M8-004` batch.
- [ ] Primary agent fixes severity 1–3 findings and reruns only checks affected
      by those fixes. Repeat the complete checkpoint matrix only when shared or
      cross-cutting code changed; then commit, push, and record closure.
- **Gate acceptance:** no unresolved severity 1–3 finding.

#### M8-005 — Migrate overlays, disclosure, menus, and feedback

- **Status/dependencies:** `PENDING`; depends on approved `R-820`.
- **Owned scope:** facade overlay and feedback primitives/patterns only.
- [ ] Convert `Disclosure`, `AdaptiveDialog`, `ConfirmDialog`, `DangerDialog`,
      `Popover`, `Menu`, and `Tooltip` using public Mantine components.
- [ ] Convert `Banner`, `InlineNotice`, `Toast`, `StatusMessage`, `Progress`,
      `Skeleton`, `EmptyState`, and `ErrorState`.
- [ ] Preserve responsive modal/sheet composition, focus trap/restoration,
      escape/cancel behavior, destructive confirmation rules, portal layering,
      fixed toast placement, live-region semantics, and approved progress-only
      motion.
- [ ] Exercise nested overlay, mobile bottom navigation, long error text,
      loading/retry, reduced-motion, and dirty-form exit interactions.
- **Focused verification:** affected tests and a targeted overlay/focus smoke
  only when the changed behavior is unsafe to defer to `R-830`.
- **Acceptance:** no focus loss, background interaction, clipped portal,
  navigation overlap, layout shift, or decorative motion regression.

#### M8-006 — Migrate reusable navigation, form, filter, and status patterns

- **Status/dependencies:** `PENDING`; depends on `M8-005`.
- **Owned scope:** facade reusable patterns; no domain composites or actor
  behavior.
- [ ] Convert `AppFrame`, `PageHeader`, `AppNavigation`, `DefaultNavigation`,
      `List`, `ListRow`, `DefinitionList`, `StickyActionBar`, `FormLayout`,
      `FormActions`, `ErrorSummary`, `DraftStatus`, `FilterBar`,
      `ActiveFilterChips`, `FilterSheet`, `StatusPanel`, `GlobalStatus`, and
      `WorkflowProgress` to compositions of migrated facade primitives.
- [ ] Preserve compact bottom navigation/safe areas, wide rail behavior, 44px
      targets, sticky/fixed layering, immediate interaction, long labels, money
      protection, pristine-form warning suppression, and cancel actions.
- [ ] Do not adopt Mantine AppShell or notification managers directly in
      screens; the facade owns any use.
- **Focused verification:** affected tests and a targeted shell/responsive smoke
  only when the changed behavior is unsafe to defer to `R-830`.
- **Acceptance:** shell and reusable patterns remain screen-agnostic and meet
  all responsive/layering contracts.

#### R-830 — Overlay and reusable-pattern review checkpoint

- **Status/dependencies:** `PENDING`; depends on `M8-005`, `M8-006`.
- [ ] Fresh read-only reviewer audits overlay safety, focus, live regions,
      navigation, safe areas, z-index, form/filter state, reduced motion,
      responsive behavior, and contract leakage.
- [ ] From the recorded pre-`M8-005` base commit, run affected tests once with
      `deno test --allow-read --allow-write --allow-run --allow-env
      --changed=<recorded-pre-M8-005-base-commit>`,
      then run one gallery accessibility check, one production build, only
      affected approved E2E journeys, and one overlay/shell agent-browser matrix
      for the combined `M8-005`/`M8-006` batch.
- [ ] Primary agent resolves severity 1–3 findings and records a pushed green
      closure before domain composites.
- **Gate acceptance:** no unresolved severity 1–3 finding.

#### M8-007 — Recompose expense, organization, and manual-entry components

- **Status/dependencies:** `PENDING`; depends on approved `R-830`.
- **Owned scope:** expense/project/category/manual-entry design-system
  composites and affected feature presentation only; no actor/domain changes.
- [ ] Recompose `PeriodPicker`, `ProjectPicker`, `CurrencyPicker`,
      `MerchantPicker`, `MoneySummary`, `CategoryBreakdown`, `ExpenseRow`,
      `ExpenseList`, `ExpenseForm`, and organization/deletion compositions from
      migrated facade primitives.
- [ ] Preserve controlled decimal/date/time values, project/category identity,
      filter behavior, signed multi-currency presentation, reassign/delete
      safeguards, dirty state, immediate save feedback, and existing actor
      events.
- [ ] Add regressions for large/negative money, long project/category/merchant
      names, empty/error/loading/filter states, keyboard entry, narrow forms,
      and populated-project deletion.
- **Focused verification:** affected tests and an immediate targeted journey or
  browser smoke only for behavior unsafe to defer to `R-840`.
- **Acceptance:** no application business logic or Mantine imports leak into
  screens, and existing actor event contracts remain unchanged.

#### M8-008 — Recompose receipt, Gemini, sync, conflict, and portability UI

- **Status/dependencies:** `PENDING`; depends on `M8-007`.
- **Owned scope:** remaining domain composites and affected feature presentation
  only; no actor, adapter, persistence, schema, or workflow change.
- [ ] Recompose receipt source/metadata/line/editor/reconciliation components,
      model picker/quick setup/configuration test, sync/global status, known
      devices, conflict review, and import/export panels from migrated facade
      primitives.
- [ ] Preserve native file/camera capture, receipt image privacy, durable
      drafts, mismatch/error states, secret handling, offline/reconnect honesty,
      opaque-ID policy, conflict neutrality, import/replace warnings, and
      destructive cancel/confirmation behavior.
- [ ] Test long technical/error strings, secret reveal, model loading/failure,
      receipt line editing, conflict options, import progress/recovery, offline
      banners, focus restoration, and narrow review layouts.
- **Focused verification:** affected tests and an immediate targeted journey or
  browser smoke only for behavior unsafe to defer to `R-840`.
- **Acceptance:** all remaining screens use the facade unchanged or through
  approved recorded exceptions; no product workflow semantics changed.

#### R-840 — Domain-composite review checkpoint

- **Status/dependencies:** `PENDING`; depends on `M8-007`, `M8-008`.
- [ ] Fresh read-only reviewer traces representative actor snapshot/event paths
      through each migrated composite and audits privacy, destructive safety,
      conflict neutrality, offline honesty, accessibility, responsive layouts,
      and absence of duplicated state.
- [ ] From the recorded pre-`M8-007` base commit, run affected tests once with
      `deno test --allow-read --allow-write --allow-run --allow-env
      --changed=<recorded-pre-M8-007-base-commit>`,
      then run one gallery accessibility check, one production build, only
      affected approved E2E journeys, and one domain-screen agent-browser matrix
      for the combined `M8-007`/`M8-008` batch.
- [ ] Primary agent resolves severity 1–3 findings and reruns only checks
      affected by those fixes. Repeat the complete checkpoint matrix only when
      shared or cross-cutting code changed before closure.
- **Gate acceptance:** no unresolved severity 1–3 finding and no actor/domain/
  adapter contract drift.

#### M8-009 — Remove superseded implementation and enforce boundaries

- **Status/dependencies:** `PENDING`; depends on approved `R-840`.
- **Owned scope:** design-system implementation/CSS, dependency configuration,
  static boundary checks, tests, and documentation; no visual redesign.
- [ ] Verify every migration-matrix row is complete, then remove all
      `react-aria-components` imports and its pinned dependency.
- [ ] Delete only CSS selectors and helper code proven unused by searches,
      coverage, gallery, build, and screen inspection; preserve semantic tokens
      and feature styles still carrying product layout.
- [ ] Split the monolithic design-system module into facade-owned modules only
      if this improves reviewability without changing the public barrel or
      creating library-specific imports in screens.
- [ ] Add an automated boundary check that fails on `@mantine/*` or component-
      library imports outside approved design-system/provider files, Mantine
      types in public exports, and reintroduction of React Aria.
- [ ] Run dependency/license/security checks and update third-party notices and
      architecture documentation.
- **Focused verification:** boundary check, affected tests, unused-selector/
  import searches, `deno audit --frozen`, and one production build. The final
  gallery/a11y/browser and complete repository matrix belongs to `M8-010`.
- **Acceptance:** one maintained low-level library remains, no copied or dead
  implementation survives, and future replacement remains localized behind the
  facade.

#### M8-010 — Full migration regression, visual closure, and handoff

- **Status/dependencies:** `PENDING`; depends on `M8-009`.
- **Owned scope:** regression fixes within M8 ownership, gallery/fixtures,
  documentation, and ledger evidence; no new feature or redesign.
- [ ] Run `deno task verify` once from a clean working tree. It owns the
      complete canonical static, Deno test, E2E, gallery/a11y, browser-tooling,
      Pages, CI, toolchain, build, audit, and diff matrix; do not rerun its
      constituent commands against the same commit.
- [ ] Inspect the gallery and every approved screen/state at `320x568`,
      `390x844`, and `1280x800` with agent-browser, including keyboard,
      accessibility tree/axe, long content, large money, empty/loading/offline/
      error/conflict/destructive states, overlays, reduced motion, and safe
      areas.
- [ ] Compare production bundle evidence with the M8-002 baseline and explain
      material growth; fix accidental duplication or imports.
- [ ] Reconcile `UI_SPEC.md`, `DESIGN_SYSTEM.md`, `AGENTS.md`, README/licenses,
      gallery, tests, migration matrix, and actual implementation.
- [ ] Record exact final evidence, remaining accepted limitations (owner
      approval required), commits, clean status, and rollback/recovery notes.
- **Acceptance:** canonical verification is green, visual/state matrix has no
  unresolved regression, documentation matches code, and repository/upstream are
  aligned and clean.

#### R-850 — Final independent Mantine migration review

- **Status/dependencies:** `PENDING`; depends on `M8-010`.
- [ ] Fresh read-only reviewer independently checks facade isolation, migration
      matrix closure, public contract compatibility, accessibility, responsive
      and overlay behavior, state ownership, security/privacy, dependency and
      license state, dead code removal, tests, browser evidence, and clean
      build.
- [ ] Reviewer reruns risk-selected commands plus the boundary check and reports
      `APPROVE` or `BLOCK` with severity and evidence.
- [ ] Primary agent fixes every severity 1–3 finding, reruns the full affected
      gate and complete canonical verification when shared code changed, then
      requests a fresh closure review rather than asking the same reviewer to
      approve its own fixes.
- [ ] After approval, primary agent marks all M8 tasks and `R-850` `COMPLETE`,
      records final commits/evidence in Current Checkpoint, commits, pushes, and
      confirms clean alignment with `origin/master`.
- **Gate acceptance:** no unresolved severity 1–3 finding, explicit fresh
  `APPROVE`, full verification green, and clean pushed repository.

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
  the next named M8 review gate. Run an earlier targeted visual check only when
  waiting would be unsafe.
- `deno task verify` is reserved for `M8-010`/`R-850`, release work, or a
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

1. Re-read the active M8 task and Current Checkpoint.
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
2. At `R-810`, `R-820`, `R-830`, `R-840`, and `R-850`, one fresh read-only
   reviewer independently checks the completed batch. It reports `APPROVE` or
   `BLOCK`, severity, file/line evidence, commands/results, and minimal fixes.
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

- **Plan state:** Released baseline through `R-700`, `M8-001`, `M8-002`, and
  `R-810` are `COMPLETE`; `M8-003` through `M8-010`, and `R-820` through
  `R-850` remain `PENDING`.
- **Reconciled branch/upstream:** `master` is aligned with `origin/master`.
- **Owner authorization:** The owner approved Mantine as the migration target
  and explicitly authorized autonomous implementation of all M8 tasks.
- **Worktree state:** `master` is clean and aligned with `origin/master` at
  the pending R-810-closure commit; no M8 branch/worktree exists. Historical non-M8
  worktrees remain present and were preserved untouched.
- **Verification status:** The released baseline's revised non-duplicating
  `deno task verify` passed at commit `ee9f4fd` (331 Deno tests, 11 E2E tests,
  gallery/axe at three viewports, browser/toolchain checks, one build, Pages
  artifact inspection, frozen audit, and diff check). M8-001 evidence is
  recorded above for pushed commit `3726591`. M8-002's extended compatibility
  evidence is green, including the preferred date/time/file candidates,
  Dropzone, builds, artifact verifier, affected tests, and Chromium proof. The
  app still uses the pre-M8 React Aria facade; no production provider or facade
  conversion has occurred.
- **M8 active/interrupted work:** M8-002 is complete and pushed at `12f12c4`;
  R-810 was approved by the fresh read-only reviewer with no findings and is
  recorded for closure. No review agent remains active, no migration
  branch/worktree exists, and historical non-M8 worktrees were preserved
  untouched.
- **Exact next action:** commit and push this R-810 closure, then begin
  `M8-003` by reconciling the provider, theme, token, and structural primitive
  contracts before editing production UI.

Every checkpoint update records task status, HEAD/upstream and unpushed commits,
exact validation evidence, active or preserved work/reviewers, blockers or
recovery notes, and one exact next action.

## Ready-to-Use Orchestration Prompt

```text
Act as the single primary coding agent for the M8 Mantine design-system
migration. Read AGENTS.md and this plan completely, then read the authoritative
specification/design documents and applicable skills named by the active task.
Reconcile Current Checkpoint using the short or full recovery path. Preserve all
unexpected work and trust repository evidence over checklist state.

Confirm explicit M8 implementation authorization. If absent, stop. If present,
continue exactly one dependency-ready task using the M8 execution, boundary,
validation, commit, and checkpoint policies. Never use an implementation
sub-agent, advisor, parallel task, or M8 worktree. Use one fresh read-only agent
only at the named review gates; the primary agent alone fixes findings.

Keep product behavior and facade contracts stable, keep XState authoritative,
run risk-selected tests/checks without duplicate gates, commit and push green
increments, and update Current Checkpoint after each task or gate. If a genuine
owner decision is required, preserve safe work, record the exact blocker and
recovery action, and ask one concise decision batch.
```
