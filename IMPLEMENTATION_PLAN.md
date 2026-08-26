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

## Approved MVP Boundary

The MVP is a local-first, dark-theme React PWA hosted at the repository's
standard GitHub Pages path. Deno 2 executes every project toolchain and task;
source and tests use strict `typescript@7`. IndexedDB is repository-namespaced.
XState v5 actors own behavioral modes and workflows; React renders actor
snapshots and dispatches domain events. A backend is excluded unless an agreed
requirement later proves impossible in the browser, in which case only Deno
Deploy may be proposed and owner approval is required.

The delivered product includes:

- project-scoped signed multi-currency expense records, customizable global
  categories, manual create/edit/delete, receipt parents and independently
  editable lines, filtering/search/sorting, and per-currency totals;
- camera/file receipt capture, ephemeral image preparation and metadata
  sanitization, schema-constrained Gemini extraction, durable structured review
  drafts, atomic reviewed saves, and device-local API-key/model configuration;
- versioned JSON import/export, Automerge-backed local data and causal merge,
  Google Drive app-data synchronization, known devices, explicit conflict
  review, offline replay, project deletion, disconnect, and Delete Everywhere;
- the approved responsive screens, comfortable dark design system, immediate
  interactions, accessible semantics, offline/install/update behavior, and
  GitHub Pages deployment; and
- unit, XState actor, adapter integration, component, minimal E2E,
  accessibility, and agent-driven visual verification at the agreed gates.

Explicitly deferred: CSV, tags, income-specific UI, charts/comparisons/trends,
cross-currency conversion, reporting/domestic currency, historical exchange
rates, light-theme implementation or theme switching, custom domains, receipt
image retention, tax/VAT fields, generic payment/address/receipt-number fields,
automatic receipt redaction, rolling date periods, tutorials, speculative
automation/LLM app control, and per-record physical Automerge-history erasure.

## Architecture and Ownership Baseline

The first foundation task may refine names but not blur these boundaries:

```text
src/
|-- app/                 composition, routing, providers, shell
|-- actors/              XState v5 machines, actor protocols, persistence hooks
|-- domain/              schemas, money, records, selectors, migrations, import
|-- adapters/            IndexedDB/Automerge, Drive, Gemini, browser/PWA ports
|-- features/            screen-level feature composition
|-- design-system/       tokens, primitives, patterns, gallery
`-- test-support/        deterministic clocks, IDs, fixtures, fake adapters
e2e/                     minimal browser journeys only
scripts/                 Deno-run installation/build/release verification
spikes/                  compatibility evidence; removed or retained as docs
```

Dependency direction is `features/app -> actors -> domain + adapter ports`.
Concrete adapters implement ports and do not leak service SDK types into domain
records or UI. Design-system primitives contain no expense/sync business rules.
Actors model finite modes as states, derive UI through `matches`, tags, `can`,
and selectors, and persist resumable snapshots with XState v5 persisted-snapshot
APIs rather than reconstructing partial context manually. Simple pure derived
state stays in domain functions; it does not become a machine merely to claim
XState coverage.

Contract files become integration boundaries after `R-200`. Later workers must
not change a locked schema, event, port, or reusable component contract without
an explicit plan update, impact list, and integration-owner approval.

## Definition of Done

The MVP is complete only when all of the following are true:

1. Every task through `R-700` is `COMPLETE`; no required behavior is represented
   only by a TODO, mock in production, skipped test, or undocumented manual
   step.
2. `deno task verify` passes from a clean clone using the pinned Deno and
   lockfile state. Its test phase runs each discovered Deno test module once;
   the gate must not follow the umbrella test task by rerunning its overlapping
   component, integration, domain, or actor subsets. The five approved E2E
   journeys also pass at the final gate.
3. The five approved E2E journeys pass with deterministic fake external
   services. Lower-layer suites prove merge, retry, cancellation, migration,
   deletion, and validation detail without duplicating them in E2E.
4. `agent-browser` Chromium inspection covers the component gallery and every
   approved screen at `320x568`, `390x844`, and `1280x800` where relevant,
   including keyboard, accessibility tree, empty/loading/offline/error/conflict,
   large-value/long-label, and destructive states. Findings are fixed and
   rechecked; screenshots containing secrets or personal data are forbidden.
5. WCAG 2.2 AA requirements in the specifications pass automated and manual
   checks. Ordinary transitions remain `0ms`; functional progress remains
   understandable with reduced motion.
6. A production build works under the repository base path, hash-route refresh,
   repository-scoped service worker, offline relaunch, explicit update reload,
   and the supported browser policy.
7. Canonical JSON schema documentation, migrations, third-party notices,
   privacy/disclosure text, and operational instructions match the code.
8. No live credential is required by CI; no key, OAuth token, receipt image,
   financial fixture derived from private data, or browser profile is committed
   or printed in logs.
9. The final independent review finds no unresolved severity-1 or severity-2
   issue, all scoped fixes pass full verification, the ledger matches Git/test
   reality, and the release commit is pushed.

## Dependency Graph and Ordered Milestones

```text
P-000
  |
  +--> F-001 ----> F-004 ----> F-005 ----> R-100
  +--> F-002 -------^             ^
  `--> F-003 -------+-------------'
                                  |
                              D-101
                            /   |   \
                       D-102  D-103  U-104
                          \     |     /
                              R-200
                     _________/ | \_________
                    /           |           \
                L-201        L-203        A-301/S-401
                  |             |               |
                L-202 ------> L-204             |
                   \           /                |
                     L-205 --> R-300             |
                               |                 |
                         A-302 -> A-303 -> R-400 |
                                                 |
                         S-401 -> S-402 -> S-403 |
                                      \-> S-404  |
                               S-403/S-404 -> S-405 -> R-500
                                                   |
                              X-501 -> X-502 -> P-503 -> R-600
                                                   |
                              Q-601 -> Q-602 -> Q-603 -> Q-604 -> R-700
```

Cross-links omitted from the drawing remain explicit in each task. Milestones:

1. `M0 Specification`: `P-000` and independent documentation review.
2. `M1 Feasibility/Foundation`: `F-001`–`F-005`, then `R-100`.
3. `M2 Contracts/Design System`: `D-101`–`U-104`, then `R-200`.
4. `M3 Local Vertical Slice`: `L-201`–`L-205`, then `R-300`.
5. `M4 Receipt Intelligence`: `A-301`–`A-303`, then `R-400`.
6. `M5 Synchronization/Portability`: `S-401`–`S-405`, then `R-500`.
7. `M6 Destruction/PWA Completion`: `X-501`–`P-503`, then `R-600`.
8. `M7 Hardening/Release`: `Q-601`–`Q-604`, then `R-700`.
9. `M8 Mantine Migration`: `M8-001`–`M8-010`, with review checkpoints
   `R-810`–`R-850`. M8 is sequential and single-implementer by design.

## Task Ledger

### M0 — Specification

#### P-000 — Freeze coherent approved documentation

- **Status/dependencies:** `COMPLETE`; no dependencies. Draft `e9e0822`, review
  fixes `5165d60`, and independent closure verification are pushed/recorded.
- **Ownership:** `SPEC.md`, `UI_SPEC.md`, `DESIGN_SYSTEM.md`, `AGENTS.md`,
  `README.md`, and this file only.
- **Scope/non-goals:** create this executable plan, obtain an independent
  review, and fix documentation contradictions. No application code, dependency
  setup, spike, or deployment.
- **Outputs/acceptance:** all six documents agree; open items are technical
  compatibility outputs assigned below rather than unowned product decisions;
  plan includes stable tasks, gates, tests, ownership, and resume prompt.
- **Tests:** documentation link/path checks, heading/task-ID uniqueness, and
  human coherence review; no application test.
- **Verification:** `git diff --check`;
  `rg '^(#### [A-Z]-[0-9]{3})' IMPLEMENTATION_PLAN.md`; inspect
  `git status --short --branch`; independent review report resolved.

### M1 — Feasibility and Foundation

#### F-001 — Prove and pin the Deno frontend/test toolchain

- **Status/dependencies:** `COMPLETE`; depends on `P-000`. Worker commit
  `96240de` was integrated by `db1d9b4`; the required foundation validations
  passed from `master`.
- **Ownership:** `spikes/toolchain/**`, `deno.json`, `deno.lock`, toolchain-only
  scripts and a compatibility decision record; no product feature source.
- **Scope/non-goals:** prove Deno 2 execution of strict `typescript@7`, React,
  XState v5/React bindings, React Aria Components, Lucide, Zod 4, `big.js`, the
  selected browser build/PWA tooling, `deno test`, Testing Library plus
  `happy-dom`, and a real E2E dependency. Provisional E2E choice is Playwright,
  executed only through `deno task`; `agent-browser` remains a separate agent
  visual/a11y tool. Do not build app behavior.
- **Outputs/acceptance:** pinned versions/lockfile; exact canonical task
  commands; a self-contained spike compile/render/actor/component/browser proof
  which does not depend on the later production harness; documented fallback
  selected only if Playwright cannot run reproducibly without a Node/npm project
  toolchain.
- **Tests:** strict compile failure fixture, XState actor transition, React Aria
  render/event, Testing Library role query, and one Playwright smoke page.
- **Verification:** historically, the complete F-001 gate ran every disposable
  spike proof. The retained `deno task verify:toolchain` now checks only its
  unique pinned TypeScript-version and expected strict-failure invariants; the
  canonical `deno task verify` owns formatting, lint, compile, tests, E2E,
  browser tooling, and build without invoking them twice; `git diff --check`.

#### F-002 — Prove Automerge and IndexedDB semantics

- **Status/dependencies:** `COMPLETE`; depends on `P-000`. Worker commit
  `bec8d08` was integrated by `59efed5`; the required foundation validations
  passed from `master`.
- **Ownership:** `spikes/automerge/**` and its decision record only.
- **Scope/non-goals:** test current Automerge with Deno/browser build,
  repository-namespaced IndexedDB, stable IDs/decimal strings, concurrent edits,
  conflicts, tombstones, delete-versus-edit, resolution revisions, offline
  replay, generation retirement, export projection, and fake-Drive round trip.
  Do not evaluate a second CRDT unless a recorded required case fails.
- **Outputs/acceptance:** executable compatibility matrix and pass/fail
  evidence; chosen Automerge APIs and limitations; alternative-evaluation task
  proposed only on failure and marked owner-visible before architecture changes.
- **Tests:** one deterministic test per required merge primitive, two-device
  convergence, restart from IndexedDB, and retirement preventing resurrection.
- **Verification:** `deno run -A spikes/automerge/verify.ts`; repeat that runner
  with randomized operation ordering under a recorded seed;
  `deno fmt --check spikes/automerge`; `deno lint spikes/automerge`;
  `git diff --check`.

#### F-003 — Prove browser Google, image, and PWA integrations

- **Status/dependencies:** `COMPLETE`; depends on `P-000`. Worker commit
  `c6b2f8f` and scoped fix `200a9a5` were integrated by `dd20e31` and `0ccfea6`;
  the required browser-integration proofs pass from `master`.
