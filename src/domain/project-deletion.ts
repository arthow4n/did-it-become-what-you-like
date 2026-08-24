import {
  type JsonObject,
  type JsonValue,
  type LocalPort,
} from "../adapters/ports/index.ts";
import {
  createCanonicalExport,
  serializeCanonicalExport,
} from "./import-export/index.ts";
import {
  CURRENT_SCHEMA_VERSION,
  DATASET_FORMAT,
  type Expense,
  parseCurrentDataset,
  type PortableDataset,
  type Project,
  type ReceiptAdjustment,
  type ReceiptParent,
  type ReceiptPurchaseLine,
  StableIdSchema,
  type Tombstone,
  TombstoneSchema,
  UNCATEGORIZED_CATEGORY_ID,
} from "./index.ts";

const PROJECT_ORGANIZATION_SETTINGS_KEY =
  "project-category-organization" as const;
const LOCAL_DEVICE_ID = "device-local";

type ProjectOrganizationSettings = {
  readonly orderedProjectIds: readonly string[];
  readonly lastSelectedProjectId?: string;
};

export type ProjectDeletionTarget = {
  readonly projectId: string;
  readonly projectName: string;
  readonly expenseCount: number;
  readonly receiptCount: number;
};

export type ProjectDeletionPreview = {
  readonly target: ProjectDeletionTarget;
  readonly project: Project;
  readonly expenseCount: number;
  readonly receiptCount: number;
  readonly purchaseLineCount: number;
  readonly adjustmentCount: number;
  readonly currencies: readonly string[];
  readonly dateRange: {
    readonly from: string;
    readonly to: string;
  } | null;
  readonly current: boolean;
};

export type ProjectDeletionErrorCode =
  | "not-found"
  | "current-project"
  | "last-active-project"
  | "not-populated"
  | "corrupt-data"
  | "invalid";

export class ProjectDeletionError extends Error {
  override readonly name = "ProjectDeletionError";
  readonly code: ProjectDeletionErrorCode;
  readonly retryable = false;

  constructor(code: ProjectDeletionErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

export type ProjectDeletionService = {
  preview(projectId: string): Promise<ProjectDeletionPreview>;
  exportSafety(target: ProjectDeletionTarget): Promise<string>;
  commit(target: ProjectDeletionTarget): Promise<{
    readonly projectId: string;
    readonly tombstoneCount: number;
  }>;
};

function asObject(value: unknown): JsonObject | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as JsonObject
    : undefined;
}

function asStringArray(value: unknown): readonly string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function parseOrganizationSettings(
  value: JsonValue | undefined,
): ProjectOrganizationSettings {
  const object = asObject(value);
  if (object === undefined) return { orderedProjectIds: [] };
  const lastSelectedProjectId = typeof object.lastSelectedProjectId === "string"
    ? object.lastSelectedProjectId
    : undefined;
  return {
    orderedProjectIds: asStringArray(object.orderedProjectIds),
    ...(lastSelectedProjectId === undefined ? {} : { lastSelectedProjectId }),
  };
}

function portableDatasetFromEntries(
  entries: readonly { readonly value: JsonValue }[],
): PortableDataset {
  const groups: Record<string, JsonValue[]> = {
    projects: [],
    categories: [],
    expenses: [],
    receipts: [],
    receiptPurchaseLines: [],
    receiptAdjustments: [],
    devices: [],
    tombstones: [],
    retirementMarkers: [],
    revisions: [],
  };
  let settings: JsonValue | undefined;
  for (const entry of entries) {
    const object = asObject(entry.value);
    const type = object?.type;
    if (type === "portable-settings") {
      settings = entry.value;
      continue;
    }
    const group = type === "project"
      ? "projects"
      : type === "category"
      ? "categories"
      : type === "expense"
      ? "expenses"
      : type === "receipt"
      ? "receipts"
      : type === "receipt-purchase-line"
      ? "receiptPurchaseLines"
      : type === "receipt-adjustment"
      ? "receiptAdjustments"
      : type === "device"
      ? "devices"
      : type === "tombstone"
      ? "tombstones"
      : type === "retirement-marker"
      ? "retirementMarkers"
      : type === "revision"
      ? "revisions"
      : undefined;
    if (group !== undefined) groups[group].push(entry.value);
  }
  if (
    !groups.categories.some((value) =>
      asObject(value)?.id === UNCATEGORIZED_CATEGORY_ID
    )
  ) {
    groups.categories.push({
      schemaVersion: CURRENT_SCHEMA_VERSION,
      type: "category",
      id: UNCATEGORIZED_CATEGORY_ID,
      name: "Uncategorized",
      sortOrder: 0,
      archived: false,
      system: true,
    });
  }
  if (settings === undefined) {
    settings = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      type: "portable-settings",
      id: "settings-portable",
      expenseDayBoundary: "03:00",
    };
  }
  try {
    return parseCurrentDataset({
      schemaVersion: CURRENT_SCHEMA_VERSION,
      format: DATASET_FORMAT,
      ...groups,
      settings,
    });
  } catch {
    throw new ProjectDeletionError(
      "corrupt-data",
      "The local dataset could not be validated.",
    );
  }
}

