---
name: ui-audit-workflow
description: >-
  Standardized end-to-end UI/UX audit and remediation workflow. Use when
  conducting visual audits, identifying UI/form defects, organizing multi-step
  remediation checklists, executing incremental pre-commit fixes, and verifying
  cross-viewport visual and functional polish without repeating commit links.
---

# UI/UX Audit & Iterative Remediation Workflow

This skill defines the standardized, multi-phase procedure for auditing user
interfaces, cataloging visual and responsive defects, generating actionable
remediation checklists, and executing step-by-step verified fixes with automated
visual regression proof.

---

## 1. Core Principles & Safeguards

1. **Zero Feature Drift:** An audit improves layout, positioning, responsive
   adaptation, typography, and visual ergonomics without changing underlying
   business rules, state machines, or domain behavior.
2. **Design System Token Fidelity:** All fixes must utilize approved tokens
   (`tokens.css`) and primitives (`components.tsx`). Never introduce one-off hex
   colors or rogue pixel dimensions.
3. **Multi-Viewport Standard:** Every screen, form, and modal must be audited
   and verified across three standard breakpoints:
   - **Desktop (`1280×800`):** Multi-column balance, sticky sidebar, constrained
     maximum form/dropdown widths, natural button sizing.
   - **Mobile Phone (`390×844`):** Fixed bottom navigation, full-width action
     button vertical stacks, body clearance padding above bottom bar.
   - **Narrow / Compact (`320×568`):** Safe-area insets, horizontal swipe scroll
     for segmented filters, zero horizontal clipping.
4. **Immediate Motion Policy:** Interaction transitions are `0ms` (instant) by
   default; animations are restricted solely to indeterminate progress tracks.
5. **Incremental Commit Cadence:** When executing the audit checklist, work on
   one step at a time, verify with fast pre-commit gates, update the checklist,
   commit immediately, and push to remote.

---

## 2. Five Visual & UX Audit Dimensions

When evaluating screens and components, audit against these 5 pillars:

### A. Navigation & Viewport Insets

- **Mobile Bottom Navigation:** Navigation must anchor to `bottom: 0` with safe
  bottom inset (`env(safe-area-inset-bottom)`).
- **Body Clearance:** The scrollable `<main>` container must have
  `padding-bottom` calculated to prevent floating bottom bar overlap
  (`calc(var(--control-height) + var(--space-8) + env(safe-area-inset-bottom, 0px))`).
- **Desktop Sidebar:** Sticky left sidebar
  (`position: sticky; top: 0; min-height: 100dvh;`).

### B. Form Ergonomics & Control Anchoring

- **Embedded Icons & Dropdown Chevrons:** Search clear buttons, dropdown
  chevrons (`CurrencyPicker`), and reveal toggles (`SecretField`) must be
  enclosed within a `.ds-field-control-wrap` container with `position: relative`
  so icons anchor neatly inside the right edge of the input box.
- **Desktop 2-Column Pairing:** Pair tightly coupled fields
  (`[Amount + Currency]`, `[Date + Time]`) into responsive horizontal 2-column
  rows on desktop (`@media (min-width: 720px)`), collapsing into single column
  on mobile.
- **Natural Width vs 600px Stretching:** Action buttons in cards or settings
  views on desktop must maintain their natural intrinsic width (right-aligned)
  rather than stretching 600px wide.
- **Mobile Form Actions:** On mobile (`< 720px`), form action buttons must
  expand to `width: 100%` and stack vertically
  (`flex-direction: column-reverse`) with the primary submit button on top.

### C. Dialog & State Hygiene

- **Secondary Cancel Action:** Every modal, editor, or confirmation dialog must
  provide a secondary `Cancel` or `Close` button alongside the primary action.
- **Pristine Form Warnings:** Inline `DraftStatus` or "Unsaved changes" warning
  banners must remain hidden until the user actually enters meaningful dirty
  values.

### D. Typographic & Data Hierarchy

- **Subdued Helper Text:** `.ds-field__description` must be visually subordinate
  (`color: var(--color-text-secondary); font-size: var(--font-size-caption); line-height: var(--line-height-tight);`).
- **Required Asterisks:** Asterisks (`*`) must be nested directly inside the
  `<AriaLabel>` rather than floating as sibling grid items.
- **Tabular Currency Formatting:** Monetary amounts (`.ds-money`) must have
  `white-space: nowrap; font-variant-numeric: tabular-nums; flex-shrink: 0;` and
  standard two-digit decimal precision (`12.50`).

