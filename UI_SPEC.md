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
    |   +-- Export JSON / CSV
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

## Mobile Wireframes

### Screen 1: Expenses

**Status: approved.**

```text
+----------------------------------+
| Sweden project             Synced|
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

**Status: approved.** Child workflows remain open and are reviewed separately.

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
| SEK · Expense day 03:00   [Open] |
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
  configuration, domestic currency, and expense-day boundary.
- Destructive actions are inside **Data and privacy**, not exposed directly on
  the landing screen.
- Settings search is excluded initially and may be added only if the collection
  grows enough to justify it.
- Domestic currency and expense-day boundary are synchronized personal domain
  preferences. API key, selected Gemini model, image-preparation preference,
  last-selected project, OAuth tokens, and device-specific UI state remain
  local to each device.

### Screen 10: Google Drive and Synchronization

**Status: open.** Connection, account identity, manual and automatic sync,
offline/error/conflict states, known devices, account switching, and local
disconnection require separate approval.

### Screen 11: Gemini Receipt-Scanning Settings

**Status: open.** API-key replacement/removal, model selection, image
preparation, and capability-validation states require separate approval.

### Screen 12: Import and Export

**Status: open.** JSON/CSV export and merge/replace import workflows require
separate approval.

### Screen 13: Preferences

**Status: open.** Domestic currency, expense-day boundary, and later visual or
accessibility preferences require separate approval.

### Screen 14: Data and Privacy

**Status: open.** Disconnect, local deletion, Delete Everywhere, device
retirement, progress, and safety-export presentation require separate approval.

### Screen 15: About and Disclosure

**Status: open.** Version, AI disclosure, privacy explanation, licenses, and
update information require separate approval.

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

1. overall visual character and shell navigation;
2. Expenses list, period selection, filters, search, and totals;
3. manual entry and expense detail/editing;
4. receipt capture and review;
5. project and category organization;
6. synchronization, conflicts, import/export, and deletion;
7. first-use, installation, updates, offline, and other PWA states; and
8. desktop adaptations and final accessibility/visual acceptance criteria;
   and
9. only after all screens and workflows are agreed, select the UI component
   library/design system and settle detailed visual styling such as tokens,
   typography, icons, density, corners, and theme behavior.
