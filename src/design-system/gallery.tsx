import { createRoot } from "react-dom/client";
import { useState } from "react";
import {
  ActionCard,
  AdaptiveDialog,
  AppFrame,
  Badge,
  Banner,
  Button,
  CategoryBreakdown,
  Checkbox,
  ContentContainer,
  DateText,
  DefaultNavigation,
  Disclosure,
  Divider,
  DraftStatus,
  EmptyState,
  ErrorState,
  ExpenseList,
  FormActions,
  GlobalStatus,
  Heading,
  Icon,
  IconButton,
  Inline,
  InlineNotice,
  ListRow,
  MoneyField,
  MoneySummary,
  MoneyText,
  NativeDateField,
  NativeTimeField,
  PageHeader,
  PeriodPicker,
  Progress,
  RadioGroup,
  ReceiptReconciliation,
  ResponsiveGrid,
  SearchField,
  SecretField,
  SegmentedControl,
  SelectField,
  Skeleton,
  Stack,
  StatusMessage,
  StatusPanel,
  StickyActionBar,
  Switch,
  Text,
  TextArea,
  TextField,
  Toast,
  WorkflowProgress,
} from "./components.tsx";
import "./tokens.css";
import { AlertCircle, Check, Plus, Settings, X } from "lucide-react";

const longLabel =
  "A deliberately long merchant and category label that must wrap without creating page-level horizontal scrolling";

