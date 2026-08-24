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
  last known evidence, and exact recovery action. This is resumable state, not
  a product blocker.
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
   only by a TODO, mock in production, skipped test, or undocumented manual step.
2. `deno task fmt:check`, `deno task lint`, `deno task check`,
   `deno task test`, `deno task test:integration`, `deno task test:component`,
   `deno task test:e2e`, and `deno task build` pass from a clean clone using the
   pinned Deno and lockfile state. `F-001` may adjust command names once and must
   update this plan everywhere if it does.
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

## Task Ledger

### M0 — Specification

#### P-000 — Freeze coherent approved documentation

- **Status/dependencies:** `COMPLETE`; no dependencies. Draft `e9e0822`, review
  fixes `5165d60`, and independent closure verification are pushed/recorded.
- **Ownership:** `SPEC.md`, `UI_SPEC.md`, `DESIGN_SYSTEM.md`, `AGENTS.md`,
  `README.md`, and this file only.
- **Scope/non-goals:** create this executable plan, obtain an independent review,
  and fix documentation contradictions. No application code, dependency setup,
  spike, or deployment.
- **Outputs/acceptance:** all six documents agree; open items are technical
  compatibility outputs assigned below rather than unowned product decisions;
  plan includes stable tasks, gates, tests, ownership, and resume prompt.
- **Tests:** documentation link/path checks, heading/task-ID uniqueness, and
  human coherence review; no application test.
- **Verification:** `git diff --check`; `rg '^(#### [A-Z]-[0-9]{3})' IMPLEMENTATION_PLAN.md`;
  inspect `git status --short --branch`; independent review report resolved.

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
- **Outputs/acceptance:** pinned versions/lockfile; exact canonical task commands;
  a self-contained spike compile/render/actor/component/browser proof which does
  not depend on the later production harness; documented fallback selected only
  if Playwright cannot run reproducibly without a Node/npm project toolchain.
- **Tests:** strict compile failure fixture, XState actor transition, React Aria
  render/event, Testing Library role query, and one Playwright smoke page.
- **Verification:** `deno task verify:toolchain`, which runs every disposable
  spike proof and fails on any incompatibility; `git diff --check`.

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
- **Outputs/acceptance:** executable compatibility matrix and pass/fail evidence;
  chosen Automerge APIs and limitations; alternative-evaluation task proposed
  only on failure and marked owner-visible before architecture changes.
- **Tests:** one deterministic test per required merge primitive, two-device
  convergence, restart from IndexedDB, and retirement preventing resurrection.
- **Verification:** `deno run -A spikes/automerge/verify.ts`; repeat that runner
  with randomized operation ordering under a recorded seed;
  `deno fmt --check spikes/automerge`; `deno lint spikes/automerge`;
  `git diff --check`.

#### F-003 — Prove browser Google, image, and PWA integrations

- **Status/dependencies:** `COMPLETE`; depends on `P-000`. Worker commit
  `c6b2f8f` and scoped fix `200a9a5` were integrated by `dd20e31` and
  `0ccfea6`; the required browser-integration proofs pass from `master`.
- **Ownership:** `spikes/browser-integrations/**` and its decision record only.
- **Scope/non-goals:** prove browser-safe use of Google Identity/Drive app-data,
  `@google/genai` model listing and structured image output, ephemeral camera/file
  input, EXIF stripping, preparation on/off semantics, CSP, base-path routing,
  and repository-scoped service-worker behavior. Use synthetic images/data;
  live calls are optional manual smoke checks, never CI prerequisites.
- **Outputs/acceptance:** exact OAuth/scopes and redirect constraints, adapter
  feasibility, model compatibility-test approach, evidence-based image limits,
  supported formats, and no backend requirement—or a blocked owner decision if
  a browser requirement truly fails.
- **Tests:** fake SDK contract tests; metadata-removal fixture; structured-output
  validation; hash refresh/base-path/service-worker-scope browser proofs.
- **Verification:** `deno run -A spikes/browser-integrations/verify.ts`, using
  its self-contained runner and browser fixture;
  `deno fmt --check spikes/browser-integrations`;
  `deno lint spikes/browser-integrations`; `git diff --check`. Production build
  and browser-agent inspection begin only after `F-004`/`F-005` own them.

#### F-004 — Create the application skeleton and CI/deployment pipeline

- **Status/dependencies:** `COMPLETE`; depends on `F-001`, `F-002`, `F-003`,
  all complete. Worker commit `d398608` and CSP fix `fe38734` were integrated
  as `612f5c5` and `3f40033`; the canonical foundation gate passes from
  `master`.
- **Ownership:** root tool configs, `.github/workflows/**`, `scripts/**`, minimal
  `src/app` entry, static manifest/icons placeholders generated without product
  styling; not domain/features.
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

- **Status/dependencies:** `COMPLETE`; depends on `F-001`, `F-003`, `F-004`,
  all complete. Worker commit `0c6787f` was integrated as `f22c7c3`; the
  required foundation and F-005 validation commands pass from `master`.
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
  yields a nonzero result and useful trace, checksum failure aborts installation,
  `agent-browser` screenshot/tree/a11y smoke.
- **Verification:** `deno task test`; `deno task test:integration`;
  `deno task test:component`; `deno task test:e2e`; `deno task browser:install`;
  `deno task browser:verify`.

#### R-100 — Foundation independent review gate

- **Status/dependencies:** `COMPLETE`; depends on `F-004`, `F-005`, both
  complete. Bohr found five issues; scoped fixes were integrated and fresh
  reviewer Russell (`01a030e8-5ae2-7633-a97a-75eb8fd4dddc`) approved closure
  with no unresolved severity-1/2/3/4 findings.
- **Ownership:** read-only review first; findings in this ledger; fixes return to
  owning task/files through a scoped fix commit.
- **Scope/non-goals:** independently review reproducibility, Deno-only execution,
  TypeScript 7 enforcement, dependency/security posture, CI permissions,
  base-path/PWA correctness, fake boundaries, and evidence from all spikes.
- **Outputs/acceptance:** no unresolved high/medium finding; compatibility
  decisions frozen; full foundation commands pass after fixes.
- **Tests:** rerun all M1 tests and deliberately exercise one failed CI/test path.
- **Verification:** all `F-004` and `F-005` commands plus clean-clone build.

### M2 — Domain, Actor, Adapter, and Design-System Contracts

#### D-101 — Define canonical domain schema, money, migrations, and export shape

- **Status/dependencies:** `COMPLETE`; depends on `R-100`, which is complete.
  Worker commit `9bd7be0` was integrated as `99f0984`; the orchestrator
  completed recovery after the worker interruption and the required D-101
  validations pass from `master`.
- **Ownership:** `src/domain/schema/**`, `money/**`, `migrations/**`, documented
  canonical JSON schema and domain fixtures; no persistence/service/UI code.
- **Scope/non-goals:** versioned Zod 4 schemas and TypeScript types for projects,
  categories, expenses, receipt parents/lines/adjustments, device registry,
  tombstones, retirement markers, revisions, settings split, imports/exports,
  stable IDs, dates/time, and canonical decimal strings. No cross-currency
  conversion or UI formatting decisions beyond approved semantics.
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
  tags, outputs, persisted snapshots, invoked/spawned actor ports, and ownership.
  Avoid giant root context, duplicated mode booleans, and machines for pure
  selectors.
- **Outputs/acceptance:** XState v5 `setup(...)` contracts compile; modes live in
  states; UI can derive availability with snapshots/tags/`can`; persistence and
  cancellation boundaries are explicit; future structured automation could
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
- **Outputs/acceptance:** SDK/browser objects do not cross ports; abort/retry and
  typed error taxonomies are explicit; fakes support deterministic offline,
  quota, conflict, corruption, and partial-transport scenarios.
- **Tests:** port contract fixtures, fake determinism, abort behavior, error
  mapping exhaustiveness, and secret redaction.
- **Verification:** `deno task test --filter adapter-contract`; `deno task check`.

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
- **Outputs/acceptance:** component APIs cover the screen mapping; all states are
  visible in the gallery; future light tokens require no API change; compact,
  medium, and wide layouts avoid page-level horizontal overflow.
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
  reviewer Banach (`01a0312e-b8bb-7582-8ae0-e8fbc7ca9eef`) completed a
  read-only review of pushed checkpoint `b398037` and returned `BLOCK`; all
  scoped findings are now integrated. Closure reviewer Hypatia
  (`01a0314e-8936-7d53-a90f-ddf11e95f757`) completed with `BLOCK`; the
  orchestrator integrated the three scoped fixes and must dispatch one fresh
  independent closure reviewer from the new clean checkpoint. Closure-3
  reviewer Linnaeus (`01a03187-24aa-7521-b137-52ad5912d31f`) approved the
  complete gate at `c390656` with no new findings; the contracts are now locked
  for downstream M3 work.
- **Ownership:** read-only first; scoped fixes by original owner/integration
  owner; contract changes documented with affected downstream tasks.
- **Scope/non-goals:** review schema completeness, actor decomposition/v5
  correctness, adapter leakage, fake fidelity, design-system reuse/accessibility,
  and contract consistency across all approved screens.
- **Outputs/acceptance:** contracts declared locked; no unresolved high/medium
  finding; downstream ownership can remain disjoint without inventing APIs.
- **Tests:** full domain/actor/adapter/component suites and gallery visual/a11y.
- **Verification:** `deno task verify`; `deno task gallery:verify`; clean Git state.

### M3 — Local Vertical Slice

#### L-201 — Implement Automerge/IndexedDB local repository and migrations

- **Status/dependencies:** `COMPLETE`; depends on `R-200`.
- **Ownership:** `src/adapters/local/**`; changes to locked domain/ports require
  approval. No feature UI or Google transport.
- **Scope/non-goals:** repository-namespaced IndexedDB, Automerge document load,
  atomic multi-record transactions, indexes/query projections, migration backup
  and recovery, local revisions/tombstones, and restart hydration.
- **Outputs/acceptance:** offline-first commit succeeds independently of network;
  crashes cannot expose partial receipt/import mutations; corrupt/migration
  failures preserve recoverable prior data and emit typed errors.
- **Tests:** fresh/open/restart, atomic rollback, concurrent local commits,
  migration fixtures for every version, corruption, quota/failure, tombstones,
  and deterministic projection rebuild.
- **Verification:** `deno task test:integration --filter local-repository`;
  `deno task check`.

#### L-202 — Implement project and category actors/domain operations

- **Status/dependencies:** `COMPLETE`; depends on `L-201`, `D-102`.
- **Ownership:** project/category domain services, actors, selectors; no screens
  except headless actor fixtures. A bounded internal-contract follow-up may add
  the missing project reorder command to `src/actors/contracts/types.ts` and
  its focused actor-contract coverage; this does not change approved user
  behavior or expand the task beyond ordering already in scope.
- **Scope/non-goals:** first/default/last-selected project, stable custom project
  ordering, rename/archive/restore/empty delete, the guard requiring a switch
  away before archiving the current project, default currency, global ordered
  categories, protected Uncategorized, archive/delete-and-reassign,
  deleted-category redirection, and offline operations. Populated-project
  destructive workflow belongs to `X-501`.
- **Outputs/acceptance:** invariants are transactional and actor snapshots expose
  exact available actions/errors without UI-only rules.
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
- **Scope/non-goals:** project scoping, current/custom calendar periods, category,
  currency, merchant/description search, signed amount range, newest/oldest
  stable ordering, receipt grouping, category breakdown, and separate-currency
  outflow/money-back/net totals. No rolling windows, charts, or conversion.
- **Outputs/acceptance:** list and summaries consume one filter object and cannot
  disagree; optional receipt time is inherited by lines for ordering.
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
- **Outputs/acceptance:** UI can render entirely from snapshots and dispatch typed
  events; accepted saves commit locally before navigation; failed saves retain
  input; explicit dates never change with timezone.
- **Tests:** happy/edit/delete/undo, invalid decimals/required fields, 03:00 day
  boundary, suggestion clearing, reload hydration, duplicate-submit prevention,
  discard confirmation, repository failure/retry, and event path coverage.
- **Verification:** `deno task test --filter manual-expense`; `deno task test
  --filter shell-actor`; `deno task test:integration --filter manual-save`;
  `deno task check`.

#### L-205 — Deliver the complete local browsing and organization UI slice

- **Status/dependencies:** `COMPLETE`; depends on `L-202`, `L-204`, `U-104`.
- **Ownership:** shell plus Screens 1–3, 6–9 and non-destructive project/category
  editor composition; no Gemini/Drive/destructive workflows.
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
- **Tests:** all M2/M3 suites, local E2E, migration restart and failure injection.
- **Verification:** `deno task verify`; `deno task test:e2e --grep local`;
  agent-browser local-screen audit.

### M4 — Receipt Intelligence

#### A-301 — Implement image preparation and Gemini adapter

- **Status/dependencies:** `COMPLETE`; depends on `R-200`, `F-003`; may
  begin after `R-200` in parallel with M3 where ownership is disjoint.
- **Ownership:** `src/adapters/gemini/**`, image utilities and structured Gemini
  schema mapping; no receipt actor/UI. A bounded integration follow-up may
  extend the internal Gemini draft port only; it does not change user behavior
  or receipt requirements.
- **Scope/non-goals:** API-key/model listing/test, capability labels including
  Needs test, schema-constrained request, browser revalidation, permitted prompt
  context only, the repository-namespaced `localStorage` secret port with
  automatic persistence until explicit removal, EXIF stripping always, optional
  resize/compression, ephemeral memory cleanup, cancellation, and typed failures.
  The key never enters IndexedDB, sync, export, fixtures, or logs. No background
  calls or image persistence.
- **Outputs/acceptance:** synthetic adapter contract passes; inspection proves no
  forbidden request data; invalid output cannot reach review; key is redacted
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
  purchase/adjustment/tip lines, uncertainty, selection/edit/add/remove, optional
  adjustment links, totals mismatch, durable structured draft, atomic save and
  discard. Receipt images never enter snapshots.
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
- **Scope/non-goals:** native Take photo/Choose image, preview/use/retake/remove,
  visible disclosure, options, inline key setup, scanning/failure states,
  editable review with uncertainty/mismatch, model type-ahead/compatibility,
  automatic key remembering, masked stored-key display with Remove as the sole
  replacement path, pending-scan continuation after successful quick setup, and
  configuration test. No custom camera or image editor.
- **Outputs/acceptance:** exact approved data disclosure; source images disappear
  after terminal paths; all review actions keyboard/touch accessible; long
  receipts use natural-height responsive cards and desktop adaptation.
- **Tests:** component rendering/events for every actor mode, focus and disclosure,
  automatic key persistence, masking/removal-only replacement, setup validation
  retaining the selected image and continuing the pending scan, model search,
  line selection/edit, mismatch confirmation; fake-Gemini E2E capture through
  atomic save.
- **Verification:** `deno task test:component --filter receipt-ui`;
  `deno task test:e2e --grep receipt-review`; Playwright request-allowlist and
  cleanup assertions; separate agent-browser visual/a11y/tree inspection and
  screenshots at three viewports.

#### R-400 — Receipt independent review gate

- **Status/dependencies:** `COMPLETE`; depends on `A-303`, `R-300`.
- **Ownership:** read-only review first; scoped fixes by A-task owners.
- **Scope/non-goals:** review privacy allowlist, secret handling, image lifetime,
  structured validation, actor safety, financial signs/totals, accessibility and
  visual fidelity. No live personal receipt is used.
- **Outputs/acceptance:** no high/medium finding; fake receipt journey and all
  failure paths pass; network inspection contains only permitted data.
- **Tests:** all M4 tests plus malformed/fuzz output and cancellation leak checks.
- **Verification:** `deno task verify`; receipt E2E; agent-browser receipt audit.

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
- **Tests:** auth success/cancel/revoke/account mismatch, offline/401/403/404/429/
  5xx, pagination, conditional conflict, retry/backoff with fake clock, app-data
  path isolation, retirement marker read-before-upload.
- **Verification:** `deno task test:integration --filter drive-adapter`;
  `deno task check`; optional `deno task smoke:drive` only with explicit env.

#### S-402 — Implement synchronization actor, causal transport, and device registry

- **Status/dependencies:** `COMPLETE`; depends on `S-401`, `L-201`, `D-102`.
- **Ownership:** sync/device actors and causal transport coordinator; no conflict
  or settings screen markup.
- **Scope/non-goals:** local-first dirty state, explicit/connect/reconnect sync,
  pull-before-push, causal change exchange, deterministic convergence, offline/
  auth/quota/failure modes, known-device labels/last-seen/acknowledgements, account
  switch confirmation, and retirement-before-upload. Opaque device IDs remain a
  diagnostic identifier and are not ordinary presentation data. No wall-clock
  auto-winner.
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
  with device/timestamp context, neutral choice/custom value, delete-versus-edit,
  offline resolution revision referencing all parents, durable progress/count.
  No automatic latest-timestamp winner.
- **Outputs/acceptance:** resolved conflicts do not recur after sync; untouched
  conflicts remain visible; resolution cannot claim success before local commit.
- **Tests:** independent edits auto-merge, same-field conflict, custom value,
  delete-versus-edit both choices, receipt-line conflict, offline/reload/resync,
  concurrent resolutions and deterministic final convergence.
- **Verification:** `deno task test --filter conflict`;
  `deno task test:integration --filter conflict-convergence`; `deno task check`.

#### S-404 — Implement canonical JSON import/export workflows

- **Status/dependencies:** `COMPLETE`; depends on `D-101`, `L-201`, `S-402`.
- **Ownership:** import/export domain, actors and file/share adapter composition;
  no Screen 12 markup.
- **Scope/non-goals:** complete documented JSON download/share, validate/preview,
  merge as causal imported changes, replace as a new generation with safety
  backup, interruption recovery, mandatory successful online pre-sync immediately
  before replace whenever Drive is configured, generation coordination, and
  device-local exclusions. No CSV or opaque database export.
- **Outputs/acceptance:** import is atomic; merge deduplicates stable history;
  replace cannot be undone by another device's old generation; key/drafts/images
  are excluded; a configured-Drive pre-sync failure makes no mutation; export
  restores all synchronized records and metadata required for correctness.
- **Tests:** exact round trip, old schema migration, malformed/unknown future
  version, duplicates, merge conflicts, replace cancellation/failure/restart,
  configured Drive offline/pre-sync failure with no mutation, successful pre-sync
  immediately followed by synchronized replacement, unconfigured offline local
  replacement, share unavailable fallback, and secret exclusions.
- **Verification:** `deno task test --filter 'import|export'`;
  `deno task test:integration --filter import-sync`; schema-doc verification.

#### S-405 — Deliver Drive, Conflict, Known Devices, and Import/Export UI

- **Status/dependencies:** `COMPLETE`; depends on `S-402`, `S-403`, `S-404`,
  `U-104`, `L-205`.
- **Ownership:** Screens 10, 10A, 10B, 12, global sync/conflict indicators;
  no adapter/domain contract changes.
- **Scope/non-goals:** connect/account/status/sync-now/disconnect entry, conflict
  banner/list/field resolution, known-device labels/status, export and import
  merge/replace previews/warnings/progress/recovery. Ordinary Known Devices hides
  opaque IDs; an optional labeled technical-details view may reveal them only
  for diagnosis. No live-call E2E.
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
  safety, offline honesty, and UI/actor separation. E2E is not used to substitute
  for schedule-level integration evidence.
- **Outputs/acceptance:** no high/medium finding; seeded multi-device suites pass
  repeatedly; no credential/log leakage; fake Drive E2E remains narrow. A
  review BLOCK requires a bounded fix wave and a fresh independent closure
  review before downstream M6 work is released.
- **Tests:** all M5 tests, reordered/failing transport schedules, corrupt imports,
  account switching, restart at every durable workflow stage.
- **Verification:** `deno task verify`; approved E2Es; agent-browser M5 audit.

