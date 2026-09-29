import {
  CalendarDateSchema,
  type CanonicalDecimal,
  canonicalDecimal,
  CURRENT_SCHEMA_VERSION,
  type Expense,
  ExpenseSchema,
  type ReceiptAdjustment,
  ReceiptAdjustmentSchema,
  type ReceiptLine,
  type ReceiptParent,
  ReceiptParentSchema,
  type ReceiptPurchaseLine,
  ReceiptPurchaseLineSchema,
  type StableId,
  StableIdSchema,
  TimeOfDaySchema,
  TombstoneSchema,
  UNCATEGORIZED_CATEGORY_ID,
} from "../schema/index.ts";

import type {
  OrganizationStore,
  OrganizationTransaction,
} from "../organization.ts";
import {
  type ReceiptAggregate,
  ReceiptDomainError,
  type ReceiptDraftLine,
  type ReceiptLineChanges,
  type ReceiptMetadataChanges,
  type ReceiptMutationResult,
  type ReceiptServiceOptions,
} from "./types.ts";
import {
  asOrganizationJsonValue,
  defaultReceiptId,
  parsedRecords,
  type ReceiptParsedRecords,
} from "./records.ts";
import {
  ensureOutflowSign,
  receiptLineAmount,
  receiptTotalWithLineDirection,
} from "./arithmetic.ts";

export type ReceiptManagementService = {
  get(receiptId: StableId): Promise<ReceiptAggregate | undefined>;
  updateMetadata(
    receiptId: StableId,
    changes: ReceiptMetadataChanges,
  ): Promise<ReceiptAggregate>;
  updateLine(
    receiptId: StableId,
    lineId: StableId,
    changes: ReceiptLineChanges,
  ): Promise<ReceiptAggregate>;
  addLine(
    receiptId: StableId,
    changes: ReceiptLineChanges,
  ): Promise<ReceiptAggregate>;
  deleteLine(
    receiptId: StableId,
    lineId: StableId,
  ): Promise<ReceiptMutationResult>;
  deleteReceipt(receiptId: StableId): Promise<ReceiptMutationResult>;
};

function aggregateFromRecords(
  records: ReceiptParsedRecords,
  receiptId: StableId,
): ReceiptAggregate | undefined {
  const receipt = records.receipts.find((candidate) =>
    candidate.id === receiptId
  );
  if (!receipt) return undefined;
  const purchaseLines = records.purchaseLines.filter((line) =>
    line.receiptId === receiptId
  );
  const adjustments = records.adjustments.filter((line) =>
    line.receiptId === receiptId
  );
  const lineIds = new Set<StableId>([
    ...purchaseLines.map((line) => line.id),
    ...adjustments.map((line) => line.id),
  ]);
  const purchaseIds = new Set(purchaseLines.map((line) => line.id));
  if (
    [...purchaseLines, ...adjustments].some((line) =>
      line.projectId !== receipt.projectId ||
      ("lineId" in line && line.lineId !== undefined &&
        !purchaseIds.has(line.lineId))
    )
  ) {
    throw new ReceiptDomainError("corrupt-data");
  }
  const derivedExpenses = records.expenses.filter((expense) =>
    expense.receiptId === receiptId ||
    (expense.receiptLineId !== undefined && lineIds.has(expense.receiptLineId))
  );
  if (
    derivedExpenses.some((expense) => expense.projectId !== receipt.projectId)
  ) {
    throw new ReceiptDomainError("corrupt-data");
  }
  for (const expense of derivedExpenses) {
    if (expense.receiptId !== receiptId || expense.source === "manual") {
      throw new ReceiptDomainError("corrupt-data");
    }
    if (expense.receiptLineId === undefined) continue;
    const line = [...purchaseLines, ...adjustments].find((candidate) =>
      candidate.id === expense.receiptLineId
    );
    if (!line) throw new ReceiptDomainError("corrupt-data");
    const expectedSource = line.type === "receipt-purchase-line"
      ? "receipt-line"
      : "adjustment";
    if (expense.source !== expectedSource) {
      throw new ReceiptDomainError("corrupt-data");
    }
  }
  return { receipt, purchaseLines, adjustments, derivedExpenses };
}

