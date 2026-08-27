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
  the export scan found all 151 component declarations named in
  `DESIGN_SYSTEM.md`, with the two provider exports documented in the same
  matrix; and `git diff --check` passed.
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

- **Status/dependencies:** `COMPLETE`; depends on approved `R-810`.
- **Owner:** primary agent; production edits are isolated to the facade,
  provider composition, app entry, design-system fixtures, and this plan.
- **Owned scope:** app provider composition and design-system tokens/layout/
  typography primitives only.
- [x] Add one facade-owned provider entry and map After Midnight color,
      typography, spacing, radius, focus, control-height, z-index, and `0ms`
      motion contracts into Mantine defaults while preserving semantic CSS
      tokens for product styles.
- [x] Convert `ContentContainer`, `Stack`, `Inline`, `ResponsiveGrid`, `Text`,
      `Heading`, `Card`, `Section`, `Divider`, `Icon`, `Badge`, `Chip`, and
      `StatusDot` to Mantine-backed wrappers where the matrix specifies.
- [x] Preserve intrinsic/full-width rules, money nowrap/tabular behavior,
      long-text flex protection, compact grids, and semantic HTML.
- [x] Keep feature markup and imports unchanged unless a pre-recorded contract
      exception was approved at `R-810`.
- **Focused verification:** `deno task check` passed; `deno task lint` passed
  (207 files); `deno task fmt:check` passed (223 files);
  `deno task test:affected` passed (109 tests); `deno task test:component`
  passed (104 tests); `deno task build` passed (4,109 app modules, 261.17 kB
  CSS / 1,095.05 kB JS, plus the toolchain build); `deno task gallery` passed
  (3,904 modules, 252.57 kB CSS / 1,118.03 kB JS); the facade-boundary search
  found no Mantine or React Aria imports in `src/app/**` or `src/features/**`;
  and `git diff --check` passed.
- **Acceptance:** structural gallery fixtures match approved semantics with no
  duplicate provider, palette leak, transition, or layout regression.

#### M8-004 — Migrate buttons and field controls

- **Status/dependencies:** `COMPLETE`; depends on `M8-003`.
- **Owner:** primary agent; use the existing facade contract and Mantine's
  public APIs only.
- **Owned scope:** facade button/link/action and input/choice components plus
  their tests and gallery fixtures.
- [x] Convert `Button`, `IconButton`, `LinkButton`, and `ActionCard`,
      translating `onPress`, variants, loading/disabled state, refs, and
      accessible names internally.
- [x] Convert `Field`, `TextField`, `TextArea`, `SearchField`, `SecretField`,
      `DecimalField`, `MoneyField`, `SelectField`, `ColorChoiceField`,
      `Checkbox`, `RadioGroup`, `Switch`, and `SegmentedControl`.
- [x] Convert `NativeDateField`, `NativeTimeField`, and `FileField` to the
      preferred Mantine `DateInput`, `TimeInput`, and Dropzone/FileInput facade
      implementations after M8-002 proves value, accessibility, keyboard, and
      capture compatibility; retain native controls only as explicit fallbacks.
- [x] Test facade-owned controlled updates, callback translation,
      validation/error association, clear/reveal behavior, decimal strings,
      date/time/file value adaptation, Dropzone acceptance/rejection and
      camera capture, plus any custom compact-overflow or styling rules. Use
      Mantine's upstream accessibility/primitive behavior as coverage rather
      than reproducing its generic role, focus-ring, and keyboard test suite;
      retain only a small integration smoke where it detects a repository
      wiring risk.
- **Focused verification:** `deno task check` passed; `deno task lint` passed
  (207 files); `deno task fmt:check` passed (223 files); `deno task
  test:affected` passed (109 tests before the final focused control assertions);
  `deno task test:component` passed (105 tests); the final focused
  `src/design-system/design-system.test.tsx` run passed (20 tests); and
  `git diff --check` passed. The batch keeps all Mantine imports inside the
  facade and adapts native string/file event contracts at that boundary. The
  component tests cover facade wiring and product contracts only; generic
  Mantine primitive and accessibility behavior remains upstream-owned.
- **Acceptance:** screens retain facade contracts and no field relies on
  feature-owned Mantine styling or a second form-state authority.

#### R-820 — Foundation and controls review checkpoint

- **Status/dependencies:** `COMPLETE`; depends on `M8-003`, `M8-004`.
- [x] Fresh read-only reviewer audits provider/theme boundaries, public API
      compatibility, semantic markup, focus/error behavior, native controls,
      intrinsic sizing, mobile overflow, motion, tests, and visual evidence.
- [x] From pre-`M8-003` base commit `12f12c4`, run affected tests once with
      `deno test --allow-read --allow-write --allow-run --allow-env
      --changed=12f12c4`,
      then run one gallery accessibility check, one production build, and one
      agent-browser keyboard/form/layout matrix at all three viewports for the
      combined `M8-003`/`M8-004` batch.
- [x] Primary agent fixes severity 1–3 findings and reruns only checks affected
      by those fixes. Repeat the complete checkpoint matrix only when shared or
      cross-cutting code changed; then commit, push, and record closure.
- **Review evidence (R-820 initial pass, 2026-08-27):** Fresh read-only reviewer
  audited `HEAD 7915486` against base `12f12c4` and returned **BLOCK** with ten
  findings: S2 semantic error contrast using Mantine's default error token; S2
  missing Mantine dates and Dropzone style layers; S2 narrow ActionCard
  intrinsic-width clipping; S2 `NativeDateField` suppressing `defaultValue`;
  S2 SecretField reveal control excluded from keyboard focus; S2 uncontrolled
  SearchField clear not updating its value; S2 FileField rejection being
  discarded without facade feedback; S2 migrated public control types exposing
  React Aria prop declarations; S2 SegmentedControl retaining decorative
  transition motion; and S3 Pressable warnings around Mantine-backed dialog
  triggers with no browser proof of keyboard opening. The reviewer recorded
  `deno test --allow-read --allow-write --allow-run --allow-env
  --changed=12f12c4` passing (110 tests), `deno task build` passing (4233
  modules; JS 1324.80 kB; CSS 261.17 kB), `git diff --check` passing, and
  `deno task a11y:gallery` failing on two serious contrast findings. The
  three-viewport agent-browser matrix also failed on overflow, date default,
  secret reveal, SearchField clear, and SegmentedControl transition behavior;
  the date-open evidence was saved as `/tmp/r820-gallery-date-open.png` and
  narrow ActionCard evidence as `/tmp/r820-app-narrow-first.png`.
- **Fix evidence:** Primary fixes are pushed at `265d5b8` and cover all ten
  findings: Mantine error/red tokens and date/dropzone layers are mapped;
  ActionCard children are intrinsically shrinkable; date defaults are
  uncontrolled when appropriate; the secret toggle is keyboard reachable;
  SearchField owns uncontrolled clear state; FileField reports rejected files
  through its facade callback and live error; migrated public control types are
  facade-owned; segmented transitions are disabled; and Mantine-backed
  triggers retain the React Aria press bridge, including disabled controlled
  triggers. `deno task check` passed, `deno task lint` passed (207 files),
  `deno task test:affected` passed (113 tests), the focused design-system test
  passed (23 tests), targeted `deno fmt --check` passed for all changed source
  files, and `git diff --check` passed. A repository-wide `deno fmt --check`
  still reports pre-existing formatting drift in `AGENTS.md`,
  `IMPLEMENTATION_PLAN.md`, and `DESIGN_SYSTEM.md`; those unrelated document
  rewrites were not included in the implementation commit.
- **Closure review evidence (2026-08-27):** Fresh read-only reviewer audited
  `HEAD a74da1f` against `12f12c4` and confirmed the original ten findings are
  resolved. The required affected run passed (113 tests), `deno task
  a11y:gallery` passed at all three viewports, `deno task build` passed, and
  `git diff --check 12f12c4..HEAD` passed. Browser checks passed for dialog
  Enter opening, date default, file rejection feedback, SearchField clear,
  keyboard secret reveal, ActionCard sizing, and zero segmented transition
  duration at 1280x800, 390x844, and 320x568. The gate remains **BLOCKED** on
  two new S2 findings: long `ExpenseRow` content creates document widths of
  1843px at 1280px and 1113px at both narrow viewports; and `SwitchProps`
  declares `isRequired`, `isInvalid`, and `validationBehavior` without mapping
  or removing them in the Mantine adapter. Evidence points to the gallery
  fixture at `gallery.tsx:83-84`/`477-492`, the production row at
  `components.tsx:2751-2777`, row constraints at `tokens.css:800-817`, and
  the switch adapter at `components.tsx:1444-1471`.
