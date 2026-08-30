import { z } from "zod";
import {
  type CalendarDate,
  CalendarDateSchema,
  type CanonicalDecimal,
  canonicalDecimal,
  CanonicalDecimalSchema,
  CategorySchema,
  type CurrencyCode,
  CurrencyCodeSchema,
  CURRENT_SCHEMA_VERSION,
  type Expense,
  ExpenseSchema,
  OptionalTextSchema,
  type Project,
  ProjectSchema,
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
} from "./schema/index.ts";
import { moneyAdd, moneyCompare, moneySubtract } from "./money/index.ts";
import type {
  OrganizationJsonValue,
  OrganizationStore,
  OrganizationTransaction,
} from "./organization.ts";

/**
 * Structured receipt data is the only data a review actor may persist. The
 * source image is intentionally absent from these types and schemas.
 */
export type ReceiptDraftLine =
  | {
    readonly type: "purchase";
    readonly id: StableId;
    readonly description: string;
    readonly categoryId: StableId;
    readonly quantity?: CanonicalDecimal;
    readonly unitPrice?: CanonicalDecimal;
    readonly lineTotal: CanonicalDecimal;
    readonly selected: boolean;
    readonly uncertain: boolean;
    readonly selectionReason?: string;
    readonly classificationReason?: string;
  }
  | {
    readonly type: "adjustment";
    readonly id: StableId;
    readonly description: string;
    readonly categoryId: StableId;
    readonly amount: CanonicalDecimal;
    readonly lineId?: StableId;
    readonly selected: boolean;
    readonly uncertain: boolean;
    readonly selectionReason?: string;
    readonly classificationReason?: string;
  };

export type ReceiptReviewDraft = {
  readonly parent: Omit<ReceiptParent, "id" | "schemaVersion" | "type">;
  readonly lines: readonly ReceiptDraftLine[];
  readonly uncertainty: readonly string[];
  readonly printedTotalMismatch: boolean;
  readonly mismatchDifference?: CanonicalDecimal;
  readonly mismatchExplanation?: string;
};

export type ReceiptExtractionDraftLike = {
  readonly merchant?: unknown;
  readonly currency?: unknown;
  readonly date?: unknown;
  readonly printedTotal?: unknown;
  readonly lines?: unknown;
  readonly uncertainty?: unknown;
  readonly mismatches?: unknown;
};

export type ReceiptReviewInput = {
  readonly projectId: StableId;
  readonly currency: CurrencyCode;
  readonly categoryCatalogue: readonly {
    readonly id: StableId;
    readonly name: string;
  }[];
  readonly nextId: () => StableId;
};

export type ReceiptCommitResult = {
  readonly receipt: ReceiptParent;
  readonly purchaseLines: readonly ReceiptPurchaseLine[];
  readonly adjustments: readonly ReceiptAdjustment[];
};

export type ReceiptCommitRequest = {
  readonly review: ReceiptReviewDraft;
  readonly confirmMismatch: boolean;
};

export type ReceiptIdGenerator = (kind: "receipt" | "line") => StableId;

export type ReceiptServiceOptions = {
  readonly nextId?: ReceiptIdGenerator;
  readonly now?: () => string;
  readonly deviceId?: StableId;
};

export type ReceiptErrorCode =
  | "invalid"
  | "mismatch"
  | "not-found"
  | "conflict"
  | "corrupt-data";

export type ReceiptAggregate = {
  readonly receipt: ReceiptParent;
  readonly purchaseLines: readonly ReceiptPurchaseLine[];
  readonly adjustments: readonly ReceiptAdjustment[];
  readonly derivedExpenses: readonly Expense[];
};

export type ReceiptMetadataChanges = {
  readonly merchant?: string | null;
  readonly date?: CalendarDate;
  readonly time?: string | null;
  readonly printedTotal?: string;
};

export type ReceiptPurchaseLineChanges = {
  readonly type: "purchase";
  readonly description: string;
  readonly categoryId: StableId;
  readonly quantity?: string | null;
  readonly unitPrice?: string | null;
  readonly lineTotal: string;
};

export type ReceiptAdjustmentChanges = {
  readonly type: "adjustment";
  readonly description: string;
  readonly categoryId: StableId;
  readonly amount: string;
  readonly lineId?: StableId | null;
};

