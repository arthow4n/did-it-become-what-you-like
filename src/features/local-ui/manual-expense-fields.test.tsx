import { createElement } from "react";
import { createActor } from "xstate";
import { createManualExpenseMachine } from "../../actors/manual-expense.ts";
import { createFakeLocalPort } from "../../test-support/fakes/ports.ts";
import { withComponentHarness } from "../../test-support/component-harness.tsx";
import type { ProjectCategoryService } from "../../domain/organization.ts";
import { ExpenseDraftField } from "./manual-expense-fields.tsx";

declare const Deno: {
  test(name: string, fn: () => void | Promise<void>): void;
};

Deno.test("manual draft fields update the actor immediately without rendering unrelated fields", async () => {
  await withComponentHarness(({ render, fireEvent }) => {
    // Opening with a supplied draft requires no organization I/O.
    const actor = createActor(
      createManualExpenseMachine({
        local: createFakeLocalPort(),
        organization: {} as ProjectCategoryService,
      }),
      {
        input: {
          request: {
            initialDraft: {
              projectId: "project-entry",
              categoryId: "category-entry",
              amount: "",
              currency: "SEK",
              date: "2026-10-28",
              description: "",
              direction: "spent",
            },
          },
        },
      },
    ).start();
    try {
      let amountRenders = 0;
      let merchantRenders = 0;
      const view = render(
        <>
          <ExpenseDraftField actor={actor} field="amount">
            {(value, onChange) => {
              amountRenders++;
              return createElement("input", {
                "aria-label": "Amount",
                value,
                onChange: (event) => onChange(event.currentTarget.value),
              });
            }}
          </ExpenseDraftField>
          <ExpenseDraftField actor={actor} field="merchant">
            {(value, onChange) => {
              merchantRenders++;
              return createElement("input", {
                "aria-label": "Merchant",
                value: value ?? "",
                onChange: (event) => onChange(event.currentTarget.value),
              });
            }}
          </ExpenseDraftField>
        </>,
      );
      const initialMerchantRenders = merchantRenders;
      const amount = view.getByLabelText("Amount");
      for (const value of ["1", "12", "12.", "12.5", "12.50"]) {
        fireEvent.input(amount, { target: { value } });
        if (actor.getSnapshot().context.draft?.amount !== value) {
          throw new Error("Actor must receive each keystroke before blur");
        }
      }
      if (merchantRenders !== initialMerchantRenders) {
        throw new Error("Amount typing rendered an unrelated field");
      }
      const amountRendersAfterTyping = amountRenders;
      const revision = actor.getSnapshot().context.persistenceRevision;
      fireEvent.blur(amount);
      fireEvent.focus(view.getByLabelText("Merchant"));
      if (actor.getSnapshot().context.persistenceRevision !== revision) {
        throw new Error("Focus changes must not resend the draft");
      }
      fireEvent.input(view.getByLabelText("Merchant"), {
        target: { value: "Corner Store " },
      });
      if (amountRenders !== amountRendersAfterTyping) {
        throw new Error("Merchant typing rendered the amount field");
      }
      const draft = actor.getSnapshot().context.draft;
      if (draft?.amount !== "12.50" || draft.merchant !== "Corner Store ") {
        throw new Error(
          "Successive field edits must preserve the current draft",
        );
      }
      // Terminal draft clearing must be safe for subscriptions still mounted.
      actor.send({ type: "expense.discard" });
      actor.send({ type: "expense.confirm-discard" });
    } finally {
      actor.stop();
    }
  });
});
