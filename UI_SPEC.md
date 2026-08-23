# UI/UX Specification Draft

## Status

This document is a living discussion aid, not an implementation plan. Decisions
explicitly listed as agreed are requirements; the remaining screen details and
workflows stay open until the repo owner approves them. No UI implementation
may begin merely because a wireframe appears here.

The wireframes are intentionally low fidelity. They define information
hierarchy, navigation, and important actions without prematurely choosing a
visual design system.

## Agreed Foundation

- The visual character is calm and minimal, with neutral surfaces and one
  restrained accent color. Exact design tokens remain open.
- Mobile uses bottom navigation for **Expenses**, central **Add**,
  **Organize**, and **Settings**. Desktop presents the same structure in a left
  navigation rail.
- The current project selector belongs in the Expenses header rather than in a
  separate permanent navigation destination.
- **Add** opens a choice between manual entry and **Scan with AI**. It is an
  action rather than an otherwise empty tab, and the initial design does not
  depend on a hidden long-press shortcut.
- **Organize** provides one landing screen for Projects and Categories; editing
  a project or category opens its own focused screen.
- Expenses is the primary read/review screen. Filters select which records are
  being examined, the expense list explains what was recorded, summary totals
  explain how much the selection represents, and the category breakdown
  explains where that money went.
- Totals are integrated into Expenses rather than placed on a separate totals
  screen. The summary distinguishes **Outflows**, **Money back**, and **Net
  spent** so positive adjustments are visible rather than silently hidden.
- Quick period choices include **Today**, **This month**, **This year**, and a
  custom calendar day/month/year. Secondary filtering can include category,
  currency, merchant search, and other later-agreed criteria. Every summary and
  list updates from the same active filter selection.
- Responsive layouts must give content a natural width and height, wrap where
  appropriate, and never depend on page-level horizontal scrolling. A control
  row which genuinely benefits from horizontal overflow, such as compact quick
  period choices on a very narrow screen, must be touch-draggable and keyboard
  operable. It must not use an unexplained arrow as a substitute for scrolling.

## Proposed Experience

The application should feel calm, direct, and trustworthy rather than like a
dense financial dashboard. Recording an expense should take little effort, and
reviewing historical spending should foreground readable amounts and category
totals. Advanced synchronization and data-management controls should remain
available without dominating ordinary use.

Agreed visual principles:

- use a quiet neutral surface with one restrained accent color;
- make signed amounts and currencies unambiguous without relying on red and
  green alone;
- prefer plain language and recognizable icons with text labels;
- use large touch targets and comfortable spacing on mobile;
- retain useful density on desktop without stretching mobile cards across the
  full window; and
- display offline, unsaved, synchronization, and conflict states consistently.

The exact color palette, typography, icon family, density, corner treatment,
and light/dark theme behavior remain open decisions.

## Proposed Navigation Tree

```text
Application shell
|
+-- Expenses (default destination)
|   +-- Current project selector
|   +-- Period and filter controls
|   +-- Category totals
|   +-- Expense list
|   |   +-- Expense details
|   |       +-- Edit expense
|   |       +-- Delete expense
|   +-- Add action
|       +-- Add manually
|       +-- Scan with AI
|           +-- Camera or image selection
|           +-- Preparing / scanning
|           +-- Receipt review
|           +-- Save result or return to editing
|
+-- Organize
|   +-- Projects
|   |   +-- Create / edit / delete project
|   +-- Categories
|       +-- Create / edit / reorder / delete category
|
+-- Settings
    +-- Google Drive and synchronization
    |   +-- Connect / disconnect
    |   +-- Sync status and known devices
    |   +-- Conflict review
    |   +-- Delete local data / delete everywhere
    +-- Gemini receipt scanning
    |   +-- API key
    |   +-- Model
    |   +-- Image preparation
    +-- Data portability
    |   +-- Export JSON
    |   +-- Import and preview
    +-- Application preferences
```

### Agreed shell

- Mobile uses a bottom bar with **Expenses**, central **Add**, **Organize**, and
  **Settings**. Add is an action which opens a choice between manual entry and
  AI scanning, not a persistent tab with its own empty page.
- Desktop uses the same destinations in a left navigation rail. The content
  area has a readable maximum width, while suitable list/detail screens may use
  two columns.
- The selected project appears prominently in the Expenses header because it
  changes the scope of lists and totals.