- **Ownership:** `spikes/browser-integrations/**` and its decision record only.
- **Scope/non-goals:** prove browser-safe use of Google Identity/Drive app-data,
  `@google/genai` model listing and structured image output, ephemeral
  camera/file input, EXIF stripping, preparation on/off semantics, CSP,
  base-path routing, and repository-scoped service-worker behavior. Use
  synthetic images/data; live calls are optional manual smoke checks, never CI
  prerequisites.
- **Outputs/acceptance:** exact OAuth/scopes and redirect constraints, adapter
  feasibility, model compatibility-test approach, evidence-based image limits,
  supported formats, and no backend requirement—or a blocked owner decision if a
  browser requirement truly fails.
- **Tests:** fake SDK contract tests; metadata-removal fixture;
  structured-output validation; hash refresh/base-path/service-worker-scope
  browser proofs.
- **Verification:** `deno run -A spikes/browser-integrations/verify.ts`, using
  its self-contained runner and browser fixture;
  `deno fmt --check spikes/browser-integrations`;
  `deno lint spikes/browser-integrations`; `git diff --check`. Production build
  and browser-agent inspection begin only after `F-004`/`F-005` own them.

#### F-004 — Create the application skeleton and CI/deployment pipeline

- **Status/dependencies:** `COMPLETE`; depends on `F-001`, `F-002`, `F-003`, all
  complete. Worker commit `d398608` and CSP fix `fe38734` were integrated as
  `612f5c5` and `3f40033`; the canonical foundation gate passes from `master`.
- **Ownership:** root tool configs, `.github/workflows/**`, `scripts/**`,
  minimal `src/app` entry, static manifest/icons placeholders generated without
  product styling; not domain/features.
- **Scope/non-goals:** establish Deno tasks, strict checks, production build,
  repository-relative hash routing, manifest, scoped service worker skeleton,
  GitHub Pages artifact/deploy workflow, and secret-free CI. No product screen.
- **Outputs/acceptance:** clean clone installs/locks/builds/tests via Deno only;
  CI uses least permissions and deploys only verified artifacts; shell loads at
  repository path and a nested hash route refreshes.
- **Tests:** build smoke, manifest validation, base-path asset resolution,
  service-worker scope assertion, and CI configuration validation.
- **Verification:** `deno task fmt:check`; `deno task lint`; `deno task check`;
  `deno task test`; `deno task build`; `deno task verify:pages`.

#### F-005 — Establish test, fake-service, and visual tooling

- **Status/dependencies:** `COMPLETE`; depends on `F-001`, `F-003`, `F-004`, all
  complete. Worker commit `0c6787f` was integrated as `f22c7c3`; the required
  foundation and F-005 validation commands pass from `master`.
- **Ownership:** `src/test-support/**`, test configuration, `e2e/support/**`,
  visual scripts; no production behavior.
- **Scope/non-goals:** provide deterministic clock/ID/network fixtures, fake
  Drive/Gemini ports, component harness, Playwright E2E configuration, and a
  Deno-run installer for a pinned native `agent-browser` binary plus Chrome for
  Testing. Downloaded binaries/profiles stay ignored; pinned SHA-256 values and
  install metadata are reviewed. Do not use agent-browser as the E2E assertion
  framework.
- **Outputs/acceptance:** one command per test layer; isolated browser state;
  secret/log redaction; reproducible local and CI installation; screenshot and
  a11y artifacts stored only as deliberate non-sensitive test artifacts.
- **Tests:** fake adapter determinism, test isolation, intentional E2E failure
  yields a nonzero result and useful trace, checksum failure aborts
  installation, `agent-browser` screenshot/tree/a11y smoke.
- **Verification:** `deno task test`; `deno task test:integration`;
  `deno task test:component`; `deno task test:e2e`; `deno task browser:install`;
  `deno task browser:verify`.

#### R-100 — Foundation independent review gate

- **Status/dependencies:** `COMPLETE`; depends on `F-004`, `F-005`, both
  complete. Bohr found five issues; scoped fixes were integrated and fresh
  reviewer Russell (`01a030e8-5ae2-7633-a97a-75eb8fd4dddc`) approved closure
  with no unresolved severity-1/2/3/4 findings.
- **Ownership:** read-only review first; findings in this ledger; fixes return
  to owning task/files through a scoped fix commit.
- **Scope/non-goals:** independently review reproducibility, Deno-only
  execution, TypeScript 7 enforcement, dependency/security posture, CI
  permissions, base-path/PWA correctness, fake boundaries, and evidence from all
  spikes.
- **Outputs/acceptance:** no unresolved high/medium finding; compatibility
  decisions frozen; full foundation commands pass after fixes.
- **Tests:** rerun all M1 tests and deliberately exercise one failed CI/test
  path.
- **Verification:** all `F-004` and `F-005` commands plus clean-clone build.

### M2 — Domain, Actor, Adapter, and Design-System Contracts

#### D-101 — Define canonical domain schema, money, migrations, and export shape

- **Status/dependencies:** `COMPLETE`; depends on `R-100`, which is complete.
  Worker commit `9bd7be0` was integrated as `99f0984`; the orchestrator
  completed recovery after the worker interruption and the required D-101
  validations pass from `master`.
- **Ownership:** `src/domain/schema/**`, `money/**`, `migrations/**`, documented
  canonical JSON schema and domain fixtures; no persistence/service/UI code.
- **Scope/non-goals:** versioned Zod 4 schemas and TypeScript types for
  projects, categories, expenses, receipt parents/lines/adjustments, device
  registry, tombstones, retirement markers, revisions, settings split,
  imports/exports, stable IDs, dates/time, and canonical decimal strings. No
  cross-currency conversion or UI formatting decisions beyond approved
  semantics.
- **Outputs/acceptance:** one schema source of truth where practical; immutable
  relationships survive rename; exact validation errors; explicit migration
  registry; lossless deterministic JSON serialization.
- **Tests:** decimal normalization/rejection and arbitrary-precision arithmetic;
  signs; all record variants; rename invariants; invalid references; schema
  version dispatch; migration up/down policy; deterministic export round trip.
- **Verification:** `deno task test --filter domain`; `deno task check`;
  `deno task verify:schema-docs`.

#### D-102 — Define the XState actor system and event contracts

- **Status/dependencies:** `COMPLETE`; depends on `D-101`, `F-005`, both
  complete. Worker commit `0245859` was integrated as `1efd97b`; the focused
  actor-contract suite and root gates pass.
- **Ownership:** `src/actors/contracts/**`, actor topology documentation and
  compile-only machine shells; no concrete service adapters or screen markup.
- **Scope/non-goals:** define root/shell, expense form, receipt scan/review,
  project/category, sync, conflict, import, project deletion, Delete Everywhere,
  update/install, and durable-workflow actor boundaries; typed domain events,
  tags, outputs, persisted snapshots, invoked/spawned actor ports, and
  ownership. Avoid giant root context, duplicated mode booleans, and machines
  for pure selectors.
- **Outputs/acceptance:** XState v5 `setup(...)` contracts compile; modes live
  in states; UI can derive availability with snapshots/tags/`can`; persistence
  and cancellation boundaries are explicit; future structured automation could
  dispatch typed events without being implemented.
- **Tests:** compile-time event payload checks; representative guards; persisted
  snapshot hydrate/resume; parent-child completion/cancellation; forbidden event
  no-op/rejection for each workflow class.
- **Verification:** `deno task test --filter actor-contract`; `deno task check`;
  actor topology review against every UI cross-cutting state.

#### D-103 — Define adapter ports and deterministic fakes

- **Status/dependencies:** `COMPLETE`; depends on `D-101`, `F-005`, both
  complete. Worker commit `5f46f04` was integrated as `6bd54c2`; the focused
  adapter-contract suite and root gates pass.
- **Ownership:** `src/adapters/ports/**`, `src/test-support/fakes/**`; no real
  Google/IndexedDB implementation.
- **Scope/non-goals:** typed ports for local transactions/query, causal sync,
  Drive authorization/transport, Gemini models/extraction, image preparation,
  online status, clock/IDs, file/share, update/install, and secret storage.
- **Outputs/acceptance:** SDK/browser objects do not cross ports; abort/retry
  and typed error taxonomies are explicit; fakes support deterministic offline,
  quota, conflict, corruption, and partial-transport scenarios.
- **Tests:** port contract fixtures, fake determinism, abort behavior, error
  mapping exhaustiveness, and secret redaction.
- **Verification:** `deno task test --filter adapter-contract`;
  `deno task check`.

#### U-104 — Implement and verify the shared design-system foundation

- **Status/dependencies:** `COMPLETE`; depends on `R-100`, `D-101`, both
  complete. Worker commit `42d57fb` was integrated as `b06042b`; gallery wiring
  and scoped accessibility fixes were integrated as `5ebcd89`.
- **Ownership:** `src/design-system/**` and component gallery only; no feature
  business logic.
- **Scope/non-goals:** implement semantic dark tokens, immediate-motion policy,
  layout/type primitives, accessible fields/actions/overlays/navigation/status,
  reusable patterns and approved domain composites from `DESIGN_SYSTEM.md`.
  React Aria behavior is wrapped rather than forked. No one-off screen styling.
- **Outputs/acceptance:** component APIs cover the screen mapping; all states
  are visible in the gallery; future light tokens require no API change;
  compact, medium, and wide layouts avoid page-level horizontal overflow.
- **Tests:** component semantics/event wiring, keyboard/focus, disabled/pending/
  invalid/destructive variants, forced colors, 44px targets, token contrast,
  immediate transitions, long labels/amounts, and reduced-motion progress.
- **Verification:** `deno task test:component --filter design-system`;
  `deno task gallery`; `deno task a11y:gallery`; agent-browser screenshots/tree
  at all three viewports.

#### R-200 — Contract and design-system independent review gate

- **Status/dependencies:** `COMPLETE`; depends on `D-101`, `D-102`, `D-103`,
  `U-104`, all complete. Fresh read-only reviewer Boole
  (`01a03123-61ee-79b2-b2c1-4e6ad08b0ab5`) is reviewing integrated `master` at
  `186ff05`; that reviewer stalled and was shut down without a handoff. Fresh
  reviewer Banach (`01a0312e-b8bb-7582-8ae0-e8fbc7ca9eef`) completed a read-only
  review of pushed checkpoint `b398037` and returned `BLOCK`; all scoped
  findings are now integrated. Closure reviewer Hypatia
  (`01a0314e-8936-7d53-a90f-ddf11e95f757`) completed with `BLOCK`; the
  orchestrator integrated the three scoped fixes and must dispatch one fresh
  independent closure reviewer from the new clean checkpoint. Closure-3 reviewer
  Linnaeus (`01a03187-24aa-7521-b137-52ad5912d31f`) approved the complete gate
  at `c390656` with no new findings; the contracts are now locked for downstream
  M3 work.
