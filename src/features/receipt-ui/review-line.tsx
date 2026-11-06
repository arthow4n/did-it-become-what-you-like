import { shallowEqual, useSelector } from "@xstate/react";
import { memo } from "react";
import type { ActorRefFrom, SnapshotFrom } from "xstate";
import type { createReceiptReviewMachine } from "../../actors/receipt.ts";
import type { Category } from "../../domain/index.ts";
import { ReceiptLineCard } from "../../design-system/index.ts";
import { LineEditorDialog, QuickCategoryDialog } from "./line-dialogs.tsx";
import { lineViewModel, type ReceiptReviewMode } from "./types.ts";

type ReviewMachine = ReturnType<typeof createReceiptReviewMachine>;
export type ReceiptReviewActor = ActorRefFrom<ReviewMachine>;
type ReviewLinks = Array<{ id: string; label: string }>;

export function selectReviewLinks(
  snapshot: SnapshotFrom<ReviewMachine>,
): ReviewLinks {
  return (snapshot.context.review?.lines ?? []).filter((line) =>
    line.type === "purchase" && line.selected
  ).map((line) => ({
    id: line.id,
    label: line.description || "Unclear purchase",
  }));
}

export function sameReviewLinks(a: ReviewLinks, b: ReviewLinks): boolean {
  return a.length === b.length &&
    a.every((link, index) =>
      link.id === b[index].id && link.label === b[index].label
    );
}

// A normalized draft may replace every line object. Compare each line's scalar
// fields so edits and persistence updates do not render unrelated cards.
export const ReceiptReviewLine = memo(function ReceiptReviewLine({
  actor,
  lineId,
  categories,
  links,
  mode,
}: {
  actor: ReceiptReviewActor;
  lineId: string;
  categories: readonly Category[];
  links: ReviewLinks;
  mode: ReceiptReviewMode;
}) {
  const line = useSelector(
    actor,
    (snapshot) =>
      snapshot.context.review?.lines.find((line) => line.id === lineId),
    shallowEqual,
  );
  const currency = useSelector(
    actor,
    (snapshot) => snapshot.context.review?.parent.currency,
  );
  const saving = useSelector(actor, (snapshot) => snapshot.hasTag("saving"));
  if (!line || !currency) return null;
  const send = actor.send;
  return (
    <ReceiptLineCard
      line={lineViewModel(line, categories)}
      currency={currency}
      mode={mode === "manual" ? "manual" : mode === "menu" ? "menu" : "review"}
      onSelectedChange={mode === "manual" ? undefined : (selected) =>
        send({
          type: "receipt.review.select-line",
          lineId: line.id,
          selected,
        })}
      onQuantityChange={line.type === "purchase"
        ? (quantity) =>
          send({
            type: "receipt.review.set-line-quantity",
            lineId: line.id,
            quantity,
          })
        : undefined}
      categoryControl={
        <QuickCategoryDialog
          line={line}
          categories={categories}
          isDisabled={saving}
          onSelect={(categoryId) =>
            send({
              type: "receipt.review.edit-line",
              line: { ...line, categoryId },
            })}
        />
      }
      editControl={
        <LineEditorDialog
          line={line}
          categories={categories}
          linkOptions={links}
          triggerLabel="Edit"
          onSave={(next) =>
            send({ type: "receipt.review.edit-line", line: next })}
          manual={mode === "manual"}
        />
      }
      onRemove={() =>
        send({ type: "receipt.review.remove-line", lineId: line.id })}
    />
  );
});
