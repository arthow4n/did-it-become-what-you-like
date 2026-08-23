# Application Specification

## Status and Decision Language

This document is the starting point for the application specification. Product
requirements, user experience, and implementation details will be refined only
after discussion and agreement. Implementation must not begin until the repo
owner explicitly approves the specification.

The terms in this document have the following meanings:

- **Required**: agreed direction.
- **Provisional**: captured from the current discussion but not yet settled.
- **Open**: a decision that still needs to be made.

## Product Summary

The application is a personal expense tracker for the repo owner. It should
make everyday entry and review of expenses fast, work especially well on a
phone, and keep its data in simple formats that remain easy to inspect and
analyze outside the application.

The device-local copy is the primary working copy. Core entry and review flows
should remain available offline, while Google Drive provides automatic backup
or multi-device synchronization according to the sync design still to be
agreed.

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
- **Progressive enhancement:** the browser experience must remain usable
  without installing the PWA.

## User Needs and Usage

- Expense capture must fit several real-life moments:
  - immediately after a purchase, commonly by scanning its receipt or invoice;
  - manually later the same day; and
  - processing multiple expenses in a later session.
- The application is primarily a trustworthy record for later reflection, not
  a tool that must provide an immediate response after every entry.
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
- Merchant/shop and description are separate optional fields. Merchant/shop
  should preserve the exact merchant branch or location when known rather than
  reducing it to only a generic chain name.
- Calendar date is required. Time-of-day is optional and should be preserved
  when entered manually or extracted from a receipt so same-day records can be
  ordered more accurately.
- Monetary amounts follow their natural direction from the owner's perspective:
  purchases and other outflows are negative, while discounts, refunds,
  cashback, bottle-deposit returns, and other inflows are positive. This sign
  convention must also support possible future income records without a data
  migration that reverses existing meanings.
- Monetary amounts, quantities, and unit prices must be persisted as canonical
  decimal strings, never as JavaScript `Number` values or implicit integer minor
  units. Examples include `"-10.99"` for an outflow and `"1.25"` for a
  quantity.
- Canonical decimal strings represent mathematical value rather than entered
  formatting: redundant leading/trailing zeros are normalized, so `"10.90"`
  may persist as `"10.9"`. Currency-aware display formatting restores the
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
  deleted through category management.
- Categories are shared globally across projects because the owner
  generally uses the same category set in every context. Switching projects
  isolates expense views but does not create a separate category catalogue.
- Categories and projects must have stable immutable IDs. Expenses reference
  `categoryId` and `projectId`, never mutable display names, so renaming a
  category or project cannot break or rewrite relationships.
- The expense view must support filtering by:
  - day, month, and year; and
  - category.
- Multiple currencies must be supported.
- The user must be able to set a domestic/default currency.
- The application must support multiple user-defined projects.
- Each project represents a distinct life or travel context whose
  expenses should not be mixed in ordinary views. Examples include the owner's
  former life in Taiwan, current life in Sweden, or an individual trip to
  another country.
- A project must have a default/local currency so expenses can be recorded
  naturally in the currency of that context without requiring immediate
  conversion to the owner's domestic currency.
- The project currency is a default, not a restriction. An individual entry
  may override it, and one project may contain entries in multiple
  currencies.
- Every expense belongs to exactly one project, defaulting to the currently
  selected project while remaining manually changeable.
- The application must persist the most recently selected project and reopen
  that project on the next launch.
- Normal expense lists, filters, and totals are scoped to the selected project.
  Entries from other projects remain hidden until the user switches projects.
- Domain-level tags are not part of the initial release. They may be added later
  if a concrete cross-project labeling need emerges. Stable record identifiers
  must allow this extension without redesigning existing data.
- Creating, viewing, editing, and deleting an expense offline are provisional
  baseline behaviors; exact validation, ordering, and deletion/undo behavior
  remain to be specified.

### Invoice-Assisted Entry

- The application must provide LLM-assisted entry from a scanned or
  photographed invoice.
- The PWA must support both capturing a new receipt image with the device camera
  and selecting/importing an existing image from the device.
- The LLM should produce draft expense entries for the relevant items on the
  invoice to reduce manual entry.
- The future extraction prompt and review model must request and preserve the
  most specific merchant/shop identity visible on the receipt, including its
  branch or location when available.
- The AI must suggest a category for every extracted item using only the
  owner's existing category catalogue.
- The AI must never create categories. When no existing category can be chosen
  confidently, it must use `Uncategorized` for the draft.
- A scanned receipt or invoice must produce a separate draft entry for every
  purchased line item rather than only one entry for the receipt total.
- Extracted discounts, refunds, cashback, bottle-deposit returns, and similar
  credits must be retained when present. They must not be discarded or forced
  into the same semantics as an ordinary expense.
