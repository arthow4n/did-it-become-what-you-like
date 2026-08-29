# Application Specification

## Status and Decision Language

This document is the starting point for the application specification. Product
requirements, user experience, and implementation details will be refined only
after discussion and agreement. Implementation must not begin until the repo
owner explicitly approves the specification.

After product and screen decisions are complete, the project must define and
approve the shared `DESIGN_SYSTEM.md` before planning UI implementation. It must
then turn the approved specifications into dependency-ordered milestones,
identify prerequisites and safe parallel workstreams, and attach verification
criteria. Neither design-system work nor milestone planning constitutes approval
to begin application implementation.

The terms in this document have the following meanings:

- **Required**: agreed direction.
- **Provisional**: captured from the current discussion but not yet settled.
- **Open**: a decision that still needs to be made.

## Product Summary

The application is a personal expense tracker for the repo owner. It should make
everyday entry and review of expenses fast, work especially well on a phone, and
keep its data in simple formats that remain easy to inspect and analyze outside
the application.

The device-local copy is the primary working copy. Core entry and review flows
should remain available offline, while Google Drive provides automatic backup
and multi-device synchronization according to the agreed sync design.

## Product Principles

- **Local first:** local work must not wait for a network service.
- **Portable data:** records remain inspectable and exportable in plain,
  documented formats.
- **Private by default:** no analytics, advertising, session replay, or
  unrelated transmission of financial data.
- **Low-friction entry:** adding and correcting expenses is the primary mobile
  interaction.
- **Accessible and responsive:** core flows must support touch, keyboards,
  assistive technology, narrow screens, and desktop screens.
- **Progressive enhancement:** the browser experience must remain usable without
  installing the PWA.

## User Needs and Usage

- Expense capture must fit several real-life moments:
  - immediately after a purchase, commonly by scanning its receipt or invoice;
  - manually later the same day; and
  - processing multiple expenses in a later session.
- The application is primarily a trustworthy record for later reflection, not a
  tool that must provide an immediate response after every entry.
- The owner wants to return later and answer questions such as:
  - how much was spent on a particular day, month, or year; and
  - how much was spent in each category during that period.
- The owner currently uses a similar expense application, but it is simpler and
  requires more manual work. Fast invoice-assisted capture and richer review
  should reduce that friction without making ordinary manual entry complicated.
- The product name is philosophical. It does not imply a feature for rating or
  judging whether individual purchases were worthwhile.
- The essential review experience is expense lists and spending totals broken
  down by category and selected day, month, or year.
- Comparisons and trends between periods are not required for the initial
  release. They are possible future enhancements, so the data model must retain
  clean historical fields and must not prevent adding them later.
- Although general income tracking is not required initially, the monetary data
  model must represent both outgoing expenses and money returned to the owner.
  It must not assume that every recorded amount has the same direction.

## Required Product Capabilities

### Expense Entry and Organization

- An expense must support at least:
  - date;
  - amount and currency; and
  - category.
- An expense may additionally contain:
  - merchant/shop; and
  - description.
- A standalone manually created expense may have an empty description. A saved
  receipt purchase or adjustment line instead requires a non-empty line
  description so an expanded receipt remains understandable.
- Merchant/shop and description are separate optional fields. Merchant/shop
  should preserve the exact merchant branch or location when known rather than
  reducing it to only a generic chain name.
- Calendar date is required. Time-of-day is optional and should be preserved
  when entered manually or extracted from a receipt so same-day records can be
  ordered more accurately.
- Application preferences must include a configurable local **expense-day
  boundary** for automatic manual-entry dates. For example, with a boundary of
  03:00, a new form opened at 01:30 defaults to the previous calendar date,
  matching the owner's lived day after returning home past midnight.
- The boundary uses the device's current local wall-clock time and timezone when
  a new manual form opens, including while travelling. Its native time input
  must show a live example with concrete dates.
- The expense-day boundary affects only the initial date suggested for a new
  manual expense. It must not rewrite a date explicitly chosen by the owner or a
  transaction date extracted from a receipt or supplied by import. The form must
  display the resulting concrete calendar date so the offset is never hidden
  behind only a relative label such as “Today.” Once stored, the calendar date
  is stable and must not change when the device enters another timezone.
- Monetary amounts follow their natural direction from the owner's perspective:
  purchases and other outflows are negative, while discounts, refunds, cashback,
  bottle-deposit returns, and other inflows are positive. A bottle-deposit
  charge printed beside purchased goods (for example, `PANT BURK 2,00`) is an
  adjustment outflow and is negative; only an explicit return/refund or a
  printed negative deposit is an inflow. This sign convention must also support
  possible future income records without a data migration that reverses
  existing meanings.
- Monetary amounts, quantities, and unit prices must be persisted as canonical
  decimal strings, never as JavaScript `Number` values or implicit integer minor
  units. Examples include `"-10.99"` for an outflow and `"1.25"` for a quantity.
- Canonical decimal strings represent mathematical value rather than entered
  formatting: redundant leading/trailing zeros are normalized, so `"10.90"` may
  persist as `"10.9"`. Currency-aware display formatting restores the
  appropriate presentation.
- All arithmetic over persisted decimal values must use a pinned
  arbitrary-precision decimal library. `big.js` in strict mode is the
  provisional default because it is small, browser/Deno compatible, and can
  reject accidental primitive-number inputs. Native JavaScript Decimal may
  replace it only after that proposal is standardized and supported by the
  agreed browser baseline.
- Categories must be fully customizable.
- A built-in `Uncategorized` category must always exist. It behaves as the
  fallback category for entries which have not been classified and cannot be
  renamed, archived, reordered, or deleted through category management.
- Categories are shared globally across projects because the owner generally
  uses the same category set in every context. Switching projects isolates
  expense views but does not create a separate category catalogue.
- Active categories have a global custom order used by manual pickers and the
  Gemini category catalogue. A category requires a case-insensitively unique
  trimmed active name, may have an optional color which is never its sole
  identifier, and does not require an icon in the initial release.
- Archiving a category preserves historical relationships while excluding it
  from new-entry and Gemini choices. Empty custom categories can be deleted.
  Deleting a used category requires atomic reassignment of all references across
  all projects to an explicitly selected replacement, defaulting to
  `Uncategorized`, followed by a synchronized tombstone for the old category.
- A deleted-category tombstone retains its replacement category ID so a late
  offline expense referencing the deleted ID is deterministically redirected
  rather than resurrecting the category or retaining a broken reference.
