import { assign, createActor, fromPromise, setup, type Snapshot } from "xstate";
import type {
  ContractFailure,
  ImportCommitOutput,
  ImportEvent,
  ImportOutput,
  ImportPreview,
} from "../contracts/index.ts";
import {
  type ExportResult,
  type ImportCommitRequest,
  type ImportExportAdapter,
  type ShareResult,
} from "../../adapters/import-export/index.ts";
import {
  type CanonicalExport,
  type CanonicalImportPreview,
  ImportExportDomainError,
} from "../../domain/import-export/index.ts";

export type ImportExportActorDependencies = {
  readonly adapter: ImportExportAdapter;
};

export type ImportActorContext = {
  readonly source: string | null;
  readonly preview: ImportPreview | null;
  readonly document: CanonicalExport | null;
  readonly mode: "merge" | "replace" | null;
  readonly driveConfigured: boolean;
  readonly online: boolean;
  readonly preSynced: boolean;
  readonly result: ImportCommitOutput | null;
  readonly error: ContractFailure | null;
};

type ValidatedImport = {
  readonly preview: ImportPreview;
  readonly document: CanonicalExport;
};

function previewForContract(
  preview: CanonicalImportPreview,
): ImportPreview {
  return {
    dataset: preview.document.dataset,
    schemaVersion: preview.sourceSchemaVersion,
    projectCount: preview.projectCount,
    categoryCount: preview.categoryCount,
    expenseCount: preview.expenseCount,
    receiptCount: preview.receiptCount,
    migrationRequired: preview.migrationRequired,
    changeCount: preview.changeCount,
    migrations: [...preview.migrations],
    warnings: [...preview.warnings],
    errors: [...preview.errors],
  };
}

function failure(
  error: unknown,
  fallback: ContractFailure,
): ContractFailure {
  if (error instanceof ImportExportDomainError) {
    return {
      code: error.code === "future-version" ? "unsupported" : "invalid",
      message: error.message,
      retryable: false,
    };
  }
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { readonly code?: unknown }).code;
    if (
      code === "offline" || code === "unavailable" || code === "unsupported" ||
      code === "aborted" || code === "conflict" || code === "quota" ||
      code === "corrupt-data" || code === "invalid-request"
    ) {
      return {
        code,
        message: fallback.message,
        retryable: code === "offline" || code === "unavailable" ||
          code === "quota",
      };
    }
  }
  return fallback;
}