- **Second-fix evidence:** The two closure blockers are fixed and pushed at
  `78fbf2a`: `ExpenseRow` now gives its list-row action a shrinkable full-width
  facade hook with wrapping Mantine inner/label constraints, and `Switch`
  consumes `isRequired`, `isInvalid`, and `validationBehavior`, mapping the
  supported states and preventing unsupported props from leaking. `deno task
  check` passed, `deno task lint` passed (207 files), targeted `deno fmt
  --check` passed for the three changed source files, `git diff --check` passed,
  and `deno test --allow-read --allow-write --allow-run --allow-env
  --related=src/design-system/components.tsx` passed (99 tests). The
  post-commit `deno task test:affected` selected no modules because the fix was
  already committed; the related run provides the direct affected evidence.
- **Third closure review evidence (2026-08-27):** Fresh read-only reviewer
  audited pushed `HEAD 1232814` against `12f12c4`. All ten initial findings and
  the Switch validation mapping were confirmed resolved. The required affected
  run passed (113 tests), `deno task a11y:gallery` passed, `deno task build`
  passed, and `git diff --check 12f12c4..HEAD` passed. Keyboard/form checks
  passed at 1280x800, 390x844, and 320x568 for dialog Enter, date default,
  rejection feedback, search clear, secret reveal, Switch semantics, and
  segmented motion. The gate remains **BLOCKED** on two S2 layout findings:
  `ExpenseRow` still reaches 356.359px at 320px because its containing grid
  track expands beyond the available width, and `FilterBar` still produces a
  496px document width at both 390px and 320px. Evidence points to
  `components.tsx:2763`, `tokens.css:800`, `gallery.tsx:477`, and the FilterBar
  styles at `tokens.css:1097`.
- **Fourth-fix evidence:** The two remaining layout blockers are addressed and
  pushed at `d7c2791`. List rendering now uses a single `minmax(0, 1fr)` grid
  track so long `ExpenseRow` content cannot expand the page, and narrow
  FilterBar children shrink to the available width while its segmented control
  remains the intentional horizontally scrollable control. The direct related
  component run already passed (99 tests) before this CSS-only commit; targeted
  formatting and `git diff --check` passed. A fresh closure reviewer must
  verify the three viewport scroll-width measurements before the gate can
  close.
- **Fourth closure review evidence (2026-08-27):** Fresh read-only reviewer
  confirmed FilterBar containment and that Switch validation mapping is fixed,
  but returned **BLOCK**. The gallery accessibility check, production build,
  and diff check passed; the browser matrix found `ExpenseRow` still reaches
  356px at the 320px viewport, its long label is clipped by the 48px trigger,
  and the long ActionCard content is clipped by the fixed 88px button height.
  The keyboard reveal toggle is reachable and Space works, but Enter does not
  activate it. The changed test command also exposed a reproducible shared
  harness race: `deno test ... --changed=12f12c4` failed after 96 passes with
  18 cancelled tests and React DOM `window.event` errors originating from
  concurrent global DOM harness cleanup (`component-harness.tsx:14`).
  FilterBar measured contained at 940px desktop, 302px at 390px, and 232px at
  320px; the remaining page overflow was isolated to ExpenseRow.
- **Fifth-fix evidence:** The remaining blockers are fixed and pushed at
  `5f765d1`. ActionCard and ExpenseRow Mantine buttons now override the
  primitive fixed height/overflow so long content grows and wraps; list/gallery
  tracks are explicitly shrinkable; SecretField handles Enter on its keyboard
  reachable toggle; and `withComponentHarness` serializes shared DOM globals
  and drains scheduled work before restoring them. `deno test
  --allow-read --allow-write --allow-run --allow-env --changed=12f12c4` passed
  (113 tests, 0 failures), `deno task check` passed, `deno task lint` passed
  (207 files), targeted `deno fmt --check` passed (4 files), and `git
  diff --check` passed.
- **Fifth closure review evidence (2026-08-27):** Fresh read-only reviewer
  audited pushed `HEAD 447b8e9` against `12f12c4`. The required affected run
  passed (113 tests), `deno task a11y:gallery` passed at all three viewports,
  `deno task build` passed, and `git diff --check 12f12c4..HEAD` passed. The
  reviewer confirmed FilterBar containment, fully wrapped ExpenseRow labels,
  long ActionCard content, Switch validation mapping, keyboard SecretField
  reveal, dialog/date/file/search behavior, and zero segmented transition
  duration. The gate remains **BLOCKED** on one S2 layout finding: at
  `320x568`, `documentElement.scrollWidth` and `body.scrollWidth` are `356px`
  versus a `320px` viewport, with the ExpenseRow ending at `x=356.36px`
  (`x=45px`, width `311.36px`). The long label itself wraps without clipping;
  evidence isolates the remaining expansion to the containing gallery grid
  track at `tokens.css:1202`. No other finding remains.
- **Exact next action:** constrain the gallery section/surface grid tracks with
  an explicit `minmax(0, 1fr)` column, run the affected checks and diff check,
  commit and push the focused fix, update this checkpoint, and request a fresh
  read-only closure review before opening M8-005.
- **Sixth-fix evidence:** The remaining gallery-track expansion is fixed and
  pushed at `2806236`: `.ds-gallery__section` and `.ds-gallery__surface` now
  explicitly use a shrinkable `minmax(0, 1fr)` grid column. The affected run
  `deno test --allow-read --allow-write --allow-run --allow-env
  --changed=12f12c4` passed (113 tests, 0 failures); `deno task check`,
  `deno task lint` (207 files), targeted `deno fmt --check
  src/design-system/tokens.css`, `deno task a11y:gallery` (all three
  viewports), `deno task build`, and `git diff --check` all passed. A fresh
  closure reviewer is still required to confirm the exact three-viewport
  browser width measurements before R-820 can close.
- **Sixth closure review evidence (2026-08-27):** Fresh read-only reviewer
  audited pushed `HEAD a56d3ba` against `12f12c4`. The required affected run
  passed (113 tests), `deno task a11y:gallery` passed at all three viewports,
  `deno task build` passed, and `git diff --check 12f12c4..HEAD` passed. The
  reviewer confirmed the ExpenseRow is contained (`right=275px` at 320px),
  FilterBar containment and local segmented scrolling, all prior dialog/date/
  file/search/secret/Switch/ActionCard/motion checks, and clean facade
  boundaries. The gate remains **BLOCKED** on one S2 gallery overflow: at
  `320x568`, document and body `scrollWidth` are `356px` versus a `320px`
  viewport. The standalone large `MoneyText` fixture at `gallery.tsx:519`,
  intentionally rendered with the product money `nowrap` contract at
  `components.tsx:370` and `tokens.css:293`, reaches the extra width. No
  ExpenseRow or FilterBar overflow remains.
- **Exact next action:** contain the standalone gallery MoneyText fixture at
  the fixture boundary without weakening the product money `nowrap` contract,
  run the affected checks and diff check, commit and push the focused fix,
  update this checkpoint, and request a fresh read-only closure review before
  opening M8-005.
- **Follow-up validation note:** The initial bounded-scroller implementation
  preserved the money contract, but its first local `deno task a11y:gallery`
  run failed at the narrow viewport with axe `scrollable-region-focusable`:
  the new gallery scroller was not keyboard-focusable. This is a contained
  gallery-fixture accessibility correction; no product money semantics are
  changing.
- **Exact next action:** make the gallery scroller labeled and keyboard
  focusable, rerun the affected tests, gallery accessibility, formatting, and
  diff checks, then commit/push the correction and update this checkpoint.
- **Correction evidence:** The gallery scroller is now labeled and keyboard
  focusable, preserving the full `MoneyText` value and its product `nowrap`
  contract while keeping horizontal overflow local. The correction is pushed
  at `c1907d5`. `deno test --allow-read --allow-write --allow-run --allow-env
  --changed=12f12c4` passed (113 tests, 0 failures); `deno task check`,
  `deno task lint` (207 files), targeted `deno fmt --check
  src/design-system/gallery.tsx src/design-system/tokens.css`,
  `deno task a11y:gallery` (all three viewports), and `git diff --check` all
  passed. A fresh closure reviewer must still confirm the exact browser width
  measurements and combined R-820 gate before M8-005 can start.
- **Exact next action:** invoke a fresh read-only R-820 closure reviewer at the
  pushed `c1907d5` checkpoint and record approval or any remaining severity
  1–3 finding before opening M8-005.
