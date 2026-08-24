import { z } from "zod";
import {
  CategorySchema,
  DeviceSchema,
  ExpenseSchema,
  PortableSettingsSchema,
  ProjectSchema,
  ReceiptAdjustmentSchema,
  type ReceiptLine,
  ReceiptParentSchema,
  ReceiptPurchaseLineSchema,
  RetirementMarkerSchema,
  RevisionSchema,
  TombstoneSchema,
} from "./records.ts";
import {
  CURRENT_SCHEMA_VERSION,
  DATASET_FORMAT,
  InstantSchema,
  UNCATEGORIZED_CATEGORY_ID,
} from "./primitives.ts";

export const PortableDatasetSchema = z.object({
  schemaVersion: z.literal(CURRENT_SCHEMA_VERSION),
  format: z.literal(DATASET_FORMAT),
  exportedAt: InstantSchema.optional(),
  projects: z.array(ProjectSchema),
  categories: z.array(CategorySchema),
  expenses: z.array(ExpenseSchema),
  receipts: z.array(ReceiptParentSchema),
  receiptPurchaseLines: z.array(ReceiptPurchaseLineSchema),
  receiptAdjustments: z.array(ReceiptAdjustmentSchema),
  devices: z.array(DeviceSchema),
  tombstones: z.array(TombstoneSchema),
  retirementMarkers: z.array(RetirementMarkerSchema),
  revisions: z.array(RevisionSchema),
  settings: PortableSettingsSchema,
}).strict().superRefine(validateDatasetInvariants);

export type PortableDataset = z.infer<typeof PortableDatasetSchema>;

type DatasetLike = Omit<PortableDataset, "schemaVersion" | "format">;

function addIssue(
  ctx: z.RefinementCtx,
  path: PropertyKey[],
  message: string,
): void {
  ctx.addIssue({ code: "custom", path, message });
}