export function createImportMachine(
  dependencies: ImportExportActorDependencies,
) {
  const machineSetup = setup({
    types: {
      context: {} as ImportActorContext,
      events: {} as ImportEvent,
      output: {} as ImportOutput,
    },
    actors: {
      validateImport: fromPromise(
        async ({ input }: { input: string }): Promise<ValidatedImport> => {
          const preview = dependencies.adapter.previewImport(input);
          await Promise.resolve();
          return {
            preview: previewForContract(preview),
            document: preview.document,
          };
        },
      ),
      synchronizeBeforeReplace: fromPromise(
        async ({ signal }: { signal: AbortSignal }): Promise<void> => {
          await dependencies.adapter.synchronizeBeforeReplace({ signal });
        },
      ),
      commitImport: fromPromise(
        async ({ input, signal }: {
          input: ImportCommitRequest;
          signal: AbortSignal;
        }): Promise<ImportCommitOutput> => {
          const result = await dependencies.adapter.commitImport(input, {
            signal,
          });
          return {
            mode: result.mode,
            generation: result.generation,
            conflictCount: result.conflictCount,
          };
        },
      ),
    },
    guards: {
      hasReplacePreSync: ({ context }) =>
        context.mode === "replace" && context.driveConfigured &&
        context.online,
      replacePreSyncOffline: ({ context }) =>
        context.mode === "replace" && context.driveConfigured &&
        !context.online,
      hasMode: ({ context }) => context.mode !== null,
      hasConflicts: ({ context }) => (context.result?.conflictCount ?? 0) > 0,
    },
  });

  return machineSetup.createMachine({
    id: "s404-import",
    initial: "idle",
    context: {
      source: null,
      preview: null,
      document: null,
      mode: null,
      driveConfigured: false,
      online: false,
      preSynced: false,
      result: null,
      error: null,
    },
    output: ({ context }) =>
      context.result === null
        ? { status: "cancelled" }
        : { status: "completed", result: context.result },
    states: {
      idle: {
        on: {
          "import.open": {
            target: "choosing",
            actions: assign({
              driveConfigured: ({ event }) => event.driveConfigured,
              online: ({ event }) => event.online,
              preSynced: () => false,
              error: () => null,
              result: () => null,
              mode: () => null,
              preview: () => null,
              document: () => null,
            }),
          },
        },
      },
      choosing: {
        tags: ["choosing"],
        on: {
          "import.file-selected": {
            target: "validating",
            actions: assign({
              source: ({ event }) => event.contents,
              error: () => null,
              result: () => null,
            }),
          },
          "import.cancel": "cancelled",
        },
      },
      validating: {
        tags: ["validating"],
        invoke: {
          src: "validateImport",
          input: ({ context }) => context.source ?? "",
          onDone: {
            target: "previewing",
            actions: assign({
              preview: ({ event }) => event.output.preview,
              document: ({ event }) => event.output.document,
              error: () => null,
            }),
          },
          onError: {
            target: "failed",
            actions: assign({
              error: ({ event }) =>
                failure(event.error, {
                  code: "invalid",
                  message: "The backup could not be validated.",
                  retryable: false,
                }),
            }),
          },
        },
        on: { "import.cancel": "cancelled" },
      },
      previewing: {
        tags: ["preview"],
        on: {
          "import.choose-merge": {
            actions: assign({ mode: () => "merge", error: () => null }),
          },
          "import.choose-replace": {
            actions: assign({ mode: () => "replace", error: () => null }),
          },
          "import.commit": [
            { target: "preSyncing", guard: "hasReplacePreSync" },
            {
              target: "failed",
              guard: "replacePreSyncOffline",
              actions: assign({
                error: () => ({
                  code: "offline",
                  message: "Replacement requires an online pre-sync.",
                  retryable: true,
                }),
              }),
            },
            {
              target: "committing",
              guard: "hasMode",
            },
            {
              target: "failed",
              actions: assign({
                error: () => ({
                  code: "invalid-request",
                  message: "Choose merge or replace before committing.",
                  retryable: false,
                }),
              }),
            },
          ],
          "import.cancel": "cancelled",
        },
      },
      preSyncing: {
        tags: ["synchronizing"],
        invoke: {
          src: "synchronizeBeforeReplace",
          onDone: {
            target: "committing",
            // The adapter uses this only to avoid running the already-completed
            // pre-sync a second time in the following commit state.
            actions: assign({ preSynced: () => true }),
          },
          onError: {
            target: "failed",
            actions: assign({
              error: ({ event }) =>
                failure(event.error, {
                  code: "unknown",
                  message: "Replacement pre-sync failed.",
                  retryable: true,
                }),
            }),
          },
        },
        on: { "import.cancel": "cancelled" },
      },
      committing: {
        tags: ["saving"],
        invoke: {
          src: "commitImport",
          input: ({ context }) => ({
            document: context.document!,
            mode: context.mode!,
            driveConfigured: context.driveConfigured,
            online: context.online,
            preSynced: context.preSynced,
          }),
          onDone: {
            target: "committed",
            actions: assign({
              result: ({ event }) => event.output,
              error: () => null,
            }),
          },
          onError: {
            target: "failed",
            actions: assign({
              error: ({ event }) =>
                failure(event.error, {
                  code: "unknown",
                  message: "Import was not committed.",
                  retryable: true,
                }),
            }),
          },
        },
        on: { "import.cancel": "cancelled" },
      },
      committed: {
        always: [
          { target: "conflict", guard: "hasConflicts" },
          "completed",
        ],
      },
      conflict: {
        tags: ["conflict"],
        on: {
          "import.resolve-conflicts": "completed",
          "import.cancel": "cancelled",
        },
      },
      failed: {
        tags: ["error"],
        on: {
          "import.retry": "validating",
          "import.cancel": "cancelled",
        },
      },
      completed: {
        type: "final",
        output: ({ context }) => ({
          status: "completed",
          result: context.result!,
        }),
      },
      cancelled: { type: "final", output: () => ({ status: "cancelled" }) },
    },
  });
}