### E. Layout Shift & Alignment

- **Toast Notifications (Zero CLS):** Toasts must render in a fixed overlay
  (`position: fixed; bottom: var(--space-4); right: var(--space-4); z-index: 30;`)
  with integrated dismiss buttons, never pushing the document content down.
- **Filter Bar Baseline:** Filter bars combining labeled dropdowns and unlabeled
  action buttons must align with `align-items: flex-end`.

---

## 3. End-to-End Audit & Remediation Lifecycle

```
[Phase 1: Automated Visual Capture]
         │
         ▼
[Phase 2: Audit Analysis & Report Generation]
         │
         ▼
[Phase 3: Step-by-Step Remediation (Fast Gates + Commit + Push)]
         │
         ▼
[Phase 4: Comprehensive Verification (Unit + A11y + E2E + Build)]
         │
         ▼
[Phase 5: Post-Fix Visual Re-Capture & Clean Reporting]
```

---

## 4. Detailed Phase Instructions

### Phase 1: Automated Visual Capture

1. Create a versioned or dated audit directory:
   `ui-audit-YYYY-MM-DD/round-N-screenshots/`.
2. Run browser automation (Playwright script or `agent-browser`) to capture
   high-resolution screenshots for all views across Desktop (`1280×800`), Mobile
   (`390×844`), and Narrow (`320×568`).
3. Cover all states:
   - Initial empty / first-use views
   - Create project / category modals
   - Expenses screen (active items, filters, project dropdown)
   - Add manual expense form (top, bottom, clean state)
   - Gemini scanning & secret field settings
   - Toast notification overlay
   - Design System Gallery component fixtures
     (`/src/design-system/gallery.html`)

### Phase 2: Audit Analysis & Report Generation

1. Inspect each captured screenshot against the 5 audit dimensions.
2. Author the audit report (e.g., `ROUND_N_UI_AUDIT_REPORT.md`):
   - **Executive Summary:** High-level assessment of visual state.
   - **Categorized Findings:** Grouped by severity (`P1 Critical`, `P2 Form UX`,
     `P3 Polish`) with specific visual evidence links.
   - **Actionable Remediation Checklist:** Numbered steps (`STEP-01`, `STEP-02`,
     ...) specifying exact target files, required CSS/JSX adjustments, and
     verification criteria.

### Phase 3: Step-by-Step Remediation Protocol

Execute checklist items sequentially following this exact per-step loop:

1. **Apply Code Edits:** Modify the targeted CSS or component files.
2. **Fast Pre-Commit Verification:** Run fast validation commands:
   ```bash
   deno fmt src && deno task fmt:check && deno task lint && deno task check && deno task test:component
   ```
   _(Note: Heavy Playwright E2E tests are postponed until all checklist items
   are completed for maximum execution velocity)._
3. **Update Checklist:** Mark the step complete in the audit report markdown:
   `- [x] **STEP-XX (FIX-XX)** ...`
4. **Commit & Push:** Commit immediately with a focused conventional message and
   push:
   ```bash
   git commit -am "fix(ui): FIX-XX <concise description of visual fix>" && git push origin master
   ```

### Phase 4: Comprehensive Test & Build Validation

Once all checklist items are checked off:

1. **Run Full Test Suite:**
   ```bash
   deno task test && deno task test:component
   ```
2. **Run Design System Accessibility Check:**
   ```bash
   deno task a11y:gallery
   ```
3. **Run Production Build:**
   ```bash
   deno task build
   ```
4. **Run End-to-End Test Suite:**
   ```bash
   deno task test:e2e
   ```
5. If any test expectation requires precision updating (e.g. formatted money
   string `SEK -12.50`), update the test, re-verify, commit, and push.

### Phase 5: Post-Fix Visual Re-Capture & Clean Reporting

1. Re-run the automated screenshot script to overwrite / refresh the screenshot
   suite in `ui-audit-YYYY-MM-DD/round-N-screenshots/`.
2. Inspect key screenshots (e.g., modals, form rows, mobile action stacks) to
   confirm visual perfection.
3. Commit and push the updated screenshots.
4. **Final Reporting Standard:**
   - Present a clear, concise markdown summary of the fixed items.
   - Report validation test counts (unit, component, a11y, e2e, build).
   - Point to the screenshot folder for visual inspection.
   - **Do NOT repeat individual commit hashes or external links to commits in
     the final text report.**
