import {
  CURRENT_SCHEMA_VERSION,
  type ReceiptAdjustment,
  ReceiptAdjustmentSchema,
  ReceiptParentSchema,
  type ReceiptPurchaseLine,
  ReceiptPurchaseLineSchema,
  UNCATEGORIZED_CATEGORY_ID,
} from "../schema/index.ts";
import type { OrganizationStore } from "../organization.ts";
import {
  type ReceiptCommitRequest,
  type ReceiptCommitResult,
  ReceiptDomainError,
  type ReceiptServiceOptions,
} from "./types.ts";
import {
  asOrganizationJsonValue,
  defaultReceiptId,
  parsedRecords,
} from "./records.ts";
import { ensureOutflowSign } from "./arithmetic.ts";
import { validateReceiptReviewDraft } from "./draft.ts";

export type ReceiptCommitService = {
  commit(request: ReceiptCommitRequest): Promise<ReceiptCommitResult>;
};

/**
 * Commit the parent and all selected lines in one repository transaction. The
 * repository transaction is deliberately allowed to abort; no compensating
 * writes can leave a partial receipt behind.
 */
export function createReceiptCommitService(
  store: OrganizationStore,
  options: ReceiptServiceOptions = {},
): ReceiptCommitService {
  const nextId = options.nextId ?? defaultReceiptId;
  return {
    async commit(request): Promise<ReceiptCommitResult> {
      const review = validateReceiptReviewDraft(request.review);
      if (review.printedTotalMismatch && !request.confirmMismatch) {
        throw new ReceiptDomainError("mismatch");
      }
      const selected = review.lines.filter((line) => line.selected);
      if (selected.length === 0) {
        throw new ReceiptDomainError(
          "invalid",
          "Select at least one receipt line.",
        );
      }
      return await store.transaction("readwrite", async (transaction) => {
        const parsed = parsedRecords(await transaction.query("records"));
        const project = parsed.projects.find((candidate) =>
          candidate.id === review.parent.projectId
        );
        if (!project || project.archived) {
          throw new ReceiptDomainError("not-found");
        }
        for (const line of selected) {
          const category = parsed.categories.find((candidate) =>
            candidate.id === line.categoryId
          );
          if (
            !category ||
            (category?.archived && category.id !== UNCATEGORIZED_CATEGORY_ID)
          ) {
            throw new ReceiptDomainError("not-found");
          }
        }
        const receiptId = nextId("receipt");
        if (parsed.ids.has(receiptId) || parsed.tombstonedIds.has(receiptId)) {
          throw new ReceiptDomainError("conflict");
        }
        const receipt = ReceiptParentSchema.parse({
          schemaVersion: CURRENT_SCHEMA_VERSION,
          type: "receipt",
          id: receiptId,
          ...review.parent,
        });
        const used = new Set([...parsed.ids, receiptId]);
        const purchaseLines: ReceiptPurchaseLine[] = [];
        const adjustments: ReceiptAdjustment[] = [];
        for (const line of selected) {
          if (used.has(line.id) || parsed.tombstonedIds.has(line.id)) {
            throw new ReceiptDomainError("conflict");
          }
          used.add(line.id);
          if (!line.description.trim()) {
            throw new ReceiptDomainError(
              "invalid",
              "Every selected receipt line requires a description.",
            );
          }
          if (line.type === "purchase") {
            purchaseLines.push(ReceiptPurchaseLineSchema.parse({
              schemaVersion: CURRENT_SCHEMA_VERSION,
              type: "receipt-purchase-line",
              id: line.id,
              receiptId,
              projectId: project.id,
              categoryId: line.categoryId,
              description: line.description,
              ...(line.quantity === undefined
                ? {}
                : { quantity: line.quantity }),
              ...(line.unitPrice === undefined
                ? {}
                : { unitPrice: line.unitPrice }),
              lineTotal: ensureOutflowSign(line.lineTotal),
            }));
          } else {
            if (
              line.lineId !== undefined &&
              !selected.some((candidate) =>
                candidate.type === "purchase" && candidate.id === line.lineId
              )
            ) {
              throw new ReceiptDomainError(
                "invalid",
                "An adjustment link must reference a selected purchase line.",
              );
            }
            adjustments.push(ReceiptAdjustmentSchema.parse({
              schemaVersion: CURRENT_SCHEMA_VERSION,
              type: "receipt-adjustment",
              id: line.id,
              receiptId,
              projectId: project.id,
              categoryId: line.categoryId,
              description: line.description,
              amount: line.amount,
              ...(line.lineId === undefined ? {} : { lineId: line.lineId }),
            }));
          }
        }
        await transaction.put(
          "records",
          receipt.id,
          asOrganizationJsonValue(receipt),
        );
        for (const line of purchaseLines) {
          await transaction.put(
            "records",
            line.id,
            asOrganizationJsonValue(line),
          );
        }
        for (const line of adjustments) {
          await transaction.put(
            "records",
            line.id,
            asOrganizationJsonValue(line),
          );
        }
        return { receipt, purchaseLines, adjustments };
      });
    },
  };
}