- Categories and projects must have stable immutable IDs. Expenses reference
  `categoryId` and `projectId`, never mutable display names, so renaming a
  category or project cannot break or rewrite relationships.
- The expense view must support filtering by:
  - day, month, and year; and
  - category.
- **Today**, **This month**, and **This year** mean the corresponding current
  local calendar period. Custom selection chooses one specific calendar day,
  month, or year. Rolling periods such as “last 30 days” are not part of the
  initial release.
- Day, month, and year filters operate directly on each record's stored calendar
  date; they do not reinterpret those dates across timezones.
- Within the currently selected project, a period can be combined with one
  category, one currency, merchant/description text search, and an optional
  amount range. The expense list, category breakdown, and totals all use this
  same combined filter state.
- Expense lists default to newest first using stored calendar date followed by
  optional time-of-day. The initial release also offers oldest first, uses a
  deterministic stable tie-breaker, and does not add other sort modes.
- Multiple currencies must be supported.
- The application must support multiple user-defined projects.
- Each project represents a distinct life or travel context whose expenses
  should not be mixed in ordinary views. Examples include the owner's former
  life in Taiwan, current life in Sweden, or an individual trip to another
  country.
- A project must have a default/local currency so expenses can be recorded
  naturally in the currency of that context without requiring immediate
  conversion to a common reporting currency.
- The project currency is a default, not a restriction. An individual entry may
  override it, and one project may contain entries in multiple currencies.
- Every expense belongs to exactly one project, defaulting to the currently
  selected project while remaining manually changeable.
- The application must persist the most recently selected project and reopen
  that project on the next launch.
- Normal expense lists, filters, and totals are scoped to the selected project.
  Entries from other projects remain hidden until the user switches projects.
- Project archival is reversible and preserves every related record while hiding
  the project from ordinary switching. Deleting an empty project removes only
  that project after confirmation, and at least one active project must remain.
- Deleting a populated project follows the approved Screen 7A workflow: offer a
  complete JSON safety export, require strong confirmation, and atomically
  create synchronized tombstones for the project and every expense, receipt
  parent, receipt line, adjustment, and derived index entry belonging to it.
  Global categories, other projects, their records, the Gemini key, and
  unrelated settings remain unchanged.
- Populated-project deletion is logical synchronized deletion, not physical
  privacy erasure from Automerge history. Physical destruction of the complete
  dataset generation and history remains exclusive to Delete Everywhere.
- Domain-level tags are not part of the initial release. They may be added later
  if a concrete cross-project labeling need emerges. Stable record identifiers
  must allow this extension without redesigning existing data.
- Creating, viewing, editing, and deleting an expense offline are required
  baseline behaviors and use the same validation, ordering, deletion, and undo
  rules as online local operations.

### Invoice-Assisted Entry

- The application must provide LLM-assisted entry from a scanned or photographed
  invoice.
- The PWA must support both capturing a new receipt image with the device camera
  and selecting/importing an existing image from the device.
- The LLM should produce draft expense entries for the relevant items on the
  invoice to reduce manual entry.
- The future extraction prompt and review model must request and preserve the
  most specific merchant/shop identity visible on the receipt, including its
  branch or location when available.
- The AI must suggest a category for every extracted item using only the owner's
  existing category catalogue.
- The AI must never create categories. When no existing category can be chosen
  confidently, it must use `Uncategorized` for the draft.
- A scanned receipt or invoice must produce a separate draft entry for every
  purchased line item rather than only one entry for the receipt total.
- Extracted discounts, refunds, cashback, bottle-deposit returns, and similar
  credits must be retained when present. Bottle-deposit charges must also be
  retained as signed adjustment outflows when they appear on the receipt. These
  adjustments must not be discarded or forced into the same semantics as an
  ordinary expense.
- The owner's previous application required folding discounts into an item's
  final price. This was a tool limitation rather than a preferred model. A
  receipt instead contains purchase lines and signed adjustment lines which sum
  to its total.
- An adjustment may refer to a particular item when that relationship can be
  determined confidently. Linking is optional: receipt-wide or otherwise
  ambiguous adjustments must remain valid without an item link.
- A receipt is a logical parent record. Its initial fields are merchant/shop,
  project, calendar date, optional time-of-day, currency, and the printed
  receipt total. Payment method, address, receipt number, and separate tax/VAT
  fields are excluded from the initial model. Each purchased item or adjustment
  has its own stable record and identifier referencing the receipt. Records must
  remain independently editable and mergeable rather than requiring every
  receipt change to replace one large nested object.
- A receipt parent belongs to the same single project as all of its lines and
  carries a stable `projectId`; one receipt cannot span projects.
- Receipt time-of-day is stored once on the parent. Its lines inherit that time
  for display and ordering and do not duplicate an independently editable time.
- Every saved receipt purchase or adjustment line requires a non-empty
  description. An AI line whose identity is unreadable or too incomplete to
  satisfy that rule starts unselected in review and explains the issue; the
  owner may correct and select it before saving.
- A purchased-item line should preserve quantity, unit price, and line total
  when that information is available from manual entry or receipt extraction.
- The merchant-printed line total is authoritative when it differs from the
  mathematical product of quantity and unit price. The source quantity and unit
  price remain preserved, and the discrepancy may be shown during review.
- Tax/VAT is not stored as a separate value for the initial consumer use case;
  recorded prices are treated as tax-inclusive.
- A tip shown on a receipt must be retained as an outgoing expense line rather
  than discarded or treated as tax.
- Receipt images are ephemeral inference inputs only. They must not be retained
  in IndexedDB, synchronized to Google Drive, or included in exports. Any
  temporary in-memory or browser-managed copy must be released after inference
  succeeds, fails, or is cancelled.
- Generated entries must be presented for user review and correction before they
  are saved. The review must show all entries about to be created and allow the
  owner to add missing lines, edit AI-generated values, and remove incorrect
  lines.
- Once structured extraction has passed browser validation, its review draft and
  focused workflow snapshot must persist device-locally in IndexedDB so an
  accidental reload does not lose completed inference work. The structured draft
  is cleared on Save or explicit discard and is neither synchronized nor
  exported as an accepted record before Save. The source image remains strictly
  ephemeral and must never enter the persisted snapshot.
- Saving a reviewed receipt must commit its parent record and all accepted lines
  atomically. A failure must leave none of that receipt partially saved.
