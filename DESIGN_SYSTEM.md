# Design System

## Status and Purpose

**Status: approved design foundation.** The repo owner delegated detailed
component and token decisions to the coding agent's best judgment based on all
approved screens in `UI_SPEC.md`.

This document is a design and component contract, not blanket authorization to
begin implementation. Exact token tuning may occur through the required visual
gallery review without changing the semantic roles or component
responsibilities. The M8 migration ledger in `IMPLEMENTATION_PLAN.md` orders
implementation; the owner must explicitly start migration implementation before
runtime, dependency, generated-asset, or styling changes are made.

The system is named **After Midnight**: a calm, comfortable dark interface for
quick expense entry and trustworthy later review. It should feel native and
quiet rather than like a dense financial dashboard.

## Foundation Decisions

- **View layer:** React with TypeScript 7 is confirmed.
- **Application state:** XState v5 remains the workflow authority; React binds
  to actors through `@xstate/react`.
- **Accessible behavior:** the repository-owned facade is the only application
  UI boundary. During M8, maintained Mantine components provide applicable
  low-level behavior through public APIs; the facade translates their events
  and preserves product-oriented contracts. The pre-M8 implementation is
  recorded in the migration matrix below and remains React Aria-backed until
  the ordered migration reaches it.
- **Styling:** semantic After Midnight CSS custom properties remain the visual
  source of truth. Mantine provider values and component defaults map to those
  roles; library-specific customization stays inside `src/design-system/**`.
  Ordinary CSS, cascade layers, and scoped component styles remain valid for
  product layout. Do not add Tailwind, a runtime CSS-in-JS system, or a second
  styled component library for the MVP.