- **Final closure evidence (2026-08-27):** Fresh read-only reviewer Hubble
  (`01a0416e-42c8-7e31-aaaf-745af7185a07`) audited pushed `HEAD 221f76e`
  against `12f12c4` and returned **APPROVE** with no unresolved severity 1–3
  findings. `deno test --allow-read --allow-write --allow-run --allow-env
  --changed=12f12c4` passed (113 tests), `deno task a11y:gallery` passed at
  all three viewports, `deno task build` passed with only the existing
  non-blocking chunk-size warning, `deno task check` passed, `deno task lint`
  checked 207 files, and `git diff --check 12f12c4..HEAD` passed. Browser
  measurements were page width `1280/390/320` at the three viewports;
  ExpenseRow right edges were `1219/345/275px`; MoneyText local scroll/client
  widths were `444/444`, `311/300`, and `311/230`; and FilterBar remained
  contained with local segmented scrolling. Dialog Enter, date default, file
  rejection, SearchField clear, SecretField Space/Enter, Switch validation
  mapping, long ActionCard content, zero transition motion, and facade-boundary
  checks all passed. Direct axe was clean; the reviewer treated only the
  intentional focusable money scroller and fixed-overlay heuristics as
  non-findings.
- **Gate acceptance:** R-820 is approved and closed. M8-005 is the sole
  dependency-ready task and is now marked `IN_PROGRESS`.
- **Gate acceptance:** no unresolved severity 1–3 finding.

#### M8-005 — Migrate overlays, disclosure, menus, and feedback

- **Status/dependencies:** `COMPLETE`; depends on approved `R-820`.
- **Owned scope:** facade overlay and feedback primitives/patterns only.
- [x] Convert `Disclosure`, `AdaptiveDialog`, `ConfirmDialog`, `DangerDialog`,
      `Popover`, `Menu`, and `Tooltip` using public Mantine components.
- [x] Convert `Banner`, `InlineNotice`, `Toast`, `StatusMessage`, `Progress`,
      `Skeleton`, `EmptyState`, and `ErrorState`.
- [x] Use Mantine Notifications as the notification infrastructure: mount its
      provider-owned host and adapt the public `Toast`/status facade to it.
      Do not invent a repository notification manager or duplicate Mantine's
      notification primitive; preserve the facade's fixed placement, live
      region, dismiss, and undo contracts at the integration boundary.
- [x] Preserve responsive modal/sheet composition, focus trap/restoration,
      escape/cancel behavior, destructive confirmation rules, portal layering,
      fixed toast placement, live-region semantics, and approved progress-only
      motion.
- [x] Exercise nested overlay, mobile bottom navigation, long error text,
      loading/retry, reduced-motion, and dirty-form exit interactions.
- **Current task scope:** Start with an impact inventory of the current
  overlay/feedback facade implementations, their tests, provider composition,
  and notification call sites. Keep feature imports on the facade and use
  Mantine Notifications only through the provider-owned integration boundary.
- **Overlay slice evidence (2026-08-27):** The first dependency-safe slice is
  pushed at `76c5235`. `Disclosure` now uses Mantine Accordion;
  `AdaptiveDialog` uses Mantine Modal/Drawer with the existing responsive
  facade contract; and `Popover`, `Menu`, and `Tooltip` use their public
  Mantine counterparts. The slice preserves controlled disclosure/dialog
  callbacks, keyboard opening, focus restoration, portal layering, immediate
  transitions, and facade-only feature imports. The focused contract test was
  added without duplicating Mantine's upstream primitive accessibility tests.
  `deno test --allow-read --allow-write --allow-run --allow-env
  --related=src/design-system/components.tsx` passed (100 tests, 0 failures),
  `deno fmt --check` passed for the three changed files, `deno task check`,
  `deno task lint` (207 files), and `git diff --check` all passed. The
  repository is clean and `master` is aligned with `origin/master` at
  `76c5235`.
- **Exact next action:** inventory and migrate the provider-owned Mantine
  Notifications host plus `Banner`, `InlineNotice`, `Toast`, and
  `StatusMessage`; then add only the facade-boundary tests needed to prove
  live-region, dismiss, and notification integration contracts.
- **Feedback slice evidence (2026-08-27):** The provider-owned Notifications
  host and the `Banner`, `InlineNotice`, `Toast`, and `StatusMessage` facades
  are pushed at `bd5cc90`. The host owns the fixed bottom-right placement,
  toast z-layer, immediate transitions, and Mantine notification store;
  `Toast` retains a polite status live region, optional dismiss action, and
  callback boundary for undo/action content. Alert-backed notices preserve
  tone and alert/status semantics. `deno task test:affected` passed (115 tests,
  0 failures), including the Mantine compatibility suite;
  `deno task build` passed with only the existing chunk-size warning,
  `deno task fmt:check` checked 223 files, `deno task check` passed,
  `deno task lint` checked 207 files, and `git diff --check` passed. The
  repository is clean and `master` is aligned with `origin/master` at
  `bd5cc90`.
- **Exact next action:** migrate the remaining feedback facades (`Progress`,
  `Skeleton`, `EmptyState`, and `ErrorState`) to public Mantine components,
  preserving progressbar semantics, reduced-motion behavior, and long/error
  content layout; then run the affected component and feature tests.
- **Remaining feedback slice evidence (2026-08-27):** `Progress`, `Skeleton`,
  `EmptyState`, and `ErrorState` are now Mantine-backed at pushed commit
  `6c904fc`. The progress facade preserves one labeled facade-owned progressbar,
  min/max/value semantics, an indeterminate state without `aria-valuenow`, and
  Mantine's track/section rendering with zero transition duration. Skeleton is
  explicitly static; empty and error states retain their heading and long-copy
  structure. `deno task test:affected` passed (102 tests, 0 failures),
  `deno task build` passed with only the existing chunk-size warning,
  `deno task fmt:check` checked 223 files, `deno task check` passed,
  `deno task lint` checked 207 files, and `git diff --check` passed.
- **M8-005 completion:** All listed M8-005 facade conversions and the
  provider-owned notification boundary are implemented and pushed. Existing
  overlay/feature contract tests cover dirty exits, loading/retry, long error
  content, and notification/live-region behavior; combined viewport and visual
  review remains intentionally batched for `R-830` after M8-006.
- **Exact next action:** mark M8-005 complete and begin the dependency-ready
  M8-006 reusable navigation/form/filter/status inventory, starting with
  `AppFrame`, `PageHeader`, and navigation primitives.
- **Focused verification:** affected tests and a targeted overlay/focus smoke
  only when the changed behavior is unsafe to defer to `R-830`.
- **Acceptance:** no focus loss, background interaction, clipped portal,
  navigation overlap, layout shift, or decorative motion regression.

#### M8-006 — Migrate reusable navigation, form, filter, and status patterns

- **Status/dependencies:** `COMPLETE`; depends on `M8-005`.
- **Owned scope:** facade reusable patterns; no domain composites or actor
  behavior.
- **Completed task scope:** inventory the reusable facade roots, consumers, and
  tests; migrate `AppFrame`, `PageHeader`, `AppNavigation`, and
  `DefaultNavigation`, preserving screen-level contracts and responsive shell
  boundaries.
- **Shell slice evidence (2026-08-27):** `AppFrame`, `PageHeader`, and the
  `AppNavigation`/`DefaultNavigation` path now use Mantine Box and
  UnstyledButton primitives at pushed commit `7bb9e87`. Landmark structure,
  selected `aria-current`, disabled/`aria-disabled`, callback wiring, and the
  existing compact-bottom/wide-rail CSS contract are preserved. The affected
  run `deno task test:affected` passed (103 tests, 0 failures);
  `deno task check`, `deno task lint` (207 files), and `git diff --check` all
  passed. The repository is clean and aligned with `origin/master` at
  `7bb9e87`.
- **Historical implementation sequence:** the shell slice landed first, then
  the reusable list/definition/form structure (`List`, `ListRow`,
  `DefinitionList`, `FormLayout`, `FormActions`, and `ErrorSummary`), followed
  by filters, status, workflow, and sticky-action facades.
- **Reusable pattern completion evidence (2026-08-27):** The full M8-006
  reusable facade set is pushed at `a5d4b19` and `f3f2a0b`: shell/navigation,
  lists/definitions, form layout/actions, error summaries, sticky actions,
  filters/chips/sheets, status panels, draft/global status, and workflow
  progress now compose public Mantine primitives through the facade. Native
  landmarks/list/definition semantics, 44px targets, compact bottom navigation,
  wide rail layout, sticky layering, and existing screen contracts remain
  intact. The final affected run `deno task test:affected` passed (105 tests,
  0 failures); `deno task build` passed with only the existing chunk-size
  warning, `deno task fmt:check` checked 223 files, `deno task check` passed,
  `deno task lint` checked 207 files, and `git diff --check` passed.
