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
interfaces, discovering visual and responsive defects through interactive screen
journeys, generating actionable remediation checklists, executing verified
step-by-step fixes, and validating with automated visual regression tests.

---

## 1. Core Principles & Safeguards

1. **Zero Feature Drift:** An audit refines visual layout, positioning,
   responsive ergonomics, spacing, and typography without changing underlying
   business rules, state machines, or domain data contracts.
2. **Design System Token Fidelity:** All fixes must utilize approved tokens
   (`tokens.css`) and primitives (`components.tsx`). Never introduce one-off hex
   colors or rogue pixel dimensions.
3. **Multi-Viewport Standard:** Every screen, form, drawer, and modal must be
   audited and verified across three standard breakpoints:
   - **Desktop (`1280×800`):** Multi-column balance, sticky sidebar, constrained
     maximum form/dropdown widths, natural button sizing.
   - **Mobile Phone (`390×844`):** Fixed bottom navigation, full-width action
     button vertical stacks, body clearance padding above bottom bar.
   - **Narrow / Compact (`320×568`):** Safe-area insets, horizontal swipe scroll
     for segmented filters, zero horizontal clipping.
4. **Interactive Mid-Step Exploration:** Static audits miss hidden defects. An
   audit must interactively click through real workflows, open drawers, enter
   drafts, trigger toasts, and capture mid-interaction states.
5. **Incremental Commit Cadence:** When executing the audit checklist, work on
   one step at a time, verify with fast pre-commit gates, update the checklist,
   commit immediately, and push to remote.

---

## 2. Five Visual & UX Audit Dimensions

When evaluating screens and components, audit against these 5 pillars:

### A. Navigation, Viewport Insets & Z-Index Layering

- **Z-Index Layer Hierarchy:**
  - Content / Base: `0`
  - Sticky Action / Filter Bars: `10`
  - Fixed Mobile Bottom Navigation: `20`
  - Modals, Drawers & Overlays (`.ds-modal-overlay`, `.local-ui-overlay`): `40`
  - Floating Toasts / Global Status Notifications: `50`
- **Zero Covered Elements:** Bottom sheets (e.g. `AddChoiceScreen`) must sit on
  top of the bottom navigation bar (`z-index: 40`) and include bottom safe-area
  clearance
  (`padding-bottom: max(var(--space-5), env(safe-area-inset-bottom))`).
- **Body Clearance:** The scrollable `<main>` container must have
  `padding-bottom: calc(var(--control-height) + var(--space-8) + env(safe-area-inset-bottom, 0px))`
  so scrolled content is never clipped behind the fixed navigation bar.

### B. Form Ergonomics, Mobile Action Spanning & Control Anchoring

- **Embedded Icons & Dropdown Chevrons:** Search clear buttons, dropdown
  chevrons (`CurrencyPicker`), and reveal toggles (`SecretField`) must be
  enclosed within `.ds-field-control-wrap` with `position: relative` so icons
  anchor neatly inside the right edge of the input box.
- **Mobile Field Pairing (Amount + Currency, Date + Time):** On mobile
  (`< 720px`), tightly coupled fields must NOT stack into giant full-page
  scrolls where a small picker (e.g. a 3-letter currency dropdown) occupies an
  isolated 100%-wide row.
  - Pair `[Amount + Currency]` side-by-side in a responsive 2-column row
    (`min-width: 0`), giving Amount flexible space and Currency a compact fixed
    width (~96px).
  - Pair `[Date + Time]` side-by-side (~60% / ~40%) on mobile viewports.
- **Mobile Button Spanning (Full-Width vs. Natural Width Antipatterns):**
  - On mobile (`< 720px`), primary form actions, sticky bottom bar CTAs
    (`[ Scan with AI ]`, `[ Save selected entries ]`), standalone trigger
    buttons (`[ + Add expense ]`, `[ + Create project ]`,
    `[ + Create category ]`), and danger confirmation buttons
    (`[ Delete this expense ]`) must span **100% full width (`width: 100%`)**.
  - **Antipattern to Avoid:** Do NOT render primary actions with natural width
    (~150px) floating lopsided on the left or right of a mobile screen leaving
    60% blank space.
