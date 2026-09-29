import { type CanonicalDecimal, type ReceiptLine } from "../schema/index.ts";
import { moneyCompare, moneySubtract, moneySum } from "../money/index.ts";
import type { ReceiptDraftLine, ReceiptReviewDraft } from "./types.ts";

export function ensureOutflowSign(value: CanonicalDecimal): CanonicalDecimal {
  return moneyCompare(value, "0") > 0 ? moneySubtract("0", value) : value;
}

/** Receipt credits and other inflows are positive ledger amounts. */
export function ensureInflowSign(value: CanonicalDecimal): CanonicalDecimal {
  return moneyCompare(value, "0") < 0 ? moneySubtract("0", value) : value;
}

export function lineTotal(line: ReceiptDraftLine): CanonicalDecimal {
  return line.type === "purchase"
    ? ensureOutflowSign(line.lineTotal)
    : line.amount;
}

export function receiptTotalWithLineDirection(
  printedTotal: CanonicalDecimal,
  lines: readonly ReceiptDraftLine[],
): CanonicalDecimal {
  const selectedTotal = moneySum(
    lines.filter((line) => line.selected).map(lineTotal),
  );
  const selectedDirection = moneyCompare(selectedTotal, "0");
  if (selectedDirection === 0 || moneyCompare(printedTotal, "0") === 0) {
    return printedTotal;
  }
  return moneyCompare(printedTotal, "0") === selectedDirection
    ? printedTotal
    : moneySubtract("0", printedTotal);
}

export function receiptSelectedTotal(
  review: Pick<ReceiptReviewDraft, "lines">,
): CanonicalDecimal {
  return moneySum(review.lines.filter((line) => line.selected).map(lineTotal));
}

export function receiptMismatchDifference(
  review: Pick<ReceiptReviewDraft, "parent" | "lines">,
): CanonicalDecimal {
  return moneySubtract(
    receiptSelectedTotal(review),
    receiptTotalWithLineDirection(review.parent.printedTotal, review.lines),
  );
}

export function mismatchFields(
  parent: ReceiptReviewDraft["parent"],
  lines: readonly ReceiptDraftLine[],
  explanation?: string,
): Pick<
  ReceiptReviewDraft,
  "printedTotalMismatch" | "mismatchDifference" | "mismatchExplanation"
> {
  const difference = moneySubtract(
    moneySum(lines.filter((line) => line.selected).map(lineTotal)),
    parent.printedTotal,
  );
  if (moneyCompare(difference, "0") === 0) {
    return { printedTotalMismatch: false };
  }
  return {
    printedTotalMismatch: true,
    mismatchDifference: difference,
    ...(explanation === undefined ? {} : { mismatchExplanation: explanation }),
  };
}

export function receiptLineAmount(line: ReceiptLine): CanonicalDecimal {
  return "lineTotal" in line ? line.lineTotal : line.amount;
}