- **Ownership:** read-only first; scoped fixes by original owner/integration
  owner; contract changes documented with affected downstream tasks.
- **Scope/non-goals:** review schema completeness, actor decomposition/v5
  correctness, adapter leakage, fake fidelity, design-system
  reuse/accessibility, and contract consistency across all approved screens.
- **Outputs/acceptance:** contracts declared locked; no unresolved high/medium
  finding; downstream ownership can remain disjoint without inventing APIs.
- **Tests:** full domain/actor/adapter/component suites and gallery visual/a11y.
- **Verification:** `deno task verify`; `deno task gallery`;
  `deno task a11y:gallery`; clean Git state.

### M3 — Local Vertical Slice

#### L-201 — Implement Automerge/IndexedDB local repository and migrations

- **Status/dependencies:** `COMPLETE`; depends on `R-200`.
- **Ownership:** `src/adapters/local/**`; changes to locked domain/ports require
  approval. No feature UI or Google transport.
- **Scope/non-goals:** repository-namespaced IndexedDB, Automerge document load,
  atomic multi-record transactions, indexes/query projections, migration backup
  and recovery, local revisions/tombstones, and restart hydration.
- **Outputs/acceptance:** offline-first commit succeeds independently of
  network; crashes cannot expose partial receipt/import mutations;
  corrupt/migration failures preserve recoverable prior data and emit typed
  errors.
- **Tests:** fresh/open/restart, atomic rollback, concurrent local commits,
  migration fixtures for every version, corruption, quota/failure, tombstones,
  and deterministic projection rebuild.
- **Verification:** `deno task test:integration --filter local-repository`;
  `deno task check`.

#### L-202 — Implement project and category actors/domain operations

- **Status/dependencies:** `COMPLETE`; depends on `L-201`, `D-102`.
- **Ownership:** project/category domain services, actors, selectors; no screens
  except headless actor fixtures. A bounded internal-contract follow-up may add
  the missing project reorder command to `src/actors/contracts/types.ts` and its
  focused actor-contract coverage; this does not change approved user behavior
  or expand the task beyond ordering already in scope.
- **Scope/non-goals:** first/default/last-selected project, stable custom
  project ordering, rename/archive/restore/empty delete, the guard requiring a
  switch away before archiving the current project, default currency, global
  ordered categories, protected Uncategorized, archive/delete-and-reassign,
  deleted-category redirection, and offline operations. Populated-project
  destructive workflow belongs to `X-501`.
- **Outputs/acceptance:** invariants are transactional and actor snapshots
  expose exact available actions/errors without UI-only rules.
- **Tests:** at-least-one project, last selection, project reorder and stable
  identity, current-project archive rejection then switch/archive, restore,
  confirmed empty-project deletion, category uniqueness/order/archive,
  Uncategorized protection, reassignment atomics, late reference redirection,
  and local failure/retry.
- **Verification:** `deno task test --filter 'project|category'`;
  `deno task test:integration --filter organize`; `deno task check`.

#### L-203 — Implement expense queries, totals, filtering, and formatting

- **Status/dependencies:** `COMPLETE`; depends on `D-101`, `L-201`; may overlap
  `L-202` with disjoint query ownership.
- **Ownership:** `src/domain/queries/**`, formatting/selectors and query adapter
  implementation; no actors/screens.
- **Scope/non-goals:** project scoping, current/custom calendar periods,
  category, currency, merchant/description search, signed amount range,
  newest/oldest stable ordering, receipt grouping, category breakdown, and
  separate-currency outflow/money-back/net totals. No rolling windows, charts,
  or conversion.
- **Outputs/acceptance:** list and summaries consume one filter object and
  cannot disagree; optional receipt time is inherited by lines for ordering.
- **Tests:** boundary dates/timezones, combined filters, case/search behavior,
  deterministic ties, signs, multi-currency separation, receipt expansion data,
  empty/large decimal values, and property tests for totals.
- **Verification:** `deno task test --filter 'query|total|format'`; performance
  fixture within budget recorded by task; `deno task check`.

#### L-204 — Implement manual expense and local shell actors

- **Status/dependencies:** `COMPLETE`; depends on `L-202`, `L-203`, `D-102`.
- **Ownership:** manual-expense and shell actor implementations; no full screen
  CSS or external sync.
- **Scope/non-goals:** create/edit shared form, spent/money-back signs, decimal
  input, default project/currency/category/date boundary, optional merchant/
  description/time, merchant suggestions/clear, durable dirty draft, local save,
  retry, discard/back, delete/undo, project switching, offline shell modes.
- **Outputs/acceptance:** UI can render entirely from snapshots and dispatch
  typed events; accepted saves commit locally before navigation; failed saves
  retain input; explicit dates never change with timezone.
- **Tests:** happy/edit/delete/undo, invalid decimals/required fields, 03:00 day
  boundary, suggestion clearing, reload hydration, duplicate-submit prevention,
  discard confirmation, repository failure/retry, and event path coverage.
- **Verification:** `deno task test --filter manual-expense`;
  `deno task test
  --filter shell-actor`;
  `deno task test:integration --filter manual-save`; `deno task check`.

#### L-205 — Deliver the complete local browsing and organization UI slice

- **Status/dependencies:** `COMPLETE`; depends on `L-202`, `L-204`, `U-104`.
- **Ownership:** shell plus Screens 1–3, 6–9 and non-destructive
  project/category editor composition; no Gemini/Drive/destructive workflows.
- **Scope/non-goals:** first-use local path, responsive navigation, Expenses
  totals/list/filter/search/receipt expansion, Add Choice, manual create/edit,
  Organize, accessible project ordering, explicit project Use/Edit actions,
  current-project archive guard, archive/restore and confirmed empty-project
  deletion, category management, Settings landing, and draft/error/offline
  states. Populated project delete action may be visibly unavailable until
  `X-501`; it must not be faked.
- **Outputs/acceptance:** approved mobile and desktop behavior uses shared
  components, no horizontal page scrolling, keyboard/focus and browser Back
  work, reload restores drafts/last project, no tutorial or decorative motion.
- **Tests:** component snapshot-to-view/event wiring for every screen state;
  accessible project drag/move ordering, switch-before-archive feedback,
  archive/restore and empty-delete confirmation; accessibility names/focus; one
  local manual-save browser integration journey; narrow/long-content responsive
  assertions.
- **Verification:** `deno task test:component`; `deno task test:integration`;
  `deno task test:domain`; `deno task test:actor`;
  `deno task test:e2e --grep local-first-manual`; `deno task a11y:gallery`;
  `deno task browser:verify`; native agent-browser screen matrix at 320x568,
  390x844, and 1280x800; `deno task test`; `deno task build`.

#### R-300 — Local vertical-slice independent review gate

- **Status/dependencies:** `COMPLETE`; depends on `L-205`; the bounded
  custom-period/saved-record-Undo and accessibility follow-ups are integrated
  and independently approved.
- **Ownership:** review read-only first; fixes remain scoped to M3 owners.
- **Scope/non-goals:** review financial correctness, local durability, XState/UI
  separation, responsive/accessibility fidelity, design-system reuse, and all
  approved local flows. Do not begin external integration during review.
- **Outputs/acceptance:** no high/medium finding; owner can complete ordinary
  expense tracking offline; tests and visual evidence pass after fixes.
- **Tests:** all M2/M3 suites, local E2E, migration restart and failure
  injection.
- **Verification:** `deno task verify`; `deno task test:e2e --grep local`;
  agent-browser local-screen audit.

### M4 — Receipt Intelligence

#### A-301 — Implement image preparation and Gemini adapter

- **Status/dependencies:** `COMPLETE`; depends on `R-200`, `F-003`; may begin
  after `R-200` in parallel with M3 where ownership is disjoint.
- **Ownership:** `src/adapters/gemini/**`, image utilities and structured Gemini
  schema mapping; no receipt actor/UI. A bounded integration follow-up may
  extend the internal Gemini draft port only; it does not change user behavior
  or receipt requirements.
- **Scope/non-goals:** API-key/model listing/test, capability labels including
  Needs test, schema-constrained request, browser revalidation, permitted prompt
  context only, the repository-namespaced `localStorage` secret port with
  automatic persistence until explicit removal, EXIF stripping always, optional
  resize/compression, ephemeral memory cleanup, cancellation, and typed
  failures. The key never enters IndexedDB, sync, export, fixtures, or logs. No
  background calls or image persistence.
- **Outputs/acceptance:** synthetic adapter contract passes; inspection proves
  no forbidden request data; invalid output cannot reach review; key is redacted
  from all errors/logs; task locks tested image thresholds from `F-003`.
- **Tests:** namespaced key persistence/read/removal and export/sync exclusion;
  model compatibility/cache invalidation; invalid/quota/offline errors; schema
  equivalence; hostile model text; metadata removal prep on/off; abort/retry;
  object URL/buffer cleanup; request allowlist snapshot and log redaction.
- **Verification:** `deno task test --filter 'A-301'`;
  `deno task test:integration --filter 'fake Gemini'`; CSP/network inspection.

#### A-302 — Implement receipt scan/review actors and atomic receipt domain flow

- **Status/dependencies:** `COMPLETE`; depends on `A-301`, `L-201`, `L-202`,
  `D-102`.
- **Ownership:** receipt actors/domain orchestration; no screen composition.
- **Scope/non-goals:** camera/file selection lifecycle, disclosure, inline key
  setup, preparing/requesting/validating/review/failure states, parent metadata,
  purchase/adjustment/tip lines, uncertainty, selection/edit/add/remove,
  optional adjustment links, totals mismatch, durable structured draft, atomic
  save and discard. Receipt images never enter snapshots.
- **Outputs/acceptance:** finite states govern every action; invalid/unreadable
  lines start unselected; receipt time is parent-only; accepted lines require
  descriptions; failures save nothing; reload resumes validated review only.
- **Tests:** generated paths for scan/retry/cancel/offline/model loss; all line
  signs/types; optional links; printed-total discrepancy; mismatch confirmation;
  draft hydration without image; atomic rollback; Save/discard cleanup.
- **Verification:** `deno task test --filter receipt-actor`;
  `deno task test:integration --filter receipt-atomic`; `deno task check`.

#### A-303 — Deliver Scan, Receipt Review, and Gemini Settings UI

- **Status/dependencies:** `COMPLETE`; depends on `A-302`, `L-205`, `U-104`.
- **Ownership:** Screens 4, 5, and 11 plus their feature composition and the
  small approved receipt/Gemini domain composites required by the existing
  design-system map; no adapter internals or schema changes.
- **Scope/non-goals:** native Take photo/Choose image,
  preview/use/retake/remove, visible disclosure, options, inline key setup,
  scanning/failure states, editable review with uncertainty/mismatch, model
  type-ahead/compatibility, automatic key remembering, masked stored-key display
  with Remove as the sole replacement path, pending-scan continuation after
  successful quick setup, and configuration test. No custom camera or image
  editor.