- A compact global status indicator communicates offline, syncing, conflict,
  or error state. Activating it opens the relevant synchronization details.

### First Use and Installation

**Status: approved.** There is no tutorial, walkthrough, or onboarding
carousel.

```text
+----------------------------------+
| did-it-become-what-you-like      |
|                                  |
| Start tracking expenses          |
|                                  |
| [ Create first project         ] |
| Start with local data             |
|                                  |
| [ Restore JSON backup          ] |
| Validate and preview before import|
|                                  |
| [ Connect Google Drive         ] |
| Continue with synchronized data   |
+----------------------------------+
```

- First launch presents only three useful paths: create the first local
  project, restore a versioned JSON backup, or connect Google Drive. Each path
  enters the already-approved focused workflow.
- Gemini configuration is optional and remains discoverable from **Scan with
  AI** and Settings; it does not block ordinary first use.
- The app assumes the owner can understand its plain labels. It never inserts a
  tutorial, feature tour, walkthrough, or carousel before useful work.
- The browser's install opportunity is not shown immediately on arrival. After
  the owner completes a durable useful action, such as saving the first expense
  or restoring data, a dismissible **Install app** action may appear when the
  platform supports it. Dismissal never blocks use, and installation remains
  available later from About when supported.
- Once the application shell and local data are cached, an offline launch opens
  normally. A compact, non-blocking offline indicator appears; local browsing,
  manual creation, editing, and deletion remain available. Drive sync and AI
  scanning are unavailable with concise explanations and resume when online.
- On a first launch while offline, creating a local project and restoring a
  local JSON backup remain available; Google Drive connection is disabled with
  an explanation.
- Online, offline, and reconnecting are explicit shell modes. Screen actions
  derive their availability from the actor snapshot so offline restrictions are
  consistent rather than recreated independently by each component.

## Mobile Wireframes

### Screen 1: Expenses

**Status: approved.**

```text
+----------------------------------+
| Sweden project             Synced|
|                                  |
| ! 2 conflicts need review        |
| [ Review conflicts             ] |
|                                  |
| [Today][Month][Year][Custom]     |
| [All categories] [Filters] [Find]|
|                                  |
| Net spent          SEK 4,358.50  |
| Outflows 4,382.50 | Back 24.00   |
|                                  |
| By category              View all|
| Groceries                  2,140  |
| Travel                     1,020  |
|                                  |
| Sun 23 Aug                       |
| ICA Maxi Solna · 8 receipt lines |
| Receipt          SEK -286.40     |
|                                  |
| SL                               |
| Transport        SEK -43.00      |
|                                  |
| Sat 22 Aug                       |
| Bottle return   SEK +24.00       |
|                                  |
| Expenses   [+]  Organize Settings|
+----------------------------------+
```

Agreed behavior:

- **This month** is the initial period. Today, This month, This year, and custom
  calendar selection remain quickly available.
- The three largest categories are shown initially with **View all**. Selecting
  a category applies it as a filter.
- A scanned receipt is summarized as one expandable row so a long receipt does
  not overwhelm the list; expanding it reveals its independently editable
  lines.
- An individual row shows merchant or description, category, signed amount,
  currency, and optional time when present. Full information is available from
  its details screen.
- Quick periods and category remain directly available. Search, currency,
  amount range, and other secondary criteria use a filter panel, with active
  criteria represented by removable chips.
- The category breakdown and all three totals always reflect exactly the same
  selected project and filters as the expense list.
- When unresolved conflicts exist anywhere in the dataset, Expenses shows a
  persistent, non-color-only banner with the count and a labeled Review action.
  The banner remains until resolution but does not block local entry, review,
  or synchronization of non-conflicting data.

### Screen 2: Add Choice

**Status: approved.**

```text
+----------------------------------+
| Expenses screen, dimmed          |
|                                  |
| +------------------------------+ |
| | Add an expense             X | |
| |                              | |
| | [ +  Add manually          ] | |
| |      Enter the details       | |
| |                              | |
| | [ Scan receipt with AI     ] | |
| |      Use camera or an image  | |
| |      Sends receipt to Gemini | |
| +------------------------------+ |
+----------------------------------+
```

Agreed behavior:

- Add Choice is a mobile bottom sheet over Expenses rather than a separate
  otherwise-empty page. Desktop uses the equivalent compact modal or popover.