async function readDataset(local: LocalPort): Promise<PortableDataset> {
  const entries = await local.query<JsonValue>("records", {});
  return portableDatasetFromEntries(entries);
}

async function readOrganizationSettings(
  local: LocalPort,
): Promise<ProjectOrganizationSettings> {
  return await local.transaction(
    "readonly",
    async (transaction) =>
      parseOrganizationSettings(
        await transaction.get<JsonValue>(
          "settings",
          PROJECT_ORGANIZATION_SETTINGS_KEY,
        ),
      ),
  );
}

function activeProjectIds(
  projects: readonly Project[],
  settings: ProjectOrganizationSettings,
): readonly string[] {
  const active = new Set(
    projects.filter((project) => !project.archived).map((project) =>
      project.id
    ),
  );
  const ordered = settings.orderedProjectIds.filter((id) => active.has(id));
  return [
    ...ordered,
    ...projects
      .filter((project) => !project.archived && !ordered.includes(project.id))
      .map((project) => project.id),
  ];
}

function currentProjectId(
  projects: readonly Project[],
  settings: ProjectOrganizationSettings,
): string | undefined {
  const active = new Set(
    projects.filter((project) => !project.archived).map((project) =>
      project.id
    ),
  );
  return settings.lastSelectedProjectId !== undefined &&
      active.has(settings.lastSelectedProjectId)
    ? settings.lastSelectedProjectId
    : activeProjectIds(projects, settings)[0];
}

function projectRecords(dataset: PortableDataset, projectId: string): {
  readonly project: Project | undefined;
  readonly expenses: readonly Expense[];
  readonly receipts: readonly ReceiptParent[];
  readonly purchaseLines: readonly ReceiptPurchaseLine[];
  readonly adjustments: readonly ReceiptAdjustment[];
} {
  return {
    project: dataset.projects.find((project) => project.id === projectId),
    expenses: dataset.expenses.filter((expense) =>
      expense.projectId === projectId
    ),
    receipts: dataset.receipts.filter((receipt) =>
      receipt.projectId === projectId
    ),
    purchaseLines: dataset.receiptPurchaseLines.filter((line) =>
      line.projectId === projectId
    ),
    adjustments: dataset.receiptAdjustments.filter((adjustment) =>
      adjustment.projectId === projectId
    ),
  };
}

function ensureDeletionAllowed(
  dataset: PortableDataset,
  settings: ProjectOrganizationSettings,
  projectId: string,
): ProjectDeletionPreview {
  const records = projectRecords(dataset, projectId);
  if (records.project === undefined) {
    throw new ProjectDeletionError(
      "not-found",
      "The project could not be found.",
    );
  }
  const activeIds = activeProjectIds(dataset.projects, settings);
  const current = currentProjectId(dataset.projects, settings) === projectId;
  if (current) {
    throw new ProjectDeletionError(
      "current-project",
      "Switch to another active project before deleting this project.",
    );
  }
  if (!records.project.archived && activeIds.length <= 1) {
    throw new ProjectDeletionError(
      "last-active-project",
      "At least one active project must remain.",
    );
  }
  if (
    records.expenses.length === 0 && records.receipts.length === 0 &&
    records.purchaseLines.length === 0 && records.adjustments.length === 0
  ) {
    throw new ProjectDeletionError(
      "not-populated",
      "This workflow is only for populated projects.",
    );
  }
  const currencies = [
    ...new Set([
      ...records.expenses.map((expense) => expense.currency),
      ...records.receipts.map((receipt) => receipt.currency),
    ]),
  ].sort();
  const dates = [
    ...records.expenses.map((expense) => expense.date),
    ...records.receipts.map((receipt) => receipt.date),
  ].sort();
  return {
    target: {
      projectId,
      projectName: records.project.name,
      expenseCount: records.expenses.length,
      receiptCount: records.receipts.length,
    },
    project: records.project,
    expenseCount: records.expenses.length,
    receiptCount: records.receipts.length,
    purchaseLineCount: records.purchaseLines.length,
    adjustmentCount: records.adjustments.length,
    currencies,
    dateRange: dates.length === 0
      ? null
      : { from: dates[0]!, to: dates[dates.length - 1]! },
    current,
  };
}

