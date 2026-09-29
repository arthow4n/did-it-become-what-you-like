import {
  asOrganizationJsonValue,
  type OrganizationJsonValue,
} from "../organization.ts";
export { asOrganizationJsonValue, type OrganizationJsonValue };
import {
  CategorySchema,
  type Expense,
  ExpenseSchema,
  type Project,
  ProjectSchema,
  type ReceiptAdjustment,
  ReceiptAdjustmentSchema,
  type ReceiptParent,
  ReceiptParentSchema,
  type ReceiptPurchaseLine,
  ReceiptPurchaseLineSchema,
  type StableId,
  StableIdSchema,
  TombstoneSchema,
} from "../schema/index.ts";
import { ReceiptDomainError } from "./types.ts";

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function defaultReceiptId(kind: "receipt" | "line"): StableId {
  const suffix = globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random()}`;
  return StableIdSchema.parse(`${kind}-${suffix}`);
}

export function parsedRecords(
  entries: readonly { readonly value: OrganizationJsonValue }[],
): {
  readonly projects: readonly Project[];
  readonly categories: readonly ReturnType<typeof CategorySchema.parse>[];
  readonly expenses: readonly Expense[];
  readonly receipts: readonly ReceiptParent[];
  readonly purchaseLines: readonly ReceiptPurchaseLine[];
  readonly adjustments: readonly ReceiptAdjustment[];
  readonly tombstones: readonly ReturnType<typeof TombstoneSchema.parse>[];
  readonly ids: ReadonlySet<string>;
  readonly tombstonedIds: ReadonlySet<string>;
} {
  const projects: Project[] = [];
  const categories: ReturnType<typeof CategorySchema.parse>[] = [];
  const expenses: Expense[] = [];
  const receipts: ReceiptParent[] = [];
  const purchaseLines: ReceiptPurchaseLine[] = [];
  const adjustments: ReceiptAdjustment[] = [];
  const tombstones: ReturnType<typeof TombstoneSchema.parse>[] = [];
  const ids = new Set<string>();
  const tombstonedIds = new Set<string>();
  for (const entry of entries) {
    if (!isRecord(entry.value) || typeof entry.value.type !== "string") {
      continue;
    }
    if (typeof entry.value.id === "string") {
      if (ids.has(entry.value.id)) throw new ReceiptDomainError("corrupt-data");
      ids.add(entry.value.id);
    }
    if (entry.value.type === "project") {
      try {
        projects.push(ProjectSchema.parse(entry.value));
      } catch {
        throw new ReceiptDomainError("corrupt-data");
      }
    } else if (entry.value.type === "category") {
      try {
        categories.push(CategorySchema.parse(entry.value));
      } catch {
        throw new ReceiptDomainError("corrupt-data");
      }
    } else if (entry.value.type === "expense") {
      try {
        expenses.push(ExpenseSchema.parse(entry.value));
      } catch {
        throw new ReceiptDomainError("corrupt-data");
      }
    } else if (entry.value.type === "receipt") {
      try {
        receipts.push(ReceiptParentSchema.parse(entry.value));
      } catch {
        throw new ReceiptDomainError("corrupt-data");
      }
    } else if (entry.value.type === "receipt-purchase-line") {
      try {
        purchaseLines.push(ReceiptPurchaseLineSchema.parse(entry.value));
      } catch {
        throw new ReceiptDomainError("corrupt-data");
      }
    } else if (entry.value.type === "receipt-adjustment") {
      try {
        adjustments.push(ReceiptAdjustmentSchema.parse(entry.value));
      } catch {
        throw new ReceiptDomainError("corrupt-data");
      }
    } else if (entry.value.type === "tombstone") {
      try {
        const tombstone = TombstoneSchema.parse(entry.value);
        tombstones.push(tombstone);
        tombstonedIds.add(tombstone.targetId);
      } catch {
        throw new ReceiptDomainError("corrupt-data");
      }
    }
  }
  return {
    projects,
    categories,
    expenses,
    receipts,
    purchaseLines,
    adjustments,
    tombstones,
    ids,
    tombstonedIds,
  };
}

export type ReceiptParsedRecords = ReturnType<typeof parsedRecords>;