- **Outputs/acceptance:** exact approved data disclosure; source images
  disappear after terminal paths; all review actions keyboard/touch accessible;
  long receipts use natural-height responsive cards and desktop adaptation.
- **Tests:** component rendering/events for every actor mode, focus and
  disclosure, automatic key persistence, masking/removal-only replacement, setup
  validation retaining the selected image and continuing the pending scan, model
  search, line selection/edit, mismatch confirmation; fake-Gemini E2E capture
  through atomic save.
- **Verification:** `deno task test:component --filter receipt-ui`;
  `deno task test:e2e --grep receipt-review`; Playwright request-allowlist and
  cleanup assertions; separate agent-browser visual/a11y/tree inspection and
  screenshots at three viewports.

#### R-400 — Receipt independent review gate

- **Status/dependencies:** `COMPLETE`; depends on `A-303`, `R-300`.
- **Ownership:** read-only review first; scoped fixes by A-task owners.
- **Scope/non-goals:** review privacy allowlist, secret handling, image
  lifetime, structured validation, actor safety, financial signs/totals,
  accessibility and visual fidelity. No live personal receipt is used.
- **Outputs/acceptance:** no high/medium finding; fake receipt journey and all
  failure paths pass; network inspection contains only permitted data.
- **Tests:** all M4 tests plus malformed/fuzz output and cancellation leak
  checks.
- **Verification:** `deno task verify`; receipt E2E; agent-browser receipt
  audit.

### M5 — Synchronization and Portability

#### S-401 — Implement Google authorization and Drive app-data transport

- **Status/dependencies:** `COMPLETE`; depends on `R-200`, `F-003`; may begin
  after `R-200` in parallel with M3/M4 under adapter-only ownership.
- **Ownership:** `src/adapters/drive/**`; no merge policy or sync UI.
- **Scope/non-goals:** least-scope browser OAuth, one-account identity, app-data
  folder files, conditional reads/writes, retirement marker access, token
  lifecycle/revocation, pagination/retries and typed errors. No domain merge
  choices based on timestamps.
- **Outputs/acceptance:** tokens remain device/browser managed and redacted;
  transport is abortable/idempotent where required; fake and optional manual
  smoke obey the same port contract.
- **Tests:** auth success/cancel/revoke/account mismatch,
  offline/401/403/404/429/ 5xx, pagination, conditional conflict, retry/backoff
  with fake clock, app-data path isolation, retirement marker
  read-before-upload.
- **Verification:** `deno task test:integration --filter drive-adapter`;
  `deno task check`; optional `deno task smoke:drive` only with explicit env.

#### S-402 — Implement synchronization actor, causal transport, and device registry

- **Status/dependencies:** `COMPLETE`; depends on `S-401`, `L-201`, `D-102`.
- **Ownership:** sync/device actors and causal transport coordinator; no
  conflict or settings screen markup.
- **Scope/non-goals:** local-first dirty state, explicit/connect/reconnect sync,
  pull-before-push, causal change exchange, deterministic convergence, offline/
  auth/quota/failure modes, known-device labels/last-seen/acknowledgements,
  account switch confirmation, and retirement-before-upload. Opaque device IDs
  remain a diagnostic identifier and are not ordinary presentation data. No
  wall-clock auto-winner.
- **Outputs/acceptance:** sync never blocks local commits; reconnect cannot
  resurrect retired data; multiple actor triggers coalesce safely; status is
  honest and resumable.
- **Tests:** two/three-device schedules, offline edits, duplicate/out-of-order
  changes, failed upload after pull, token expiry, quota, account mismatch,
  device rename, ordinary projection excluding opaque IDs, restart hydration,
  retirement detection, and convergence.
- **Verification:** `deno task test --filter sync-actor`;
  `deno task test:integration --filter sync-schedules`; seeded stress run.

#### S-403 — Implement conflict detection and resolution workflow

- **Status/dependencies:** `COMPLETE`; depends on `S-402`, `D-102`.
- **Ownership:** conflict domain/actor and projections; no Screen 10A markup.
- **Scope/non-goals:** group conflicts by record/receipt, field candidate values
  with device/timestamp context, neutral choice/custom value,
  delete-versus-edit, offline resolution revision referencing all parents,
  durable progress/count. No automatic latest-timestamp winner.
- **Outputs/acceptance:** resolved conflicts do not recur after sync; untouched
  conflicts remain visible; resolution cannot claim success before local commit.
- **Tests:** independent edits auto-merge, same-field conflict, custom value,
  delete-versus-edit both choices, receipt-line conflict, offline/reload/resync,
  concurrent resolutions and deterministic final convergence.
- **Verification:** `deno task test --filter conflict`;
  `deno task test:integration --filter conflict-convergence`; `deno task check`.

#### S-404 — Implement canonical JSON import/export workflows

- **Status/dependencies:** `COMPLETE`; depends on `D-101`, `L-201`, `S-402`.
- **Ownership:** import/export domain, actors and file/share adapter
  composition; no Screen 12 markup.
- **Scope/non-goals:** complete documented JSON download/share,
  validate/preview, merge as causal imported changes, replace as a new
  generation with safety backup, interruption recovery, mandatory successful
  online pre-sync immediately before replace whenever Drive is configured,
  generation coordination, and device-local exclusions. No CSV or opaque
  database export.
- **Outputs/acceptance:** import is atomic; merge deduplicates stable history;
  replace cannot be undone by another device's old generation; key/drafts/images
  are excluded; a configured-Drive pre-sync failure makes no mutation; export
  restores all synchronized records and metadata required for correctness.
- **Tests:** exact round trip, old schema migration, malformed/unknown future
  version, duplicates, merge conflicts, replace cancellation/failure/restart,
  configured Drive offline/pre-sync failure with no mutation, successful
  pre-sync immediately followed by synchronized replacement, unconfigured
  offline local replacement, share unavailable fallback, and secret exclusions.
- **Verification:** `deno task test --filter 'import|export'`;
  `deno task test:integration --filter import-sync`; schema-doc verification.

#### S-405 — Deliver Drive, Conflict, Known Devices, and Import/Export UI

- **Status/dependencies:** `COMPLETE`; depends on `S-402`, `S-403`, `S-404`,
  `U-104`, `L-205`.
- **Ownership:** Screens 10, 10A, 10B, 12, global sync/conflict indicators; no
  adapter/domain contract changes.
- **Scope/non-goals:** connect/account/status/sync-now/disconnect entry,
  conflict banner/list/field resolution, known-device labels/status, export and
  import merge/replace previews/warnings/progress/recovery. Ordinary Known
  Devices hides opaque IDs; an optional labeled technical-details view may
  reveal them only for diagnosis. No live-call E2E.
- **Outputs/acceptance:** global conflict banner persists correctly; offline
  operations remain available; destructive/import focus and warnings are
  accessible; UI derives availability/status from actors, not duplicated flags.
- **Tests:** component modes/events/focus for all screens; fake-Drive reconnect
  E2E proves boundary wiring; conflict E2E; import component integration; long
  device/error strings, opaque-ID absence from ordinary UI and presence only in
  technical details, and narrow layouts.
- **Verification:** `deno task test:component --filter 'sync|conflict|import'`;
  `deno task test:e2e --grep 'drive-reconnect|conflict-resolution'`;
  agent-browser screen/a11y audit.

#### R-500 — Synchronization and portability independent review gate

- **Status/dependencies:** `COMPLETE`; depends on `S-405`, `R-400`; the
  independent review BLOCK was resolved by the bounded fix wave and fresh
  closure review recorded below.
- **Ownership:** review read-only first; fixes scoped to S-task owners.
- **Scope/non-goals:** adversarially review causal convergence, Drive security,
  retirement checks, device semantics, conflict resolution, import/replace
  safety, offline honesty, and UI/actor separation. E2E is not used to
  substitute for schedule-level integration evidence.
- **Outputs/acceptance:** no high/medium finding; seeded multi-device suites
  pass repeatedly; no credential/log leakage; fake Drive E2E remains narrow. A
  review BLOCK requires a bounded fix wave and a fresh independent closure
  review before downstream M6 work is released.
- **Tests:** all M5 tests, reordered/failing transport schedules, corrupt
  imports, account switching, restart at every durable workflow stage.
- **Verification:** `deno task verify`; approved E2Es; agent-browser M5 audit.

### M6 — Destructive Workflows and PWA Completion

#### X-501 — Implement populated-project deletion

- **Status/dependencies:** `COMPLETE`; depends on `R-500`, `L-202`.
- **Ownership:** project-deletion actor/domain and Screen 7A composition; no
  global Delete Everywhere behavior.
- **Scope/non-goals:** record-count warning, complete safety export, exact-name
  confirmation, atomic synchronized tombstones for owned project data/indexes,
  category preservation, local failure/retry and safe navigation.
- **Outputs/acceptance:** no partially deleted project; unrelated projects,
  categories/settings/key remain unchanged; late changes cannot resurrect the
  deleted project; UI never implies physical history erasure.
- **Tests:** cancel/wrong confirmation/export failure/commit failure, complete
  deletion scope, unrelated invariants, offline deletion then sync, late-device
  replay, restart and convergence.
- **Verification:** `deno task test --filter project-deletion`;
  `deno task test:component --filter populated-project-delete`;
  `deno task test:integration --filter project-delete-sync`.

#### X-502 — Implement disconnect and Delete Everywhere

- **Status/dependencies:** `COMPLETE`; depends on `X-501`, `S-402`, `S-404`.
- **Ownership:** disconnect/global-deletion actor, retirement/generation erase
  coordination, Screens 10/14 destructive paths; no unrelated settings.
- **Scope/non-goals:** disconnect with keep-local semantics; local-only erase;
  local erase offers **Remove Gemini API key** checked by default and persists
  the checked/unchecked choice before erasure; Delete Everywhere offers a
  complete safety export and, if explicitly declined, requires a distinct
  additional confirmation before retirement can begin; then retirement
  publication, Drive generation/history deletion, initiating-device erasure,
  per-device acks, waiting/lost-device forced finalization, revocation ordering,
  durable minimal progress, and explicit recovery/reinitialize. It cannot erase
  an inaccessible browser and must say so.
- **Outputs/acceptance:** retired payload cannot be re-uploaded; erased
  financial data never enters progress snapshots; export acceptance and explicit
  decline-plus-second-confirmation are separate guarded paths; local key removal
  honors the default-checked choice; each scope is unmistakable; real cloud
  deletion state is reported honestly.
- **Tests:** every state/transition/failure/reload; accepted safety export;
  declined export blocked without second confirmation and allowed only after it;
  export failure; retirement-before-upload; Drive-delete failure; local erase
  failure; default-checked key removal and explicit unchecked key preservation;
  multiple acknowledgements; offline device; forced finalization; revocation
  ordering; old-device reconnect; no payload/key in durable progress/logs.
- **Verification:** `deno task test --filter delete-everywhere`;
  `deno task test:integration --filter retirement`; component destructive-flow
  tests and agent-browser focus/warning audit.