- Manual entry is the first option and AI scanning is second. Both are large,
  full-width, labeled touch targets and do not depend on icon recognition.
- The AI choice includes a concise reminder that the receipt is sent to
  Gemini. The first-ever scan still presents the fuller agreed disclosure.
- The sheet closes through its labeled close control, browser Back, Escape, or
  tapping outside. Keyboard focus is contained and restored appropriately.
- When offline, manual entry remains enabled while AI scanning is visibly
  disabled with an explanation that an internet connection is required.
- No hidden long-press gesture is required for the initial release.

### Screen 3: Manual Expense

**Status: approved.** The same form is used to create and edit an expense.

```text
+----------------------------------+
| X            New expense         |
|                                  |
| Direction                        |
| [ Spent ]       [ Money back ]   |
|                                  |
| Amount *     [       0.00 ][SEK] |
| Merchant     [ ICA Maxi Solna  X]|
| Category *   [ Groceries       ] |
| Date *       [ Sat 22 Aug      ] |
|               Default expense day|
| Project *    [ Sweden          ] |
| Description  [                  ]|
| Time         [ --:--            ]|
|                                  |
| [ Save expense                 ] |
| [ Save and add another         ] |
+----------------------------------+
```

Agreed behavior:

- The owner enters a positive magnitude and chooses **Spent** or **Money
  back**. The form maps those choices to the agreed negative and positive
  persisted signs; it does not require manually typing a minus sign.
- A new form defaults to the current project's currency and project,
  `Uncategorized`, and the calendar date produced by the configured local
  expense-day boundary. Every default remains changeable.
- The chosen concrete date is always visible. For example, a form opened at
  01:30 with a 03:00 boundary shows the previous calendar date and identifies
  it as the default expense day rather than showing only an ambiguous “Today.”
- Amount, merchant, category, date, project, description, and time all remain
  visible; optional description and time are not hidden under a disclosure.
- Merchant is initially empty. Previously used exact merchant/branch names are
  offered as local suggestions, with recent matches prioritized, but no
  suggestion is forced. A one-tap clear control removes the field value.
- Saving returns to Expenses and briefly offers Undo. **Save and add another**
  clears record-specific values while retaining sensible defaults for batch
  entry. Closing a changed form requires discard confirmation.
- Opening an existing expense uses this same form populated with its current
  values. Every editable expense field can be changed, and saving updates the
  existing stable record rather than creating a replacement record.

### Screen 4: Scan Receipt

**Status: approved.**

```text
+----------------------------------+
| X            Scan receipt        |
|                                  |
| +------------------------------+ |
| |       Receipt preview        | |
| +------------------------------+ |
|                                  |
| [ Take photo ] [ Choose image ]  |
|                                  |
| Gemini: selected model           |
| Image preparation: On  [Options] |
|                                  |
| Receipt is sent to Google Gemini.|
|                                  |
| [ Scan with AI                 ] |
+----------------------------------+
```

Agreed behavior:

- **Take photo** invokes the device's native camera directly. The initial
  release does not build a custom camera viewfinder. **Choose image** uses the
  device's ordinary image picker.
- The chosen image is previewed before transmission and has clear Replace and
  Remove actions.
- The selected Gemini model and image-preparation status are summarized on the
  screen. **Options** expands model and preparation controls for this scan;
  persistent defaults also remain available in Settings.
- The concise Gemini transmission reminder remains visible. First use still
  requires the fuller agreed disclosure.
- When offline, scanning is disabled with an explanation while manual entry
  remains reachable. No selected image is queued for later transmission.
- With no API key, activating **Scan with AI** opens an in-place setup sheet
  over the scan screen rather than losing the selected image or navigating to
  Settings:

  ```text
  +------------------------------+
  | Set up Gemini             X  |
  |                              |
  | API key                      |
  | [ **************** ] [Show]  |
  |                              |
  | Stored on this device. It is |
  | not a browser secret.        |
  |                              |
  | [ Save and continue        ] |
  +------------------------------+
  ```

- The quick setup supports paste and explicit reveal/hide, validates the key,
  displays validation errors without closing, automatically remembers a valid
  key under the agreed namespaced `localStorage` rule, and resumes the pending
  scan after success. A native `window.prompt()` is not used.
- Scanning visibly progresses through in-memory preparation, requesting, and
  structured-output validation. It can be cancelled. Success opens Receipt
  Review; failure offers Retry, another image or model, and manual entry.