- The extracted receipt total must be checked against the sum of its draft
  purchase and adjustment lines. A mismatch must be clearly warned about, but
  the owner may explicitly confirm and save despite the mismatch.
- Extraction results must identify uncertain fields, inconsistencies, and other
  potential issues, with a useful explanation rather than silently inventing a
  confident value.
- AI-assisted receipt scanning requires an internet connection. When offline,
  the application must explain that scanning is unavailable while keeping manual
  entry fully usable. It must not retain or queue a selected receipt image for
  later submission.
- `@google/genai`, used with a Google AI Studio API key, is the provisional
  default SDK and service for this feature.
- The owner chooses which compatible Gemini model performs receipt extraction.
  The application must use the SDK's model-listing API to refresh models
  available to the entered API key rather than permanently hard-coding one model
  name. It should recommend a suitable stable, fast model by default while
  allowing the owner to select another compatible model. The picker must provide
  type-ahead search because the returned list may be long.
- A model appearing in the API's list is not sufficient proof that it supports
  every required receipt feature or that it has free-tier quota. The model
  picker must identify or validate support for image input, content generation,
  and the required structured-output schema, explain incompatibility clearly,
  and recover when a previously selected model is removed or deprecated.
- Receipt extraction must use Gemini's schema-constrained structured output, not
  parse an unconstrained prose response. The response schema must be versioned,
  cover the agreed receipt parent, lines, uncertainty, and mismatch information,
  and be validated again in the browser before review data is accepted.
- Runtime validation and static types must share a maintainable source of truth.
  Zod 4 is the provisional validator when a schema library is useful; Zod 3 must
  not be introduced. JSON Schema sent to Gemini and the corresponding runtime
  validator must be generated from one definition where practical, or otherwise
  be tested to remain equivalent. No type assertion may substitute for
  validating model output.
- Receipt-image resizing and compression are enabled by default to reduce upload
  size and latency while preserving text readability. The owner may disable this
  preparation in settings and send the selected image unchanged. Preparation
  happens only in memory, and neither the original nor prepared image is
  retained after the request succeeds, fails, or is cancelled.
- A failed, invalid, or incompatible extraction must save no receipt or expense
  records. The UI must explain the failure and offer retry, choosing another
  image or model, and switching to manual entry.
- If a selected model disappears or becomes incompatible after the available
  models are refreshed, receipt scanning must pause and require a new selection;
  the application must not silently substitute another model.
- Gemini settings must offer a configuration test which validates the entered
  key, selected model, and required capabilities without sending a real receipt
  or expense data. Errors must distinguish at least an invalid key, unavailable
  or deprecated model, quota/rate limiting, offline state, and an unknown
  service error, with a relevant corrective action for each.
- Gemini may be contacted only following an explicit owner action such as **Scan
  with AI**. The application must never scan receipts automatically or make
  background inference requests.
- A receipt request may send only the selected receipt image, the versioned
  extraction instructions/schema, active category stable IDs and names, device
  locale, and the current project's default currency code. The API credential is
  necessarily used to authorize that request. Expense history, project names,
  merchant history, Google Drive contents, other device identifiers or details,
  and sync metadata must never be included.
- The application does not attempt automatic visual redaction because an
  unreliable redactor could either leak content or remove information required
  for extraction. The owner must see the selected image before transmission and
  may use it, choose another image, or retake the photo.
- Image privacy sanitization is mandatory and separate from optional image
  preparation. EXIF and other embedded metadata, including location and device
  details, must always be removed in memory before transmission. Turning
  preparation off preserves the source pixel dimensions and avoids optional
  resize/compression, but it never disables metadata removal.
- A model whose returned metadata does not establish every required receipt
  capability is labeled **Needs test**, not assumed compatible. Its synthetic
  configuration test must pass for the current key and model before that model
  can be used to scan a real receipt. Test evidence is device-local and must be
  invalidated when the relevant key, model, schema/compatibility version, or
  capability requirements change.
- Exact preparation dimensions, byte targets, compression quality, and accepted
  browser-decodable formats are compatibility-tuning outputs rather than owner
  preferences. The implementation-plan compatibility task must derive them from
  then-current official Gemini limits and verify them with representative
  receipt-legibility tests before the scanning feature is accepted.

### Local Data, Export, and Google Drive

- The application must remain useful locally and must not depend on Google Drive
  being continuously available.
- Expense data must use two-way Google Drive synchronization after authorization
  so changes made on one device can appear on another.
- Synchronization data must use Google Drive's hidden application-data folder to
  reduce accidental manual modification of internal sync state.
- The user must be able to export their data directly as a plain file,
  independently of Google Drive.
- Stored and exported data must use simple, documented, broadly readable
  formats. Versioned JSON is the lossless canonical/export format because it can
  preserve receipt relationships and sync metadata. SQLite or another
  opaque/binary database file is not the interchange format.
- CSV import and export are excluded from the initial release. A flattened
  analysis export may be reconsidered later if it proves useful, but it is not
  part of the MVP.
- The data must not require a proprietary database or the application itself for
  basic inspection and analysis.
- A complete JSON export must contain every project and support restoring the
  application. Export must always support a normal file download and may also
  offer the native share sheet when the browser supports sharing files.
- JSON import must be validated and previewed before mutation, then offer both
  merge and replace modes. Either mode must be atomic and must never leave a
  partially imported dataset.
- Local changes must be saved to IndexedDB first and remain successful even when
  Drive is unavailable. Synchronization must then be attempted after changes, on
  app launch, when connectivity returns, and through a manual sync action.
- Deletions must synchronize as tombstones rather than immediate physical
  removal, preventing an offline device from accidentally restoring deleted
  data. Tombstones are retained indefinitely in the initial release; later
  compaction requires a separately approved proof that no supported device can
  resurrect deleted records.
- Every synchronized record must have stable identity and revision ancestry.
  Concurrent edits to different fields merge automatically without discarding
  either change.
- Concurrent edits to the same field must preserve both candidate values and
  require explicit owner resolution. A concurrent deletion and edit must also
  require the owner to choose whether to keep or delete the record.
- Resolving a conflict creates a new revision which references every conflicting
  revision it resolves. Once synchronized, other devices can therefore prove
  that the new revision supersedes both branches and must not show the same
  conflict again.
- Conflict Review groups conflicts by affected record and presents all
  same-field candidates neutrally. The owner may choose any candidate or enter
  another valid value. Delete-versus-edit conflicts explicitly compare keeping
  the edited record with deleting it and summarize the edits deletion discards.