#### P-503 — Complete preferences, privacy/about, install, update, and offline PWA

- **Status/dependencies:** `COMPLETE`; depends on `X-502`, `A-303`, `S-405`,
  `F-004`.
- **Ownership:** Screens 13–15, remaining Settings composition, install/update/
  connectivity actors and concrete service worker/cache policy.
- **Scope/non-goals:** expense-day preference/example, data/privacy disclosures,
  exact README AI disclosure, licenses/repository/version/commit, install offer
  after useful action, About install fallback, checking/update-ready/explicit
  reload, cache/offline launch, unsupported browser explanation, and no surprise
  reload. No analytics, tutorial, theme switch, or decorative motion.
- **Outputs/acceptance:** offline local capabilities match spec; unsaved input
  is protected during update; service worker never escapes repository scope;
  update status is actor-driven and accessible.
- **Tests:** day-boundary examples, disclosure exactness, install
  support/dismiss/ later action, update states and dirty-form block,
  cache/offline first/relaunch, unsupported browser, base path/scope,
  licenses/build metadata.
- **Verification:**
  `deno task test --filter 'preference|install|update|offline'`;
  `deno task test:component --filter settings-final`;
  `deno task test:e2e --grep offline-update`; production-build agent-browser
  offline/update audit.

#### R-600 — Destructive/PWA independent review gate

- **Status/dependencies:** `COMPLETE`; depends on `P-503`, `R-500`; the second
  bounded fix wave is integrated and closure-3 independently approved the gate
  with no unresolved severity-1/2/3/4 finding.
- **Ownership:** read-only review first; scoped fixes by M6 owners.
- **Scope/non-goals:** review destructive truthfulness and ordering, data
  leakage, reload recovery, offline/update/install correctness,
  settings/disclosures, base-path/service-worker isolation, and accessibility of
  warnings.
- **Outputs/acceptance:** no high/medium finding; failure injection cannot lose
  or resurrect data contrary to spec; production PWA passes offline/update
  audit.
- **Tests:** all M6 tests plus restart/failure at each destructive phase and
  repository-neighbor service-worker isolation fixture.
- **Verification:** `deno task verify`; offline/update E2E; agent-browser M6
  audit.

### M7 — Hardening and Release

#### Q-601 — Close screen/state/design-system completeness gaps

- **Status/dependencies:** `COMPLETE`; depends on `R-600`, which is complete.
- **Dispatch:** the integration owner has created the isolated worktree
  `~/git/worktrees/did-it-become-what-you-like-q-601-completeness` on branch
  `task/q-601-completeness` at root `64ce6ec`. One bounded worker is assigned to
  perform the approved traceability audit and implement only inventoried Q-601
  fixes; the worker must preserve a timestamped untracked handover and must not
  edit this plan, `master`, remotes, or another task's ownership. Einstein
  (`01a0362b-9f14-7eb1-8f32-3393099c337d`) owns the worktree and started from
  the pushed plan checkpoint `b440222`; commit `2339426` was inspected and
  integrated as `de8d40e`, and the worker was shut down.
- **Ownership:** only gaps explicitly inventoried against specs;
  shared-component fixes precede affected feature fixes; no new product scope.
- **Scope/non-goals:** map every approved screen/checklist state to
  implementation, remove one-off duplication, validate
  responsive/long-content/large-money/
  empty/loading/offline/error/conflict/destructive states and immediate motion.
- **Outputs/acceptance:** traceability matrix has no missing requirement;
  gallery and screen mappings match; no deferred feature leaked into MVP.
- **Tests:** targeted regression at cheapest layer for every found gap; complete
  component/a11y suite; visual baselines reviewed rather than blindly updated.
- **Verification:** `deno task verify`; `deno task gallery`;
  `deno task a11y:gallery`; agent-browser full screen matrix. The historical
  `deno task gallery:verify` name is not defined by the repository and is not
  used as evidence.

#### Q-602 — Finalize the five-journey E2E suite

- **Status/dependencies:** `COMPLETE`; depends on `Q-601`, which is complete.
- **Dispatch:** the integration owner has created the isolated worktree
  `~/git/worktrees/did-it-become-what-you-like-q-602-e2e` on branch
  `task/q-602-e2e` at root `d3982a0`. One bounded worker owns only `e2e/**` and
  E2E-only fake scenario setup; it must preserve a timestamped untracked
  handover and must not edit this plan, `master`, remotes, production source, or
  another task's ownership. Jason (`01a03665-eb3b-7882-af03-2e7956597aed`) owns
  the worktree and started from the pushed plan checkpoint `15ffafe`; commit
  `290c1fc` was inspected and integrated as `0582d2f`, and the worker was shut
  down.
- **Ownership:** `e2e/**` and E2E-only fake scenario setup; production behavior
  changes require a separate scoped fix with lower-layer regression test.
- **Scope/non-goals:** make the approved local manual, fake Gemini receipt, fake
  Drive reconnect, conflict resolution, and offline/update recovery journeys
  deterministic. E2E does not enumerate merge schedules or machine guards.
- **Outputs/acceptance:** isolated/repeatable/no live credentials; failures
  retain useful traces/screenshots without secrets; suite passes repeated and
  shuffled.
- **Tests:** exactly the five journeys, with viewport coverage allocated by risk
  rather than multiplying every journey across every browser/viewport.
- **Verification:** `deno task test:e2e`; repeat three times; the selected
  runner does not support `deno task test:e2e --shuffle` and its exact
  `unknown option '--shuffle'` result is recorded in the checkpoint.

#### Q-603 — Cross-browser, accessibility, security, and visual hardening

- **Status/dependencies:** `COMPLETE`; depends on `Q-602`, which is complete.
- **Dispatch:** the integration owner has created the isolated worktree
  `~/git/worktrees/did-it-become-what-you-like-q-603-hardening` on branch
  `task/q-603-hardening` at root `0e383fc`. One bounded worker owns the
  hardening audit and only scoped regression fixes; it must preserve a
  timestamped untracked handover and must not edit this plan, `master`, remotes,
  or another task's ownership. Ampere (`01a0367d-8c8f-7dd0-b462-ba07fbbd62e6`)
  is the assigned worker.
- **Ownership:** audit reports and scoped regression fixes; no feature
  expansion.
- **Scope/non-goals:** Chromium automated matrix, agent-browser screenshot/tree/
  axe review, keyboard/touch/focus, CSP/network/storage/secret audit, and manual
  or available automation evidence for current iOS Safari/Android Chrome and
  latest-two desktop policy. Platform-unavailable checks are explicitly recorded
  for owner/manual verification rather than falsely claimed.
- **Outputs/acceptance:** WCAG AA and privacy/security requirements met; no
  page-level horizontal scroll; functional progress has static reduced-motion
  equivalent; all findings have regression evidence.
- **Tests:** full suite plus accessibility, CSP/network allowlist, storage-name,
  build-content secret scan, install/camera/file smoke on available platforms.
- **Verification:** `deno task verify`; `deno task security:check`;
  `deno task a11y`; documented agent-browser and platform matrix.
- **Evidence:** Ampere's bounded audit found and fixed the medium-severity 390px
  Expenses filter overlap in `src/features/local-ui.css`, with the focused
  regression in `e2e/responsive-filters.spec.ts`. The worker's fixed 19-route
  matrix covered `320x568`, `390x844`, and `1280x800`; all routes had no axe
  violations, no page overflow, and no browser errors (the 320px Add sheet
  retained only one non-violation axe incomplete contrast-background
  determination). Keyboard/focus/modal, reduced-motion, touch-target,
  CSP/network, storage naming, secret scan, PWA, and camera/file checks passed
  where available. The host cannot provide iOS Safari, Android Chrome, Firefox,
  Safari, or Edge evidence; this limitation is recorded rather than inferred
  away. `deno task security:check` and `deno task a11y` are absent
  (`Task not found`); canonical `deno task verify`, `deno task a11y:gallery`,
  and `deno task browser:verify` passed. Integrated source commit is `1ce1947`;
  root `deno task verify` also passed after integration.

#### Q-604 — Produce and verify the GitHub Pages release

- **Status/dependencies:** `COMPLETE`; depends on `Q-603`, which is complete.
- **Dispatch:** the integration owner has created the isolated worktree
  `~/git/worktrees/did-it-become-what-you-like-q-604-release` on branch
  `task/q-604-release` at root `60cd78a`. One bounded worker owns release
  metadata, deployment workflow/config, artifact verification, and release
  documentation only; it must preserve a timestamped untracked handover and must
  not edit this plan, `master`, remotes, or another task's ownership. Poincare
  (`01a036a8-8646-70f3-9e01-6ce36276c84e`) is the assigned worker.
- **Ownership:** release metadata, deployment workflow/config and documentation;
  no feature code except release-blocking regression fixes through prior owners.
- **Scope/non-goals:** clean production build, version/commit metadata, license
  notices, artifact provenance, Pages deployment, live base-path/hash/offline/
  update smoke, rollback instructions. No custom domain or backend.
- **Outputs/acceptance:** deployed artifact matches reviewed commit; checks pass
  before deploy; live PWA cannot control sibling repository paths; source link
  and disclosure are exact.
- **Tests:** production artifact and manifest/service-worker inspection, live
  smoke without personal data, offline reload and update-ready exercise.
- **Verification:** `deno task release:verify`; GitHub workflow success; live
  `agent-browser` smoke; record deployed commit in this checkpoint.
- **Evidence:** Poincare's scoped release commit `9a8e0de` was integrated as
  `b1d33a7`. It added `deno task release:verify`, release provenance and notice
  checks to both CI and Pages workflows, and `RELEASE.md` with the deployment
  boundary and rollback procedure. Root `deno task verify` and
  `deno task release:verify` passed; release verification bound the artifact to
  version `0.1.0`, commit `b1d33a7`, base path `/did-it-become-what-you-like/`,
  PWA scope, metadata/notices, secret scan, and SHA-256 artifact lines. GitHub
  CI #184 and Deploy to GitHub Pages #12 completed successfully; deployment
  `6075255903` reported `success` for `github-pages`. Live `agent-browser` smoke
  at the repository URL and `#/settings/about` passed at `390x844`: HTTP 200,
  current bundle, About build `b1d33a7`, axe `0` violations, no browser errors,
  no page overflow, active service worker, and offline reload retained the app.
  The live About status was `Up to date`; no unsaved-input update prompt was
  claimed because no update was available during this deployment.

#### R-700 — Final independent release review and definition-of-done gate

- **Status/dependencies:** `COMPLETE`; the owner-supplied production OAuth
  configuration and fresh same-account desktop sync smoke are now complete;
  depends on `Q-604`, which is complete.
