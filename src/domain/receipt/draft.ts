import {
  type CalendarDate,
  CalendarDateSchema,
  type CanonicalDecimal,
  canonicalDecimal,
  type CurrencyCode,
  CurrencyCodeSchema,
  type StableId,
  StableIdSchema,
  type TimeOfDay,
  TimeOfDaySchema,
  UNCATEGORIZED_CATEGORY_ID,
} from "../schema/index.ts";
import {
  moneyAdd,
  moneyCompare,
  moneyDivide,
  moneyMultiply,
  moneySubtract,
} from "../money/index.ts";
import {
  type DurableReceiptReviewSnapshot,
  DurableReceiptReviewSnapshotSchema,
  ReceiptDomainError,
  type ReceiptDraftLine,
  type ReceiptDraftLineCandidate,
  type ReceiptReviewDraft,
  ReceiptReviewDraftSchema,
  type ReceiptReviewInput,
} from "./types.ts";
import { isRecord } from "./records.ts";
import {
  ensureInflowSign,
  ensureOutflowSign,
  mismatchFields,
  receiptTotalWithLineDirection,
} from "./arithmetic.ts";

function invalid(message: string): never {
  throw new ReceiptDomainError("invalid", message);
}

function parseDecimal(value: unknown): CanonicalDecimal | undefined {
  if (typeof value !== "string") return undefined;
  try {
    return canonicalDecimal(value.trim());
  } catch {
    return undefined;
  }
}

