import { Inline, Stack } from "../primitives.tsx";
import {
  DecimalField,
  SelectField,
  type SelectOption,
  TextField,
} from "../fields.tsx";
import { CategoryPicker } from "./category-picker.tsx";

export type ReceiptLineEditorValue = {
  type: "purchase" | "adjustment";
  description: string;
  categoryId: string;
  amount: string;
  quantity?: string;
  unitPrice?: string;
  lineId?: string;
};

export type ReceiptLineEditorProps = {
  value: ReceiptLineEditorValue;
  categories: SelectOption[];
  linkOptions?: SelectOption[];
  onChange: (value: ReceiptLineEditorValue) => void;
  manual?: boolean;
};

export function ReceiptLineEditor(
  { value, categories, linkOptions = [], onChange, manual = false }:
    ReceiptLineEditorProps,
) {
  return (
    <Stack gap={4}>
      <TextField
        label="Description"
        isRequired
        value={value.description}
        onChange={(description) => onChange({ ...value, description })}
      />
      <CategoryPicker
        label="Category"
        categories={categories}
        value={value.categoryId}
        onValueChange={(categoryId) => onChange({ ...value, categoryId })}
      />
      <DecimalField
        label={manual
          ? value.type === "adjustment" ? "Adjustment" : "Amount paid"
          : value.type === "adjustment"
          ? "Signed adjustment"
          : "Line total"}
        value={value.amount}
        onChange={(amount) => onChange({ ...value, amount })}
        description={manual
          ? "Enter the positive amount paid for this item."
          : "Enter the signed amount exactly as printed."}
      />
      {value.type === "purchase"
        ? (
          <Inline>
            <DecimalField
              label="Quantity (optional)"
              value={value.quantity ?? ""}
              onChange={(quantity) => onChange({ ...value, quantity })}
            />
            <TextField
              label="Unit price (optional)"
              value={value.unitPrice ?? ""}
              onChange={(unitPrice) => onChange({ ...value, unitPrice })}
              inputMode="decimal"
              type="text"
              description="Preserve the printed unit price when known."
            />
          </Inline>
        )
        : (
          <SelectField
            label="Link to purchase (optional)"
            options={[
              { id: "", label: "Receipt-wide adjustment" },
              ...linkOptions,
            ]}
            value={value.lineId ?? ""}
            onValueChange={(lineId) =>
              onChange({ ...value, lineId: lineId || undefined })}
          />
        )}
    </Stack>
  );
}
