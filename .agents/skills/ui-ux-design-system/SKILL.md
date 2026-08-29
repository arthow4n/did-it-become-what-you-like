---
name: ui-ux-design-system
description: >-
  Expert guidelines, layout discipline, and responsive best practices for
  implementing, modifying, and auditing UI components in the 'After Midnight'
  design system. Activate when building or styling UI components, fixing visual
  bugs, adjusting layouts/viewports, or verifying responsive behavior with
  agent-browser.
---

# UI & UX Design System Implementation Guide

This skill provides essential guidelines, layout rules, common antipatterns, and
verification procedures for building and refining user interfaces in **After
Midnight**.

---

## 1. Core Design Philosophy

- **Theme & Aesthetics:** Calm, dark interface (`canvas: #101315`,
  `surface-1: #171B1F`, `surface-2: #1E2429`, `surface-3: #272E35`,
  `accent: #78DCCA`).
- **Semantic Tokens Only:** Never hard-code hex colors or arbitrary pixel values
  (`gap: 17px`, `color: #fff`). Always use CSS custom properties
  (`var(--color-surface-2)`, `var(--space-3)`).
- **Immediate Motion Policy:** Default transition duration is `0ms`. Motion is
  only permitted for indeterminate progress indicators.
- **Contract Hierarchy:** Tokens own visual decisions → Primitives own
  accessibility & states → Patterns own layout → Composites own domain
  presentation → Screens bind actors.

---

## 2. Layout, Sizing & Flexbox Discipline

### A. Natural Widths vs Full-Width Controls & Mobile Spanning

- **Full-Width (Block) Controls:** `TextField`, `TextArea`, search bars, and
  `ActionCard` containers expand to the container width (up to
  `--form-max: 640px` or `--content-max: 1200px`).
- **Desktop Action Buttons (Natural Width):** On desktop (`>= 720px`), `Button`,
  `IconButton`, `SelectField`, `SegmentedControl`, `ColorChoiceField`,
  `NativeDateField`, `NativeTimeField`, `Badge`, `Chip`, and `StatusDot`
  maintain their natural intrinsic width (e.g. right-aligned in forms).
- **Mobile Action Buttons (100% Full-Width Spanning):** On mobile viewports
  (`< 720px`), primary form actions, bottom sticky action bar CTAs
  (`[ Scan with AI ]`, `[ Save entries ]`), standalone page action triggers
  (`[ + Add expense ]`, `[ + Create project ]`, `[ + Create category ]`), and
  danger confirmation buttons (`[ Delete this expense ]`) **MUST expand to
  `width: 100%`**.
- **Antipattern:** NEVER leave a mobile primary action floating with natural
  width (~150px) on the left or right with 60% empty whitespace.
- **Mobile Field Pairing:** Small selectors (like a 3-letter currency dropdown)
  must NEVER sit isolated on a full-width row under a number field. Pair
  `[Amount (flex 1) + Currency (compact ~96px)]` and
  `[Date (~60%) + Time (~40%)]` side-by-side in responsive 2-column rows
  (`min-width: 0`) across all mobile viewports.

### B. CSS Grid & Asymmetric Stretch Prevention

- In CSS Grid containers (`ResponsiveGrid`, multi-column cards, gallery
  fixtures), always specify:
  ```css
  .ds-responsive-grid,
  .ds-gallery__section {
    display: grid;
    align-content: start;
    align-items: start;
  }
  ```
- **Why:** Without `align-items: start`, grid rows default to `stretch`. When
  one column has 10 items and an adjacent column has 2 items, the shorter items
  stretch vertically to hundreds of pixels (turning pill buttons into giant
  distorted circles/ovals).

### C. Flexbox Compression & Text Overflow Protection

- When building horizontal rows with text and trailing actions/metrics (e.g.
  `ListRow`, `PageHeader`, `FilterBar`):
  - **Trailing Slots (Metrics / Actions / Status):** Must have
    `flex-shrink: 0; white-space: nowrap;`.
  - **Main Content (Titles / Descriptions):** Must have
    `flex: 1 1 auto; min-width: 0;` so that long text wraps or truncates without
    crushing adjacent items.
  - **Monetary Amounts:** `.ds-money` must ALWAYS be
    `white-space: nowrap; font-variant-numeric: tabular-nums;`. Never use
    `overflow-wrap: anywhere; white-space: normal;` on currency numbers.

---

## 3. Spacing Rhythm & Visual Hierarchy

Always use the 4px token scale (`--space-1` through `--space-10`):

