# Round 2 UI & UX Audit Report: Post-Fix Visual Review & Verification

**Date:** 2026-08-26  
**Auditor:** Antigravity UI & Design System Agent  
**Design System:** *After Midnight*  
**Scope:** Verification of 13 completed audit fixes across Desktop (`1280×800`), Mobile (`390×844`), and Narrow (`320×568`) viewports.  
**Repository State:** All 13 fixes integrated, unit tested, component tested, accessibility verified with axe-core, and built for production.

---

## 1. Executive Summary & Verification Outcome

In Round 1, a comprehensive UI audit identified 13 structural defects across mobile navigation placement, input component bounds, toast layout shifts, typography/asterisk breaks, flexbox/grid vertical stretches, non-wrapping currency strings, filter bar baseline alignment, form segmented control widths, header back actions, secret field toggle layout, draft status clutter, color swatch sizing, and currency decimal precision.

All 13 defects have been resolved, verified with 92 component tests, 266 unit/domain tests, gallery accessibility validation (`axe-core`), and full production build verification.

A fresh set of 29 high-resolution screenshots was captured in Round 2 across desktop, mobile, and design system gallery surfaces (`ui-audit-2026-08-26/round-2-screenshots/`).

### Verification Scorecard

| Fix ID | Category | Component / Surface | Before State | Round 2 Verified State | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **FIX-01** | Mobile Navigation | `AppFrame`, `AppNavigation`, `tokens.css` | Header-pinned top nav consumed viewport height | Fixed bottom tab bar with safe-area insets | **PASSED** |
| **FIX-02** | Form Controls | `SearchField`, `tokens.css` | Clear button overflowed input border | Anchored inside `.ds-field-control-wrap` | **PASSED** |
| **FIX-03** | Feedback / CLS | `Toast`, `LocalShellApp`, `tokens.css` | Block notification bumped DOM down | Fixed bottom overlay with colocated close X | **PASSED** |
| **FIX-04** | Form Typography | `TextField`, `TextArea`, `components.tsx` | Required asterisk broke into separate grid row | Nested inline inside `<AriaLabel>` | **PASSED** |
| **FIX-05** | CSS Grid Layout | `tokens.css`, `SegmentedControl` | Grid stretched SegmentedControl to 220px ovals | Constrained to 48px pill with `align-self: start` | **PASSED** |
| **FIX-06** | Financial Numbers | `tokens.css`, `MoneyText`, `ListRow` | Currency strings wrapped vertically per character | `font-variant-numeric: tabular-nums; white-space: nowrap;` | **PASSED** |
| **FIX-07** | Filter Bar | `FilterBar`, `local-ui.css`, `tokens.css` | Period tabs, dropdown, search, and button misaligned | Aligned to bottom baseline (`align-items: flex-end`) | **PASSED** |
| **FIX-08** | Control Sizing | `ExpenseForm`, `FilterSheet`, `local-ui.tsx` | Segmented controls had void space; compact inputs stretched | Equalized form tabs (`fullWidth`) and natural widths | **PASSED** |
| **FIX-09** | Page Navigation | `PageHeader`, `local-ui.tsx` | Plain text "Back" / "Close" looked like unthemed text | Styled 44px quiet `IconButton` with `ArrowLeft` / `X` | **PASSED** |
| **FIX-10** | Secret Input | `SecretField`, `tokens.css` | "Show value" was an extra centered button below field | Integrated inline trailing eye icon toggle | **PASSED** |
| **FIX-11** | Form Cleanliness | `DraftStatus`, `local-ui.tsx` | "Unsaved changes" shown on pristine untouched forms | Rendered only when form is dirty, saving, or failed | **PASSED** |
| **FIX-12** | Form / Modals | `ColorChoiceField`, `DangerDialog` | Swatches were giant 48px; DangerDialog had no Cancel | Standardized 36px swatches; added Cancel button | **PASSED** |
| **FIX-13** | Formatting | `formatMoney`, `formatDecimal` | Amounts showed `SEK -250.5` with single decimal digit | Standardized two-digit decimals (`SEK -250.50`) | **PASSED** |

---

## 2. Before vs. After Visual Review

### 2.1 Mobile Navigation (FIX-01)
- **Before (`screenshots/02_mobile_home_initial.png`):** The navigation bar was jammed at the very top of the mobile screen above the "After Midnight" title, consuming prime thumb reach and reading space.
- **After (`round-2-screenshots/16_mobile_home_bottom_nav.png`):** The navigation bar is firmly anchored to the viewport bottom (`bottom: 0`, safe area padded). Content scrolls independently underneath, and the primary "Add" action is prominent in the center.