- Conflict resolution can commit locally while offline. Durable workflow state
  and unresolved candidate data must survive reloads; conflict indicators update
  only after the local resolution revision commits successfully.
- Wall-clock timestamps may support display and ordering but must not be the
  sole authority for conflict resolution, because device clocks and offline
  upload order are unreliable.
- Automerge is the provisional default for causal revision, merge, and conflict
  primitives. The application must not hand-roll the distributed merge algorithm
  when Automerge provides the required behavior.
- Automerge's browser IndexedDB storage adapter may be used with the required
  repository-namespaced database. Application code must still provide the Google
  Drive transport, expense schema, conflict-review workflow, and export mapping.
- Automerge's compact internal representation may remain an implementation
  detail in IndexedDB and hidden Drive sync data. User-controlled interchange in
  the initial release remains versioned JSON.
- Before implementation commits to Automerge, a focused compatibility check must
  verify its current release with Deno 2, the production browser build,
  repository-namespaced IndexedDB, conflict inspection/resolution, and a Google
  Drive round trip.
- That gate must exercise every critical agreed synchronization primitive,
  including concurrent independent changes, same-field conflicts, additions,
  synchronized tombstones, delete-versus-edit, resolution revisions, offline
  replay, generation retirement, export mapping, and deterministic restoration.
  A fake Drive transport may prove the transport contract and round trip; live
  credentials are not a prerequisite. Another established merge library is
  evaluated only if Automerge fails this gate rather than as speculative
  parallel research.
- Signing out, going offline, or revoking Drive access must not block local use.
  Synchronization pauses with a visible status and resumes only after the
  required connectivity and authorization return.
- Switching to a different Google account must require explicit confirmation.
  Data from different Drive accounts must never merge automatically.
- Only one Google account may be configured for synchronization at a time.
- Drive authorization must request the least-privilege hidden application-data
  scope and must not request general access to the owner's Drive files.

### Import and Synchronization

- Import is an explicit workflow with validating, previewing, preparing,
  committing, synchronizing, conflict-resolution, and failure modes. The XState
  actor must prevent ordinary synchronization from running concurrently with an
  import commit.
- Import preview must show the schema version, record counts, required
  migrations, warnings, and blocking validation errors before mutation. An
  invalid file cannot advance to commit.
- Before import, the application should synchronize the latest Drive state when
  possible and generate a safety export of the current local dataset.
- Merge import treats imported records as incoming revisions in the current
  dataset. Stable IDs and Automerge rules merge non-conflicting changes and
  surface genuine conflicts through the normal resolution workflow.
- Merge import is permitted while offline. Its resulting local revisions enter
  the normal synchronization workflow when connectivity returns. It is the
  prominent recommended choice in the UI.
- Replace import creates a new dataset generation rather than pretending that
  every imported record is a newer edit. This prevents stale remote or
  long-offline devices from silently restoring the replaced generation.
- When Drive synchronization is configured, replace import requires an online,
  successful synchronization immediately before replacement. Without Drive
  configured, local replacement remains available offline.
- Before replacement commits, the application must download a complete JSON
  safety export of the current dataset. If the safety export cannot be created,
  replacement must not proceed. Replace must be visually separated as a
  destructive choice and require strong confirmation.
- Unsynchronized changes belonging to the replaced generation are preserved in
  that safety export but must not automatically merge into the new generation.
  They may be recovered later through an explicit merge import.
- After a successful replacement synchronizes, other devices must recognize the
  generation change and require explicit adoption instead of merging old local
  changes into it automatically.

### Disconnecting and Deleting Cloud Data

- The application must provide three clearly distinct actions:
  - disconnect this device while preserving its local data and all cloud data;
  - delete this device's local data without affecting cloud data or other
    devices; and
  - delete everywhere, meaning eventual deletion from Drive and every device
    which later reconnects.
- Deleting this device's local data must also leave that device disconnected so
  the preserved Drive dataset is not immediately downloaded again. This local
  disconnection does not alter Drive data or another device's connection.
- Deleting local data must offer removal of the locally stored Gemini API key
  through a checkbox enabled by default.
- Before deleting everywhere, the application must offer a complete JSON safety
  export. The owner may explicitly decline it to perform intentional permanent
  deletion, but declining requires an additional explicit confirmation.
- A global cloud deletion initiated on one device must remove synchronized
  financial payloads from the configured Google account and prevent any other
  device from recreating them from an old local copy.
- An offline device can learn of the global deletion only after reconnecting. It
  must check remote authorization/retirement state before attempting any upload
  and transition to a durable disconnected/retired state when detected.
- Deleting everywhere must first publish a minimal non-financial dataset
  retirement marker outside the sensitive Automerge document. It must then
  physically remove the retired Automerge generation and its change history from
  Drive and remove that generation from the initiating device's IndexedDB.
- Clearing or deleting current Automerge fields is not privacy erasure because
  prior values may remain in CRDT change history. Sensitive data must never be
  copied into the retirement marker; the retired document/history itself must be
  destroyed.
- Every device must check retirement state before upload. When a device observes
  its generation's marker, it must erase that entire local generation,
  acknowledge retirement if the protocol supports acknowledgements, and enter a
  durable disconnected/retired state without uploading.
- Synchronization must maintain a registry of opaque known-device IDs,
  recognizable synchronized device labels, and last-seen/acknowledgement status
  so deletion progress can identify which devices remain outstanding. New
  devices receive neutral default labels such as `Device 1`, and the owner can
  rename them. The UI identifies the current device and presents last-seen times
  approximately rather than implying exact presence information.
- Opaque device IDs must normally remain hidden and be available only in an
  optional technical-details view for diagnostics. A device must never be
  automatically removed from the registry merely because it has been inactive
  for a long time.
- The application must show whether deletion is pending, removed from Drive,
  awaiting known devices, or complete. It must state that a browser cannot erase
  a device which never runs and reconnects. Progress must show acknowledgement
  status for each known device rather than only a single aggregate spinner.
- Revoking Google OAuth scopes is the final disconnection step, not a substitute
  for synchronized retirement. Revocation must not happen so early that known
  offline devices are prevented from reading the retirement marker unless the
  owner explicitly finalizes despite those devices.