export type ReceiptLineChanges =
  | ReceiptPurchaseLineChanges
  | ReceiptAdjustmentChanges;

export type ReceiptMutationResult = {
  readonly aggregate?: ReceiptAggregate;
  readonly deletedReceipt: boolean;
  readonly deletedLineId?: StableId;
};

const RECEIPT_ERROR_MESSAGES: Readonly<Record<ReceiptErrorCode, string>> = {
  invalid: "The receipt review is invalid.",
  mismatch: "Confirm the printed-total mismatch before saving.",
  "not-found": "The receipt project or category is no longer available.",
  conflict: "A receipt record with the same identity already exists.",
  "corrupt-data": "Stored receipt data is invalid or corrupt.",
};

export class ReceiptDomainError extends Error {
  override readonly name = "ReceiptDomainError";
  readonly retryable = false;

  constructor(
    readonly code: ReceiptErrorCode,
    message?: string,
  ) {
    super(message ?? RECEIPT_ERROR_MESSAGES[code]);
  }
}

export function isReceiptDomainError(
  error: unknown,
): error is ReceiptDomainError {
  return error instanceof ReceiptDomainError;
}

const DraftParentSchema = z.strictObject({
  projectId: StableIdSchema,
  date: CalendarDateSchema,
  time: TimeOfDaySchema.optional(),
  merchant: OptionalTextSchema,
  currency: CurrencyCodeSchema,
  printedTotal: CanonicalDecimalSchema,
});

const DraftPurchaseLineSchema = z.strictObject({
  type: z.literal("purchase"),
  id: StableIdSchema,
  description: z.string().max(500),
  categoryId: StableIdSchema,
  quantity: CanonicalDecimalSchema.optional(),
  unitPrice: CanonicalDecimalSchema.optional(),
  lineTotal: CanonicalDecimalSchema,
  selected: z.boolean(),
  uncertain: z.boolean(),
  selectionReason: z.string().trim().min(1).max(1_000).optional(),
  classificationReason: z.string().trim().min(1).max(500).optional(),
});

const DraftAdjustmentLineSchema = z.strictObject({
  type: z.literal("adjustment"),
  id: StableIdSchema,
  description: z.string().max(500),
  categoryId: StableIdSchema,
  amount: CanonicalDecimalSchema,
  lineId: StableIdSchema.optional(),
  selected: z.boolean(),
  uncertain: z.boolean(),
  selectionReason: z.string().trim().min(1).max(1_000).optional(),
  classificationReason: z.string().trim().min(1).max(500).optional(),
});

export const ReceiptReviewDraftSchema = z.strictObject({
  parent: DraftParentSchema,
  lines: z.array(z.discriminatedUnion("type", [
    DraftPurchaseLineSchema,
    DraftAdjustmentLineSchema,
  ])),
  uncertainty: z.array(z.string().trim().min(1).max(1_000)),
  printedTotalMismatch: z.boolean(),
  mismatchDifference: CanonicalDecimalSchema.optional(),
  mismatchExplanation: z.string().trim().min(1).max(1_000).optional(),
});

export type DurableReceiptReviewSnapshot = {
  readonly version: 1;
  readonly kind: "receipt-review";
  readonly revision: number;
  readonly review: ReceiptReviewDraft;
};

export const DurableReceiptReviewSnapshotSchema = z.strictObject({
  version: z.literal(1),
  kind: z.literal("receipt-review"),
  revision: z.number().int().nonnegative(),
  review: ReceiptReviewDraftSchema,
});