The XState scan actor owns image-selected, key-setup, key-validating,
preparing, requesting, output-validating, review-ready, offline, failed, and
cancelled modes. UI components must derive availability and rendering from
that workflow rather than recreating it with unrelated booleans.

### Screen 5: Receipt Review

**Status: approved.**

```text
+----------------------------------+
| X          Review receipt        |
|                                  |
| ICA Maxi Solna                   |
| Sat 22 Aug · SEK          [Edit] |
|                                  |
| Receipt total          -45.90    |
| Selected lines         -43.90    |
| Difference               2.00    |
| ! Review totals before saving    |
|                                  |
| [x] Milk                         |
|     Groceries            -18.90  |
|     1 x 18.90              Edit  |
|                                  |
| [x] Discount              +5.00  |
|     Possibly linked to Bread     |
|                                  |
| [ ] Unclear item                 |
|     Uncategorized                |
|     AI: text was partly hidden   |
|                                  |
| [ Add missing line             ] |
| [ Save 3 selected entries      ] |
+----------------------------------+
```

Agreed behavior:

- Exact merchant, date, currency, and printed receipt total appear at the top.
  Edit opens a compact receipt-metadata form.
- Lines use responsive natural-height cards. Editing or adding a line opens a
  focused bottom sheet containing description, category, signed amount,
  quantity, unit price, and an optional adjustment-to-item link.
- Confident, structurally valid extracted lines start selected. Seriously
  uncertain or incomplete lines start unselected and visibly explain why.
- Printed total, selected-line total, and their exact signed difference update
  continuously as lines are selected or edited.
- Saving atomically commits the parent receipt and every selected line. A
  remaining mismatch requires explicit confirmation. Closing a modified review
  requires discard confirmation.
- The receipt image remains unpersisted under the previously agreed ephemeral
  inference-input rule.

### Screen 6: Organize

**Status: approved.**

```text
+----------------------------------+
| Organize                         |
|                                  |
| Projects                         |
| ● Sweden                  SEK    |
|   Taiwan                  TWD    |
|   Japan trip              JPY    |
| [ Manage projects ] [ + New ]    |
|                                  |
| Categories                       |
|   Groceries                      |
|   Transport                      |
|   Uncategorized          Built-in|
| [ Manage categories ] [ + New ]  |
|                                  |
| Expenses   [+]  Organize Settings|
+----------------------------------+
```

Agreed behavior:

- Organize is one landing destination containing compact Projects and
  Categories sections.
- Each section previews up to three records and provides clearly labeled
  **Manage** and **New** actions. Larger collections remain on dedicated list
  screens rather than making the landing page excessively long.
- A project preview shows name, default currency, and the current-project
  indicator. Expense counts are not shown here.
- A category preview shows its name and identifies the built-in
  `Uncategorized` category.
- Sections and controls use natural-height responsive layout and ordinary
  vertical page scrolling.

### Screen 7: Manage Projects and Project Editor

**Status: approved, including the populated-project deletion child workflow
below.**

```text
+----------------------------------+
| < Organize      Manage projects  |
|                                  |
| Current project                  |
| Sweden                    SEK    |
|                         [ Edit ]  |
|                                  |
| Other projects                   |
| Taiwan                    TWD    |
|              [ Use ] [ Edit ]    |
|                                  |
| Japan trip                JPY    |
|              [ Use ] [ Edit ]    |
|                                  |
| [ + Create project             ] |
| Archived projects (2)   [ Show ] |
+----------------------------------+
```

Agreed behavior:

- Current, Other, and initially collapsed Archived sections organize the full
  project list.
- Switching requires an explicit **Use** action rather than an accidental row
  tap; editing is a separate action.
- Create and Edit use a focused bottom sheet on mobile and compact modal on
  desktop, containing at least project name and default currency. Renaming
  preserves the stable project ID and all relationships.
- The current project remains first. Other active projects support custom order
  through drag and accessible move controls.
- Archiving preserves a project and all of its expenses while hiding it from
  ordinary project switching. The current project must be switched before it
  can be archived. Archived projects can be restored.
- An empty project can be deleted after ordinary confirmation. At least one
  active project must remain so every new expense always has a valid project.

#### Screen 7A: Delete a Populated Project

**Status: approved.**

“Delete project” means more than deleting its label. Agreed behavior:

