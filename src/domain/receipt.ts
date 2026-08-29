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
  UNCATEGORIZED_CATEGORY_ID,
} from "./schema/index.ts";
import { moneyAdd, moneyCompare, moneySubtract } from "./money/index.ts";
import type {
  OrganizationJsonValue,
  OrganizationStore,
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
};

export type ReceiptErrorCode =
  | "invalid"
  | "mismatch"
  | "not-found"
  | "conflict"
  | "corrupt-data";

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

/** Receipt purchases and their parent total are outgoing amounts. */
function ensureOutflowSign(value: CanonicalDecimal): CanonicalDecimal {
  return moneyCompare(value, "0") > 0 ? moneySubtract("0", value) : value;
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
      };
    }
    return {
      ...line,
      description,
      ...(line.selectionReason === undefined
        ? {}
        : { selectionReason: line.selectionReason.trim() }),
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
    const amount = parseDecimal(rawLine.amount);
    const reason = modelReason ??
      (categoryIssue ? "The category suggestion was unavailable." : undefined);
    const invalidLine = kind === undefined || amount === undefined ||
      description.length === 0;
    const selected = rawLine.selected === true && !invalidLine &&
      reason === undefined;
    const uncertain = Boolean(reason) || invalidLine;
    const selectionReason = reason ??
      (invalidLine
        ? "Correct this incomplete line before selecting it."
        : undefined);
    const id = input.nextId();
    if (kind === "adjustment") {
      lines.push({
        type: "adjustment",
        id,
        description,
        categoryId,
        amount: amount ?? "0",
        selected,
        uncertain,
        ...(selectionReason === undefined ? {} : { selectionReason }),
      });
    } else {
      lines.push({
        type: "purchase",
        id,
        description,
        categoryId,
        lineTotal: ensureOutflowSign(amount ?? "0"),
        selected,
        uncertain,
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
  readonly ids: ReadonlySet<string>;
} {
  const projects: Project[] = [];
  const categories: ReturnType<typeof CategorySchema.parse>[] = [];
  const ids = new Set<string>();
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
    }
  }
  return { projects, categories, ids };
}

function defaultReceiptId(kind: "receipt" | "line"): StableId {
  const suffix = globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random()}`;
  return StableIdSchema.parse(`${kind}-${suffix}`);
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
        const categoryIds = new Set(
          parsed.categories.map((category) => category.id),
        );
        for (const line of selected) {
          if (!categoryIds.has(line.categoryId)) {
            throw new ReceiptDomainError("not-found");
          }
        }
        const receiptId = nextId("receipt");
        if (parsed.ids.has(receiptId)) throw new ReceiptDomainError("conflict");
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
          if (used.has(line.id)) throw new ReceiptDomainError("conflict");
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