- [x] Convert `AppFrame`, `PageHeader`, `AppNavigation`, `DefaultNavigation`,
      `List`, `ListRow`, `DefinitionList`, `StickyActionBar`, `FormLayout`,
      `FormActions`, `ErrorSummary`, `DraftStatus`, `FilterBar`,
      `ActiveFilterChips`, `FilterSheet`, `StatusPanel`, `GlobalStatus`, and
      `WorkflowProgress` to compositions of migrated facade primitives.
- [x] Preserve compact bottom navigation/safe areas, wide rail behavior, 44px
      targets, sticky/fixed layering, immediate interaction, long labels, money
      protection, pristine-form warning suppression, and cancel actions.
- [x] Do not adopt Mantine AppShell or notification managers directly in
      screens; the facade owns any use.
- **Focused verification:** affected tests and a targeted shell/responsive smoke
  only when the changed behavior is unsafe to defer to `R-830`.
- **Acceptance:** shell and reusable patterns remain screen-agnostic and meet
  all responsive/layering contracts.

#### R-830 — Overlay and reusable-pattern review checkpoint

- **Status/dependencies:** `COMPLETE`; depends on `M8-005`, `M8-006`.
- **Review attempt (2026-08-27):** Fresh read-only reviewer `01a041a5-d6f1-7762-9956-103806fb9f75`
  (`Sartre`) audited `HEAD e92c7f1` against the recorded pre-M8-005 base
  `12f12c4` and returned `BLOCK`. The review found severity-2 adaptive-dialog
  ARIA/closed-portal exposure, severity-2 mobile sticky-action overlap with
  bottom navigation, severity-2 missing explicit Cancel actions in
  `ConfirmDialog`/`DeleteAndReassign`, and severity-3 sub-44px repository-owned
  icon hit areas. It also recorded the exact evidence: affected tests passed
  (`119 passed, 0 failed`), build passed with the existing chunk warning, the
  gallery check failed on narrow adaptive-dialog ARIA/portal violations, the
  E2E command was blocked by an existing dev server on port 5173, and the
  overlay/shell matrix confirmed the 320px sticky overlap while 390px and
  1280px overlay/shell checks passed. No reviewer edits or repository changes
  were made.
- **Primary remediation (2026-08-27):** The primary agent resolved the
  severity-1–3 findings in focused pushed commits: `e65083d` hides closed
  Mantine dialog roots and removes the invalid root label, `aec0e16` lifts
  mobile sticky actions above the full bottom-navigation/safe-area region,
  `9d7477d` adds explicit Cancel contracts/actions to the shared confirmation
  facades, and `d4e21b5` restores 44px hit areas for search-clear, secret-reveal,
  and notification-dismiss actions. The direct design-system suite passed 30
  tests; `deno task test:component` passed 115 tests; `deno task a11y:gallery`
  passed all three viewports; `deno task build` passed with only the existing
  chunk-size warning; `deno task fmt:check` checked 223 files; `deno task lint`
  checked 207 files; `deno task check` and `git diff --check` passed. The
  approved E2E command was attempted again and remains blocked by the existing
  dev server on port 5173; that process was left untouched.
- **Closure review attempt (2026-08-27):** Fresh read-only reviewer
  `01a041c1-644d-76e0-82c3-dd1b31867ad9` (`Faraday`) rechecked the remediated
  batch and returned `BLOCK` for one severity-2 repository integration issue:
  the enabled `ReceiptDisclosure` “Continue to scan” action remained in normal
  flow and was covered by fixed bottom navigation at 320px. The reviewer
  otherwise confirmed the dialog/portal, sticky, and hit-area fixes, with
  gallery, build, affected tests, and 390px/1280px browser checks green; the
  approved E2E command remained blocked by the existing port-5173 dev server.
- **Closure remediation (2026-08-27):** `c3aa34a` moves the disclosure action
  into the shared `StickyActionBar`, retains the explicit disclosure Cancel
  action in the card, and adds a focused ownership assertion. The receipt suite
  passed 8 tests, `deno task test:affected` reported no additional selected
  modules, `deno task a11y:gallery` passed all three viewports, `deno task
  build` passed with only the existing chunk-size warning, `deno task fmt:check`
  checked 223 files, `deno task lint` checked 207 files, `deno task check`,
  and `git diff --check` passed. A fresh closure reviewer is still required.
- **Closure approval (2026-08-27):** Fresh read-only reviewer
  `01a041d2-2599-7592-ad6d-811184042281` (`Peirce`) audited pushed `35744b5`
  against `12f12c4` and returned `APPROVE` with no unresolved severity 1–3
  findings. The reviewer recorded 120 affected tests passed, gallery/build/
  check/lint/format/diff checks green, no facade-boundary leakage, and browser
  passes at 320x568, 390x844, and 1280x800. At 320px, the enabled receipt
  disclosure action was 48px high, inside `StickyActionBar`, outside bottom
  navigation, and a semantic click advanced correctly. The approved E2E
  command remained unavailable only because the existing port-5173 dev server
  was occupied; the known production chunk warning is non-blocking. Generic
  Mantine primitive behavior remains upstream-owned and was not duplicated.
- [x] Fresh read-only reviewer audits overlay safety, focus, live regions,
      navigation, safe areas, z-index, form/filter state, reduced motion,
      responsive behavior, and contract leakage.
- [x] From the recorded pre-`M8-005` base commit, run affected tests once with
      `deno test --allow-read --allow-write --allow-run --allow-env
      --changed=<recorded-pre-M8-005-base-commit>`,
      then run one gallery accessibility check, one production build, only
      affected approved E2E journeys, and one overlay/shell agent-browser matrix
      for the combined `M8-005`/`M8-006` batch.
- [x] Primary agent resolves severity 1–3 findings and records a pushed green
      closure before domain composites.
- **Gate acceptance:** no unresolved severity 1–3 finding.

#### M8-007 — Recompose expense, organization, and manual-entry components

- **Status/dependencies:** `COMPLETE`; depends on approved `R-830`.
- **Owned scope:** expense/project/category/manual-entry design-system
  composites and affected feature presentation only; no actor/domain changes.
- **Implementation evidence (2026-08-27):** The expense/domain slice is pushed
  at `e41ee4b`. `CurrencyPicker` now composes the migrated facade
  `SelectField` with Mantine-backed searchable selection and ISO options;
  `MoneySummary` uses the Mantine-backed facade layout root; and
  `CategoryBreakdown` composes `ListRow` so category identity and signed money
  stay inside the migrated list contract. `PeriodPicker`, `ProjectPicker`,
  `MerchantPicker`, `ExpenseRow`, `ExpenseList`, and `ExpenseForm` already
  compose the migrated facade controls/patterns; organization managers and
  deletion flows likewise remain facade-only with actor commands unchanged.
  The direct design-system suite passed 31 tests, the component/feature suite
  passed 116 tests, `deno task build` passed with only the existing chunk-size
  warning, `deno task fmt:check` checked 223 files, `deno task lint` checked 207
  files, `deno task check`, and `git diff --check` passed. No actor, domain,
  persistence, or application Mantine imports changed.
- [x] Recompose `PeriodPicker`, `ProjectPicker`, `CurrencyPicker`,
      `MerchantPicker`, `MoneySummary`, `CategoryBreakdown`, `ExpenseRow`,
      `ExpenseList`, `ExpenseForm`, and organization/deletion compositions from
      migrated facade primitives.
- [x] Preserve controlled decimal/date/time values, project/category identity,
      filter behavior, signed multi-currency presentation, reassign/delete
      safeguards, dirty state, immediate save feedback, and existing actor
      events.
- [x] Add regressions for large/negative money, long project/category/merchant
      names, empty/error/loading/filter states, keyboard entry, narrow forms,
      and populated-project deletion.
- **Focused verification:** affected tests and an immediate targeted journey or
  browser smoke only for behavior unsafe to defer to `R-840`.
- **Acceptance:** no application business logic or Mantine imports leak into
  screens, and existing actor event contracts remain unchanged.

#### M8-008 — Recompose receipt, Gemini, sync, conflict, and portability UI

- **Status/dependencies:** `COMPLETE`; depends on `M8-007`.
- **Owned scope:** remaining domain composites and affected feature presentation
  only; no actor, adapter, persistence, schema, or workflow change.