- the confirmation identifies the project and counts its expenses, receipt
  parents, purchase lines, adjustments, and affected currencies/date range;
- a complete JSON safety export is offered before deletion;
- confirmation requires typing the project name;
- commit atomically creates synchronized tombstones for the project and every
  expense, receipt parent, receipt line, and project-derived index entry which
  belongs to it;
- global categories, other projects, their records, the Gemini key, and
  unrelated settings remain unchanged;
- Drive synchronization carries the tombstones to other devices, and stale
  offline devices cannot resurrect the records under the agreed merge rules;
- this is logical synchronized deletion, not privacy erasure of Automerge
  history. Only the already-agreed delete-everywhere workflow physically
  destroys the entire dataset generation and history; and
- recovery after confirmation is through the safety JSON import rather than a
  casual toast Undo which could race with synchronization.

The current or sole active project cannot enter this workflow until another
active project is selected or created.

### Screen 8: Manage Categories and Category Editor

**Status: approved.**

```text
+----------------------------------+
| < Organize     Manage categories |
|                                  |
| [ Search categories            ] |
|                                  |
| =  ● Groceries            [Edit] |
| =  ● Transport            [Edit] |
| =  ● Restaurants          [Edit] |
|    ○ Uncategorized       Built-in|
|                                  |
| [ + Create category            ] |
| Archived categories (2)  [Show]  |
+----------------------------------+
```

Agreed behavior:

- Active categories appear in their global custom order; archived categories
  are initially collapsed. Search covers both sections and identifies archived
  matches.
- Create and Edit use a focused bottom sheet on mobile and compact modal on
  desktop. Name is required, color is optional, and icons are not part of the
  MVP. Color is never the only category identifier.
- After trimming surrounding whitespace, active category names are unique
  without regard to letter case. Restoring an archived category whose name now
  conflicts requires renaming it.
- Drag handles and accessible Move up/Move down actions change the same global
  order used by category pickers and the Gemini category catalogue.
- Archiving a used category preserves all historical relationships and keeps
  the category visible where old expenses require it, while excluding it from
  new-entry and Gemini choices. An empty custom category may be deleted after
  confirmation.
- **Delete and reassign** requires selecting a replacement category, defaulting
  to `Uncategorized`; previews the number of affected records across every
  project; atomically changes every reference and tombstones the old category;
  and synchronizes the operation to other devices.
- A deleted-category tombstone retains its replacement category ID. If a late
  offline revision arrives referencing the deleted category, synchronization
  deterministically redirects that reference to the replacement instead of
  resurrecting the category or leaving a broken relationship.
- Built-in `Uncategorized` has a stable semantic ID and cannot be renamed,
  archived, reordered, or deleted.

### Screen 9: Settings

**Status: approved.** Its child workflows are specified and approved below.

```text
+----------------------------------+
| Settings                         |
|                                  |
| Google Drive and sync            |
| Synced 2 minutes ago      [Open] |
|                                  |
| Gemini receipt scanning          |
| Key and model configured  [Open] |
|                                  |
| Preferences                      |
| Expense day 03:00         [Open] |
|                                  |
| Import and export         [Open] |
| Data and privacy          [Open] |
| About and disclosure      [Open] |
|                                  |
| Expenses   [+]  Organize Settings|
+----------------------------------+
```

Agreed behavior:

- The six groups appear in the order shown, prioritizing ordinary sync,
  scanning, and preference tasks over infrequent data administration.
- Rows show useful current summaries such as last synchronization, Gemini
  configuration, and expense-day boundary.
- Destructive actions are inside **Data and privacy**, not exposed directly on
  the landing screen.
- Settings search is excluded initially and may be added only if the collection
  grows enough to justify it.
- Expense-day boundary is a synchronized personal domain preference. API key,
  selected Gemini model, image-preparation preference, last-selected project,
  OAuth tokens, and device-specific UI state remain local to each device.

### Screen 10: Google Drive and Synchronization

**Status: approved.** Conflict review and known-device management are separate
approved child screens below.

```text
+----------------------------------+
| < Settings      Google Drive     |
|                                  |
| Connected account                |
| owner@example.com                |
|                                  |
| Status: Synced                   |
| Last sync: 2 minutes ago         |
| Pending local changes: 0         |
| [ Sync now                     ] |
|                                  |
| Automatic sync                   |
| After changes, launch, reconnect |
|                                  |
| Known devices: 2       [ Manage ]|
|                                  |
| [ Switch Google account        ] |
| [ Disconnect this device       ] |
|                                  |
| Cloud deletion: Data and privacy|
+----------------------------------+
```

