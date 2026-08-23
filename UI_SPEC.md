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

```text
+----------------------------------+
| < Back       Scan receipt        |
|                                  |
|     +----------------------+     |
|     |                      |     |
|     |  Receipt preview /   |     |
|     |  camera viewfinder   |     |
|     |                      |     |
|     +----------------------+     |
|                                  |
| [ Camera ]   [ Choose image ]    |
|                                  |
| Model [ compatible Gemini ... v ]|
| Image preparation: On            |
|                                  |
|          [ Scan with AI ]        |
+----------------------------------+
```

The same workflow must visibly represent preparing, requesting, validating,
offline, failure, and cancellation states. The XState scan actor owns these
modes; the UI must not infer them from unrelated booleans.

Open decisions: whether model and preparation controls remain visible here or
live only in Settings, and the preferred progress presentation.

### Screen 5: Receipt Review

```text
+----------------------------------+
| < Discard     Review receipt     |
| ICA Maxi Solna | 23 Aug | SEK    |
|                                  |
| ! Lines differ from total by 2.00|
|                                  |
| [x] Milk       Groceries  -18.90 |
|     qty 1 x 18.90      [ Edit ]  |
| [x] Bread      Groceries  -32.00 |
|     qty 2 x 16.00      [ Edit ]  |
| [x] Discount   Groceries   +5.00 |
|     Linked to Bread?     [ Edit ]|
| [ ] Unclear line  Uncategorized  |
|     AI: text was partly hidden   |
|                                  |
| [+ Add line]     Total: -45.90   |
|       [ Save 3 selected lines ]  |
+----------------------------------+
```

Open decisions: card versus table-like lines, inline versus separate editing,
how selected/skipped lines behave, and the strength and placement of mismatch
and uncertainty explanations.

### Screen 6: Organize and Settings

```text
+----------------------------------+  +----------------------------------+
| Organize                         |  | Settings                         |
|                                  |  |                                  |
| Projects                         |  | Google Drive       Synced      > |
| Sweden                    SEK  > |  | Gemini scanning    Configured  > |
| Taiwan                   TWD  > |  | Import and export               > |
| Trips                         > |  | Application preferences        > |
|                         [+ Add] |  |                                  |
|                                  |  | Data removal                     |
| Categories                       |  | Delete local data               > |
| Groceries                     > |  | Delete everywhere               > |
| Transport                     > |  |                                  |
| Uncategorized        Built-in   |  | Version and disclosure          > |
|                         [+ Add] |  |                                  |
|                                  |  |                                  |
| Expenses   [+]  Organize Settings|  | Expenses   [+]  Organize Settings|
+----------------------------------+  +----------------------------------+
```

These may become separate Projects and Categories screens if a combined page
is too long. Destructive actions must not visually compete with everyday
settings and require their already-specified confirmation workflows.

Open decisions: combined versus separate organization screens, category
reordering, project archival versus deletion, and grouping of advanced data and
sync controls.

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
