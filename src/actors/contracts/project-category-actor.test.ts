import { createActor } from "xstate";
import {
  createCategoryActorMachine,
  createCategoryOrganizationMachine,
  createProjectActorMachine,
  createProjectCategoryService,
  createProjectOrganizationMachine,
  selectProjectOrganizationActions,
} from "../project-category.ts";
import {
  createFakeLocalPort,
  type FakeLocalPort,
} from "../../test-support/fakes/ports.ts";
import { UNCATEGORIZED_CATEGORY_ID } from "../../domain/index.ts";

declare const Deno: {
  test(name: string, fn: () => void | Promise<void>): void;
};

function assert(
  condition: unknown,
  message = "Expected condition",
): asserts condition {
  if (!condition) throw new Error(message);
}

function assertEquals<T>(actual: T, expected: T): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

async function settle(): Promise<void> {
  for (let index = 0; index < 12; index += 1) {
    await Promise.resolve();
  }
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
}

const projectOne = {
  schemaVersion: 1 as const,
  type: "project" as const,
  id: "project-one",
  name: "One",
  defaultCurrency: "SEK" as const,
  archived: false,
};

const projectTwo = {
  ...projectOne,
  id: "project-two",
  name: "Two",
};

function createService(
  local: FakeLocalPort = createFakeLocalPort(),
) {
  return {
    local,
    service: createProjectCategoryService(local, {
      deviceId: "device-actor",
      now: () => "2026-08-24T03:25:00.000Z",
    }),
  };
}

Deno.test("project-category actor: locked project command actor commits reorder", async () => {
  const { service } = createService();
  await service.commitProject({ type: "create", project: projectOne });
  await service.commitProject({ type: "create", project: projectTwo });
  const machine = createProjectActorMachine(service);
  const actor = createActor(machine).start();
  actor.send({
    type: "project.open",
    projects: [projectOne, projectTwo],
    selectedProjectId: projectOne.id,
  });
  actor.send({
    type: "project.command",
    command: { type: "reorder", orderedIds: [projectTwo.id, projectOne.id] },
  });
  await settle();
  assertEquals(actor.getSnapshot().value, "ready");
  assertEquals(
    actor.getSnapshot().context.projects.map((project) => project.id),
    [
      projectTwo.id,
      projectOne.id,
    ],
  );
  actor.stop();
});

Deno.test("project-category actor: organization snapshot exposes guard-valid actions and exact errors", async () => {
  const { service } = createService();
  await service.commitProject({ type: "create", project: projectOne });
  await service.commitProject({ type: "create", project: projectTwo });
  const state = await service.getState();
  const actor = createActor(createProjectOrganizationMachine(service)).start();
  actor.send({ type: "project.open", state });
  const initialActions = selectProjectOrganizationActions(actor.getSnapshot());
  assert(
    !initialActions.some((action) =>
      action.type === "archive" && action.projectId === projectOne.id
    ),
    "the selected project must not expose archive",
  );
  assert(
    initialActions.some((action) =>
      action.type === "archive" && action.projectId === projectTwo.id
    ),
    "a switched-away project may expose archive",
  );

  actor.send({
    type: "project.command",
    command: { type: "archive", projectId: projectOne.id },
  });
  await settle();
  assertEquals(actor.getSnapshot().value, "failed");
  assertEquals(actor.getSnapshot().context.error?.code, "current-project");
  assertEquals(
    actor.getSnapshot().context.error?.message,
    "Switch to another project before archiving the current project.",
  );
  assert(
    selectProjectOrganizationActions(actor.getSnapshot()).some((action) =>
      action.type === "retry"
    ),
    "failed snapshots expose retry",
  );
  actor.stop();
});

Deno.test("project-category actor: offline failure retains retryable state and retries locally", async () => {
  const { local, service } = createService();
  await service.commitProject({ type: "create", project: projectOne });
  const state = await service.getState();
  const actor = createActor(createProjectOrganizationMachine(service)).start();
  actor.send({ type: "project.open", state });
  local.setScenario({ offline: true });
  actor.send({
    type: "project.command",
    command: { type: "rename", projectId: projectOne.id, name: "Offline" },
  });
  await settle();
  assertEquals(actor.getSnapshot().value, "failed");
  assertEquals(actor.getSnapshot().context.error, {
    code: "offline",
    message: "This operation is unavailable offline.",
    retryable: true,
  });
  assert(actor.getSnapshot().can({ type: "project.retry" }));
  local.setScenario({ offline: false });
  actor.send({ type: "project.retry" });
  await settle();
  assertEquals(actor.getSnapshot().value, "ready");
  assertEquals(actor.getSnapshot().context.state?.projects[0]?.name, "Offline");
  actor.stop();
});

Deno.test("project-category actor: category actor protects Uncategorized", async () => {
  const { service } = createService();
  const state = await service.getState();
  const actor = createActor(createCategoryOrganizationMachine(service)).start();
  actor.send({ type: "category.open", state });
  actor.send({
    type: "category.command",
    command: { type: "archive", categoryId: UNCATEGORIZED_CATEGORY_ID },
  });
  await settle();
  assertEquals(actor.getSnapshot().value, "failed");
  assertEquals(actor.getSnapshot().context.error?.code, "protected");
  assertEquals(
    actor.getSnapshot().context.error?.message,
    "Uncategorized is protected and cannot be changed that way.",
  );
  actor.stop();
});

Deno.test("project-category actor: locked category actor remains injectable", async () => {
  const { service } = createService();
  const actor = createActor(createCategoryActorMachine(service)).start();
  actor.send({ type: "category.open", categories: [] });
  actor.send({
    type: "category.command",
    command: {
      type: "reorder",
      orderedIds: [],
    },
  });
  await settle();
  assertEquals(actor.getSnapshot().value, "ready");
  actor.stop();
});