- **Dispatch:** the earlier `review/r-700-final` handover and Zeno's paused
  review remain preserved, but neither is used as final closure evidence. A
  fresh read-only Luna `xhigh` reviewer, Chandrasekhar
  (`01a03afa-ad5e-7aa2-a962-5ffca207db7b`), independently reviewed the final
  source and Pages deployment after the owner confirmed that a new desktop can
  sync the existing data and the projection refresh/PWA fixes were integrated.
  The reviewer inspected the full repository and this ledger, preserved a
  timestamped untracked handover, edited no source/plan/remotes, and issued
  `APPROVE` with no severity-1/2/3/4 findings.
- **Ownership:** full repository read-only review first; fixes individually
  scoped and returned through the responsible task area.
- **Scope/non-goals:** independently compare code, tests, deployment, and this
  ledger against every normative spec and Definition of Done. Do not approve
  based only on prior reviewers or green E2E.
- **Evidence/blockers:** Plato's independent review completed the canonical
  matrix and live Pages audit at `71737ab`, with `deno task verify`, full E2E
  (`11 passed`), `deno task release:verify`, `deno task verify:ci`, and
  `deno task verify:pages` all passing. `S2-2` is resolved by `f475c19`: About
  now renders the existing deterministic GitHub `LICENSE_URL`, retains the
  notices/source links, and asserts both exact hrefs. `S2-1` production
  composition is also wired in `f475c19`: Pages maps the non-secret repository
  variable `VITE_GOOGLE_CLIENT_ID`, the deployed index loads Google Identity
  Services before the app, and `RELEASE.md` records the owner setup steps. A
  live configured-Drive smoke then exposed a new S-405 production blocker: first
  sync returns the safe `invalid-request` message. The adapter asks Drive API v3
  for the removed v2 `etag` JSON field in `files.list` and mutation projections;
  the correction must use HTTP ETags while retaining conditional writes. This is
  recorded as a bounded S-405 follow-up below. Local `deno task verify` passed
  all required checks, including 250 unit, 72 integration, 86 component, 37
  domain, 1 actor, 5 local E2E journeys, gallery/browser inspection,
  Pages/CI/toolchain verification, both builds, frozen audit, and diff check. CI
  run `32838627968` and Pages run `32838627944` both succeeded for `f475c19`;
  deployment `6081452539` is the resulting `github-pages` deployment. Live
  `agent-browser` inspection of `#/settings/about` confirmed build `f475c19`,
  `Up to date`, and the exact GitHub application-license, third-party-notices,
  and source links. Final live Drive authorization remains blocked until the
  owner creates the Google OAuth client, adds the repository variable, and
  reruns the Pages deployment; then dispatch a fresh read-only R-700 closure
  reviewer. The earlier reviewer handover remains preserved. The owner
  subsequently configured the repository variable and confirmed that Google
  authorization succeeds, but the first configured-Drive sync failed because of
  the v3 `etag` projection described above. The bounded S-405 worker commit
  `9ec1ffd` removed those projections, captured per-file HTTP `ETag` headers,
  preserved conditional mutation and lost-response idempotency behavior, and
  added a v3 regression test. The root integration commit is `7119b8a`. Root
  `deno task verify` passed: 251 unit, 73 integration, 86 component, 37 domain,
  1 actor, 5 local E2E journeys, gallery/browser inspection, Pages/CI/toolchain
  checks, both builds, frozen audit, and diff check. R-700 remains blocked only
  until the corrected build is deployed and a fresh configured-Drive sync smoke
  succeeds. The corrected source is now deployed by Pages run `32875077172` and
  deployment `6088023350` for `9c50f49`; the live bundle requests
  `nextPageToken,files(id,name,mimeType,modifiedTime,parents)` without the
  removed JSON `etag` field.
- **Final closure evidence:** Chandrasekhar's final independent review approved
  commit `212f199` after verifying the deployed bundle and live Pages behavior.
  CI run `32904372312`, Pages run `32904372317`, and deployment `6092975926`
  succeeded; the live bundle is `assets/index-Cp6NAvMS.js`. Full E2E passed
  11/11, offline/update E2E passed 1/1, core passed 266/266, integration 83/83,
  components 92/92, domain 37/37, actor 1/1, and all formatting, lint,
  type-check, build, release, Pages, CI, gallery/a11y, browser, schema, and
  frozen-audit checks passed. The reviewer recorded real authenticated Drive and
  several non-Chromium browser checks as unavailable, while owner
  smoke/fake-Drive evidence covers the configured Drive path. R-700 is complete.
- **Outputs/acceptance:** traceability and security/privacy review complete; no
  severity-1/2 finding; severity-3 findings fixed or explicitly accepted by the
  owner; final checkpoint and evidence match Git and deployed commit.
- **Tests:** complete clean-clone verification and targeted adversarial checks
  chosen independently by reviewer.
- **Verification:** every Definition-of-Done command; clean `git status`;
  deployed/source commit equality; final plan-update commit pushed.

### M8 — Mantine Design-System Migration

#### M8 authority, outcome, and non-goals

This milestone replaces repository-written low-level component behavior with
maintained Mantine components behind the existing `src/design-system` facade.
The repository owner approved Mantine as the selected library and approved this
planning work, but **has not yet authorized migration implementation**. No M8
source, dependency, generated-asset, or styling change may begin until the owner
explicitly starts the migration in a later session.

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

#### Mandatory single-agent execution rule

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

#### Locked design-system boundary rules

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

#### Restart and compaction recovery checklist for M8

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

#### Per-task execution and evidence checklist

Apply this checklist to `M8-001` through `M8-010` without exception:

- [ ] Mark exactly one task `IN_PROGRESS` and update Current Checkpoint before
      editing; all later tasks remain `PENDING`.
- [ ] Inventory owned files, affected facade exports, consumer count, locked
      contracts, and explicit non-goals.
- [ ] Add or update the cheapest component/accessibility regression tests with
      the behavior change; do not postpone tests to cleanup.
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

#### Ordered migration checklist and ledger

##### M8-001 — Freeze facade contracts and encode migration governance

- **Status/dependencies:** `PENDING`; depends on explicit owner authorization to
  start implementation and completed `R-700`.
- **Owned scope:** `AGENTS.md`, `DESIGN_SYSTEM.md`, `IMPLEMENTATION_PLAN.md`,
  and contract/inventory documentation or tests under `src/design-system/**`; no
  runtime implementation.
- [ ] Add the locked boundary rules above to `AGENTS.md` as permanent agent
      rules and revise `DESIGN_SYSTEM.md` from repository-owned React Aria
      implementation to repository-facade/Mantine implementation.
- [ ] Inventory every public export in `src/design-system/index.ts`, every
      consumer, and every React Aria primitive currently wrapped.
- [ ] Classify each facade export as a direct Mantine wrapper, small facade
      composition, domain composite, or approved native control, and record its
      target Mantine/public-browser primitive.
- [ ] Freeze the current public contract with compile-time/API tests and
      component behavior tests for representative props, callbacks, refs,
      labels, validation, focus, and controlled values.
- [ ] Record any proposed facade change as an explicit impact item; default to
      preserving all application-facing contracts and screen markup.
- **Focused verification:** `deno task test:affected`; documentation/import
  searches; changed-file format/lint; `git diff --check`.
- **Acceptance:** governance is durable outside this plan, migration matrix has
  no unclassified export, and no runtime/dependency change has occurred.

##### M8-002 — Prove and pin Mantine compatibility

- **Status/dependencies:** `PENDING`; depends on `M8-001`.
- **Owned scope:** `deno.json`, `deno.lock`, isolated compatibility proof/tests,
  and minimal test-only provider support; no production facade conversion.
- [ ] Verify the current stable Mantine release against pinned React 19.2,
      strict TypeScript 7, Deno npm resolution, Vite production build, happy-dom
      component tests, and Chromium.
- [ ] Prove `MantineProvider`, CSS imports/layers, dark theme, controlled input,
      modal focus restoration/portal, select keyboard behavior, notification,
      reduced motion, and tree-shaken production build.
- [ ] Measure and record baseline versus proof build CSS/JS sizes; size growth
      is evidence for review, not permission to use private imports.
- [ ] Pin only the packages required by the approved mapping. Do not add
      `@mantine/form` or broad extensions without a mapped requirement.
- **Focused verification:** compatibility proof tests; `deno task check`;
  `deno task test:component`; `deno task build`; focused agent-browser proof.
- **Acceptance:** all required behavior works through public Mantine APIs; any
  failed prerequisite blocks `R-810` with exact evidence rather than triggering
  an unreviewed fallback-library choice.

##### R-810 — Governance and compatibility review checkpoint

- **Status/dependencies:** `PENDING`; depends on `M8-001`, `M8-002`.
- [ ] Fresh read-only reviewer checks the inventory, locked facade, dependency
      choices, Deno/Vite/React compatibility, accessibility proof, styling
      strategy, bundle evidence, and absence of premature production changes.
- [ ] Reviewer reports `APPROVE` or `BLOCK`, severity, file/line evidence, exact
      commands/results, and minimal corrections.
- [ ] Primary agent resolves every severity 1–3 finding and reruns only checks
      affected by those fixes. Repeat the complete checkpoint matrix only when
      shared or cross-cutting code changed; then commit, push, and record
      closure before `M8-003`.
- **Gate acceptance:** no unresolved severity 1–3 finding and full compatibility
  proof is green.

##### M8-003 — Introduce provider, theme mapping, and structural primitives

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

##### M8-004 — Migrate buttons and field controls

- **Status/dependencies:** `PENDING`; depends on `M8-003`.
- **Owned scope:** facade button/link/action and input/choice components plus
  their tests and gallery fixtures.
- [ ] Convert `Button`, `IconButton`, `LinkButton`, and `ActionCard`,
      translating `onPress`, variants, loading/disabled state, refs, and
      accessible names internally.
- [ ] Convert `Field`, `TextField`, `TextArea`, `SearchField`, `SecretField`,
      `DecimalField`, `MoneyField`, `SelectField`, `ColorChoiceField`,
      `Checkbox`, `RadioGroup`, `Switch`, and `SegmentedControl`.
- [ ] Retain native `NativeDateField`, `NativeTimeField`, and `FileField`
      controls while adopting the shared Mantine-compatible field shell.
- [ ] Test controlled updates, validation/error association, required labels,
      keyboard/touch use, clear/reveal controls, decimal strings, select
      popovers, disabled/read-only state, focus ring, autofill, and compact
      overflow.
- **Focused verification:** affected tests, changed-file format/lint, and a
  targeted keyboard/focus smoke only for behavior unsafe to defer to `R-820`.
- **Acceptance:** screens retain facade contracts and no field relies on
  feature-owned Mantine styling or a second form-state authority.

##### R-820 — Foundation and controls review checkpoint

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

##### M8-005 — Migrate overlays, disclosure, menus, and feedback

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

##### M8-006 — Migrate reusable navigation, form, filter, and status patterns

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

##### R-830 — Overlay and reusable-pattern review checkpoint

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

##### M8-007 — Recompose expense, organization, and manual-entry components

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

##### M8-008 — Recompose receipt, Gemini, sync, conflict, and portability UI

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

##### R-840 — Domain-composite review checkpoint

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