| Token       | Pixels | Semantic Responsibility                                                     |
| ----------- | -----: | --------------------------------------------------------------------------- |
| `--space-1` |    4px | Micro-spacing: Icon to label inside compact chips/badges, pill item padding |
| `--space-2` |    8px | Intra-field gaps: Label to input, inline filter chips, button pairs         |
| `--space-3` |   12px | Component internal padding: List row padding, filter bar items              |
| `--space-4` |   16px | Card content padding, section element stacking                              |
| `--space-5` |   20px | Major form group gaps, dialog content spacing                               |
| `--space-6` |   24px | Distinct card stacks, page header bottom margins                            |
| `--space-7` |   32px | Page landmark gutters, wide-screen main padding                             |
| `--space-8` |   40px | Empty state vertical centering                                              |

**Rule:** Every interactive element must have at least `--space-2` (8px)
breathing room from neighboring elements.

---

## 4. Top 10 Common Antipatterns & How to Fix Them

### 1. Inverted Mobile Navigation

- **Wrong:** Placing `<aside>` above `<main>` in normal flow, causing tabs to
  render at the top header on mobile.
- **Right:** Position mobile navigation fixed at
  `bottom: 0; left: 0; right: 0; z-index: 10;` with
  `padding-bottom: max(var(--space-2), env(safe-area-inset-bottom))`, and add
  bottom padding to `<main>`.

### 2. SearchField Clear Button Overflow

- **Wrong:** Applying `position: relative` to the whole field grid container
  (which includes the label). Setting `top: 50%` on the button places it on the
  top border of the input.
- **Right:** Wrap only the `<AriaInput>` and clear `<AriaButton>` in a
  `.ds-field-control-wrap` with `position: relative`, and position the button
  inside that wrapper. Hide the button when empty.

### 3. Toast Notifications Bumping Page Layout (CLS)

- **Wrong:** Placing a toast and its Dismiss button in the regular document flow
  inside `<main>`, inserting a blank 48px block that pushes content down.
- **Right:** Render `Toast` inside a fixed overlay
  (`position: fixed; bottom: var(--space-4); right: var(--space-4); z-index: 30;`)
  with the Dismiss button integrated directly inside the toast component.

### 4. Required Field Asterisk on Separate Line

- **Wrong:** Rendering `{props.isRequired ? <span>*</span> : null}` as a sibling
  to `<AriaLabel>` in a CSS grid field.
- **Right:** Nest the asterisk inside
  `<AriaLabel className="ds-field__label">{label} {props.isRequired && <span className="ds-field__required">*</span>}</AriaLabel>`.

### 5. Single-Character Vertical Money Wrapping

- **Wrong:** Setting `overflow-wrap: anywhere; white-space: normal;` on
  `.ds-money`, causing `SEK -286.40` to wrap vertically into single characters.
- **Right:** Set
  `.ds-money { white-space: nowrap; font-variant-numeric: tabular-nums; flex-shrink: 0; }`.

### 6. Smashed PageHeader Back Links

- **Wrong:** Rendering `Back` or `Close` as plain unstyled text directly next to
  `<h1>` on the same line.
- **Right:** Use an `IconButton` with an explicit icon (`ArrowLeft`, `X`) and
  minimum 44px hit target in the `leading` slot.

### 7. Isolated SecretField Reveal Toggle

- **Wrong:** Rendering "Show value" as an isolated centered button on its own
  row below the password input.
- **Right:** Position the eye / reveal toggle as an absolute trailing icon
  inside the password input control wrapper.

### 8. Premature Unsaved Changes Banner

- **Wrong:** Displaying an "Unsaved changes" banner immediately upon opening a
  clean, untouched form.
- **Right:** Only display draft warnings when the form is actually dirty
  (`isDirty === true` or has unsaved edits from a previous session).

### 9. Misaligned Filter Bar Controls

- **Wrong:** Placing labeled controls (Category dropdown, Search) and unlabeled
  controls (Period segmented buttons, Filters button) in the same flex row with
  `align-items: center`.
- **Right:** Align all controls to a common baseline using
  `align-items: flex-end;` and consistent `var(--control-height)`.

### 10. Missing Dialog Cancel Actions

- **Wrong:** Providing only a destructive action in a dialog footer with no
  secondary Cancel button.
- **Right:** Pair destructive/primary actions with a secondary `Cancel` button
  for accessible keyboard/touch safety.

### 11. Isolated Mobile Currency / Date Stacking