### 2.2 SearchField Clear Button (FIX-02)
- **Before (`screenshots/04_desktop_input_clear_button_bug.png`):** The clear button rendered as a separate block element overflowing outside the input border.
- **After (`round-2-screenshots/06_desktop_search_field_clear_button.png`):** The clear button is positioned cleanly inside the right padding of the field control wrap (`right: var(--space-2)`). Native browser search clear buttons are suppressed with `::-webkit-search-cancel-button: none`.

### 2.3 Notification Toast Layout Shift (FIX-03)
- **Before (`screenshots/14_desktop_toast_layout_bump_bug.png`):** Triggering a toast injected an in-flow block element above content, causing heavy Cumulative Layout Shift (CLS).
- **After (`round-2-screenshots/03_desktop_expenses_with_toast.png`):** Toasts appear as fixed overlays in the bottom-right corner (`position: fixed; z-index: 30; bottom: max(...)`) with an integrated close button (`ds-toast__dismiss`). Existing screen content stays rock-solid.

### 2.4 Form Asterisks & Field Headers (FIX-04 & FIX-09)
- **Before (`screenshots/03_desktop_create_project_modal.png`):** Asterisks broke onto their own lines in CSS grid layouts, and modal headers lacked visual icons.
- **After (`round-2-screenshots/02_desktop_create_project_modal.png`):** Asterisks are nested inside `<AriaLabel>` as inline visual markers, and page headers use standardized `IconButton` controls.

### 2.5 SegmentedControl Height & Card Layout (FIX-05)
- **Before (`screenshots/31_desktop_gallery_overview.png`):** CSS Grid stretched SegmentedControl items into 220px tall ovals.
- **After (`round-2-screenshots/26_desktop_gallery_middle_segmented_control.png`):** Constrained with `align-self: start; height: var(--control-height);` to remain compact 48px pills regardless of parent grid height.

### 2.6 Tabular Non-Wrapping Currency Amounts (FIX-06 & FIX-13)
- **Before (`screenshots/36_desktop_gallery_bottom_4.png`):** Long merchant strings pushed money amounts to narrow columns where strings wrapped character-by-character (`S\nE\nK\n-\n2\n8\n6`).
- **After (`round-2-screenshots/28_desktop_gallery_money_nonwrapping.png`):** Lists enforce `.ds-list-row__trailing { flex: 0 0 auto; white-space: nowrap; }` with `tabular-nums` and consistent two-digit decimals (`SEK -286.40`), ensuring financial readability.

### 2.7 FilterBar Baseline Alignment & Form Tab Equalization (FIX-07 & FIX-08)
- **Before (`screenshots/05_desktop_project_created_toast.png`):** Buttons sat 12px lower than inputs in filter bars, and segmented choice tabs only occupied ~30% of form width leaving awkward empty voids.
- **After (`round-2-screenshots/08_desktop_expenses_list_aligned.png`, `round-2-screenshots/05_desktop_manual_expense_form_clean.png`):** FilterBar aligns to `align-items: flex-end`, and ExpenseForm "Spent" / "Money back" tabs divide 100% of the form width evenly (`data-full-width="true"`).

### 2.8 SecretField Inline Reveal Toggle (FIX-10)
- **Before (`screenshots/24_desktop_settings_gemini.png`):** "Show value" was rendered as a full-width secondary button underneath the input field.
- **After (`round-2-screenshots/14_desktop_gemini_secret_field_inline.png`, `round-2-screenshots/15_desktop_gemini_secret_field_revealed.png`):** The toggle is an inline trailing eye icon (`Eye` / `EyeOff`) inside the input control boundary.

### 2.9 Clean Initial Form State (FIX-11)
- **Before (`screenshots/07_desktop_manual_expense_form.png`):** A pristine, freshly opened "New expense" form displayed a prominent "Unsaved changes" warning card.
- **After (`round-2-screenshots/05_desktop_manual_expense_form_clean.png`):** Untouched forms open with zero warning cards; `DraftStatus` renders conditionally only when dirty, saving, or failed.

### 2.10 Standardized Swatches & Safe DangerDialog (FIX-12)
- **Before (`screenshots/21_desktop_create_category_form.png`, `screenshots/39_desktop_danger_dialog.png`):** Color swatches were oversized 48px circles breaking group lines, and `DangerDialog` lacked a Cancel button.
- **After (`round-2-screenshots/12_desktop_create_category_swatches.png`, `round-2-screenshots/30_desktop_gallery_danger_dialog_with_cancel.png`):** Swatches are standardized to 36px in a tight flex group, and `DangerDialog` pairs an explicit secondary `Cancel` button before the destructive confirmation.

---

## 3. Code Review & Architecture Quality Check