- **Form Action Button Vertical Hierarchy:** In mobile vertical button stacks,
  the primary submit/confirm action must ALWAYS be on **TOP**, and
  secondary/cancel actions on the **BOTTOM**. Never invert this order.
- **Structured Multi-Action List Cards:** Management list cards (e.g. projects,
  categories) must NOT cram 5–6 raw wrapping inline buttons (`Use`, `Edit`,
  `Move up`, `Move down`, `Archive`, `Delete empty`) onto erratic lines. Use a
  structured 2-tier layout: primary status/switch action on top, followed by a
  compact secondary action grid.

### C. Financial Metrics & Header Alignment

- **Responsive Money Summary:** `.ds-money-summary` must NOT force a rigid
  3-column horizontal grid on small viewports. On mobile (`< 720px`), it must
  render as a clean 1-column stack or balanced 2-column card layout to prevent
  crushed labels and wrapped numbers.
- **PageHeader Status Alignment:** Header status indicators (`status` slot) must
  be compact inline elements (`StatusDot` or subtle pill), never wide block
  cards squashed beside action buttons.
- **Baseline Alignment:** Filter bars combining labeled dropdowns and unlabeled
  buttons must align to a common baseline (`align-items: flex-end`).
- **Period Picker Viewport Resiliency:** Segmented control period pickers
  (`[ Today | This month | This year | Custom ]`) must support smooth horizontal
  scrolling or clean wrapping on narrow (`320px`) screens so segments are never
  clipped off-screen.

### D. Dialog, Section & State Hygiene

- **Section Gap Discipline:** Every management or group section (`<section>`)
  must maintain standard internal spacing (`<Stack gap={3}>` or
  `display: grid; gap: var(--space-3);`).
- **Secondary Cancel Action:** Every modal, editor, or confirmation dialog must
  provide a secondary `Cancel` button alongside the primary action, and
  canceling an editor must cleanly exit editing mode (`setEditor(null)`).
- **Pristine Form Warnings:** Inline `DraftStatus` or "Unsaved changes" warning
  banners must remain hidden until the user actually enters meaningful dirty
  values.
- **Shell Status Banner Margin:** Global sync/authz banners
  (`.sync-ui-shell-status`) must maintain a `--space-4` bottom margin above page
  content.
- **Bottom Navigation Clearance:** Main content containers must maintain
  adequate bottom padding to ensure scrolled content and danger action buttons
  (e.g. "Delete everywhere") are never obscured behind fixed bottom navigation
  bars.

### E. Typographic Hierarchy, Word-Wrapping & Data Alignment

- **ListRow Word-Wrapping Discipline:** List rows and category breakdown items
  must specify `min-width: 0`, `word-break: normal`, and
  `overflow-wrap: anywhere` to prevent awkward character-by-character word
  breaks (e.g. `"Uncat / egori / zed"` or `"Uncategorize / d"`).
- **Badge Sizing & Overflow:** Status badges (e.g. `"CURRENT"` project) must
  have sufficient min-width and compact padding so text is never truncated to
  `"CURR..."`.
- **Subdued Helper Text:** `.ds-field__description` must be visually subordinate
  (`color: var(--color-text-secondary); font-size: var(--font-size-caption); line-height: var(--line-height-tight);`).
- **Required Asterisks:** Asterisks (`*`) must be nested directly inside the
  `<AriaLabel>` rather than floating as sibling grid items.
- **Tabular Currency Formatting:** Monetary amounts (`.ds-money`) must have
  `white-space: nowrap; font-variant-numeric: tabular-nums; flex-shrink: 0;` and
  standard two-digit decimal precision (`12.50`).

---

## 3. Canonical Interactive Screen Review Order

When conducting an audit, follow this standard journey order:

```
1. [First-Use / Landing] ────► 2. [Create Project Modal] ────► 3. [Expenses Main Hub]
                                                                      │
┌─────────────────────────────────────────────────────────────────────┘
▼
4. [Add Choice Drawer] ──────► 5. [Manual Expense Form] ─────► 6. [AI Receipt Scan]
                                                                      │
┌─────────────────────────────────────────────────────────────────────┘
▼
7. [Expense Saved / List] ───► 8. [Organize Hub & Screens] ──► 9. [Settings & Sync]
                                                                      │
┌─────────────────────────────────────────────────────────────────────┘
▼
10. [Design System Gallery Fixtures]
```

### Detailed Journey Steps:

1. **Screen 1: First-Use / Landing** (`/first-use`)
   - Empty state typography, action cards layout, local-first copy.
2. **Screen 2: Create Project Dialog** (Triggered from First-Use or Organize)
   - Input clear button, CurrencyPicker chevron alignment, Cancel vs Save
     buttons.
3. **Screen 3: Expenses Main Hub** (`/expenses`)
   - Header title, compact sync dot, Add expense button, standalone project
     picker max-width, filter bar alignment, period swipe tabs, responsive money
     summary cards.
4. **Screen 4: Add Choice Drawer / Modal** (`/add`)
   - Bottom sheet z-index above mobile navigation, safe-area clearance, "Scan
     receipt with AI" visibility.
5. **Screen 5: Manual Expense Form** (`/expense/new` or `/expense/edit/:id`)
   - Clean form (no premature draft warnings), 2-column Amount/Currency and
     Date/Time desktop rows, full-width mobile action button stack, subdued
     field descriptions.
6. **Screen 6: AI Receipt Scanning & Gemini Setup** (`/receipt/scan`)
   - Source picker options, Gemini API key modal with inline eye reveal toggle,
     natural width "Save and continue" button.
7. **Screen 7: Populated Expenses View**
   - Non-wrapping tabular money amounts, category badges, baseline-aligned
     filter bar.
8. **Screen 8: Organize Hub & Management Screens** (`/organize`, `/projects`,
   `/categories`)
   - Section heading-to-list gaps, Project/Category editor forms with Cancel
     buttons, color swatch picker sizing (36px).
9. **Screen 9: Settings, Drive Sync & Preferences** (`/settings`,
   `/settings/sync`, `/settings/preferences`)
   - Settings list row spacing, Google Drive sync banner margin and
     authorization copy, live day-boundary example.
10. **Screen 10: Design System Gallery** (`/src/design-system/gallery.html`)
    - Component fixtures across viewports, dark theme color contrast, axe
      accessibility tree.

---

## 4. End-to-End Audit & Remediation Lifecycle

```
[Phase 1: Automated Interactive Visual Capture]
         │
         ▼
[Phase 2: Multi-Dimensional Audit & Checklist Generation]
         │
         ├─► [Optional: Convert to IMPLEMENTATION_PLAN.md via implementation-planning skill]
         │
         ▼
[Phase 3: Step-by-Step Remediation (Fast Gates + Commit + Push)]
         │
         ▼
[Phase 4: Comprehensive Verification (Unit + A11y + E2E + Build)]
         │
         ▼
[Phase 5: Post-Fix Visual Re-Capture, Cleanup & Clean Reporting]
```

---

## 5. Detailed Phase Instructions

### Phase 1: Automated Interactive Visual Capture

1. Execute the dedicated visual capture command to explore the 10 canonical
   journeys across Desktop (`1280×800`), Mobile (`390×844`), and Narrow
   (`320×568`):
   ```bash
   deno task audit:capture ui-audit-YYYY-MM-DD/round-1-screenshots
   ```
2. The capture script automatically navigates through first-use, modal/drawer
   states, filled drafts, receipt scans, review dialogs, and settings screens.

### Phase 2: Multi-Dimensional Audit & Checklist Generation

1. Inspect each captured screenshot against the 5 audit dimensions.
2. Author the audit report (e.g., `ROUND_N_UI_AUDIT_REPORT.md`):
   - **Executive Summary:** High-level assessment of visual state.
   - **Categorized Findings:** Grouped by severity (`P1 Critical`,
     `P2 Form UX / Layout`, `P3 Polish`) with specific visual evidence links.
   - **Actionable Remediation Checklist:** Numbered steps (`STEP-01`, `STEP-02`,
     ...) specifying exact target files, required CSS/JSX adjustments, and
     verification criteria.