- **Wrong:** Placing `Amount` on one row and an isolated full-width `Currency`
  dropdown on the next row, or stacking `Date` and `Time` into two separate
  full-page rows on mobile.
- **Right:** Pair `[Amount (flexible) + Currency (compact ~96px)]` and
  `[Date (~60%) + Time (~40%)]` in responsive 2-column rows (`min-width: 0`).

### 12. Mobile Natural-Width Button Float Antipattern

- **Wrong:** Rendering primary CTAs on mobile (e.g. `[ Scan with AI ]`,
  `[ Save selected entries ]`, `[ Add expense ]`, `[ Delete this expense ]`)
  with natural width (~150px) floating to one side with 60% blank empty space.
- **Right:** On mobile (`< 720px`), primary form actions and sticky bottom bar
  buttons must span `width: 100%`.

### 13. Inverted Vertical Form Action Stacks

- **Wrong:** Placing the secondary/cancel button above the primary submit button
  in mobile vertical button stacks.
- **Right:** Always place the primary action on **TOP** and secondary/cancel on
  the **BOTTOM** in mobile vertical stacks.

### 14. Cluttered Multi-Action List Cards

- **Wrong:** Packing 5–6 unorganized wrapping inline buttons (`Use`, `Edit`,
  `Move up`, `Move down`, `Archive`, `Delete empty`) onto raw text lines inside
  list cards.
- **Right:** Use a structured 2-tier card layout: primary action on top,
  followed by a compact secondary action grid.

### 15. Modal & Drawer Header Close Button Wrapping / Stretching

- **Wrong:** Blanket mobile CSS rules (`.ds-page-header__actions > button { width: 100%; }`)
  that force single `IconButton` close triggers (`X`, back arrow) to wrap onto a
  new row beneath the title and stretch full-width or center awkwardly.
- **Right:** Keep modal/drawer/sheet headers on a single row with the close button
  pinned to the right edge (`.ds-page-header__actions > .ds-icon-button { width: auto; }`
  and `flex: 0 0 auto`).

### 16. Cluttered Choice Sheets & Intermediate Overlays

- **Wrong:** Bloating quick-decision sheets (such as `AddChoiceScreen`) with
  nested container cards, verbose multi-line explanatory paragraphs, and
  irregularly aligned icons.
- **Right:** Use clean, prominent, full-width action buttons with crisp titles and
  leading icons (`Plus`, `Search`/`Scan`), keeping intermediate choices direct,
  fast, and visually polished.

---

## 5. Risk-Based Visual Verification Procedure

Do not rerun the complete component, gallery, build, and browser matrix after
each small UI edit. Validate at two levels:

1. **Each UI edit:** normally run affected tests:
   ```bash
   deno task test:affected
   ```
   Alternatively, when validating a known source file directly or when Git-
   based changed selection is unsuitable, run:
   ```bash
   deno test --allow-read --allow-write --allow-run --allow-env \
     --related=src/design-system/components.tsx
   ```
   Add an immediate targeted browser/gallery check only when the edit changes
   focus, overlays, navigation, responsive layout, CSS-only behavior, or another
   effect Deno's module graph cannot observe.
2. **Named UI checkpoint:** run `deno task a11y:gallery`, the affected component
   layer if additional coverage is required, one production build for the
   coherent batch, and inspect all batch-owned states with `agent-browser`. Do
   not rerun unchanged successful commands merely because a reviewer starts.
3. **Inspect with `agent-browser` at the checkpoint:**
   - **Desktop Viewport (`1280×800`):**
     ```bash
     agent-browser set viewport 1280 800
     agent-browser open "http://127.0.0.1:5173/did-it-become-what-you-like/"
     agent-browser screenshot "desktop_check.png"
     ```
   - **Mobile Viewport (`390×844`):**
     ```bash
     agent-browser set viewport 390 844
     agent-browser screenshot "mobile_check.png"
     ```
4. **Verify Gallery Fixture:**
   ```bash
   agent-browser open "http://127.0.0.1:5173/did-it-become-what-you-like/src/design-system/gallery.html"
   agent-browser screenshot "gallery_check.png"
   ```
5. **Checklist Before Closing the Checkpoint:**
   - [ ] Mobile navigation tabs are anchored to the bottom.
   - [ ] No clear buttons or icons overflow their input borders.
   - [ ] No layout shift occurs when saving or triggering notifications.
   - [ ] Asterisks render inline next to field labels.
   - [ ] No segmented controls stretch into giant ovals in multi-column layouts.
   - [ ] Money numbers never wrap character-by-character.
   - [ ] All interactive touch targets are at least 44px.