- **Icons:** use directly imported
  [`lucide-react`](https://lucide.dev/guide/react) icons. Text labels remain the
  default; icons never carry essential meaning alone.
- **Native browser controls:** retain native file/camera capture and use native
  date/time inputs where already approved. Wrap them in the same field contract
  rather than replacing useful platform behavior.
- **Dependencies:** declare and pin browser dependencies through the Deno 2
  dependency configuration. M8-002 must prove the selected stable Mantine
  packages, React 19.2, Lucide, XState, TypeScript 7, Deno npm resolution,
  Vite, happy-dom, and Chromium work together before production facade
  conversion starts. No `@mantine/form` dependency is planned.

Mantine provides maintained low-level behavior, not the product's semantic
appearance or workflow state. Application screens must import repository-owned
design-system components rather than styling Mantine, React Aria, or another
library independently. A screen may use ordinary semantic layout elements, but
it must not create a parallel button, field, overlay, notice, or status pattern.

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
  mechanics. It must not become a second source of business truth. Until the
  ordered migration removes it, React Aria may own the same ephemeral state in
  the legacy facade implementation only.

## Mantine migration boundary

The migration preserves the public `src/design-system/index.ts` facade. Feature
and app files never import Mantine or React Aria directly. Public design-system
props, refs, callback signatures, and types remain library-neutral; library
events are translated inside the facade. After Midnight semantic tokens remain
the source of truth and are mapped into `MantineProvider` and facade defaults.

Mantine `styles`, `classNames`, provider APIs, copied source, private imports,
and raw palette indexes are confined to `src/design-system/**` and the
facade-owned provider. XState remains authoritative for durable form/workflow
state, native date/time/file/camera controls remain native where approved, and
domain composites remain repository-owned compositions. Ordinary interaction
and layout changes remain immediate (`0ms`); only approved functional progress
motion may move, with a reduced-motion equivalent.

The facade is intentionally divided into four migration classes:

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
| `warning`        |          `#F0C674` | Review needed and mismatch states                      |
| `info`           |          `#8FC8F8` | Neutral information and synchronization                |
| `focus-ring`     |          `#9AE8DA` | Keyboard focus indicator                               |

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
   - Content / Base: `z-index: 0`
   - Sticky Action / Filter Bars: `z-index: 10`
   - Fixed Mobile Bottom Navigation: `z-index: 20`
   - Modals, Drawers & Overlays (`.ds-modal-overlay`, `.local-ui-overlay`):
     `z-index: 40` (ensuring overlays sit cleanly over bottom navigation)
   - Floating Toasts / Global Status Notifications: `z-index: 50`
   - Ephemeral feedback (`Toast`) must render inside a dedicated fixed overlay
     container. Actions associated with notifications (Dismiss, Undo) must be
     colocated inside the floating notification container, never in regular
     flow.

6. **Mobile Navigation & Touch Ergonomics:**
   - Compact screens (`< 720px`) MUST anchor application navigation to the
     bottom viewport edge with safe-area padding
     (`padding-bottom: max(var(--space-2), env(safe-area-inset-bottom))`).
   - Bottom sheets (e.g. `AddChoiceScreen`) must include bottom safe-area
     clearance
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
| `SelectField`, `ComboBoxField`                          | Short selection and type-ahead long-list selection                                      |
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

## M8-001 facade inventory and migration matrix

The public barrel is `src/design-system/index.ts`; it currently re-exports all
public symbols from `src/design-system/components.tsx`. The matrix below is
the contract inventory for M8-001. A row may group a component with its
publicly exported prop/view type, but every public symbol is named. The target
column names only public Mantine or browser primitives; it does not authorize
their implementation before the ordered task and review gate.

| Public exports | Class | Current backing | M8 target primitive/composition |
| --- | --- | --- | --- |
| `Space` | facade type | CSS token scale | semantic CSS tokens mapped to Mantine spacing |
| `AppFrameProps`, `AppFrame` | small facade composition | semantic `aside`/`main` and CSS | Mantine `Box` plus semantic landmarks; retain facade-owned shell layout |
| `PageHeaderProps`, `PageHeader` | small facade composition | semantic heading/text and CSS | Mantine `Group`, `Title`, `Text`, and `Box` |
| `StackProps`, `Stack` | direct Mantine wrapper | CSS flex column | Mantine `Stack` with token gap |
| `InlineProps`, `Inline` | direct Mantine wrapper | CSS flex row | Mantine `Group` with token gap and justification |
| `ResponsiveGridProps`, `ResponsiveGrid` | direct Mantine wrapper | CSS grid | Mantine `SimpleGrid`/`Grid` with `align-content` and `align-items: start` |
| `ContentContainerProps`, `ContentContainer` | direct Mantine wrapper | bounded semantic `div` | Mantine `Container` with semantic size tokens |
| `TextProps`, `Text` | direct Mantine wrapper | semantic element and CSS | Mantine `Text`, preserving `as`, tone, and size |
| `HeadingProps`, `Heading` | direct Mantine wrapper | semantic `h1`–`h6` and CSS | Mantine `Title` or semantic heading with token size/level |
| `MoneyTextProps`, `formatMoney`, `MoneyText` | small facade composition | string-preserving formatter and `span` | Mantine `Text` plus facade-owned money formatting/nowrap |
| `DateTextProps`, `DateText` | small facade composition | semantic `time` | semantic `time` with Mantine typography defaults |
| `IconProps`, `Icon` | approved retained icon wrapper | Lucide SVG in semantic `span` | Lucide plus browser `span`; no replacement by a library icon system |
| `Tone`, `ButtonVariant`, `ButtonProps`, `Button` | direct Mantine wrapper | React Aria `Button` | Mantine `Button`, with facade variants and translated events |
| `IconButtonProps`, `IconButton` | direct Mantine wrapper | facade `Button` with Lucide icon | Mantine `ActionIcon`, with facade label/target contract |
| `LinkButtonProps`, `LinkButton` | direct Mantine wrapper | semantic anchor and CSS | Mantine `Anchor` with facade variant styling |
| `ActionCardProps`, `ActionCard` | small facade composition | React Aria `Button` with semantic content | Mantine `UnstyledButton`/`Card` composition |
| `FieldProps`, `Field` | small facade composition | semantic label/description/error wrapper | Mantine `Input.Wrapper`, `Input.Label`, `Input.Description`, and `Input.Error` |
| `TextField`, `TextAreaProps`, `TextArea` | direct Mantine wrapper | React Aria text field/input primitives | Mantine `TextInput` and `Textarea` behind the shared field contract |
| `SearchFieldProps`, `SearchField` | small facade composition | React Aria search field, input, and clear button | Mantine `TextInput`/`Autocomplete` plus facade clear action |
| `SecretFieldProps`, `SecretField` | direct Mantine wrapper | React Aria text field/input plus local reveal state | Mantine `PasswordInput`, preserving the reveal contract |
| `DecimalFieldProps`, `DecimalField` | direct Mantine wrapper | text input with decimal input mode | Mantine `TextInput` with string-preserving decimal semantics |
| `MoneyFieldProps`, `MoneyField` | small facade composition | `TextField` plus product guidance | Mantine `TextInput` and shared `Field` contract; direction remains outside |
| `NativeDateFieldProps`, `NativeDateField` | approved native control | browser `input[type=date]` plus `Field` | native date input plus Mantine-compatible field shell |
| `NativeTimeFieldProps`, `NativeTimeField` | approved native control | browser `input[type=time]` plus `Field` | native time input plus Mantine-compatible field shell |
| `FileFieldProps`, `FileField` | approved native control | browser `input[type=file]` plus `Field` | native file/camera input plus Mantine-compatible field shell |
| `SelectOption`, `SelectFieldProps`, `SelectField` | direct Mantine wrapper | React Aria select/list box/popover primitives | Mantine `Select`/public combobox primitives with translated selection |
| `ColorChoiceFieldProps`, `ColorChoiceField` | approved native control | native color input plus facade preset buttons | native `input[type=color]` plus Mantine layout/controls; preserve presets |
| `CheckboxProps`, `Checkbox` | direct Mantine wrapper | React Aria checkbox | Mantine `Checkbox` |
| `RadioGroupProps`, `RadioGroup` | direct Mantine wrapper | React Aria radio group/radios | Mantine `Radio.Group` and `Radio` |
| `SwitchProps`, `Switch` | direct Mantine wrapper | React Aria switch | Mantine `Switch` |
| `SegmentedOption`, `SegmentedControlProps`, `SegmentedControl` | direct Mantine wrapper | React Aria radio group/radios | Mantine `SegmentedControl`, preserving controlled values and overflow rules |
| `ChipProps`, `Chip` | small facade composition | semantic `span` plus facade remove button | Mantine `Pill`/`Badge` plus facade `ActionIcon` removal |
| `BadgeProps`, `Badge` | direct Mantine wrapper | semantic `span` and tone data attribute | Mantine `Badge` with semantic tone mapping |
| `StatusDotProps`, `StatusDot` | small facade composition | semantic status span and tone data attribute | Mantine `Badge`/`ThemeIcon` composition; status text remains required |
| `CardProps`, `Card`, `Section` | direct Mantine wrapper | semantic element and CSS surface | Mantine `Card`/`Paper`, preserving semantic `as` and surface roles |
| `Divider` | direct Mantine wrapper | browser `hr` and CSS | Mantine `Divider` |
| `DisclosureProps`, `Disclosure` | direct Mantine wrapper | React Aria disclosure/panel/button | Mantine `Accordion`/`Collapse` public APIs, preserving immediate expansion |
| `ListProps`, `List` | small facade composition | semantic `ul` | Mantine `List` or semantic `ul` with facade list contract |
| `ListRowProps`, `ListRow` | small facade composition | semantic `li` with flex slots | Mantine `Box`/`Group` plus semantic `li`; preserve nowrap trailing slots |
| `DefinitionListProps`, `DefinitionList` | small facade composition | semantic `dl`/`dt`/`dd` | semantic definition list plus Mantine layout primitives |
| `AdaptiveDialogProps`, `AdaptiveDialog` | direct Mantine wrapper | React Aria trigger/modal/overlay/dialog | Mantine `Drawer` on compact screens and `Modal` on wide screens |
| `ConfirmDialogProps`, `ConfirmDialog` | domain composite | `AdaptiveDialog` plus confirmation action | migrated `AdaptiveDialog` and facade `Button`; cancel remains required |
| `DeleteAndReassignProps`, `DeleteAndReassign` | domain composite | `AdaptiveDialog`, controlled replacement, local ephemeral choice | migrated facade dialog/select primitives; actor still owns command |
| `DangerDialogProps`, `DangerDialog` | domain composite | `AdaptiveDialog`, typed phrase, danger/cancel actions | migrated facade dialog/field/button primitives; no Mantine workflow state |
| `PopoverProps`, `Popover` | direct Mantine wrapper | React Aria trigger/popover/dialog | Mantine `Popover` |
| `MenuItem`, `Menu` | direct Mantine wrapper | React Aria menu trigger/popover/menu items | Mantine `Menu` and `Menu.Item`, translated action IDs |
| `Tooltip` | direct Mantine wrapper | React Aria tooltip trigger/tooltip | Mantine `Tooltip`, preserving accessible labels |
| `BannerProps`, `Banner`, `InlineNotice` | small facade composition | semantic status containers and CSS | Mantine `Alert` plus facade live-region/placement semantics |
| `ToastProps`, `Toast` | small facade composition | fixed semantic live-region toast and native dismiss button | Mantine `Notification` in a facade-owned fixed host |
| `StatusMessage` | small facade composition | semantic polite live-region container | Mantine `Alert`/`Text` with facade announcement semantics |
| `ProgressProps`, `Progress` | direct Mantine wrapper | React Aria progress bar and CSS track | Mantine `Progress`, preserving label/value and approved motion |
| `Skeleton` | direct Mantine wrapper | semantic `div` and CSS | Mantine `Skeleton` |
| `EmptyState`, `ErrorState` | small facade composition | semantic headings/text/action layout | Mantine `Stack`, `Text`, and `Alert` composition |
| `StickyActionBar` | small facade composition | semantic fixed/sticky container and CSS | Mantine `Box` plus facade safe-area/layering styles |
| `NavigationItem`, `AppNavigation` | small facade composition | semantic `nav` plus React Aria buttons | Mantine `NavLink`/`UnstyledButton` composition; shell remains facade-owned |
| `GlobalStatusProps`, `GlobalStatus` | reusable pattern | status mapping plus `StatusPanel` | existing facade `StatusPanel` backed by migrated primitives |
| `FormLayout`, `FormActions`, `ErrorSummary`, `DraftStatus` | reusable patterns | semantic wrappers and `StatusPanel` | migrated facade layout/status primitives; XState remains state authority |
| `FilterBar`, `ActiveFilterChips`, `FilterSheet` | reusable patterns | facade layout, `Chip`, and `AdaptiveDialog` | migrated facade layout/chip/dialog primitives |
| `StatusPanel`, `WorkflowProgress` | reusable patterns | facade layout, `Progress`, and `Badge` | migrated facade layout/progress/badge primitives |
| `PeriodPicker`, `ProjectPicker`, `CurrencyPicker`, `MerchantPicker` | domain composites | facade selectors and native date field | migrated facade `SegmentedControl`, select/combobox, and native date primitives |
| `MoneySummaryItem`, `MoneySummary`, `CategoryTotal`, `CategoryBreakdown` | domain composites | `MoneyText`, `List`, and semantic sections | migrated facade typography/layout/list primitives; signed totals stay domain-owned |
| `ExpenseViewModel`, `ExpenseRow`, `ExpenseList`, `ReceiptGroupProps`, `ReceiptGroup` | domain composites | facade list/disclosure/money primitives | migrated facade list/disclosure/money primitives; view models remain repository types |
| `ReceiptReconciliation`, `ReceiptSourcePicker`, `ReceiptMetadataViewModel`, `ReceiptMetadata` | domain composites | facade card/field/notice/native capture primitives | migrated facade card/field/notice primitives plus native file/camera behavior |
| `ReceiptLineViewModel`, `ReceiptLineCard`, `ReceiptLineEditorValue`, `ReceiptLineEditor` | domain composites | facade card, checkbox, field, and select primitives | migrated facade card/field/choice primitives; controlled editor values remain stable |
| `GeminiModelViewModel`, `ModelPicker` | domain composite | React Aria combo box/list box/popover | facade combobox/select primitives; compatibility and secret policy remain outside |
| `GeminiQuickSetup`, `GeminiConfigurationTest` | domain composites | facade card, secret field, notice, form, and status patterns | migrated facade primitives; no Mantine Form or duplicated durable state |
| `ExpenseForm`, `AppNavigationIconSet`, `DefaultNavigation` | reusable/domain composition | `FormLayout`, `FormActions`, and `AppNavigation` | migrated facade patterns; navigation/action semantics remain unchanged |

### Direct facade consumers

There are twelve direct import sites: nine production feature modules, one
feature test, and the two design-system verification modules. The application
has no direct design-system import from `src/app/**`; `src/app/main.tsx` only
loads the semantic token stylesheet. This table records the complete consumer
set and the imported facade symbols; symbols not named in a consumer are still
public API surface and are covered by the export matrix above.

| Consumer | Imported facade symbols |
| --- | --- |
| `src/features/conflict-import-ui/conflict-import-ui.tsx` | `Badge`, `Banner`, `Button`, `Card`, `Checkbox`, `ContentContainer`, `DefinitionList`, `Divider`, `EmptyState`, `ErrorState`, `FileField`, `Heading`, `Inline`, `InlineNotice`, `List`, `ListRow`, `PageHeader`, `Progress`, `RadioGroup`, `Section`, `Stack`, `StatusMessage`, `Text`, `TextArea`, `WorkflowProgress` |
| `src/features/destruction-ui.tsx` | `AdaptiveDialog`, `Badge`, `Button`, `Checkbox`, `ContentContainer`, `DefinitionList`, `FormActions`, `Heading`, `Inline`, `InlineNotice`, `List`, `ListRow`, `PageHeader`, `Stack`, `Text`, `WorkflowProgress` |
| `src/features/local-ui.tsx` | `ActionCard`, `ActiveFilterChips`, `AdaptiveDialog`, `AppFrame`, `Badge`, `Banner`, `Button`, `Card`, `CategoryBreakdown`, `ColorChoiceField`, `ConfirmDialog`, `ContentContainer`, `CurrencyPicker`, `DefaultNavigation`, `DefinitionList`, `DeleteAndReassign`, `Disclosure`, `DraftStatus`, `EmptyState`, `ErrorSummary`, `ExpenseForm`, `ExpenseList`, `FilterBar`, `FilterSheet`, `FormActions`, `Heading`, `Icon`, `IconButton`, `Inline`, `InlineNotice`, `List`, `ListRow`, `MerchantPicker`, `MoneyField`, `MoneySummary`, `NativeDateField`, `NativeTimeField`, `PageHeader`, `PeriodPicker`, `ProjectPicker`, `ReceiptGroup`, `SearchField`, `SegmentedControl`, `SelectField`, `Skeleton`, `Stack`, `Text`, `TextArea`, `TextField`, `Toast` |
| `src/features/receipt-ui.tsx` | `AdaptiveDialog`, `Button`, `Card`, `ContentContainer`, `ErrorState`, `GeminiConfigurationTest`, `GeminiQuickSetup`, `Heading`, `Inline`, `InlineNotice`, `ModelPicker`, `NativeDateField`, `PageHeader`, `ReceiptLineCard`, `ReceiptLineEditor`, `ReceiptMetadata`, `ReceiptReconciliation`, `ReceiptSourcePicker`, `Stack`, `StatusPanel`, `StickyActionBar`, `Switch`, `Text`, `TextField`, `WorkflowProgress` |
| `src/features/settings-pwa.tsx` | `Button`, `Card`, `ContentContainer`, `DefinitionList`, `FormActions`, `Heading`, `InlineNotice`, `LinkButton`, `List`, `ListRow`, `NativeTimeField`, `PageHeader`, `Stack`, `StatusMessage`, `Text` |
| `src/features/sync-ui/global-status.tsx` | `Button`, `Inline`, `StatusDot`, `Text` |
| `src/features/sync-ui/known-device-list.tsx` | `Badge`, `Button`, `ContentContainer`, `Disclosure`, `EmptyState`, `Heading`, `Icon`, `Inline`, `List`, `ListRow`, `PageHeader`, `Section`, `Stack`, `StatusMessage`, `Text`, `TextField` |
| `src/features/sync-ui/sync-account-panel.tsx` | `Button`, `Card`, `ConfirmDialog`, `ContentContainer`, `DefinitionList`, `ErrorState`, `Heading`, `Icon`, `Inline`, `InlineNotice`, `PageHeader`, `Progress`, `Section`, `Stack`, `StatusDot`, `StatusPanel`, `Switch`, `Text` |
| `src/features/sync-ui/sync-status.ts` | type `Tone` |
| `src/features/receipt-ui.test.tsx` | `GeminiQuickSetup`, `ModelPicker`, `ReceiptLineCard`, `ReceiptSourcePicker` |
| `src/design-system/gallery.tsx` | Gallery fixtures import the primitive, pattern, and composite symbols needed to exercise the visual contract; see its import block for the exhaustive fixture list. |
| `src/design-system/design-system.test.tsx` | `AdaptiveDialog`, `Button`, `Checkbox`, `ColorChoiceField`, `CurrencyPicker`, `DefinitionList`, `DeleteAndReassign`, `ExpenseRow`, `FileField`, `formatMoney`, `MerchantPicker`, `MoneySummary`, `MoneyText`, `NativeDateField`, `NativeTimeField`, `PageHeader`, `PeriodPicker`, `Progress`, `SegmentedControl`, `TextField` |

### Legacy React Aria inventory and impact register

Before M8, every React Aria value primitive is imported only by
`src/design-system/components.tsx`. The wrapped inventory is:

| React Aria primitive | Facade users | M8 replacement boundary |
| --- | --- | --- |
| `Button` | `Button`, `ActionCard`, select/search/model/disclosure/navigation triggers, chip/toast dismiss actions | Mantine `Button`, `ActionIcon`, `UnstyledButton`, or facade-owned semantic action |
| `Checkbox` | `Checkbox` | Mantine `Checkbox` |
| `ComboBox` | `ModelPicker` | Mantine public combobox/autocomplete primitive |
| `Dialog` | `AdaptiveDialog`, `Popover` | Mantine `Modal`/`Drawer`/`Popover` content behind facade |
| `DialogTrigger` | `AdaptiveDialog`, `Popover` | Mantine overlay trigger state behind facade |
| `Disclosure`, `DisclosurePanel` | `Disclosure` | Mantine `Accordion`/`Collapse` |
| `FieldError` | text, textarea, secret, select error rendering | Mantine `Input.Error` behind facade |
| `Input` | text, textarea/search/secret/select/model fields | Mantine `TextInput`/`Textarea`/public combobox primitives |
| `Label` | text, textarea, search, secret, select, radio, model fields | Mantine `Input.Label`/component labels behind facade |
| `ListBox`, `ListBoxItem` | select and model picker options | Mantine `Select`/combobox option primitives |
| `Menu`, `MenuItem`, `MenuTrigger` | `Menu` | Mantine `Menu`, `Menu.Item`, and trigger |
| `Modal`, `ModalOverlay` | `AdaptiveDialog` | Mantine `Modal`/`Drawer` |
| `Popover` | select, model picker, `Popover`, `Menu` | Mantine `Popover` and component-owned dropdowns |
| `ProgressBar` | `Progress` | Mantine `Progress` |
| `Radio`, `RadioGroup` | `RadioGroup`, `SegmentedControl` | Mantine `Radio.Group`/`Radio` and `SegmentedControl` |
| `SearchField` | `SearchField` | Mantine `TextInput`/public search composition |
| `Select`, `SelectValue` | `SelectField` | Mantine `Select` or documented public combobox API |
| `Switch` | `Switch` | Mantine `Switch` |
| `Text`, `TextArea`, `TextField` | text, textarea, search, secret, decimal, money, model fields | Mantine typography/input primitives behind facade |
| `Tooltip`, `TooltipTrigger` | `Tooltip` | Mantine `Tooltip` |

The current public prop aliases `AriaButtonProps`, `AriaCheckboxProps`,
`AriaDisclosureProps`, `AriaProgressBarProps`, `AriaRadioGroupProps`,
`AriaSearchFieldProps`, `AriaSelectProps`, `AriaSwitchProps`, and
`AriaTextFieldProps` are implementation-derived dependencies of the public
facade types. They are not application imports, but they are explicit M8 API
impact items and must be translated to facade-owned contracts before the
superseded dependency is removed.

| Impact ID | Frozen baseline and affected consumers | Migration decision |
| --- | --- | --- |
| `M8-API-001` | `Button`, `Checkbox`, `Disclosure`, `Progress`, `RadioGroup`, `SearchField`, `SelectField`, `Switch`, `TextField`, `TextArea`, and `SecretField` public types derive part of their shape from React Aria types. Application call sites rely on `onPress`, `onChange`, `isDisabled`, `isSelected`, `value`, and related controlled props. | Preserve the application-facing behavior while replacing inherited library types with facade-owned types in the ordered control task. No Mantine type may appear in the public barrel. |
| `M8-API-002` | Selection callbacks currently translate React Aria keys/events in `SelectField`, `SegmentedControl`, `RadioGroup`, `ModelPicker`, and pickers. | Keep product callbacks (`onValueChange`, `onChange`) and translate Mantine events internally. Record any unavoidable signature change before editing consumers. |
| `M8-API-003` | Current components do not consistently forward DOM refs; native field prop aliases inherit browser input props, while custom facade controls expose no documented ref contract. | Treat ref support as an explicit contract decision in M8-003/M8-004. Do not silently add or remove ref behavior; if forwarding is required, inventory all consumers and test focus/imperative use. |
| `M8-API-004` | Controlled text, decimal, money, date/time, select, segmented, switch, checkbox, and picker values are bound to actors in feature files. | Preserve string values and immediate callback behavior. Mantine Form is not introduced; XState actors remain durable state authority. |
| `M8-API-005` | Feature files pass facade `className` hooks for product layout, but no feature file imports a library-specific styling API. | Preserve approved facade class hooks where needed for product CSS; all Mantine `styles`, `classNames`, selectors, and provider configuration stay inside the facade/provider. |
| `M8-API-006` | `src/design-system/gallery.tsx` and `src/design-system/design-system.test.tsx` are the shared visual/behavior contract fixtures; `src/features/receipt-ui.test.tsx` is the feature-facing component regression surface. | Extend the cheapest affected fixture in each migration task and defer the complete gallery/browser matrix to the named review gate. |

No facade contract change is proposed by M8-001. The only planned changes are
the internal library backing and the removal of implementation-derived public
types recorded above; application imports and screen markup remain frozen until
an approved task and review gate say otherwise.

### Reusable patterns

| Pattern                                                    | Responsibility                                                 |
| ---------------------------------------------------------- | -------------------------------------------------------------- |
| `AppNavigation`                                            | Expenses/Add/Organize/Settings bottom bar and desktop rail     |
| `GlobalStatus`                                             | Offline, reconnecting, syncing, conflict, error, update status |
| `FormLayout`, `FormActions`, `ErrorSummary`, `DraftStatus` | Consistent form spacing, validation, dirty/save feedback       |
| `FilterBar`, `FilterSheet`, `ActiveFilterChips`            | Quick filters, advanced filters, removable active criteria     |
| `MasterDetail`                                             | Mobile list-to-detail and wide two-column detail composition   |
| `ManagementList`                                           | Active/archived sections, search, reorder and row actions      |
| `ReorderControls`                                          | Drag plus keyboard-accessible move actions                     |
| `SettingsList`, `SettingsRow`                              | Settings navigation with concise live summary                  |
| `StatusPanel`                                              | Identity, current state, timestamps, pending counts, actions   |
| `SafetyExportStep`                                         | Reusable pre-destructive JSON export/decline confirmation      |
| `WorkflowProgress`                                         | Named resumable steps, retry, and terminal result              |
| `UpdatePrompt`                                             | Checking/current/ready/offline/error and guarded reload        |

### Domain composites

| Composite                                                 | Responsibility                                                |
| --------------------------------------------------------- | ------------------------------------------------------------- |
| `ProjectPicker`                                           | Current project selection and stable-ID values                |
| `PeriodPicker`                                            | Today/month/year/custom calendar selection                    |
| `CurrencyPicker`, `MerchantPicker`                        | Searchable ISO currency and local merchant suggestions        |
| `MoneySummary`                                            | Net spent, outflows, and money back for identical filters     |
| `CategoryBreakdown`                                       | Ranked category totals and filter activation                  |
| `ExpenseList`, `ExpenseRow`, `ReceiptGroup`               | Date grouping, records, expandable receipt parent/lines       |
| `ExpenseForm`                                             | Shared create/edit fields and snapshot-derived save actions   |
| `ReceiptSourcePicker`                                     | Native camera/file input, ephemeral preview, replace/remove   |
| `GeminiQuickSetup`                                        | Inline key entry, warning, validation, resume action          |
| `ReceiptMetadata`, `ReceiptLineCard`, `ReceiptLineEditor` | Review/edit extracted parent and line values                  |
| `ReceiptReconciliation`                                   | Printed, selected, and difference totals plus warning         |
| `ProjectEditor`, `CategoryEditor`                         | Stable-ID entity create/edit forms                            |
| `DeleteAndReassign`                                       | Category replacement preview and atomic confirmation          |
| `ProjectDeletionReview`                                   | Project scope summary, safety export, typed confirmation      |
| `SyncAccountPanel`, `KnownDeviceList`                     | Drive identity/status and recognizable devices                |
| `ConflictResolver`                                        | Record/field progress, candidates, custom value, delete/edit  |
| `ModelPicker`, `GeminiConfigurationTest`                  | Searchable compatible models and explicit test states         |
| `ImportPreview`, `ImportModeChoice`                       | Schema/count validation and merge/dangerous replace           |
| `DeletionScopePicker`, `DeletionProgress`                 | Local/disconnect/everywhere scope and device acknowledgements |
| `PreferenceExample`                                       | Live expense-day boundary example with concrete dates         |
| `AboutSummary`                                            | Version/build, disclosure, privacy, licenses, source, updates |

## Screen-to-Component Mapping

| Screen/workflow               | Primary design-system composition                                                                                                                        |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| First use                     | `AppFrame`, `ContentContainer`, `ActionCard`, `InlineNotice`                                                                                             |
| 1 Expenses                    | `PageHeader`, `ProjectPicker`, `GlobalStatus`, `Banner`, `PeriodPicker`, `FilterBar`, `MoneySummary`, `CategoryBreakdown`, `ExpenseList`, `ReceiptGroup` |
| 2 Add Choice                  | `AdaptiveDialog`, two `ActionCard`s, `InlineNotice`                                                                                                      |
| 3 Manual/Create/Edit          | `PageHeader`, `FormLayout`, `SegmentedControl`, `MoneyField`, `ComboBoxField`, native date/time fields, `DraftStatus`, `FormActions`, `Toast`            |
| 4 Scan Receipt                | `PageHeader`, `ReceiptSourcePicker`, `StatusPanel`, `InlineNotice`, `GeminiQuickSetup`, `WorkflowProgress`, `StickyActionBar`                            |
| 5 Receipt Review              | `PageHeader`, `ReceiptMetadata`, `ReceiptReconciliation`, `ReceiptLineCard`, `ReceiptLineEditor`, `InlineNotice`, `StickyActionBar`                      |
| 6 Organize                    | `PageHeader`, `Section`, `ActionCard`, preview `ListRow`s                                                                                                |
| 7 Projects                    | `PageHeader`, `ManagementList`, `ReorderControls`, `ProjectEditor`, `ConfirmDialog`, `ProjectDeletionReview`                                             |
| 7A Populated project deletion | `ProjectDeletionReview`, `SafetyExportStep`, `DangerDialog`, `WorkflowProgress`                                                                          |
| 8 Categories                  | `PageHeader`, `ManagementList`, `SearchField`, `ReorderControls`, `CategoryEditor`, `DeleteAndReassign`                                                  |
| 9 Settings                    | `PageHeader`, `SettingsList`, `SettingsRow`                                                                                                              |
| 10 Google Drive               | `PageHeader`, `SyncAccountPanel`, `StatusPanel`, `SettingsList`, `InlineNotice`, `Button` variants                                                       |
| 10A Conflicts                 | `PageHeader`, `MasterDetail`, `Progress`, `ConflictResolver`, `RadioGroup`, `InlineNotice`                                                               |
| 10B Devices                   | `PageHeader`, `KnownDeviceList`, inline rename `TextField`, `StatusMessage`                                                                              |
| 11 Gemini Settings            | `PageHeader`, `SecretField`, `ModelPicker`, `Switch`, `GeminiConfigurationTest`, `ErrorState`                                                            |
| 12 Import/Export              | `PageHeader`, `FileField`, `ImportPreview`, `ImportModeChoice`, `SafetyExportStep`, `WorkflowProgress`, `DangerDialog`                                   |
| 13 Preferences                | `PageHeader`, `NativeTimeField`, `PreferenceExample`                                                                                                     |
| 14 Data and Privacy           | `PageHeader`, `DefinitionList`, `SettingsList`, `DeletionScopePicker`, `SafetyExportStep`, `DeletionProgress`, `DangerDialog`                            |
| 15 About                      | `PageHeader`, `AboutSummary`, `UpdatePrompt`, `DefinitionList`, link actions                                                                             |
| Cross-cutting drafts/saves    | `DraftStatus`, `StatusMessage`, `ConfirmDialog`, `ErrorSummary`, `Toast`                                                                                 |

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
checking all mapped screen consumers rather than only the component in
isolation.

## Deferred Work

- A light token set and theme switch.
- Charts and trend visualizations.
- A separate desktop table product.
- Brand illustration, custom iconography, and downloaded web fonts.
- Additional density modes or user-selectable visual preferences.

These are not implementation tasks in the MVP orchestration plan.