3. **User Direction & Planning Decision:**
   - Ask the user whether to convert the audit report into an executable
     milestone in `IMPLEMENTATION_PLAN.md` using the `implementation-planning`
     skill (with batched workstreams, a single comprehensive milestone review
     gate, and lifecycle archiving) or to proceed directly with the transient
     checklist loop in Phase 3 below.
   - **Batched Review Recommendation:** For UI/UX audit remediations, always
     prefer batching the review into a **single consolidated milestone review
     gate at the end** (after the visual re-capture and test verification task).
     Interconnected CSS, layout, and component adjustments are best audited
     holistically against the complete multi-viewport screenshot matrix in one
     pass, avoiding unnecessary subagent latency at intermediate steps.

### Phase 3: Step-by-Step Remediation Protocol

Execute checklist items sequentially following this exact per-step loop:

1. **Apply Code Edits:** Modify the targeted CSS or component files.
2. **Fast Pre-Commit Verification:** Run affected tests and changed-file static
   checks. Add a targeted browser check only when the step changes behavior that
   the module graph cannot observe:
   ```bash
   deno fmt <changed-files>
   deno lint <changed-ts-or-tsx-files>
   deno task test:affected
   git diff --check
   ```
   Do not run full component, E2E, build, gallery, or repository verification
   after every checklist item.
3. **Update Checklist:** Mark the step complete in the audit report markdown:
   `- [x] **STEP-XX (FIX-XX)** ...`
4. **Commit & Push:** Commit immediately with a focused conventional message and
   push:
   ```bash
   git commit -am "fix(ui): FIX-XX <concise description of visual fix>" && git push origin master
   ```

### Phase 4: Comprehensive Test & Build Validation

Once all checklist items are checked off:

1. **Run Tests Affected by the Complete Audit Batch:**
   ```bash
   deno test --allow-read --allow-write --allow-run --allow-env \
     --changed=<audit-base-commit>
   ```
2. **Run Design System Accessibility Check:**
   ```bash
   deno task a11y:gallery
   ```
3. **Run Production Build:**
   ```bash
   deno task build
   ```
4. **Run Only Affected Approved End-to-End Journeys:**
   ```bash
   deno task test:e2e --grep <affected-journey>
   ```
   Run `deno task verify` only when this is the final/release gate or the audit
   changed cross-cutting dependency, toolchain, or configuration behavior whose
   impact cannot be bounded reliably.
5. If any test expectation requires precision updating (e.g. formatted money
   string `SEK -12.50`), update the test, re-verify, commit, and push.

### Phase 5: Post-Fix Visual Re-Capture, Cleanup & Clean Reporting

1. Re-run visual capture into the post-fix round directory:
   ```bash
   deno task audit:capture ui-audit-YYYY-MM-DD/round-2-screenshots
   ```
2. Inspect key screenshots to confirm visual perfection across all breakpoints.
3. **Artifact Cleanup (Preserved in Git History):** After visual verification is
   confirmed, remove the audit directory, screenshots, and report files from the
   working tree (`git rm UI_UX_AUDIT_REPORT_*.md` and remove local screenshot
   dirs). When an implementation plan was created for the audit, this cleanup is
   executed as part of the plan's final `M<N>-FINAL` archiving task. All visual
   before/after states, audit findings, and verification histories remain
   permanently queryable in Git history, keeping the repository workspace lean.
4. **Commit & Push Cleanup:** Per `AGENTS.md`, any document deletion/archiving
   must include `[archive]` in the commit message:
   ```bash
   git rm UI_UX_AUDIT_REPORT_YYYY_MM_DD.md && git commit -am "docs(audit): [archive] prune completed UI/UX audit report" && git push origin master
   ```
5. **Final Reporting Standard:**
   - Present a clear, concise markdown summary of the fixed items.
   - Report validation test counts (unit, component, a11y, e2e, build).
   - Note that visual verification passed and transient audit files have been
     cleaned up.
   - **Do NOT repeat individual commit hashes or external links to commits in
     the final text report.**
