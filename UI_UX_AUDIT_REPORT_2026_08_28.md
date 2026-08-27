# Comprehensive UI/UX Audit & Mobile Form Ergonomics Report

**Audit Date**: 2026-08-28\
**Audit Viewports Captured**:

- **Desktop**: 1280 × 800 px
- **Mobile**: 390 × 844 px
- **Narrow Mobile**: 320 × 568 px\
  **Evidence Artifacts**: 96 screenshots captured across all canonical screens
  in `ui-audit-2026-08-28/round-1-screenshots/`.

---

## 1. Executive Summary & Audit Verdict

This UI/UX audit was conducted to identify usability, layout, and visual defects
across the application, with special scrutiny given to **form UI ergonomics**,
**mobile button spanning (full-width vs. awkward natural width)**, and **compact
viewport resiliency (320px–390px)**.

### Dimension Health Scores

| Dimension                              |    Rating     | Key Finding Summary                                                                                                                                                                                                       |
| :------------------------------------- | :-----------: | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **1. Visual Hierarchy & Tokens**       | ⚠️ Needs Work | Colors and typography follow semantic tokens, but button styles and badges suffer from awkward natural widths and truncation (`CUR...`).                                                                                  |
| **2. Layout & Viewport Resiliency**    | ❌ Defective  | Severe text wrapping bugs on 320px/390px (`Uncat-egori-zed`), period segmented control horizontal overflow, and sticky bottom navigation obscuring action buttons.                                                        |
| **3. Mobile Form Ergonomics**          | ❌ Defective  | Disconnected `Amount` + `Currency` and `Date` + `Time` stacked vertically into giant full-page scrolls; isolated buttons with natural widths.                                                                             |
| **4. Button Width & Action Placement** | ❌ Defective  | Multiple primary actions (`Scan with AI`, `Save selected`, `Add expense`, `Delete this expense`, `Filters`, `Create project`) render with tiny natural widths and lopsided alignments instead of spanning 100% on mobile. |
| **5. Overlay & Dialog Polish**         | ⚠️ Needs Work | Dialog footers invert button stacking (`Cancel` above `Save`), and confirm notices place side-by-side natural buttons that wrap erratically.                                                                              |

---

## 2. Comprehensive Findings Catalog

### P1 Defects (High Severity: Broken Layouts, Clipped Elements & Touch Target Failures)

1. **[P1-01] ListRow Text Wrapping & Severe Word Breaking (`ExpensesScreen`,
   `CategoryBreakdown`)**:
   - _Target_: `src/features/local-ui.tsx` (L1086-1140, L2800-2850),
     `src/design-system/tokens.css` (L930-980).
   - _Symptom_: Category names wrap character-by-character on mobile
     (`"Uncat" / "egori" / "zed"`) and expense rows wrap
     `"Uncategorize" / "d · 2026-08-27"`.
   - _Root Cause_: `.ds-list-row` lacks `min-width: 0` on its content container
     and uses unconstrained flex shrink.

2. **[P1-02] Segmented Control Period Picker Overflows Screen
   (`ExpensesScreen`)**:
   - _Target_: `src/features/local-ui.tsx` (L850-920),
     `src/features/local-ui.css` (L120-160).
   - _Symptom_: On 320px screens, `[ Today | This month | This year | Custom ]`
     overflows past the right viewport margin.
   - _Root Cause_: Minimum segment width (`min-width: 80px`) without overflow
     scrolling or mobile segment wrapping.

3. **[P1-03] Bottom Navigation Obscuring Bottom Action Buttons
   (`DataPrivacyScreen`)**:
   - _Target_: `src/design-system/tokens.css` (L153-160, L1041-1048),
     `src/features/destruction-ui.tsx` (L450-480).
   - _Symptom_: On mobile, fixed bottom navigation overlays the "Delete
     everywhere" button and danger cards.
   - _Root Cause_: Insufficient bottom padding on `.ds-app-frame__main` to clear
     fixed navigation + safe area in all views.

---

### P2 Defects (Medium Severity: Form Ergonomics & Awkward Natural-Width Buttons)

4. **[P2-01] Manual Expense Form: Disjointed Amount & Currency Stacking**:
   - _Target_: `src/features/local-ui.tsx` (L2510-2530),
     `src/features/local-ui.css` (L40-80).
   - _Symptom_: On mobile (`< 720px`), `Amount` is followed by an isolated
     100%-wide `Currency` dropdown row, pushing merchant and category below the
     fold.
   - _Recommendation_: Pair Amount (flex 1) and Currency (compact fixed 96px)
     side-by-side in a single row on all mobile viewports.