### 3.1 Design System Tokens & Hierarchy (`tokens.css`)
- **Semantic Tokens:** Strict adherence to `--space-1` through `--space-9`, `--color-accent`, `--color-surface-*`, and `--color-text-*`. No ad-hoc hex colors or magic pixel values introduced.
- **Responsive Media Queries:** Maintained `@media (max-width: 359px)`, `@media (max-width: 719px)`, and `@media (min-width: 720px)` breakpoints consistently.
- **Layout Safety:** Added defensive layout CSS (`align-content: start`, `align-items: start`, `flex-shrink: 0`, `white-space: nowrap`) to isolate component dimensions from external container stretch.

### 3.2 Component Primitives (`components.tsx`)
- **React Aria Components Integration:** Preserved accessibility attributes (`role`, `aria-label`, `aria-live`, `aria-invalid`, `aria-pressed`, `aria-current`).
- **Encapsulated Wrappers:** Introduced `.ds-field-control-wrap` as the canonical container for inputs with trailing actions (SearchField, SecretField).

### 3.3 Domain & Formatting (`src/domain/queries/format.ts`)
- **Exact Decimals:** Maintained string-based arbitrary precision arithmetic (`big.js` / canonical decimal parser). Zero loss of precision for 20+ digit values while ensuring consistent two-digit decimals for monetary amounts.

---

## 4. Round 2 Verification Gates & Evidence

All automated verification gates passed:

```bash
$ deno fmt --check
Checked 216 files: OK

$ deno lint
Checked 199 files: OK

$ deno task check (TypeScript tsc --noEmit)
Checked all project files: OK

$ deno task test (Domain, Actors, Adapters, Integration)
ok | 266 passed | 0 failed (15s)

$ deno task test:component (Design System & Features)
ok | 92 passed | 0 failed (11s)

$ deno task a11y:gallery (axe-core Accessibility)
Design-system gallery passed native screenshot/tree/axe inspection for 3 viewports on agent-browser + Chrome.

$ deno task build (Production Bundler & PWA Manifest)
dist/index.html (1.09 kB)
dist/assets/index-*.css (28.94 kB)
dist/assets/index-*.js (1,038.16 kB)
PWA precache generated: OK
```

---

---

## 5. Round 2 UI & Form Design Actionable Checklist