- The owner's previous application required folding discounts into an item's
  final price. This was a tool limitation rather than a preferred model. A
  receipt instead contains purchase lines and signed adjustment lines which sum
  to its total.
- An adjustment may refer to a particular item when that relationship can be
  determined confidently. Linking is optional: receipt-wide or otherwise
  ambiguous adjustments must remain valid without an item link.
- A receipt is a logical parent record for shared metadata such as merchant,
  date, currency, and receipt total. Each purchased item or adjustment has its
  own stable record and identifier referencing the receipt. Records must remain
  independently editable and mergeable rather than requiring every receipt
  change to replace one large nested object.
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
- Generated entries must be presented for user review and correction before
  they are saved. The review must show all entries about to be created and allow
  the owner to add missing lines, edit AI-generated values, and remove incorrect
  lines.
- Saving a reviewed receipt must commit its parent record and all accepted lines
  atomically. A failure must leave none of that receipt partially saved.
- The extracted receipt total must be checked against the sum of its draft
  purchase and adjustment lines. A mismatch must be clearly warned about, but
  the owner may explicitly confirm and save despite the mismatch.
- Extraction results must identify uncertain fields, inconsistencies, and other
  potential issues, with a useful explanation rather than silently inventing a
  confident value.
- AI-assisted receipt scanning requires an internet connection. When offline,
  the application must explain that scanning is unavailable while keeping
  manual entry fully usable. It must not retain or queue a selected receipt
  image for later submission.
- `@google/genai`, used with a Google AI Studio API key, is the provisional
  default SDK and service for this feature.

### Local Data, Export, and Google Drive

- The application must remain useful locally and must not depend on Google
  Drive being continuously available.
- Expense data must use two-way Google Drive synchronization after
  authorization so changes made on one device can appear on another.
- Synchronization data must use Google Drive's hidden application-data folder to
  reduce accidental manual modification of internal sync state.
- The user must be able to export their data directly as a plain file,
  independently of Google Drive.
- Stored and exported data must use simple, documented, broadly readable
  formats. Versioned JSON is the lossless canonical/export format because it can
  preserve receipt relationships and sync metadata. CSV is a flattened analysis
  export rather than the source of truth. SQLite or another opaque/binary
  database file is not the interchange format.
- CSV import is excluded from the initial release because it cannot safely
  preserve receipt relationships, revision ancestry, or merge semantics.
- The data must not require a proprietary database or the application itself
  for basic inspection and analysis.
- A complete JSON export must contain every project and support restoring the
  application. CSV export must reflect the currently filtered analysis view.
- JSON import must be validated and previewed before mutation, then offer both
  merge and replace modes. Either mode must be atomic and must never leave a
  partially imported dataset.
- Local changes must be saved to IndexedDB first and remain successful even when
  Drive is unavailable. Synchronization must then be attempted after changes,
  on app launch, when connectivity returns, and through a manual sync action.
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
- Wall-clock timestamps may support display and ordering but must not be the
  sole authority for conflict resolution, because device clocks and offline
  upload order are unreliable.
- Automerge is the provisional default for causal revision, merge, and conflict
  primitives. The application must not hand-roll the distributed merge
  algorithm when Automerge provides the required behavior.
- Automerge's browser IndexedDB storage adapter may be used with the required
  repository-namespaced database. Application code must still provide the
  Google Drive transport, expense schema, conflict-review workflow, and export
  mapping.
- Automerge's compact internal representation may remain an implementation
  detail in IndexedDB and hidden Drive sync data. User-controlled interchange
  remains versioned JSON and CSV.
- Before implementation commits to Automerge, a focused compatibility check
  must verify its current release with Deno 2, the production browser build,
  repository-namespaced IndexedDB, conflict inspection/resolution, and a Google
  Drive round trip.
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
- Before import, the application should synchronize the latest Drive state when
  possible and generate a safety export of the current local dataset.
- Merge import treats imported records as incoming revisions in the current
  dataset. Stable IDs and Automerge rules merge non-conflicting changes and
  surface genuine conflicts through the normal resolution workflow.
- Merge import is permitted while offline. Its resulting local revisions enter
  the normal synchronization workflow when connectivity returns.
- Replace import creates a new dataset generation rather than pretending that
  every imported record is a newer edit. This prevents stale remote or
  long-offline devices from silently restoring the replaced generation.
- When Drive synchronization is configured, replace import requires an online,
  successful synchronization immediately before replacement. Without Drive
  configured, local replacement remains available offline.
- Before replacement commits, the application must download a complete JSON
  safety export of the current dataset. If the safety export cannot be created,
  replacement must not proceed.
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
- A global cloud deletion initiated on one device must remove synchronized
  financial payloads from the configured Google account and prevent any other
  device from recreating them from an old local copy.