function tombstoneId(targetType: string, targetId: string): string {
  return StableIdSchema.parse(`tombstone-${targetType}-${targetId}`);
}

function createRecordTombstone(
  targetType: Tombstone["targetType"],
  targetId: string,
  deletedAt: string,
  deletedBy: string,
): Tombstone {
  return TombstoneSchema.parse({
    schemaVersion: CURRENT_SCHEMA_VERSION,
    type: "tombstone",
    id: tombstoneId(targetType, targetId),
    targetType,
    targetId,
    deletedAt,
    deletedBy,
  });
}

export function createProjectDeletionService(
  local: LocalPort,
  options: {
    readonly now?: () => string;
    readonly deviceId?: string;
  } = {},
): ProjectDeletionService {
  const now = options.now ?? (() => new Date().toISOString());
  const deviceId = StableIdSchema.parse(options.deviceId ?? LOCAL_DEVICE_ID);

  const preview = async (
    projectId: string,
  ): Promise<ProjectDeletionPreview> => {
    const [dataset, settings] = await Promise.all([
      readDataset(local),
      readOrganizationSettings(local),
    ]);
    return ensureDeletionAllowed(dataset, settings, projectId);
  };

  const exportSafety = async (
    target: ProjectDeletionTarget,
  ): Promise<string> => {
    const dataset = await readDataset(local);
    const settings = await readOrganizationSettings(local);
    ensureDeletionAllowed(dataset, settings, target.projectId);
    return serializeCanonicalExport(createCanonicalExport({
      dataset,
      generation: 1,
      heads: [],
      changes: [],
      exportedAt: now(),
    }));
  };

  const commit = async (target: ProjectDeletionTarget) => {
    return await local.transaction("readwrite", async (transaction) => {
      const dataset = portableDatasetFromEntries(
        await transaction.query<JsonValue>("records", {}),
      );
      const settings = parseOrganizationSettings(
        await transaction.get<JsonValue>(
          "settings",
          PROJECT_ORGANIZATION_SETTINGS_KEY,
        ),
      );
      ensureDeletionAllowed(
        dataset,
        settings,
        target.projectId,
      );
      const records = projectRecords(dataset, target.projectId);
      const deletedAt = now();
      const related: readonly {
        readonly type: Tombstone["targetType"];
        readonly id: string;
      }[] = [
        { type: "project", id: records.project!.id },
        ...records.expenses.map((record) => ({
          type: "expense" as const,
          id: record.id,
        })),
        ...records.receipts.map((record) => ({
          type: "receipt" as const,
          id: record.id,
        })),
        ...records.purchaseLines.map((record) => ({
          type: "receipt-purchase-line" as const,
          id: record.id,
        })),
        ...records.adjustments.map((record) => ({
          type: "receipt-adjustment" as const,
          id: record.id,
        })),
      ];
      for (const record of related) {
        await transaction.delete("records", record.id);
        const tombstone = createRecordTombstone(
          record.type,
          record.id,
          deletedAt,
          deviceId,
        );
        await transaction.put("records", tombstone.id, tombstone as JsonValue);
      }
      const nextOrder = activeProjectIds(dataset.projects, settings).filter((
        id,
      ) => id !== target.projectId);
      const nextSelected = settings.lastSelectedProjectId === target.projectId
        ? nextOrder[0]
        : settings.lastSelectedProjectId;
      await transaction.put(
        "settings",
        PROJECT_ORGANIZATION_SETTINGS_KEY,
        {
          orderedProjectIds: nextOrder,
          ...(nextSelected === undefined
            ? {}
            : { lastSelectedProjectId: nextSelected }),
        },
      );
      return {
        projectId: target.projectId,
        tombstoneCount: related.length,
      };
    });
  };

  return { preview, exportSafety, commit };
}