function asOrganizationJsonValue(value: unknown): OrganizationJsonValue {
  return value as OrganizationJsonValue;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

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

/** Receipt purchases and their parent total are outgoing amounts. */
function ensureOutflowSign(value: CanonicalDecimal): CanonicalDecimal {
  return moneyCompare(value, "0") > 0 ? moneySubtract("0", value) : value;
}

/** Receipt credits and other inflows are positive ledger amounts. */
function ensureInflowSign(value: CanonicalDecimal): CanonicalDecimal {
  return moneyCompare(value, "0") < 0 ? moneySubtract("0", value) : value;
}

function normalizeExtractedAmount(
  value: CanonicalDecimal,
  direction: "outflow" | "inflow" | undefined,
): CanonicalDecimal {
  if (direction === "inflow") return ensureInflowSign(value);
  if (direction === "outflow") return ensureOutflowSign(value);
  return value;
}

const BOTTLE_DEPOSIT_CHARGE_PATTERN =
  /\b(?:pant(?:\s+burk)?|bottle\s+deposit)\b/i;
const BOTTLE_DEPOSIT_RETURN_PATTERN =
  /\b(?:retur|åter|återbetalning|refund|return)\b/i;

/**
 * A positive deposit printed with purchased goods is a charge, not a refund.
 * Keep this correction deliberately narrow: explicit return/refund evidence or
 * a printed negative amount remains an inflow.
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
    direction !== "inflow" ||
    amount === undefined ||
    moneyCompare(amount, "0") < 0 ||
    !BOTTLE_DEPOSIT_CHARGE_PATTERN.test(description) ||
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

function lineTotal(line: ReceiptDraftLine): CanonicalDecimal {
  return line.type === "purchase"
    ? ensureOutflowSign(line.lineTotal)
    : line.amount;
}

function receiptTotalWithLineDirection(
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

function mismatchFields(
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
        ...line,
        description,
        lineTotal: ensureOutflowSign(line.lineTotal),
        ...(line.selectionReason === undefined
          ? {}
          : { selectionReason: line.selectionReason.trim() }),
        ...(line.classificationReason === undefined
          ? {}
          : { classificationReason: line.classificationReason.trim() }),
      };
    }
    return {
      ...line,
      description,
      ...(line.selectionReason === undefined
        ? {}
        : { selectionReason: line.selectionReason.trim() }),
      ...(line.classificationReason === undefined
        ? {}
        : { classificationReason: line.classificationReason.trim() }),
    };
  });
  const parent = {
    ...review.parent,
    printedTotal: receiptTotalWithLineDirection(
      review.parent.printedTotal,
      lines,
    ),
  };
  const mismatch = mismatchFields(parent, lines, review.mismatchExplanation);
  return {
    parent: {
      ...parent,
      ...(parent.merchant === undefined
        ? {}
        : { merchant: parent.merchant.trim() }),
    },
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
  const date = typeof value.date === "string" ? value.date.trim() : "";
  const printedTotal = parseDecimal(value.printedTotal);
  if (!CurrencyCodeSchema.safeParse(currency).success) {
    invalid("Receipt extraction returned an invalid currency.");
  }
  if (!CalendarDateSchema.safeParse(date).success) {
    invalid("Receipt extraction returned an invalid date.");
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
  const lines: ReceiptDraftLine[] = [];
  for (const rawLine of value.lines) {
    if (!isRecord(rawLine)) {
      lines.push({
        type: "purchase",
        id: input.nextId(),
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
    // Purchases are always ledger outflows even if an untrusted boundary
    // contradicts the contract; keep the line safe while marking it invalid.
    const normalizationDirection = kind === "purchase" ? "outflow" : direction;
    const reason = modelReason ??
      (categoryIssue ? "The category suggestion was unavailable." : undefined);
    const invalidLine = kind === undefined || amount === undefined ||
      direction === undefined || directionMismatch ||
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
    const id = input.nextId();
    if (kind === "adjustment") {
      lines.push({
        type: "adjustment",
        id,
        description,
        categoryId,
        amount: normalizedAmount,
        selected,
        uncertain,
        ...(classificationReason === undefined ? {} : { classificationReason }),
        ...(selectionReason === undefined ? {} : { selectionReason }),
      });
    } else {
      lines.push({
        type: "purchase",
        id,
        description,
        categoryId,
        lineTotal: normalizedAmount,
        selected,
        uncertain,
        ...(classificationReason === undefined ? {} : { classificationReason }),
        ...(selectionReason === undefined ? {} : { selectionReason }),
      });
    }
  }
  const uncertainty = [
    ...value.uncertainty.map((item) => item.trim()).filter(Boolean),
    ...value.mismatches.map((item) => item.trim()).filter(Boolean),
  ];
  return validateReceiptReviewDraft({
    parent: {
      projectId: input.projectId,
      date: date as CalendarDate,
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
  return withChangedLines(
    review,
    review.lines.map((line) =>
      line.id === lineId ? { ...line, selected } : line
    ),
  );
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
  return withChangedLines(
    {
      ...review,
      lines: review.lines.map((line) =>
        line.type === "adjustment" && line.lineId === lineId
          ? { ...line, lineId: undefined }
          : line
      ),
    },
    review.lines.filter((line) => line.id !== lineId),
  );
}

export function editReceiptParent(
  review: ReceiptReviewDraft,
  parent: ReceiptReviewDraft["parent"],
): ReceiptReviewDraft {
  return validateReceiptReviewDraft({ ...review, parent });
}

function moneySum(values: readonly CanonicalDecimal[]): CanonicalDecimal {
  return values.length === 0 ? "0" : moneyAdd(values[0], ...values.slice(1));
}

function parsedRecords(
  entries: readonly { readonly value: OrganizationJsonValue }[],
): {
  readonly projects: readonly Project[];
  readonly categories: readonly ReturnType<typeof CategorySchema.parse>[];
  readonly expenses: readonly Expense[];
  readonly receipts: readonly ReceiptParent[];
  readonly purchaseLines: readonly ReceiptPurchaseLine[];
  readonly adjustments: readonly ReceiptAdjustment[];
  readonly tombstones: readonly ReturnType<typeof TombstoneSchema.parse>[];
  readonly ids: ReadonlySet<string>;
  readonly tombstonedIds: ReadonlySet<string>;
} {
  const projects: Project[] = [];
  const categories: ReturnType<typeof CategorySchema.parse>[] = [];
  const expenses: Expense[] = [];
  const receipts: ReceiptParent[] = [];
  const purchaseLines: ReceiptPurchaseLine[] = [];
  const adjustments: ReceiptAdjustment[] = [];
  const tombstones: ReturnType<typeof TombstoneSchema.parse>[] = [];
  const ids = new Set<string>();
  const tombstonedIds = new Set<string>();
  for (const entry of entries) {
    if (!isRecord(entry.value) || typeof entry.value.type !== "string") {
      continue;
    }
    if (typeof entry.value.id === "string") {
      if (ids.has(entry.value.id)) throw new ReceiptDomainError("corrupt-data");
      ids.add(entry.value.id);
    }
    if (entry.value.type === "project") {
      try {
        projects.push(ProjectSchema.parse(entry.value));
      } catch {
        throw new ReceiptDomainError("corrupt-data");
      }
    } else if (entry.value.type === "category") {
      try {
        categories.push(CategorySchema.parse(entry.value));
      } catch {
        throw new ReceiptDomainError("corrupt-data");
      }
    } else if (entry.value.type === "expense") {
      try {
        expenses.push(ExpenseSchema.parse(entry.value));
      } catch {
        throw new ReceiptDomainError("corrupt-data");
      }
    } else if (entry.value.type === "receipt") {
      try {
        receipts.push(ReceiptParentSchema.parse(entry.value));
      } catch {
        throw new ReceiptDomainError("corrupt-data");
      }
    } else if (entry.value.type === "receipt-purchase-line") {
      try {
        purchaseLines.push(ReceiptPurchaseLineSchema.parse(entry.value));
      } catch {
        throw new ReceiptDomainError("corrupt-data");
      }
    } else if (entry.value.type === "receipt-adjustment") {
      try {
        adjustments.push(ReceiptAdjustmentSchema.parse(entry.value));
      } catch {
        throw new ReceiptDomainError("corrupt-data");
      }
    } else if (entry.value.type === "tombstone") {
      try {
        const tombstone = TombstoneSchema.parse(entry.value);
        tombstones.push(tombstone);
        tombstonedIds.add(tombstone.targetId);
      } catch {
        throw new ReceiptDomainError("corrupt-data");
      }
    }
  }
  return {
    projects,
    categories,
    expenses,
    receipts,
    purchaseLines,
    adjustments,
    tombstones,
    ids,
    tombstonedIds,
  };
}

function defaultReceiptId(kind: "receipt" | "line"): StableId {
  const suffix = globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random()}`;
  return StableIdSchema.parse(`${kind}-${suffix}`);
}

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

type ReceiptParsedRecords = ReturnType<typeof parsedRecords>;

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

export function receiptLineAmount(line: ReceiptLine): CanonicalDecimal {
  return "lineTotal" in line ? line.lineTotal : line.amount;
}