### M6 — Destructive Workflows and PWA Completion

#### X-501 — Implement populated-project deletion

- **Status/dependencies:** `IN_PROGRESS`; depends on `R-500`, `L-202`.
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

- **Status/dependencies:** `PENDING`; depends on `X-501`, `S-402`, `S-404`.
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
- **Outputs/acceptance:** retired payload cannot be re-uploaded; erased financial
  data never enters progress snapshots; export acceptance and explicit
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

- **Status/dependencies:** `PENDING`; depends on `X-502`, `A-303`, `S-405`,
  `F-004`.
- **Ownership:** Screens 13–15, remaining Settings composition, install/update/
  connectivity actors and concrete service worker/cache policy.
- **Scope/non-goals:** expense-day preference/example, data/privacy disclosures,
  exact README AI disclosure, licenses/repository/version/commit, install offer
  after useful action, About install fallback, checking/update-ready/explicit
  reload, cache/offline launch, unsupported browser explanation, and no surprise
  reload. No analytics, tutorial, theme switch, or decorative motion.
- **Outputs/acceptance:** offline local capabilities match spec; unsaved input is
  protected during update; service worker never escapes repository scope;
  update status is actor-driven and accessible.
- **Tests:** day-boundary examples, disclosure exactness, install support/dismiss/
  later action, update states and dirty-form block, cache/offline first/relaunch,
  unsupported browser, base path/scope, licenses/build metadata.
- **Verification:** `deno task test --filter 'preference|install|update|offline'`;
  `deno task test:component --filter settings-final`;
  `deno task test:e2e --grep offline-update`; production-build agent-browser
  offline/update audit.

#### R-600 — Destructive/PWA independent review gate

- **Status/dependencies:** `PENDING`; depends on `P-503`, `R-500`.
- **Ownership:** read-only review first; scoped fixes by M6 owners.
- **Scope/non-goals:** review destructive truthfulness and ordering, data leakage,
  reload recovery, offline/update/install correctness, settings/disclosures,
  base-path/service-worker isolation, and accessibility of warnings.
- **Outputs/acceptance:** no high/medium finding; failure injection cannot lose or
  resurrect data contrary to spec; production PWA passes offline/update audit.
- **Tests:** all M6 tests plus restart/failure at each destructive phase and
  repository-neighbor service-worker isolation fixture.
- **Verification:** `deno task verify`; offline/update E2E; agent-browser M6 audit.

### M7 — Hardening and Release

#### Q-601 — Close screen/state/design-system completeness gaps

- **Status/dependencies:** `PENDING`; depends on `R-600`.
- **Ownership:** only gaps explicitly inventoried against specs; shared-component
  fixes precede affected feature fixes; no new product scope.
- **Scope/non-goals:** map every approved screen/checklist state to implementation,
  remove one-off duplication, validate responsive/long-content/large-money/
  empty/loading/offline/error/conflict/destructive states and immediate motion.
- **Outputs/acceptance:** traceability matrix has no missing requirement; gallery
  and screen mappings match; no deferred feature leaked into MVP.
- **Tests:** targeted regression at cheapest layer for every found gap; complete
  component/a11y suite; visual baselines reviewed rather than blindly updated.
- **Verification:** `deno task verify`; `deno task gallery:verify`;
  agent-browser full screen matrix.

#### Q-602 — Finalize the five-journey E2E suite

- **Status/dependencies:** `PENDING`; depends on `Q-601`.
- **Ownership:** `e2e/**` and E2E-only fake scenario setup; production behavior
  changes require a separate scoped fix with lower-layer regression test.
- **Scope/non-goals:** make the approved local manual, fake Gemini receipt,
  fake Drive reconnect, conflict resolution, and offline/update recovery journeys
  deterministic. E2E does not enumerate merge schedules or machine guards.
- **Outputs/acceptance:** isolated/repeatable/no live credentials; failures retain
  useful traces/screenshots without secrets; suite passes repeated and shuffled.
- **Tests:** exactly the five journeys, with viewport coverage allocated by risk
  rather than multiplying every journey across every browser/viewport.
- **Verification:** `deno task test:e2e`; repeat three times; run
  `deno task test:e2e --shuffle` if supported by the selected runner.

#### Q-603 — Cross-browser, accessibility, security, and visual hardening

- **Status/dependencies:** `PENDING`; depends on `Q-602`.
- **Ownership:** audit reports and scoped regression fixes; no feature expansion.
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

#### Q-604 — Produce and verify the GitHub Pages release

- **Status/dependencies:** `PENDING`; depends on `Q-603`.
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

#### R-700 — Final independent release review and definition-of-done gate

- **Status/dependencies:** `PENDING`; depends on `Q-604`.
- **Ownership:** full repository read-only review first; fixes individually
  scoped and returned through the responsible task area.
- **Scope/non-goals:** independently compare code, tests, deployment, and this
  ledger against every normative spec and Definition of Done. Do not approve
  based only on prior reviewers or green E2E.
- **Outputs/acceptance:** traceability and security/privacy review complete; no
  severity-1/2 finding; severity-3 findings fixed or explicitly accepted by the
  owner; final checkpoint and evidence match Git and deployed commit.
- **Tests:** complete clean-clone verification and targeted adversarial checks
  chosen independently by reviewer.
- **Verification:** every Definition-of-Done command; clean `git status`;
  deployed/source commit equality; final plan-update commit pushed.

## Parallel Lanes, Agents, and Worktrees

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
Checkpoint before dispatch. This avoids exposing the owner's account name in
new checkpoints, worker prompts, and status reports; existing historical
records need not be rewritten.

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

- **Mandatory pre-commit baseline:** every implementation commit must pass
  `deno task fmt:check`, `deno task lint`, `deno task check`, and the focused
  unit/actor/component/integration/E2E commands applicable to its changed files.
  It must also pass `deno task build` whenever production source, dependencies,
  build configuration, routing, PWA behavior, or generated assets changed. A
  required failing command blocks the commit; it is never deferred to a review
  gate or another agent.
- Before `F-004` establishes the canonical task aliases, the isolated foundation
  spikes run the equivalent direct Deno commands written in their task entries;
  this is not permission to skip formatting, linting, type/proof execution, or
  diff validation.
- **Additive layer matrix:** domain and actor changes run focused unit/actor
  tests; persistence and service adapters run focused integration tests;
  design-system/component/screen changes run component and accessibility tests;
  a change touching an approved browser journey runs that focused E2E; visual
  UI changes receive the task's agent-browser inspection before completion.
  Run broader suites whenever shared contracts, configuration, or risk make the
  focused command insufficient.
- Every worker handoff lists each exact command, exit result, and any intentionally
  unavailable manual/platform check. “Tests pass” without command evidence is
  not acceptable to the integration owner.
- Prefer one focused implementation commit per task; a task may use two or
  three commits only when a reviewable foundation, behavior, and fix naturally
  separate. Tests required by the task ship with the behavior, never in a later
  cleanup commit.
- Run the task's cheapest checks before committing. Run its full listed
  verification before marking complete. Do not create knowingly red commits as
  progress markers.
- After integration, make a small ledger/checkpoint commit if the task commit
  could not safely include it. Push `master` after each completed task or small
  inseparable integration group and after every review/fix gate.
- Commit messages lead with the outcome, and review fixes identify the gate,
  for example `Implement canonical expense schema` and
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
not integrated into `master`, and compare them with the task's allowed ownership.
Also check whether any previously launched process or agent is actually still
running; a stale `IN_PROGRESS` label is not proof of a live owner.

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

Recovery is complete when every discovered change is assigned exactly once,
no worker unknowingly duplicates another branch, the ledger matches Git and
test evidence, and the next action is dependency-safe. The normal implement,
review, validate, commit, push, and checkpoint loop then continues. Rate limits
and restarts are operational interruptions, not reasons to mark a task
`BLOCKED`, skip review, weaken tests, or request product decisions.

## Long-Running Worker and Review Progress Protocol

Long reviews and implementation tasks may legitimately take several bounded
command windows. Silence is not completion, and one missed update is not an
interruption. Progress is operational telemetry and a resumable handover: if a
final response is lost to context compaction, rate limiting, or session loss,
the latest progress record must let the next orchestrator resume without
guessing. Only the final handoff and the orchestrator's ledger update can
change a task's completion or gate status.

### Preferred progress channel

When the agent environment exposes a child-to-parent message or progress
operation, a worker or reviewer should send a concise update at least every
five minutes and after each major phase. Each update must include an ISO-8601
UTC timestamp, task/review ID, worker identity, phase, last completed command
and result, current command and start time, next action, finding counts by
severity so far, and any blocker or unavailable check. It must say
`PROGRESS — not a final handoff` so it cannot be mistaken for approval.

The current orchestration interface documents orchestrator-to-agent
`send_input` and agent waiting, but no dependable proactive child-to-parent
progress call. Agents must not assume that a queued input is a progress
channel. The fallback below is therefore mandatory for a long-running task
when no such child-to-parent operation is available.

### Markdown fallback

Before dispatching a review expected to exceed one command window, or when a
writer reports that it may be long-running, the orchestrator creates and
records a dedicated review/worker worktree using the normal `~` path privacy
rule. The worker may write only the untracked progress file
`<TASK-ID>-progress.md` in that worktree; source, tests, configuration, the
implementation plan, and commits remain outside its write scope unless the
task explicitly authorizes them. The file is operational evidence and a
resumable handover, not a second plan, and must never be committed or pushed.
The implementation plan remains the authority for sequencing and status; the
progress file preserves the worker's latest execution state and review
reasoning between plan checkpoints.

