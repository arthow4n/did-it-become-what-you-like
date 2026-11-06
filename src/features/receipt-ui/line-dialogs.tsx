import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  CanonicalDecimalSchema,
  type Category,
  StableIdSchema,
} from "../../domain/index.ts";
import type { ReceiptDraftLine } from "../../domain/receipt.ts";
import {
  AdaptiveDialog,
  Button,
  CategoryPicker,
  FormActions,
  Inline,
  InlineNotice,
  ReceiptLineEditor,
  Stack,
  Text,
} from "../../design-system/index.ts";
import { categoryOptions } from "./types.ts";

function unsignedDecimal(value: string): string {
  return value.startsWith("-") ? value.slice(1) : value;
}

function outflowDecimal(value: string): string {
  const unsigned = unsignedDecimal(value);
  return unsigned === "0" ? "0" : `-${unsigned}`;
}

function editorValue(line: ReceiptDraftLine, manual = false): {
  type: "purchase" | "adjustment";
  description: string;
  categoryId: string;
  amount: string;
  quantity?: string;
  unitPrice?: string;
  lineId?: string;
} {
  return line.type === "purchase"
    ? {
      type: line.type,
      description: line.description,
      categoryId: line.categoryId,
      amount: manual ? unsignedDecimal(line.lineTotal) : line.lineTotal,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
    }
    : {
      type: line.type,
      description: line.description,
      categoryId: line.categoryId,
      amount: line.amount,
      lineId: line.lineId,
    };
}

function updatedLine(
  line: ReceiptDraftLine,
  value: ReturnType<typeof editorValue>,
  manual = false,
): ReceiptDraftLine | undefined {
  const amount = CanonicalDecimalSchema.safeParse(value.amount);
  if (!amount.success) return undefined;
  if (line.type === "purchase" && value.type === "purchase") {
    const quantity = value.quantity?.trim();
    const unitPrice = value.unitPrice?.trim();
    if (quantity && !CanonicalDecimalSchema.safeParse(quantity).success) {
      return undefined;
    }
    if (unitPrice && !CanonicalDecimalSchema.safeParse(unitPrice).success) {
      return undefined;
    }
    return {
      ...line,
      description: value.description,
      categoryId: StableIdSchema.parse(value.categoryId),
      lineTotal: manual ? outflowDecimal(amount.data) : amount.data,
      ...(quantity ? { quantity } : { quantity: undefined }),
      ...(unitPrice ? { unitPrice } : { unitPrice: undefined }),
    };
  }
  if (line.type === "adjustment" && value.type === "adjustment") {
    return {
      ...line,
      description: value.description,
      categoryId: StableIdSchema.parse(value.categoryId),
      amount: amount.data,
      ...(value.lineId
        ? { lineId: StableIdSchema.parse(value.lineId) }
        : { lineId: undefined }),
    };
  }
  return undefined;
}

export function LineEditorDialog({
  line,
  categories,
  linkOptions,
  onSave,
  onClose,
  triggerLabel,
  triggerVariant = "quiet",
  fullWidth,
  dialogTitle,
  manual = false,
}: {
  line: ReceiptDraftLine;
  categories: readonly Category[];
  linkOptions: Array<{ id: string; label: string }>;
  onSave: (line: ReceiptDraftLine) => void;
  onClose?: () => void;
  triggerLabel: string;
  triggerVariant?: "primary" | "secondary" | "quiet" | "danger";
  fullWidth?: boolean;
  dialogTitle?: string;
  manual?: boolean;
}) {
  const [value, setValue] = useState(editorValue(line, manual));
  const [error, setError] = useState<string>();

  useEffect(() => {
    setValue(editorValue(line, manual));
    setError(undefined);
  }, [line, manual]);
  return (
    <AdaptiveDialog
      trigger={
        <Button variant={triggerVariant} fullWidth={fullWidth}>
          {triggerLabel}
        </Button>
      }
      title={dialogTitle ??
        (line.type === "purchase" ? "Edit receipt line" : "Edit adjustment")}
    >
      {(close) => (
        <Stack gap={4}>
          <ReceiptLineEditor
            value={value}
            categories={categoryOptions(categories)}
            linkOptions={linkOptions}
            manual={manual}
            onChange={(next) => {
              setValue(next);
              setError(undefined);
            }}
          />
          {error
            ? (
              <InlineNotice tone="danger" title="Check this line">
                {error}
              </InlineNotice>
            )
            : null}
          <FormActions>
            <Button variant="secondary" onPress={close}>
              Cancel
            </Button>
            <Button
              isDisabled={value.description.trim().length === 0}
              onPress={() => {
                const next = updatedLine(line, value, manual);
                if (!next) {
                  setError(
                    "Enter valid decimal values before saving this line.",
                  );
                  return;
                }
                onSave(next);
                close();
                onClose?.();
              }}
            >
              Save line
            </Button>
          </FormActions>
        </Stack>
      )}
    </AdaptiveDialog>
  );
}

export function QuickCategoryDialog({
  line,
  categories,
  onSelect,
  isDisabled,
}: {
  line: { readonly categoryId: string; readonly description?: string };
  categories: readonly Category[];
  onSelect: (categoryId: string) => void;
  isDisabled?: boolean;
}) {
  const currentCategory =
    categories.find((c) => c.id === line.categoryId)?.name ??
      line.categoryId;
  const options = categoryOptions(categories);

  return (
    <AdaptiveDialog
      trigger={
        <Button
          variant="quiet"
          isDisabled={isDisabled}
          className="ds-receipt-line-category-trigger"
          aria-label={`Category: ${currentCategory}. Tap to change category.`}
        >
          <Inline gap={1}>
            <span>{currentCategory}</span>
            <ChevronDown size={14} />
          </Inline>
        </Button>
      }
      title="Change category"
    >
      {(close) => (
        <Stack gap={4}>
          <Text size="body" tone="secondary">
            {line.description || "Unclear item"}
          </Text>
          <CategoryPicker
            label="Category"
            categories={options}
            value={line.categoryId}
            onValueChange={(categoryId) => {
              onSelect(categoryId);
              close();
            }}
          />
        </Stack>
      )}
    </AdaptiveDialog>
  );
}