- The owner may force finalization after a strong warning when a known device is
  lost or never reconnects. Its inaccessible local browser copy cannot be
  erased, but revoked authorization and the durable retirement marker must
  prevent it from silently recreating the retired cloud dataset if used later.
  Ordinary synchronization settings must not offer casual device removal or
  lost-device actions; these controls belong only to the strongly warned Delete
  Everywhere workflow.
- Delete Everywhere must be owned by a focused XState actor with explicit scope
  selection, confirmation, safety-export, retirement-publication, Drive-delete,
  local-erasure, awaiting-device, forced-finalization, completed, and failure
  modes. The minimum non-financial workflow state required to resume and show
  honest progress must persist across reloads until a terminal state; erased
  financial payloads must never be copied into that progress snapshot.
- Ordinary deletion of an individual expense uses the synchronized tombstone
  model and does not promise immediate erasure from Automerge history in the
  initial release. Full physical history destruction is guaranteed by the
  delete-everywhere workflow; per-record hard erasure is deferred unless a
  concrete need justifies generation compaction.
- Reconnecting after global deletion must be an explicit recovery or
  reinitialization workflow. It must never silently upload an old local dataset.

### Initial Currency Presentation

- The initial release must not automatically convert currencies.
- Project default currency is sufficient for the initial release. There is no
  separate domestic or reporting currency setting in the MVP.
- When a filtered result contains multiple currencies, totals must be presented
  separately for each currency rather than combined into a misleading value.
- Every entry must preserve its original amount and currency. The data model
  must also preserve its transaction date. These source values are sufficient to
  attach or look up historical exchange-rate data later without changing the
  original record.
- Cross-currency totals and comparisons are explicitly deferred and must not be
  implemented during MVP work. When pursued later, domestic/reporting currency,
  historical exchange-rate import or lookup, rate provenance, conversion, and
  rounding behavior must be designed and delivered together as one coherent
  feature batch.

## User Experience

- Approved navigation, responsive composition, accessibility rules, and
  cross-cutting workflow states are specified in this document and
  [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md). Agreed screen decisions are product
  requirements.
- [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md) defines the shared accessible React
  foundation, semantic dark-theme tokens, reusable component responsibilities,
  responsive rules, and screen-to-component mapping. Screens must reuse it
  rather than creating parallel UI patterns.
- Mobile is the primary form factor. Entry, invoice capture, filtering, and
  synchronization status must be comfortable on small touch screens.
- Desktop browsers must also provide a complete and usable experience.
- The application must be responsive rather than maintaining separate mobile and
  desktop applications.
- Navigation changes from the mobile bottom bar to a desktop left rail according
  to available layout width, not device-name detection. Exact thresholds belong
  to the later approved design system.
- Wide Expenses layouts use a larger list column with a narrower contextual
  column for category summaries, active filters, and related totals. Selecting a
  record may open details beside the list; narrow layouts use a focused detail
  screen with ordinary Back behavior.
- Forms must use readable maximum widths. Suitable review and list/detail flows
  may use two columns when space permits and collapse to the same natural-height
  mobile sequence when it does not.
- Mobile and desktop must reuse the same semantic components, actor events,
  information hierarchy, validation, and accessibility behavior. Responsive
  composition may reveal or reposition content but must not create a separate
  desktop workflow or table-only product.
- The MVP must target WCAG 2.2 Level AA. Interactive controls normally require
  at least a 44-by-44 CSS-pixel target with adequate separation.
- Every action must be keyboard operable with visible focus and logical focus
  order. Dialogs and sheets contain and restore focus appropriately, and failed
  validation moves focus to a useful error summary or invalid field.
- Semantic HTML, explicit labels and accessible names, and restrained live
  announcements must make saves, failures, sync, and update status usable with
  assistive technology without stealing focus unnecessarily.
- Color must never be the sole carrier for signed amounts, categories, errors,
  conflicts, or other meaning. Every UI state must meet the agreed contrast
  target.
- UI state changes are immediate by default for every owner: navigation,
  overlays, expansion, and responsive changes do not animate or delay input.
  Restrained motion is allowed only as functional feedback for otherwise unclear
  ongoing work, such as an indeterminate progress indicator. The reduced-motion
  preference must replace even that movement with equivalent static feedback
  where practical.
- The MVP ships only a comfortable dark theme and has no theme switch. It uses
  layered near-black or charcoal neutral surfaces, readable non-glaring text,
  and a restrained accent rather than an undifferentiated pitch-black canvas,
  harsh glare, neon accents, or decorative glow.
- All component colors must use semantic theme tokens. The infrastructure must
  allow a future light token set without changing component APIs, information
  hierarchy, or workflows, but designing and implementing that light theme is
  explicitly deferred beyond MVP.
- Offline, loading, saving, scanning, syncing, conflict, and error states must
  be visible and understandable to the user.
- First launch must offer three useful paths: create the first local project,
  restore a validated versioned JSON backup, or connect Google Drive. There must
  be no tutorial, feature tour, walkthrough, or onboarding carousel.
- Gemini setup is optional and must not block first use or manual entry.
- The application must not present an installation prompt immediately on
  arrival. After the owner completes a durable useful action, it may show a
  dismissible **Install app** action when supported. Dismissal never blocks use,
  and installation remains reachable later from About when supported.
- After the application shell has been cached, offline launch must open existing
  local data normally with a compact non-blocking indicator. Local browsing and
  expense creation, editing, and deletion remain enabled; Drive and Gemini
  actions explain that they require connectivity. First-use project creation and
  local JSON restoration also remain available offline.
- The About screen must show the release version and short Git commit hash, the
  exact generative-AI disclosure from `README.md`, a local-first/no-tracking
  privacy summary, application and third-party license information, and a link
  to this repository.
- PWA update checks must explicitly distinguish checking, up-to-date,
  update-ready, offline, and failure modes. An update-ready state must offer an
  explicit reload action and must not automatically reload over unsaved input.
  When a workflow is dirty, reloading to update requires saving or explicitly
  discarding its changes first.
- Unfinished manual create/edit forms must persist as device-local IndexedDB
  drafts and restore after accidental reload. Manual and receipt-review drafts
  are cleared after successful Save or explicit discard, and are not
  synchronized or included in data exports.
- In-app navigation away from a dirty workflow must offer **Keep editing** and
  **Discard changes**. Page close or reload should request the browser's native
  unsaved-change warning when supported, while durable drafts protect against
  browsers which do not show it.
