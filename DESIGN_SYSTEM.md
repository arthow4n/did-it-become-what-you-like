# Design System

## Status and Purpose

**Status: approved design foundation.** The repo owner delegated detailed
component and token decisions to the coding agent's best judgment based on all
approved screens in `SPEC.md` and this design system.

This document is a living design and component contract. Exact token tuning may
occur through visual gallery and multi-viewport review without changing semantic
roles or component responsibilities.

The system is named **After Midnight**: a calm, comfortable dark interface for
quick expense entry and trustworthy later review. It should feel native and
quiet rather than like a dense financial dashboard.

## Foundation Decisions

- **View layer:** React with TypeScript 7 is confirmed.
- **Application state:** XState v5 remains the workflow authority; React binds
  to actors through `@xstate/react`.
- **Accessible behavior:** the repository-owned facade is the only application
  UI boundary. Maintained Mantine components provide applicable low-level
  behavior through public APIs; the facade translates their events and preserves
  product-oriented contracts.
- **Styling:** semantic After Midnight CSS custom properties remain the visual
  source of truth. Mantine provider values and component defaults map to those
  roles; library-specific customization stays inside `src/design-system/**`.
  Ordinary CSS, cascade layers, and scoped component styles remain valid for
  product layout. Do not add Tailwind, a runtime CSS-in-JS system, or a second
  styled component library for the MVP.