- **Impact inventory (2026-08-27):** Receipt, conflict/import, sync, and
  portability feature files already keep their field, list, notice, status,
  and workflow imports on the facade. The remaining direct component-library
  implementation in this scope is `ModelPicker` in
  `src/design-system/components.tsx`, which was migrated in this task. Receipt
  capture uses one imperative native file input for the approved camera/file
  contract; the facade `FileField`/Mantine Dropzone boundary must own that
  input while preserving `capture`, privacy-safe previews, and object-URL
  cleanup. Remaining raw feature wrappers are layout/semantic containers,
  native image preview, or CSS-required master-detail boundaries and will be
  changed only where a facade primitive can preserve their contract.
- [x] Recompose receipt source/metadata/line/editor/reconciliation components,
  model picker/quick setup/configuration test, sync/global status, known
  devices, conflict review, and import/export panels from migrated facade
  primitives.
- [x] Preserve native file/camera capture, receipt image privacy, durable
  drafts, mismatch/error states, secret handling, offline/reconnect honesty,
  opaque-ID policy, conflict neutrality, import/replace warnings, and
  destructive cancel/confirmation behavior.
- [x] Test long technical/error strings, secret reveal, model loading/failure,
  receipt line editing, conflict options, import progress/recovery, offline
  banners, focus restoration, and narrow review layouts.
- **Implementation evidence (2026-08-27):** The complete domain-composite slice
  is pushed through `c40a7ff`. `ModelPicker` now composes the Mantine-backed
  searchable `SelectField` with facade-owned status/reason rendering; receipt
  capture now uses the facade `FileField` Dropzone boundary with controlled
  camera capture, input/open refs, single-file semantics, and unchanged
  privacy-safe image lifecycle; receipt uncertainty, conflict/import warnings,
  discarded values, diagnostics, loading placeholders, master-detail,
  replacement, global sync, and portability wrappers use facade compositions.
  Known devices, receipt metadata/line/editor/reconciliation, Gemini setup and
  configuration status, and actor/event boundaries remain unchanged. No
  feature/app Mantine or React Aria imports remain; native image preview stays
  an approved privacy-preserving boundary.
- **Focused verification (2026-08-27):** Direct receipt/Gemini and design-system
  tests passed (39 tests); direct conflict/import and sync UI tests passed (24
  tests); `deno task test:affected` passed (27 tests); targeted TypeScript
  checks, `deno fmt --check`, `deno lint`, and `git diff --check` passed for
  each changed slice. The complete component/gallery/build/browser matrix is
  intentionally delegated to `R-840`.
- [x] Run affected tests and an immediate targeted journey or
  browser smoke only for behavior unsafe to defer to `R-840`.
- **Acceptance:** all remaining screens use the facade unchanged or through
  approved recorded exceptions; no product workflow semantics changed.

#### R-840 — Domain-composite review checkpoint

- **Status/dependencies:** `COMPLETE`; depends on `M8-007`, `M8-008`.
- [x] Fresh read-only reviewer traces representative actor snapshot/event paths
      through each migrated composite and audits privacy, destructive safety,
      conflict neutrality, offline honesty, accessibility, responsive layouts,
      and absence of duplicated state.
- [x] From the recorded pre-`M8-007` base commit
      `7eaa58413da2cd153b6b4ca5c865885e323699a2`, run affected tests once with
      `deno test --allow-read --allow-write --allow-run --allow-env
      --changed=7eaa58413da2cd153b6b4ca5c865885e323699a2`,
      then run one gallery accessibility check, one production build, only
      affected approved E2E journeys, and one domain-screen agent-browser matrix
      for the combined `M8-007`/`M8-008` batch.
- **Review attempt (2026-08-27):** Fresh read-only reviewer Volta
  (`01a041ee-ed38-7a91-ac35-d75d1bd6091c`) audited pushed `HEAD 3e28366` and
  returned `BLOCK`. It found severity-2 missing Cancel action in the forced
  finalization state at `src/features/destruction-ui.tsx`, a severity-2 320px
  known-device overflow caused by the retirement badge, and a severity-3 plan
  reproducibility/status mismatch. The reviewer recorded 107 passed changed
  tests, 55 passed actor/domain tests, 2 passed device-registry tests, gallery
  accessibility at all three viewports, a production build with only the
  existing chunk warning, and `git diff --check 7eaa584..HEAD` passed. The
  affected browser matrix passed the other domain/privacy/focus checks;
  Playwright E2E remained unavailable because existing Vite PID 515499 occupies
  port 5173 and was left untouched. The reviewer was closed after its report.
- **Remediation evidence (2026-08-27):** Pushed commit `5566307` adds the
  explicit Cancel action to forced finalization and a product regression
  covering both confirm/cancel callbacks. It also constrains known-device
  retirement badges to the row width with wrapping and adds narrow-layout CSS
  and DOM containment regressions. The focused destruction/sync test command
  passed (20 tests), and targeted TypeScript, format, lint, and diff checks
  passed. A fresh closure review remains required.
- **Closure review attempt (2026-08-27):** Fresh read-only reviewer Turing
  (`01a04208-7f8c-7a23-aa36-41bd370a49ee`) audited pushed `HEAD 06f0cc8` and
  returned `BLOCK`. It verified the forced-finalization Cancel and badge
  containment fixes, but found a severity-1 data-safety regression: hydrated
  known devices can be absent from the memoized live projection used by
  Delete Everywhere after sync hydration. It also found a severity-2 contract
  regression: receipt line and metadata editors have no explicit Cancel action.
  The reviewer recorded 109 changed tests, 82 targeted actor/domain/adapter
  tests, 41 related changed-file tests, 1 actor test, gallery accessibility at
  all three viewports, production build with only the existing chunk warning,
  full check/lint/format/diff success, and no direct feature/app library
  imports. Playwright E2E remained unavailable because the existing Vite server
  occupied port 5173 and was left untouched. The reviewer was closed after its
  final report.
- **Remediation evidence (2026-08-27):** Pushed commit `f5974f8` adds an
  observable revision/subscription boundary to the device registry and binds
  the runtime projection to it, so hydration, merge, touch, rename,
  acknowledgement, and import-driven registry updates are rendered from the
  live state. It adds a registry hydration/update subscription regression and
  explicit secondary Cancel actions for receipt line and metadata editors with
  no-save regressions. `deno task test:affected` passed with 61 tests, and
  targeted format, lint, and `git diff --check` passed. A fresh closure review
  remains required.
- **Closure review attempt (2026-08-27):** Fresh read-only reviewer Parfit
  (`01a04226-b3eb-71b1-8aac-28a494f4ddef`) audited pushed `HEAD 7fb3dea` and
  returned `BLOCK`. It found a severity-2 actor gap: forced finalization still
  ignores `delete-everywhere.cancel` even though the UI exposes that action.
  It also recorded severity-3 gaps for this checkpoint referring to the
  pre-review plan commit rather than actual `HEAD 7fb3dea`, and for lacking a
  runtime-boundary regression that proves hydrated/merged registry devices
  render and feed Delete Everywhere counts. The reviewer verified the
  registry subscription implementation and receipt Cancel behavior, and
  recorded 29 relevant UI/registry tests, 16 actor/domain tests, 20 adapter
  integrations, 43 destruction/import actor-contract tests, 10 import-export
  integration tests, frozen audit, TypeScript, format, lint, build, gallery at
  all three viewports, and diff checks as passing. Playwright E2E remained
  unavailable because the existing Vite server occupied port 5173 and was
  left untouched. The reviewer was closed after its final report.
- **Remediation evidence (2026-08-27):** Pushed commit `ba70363` adds the
  missing `delete-everywhere.cancel` transition in forced finalization and an
  actor regression proving that cancellation reaches the terminal handoff. It
  centralizes the runtime's Delete Everywhere device-count calculation and
  adds a runtime-boundary regression that hydrates a persisted two-device
  registry, renders both devices through `SyncPortabilityRuntime`, and checks
  the production progress calculation. `deno task test:affected` passed with
  124 tests; targeted format, lint, and `git diff --check` passed. A fresh
  closure review remains required.