##### M8-009 — Remove superseded implementation and enforce boundaries

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

##### M8-010 — Full migration regression, visual closure, and handoff

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

##### R-850 — Final independent Mantine migration review

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

## Parallel Lanes, Agents, and Worktrees

This section records the orchestration policy used by M0–M7. It does **not**
apply to M8. The M8 Mandatory Single-Agent Execution Rule overrides it: M8 has
no implementation sub-agents, parallel lanes, advisors, or implementation
worktrees, and permits a separate agent only for its named read-only review
gates.

The future default orchestrator and bounded workers/reviewers may use
`gpt-5.6-luna` with `xhigh` reasoning, as requested by the owner. Use the same
capable model for review; independence comes from a fresh bounded assignment and
evidence, not from choosing a weaker model. The orchestrator retains integration
ownership and must not delegate interpretation of skill instructions or
unresolved product choices.

Maximum useful concurrency is three sub-agents plus the orchestrator. Start
fewer when fewer dependency-ready tasks have disjoint ownership. Approved
parallel waves are:

- `F-001`, `F-002`, `F-003` in separate spike worktrees.
- After `D-101`, run `D-102`, `D-103`, and `U-104` in parallel, capped at three
  active workers.
- After `R-200`, `L-201`, `L-203`, `A-301`, and `S-401` are logically disjoint;
  schedule at most three and prioritize the local vertical slice.
- Later UI tasks are not parallel with changes to their actor/contract owner
  unless the actor contract was locked and file ownership is disjoint.
- Review gates never run concurrently with unintegrated milestone work.

Create a worktree only for a dependency-ready task expected to produce a
meaningful independent commit. Name branches `task/<task-id>-<slug>` and place
worktrees outside the repository directory. Record the worktree path using `~`
for the home-directory prefix (for example, `~/git/worktrees/...`), branch, base
commit, assigned files/contracts, agent, and expected merge order in the Current
Checkpoint before dispatch. This avoids exposing the owner's account name in new
checkpoints, worker prompts, and status reports; existing historical records
need not be rewritten.

The root/orchestrator is the sole integration owner and the only agent allowed
to update `master` or this ledger while parallel work is active. Workers commit
their bounded code and tests together on task branches; they do not push or
merge `master`. The integration owner inspects diff/tests, integrates in the
recorded order, runs affected tests after each integration and the milestone
gate afterward, updates this ledger, then pushes `master`.

Never remove a worktree with uncommitted changes or a branch not demonstrably
integrated. On interruption, preserve the directory and branch and record its
exact state. Avoid parallel ownership of `deno.json`, lockfiles, canonical
schemas/contracts, shared tokens/components, generated files, or this ledger;
one integration task owns those collision points.

## Commit, Push, and Checkpoint Policy

- **Risk-based pre-commit baseline:** format and lint changed files, run
  `deno task test:affected`, add the narrowest explicit check for relevant
  non-import effects, and run `git diff --check`. Use
  `deno test --related=<path>` when a known source file needs direct dependency-
  graph coverage. A required failing command blocks the commit.
- Before `F-004` establishes the canonical task aliases, the isolated foundation
  spikes run the equivalent direct Deno commands written in their task entries;
  this is not permission to skip formatting, linting, type/proof execution, or
  diff validation.
- **Non-import effect matrix:** add schema documentation checks for schema
  changes; an app build for dependencies or production build configuration;
  gallery/browser inspection for CSS, HTML, focus, overlay, navigation, and
  responsive behavior; the affected E2E for a changed journey seam; and Pages,
  CI, PWA, or tooling checks only when their owned files or behavior changed.
  Batch coherent UI visual checks at the next review gate.
- `deno task verify` is a final/release or genuinely unbounded cross-cutting
  gate. It runs each Deno test module and E2E suite once. Never run it and then
  mechanically rerun its constituent or overlapping subset commands against the
  same commit.
- Every worker handoff lists each exact command, exit result, and any
  intentionally unavailable manual/platform check. “Tests pass” without command
  evidence is not acceptable to the integration owner.
- Prefer one focused implementation commit per task; a task may use two or three
  commits only when a reviewable foundation, behavior, and fix naturally
  separate. Tests required by the task ship with the behavior, never in a later
  cleanup commit.
- Run the task's cheapest capable checks before committing. A historical task
  entry may list broader evidence used when that task originally completed; it
  does not override this policy for new work. Do not create knowingly red
  commits as progress markers.
- After integration, make a small ledger/checkpoint commit if the task commit
  could not safely include it. Push `master` after each completed task or small
  inseparable integration group and after every review/fix gate.
- Commit messages lead with the outcome, and review fixes identify the gate, for
  example `Implement canonical expense schema` and
  `Fix R-300 local workflow review findings`.
- Never force-push. Reconcile remote changes, actual Git history, tests, and the
  recorded checkpoint before resuming. A checkbox is not evidence.

## Interruption and Recovery Protocol

This protocol applies to rate limits, context/session loss, terminal closure,
machine restart, network failure during push, interrupted sub-agents, and any
other case where the recorded integration owner may no longer be active. An
interruption does not broaden authorization, justify destructive cleanup, or
turn incomplete work into a completed task.

### Before a predictable interruption

When a rate/token limit or shutdown is approaching, the orchestrator must stop
dispatching new work and perform the safest possible handoff:

1. Collect each active worker's task ID, branch/worktree, diff/commit state,
   exact validation commands/results, and next intended action. Do not wait so
   long that the handoff itself is lost.
2. Commit and push only a coherent increment which passes the mandatory
   pre-commit baseline and its additive layer checks. Never create a knowingly
   failing “WIP” commit merely to empty a worktree.
3. Preserve incomplete or unvalidated changes in their existing named worktree.
   Record its absolute path, branch, base and latest commit, `git status`/diff
   summary, files owned, tests already run, failures or unknowns, and the first
   recovery command. Do not stash, discard, relocate, or delete it.
4. Update this ledger: keep genuinely active owned work `IN_PROGRESS`, mark work
   whose agent/session will stop as `INTERRUPTED`, record any local commit whose
   push is still pending, and identify the next safe recovery action. Commit and
   push that checkpoint when possible.
5. If the checkpoint cannot be pushed, leave a local checkpoint commit when it
   is coherent and record/preserve it. The next session must compare local and
   remote history rather than assuming `origin/master` contains the handoff.

### Mandatory audit after any interruption

A fresh or resumed orchestrator performs this read-only audit before changing
files, creating worktrees, reassigning agents, pulling, merging, or marking a
task complete:

```text
git status --short --branch
git log --oneline --decorate -n 20
git branch -vv
git worktree list --porcelain
git rev-list --left-right --count origin/master...master
```

When network access is available, run `git fetch --prune origin` and repeat the
upstream comparison. For every recorded or discovered worktree, run its own
`git status --short --branch`, inspect staged and unstaged diffs, list commits
not integrated into `master`, and compare them with the task's allowed
ownership. Also check whether any previously launched process or agent is
actually still running; a stale `IN_PROGRESS` label is not proof of a live
owner.

Then reconcile this ledger with evidence:

- A clean, pushed integrated commit is not `COMPLETE` until the task's required
  validations and review evidence are present; rerun missing or stale checks.
- A committed worker branch remains unintegrated work. Review and verify it in
  the recorded merge order; never recreate the same task in parallel.
- An uncommitted worktree is preserved and inspected. Resume the same bounded
  task there, or reassign that exact worktree with a precise handoff. Never
  delete, overwrite, or independently reimplement its changes.
- A dirty `master` is treated as recovery work of unknown completeness. Inspect
  ownership and diffs before continuing; do not reset, checkout over, stash, or
  commit it until its task and validation state are understood.
- A local commit not on `origin/master` is inspected and validated, then pushed
  normally. If remote history advanced, integrate it safely without force-push.
- A task recorded `IN_PROGRESS` or `INTERRUPTED` with no surviving work is moved
  back to `READY` only when all dependencies remain complete and no output was
  lost; otherwise record the exact missing evidence or genuine blocker.
- Surviving worktree paths can change after a machine rebuild. Locate by branch
  and commit, record the new absolute path, and never assume absence from the
  old path means the work was safely integrated.

Before resuming edits, update the Current Checkpoint with actual HEAD/upstream,
active and interrupted tasks, every surviving branch/worktree, validation
evidence, unpushed commits, and one exact next action. Push this reconciliation
checkpoint if it changes shared state. Only then resume the dependency graph.

### Recovery completion

Recovery is complete when every discovered change is assigned exactly once, no
worker unknowingly duplicates another branch, the ledger matches Git and test
evidence, and the next action is dependency-safe. The normal implement, review,
validate, commit, push, and checkpoint loop then continues. Rate limits and
restarts are operational interruptions, not reasons to mark a task `BLOCKED`,
skip review, weaken tests, or request product decisions.

## Long-Running Worker and Review Progress Protocol

Long reviews and implementation tasks may legitimately take several bounded
command windows. Silence is not completion, and one missed update is not an
interruption. Progress is operational telemetry and a resumable handover: if a
final response is lost to context compaction, rate limiting, or session loss,
the latest progress record must let the next orchestrator resume without
guessing. Only the final handoff and the orchestrator's ledger update can change
a task's completion or gate status.

### Preferred progress channel

When the agent environment exposes a child-to-parent message or progress
operation, a worker or reviewer should send a concise update at least every five
minutes and after each major phase. Each update must include an ISO-8601 UTC
timestamp, task/review ID, worker identity, phase, last completed command and
result, current command and start time, next action, finding counts by severity
so far, and any blocker or unavailable check. It must say
`PROGRESS — not a final handoff` so it cannot be mistaken for approval.

The current orchestration interface documents orchestrator-to-agent `send_input`
and agent waiting, but no dependable proactive child-to-parent progress call.
Agents must not assume that a queued input is a progress channel. The fallback
below is therefore mandatory for a long-running task when no such
child-to-parent operation is available.

### Markdown fallback

Before dispatching a review expected to exceed one command window, or when a
writer reports that it may be long-running, the orchestrator creates and records
a dedicated review/worker worktree using the normal `~` path privacy rule. The
worker may write only the untracked progress file `<TASK-ID>-progress.md` in
that worktree; source, tests, configuration, the implementation plan, and
commits remain outside its write scope unless the task explicitly authorizes
them. The file is operational evidence and a resumable handover, not a second
plan, and must never be committed or pushed. The implementation plan remains the
authority for sequencing and status; the progress file preserves the worker's
latest execution state and review reasoning between plan checkpoints.

Update the file at least every five minutes between commands, immediately before
and after a long command, and before yielding or stopping. Use this shape so the
orchestrator can inspect it without guessing:

