import { fromPromise } from "xstate";
import {
  createProjectDeletionService,
  type ProjectDeletionService,
  type ProjectDeletionTarget,
} from "../domain/project-deletion.ts";
import type { LocalPort } from "../adapters/ports/index.ts";
import { projectDeletionMachine } from "./contracts/deletion.ts";

export type ProjectDeletionActorDependencies = {
  readonly service: ProjectDeletionService;
  /** The browser composition supplies the actual download/share boundary. */
  readonly saveSafetyExport?: (json: string) => Promise<void>;
};

/**
 * Provide the locked project-deletion protocol with its local concrete ports.
 * A new machine is created for each workflow generation so terminal actors can
 * be retried or reopened without sending events to a final state.
 */
export function createProjectDeletionMachine(
  dependencies: ProjectDeletionActorDependencies,
) {
  return projectDeletionMachine.provide({
    actors: {
      exportSafety: fromPromise(
        async (
          { input }: { input: ProjectDeletionTarget },
        ): Promise<string> => {
          const json = await dependencies.service.exportSafety(input);
          await dependencies.saveSafetyExport?.(json);
          return "did-it-become-what-you-like-project-safety.json";
        },
      ),
      commitProjectDeletion: fromPromise(
        async ({ input }: { input: ProjectDeletionTarget }) =>
          await dependencies.service.commit(input),
      ),
    },
  });
}

export function createProjectDeletionDependencies(
  local: LocalPort,
  options: {
    readonly now?: () => string;
    readonly deviceId?: string;
    readonly saveSafetyExport?: (json: string) => Promise<void>;
  } = {},
): ProjectDeletionActorDependencies {
  return {
    service: createProjectDeletionService(local, options),
    saveSafetyExport: options.saveSafetyExport,
  };
}
