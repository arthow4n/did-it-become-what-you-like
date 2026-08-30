import { within } from "@testing-library/dom";
import { createElement } from "react";
import type {
  ReceiptAggregate,
  ReceiptManagementService,
} from "../domain/receipt.ts";
import { ReceiptDetailScreen } from "./receipt-detail-ui.tsx";
import {
  withAriaGlobals,
  withComponentHarness,
} from "../test-support/component-harness.tsx";

declare const Deno: {
  test(name: string, fn: () => void | Promise<void>): void;
};

function assert(
  condition: unknown,
  message = "Expected condition",
): asserts condition {
  if (!condition) throw new Error(message);
}

const category = {
  schemaVersion: 1 as const,
  type: "category" as const,
  id: "category-food",
  name: "Food",
  sortOrder: 0,
  archived: false,
  system: false,
};

const aggregate: ReceiptAggregate = {
  receipt: {
    schemaVersion: 1,
    type: "receipt",
    id: "receipt-detail-test",
    projectId: "project-detail-test",
    date: "2026-08-30",
    time: "18:42",
    merchant: "Evening Market",
    currency: "SEK",
    printedTotal: "-75",
  },
  purchaseLines: [{
    schemaVersion: 1,
    type: "receipt-purchase-line",
    id: "line-coffee",
    receiptId: "receipt-detail-test",
    projectId: "project-detail-test",
    categoryId: "category-food",
    description: "Coffee",
    lineTotal: "-50",
  }, {
    schemaVersion: 1,
    type: "receipt-purchase-line",
    id: "line-bread",
    receiptId: "receipt-detail-test",
    projectId: "project-detail-test",
    categoryId: "category-food",
    description: "Bread",
    lineTotal: "-25",
  }],
  adjustments: [{
    schemaVersion: 1,
    type: "receipt-adjustment",
    id: "adjustment-discount",
    receiptId: "receipt-detail-test",
    projectId: "project-detail-test",
    categoryId: "category-food",
    description: "Member discount",
    amount: "0",
    lineId: "line-coffee",
  }],
  derivedExpenses: [],
};

function createService(options?: {
  get?: ReceiptManagementService["get"];
  updateLine?: ReceiptManagementService["updateLine"];
  addLine?: ReceiptManagementService["addLine"];
  deleteLine?: ReceiptManagementService["deleteLine"];
  deleteReceipt?: () => Promise<{ deletedReceipt: boolean }>;
}): ReceiptManagementService {
  let current = aggregate;
  return {
    get: options?.get ?? (() => Promise.resolve(current)),
    updateMetadata: (_receiptId, changes) => {
      current = {
        ...current,
        receipt: {
          ...current.receipt,
          ...(changes.merchant === undefined
            ? {}
            : { merchant: changes.merchant ?? undefined }),
          ...(changes.date === undefined ? {} : { date: changes.date }),
          ...(changes.time === undefined
            ? {}
            : { time: changes.time ?? undefined }),
          ...(changes.printedTotal === undefined
            ? {}
            : { printedTotal: changes.printedTotal }),
        },
      };
      return Promise.resolve(current);
    },
    updateLine: options?.updateLine ?? (() => Promise.resolve(current)),
    addLine: options?.addLine ?? (() => Promise.resolve(current)),
    deleteLine: options?.deleteLine ??
      ((_receiptId, lineId) =>
        Promise.resolve({
          aggregate: {
            ...current,
            purchaseLines: current.purchaseLines.filter((line) =>
              line.id !== lineId
            ),
            adjustments: current.adjustments.filter((line) =>
              line.id !== lineId
            ),
          },
          deletedReceipt: false,
          deletedLineId: lineId,
        })),
    deleteReceipt: options?.deleteReceipt ?? (() =>
      Promise.resolve({
        deletedReceipt: true,
      })),
  };
}