Agreed behavior:

- The disconnected state offers **Connect Google Drive** and explains that the
  application requests only its hidden application-data folder.
- The connected state shows account identity, current sync mode, last
  successful sync, pending local changes, and **Sync now**.
- Automatic synchronization is attempted after local changes, on launch, and
  when connectivity or authorization returns.
- A prominent conflict card appears when needed, includes the unresolved count,
  and opens Conflict Review. Non-conflicting data may keep synchronizing.
- **Manage devices** shows the current device, optional editable labels, last
  seen, and deletion acknowledgement state for every known device.
- Offline mode truthfully shows locally saved pending changes rather than
  presenting them as lost. Manual sync is unavailable until online.
- Authorization failure offers Reconnect. Switching accounts requires explicit
  confirmation and never merges accounts automatically. **Disconnect this
  device** preserves local and cloud data; cloud deletion remains under Data
  and privacy.

### Screen 10A: Conflict Review

**Status: approved.** This screen is reachable from both the Expenses banner
and Google Drive settings.

```text
+----------------------------------+
| < Back        Conflicts 1 of 2   |
|                                  |
| ICA Maxi Solna · 22 Aug          |
| Conflicting field: Category      |
|                                  |
| Option 1                         |
| Groceries                        |
| Stockholm phone · 10:42          |
| [ Choose this value            ] |
|                                  |
| Option 2                         |
| Household                        |
| Laptop · 10:45                   |
| [ Choose this value            ] |
|                                  |
| [ Enter a different value      ] |
| [ Save and review next         ] |
+----------------------------------+
```

Agreed behavior:

- The workflow begins with conflicts grouped by affected expense or receipt,
  then reviews one conflicting field at a time. Mobile navigates list to detail;
  desktop may use an equivalent two-column layout.
- Every candidate is presented neutrally, with a device label and timestamp
  when known. Neither presentation order nor timestamp identifies an automatic
  winner.
- The owner may select any candidate or enter another value which passes the
  field's normal validation.
- Delete-versus-edit conflicts present explicit **Keep edited record** and
  **Delete record** actions and summarize the edits which deletion discards.
- Each successful choice commits locally as a resolution revision referencing
  all conflicting parents. Resolution works offline and joins normal sync
  later. The conflict count/banner changes only after the local commit succeeds.
- Workflow progress and unresolved candidates are durable, so closing,
  reloading, or a failed sync cannot lose completed resolutions or make the UI
  claim a conflict is resolved prematurely.

### Screen 10B: Known Devices

**Status: approved.**

```text
+----------------------------------+
| < Google Drive    Known devices  |
|                                  |
| Stockholm phone                  |
| This device · Seen now           |
|                         [Rename] |
|                                  |
| Laptop                           |
| Seen 2 days ago         [Rename] |
|                                  |
| Old tablet                       |
| Seen 5 months ago       [Rename] |
|                                  |
| Devices receive changes only     |
| when the app reconnects.         |
+----------------------------------+
```

- New devices receive neutral default labels such as `Device 1`; labels may be
  renamed and synchronize so the owner can recognize them on other devices.
- The list identifies the current device and shows approximate last-seen and,
  when relevant, dataset-retirement/deletion-acknowledgement status.
- Opaque device IDs stay out of the ordinary interface and appear only in an
  optional technical-details view for diagnostics.
- Devices are never automatically removed merely because they have been
  inactive for a long time.
- Ordinary synchronization has no casual **Remove device** or **Mark lost**
  action. Lost-device handling and forced finalization exist only inside the
  strongly warned **Delete Everywhere** workflow, where their consequences are
  relevant and explicit.

### Screen 11: Gemini Receipt-Scanning Settings

**Status: approved.**

```text
+----------------------------------+
| < Settings      Gemini scanning  |
|                                  |
| API key                          |
| ••••••••••••ABCD        [Remove] |
| Stored only on this device       |
|                                  |
| Model                            |
| [ Search models...             ] |
| Gemini … · Compatible            |
| Gemini … · Incompatible          |
| [ Refresh available models     ] |
|                                  |
| Image preparation          [ On ]|
| Resize/compress before sending   |
| Changeable while scanning        |
|                                  |
| [ Test configuration           ] |
+----------------------------------+
```