- [x] **STEP-R2-01 (FIX-R2-01) · Wrap `CurrencyPicker` in `.ds-field-control-wrap`**
  - **Priority:** P1 (Visual Bug / Misalignment)
  - **Files:** [`src/design-system/components.tsx`](../src/design-system/components.tsx#L2033-L2065)
  - **Action:** Wrap `<AriaInput>` and `<AriaButton className="ds-icon-button ds-search-field__clear">` in `<div className="ds-field-control-wrap">` so the dropdown chevron anchors cleanly inside the right edge of the input.
  - **Verification:** Inspect Create Project and Expense Form. The chevron must be embedded inside the input control boundary.
  - **Commit:** `fix(ui): FIX-R2-01 wrap CurrencyPicker in field-control-wrap to anchor chevron inside input`

- [x] **STEP-R2-02 (FIX-R2-02) · Mobile Viewport Body Bottom Clearance Padding**
  - **Priority:** P1 (Layout / Usability)
  - **Files:** [`src/design-system/tokens.css`](../src/design-system/tokens.css)
  - **Action:** Set `.ds-app-frame__body` on mobile (`@media (max-width: 719px)`) to `padding-bottom: calc(var(--control-height) + var(--space-6) + env(safe-area-inset-bottom, 0px))`.
  - **Verification:** Scroll long forms and expenses list on mobile (390x844). Content and submit buttons must have ample clearance above the bottom navigation bar.
  - **Commit:** `fix(ui): FIX-R2-02 add bottom clearance padding to app-frame body on mobile viewports`

- [x] **STEP-R2-03 (FIX-R2-03) · Responsive Full-Width Form Action Buttons on Mobile**
  - **Priority:** P1 (Form UX / Visual Hierarchy)
  - **Files:** [`src/design-system/tokens.css`](../src/design-system/tokens.css), [`src/design-system/components.tsx`](../src/design-system/components.tsx)
  - **Action:** Style `.ds-form-actions` on desktop with `justify-content: flex-end; gap: var(--space-3);`, and on mobile (`@media (max-width: 719px)`) with `flex-direction: column-reverse; width: 100%; gap: var(--space-2);` where buttons fill full width.
  - **Verification:** Open ExpenseForm on mobile. "Save expense" must be full-width on top, and "Save and add another" full-width below it.
  - **Commit:** `fix(ui): FIX-R2-03 responsive full-width vertical stack for form action buttons on mobile`

- [x] **STEP-R2-04 (FIX-R2-04) · Desktop 2-Column Responsive Pairing for Related Form Fields**
  - **Priority:** P2 (Form Layout / Visual Balance)
  - **Files:** [`src/features/local-ui.css`](../src/features/local-ui.css), [`src/features/local-ui.tsx`](../src/features/local-ui.tsx)
  - **Action:** On desktop (`@media (min-width: 720px)`), pair `[Amount + Currency]` (3fr:1fr) and `[Date + Time]` (1fr:1fr) into horizontal 2-column rows, folding into single columns on mobile.
  - **Verification:** Inspect ExpenseForm on 1280x800 desktop. Amount/Currency and Date/Time must sit side-by-side cleanly.
  - **Commit:** `fix(ui): FIX-R2-04 pair Amount-Currency and Date-Time into responsive two-column desktop rows`

- [x] **STEP-R2-05 (FIX-R2-05) · Add Secondary Cancel Button to Create Project and Category Modals**
  - **Priority:** P2 (Dialog Usability / Form Standards)
  - **Files:** [`src/features/local-ui.tsx`](../src/features/local-ui.tsx)
  - **Action:** Pair a secondary `Cancel` button before `Save project` in `CreateProjectModal` and before `Save category` in `CreateCategoryModal`.
  - **Verification:** Open Create Project and Create Category dialogs. Footers must contain both `Cancel` and `Save` buttons.
  - **Commit:** `fix(ui): FIX-R2-05 add secondary Cancel button to project and category creation modals`

- [x] **STEP-R2-06 (FIX-R2-06) · Subdue Helper Description Text Styling**
  - **Priority:** P2 (Visual Hierarchy / Typographic Discipline)
  - **Files:** [`src/design-system/tokens.css`](../src/design-system/tokens.css)
  - **Action:** Set `.ds-field__description` to `color: var(--color-text-secondary); font-size: var(--font-size-caption); line-height: 1.3; margin-top: var(--space-1);`.
  - **Verification:** Inspect form field descriptions (Amount, Date, Category color). Helper text must be distinctly subdued and subordinate to field labels.
  - **Commit:** `fix(ui): FIX-R2-06 subdue field description text with secondary color and caption font size`

- [x] **STEP-R2-07 (FIX-R2-07) · Suppress DraftStatus on Clean Untouched Forms**
  - **Priority:** P2 (Visual Clutter / UX)
  - **Files:** [`src/features/local-ui.tsx`](../src/features/local-ui.tsx)
  - **Action:** Only render `DraftStatus` for `"dirty"` state when user-entered values are actually present (`Boolean(draft.amount || draft.merchant || draft.description)`).
  - **Verification:** Open "New expense" from the Add menu. Form must start with zero warning cards.
  - **Commit:** `fix(ui): FIX-R2-07 suppress DraftStatus warning card on pristine untouched forms`

- [x] **STEP-R2-08 (FIX-R2-08) · Constrain Action Button Stretching in Desktop Settings Cards**
  - **Priority:** P3 (Visual Balance)
  - **Files:** [`src/features/local-ui.css`](../src/features/local-ui.css)
  - **Action:** On desktop screens (`@media (min-width: 720px)`), set `Save and continue` in `GeminiQuickSetup` to natural width right-aligned (`align-self: flex-end; width: auto;`).
  - **Verification:** Open Gemini Settings on 1280x800 desktop. Button must not stretch 600px wide.
  - **Commit:** `fix(ui): FIX-R2-08 prevent 600px button stretching in desktop settings cards`

- [ ] **STEP-R2-09 (FIX-R2-09) · Add Horizontal Swipe Scroll for Narrow Period Filter Tabs**
  - **Priority:** P3 (Responsiveness)
  - **Files:** [`src/design-system/tokens.css`](../src/design-system/tokens.css)
  - **Action:** Enable smooth horizontal scroll with hidden scrollbar (`overflow-x: auto; scrollbar-width: none;`) on `.ds-filter-bar .ds-segmented-control` on narrow screens.
  - **Verification:** Inspect FilterBar on 320px/360px viewport. Period tabs must scroll without clipping container edges.
  - **Commit:** `fix(ui): FIX-R2-09 add horizontal swipe scroll to period segmented control on narrow screens`

- [ ] **STEP-R2-10 (FIX-R2-10) · Constrain Desktop Standalone Project Selector Width**
  - **Priority:** P3 (Visual Polish)
  - **Files:** [`src/features/local-ui.css`](../src/features/local-ui.css)
  - **Action:** Add `max-width: 360px` to standalone project pickers on desktop (`@media (min-width: 720px)`), maintaining 100% width on mobile.
  - **Verification:** Inspect Expenses page on wide desktop. Project selector must not span full 1200px width.
  - **Commit:** `fix(ui): FIX-R2-10 constrain standalone project picker max-width on desktop viewports`