function draftLinesForAggregate(
  purchaseLines: readonly ReceiptPurchaseLine[],
  adjustments: readonly ReceiptAdjustment[],
): ReceiptDraftLine[] {
  return [
    ...purchaseLines.map((line) => ({
      type: "purchase" as const,
      id: line.id,
      description: line.description,
      categoryId: line.categoryId,
      ...(line.quantity === undefined ? {} : { quantity: line.quantity }),
      ...(line.unitPrice === undefined ? {} : { unitPrice: line.unitPrice }),
      lineTotal: line.lineTotal,
      selected: true,
      uncertain: false,
    })),
    ...adjustments.map((line) => ({
      type: "adjustment" as const,
      id: line.id,
      description: line.description,
      categoryId: line.categoryId,
      amount: line.amount,
      ...(line.lineId === undefined ? {} : { lineId: line.lineId }),
      selected: true,
      uncertain: false,
    })),
  ];
}

function canonicalValue(value: string, message: string): CanonicalDecimal {
  try {
    return canonicalDecimal(value.trim()) as CanonicalDecimal;
  } catch {
    throw new ReceiptDomainError("invalid", message);
  }
}

function validateEditableCategory(
  records: ReceiptParsedRecords,
  currentCategoryId: StableId,
  nextCategoryId: StableId,
): void {
  const category = records.categories.find((candidate) =>
    candidate.id === nextCategoryId
  );
  if (!category) throw new ReceiptDomainError("not-found");
  if (
    nextCategoryId !== currentCategoryId && category.archived &&
    category.id !== UNCATEGORIZED_CATEGORY_ID
  ) {
    throw new ReceiptDomainError(
      "not-found",
      "Choose an active category or Uncategorized.",
    );
  }
}

function parentWithChanges(
  aggregate: ReceiptAggregate,
  changes: ReceiptMetadataChanges,
): ReceiptParent {
  const next: Record<string, unknown> = { ...aggregate.receipt };
  const allowed = new Set([
    "merchant",
    "date",
    "time",
    "printedTotal",
  ]);
  if (Object.keys(changes).some((key) => !allowed.has(key))) {
    throw new ReceiptDomainError(
      "invalid",
      "Receipt metadata cannot be changed this way.",
    );
  }
  if (Object.prototype.hasOwnProperty.call(changes, "merchant")) {
    const merchant = changes.merchant;
    if (
      merchant === null || merchant === undefined || merchant.trim() === ""
    ) {
      delete next.merchant;
    } else {
      next.merchant = merchant.trim();
    }
  }
  if (changes.date !== undefined) {
    try {
      next.date = CalendarDateSchema.parse(changes.date);
    } catch {
      throw new ReceiptDomainError("invalid", "Enter a valid receipt date.");
    }
  }
  if (Object.prototype.hasOwnProperty.call(changes, "time")) {
    if (
      changes.time === null || changes.time === undefined || changes.time === ""
    ) {
      delete next.time;
    } else {
      try {
        next.time = TimeOfDaySchema.parse(changes.time);
      } catch {
        throw new ReceiptDomainError("invalid", "Enter a valid receipt time.");
      }
    }
  }
  if (changes.printedTotal !== undefined) {
    const printedTotal = canonicalValue(
      changes.printedTotal,
      "Enter a valid printed total.",
    );
    next.printedTotal = receiptTotalWithLineDirection(
      printedTotal,
      draftLinesForAggregate(aggregate.purchaseLines, aggregate.adjustments),
    );
  }
  try {
    return ReceiptParentSchema.parse(next);
  } catch {
    throw new ReceiptDomainError("invalid", "Receipt metadata is invalid.");
  }
}

function expenseProjection(
  expense: Expense,
  receipt: ReceiptParent,
  line: ReceiptPurchaseLine | ReceiptAdjustment | undefined,
): Expense {
  const next: Record<string, unknown> = { ...expense };
  next.projectId = receipt.projectId;
  next.date = receipt.date;
  next.currency = receipt.currency;
  if (receipt.time === undefined) delete next.time;
  else next.time = receipt.time;
  if (receipt.merchant === undefined) delete next.merchant;
  else next.merchant = receipt.merchant;
  if (line !== undefined) {
    next.categoryId = line.categoryId;
    next.description = line.description;
    next.amount = "lineTotal" in line ? line.lineTotal : line.amount;
  }
  try {
    return ExpenseSchema.parse(next);
  } catch {
    throw new ReceiptDomainError("corrupt-data");
  }
}

