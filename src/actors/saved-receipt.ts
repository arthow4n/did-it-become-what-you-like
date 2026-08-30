import { fromPromise } from "xstate";
import type { ReceiptManagementService } from "../domain/receipt.ts";
import type { StableId } from "../domain/index.ts";
import {
  savedReceiptDetailMachine,
  type SavedReceiptMutation,
  type SavedReceiptMutationOutput,
} from "./contracts/saved-receipt.ts";

export type SavedReceiptMachineDependencies = {
  readonly service: ReceiptManagementService;
};

async function mutateReceipt(
  service: ReceiptManagementService,
  mutation: SavedReceiptMutation,
): Promise<SavedReceiptMutationOutput> {
  switch (mutation.kind) {
    case "metadata":
      return {
        kind: "metadata",
        aggregate: await service.updateMetadata(
          mutation.receiptId,
          mutation.changes,
        ),
      };
    case "line":
      return {
        kind: "line",
        aggregate: await service.updateLine(
          mutation.receiptId,
          mutation.lineId,
          mutation.changes,
        ),
      };
    case "add-line":
      return {
        kind: "add-line",
        aggregate: await service.addLine(
          mutation.receiptId,
          mutation.changes,
        ),
      };
    case "delete-line":
      return {
        kind: "delete-line",
        result: await service.deleteLine(mutation.receiptId, mutation.lineId),
      };
    case "delete-receipt":
      return {
        kind: "delete-receipt",
        result: await service.deleteReceipt(mutation.receiptId),
      };
  }
}

export function createSavedReceiptMachine(
  dependencies: SavedReceiptMachineDependencies,
) {
  return savedReceiptDetailMachine.provide({
    actors: {
      loadReceipt: fromPromise(
        ({ input }: { input: StableId }) => dependencies.service.get(input),
      ),
      mutateReceipt: fromPromise(
        ({ input }: { input: SavedReceiptMutation }) =>
          mutateReceipt(dependencies.service, input),
      ),
    },
  });
}