export function DesignSystemGallery() {
  const [period, setPeriod] = useState("month");
  const [saved, setSaved] = useState<"idle" | "saving" | "saved" | "failed">(
    "idle",
  );
  const [offline, setOffline] = useState(false);
  const [selected, setSelected] = useState("spent");

  const saveLabel = saved === "saving"
    ? "Saving expense"
    : saved === "saved"
    ? "Saved expense"
    : saved === "failed"
    ? "Retry save"
    : "Save expense";
  const save = () => {
    setSaved("saving");
    globalThis.setTimeout(() => setSaved("saved"), 350);
  };

  return (
    <AppFrame navigation={<DefaultNavigation selected="expenses" />}>
      <ContentContainer>
        <Stack gap={7}>
          <PageHeader
            eyebrow="After Midnight · development-only fixture"
            title="Shared design-system gallery"
            headingLevel={1}
            description="A verification surface for semantics, states, tokens, focus, responsive layout, and the immediate-motion policy."
            status={
              <GlobalStatus
                status={offline ? "offline" : "synced"}
                action={
                  <Button
                    variant="quiet"
                    onPress={() => setOffline((value) => !value)}
                  >
                    {offline ? "Reconnect" : "Go offline"}
                  </Button>
                }
              />
            }
            actions={
              <IconButton aria-label="Gallery settings" icon={<Settings />} />
            }
          />

          <Banner
            tone="warning"
            title="Review needed"
            action={<Button variant="secondary">Review conflicts</Button>}
          >
            Two conflicts need review. The warning includes text and an action,
            not color alone.
          </Banner>

          <ResponsiveGrid columns={3}>
            <section className="ds-gallery__section">
              <Heading size="sm">Actions and variants</Heading>
              <Inline>
                <Button variant="primary">Primary action</Button>
                <Button variant="secondary">Secondary action</Button>
                <Button variant="quiet">Quiet action</Button>
                <Button variant="danger">Delete data</Button>
                <Button pending isDisabled aria-label="Pending save">
                  Save expense
                </Button>
                <IconButton aria-label="Close panel" icon={<X />} />
              </Inline>
              <ActionCard
                title="Add manually"
                description="Enter the details locally."
                icon={<Plus />}
              />
              <ActionCard
                title={longLabel}
                description="Long labels remain readable and wrap naturally."
              />
            </section>

            <section className="ds-gallery__section">
              <Heading size="sm">Fields and selection</Heading>
              <TextField
                label="Merchant"
                placeholder="ICA Maxi Solna"
                description="Suggestions stay local to the device."
              />
              <TextField
                label="Invalid merchant"
                value=""
                isInvalid
                error="Enter a merchant or description."
              />
              <TextArea label="Description" placeholder="Optional details" />
              <MoneyField
                label="Amount"
                currency="SEK"
                value="12345678901234567890.50"
              />
              <SecretField
                label="Gemini API key"
                value="not-a-secret-fixture"
              />
              <SearchField label="Find" placeholder="Merchant or description" />
              <NativeDateField label="Expense date" defaultValue="2026-08-24" />
              <NativeTimeField label="Time" defaultValue="03:00" />
            </section>

            <section className="ds-gallery__section">
              <Heading size="sm">Accessible choices</Heading>
              <SegmentedControl
                label="Direction"
                value={selected}
                onChange={setSelected}
                options={[{ id: "spent", label: "Spent" }, {
                  id: "back",
                  label: "Money back",
                }]}
              />
              <RadioGroup
                label="Sort order"
                defaultValue="newest"
                options={[{ id: "newest", label: "Newest first" }, {
                  id: "oldest",
                  label: "Oldest first",
                }]}
              />
              <Checkbox defaultSelected>Include archived categories</Checkbox>
              <Switch defaultSelected>Image preparation on</Switch>
              <SelectField
                label="Project"
                defaultSelectedKey="sweden"
                options={[{ id: "sweden", label: "Sweden" }, {
                  id: "taiwan",
                  label: "Taiwan",
                }]}
              />
              <PeriodPicker value={period} onValueChange={setPeriod} />
            </section>
          </ResponsiveGrid>

          <section className="ds-gallery__surface">
            <Heading size="sm">Loading, saving, saved, and failed</Heading>
            <InlineNotice
              tone={saved === "failed"
                ? "danger"
                : saved === "saved"
                ? "positive"
                : "info"}
              title={saved === "failed"
                ? "Save failed"
                : saved === "saved"
                ? "Saved locally"
                : saved === "saving"
                ? "Saving locally"
                : "Ready to save"}
            >
              {saved === "failed"
                ? "The record was not saved. Your entered data remains visible."
                : saved === "saved"
                ? "The local transaction completed."
                : saved === "saving"
                ? "Saving prevents duplicate submission."
                : "Local saving is explicit and status is announced."}
            </InlineNotice>
            <FormActions>
              <Button variant="secondary" onPress={() => setSaved("failed")}>
                Simulate failure
              </Button>
              <Button pending={saved === "saving"} onPress={save}>
                {saveLabel}
              </Button>
            </FormActions>
            <DraftStatus
              state={saved === "saving"
                ? "saving"
                : saved === "saved"
                ? "saved"
                : saved === "failed"
                ? "failed"
                : "dirty"}
              action={saved === "failed"
                ? <Button variant="quiet" onPress={save}>Retry</Button>
                : undefined}
            />
            <Toast>
              Saved status remains available as a non-critical confirmation.
            </Toast>
          </section>

          <ResponsiveGrid columns={2}>
            <section className="ds-gallery__section">
              <Heading size="sm">Status, progress, and errors</Heading>
              <GlobalStatus
                status="offline"
                detail="Drive and Gemini actions wait until online."
              />
              <GlobalStatus
                status="syncing"
                detail="Two local changes pending."
              />
              <GlobalStatus status="conflict" detail="2 records need review." />
              <StatusPanel
                title="Known device"
                detail="Stockholm phone · Seen now"
                action={<Button variant="quiet">Rename</Button>}
              />
              <Progress label="Preparing receipt" indeterminate />
              <Progress label="Validating review" value={68} />
              <WorkflowProgress
                steps={["Choose image", "Prepare", "Review", "Save"]}
                current={1}
                status="Receipt workflow"
              />
              <StatusMessage tone="positive">
                All accessibility status messages include meaningful text.
              </StatusMessage>
              <ErrorState title="Unable to save">
                The local repository rejected this attempt.
              </ErrorState>
              <EmptyState
                title="No expenses yet"
                action={<Button>Create first expense</Button>}
              >
                Start with a local record. The empty state offers one useful
                next action.
              </EmptyState>
            </section>

            <section className="ds-gallery__section">
              <Heading size="sm">Money and domain composites</Heading>
              <MoneySummary
                items={[{
                  label: "Net spent",
                  amount: "-4358.50",
                  currency: "SEK",
                  tone: "negative",
                }, {
                  label: "Outflows",
                  amount: "-4382.50",
                  currency: "SEK",
                  tone: "negative",
                }, {
                  label: "Money back",
                  amount: "+24.00",
                  currency: "SEK",
                  tone: "positive",
                }]}
              />
              <CategoryBreakdown
                categories={[{
                  id: "groceries",
                  name: "Groceries",
                  amount: "-2140.00",
                  currency: "SEK",
                }, {
                  id: "travel",
                  name: "Travel",
                  amount: "-1020.00",
                  currency: "SEK",
                }]}
              />
              <ExpenseList
                expenses={[{
                  id: "one",
                  merchant: longLabel,
                  category: "Groceries",
                  amount: "-286.40",
                  currency: "SEK",
                  date: "2026-08-23",
                }, {
                  id: "two",
                  merchant: "Bottle return",
                  category: "Money back",
                  amount: "+24.00",
                  currency: "SEK",
                  date: "2026-08-22",
                }]}
              />
              <ReceiptReconciliation
                printed="-45.90"
                selected="-43.90"
                difference="2.00"
                currency="SEK"
              />
              <DateText value="2026-08-24" />
              <MoneyText
                amount="-999999999999999999999.99"
                currency="SEK"
                tone="negative"
              />
            </section>
          </ResponsiveGrid>

          <section className="ds-gallery__section">
            <Heading size="sm">Overlays, focus, and expandable content</Heading>
            <Inline>
              <AdaptiveDialog
                trigger={<Button>Open modal sheet</Button>}
                title="Add an expense"
              >
                <Stack gap={4}>
                  <Text>
                    Focus is contained by React Aria and returns to the trigger
                    on close.
                  </Text>
                  <Button>Continue</Button>
                </Stack>
              </AdaptiveDialog>
              <AdaptiveDialog
                trigger={<Button variant="secondary">Open confirmation</Button>}
                title="Discard changes"
              >
                <Stack gap={4}>
                  <InlineNotice tone="warning">
                    Unsaved values will be discarded.
                  </InlineNotice>
                  <Button variant="danger">Discard changes</Button>
                </Stack>
              </AdaptiveDialog>
              <IconButton aria-label="Help for amount" icon={<AlertCircle />} />
            </Inline>
            <Disclosure title="Long receipt lines">
              <ListRow
                leading={
                  <Icon>
                    <Check />
                  </Icon>
                }
                trailing={<Badge tone="positive">Selected</Badge>}
              >
                <Text>{longLabel}</Text>
              </ListRow>
            </Disclosure>
            <Divider />
            <Skeleton style={{ width: "70%" }} />
            <StickyActionBar>
              <Button variant="secondary">Cancel</Button>
              <Button>Save expense</Button>
            </StickyActionBar>
          </section>

          <section className="ds-gallery__section">
            <Heading size="sm">Responsive and forced-colors notes</Heading>
            <Text>
              Resize the fixture to 320×568, 390×844, and 1280×800. The page
              uses natural-height cards, touch-draggable filter rows, safe-area
              padding, semantic tokens, and no page-level horizontal scroll.
              Enable forced colors in the browser to inspect the explicit
              system-color fallback.
            </Text>
            <Inline>
              <Badge tone="positive">Dark semantic tokens</Badge>
              <Badge tone="warning">0ms ordinary transitions</Badge>
              <Badge tone="info">Reduced-motion functional progress</Badge>
            </Inline>
          </section>
        </Stack>
      </ContentContainer>
    </AppFrame>
  );
}

export function mountDesignSystemGallery(root: HTMLElement): void {
  createRoot(root).render(<DesignSystemGallery />);
}