- A stored key is masked and has a single **Remove** action. There is no
  redundant **Replace** action: to change the key, remove it and enter the new
  key in the empty state. Removing it disables only AI scanning and leaves all
  expense data untouched.
- The model picker has type-ahead search because the returned model list may be
  long. It identifies receipt-compatible choices and explains why an exposed
  model is incompatible rather than treating every returned model as usable.
- Refreshing models uses the entered key's available-model list. If the selected
  model disappears or becomes incompatible, scanning pauses and asks for a new
  selection instead of silently substituting one.
- Image preparation is a device-local on/off default and can be overridden for
  an individual scan.
- **Test configuration** checks the key, chosen model, and required capabilities
  without sending a real receipt or expense data.
- The screen distinguishes an invalid key, unavailable or deprecated model,
  quota/rate limit, offline state, and an otherwise unknown service error, and
  gives a relevant corrective action for each. These are explicit workflow
  modes rather than overlapping UI booleans.

### Screen 12: Import and Export

**Status: approved.** CSV is deferred beyond the MVP; this screen uses only the
lossless, versioned JSON format.

```text
+----------------------------------+
| < Settings      Import & export  |
|                                  |
| Export                           |
| [ Export complete backup       ] |
| Versioned JSON · all projects    |
| Suitable for inspection/restore  |
|                                  |
| Import                           |
| [ Choose JSON backup           ] |
| Validated and previewed first     |
+----------------------------------+
```

When the browser supports sharing files, a successful export may additionally
offer the native share sheet; a normal file download is always available.

```text
+----------------------------------+
| < Import          Preview        |
|                                  |
| Valid JSON backup                |
| Schema 2 · no migration needed   |
| 3 projects · 18 categories       |
| 1,240 expenses · 42 receipts     |
|                                  |
| [ Merge into current data      ] |
| Recommended · works offline      |
|                                  |
| Replace all current data         |
| Creates a new dataset generation |
| [ Review replacement risks     ] |
+----------------------------------+
```

- Validation and preview show the schema version, record counts, required
  migrations, warnings, and blocking errors before any mutation. An invalid
  file cannot advance to commit.
- **Merge** is the prominent recommended action. It works offline, commits
  atomically, and sends resulting conflicts and revisions through the ordinary
  synchronization and conflict-review workflows.
- **Replace** is visually separated as destructive. It requires a successful
  automatic JSON safety export and strong confirmation. With Drive configured,
  it also requires an online pre-sync; without Drive, local replacement remains
  available offline.
- The focused import actor owns explicit choosing, validating, previewing,
  preparing, committing, synchronizing, conflict, completed, and failure modes.
  The UI derives progress and available actions from those modes.

### Screen 13: Preferences

**Status: approved.** Project currency is sufficient for the MVP.
Domestic/reporting currency and cross-currency conversion are deferred as one
later feature batch with historical exchange-rate support and must not be
implemented during MVP work.

```text
+----------------------------------+
| < Settings          Preferences  |
|                                  |
| Expense-day boundary             |
| [ 03:00                         ] |
|                                  |
| Before this local time, a new     |
| manual expense defaults to the    |
| previous calendar date.           |
|                                  |
| Example                          |
| Entered at 01:30 on 24 August     |
| Suggested date: 23 August         |
+----------------------------------+
```

- The boundary uses the platform's native time input and shows a live example
  with concrete dates so its effect is unambiguous.
- It is evaluated using the device's current local wall-clock time and timezone
  when a new manual form opens, including while travelling.
- The calculation only chooses the initial calendar-date value. Once chosen or
  edited, that stored date is stable and is not changed when the device later
  enters another timezone.
- Day, month, and year filters operate on stored calendar dates rather than
  converting them between timezones.
- No speculative visual or accessibility preferences are added to this screen;
  those can be introduced later only when a concrete need emerges.

### Screen 14: Data and Privacy

**Status: approved.**

```text
+----------------------------------+
| < Settings      Data & privacy   |
|                                  |
| Receipt images                   |
| Never stored after AI processing |
|                                  |
| Gemini API key                   |
| Stored only on this device       |
|                                  |
| Data actions                     |
| [ Disconnect this device       ] |
| Keeps local and Drive data       |
|                                  |
| [ Delete this device's data    ] |
| Keeps Drive and other devices    |
|                                  |
| Delete everywhere                |
| Erases Drive and reconnecting     |
| devices                           |
| [ Review deletion              ] |
+----------------------------------+
```

