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

## Required Product Capabilities

### Expense Entry and Organization

- An expense must support at least:
  - date;
  - description;
  - amount and currency; and
  - category.
- Categories must be fully customizable.
- The expense view must support filtering by:
  - day, month, and year; and
  - category.
- Multiple currencies must be supported.
- The user must be able to set a domestic/default currency.
- The application must provide a way to separate or group expenses into
  multiple user-defined collections. The final concept and name (for example,
  project, tag, ledger, or account) remain open.
- Creating, viewing, editing, and deleting an expense offline are provisional
  baseline behaviors; exact validation, ordering, and deletion/undo behavior
  remain to be specified.

### Invoice-Assisted Entry

- The application must provide LLM-assisted entry from a scanned or
  photographed invoice.
- The LLM should produce draft expense entries for the relevant items on the
  invoice to reduce manual entry.
- Generated entries must be presented for user review and correction before
  they are saved.
- `@google/genai`, used with a Google AI Studio API key, is the provisional
  default SDK and service for this feature.

### Local Data, Export, and Google Drive

- The application must remain useful locally and must not depend on Google
  Drive being continuously available.
- Expense data must be automatically backed up or synchronized to the owner's
  Google Drive after authorization.
- The user must be able to export their data directly as a plain file,
  independently of Google Drive.
- Stored and exported data must use simple, documented, broadly readable
  formats. JSON and CSV are the current candidates; the canonical format and
  export variants remain open.
- The data must not require a proprietary database or the application itself
  for basic inspection and analysis.
- Import/restore from the application's plain export is provisionally expected,
  but its merge, replacement, validation, and duplicate rules remain open.

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
- UI availability and rendering must be derived from XState snapshots, state
  matching, tags, selectors, and permitted events rather than duplicated
  component-level workflow flags.
- Durable expense records may live in an appropriate persistence layer, but
  access to and mutation of them must be coordinated by the actor system.
- React with `@xstate/react` is the provisional UI framework; it is not yet a
  final decision.

### Local Browser Storage

- IndexedDB is required for all locally persisted application data, including
  expenses, categories, collections/tags, settings, sync metadata, migrations,
  and retained invoice data if invoice retention is later approved.
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

- Is an expense one purchased line item, one receipt/invoice total, or either?
- When invoice items become separate entries, how is the invoice total,
  merchant, tax, discount, tip, quantity, and shared receipt image represented?
- Is time-of-day needed, or only a calendar date?
- Should attachments be retained after LLM processing? If so, locally, in
  Google Drive, or both?

### 2. Collections, Projects, and Tags

- Does an expense belong to exactly one separate collection, or can it have
  multiple tags?
- Is the intended separation about a trip/project, a financial account, a
  person, or another concept?
- Should collection be an additional filter alongside category, or should
  switching collections create isolated views and settings?
- What should this concept be called in the UI?

### 3. Currency Behavior

- Is the domestic currency only the default for new entries, or must all
  expenses also show a converted domestic value?
- If conversion is required, are exchange rates entered manually, fetched
  automatically, or captured from the actual card/bank conversion?
- Must historical exchange rates and the source of each rate be preserved?
- What precision and rounding rules are required?

### 4. Canonical Data and File Exchange

- Should JSON be the lossless canonical format with CSV as a flattened analysis
  export, or should CSV itself be canonical?
- Is import from exported files required as well as export?
- Should exports include all collections in one file or separate files?
- How will schema versions and future migrations be represented?
- Should monetary amounts use integer minor units, decimal strings, or another
  exact representation that avoids binary floating-point errors?

### 5. Local Persistence and Google Drive Sync

- Does "automatic backup" mean one-way snapshots, two-way multi-device sync,
  or both?
- Should Drive data use a normal user-visible folder or Google's hidden
  application-data folder?
- How quickly should local changes sync, and what manual sync/retry controls
  are needed?
- What happens when the user is signed out, offline, or revokes Drive access?
- How are edits and deletions represented and recovered?
- How should simultaneous edits from multiple devices be merged? Candidate
  approaches include append-only records, per-record IDs and revisions,
  tombstones for deletion, deterministic field/record merging, or explicit
  user conflict resolution. No strategy is agreed yet.
- What happens when two devices modify the same expense, category, or
  collection while offline?
- Which IndexedDB helper, if any, should be used while preserving transparent
  schema control and Deno 2 compatibility?

### 6. Google Access and Privacy

- Which Google Drive OAuth scopes are acceptable?
- Is access limited to one configured Google account?
- Since GitHub Pages is public, does the app shell need any additional access
  control, or is control of the connected Drive account sufficient?
- What data may be sent to Gemini, and what must be redacted or confirmed?

### 7. Gemini API-Key Architecture

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

### 8. Filtering and Reporting

- Do day/month/year filters mean a chosen calendar period, rolling periods, or
  both?
- Can filters be combined across date, category, currency, and collection/tag?
- Which list search and sorting controls are required for the initial release?
- Comparisons, trends, and charts are post-MVP possibilities. What historical
  fields or invariants must be retained now to support them later without
  complicating the initial UI?
- What timezone defines day/month/year boundaries?

### 9. Framework, PWA, and Browser Support

- Should React be confirmed, or is another UI layer preferred?
- Which mobile and desktop browsers and minimum versions must be supported?
- What must work offline beyond browsing and manual entry?
- How should install prompts, updates, and unsaved changes be communicated?
- How will the app handle GitHub Pages' repository base path, direct loads, and
  service-worker scope?

### 10. Testing and Visual Acceptance

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
2. Decide whether collections and tags are distinct concepts.
3. Define canonical storage/export data and multi-currency semantics.
4. Define local persistence, Google Drive sync, and conflict behavior.
5. Define the remaining Gemini model, privacy, and key UX details.
6. Confirm React, browser support, and detailed PWA behavior.
7. Agree on acceptance criteria and test tooling.