```markdown
# Progress — R-200

- status: `PROGRESS — not a final handoff`
- updated_at_utc: `2026-08-24T12:00:00Z`
- worker: `reviewer-name (agent-id)`
- phase: `command matrix | source inspection | failure-path check | handoff`
- base_commit: `663a874`; owned_scope: `read-only source; progress file only`
- last_completed: `deno task check` — exit `0`
- current: `deno task a11y:gallery` — started `2026-08-24T11:58:00Z`
- next: `inspect actor persistence and adapter error boundaries`
- findings: `S1=0, S2=0, S3=1, S4=0`
- blocker: `none` or a redacted concrete condition
- last_safe_checkpoint:
  `no source changes; progress file is the only worktree mutation`
- recovery_command: `read this file, run git status, then resume current/next`
- handoff: `resumable progress; not a final approval`
- repository_mutation: `none`
```

Do not put credentials, tokens, receipt images, personal data, full home
directory names, or unredacted hostile model output in progress messages or
files. Use `~` in paths. On interruption, preserve the worktree and progress
file, inspect its timestamp and Git state, and record the recovery action in the
Current Checkpoint. A progress file is stale after fifteen minutes without an
update, or after three expected update intervals; the orchestrator must first
send a bounded status request when possible, then perform the full Interruption
and Recovery Protocol before closing or reassigning the worker.

Reviewers are explicitly encouraged to append a progress entry continuously, not
only when asked: record each completed validation phase, provisional or
confirmed finding, evidence location, recommendation, and the next safe action.
The latest entry must be a usable handover if the reviewer loses its final
response or the orchestrator's context is compacted. Before the final response,
append one handoff entry containing the complete command/result matrix, every
unresolved finding with severity and file/line evidence, unavailable checks,
worktree/Git state, and explicit APPROVE or BLOCK. This entry is still not
approval by itself; the orchestrator verifies it against the repository and
updates the plan.

### Stall escalation and advisor backoff

If a worker or reviewer has stale progress for three expected intervals, the
same command/failure has resisted two bounded attempts, or the local scope
reveals a cross-cutting contradiction, the orchestrator must stop repeating the
same prompt. First preserve the progress handover, inspect the worktree and Git
state, and send one bounded status request. If the issue remains unclear,
dispatch one fresh read-only advisor agent for that specific task or finding.
Give the advisor the task ID, progress handover, exact evidence, authoritative
specs, locked contracts, and explicit non-goals.

The advisor's job is to step back and recommend the smallest reasonable
unblocking path. It may challenge internal architecture, type structure, testing
strategy, or infrastructure choices when approved user behavior and
specification remain unchanged. It may identify a missing contract, a better
ownership split, or a safe recovery sequence. It must not edit source, alter the
product requirements, weaken a test, enable deployment, or invent scope; it
returns evidence, options, tradeoffs, and a recommendation. The advisor also
follows the progress/handover protocol if its assessment is long-running.

After the advisor returns, the orchestrator chooses one of three bounded paths:

1. If the issue is an implementation detail within the approved specs, record
   the recommendation and dispatch or resume the owning worker with the
   narrowest fix and regression test.
2. If the issue requires an internal contract/ownership adjustment but does not
   change user behavior, update this plan with the impact list and obtain
   integration-owner review before changing the locked contract.
3. If the issue is a contradiction, ambiguity, or proposed change to an approved
   user requirement, preserve all work, mark the exact task `BLOCKED`, and yield
   one concise decision request to the human owner.

Do not spawn multiple advisors for the same stall, keep retrying a dead end
after the advisor has recommended a path, or treat advisor uncertainty as
permission to broaden scope. Advisor backoff is a recovery aid, not a reason to
bypass dependency order, safety checks, the review gate, or the human decision
boundary.

### Final handoff boundary

The worker's final response must repeat the exact validation commands/results,
all findings with severity and file/line evidence, unavailable checks, and an
explicit `APPROVE` or `BLOCK` for reviews. The latest progress file must carry
the same handover essentials before that response is sent. After context
compaction or a resumed session, the orchestrator reads both the plan and the
latest progress handover before waiting, closing, integrating, or dispatching.
The orchestrator removes the untracked progress artifact only after preserving
any needed evidence in this ledger and confirming the worktree is clean or
safely preserved. Never mark a task complete from a progress update, a quiet
process, or a stale file.

## Review and Fix Loop

For every implementation task:

1. The implementer reads the authoritative specs, this task, locked contracts,
   and applicable skills; states assumptions and owned files before editing.
2. The implementer writes the lowest-layer tests with or alongside behavior,
   runs affected tests and the narrowest capable non-import checks, records
   exact commands/results, inspects the diff for unrelated or secret changes,
   and only then commits a green bounded result.
3. The integration owner reviews scope and evidence before integration. It may
   trust exact successful evidence for the same commit and reruns only checks
   selected for a concrete integration risk. A failed contract or collision
   returns to the worker; it is not patched blindly during merge.
4. At each `R-*` gate, a fresh Luna `xhigh` reviewer independently inspects the
   milestone against specs, locked contracts, tests, and actual behavior. The
   reviewer is read-only first and reports severity, evidence, affected files,
   and a minimal corrective recommendation.
5. Substantiated findings become bounded fix tasks owned by the appropriate
   implementer or a fresh worker. Every fix adds/regresses the cheapest useful
   test and reruns the affected visual/a11y inspection where applicable.
6. After fixes, the integration owner reruns affected validation and repeats the
   entire gate only when shared or cross-cutting code changed. It records
   evidence and commit, pushes, and only then releases downstream dependencies.

Review severity: severity 1 risks data loss/security/privacy or makes a core
flow unusable; severity 2 violates an approved requirement or architecture/test
contract; severity 3 is a contained quality/accessibility/maintainability issue;
severity 4 is optional polish. Severity 1–2 block the gate. Severity 3 must be
fixed unless the owner explicitly accepts it. Severity 4 cannot expand MVP.

## Current Checkpoint

- **Plan state:** Implementation and milestones M0 through M7 (including Q-601,
  Q-602, Q-603, Q-604, and R-700) are `COMPLETE`. The ordered M8 Mantine
  migration plan is written; `M8-001` through `M8-010` and `R-810` through
  `R-850` are `PENDING`.
- **Reconciled branch/upstream:** `master` is aligned with `origin/master`.
- **Integrated implementation state:** All features, adapters, XState actors, UI
  workflows, and PWA capabilities are integrated and verified.
- **Completed implementation tasks:** `P-000`, `F-001`–`F-005`, `R-100`,
  `D-101`–`D-103`, `U-104`, `R-200`, `L-201`–`L-205`, `R-300`, `A-301`–`A-303`,
  `R-400`, `S-401`–`S-405`, `R-500`, `X-501`–`X-502`, `P-503`, `R-600`,
  `Q-601`–`Q-604`, `R-700`.
- **Owner authorization:** The owner approved Mantine as the migration target
  and authorized preparation of this plan only. M8 implementation is not yet
  authorized; a later explicit start instruction is required.
- **Worktree state:** Repository is clean with no unmerged worktrees.
- **Verification status:** Full `deno task verify` passed across all test
  suites, builds, and browser/a11y validations.
- **Validation-policy revision:** Risk-based affected testing is now the normal
  task path; the umbrella test discovers each Deno test module once, the full
  gate runs Deno tests/E2E/build once, Pages can inspect the existing artifact,
  and UI/browser checks are checkpoint-batched. Fresh read-only review
  `final_policy_review` approved closure after the committed-batch base commands
  were made explicit. The revised `deno task verify` passed with 331 Deno tests,
  11 E2E tests, three-viewpoint gallery/axe inspection, browser-tooling smoke,
  unique toolchain invariants, one production/toolchain build, Pages artifact
  inspection, frozen audit, and diff check.
- **M8 active/interrupted work:** none. No implementation or review agent is
  assigned, no migration branch/worktree exists, and no M8 commit is unpushed.
- **Unresolved M8 findings/blockers:** implementation authorization is the only
  prerequisite not yet satisfied; this is an authorization boundary, not a
  technical failure.
- **Exact next action:** wait for explicit owner authorization. Once received,
  run the M8 restart/recovery checklist, mark only `M8-001` `IN_PROGRESS`, and
  execute it with the primary agent; do not dispatch an implementation agent.

Every checkpoint update must record completed, active, and interrupted task IDs;
integrated and unpushed commit hashes; verification commands/results; active or
preserved worktrees/agents; unresolved findings or blockers; recovery notes when
applicable; and the exact next dependency-ready task or recovery action.

## Ready-to-Use Orchestration Prompt

```text
Act as the single primary coding agent for the M8 Mantine design-system
migration in this repository. Do not act as a parallel orchestrator.

Before changing anything:
1. Read IMPLEMENTATION_PLAN.md completely.
2. Read the complete M8 section again and execute its Restart and Compaction
   Recovery Checklist. Reconcile Current Checkpoint with branch, upstream,
   commits, worktrees, active agents/processes, files, dependency state, and
   test evidence. Actual repository evidence wins. Preserve all unexpected or
   incomplete work and never reset, discard, stash, or duplicate it.
3. Read AGENTS.md, SPEC.md, UI_SPEC.md, DESIGN_SYSTEM.md, README.md, and every
   applicable skill instruction completely before selecting or changing a task.
4. Confirm that the owner has explicitly authorized M8 implementation after
   this plan was written. Approval of Mantine or of the plan alone is not
   implementation authorization. If authorization is absent, stop without
   changing source, dependencies, CSS, configuration, or generated assets.

Once authorized, continue sequentially until R-850 is COMPLETE or a genuine
owner decision is required:
- Use one primary agent only for all implementation, fixes, validation, commits,
  pushes, and ledger updates. Never dispatch implementation workers or advisors,
  never create an M8 worktree, and never overlap M8 tasks.
- Mark exactly one dependency-ready task IN_PROGRESS. Follow its checklist and
  the M8 per-task evidence checklist, preserve the facade and locked boundary
  rules, inspect every diff, and commit/push only green focused changes.
- After each task, record exact commands/results, browser states/viewports,
  commit/push state, findings, and the next dependency-ready action in Current
  Checkpoint so a compacted or restarted session can resume without inference.
- Stop at R-810, R-820, R-830, R-840, and R-850. Only there, dispatch one fresh
  independent read-only reviewer agent. The reviewer must not edit, commit,
  push, create a worktree, or delegate. The primary agent fixes findings
  sequentially and obtains the required fresh closure review.
- Prefer unit/domain, XState actor, adapter integration, and component tests.
  Keep E2E to the five approved browser journeys and use a proper E2E dependency,
  not agent-browser, for pass/fail assertions. Use agent-browser separately for
  Chromium visual, interaction, accessibility-tree, and axe inspection.
- Never redesign screens, adopt Mantine Form for business state, leak Mantine
  imports/types/styles into features, copy library source, add deferred scope,
  weaken tests, add live credentials/backend behavior, use destructive Git, or
  force-push. Never claim an unavailable check was performed.

If blocked by a real owner decision, preserve and push all safe completed work,
record the exact blocker and recovery action in Current Checkpoint, and ask one
concise decision batch. After interruption or compaction, preserve the work and
make the next session restart from the M8 recovery checklist rather than from
memory.
```