- **Icons:** use directly imported
  [`lucide-react`](https://lucide.dev/guide/react) icons. Text labels remain the
  default; icons never carry essential meaning alone.
- **Date, time, and file controls:** prefer Mantine's documented `DateInput`,
  `TimeInput`, and `Dropzone`/`FileInput` behind the facade when they preserve
  the product's string values, keyboard behavior, accessibility, and file/camera
  capture. Keep a native control as the explicit fallback when a Mantine wrapper
  cannot preserve useful platform behavior.
- **Dependencies:** declare and pin browser dependencies through the Deno 2
  dependency configuration. The selected stable Mantine packages, React 19.2,
  Lucide, XState, TypeScript 7, Deno npm resolution, Vite, happy-dom, and
  Chromium work together across the repository facade. No `@mantine/form`
  dependency is used.

Mantine provides maintained low-level behavior, not the product's semantic
appearance or workflow state. Application screens must import repository-owned
design-system components rather than styling Mantine or another library
independently. A screen may use ordinary semantic layout elements, but it must
not create a parallel button, field, overlay, notice, or status pattern.

## Ownership Boundary

The layers are:

```text
semantic tokens
    -> UI primitives
        -> reusable patterns
            -> domain composites
                -> screen compositions
```

- Tokens own visual decisions.
- UI primitives own accessible behavior and all interaction/visual states.
- Reusable patterns own common layout, feedback, and form composition.
- Domain composites translate snapshot-derived view models into expense-domain
  presentation.
- Screens arrange components and bind actor selectors/events.
- Design-system components never read IndexedDB, call Google APIs or Gemini,
  perform navigation, or decide business rules.
- XState actors own durable workflow state and permitted actions. Components
  receive controlled values, status, and callbacks or typed event dispatchers.
- Mantine may own ephemeral interaction state such as focus and popover
  mechanics. It must not become a second source of business truth. The
  superseded React Aria implementation is not a runtime dependency.

## Mantine migration boundary

The migration preserves the public `src/design-system/index.ts` facade. Feature
and app files never import Mantine or another component library directly. Public
design-system props, refs, callback signatures, and types remain
library-neutral; library events are translated inside the facade. After Midnight
semantic tokens remain the source of truth and are mapped into `MantineProvider`
and facade defaults.

`DesignSystemProvider` is the single runtime entry for Mantine. It forces the
approved dark scheme and maps the semantic color, type, spacing, radius, focus,
control-height, z-index, and motion contracts into Mantine's theme and CSS
variables. The application and gallery import the facade-owned style entry so
Mantine's layered CSS is loaded before `tokens.css`; screens do not import
Mantine styles directly.

Mantine `styles`, `classNames`, provider APIs, copied source, private imports,
and raw palette indexes are confined to `src/design-system/**` and the
facade-owned provider. XState remains authoritative for durable form/workflow
state, date/time/file/camera controls remain behind the facade (prefer Mantine
wrappers with a native fallback), and domain composites remain repository-owned
compositions. Ordinary interaction and layout changes remain immediate (`0ms`);
only approved functional progress motion may move, with a reduced-motion
equivalent.

### Facade implementation classes

- **Direct Mantine wrapper:** one maintained Mantine primitive owns the
  applicable low-level behavior, while facade props and semantic tokens are
  translated internally.
- **Small facade composition:** a few Mantine primitives and semantic browser
  elements are combined to preserve a product contract that has no one-to-one
  library component.
- **Domain composite:** repository-owned presentation maps domain/view-model
  data to facade primitives. Mantine never receives domain state directly from
  application screens.
- **Approved native control:** the browser owns date, time, file, camera, or
  color input behavior; the facade supplies the shared field contract and
  presentation.

## Theme Tokens

The MVP has one dark theme and no theme switch. All colors use semantic custom
properties so a future light token set can be added without changing component
APIs. Components must not hard-code palette values.

### Color roles

| Token            | Initial dark value | Responsibility                                         |
| ---------------- | -----------------: | ------------------------------------------------------ |
| `canvas`         |          `#101315` | App background                                         |
| `surface-1`      |          `#171B1F` | Primary cards and navigation                           |
| `surface-2`      |          `#1E2429` | Raised controls and grouped sections                   |
| `surface-3`      |          `#272E35` | Popovers, selected rows, overlays                      |
| `border-subtle`  |          `#3B4650` | Non-essential separators                               |
| `border-strong`  |          `#596875` | Interactive boundaries; at least 3:1 on `surface-1`    |
| `text-primary`   |          `#E8EDF1` | Primary copy; softened rather than pure white          |
| `text-secondary` |          `#B7C0C8` | Supporting copy                                        |
| `text-muted`     |          `#89949E` | Metadata; still AA for ordinary text on `surface-1`    |
| `accent`         |          `#78DCCA` | Restrained primary action and selection                |
| `on-accent`      |          `#0A211E` | Text/icons on filled accent controls                   |
| `positive`       |          `#86D9AA` | Money back, always with `+` and/or text                |
| `negative`       |          `#FF9E9E` | Expense outflow, always with a minus sign or label     |
| `danger`         |          `#FF9E9E` | Destructive actions and errors; separate semantic role |
| `on-danger`      |          `#241113` | Text/icons on filled danger controls                   |
| `warning`        |          `#F0C674` | Review needed and mismatch states                      |
| `info`           |          `#8FC8F8` | Neutral information and synchronization                |
| `focus-ring`     |          `#9AE8DA` | Keyboard focus indicator                               |

Status containers use dark tinted surfaces derived from these roles, while
foreground text keeps AA contrast. The initial primary, secondary, muted,
accent, positive, negative/danger, warning, and info foregrounds all exceed
4.5:1 on `surface-1`, and `on-danger` exceeds 4.5:1 on `danger`; token changes
must be rechecked rather than assuming the role name guarantees contrast.

### Type, spacing, and shape

- Use the platform UI stack: `system-ui`, `-apple-system`, `BlinkMacSystemFont`,
  `"Segoe UI"`, sans-serif. Do not download a font for MVP.
- Type steps are 12, 14, 16, 20, and 28 CSS pixels. Body and form controls start
  at 16px on mobile. Line heights remain between 1.25 and 1.55 by role.
- Money uses `font-variant-numeric: tabular-nums`; it does not use a separate
  monospace family.
- Spacing uses a 4px base with named steps: 4, 8, 12, 16, 20, 24, 32, 40, 48,
  and 64px. Components choose named steps, never arbitrary local gaps.
- Control heights are normally 48px, never below the agreed 44px target.
- Corner radii are 8px for controls, 12px for cards, 16px for sheets/dialogs,
  and a pill radius only for chips, badges, and compact segmented choices.
- Shadows are subtle and reserved for overlays or materially raised surfaces.
  Ordinary hierarchy comes from surface and border roles, not glow.
- A visible focus ring is 2px with a 2px offset and must remain unobscured.
- Ordinary state changes, navigation, overlays, expansion, and responsive
  recomposition are immediate: the default transition duration is `0ms` for
  every user, not only in reduced-motion mode. Motion is permitted only when it
  communicates ongoing work or another state which would otherwise be unclear,
  such as an indeterminate progress indicator; it must be restrained and never
  delay interaction. Reduced-motion mode removes even non-essential functional
  movement while preserving equivalent static state feedback.

### Responsive layout

Initial content-driven ranges, subject to visual verification, are:

| Range   |            Width | Composition                                        |
| ------- | ---------------: | -------------------------------------------------- |
| Compact |      below 720px | Bottom navigation, one column, sheets/full screens |
| Medium  |       720–1023px | Rail where it fits, bounded one/two-column content |
| Wide    | 1024px and above | Rail plus list/summary or list/detail columns      |

- Maximum app content width: 1200px.
- Maximum ordinary form width: 640px.
- Maximum settings/readable content width: 760px.
- Maximum receipt/conflict review width: 960px.
- Respect safe-area insets for fixed mobile actions and bottom navigation.
- Breakpoints may be tuned in the component gallery after visual inspection, but
  screens must not branch on device names or duplicate workflows.

### Layout, Flexbox, and Sizing Discipline

To prevent awkward layout collapse, disproportionate control expansion, and
flexbox abuse, all components and screens must follow these rules:

1. **Natural vs Full-Width Sizing & Form Ergonomics:**
   - Text inputs, text areas, and complex search bars take container width up to
     the form maximum (`--form-max: 640px`).
   - Compact controls (`Button`, `IconButton`, `SelectField`,
     `SegmentedControl`, `ColorChoiceField`, `NativeDateField`,
     `NativeTimeField`, `Badge`, `Chip`) MUST maintain their natural compact
     width or use explicit inline layout. Never blindly apply `flex: 1` or
     `width: 100%` where it stretches small controls into disproportionate
     shapes.
   - For segmented choices spanning a full form width (e.g. "Spent / Money
     back"), use equal fractional distribution (`flex: 1 1 0` per segment)
     rather than letting one small segment float in an empty void.
   - Multi-segment controls (e.g. Period selector) on narrow viewports
     (`< 360px` or compact mobile) enable horizontal swipe scrolling with hidden
     scrollbars to prevent label clipping.
   - Tightly coupled fields (`[Amount + Currency]`, `[Date + Time]`) pair into
     responsive two-column rows on desktop (`@media (min-width: 720px)`),
     collapsing to a single column on mobile.
   - Form action button groups on mobile (`< 720px`) expand to full width
     (`width: 100%`) and stack vertically (`flex-direction: column-reverse`)
     with the primary action on top. On desktop, action buttons retain natural
     width (right-aligned).
   - Embedded input adornments (search clear buttons, select chevrons like
     `CurrencyPicker`, secret reveal toggles) must be enclosed inside
     `.ds-field-control-wrap` with `position: relative` so icons anchor neatly
     inside the right boundary of the input box.
   - Description text below field labels uses secondary text color and caption
     font size.

2. **Grid and Asymmetric Stretch Prevention:**
   - Multi-column CSS Grid containers (`ResponsiveGrid`, multi-column cards,
     gallery sections) MUST specify `align-content: start; align-items: start;`.
     This prevents unequal column heights from vertically stretching short
     sibling items (e.g., preventing a pill-shaped `SegmentedControl` from
     expanding into a giant 220px oval/circle).
   - Interactive components inside grid layouts must specify `align-self: start`
     where stretching is inappropriate.

3. **Flexbox Compression & Text Overflow Protection:**
   - In horizontal flex rows pairing titles or long descriptions with trailing
     metrics or actions (e.g. `ListRow`, `PageHeader`, `FilterBar`), trailing
     slots (`.ds-list-row__trailing`, buttons, status chips, monetary amounts)
     MUST specify `flex-shrink: 0; white-space: nowrap;`.
   - The flexible text container (`.ds-list-row__main`, titles) must specify
     `flex: 1 1 auto; min-width: 0;` so that long text wraps or truncates
     gracefully without crushing adjacent elements.
   - Monetary amounts (`.ds-money`) must NEVER use
     `overflow-wrap: anywhere; white-space: normal;` — currency amounts must
     stay on a single line
     (`white-space: nowrap; font-variant-numeric: tabular-nums;`).
   - Financial summaries (`.ds-money-summary`) must adapt responsively on
     compact screens (`< 720px`) by stacking or using a balanced 2-column card
     layout to prevent label clipping and tabular number truncation.

4. **Spacing Rhythm & Visual Hierarchy:**
   - Spacing between elements must strictly use the named 4px tokens. Never
     collapse gaps completely or use arbitrary un-tokenized gaps:
     - `--space-1` (4px): tightly coupled sub-elements (icon + label in compact
       badge, segmented control item padding)
     - `--space-2` (8px): intra-field gaps (label to control, inline chip list,
       tight button pairs)
     - `--space-3` (12px): list row padding, filter bar items, related form
       groups, section internal spacing
     - `--space-4` (16px): intra-card element stacking, section content padding
     - `--space-5` (20px) / `--space-6` (24px): distinct form sections, cards in
       a stack, dialog content gaps
     - `--space-7` (32px) / `--space-8` (40px): page-level landmarks and main
       layout margins
   - Every interactive control must provide at least `--space-2` (8px) breathing
     room from neighboring elements.
   - Distinct management sections and cards must maintain `--space-3` (12px) to
     `--space-4` (16px) vertical gap spacing.
   - Top-level shell status banners must include bottom margin
     (`margin-bottom: var(--space-4)`).

5. **Z-Index Layering & Overlay Hierarchy:**
   - Content / Base: `z-index: 0` (`--layer-content`)
   - Sticky Action / Filter Bars: `z-index: 10` (`--layer-sticky`)
   - Fixed Mobile Bottom Navigation: `z-index: 20` (`--layer-navigation`)
   - Modals, Drawers & Overlays (`.ds-modal-overlay`, `.local-ui-overlay`):
     `z-index: 40` (`--layer-overlay`, ensuring overlays sit cleanly over bottom
     navigation)
   - Floating Toasts / Global Status Notifications: `z-index: 50`
     (`--layer-toast`)
   - Ephemeral feedback (`Toast`) must render inside a dedicated fixed overlay
     container. Actions associated with notifications (Dismiss, Undo) must be
     colocated inside the floating notification container, never in regular
     flow.

6. **Mobile Navigation & Touch Ergonomics:**
   - Compact screens (`< 720px`) MUST anchor application navigation to the
     bottom viewport edge with safe-area padding
     (`padding-bottom: max(var(--space-2), env(safe-area-inset-bottom))`).
   - Bottom sheets (e.g. `FilterSheet` or modal dialogs) must include bottom
     safe-area clearance
     (`padding-bottom: max(var(--space-5), env(safe-area-inset-bottom))`).
   - Content container `<main>` must maintain bottom padding
     (`padding-bottom: calc(var(--control-height) + var(--space-8) + env(safe-area-inset-bottom, 0px))`)
     so scrolled content is never clipped behind the fixed navigation bar.
   - Touch targets must meet the minimum 44px boundary.

7. **Dialogs and Form State Hygiene:**
   - Every modal, editor, or confirmation dialog must provide a secondary
     `Cancel` button alongside the primary action.
   - Pristine forms must suppress draft warning banners (`DraftStatus`) until
     actual user modification occurs (`isDirty === true`).
   - Safe focus restoration must occur on dialog/modal exit.

## Component Map

### UI primitives

| Component                                               | Responsibility                                                                          |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `AppFrame`                                              | Canvas, safe areas, bottom bar/rail transition, main landmark                           |
| `PageHeader`                                            | Back/close, title, project/scope, trailing status/actions                               |
| `Stack`, `Inline`, `ResponsiveGrid`, `ContentContainer` | Tokenized layout without screen-local gap values                                        |
| `Text`, `Heading`, `MoneyText`, `DateText`              | Semantic typography, signed money, tabular numbers, concrete dates                      |
| `Icon`                                                  | Lucide sizing and decorative/accessibility policy                                       |
| `Button`, `IconButton`, `LinkButton`                    | Primary, secondary, quiet, and danger actions; loading included                         |
| `ActionCard`                                            | Large labeled first-use/add-choice action with description                              |
| `Field`                                                 | Label, required/optional status, description, error, control slot                       |
| `TextField`, `TextArea`, `SearchField`, `SecretField`   | Common text entry, clear/reveal behavior, validation                                    |
| `DecimalField`, `MoneyField`                            | Decimal-string quantity/price and signed-domain money input; direction remains separate |
| `NativeDateField`, `NativeTimeField`, `FileField`       | Approved platform inputs inside the Field contract                                      |
| `SelectField`                                           | Short selection and type-ahead long-list selection                                      |
| `ColorChoiceField`                                      | Optional labeled category color with accessible presets/custom value                    |
| `Checkbox`, `RadioGroup`, `Switch`, `SegmentedControl`  | Boolean, exclusive, and compact mode selection                                          |
| `Chip`, `Badge`, `StatusDot`                            | Filters and status supplements; never color-only                                        |
| `Card`, `Section`, `Divider`, `Disclosure`              | Grouping and natural-height expandable content                                          |
| `List`, `ListRow`, `DefinitionList`                     | Navigable/summary records with consistent density                                       |
| `AdaptiveDialog`                                        | Sheet on compact screens, modal/popover on wider screens                                |
| `ConfirmDialog`                                         | Ordinary confirmation with safe initial focus                                           |
| `DangerDialog`                                          | Strong destructive confirmation and typed phrase slot                                   |
| `Popover`, `Menu`, `Tooltip`                            | Accessible transient supporting controls                                                |
| `Banner`, `InlineNotice`, `Toast`, `StatusMessage`      | Persistent, inline, transient, and announced feedback                                   |
| `Progress`, `Skeleton`, `EmptyState`, `ErrorState`      | Async and collection states without layout jumps                                        |
| `StickyActionBar`                                       | Safe-area-aware compact-screen primary actions                                          |

Every interactive primitive supports the applicable default, hover, pressed,
focus-visible, selected, disabled, pending, invalid, and read-only states. A
pending control keeps its label or an equally descriptive accessible name.

### Reusable patterns

| Pattern                                                    | Responsibility                                                     |
| ---------------------------------------------------------- | ------------------------------------------------------------------ |
| `AppNavigation`                                            | Expenses/Manual/Scan/Organize/Settings bottom bar and desktop rail |
| `GlobalStatus`                                             | Offline, reconnecting, syncing, conflict, error, update status     |
| `FormLayout`, `FormActions`, `ErrorSummary`, `DraftStatus` | Consistent form spacing, validation, dirty/save feedback           |
| `FilterBar`, `FilterSheet`, `ActiveFilterChips`            | Quick filters, advanced filters, removable active criteria         |
| `MasterDetail`                                             | Mobile list-to-detail and wide two-column detail composition       |
| `ManagementList`                                           | Active/archived sections, search, reorder and row actions          |
| `ReorderControls`                                          | Drag plus keyboard-accessible move actions                         |
| `SettingsList`, `SettingsRow`                              | Settings navigation with concise live summary                      |
| `StatusPanel`                                              | Identity, current state, timestamps, pending counts, actions       |
| `SafetyExportStep`                                         | Reusable pre-destructive JSON export/decline confirmation          |
| `WorkflowProgress`                                         | Named resumable steps, retry, and terminal result                  |
| `UpdatePrompt`                                             | Checking/current/ready/offline/error and guarded reload            |

### Domain composites

| Composite                                                 | Responsibility                                                                                                         |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `ProjectPicker`                                           | Current project selection and stable-ID values                                                                         |
| `PeriodPicker`                                            | Today/month/year/custom calendar selection                                                                             |
| `CurrencyPicker`, `MerchantPicker`                        | Searchable ISO currency and local merchant suggestions                                                                 |
| `MoneySummary`                                            | Net spent, outflows, and money back for identical filters                                                              |
| `CategoryBreakdown`                                       | Ranked category totals and filter activation                                                                           |
| `ExpenseList`, `ExpenseRow`, `ReceiptGroup`               | Date grouping, records, expandable receipt parent/lines                                                                |
| `ExpenseForm`                                             | Shared create/edit fields and snapshot-derived save actions                                                            |
| `ReceiptSourcePicker`                                     | Native camera/file input, ephemeral preview, replace/remove                                                            |
| `GeminiQuickSetup`                                        | Inline key entry, warning, validation, resume action                                                                   |
| `ReceiptMetadata`, `ReceiptLineCard`, `ReceiptLineEditor` | Review/edit extracted parent and line values; `ReceiptLineCard` also has a management variant without review selection |
| `ReceiptDetail`                                           | Saved receipt metadata, reconciliation, line hierarchy, and management actions                                         |
| `ReceiptReconciliation`                                   | Printed, selected, and difference totals plus warning                                                                  |
| `ProjectEditor`, `CategoryEditor`                         | Stable-ID entity create/edit forms                                                                                     |
| `DeleteAndReassign`                                       | Category replacement preview and atomic confirmation                                                                   |
| `ProjectDeletionReview`                                   | Project scope summary, safety export, typed confirmation                                                               |
| `SyncAccountPanel`, `KnownDeviceList`                     | Drive identity/status and recognizable devices                                                                         |
| `ConflictResolver`                                        | Record/field progress, candidates, custom value, delete/edit                                                           |
| `ModelPicker`, `GeminiConfigurationTest`                  | Searchable compatible models and explicit test states                                                                  |
| `ImportPreview`, `ImportModeChoice`                       | Schema/count validation and merge/dangerous replace                                                                    |
| `DeletionScopePicker`, `DeletionProgress`                 | Local/disconnect/everywhere scope and device acknowledgements                                                          |
| `PreferenceExample`                                       | Live expense-day boundary example with concrete dates                                                                  |
| `AboutSummary`                                            | Version/build, disclosure, privacy, licenses, source, updates                                                          |

Components should be split when they have a stable responsibility, independent
variants/tests, or multiple consumers; tiny private layout helpers may remain
colocated.

## Interaction and Content Rules

- One screen has one clear primary action. Secondary and dangerous actions do
  not visually compete with it.
- Use sentence case and direct verbs: **Save expense**, **Review conflicts**,
  **Delete everywhere**. Avoid tutorial copy and unexplained jargon.
- Amounts always show currency and natural sign. Color supplements the `+`/`-`
  and text; it never replaces them.
- Disabled controls explain why nearby. Do not use disabled state to conceal a
  recoverable error or required setup path.
- Errors appear next to the responsible field/action and in an error summary
  when submission fails. Focus moves only when that helps recovery.
- Toasts confirm non-critical completed actions and never contain the only copy
  of important information. Persistent problems use a banner or inline notice.
- Destructive actions state scope, offer the agreed safety export where
  applicable, and use danger styling only at the decision point.
- Empty states explain the current scope and offer the single most useful next
  action. They do not become tutorial pages.
- Loading uses a stable layout. Prefer a labeled progress/status state over a
  spinner with no explanation for any operation that may take noticeable time.
- Lists use stable IDs as keys. Reordering always has keyboard controls in
  addition to drag interaction.
- Saved receipt detail uses a clear `View receipt` entry point from a receipt
  group and keeps line activation within the receipt-detail workflow. The detail
  hierarchy must show metadata and reconciliation before destructive actions,
  and must distinguish purchase lines from adjustments without relying on color.
  Receipt groups keep that entry point explicit rather than making an entire
  expanded group an ambiguous click target; management line cards do not render
  the review-only selection checkbox.
- Receipt metadata and line editors use the shared Field, FormActions,
  DraftStatus, and AdaptiveDialog contracts. Dirty staged values are owned by
  the XState actor; in-app exits offer Keep editing and Discard changes, and
  successful destructive actions restore focus to the expense-list entry point.
- Receipt management remains usable at compact, medium, and wide widths. On
  compact screens detail becomes a focused sequence with safe-area-aware
  actions; on wider screens it may use the approved MasterDetail composition.

## Component Verification Contract

Before application screens consume the system, implementation must provide a
development-only component gallery reachable through the Deno-run dev workflow.
It must render:

- every primitive and pattern state on the dark canvas and each surface;
- automated contrast checks for the documented semantic token pairings;
- compact, medium, and wide compositions;
- long labels, large monetary values, empty values, errors, pending, disabled,
  selected, and focus-visible states;
- the immediate-by-default motion policy, reduced-motion fallback for the few
  functional indicators, and forced-colors/high-contrast behavior where the
  browser supports inspection; and
- representative mobile and desktop screenshots plus accessibility-tree checks
  through `agent-browser` and Chromium.

The gallery is a verification surface, not a production route or a second
component documentation framework. Exact token tuning happens there before
screens are considered visually accepted. Changes to a shared component require
checking all mapped screen consumers rather than only the component in
isolation.

## Deferred Work

- A light token set and theme switch.
- Charts and trend visualizations.
- A separate desktop table product.
- Brand illustration, custom iconography, and downloaded web fonts.
- Additional density modes or user-selectable visual preferences.

These are not implementation tasks in the MVP orchestration plan.