- The three actions are visually separate and state their scope before the
  owner enters any confirmation flow.
- **Disconnect this device** stops synchronization but preserves this device's
  local dataset and all synchronized Drive data.
- **Delete this device's data** erases this device's local dataset and also
  disconnects it, preventing an immediate cloud re-download. It does not affect
  Drive or other devices. Its confirmation includes **Remove Gemini API key**,
  checked by default.
- **Delete everywhere** first offers a complete JSON safety export. Declining
  the export requires an additional explicit confirmation before the destructive
  action can continue.
- Delete Everywhere progress distinguishes publishing retirement, deleting the
  Drive generation, erasing this device, and acknowledgement by each known
  device. It explains that an offline device cannot be erased until it runs and
  reconnects.
- Lost-device finalization exists only within this progress workflow, behind a
  strong warning that the inaccessible browser copy cannot be erased. It is not
  an ordinary device-list action.
- The focused deletion actor owns explicit scope selection, confirmation,
  safety export, retirement publication, Drive deletion, local erasure,
  awaiting-device, forced-finalization, completed, and failure modes. Its
  non-financial progress state must survive reloads until the workflow reaches a
  terminal state.

### Screen 15: About and Disclosure

**Status: approved.**

```text
+----------------------------------+
| < Settings               About   |
|                                  |
| did-it-become-what-you-like      |
| Version 0.1.0 · build abc1234    |
| [ Check for updates            ] |
|                                  |
| Generative AI usage disclosure   |
| This application is 100%         |
| vibe-coded using ChatGPT Codex    |
| and Google Antigravity.           |
|                                  |
| Privacy                          |
| Local-first · no analytics or ads |
| [ Data and privacy details     ] |
|                                  |
| [ Open-source licenses         ] |
| [ View source on GitHub        ] |
+----------------------------------+
```

- Version information includes the release version and short Git commit hash so
  a deployed build can be identified precisely during diagnosis.
- The generative-AI disclosure uses the exact wording already published in
  `README.md`.
- The privacy summary states that the app is local-first and has no analytics,
  advertising, or unrelated tracking, with a link to the detailed Data and
  Privacy screen.
- Open-source information presents the application's license and third-party
  notices. The source action opens this repository on GitHub.
- **Check for updates** has explicit checking, up-to-date, update-ready,
  offline, and failure modes. When a new service worker is ready, the owner gets
  an explicit **Reload to update** action; the app never surprises the owner
  with a reload which could discard unsaved input.

## Cross-Cutting UI States

Each relevant screen must eventually define and approve these states rather
than only its ideal populated state:

- first use and empty data;
- loading and local saving;
- offline and reconnecting;
- synchronization in progress, conflict, retryable error, and retired dataset;
- AI preparation, request, invalid output, and retry;
- form validation, unsaved changes, and cancellation;
- import preview, replacement warning, and migration failure; and
- deletion pending, awaiting devices, finalized, and forced finalization.

## Screen Approval Checklist

A screen is not approved until the owner agrees on:

1. its purpose and entry/exit paths;
2. the information and actions visible by default;
3. its mobile layout and desktop adaptation;
4. empty, loading, offline, error, conflict, and destructive states which apply;
5. accessibility behavior, including keyboard order, labels, focus, and touch
   target expectations; and
6. acceptance examples suitable for later end-to-end and visual testing.

## Prioritized Open Decisions

The UI should be agreed incrementally in this order:

1. shell navigation and information architecture;
2. Expenses list, period selection, filters, search, and totals;
3. manual entry and expense detail/editing;
4. receipt capture and review;
5. project and category organization;
6. synchronization, conflicts, import/export, and deletion;
7. first-use, installation, updates, offline, and other PWA states;
8. desktop adaptations and final accessibility/visual acceptance criteria;
9. only after all screens and workflows are agreed, select the UI component
   library/design system and settle detailed visual styling such as tokens,
   typography, icons, density, corners, and theme behavior;
10. document reusable components, interaction patterns, and responsive rules in
    the chosen design system before implementing application screens; and
11. only then create a dependency-ordered implementation plan with milestones,
    prerequisites, acceptance checks, and safe parallel workstreams for owner
    approval. Planning does not itself authorize implementation.
