import type { Category, StableId } from "../../domain/index.ts";
import type {
  ReceiptAggregate,
  ReceiptLineChanges,
  ReceiptManagementService,
} from "../../domain/index.ts";
import type {
  SavedReceiptActorOutput,
  SavedReceiptLineDraft,
} from "../../actors/contracts/saved-receipt.ts";
import type { ReceiptLineEditorValue } from "../../design-system/index.ts";

export type ReceiptDetailScreenProps = {
  service: ReceiptManagementService;
  receiptId: StableId;
  categories: readonly Category[];
  focusedLineId?: StableId;
  discardRequest?: number;
  onDirtyChange?: (dirty: boolean) => void;
  onDirtyDiscarded?: () => void;
  onBack?: () => void;
  onComplete?: (output: SavedReceiptActorOutput) => void;
};

export function categoryOptions(
  categories: readonly Category[],
  currentCategoryId?: string,
) {
  return categories.filter((category) =>
    !category.archived || category.id === currentCategoryId
  ).map((category) => ({
    id: category.id,
    label: category.archived ? `${category.name} (archived)` : category.name,
    ...(category.archived ? { disabled: true } : {}),
  }));
}

export function editorValue(
  draft: SavedReceiptLineDraft,
): ReceiptLineEditorValue {
  const changes = draft.changes;
  return changes.type === "purchase"
    ? {
      type: "purchase",
      description: changes.description,
      categoryId: changes.categoryId,
      amount: changes.lineTotal,
      quantity: changes.quantity ?? undefined,
      unitPrice: changes.unitPrice ?? undefined,
    }
    : {
      type: "adjustment",
      description: changes.description,
      categoryId: changes.categoryId,
      amount: changes.amount,
      lineId: changes.lineId ?? undefined,
    };
}

export function editorValueFromChanges(
  changes: ReceiptLineChanges,
): ReceiptLineEditorValue {
  return changes.type === "purchase"
    ? {
      type: "purchase",
      description: changes.description,
      categoryId: changes.categoryId,
      amount: changes.lineTotal,
      quantity: changes.quantity ?? undefined,
      unitPrice: changes.unitPrice ?? undefined,
    }
    : {
      type: "adjustment",
      description: changes.description,
      categoryId: changes.categoryId,
      amount: changes.amount,
      lineId: changes.lineId ?? undefined,
    };
}

export function changesFromEditor(
  value: ReceiptLineEditorValue,
): ReceiptLineChanges {
  if (value.type === "purchase") {
    return {
      type: "purchase",
      description: value.description,
      categoryId: value.categoryId,
      quantity: value.quantity?.trim() ? value.quantity : null,
      unitPrice: value.unitPrice?.trim() ? value.unitPrice : null,
      lineTotal: value.amount,
    };
  }
  return {
    type: "adjustment",
    description: value.description,
    categoryId: value.categoryId,
    amount: value.amount,
    lineId: value.lineId?.trim() ? value.lineId : null,
  };
}

export function lineDescription(
  aggregate: ReceiptAggregate,
  lineId: StableId,
): string {
  const line = [...aggregate.purchaseLines, ...aggregate.adjustments].find(
    (candidate) => candidate.id === lineId,
  );
  return line?.description ?? "this line";
}

export function mutationIsLine(
  kind: string | undefined,
): kind is "line" | "delete-line" | "add-line" {
  return kind === "line" || kind === "delete-line" || kind === "add-line";
}