5. **[P2-02] Manual Expense Form: Date & Time Split Onto Separate Full Rows**:
   - _Target_: `src/features/local-ui.tsx` (L2540-2555),
     `src/features/local-ui.css` (L50-70).
   - _Symptom_: `Date` and `Time` take two vertical full-width rows, adding
     unnecessary scrolling.
   - _Recommendation_: Pair `Date` (~60%) and `Time` (~40%) on a single
     responsive row on mobile.

6. **[P2-03] Natural-Width Danger Action in Expense Edit ("Delete this
   expense")**:
   - _Target_: `src/features/local-ui.tsx` (L2585-2605).
   - _Symptom_: `Delete this expense` is wrapped in an inline notice with
     natural width (~180px) floating inside a full-width container.
   - _Recommendation_: Span `Delete this expense` full-width (`width: 100%`)
     within its confirmation card.

7. **[P2-04] Natural-Width Sticky Action Bars (`ReceiptScanScreen`,
   `ReceiptReviewScreen`)**:
   - _Target_: `src/features/receipt-ui.tsx` (L980-990, L1610-1630),
     `src/design-system/tokens.css` (L980-994).
   - _Symptom_: `[ Scan with AI ]` and `[ Save 1 selected entry ]` sit
     right-aligned with natural width (~160px) in bottom sticky bars, leaving
     60% empty black space.
   - _Recommendation_: In `.ds-sticky-action-bar` on mobile, primary actions
     must span 100% width.

8. **[P2-05] Natural-Width Secondary & Helper Triggers (`ExpensesScreen`,
   `ProjectManager`, `CategoryManager`)**:
   - _Target_: `src/features/local-ui.tsx` (L750, L1230, L1840).
   - _Symptom_: `[ Add expense ]`, `[ Filters ]`, `[ Create project ]`, and
     `[ Create category ]` buttons float with natural width in full-width
     containers.
   - _Recommendation_: Expand header actions to full-width or integrate them
     into structured toolbars on mobile.

9. **[P2-06] Project & Category List Rows Cluttered With 6 Unstructured
   Buttons**:
   - _Target_: `src/features/local-ui.tsx` (L1440-1510, L2020-2070).
   - _Symptom_: On mobile, `[ Use ]`, `Edit`, `Move up`, `Move down`, `Archive`,
     and `[ Delete empty ]` are placed in raw wrapping `<Inline>` rows, causing
     irregular jagged lines.
   - _Recommendation_: Refactor list row actions into a structured 2-tier
     layout: primary status/switch action + cleanly formatted icon or secondary
     action grid.

10. **[P2-07] Inverted Dialog Action Hierarchy (Cancel above Primary)**:
    - _Target_: `src/design-system/tokens.css` (L1081-1102),
      `src/design-system/components.tsx` (L1080-1110).
    - _Symptom_: `FormActions` with `column-reverse` places the secondary/cancel
      button on TOP and primary button on BOTTOM on mobile, leading to
      misclicks.
    - _Recommendation_: Keep Primary CTA on top and Secondary/Cancel button on
      bottom in mobile vertical button stacks.

---

## 3. Screen-by-Screen Proposed Form Arrangements (with ASCII UI Wireframes)

### A. Manual Expense Form (`ManualExpenseScreen`)

#### Current Arrangement (Mobile)

```
+--------------------------------------------------+
| < Back     New expense                           |
+--------------------------------------------------+
| [ Unsaved changes notice                       ] |
|                                                  |
| [ (•) Spent          ( ) Money back            ] |
|                                                  |
| Amount *                                         |
| [ 450                                          ] |
|                                                  |
| Currency                                         |
| [ SEK                                        v ] |
|                                                  |
| Merchant                                         |
| [ Nordic Market                              x ] |
|                                                  |
| Category                                         |
| [ Uncategorized                              v ] |
|                                                  |
| Date *                                           |
| [ 2026-08-27                                   ] |
|                                                  |
| Time (optional)                                  |
| [ --:-- --                                     ] |
|                                                  |
| Project                                          |
| [ Personal Budget                            v ] |
|                                                  |
| Description (optional)                           |
| [ Weekly grocery shopping                      ] |
|                                                  |
| [ Save expense (100%)                          ] |
| [ Save and add another (100%)                  ] |
|                                                  |
| [ Delete notice: [ Delete (natural) ]          ] |
+--------------------------------------------------+
```

#### Proposed Ergonomic Arrangement (Mobile)

```
+--------------------------------------------------+
| < Back     New expense                           |
+--------------------------------------------------+
| [ Unsaved changes banner                       ] |
|                                                  |
| [ (•) Spent          ( ) Money back            ] |
|                                                  |
| +--------------------------------+ +-----------+ |
| | Amount *                       | | Currency  | |
| | [ 450.00                     ] | | [ SEK v ] | |
| +--------------------------------+ +-----------+ |
|                                                  |
| Merchant                                         |
| [ Nordic Market                              x ] |
|                                                  |
| Category                                         |
| [ 🏷️ Uncategorized                           v ] |
|                                                  |
| +------------------------+ +-------------------+ |
| | Date *                 | | Time (opt)        | |
| | [ 2026-08-27         ] | | [ 14:30         ] | |
| +------------------------+ +-------------------+ |
|                                                  |
| Project                                          |
| [ 📁 Personal Budget                         v ] |
|                                                  |
| Description (optional)                           |
| [ Weekly grocery shopping                      ] |
|                                                  |
| ================= Form Actions ================= |
| [ Save expense (Primary Full-Width)            ] |
| [ Save and add another (Secondary Full-Width)  ] |
|                                                  |
| [ Danger Zone Card                             ] |
| [ Delete this expense (Danger Full-Width)      ] |
+--------------------------------------------------+
```

---

### B. Expenses Screen (`ExpensesScreen`) & Filter Bar

#### Current Arrangement (Mobile)

```
+--------------------------------------------------+
| Personal Budget                                  |
| Expenses                                         |
| Review selected project and period.              |
| [ Add expense (natural width float left) ]       |
|                                                  |
| Project                                          |
| [ Personal Budget                            v ] |
|                                                  |
| [ Today | This month | This year | Cust... (OVR) ]
| Category                                         |
| [ All categories                             v ] |
| Find                                             |
| [ Search merchant or description               ] |
| [ Filters (natural width float left) ]           |
|                                                  |
| Net spent: SEK -535.50                           |
| Outflows:  SEK -535.50                           |
|                                                  |
| By category                                      |
| +----------------------------------------------+ |
| | Uncat                                        | |
| | egori    SEK -535.50                         | |
| | zed                                          | |
| +----------------------------------------------+ |
+--------------------------------------------------+
```

#### Proposed Ergonomic Arrangement (Mobile)

```
+--------------------------------------------------+
| Personal Budget                                  |
| Expenses                                         |
|                                                  |
| [ + Add expense (Full-Width Primary Action)    ] |
|                                                  |
| Project                                          |
| [ 📁 Personal Budget                         v ] |
|                                                  |
| Period                                           |
| [ Today ][ This month ][ This year ][ Custom ]   |
| (Scrollable / auto-fitting segmented pill row)   |
|                                                  |
| +-----------------------------+ +--------------+ |
| | Find                        | | Filters      | |
| | [ 🔍 Merchant/desc...     ] | | [ ⚙️ Filters ]| |
| +-----------------------------+ +--------------+ |
|                                                  |
| Category                                         |
| [ 🏷️ All categories                          v ] |
|                                                  |
| +----------------------------------------------+ |
| | Net Spent: SEK -535.50                       | |
| | Outflows:  SEK -535.50  ·  Back: SEK 0       | |
| +----------------------------------------------+ |
|                                                  |
| By category                                      |
| +----------------------------------------------+ |
| | Uncategorized (nowrap)          SEK -535.50  | |
| +----------------------------------------------+ |
+--------------------------------------------------+
```

---

### C. Project & Category Management Screens (`ProjectManager`, `CategoryManager`)

#### Current Arrangement (Mobile)

```
+--------------------------------------------------+
| < Back     Manage projects                       |
+--------------------------------------------------+
| [ Create project (natural width) ]               |
|                                                  |
| Current project                                  |
| +----------------------------------------------+ |
| | Personal Budget                 [ CURR... ]  | |
| | SEK                                          | |
| | Edit (natural text)                          | |
| +----------------------------------------------+ |
|                                                  |
| Other projects                                   |
| +----------------------------------------------+ |
| | Trip to Tokyo         [ Use ]   Edit         | |
| | SEK                                          | |
| | Move up    Move down                         | |
| | Archive    [ Delete empty ]                  | |
| +----------------------------------------------+ |
+--------------------------------------------------+
```

#### Proposed Ergonomic Arrangement (Mobile)

```
+--------------------------------------------------+
| < Back     Manage projects                       |
+--------------------------------------------------+
| [ + Create project (Full-Width Action)         ] |
|                                                  |
| Current project                                  |
| +----------------------------------------------+ |
| | 📁 Personal Budget            [ CURRENT ]    | |
| | Currency: SEK                                | |
| | [ Edit project details (Full-Width Quiet)  ] | |
| +----------------------------------------------+ |
|                                                  |
| Other projects                                   |
| +----------------------------------------------+ |
| | 📁 Trip to Tokyo               Currency: SEK | |
| | +------------------------------------------+ | |
| | | [ Switch to project (Primary)          ] | | |
| | | [ Edit ] [ ↑ Up ] [ ↓ Down ] [ Archive ] | | |
| | | [ Delete empty project (Danger)        ] | | |
| | +------------------------------------------+ | |
| +----------------------------------------------+ |
+--------------------------------------------------+
```

---

### D. Receipt Scan & Review Screens (`ReceiptScanScreen`, `ReceiptReviewScreen`)

#### Current Arrangement (Mobile)

```
+--------------------------------------------------+
| Close     Scan receipt                           |
+--------------------------------------------------+
| [ Selected receipt preview image               ] |
| [ Take photo ]  [ Choose image ]  [ Remove ]     |
|                                                  |
| [ Model options dropdown                       ] |
|                                                  |
| ---------------- Sticky Bar -------------------- |
|                            [ Scan with AI ]      |
|                        (natural width, right)    |
+--------------------------------------------------+
```

#### Proposed Ergonomic Arrangement (Mobile)

```
+--------------------------------------------------+
| Close     Scan receipt                           |
+--------------------------------------------------+
| [ Selected receipt preview image               ] |
|                                                  |
| +-----------------------+ +--------------------+ |
| | [ 📷 Retake photo ]   | | [ 📁 Choose file ] | |
| +-----------------------+ +--------------------+ |
| [ 🗑️ Remove image (Quiet Full-Width)           ] |
|                                                  |
| Model: [ Gemini 2.5 Flash                    v ] |
| [x] Compress and optimize image                  |
|                                                  |
| ================ Sticky Bottom Bar ============= |
| [ 🚀 Scan with AI (Full-Width 100% Primary)    ] |
+--------------------------------------------------+
```

---

## 4. Prioritized Remediation Checklist

- [ ] **STEP-01: Form Component & Row Discipline** (`src/features/local-ui.tsx`,
      `src/features/local-ui.css`)
  - Configure `Amount` + `Currency` 2-column flex row on mobile
    (`min-width: 0`).
  - Configure `Date` + `Time` 2-column flex row on mobile.
  - Make `Delete this expense` confirmation button span 100% full width.
- [ ] **STEP-02: Action Button Spanning on Mobile**
      (`src/design-system/tokens.css`, `src/design-system/components.tsx`)
  - Ensure all `.ds-sticky-action-bar` child primary buttons default to
    `width: 100%` on `< 720px`.
  - Fix `FormActions` vertical ordering: Primary on TOP, Secondary/Cancel on
    BOTTOM.
  - Update `PageHeader` mobile action button to span full width or integrate
    into top bar.
- [ ] **STEP-03: Resilient Text & Badge Formatting**
      (`src/design-system/tokens.css`, `src/features/local-ui.tsx`)
  - Fix `.ds-list-row` text truncation and word-wrap
    (`word-break: normal; overflow-wrap: anywhere; min-width: 0;`).
  - Fix `Badge` sizing and avoid truncating `"CURRENT"` badge on mobile.
  - Adjust `.ds-segmented-control` on mobile to support clean horizontal scroll
    without clipping.
- [ ] **STEP-04: Manager Card Restructuring** (`src/features/local-ui.tsx`)
  - Reorganize project and category card action buttons into clean, accessible
    2-tier button grids.
  - Make `Create project` and `Create category` full-width buttons on mobile.
- [ ] **STEP-05: Receipt Flow Polish** (`src/features/receipt-ui.tsx`)
  - Make `Scan with AI` and `Save selected entries` full-width in sticky action
    bars.
  - Format `Add missing line` as a clear full-width secondary button.
- [ ] **STEP-06: Layout Clearance & Viewport Verification**
  - Increase `.ds-app-frame__main` bottom padding to prevent bottom navigation
    overlap across all screens.
  - Verify with Playwright automated visual suite on 1280px, 390px, and 320px
    viewports.

---

## 5. Verification Proof & Evidence Matrix

- Screenshots preserved in `ui-audit-2026-08-28/round-1-screenshots/`:
  - `desktop-*.png` (32 screens)
  - `mobile-*.png` (32 screens)
  - `narrow-*.png` (32 screens)
- Automated Playwright capture spec: `e2e/ui-audit-capture.spec.ts`.