Deno.test("receipt detail renders saved management and stages metadata changes", async () => {
  await withComponentHarness(async ({ render, fireEvent, waitFor }) => {
    let output: unknown;
    await withAriaGlobals(async () => {
      render(
        createElement(ReceiptDetailScreen, {
          service: createService(),
          receiptId: aggregate.receipt.id,
          categories: [category],
          focusedLineId: "line-bread",
          onComplete: (next) => output = next,
        }),
      );
      const view = within(document.body);
      await waitFor(() => {
        assert(
          view.getAllByRole("heading", { name: "Evening Market" }).length >= 2,
        );
        assert(view.getByText(/18:42/));
        assert(view.getByText("Coffee"));
        assert(view.getByText("Member discount"));
      });
      const receiptHeading = view.getAllByRole("heading", {
        name: "Evening Market",
      })[0];
      const header = receiptHeading.closest("header");
      assert(header);
      assert(
        !within(header).queryByRole("button", { name: "Delete receipt" }),
        "destructive receipt action should follow receipt context",
      );
      const receiptDate = view.getByText(/18:42/);
      const deleteReceipt = view.getByRole("button", {
        name: "Delete receipt",
      });
      assert(
        Boolean(receiptDate.compareDocumentPosition(deleteReceipt) & 4),
        "receipt context should precede the destructive action",
      );
      assert(!view.queryByRole("checkbox"));
      const focused = document.querySelector<HTMLElement>(
        '[data-receipt-line-id="line-bread"]',
      );
      assert(focused && document.activeElement === focused);

      const editButtons = view.getAllByRole("button", { name: "Edit" });
      fireEvent.click(editButtons[0]);
      await waitFor(() =>
        assert(view.getByRole("dialog", { name: "Edit receipt details" }))
      );
      fireEvent.input(view.getByLabelText("Merchant"), {
        target: { value: "Updated Market" },
      });
      fireEvent.click(view.getByRole("button", { name: "Save changes" }));
      await waitFor(() =>
        assert(view.getAllByText("Updated Market").length >= 2)
      );

      const refreshedEditButtons = view.getAllByRole("button", {
        name: "Edit",
      });
      fireEvent.click(refreshedEditButtons[1]);
      await waitFor(() =>
        assert(view.getByRole("dialog", { name: "Edit receipt line" }))
      );
      fireEvent.input(view.getByLabelText(/Description/), {
        target: { value: "Sourdough bread" },
      });
      fireEvent.click(view.getByRole("button", { name: "Back to expenses" }));
      await waitFor(() =>
        assert(view.getByRole("dialog", { name: "Discard receipt changes?" }))
      );
      fireEvent.click(view.getByRole("button", { name: "Discard changes" }));
      await waitFor(() => assert(output));
      assert(
        (output as { status: string }).status === "discarded",
        "discarding a dirty back navigation should complete with discarded status",
      );
    });
  });
});

Deno.test("receipt detail exposes scoped line and whole-receipt confirmations", async () => {
  await withComponentHarness(async ({ render, fireEvent, waitFor }) => {
    let output: { status: string } | undefined;
    await withAriaGlobals(async () => {
      render(
        createElement(ReceiptDetailScreen, {
          service: createService(),
          receiptId: aggregate.receipt.id,
          categories: [category],
          onComplete: (next) => output = next,
        }),
      );
      const view = within(document.body);
      await waitFor(() => assert(view.getByText("Coffee")));

      const removeButtons = view.getAllByRole("button", { name: "Remove" });
      fireEvent.click(removeButtons[0]);
      const lineDialog = view.getByRole("dialog", {
        name: "Delete this line?",
      });
      assert(within(lineDialog).getByText(/removes only this purchase line/));
      fireEvent.click(
        within(lineDialog).getByRole("button", { name: "Cancel" }),
      );
      await new Promise<void>((resolve) => setTimeout(resolve, 20));
      assert(!view.queryByRole("dialog", { name: "Delete this line?" }));

      fireEvent.click(view.getByRole("button", { name: "Delete receipt" }));
      const receiptDialog = view.getByRole("dialog", {
        name: "Delete this receipt?",
      });
      assert(
        within(receiptDialog).getByText(/every purchase line and adjustment/),
      );
      fireEvent.click(
        within(receiptDialog).getByRole("button", { name: "Delete receipt" }),
      );
      await waitFor(() => assert(output?.status === "deleted"));
      await new Promise<void>((resolve) => setTimeout(resolve, 20));
    });
  });
});

