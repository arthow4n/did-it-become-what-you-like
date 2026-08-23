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
- The choice between a user-supplied browser key and a Deno Deploy proxy is
  open and must consider that a static frontend cannot keep a key secret.
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

### 6. Google Access and Privacy

- Which Google Drive OAuth scopes are acceptable?
- Is access limited to one configured Google account?
- Since GitHub Pages is public, does the app shell need any additional access
  control, or is control of the connected Drive account sufficient?
- What data may be sent to Gemini, and what must be redacted or confirmed?

### 7. Gemini API-Key Architecture

- Is entering and storing the owner's own API key locally in the browser an
  acceptable security tradeoff for this personal application?
- If not, should the invoice feature be the sole reason for introducing a
  minimal Deno Deploy backend?
- Where would a browser-supplied key be stored, how would it be cleared, and
  what should happen on a second device?
- Which Gemini model, structured-output schema, image limits, failure behavior,
  and usage controls are required?

### 8. Filtering and Reporting

- Do day/month/year filters mean a chosen calendar period, rolling periods, or
  both?
- Can filters be combined across date, category, currency, and collection/tag?
- Are totals, domestic-currency totals, charts, search, sorting, or saved filter
  views required?
- What timezone defines day/month/year boundaries?

### 9. Framework, PWA, and Browser Support

- Should React be confirmed, or is another UI layer preferred?
- Which mobile and desktop browsers and minimum versions must be supported?
- What must work offline beyond browsing and manual entry?
- How should install prompts, updates, and unsaved changes be communicated?

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
5. Decide the Gemini API-key security architecture.
6. Confirm React, browser support, and detailed PWA behavior.
7. Agree on acceptance criteria and test tooling.