- An offline device can learn of the global deletion only after reconnecting. It
  must check remote authorization/retirement state before attempting any upload
  and transition to a durable disconnected/retired state when detected.
- Deleting everywhere must first publish a minimal non-financial dataset
  retirement marker outside the sensitive Automerge document. It must then
  physically remove the retired Automerge generation and its change history
  from Drive and remove that generation from the initiating device's IndexedDB.
- Clearing or deleting current Automerge fields is not privacy erasure because
  prior values may remain in CRDT change history. Sensitive data must never be
  copied into the retirement marker; the retired document/history itself must
  be destroyed.
- Every device must check retirement state before upload. When a device observes
  its generation's marker, it must erase that entire local generation,
  acknowledge retirement if the protocol supports acknowledgements, and enter a
  durable disconnected/retired state without uploading.
- The application must show whether deletion is pending, removed from Drive,
  awaiting known devices, or complete. It must state that a browser cannot erase
  a device which never runs and reconnects.
- Revoking Google OAuth scopes is the final disconnection step, not a substitute
  for synchronized retirement. Revocation must not happen so early that known
  offline devices are prevented from reading the retirement marker unless the
  owner explicitly finalizes despite those devices.
- Reconnecting after global deletion must be an explicit recovery or
  reinitialization workflow. It must never silently upload an old local dataset.

### Initial Currency Presentation

- The initial release must not automatically convert currencies.
- When a filtered result contains multiple currencies, totals must be presented
  separately for each currency rather than combined into a misleading value.
- Every entry must preserve its original amount and currency. The data model
  must also preserve its transaction date. These source values are sufficient
  to attach or look up historical exchange-rate data later without changing the
  original record.

## User Experience

- Mobile is the primary form factor. Entry, invoice capture, filtering, and
  synchronization status must be comfortable on small touch screens.
- Desktop browsers must also provide a complete and usable experience.
- The application must be responsive rather than maintaining separate mobile
  and desktop applications.
- Offline, loading, saving, scanning, syncing, conflict, and error states must
  be visible and understandable to the user.

## Architecture and Hosting

- The application must be a Progressive Web App (PWA).
- The frontend must be deployable as a static site on GitHub Pages.
- The project must use Deno 2 to execute all development and build tooling,
  including the frontend toolchain.
- `deno task` must be the canonical interface for project-owned development,
  formatting, linting, testing, building, and maintenance commands.
- Development, testing, and deployment must not require a Node.js, npm, pnpm,
  Yarn, or Bun project toolchain. Dependencies and tools must be compatible
  with Deno 2 and reproducibly pinned or locked.
- A backend should be avoided unless an agreed product requirement cannot be
  met reasonably and safely in the client.
- If a backend becomes necessary, it must be designed for and deployed on Deno
  Deploy.
- Prefer a local-first, static architecture. Any proposal to introduce a
  backend must identify the requirement it serves, explain why a browser-only
  solution is insufficient, and be agreed upon before implementation.

### UI and Application State

- XState v5 is required to drive application behavior and UI state.
- Asynchronous workflows such as local persistence, Google Drive sync, invoice
  processing, retries, and conflict handling must be modeled explicitly with
  XState actors and statecharts.
- The synchronization actor must explicitly distinguish idle, offline,
  synchronizing, conflict-resolution, and error/retry modes. Unresolved conflict
  data must be durable rather than existing only in transient machine context.
- UI availability and rendering must be derived from XState snapshots, state
  matching, tags, selectors, and permitted events rather than duplicated
  component-level workflow flags.
- Durable expense records may live in an appropriate persistence layer, but
  access to and mutation of them must be coordinated by the actor system.
- React with `@xstate/react` is the provisional UI framework; it is not yet a
  final decision.

### Local Browser Storage

- IndexedDB is required for all locally persisted application data, including
  expenses, categories, projects, settings, sync metadata, migrations,
  and extracted receipt records. Source receipt images are explicitly excluded
  because they are not retained.
- The IndexedDB database name must be namespaced with the repository name,
  `did-it-become-what-you-like`, so it cannot collide with databases created by
  other projects hosted on the same GitHub Pages origin.
- Any related browser-storage identifiers must use the same repository
  namespace where the storage API exposes a shared origin-level key space.
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
  the browser if the agreed sync design can be delivered safely that way.
  Google Identity Services supports browser-based authorization, so Drive
  integration alone does not currently justify a backend.
- `@google/genai` technically supports browser initialization. However, its
  official documentation warns that client-side API keys are exposed and
  recommends a server-side implementation for production environments.
- No API key may be committed to the repository or embedded in the published
  application bundle.