- **Closure review attempt (2026-08-27):** Fresh read-only reviewer Meitner
  (`01a04235-7b8a-7a01-b2fd-b46b629ff8d9`) audited pushed `HEAD 0ae49b3` and
  returned `BLOCK`. It confirmed the actor, live projection, receipt Cancel,
  privacy, responsive, and accessibility findings were resolved, but found
  two severity-3 gaps: the checkpoint described implementation `HEAD ba70363`
  instead of the actual plan commit `0ae49b3`, and the runtime regression
  asserted Delete Everywhere progress from the seed registry rather than
  through the mounted runtime gate. It recorded 213 changed tests, 134
  actor/domain/adapter checks, 21 runtime/receipt checks, frozen audit,
  TypeScript, format, lint, build, gallery at all three viewports, direct
  privacy/receipt browser smoke, and diff checks as passing. Playwright E2E
  remained unavailable because the existing Vite server occupied port 5173
  and was left untouched. The reviewer was closed after its final report.
- **Remediation evidence (2026-08-27):** Pushed commit `691ce2e` moves the
  runtime component regression into a dedicated boundary test and makes its
  Delete Everywhere assertion consume the two device rows rendered by the
  mounted `SyncPortabilityRuntime`, rather than the seed registry. The same
  rendered projection is checked through the production known-device and
  acknowledgement progress calculation. The runtime boundary and existing
  runtime tests passed (`11` tests), with targeted format, lint, and
  `git diff --check` passing. A fresh closure review remains required.
- **Closure review attempt (2026-08-27):** Fresh read-only reviewer Heisenberg
  (`01a04243-9b93-7043-9579-1ee5be6e933b`) audited the current pushed
  checkpoint and returned `BLOCK` only for a severity-3 bookkeeping issue:
  this document named the preceding implementation commit rather than the
  plan commit that followed it. The reviewer confirmed all substantive R-840
  findings were resolved, including live registry invalidation, Delete
  Everywhere count and acknowledgement wiring, forced-finalization Cancel,
  receipt editor Cancel actions, and the mounted runtime regression. It found
  no responsive, privacy, accessibility, Mantine-boundary, or actor/domain/
  adapter drift. Its targeted actor/domain/adapter/runtime/UI checks passed
  (72 tests), as did the affected selector (no affected tests), TypeScript,
  format, lint, frozen audit, build, gallery at all three viewports, browser
  tooling, and diff checks. Playwright E2E remained unavailable because the
  existing Vite server occupied port 5173 and was left untouched. The
  reviewer was closed after its final report.
- **Final closure reconciliation (2026-08-27):** Sagan's final independent
  review found no source-level R-840 defect and only requested that this
  checkpoint stop describing the already-pushed bookkeeping remediation as
  pending. This plan update makes that correction, marks the primary-agent
  remediation complete, and satisfies the gate: no unresolved severity 1–3
  finding or actor/domain/adapter contract drift remains.
- [x] Primary agent resolves severity 1–3 findings and reruns only checks
      affected by those fixes. Repeat the complete checkpoint matrix only when
      shared or cross-cutting code changed before closure.
- **Gate acceptance:** no unresolved severity 1–3 finding and no actor/domain/
  adapter contract drift.

#### M8-009 — Remove superseded implementation and enforce boundaries

- **Status/dependencies:** `COMPLETE`; depends on approved `R-840`.
- **Owned scope:** design-system implementation/CSS, dependency configuration,
  static boundary checks, tests, and documentation; no visual redesign.
- [x] Verify every migration-matrix row is complete, then remove all
      `react-aria-components` imports and its pinned dependency. The public
      matrix now labels the historical column `Pre-M8 backing`; the dependency
      and its transitive lock entries are absent from `deno.json` and
      `deno.lock`, including the old toolchain proof.
- [x] Delete only CSS selectors and helper code proven unused by searches,
      coverage, gallery, build, and screen inspection; preserve semantic tokens
      and feature styles still carrying product layout. The selector audit
      returned no CSS class present only in CSS after removal; no helper had an
      unused import/reference signal, so no speculative helper deletion was
      made. Existing R-840 gallery/screen evidence and the current design-system
      fixture/build checks cover the retained styling boundary.
- [x] Split the monolithic design-system module into facade-owned modules only
      if this improves reviewability without changing the public barrel or
      creating library-specific imports in screens. No split was warranted in
      this cleanup: the public barrel is unchanged and all library details
      remain localized to the existing facade/provider boundary.
- [x] Add an automated boundary check that fails on `@mantine/*` or component-
      library imports outside approved design-system/provider files, Mantine
      types in public exports, and reintroduction of React Aria. The new
      `scripts/verify-design-system-boundary.ts` task scans application and
      toolchain source, the public barrel, import map, and lockfile.
- [x] Run dependency/license/security checks and update third-party notices and
      architecture documentation. React Aria was removed from the notices;
      Mantine and Day.js are recorded as current production dependencies, and
      the architecture document now distinguishes historical React Aria
      inventory from current Mantine backing.
- **Focused verification (2026-08-27):** `deno task
  verify:design-system-boundary` passed across 167 source files;
  `deno test --allow-read --allow-write --allow-run --allow-env
  src/design-system/design-system.test.tsx
  src/design-system/mantine-compatibility.test.tsx` passed 39 tests;
  `deno test --allow-read --allow-write --allow-run --allow-env
  spikes/toolchain/tests/toolchain_test.tsx` passed 2 tests;
  `deno task test:affected` found no affected test modules; `deno task check`,
  `deno task lint`, `deno audit --frozen`, `deno task build`, and
  `deno task verify:mantine-compatibility` passed; `git diff --check` passed.
  The final gallery/a11y/browser and complete repository matrix belongs to
  `M8-010`.
- **Acceptance:** one maintained low-level library remains, no copied or dead
  implementation survives, and future replacement remains localized behind the
  facade.

#### M8-010 — Full migration regression, visual closure, and handoff

- **Status/dependencies:** `COMPLETE`; depends on `M8-009`.
- **Owned scope:** regression fixes within M8 ownership, gallery/fixtures,
  documentation, and ledger evidence; no new feature or redesign.
- [x] Run `deno task verify` from a clean working tree. The final corrected
      checkpoint passed the complete canonical static, Deno test, E2E,
      gallery/a11y, browser-tooling, Pages, CI, toolchain, build, audit, and
      diff matrix: 363 Deno tests, 11 E2E journeys, gallery/axe at 320x568,
      390x844, and 1280x800, browser visual/tree/axe smoke, boundary scan,
      both production builds, Pages artifact verification, and no known audit
      vulnerabilities. The first attempt was blocked by the occupied local
      Vite port; after enabling safe existing-server reuse, the only stale
      receipt journey locators were updated, and the post-Confucius feature-CSS
      remediation rerun passed at `05b46a3`.
- [x] Re-ran the complete canonical gate after the Descartes remediation from
      pushed `8dca502`. The gate passed with 365 Deno tests, 11 E2E journeys,
      gallery/axe at 320x568, 390x844, and 1280x800, browser visual/tree/axe
      smoke, CI/toolchain checks, boundary verification across 167 source
      files, both production builds, Pages artifact verification, frozen audit
      with no known vulnerabilities, and `git diff --check`. The app build
      receipt was 1,181.63 kB JavaScript / 290.94 kB CSS (325.64 kB / 42.89 kB
      gzip); Automerge WASM was 3,571.25 kB (1,138.81 kB gzip).
- [x] Re-ran the complete canonical gate after the Kuhn remediation from
      pushed `03e9f21`. The gate passed with 365 Deno tests, 11 E2E journeys,
      gallery/axe at 320x568, 390x844, and 1280x800 including the opened-menu
      check, browser visual/tree/axe smoke, CI/toolchain checks, boundary
      verification across 167 source files, production and Mantine proof
      builds, production Mantine/CSP browser smoke, Pages artifact
      verification, frozen audit with no known vulnerabilities, and
      `git diff --check`. The app build remained 1,181.63 kB JavaScript /
      290.94 kB CSS (325.64 kB / 42.89 kB gzip); Automerge WASM remained
      3,571.25 kB (1,138.81 kB gzip).
- [x] Inspect the gallery and every approved screen/state at `320x568`,
      `390x844`, and `1280x800` with agent-browser, including keyboard,
      accessibility tree/axe, long content, large money, empty/loading/offline/
      error/conflict/destructive states, overlays, reduced motion, and safe
      areas. The named gallery/browser inspections passed, and the existing
      feature/component/E2E state matrix passed without a visual or semantic
      regression; no new product styling was introduced by M8-009.
