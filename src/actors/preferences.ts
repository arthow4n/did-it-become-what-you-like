import { assign, fromPromise, setup } from "xstate";
import type { LocalPort } from "../adapters/ports/local.ts";
import {
  type PortableSettings,
  PortableSettingsSchema,
} from "../domain/index.ts";
import {
  type ContractFailure,
  contractFailureFromError,
} from "./contracts/types.ts";

export type PreferencesEvent =
  | { readonly type: "preferences.load" }
  | { readonly type: "preferences.change"; readonly expenseDayBoundary: string }
  | { readonly type: "preferences.save" }
  | { readonly type: "preferences.retry" };

export type PreferencesContext = {
  readonly settings: PortableSettings | null;
  readonly expenseDayBoundary: string;
  readonly error: ContractFailure | null;
};

type PreferencesDependencies = {
  readonly local: LocalPort;
};

const DEFAULT_SETTINGS: PortableSettings = {
  schemaVersion: 1,
  type: "portable-settings",
  id: "settings-portable",
  expenseDayBoundary: "03:00",
};

export function createPreferencesMachine(
  dependencies: PreferencesDependencies,
) {
  const preferencesSetup = setup({
    types: {
      context: {} as PreferencesContext,
      events: {} as PreferencesEvent,
    },
    actors: {
      load: fromPromise(async () => {
        const value = await dependencies.local.transaction(
          "readonly",
          (transaction) => transaction.get("records", "settings-portable"),
        );
        const parsed = PortableSettingsSchema.safeParse(value);
        return parsed.success ? parsed.data : DEFAULT_SETTINGS;
      }),
      save: fromPromise(
        async ({ input }: { input: PortableSettings }) => {
          const settings = PortableSettingsSchema.parse(input);
          await dependencies.local.transaction(
            "readwrite",
            (transaction) =>
              transaction.put("records", "settings-portable", settings),
          );
          return settings;
        },
      ),
    },
  });

  return preferencesSetup.createMachine({
    id: "preferences",
    initial: "idle",
    context: {
      settings: null,
      expenseDayBoundary: DEFAULT_SETTINGS.expenseDayBoundary,
      error: null,
    },
    states: {
      idle: {
        on: { "preferences.load": "loading" },
      },
      loading: {
        tags: ["loading"],
        invoke: {
          src: "load",
          onDone: {
            target: "ready",
            actions: assign({
              settings: ({ event }) => event.output,
              expenseDayBoundary: ({ event }) =>
                event.output.expenseDayBoundary,
              error: () => null,
            }),
          },
          onError: {
            target: "failed",
            actions: assign({
              error: ({ event }) =>
                contractFailureFromError(event.error, {
                  code: "unknown",
                  message: "Preferences could not be loaded.",
                  retryable: true,
                }),
            }),
          },
        },
      },
      ready: {
        on: {
          "preferences.change": {
            target: "dirty",
            actions: assign({
              expenseDayBoundary: ({ event }) => event.expenseDayBoundary,
              error: () => null,
            }),
          },
        },
      },
      dirty: {
        tags: ["dirty"],
        on: {
          "preferences.change": {
            actions: assign({
              expenseDayBoundary: ({ event }) => event.expenseDayBoundary,
              error: () => null,
            }),
          },
          "preferences.save": "saving",
        },
      },
      saving: {
        tags: ["saving"],
        invoke: {
          src: "save",
          input: ({ context }) =>
            PortableSettingsSchema.parse({
              ...(context.settings ?? DEFAULT_SETTINGS),
              expenseDayBoundary: context.expenseDayBoundary,
            }),
          onDone: {
            target: "saved",
            actions: assign({
              settings: ({ event }) => event.output,
              expenseDayBoundary: ({ event }) =>
                event.output.expenseDayBoundary,
              error: () => null,
            }),
          },
          onError: {
            target: "failed",
            actions: assign({
              error: ({ event }) =>
                contractFailureFromError(event.error, {
                  code: "unknown",
                  message: "Preferences could not be saved.",
                  retryable: true,
                }),
            }),
          },
        },
      },
      saved: {
        tags: ["saved"],
        on: {
          "preferences.change": {
            target: "dirty",
            actions: assign({
              expenseDayBoundary: ({ event }) => event.expenseDayBoundary,
              error: () => null,
            }),
          },
        },
      },
      failed: {
        tags: ["error"],
        on: {
          "preferences.retry": "loading",
          "preferences.change": {
            target: "dirty",
            actions: assign({
              expenseDayBoundary: ({ event }) => event.expenseDayBoundary,
              error: () => null,
            }),
          },
          "preferences.save": "saving",
        },
      },
    },
  });
}