function safeText(value: unknown, maximum = 500): string {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

function safeReason(value: unknown): string | undefined {
  const reason = safeText(value, 1_000);
  return reason.length === 0 ? undefined : reason;
}

function safeClassificationReason(value: unknown): string | undefined {
  const reason = safeText(value, 500);
  return reason.length === 0 ? undefined : reason;
}

const BOTTLE_DEPOSIT_CHARGE_PATTERN =
  /\b(?:pant(?:\s+burk)?|bottle\s+deposit)\b/i;
const BOTTLE_DEPOSIT_RETURN_PATTERN =
  /\b(?:retur|åter|återbetalning|refund|return)\b/i;

function positiveReceiptAmount(
  value: CanonicalDecimal,
): CanonicalDecimal {
  return moneyCompare(value, "0") < 0 ? moneySubtract("0", value) : value;
}

function inferredReceiptUnitPrice(
  line: Extract<ReceiptDraftLineCandidate, { readonly type: "purchase" }>,
): CanonicalDecimal | undefined {
  const quantity = line.quantity ?? "1";
  if (moneyCompare(quantity, "0") <= 0) return undefined;
  return moneyDivide(positiveReceiptAmount(line.lineTotal), quantity);
}

/**
 * Consolidate only extracted lines which are safe to treat as repeated units.
 * Unselected or uncertain lines stay independent so review never loses an
 * individual correction or selection decision.
 */
function receiptLineMergeKey(
  line: ReceiptDraftLineCandidate,
): string | undefined {
  if (!line.selected || line.uncertain || line.description.length === 0) {
    return undefined;
  }
  if (
    line.type === "adjustment" &&
    (!BOTTLE_DEPOSIT_CHARGE_PATTERN.test(line.description) ||
      BOTTLE_DEPOSIT_RETURN_PATTERN.test(line.description))
  ) {
    return undefined;
  }
  const description = line.description
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("en-US");
  const amount = line.type === "purchase" ? line.lineTotal : line.amount;
  return [
    line.type,
    description,
    line.categoryId,
    amount,
    line.type === "purchase" ? line.quantity ?? "1" : "",
    line.type === "purchase" ? line.unitPrice ?? "" : "",
  ].join("\u0000");
}

function consolidateReceiptLines(
  lines: readonly ReceiptDraftLineCandidate[],
): readonly ReceiptDraftLineCandidate[] {
  const consolidated: ReceiptDraftLineCandidate[] = [];
  const indices = new Map<string, number>();
  for (const line of lines) {
    const key = receiptLineMergeKey(line);
    if (key === undefined) {
      consolidated.push(line);
      continue;
    }
    const existingIndex = indices.get(key);
    if (existingIndex === undefined) {
      indices.set(key, consolidated.length);
      consolidated.push(line);
      continue;
    }
    const existing = consolidated[existingIndex];
    if (existing === undefined || existing.type !== line.type) {
      consolidated.push(line);
      continue;
    }
    if (existing.type === "purchase" && line.type === "purchase") {
      const unitPrice = existing.unitPrice ?? line.unitPrice ??
        inferredReceiptUnitPrice(existing) ?? inferredReceiptUnitPrice(line);
      consolidated[existingIndex] = {
        ...existing,
        quantity: moneyAdd(
          existing.quantity ?? "1",
          line.quantity ?? "1",
        ),
        unitPrice,
        lineTotal: moneyAdd(existing.lineTotal, line.lineTotal),
      };
    } else if (
      existing.type === "adjustment" &&
      line.type === "adjustment" &&
      BOTTLE_DEPOSIT_CHARGE_PATTERN.test(existing.description) &&
      !BOTTLE_DEPOSIT_RETURN_PATTERN.test(existing.description)
    ) {
      consolidated[existingIndex] = {
        ...existing,
        amount: moneyAdd(existing.amount, line.amount),
      };
    }
  }
  return consolidated;
}

/** Receipt purchases and their parent total are outgoing amounts. */

function normalizeExtractedAmount(
  value: CanonicalDecimal,
  direction: "outflow" | "inflow" | undefined,
): CanonicalDecimal {
  if (direction === "inflow") return ensureInflowSign(value);
  if (direction === "outflow") return ensureOutflowSign(value);
  return value;
}

/**
 * A positive deposit printed with purchased goods is a charge, not a refund.
 * Keep this correction deliberately narrow: explicit return/refund evidence or
 * a printed negative amount remains an inflow, even if the model direction is
 * contradictory.
 */
function normalizeBottleDepositDirection(
  description: string,
  kind: "purchase" | "adjustment" | undefined,
  amount: CanonicalDecimal | undefined,
  direction: "outflow" | "inflow" | undefined,
): {
  readonly direction: "outflow" | "inflow" | undefined;
  readonly classificationReason?: string;
} {
  if (
    kind !== "adjustment" ||
    amount === undefined ||
    !BOTTLE_DEPOSIT_CHARGE_PATTERN.test(description)
  ) {
    return { direction };
  }
  if (moneyCompare(amount, "0") < 0) {
    return {
      direction: "inflow",
      ...(direction === "outflow"
        ? {
          classificationReason:
            "The printed negative PANT BURK amount is a deposit return, so it is treated as money back.",
        }
        : {}),
    };
  }
  if (
    direction !== "inflow" ||
    BOTTLE_DEPOSIT_RETURN_PATTERN.test(description)
  ) {
    return { direction };
  }
  return {
    direction: "outflow",
    classificationReason:
      "The PANT BURK line is a bottle-deposit charge listed with the purchased goods, so it increases the amount owed.",
  };
}

function normalizedDraft(
  draft: ReceiptReviewDraft,
  options: { readonly requireSelectedDescription: boolean },
): ReceiptReviewDraft {
  const parsed = ReceiptReviewDraftSchema.safeParse(draft);
  if (!parsed.success) invalid("Receipt review data failed validation.");
  const review = parsed.data;
  const ids = new Set<string>();
  for (const line of review.lines) {
    if (ids.has(line.id)) {
      invalid("Receipt review contains duplicate line IDs.");
    }
    ids.add(line.id);
  }
  const purchaseIds = new Set(
    review.lines.filter((line) => line.type === "purchase").map((line) =>
      line.id
    ),
  );
  const lines: ReceiptDraftLine[] = review.lines.map((line) => {
    const description = line.description.trim();
    if (options.requireSelectedDescription && line.selected && !description) {
      invalid("Every selected receipt line requires a description.");
    }
    if (
      line.type === "adjustment" && line.lineId !== undefined &&
      !purchaseIds.has(line.lineId)
    ) {
      invalid(
        "An adjustment link must reference a purchase line on this receipt.",
      );
    }
    if (line.type === "purchase") {
      return {
        type: line.type,
        id: line.id,
        description,
        categoryId: line.categoryId,
        lineTotal: ensureOutflowSign(line.lineTotal),
        selected: line.selected,
        uncertain: line.uncertain,
        ...(line.quantity === undefined ? {} : { quantity: line.quantity }),
        ...(line.unitPrice === undefined ? {} : { unitPrice: line.unitPrice }),
        ...(line.selectionReason === undefined
          ? {}
          : { selectionReason: line.selectionReason.trim() }),
        ...(line.classificationReason === undefined
          ? {}
          : { classificationReason: line.classificationReason.trim() }),
      };
    }
    return {
      type: line.type,
      id: line.id,
      description,
      categoryId: line.categoryId,
      amount: line.amount,
      selected: line.selected,
      uncertain: line.uncertain,
      ...(line.lineId === undefined ? {} : { lineId: line.lineId }),
      ...(line.selectionReason === undefined
        ? {}
        : { selectionReason: line.selectionReason.trim() }),
      ...(line.classificationReason === undefined
        ? {}
        : { classificationReason: line.classificationReason.trim() }),
    };
  });
  // Rebuild the optional fields instead of spreading the incoming object.
  // Form controls represent cleared values as `undefined`, but Automerge
  // rejects assigning an own property whose value is undefined. Keeping the
  // canonical draft sparse also makes persisted reviews stable across edits.
  const parent = {
    projectId: review.parent.projectId,
    date: review.parent.date,
    currency: review.parent.currency,
    printedTotal: receiptTotalWithLineDirection(
      review.parent.printedTotal,
      lines,
    ),
    ...(review.parent.time === undefined ? {} : { time: review.parent.time }),
    ...(review.parent.merchant === undefined ||
        review.parent.merchant.trim() === ""
      ? {}
      : { merchant: review.parent.merchant.trim() }),
  };
  const mismatch = mismatchFields(parent, lines, review.mismatchExplanation);
  return {
    parent,
    lines,
    uncertainty: review.uncertainty.map((item) => item.trim()),
    ...mismatch,
  };
}

/** Validate a persisted or edited draft and recompute its mismatch fields. */
export function validateReceiptReviewDraft(
  draft: ReceiptReviewDraft,
): ReceiptReviewDraft {
  return normalizedDraft(draft, { requireSelectedDescription: true });
}

/** Convert the A-301 model port result into a safe, editable review draft. */
export function normalizeReceiptExtractionDraft(
  value: unknown,
  input: ReceiptReviewInput,
): ReceiptReviewDraft {
  if (!isRecord(value)) invalid("Receipt extraction output is not an object.");
  const currency = typeof value.currency === "string"
    ? value.currency.trim().toUpperCase()
    : "";
  const isMenu = input.scanMode === "menu";
  const rawDate = typeof value.date === "string" ? value.date.trim() : "";
  const date = isMenu && input.today ? input.today : rawDate;
  const printedTotal = isMenu ? "0" : parseDecimal(value.printedTotal);
  if (!CurrencyCodeSchema.safeParse(currency).success) {
    invalid("Receipt extraction returned an invalid currency.");
  }
  if (!CalendarDateSchema.safeParse(date).success) {
    invalid("Receipt extraction returned an invalid date.");
  }
  let time: TimeOfDay | undefined;
  if (value.time !== undefined && value.time !== null && value.time !== "") {
    if (
      typeof value.time !== "string" ||
      !TimeOfDaySchema.safeParse(value.time.trim()).success
    ) {
      invalid("Receipt extraction returned an invalid time.");
    }
    time = value.time.trim() as TimeOfDay;
  }
  if (printedTotal === undefined) {
    invalid("Receipt extraction did not return a printed total.");
  }
  if (!Array.isArray(value.lines)) {
    invalid("Receipt extraction did not return receipt lines.");
  }
  if (
    !Array.isArray(value.uncertainty) ||
    value.uncertainty.some((item) => typeof item !== "string")
  ) {
    invalid("Receipt extraction returned invalid uncertainty data.");
  }
  if (
    !Array.isArray(value.mismatches) ||
    value.mismatches.some((item) => typeof item !== "string")
  ) {
    invalid("Receipt extraction returned invalid mismatch data.");
  }
  const categories = new Set(
    input.categoryCatalogue.map((category) => category.id),
  );
  const candidates: ReceiptDraftLineCandidate[] = [];
  for (const rawLine of value.lines) {
    if (!isRecord(rawLine)) {
      candidates.push({
        type: "purchase",
        description: "",
        categoryId: UNCATEGORIZED_CATEGORY_ID,
        lineTotal: "0",
        selected: false,
        uncertain: true,
        selectionReason: "This extracted line could not be read.",
      });
      continue;
    }
    const kind = rawLine.kind === "adjustment"
      ? "adjustment"
      : rawLine.kind === "purchase"
      ? "purchase"
      : undefined;
    const categoryCandidate = typeof rawLine.categoryId === "string"
      ? rawLine.categoryId.trim()
      : "";
    const categoryId = StableIdSchema.safeParse(categoryCandidate).success &&
        categories.has(categoryCandidate)
      ? categoryCandidate
      : UNCATEGORIZED_CATEGORY_ID;
    const categoryIssue = categoryId === UNCATEGORIZED_CATEGORY_ID &&
      categoryCandidate !== UNCATEGORIZED_CATEGORY_ID;
    const description = safeText(rawLine.description);
    const modelReason = safeReason(rawLine.uncertainty);
    const modelClassificationReason = safeClassificationReason(
      rawLine.rationale,
    );
    const amount = parseDecimal(rawLine.amount);
    const quantity = parseDecimal(rawLine.quantity);
    const unitPrice = parseDecimal(rawLine.unitPrice);
    const modelDirection = rawLine.direction === "inflow"
      ? "inflow"
      : rawLine.direction === "outflow"
      ? "outflow"
      : undefined;
    const normalizedDeposit = normalizeBottleDepositDirection(
      description,
      kind,
      amount,
      modelDirection,
    );
    const direction = normalizedDeposit.direction;
    const classificationReason = normalizedDeposit.classificationReason ??
      modelClassificationReason;
    const directionMismatch = kind === "purchase" && direction !== "outflow";
    const quantityInvalid = rawLine.quantity !== undefined &&
      quantity === undefined;
    const unitPriceInvalid = rawLine.unitPrice !== undefined &&
      unitPrice === undefined;
    const purchaseDetailsOnAdjustment = kind === "adjustment" &&
      (rawLine.quantity !== undefined || rawLine.unitPrice !== undefined);
    // Purchases are always ledger outflows even if an untrusted boundary
    // contradicts the contract; keep the line safe while marking it invalid.
    const normalizationDirection = kind === "purchase" ? "outflow" : direction;
    const reason = modelReason ??
      (categoryIssue ? "The category suggestion was unavailable." : undefined);
    const invalidLine = kind === undefined || amount === undefined ||
      direction === undefined || directionMismatch ||
      quantityInvalid || unitPriceInvalid || purchaseDetailsOnAdjustment ||
      description.length === 0 ||
      classificationReason === undefined;
    const selected = rawLine.selected === true && !invalidLine &&
      reason === undefined;
    const uncertain = Boolean(reason) || invalidLine;
    const selectionReason = reason ??
      (invalidLine
        ? "Correct this incomplete line before selecting it."
        : undefined);
    const normalizedAmount = amount === undefined
      ? "0"
      : normalizeExtractedAmount(amount, normalizationDirection);
    if (kind === "adjustment") {
      candidates.push({
        type: "adjustment",
        description,
        categoryId,
        amount: normalizedAmount,
        selected,
        uncertain,
        ...(classificationReason === undefined ? {} : { classificationReason }),
        ...(selectionReason === undefined ? {} : { selectionReason }),
      });
    } else {
      candidates.push({
        type: "purchase",
        description,
        categoryId,
        lineTotal: normalizedAmount,
        ...(quantity === undefined ? {} : { quantity }),
        ...(unitPrice === undefined ? {} : { unitPrice }),
        selected,
        uncertain,
        ...(classificationReason === undefined ? {} : { classificationReason }),
        ...(selectionReason === undefined ? {} : { selectionReason }),
      });
    }
  }
  const lines: ReceiptDraftLine[] = consolidateReceiptLines(candidates).map(
    (line) => ({ ...line, id: input.nextId() }),
  );
  const uncertainty = [
    ...value.uncertainty.map((item) => item.trim()).filter(Boolean),
    ...value.mismatches.map((item) => item.trim()).filter(Boolean),
  ];
  return validateReceiptReviewDraft({
    parent: {
      projectId: input.projectId,
      date: date as CalendarDate,
      ...(time !== undefined ? { time } : {}),
      ...(safeText(value.merchant) === ""
        ? {}
        : { merchant: safeText(value.merchant) }),
      currency: currency as CurrencyCode,
      printedTotal,
    },
    lines,
    uncertainty,
    printedTotalMismatch: false,
  });
}

function withChangedLines(
  review: ReceiptReviewDraft,
  lines: readonly ReceiptDraftLine[],
): ReceiptReviewDraft {
  return validateReceiptReviewDraft({ ...review, lines });
}

export function setReceiptLineSelected(
  review: ReceiptReviewDraft,
  lineId: StableId,
  selected: boolean,
): ReceiptReviewDraft {
  const target = review.lines.find((line) => line.id === lineId);
  const lines = review.lines.map((line) => {
    if (line.id !== lineId) return line;
    if (
      selected && line.type === "purchase" &&
      (!line.quantity || line.quantity === "0")
    ) {
      const unitPrice = line.unitPrice ?? ensureInflowSign(line.lineTotal);
      return {
        ...line,
        selected: true,
        quantity: "1",
        unitPrice,
        lineTotal: ensureOutflowSign(unitPrice),
      };
    }
    return { ...line, selected };
  });
  if (!selected && target?.type === "purchase") {
    return withChangedLines(
      review,
      lines.map((line) =>
        line.type === "adjustment" && line.lineId === lineId
          ? { ...line, lineId: undefined }
          : line
      ),
    );
  }
  return withChangedLines(
    review,
    lines,
  );
}

export function setReceiptLineQuantity(
  review: ReceiptReviewDraft,
  lineId: StableId,
  quantity: CanonicalDecimal,
): ReceiptReviewDraft {
  const line = review.lines.find((candidate) => candidate.id === lineId);
  if (!line) {
    invalid("The receipt line to edit was not found.");
  }
  if (line.type !== "purchase") {
    return review;
  }
  const isZero = moneyCompare(quantity, "0") <= 0;
  const currentQuantity = line.quantity ?? "1";
  const unitPrice = line.unitPrice ?? (
    moneyCompare(currentQuantity, "0") > 0
      ? moneyDivide(ensureInflowSign(line.lineTotal), currentQuantity)
      : ensureInflowSign(line.lineTotal)
  );
  const nextQuantity = isZero ? "0" : quantity;
  const lineTotal = ensureOutflowSign(moneyMultiply(nextQuantity, unitPrice));
  const selected = !isZero;
  return editReceiptLine(review, {
    ...line,
    quantity: isZero ? undefined : nextQuantity,
    unitPrice,
    lineTotal: isZero ? ensureOutflowSign(unitPrice) : lineTotal,
    selected,
  });
}

export function editReceiptLine(
  review: ReceiptReviewDraft,
  line: ReceiptDraftLine,
): ReceiptReviewDraft {
  if (!review.lines.some((candidate) => candidate.id === line.id)) {
    invalid("The receipt line to edit was not found.");
  }
  return withChangedLines(
    review,
    review.lines.map((candidate) =>
      candidate.id === line.id ? line : candidate
    ),
  );
}

export function addReceiptLine(
  review: ReceiptReviewDraft,
  line: ReceiptDraftLine,
): ReceiptReviewDraft {
  if (review.lines.some((candidate) => candidate.id === line.id)) {
    invalid("The receipt line ID is already in use.");
  }
  return withChangedLines(review, [...review.lines, line]);
}

export function removeReceiptLine(
  review: ReceiptReviewDraft,
  lineId: StableId,
): ReceiptReviewDraft {
  const lines = review.lines.filter((line) => line.id !== lineId).map((line) =>
    line.type === "adjustment" && line.lineId === lineId
      ? { ...line, lineId: undefined }
      : line
  );
  return withChangedLines(
    review,
    lines,
  );
}

export function editReceiptParent(
  review: ReceiptReviewDraft,
  parent: ReceiptReviewDraft["parent"],
): ReceiptReviewDraft {
  return validateReceiptReviewDraft({ ...review, parent });
}

export function toDurableReceiptReview(
  review: ReceiptReviewDraft,
  revision: number,
): DurableReceiptReviewSnapshot {
  const validated = validateReceiptReviewDraft(review);
  return {
    version: 1,
    kind: "receipt-review",
    revision,
    review: validated,
  };
}

export function parseDurableReceiptReview(
  value: unknown,
): DurableReceiptReviewSnapshot {
  const parsed = DurableReceiptReviewSnapshotSchema.safeParse(value);
  if (!parsed.success) throw new ReceiptDomainError("corrupt-data");
  return {
    ...parsed.data,
    review: validateReceiptReviewDraft(parsed.data.review),
  };
}
