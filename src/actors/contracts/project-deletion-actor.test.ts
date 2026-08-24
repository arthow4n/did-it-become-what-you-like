import { createActor } from "xstate";
import { createProjectDeletionMachine } from "../project-deletion.ts";
import type {
  ProjectDeletionService,
  ProjectDeletionTarget,
} from "../../domain/project-deletion.ts";

declare const Deno: {
  test(name: string, fn: () => void | Promise<void>): void;
};

function assert(
  condition: unknown,
  message = "Expected condition",
): asserts condition {
  if (!condition) throw new Error(message);
}

async function settle(): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
}

const target: ProjectDeletionTarget = {
  projectId: "project-delete",
  projectName: "Trip project",
  expenseCount: 1,
  receiptCount: 1,
};

function createService(
  overrides: Partial<{
    exportSafety: ProjectDeletionService["exportSafety"];
    commit: ProjectDeletionService["commit"];
  }> = {},
): ProjectDeletionService {
  return {
    preview: () => Promise.reject(new Error("not used in actor test")),
    exportSafety: overrides.exportSafety ?? (() => Promise.resolve("{}")),
    commit: overrides.commit ??
      (() =>
        Promise.resolve({ projectId: target.projectId, tombstoneCount: 6 })),
  };
}

function start(service: ProjectDeletionService) {
  const actor = createActor(createProjectDeletionMachine({ service })).start();
  actor.send({
    type: "project-delete.open",
    target,
    safetyExportRequired: true,
  });
  return actor;
}

Deno.test(
  "project-deletion actor keeps wrong name invalid and does not commit",
  async () => {
    let commits = 0;
    const actor = start(createService({
      commit: () => {
        commits += 1;
        return Promise.resolve({
          projectId: target.projectId,
          tombstoneCount: 6,
        });
      },
    }));
    actor.send({ type: "project-delete.export-safety" });
    await settle();
    actor.send({ type: "project-delete.type-name", value: "Trip project?" });
    actor.send({ type: "project-delete.confirm" });
    assert(actor.getSnapshot().matches("confirming"));
    assertEquals(actor.getSnapshot().context.error?.code, "invalid");
    assert(commits === 0, "wrong confirmation must not commit");
    actor.stop();
  },
);

Deno.test(
  "project-deletion actor retries an export failure before confirming",
  async () => {
    let exports = 0;
    const actor = start(createService({
      exportSafety: () => {
        exports += 1;
        return exports === 1
          ? Promise.reject(new Error("synthetic export failure"))
          : Promise.resolve("{}");
      },
    }));
    actor.send({ type: "project-delete.export-safety" });
    await settle();
    assert(actor.getSnapshot().matches("exportFailed"));
    actor.send({ type: "project-delete.retry" });
    await settle();
    assert(actor.getSnapshot().matches("confirming"));
    assert(exports === 2, "retry must invoke export again");
    actor.send({ type: "project-delete.cancel" });
    assert(actor.getSnapshot().matches("cancelled"));
    actor.stop();
  },
);

Deno.test(
  "project-deletion actor retries a commit failure and reaches completed",
  async () => {
    let commits = 0;
    const actor = start(createService({
      commit: () => {
        commits += 1;
        return commits === 1
          ? Promise.reject(new Error("synthetic commit failure"))
          : Promise.resolve({ projectId: target.projectId, tombstoneCount: 6 });
      },
    }));
    actor.send({ type: "project-delete.export-safety" });
    await settle();
    actor.send({ type: "project-delete.type-name", value: target.projectName });
    actor.send({ type: "project-delete.confirm" });
    await settle();
    assert(actor.getSnapshot().matches("failed"));
    actor.send({ type: "project-delete.retry" });
    await settle();
    assert(actor.getSnapshot().matches("completed"));
    assert(commits === 2, "retry must invoke commit again");
    actor.stop();
  },
);

Deno.test("project-deletion actor cancellation reaches a terminal handoff", () => {
  const actor = start(createService());
  actor.send({ type: "project-delete.cancel" });
  assert(actor.getSnapshot().matches("cancelled"));
  actor.stop();
});

function assertEquals<T>(actual: T, expected: T): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}
