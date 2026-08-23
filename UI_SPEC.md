# UI/UX Specification Draft

## Status

This document is a provisional discussion aid, not an approved design or an
implementation plan. Every screen and workflow remains open until the repo
owner explicitly agrees to it. No UI implementation may begin merely because a
wireframe appears here.

The wireframes are intentionally low fidelity. They define information
hierarchy, navigation, and important actions without prematurely choosing a
visual design system.

## Proposed Experience

The application should feel calm, direct, and trustworthy rather than like a
dense financial dashboard. Recording an expense should take little effort, and
reviewing historical spending should foreground readable amounts and category
totals. Advanced synchronization and data-management controls should remain
available without dominating ordinary use.

Provisional visual principles:

- use a quiet neutral surface with one restrained accent color;
- make signed amounts and currencies unambiguous without relying on red and
  green alone;
- prefer plain language and recognizable icons with text labels;
- use large touch targets and comfortable spacing on mobile;
- retain useful density on desktop without stretching mobile cards across the
  full window; and
- display offline, unsaved, synchronization, and conflict states consistently.

The exact color palette, typography, icon family, density, corner treatment,
and light/dark theme behavior are open decisions.

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

### Shell proposal

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

```text
+----------------------------------+
| Sweden project             Synced|
| v                                |
|                                  |
| [ Aug 2026 v ] [ Filters (1) ]   |
|                                  |
| Total                            |
| SEK -4,382.50                    |
| Food -2,140  Travel -1,020  ...  |
|                                  |
| Sun 23 Aug                       |
| ICA Maxi, Solna                  |
| Groceries       SEK -286.40      |
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

Open decisions: how period selection works, whether category totals are chips,
cards, or a compact list, where search appears, and how much information each
expense row shows.

### Screen 2: Add Choice

```text
+----------------------------------+
| Expenses                         |
|                                  |
|          Add an expense          |
|                                  |
|  [ Edit  Add manually          ] |
|  [ Scan  Scan receipt with AI  ] |
|                                  |
|  Scanning sends the image and    |
|  extracted content to Gemini.    |
|                                  |
|                    [ Cancel ]    |
+----------------------------------+
```

Open decisions: bottom sheet versus full screen, whether the camera can be
launched directly by holding the Add button, and the final labels/icons.

### Screen 3: Manual Expense

```text
+----------------------------------+
| < Cancel      New expense    Save|
|                                  |
| Amount                           |
| [ -  ][        0.00 ][ SEK v ]   |
|                                  |
| Category *   [ Groceries      v ]|
| Project *    [ Sweden         v ]|
| Date *       [ 2026-08-23       ]|
| Time         [ --:--             ]|
| Merchant     [                    ]|
| Description  [                    ]|
|                                  |
|              [ Save expense ]    |
+----------------------------------+
```

Open decisions: fastest signed-amount control, field order, whether uncommon
fields collapse under “More details,” and post-save destination.

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
8. desktop adaptations and final accessibility/visual acceptance criteria.