Deno.test("receipt detail adds purchase lines and adjustments with focus return", async () => {
  await withComponentHarness(async ({ render, fireEvent, waitFor }) => {
    let current = aggregate;
    let nextLine = 0;
    await withAriaGlobals(async () => {
      render(
        createElement(ReceiptDetailScreen, {
          service: createService({
            addLine: (_receiptId, changes) => {
              const id = `line-added-ui-${++nextLine}`;
              current = changes.type === "purchase"
                ? {
                  ...current,
                  purchaseLines: [...current.purchaseLines, {
                    schemaVersion: 1,
                    type: "receipt-purchase-line",
                    id,
                    receiptId: current.receipt.id,
                    projectId: current.receipt.projectId,
                    categoryId: changes.categoryId,
                    description: changes.description,
                    lineTotal: changes.lineTotal,
                  }],
                }
                : {
                  ...current,
                  adjustments: [...current.adjustments, {
                    schemaVersion: 1,
                    type: "receipt-adjustment",
                    id,
                    receiptId: current.receipt.id,
                    projectId: current.receipt.projectId,
                    categoryId: changes.categoryId,
                    description: changes.description,
                    amount: changes.amount,
                    ...(changes.lineId ? { lineId: changes.lineId } : {}),
                  }],
                };
              return Promise.resolve(current);
            },
          }),
          receiptId: aggregate.receipt.id,
          categories: [category],
        }),
      );
      const view = within(document.body);
      await waitFor(() => assert(view.getByText("Coffee")));

      fireEvent.click(view.getByRole("button", { name: "Add purchase line" }));
      await waitFor(() =>
        assert(view.getByRole("dialog", { name: "Add receipt line" }))
      );
      fireEvent.input(view.getByLabelText(/Description/), {
        target: { value: "Tea" },
      });
      fireEvent.input(view.getByLabelText(/Line total/), {
        target: { value: "4" },
      });
      fireEvent.click(view.getByRole("button", { name: "Add line" }));
      await waitFor(() => assert(view.getByText("Tea")));
      const addedPurchase = document.querySelector<HTMLElement>(
        '[data-receipt-line-id="line-added-ui-1"]',
      );
      assert(addedPurchase && document.activeElement === addedPurchase);

      fireEvent.click(view.getByRole("button", { name: "Add adjustment" }));
      await waitFor(() =>
        assert(view.getByRole("dialog", { name: "Add receipt line" }))
      );
      fireEvent.input(view.getByLabelText(/Description/), {
        target: { value: "Bottle return" },
      });
      fireEvent.input(view.getByLabelText(/Signed adjustment/), {
        target: { value: "1" },
      });
      fireEvent.click(view.getByRole("button", { name: "Add line" }));
      await waitFor(() => assert(view.getByText("Bottle return")));
    });
  });
});

Deno.test(
  "receipt detail disables line management while an atomic change is pending",
  async () => {
    await withComponentHarness(async ({ render, fireEvent, waitFor }) => {
      let resolveUpdate: ((value: ReceiptAggregate) => void) | undefined;
      await withAriaGlobals(async () => {
        render(
          createElement(ReceiptDetailScreen, {
            service: createService({
              updateLine: () =>
                new Promise<ReceiptAggregate>((resolve) => {
                  resolveUpdate = resolve;
                }),
            }),
            receiptId: aggregate.receipt.id,
            categories: [category],
          }),
        );
        const view = within(document.body);
        await waitFor(() => assert(view.getByText("Coffee")));
        const editButtons = view.getAllByRole("button", { name: "Edit" });
        fireEvent.click(editButtons[1]);
        await waitFor(() =>
          assert(view.getByRole("dialog", { name: "Edit receipt line" }))
        );
        fireEvent.input(view.getByLabelText(/Description/), {
          target: { value: "Updated coffee" },
        });
        fireEvent.click(view.getByRole("button", { name: "Save changes" }));
        await waitFor(() => assert(view.getByText("Saving receipt change")));
        const coffeeLine = document.querySelector<HTMLElement>(
          '[data-receipt-line-id="line-coffee"]',
        );
        assert(coffeeLine);
        assert(
          within(coffeeLine).getByRole("button", { name: "Edit" }).hasAttribute(
            "disabled",
          ),
        );
        assert(
          within(coffeeLine).getByRole("button", { name: "Remove" })
            .hasAttribute("disabled"),
        );
        resolveUpdate?.(aggregate);
      });
    });
  },
);

Deno.test(
  "receipt detail exposes missing-receipt recovery without a dirty prompt",
  async () => {
    await withComponentHarness(async ({ render, fireEvent, waitFor }) => {
      const dirtyStates: boolean[] = [];
      await withAriaGlobals(async () => {
        render(
          createElement(ReceiptDetailScreen, {
            service: createService({
              get: () => Promise.resolve(undefined),
            }),
            receiptId: aggregate.receipt.id,
            categories: [category],
            onDirtyChange: (dirty) => dirtyStates.push(dirty),
          }),
        );
        const view = within(document.body);
        await waitFor(() => {
          assert(view.getByText("Receipt not found"));
          assert(view.getByRole("button", { name: "Reload receipt" }));
        });
        assert(!dirtyStates.includes(true));
        fireEvent.click(view.getByRole("button", { name: "Reload receipt" }));
        await waitFor(() => assert(view.getByText("Receipt not found")));
      });
    });
  },
);