- [x] Compare production bundle evidence with the M8-002 baseline and explain
      material growth; fix accidental duplication or imports. The final app
      build at the latest gate is `1,181.63 kB` JavaScript / `290.94 kB` CSS
      (`325.64 kB` / `42.89 kB` gzip), versus the unchanged pre-Mantine
      baseline of
      `1,038,625` JavaScript bytes / `30,076` CSS bytes (`284.90 kB` /
      `5.78 kB` gzip). The expected increase is Mantine's maintained runtime
      and layered component CSS; the boundary scan found no accidental library
      imports in screens and the isolated proof retained one tree-shaken entry.
      The earlier `1,180.87`/`325.39`, `02edfb9` `290.76`/`42.88`, and
      `3b94827` `290.84`/`42.90` receipts were from earlier builds; the exact
      current output is from the final `03e9f21` gate.
- [x] Reconcile `UI_SPEC.md`, `DESIGN_SYSTEM.md`, `AGENTS.md`, README/licenses,
      gallery, tests, migration matrix, and actual implementation. The public
      barrel remains facade-only; the design-system document now marks React
      Aria as historical, third-party notices list Mantine/Day.js, notifications
      remain Mantine-owned, and the gallery/tests exercise the current facade.
- [x] Record exact final evidence, remaining accepted limitations (owner
      approval required), commits, clean status, and rollback/recovery notes.
      The E2E runner fix is pushed at `2873dfe`, the receipt journey contract
      fix at `2189863`, the scoped conflict-journey timeout is pushed at
      `d792cd1`, and the post-remediation canonical gate is green at
      `02edfb9`. The latest gate after the Kuhn remediation passed at
      `03e9f21` with 365 Deno tests, 11 E2E journeys, gallery/axe at three
      viewports including the opened-menu check, browser/toolchain/CI checks,
      the strengthened boundary scan, production and Mantine proof builds,
      production Mantine/CSP browser smoke, Pages artifact verification,
      frozen audit, and diff checks.
      No unresolved M8 limitation requires
      owner acceptance;
      rollback remains ordinary revert of the focused commits, with all prior
      worktrees preserved untouched.
- **Acceptance:** canonical verification is green, visual/state matrix has no
  unresolved regression, documentation matches code, and repository/upstream are
  aligned and clean.

#### R-850 — Final independent Mantine migration review

- **Status/dependencies:** `IN_PROGRESS`; depends on `M8-010`.
- **Fresh closure review evidence (2026-08-27):** Fresh read-only reviewer
  Newton (`01a04291-06c8-7940-bf67-a403c1ab173b`) audited pushed `HEAD
  669ec3d` and returned `BLOCK` with three findings: the checkpoint still
  described the post-remediation canonical gate as pending despite its green
  result; the migration documentation omitted the two provider exports,
  named nonexistent `ComboBoxField`, and misstated direct-import consumers;
  and the gallery used `aria-label` on a focusable generic `div` without a
  supported role. Its independent risk-selected verification passed the
  boundary scan, 41 focused design-system/Mantine/API tests, 113 affected
  tests, TypeScript, lint, format, frozen audit, builds, gallery at three
  viewports, and browser checks. Newton was closed after its report.
- **Initial review evidence (2026-08-27):** Fresh read-only reviewer Hooke
  (`01a04265-fa88-7273-ba37-0497183358a8`) audited pushed `HEAD 41c6586` and
  returned `BLOCK` with two substantive findings and one stale-checkpoint
  finding. The severity-2 contract finding was that `SelectField` discarded
  `isOpen`/`onOpenChange` and the shared controls discarded
  `validationBehavior`; the severity-3 boundary finding was that the verifier
  inspected only barrel text and not the star-exported declaration source; the
  remaining severity-3 finding was that the checkpoint contradicted the
  already-complete M8-010 section. Its risk-selected matrix otherwise passed:
  40 focused design-system/Mantine/API tests, TypeScript, lint, format,
  frozen audit, Mantine compatibility/prod builds, gallery/axe at three
  viewports, browser tooling, 11 Playwright journeys, app/browser checks, and
  a clean aligned Git state. The completed reviewer was closed after its
  report.
- **Primary remediation evidence (2026-08-27):** Pushed `171d700` translates
  facade validation behavior to native `required` or `aria-required`, wires
  Select open state and callbacks to Mantine's dropdown API, preserves
  composite validation semantics, adds focused Select/native/ARIA regressions,
  and makes the boundary verifier inspect exported declaration slices behind
  the public star barrel. The affected selector passed with 113 tests;
  `deno task check`, `deno task lint`, boundary verification across 167 source
  files, and diff checks passed. Pushed `d792cd1` gives only the known
  conflict-resolution journey an explicit 60-second timeout after repeated
  full-suite timing pressure; the complete E2E suite passed all 11 journeys.
  The first post-remediation canonical run reached 362 Deno tests but had the
  same conflict journey timeout; its isolated rerun passed 1/1. The subsequent
  complete gate passed at `669ec3d`, and the final gate after the
  documentation/gallery remediation passed at `02edfb9`.
- **Primary remediation evidence after Newton (2026-08-27):** Pushed
  `02edfb9` reconciles the public matrix with the 151 component declarations
  plus the two provider exports, records the twelve barrel consumers and
  intentional provider/fixture imports, removes stale `ComboBoxField` claims,
  and gives the gallery's focusable money fixture the supported `group` role.
  `deno task a11y:gallery`, `deno task check`, `deno task lint`, focused
  boundary verification, and `git diff --check` passed. The final canonical
  gate passed on the same pushed commit with 362 Deno tests, 11 E2E journeys,
  gallery/axe at three viewports, browser/toolchain/CI checks, the strengthened
  boundary scan, both builds, Pages artifact verification, frozen audit, and
  diff checks.
- **Fresh closure review evidence (2026-08-27):** Fresh read-only reviewer
  Herschel (`01a042a8-e883-7263-b58b-d0f637a325e7`) audited pushed `HEAD
  87ebe4b` and returned `BLOCK` with one severity-2 semantic-token finding
  and two severity-3 findings: the danger button foreground hard-coded
  `#241113` despite the semantic-token contract; navigation used an arbitrary
  `2px` gap despite the named 4px spacing scale; and M8-010 contained stale
  test/build receipt values. Herschel otherwise verified the aligned clean
  state, boundary scan, focused suites, gallery/axe, E2E, builds, and audit;
  the reviewer was closed after its report. The primary agent owns these
  contained remediations and must add focused contrast/token coverage before
  requesting closure again.
- **Primary remediation evidence after Herschel (2026-08-27):** Pushed
  `3b94827` replaces the danger button's hard-coded foreground with the
  documented `on-danger` token, maps it to `MarkText` in forced colors, and
  replaces the navigation's arbitrary `2px` gap with `var(--space-1)`. The
  design-system documentation now lists the token and its contrast contract;
  the owned CSS test calculates 4.5:1 contrast for documented foreground
  pairs and locks both token usages. The focused design-system suite and
  `deno task test:affected` passed 32 tests; `deno task check`, `deno task
  lint`, frozen audit, and diff checks passed. The complete canonical gate on
  `3b94827` passed 362 Deno tests, 11 E2E journeys, gallery/axe at three
  viewports, browser/toolchain/CI checks, the strengthened boundary scan, both
  builds, Pages artifact verification, frozen audit, and diff checks.
- **Fresh closure review evidence (2026-08-27):** Fresh read-only reviewer
  Confucius (`01a042c2-99cb-7272-9946-76525b4e8f75`) audited pushed `HEAD
  47568cc` and returned `BLOCK` with one severity-2 and three severity-3
  findings: compact feature navigation still used `gap: 0`, feature overlay
  CSS hard-coded `z-index: 40`, the receipt preview referenced undefined
  `var(--surface-2)` instead of `var(--color-surface-2)`, and the checkpoint
  still said remediation was active after the previous fix and canonical gate.
  Its independent risk-selected verification passed the boundary scan, focused
  suites, TypeScript, lint, audit, builds, gallery/axe, E2E, compatibility,
  and diff checks. Confucius was closed after its report. The primary agent
  owns these feature-CSS and checkpoint remediations and must request another
  fresh closure review after the next canonical gate.
- **Primary remediation evidence after Confucius (2026-08-27):** Pushed
  `05b46a3` replaces the invalid receipt-preview surface token with
  `var(--color-surface-2)`, maps the feature overlay to `var(--layer-overlay)`,
  and keeps compact navigation at the named `var(--space-1)` gap. The new
  local UI CSS contract test passed with the complete local UI suite at 18
  tests; `deno task test:affected` also passed 18 tests, and TypeScript, lint,
  frozen audit, and diff checks passed. The complete canonical gate passed on
  `05b46a3` with 363 Deno tests, 11 E2E journeys, gallery/axe at three
  viewports, browser/toolchain/CI checks, the strengthened boundary scan, both
  builds, Pages artifact verification, frozen audit, and diff checks.
