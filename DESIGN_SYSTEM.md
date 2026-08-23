# Design System

## Status and Purpose

**Status: approved design foundation.** The repo owner delegated detailed
component and token decisions to the coding agent's best judgment based on all
approved screens in `UI_SPEC.md`.

This document is a design and component contract, not authorization to begin
implementation. Exact token tuning may occur through the required visual
gallery review without changing the semantic roles or component responsibilities.
The repo owner must still approve the later implementation plan before
application code is written.

The system is named **After Midnight**: a calm, comfortable dark interface for
quick expense entry and trustworthy later review. It should feel native and
quiet rather than like a dense financial dashboard.

## Foundation Decisions

- **View layer:** React with TypeScript 7 is confirmed.
- **Application state:** XState v5 remains the workflow authority; React binds
  to actors through `@xstate/react`.
- **Accessible behavior:** build repository-owned components on
  [`react-aria-components`](https://react-spectrum.adobe.com/react-aria/components.html).
  Use its unstyled composition and interaction behavior for controls such as
  dialogs, popovers, list boxes, combo boxes, switches, disclosures, and tabs.
- **Styling:** ordinary CSS, CSS custom properties, cascade layers, and scoped
  component styles. Do not add Tailwind, a runtime CSS-in-JS system, or a second
  styled component library for the MVP.
- **Icons:** use directly imported
  [`lucide-react`](https://lucide.dev/guide/react) icons. Text labels remain the
  default; icons never carry essential meaning alone.
- **Native browser controls:** retain native file/camera capture and use native
  date/time inputs where already approved. Wrap them in the same field contract
  rather than replacing useful platform behavior.
- **Dependencies:** declare and pin browser dependencies through the Deno 2
  dependency configuration. A pre-implementation compatibility gate must prove
  React, React Aria Components, Lucide, XState, and TypeScript 7 work together
  under the chosen Deno-run frontend build before feature work starts.

React Aria provides behavior, not the product's appearance. Application screens
must import repository-owned design-system components rather than styling React
Aria primitives independently. A screen may use ordinary semantic layout
elements, but it must not create a parallel button, field, overlay, notice, or
status pattern.

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
- React Aria may own ephemeral interaction state such as focus and popover
  mechanics. It must not become a second source of business truth.

## Theme Tokens

The MVP has one dark theme and no theme switch. All colors use semantic custom
properties so a future light token set can be added without changing component
APIs. Components must not hard-code palette values.

### Color roles

| Token | Initial dark value | Responsibility |
|---|---:|---|
| `canvas` | `#101315` | App background |
| `surface-1` | `#171B1F` | Primary cards and navigation |
| `surface-2` | `#1E2429` | Raised controls and grouped sections |
| `surface-3` | `#272E35` | Popovers, selected rows, overlays |
| `border-subtle` | `#3B4650` | Non-essential separators |
| `border-strong` | `#596875` | Interactive boundaries; at least 3:1 on `surface-1` |
| `text-primary` | `#E8EDF1` | Primary copy; softened rather than pure white |
| `text-secondary` | `#B7C0C8` | Supporting copy |
| `text-muted` | `#89949E` | Metadata; still AA for ordinary text on `surface-1` |
| `accent` | `#78DCCA` | Restrained primary action and selection |
| `on-accent` | `#0A211E` | Text/icons on filled accent controls |
| `positive` | `#86D9AA` | Money back, always with `+` and/or text |
| `negative` | `#FF9E9E` | Expense outflow, always with a minus sign or label |
| `danger` | `#FF9E9E` | Destructive actions and errors; separate semantic role |
| `warning` | `#F0C674` | Review needed and mismatch states |
| `info` | `#8FC8F8` | Neutral information and synchronization |
| `focus-ring` | `#9AE8DA` | Keyboard focus indicator |

Status containers use dark tinted surfaces derived from these roles, while
foreground text keeps AA contrast. The initial primary, secondary, muted,
accent, positive, negative/danger, warning, and info foregrounds all exceed
4.5:1 on `surface-1`; token changes must be rechecked rather than assuming the
role name guarantees contrast.

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

| Range | Width | Composition |
|---|---:|---|
| Compact | below 720px | Bottom navigation, one column, sheets/full screens |
| Medium | 720–1023px | Rail where it fits, bounded one/two-column content |
| Wide | 1024px and above | Rail plus list/summary or list/detail columns |

- Maximum app content width: 1200px.
- Maximum ordinary form width: 640px.
- Maximum settings/readable content width: 760px.
- Maximum receipt/conflict review width: 960px.
- Respect safe-area insets for fixed mobile actions and bottom navigation.
- Breakpoints may be tuned in the component gallery after visual inspection,
  but screens must not branch on device names or duplicate workflows.

## Component Map

### UI primitives

| Component | Responsibility |
|---|---|
| `AppFrame` | Canvas, safe areas, bottom bar/rail transition, main landmark |
| `PageHeader` | Back/close, title, project/scope, trailing status/actions |
| `Stack`, `Inline`, `ResponsiveGrid`, `ContentContainer` | Tokenized layout without screen-local gap values |
| `Text`, `Heading`, `MoneyText`, `DateText` | Semantic typography, signed money, tabular numbers, concrete dates |
| `Icon` | Lucide sizing and decorative/accessibility policy |
| `Button`, `IconButton`, `LinkButton` | Primary, secondary, quiet, and danger actions; loading included |
| `ActionCard` | Large labeled first-use/add-choice action with description |
| `Field` | Label, required/optional status, description, error, control slot |
| `TextField`, `TextArea`, `SearchField`, `SecretField` | Common text entry, clear/reveal behavior, validation |
| `DecimalField`, `MoneyField` | Decimal-string quantity/price and signed-domain money input; direction remains separate |
| `NativeDateField`, `NativeTimeField`, `FileField` | Approved platform inputs inside the Field contract |
| `SelectField`, `ComboBoxField` | Short selection and type-ahead long-list selection |
| `ColorChoiceField` | Optional labeled category color with accessible presets/custom value |
| `Checkbox`, `RadioGroup`, `Switch`, `SegmentedControl` | Boolean, exclusive, and compact mode selection |
| `Chip`, `Badge`, `StatusDot` | Filters and status supplements; never color-only |
| `Card`, `Section`, `Divider`, `Disclosure` | Grouping and natural-height expandable content |
| `List`, `ListRow`, `DefinitionList` | Navigable/summary records with consistent density |
| `AdaptiveDialog` | Sheet on compact screens, modal/popover on wider screens |
| `ConfirmDialog` | Ordinary confirmation with safe initial focus |
| `DangerDialog` | Strong destructive confirmation and typed phrase slot |
| `Popover`, `Menu`, `Tooltip` | Accessible transient supporting controls |
| `Banner`, `InlineNotice`, `Toast`, `StatusMessage` | Persistent, inline, transient, and announced feedback |
| `Progress`, `Skeleton`, `EmptyState`, `ErrorState` | Async and collection states without layout jumps |
| `StickyActionBar` | Safe-area-aware compact-screen primary actions |

Every interactive primitive supports the applicable default, hover, pressed,
focus-visible, selected, disabled, pending, invalid, and read-only states. A
pending control keeps its label or an equally descriptive accessible name.

### Reusable patterns

| Pattern | Responsibility |
|---|---|
| `AppNavigation` | Expenses/Add/Organize/Settings bottom bar and desktop rail |
| `GlobalStatus` | Offline, reconnecting, syncing, conflict, error, update status |
| `FormLayout`, `FormActions`, `ErrorSummary`, `DraftStatus` | Consistent form spacing, validation, dirty/save feedback |
| `FilterBar`, `FilterSheet`, `ActiveFilterChips` | Quick filters, advanced filters, removable active criteria |
| `MasterDetail` | Mobile list-to-detail and wide two-column detail composition |
| `ManagementList` | Active/archived sections, search, reorder and row actions |
| `ReorderControls` | Drag plus keyboard-accessible move actions |
| `SettingsList`, `SettingsRow` | Settings navigation with concise live summary |
| `StatusPanel` | Identity, current state, timestamps, pending counts, actions |
| `SafetyExportStep` | Reusable pre-destructive JSON export/decline confirmation |
| `WorkflowProgress` | Named resumable steps, retry, and terminal result |
| `UpdatePrompt` | Checking/current/ready/offline/error and guarded reload |

### Domain composites

| Composite | Responsibility |
|---|---|
| `ProjectPicker` | Current project selection and stable-ID values |
| `PeriodPicker` | Today/month/year/custom calendar selection |
| `CurrencyPicker`, `MerchantPicker` | Searchable ISO currency and local merchant suggestions |
| `MoneySummary` | Net spent, outflows, and money back for identical filters |
| `CategoryBreakdown` | Ranked category totals and filter activation |
| `ExpenseList`, `ExpenseRow`, `ReceiptGroup` | Date grouping, records, expandable receipt parent/lines |
| `ExpenseForm` | Shared create/edit fields and snapshot-derived save actions |
| `ReceiptSourcePicker` | Native camera/file input, ephemeral preview, replace/remove |
| `GeminiQuickSetup` | Inline key entry, warning, validation, resume action |
| `ReceiptMetadata`, `ReceiptLineCard`, `ReceiptLineEditor` | Review/edit extracted parent and line values |
| `ReceiptReconciliation` | Printed, selected, and difference totals plus warning |
| `ProjectEditor`, `CategoryEditor` | Stable-ID entity create/edit forms |
| `DeleteAndReassign` | Category replacement preview and atomic confirmation |
| `ProjectDeletionReview` | Project scope summary, safety export, typed confirmation |
| `SyncAccountPanel`, `KnownDeviceList` | Drive identity/status and recognizable devices |
| `ConflictResolver` | Record/field progress, candidates, custom value, delete/edit |
| `ModelPicker`, `GeminiConfigurationTest` | Searchable compatible models and explicit test states |
| `ImportPreview`, `ImportModeChoice` | Schema/count validation and merge/dangerous replace |
| `DeletionScopePicker`, `DeletionProgress` | Local/disconnect/everywhere scope and device acknowledgements |
| `PreferenceExample` | Live expense-day boundary example with concrete dates |
| `AboutSummary` | Version/build, disclosure, privacy, licenses, source, updates |

## Screen-to-Component Mapping

| Screen/workflow | Primary design-system composition |
|---|---|
| First use | `AppFrame`, `ContentContainer`, `ActionCard`, `InlineNotice` |
| 1 Expenses | `PageHeader`, `ProjectPicker`, `GlobalStatus`, `Banner`, `PeriodPicker`, `FilterBar`, `MoneySummary`, `CategoryBreakdown`, `ExpenseList`, `ReceiptGroup` |
| 2 Add Choice | `AdaptiveDialog`, two `ActionCard`s, `InlineNotice` |
| 3 Manual/Create/Edit | `PageHeader`, `FormLayout`, `SegmentedControl`, `MoneyField`, `ComboBoxField`, native date/time fields, `DraftStatus`, `FormActions`, `Toast` |
| 4 Scan Receipt | `PageHeader`, `ReceiptSourcePicker`, `StatusPanel`, `InlineNotice`, `GeminiQuickSetup`, `WorkflowProgress`, `StickyActionBar` |
| 5 Receipt Review | `PageHeader`, `ReceiptMetadata`, `ReceiptReconciliation`, `ReceiptLineCard`, `ReceiptLineEditor`, `InlineNotice`, `StickyActionBar` |
| 6 Organize | `PageHeader`, `Section`, `ActionCard`, preview `ListRow`s |
| 7 Projects | `PageHeader`, `ManagementList`, `ReorderControls`, `ProjectEditor`, `ConfirmDialog`, `ProjectDeletionReview` |
| 7A Populated project deletion | `ProjectDeletionReview`, `SafetyExportStep`, `DangerDialog`, `WorkflowProgress` |
| 8 Categories | `PageHeader`, `ManagementList`, `SearchField`, `ReorderControls`, `CategoryEditor`, `DeleteAndReassign` |
| 9 Settings | `PageHeader`, `SettingsList`, `SettingsRow` |
| 10 Google Drive | `PageHeader`, `SyncAccountPanel`, `StatusPanel`, `SettingsList`, `InlineNotice`, `Button` variants |
| 10A Conflicts | `PageHeader`, `MasterDetail`, `Progress`, `ConflictResolver`, `RadioGroup`, `InlineNotice` |
| 10B Devices | `PageHeader`, `KnownDeviceList`, inline rename `TextField`, `StatusMessage` |
| 11 Gemini Settings | `PageHeader`, `SecretField`, `ModelPicker`, `Switch`, `GeminiConfigurationTest`, `ErrorState` |
| 12 Import/Export | `PageHeader`, `FileField`, `ImportPreview`, `ImportModeChoice`, `SafetyExportStep`, `WorkflowProgress`, `DangerDialog` |
| 13 Preferences | `PageHeader`, `NativeTimeField`, `PreferenceExample` |
| 14 Data and Privacy | `PageHeader`, `DefinitionList`, `SettingsList`, `DeletionScopePicker`, `SafetyExportStep`, `DeletionProgress`, `DangerDialog` |
| 15 About | `PageHeader`, `AboutSummary`, `UpdatePrompt`, `DefinitionList`, link actions |
| Cross-cutting drafts/saves | `DraftStatus`, `StatusMessage`, `ConfirmDialog`, `ErrorSummary`, `Toast` |

This mapping is a reuse requirement, not a mandate that every listed component
live in a separate file. Components should be split when they have a stable
responsibility, independent variants/tests, or multiple consumers; tiny private
layout helpers may remain colocated.

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
checking all mapped screen consumers rather than only the component in isolation.

## Deferred Work

- A light token set and theme switch.
- Charts and trend visualizations.
- A separate desktop table product.
- Brand illustration, custom iconography, and downloaded web fonts.
- Additional density modes or user-selectable visual preferences.

These are not implementation tasks in the MVP orchestration plan.
