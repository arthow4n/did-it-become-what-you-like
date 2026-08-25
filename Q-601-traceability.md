# Q-601 completeness traceability audit

Audit base: b440222 (worker branch tip at audit start: 3971334; branch metadata
commit is pre-existing). Scope is limited to the approved UI requirements in
UI_SPEC.md, SPEC.md, and DESIGN_SYSTEM.md.

Baseline evidence before Q-601 edits:

- deno task verify — exit 0.
- Component/a11y coverage: 81 component tests passed; gallery native
  screenshot/tree/axe verification passed at the three required viewports.
- Local browser smoke: 4/4 passed; production build and audit passed.
- Existing build warning only: Vite reports a large generated application chunk
  and Automerge WASM asset; no validation failure.

## Approved screen matrix

| Approved requirement                          | Actual composition                                                                                                    | Tests/evidence                                                     | Disposition                                                                                     |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| First use — UI_SPEC.md:130-177                | src/features/local-ui.tsx:FirstUseScreen, mounted by LocalUiRuntime                                                   | src/features/local-ui.test.tsx first-use entry-path test           | Complete                                                                                        |
| 1 Expenses — UI_SPEC.md:181-245               | ExpensesScreen with PageHeader, ProjectPicker, filters, totals, breakdown, lists, empty/offline/conflict shell states | local UI expenses test; baseline component/gallery/browser checks  | Complete                                                                                        |
| 2 Add choice — UI_SPEC.md:247-276             | AddChoiceScreen in local UI overlay with manual/AI actions and offline notice                                         | local UI offline/focus tests                                       | Complete; custom overlay retained as existing approved composition                              |
| 3 Manual — UI_SPEC.md:280-331                 | ManualExpenseScreen actor-backed ExpenseForm, draft/save/retry/discard actions                                        | local UI typed submit, dirty-navigation, recovery tests            | Complete                                                                                        |
| 4 Scan — UI_SPEC.md:333-405                   | ReceiptScanScreen with ReceiptSourcePicker, Gemini setup/model/test, workflow progress and sticky actions             | receipt UI disclosure/source/model/cleanup tests                   | Complete                                                                                        |
| 5 Review — UI_SPEC.md:407-459                 | ReceiptReviewScreen with metadata, reconciliation, line editor, uncertainty/error/save states                         | receipt UI line/review tests; actor-backed review composition      | Complete                                                                                        |
| 6 Organize — UI_SPEC.md:461-499               | OrganizeScreen sections and preview rows                                                                              | local UI organize test                                             | Complete                                                                                        |
| 7 Projects — UI_SPEC.md:501-540               | ProjectManager plus actor-backed project editor, ordering, archive and confirmation                                   | local UI project manager test                                      | Fixed in Q-601: editor now uses level-one heading and searchable ISO CurrencyPicker             |
| 7A populated deletion — UI_SPEC.md:541-565    | ProjectDeletionReview with safety export, typed confirmation, progress/failure/retry                                  | local UI populated-project-delete test; destruction actor coverage | Complete                                                                                        |
| 8 Categories — UI_SPEC.md:567-613             | CategoryManager with search, archive/reorder, ColorChoiceField, shared DeleteAndReassign                              | local UI category tests; design-system component tests             | Fixed in Q-601: editor heading, custom color, selectable replacement and affected-count preview |
| 9 Settings — UI_SPEC.md:615-652               | SettingsScreen settings list and local-settings notice                                                                | local UI settings test; runtime summary callback                   | Fixed in Q-601: six approved groups, unique accessible action names, live sync/Gemini summaries |
| 10 Drive/synchronization — UI_SPEC.md:654-700 | SyncPortabilityRuntime and GoogleDriveSyncScreen / SyncAccountPanel                                                   | sync UI and runtime tests                                          | Complete                                                                                        |
| 10A conflicts — UI_SPEC.md:702-746            | ConflictReviewScreen master/detail, candidate resolver and actor-derived progress                                     | conflict/import component and runtime tests                        | Complete                                                                                        |
| 10B devices — UI_SPEC.md:748-782              | KnownDevicesScreen / KnownDeviceList with rename, retirement acknowledgement and diagnostics disclosure               | sync UI device tests                                               | Complete                                                                                        |
| 11 Gemini settings — UI_SPEC.md:784-831       | GeminiSettingsScreen with SecretField-equivalent quick setup, model picker, switch and configuration test             | receipt UI Gemini tests; runtime local secret boundary             | Complete; typed adapter error copy remains redacted by boundary                                 |
| 12 Import/export — UI_SPEC.md:833-886         | ImportExportScreen export/import panels, preview, merge/replace safety workflow                                       | conflict/import component and runtime tests                        | Complete                                                                                        |
| 13 Preferences — UI_SPEC.md:888-925           | PreferencesScreen actor-backed native time field, example, dirty/save/retry/discard                                   | settings PWA preference tests                                      | Complete                                                                                        |
| 14 Data/privacy — UI_SPEC.md:927-977          | DataPrivacyScreen local/disconnect/everywhere scopes, safety export, device acknowledgement and forced finalization   | destruction UI and actor tests                                     | Complete                                                                                        |
| 15 About — UI_SPEC.md:979-1014                | AboutScreen disclosure, privacy, licenses, source and update/install states                                           | settings PWA About/update tests                                    | Complete                                                                                        |