- Saving must have explicit local-saving, saved, and save-failed modes. The UI
  prevents duplicate submission while saving, navigates only after the IndexedDB
  transaction commits, and retains all entered data with a **Retry** action if
  local persistence fails.

## Architecture and Hosting

- The application must be a Progressive Web App (PWA).
- The frontend must be deployable as a static site on GitHub Pages.
- Deployment must use repository-relative assets and hash-based application
  routes so every route can be loaded or refreshed at the repository's standard
  GitHub Pages URL without a custom-domain or `404.html` routing workaround.
- The service worker must be registered with scope restricted to this
  repository's GitHub Pages base path. It must not intercept or cache requests
  belonging to another repository on the same owner origin.
- The project must use Deno 2 to execute all development and build tooling,
  including the frontend toolchain.
- Application and test source code must use TypeScript 7 with strict type
  checking. The project must pin the official stable `typescript@7` package, and
  the canonical `deno task check` workflow must invoke that package's `tsc`
  executable through Deno 2. Deno's separate experimental `--unstable-tsgo`
  integration is neither required nor a substitute for this dependency. Silently
  falling back to an older TypeScript checker is not acceptable for the required
  type-checking gate.
- `deno task` must be the canonical interface for project-owned development,
  formatting, linting, testing, building, and maintenance commands.
- Development, testing, and deployment must not require a Node.js, npm, pnpm,
  Yarn, or Bun project toolchain. Dependencies and tools must be compatible with
  Deno 2 and reproducibly pinned or locked.
- A backend should be avoided unless an agreed product requirement cannot be met
  reasonably and safely in the client.
- If a backend becomes necessary, it must be designed for and deployed on Deno
  Deploy.
- Prefer a local-first, static architecture. Any proposal to introduce a backend
  must identify the requirement it serves, explain why a browser-only solution
  is insufficient, and be agreed upon before implementation.

### UI and Application State

- XState v5 is required to drive application behavior and UI state.
- The actor system must have a coarse root application actor for shared
  lifecycle and navigation, with focused invoked or spawned actors owning
  expense editing, receipt scanning/review, synchronization, conflicts, import,
  deletion, and other substantial workflows. It must not become one giant global
  statechart.
- Focused form and receipt-review actors must own dirty, draft-persisting,
  saving, saved, save-failed, retry, and discard behavior. Durable workflow
  state must use persisted XState snapshots for hydration rather than
  reconstructing a state value from ad hoc booleans and partial context.
- Asynchronous workflows such as local persistence, Google Drive sync, invoice
  processing, retries, and conflict handling must be modeled explicitly with
  XState actors and statecharts.
- The receipt-scanning actor must explicitly represent idle, optional in-memory
  image preparation, requesting, validating structured output, review, and
  failure modes. Retry, model/image replacement, cancellation, and manual-entry
  events must be permitted only in the appropriate states, and no failed path
  may persist draft receipt data as accepted expenses.
- The synchronization actor must explicitly distinguish idle, offline,
  synchronizing, conflict-resolution, and error/retry modes. Unresolved conflict
  data must be durable rather than existing only in transient machine context.
- UI availability and rendering must be derived from XState snapshots, state
  matching, tags, selectors, and permitted events rather than duplicated
  component-level workflow flags.
- Business operations must be expressed as stable, typed, domain-oriented events
  with runtime-validated payloads where events cross an untrusted or serialized
  boundary. UI components dispatch those events and render actor snapshots; they
  must not bypass actors to reproduce business decisions in component handlers.
- Durable expense records may live in an appropriate persistence layer, but
  access to and mutation of them must be coordinated by the actor system.
- React with `@xstate/react` is the confirmed UI framework.
- Repository-owned design-system components must use React Aria Components for
  behavior-heavy accessible primitives, ordinary CSS with semantic custom
  properties for styling, and directly imported Lucide React icons. The MVP must
  not add Tailwind, runtime CSS-in-JS, or a second styled component library
  without a newly agreed requirement.
- Screens bind XState actors to components defined by `DESIGN_SYSTEM.md`.
  Application screens must not independently style raw React Aria controls into
  competing button, field, overlay, notice, or status systems.

### Future Automation Extension

- Post-MVP, a constrained LLM adapter may translate structured tool calls into
  the same public domain events used by the human UI, allowing assisted
  navigation and operation without inventing a second application-control API.
- This possibility is not an initial-release feature and must not add chat,
  remote control, or background AI behavior to the MVP.
- Any future adapter must validate its structured input and obey the same actor
  guards, conflict handling, permission checks, review steps, and destructive
  confirmations as a human action. It may not mutate actor context, IndexedDB,
  or navigation state directly or gain a privileged bypass around the normal
  workflows.

### Deferred AI Scan Feedback Memory

- Post-MVP, after reviewing or editing an AI-generated receipt or expense draft,
  the owner may be offered an explicit **Send feedback to AI** action. This is a
  future feedback mechanism, not an automatic interpretation of every edit.
- The feedback action may ask a constrained tool to append a concise,
  human-readable characterization or correction to an application-managed
  plain-text Markdown memory file. The memory is intended to help future scan
  prompts apply the owner's recurring preferences and corrections; it is not a
  second source of truth for expense records.
- Any future memory write must be explicit, inspectable, editable, and deletable
  by the owner. It must exclude receipt images, API keys, credentials, raw
  prompts, and unrelated personal data, and must not silently upload or
  synchronize content.
- Future scan flows may attach the owner-approved memory content as bounded
  context, but the memory must never override the current receipt, the owner's
  present edits, domain validation, or the normal review and confirmation steps.
- The memory file format, storage location, synchronization policy, prompt
  assembly, retention limits, and tool permissions require a later design
  decision. This feature has no MVP UI, actor, adapter, persistence, or test
  contract and must not be implemented as part of the initial release.

### Local Browser Storage

- Expense-day boundary is a synchronized personal domain preference and belongs
  to the portable dataset. Last-selected project, OAuth tokens, device-specific
  UI state, Gemini API key, selected Gemini model, and image-preparation
  preference remain device-local.
- IndexedDB is required for all locally persisted application data, including
  expenses, categories, projects, settings, sync metadata, migrations,
  device-local workflow drafts/snapshots, and extracted receipt records. Source
  receipt images are explicitly excluded because they are not retained.
- The IndexedDB database name must be namespaced with the repository name,
  `did-it-become-what-you-like`, so it cannot collide with databases created by
  other projects hosted on the same GitHub Pages origin.