export function createImportActor(
  dependencies: ImportExportActorDependencies,
  snapshot?: Snapshot<unknown>,
) {
  const machine = createImportMachine(dependencies);
  return createActor(machine, {
    ...(snapshot === undefined ? {} : { snapshot }),
  });
}

export type ExportEvent =
  | { readonly type: "export.request"; readonly share: boolean }
  | { readonly type: "export.retry" }
  | { readonly type: "export.cancel" };

export type ExportOutput =
  | {
    readonly status: "completed";
    readonly result: ExportResult;
    readonly delivery: ShareResult;
  }
  | { readonly status: "cancelled" };

export type ExportActorContext = {
  readonly share: boolean;
  readonly result: ExportResult | null;
  readonly delivery: ShareResult | null;
  readonly error: ContractFailure | null;
};

export function createExportMachine(
  dependencies: ImportExportActorDependencies,
) {
  const machineSetup = setup({
    types: {
      context: {} as ExportActorContext,
      events: {} as ExportEvent,
      output: {} as ExportOutput,
    },
    actors: {
      exportDocument: fromPromise(
        async ({ signal }: { signal: AbortSignal }) =>
          await dependencies.adapter.exportDocument({ signal }),
      ),
      deliverExport: fromPromise(
        async ({ input, signal }: {
          input: { readonly result: ExportResult; readonly share: boolean };
          signal: AbortSignal;
        }): Promise<ShareResult> =>
          input.share
            ? await dependencies.adapter.shareExport(input.result, { signal })
            : (await dependencies.adapter.saveExport(input.result, { signal }),
              "saved"),
      ),
    },
  });
  return machineSetup.createMachine({
    id: "s404-export",
    initial: "idle",
    context: { share: false, result: null, delivery: null, error: null },
    output: ({ context }) =>
      context.result === null || context.delivery === null
        ? { status: "cancelled" }
        : {
          status: "completed",
          result: context.result,
          delivery: context.delivery,
        },
    states: {
      idle: {
        on: {
          "export.request": {
            target: "exporting",
            actions: assign({
              share: ({ event }) => event.share,
              result: () => null,
              delivery: () => null,
              error: () => null,
            }),
          },
        },
      },
      exporting: {
        tags: ["exporting"],
        invoke: {
          src: "exportDocument",
          onDone: {
            target: "delivering",
            actions: assign({ result: ({ event }) => event.output }),
          },
          onError: {
            target: "failed",
            actions: assign({
              error: () => ({
                code: "unknown",
                message: "Export could not be prepared.",
                retryable: true,
              }),
            }),
          },
        },
        on: { "export.cancel": "cancelled" },
      },
      delivering: {
        tags: ["delivering"],
        invoke: {
          src: "deliverExport",
          input: ({ context }) => ({
            result: context.result!,
            share: context.share,
          }),
          onDone: {
            target: "completed",
            actions: assign({ delivery: ({ event }) => event.output }),
          },
          onError: {
            target: "failed",
            actions: assign({
              error: () => ({
                code: "unavailable",
                message: "Export could not be downloaded or shared.",
                retryable: true,
              }),
            }),
          },
        },
        on: { "export.cancel": "cancelled" },
      },
      completed: {
        type: "final",
        output: ({ context }) => ({
          status: "completed",
          result: context.result!,
          delivery: context.delivery!,
        }),
      },
      failed: {
        tags: ["error"],
        on: { "export.retry": "exporting", "export.cancel": "cancelled" },
      },
      cancelled: { type: "final", output: () => ({ status: "cancelled" }) },
    },
  });
}

export function createExportActor(
  dependencies: ImportExportActorDependencies,
  snapshot?: Snapshot<unknown>,
) {
  const machine = createExportMachine(dependencies);
  return createActor(machine, {
    ...(snapshot === undefined ? {} : { snapshot }),
  });
}
