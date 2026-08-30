import { z } from "zod";
import {
  CalendarDateSchema,
  CanonicalDecimalSchema,
  CurrencyCodeSchema,
  CURRENT_SCHEMA_VERSION,
  InstantSchema,
  NonEmptyTextSchema,
  OptionalTextSchema,
  PositiveIntegerSchema,
  RevisionNumberSchema,
  StableIdSchema,
  TimeOfDaySchema,
  UNCATEGORIZED_CATEGORY_ID,
} from "./primitives.ts";

const RecordVersion = z.literal(CURRENT_SCHEMA_VERSION);

function recordBase(type: string) {
  return {
    schemaVersion: RecordVersion,
    type: z.literal(type),
    id: StableIdSchema,
  };
}

export const ProjectSchema = z.object({
  ...recordBase("project"),
  name: NonEmptyTextSchema.max(120),
  defaultCurrency: CurrencyCodeSchema,
  archived: z.boolean(),
}).strict();
export type Project = z.infer<typeof ProjectSchema>;

export const CategorySchema = z.object({
  ...recordBase("category"),
  name: NonEmptyTextSchema.max(120),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  sortOrder: z.number().int().nonnegative(),
  archived: z.boolean(),
  system: z.boolean(),
}).strict().superRefine((category, ctx) => {
  if (category.system) {
    if (category.id !== UNCATEGORIZED_CATEGORY_ID) {
      ctx.addIssue({
        code: "custom",
        path: ["id"],
        message: "the only system category is Uncategorized",
      });
    }
    if (category.name !== "Uncategorized") {
      ctx.addIssue({
        code: "custom",
        path: ["name"],
        message: "the system category must be named Uncategorized",
      });
    }
    if (category.archived) {
      ctx.addIssue({
        code: "custom",
        path: ["archived"],
        message: "Uncategorized cannot be archived",
      });
    }
  }
  if (category.id === UNCATEGORIZED_CATEGORY_ID && !category.system) {
    ctx.addIssue({
      code: "custom",
      path: ["system"],
      message: "Uncategorized must be the system category",
    });
  }
});
export type Category = z.infer<typeof CategorySchema>;

const ExpenseSourceSchema = z.enum(["manual", "receipt-line", "adjustment"]);

export const ExpenseSchema = z.object({
  ...recordBase("expense"),
  projectId: StableIdSchema,
  categoryId: StableIdSchema,
  date: CalendarDateSchema,
  time: TimeOfDaySchema.optional(),
  amount: CanonicalDecimalSchema,
  currency: CurrencyCodeSchema,
  merchant: OptionalTextSchema,
  description: z.string().trim().max(500),
  source: ExpenseSourceSchema,
  receiptId: StableIdSchema.optional(),
  receiptLineId: StableIdSchema.optional(),
}).strict().superRefine((expense, ctx) => {
  if (expense.source === "manual" && expense.receiptId) {
    ctx.addIssue({
      code: "custom",
      path: ["receiptId"],
      message: "manual expenses cannot reference a receipt",
    });
  }
  if (expense.source !== "manual" && !expense.receiptId) {
    ctx.addIssue({
      code: "custom",
      path: ["receiptId"],
      message: "receipt expenses must reference a receipt",
    });
  }
});
export type Expense = z.infer<typeof ExpenseSchema>;

export const ReceiptParentSchema = z.object({
  ...recordBase("receipt"),
  projectId: StableIdSchema,
  date: CalendarDateSchema,
  time: TimeOfDaySchema.optional(),
  merchant: OptionalTextSchema,
  currency: CurrencyCodeSchema,
  printedTotal: CanonicalDecimalSchema,
}).strict();
export type ReceiptParent = z.infer<typeof ReceiptParentSchema>;

export const ReceiptPurchaseLineSchema = z.object({
  ...recordBase("receipt-purchase-line"),
  receiptId: StableIdSchema,
  projectId: StableIdSchema,
  categoryId: StableIdSchema,
  description: NonEmptyTextSchema,
  quantity: CanonicalDecimalSchema.optional(),
  unitPrice: CanonicalDecimalSchema.optional(),
  lineTotal: CanonicalDecimalSchema,
}).strict();
export type ReceiptPurchaseLine = z.infer<typeof ReceiptPurchaseLineSchema>;

export const ReceiptAdjustmentSchema = z.object({
  ...recordBase("receipt-adjustment"),
  receiptId: StableIdSchema,
  projectId: StableIdSchema,
  categoryId: StableIdSchema,
  description: NonEmptyTextSchema,
  amount: CanonicalDecimalSchema,
  lineId: StableIdSchema.optional(),
}).strict();
export type ReceiptAdjustment = z.infer<typeof ReceiptAdjustmentSchema>;