- The owner has accepted the personal-app risk of direct browser use. The user
  will enter their own Google AI Studio API key at runtime, and the application
  will persist it in `localStorage` under a key namespaced with
  `did-it-become-what-you-like`.
- The UI must state that this locally stored key is not a browser secret and can
  be read by JavaScript executing on the same origin. It must provide clear
  controls to replace and remove the key.
- The frontend must minimize this accepted risk with a restrictive Content
  Security Policy, no runtime CDN dependencies or unrelated third-party
  scripts, safe rendering of user/LLM text, and a deliberately small dependency
  surface.
- This accepted key design does not currently justify a Deno Deploy backend. It
  may be revisited if the threat model or deployment scope changes.
- Sending invoice images and extracted content to an LLM provider must be made
  clear to the user before submission.
- The public PWA requires no separate application login. Local data is available
  only in its browser origin, while Google OAuth independently protects Drive
  synchronization.

## Quality and Development Process

- The application must have unit tests.
- The application must have end-to-end tests covering its critical user
  journeys.
- During development, the coding agent must use
  [`agent-browser`](https://github.com/vercel-labs/agent-browser) with Chromium
  to inspect and exercise the running UI.
- Visual UI/UX checks must cover representative mobile and desktop viewports,
  not only automated DOM assertions.
- Browser checks should include screenshots and accessibility-tree inspection
  where useful, and should exercise offline and error states when applicable.
- How `agent-browser` is pinned, installed, and invoked while preserving the
  Deno 2-only toolchain requirement remains an open tooling decision.

## Open Questions and Ambiguities

These questions must be resolved incrementally before implementation.

### 1. Expense Record and Invoice Semantics

- Which shared receipt metadata and line-level fields are required beyond the
  agreed merchant, date, currency, total, quantity, unit price, line total, and
  independent purchase/adjustment/tip records?

### 2. Project Behavior

- Detailed project-switching navigation and visual UI design will be specified
  during the later UI/UX discussion.

### 3. Currency Behavior

- Which explicit rounding modes are needed later for derived values such as
  currency conversion? Original entered and receipt values are never rounded.

### 4. Local Persistence and Google Drive Sync

- Does the Automerge compatibility check validate the complete agreed behavior,
  or must another established library be evaluated before implementation?

### 5. Google Access and Privacy

- What data may be sent to Gemini, and what must be redacted or confirmed?

### 6. Gemini API-Key Architecture

- Should the accepted `localStorage` default remain, or should the application
  store only passphrase-encrypted key ciphertext in IndexedDB and require an
  unlock each browser session? Neither browser-only option protects the key
  from malicious JavaScript running in the application's origin after unlock.
- Is a WebAuthn/passkey-assisted key-wrapping option worth its additional
  compatibility, recovery, and UX complexity?
- Should the application use a dedicated custom domain to isolate its browser
  origin from the owner's other GitHub Pages projects?
- Should the API key remain device-specific, or be manually entered on each
  device? It must not be included in ordinary expense-data sync or exports.
- Should the user opt into remembering the key, or is persistent
  `localStorage` always expected after entry?
- Which Gemini model, structured-output schema, image limits, failure behavior,
  and usage controls are required?

### 7. Filtering and Reporting

- Do day/month/year filters mean a chosen calendar period, rolling periods, or
  both?
- Can filters be combined across date, category, currency, and project?
- Which list search and sorting controls are required for the initial release?
- Comparisons, trends, and charts are post-MVP possibilities. What historical
  fields or invariants must be retained now to support them later without
  complicating the initial UI?
- What timezone defines day/month/year boundaries?

### 8. Framework, PWA, and Browser Support

- Should React be confirmed, or is another UI layer preferred?
- Which mobile and desktop browsers and minimum versions must be supported?
- What must work offline beyond browsing and manual entry?
- How should install prompts, updates, and unsaved changes be communicated?
- How will the app handle GitHub Pages' repository base path, direct loads, and
  service-worker scope?

### 9. Testing and Visual Acceptance

- Which unit-test and end-to-end frameworks best satisfy the Deno 2-only
  constraint?
- Which exact critical journeys and viewport/device sizes form the acceptance
  suite?
- How should Google Drive, Gemini, offline behavior, and merge conflicts be
  tested without making live external calls on every run?
- What is the Deno-compatible, reproducible installation strategy for
  `agent-browser` and its Chromium dependency?

## Recommended Decision Order

1. Define expense and invoice record semantics.
2. Define canonical storage/export data and multi-currency semantics.
3. Define local persistence, Google Drive sync, and conflict behavior.
4. Define the remaining Gemini model, privacy, and key UX details.
5. Confirm React, browser support, and detailed PWA behavior.
6. Agree on acceptance criteria and test tooling.
