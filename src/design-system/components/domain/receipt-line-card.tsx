import type { ReactNode } from "react";
import { Minus, Pencil, Plus, Trash2 } from "lucide-react";
import {
  Card,
  IconButton,
  Inline,
  MoneyText,
  Stack,
  Text,
} from "../primitives.tsx";
import { Checkbox } from "../fields.tsx";
import { InlineNotice } from "../feedback.tsx";

export type ReceiptLineViewModel = {
  id: string;
  type: "purchase" | "adjustment";
  description: string;
  category: string;
  amount: string;
  selected: boolean;
  uncertain: boolean;
  selectionReason?: string;
  classificationReason?: string;
  quantity?: string;
  unitPrice?: string;
  linkedLineDescription?: string;
};

export type ReceiptLineCardProps = {
  line: ReceiptLineViewModel;
  currency: string;
  mode?: "review" | "management" | "manual" | "menu";
  isDisabled?: boolean;
  onSelectedChange?: (selected: boolean) => void;
  onQuantityChange?: (quantity: string) => void;
  onEdit?: () => void;
  editControl?: ReactNode;
  categoryControl?: ReactNode;
  onRemove?: () => void;
};

export function ReceiptLineCard(
  {
    line,
    currency,
    mode = "review",
    isDisabled,
    onSelectedChange,
    onQuantityChange,
    onEdit,
    editControl,
    categoryControl,
    onRemove,
  }: ReceiptLineCardProps,
) {
  return (
    <Card as="section">
      <Inline justify="space-between">
        {mode === "management" || mode === "manual"
          ? <strong>{line.description || "Unclear item"}</strong>
          : (
            <Checkbox
              isSelected={line.selected}
              isDisabled={isDisabled}
              onChange={onSelectedChange}
            >
              <strong>{line.description || "Unclear item"}</strong>
            </Checkbox>
          )}
        <MoneyText
          amount={line.amount}
          currency={currency}
          tone={line.amount.startsWith("-") ? "negative" : "positive"}
        />
      </Inline>
      <Inline justify="space-between">
        <Stack gap={1}>
          {categoryControl ?? <Text tone="secondary">{line.category}</Text>}
          {line.quantity || line.unitPrice
            ? (
              <Text size="label" tone="muted">
                {line.quantity ?? "?"} × {line.unitPrice ?? "?"}
              </Text>
            )
            : null}
          {line.linkedLineDescription
            ? (
              <Text size="label" tone="secondary">
                Linked to {line.linkedLineDescription}
              </Text>
            )
            : null}
        </Stack>
        <Inline gap={1}>
          {onQuantityChange && line.type === "purchase"
            ? (
              <Inline gap={1} className="ds-quantity-stepper">
                <IconButton
                  icon={<Minus size={16} />}
                  aria-label={`Decrease quantity of ${
                    line.description || "item"
                  }`}
                  variant="quiet"
                  isDisabled={isDisabled || !line.selected}
                  onPress={() => {
                    const current = parseInt(line.quantity ?? "1", 10);
                    if (isNaN(current) || current <= 1) {
                      onSelectedChange?.(false);
                      onQuantityChange("0");
                    } else {
                      onQuantityChange(String(current - 1));
                    }
                  }}
                />
                <Text
                  style={{
                    minWidth: "1.25rem",
                    textAlign: "center",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {line.selected ? (line.quantity ?? "1") : "0"}
                </Text>
                <IconButton
                  icon={<Plus size={16} />}
                  aria-label={`Increase quantity of ${
                    line.description || "item"
                  }`}
                  variant="quiet"
                  isDisabled={isDisabled}
                  onPress={() => {
                    if (!line.selected) {
                      onSelectedChange?.(true);
                      onQuantityChange(
                        line.quantity && line.quantity !== "0"
                          ? line.quantity
                          : "1",
                      );
                    } else {
                      const current = parseInt(line.quantity ?? "1", 10);
                      onQuantityChange(
                        String(isNaN(current) ? 1 : current + 1),
                      );
                    }
                  }}
                />
              </Inline>
            )
            : null}
          {editControl}
          {editControl === undefined && onEdit
            ? (
              <IconButton
                icon={<Pencil size={18} />}
                aria-label="Edit"
                variant="quiet"
                isDisabled={isDisabled}
                onPress={onEdit}
              />
            )
            : null}
          {onRemove
            ? (
              <IconButton
                icon={<Trash2 size={18} />}
                aria-label="Remove"
                variant="quiet"
                isDisabled={isDisabled}
                onPress={onRemove}
              />
            )
            : null}
        </Inline>
      </Inline>
      {line.uncertain
        ? (
          <InlineNotice tone="warning" title="Review this line">
            {line.selectionReason ??
              "The extraction was uncertain. Check the details before selecting it."}
          </InlineNotice>
        )
        : null}
      {line.classificationReason
        ? (
          <Text size="label" tone="muted">
            AI classification: {line.classificationReason}
          </Text>
        )
        : null}
    </Card>
  );
}