- Any related browser-storage identifiers must use the same repository namespace
  where the storage API exposes a shared origin-level key space.
- Repository namespacing prevents accidental collisions but is not a security
  boundary. Browser storage is origin-scoped rather than URL-path-scoped, so
  other GitHub Pages projects served from the same owner origin may be able to
  address the same storage.
- Multi-record mutations and imports must be transactional. Schema migrations
  must be explicit, versioned, and tested.
- Persisted data and complete JSON exports must carry an explicit schema
  version. A centralized migration registry must define each supported ordered
  migration, apply migrations atomically, and be tested against every supported
  source version.
- `localStorage` must not be used for expense or other application data. The
  user-entered Google AI Studio API key is the single approved exception.
- Service-worker caches may hold the application shell and other explicitly
  approved cacheable resources; they are not a source of truth for user data.

### Browser Integrations and Security

- Google Drive authorization and API access should be implemented directly in
  the browser if the agreed sync design can be delivered safely that way. Google
  Identity Services supports browser-based authorization, so Drive integration
  alone does not currently justify a backend.
- `@google/genai` technically supports browser initialization. However, its
  official documentation warns that client-side API keys are exposed and
  recommends a server-side implementation for production environments.
- No API key may be committed to the repository or embedded in the published
  application bundle.
- The owner has accepted the personal-app risk of direct browser use. The user
  will enter their own Google AI Studio API key at runtime, and the application
  will persist it in `localStorage` under a key namespaced with
  `did-it-become-what-you-like`.
- The key is device-specific and must never be synchronized or included in any
  data export. It is remembered automatically until the owner explicitly deletes
  it; there is no separate remember-key or session-only option in the initial
  release. The settings UI shows a stored key in masked form with only a
  **Remove** action. Changing it means removing it and then entering the new
  key; there is no redundant **Replace** control. Removing the key disables only
  AI scanning and does not remove expense data.
- The selected Gemini model and image-preparation preference are also
  device-local because available models, keys, and device capabilities may
  differ. They are neither synchronized nor included in complete data exports.
  Image preparation is an on/off device default which may be overridden for an
  individual scan.
- The UI must state that this locally stored key is not a browser secret and can
  be read by JavaScript executing on the same origin. It must provide clear
  controls to enter and remove the key.
- Starting AI scanning without a configured key must open an in-place quick
  setup rather than redirecting away from the selected receipt. The setup must
  use a masked API-key input with paste and explicit reveal controls, repeat the
  concise client-side exposure warning, validate the key, persist it according
  to the agreed automatic-remember behavior, and continue the pending scan after
  successful setup. Validation errors remain in the setup for correction.
- The frontend must minimize this accepted risk with a restrictive Content
  Security Policy, no runtime CDN dependencies or unrelated third-party scripts,
  safe rendering of user/LLM text, and a deliberately small dependency surface.
- This accepted key design does not currently justify a Deno Deploy backend. It
  may be revisited if the threat model or deployment scope changes.
- A custom domain is not required. Deployment uses the repository's standard
  GitHub Pages URL, with explicit acceptance that other projects on the same
  owner origin may share the browser-storage security boundary.
- The supported browser policy is the latest two major releases of Chrome, Edge,
  Firefox, and Safari. Current iOS Safari and Android Chrome are equal primary
  mobile targets for camera/image selection, IndexedDB, offline launch, and PWA
  installation where the platform exposes it. An unsupported browser receives a
  concise explanation rather than an unreliable degraded workflow.
- Before first use, the application must explain that invoice images and their
  extracted content are sent to Google Gemini. Later scan flows retain a visible
  reminder without requiring repetitive confirmation before every scan.
- The public PWA requires no separate application login. Local data is available
  only in its browser origin, while Google OAuth independently protects Drive
  synchronization.

## Quality and Development Process

- The application must have unit tests.
- The application must have end-to-end tests covering its critical user
  journeys.
- Deno's built-in `deno test` runner with `@std/assert` is the default for pure
  domain, XState actor, adapter integration, and component suites. React
  component tests use React Testing Library with `happy-dom`, subject to the
  foundation compatibility gate; Jest and Vitest are not introduced without a
  demonstrated compatibility need.
- Browser E2E uses a proper test dependency which produces deterministic
  assertions, failures, traces, and nonzero exits. Playwright is the provisional
  choice and must pass the Deno-only compatibility gate before it is pinned.
  `agent-browser` is deliberately not the E2E assertion framework; it remains
  the coding agent's separate visual, interaction, accessibility-tree, and axe
  inspection tool.
- Business rules, guards, transitions, retries, cancellation, and actor
  coordination should be tested primarily at the XState actor/machine level,
  including generated path/model tests where they add useful coverage. This is
  the main logic-test layer and should prevent duplicating the same behavioral
  assertions across many UI tests.
- Component tests should focus on snapshot-to-view rendering, event wiring,
  validation presentation, and accessibility rather than re-testing statechart
  logic. End-to-end tests remain required for a smaller set of critical browser
  journeys because machine tests cannot prove layout, focus behavior,
  IndexedDB/service-worker integration, or external browser APIs work together.
- Prefer the lowest reliable test layer for each behavior. Pure domain logic,
  schema validation, migrations, formatting, selectors, and utilities use unit
  tests; workflow behavior uses XState actor/machine tests; components use unit
  tests for rendering, accessibility semantics, variants, and event dispatch.
  E2E tests are intentionally minimal and prove only critical integration seams
  and complete owner journeys which lower layers cannot establish.
- The initial E2E suite contains five journeys: local first use through manual
  expense save; receipt capture/review using a fake Gemini adapter; Drive
  reconnect and visible synchronization using a deterministic fake Drive
  adapter; conflict review/resolution; and offline/update recovery.
- The Drive E2E journey proves only browser/UI/actor/adapter wiring. Merge
  causality, retries, replay, conflict cases, and transport behavior belong in
  cheaper domain, actor, and adapter integration tests and must not be repeated
  across the E2E suite.
- Normal automated tests use deterministic fake Gemini and Drive adapters and
  never require live credentials in CI. Optional manual smoke tests may use
  credentials explicitly supplied by the owner and must never persist them in
  fixtures, logs, screenshots, or repository files.
- Responsive acceptance uses `320x568` as a narrow stress viewport, `390x844` as
  a common phone viewport, and `1280x800` as desktop. Tablet-specific checks are
  added only for a component or screen whose composition materially changes at
  that width.