## Shared mapping and checklist audit

The approved mapping in DESIGN_SYSTEM.md:227-250 was checked against the screen
paths above and the shared exports in src/design-system/components.tsx. The
following concrete mismatches were found and fixed:

| ID / severity       | Evidence                                                                                                                                                                                                                                 | Disposition                                                                                                                                                                                                                         |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q-601-UI-01 / S2    | local-ui.tsx project editor previously used a six-code SelectField; SPEC.md:169-174 says project currency is a default and may contain multiple currencies; DESIGN_SYSTEM.md:207 requires searchable ISO currency                        | Replaced with shared CurrencyPicker, preserving the existing controlled actor command                                                                                                                                               |
| Q-601-UI-02 / S2    | local-ui.tsx category deletion previously sent replacementCategoryId: category-uncategorized and the dialog had no selection/count; UI_SPEC.md:604-607 requires explicit replacement, default Uncategorized, and affected-record preview | Added shared DeleteAndReassign; screen passes active/built-in options, default, affected expense count, and actor callback                                                                                                          |
| Q-601-UI-03 / S3    | Project/category editor PageHeaders omitted headingLevel; focused screen checklist requires an identifiable application heading (UI_SPEC.md:1129-1139)                                                                                   | Added headingLevel=1 and regression coverage                                                                                                                                                                                        |
| Q-601-UI-04 / S2/S3 | Settings previously rendered seven rows including direct Conflict Review, generic repeated Open names, and static Not connected; UI_SPEC.md:642-647 approves six groups and live summaries                                               | Removed extra row, added unique accessible names, and pass actor/runtime-derived sync and device-local Gemini summaries                                                                                                             |
| Q-601-DS-01 / S3    | DESIGN_SYSTEM.md:167 promises ColorChoiceField presets/custom value; implementation exposed presets only                                                                                                                                 | Added accessible native custom-color control and tokenized layout styling; category editor consumes the shared component                                                                                                            |
| Q-601-UI-05 / S2    | Final agent-browser matrix found `page-has-heading-one` on the transient `/expense/new` loading/recovery composition and empty `/receipt/review` composition at all three required viewports                                             | Added level-one PageHeader coverage to LoadingScreen/manual recovery and receipt review closed/empty states; regressions live in `src/features/local-ui.test.tsx` and `src/features/receipt-ui.test.tsx`; final matrix is axe-clean |

All other screen checklist items were found represented by existing
compositions: purpose/entry-exit, visible approved actions, compact and wide
layouts, relevant empty/loading/offline/error/conflict/destructive states,
keyboard labels/focus and touch targets, and focused component/actor/browser
evidence. The final three-viewport agent-browser matrix covered 18 approved hash
routes at 320x568, 390x844, and 1280x800 (54 runs), with snapshots, PNG
screenshots, and axe reports for every run; the aggregate was 0 violations and
all routes had equal document and viewport widths.

## Final verification evidence

- `deno task fmt:check`, `deno task lint`, and `deno task check` — exit 0.
- Focused component tests — local UI 17/17, receipt UI 8/8, shared composite
  1/1; complete `deno task test:component` 86/86.
- `deno task build` and `deno task gallery` — exit 0; existing large-chunk
  warnings only.
- `deno task verify` — exit 0 on clean retry: unit 250, integration 72,
  component 86, domain 37, actor 1, approved local E2E 4/4, gallery a11y,
  browser smoke, Pages, CI, toolchain proof, build, frozen audit, and
  `git diff --check`.
- `deno task gallery:verify` — unavailable because no such task is defined;
  `deno task a11y:gallery` is the canonical current gallery a11y check and
  passed inside `verify`.

## Cross-cutting state matrix

| Approved state (UI_SPEC.md:1016-1028)                                 | Evidence                                                                             | Disposition |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ----------- |
| First use / empty                                                     | FirstUseScreen, EmptyState in expenses, categories, projects, devices and conflicts  | Complete    |
| Loading / local saving                                                | shell loading, actor Progress/WorkflowProgress, form DraftStatus and pending buttons | Complete    |
| Offline / reconnecting                                                | shell banner, sync/import/conflict/receipt notices and actor network events          | Complete    |
| Syncing / conflict / retryable error / retired                        | sync status projection and conflict card/resolver                                    | Complete    |
| AI preparation / request / invalid output / retry                     | receipt scan actor phases, validation, retry/change/manual actions                   | Complete    |
| Validation / unsaved / cancellation                                   | ErrorSummary, field errors, dirty exit guard, workflow cancel actions                | Complete    |
| Import preview / replacement warning / migration failure              | preview counts/warnings/errors and safety export/online pre-sync gates               | Complete    |
| Deletion pending / awaiting devices / finalized / forced finalization | destruction actor projection and DataPrivacyScreen workflow                          | Complete    |

## Deferred exclusions

No deferred feature was implemented. Explicitly out of Q-601 scope are the
approved/deferred items already excluded by the specs: cross-currency
conversion/reporting totals, charts, separate desktop table product, light
theme, brand illustration/custom iconography/downloaded fonts, additional
density modes, new backend behavior, live credentials, and unapproved navigation
or E2E journeys. The direct Settings Conflict Review shortcut was removed; its
approved entry paths remain the Expenses banner and Drive screen.