Update the file at least every five minutes between commands, immediately
before and after a long command, and before yielding or stopping. Use this
shape so the orchestrator can inspect it without guessing:

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
- last_safe_checkpoint: `no source changes; progress file is the only worktree mutation`
- recovery_command: `read this file, run git status, then resume current/next`
- handoff: `resumable progress; not a final approval`
- repository_mutation: `none`
```

Do not put credentials, tokens, receipt images, personal data, full home
directory names, or unredacted hostile model output in progress messages or
files. Use `~` in paths. On interruption, preserve the worktree and progress
file, inspect its timestamp and Git state, and record the recovery action in
the Current Checkpoint. A progress file is stale after fifteen minutes without
an update, or after three expected update intervals; the orchestrator must
first send a bounded status request when possible, then perform the full
Interruption and Recovery Protocol before closing or reassigning the worker.

Reviewers are explicitly encouraged to append a progress entry continuously,
not only when asked: record each completed validation phase, provisional or
confirmed finding, evidence location, recommendation, and the next safe
action. The latest entry must be a usable handover if the reviewer loses its
final response or the orchestrator's context is compacted. Before the final
response, append one handoff entry containing the complete command/result
matrix, every unresolved finding with severity and file/line evidence,
unavailable checks, worktree/Git state, and explicit APPROVE or BLOCK. This
entry is still not approval by itself; the orchestrator verifies it against the
repository and updates the plan.

### Stall escalation and advisor backoff

If a worker or reviewer has stale progress for three expected intervals, the
same command/failure has resisted two bounded attempts, or the local scope
reveals a cross-cutting contradiction, the orchestrator must stop repeating
the same prompt. First preserve the progress handover, inspect the worktree
and Git state, and send one bounded status request. If the issue remains
unclear, dispatch one fresh read-only advisor agent for that specific task or
finding. Give the advisor the task ID, progress handover, exact evidence,
authoritative specs, locked contracts, and explicit non-goals.

The advisor's job is to step back and recommend the smallest reasonable
unblocking path. It may challenge internal architecture, type structure,
testing strategy, or infrastructure choices when approved user behavior and
specification remain unchanged. It may identify a missing contract, a better
ownership split, or a safe recovery sequence. It must not edit source, alter
the product requirements, weaken a test, enable deployment, or invent scope;
it returns evidence, options, tradeoffs, and a recommendation. The advisor
also follows the progress/handover protocol if its assessment is long-running.

After the advisor returns, the orchestrator chooses one of three bounded paths:

1. If the issue is an implementation detail within the approved specs, record
   the recommendation and dispatch or resume the owning worker with the
   narrowest fix and regression test.
2. If the issue requires an internal contract/ownership adjustment but does
   not change user behavior, update this plan with the impact list and obtain
   integration-owner review before changing the locked contract.
3. If the issue is a contradiction, ambiguity, or proposed change to an
   approved user requirement, preserve all work, mark the exact task
   `BLOCKED`, and yield one concise decision request to the human owner.

Do not spawn multiple advisors for the same stall, keep retrying a dead end
after the advisor has recommended a path, or treat advisor uncertainty as
permission to broaden scope. Advisor backoff is a recovery aid, not a reason
to bypass dependency order, safety checks, the review gate, or the human
decision boundary.

### Final handoff boundary

The worker's final response must repeat the exact validation commands/results,
all findings with severity and file/line evidence, unavailable checks, and an
explicit `APPROVE` or `BLOCK` for reviews. The latest progress file must carry
the same handover essentials before that response is sent. After context
compaction or a resumed session, the orchestrator reads both the plan and the
latest progress handover before waiting, closing, integrating, or dispatching.
The orchestrator removes the
untracked progress artifact only after preserving any needed evidence in this
ledger and confirming the worktree is clean or safely preserved. Never mark a
task complete from a progress update, a quiet process, or a stale file.

## Review and Fix Loop

For every implementation task:

1. The implementer reads the authoritative specs, this task, locked contracts,
   and applicable skills; states assumptions and owned files before editing.
2. The implementer writes the lowest-layer tests with or alongside behavior,
   runs the complete mandatory pre-commit baseline and additive layer matrix,
   records exact commands/results, inspects the diff for unrelated or secret
   changes, and only then commits a green bounded result.
3. The integration owner reviews scope and evidence before integration and runs
   affected verification. A failed contract or collision returns to the worker;
   it is not patched blindly during merge.
4. At each `R-*` gate, a fresh Luna `xhigh` reviewer independently inspects the
   milestone against specs, locked contracts, tests, and actual behavior. The
   reviewer is read-only first and reports severity, evidence, affected files,
   and a minimal corrective recommendation.
5. Substantiated findings become bounded fix tasks owned by the appropriate
   implementer or a fresh worker. Every fix adds/regresses the cheapest useful
   test and reruns the affected visual/a11y inspection where applicable.
6. The integration owner reruns the entire gate, records evidence and commit,
   pushes, and only then releases downstream dependencies.

Review severity: severity 1 risks data loss/security/privacy or makes a core
flow unusable; severity 2 violates an approved requirement or architecture/test
contract; severity 3 is a contained quality/accessibility/maintainability issue;
severity 4 is optional polish. Severity 1–2 block the gate. Severity 3 must be
fixed unless the owner explicitly accepts it. Severity 4 cannot expand MVP.

## Current Checkpoint

- **Plan state:** implementation authorized; M0/M1, the M2 contract/design-
  system wave, `R-200`, M3/R-300, A-302, A-303, R-400, S-401, and S-402 are
  complete. M4 is released; S-403, S-404, and S-405 are complete. R-500 is
  `COMPLETE` after the bounded fix wave and fresh independent closure review;
  M5 is released and M6 is the next dependency-ready milestone.
- **Reconciled branch/upstream:** `master` and `origin/master` are aligned;
  the final pushed R-500 ledger sequence includes `e375cf8` (`Close R-500 and
  reconcile plan ledger`) and `150ba7c` (`Record final pushed R-500
  checkpoint`), with source checkpoint `e6ee2cd` (`Fix higher-generation
  causal packet adoption`) and S-405 source at `b423d9b` integrated beneath
  it. The latest
  completed-task ledger checkpoint before S-403 was `94f5f5c` after pushing the
  S-402 completion ledger. The root worktree
  contains only the intentionally untracked `A-303-progress.md`,
  `R-300-progress.md`, `R-400-contrast-fix-progress.md`, and preserved
  `recovered-s404-root-artifacts-2026-08-24/` recovery directory.
- **Last approved pre-plan commit:** `179d180` (`Define browser and verification
  boundaries`).
- **Draft plan commit:** `e9e0822` (`Add executable implementation orchestration
  plan`).
- **Integrated implementation state:** production source fixes through
  `2bf6471` (`Fix D-102 deletion safety and retry contracts`) and L-203 query
  implementation `97e7689` (`Implement L-203 expense queries and totals`),
  local repository implementation `e5cd6db` (`Implement L-201 local
  repository`), A-301 adapter implementation `3d0b54a` (`Implement image
  preparation and Gemini adapter`), contract follow-up `dc306bb` (`Preserve
  receipt metadata in Gemini drafts`), the pushed A-301 ledger checkpoints,
  `afb7cc4`, L-204 `08c3f88`, and L-205 `054a82f` are present on `master`;
  the R-300 fix wave is integrated through L-204 fix `721a33e`, U-104 fix
  `d9a21b0`, L-205 fix `bdd8b41`, integration correction `b504f5f`, and
  custom-period/saved-Undo follow-up `3424ed6` (`Fix remaining R-300 period
  and undo paths`);
  the Curie-finding accessibility/typed-dispatch fix is integrated as
  `acd3bff` (`Fix R-300 actor dispatch and landmarks`), and A-302 receipt
  actor/domain implementation `a1f84d6` (`Implement A-302 receipt review
  workflow`);
  the deferred-only SPEC note is `c390656`; A-303 UI integration is `a90504d`
  (`Implement A-303 receipt and Gemini UI`) and its isolated A-301 canvas
  compatibility follow-up is `a8b87ca` (`Narrow Gemini canvas context for
  browser build`). The latest integrated implementation is `0f20581`
  (`Implement S-404 import export workflows`), after `1c50cb3`
  (`Implement S-403 conflict workflow`) and `1d3afce`
  (`Implement S-401 Drive adapter`); S-402 integration is `95ac376`
  (`Implement S-402 synchronization actor and transport`); S-405 worker and
  integration commits are recorded in the S-405 ledger entry above; the latest
  pushed orchestration checkpoint before this ledger update is `73d2a53`.
- **Completed implementation tasks:** `F-001` through `F-005`, `R-100`,
  `D-101`, `D-102`, `D-103`, `U-104`, `L-201`, `L-202`, `L-203`, `L-204`, `L-205`, `A-301`, `R-200`, `A-302`, and `A-303`. Their required source, tests, and
  integration evidence are present on `master`; R-400, S-401, S-402, S-403,
  S-404, and S-405 are complete as recorded below.
- **Owner authorization:** received in this session; it authorizes the approved
  implementation scope and does not expand the MVP or deferred exclusions.
- **Completed documentation tasks:** `P-000`. Draft `e9e0822` was independently
  reviewed; all one severity-1, ten severity-2, and three severity-3 findings
  were fixed in `5165d60`. A read-only Luna `xhigh` closure review at `5165d60`
  confirmed all 14 closed, found no new severity-1/2/3 regression, and approved
  `P-000` completion.
- **P-000 verification evidence:** `git diff --check` passed; 37 task/review IDs
  are unique; every task block contains status/dependencies, ownership,
  scope/non-goals, outputs/acceptance, tests, and verification; Markdown fences
  are balanced; dependency graph/ledger and E2E/agent-browser ownership were
  independently checked; `git status --short --branch` was clean at `5165d60`.
- **Current reconciliation evidence:** L-205, L-204, L-202, L-203, and L-201 integration validation
  is recorded below. R-300 and A-302 are complete. The latest root `deno task
  verify` passed after S-405 integration: 137 repository tests, 20
  integration, 56 component, 29 domain, 1 actor, local E2E 2/2,
  gallery/browser/axe, Pages/CI/toolchain validators, both production builds,
  frozen audit, and `git diff --check`. A-303 and compact-layout focused validation also passed
  `deno task fmt:check` (142 files), `deno task lint` (130 files),
  `deno task check`, `deno task test:component --filter receipt-ui` (4),
  `deno task test:e2e --grep receipt-review` (1), and build. Native receipt
  inspection passed at 320x568, 390x844, and 1280x800; the compact fix recorded
  zero axe violations/incomplete results and placed the model trigger above
  the sticky action at 390px. The implementation plan task-heading count
  remains 37 with no duplicate IDs; `master` and `origin/master` are aligned
  through S-405 integration commit `d877c52`; the root worktree contains
  only the intentionally untracked A-303, R-300, and R-400 contrast-fix
  handovers plus the preserved S-404 root-artifact quarantine. Preserved
  worktrees are listed below.
- **R-400 completion evidence:** closure-6 independently approved the final
  native 1280x800 matrix after closure-5’s partial 320/390 review; the exact
  handover, counts, geometry, focus, cleanup, and unavailable-service boundary
  are recorded in the R-400 ledger below. No R-400 finding remains open.
- **Active wave:** `F-001` through `F-005`, `R-100`, `D-101`, `D-102`,
  `D-103`, `U-104`, `R-200`, `L-201`, `L-202`, `L-203`, `L-204`, `L-205`, and
  `A-301` are `COMPLETE`; the first bounded L-204/L-205/U-104 R-300 fix wave
  and aggregate verification correction are `COMPLETE`; the follow-up
  custom-period/saved-Undo fix wave is `COMPLETE`; R-300, A-302, and A-303 are
  `COMPLETE`; R-400, S-401, S-402, S-403, S-404, and S-405 are `COMPLETE`;
  R-500 is `COMPLETE` after fresh independent closure review; M5 is released
  and X-501 is the active M6 implementation task.
- **R-300 review recovery:** Curie (`01a03285-474b-7c61-ace3-485265e56041`)
  completed and was shut down after a read-only BLOCK in
  `~/git/worktrees/did-it-become-what-you-like-r-300-closure-4`, branch
  `review/r-300-closure-4`, based at `9cc9f26`. Its untracked
  `R-300-progress.md` handover is preserved. The root handover remains
  preserved. Feynman's fresh approval is recorded below; downstream M4 is now
  released in dependency order.
- **Preserved integrated worktrees (no active workers):**
  - `F-001`: branch `task/f-001-toolchain`, worktree
    `~/git/worktrees/did-it-become-what-you-like-f-001-toolchain`,
    base `43998c4`; ownership `spikes/toolchain/**`, `deno.json`,
    `deno.lock`, and toolchain-only decision/proof files; agent `Cicero`
    (`01a03092-5f84-7a83-992a-ff40b904dfc1`); worker commit `96240de` is
    integrated by `db1d9b4`; worktree is clean and preserved pending later
    cleanup.
  - `F-002`: branch `task/f-002-automerge`, worktree
    `~/git/worktrees/did-it-become-what-you-like-f-002-automerge`,
    base `43998c4`; ownership `spikes/automerge/**` and its decision record;
    agent `Kuhn` (`01a03092-6002-7bd1-85dc-f33d89f800ac`); local commit
    `bec8d08` (`Prove Automerge IndexedDB semantics`) is integrated by
    `59efed5`; the worktree remains preserved and clean pending final wave
    cleanup.
  - `F-003`: branch `task/f-003-browser-integrations`, worktree
    `~/git/worktrees/did-it-become-what-you-like-f-003-browser-integrations`,
    base `43998c4`; ownership `spikes/browser-integrations/**` and its decision
    record; agent `Popper` (`01a03092-6086-7b42-ade7-dc16d28f1aef`); worker
    commits `c6b2f8f` and `200a9a5` are integrated by `dd20e31` and `0ccfea6`;
    worktree is clean and preserved pending later cleanup.
  - `F-004`: branch `task/f-004-foundation`, worktree
    `~/git/worktrees/did-it-become-what-you-like-f-004-foundation`,
    base `2bdb59c`; ownership root tool configs, `.github/workflows/**`,
    `scripts/**`, minimal `src/app/**`, and static PWA placeholders; agent
    `Halley` (`01a030a7-b8c0-70f0-91e0-c8d4998a1fac`); worker commits
    `d398608` and `fe38734` are integrated as `612f5c5` and `3f40033`; worktree
    is clean and preserved pending later cleanup.
  - `F-005`: branch `task/f-005-tooling`, worktree
    `~/git/worktrees/did-it-become-what-you-like-f-005-tooling`, base `f7cd08d`;
    ownership `src/test-support/**`, test configuration, `e2e/support/**`, and
    visual scripts; agent `Faraday` (`01a030b5-c8b8-7733-919e-acc0eadfda07`);
    worker commit `0c6787f` is integrated by `f22c7c3`; the worktree is clean
    and preserved pending later final-wave cleanup; the worker is shut down.
- **Interrupted tasks:** D-101 worker Pauli was interrupted after repeated
  bounded windows with no filesystem changes; the orchestrator recovered in the
  preserved worktree and integrated D-101. F-001 through F-005, R-100, and
  D-101 are complete; no unintegrated worker changes remain.
- **F-003 handoff evidence:** `deno run -A
  spikes/browser-integrations/verify.ts` passed 11/11 proofs; `deno fmt
  --check spikes/browser-integrations`, `deno lint
  spikes/browser-integrations`, `deno check
  spikes/browser-integrations/verify.ts`, `git diff --check`, and `git diff
  --cached --check` all exited 0. Live OAuth/Drive/Gemini, Chromium/Playwright/
  agent-browser, mobile/cross-browser, production-build, real CSP delivery,
  and real service-worker registration checks are explicitly unavailable and
  recorded in the decision document.
- **F-001 handoff evidence:** local commit `96240de` passed `deno task
  fmt:check`, `deno task lint`, `deno task check`, `deno task test` (3 passed),
  `deno task build`, `deno task browser:install`, `deno task test:e2e` (1
  passed), `deno task verify:toolchain`, `git diff --cached --check`, and a
  clean `git status --short --branch`. Direct `deno check` was tested but is not
  canonical because a transitive `@types/node` declaration fails; the required
  TypeScript 7 checker passes. Generated `node_modules` and Playwright browser
  binaries are ignored/external and were not committed.
- **F-001 integration evidence:** merge commit `db1d9b4` is pushed; from
  `master`, `deno task verify:toolchain`
  passed TypeScript 7 version and strict-failure proofs, formatting, lint,
  strict check, 3 unit/component tests, Vite/PWA build, Playwright Chromium
  installation, and the Playwright smoke page.
- **F-002 handoff evidence:** local commit `bec8d08` passed `deno run -A
  spikes/automerge/verify.ts`; the seeded `--seed=20260823 --rounds=64` run
  passed twice; `deno fmt --check spikes/automerge`, `deno lint
  spikes/automerge`, `deno check --config spikes/automerge/deno.json
  spikes/automerge/verify.ts spikes/automerge/browser-fixture.ts`, browser
  bundling with `--platform browser --no-check`, `git diff --check`, and
  `git diff --cached --check` all passed. Native browser runtime and browser
  bundle `--check=all` are unavailable due to documented DOM/Node declaration
  conflicts.
- **F-002 integration evidence:** merge commit `59efed5` passed from `master`
  the direct runner, both seeded `--seed=20260823 --rounds=64` repetitions,
  format, lint, strict Deno check, browser bundling with `--platform browser
  --no-check`, and `git diff --check`. The runner reported all 12 checks
  passing on each run.
- **F-003 integration evidence:** merge commits `dd20e31` and `0ccfea6` passed
  from `master` the 11/11 browser-integration proofs, `deno fmt --check
  spikes/browser-integrations`, `deno lint spikes/browser-integrations`, `deno
  check spikes/browser-integrations/verify.ts`, and `git diff --check`. The
  initial integrated type-check failure was fixed by the scoped `deno.ns`
  reference in `200a9a5`; the documented live-service, native-browser, and
  production-delivery checks remain intentionally unavailable.
- **F-004 handoff evidence:** worker commit `d398608` and fix `fe38734` passed
  `deno task fmt:check`, `deno task lint`, `deno task check`, `deno task test`
  (6 passed), `deno task build`, `deno task verify:pages`, `deno task
  verify:ci`, `deno task verify:toolchain`, `git diff --check`, and
  `git diff --cached --check`.
- **F-004 integration evidence:** cherry-picks `612f5c5` and `3f40033` passed
  from `master` the same full canonical gate; the Pages artifact and CI policy
  validators passed, and the generated production service worker/manifest use
  the repository base path. Hosted Actions, Pages, and live service-worker
  inspection remain unavailable until the later release checks.
- **F-005 handoff/integration evidence:** worker commit `0c6787f` was reviewed
  and integrated as `f22c7c3`. From `master`, `deno task fmt:check`, `deno task
  lint`, `deno task check`, `deno task test` (15 passed), `deno task
  test:integration` (2 passed), `deno task test:component` (1 passed), `deno
  task test:e2e` (2 passed), `deno task browser:install`, `deno task
  browser:verify` (visual, accessibility-tree, and axe smoke passed), and `git
  diff --check` all exited 0. The checksum-failure and intentional-nonzero
  E2E tests passed; browser binaries, profiles, screenshots, traces, and
  Playwright artifacts remain ignored. No live credentials or product behavior
  were added.
- **R-100 review findings (Bohr, read-only):** approval is blocked pending
  scoped fixes. Severity 2: the F-002 Automerge spike lockfile is stale and
  lacks frozen-lock enforcement; CI and Pages use mutable `v2.x` Deno instead
  of the verified pinned version; and `index.html` CSP has drifted from the
  reviewed F-003 GIS/API/frame/blob allowlist. Severity 3: Linux ARM64 pairs
  native agent-browser with x64 Chrome without emulation, and GitHub Actions
  dependencies use mutable major tags instead of reviewed commit SHAs. Bohr's
  full command matrix passed, including 15 tests, 2 integration tests, 1
  component test, 2 E2E tests, build, Pages/CI/toolchain validators, browser
  install/visual smoke, and a deliberate nonzero redacted failure path.
- **R-100 post-fix evidence:** from `master`, the full canonical matrix passed:
  `deno task fmt:check`, `deno task lint`, `deno task check`, `deno task test`
  (15 passed), `deno task test:integration` (2 passed), `deno task
  test:component` (1 passed), `deno task test:e2e` (2 passed), `deno task build`,
  `deno task verify:pages`, `deno task verify:ci`, `deno task
  verify:toolchain`, `deno task browser:install`, `deno task browser:verify`,
  `deno audit --frozen`, and `git diff --check`. Both frozen seeded F-002
  repetitions (`--seed=20260823 --rounds=64`) passed 12/12; F-003 passed
  11/11; and the intentional failure exited 1 with `[REDACTED]` credentials.
- **R-100 fix ownership:** the lockfile/frozen spike fix belongs to F-002;
  Deno pin, CSP/validator, and action-SHA fixes belong to F-004; native browser
  platform metadata/decision belongs to F-005. These are review fixes only and
  must not expand product scope.
- **R-100 scoped-fix dispatch:** F-002 worker Copernicus
  (`01a030de-45ca-7133-9c9a-24d47c75a50b`) owns
  `~/git/worktrees/did-it-become-what-you-like-f-002-automerge`; F-004 worker
  Jason (`01a030de-46a1-7772-a32b-bf4ba38f4ad1`) owns
  `~/git/worktrees/did-it-become-what-you-like-f-004-foundation`; and F-005
  worker Arendt (`01a030de-4760-7bb1-bf50-c29b4efbb87c`) owns
  `~/git/worktrees/did-it-become-what-you-like-f-005-tooling`. Ownership is
  disjoint; workers must commit scoped fixes and must not edit this ledger or
  push `master`.
- **R-100 scoped-fix integration:** Copernicus committed `4165ac1` (frozen
  Automerge main/browser lockfiles), Jason committed `7de833f` (pinned Deno and
  immutable Actions, CSP alignment and validator assertions), and Arendt
  committed `59683e2` (Linux ARM64 explicit unavailability); all three commits
  were reviewed and cherry-picked as `3157d31`, `aca5ac5`, and `cd3ec8f`.
  All scoped-fix workers completed and were shut down; their worktrees remain
  clean and preserved.
- **R-100 closure evidence:** fresh independent reviewer Russell
  (`01a030e8-5ae2-7633-a97a-75eb8fd4dddc`) audited the post-fix master
  read-only and reran the complete foundation matrix. Russell approved closure:
  no unresolved severity-1/2/3/4 findings; `master` was clean and synced with
  `origin/master`; all preserved worktrees were clean; no Pages workflow was
  triggered.
- **Dispatch evidence:** the three compatibility agents and `F-004` worker
  received bounded prompts with their owned files, non-goals, acceptance
  criteria, and exact validation/handoff requirements; no worker is permitted
  to edit this ledger or push `master`.
- **Known technical follow-ups, not owner ambiguities:** Automerge's alpha
  adapter and browser type-check limitation remain recorded for later M2/release
  review; R-100 closure confirmed the foundation fixes and compatibility
  decisions are sufficient to proceed.
- **Current task:** record the approved R-200 closure, then dispatch the next
  dependency-ready M3 workstreams `L-201`, `L-203`, and `A-301` with disjoint
  ownership. Keep the deferred AI scan feedback-memory feature out of MVP
  implementation.
- **Interrupted review recovery:** Boole
  (`01a03123-61ee-79b2-b2c1-4e6ad08b0ab5`) was given repeated bounded waits and
  completion/interruption requests, then shut down while still running. It
  returned no findings or validation handoff and made no repository changes.
  Recovery audit completed: `git fetch --prune origin`; `master` at `dcd046d`
  synced with `origin/master` (`0 0`); root clean; every preserved worktree
  clean; and no unintegrated or uncommitted worker changes were found. The
  first recovery action is to dispatch one fresh read-only R-200 reviewer from
  the clean root.
- **R-200 review handoff:** Banach's 19-command matrix passed from clean pushed
  `b398037`: `timeout 120s deno task fmt:check` (106 files), `lint` (95),
  `check`, `test` (45), `test:integration` (2), actor-contract tests (9),
  adapter-contract tests (9), component tests (8), design-system component
  tests (7), E2E tests (2), build, gallery, 3-viewport gallery a11y, schema
  docs, Pages, CI, toolchain, frozen audit, and `git diff --check` all exited
  0. The deliberate invalid fake-Gemini path rejected
  `fake-gemini-needs-test` with `unsupported` as intended. Hosted Pages/Actions,
  live services, non-Chromium platforms, and forced-colors inspection were
  unavailable or intentionally not triggered; Pages remained committed and
  disabled.
- **R-200 original severity-2 findings, all resolved in the scoped fix wave:**
  1. D-101 accepts invalid `expense.receiptLineId` references and does not
     enforce line/receipt/project consistency (`src/domain/schema/records.ts`
     lines 78-106; `src/domain/schema/dataset.ts` 116-138). Fix owner D-101;
     add unknown-line, mismatched-receipt, and cross-project regression tests.
  2. D-102 collapses typed offline/authorization/quota/retired/retryable actor
     failures into generic messages (`src/actors/contracts/sync.ts` 121-128;
     `receipt.ts` 111-117; codes in `ports.ts` 10-23). Fix owner D-102 with
     D-103 coordination; preserve code, retryability, and required UI action in
     actor snapshots and tests.
  3. D-102 defines `canPreSync` but does not use it, permits `import.commit`
     with `mode: null`, and can enter replacement pre-sync offline
     (`src/actors/contracts/import.ts` 55-59, 125-153). Fix owner D-102;
     reject missing mode, block offline replace, and test online pre-sync.
  4. D-102 never increments `forcedDeviceCount` during Delete Everywhere
     finalization (`src/actors/contracts/deletion.ts` 372-400, 409-416). Fix
     owner D-102; add forced-finalization progress regression coverage.
  5. D-102 retains completed expense/receipt drafts in persisted actor context
     after Save or Discard (`src/actors/contracts/expense-form.ts` 113-119;
     `receipt.ts` 321-326; `durable-workflow.ts` 255-260). Fix owner D-102,
     with L-201 persistence integration; add clear/delete snapshot assertions.
  6. D-103's adapter error taxonomy has no `retired` code although actor ports
     require it (`src/actors/contracts/ports.ts` 10-17;
     `src/adapters/ports/errors.ts` 3-20). Fix owner D-103; add exhaustive
     non-retryable retirement mapping tests.
  7. D-103 permits direct `AdapterError` construction with arbitrary foreign
     messages/details, bypassing the safer mapper (`src/adapters/ports/errors.ts`
     41-45, 69-84, 102-108). Fix owner D-103; test credential-bearing input,
     serialization, and logs for redaction/allowlisting.
  8. U-104's gallery omits required primitive/pattern states including
     `ColorChoiceField`, `FileField`, `Chip`, `DefinitionList`, dialogs,
     `Popover`, `Menu`, `Tooltip`, `ErrorSummary`, `FilterBar`, and picker/
     filter patterns (`DESIGN_SYSTEM.md` 280-300;
     `src/design-system/gallery.tsx` 3-55). Fix owner U-104; add gallery and
     component/a11y coverage for every omitted item.
- **R-200 original severity-3 findings, also resolved:** D-101 used
  locale-dependent `localeCompare`
  for canonical export ordering (`src/domain/schema/dataset.ts` 216-227),
  risking nondeterministic JSON; replace it with a locale-independent code-unit
  comparator and regression tests. U-104 keeps `AdaptiveDialog` bottom-aligned
  at desktop (`src/design-system/components.tsx` 1098-1132;
  `src/design-system/tokens.css` 674-699); add compact bottom-sheet and wide
  modal positioning coverage at all three viewports. Both are scoped fixes and
  were resolved by `b3a8ffb` and `de924a5`; the fresh closure review must confirm
  no regression.
- **R-200 closure handoff:** Hypatia
  (`01a0314e-8936-7d53-a90f-ddf11e95f757`) reviewed read-only at
  `~/git/worktrees/did-it-become-what-you-like-r-200-closure` and recorded the
  resumable handover in `R-200-progress.md`. All 19 bounded matrix commands
  passed: format, lint, check, 62 unit tests, 2 integration tests, actor (17),
  adapter (11), component (12), design-system (11), E2E (2), build, gallery,
  3-viewport gallery a11y, schema/Pages/CI/toolchain verification, frozen audit,
  and diff check. The invalid fake-Gemini path exited 1 as intended; Pages was
  not triggered. Hypatia returned `BLOCK` with S1=0, S2=3, S3=0, S4=0.
- **New R-200 severity-2 findings blocking closure:**
  1. U-104 still renders nested labels in `src/design-system/components.tsx`
     lines 439-454; the outer Field label contains another label at 443-446,
     affecting native date/time/file fields routed through 652-727. Replace it
     with one explicit label/control association and add a no-nested-label
     component regression while preserving `getByLabelText` behavior.
  2. D-102/D-103 shaped-error handling still copies arbitrary `error.message`
     in `src/actors/contracts/types.ts` lines 87-110, especially 99-104, for
     any recognized code/retry shape. Canonicalize all untrusted rejection
     messages before durable actor context; add credential-bearing shaped-error
     redaction tests. D-102 owns the fix with D-103 coordination.
  3. D-102's sync machine unconditionally exposes the `retryable` tag and
     accepts `sync.retry` in `src/actors/contracts/sync.ts` lines 160-164. An
     unauthorized failure reported `retryable:false` while still exposing
     retryability. Derive tags/transitions from typed failure and add an
     unauthorized `can({ type: "sync.retry" }) === false` regression. D-102
     owns this fix.
- **R-200 closure worktree recovery:** Hypatia completed and was shut down;
  its worktree remains preserved at the `~` path above with only the untracked
  progress handover. No source, plan, commit, push, or Pages action changed.
- **D-101 recovery worktree:** branch `task/d-101-domain`, worktree
  `~/git/worktrees/did-it-become-what-you-like-d-101-domain`, based at
  `bd6fd68`; worker Pauli (`01a030ed-e9e6-7670-a3ff-16b76f3e0917`) was
  interrupted without creating files. The orchestrator recovered in the clean
  preserved worktree; commit `9bd7be0` is integrated as `99f0984`.
- **D-101 integration evidence:** recovery commit `9bd7be0` was reviewed and
  cherry-picked as `99f0984`. From `master`, `deno task fmt:check`, `deno task
  lint`, `deno task check`, `deno task test --filter domain` (5 passed),
  `deno task test` (20 passed), `deno task build`, `deno task
  verify:schema-docs`, `deno task verify:pages`, `deno task verify:ci`, and
  `git diff --check` all exited 0. The domain source of truth includes Zod 4
  record schemas/invariants, strict big.js decimal arithmetic, explicit v0-to-v1
  migration and unsupported down policy, deterministic export/import, portable
  versus device-local settings, schema documentation, and secret-free fixtures.
- **D-102 integrated worktree:** branch `task/d-102-actors`, worktree
  `~/git/worktrees/did-it-become-what-you-like-d-102-actors`, based at
  `7307f58`; Harvey's commit `0245859` is integrated as `1efd97b`; the
  worktree is clean and preserved.
- **D-103 integrated worktree:** branch `task/d-103-adapters`, worktree
  `~/git/worktrees/did-it-become-what-you-like-d-103-adapters`, based at
  `7307f58`; Heisenberg's commit `5f46f04` is integrated as `6bd54c2`; the
  worktree is clean and preserved.
- **U-104 integrated worktree:** branch `task/u-104-design-system`, worktree
  `~/git/worktrees/did-it-become-what-you-like-u-104-design-system`, based at
  `7307f58`; Erdos's commit `42d57fb` is integrated as `b06042b`; the worktree
  is clean and preserved. These three ownership sets were disjoint; all workers
  are shut down and no worker edited the plan or pushed `master`.
- **M2 integration evidence:** actor-contract tests (9), adapter-contract tests
  (9), design-system component tests (7), root `deno task test` (45 passed),
  integration tests (2), component tests (8), E2E tests (2), strict format/
  lint/check, build, schema/Pages/CI/toolchain validators, frozen audit, and
  `git diff --check` passed after integration. `deno task gallery` and
  `deno task a11y:gallery` passed; native agent-browser inspection covered
  `320x568`, `390x844`, and `1280x800` with screenshot/tree/axe checks.
- **Deployment state:** the GitHub Pages workflow is intentionally committed
  but manually disabled by the owner until the MVP is complete. Agents must not
  enable or trigger deployment as part of implementation; hosted deployment
  remains a later release-gate check.
- **Gate status:** R-200 is APPROVED and its contracts are locked. Closure-3's
  complete matrix passed from `c390656`; no owner decision is required. No
  GitHub Pages workflow may be enabled or triggered because the owner has
  intentionally disabled it until MVP completion.
  No GitHub Pages workflow may be enabled or triggered because the owner has
  intentionally disabled it until MVP completion.
- **R-200 scoped-fix dispatch plan:** the first wave
  owns disjoint preserved worktrees: D-101 owns
  `~/git/worktrees/did-it-become-what-you-like-d-101-domain` and only
  `src/domain/**`; D-102 owns
  `~/git/worktrees/did-it-become-what-you-like-d-102-actors` and only
  `src/actors/contracts/**`; U-104 owns
  `~/git/worktrees/did-it-become-what-you-like-u-104-design-system` and only
  `src/design-system/**`. Each worker adds regression tests, commits its scoped
  fix, and does not edit this plan or push `master`. D-103 is queued for the
  next available slot in `~/git/worktrees/did-it-become-what-you-like-d-103-adapters`
  with ownership limited to `src/adapters/ports/**` and its focused tests.
- **R-200 scoped-fix wave:** Nash
  (`01a03139-c1c3-7351-a670-dde731525fed`) completed D-101 in
  `~/git/worktrees/did-it-become-what-you-like-d-101-domain`; Newton
  (`01a03139-c2ab-7f41-ab1a-250b3af097b0`) completed D-102 in
  `~/git/worktrees/did-it-become-what-you-like-d-102-actors`; and Herschel
  (`01a03139-c38c-7843-92a9-7c68099ffc09`) completed U-104 in
  `~/git/worktrees/did-it-become-what-you-like-u-104-design-system`. Their
  source ownership is disjoint; each must commit only its scoped fixes and
  tests, keep its progress file untracked if needed, and leave this plan and
  `master` untouched.
- **D-101 scoped-fix integration:** Nash committed `068c537`, which the
  orchestrator reviewed and cherry-picked as `b3a8ffb`. Root
  `deno task fmt:check`, `deno task lint`, `deno task check`,
  `deno task test --filter domain` (8 passed), `deno task verify:schema-docs`,
  and `git diff --check` passed; the root commit is pushed. The preserved D-101
  worktree is clean except for its untracked `D-101-progress.md` artifact.
- **D-102 scoped-fix integration:** Newton committed `3d08354`; the
  orchestrator reviewed the scoped actor diff and integrated the source/tests
  as `c0bc76a`, intentionally omitting the operational progress markdown from
  the production tree. Root `deno task fmt:check`, `deno task lint`,
  `deno task check`, `deno task test --filter actor-contract` (17 passed),
  `deno task build`, and `git diff --check` passed; the root commit is pushed.
  The preserved D-102 branch is clean.
- **D-102 reopened-fix integration:** Boyle committed `0b95b06`; the
  orchestrator reviewed and cherry-picked it as `ba7b33e`, intentionally
  omitting the operational `D-102-closure-progress.md`. It canonicalizes
  recognized shaped-error messages, derives sync retry state/tags from typed
  retryability, and adds credential-retention and unauthorized retryability
  regressions. Root `deno task fmt:check`, `deno task lint`, `deno task check`,
  direct actor-contract tests (18 passed), `deno task build`, and
  `git diff --check` passed; the filtered actor alias exited 0 with 0 tests on
  this configuration. The preserved D-102 branch remains available with its
  untracked timestamped handover.
- **U-104 scoped-fix integration:** Herschel committed `18c4b38`, which the
  orchestrator reviewed and cherry-picked as `4d8b846`; the orchestrator then
  resolved the narrow duplicate `PageHeader`/gallery attributes caused by the
  preserved branch overlap in `de924a5`. Root `deno task fmt:check`, `deno task
  lint`, `deno task check`, `deno task test:component --filter design-system`
  (11 passed), `deno task test:component` (12 passed), `deno task build`,
  `deno task gallery`, `deno task a11y:gallery` (3 viewports), and `git diff
  --check` passed; the root commits are pushed. The preserved U-104 worktree is
  clean except for its untracked `U-104-progress.md` artifact.
- **U-104 reopened-fix integration:** Anscombe first committed `47aa191`,
  which added the regression but did not change the nested-label implementation;
  after the integration audit, the worker corrected it in `5525514`. The
  orchestrator reviewed that correction and reconciled the equivalent scoped
  source/test changes on root as `d1c87c9`, `2108438`, and `0b2fd4e`, omitting
  the operational progress files. `Field` now uses a non-label layout wrapper,
  an explicit label only when `controlId` exists, and a styled span for grouped
  non-control content. Root `deno task fmt:check`, `deno task lint`,
  `deno task check`, direct design-system tests (11 passed), component tests
  (12 passed), `deno task build`, `deno task gallery`, `deno task a11y:gallery`
  (3 viewports), and `git diff --check` passed; the root commits are pushed.
  The preserved U-104 worktree and its timestamped handovers remain available.
- **D-103 scoped-fix integration:** Dewey
  (`01a03144-7f47-7f92-8f85-3d2ea828c266`) committed `1cb7dd3`; the
  orchestrator reviewed and cherry-picked it as `4d524ba`. The root post-fix
  matrix passed: `deno task fmt:check`, `deno task lint`, `deno task check`,
  `deno task test` (62), `deno task test:integration` (2), actor-contract
  tests (17), adapter-contract tests (11 including fakes), component tests (12),
  design-system tests (11), E2E tests (2), build, gallery, 3-viewport
  `a11y:gallery`, schema/Pages/CI/toolchain verification, `deno audit --frozen`,
  and `git diff --check` all passed. The root commit is pushed; the preserved
  D-103 worktree is clean except for its untracked progress artifact.
- **R-200 closure readiness:** all eight original severity-2 and two
  severity-3 findings have scoped regression coverage and are integrated in
  `b3a8ffb`, `c0bc76a`, `de924a5`, and `4d524ba`; Hypatia found three new
  severity-2 regressions. Their scoped fixes are now integrated in `ba7b33e`,
  `d1c87c9`, `2108438`, and `0b2fd4e`. The complete post-fix matrix from
  `38fe984` passed: `deno task fmt:check` (106 files), `deno task lint` (95),
  `deno task check`, `deno task test` (63), `deno task test:integration` (2),
  direct actor-contract tests (18), adapter-contract tests (5), component
  tests (12), E2E tests (2), `deno task build`, `deno task gallery`,
  3-viewport `deno task a11y:gallery`, schema/Pages/CI/toolchain verification,
  `deno audit --frozen`, and `git diff --check`. Closure-2 then found three
  additional S2 findings, now fixed in `47b2f26` and `2bf6471`. The complete
  post-fix matrix from `2ff59f7` passed: `deno task fmt:check` (106 files),
  `deno task lint` (95), `deno task check`, `deno task test` (66),
  `deno task test:integration` (2), direct actor tests (20), adapter tests (5),
  component tests (12), E2E tests (2), build, gallery, 3-viewport gallery
  a11y, schema/Pages/CI/toolchain verification, frozen audit, and diff check.
  Closure-3 approved this result with no new findings; R-200 is complete and
  the next action is the dependency-ready M3 workstream dispatch.
- **R-200 closure review worktree:** prepared branch `review/r-200-closure`
  in `~/git/worktrees/did-it-become-what-you-like-r-200-closure`, based at
  `663a874`. The reviewer may inspect all source but may write only the
  untracked `R-200-progress.md` operational artifact there; no source, tests,
  plan, commits, push, or Pages action is allowed. Preserve this worktree and
  progress file if the reviewer is interrupted.
- **R-200 closure reviewer (completed BLOCK):** Hypatia
  (`01a0314e-8936-7d53-a90f-ddf11e95f757`) owns only the read-only inspection
  and untracked `R-200-progress.md` in
  `~/git/worktrees/did-it-become-what-you-like-r-200-closure`; its final
  handover is preserved and no source, plan, commit, push, or Pages action was
  permitted.
- **R-200 fresh closure review worktree:** prepared branch
  `review/r-200-closure-2` at
  `~/git/worktrees/did-it-become-what-you-like-r-200-closure-2`, based on
  `38fe984`. The reviewer may inspect the whole repository but may write only
  the untracked `R-200-closure-2-progress.md` handover. It must continuously
  record timestamped, resumable progress, recheck all prior and reopened
  findings, report the exact command matrix and unavailable checks, and end
  with explicit `APPROVE` or `BLOCK`. No source, plan, commit, push, or Pages
  action is allowed; preserve this worktree and progress file on interruption.
- **R-200 closure-2 handoff:** Mendel
  (`01a03171-c744-7c80-927a-ae03f28ebb45`) completed the independent review at
  `~/git/worktrees/did-it-become-what-you-like-r-200-closure-2`, preserving
  `R-200-closure-2-progress.md`. All 19 required matrix commands passed from
  `9020ae9` (63 full tests, 2 integration, 18 actor, 5 adapter, 12 component,
  2 E2E, builds, gallery/3-viewport a11y, validators, frozen audit, diff
  check), Pages stayed disabled/untriggered, and Git had only the untracked
  handover. Mendel returned `BLOCK`, S1=0/S2=3/S3=0/S4=0.
- **R-200 closure-2 findings:** (1) D-102 project deletion defines
  `needsSafetyExport` but allows `project-delete.type-name` and exact-name
  confirmation without a successful required export (`src/actors/contracts/
  deletion.ts:57-59,89-97,123-140`); (2) D-102 shaped recognized
  `unauthorized`/`retired` errors can let conflicting untrusted `retry:
  backoff` metadata expose retryability despite their typed non-retryable code
  (`src/actors/contracts/types.ts:99-105`, `sync.ts:161-179`); (3) D-101
  adjustment `lineId` validation accepts another adjustment because it checks
  the broad receipt-line map instead of purchase lines only
  (`src/domain/schema/dataset.ts:86-92,225-231`). These are internal fixes;
  no product/spec decision is required.
- **R-200 fresh closure-3 worktree:** prepared branch
  `review/r-200-closure-3` at
  `~/git/worktrees/did-it-become-what-you-like-r-200-closure-3`, based on
  `2ff59f7`. The reviewer may inspect the whole repository but may write only
  the untracked `R-200-closure-3-progress.md` handover. It must continuously
  record timestamped, resumable progress, recheck every prior finding and the
  second-wave fixes, report the exact command matrix and unavailable checks,
  and end with explicit `APPROVE` or `BLOCK`. No source, plan, commit, push, or
  Pages action is allowed; preserve this worktree and progress file on
  interruption.
- **R-200 closure-3 handoff and approval:** Linnaeus
  (`01a03187-24aa-7521-b137-52ad5912d31f`) completed the independent review at
  `~/git/worktrees/did-it-become-what-you-like-r-200-closure-3`, preserving
  `R-200-closure-3-progress.md`. The reviewer rechecked all prior six S2
  findings and the deferred SPEC addition, found S1=0/S2=0/S3=0/S4=0, and
  returned `APPROVE`. Its exact 19-command matrix passed from `c390656`: 66
  full tests, 2 integration, 20 actor, 5 adapter, 12 component, 2 E2E,
  production/toolchain builds, gallery and 3-viewport screenshot/tree/axe,
  schema/Pages/CI/toolchain verification, frozen audit, and diff check. Pages
  remained disabled/untriggered; the worktree has only its untracked handover.
- **R-200 fix-2 dispatch:** D-102 owns only
  `src/actors/contracts/deletion.ts`, `types.ts`, `sync.ts`, and focused actor
  tests in `~/git/worktrees/did-it-become-what-you-like-r-200-d102-fix-2`,
  branch `task/r-200-d102-fix-2`; D-101 owns only
  `src/domain/schema/dataset.ts` and focused domain tests in
  `~/git/worktrees/did-it-become-what-you-like-r-200-d101-fix-2`, branch
  `task/r-200-d101-fix-2`. Their progress files are untracked operational
  handovers, not plan substitutes; workers must not edit this plan or push
  `master`. The integration owner will merge D-101/D-102 in disjoint scope,
  rerun the complete gate, and preserve all worktrees.
- **R-200 fix-2 workers completed:** Wegener
  (`01a0317d-29e2-74b2-95f2-49aa45804c59`) owns D-102 in
  `~/git/worktrees/did-it-become-what-you-like-r-200-d102-fix-2`; Sartre
  (`01a0317d-2af7-7511-a5c1-9d9f029ae61a`) owns D-101 in
  `~/git/worktrees/did-it-become-what-you-like-r-200-d101-fix-2`. Their
  ownership is disjoint; both must keep only their untracked timestamped
  handover plus scoped source/tests, and neither may edit this plan or push
  `master`. The integration owner will inspect every diff and validation result.
- **R-200 fix-2 integration:** Sartre committed `c84bf53` for D-101; the
  orchestrator reviewed and cherry-picked it as `47b2f26`. Root format, lint,
  check, direct domain tests (9), `deno task test:domain` (9), schema-docs,
  build, and diff-check validations passed; only the two owned source/test
  paths were integrated. Wegener committed `5a03fa8` for D-102; the
  orchestrator reviewed and cherry-picked it as `2bf6471`. Root format, lint,
  check, direct actor tests (20), `deno task test --filter actor-contract`
  (20 passed, 46 filtered), build, and diff-check validations passed; only the
  three owned actor source/test paths were integrated. Both operational
  handovers remain untracked in preserved worktrees and neither worker pushed.
- **M3 first-wave dispatch:** Hegel
  (`01a03190-b744-72d1-b379-ade7587ac9f0`) owns `L-201` in
  `~/git/worktrees/did-it-become-what-you-like-l-201-local` with ownership
  limited to `src/adapters/local/**` and focused local integration tests;
  Meitner (`01a03190-b865-7041-9c74-bf2a8d0ad1ac`) owns `L-203` in
  `~/git/worktrees/did-it-become-what-you-like-l-203-queries` with ownership
  limited to `src/domain/queries/**`, formatting/selectors, and focused domain
  tests; Parfit (`01a03190-b987-7431-bf5f-bfb4b246d93b`) owns `A-301` in
  `~/git/worktrees/did-it-become-what-you-like-a-301-gemini` with ownership
  limited to `src/adapters/gemini/**`, image utilities, and focused adapter
  tests. These workstreams are disjoint and may run concurrently; every worker
  must keep its timestamped untracked handover, avoid deferred AI feedback
  memory, and leave this plan and `master` untouched.
- **L-203 completion/integration:** Meitner completed the scoped query work in
  `~/git/worktrees/did-it-become-what-you-like-l-203-queries` with untracked
  `L-203-progress.md` preserved as the operational handover. The worker commit
  `b95bf14` was inspected and cherry-picked as `97e7689`; the worker did not
  edit the plan or push. Root validation passed `deno task fmt:check`,
  `deno task lint`, `deno task check`, direct query tests (10),
  `deno task test:domain` (19), `deno task build`, and `git diff --check`.
  The worktree remains preserved and the worker is shut down. L-203 is now
  complete; the next dependency-ready implementation work is L-202.
- **L-201 completion/integration:** Hegel completed the local repository in
  `~/git/worktrees/did-it-become-what-you-like-l-201-local` with untracked
  `L-201-progress.md` preserved as the operational handover. The worker commit
  `e355e6a` was inspected and cherry-picked as `e5cd6db`; the worker did not
  edit the plan or push. Root validation passed `deno task fmt:check` (114
  files), `deno task lint` (103 files), `deno task check`, focused local tests
  (8 passed), `deno task test:integration --filter local-repository` (8 passed,
  5 filtered), `deno task test:integration` (13 passed), `deno task test` (84
  passed), `deno task build`, `deno audit --frozen`, and `git diff --check`.
  The worktree remains preserved and the worker is shut down. L-201 is now
  complete; L-202 is the next dependency-ready implementation task.
- **A-301 integration checkpoint:** Parfit completed the scoped adapter in
  `~/git/worktrees/did-it-become-what-you-like-a-301-gemini`; commit `202e83e`
  was inspected and cherry-picked as `3d0b54a`. The handover records a clean
  six-file source commit and passing worker checks: direct A-301 tests (10),
  full worker tests (66), integration (2), format, lint, strict check, build,
  and diff check. The integration review identified two S3 findings for this
  task: the locked
  `ReceiptExtractionDraft` port drops validated receipt date, line kind,
  selected, and top-level uncertainty fields needed by A-302; and the
  canonical test task did not include `src/adapters/gemini`. The integration
  owner approved a bounded internal-contract follow-up (no user/spec change)
  to preserve those validated fields, and has wired the adapter directory into
  the canonical test task. The exact `A-301` and `fake Gemini` filters are now
  the focused commands. The integration owner then completed the bounded
  internal-port follow-up in `dc306bb`: `ReceiptExtractionDraft` now preserves
  validated date, line kind, selected, and top-level uncertainty for A-302;
  focused adapter assertions and the existing fake draft were updated. Root
  validation passed `deno task fmt:check` (120 files), `deno task lint` (109
  files), `deno task check`, `deno task test --filter 'A-301'` (10 passed),
  `deno task test:integration --filter 'fake Gemini'` (1 passed),
  `deno task test:integration` (13 passed), `deno task test` (94 passed),
  `deno task build`, `deno audit --frozen`, and `git diff --check`. A-301 is
  complete; the worker and worktree are preserved.
- **L-202 dispatch:** Fermat (`01a031af-9aca-7793-9910-f4ba458ab264`) owns
  L-202 in `~/git/worktrees/did-it-become-what-you-like-l-202-project-category`
  on branch `task/l-202-project-category`. Ownership is limited to project and
  category domain services/actors/selectors and focused headless tests; no
  screens, Gemini/Drive, or populated-project destructive workflow. The worker
  must keep `L-202-progress.md` untracked, use timestamped progress and final
  handoff entries, leave this plan and `master` untouched, and not push. The
  integration owner will inspect the scoped commit and rerun the full affected
  matrix before releasing L-204/L-205 dependencies.
- **L-202 contract backoff:** Fermat reconciled the locked contracts and
  confirmed at `2026-08-24T03:00:40Z` that `ProjectCommand` has no reorder
  variant, while L-202 acceptance requires stable custom project ordering.
  The worker was paused with no source changes and only its untracked
  `L-202-progress.md` handover. A fresh read-only advisor, Hume
  (`01a031b6-823d-71e3-949f-9e03832a8e0e`), was dispatched with the exact
  evidence but did not return after bounded waits and was closed. The
  integration owner therefore approves the smallest internal-contract path:
  add `{ type: "reorder"; orderedIds: readonly StableId[] }` to `ProjectCommand`
  with focused compile/actor coverage, then resume Fermat. The owner applied
  that one-line internal contract extension as `fca4ab7`; root format, lint,
  strict check, and `actor-contract` tests (20 passed) all passed before push.
  No approved user requirement changes; no populated-project deletion, screen,
  or external integration scope is added.
- **L-202 completion/integration:** Fermat completed the scoped project/category
  implementation in `~/git/worktrees/did-it-become-what-you-like-l-202-project-category`
  with untracked `L-202-progress.md` preserved as the operational handover.
  The worker commit `b7dcecf` was inspected and cherry-picked as `afb7cc4`; the
  worker did not edit the plan or push. Root validation passed `deno task
  fmt:check` (125 files), `deno task lint` (114 files), `deno task check`,
  direct organization tests (8), direct actor tests (5),
  `deno task test:integration --filter organize` (3), `deno task test` (110),
  `deno task test:integration` (16), `deno task build`, `deno audit --frozen`,
  and `git diff --check`. The prior reorder-contract mismatch was resolved by
  `fca4ab7` and covered by the actor tests. L-202 is complete; its worktree
  remains preserved and the worker is shut down.
- **L-204 dispatch:** Huygens (`01a031d5-cb19-7fd2-840e-c866f25be457`) owns
  L-204 in `~/git/worktrees/did-it-become-what-you-like-l-204-manual-shell`
  on branch `task/l-204-manual-shell`. Ownership is limited to manual-expense
  and local-shell actors plus focused actor/integration tests; no screen/CSS
  composition, Gemini/Drive, external sync, or populated-project destructive
  workflow. The worker must keep `L-204-progress.md` untracked, use timestamped
  UTC progress/final-handoff entries, leave this plan and `master` untouched,
  and not push. The integration owner will review its scoped commit and rerun
  the affected matrix before releasing L-205.
- **L-204 completion/integration:** Huygens completed the bounded implementation
  in `~/git/worktrees/did-it-become-what-you-like-l-204-manual-shell` with
  untracked `L-204-progress.md` preserved as the timestamped handover. The
  worker commit `a019188` was inspected and cherry-picked as `08c3f88`; the
  worker did not edit the plan or push. Root validation passed
  `deno task fmt:check` (130 files), `deno task lint` (119 files),
  `deno task check`, `deno task test --filter manual-expense` (6),
  `deno task test --filter shell-actor` (3),
  `deno task test:integration --filter manual-save` (2), `deno task test`
  (121), `deno task build`, `deno audit --frozen`, and `git diff --check`.
  L-204 is complete; its worktree remains preserved and the worker is shut
  down. L-205 is now dependency-ready.
- **L-205 dispatch:** the next implementing worker owns the complete local UI
  slice in `~/git/worktrees/did-it-become-what-you-like-l-205-local-ui` on
  branch `task/l-205-local-ui`. Ownership covers shell and Screens 1–3, 6–9,
  non-destructive project/category editor composition, component/accessibility
  tests, the single approved local manual-save browser journey, and the
  required three-viewport agent-browser inspection. Before editing, the worker
  must read `UI_SPEC.md`, `DESIGN_SYSTEM.md`, the implemented shared
  components, the L-205 task, and applicable skills. It must not touch Gemini,
  Drive, external sync, populated-project destructive workflows,
  `IMPLEMENTATION_PLAN.md`, `master`, or push. Keep a timestamped UTC
  `L-205-progress.md` untracked for resumable progress and final handoff; the
  integration owner will inspect its scoped commit and rerun the complete UI
  matrix before releasing `R-300`.
- **L-205 completion/integration:** Singer completed the local UI slice in
  `~/git/worktrees/did-it-become-what-you-like-l-205-local-ui` with untracked
  `L-205-progress.md` preserved as the timestamped handover. The worker commit
  `5ccbdbe` was inspected and cherry-picked as `054a82f`; the worker did not
  edit the plan or push. Root validation passed `deno task fmt:check` (134
  files), `deno task lint` (122 files), `deno task check`, component tests (18),
  integration tests (18), domain tests (27), actor tests (1),
  `deno task test:e2e --grep local-first-manual` (1), `deno task a11y:gallery`
  (3 native viewports, axe 0), `deno task browser:verify`, `deno task test`
  (121), `deno task build`, `deno audit --frozen`, and `git diff --check`.
  Native agent-browser inspection passed at 320x568, 390x844, and 1280x800
  with no horizontal overflow or browser errors. L-205 is complete; its
  worktree remains preserved and the worker is shut down. R-300 is now
  dependency-ready.
- **R-300 review handoff:** Turing (`01a03234-7319-7601-8bd9-05cff5a641df`)
  performed the fresh read-only review from `~/git/did-it-become-what-you-like`
  at root `27020ea`, preserving the untracked `R-300-progress.md` handover.
  The gate is `BLOCKED`: 0 S1, 7 S2, 3 S3, and 0 S4 findings. The full evidence,
  exact validation results, affected paths, and bounded recommendations are in
  that handover. The reviewer made no tracked, plan, master, remote, commit,
  or push changes and was shut down after handoff.
- **R-300 bounded fix wave:** three disjoint owners are active before review
  rerun. The L-204 actor owner handles typed manual completion/Undo and safe
  hydration/open retry behavior in `src/actors/manual-expense.ts` plus actor
  tests. The L-205 UI owner handles Save-and-add-another, custom period
  selection, actionable loading/error states, Add Choice dialog semantics, and
  final local-screen evidence/E2E coverage. The U-104 design-system owner
  handles searchable currency choices, positive signed display, and shared
  SearchField/Merchant clearing. The integration owner adds the missing
  aggregate `deno task verify`, reconciles this checkpoint, and reruns R-300;
  no owner may weaken approved requirements or broaden into Gemini/Drive,
  external sync, or populated-project destructive workflows.
- **R-300 bounded fix wave completion/integration:** the three owners completed
  their review fixes with preserved timestamped handovers and no plan/master
  edits. Huygens committed `47a87d0` in
  `~/git/worktrees/did-it-become-what-you-like-l-204-manual-shell`; it was
  cherry-picked as `721a33e` and added typed Save-and-add-another, saved-record
  Undo, and safe null-draft hydration/open retry behavior. Its focused actor
  and shell tests (8 manual, 3 shell), manual-save integration (2), full test
  suite (123), format, lint, check, build, audit, and diff checks passed.
  Anscombe committed `7974c31` in
  `~/git/worktrees/did-it-become-what-you-like-u-104-design-system`; it was
  cherry-picked as `d9a21b0` and added searchable currency choices, explicit
  positive signs, and functional SearchField/Merchant clearing. Its 13 focused
  component regressions plus format, lint, check, build, and diff checks
  passed. Singer committed `30a5dc1` in
  `~/git/worktrees/did-it-become-what-you-like-l-205-local-ui`; it was
  cherry-picked as `bdd8b41` and added Save-and-add-another UI reset, actionable
  null-draft recovery, Add Choice focus/dismissal semantics, and the final
  local E2E/screen evidence. The worker matrix passed component (20),
  integration (18), domain (27), actor (1), full (121), local E2E (2), gallery,
  browser smoke, build, format, lint, check, and diff gates. The integration
  owner then fixed the substantiated `hydrateFailed` Loading regression and
  reconciled the CSP/runtime boundary in `b504f5f`: development-only Vite CSP
  meta removal keeps injected styles usable, while source/production CSP keeps
  `style-src 'self'` and narrowly permits only `wasm-unsafe-eval` for the
  bundled Automerge runtime. `deno task verify:pages` and production preview
  browser inspection passed; no general `unsafe-eval` or `unsafe-inline` was
  added. The aggregate `deno task verify` passed from pushed `b504f5f`:
  125 repository tests, 18 integration, 22 component, 27 domain, 1 actor,
  local E2E 2/2, native gallery/browser checks, Pages/CI/toolchain validators,
  production build, frozen audit, and diff checks. The new aggregate task was
  added in `179260b` and its checkpoint reconciled in `ab63b36`.
- **R-300 closure state after fix wave:** the prior Turing handoff remains
  preserved as historical evidence; it is not approval. The gate was reopened
  for a fresh read-only review from pushed `c97b222`, which confirmed remaining
  S2 gaps and was interrupted before a final result. R-300 therefore remains
  `BLOCKED` until the follow-up wave and a subsequent fresh APPROVE/BLOCK
  handoff complete; no downstream M4 task may be dispatched yet.
- **R-300 fresh-review recovery:** Mencius
  (`01a03269-d56d-7b02-83af-b7d8ebb5bd94`) began a fresh read-only closure
  review from pushed `c97b222` and appended timestamped progress to
  `~/git/did-it-become-what-you-like/R-300-progress.md`. Its aggregate
  `deno task verify` passed, and its source audit confirmed that custom period
  still maps to an undefined date filter and that the UI does not expose the
  actor's existing saved-record Undo path. After repeated bounded waits and an
  interrupt request, the reviewer was shut down before a final handoff; this
  is preserved as partial evidence, not approval. The gate remains blocked.
- **R-300 follow-up fix wave:** the integration owner attempted to dispatch
  the dependency-ordered U-104 slice to Anscombe
  (`01a03163-2b5a-7af1-ab87-b69cf65a0796`) and then a fresh U-104 worker,
  Einstein (`01a03275-8dec-7ef1-8f0b-f4fe757369a0`), in the preserved
  `~/git/worktrees/did-it-become-what-you-like-u-104-design-system`
  worktree. Both remained pending after bounded waits and interruption
  requests, made no source changes, and were shut down. Because the issue was
  an implementation-detail worker startup stall rather than a product or
  contract ambiguity, the integration owner completed the already-scoped
  recovery directly while preserving the U-104/L-205 ownership boundary.
  No worker edited this plan or pushed `master`.
- **R-300 follow-up integration:** commit `3424ed6` (`Fix remaining R-300
  period and undo paths`) adds controlled shared custom-period type/date
  inputs, maps day/month/year selections into the existing query period
  contract, keeps transient invalid date input safe, and exposes the existing
  typed saved-record Undo/retry/continue states in the local UI. It adds the
  PeriodPicker, saved-completion, and local browser regression coverage. The
  integration owner inspected the five-file diff and ran
  `deno task fmt:check` (134 files), `deno task lint` (122 files),
  `deno task check`, `deno task test:component` (24 passed),
  `deno task test:e2e --grep local` (2 passed), and the aggregate
  `deno task verify` (126 repository tests, 18 integration, 24 component,
  27 domain, 1 actor, local E2E 2/2, native gallery/browser, Pages/CI/toolchain
  validators, build, audit, and diff checks); all exited 0. The source commit
  is pushed, the root worktree has only the intentionally untracked
  `R-300-progress.md`, and R-300 remains BLOCKED pending a fresh independent
  closure reviewer.
- **R-300 closure dispatch:** Curie (`01a03285-474b-7c61-ace3-485265e56041`)
  was dispatched read-only from root checkpoint `9cc9f26` in preserved
  `~/git/worktrees/did-it-become-what-you-like-r-300-closure-4`, branch
  `review/r-300-closure-4`. The prompt requires timestamped progress and a
  final complete handoff, inspection of the historical and partial Mencius
  evidence, aggregate verification, local E2E, and native local-screen
  inspection at 320x568, 390x844, and 1280x800. No source, plan, master,
  remote, commit, or Pages changes are authorized; preserve the worktree and
  handover for orchestration recovery.
- **R-300 closure result:** Curie's final handoff at
  `2026-08-24T07:00:37Z` is an explicit `BLOCK` with `S1=0`, `S2=1`,
  `S3=3`, and `S4=0`. The S2 is the local UI dispatch at
  `src/features/local-ui.tsx:1826-1829`, which sets Save-and-add-another mode
  but always sends `expense.submit` instead of the typed
  `expense.submit-and-add-another` actor event. The S3 findings are the outer
  `main` in `index.html:13` duplicated by AppFrame's main landmark, missing
  level-one page headings where the Manual, Projects, and Categories page
  headers omit `headingLevel={1}`, and the invalid `aria-label` on the generic
  MoneySummary div. The reviewer ran the full `deno task verify` matrix
  (126 repository tests, 18 integration, 24 component, 27 domain, 1 actor,
  local E2E 2/2, gallery/browser/Pages/CI/toolchain checks, build, audit, and
  diff), the separate local E2E, and native local-screen/a11y inspection at
  320x568, 390x844, and 1280x800. All validation passed except the listed
  source/accessibility findings; no source, plan, master, remote, commit, or
  Pages changes were made by Curie.
- **R-300 next bounded fix wave:** the integration owner will correct only the
  four Curie findings in `src/features/local-ui.tsx`,
  `src/design-system/components.tsx`, `index.html`, and their focused tests.
  The fix must dispatch the typed add-another event, leave exactly one valid
  top-level main landmark, give the approved local page headers level-one
  headings while retaining nested level-two headings, and use valid summary
  semantics. It must not broaden scope, weaken the review, change approved
  requirements, enable Pages, or edit this plan from the worker worktree.
- **R-300 follow-up worker dispatch:** Beauvoir
  (`01a03293-f740-7c53-986c-35ce0eaa164f`) owns the four-finding fix in
  `~/git/worktrees/did-it-become-what-you-like-r-300-followup-fix-4`, branch
  `task/r-300-followup-fix-4`, based at `1bd17ee`. Ownership is limited to the
  four source/config paths and their focused tests named above. The worker must
  keep an untracked timestamped `R-300-followup-fix-4-progress.md`, leave this
  plan and `master` untouched, not push or enable Pages, and return an exact
  validation handoff before integration. R-300 remains BLOCKED.
- **R-300 follow-up worker integration:** Beauvoir completed the scoped fix in
  `~/git/worktrees/did-it-become-what-you-like-r-300-followup-fix-4` with the
  untracked `R-300-followup-fix-4-progress.md` handover preserved. Worker
  commit `cf672d3` was inspected and cherry-picked as root commit `acd3bff`.
  The six-file diff is limited to the authorized UI/design-system/index/test
  paths: typed Save-and-add-another dispatch, single AppFrame main ownership,
  level-one Manual/Projects/Categories page headings, valid MoneySummary group
  semantics, and focused regressions. Worker validation passed
  `deno task fmt:check` (134 files), `deno task lint` (122 files),
  `deno task check`, `deno task test:component` (28),
  `deno task test:e2e --grep local` (2/2), `deno task build`,
  `deno task verify` (128 repository tests, 18 integration, 28 component,
  27 domain, 1 actor, local E2E 2/2, native gallery/browser, Pages/CI/toolchain
  validators, builds, audit, and diff), and final diff check. The worker did
  not edit this plan or push; its worktree remains preserved. R-300 is still
  BLOCKED pending a fresh independent review of the integrated root.
- **R-300 closure re-review dispatch:** Feynman
  (`01a032a0-58e0-7852-86dc-49b5a1cd9732`) was dispatched from pushed root
  checkpoint `6c6072e` in preserved
  `~/git/worktrees/did-it-become-what-you-like-r-300-closure-5`, branch
  `review/r-300-closure-5`. The prompt requires timestamped progress and a
  complete final handoff, inspection of all prior review evidence and the
  `acd3bff` integration, aggregate verification, focused local E2E, and native
  local-screen/a11y checks at 320x568, 390x844, and 1280x800. No source, plan,
  master, remote, commit, or Pages changes are authorized.
- **R-300 closure approval:** Feynman's final handoff at
  `2026-08-24T07:29:57Z` explicitly `APPROVE`s the gate from
  `~/git/worktrees/did-it-become-what-you-like-r-300-closure-5`, based at
  `6c6072e`, after independently rechecking the Curie findings and integrated
  source `acd3bff`. It records `S1=0`, `S2=0`, `S3=0`, and `S4=0`; aggregate
  `deno task verify` passed with 128 repository tests, 18 integration, 28
  component, 27 domain, 1 actor, local E2E 2/2, gallery/browser/Pages/CI/
  toolchain checks, builds, frozen audit, and diff check; the separate local
  E2E passed 2/2; and native local-screen/a11y inspection passed at 320x568,
  390x844, and 1280x800 with stable axe violations 0, no page errors, one
  main landmark, expected level-one headings, and no horizontal overflow. The
  reviewer made no tracked, plan, master, remote, commit, or Pages changes;
  its untracked handover and worktree remain preserved. R-300 is complete and
  A-302 is released as the next dependency-ready milestone.
- **A-302 dispatch:** Godel (`01a032af-7fd1-7342-a1a9-aeb9872f70d4`) owns the
  receipt actor/domain implementation in
  `~/git/worktrees/did-it-become-what-you-like-a-302-receipt-actor`, branch
  `task/a-302-receipt-actor`, based at `0de9969`. Ownership is limited to
  receipt actor/domain orchestration and focused tests; no receipt UI,
  Gemini/Drive adapter internals, external sync, or populated-project
  destructive workflow. The worker must keep an untracked timestamped
  `R-302-progress.md`, leave this plan and `master` untouched, not push or
  enable Pages, and return exact validation plus an explicit READY FOR
  INTEGRATION or BLOCK. A-303 and R-400 remain gated.
- **A-302 completion/integration:** Godel completed the bounded receipt
  actor/domain workflow in
  `~/git/worktrees/did-it-become-what-you-like-a-302-receipt-actor` with
  timestamped `R-302-progress.md` preserved. Worker commit `285bbee` was
  inspected and cherry-picked as root `a1f84d6`. The eight-file scope adds the
  receipt scan lifecycle and disclosure gate, ephemeral image resolution and
  release, hostile-output normalization, invalid-line unselection, signed
  purchase/adjustment lines and optional links, selectable/editable/removable
  review lines, mismatch confirmation, image-free durable review hydration,
  atomic save/discard/rollback, and focused actor/domain/integration tests.
  Worker validation passed `deno task test --filter receipt-actor` (7),
  `deno task test:integration --filter receipt-atomic` (2), format, lint,
  check, build, and aggregate verification. Root integration independently
  passed `deno task verify`: 137 repository tests, 20 integration, 28
  component, 29 domain, 1 actor, local E2E 2/2, gallery/browser/Pages/CI/
  toolchain validators, production builds, frozen audit, and diff check. Only
  the existing chunk-size warnings remain. A-302 is COMPLETE; its worker and
  handover are preserved; A-303 is now dependency-ready.
- **A-303 dispatch:** Hilbert (`01a032d0-2474-7c30-be76-91397da10fd7`) owns
  the receipt Scan/Review/Gemini Settings UI in
  `~/git/worktrees/did-it-become-what-you-like-a-303-receipt-ui`, branch
  `task/a-303-receipt-ui`, based at `c558dfc`. Ownership is limited to the
  feature composition and its focused component/E2E/native evidence; no
  adapter internals, schema changes, Drive/external sync, unrelated local UI,
  or deferred feedback-memory feature. The worker must keep an untracked
  timestamped `A-303-progress.md`, leave this plan and `master` untouched, not
  push or enable Pages, and return exact validation plus READY FOR INTEGRATION
  or BLOCK. R-400 remains gated.
- **A-303 startup recovery:** Hilbert remained silent after repeated bounded
  waits and one status request, created no progress handover, and made no
  source changes. The exact worktree
  `~/git/worktrees/did-it-become-what-you-like-a-303-receipt-ui` stayed clean
  at `c558dfc`; Hilbert was shut down and the worktree is preserved for
  reassignment. A fresh read-only advisor, Euler
  (`01a032d5-96c5-7311-a842-97bb07d64c6a`), assessed the stall and returned
  `ADVISE`: the approved scope is clear, no human product decision is needed,
  and the exact clean worktree should be reassigned after clarifying the
  runtime composition/settings seam. The advisor handover is preserved in
  `~/git/worktrees/did-it-become-what-you-like-a-303-advisor/A-303-advisor-progress.md`.
  The reassigned worker must compose the existing A-302 scan/review machines
  through `LocalUiRuntime`, inject the published A-301 ports, use the Gemini
  localStorage secret boundary for keys, and give non-secret model/preparation
  preferences one explicit device-local settings owner. A new public schema or
  port contract requires orchestrator escalation; no worker may invent one.
- **A-303 replacement dispatch:** A fresh bounded implementation worker was
  started in the exact preserved worktree
  `~/git/worktrees/did-it-become-what-you-like-a-303-receipt-ui`, branch
  `task/a-303-receipt-ui`, after the worktree was fast-forwarded to
  `4250491`. Its timestamped `A-303-progress.md` handover records startup at
  `2026-08-24T08:20:35Z`, the clarified LocalUiRuntime/A-301/A-302/settings
  boundaries, and the first implementation-mapping checkpoint. The spawn
  response was truncated before an agent identifier was captured, so the
  worktree handover and actual Git state are authoritative for recovery. The
  replacement worker owns only the A-303 surface and must return exact
  validation plus `READY FOR INTEGRATION` or `BLOCK`; the orchestrator must
  not duplicate its source work or mark A-303 complete from progress alone.
- **A-303 completion/integration:** Bernoulli
  (`01a032da-dcbd-7003-b04b-52afdc4ed8b6`) completed the bounded receipt Scan,
  Receipt Review, and Gemini Settings UI in the preserved worktree
  `~/git/worktrees/did-it-become-what-you-like-a-303-receipt-ui` with final
  `A-303-progress.md` handover at `2026-08-24T08:58:24Z`, explicitly
  `READY FOR INTEGRATION`. Worker commit `00d1e59` was cherry-picked as root
  `a90504d`; it adds the actor-backed scan/review/settings composition, native
  image lifecycle, exact disclosure, device-local settings and secret UI,
  review editing/selection/mismatch/add/remove flows, focused component tests,
  and the fake-Gemini atomic-save E2E with the pending-scan continuation
  regression. The separately reviewed one-line A-301 canvas compatibility
  follow-up was committed as worker `db774b5` and root `a8b87ca`; it adds only
  the existing `drawImage` capability guard needed by the checked browser
  build, changes no public contract/schema, and remains explicitly identified
  for R-400 review. Root `deno task verify` passed after both commits. The
  worker and timestamped handover remain preserved; R-400 is now released.
- **R-400 dispatch:** Archimedes (`01a03302-91be-7852-9ecf-84e07a540dbe`) is
  the fresh independent read-only Luna xhigh reviewer in
  `~/git/worktrees/did-it-become-what-you-like-r-400-closure`, branch
  `review/r-400-closure`, based at `f7d7b6b`. The reviewer owns no source or
  plan changes and must preserve a timestamped `R-400-progress.md` handover,
  run/reconcile the receipt privacy, actor, financial, accessibility, visual,
  and fake-Gemini evidence, and end with explicit `APPROVE` or `BLOCK`.
  A-303 remains integrated but R-400 is not complete until this fresh review
  and any scoped fix/reverification loop are finished.
- **R-400 first review result:** Archimedes completed the fresh read-only review
  from `~/git/worktrees/did-it-become-what-you-like-r-400-closure`, branch
  `review/r-400-closure`, based at `f7d7b6b`, with final handover
  `~/git/worktrees/did-it-become-what-you-like-r-400-closure/R-400-progress.md`
  at `2026-08-24T09:27:01Z`: `BLOCK`, five S2 and three S3 findings. The S2
  blockers are source-file/native-input cleanup after removal/failure, silent
  incompatible-model substitution and unreachable/non-durable Needs-test
  evidence, discarded browser HTTP status before typed Gemini error mapping,
  focus escaping from quick-setup and metadata dialogs, and removal of a
  remembered API key after any quick-setup failure. S3 findings are missing
  exact request-body allowlist assertions in the fake E2E, adjustment links to
  unselected purchases, and the unresolved compact 390px contrast diagnostic.
  `deno task verify` and the receipt E2E passed, but the gate remains blocked;
  no source or plan changes were made by the reviewer.
- **R-400 fix-wave boundary:** before resuming implementation, the
  orchestrator must preserve the blocked review worktree/handover, update this
  plan with the exact fix owner and base, and keep the fix bounded to receipt
  UI/Gemini composition, approved design-system behavior, focused tests/E2E,
  and additive device-local compatibility evidence. Portable expense/receipt
  schema, A-301/A-302 public contracts, adapter internals beyond the already
  isolated canvas guard, Drive/sync, Pages, and deferred memory remain out of
  scope. R-400 cannot be marked complete from the passing aggregate verify
  while these findings remain unresolved.
- **R-400 fix-wave dispatch:** Bernoulli
  (`01a032da-dcbd-7003-b04b-52afdc4ed8b6`) is reassigned to the fresh bounded
  worktree `~/git/worktrees/did-it-become-what-you-like-r-400-fix`, branch
  `task/r-400-fix`, based at the pushed checkpoint `28296b2`. Ownership is
  limited to `src/features/receipt-ui.tsx`,
  `src/features/receipt-ui.test.tsx`, `src/features/local-ui.css`,
  `src/design-system/components.tsx`, `e2e/receipt-review.spec.ts`, and the
  additive device-local compatibility-evidence fields/tests in
  `src/domain/schema/records.ts` only if required by the model-test finding.
  The worker must fix all five S2 findings and the scoped S3 items with
  regression evidence: release/clear native files on every terminal path,
  require explicit compatible model selection and reachable durable Needs-test
  evidence, preserve only numeric HTTP status for typed error mapping, contain
  and restore focus for both dialogs, preserve remembered keys on transient
  setup failures, assert the exact fake-E2E request body/cleanup boundary,
  restrict adjustment links to valid selected purchases, and recheck the
  compact contrast diagnostic. No portable schema, A-301/A-302 contract,
  adapter-internal expansion, Drive/sync, Pages, or deferred memory changes.
  The worker must keep a timestamped `R-400-fix-progress.md`, not edit this
  plan or `master`, and return exact validation plus `READY FOR INTEGRATION` or
  `BLOCK`.
- **R-400 fix-wave integration:** Bernoulli completed the bounded fix in
  `~/git/worktrees/did-it-become-what-you-like-r-400-fix` with final
  `R-400-fix-progress.md` handover at `2026-08-24T10:15:57Z`, explicitly
  `READY FOR INTEGRATION`. Worker commit `e2f8642` was inspected and
  cherry-picked as root `12fd97f`. It fixes native input/file/object-URL/byte
  release and re-selection paths, explicit compatible/Needs-test model
  selection with versioned device-local evidence, numeric HTTP status
  preservation for typed redacted Gemini errors, focus-managed quick-setup and
  metadata dialogs, remembered-key retention, valid adjustment linking,
  compact navigation stacking, and request-body/429/cleanup regressions.
  Root `deno task verify` passed with 137 repository, 20 integration, 35
  component, 29 domain, 1 actor, and local E2E 2/2, plus native gallery,
  browser, Pages/CI/toolchain, builds, frozen audit, and diff checks. Focused
  receipt tests passed 7/7, receipt E2E 1/1, and native receipt axe passed at
  320x568, 390x844, and 1280x800 with the prior 390px incomplete diagnostic
  cleared. R-400 remains `IN_PROGRESS` pending a fresh independent closure
  review of this exact root integration.
- **R-400 fresh closure dispatch:** Gauss
  (`01a03349-80e0-7b90-8a9e-1438cddb75c5`) is the fresh independent read-only
  Luna xhigh reviewer in
  `~/git/worktrees/did-it-become-what-you-like-r-400-closure-2`, branch
  `review/r-400-closure-2`, based at `d6afa45`. It must reconcile the prior
  blocked handover and the fix handover against actual source and run the
  complete automated, receipt E2E, and native 320x568/390x844/1280x800 review
  again. It owns no source changes, maintains only a timestamped untracked
  `R-400-closure-2-progress.md`, and must end with explicit `APPROVE` or
  `BLOCK`; R-400 remains gated until that result.
- **R-400 closure-2 result:** Gauss completed the fresh independent review from
  `~/git/worktrees/did-it-become-what-you-like-r-400-closure-2`, branch
  `review/r-400-closure-2`, with final handover
  `~/git/worktrees/did-it-become-what-you-like-r-400-closure-2/R-400-closure-2-progress.md`
  at `2026-08-24T10:36:04Z`: `BLOCK`, S1=0, S2=0, S3=1, S4=0. The fix wave
  cleared all prior blockers: native/file cleanup, explicit model/Needs-test
  evidence and invalidation, typed redacted HTTP status mapping, key
  retention, dialog focus, request-body/429 assertions, and adjustment-link
  validity all passed. The sole remaining S3 is a compact 390px diagnostic:
  quick-setup warning text still receives an incomplete contrast result, and
  expanded scan options place the model trigger beneath the sticky Scan action
  at the initial scroll position. The reviewer found the screen readable and
  all other native viewports/dialogs clean, but did not accept the repeated
  diagnostic. R-400 remains blocked pending a narrow responsive fix/recheck.
- **R-400 compact-layout fix boundary:** the orchestrator must preserve both
  review worktrees and handovers and dispatch one bounded owner for only
  `src/features/local-ui.css`, receipt scan/options composition if necessary,
  focused native/component regression support, and no data/adapter/actor/schema
  changes. The fix must remove the sticky-action overlap and recheck the 390px
  contrast diagnostic at all three required viewports; no unrelated polish or
  workflow changes are authorized.
- **R-400 compact-layout fix dispatch:** Bernoulli
  (`01a032da-dcbd-7003-b04b-52afdc4ed8b6`) owns the narrow responsive fix in
  `~/git/worktrees/did-it-become-what-you-like-r-400-compact-fix`, branch
  `task/r-400-compact-fix`, based at `9eed68d`. The worker must preserve an
  untracked timestamped `R-400-compact-fix-progress.md`, leave this plan and
  `master` untouched, and return exact native/automated validation plus
  `READY FOR INTEGRATION` or `BLOCK`. R-400 remains blocked until this fix is
  integrated and receives a fresh closure recheck.
- **R-400 compact-layout fix integration:** Bernoulli completed the bounded
  responsive fix in `~/git/worktrees/did-it-become-what-you-like-r-400-compact-fix`
  with final `R-400-compact-fix-progress.md` handover at
  `2026-08-24T10:58:22Z`, explicitly `READY FOR INTEGRATION`. The worker
  commit `268131f` was inspected and cherry-picked as root `ba63635`
  (`Fix compact receipt scan layout`), changing only
  `src/features/receipt-ui.tsx` and `src/features/local-ui.css`. It wraps the
  compact options surface for immediate mobile scroll positioning and
  isolates the quick-setup warning background so the 390px model control is
  above the sticky action and the warning receives a deterministic contrast
  surface. The handover records `deno task verify`, focused component 7/7,
  receipt E2E 1/1, build, and native 320x568/390x844/1280x800 checks with
  zero axe violations/incomplete results and no horizontal overflow. The
  worker and worktree are preserved, the agent is closed, and the source
  commit is being pushed with this checkpoint. R-400 remains `IN_PROGRESS`
  pending a fresh independent closure recheck.
- **R-400 closure-3 dispatch:** Ohm
  (`01a03371-cd9e-72b0-9a0f-af5408f23ea8`) is the fresh independent read-only
  Luna xhigh reviewer in
  `~/git/worktrees/did-it-become-what-you-like-r-400-closure-3`, branch
  `review/r-400-closure-3`, based at `17d17a3`. It must reconcile the prior
  blocked review, the bounded fix handovers, and the exact integrated source;
  rerun the complete automated gate, receipt E2E, and native
  320x568/390x844/1280x800 visual, interaction, and axe review, with special
  attention to the two former compact-layout findings. The reviewer owns no
  source or plan changes and must maintain only the timestamped untracked
  `R-400-closure-3-progress.md` handover, ending with explicit `APPROVE` or
  `BLOCK`. R-400 remains gated until this review result is recorded.
- **R-400 closure-3 result:** Ohm’s fresh review was interrupted while its
  native browser command became unresponsive after the
  `2026-08-24T11:15:21Z` progress checkpoint; the exact temporary Vite and
  agent-browser processes were gracefully stopped and the reviewer was shut
  down, with its untracked handover preserved. The handover records the full
  `deno task verify` and receipt E2E as passing, 320px disclosure/scan and
  390px scan axe checks passing, native file-input removal cleanup passing,
  and the compact scroll fix clearing the model-trigger/sticky-action overlap
  (`y=543.5..591.5` versus `y=771..844`). It independently reproduces one
  incomplete serious-impact 390px quick-setup color-contrast diagnostic,
  with provisional severity counts `S1=0, S2=0, S3=1, S4=0`. Because the
  native run did not reach its final footer or complete 1280px/dialog checks,
  the orchestrator disposition is `BLOCK`, not approval; R-400 remains
  blocked on a narrow contrast diagnosis/fix and a complete fresh recheck.
- **R-400 contrast diagnosis boundary:** because the same S3 survived the
  first compact fix and was independently reproduced, the orchestrator will
  first obtain one read-only advisor diagnosis of the warning-surface
  composition. The follow-up implementation, if required, is limited to the
  quick-setup warning surface and its focused component/native evidence in
  `src/features/local-ui.css`, `src/features/receipt-ui.tsx`, and the
  corresponding focused tests; it must not alter data, adapter, actor,
  portable schema, model-selection, sticky-layout, Pages, or deferred-memory
  behavior.
- **R-400 contrast advisor dispatch:** Laplace
  (`01a03383-31dc-7620-ad4f-5e1baa6ebc8e`) is the read-only advisor in
  `~/git/worktrees/did-it-become-what-you-like-r-400-contrast-advisor`, branch
  `review/r-400-contrast-advisor`, based at `3410eeb`. Its only writable
  artifact is the timestamped untracked
  `R-400-contrast-advisor-progress.md`; it must diagnose the computed
  warning-text/background ancestry and axe interpretation, recommend the
  smallest bounded fix and regression evidence, and end with explicit
  `ADVICE READY` or `BLOCK`. It must not alter source, this plan, `master`,
  remotes, commits, or worktrees.
- **R-400 contrast advisor interruption:** Laplace created the required
  startup handover at `2026-08-24T11:26:19Z` in
  `~/git/worktrees/did-it-become-what-you-like-r-400-contrast-advisor`, but
  remained stuck at a stale synthetic browser locator before reaching the
  warning surface or a final `ADVICE READY`/`BLOCK`. Its verified temporary
  Vite and agent-browser processes were stopped gracefully, the handover and
  worktree were preserved, and the agent was shut down. This is an
  orchestration interruption, not evidence that the S3 is resolved; the
  bounded implementation worker must diagnose it from source and native
  evidence.
- **R-400 contrast-fix dispatch:** Locke
  (`01a03389-6f25-7b82-8459-92b4d22433ff`) owns the bounded follow-up in
  `~/git/worktrees/did-it-become-what-you-like-r-400-contrast-fix`, branch
  `task/r-400-contrast-fix`, based at `4f577f9`. Ownership is limited to the
  quick-setup warning-surface composition/CSS and its cheapest focused
  regression evidence. The worker must verify the warning title/body
  computed background boundary, clear the 390px serious-impact contrast
  diagnostic without changing the already-fixed sticky layout, preserve all
  prior R-400 boundaries, maintain timestamped
  `R-400-contrast-fix-progress.md`, and return exact validation plus
  `READY FOR INTEGRATION` or `BLOCK`. It must not edit this plan, `master`,
  remotes, or unrelated source, and must not commit or push. R-400 remains
  blocked until this fix is integrated and a complete fresh closure review
  passes.
- **R-400 contrast-fix worker interruption:** Locke started a temporary native
  session in `~/git/worktrees/did-it-become-what-you-like-r-400-contrast-fix`
  but never created its required handover or any tracked diff. After the
  session remained unresponsive, its exact worktree-scoped Vite and
  agent-browser processes were stopped gracefully and the worker was shut
  down. The worktree remains clean at `4f577f9`; no source, plan, commit, or
  remote mutation occurred.
- **R-400 contrast-fix replacement dispatch:** Dirac
  (`01a0338f-9bac-74e1-9099-cea2860b8e9d`) takes over the same clean worktree
  `~/git/worktrees/did-it-become-what-you-like-r-400-contrast-fix`, branch
  `task/r-400-contrast-fix`, based at `4f577f9`. It must create the
  timestamped `R-400-contrast-fix-progress.md` before browser work, diagnose
  source-first, preserve the exact bounded ownership and validation gates,
  and return `READY FOR INTEGRATION` or `BLOCK`. R-400 remains blocked until
  the replacement fix and a complete fresh closure review pass.
- **R-400 contrast-fix integration:** Dirac completed the bounded fix in
  `~/git/worktrees/did-it-become-what-you-like-r-400-contrast-fix` with final
  `R-400-contrast-fix-progress.md` handover at `2026-08-24T11:57:37Z`,
  explicitly `READY FOR INTEGRATION`. Worker commit `9d8d8fa` was inspected
  and cherry-picked as root `1f85325` (`Clear quick setup contrast
  diagnostic`), changing only `src/features/local-ui.css`: the quick-setup
  warning stack receives the opaque warning surface and the multi-line body
  text is flattened so axe can determine the shared background while the
  title/body warning colors remain unchanged. The worker’s native matrix
  records 320x568 quick setup `0/0/33`, fresh 390x844 quick setup `0/0/32`
  with the warning target absent, scoped 1280x800 warning `0/0/6`, and
  1280x800 scan/options `0/0/36`; after expansion the 390px model picker was
  `[41,505,308,77]` and sticky action `[24,747,342,73]`, with no overlap or
  horizontal overflow. A separate resized-session `incomplete=1` result was
  an unrelated API-key description target and was not attributed to this
  warning-only fix. The worker’s full `deno task verify`, focused component
  7/7, receipt E2E 1/1, build, and `git diff --check` passed; worker and
  handover remain preserved and R-400 is still blocked pending a fresh
  independent closure review.
- **R-400 closure-4 dispatch:** Planck
  (`01a033a6-8785-7021-bbc8-6100642e53cb`) is the fresh independent read-only
  Luna xhigh reviewer in
  `~/git/worktrees/did-it-become-what-you-like-r-400-closure-4`, branch
  `review/r-400-closure-4`, based at `0ae8120`. It must create the
  timestamped `R-400-closure-4-progress.md` before browser work, reconcile
  all prior review/fix handovers against the exact integrated source, rerun
  the full automated gate and receipt E2E, and recheck the warning subtree,
  compact model/sticky geometry, focus, cleanup, privacy, and all required
  320x568/390x844/1280x800 native evidence. Browser commands are bounded and
  temporary sessions must be closed; the reviewer owns no source or plan
  changes and must end with exact results, severity counts, and `APPROVE` or
  `BLOCK`. R-400 remains gated until this result is recorded.
- **R-400 closure-4 interruption:** Planck reconciled the complete source and
  prior handovers, independently passed `deno task verify` and
  `deno task test:e2e --grep receipt-review`, and found no source or
  automated severity finding. Its native Vite/agent-browser session then
  became idle before writing any viewport checkpoint; the exact temporary
  processes were stopped gracefully and the reviewer was shut down. The
  timestamped `R-400-closure-4-progress.md` handover and worktree remain
  preserved. This is not an approval because the required native evidence and
  final disposition were not reached.
- **R-400 closure-5 native recheck dispatch:** Leibniz
  (`01a033b3-6922-7801-b0bd-95fb052fcd4e`) is the fresh independent read-only
  native recheck in
  `~/git/worktrees/did-it-become-what-you-like-r-400-closure-5`, branch
  `review/r-400-closure-5`, based at `8ffe4fd`. It must create the
  timestamped `R-400-closure-5-progress.md` before browser work, independently
  run the receipt E2E and bounded native 320x568/390x844/1280x800 checks for
  the warning subtree, cleanup, focus, compact model/sticky geometry, and
  overflow, then close temporary sessions and end with exact severity counts
  and `APPROVE` or `BLOCK`. It owns no source or plan changes. R-400 remains
  gated until this recheck completes.
- **R-400 closure-5 result:** Leibniz independently passed the receipt E2E
  (`1 passed`), native 320x568 full axe `0/0/33` with warning subtree `0/0/6`
  and no overflow, and native 390x844 warning subtree `0/0/6`, no overflow,
  model picker/sticky separation after Options expansion, review cleanup, and
  metadata dialog focus/containment/Escape/restore. Its handover
  `~/git/worktrees/did-it-become-what-you-like-r-400-closure-5/R-400-closure-5-progress.md`
  at `2026-08-24T12:25:15Z` ended `BLOCK` because a stale locator stopped the
  final 1280x800 matrix before disclosure/cleanup, warning axe, geometry,
  overflow, review, and metadata checks. No in-scope product finding was
  confirmed (`S1=0, S2=0, S3=0, S4=0`); the missing viewport evidence alone
  prevents approval. The worktree/handover remain preserved and the agent is
  closed.
- **R-400 closure-6 final native completion dispatch:** Volta
  (`01a033bc-a7e6-7140-b3b8-ce7b68492063`) owns one final read-only native
  completion in
  `~/git/worktrees/did-it-become-what-you-like-r-400-closure-6`, branch
  `review/r-400-closure-6`, based at `a47fe10`. It must create
  `R-400-closure-6-progress.md` before browser work and complete the missing
  fresh 1280x800 disclosure/cleanup, warning axe, options/model/sticky
  geometry, overflow, review, and metadata focus checks, reconciling the
  preserved 320/390 evidence. It must use fresh snapshots, bounded browser
  commands, ~ paths, synthetic data, no source/plan/remote mutations, and
  end with exact severity counts and `APPROVE` or `BLOCK`. R-400 remains
  gated until this final native completion.
- **R-400 closure-6 result:** Volta completed the final fresh native matrix
  from `~/git/worktrees/did-it-become-what-you-like-r-400-closure-6` with final
  `R-400-closure-6-progress.md` handover at `2026-08-24T12:36:26Z`, explicitly
  `APPROVE`. At 1280x800 it independently verified disclosure, synthetic
  image removal/file and object-URL cleanup, warning subtree axe `0/0/6`,
  scan/options axe `0/0/37`, model/sticky separation after fresh
  `scrollIntoView` (`model/sticky overlap=false`, expanded popover also clear),
  no horizontal overflow, review axe `0/0/35` with selection toggle behavior,
  and metadata dialog focus containment/Escape/focus restoration within the
  viewport. It reconciled the preserved independent 320/390 evidence from
  Leibniz and Dirac; the only full-page incomplete remained the unrelated
  API-key description target, while the in-scope warning subtree was clean.
  All synthetic-only boundaries were honored, temporary browser/server were
  closed, and no source, plan, remote, or other worktree changed. R-400 is
  now released and complete.
- **S-401 implementation dispatch:** Lovelace
  (`01a033cb-8bef-7cc1-af6a-9f8eff28ea0d`) owns the adapter-only
  implementation in
  `~/git/worktrees/did-it-become-what-you-like-s-401-drive-adapter`, branch
  `task/s-401-drive-adapter`, based at `03f05b9`. Ownership is limited to
  `src/adapters/drive/**` and focused tests/support within that directory; no
  port, domain, sync, UI, plan, master, remote, or unrelated source changes
  are permitted. The worker must create and continuously append the UTC
  `S-401-progress.md` handover, implement least-scope appDataFolder OAuth and
  Drive transport with redacted typed errors, retries/pagination, conditional
  operations, abort/idempotence, and retirement-marker read-before-upload
  protection using synthetic boundaries only. It must return exact validation
  commands/results and `READY FOR INTEGRATION` or `BLOCKED`; live Drive smoke
  is forbidden without explicit environment configuration. S-401 was active
  under this dispatch and its worktree/handover remain preserved.
- **S-401 integration result:** Lovelace completed the bounded implementation
  in `~/git/worktrees/did-it-become-what-you-like-s-401-drive-adapter` with
  final `S-401-progress.md` handover at `2026-08-24T13:04:40Z`, explicitly
  `READY FOR INTEGRATION`. The worker source commit `ffc651e` was inspected
  and cherry-picked as root `1d3afce` (`Implement S-401 Drive adapter`),
  changing only `src/adapters/drive/adapter.ts`, `browser.ts`, `index.ts`, and
  `adapter.integration.test.ts`. It implements appDataFolder-only GIS token
  authorization, one-account identity and revocation, paginated and isolated
  Drive transport, conditional ETag operations, typed/redacted failures,
  injectable retry/backoff, abort handling, idempotent lost-response recovery,
  and retirement-marker read-before-upload protection. Worker evidence passed
  `deno task fmt:check` (146 files), `deno task lint` (134 files),
  `deno task check`, the exact direct S-401 equivalent
  `deno test --allow-read --allow-write --allow-run --allow-env
  src/adapters/drive --filter drive-adapter` (11/11), `deno task build`,
  `deno task verify` (137 repository, 20 integration, 35 component, 29
  domain, 1 actor, local E2E 2/2, gallery/browser/Pages/CI/toolchain,
  production builds, frozen audit, and diff check), and the worker secret
  scan. The repository alias `deno task test:integration --filter
  drive-adapter` passed with 0 selected/20 filtered because it hard-codes
  `src/adapters/local`; changing that alias is outside S-401 ownership. The
  same full validation was rerun after root integration and passed. No live
  Drive smoke or credentials were used. The worker worktree and timestamped
  handover remain preserved; S-401 is complete and S-402 is next.
- **S-402 implementation dispatch:** James
  (`01a033e7-eaa6-76b0-bc63-84fcf773355b`) owns the sync/device actor and
  causal-transport implementation in
  `~/git/worktrees/did-it-become-what-you-like-s-402-sync`, branch
  `task/s-402-sync`, based at `bcedb1b`. Ownership is limited to new
  `src/actors/sync/**`, `src/adapters/sync/**`, and focused tests/support in
  those directories; shared actor/port contracts, domain schemas, local
  persistence, UI, plan, master, remotes, and unrelated source are excluded.
  The worker must maintain the UTC `S-402-progress.md` handover with a concise
  XState v5 machine/actor sketch, phase checkpoints, exact validation, and a
  final `READY FOR INTEGRATION` or `BLOCKED`. It must use synthetic devices,
  deterministic clocks/IDs, pull-before-push causal exchange, safe retry and
  cancellation, opaque-ID-free ordinary projections, and retirement/account
  boundaries without changing conflict resolution or choosing wall-clock
  winners. S-402 was active under this dispatch; its worktree and handovers
  remain preserved after integration.
- **S-402 startup interruption and replacement:** James was shut down after
  the UTC recovery checkpoint window at `2026-08-24T13:27:08Z`. It had
  written a startup handover and two partial adapter files in the root
  worktree instead of the assigned worktree; none were discarded. The
  orchestrator relocated the exact files into
  `~/git/worktrees/did-it-become-what-you-like-s-402-sync` as
  `src/adapters/sync/causal.ts`, `src/adapters/sync/device-registry.ts`, and
  `S-402-james-progress.md`, preserving the original content, and restored
  root to its intentional-untracked state. Sagan
  (`01a033f4-76cb-77a2-94c2-eb2399d1bae6`) owns the same bounded task and
  recorded its paused handover at `2026-08-24T13:28:41Z`; it audited the
  relocated artifacts before continuing. This was an operational recovery,
  not evidence of a product blocker; S-402 later completed through the
  replacement worker below.
- **S-402 integration result:** Sagan completed the recovered bounded task in
  `~/git/worktrees/did-it-become-what-you-like-s-402-sync` with final
  `S-402-progress.md` handover at `2026-08-24T14:01:45Z`, explicitly `READY FOR
  INTEGRATION`. The orchestrator preserved the interrupted James handover as
  `S-402-james-progress.md`, inspected the replacement diff, and committed
  source/test files as worker commit `f713f78`, cherry-picked into root as
  `95ac376` (`Implement S-402 synchronization actor and transport`). The
  integrated files are limited to `src/actors/sync/**` and
  `src/adapters/sync/**`: a modern XState v5 sync actor with hydration,
  configure/connect/reconnect/retry/offline/account-switch/retirement modes,
  coalesced triggers, causal pull-before-push coordination, deterministic
  causal merge and in-memory/Drive boundaries, persisted known-device registry
  with opaque-ID-free ordinary projections, and focused actor/device/schedule
  tests. No public contracts, domain schemas, local adapter, UI, or conflict
  workflow were changed. Worker validation passed `deno task fmt:check` (155
  files), `deno task lint` (143 files), `deno task check`, direct actor 5/5,
  schedule 5/5, registry 2/2, `deno task build`, `deno task verify` (137
  repository, 20 integration, 35 component, 29 domain, 1 actor, local E2E
  2/2, gallery/browser/Pages/CI/toolchain, builds, audit, and diff check), and
  the locked aliases with 0 S-402 selections because their paths exclude the
  new directories. Root rerun after cherry-pick passed the same fmt/lint/check,
  direct 5/5/2 focused suites, aliases 0 selected/137 and 20 filtered, build,
  full verify, and diff checks. Only the existing Vite chunk-size warning
  remains; no live Drive or credentials were used. S-402 is complete, its
  worktree and both timestamped handovers remain preserved, and S-403 is next.
- **S-403 implementation dispatch:** Maxwell
  (`01a03419-ba5c-7b63-bd02-736a2c7aca8c`) owns the conflict-domain/actor and
  projection implementation in
  `~/git/worktrees/did-it-become-what-you-like-s-403-conflict`, branch
  `task/s-403-conflict`, based at `d99057d`. Ownership is limited to new
  `src/domain/conflict/**`, `src/actors/conflict/**`, and focused tests/support
  in those directories; existing actor contracts, public ports, domain
  schemas, local/sync adapters, UI, plan, master, remotes, and unrelated
  source are excluded. The worker must maintain UTC `S-403-progress.md` with
  an XState v5 sketch, phase checkpoints, exact commands/results, and a final
  `READY FOR INTEGRATION` or `BLOCKED`. It must preserve neutral candidates,
  delete-versus-edit choices, offline local resolution, durable unresolved
  progress, parent-referencing resolution revisions, and deterministic
  concurrent convergence without timestamp winners or Screen 10A markup.
  S-403 was active under this dispatch; its worktree and handover remain
  preserved after integration.
- **S-403 integration result:** Maxwell completed the bounded task with final
  `S-403-progress.md` handover at `2026-08-24T14:46:36Z`, explicitly `READY FOR
  INTEGRATION`. The orchestrator inspected the nine owned source/test files,
  committed them as worker-branch commit `2dd86f5`, and cherry-picked root
  integration commit `1c50cb3` (`Implement S-403 conflict workflow`). The
  implementation provides neutral field-level grouping with device/time
  context, independent-field auto-merge, same-field and delete-versus-edit
  choices including absent-field candidates, validated custom/candidate
  values, atomic offline local resolution revisions and tombstones referencing
  every parent, durable unresolved count/reload/failure state, and
  deterministic concurrent resolution convergence without timestamp winners.
  Root validation passed `deno task fmt:check` (164 files), `deno task lint`
  (152 files), `deno task check`, direct owned tests (15/15),
  `deno task test --filter conflict` (2 passed/135 filtered), the locked
  integration alias (0 selected/20 filtered because its paths exclude the
  owned directories), the direct equivalent, `deno task build`, and
  `deno task verify` (137 unit, 20 integration, 35 component, 29 domain, 1
  actor, local E2E 2/2, gallery/browser/Pages/CI/toolchain, builds, audit, and
  diff check). The existing Vite chunk warning remains the only build warning;
  no live Drive or credentials were used. No contracts, schemas, local/sync
  adapters, UI, or configuration were changed. S-403 is complete; its
  worktree and timestamped handover remain preserved.
- **S-404 implementation dispatch:** Schrodinger
  (`01a03432-f93b-7ed3-be0c-ff5b9fbe520e`) owns the import/export domain, actor,
  and file/share adapter composition in
  `~/git/worktrees/did-it-become-what-you-like-s-404-import`, branch
  `task/s-404-import`, based at `a306564`. Ownership is limited to new
  import/export paths and focused tests; existing contracts, ports, schemas,
  local/sync code, UI, plan, master, remotes, and unrelated source are
  excluded. The worker must maintain UTC `S-404-progress.md` with an XState v5
  sketch, phase checkpoints, exact commands/results, and final `READY FOR
  INTEGRATION` or `BLOCKED`. It must implement atomic canonical JSON
  import/export, causal merge and stable-history deduplication, generation-safe
  replace with safety backup/recovery, configured-Drive pre-sync gating,
  unconfigured offline replacement, share fallback, and device-local/secret
  exclusions without Screen 12 markup. S-403 and S-404 are complete; the S-404
  worktree and handover remain preserved after integration.
- **S-404 startup artifact recovery:** during the S-404 worker's early phase,
  six untracked domain files were also written to the root worktree before the
  assigned worktree copy was updated. The orchestrator preserved those exact
  artifacts by moving them to the explicit quarantine directory
  `recovered-s404-root-artifacts-2026-08-24/` in the root worktree, leaving no
  S-404 source under `master`. The S-404 assigned worktree remains the only
  implementation source; the worker was instructed to append this recovery
  event to its timestamped handover and continue without touching root.
- **S-404 integration result:** Schrodinger completed the bounded task with
  final `S-404-progress.md` handover at `2026-08-24T15:03:45Z`, explicitly
  `READY FOR INTEGRATION`. The orchestrator inspected the eleven owned
  source/test files, committed them as worker-branch commit `9d3bf4e`, and
  cherry-picked root integration commit `0f20581` (`Implement S-404 import
  export workflows`). The implementation provides canonical JSON export and
  legacy migration/preview, stable causal-history deduplication and collision
  rejection, atomic merge/replace persistence, generation-safe replacement
  with durable backup/recovery, configured-Drive online pre-sync gating,
  unconfigured offline replacement, share-unavailable save fallback, and
  device-local/secret/draft/image exclusions. It preserves the locked import
  actor event/output protocol with modern XState v5 actors and adds no Screen
  12 markup. Root rerun passed `deno task fmt:check` (175 files), `deno task
  lint` (162 files), `deno task check`, direct S-403 tests (15/15), direct
  S-404 tests (19/19), import/export aliases (0 selected/137 filtered and 0
  selected/20 filtered because their configured paths exclude new directories),
  `deno task build`, `deno task verify` (137 unit, 20 integration, 35
  component, 29 domain, 1 actor, local E2E 2/2, gallery/browser/Pages/CI/
  toolchain, builds, audit, and diff check), and
  `deno task verify:schema-docs`. The existing Vite chunk-size warning remains
  non-fatal; no live Drive or credentials were used. No existing contracts,
  ports, schemas, local/sync adapters, UI, or configuration were changed.
  S-404 is complete; its worktree, handover, and the separately preserved root
  artifact quarantine remain intact.
- **S-405 parallel UI dispatch:** S-405 is split into disjoint feature slices
  with the orchestrator as integration owner. Ptolemy
  (`01a03454-bbe3-7f02-9a58-6b6ce20ecc2c`) owns only synchronization and
  Known Devices feature components/tests in
  `~/git/worktrees/did-it-become-what-you-like-s-405-sync-ui`, branch
  `task/s-405-sync-ui`, based at `2d24c1e`; Pasteur
  (`01a03454-bc35-7721-b6ef-c2bc9cbf7c72`) owns only Conflict Review and
  Import/Export feature components/tests in
  `~/git/worktrees/did-it-become-what-you-like-s-405-conflict-import-ui`,
  branch `task/s-405-conflict-import-ui`, based at `2d24c1e`. Both workers are
  limited to their new `src/features/**` slice and its timestamped handover;
  they must not edit app shell/routing/local UI composition, design-system,
  adapters, domain, contracts, plan, master, remotes, or the other slice.
  Each must read `UI_SPEC.md` and `DESIGN_SYSTEM.md`, use actor-driven props
  and existing primitives, record a concise XState/UI state boundary where
  applicable, and finish with exact component/static validation plus
  `READY FOR INTEGRATION` or `BLOCKED`. Direct agent-browser inspection is
  deferred to the orchestrator's post-integration audit because the shared
  app composition is intentionally owned centrally. Merge order is either
  slice first, then the other slice, followed by orchestrator wiring in
  `src/features/local-ui.tsx`, routing, and app entry; the orchestrator must
  rerun combined component/E2E/agent-browser and full gates before S-405 is
  complete.
- **S-405 integration result:** Ptolemy's final handover at
  `2026-08-24T15:41:24Z` and Pasteur's final handover at
  `2026-08-24T15:43:58Z` were both `READY FOR INTEGRATION`. The orchestrator
  inspected both bounded feature slices, committed the worker branches as
  `815ee85` (`Implement S-405 synchronization UI`) and `492f0bd`
  (`Implement S-405 conflict and import UI`), and integrated them as
  `5448606` and `eec295c`. The orchestrator then added the actor-backed
  `src/features/sync-portability-runtime.tsx`, app routes for synchronization,
  known devices, conflict review, and import/export, Settings entry points,
  feature CSS imports, and the narrow header correction. The integration
  commits are `be528f9` (`Integrate S-405 synchronization and portability UI`)
  and `d877c52` (`Fix narrow synchronization header layout`). The runtime
  keeps XState machines mounted across navigation, derives sync, conflict,
  import, and export view models from actor snapshots, uses the local
  repository and browser file-share boundary, keeps Drive explicitly
  unconfigured until OAuth setup is available, and exposes opaque identifiers
  only through the existing labeled technical-details disclosures. Worker
  worktrees and timestamped handovers remain preserved; no adapters, domain
  contracts, or deployment settings were changed.
  Direct owned tests passed `21/21` across the two S-405 feature directories;
  `deno task fmt:check`, `deno task lint`, `deno task check`, `deno task build`,
  and the final `deno task verify` all passed. The final aggregate verify
  counts were 137 repository tests, 20 integration, 56 component, 29 domain,
  1 actor, local E2E `2/2`, gallery/browser/Pages/CI/toolchain checks, both
  production builds, frozen audit, and diff check. The integrated agent-browser
  audit covered all four new routes at `320x568`, `390x844`, and `1280x800`
  with zero axe violations after fixing the narrow long-title overlap; it also
  exercised the disconnected Drive screen, local export/download completion,
  malformed JSON validation failure, empty conflict review, and responsive
  screenshots. No live Drive credentials or external service calls were used.
- **R-500 independent review dispatch:** Ramanujan
  (`01a03487-4c6b-7b80-9d8f-595044c93349`) is reviewing the integrated
  synchronization/portability milestone read-only in
  `~/git/worktrees/did-it-become-what-you-like-r-500-review`, branch
  `review/r-500-synchronization`, based at `d877c52`. The only allowed
  worktree mutation is its untracked timestamped `R-500-progress.md` handover;
  source, tests, contracts, adapters, specs, this plan, `master`, remotes, and
  deployment settings are excluded. The reviewer must inspect the S-401–S-405
  evidence, maintain the progress/handover protocol, and return explicit
  `APPROVE` or `BLOCK` with severity-counted findings and exact validation
  evidence. Preserve this worktree and handover through closure.
- **R-500 independent review result:** Ramanujan's final handover at
  `2026-08-24T16:28:27Z` is `BLOCK`, preserved at
  `~/git/worktrees/did-it-become-what-you-like-r-500-review/R-500-progress.md`.
  The review found two severity-1 defects: a higher-generation replacement
  can merge and resurrect removed local records, and a real same-field causal
  conflict can crash while creating a conflict because record identity is
  lost. It found eight severity-2 defects: routed Drive authorization/transport
  is not wired; runtime conflict projection collapses field and deletion
  metadata; successful conflict resolution does not clear the global sync
  banner; import/export actors are one-shot across repeated workflows and
  navigation; import preview change counts/warnings are discarded; production
  causal merge bypasses the approved Automerge boundary; the required routed
  M5 E2E cases are absent; and configured lower-layer filters silently select
  zero tests. It also found two severity-3 defects: device callbacks use array
  positions instead of stable identities, and ordinary Known Devices renders
  raw ISO timestamps instead of the approved approximate last-seen format.
  The full verification command passed but is insufficient evidence for the
  missing selections; the handover contains the exact command matrix and
  file/line evidence. No source, test, plan, master, remote, deployment, or
  specification files were changed by the reviewer. Preserve the review
  worktree, branch, and handover; do not close or delete them as part of the
  fix wave.
- **R-500 bounded fix-wave dispatch:** The orchestrator must resolve the BLOCK
  in three disjoint worktrees, then rerun the full gate and dispatch a fresh
  read-only closure reviewer. S-402 causal owns `src/adapters/sync/**` and
  focused sync tests for generation adoption without resurrection,
  identity-safe same-field conflicts, and the approved Automerge production
  boundary. S-404 import/contract owns `src/adapters/import-export/**`,
  `src/actors/import-export/**`, `src/domain/import-export/**`, focused tests,
  and—only if required by the preview contract—`src/actors/contracts/types.ts`;
  it owns import generation gating and preservation of preview change counts,
  warnings, migrations, and errors. S-405 integration/UI owns
  `src/features/sync-portability-runtime.tsx`, the synchronization and
  conflict/import UI slices, local UI composition, app entry, and `e2e/**`;
  it owns the runtime Drive/auth boundary composition, conflict metadata and
  banner bridge, terminal actor lifecycle, stable device identity, last-seen
  formatting, and explicit routed E2E tasks. No worker may edit this plan,
  `master`, remotes, or another owner's files. Contract changes require the
  worker to document impact in its handover and the orchestrator to inspect
  all consumers before integration. If Drive auth wiring requires a new
  adapter/domain contract outside these ownership boundaries, pause that slice
  and record the exact boundary rather than making an uncontrolled cross-task
  change. The Automerge decision is an internal implementation correction and
  does not change user requirements or the deferred feature scope.
- **R-500 fix workers dispatched:** Socrates
  (`01a034a0-7c93-78c3-8cb8-b644f443010b`) owns S-402 causal/Automerge fixes
  in `~/git/worktrees/did-it-become-what-you-like-r500-s402-causal`, branch
  `fix/r500-s402-causal`, based at `bc3d827`; Tesla
  (`01a034a0-7f2e-70f2-8ad8-37256cad45c4`) owns S-404 import/preview-contract
  fixes in `~/git/worktrees/did-it-become-what-you-like-r500-s404-import`,
  branch `fix/r500-s404-import`, based at `bc3d827`; and Hubble
  (`01a034a0-81ca-7852-a1f0-f7fed8eb13d1`) owns S-405 runtime/UI/E2E fixes in
  `~/git/worktrees/did-it-become-what-you-like-r500-s405-ui`, branch
  `fix/r500-s405-ui`, based at `bc3d827`. All three are active, have disjoint
  write ownership, must preserve UTC progress handovers, and must return exact
  validation evidence with a scoped commit or an explicit BLOCK. Ramanujan's
  review agent is closed after its final BLOCK; its review worktree and
  handover remain preserved.
- **R-500 S-404 fix integration:** Tesla's final handover/reassertion at
  `2026-08-24T16:51:10Z` is `READY FOR INTEGRATION` and remains preserved at
  `~/git/worktrees/did-it-become-what-you-like-r500-s404-import/S-404-R500-progress.md`.
  The worker commit `58ca762` was inspected and cherry-picked into root as
  `909dfff` (`Fix S-404 generation adoption and preview fidelity`). The fix
  re-anchors higher-generation import roots, hides retired history from the
  wrapper's public read/export view, keeps replacement snapshots limited to
  the new generation, and carries `changeCount`, migrations, warnings, and
  blocking errors through the additive `ImportPreview` contract and actor
  projection. Its direct domain/adapter/actor suite passed `20/20`, actor
  contract tests passed `20/20`, and root `git diff --check` passed after the
  cherry-pick. The worker's full `deno task verify` evidence passed before
  integration; no UI, runtime, routed E2E, or live Drive check was claimed.
  The source integration commit is not yet pushed; the worker remains
  complete/preserved and S-402/S-405 remain active.
- **R-500 S-402 fix integration:** Socrates's final handover at
  `2026-08-24T16:51:40Z` is `READY FOR INTEGRATION` and remains preserved at
  `~/git/worktrees/did-it-become-what-you-like-r500-s402-causal/S-402-R500-progress.md`.
  The worker commit `db53832` was inspected and cherry-picked into root as
  `f536365` (`Fix S-402 causal generation and Automerge merge`). The fix makes
  higher-generation snapshots explicit replacement/adoption boundaries,
  carries record identity through same-field conflict creation, and uses one
  approved Automerge dataset boundary for same-generation field merging while
  retaining explicit application-level delete-vs-edit handling. Focused sync
  tests passed `9/9` after integration. The worker's full verification passed
  with repository/integration/component/domain/actor counts `137/20/56/29/1`,
  local E2E `2/2`, both builds, frozen audit, and diff check; the preserved
  Automerge proof passed `12/12`. The source integration commit is not yet
  pushed; S-402 and S-404 fixes are complete/preserved and Hubble's S-405
  fix remains active.
- **R-500 post-integration regression and recovery:** After Hubble's worker
  commit `13bc651` was cherry-picked as root `b423d9b`, the orchestrator ran
  the complete `deno task verify`. It exited `1` after `204` passed and `1`
  failed: `src/adapters/import-export/import-export.integration.test.ts`,
  higher-generation replacement adoption, observed the stale `expense-main`
  record in the exported replacement packet instead of an empty dataset. The
  source was not pushed from this failed integration checkpoint. The failure
  is an S-402 causal-port seam: the in-memory and Drive apply paths construct a
  higher-generation incoming snapshot with the current/remote dataset even
  though the replacement change payload carries the new dataset; the adoption
  branch therefore preserves stale data. Hubble's S-405 commit and handover
  remain preserved and are not marked released until this combined gate is
  green.
- **R-500 S-402 compatibility recovery dispatch:** Socrates
  (`01a034a0-7c93-78c3-8cb8-b644f443010b`) was resumed in the preserved
  `~/git/worktrees/did-it-become-what-you-like-r500-s402-causal` worktree to
  own only `src/adapters/sync/**` and focused sync tests. The worker must fix
  higher-generation dataset derivation for in-memory and Drive-backed causal
  ports, add a replacement-payload regression, rerun the S-402 and affected
  S-404 tests, and return a new UTC final handoff. No foreign source, plan,
  master, remote, or other worktree changes are allowed; the prior S-402
  commit remains integrated and the new commit must contain only the bounded
  compatibility fix.
- **R-500 S-402 compatibility recovery integration:** Socrates's final
  handover at `2026-08-24T17:26:07Z` is `READY FOR INTEGRATION` and remains
  preserved at `~/git/worktrees/did-it-become-what-you-like-r500-s402-causal/S-402-R500-progress.md`.
  The follow-up commit `65a1391` was inspected and cherry-picked as root
  `e6ee2cd` (`Fix higher-generation causal packet adoption`). A shared packet
  boundary now derives strictly higher-generation replacement datasets from
  validated head payloads for both in-memory and Drive-backed ports, rejecting
  missing or inconsistent replacement payloads as corrupt data while retaining
  the existing same-generation Automerge/delete-vs-edit path. Root focused
  validation passed import/export domain/adapter/actor `20/20`, sync `10/10`,
  and `git diff --check`; the previously failing higher-generation import
  regression now passes. The new source commit remains unpushed pending the
  full combined gate.
- **R-500 S-405 fix integration evidence:** Hubble's final handover at
  `2026-08-24T17:14:41Z` is `READY FOR INTEGRATION` and remains preserved at
  `~/git/worktrees/did-it-become-what-you-like-r500-s405-ui/S-405-R500-progress.md`.
  Its worker commit `13bc651` was inspected and cherry-picked as root
  `b423d9b` (`Fix S-405 sync runtime and routed journeys`). The nine-file
  slice adds runtime actor lifecycle/boundary wiring, complete conflict and
  preview projections, stable device callbacks and approximate last-seen
  formatting, repeatable workflows, routed deterministic fake-Drive and
  conflict E2E, and explicit nonzero selector coverage. Worker evidence
  passed the routed E2E `2/2`, full verify with `202/202` task tests,
  `61/61` integration, `64/64` component, `29/29` domain, `1/1` actor,
  local E2E `3/3`, both builds, frozen audit, and browser/a11y zero violations
  and incomplete checks across all four routes at 320, 390, and 1280 widths.
  Root release remains gated on the combined post-recovery verify; no live
  OAuth/Drive or Pages workflow was used.
- **R-500 recovered combined gate:** After integrating the S-402 packet-boundary
  follow-up as `e6ee2cd`, root `deno task verify` passed with `206` task tests,
  `65` integration tests, `64` component tests, `29` domain tests, `1` actor
  test, local E2E `3/3`, gallery/browser/Pages/CI/toolchain proofs, both
  production builds, frozen audit, and `git diff --check`. The explicit routed
  command `deno task test:e2e --grep 'drive-reconnect|conflict-resolution'`
  passed `2/2`; the exact lower-layer/component selector commands each passed
  their nonzero sentinel (`1 passed`, with `205`, `64`, and `63` filtered out
  respectively). The earlier 204-pass/one-failure integration regression is
  resolved by the S-402 follow-up. No live OAuth/Drive or hosted Pages action
  was used; the owner-disabled Pages workflow remains committed and untouched.
  The source and ledger commits are ready to push together, after which the
  orchestrator must dispatch a fresh read-only R-500 closure reviewer.
- **R-500 fresh closure review dispatch preparation:** The recovered source and
  ledger are pushed at `33ff45e`. A fresh read-only closure reviewer is assigned
  the preserved worktree `~/git/worktrees/did-it-become-what-you-like-r-500-closure-2`,
  branch `review/r-500-closure-2`, based at `33ff45e`. It may mutate only an
  untracked UTC `R-500-closure-2-progress.md` handover; it must independently
  inspect the complete S-401–S-405 implementation and all R-500 fix evidence,
  rerun the full gate plus the explicit routed E2E and lower-layer selector
  commands, audit the relevant specs/contracts and actual browser behavior,
  and finish with severity-counted `APPROVE` or `BLOCK`. No source, tests,
  contracts, adapters, plan, master, remotes, deployment settings, or earlier
  review/fix worktrees may be changed. Preserve this new review worktree and
  handover through closure.
- **R-500 fresh closure reviewer completed:** Lorentz
  (`01a034d6-012c-7c90-9be1-0b16f08f028a`) is the independent read-only
  reviewer in the prepared worktree and branch above. It was not reused from
  the blocked review; its final handover approves R-500 closure.
- **R-500 fresh closure review result:** Lorentz's final handover at
  `2026-08-24T17:52:29Z` is `APPROVE`, preserved at
  `~/git/worktrees/did-it-become-what-you-like-r-500-closure-2/R-500-closure-2-progress.md`.
  The independent review target was the pushed implementation at `c6787b9`
  (the later `1c50546` change was plan-only dispatch metadata); the review
  worktree remained read-only except for its handover. Severity totals are
  S1=0, S2=0, S3=1, S4=0. The sole S3 was the stale S-403 task status now
  corrected above; no implementation, security, architecture, UI/a11y, E2E,
  or evidence-blocking finding remains. The reviewer independently passed
  `deno task fmt:check` (190 files), `deno task lint` (175 files), `deno task
  check`, `deno task verify` (206 task, 65 integration, 64 component, 29
  domain, 1 actor, local E2E 3/3, builds, audit, Pages/CI/toolchain), routed
  fake-Drive/conflict E2E `2/2`, and the three exact selector commands with
  `1 selected` and `205`, `64`, and `63` filtered. Useful direct selectors
  routed real tests: Drive 11, schedules 8, convergence 1, import/export 10,
  conflict 23, and component sync 16. All four routes at 320x568, 390x844,
  and 1280x800 had no horizontal overflow and axe 0/0 violations/incomplete.
  Live OAuth/Drive, hosted Pages execution, and non-Chromium coverage remain
  unavailable and unclaimed. Preserve this reviewer worktree, branch, and
  handover; the reviewer is complete and must not edit the plan.
- **X-501 implementation dispatch preparation:** X-501 is dependency-ready
  after R-500 closure. The orchestrator will assign one worker in
  `~/git/worktrees/did-it-become-what-you-like-x-501-project-delete`, branch
  `task/x-501-project-delete`, based at the pushed root `6debf7c`. Ownership is
  limited to the populated-project deletion domain/service, concrete
  project-deletion actor wiring, Screen 7A composition in `src/features/local-ui.tsx`
  and its CSS/tests, plus focused tests. The worker must reuse the locked
  `src/actors/contracts/deletion.ts` protocol and existing local/import/sync
  ports; no Delete Everywhere, disconnect, global generation erase, unrelated
  settings, or plan/master/remote changes are in scope. The root is the sole
  integration owner; merge order is worker commit, focused root checks, then
  the X-501 gate before X-502 is released.
- **X-501 worker active:** Helmholtz
  (`01a034eb-d991-77b2-86ac-7dc039515aa0`) owns the bounded populated-project
  deletion implementation in
  `~/git/worktrees/did-it-become-what-you-like-x-501-project-delete`, branch
  `task/x-501-project-delete`, based at `6debf7c`. Its write set is the
  project-deletion domain/actor implementation, Screen 7A local UI/CSS, and
  focused tests; the locked deletion contract, Delete Everywhere/disconnect,
  sync causal merge, import/export adapter internals, plan, master, remotes,
  and unrelated settings are excluded. Preserve its UTC `X-501-progress.md`
  handover and worktree; the orchestrator remains integration owner.
- **R-200 reopened fix dispatch plan:** D-102 will own only
  `src/actors/contracts/**` in `~/git/worktrees/did-it-become-what-you-like-d-102-actors`
  for shaped-error canonicalization and retryable sync tags/transitions, with
  actor regression tests. U-104 will own only `src/design-system/**` in
  `~/git/worktrees/did-it-become-what-you-like-u-104-design-system` for the
  nested-label fix and regression test. D-103 is a coordination reviewer for
  the adapter boundary, not a parallel source owner unless the fix exposes a
  concrete adapter defect. Both workers must maintain untracked timestamped
  progress handovers, never edit this plan, and never push `master`.
- **R-200 reopened fix workers completed:** Boyle
  (`01a03163-2a56-75e1-9686-cea9f6ebe884`) owns D-102 in
  `~/git/worktrees/did-it-become-what-you-like-d-102-actors`; Anscombe
  (`01a03163-2b5a-7af1-ab87-b69cf65a0796`) owns U-104 in
  `~/git/worktrees/did-it-become-what-you-like-u-104-design-system`. Their
  ownership was disjoint; both completed with timestamped handovers and no
  plan or `master` changes. D-103 coordination remains with the integration
  owner. Preserve both worktrees and handovers for the fresh closure review.
- **Historical D-103 dispatch record:** Dewey previously owned the active
  adapter fix in
  `~/git/worktrees/did-it-become-what-you-like-d-103-adapters`, limited to
  `src/adapters/ports/**` and focused tests. The worktree was clean before
  dispatch; the worker kept `D-103-progress.md` untracked and left this plan
  and `master` untouched.

Every checkpoint update must record completed, active, and interrupted task IDs;
integrated and unpushed commit hashes; verification commands/results; active or
preserved worktrees/agents; unresolved findings or blockers; recovery notes when
applicable; and the exact next dependency-ready task or recovery action.

## Ready-to-Use Orchestration Prompt

```text
Act as the implementation orchestrator for this repository. Use
gpt-5.6-luna with xhigh reasoning for the orchestrator and for bounded workers
and independent reviewers when available and useful.

Before changing anything:
1. Read IMPLEMENTATION_PLAN.md completely.
2. Reconcile its Current Checkpoint with the actual branch,
   origin, commits, worktrees, files, and test results. Actual repository state
   wins; update the ledger if stale. If any prior session, machine, push, or
   worker was interrupted—or the state does not match exactly—execute the full
   Interruption and Recovery Protocol before editing or dispatching. Preserve
   all uncommitted/unintegrated work.
3. Read AGENTS.md, SPEC.md, UI_SPEC.md, DESIGN_SYSTEM.md, README.md, and every
   applicable skill instruction completely before selecting or changing a task.
4. Confirm that the owner has explicitly authorized implementation. If not,
   stop without implementing.

Then continue until the Definition of Done or a genuine owner decision is
required:
- Select only dependency-ready tasks. Use at most three sub-agents concurrently
  and only for disjoint ownership listed in the plan. Create recorded worktrees
  only when isolation is materially useful.
- Give every worker one bounded task ID, authoritative requirements, owned files
  and locked contracts, non-goals, exact acceptance criteria, tests, and commit
  expectation. Workers must not edit the ledger or push/merge master.
- Integrate as sole owner in the recorded order. Inspect every diff, run the
  task's checks, keep tests with behavior, update the checkpoint, make focused
  commits, and push master after each completed task or small inseparable group.
- At every R-* gate, dispatch a fresh independent Luna xhigh reviewer read-only
  first. Convert substantiated findings into scoped fixes with regression tests,
  rerun the complete gate including agent-browser visual/a11y checks where
  applicable, then push before releasing downstream tasks.
- For a long-running worker or reviewer, apply the Long-Running Worker and
  Review Progress Protocol. Prefer timestamped parent progress messages when
  the child toolset truly supports them; otherwise create the recorded
  untracked progress markdown in its dedicated `~` worktree and inspect it at
  each bounded wait.
- Prefer unit/domain, XState actor, adapter integration, and component tests.
  Keep E2E to the five approved browser journeys and use a proper E2E dependency,
  not agent-browser, for pass/fail assertions. Use agent-browser separately for
  Chromium visual, interaction, accessibility-tree, and axe inspection.
- Never add deferred scope, live credentials to CI, a backend, destructive Git
  operations, force-pushes, or contract changes without the required recorded
  approval. Never claim unavailable cross-browser checks were performed.

If blocked by a real owner decision, preserve and push all safe completed work,
record the exact blocker and next possible task in IMPLEMENTATION_PLAN.md, and
ask one concise numbered decision batch. Otherwise keep advancing the graph.
If interrupted by a rate limit, session loss, machine restart, failed push, or
worker disappearance, do not call it a product blocker: preserve the work,
record `INTERRUPTED` state when possible, and make the next session begin with
the Interruption and Recovery Protocol.
```