- Accessibility acceptance requires complete keyboard operation, visible focus,
  correct names/roles/states and landmarks, functional static feedback under
  reduced motion, and automated accessibility checks. Critical journeys also
  receive `agent-browser` Chromium screenshots and accessibility-tree inspection
  at the representative mobile and desktop viewports.
- A feature task is not complete when tests are postponed to a later cleanup
  milestone. Its appropriate unit/actor/component tests must be implemented and
  passing in the same task, while critical E2E coverage may be added at the
  milestone integration gate after the required screens and adapters exist.
- During development, the coding agent must use
  [`agent-browser`](https://github.com/vercel-labs/agent-browser) with Chromium
  to inspect and exercise the running UI.
- Visual UI/UX checks must cover representative mobile and desktop viewports,
  not only automated DOM assertions.
- Browser checks should include screenshots and accessibility-tree inspection
  where useful, and should exercise offline and error states when applicable.
- `agent-browser` is installed reproducibly through a Deno-run installer which
  downloads a pinned native release for the current platform, verifies a
  repository-pinned SHA-256, and installs the corresponding Chrome for Testing.
  Exact implementation-time versions and hashes are compatibility-task outputs;
  Node/npm is not a project toolchain.

### Post-Design Implementation Orchestration Deliverable

After the design system is approved, planning must create one living
`IMPLEMENTATION_PLAN.md`. It is the only source of truth for implementation
orchestration and must be sufficient for a coding agent to resume work without
reconstructing the plan from chat history.

That file must contain:

- the approved MVP scope, deferred exclusions, architecture baseline, and
  definition of done;
- a dependency graph and ordered milestones with stable task IDs;
- for every task: scope and non-goals, prerequisites, allowed file/contract
  ownership, expected outputs, acceptance criteria, verification commands, and
  status, including the cheapest appropriate unit, actor, component, or E2E test
  layer and the exact tests delivered with that task;
- explicit parallel lanes and collision rules so sub-agents are dispatched only
  where work is genuinely independent;
- a worktree policy identifying when isolated worktrees are worthwhile, their
  disjoint file/contract ownership, the integration owner and merge order, and
  how unintegrated work is protected;
- the current checkpoint, completed evidence, blockers, and next
  dependency-ready work;
- a sub-agent orchestration procedure which uses bounded tasks, minimizes
  duplicate context and work, and scales concurrency only when it is useful;
- a review loop of implementer self-check, independent review, automated tests,
  `agent-browser` visual/accessibility inspection where applicable, scoped fix,
  and full re-verification before completion;
- milestone test gates which keep the E2E suite compact, prevent state-machine
  assertions from being duplicated through the UI stack, and reject tasks whose
  required lower-layer tests were deferred;
- commit/push and plan-update checkpoints which leave the repository resumable
  after interruption; and
- a ready-to-use orchestration prompt instructing a coding agent to reconcile
  the recorded checkpoint with actual Git/test state, dispatch the next safe
  work, update the file, and continue until the approved definition of done or a
  genuine owner decision is required.

The later planning discussion will decide the concrete milestones, task graph,
review independence, sub-agent ownership, and concurrency limits. This section
records the required format and outcome, not those implementation decisions.

## Open Questions and Ambiguities

These questions must be resolved incrementally before implementation.

### 1. Expense Record and Invoice Semantics

- There are no remaining MVP decisions in this section. Receipt parents,
  independently editable lines, required line descriptions, monetary signs, and
  optional quantity/unit-price fields are specified above.

### 2. Project Behavior

- There are no remaining MVP UI decisions in this section. Project switching,
  organization, and deletion are specified in this document and
  `DESIGN_SYSTEM.md`.

### 3. Currency Behavior — Deferred Beyond MVP

- There are no remaining MVP decisions in this section. Cross-currency reporting
  and its historical exchange-rate, provenance, and rounding rules are one
  deferred feature batch and are not part of current specification work.

### 4. Local Persistence and Google Drive Sync

- There are no remaining owner-preference decisions in this section. Automerge
  receives one comprehensive compatibility gate; alternatives are evaluated only
  if it fails.

### 5. Google Access and Privacy

- There are no remaining MVP decisions in this section. The permitted Gemini
  request data, mandatory metadata sanitization, owner preview, and excluded
  local/synchronized data are specified above.

### 6. Gemini API-Key Architecture

- There are no remaining owner-preference decisions in this section. Unknown
  model capabilities require a passing synthetic test, while exact image
  preparation thresholds are an evidence-based compatibility-task output.

### 7. Filtering and Reporting

- There are no remaining MVP interaction decisions in this section. Calendar
  periods, combinable project-scoped filters, search, sorting, and
  multi-currency totals are specified above and in `DESIGN_SYSTEM.md`.
- Comparisons, trends, and charts remain post-MVP possibilities. Stable IDs,
  original signed decimal amounts and currencies, immutable transaction dates,
  and preserved historical records provide their initial data foundation.

### 8. Framework, PWA, and Browser Support

- React and the component/design-system foundation are defined in
  `DESIGN_SYSTEM.md`.
- Browser versions, equal iOS/Android mobile targets, offline boundaries,
  hash-based GitHub Pages routing, repository-relative assets, and
  repository-scoped service-worker behavior are specified above.

### 9. Testing and Visual Acceptance

- There are no remaining owner-preference decisions in this section.
  `deno
  test`, React Testing Library/`happy-dom`, a proper provisional
  Playwright E2E dependency, and separately installed `agent-browser` are
  subject to the recorded foundation compatibility gates.
- Critical E2E journeys, representative viewports, accessibility gates, and the
  fake-adapter boundary are specified above. Detailed synchronization and Gemini
  behaviors belong at lower test layers; CI never requires live service
  credentials.

## Recommended Decision Order

1. Define expense and invoice record semantics.
2. Define canonical storage/export data and multi-currency semantics.
3. Define local persistence, Google Drive sync, and conflict behavior.
4. Define the remaining Gemini model, privacy, and key UX details.
5. Confirm React, browser support, and detailed PWA behavior.
6. Approve every screen and applicable cross-cutting UI/PWA state.
7. Select and document the UI library, design system, tokens, reusable
   components, responsive rules, and interaction patterns.
8. Agree on acceptance criteria and test tooling.
9. Break the approved scope into dependency-ordered milestones, prerequisites,
   verification gates, and safe parallel workstreams.
10. Obtain explicit owner approval before beginning implementation.
