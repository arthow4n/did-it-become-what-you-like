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

- **Status/dependencies:** `BLOCKED`; depends on `P-000` and explicit owner
  implementation authorization. Change to `READY` only after both are true.
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

- **Status/dependencies:** `BLOCKED`; depends on `P-000` and explicit owner
  implementation authorization; may run parallel with `F-001` and `F-003` after
  both conditions are true.
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

- **Status/dependencies:** `BLOCKED`; depends on `P-000` and explicit owner
  implementation authorization; may run parallel with `F-001` and `F-002` after
  both conditions are true.
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

- **Status/dependencies:** `PENDING`; depends on `F-001`, `F-002`, `F-003`.
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

- **Status/dependencies:** `PENDING`; depends on `F-001`, `F-003`, `F-004`.
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

- **Status/dependencies:** `PENDING`; depends on `F-004`, `F-005`.
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

- **Status/dependencies:** `PENDING`; depends on `R-100`.
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

- **Status/dependencies:** `PENDING`; depends on `D-101`, `F-005`; may run in
  parallel with `D-103` and `U-104` after `D-101`.
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

- **Status/dependencies:** `PENDING`; depends on `D-101`, `F-005`; parallel with
  `D-102` and `U-104`.
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

- **Status/dependencies:** `PENDING`; depends on `R-100`, `D-101`; may run in
  parallel with `D-102` and `D-103` after the canonical domain types exist.
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

- **Status/dependencies:** `PENDING`; depends on `D-101`, `D-102`, `D-103`,
  `U-104`.
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

- **Status/dependencies:** `PENDING`; depends on `R-200`.
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

- **Status/dependencies:** `PENDING`; depends on `L-201`, `D-102`.
- **Ownership:** project/category domain services, actors, selectors; no screens
  except headless actor fixtures.
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

- **Status/dependencies:** `PENDING`; depends on `D-101`, `L-201`; may overlap
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

- **Status/dependencies:** `PENDING`; depends on `L-202`, `L-203`, `D-102`.
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
- **Verification:** `deno task test --filter 'manual-expense|shell-actor'`;
  `deno task test:integration --filter manual-save`; `deno task check`.

#### L-205 — Deliver the complete local browsing and organization UI slice

- **Status/dependencies:** `PENDING`; depends on `L-202`, `L-204`, `U-104`.
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
- **Verification:** `deno task test:component --filter local-ui`;
  `deno task test:e2e --grep local-first-manual`; agent-browser screen matrix at
  three viewports; `deno task a11y`.

#### R-300 — Local vertical-slice independent review gate

- **Status/dependencies:** `PENDING`; depends on `L-205`.
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

- **Status/dependencies:** `PENDING`; depends on `R-200`, `F-003`; may
  begin after `R-200` in parallel with M3 where ownership is disjoint.
- **Ownership:** `src/adapters/gemini/**`, image utilities and structured Gemini
  schema mapping; no receipt actor/UI.
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
- **Verification:** `deno task test --filter 'gemini|image-preparation'`;
  `deno task test:integration --filter gemini-fake`; CSP/network inspection.

#### A-302 — Implement receipt scan/review actors and atomic receipt domain flow

- **Status/dependencies:** `PENDING`; depends on `A-301`, `L-201`, `L-202`,
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

- **Status/dependencies:** `PENDING`; depends on `A-302`, `L-205`, `U-104`.
- **Ownership:** Screens 4, 5, and 11 plus their feature composition; no adapter
  internals or schema changes.
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

- **Status/dependencies:** `PENDING`; depends on `A-303`, `R-300`.
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

- **Status/dependencies:** `PENDING`; depends on `R-200`, `F-003`; may begin
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

- **Status/dependencies:** `PENDING`; depends on `S-401`, `L-201`, `D-102`.
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

- **Status/dependencies:** `PENDING`; depends on `S-402`, `D-102`.
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

- **Status/dependencies:** `PENDING`; depends on `D-101`, `L-201`, `S-402`.
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

- **Status/dependencies:** `PENDING`; depends on `S-402`, `S-403`, `S-404`,
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

- **Status/dependencies:** `PENDING`; depends on `S-405`, `R-400`.
- **Ownership:** review read-only first; fixes scoped to S-task owners.
- **Scope/non-goals:** adversarially review causal convergence, Drive security,
  retirement checks, device semantics, conflict resolution, import/replace
  safety, offline honesty, and UI/actor separation. E2E is not used to substitute
  for schedule-level integration evidence.
- **Outputs/acceptance:** no high/medium finding; seeded multi-device suites pass
  repeatedly; no credential/log leakage; fake Drive E2E remains narrow.
- **Tests:** all M5 tests, reordered/failing transport schedules, corrupt imports,
  account switching, restart at every durable workflow stage.
- **Verification:** `deno task verify`; approved E2Es; agent-browser M5 audit.

### M6 — Destructive Workflows and PWA Completion

#### X-501 — Implement populated-project deletion

- **Status/dependencies:** `PENDING`; depends on `R-500`, `L-202`.
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
worktrees outside the repository directory. Record absolute worktree path,
branch, base commit, assigned files/contracts, agent, and expected merge order
in the Current Checkpoint before dispatch.

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

- **Plan state:** documentation planning only; application implementation is
  explicitly unauthorized in this session.
- **Branch/upstream at draft creation:** `master`, tracking `origin/master`.
- **Last approved pre-plan commit:** `179d180` (`Define browser and verification
  boundaries`).
- **Draft plan commit:** `e9e0822` (`Add executable implementation orchestration
  plan`).
- **Completed implementation tasks:** none. No implementation worktree, spike,
  dependency setup, or application source has been started.
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
- **Current task:** none. Planning and coherence review are complete.
- **Next dependency-ready work after owner authorization:** `F-001`, `F-002`,
  and `F-003`, with the orchestrator assigning disjoint worktrees and prioritizing
  integration in that order.
- **Known technical gates, not owner ambiguities:** exact pinned dependencies and
  E2E invocation (`F-001`); Automerge proof (`F-002`); Google/image/PWA browser
  proof (`F-003`); exact agent-browser binary/Chromium pins (`F-005`).
- **Blocker:** explicit owner authorization in a new implementation session.

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