function lineForExpense(
  expense: Expense,
  aggregate: ReceiptAggregate,
): ReceiptPurchaseLine | ReceiptAdjustment | undefined {
  const lines = [...aggregate.purchaseLines, ...aggregate.adjustments];
  if (expense.receiptLineId !== undefined) {
    return lines.find((line) => line.id === expense.receiptLineId);
  }
  const matches = lines.filter((line) => {
    const source = line.type === "receipt-purchase-line"
      ? "receipt-line"
      : "adjustment";
    return expense.source === source &&
      expense.categoryId === line.categoryId &&
      expense.description === line.description &&
      expense.amount === receiptLineAmount(line);
  });
  return matches.length === 1 ? matches[0] : undefined;
}

function tombstoneFingerprint(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function receiptTombstoneId(
  targetType: ReturnType<typeof TombstoneSchema.parse>["targetType"],
  targetId: StableId,
): StableId {
  return StableIdSchema.parse(
    `tombstone-${targetType}-${tombstoneFingerprint(targetId)}`,
  );
}

function ensureTombstoneIdsAvailable(
  records: ReceiptParsedRecords,
  targets: readonly {
    readonly type: ReturnType<typeof TombstoneSchema.parse>["targetType"];
    readonly id: StableId;
  }[],
): void {
  const generatedIds = new Set<string>();
  for (const target of targets) {
    const tombstoneId = receiptTombstoneId(target.type, target.id);
    if (generatedIds.has(tombstoneId)) {
      throw new ReceiptDomainError("conflict");
    }
    generatedIds.add(tombstoneId);
    if (records.ids.has(tombstoneId)) {
      throw new ReceiptDomainError("conflict");
    }
  }
}

function createReceiptTombstone(
  targetType: ReturnType<typeof TombstoneSchema.parse>["targetType"],
  targetId: StableId,
  deletedAt: string,
  deletedBy: StableId,
): ReturnType<typeof TombstoneSchema.parse> {
  try {
    return TombstoneSchema.parse({
      schemaVersion: CURRENT_SCHEMA_VERSION,
      type: "tombstone",
      id: receiptTombstoneId(targetType, targetId),
      targetType,
      targetId,
      deletedAt,
      deletedBy,
    });
  } catch {
    throw new ReceiptDomainError("invalid");
  }
}

async function deleteReceiptRecord(
  transaction: OrganizationTransaction,
  targetType: ReturnType<typeof TombstoneSchema.parse>["targetType"],
  targetId: StableId,
  deletedAt: string,
  deletedBy: StableId,
): Promise<void> {
  await transaction.delete("records", targetId);
  const tombstone = createReceiptTombstone(
    targetType,
    targetId,
    deletedAt,
    deletedBy,
  );
  await transaction.put(
    "records",
    tombstone.id,
    asOrganizationJsonValue(tombstone),
  );
}

async function readReceiptRecords(
  transaction: OrganizationTransaction,
): Promise<ReceiptParsedRecords> {
  return parsedRecords(await transaction.query("records"));
}

function recordsForDeletion(
  aggregate: ReceiptAggregate,
): readonly {
  readonly type: ReturnType<typeof TombstoneSchema.parse>["targetType"];
  readonly id: StableId;
}[] {
  return [
    { type: "receipt", id: aggregate.receipt.id },
    ...aggregate.purchaseLines.map((line) => ({
      type: "receipt-purchase-line" as const,
      id: line.id,
    })),
    ...aggregate.adjustments.map((line) => ({
      type: "receipt-adjustment" as const,
      id: line.id,
    })),
    ...aggregate.derivedExpenses.map((expense) => ({
      type: "expense" as const,
      id: expense.id,
    })),
  ];
}

async function deleteAggregate(
  transaction: OrganizationTransaction,
  aggregate: ReceiptAggregate,
  records: ReceiptParsedRecords,
  deletedAt: string,
  deletedBy: StableId,
): Promise<void> {
  const recordsToDelete = recordsForDeletion(aggregate);
  ensureTombstoneIdsAvailable(records, recordsToDelete);
  for (const record of recordsToDelete) {
    await deleteReceiptRecord(
      transaction,
      record.type,
      record.id,
      deletedAt,
      deletedBy,
    );
  }
}

export function createReceiptManagementService(
  store: OrganizationStore,
  options: Pick<ReceiptServiceOptions, "now" | "deviceId" | "nextId"> = {},
): ReceiptManagementService {
  const now = options.now ?? (() => new Date().toISOString());
  const deviceId = StableIdSchema.parse(options.deviceId ?? "device-local");
  const nextId = options.nextId ?? defaultReceiptId;

  return {
    get(receiptId) {
      return store.transaction("readonly", async (transaction) => {
        const records = await readReceiptRecords(transaction);
        return aggregateFromRecords(records, receiptId);
      });
    },

    updateMetadata(receiptId, changes) {
      return store.transaction("readwrite", async (transaction) => {
        const records = await readReceiptRecords(transaction);
        const aggregate = aggregateFromRecords(records, receiptId);
        if (!aggregate) throw new ReceiptDomainError("not-found");
        const receipt = parentWithChanges(aggregate, changes);
        await transaction.put(
          "records",
          receipt.id,
          asOrganizationJsonValue(receipt),
        );
        const lines = new Map<StableId, ReceiptLine>([
          ...aggregate.purchaseLines.map((line) => [line.id, line] as const),
          ...aggregate.adjustments.map((line) => [line.id, line] as const),
        ]);
        for (const expense of aggregate.derivedExpenses) {
          const linkedLine = lineForExpense(expense, aggregate);
          const projected = expenseProjection(
            expense,
            receipt,
            linkedLine === undefined ? undefined : lines.get(linkedLine.id),
          );
          await transaction.put(
            "records",
            projected.id,
            asOrganizationJsonValue(projected),
          );
        }
        const nextRecords = await readReceiptRecords(transaction);
        return aggregateFromRecords(nextRecords, receiptId)!;
      });
    },

    updateLine(receiptId, lineId, changes) {
      return store.transaction("readwrite", async (transaction) => {
        const records = await readReceiptRecords(transaction);
        const aggregate = aggregateFromRecords(records, receiptId);
        if (!aggregate) throw new ReceiptDomainError("not-found");
        const current = [
          ...aggregate.purchaseLines,
          ...aggregate.adjustments,
        ].find((line) => line.id === lineId);
        if (!current) throw new ReceiptDomainError("not-found");
        if (
          changes.type === "purchase" &&
          current.type !== "receipt-purchase-line"
        ) {
          throw new ReceiptDomainError(
            "invalid",
            "The receipt line type cannot change.",
          );
        }
        if (
          changes.type === "adjustment" &&
          current.type !== "receipt-adjustment"
        ) {
          throw new ReceiptDomainError(
            "invalid",
            "The receipt line type cannot change.",
          );
        }
        validateEditableCategory(
          records,
          current.categoryId,
          changes.categoryId,
        );
        let updated: ReceiptLine;
        try {
          if (changes.type === "purchase") {
            const nextLine: Record<string, unknown> = {
              ...current,
              description: changes.description,
              categoryId: changes.categoryId,
              lineTotal: ensureOutflowSign(
                canonicalValue(changes.lineTotal, "Enter a valid line total."),
              ),
            };
            if (changes.quantity === null) delete nextLine.quantity;
            else if (changes.quantity !== undefined) {
              nextLine.quantity = canonicalValue(
                changes.quantity,
                "Enter a valid quantity.",
              );
            }
            if (changes.unitPrice === null) delete nextLine.unitPrice;
            else if (changes.unitPrice !== undefined) {
              nextLine.unitPrice = canonicalValue(
                changes.unitPrice,
                "Enter a valid unit price.",
              );
            }
            updated = ReceiptPurchaseLineSchema.parse(nextLine);
          } else {
            if (
              changes.lineId !== undefined && changes.lineId !== null &&
              !aggregate.purchaseLines.some((line) =>
                line.id === changes.lineId
              )
            ) {
              throw new ReceiptDomainError(
                "invalid",
                "An adjustment link must reference a purchase line on this receipt.",
              );
            }
            const nextAdjustment: Record<string, unknown> = {
              ...current,
              description: changes.description,
              categoryId: changes.categoryId,
              amount: canonicalValue(
                changes.amount,
                "Enter a valid adjustment.",
              ),
            };
            if (changes.lineId === null) delete nextAdjustment.lineId;
            else if (changes.lineId !== undefined) {
              nextAdjustment.lineId = changes.lineId;
            }
            updated = ReceiptAdjustmentSchema.parse(nextAdjustment);
          }
        } catch (error) {
          if (error instanceof ReceiptDomainError) throw error;
          throw new ReceiptDomainError(
            "invalid",
            "Receipt line values are invalid.",
          );
        }
        await transaction.put(
          "records",
          updated.id,
          asOrganizationJsonValue(updated),
        );
        const receiptLines = new Map<StableId, ReceiptLine>([
          ...aggregate.purchaseLines.map((line) => [line.id, line] as const),
          ...aggregate.adjustments.map((line) => [line.id, line] as const),
        ]);
        receiptLines.set(updated.id, updated);
        for (const expense of aggregate.derivedExpenses) {
          const linkedLine = lineForExpense(expense, aggregate);
          const projected = expenseProjection(
            expense,
            aggregate.receipt,
            linkedLine === undefined
              ? undefined
              : receiptLines.get(linkedLine.id),
          );
          await transaction.put(
            "records",
            projected.id,
            asOrganizationJsonValue(projected),
          );
        }
        const nextRecords = await readReceiptRecords(transaction);
        return aggregateFromRecords(nextRecords, receiptId)!;
      });
    },

    addLine(receiptId, changes) {
      return store.transaction("readwrite", async (transaction) => {
        const records = await readReceiptRecords(transaction);
        const aggregate = aggregateFromRecords(records, receiptId);
        if (!aggregate) throw new ReceiptDomainError("not-found");
        validateEditableCategory(
          records,
          UNCATEGORIZED_CATEGORY_ID,
          changes.categoryId,
        );

        const lineId = nextId("line");
        if (records.ids.has(lineId) || records.tombstonedIds.has(lineId)) {
          throw new ReceiptDomainError("conflict");
        }
        const expenseIdResult = StableIdSchema.safeParse(`expense-${lineId}`);
        if (!expenseIdResult.success) {
          throw new ReceiptDomainError(
            "invalid",
            "The new receipt line could not receive a stable expense identity.",
          );
        }
        const expenseId = expenseIdResult.data;
        if (
          records.ids.has(expenseId) || records.tombstonedIds.has(expenseId)
        ) {
          throw new ReceiptDomainError("conflict");
        }

        let line: ReceiptLine;
        try {
          if (changes.type === "purchase") {
            const quantity = changes.quantity === undefined ||
                changes.quantity === null
              ? undefined
              : canonicalValue(changes.quantity, "Enter a valid quantity.");
            const unitPrice = changes.unitPrice === undefined ||
                changes.unitPrice === null
              ? undefined
              : canonicalValue(
                changes.unitPrice,
                "Enter a valid unit price.",
              );
            line = ReceiptPurchaseLineSchema.parse({
              schemaVersion: CURRENT_SCHEMA_VERSION,
              type: "receipt-purchase-line",
              id: lineId,
              receiptId,
              projectId: aggregate.receipt.projectId,
              categoryId: changes.categoryId,
              description: changes.description,
              ...(quantity === undefined ? {} : { quantity }),
              ...(unitPrice === undefined ? {} : { unitPrice }),
              lineTotal: ensureOutflowSign(
                canonicalValue(changes.lineTotal, "Enter a valid line total."),
              ),
            });
          } else {
            if (
              changes.lineId !== undefined && changes.lineId !== null &&
              !aggregate.purchaseLines.some((candidate) =>
                candidate.id === changes.lineId
              )
            ) {
              throw new ReceiptDomainError(
                "invalid",
                "An adjustment link must reference a purchase line on this receipt.",
              );
            }
            line = ReceiptAdjustmentSchema.parse({
              schemaVersion: CURRENT_SCHEMA_VERSION,
              type: "receipt-adjustment",
              id: lineId,
              receiptId,
              projectId: aggregate.receipt.projectId,
              categoryId: changes.categoryId,
              description: changes.description,
              amount: canonicalValue(
                changes.amount,
                "Enter a valid adjustment.",
              ),
              ...(changes.lineId === undefined || changes.lineId === null
                ? {}
                : { lineId: changes.lineId }),
            });
          }
        } catch (error) {
          if (error instanceof ReceiptDomainError) throw error;
          throw new ReceiptDomainError(
            "invalid",
            "Receipt line values are invalid.",
          );
        }

        const expense = ExpenseSchema.parse({
          schemaVersion: CURRENT_SCHEMA_VERSION,
          type: "expense",
          id: expenseId,
          projectId: aggregate.receipt.projectId,
          categoryId: line.categoryId,
          date: aggregate.receipt.date,
          ...(aggregate.receipt.time === undefined
            ? {}
            : { time: aggregate.receipt.time }),
          amount: receiptLineAmount(line),
          currency: aggregate.receipt.currency,
          ...(aggregate.receipt.merchant === undefined
            ? {}
            : { merchant: aggregate.receipt.merchant }),
          description: line.description,
          source: line.type === "receipt-purchase-line"
            ? "receipt-line"
            : "adjustment",
          receiptId,
          receiptLineId: line.id,
        });
        await transaction.put(
          "records",
          line.id,
          asOrganizationJsonValue(line),
        );
        await transaction.put(
          "records",
          expense.id,
          asOrganizationJsonValue(expense),
        );
        const nextRecords = await readReceiptRecords(transaction);
        return aggregateFromRecords(nextRecords, receiptId)!;
      });
    },

    deleteLine(receiptId, lineId) {
      return store.transaction("readwrite", async (transaction) => {
        const records = await readReceiptRecords(transaction);
        const aggregate = aggregateFromRecords(records, receiptId);
        if (!aggregate) throw new ReceiptDomainError("not-found");
        const purchase = aggregate.purchaseLines.find((line) =>
          line.id === lineId
        );
        const adjustment = aggregate.adjustments.find((line) =>
          line.id === lineId
        );
        if (!purchase && !adjustment) throw new ReceiptDomainError("not-found");
        const deletedAt = now();
        if (purchase && aggregate.purchaseLines.length === 1) {
          await deleteAggregate(
            transaction,
            aggregate,
            records,
            deletedAt,
            deviceId,
          );
          return { deletedReceipt: true, deletedLineId: lineId };
        }
        const targetType = purchase
          ? "receipt-purchase-line" as const
          : "receipt-adjustment" as const;
        const recordsToDelete = [
          { type: targetType, id: lineId },
          ...aggregate.derivedExpenses
            .filter((expense) =>
              lineForExpense(expense, aggregate)?.id === lineId
            )
            .map((expense) => ({ type: "expense" as const, id: expense.id })),
        ];
        ensureTombstoneIdsAvailable(records, recordsToDelete);
        await deleteReceiptRecord(
          transaction,
          targetType,
          lineId,
          deletedAt,
          deviceId,
        );
        for (const expense of aggregate.derivedExpenses) {
          if (lineForExpense(expense, aggregate)?.id === lineId) {
            await deleteReceiptRecord(
              transaction,
              "expense",
              expense.id,
              deletedAt,
              deviceId,
            );
          }
        }
        if (purchase) {
          for (
            const linked of aggregate.adjustments.filter((line) =>
              line.lineId === lineId
            )
          ) {
            const unlinked: Record<string, unknown> = { ...linked };
            delete unlinked.lineId;
            const parsed = ReceiptAdjustmentSchema.parse(unlinked);
            await transaction.put(
              "records",
              parsed.id,
              asOrganizationJsonValue(parsed),
            );
          }
        }
        const nextRecords = await readReceiptRecords(transaction);
        const nextAggregate = aggregateFromRecords(nextRecords, receiptId);
        if (!nextAggregate) throw new ReceiptDomainError("corrupt-data");
        return {
          aggregate: nextAggregate,
          deletedReceipt: false,
          deletedLineId: lineId,
        };
      });
    },

    deleteReceipt(receiptId) {
      return store.transaction("readwrite", async (transaction) => {
        const records = await readReceiptRecords(transaction);
        const aggregate = aggregateFromRecords(records, receiptId);
        if (!aggregate) throw new ReceiptDomainError("not-found");
        await deleteAggregate(
          transaction,
          aggregate,
          records,
          now(),
          deviceId,
        );
        return { deletedReceipt: true };
      });
    },
  };
}