export const ReceiptLineSchema = z.discriminatedUnion("type", [
  ReceiptPurchaseLineSchema,
  ReceiptAdjustmentSchema,
]);
export type ReceiptLine = z.infer<typeof ReceiptLineSchema>;

export const DeviceSchema = z.object({
  ...recordBase("device"),
  label: OptionalTextSchema,
  createdAt: InstantSchema,
  lastSeenAt: InstantSchema,
}).strict();
export type Device = z.infer<typeof DeviceSchema>;

export const RecordTypeSchema = z.enum([
  "project",
  "category",
  "expense",
  "receipt",
  "receipt-purchase-line",
  "receipt-adjustment",
  "device",
  "portable-settings",
]);
export type RecordType = z.infer<typeof RecordTypeSchema>;

export const TombstoneSchema = z.object({
  ...recordBase("tombstone"),
  targetType: RecordTypeSchema,
  targetId: StableIdSchema,
  deletedAt: InstantSchema,
  deletedBy: StableIdSchema,
  replacementCategoryId: StableIdSchema.optional(),
  generation: PositiveIntegerSchema.optional(),
}).strict();
export type Tombstone = z.infer<typeof TombstoneSchema>;

export const RetirementMarkerSchema = z.object({
  ...recordBase("retirement-marker"),
  generation: PositiveIntegerSchema,
  retiredAt: InstantSchema,
  retiredBy: StableIdSchema,
  reason: NonEmptyTextSchema,
}).strict();
export type RetirementMarker = z.infer<typeof RetirementMarkerSchema>;

export const RevisionSchema = z.object({
  ...recordBase("revision"),
  targetType: RecordTypeSchema,
  targetId: StableIdSchema,
  revision: RevisionNumberSchema,
  deviceId: StableIdSchema,
  lamport: PositiveIntegerSchema,
  recordedAt: InstantSchema,
}).strict();
export type Revision = z.infer<typeof RevisionSchema>;

export const PortableSettingsSchema = z.object({
  ...recordBase("portable-settings"),
  expenseDayBoundary: z.string().regex(
    /^(?:[01]\d|2[0-3]):[0-5]\d$/,
    "must use HH:mm local time format",
  ),
}).strict();
export type PortableSettings = z.infer<typeof PortableSettingsSchema>;

export const ReceiptAiProviderSchema = z.enum(["gemini", "openrouter"]);
export type ReceiptAiProvider = z.infer<typeof ReceiptAiProviderSchema>;

export const DeviceLocalSettingsSchema = z.object({
  lastSelectedProjectId: StableIdSchema.optional(),
  activeProvider: ReceiptAiProviderSchema.default("gemini"),
  selectedGeminiModel: NonEmptyTextSchema.optional(),
  selectedOpenRouterModel: NonEmptyTextSchema.optional(),
  preferredProviderTag: NonEmptyTextSchema.optional(),
  requireZdr: z.boolean().default(false),
  denyProviderDataCollection: z.boolean().default(false),
  imagePreparationEnabled: z.boolean().default(true),
}).strict();
export type DeviceLocalSettings = z.infer<typeof DeviceLocalSettingsSchema>;

export const DEFAULT_DEVICE_LOCAL_SETTINGS: DeviceLocalSettings = {
  activeProvider: "gemini",
  requireZdr: false,
  denyProviderDataCollection: false,
  imagePreparationEnabled: true,
};

const DEVICE_LOCAL_SETTINGS_KEYS = [
  "lastSelectedProjectId",
  "activeProvider",
  "selectedGeminiModel",
  "selectedOpenRouterModel",
  "preferredProviderTag",
  "requireZdr",
  "denyProviderDataCollection",
  "imagePreparationEnabled",
] as const;

function recordFromUnknown(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

/**
 * Parses device-local settings while dropping fields from removed features.
 * This is intentionally separate from the strict schema so persisted legacy
 * settings cannot carry compatibility evidence, key revisions, or secrets
 * into active product state.
 */
export function parseDeviceLocalSettings(input: unknown): DeviceLocalSettings {
  const record = recordFromUnknown(input);
  const current: Record<string, unknown> = {};
  for (const key of DEVICE_LOCAL_SETTINGS_KEYS) {
    if (key in record) current[key] = record[key];
  }
  return DeviceLocalSettingsSchema.parse(current);
}
