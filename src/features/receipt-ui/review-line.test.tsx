import { Profiler } from "react";
import { createActor } from "xstate";
import { createReceiptReviewMachine } from "../../actors/receipt.ts";
import type { Category } from "../../domain/index.ts";
import type { ReceiptReviewDraft } from "../../domain/receipt.ts";
import { withComponentHarness } from "../../test-support/component-harness.tsx";
import { settle, waitForActorState } from "../../test-support/async.ts";
import { createFakeLocalPort } from "../../test-support/fakes/ports.ts";
import {
  ReceiptReviewLine,
  sameReviewLinks,
  selectReviewLinks,
} from "./review-line.tsx";

declare const Deno: { test(name: string, fn: () => Promise<void>): void };

Deno.test("receipt rows ignore sibling quantity and persistence updates but observe currency and saving", async () => {
  await withComponentHarness(async ({ render, fireEvent }) => {
    const local = createFakeLocalPort();
    const review: ReceiptReviewDraft = {
      parent: {
        projectId: "project-review",
        date: "2026-08-30",
        currency: "SEK",
        printedTotal: "-10",
      },
      lines: ["Milk", "Bread"].map((description, index) => ({
        type: "purchase",
        id: `line-${index}`,
        description,
        categoryId: `category-${index}`,
        lineTotal: "-5",
        quantity: "1",
        unitPrice: "5",
        selected: true,
        uncertain: false,
      })),
      uncertainty: [],
      printedTotalMismatch: false,
    };
    const reads = [0, 0];
    const categories: Category[] = reads.map((_, index) => ({
      schemaVersion: 1,
      type: "category",
      id: `category-${index}`,
      name: `Category ${index}`,
      sortOrder: index,
      archived: false,
      system: false,
    }));
    let releaseCommit!: () => void;
    const pendingCommit = new Promise<void>((resolve) =>
      releaseCommit = resolve
    );
    const actor = createActor(
      createReceiptReviewMachine({
        local,
        commit: {
          commit: async () => {
            await pendingCommit;
            throw new Error("Held commit");
          },
        },
      }),
      { input: { initialReview: review } },
    ).start();
    try {
      await waitForActorState(actor, "persisted");
      const links = selectReviewLinks(actor.getSnapshot());
      const content = (
        <>
          {review.lines.map((line, index) => (
            <Profiler
              key={line.id}
              id={line.id}
              onRender={() => {
                reads[index]++;
              }}
            >
              <ReceiptReviewLine
                actor={actor}
                lineId={line.id}
                categories={categories}
                links={links}
                mode="menu"
              />
            </Profiler>
          ))}
        </>
      );
      const mounted = render(content);
      await settle();
      const before = [...reads];
      fireEvent.click(
        mounted.getByRole("button", { name: "Increase quantity of Milk" }),
      );
      await waitForActorState(actor, "persisted");
      if (reads[0] <= before[0]) throw new Error("Changed row did not render");
      if (reads[1] !== before[1]) {
        throw new Error("Sibling quantity or persistence rerendered Bread");
      }
      if (!sameReviewLinks(links, selectReviewLinks(actor.getSnapshot()))) {
        throw new Error("Quantity changed link choices");
      }
      const parent = actor.getSnapshot().context.review!.parent;
      actor.send({
        type: "receipt.review.change-parent",
        parent: { ...parent, currency: "EUR" },
      });
      await waitForActorState(actor, "persisted");
      if (reads[1] <= before[1]) {
        throw new Error("Currency update was hidden from sibling");
      }
      if (!mounted.getAllByText(/EUR|€/).length) {
        throw new Error("Currency display is stale");
      }
      actor.send({ type: "receipt.review.submit", confirmMismatch: true });
      await waitForActorState(actor, "saving");
      if (
        !(mounted.getAllByRole("button", {
          name: /Category:.*Tap to change/,
        }) as HTMLButtonElement[]).every((button) => button.disabled)
      ) throw new Error("Saving did not disable category controls");
      mounted.unmount();
    } finally {
      actor.stop();
      releaseCommit();
    }
  });
});