function validateDatasetInvariants(
  dataset: DatasetLike & { schemaVersion?: number; format?: string },
  ctx: z.RefinementCtx,
): void {
  const records = [
    ...dataset.projects,
    ...dataset.categories,
    ...dataset.expenses,
    ...dataset.receipts,
    ...dataset.receiptPurchaseLines,
    ...dataset.receiptAdjustments,
    ...dataset.devices,
    ...dataset.tombstones,
    ...dataset.retirementMarkers,
    ...dataset.revisions,
    dataset.settings,
  ];
  const ids = new Set<string>();
  records.forEach((record, index) => {
    if (ids.has(record.id)) {
      addIssue(
        ctx,
        ["records", index, "id"],
        `duplicate stable ID: ${record.id}`,
      );
    }
    ids.add(record.id);
  });

  const projects = new Set(dataset.projects.map((project) => project.id));
  const categories = new Set(dataset.categories.map((category) => category.id));
  const receipts = new Map(
    dataset.receipts.map((receipt) => [receipt.id, receipt]),
  );
  const purchaseLines = new Map(
    dataset.receiptPurchaseLines.map((line) => [line.id, line] as const),
  );
  const receiptLines = new Map<string, ReceiptLine>();
  for (const line of dataset.receiptPurchaseLines) {
    receiptLines.set(line.id, line);
  }
  for (const line of dataset.receiptAdjustments) {
    receiptLines.set(line.id, line);
  }

  const uncategorized = dataset.categories.filter((category) =>
    category.id === UNCATEGORIZED_CATEGORY_ID
  );
  if (uncategorized.length !== 1) {
    addIssue(
      ctx,
      ["categories"],
      "exactly one Uncategorized system category is required",
    );
  }

  const activeNames = new Map<string, number>();
  dataset.categories.forEach((category, index) => {
    if (category.archived) return;
    const normalized = category.name.trim().toLocaleLowerCase("en-US");
    const previous = activeNames.get(normalized);
    if (previous !== undefined) {
      addIssue(
        ctx,
        ["categories", index, "name"],
        `active category name duplicates categories.${previous}`,
      );
    } else {
      activeNames.set(normalized, index);
    }
  });

  dataset.expenses.forEach((expense, index) => {
    if (!projects.has(expense.projectId)) {
      addIssue(
        ctx,
        ["expenses", index, "projectId"],
        "references an unknown project",
      );
    }
    if (!categories.has(expense.categoryId)) {
      addIssue(
        ctx,
        ["expenses", index, "categoryId"],
        "references an unknown category",
      );
    }
    if (expense.receiptId) {
      const receipt = receipts.get(expense.receiptId);
      if (!receipt) {
        addIssue(
          ctx,
          ["expenses", index, "receiptId"],
          "references an unknown receipt",
        );
      } else if (receipt.projectId !== expense.projectId) {
        addIssue(
          ctx,
          ["expenses", index, "projectId"],
          "must match the receipt project",
        );
      }
    }
    if (expense.receiptLineId) {
      const line = receiptLines.get(expense.receiptLineId);
      if (!line) {
        addIssue(
          ctx,
          ["expenses", index, "receiptLineId"],
          "references an unknown receipt line",
        );
      } else {
        if (expense.receiptId !== line.receiptId) {
          addIssue(
            ctx,
            ["expenses", index, "receiptId"],
            "must match the receipt line receipt",
          );
        }
        if (expense.projectId !== line.projectId) {
          addIssue(
            ctx,
            ["expenses", index, "projectId"],
            "must match the receipt line project",
          );
        }
      }
    }
  });

  dataset.receiptPurchaseLines.forEach((line, index) => {
    const parent = receipts.get(line.receiptId);
    if (!parent) {
      addIssue(
        ctx,
        ["receiptPurchaseLines", index, "receiptId"],
        "references an unknown receipt",
      );
    } else if (parent.projectId !== line.projectId) {
      addIssue(
        ctx,
        ["receiptPurchaseLines", index, "projectId"],
        "must match the receipt project",
      );
    }
    if (!categories.has(line.categoryId)) {
      addIssue(
        ctx,
        ["receiptPurchaseLines", index, "categoryId"],
        "references an unknown category",
      );
    }
  });

  dataset.receiptAdjustments.forEach((adjustment, index) => {
    const parent = receipts.get(adjustment.receiptId);
    if (!parent) {
      addIssue(
        ctx,
        ["receiptAdjustments", index, "receiptId"],
        "references an unknown receipt",
      );
    } else if (parent.projectId !== adjustment.projectId) {
      addIssue(
        ctx,
        ["receiptAdjustments", index, "projectId"],
        "must match the receipt project",
      );
    }
    if (!categories.has(adjustment.categoryId)) {
      addIssue(
        ctx,
        ["receiptAdjustments", index, "categoryId"],
        "references an unknown category",
      );
    }
    if (adjustment.lineId) {
      const line = purchaseLines.get(adjustment.lineId);
      if (!line || line.receiptId !== adjustment.receiptId) {
        addIssue(
          ctx,
          ["receiptAdjustments", index, "lineId"],
          "must reference a purchase line on the same receipt",
        );
      }
    }
  });

  dataset.tombstones.forEach((tombstone, index) => {
    if (
      tombstone.targetType === "category" && tombstone.replacementCategoryId &&
      !categories.has(tombstone.replacementCategoryId)
    ) {
      addIssue(
        ctx,
        ["tombstones", index, "replacementCategoryId"],
        "must reference an existing replacement category",
      );
    }
  });
}

export function parseCurrentDataset(input: unknown): PortableDataset {
  return PortableDatasetSchema.parse(input);
}

function compareCodeUnits(left: string, right: string): number {
  const length = Math.min(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const difference = left.charCodeAt(index) - right.charCodeAt(index);
    if (difference !== 0) return difference;
  }
  return left.length - right.length;
}

function sortRecords<T extends { id: string }>(records: readonly T[]): T[] {
  return [...records].sort((left, right) =>
    compareCodeUnits(left.id, right.id)
  );
}

function sortObjectKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortObjectKeys);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => compareCodeUnits(left, right))
      .map(([key, entry]) => [key, sortObjectKeys(entry)]),
  );
}

export function canonicalizeDataset(dataset: PortableDataset): PortableDataset {
  return {
    ...dataset,
    projects: sortRecords(dataset.projects),
    categories: sortRecords(dataset.categories),
    expenses: sortRecords(dataset.expenses),
    receipts: sortRecords(dataset.receipts),
    receiptPurchaseLines: sortRecords(dataset.receiptPurchaseLines),
    receiptAdjustments: sortRecords(dataset.receiptAdjustments),
    devices: sortRecords(dataset.devices),
    tombstones: sortRecords(dataset.tombstones),
    retirementMarkers: sortRecords(dataset.retirementMarkers),
    revisions: sortRecords(dataset.revisions),
  };
}

export function exportDataset(dataset: PortableDataset): string {
  const parsed = parseCurrentDataset(dataset);
  return JSON.stringify(sortObjectKeys(canonicalizeDataset(parsed))) + "\n";
}

export function formatValidationError(error: z.ZodError): string {
  return error.issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join(".") : "dataset";
    return `${path}: ${issue.message}`;
  }).join("\n");
}