- **Fresh closure review evidence (2026-08-27):** Fresh read-only reviewer
  Descartes (`01a042d7-b896-7961-8ae4-7eea0b349ba5`) audited pushed `HEAD
  43f346e` and returned `BLOCK` with three severity-2 and two severity-3
  findings: compact shared dialogs lacked bottom safe-area clearance; receipt
  scan failure cleared the image and disabled Retry; typed destructive dialog
  confirmation persisted after cancel/reopen; `Inline` and `ResponsiveGrid`
  dropped public layout refs/ARIA props; and the dirty-update reload action
  remained enabled. Its independent risk-selected verification passed the
  boundary scan, 41 design-system/Mantine/API tests, 18 local UI tests, 24
  receipt/actor/integration tests, TypeScript, lint, builds, gallery/axe,
  browser checks, E2E, audit, and diff checks. Descartes was closed after its
  report. The primary agent owns these five contract remediations and must
  request another fresh closure review after the next canonical gate.
- **Primary remediation evidence after Descartes (2026-08-27):** Pushed
  `b9a6835` adds compact-dialog bottom safe-area clearance, preserves public
  `Inline`/`ResponsiveGrid` refs and ARIA/data props, and resets typed danger
  confirmation on every reopen, with focused component and CSS regressions.
  Pushed `d3e9d57` retains the receipt's ephemeral source file for an in-session
  retry while releasing decoded bytes, updates the privacy copy, and adds the
  store regression. Pushed `4dac785` disables the update reload action while
  dirty and adds the component regression. Pushed `8dca502` dispatches the
  state-machine `receipt.retry` event from the failed-state Retry action and
  updates the two affected E2E contracts. Focused UI/receipt/actor tests passed
  71 tests in total; the focused offline-update and receipt-review journeys
  passed 2/2; the complete canonical gate then passed from `8dca502` with the
  evidence recorded in M8-010 above.
- **Fresh closure review evidence (2026-08-27):** Fresh read-only reviewer
  Kuhn (`01a042f7-4190-7351-8001-8753138d93dc`) audited pushed `HEAD
  916bbc1` and returned `BLOCK` with two severity-2 findings and one
  severity-3 checkpoint finding. The production CSP's `style-src 'self'`
  blocks nonce-less Mantine runtime style blocks, leaving Mantine semantic
  variables ineffective in the built artifact; and opening `Menu` exposes a
  critical axe `aria-required-children` violation from Mantine's focus
  placeholder. Kuhn independently verified the boundary, tests, E2E, gallery,
  builds, Pages, audit, and clean alignment. Kuhn was closed after the report;
  the primary agent owns the CSP/menu remediations and must record the plan
  commit in the next checkpoint before requesting another fresh review.
- **Primary remediation evidence after Kuhn (2026-08-27):** Pushed `03e9f21`
  scopes CSP's inline-style allowance to Mantine's nonce-less runtime style
  blocks while keeping script execution strict, disables the Mantine menu
  focus placeholder/focus trap that created the invalid presentation child,
  adds opened-menu axe coverage to the gallery check, and adds a production
  browser smoke that verifies runtime variables and control styles under the
  built CSP. The design-system suite passed 33 tests; gallery/axe, production
  browser smoke, Pages artifact verification, lint, type-check, format, and
  diff checks passed; the complete canonical gate passed from `03e9f21` with
  the evidence recorded in M8-010 above.
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

- **Plan state:** Released baseline through `R-700`, `M8-001`, `M8-002`,
  `R-810`, `M8-003`, `M8-004`, `R-820`, `M8-005`, `M8-006`, and `R-830` are
  `COMPLETE`; `M8-007`, `M8-008`, and `R-840` are `COMPLETE`; `M8-009` is
  `COMPLETE`; `M8-010` is `COMPLETE`; `R-850` is `IN_PROGRESS` with all five
  Descartes findings are remediated; Kuhn's two severity-2 findings are
  remediated and a fresh closure review is pending.
- **Reconciled branch/upstream:** `master` is aligned with `origin/master` at
  pushed `03e9f21`.
- **Owner authorization:** The owner approved Mantine as the migration target
  and explicitly authorized autonomous implementation of all M8 tasks.
- **Worktree state:** `master` is aligned with `origin/master` at the current
  pushed checkpoint `03e9f21`, with the implementation batch, R-830 remediations,
  R-840 closure fixes, and M8-009 cleanup pushed; R-830, R-840, and M8-009 are
  complete. R-820 is approved and closed, and M8-005 and M8-006 are complete.
  The initial R-850 reviewer is closed; no migration branch or M8 worktree is
  active; historical non-M8 worktrees remain present and were preserved
  untouched. R-840 and M8-010 are complete, and the Confucius remediation is
  pushed at `05b46a3`; the fresh Confucius closure review is closed and its
  findings are remediated below; Descartes's fresh closure review is closed;
  Descartes's five findings are remediated in `b9a6835`, `d3e9d57`, `4dac785`,
  and `8dca502`; no implementation or review worktree is active and no M8
  change is unpushed.
- **Verification status:** The released baseline's revised non-duplicating
  `deno task verify` passed at commit `ee9f4fd` (331 Deno tests, 11 E2E tests,
  gallery/axe at three viewports, browser/toolchain checks, one build, Pages
  artifact inspection, frozen audit, and diff check). M8-001 evidence is
  recorded above for pushed commit `3726591`. M8-002's extended compatibility
  evidence is green, including the preferred date/time/file candidates,
  Dropzone, builds, artifact verifier, affected tests, and Chromium proof. M8-003
  is now pushed and green: its provider, style entry, structural facade
  wrappers, token layers, gallery, and component harness passed the recorded
  checks above. M8-004 is now pushed and green at `eaa02d7`: Mantine-backed
  buttons, fields, choices, dates, times, and Dropzone preserve facade
  contracts; `deno task test:affected` passed with 109 tests before the final
  assertion-only additions, and `deno task test:component` passed with 105
  tests afterward. M8-009 is pushed and green: the boundary verifier passed
  across 167 source files; the design-system and Mantine compatibility suites
  passed 39 tests; the toolchain proof passed 2 tests; affected-test selection
  reported no affected modules; strict TypeScript, lint, frozen audit, app and
  Mantine proof builds, and diff checks passed. The CSS selector audit found no
  remaining selector referenced only by CSS, and third-party notices and
  architecture documentation match the dependency state.
- **M8 active/interrupted work:** M8-002 is complete and pushed at `12f12c4`;
  R-810 was approved by the fresh read-only reviewer with no findings and is
  closed at `492d9c1`. M8-003 is complete and pushed at `18bac20`; M8-004 is
  complete and pushed at `eaa02d7`; the fifth R-820 fix is pushed at `5f765d1`
  and the gallery-track fix is pushed at `2806236`, with evidence recorded
  above; the latest R-820 closure review is complete at `447b8e9` with the
  single finding resolved by `2806236`; R-820 remains owned by the primary
  agent; the latest closure review approved R-820 at `221f76e` with all
  evidence recorded above; M8-005 is complete; its overlay slice is pushed at
  `76c5235`, notification feedback at `bd5cc90`, and remaining feedback at
  `6c904fc`; M8-006 is pushed through shell `7bb9e87`, list/form/status
  `f3f2a0b`, and final sticky-action `a5d4b19`; the first R-830 review by
  `Sartre`, `Faraday`, and `Peirce` are closed with R-830 approved and all
  severity-1–3 findings resolved; M8-007 is complete at `e41ee4b`; M8-009 is
  complete with the React Aria dependency removal, dead-selector cleanup,
  boundary task, and documentation evidence above; the initial R-850 reviewer
  is closed; the fresh Newton closure reviewer is closed; Herschel's fresh
  closure review is also closed and its three findings are remediated at
  `3b94827`; Confucius's fresh closure review is closed and its four findings
  are remediated at `05b46a3`; the latest canonical gate is recorded above and
  Descartes's five findings are remediated; Kuhn's CSP/menu findings are
  remediated and await fresh closure review; no migration
  branch or M8 worktree is active; historical non-M8 worktrees were preserved
  untouched. R-840 and M8-010 are complete.
  The final canonical gate passed at `03e9f21`; no implementation or
  documentation change is unpushed.
- **Exact next action:** request a new independent R-850 closure review from a
  reviewer not previously used for this gate. Do not reuse Hooke, Newton,
  Herschel, Confucius, Descartes, or Kuhn for closure approval.

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
