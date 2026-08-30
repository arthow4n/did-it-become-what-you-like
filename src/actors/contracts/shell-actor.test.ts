import { createActor } from "xstate";
import { createLocalShellMachine } from "../local-shell.ts";
import {
  createProjectCategoryService,
  type ProjectCategoryService,
} from "../../domain/organization.ts";
import {
  createFakeLocalPort,
  type FakeLocalPort,
} from "../../test-support/fakes/ports.ts";

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

import { settle } from "../../test-support/index.ts";

const projectOne = {
  schemaVersion: 1 as const,
  type: "project" as const,
  id: "project-shell-one",
  name: "Shell one",
  defaultCurrency: "SEK" as const,
  archived: false,
};

const projectTwo = {
  ...projectOne,
  id: "project-shell-two",
  name: "Shell two",
};

const projectThree = {
  ...projectOne,
  id: "project-shell-three",
  name: "Shell three",
};

async function createShellHarness(): Promise<{
  readonly local: FakeLocalPort;
  readonly service: ProjectCategoryService;
}> {
  const local = createFakeLocalPort();
  const service = createProjectCategoryService(local, {
    deviceId: "device-shell-tests",
    now: () => "2026-08-24T12:00:00.000Z",
  });
  await service.commitProject({ type: "create", project: projectOne });
  await service.commitProject({ type: "create", project: projectTwo });
  return { local, service };
}

Deno.test("shell-actor: restores route, exposes offline modes, and switches projects", async () => {
  const harness = await createShellHarness();
  const actor = createActor(
    createLocalShellMachine({
      organization: harness.service,
      initialNetwork: "offline",
    }),
  ).start();
  await settle();

  assertEquals(actor.getSnapshot().context.route, "expenses");
  assert(actor.getSnapshot().hasTag("offline"));
  actor.send({ type: "shell.network.reconnecting" });
  assert(actor.getSnapshot().hasTag("reconnecting"));
  actor.send({ type: "shell.network.online" });
  assert(actor.getSnapshot().hasTag("online"));
  actor.send({ type: "shell.navigate", route: "about" });
  actor.send({ type: "shell.workflow.open", workflow: "expense-form" });
  assertEquals(actor.getSnapshot().context.route, "about");
  assertEquals(actor.getSnapshot().context.activeWorkflow, "expense-form");
  actor.send({ type: "shell.workflow.close" });
  assertEquals(actor.getSnapshot().context.activeWorkflow, null);
  actor.send({ type: "shell.navigate", route: "receipt-detail" });
  actor.send({ type: "shell.workflow.open", workflow: "receipt-detail" });
  assertEquals(actor.getSnapshot().context.route, "receipt-detail");
  assertEquals(actor.getSnapshot().context.activeWorkflow, "receipt-detail");
  actor.send({ type: "shell.workflow.close" });

  actor.send({
    type: "shell.project.select",
    projectId: projectTwo.id,
  });
  await settle();
  assertEquals(
    actor.getSnapshot().context.projectState?.selectedProjectId,
    projectTwo.id,
  );
  assert(actor.getSnapshot().hasTag("project-ready"));
  actor.stop();
});

Deno.test("shell-actor: project failure retains retry and offline shell recovers", async () => {
  const harness = await createShellHarness();
  const actor = createActor(
    createLocalShellMachine({ organization: harness.service }),
  ).start();
  await settle();

  harness.local.setScenario({ offline: true });
  actor.send({
    type: "shell.project.select",
    projectId: projectTwo.id,
  });
  await settle();
  assert(actor.getSnapshot().hasTag("error"));
  assertEquals(actor.getSnapshot().context.error?.code, "offline");
  assert(actor.getSnapshot().can({ type: "shell.project.retry" }));
  harness.local.setScenario({ offline: false });
  actor.send({ type: "shell.project.retry" });
  await settle();
  assert(actor.getSnapshot().hasTag("project-ready"));
  assertEquals(
    actor.getSnapshot().context.projectState?.selectedProjectId,
    projectTwo.id,
  );

  actor.send({ type: "shell.dataset.retired" });
  assert(actor.getSnapshot().hasTag("retired"));
  assertEquals(actor.getSnapshot().context.route, "expenses");
  actor.stop();
});

Deno.test(
  "shell-actor: repository refresh adopts external changes without resetting route or workflow",
  async () => {
    const harness = await createShellHarness();
    const actor = createActor(
      createLocalShellMachine({ organization: harness.service }),
    ).start();
    await settle();

    actor.send({ type: "shell.navigate", route: "settings" });
    actor.send({ type: "shell.workflow.open", workflow: "expense-form" });
    await harness.service.commitProject({
      type: "create",
      project: projectThree,
    });

    actor.send({ type: "shell.repository.refresh" });
    await settle();

    assert(actor.getSnapshot().hasTag("project-ready"));
    assert(
      actor.getSnapshot().context.projectState?.projects.some((project) =>
        project.id === projectThree.id
      ),
    );
    assertEquals(actor.getSnapshot().context.route, "settings");
    assertEquals(actor.getSnapshot().context.activeWorkflow, "expense-form");
    actor.stop();
  },
);

Deno.test("shell-actor: restoration failure exposes retryable shell error", async () => {
  const local = createFakeLocalPort();
  const service = createProjectCategoryService(local, {
    deviceId: "device-shell-failure",
    now: () => "2026-08-24T12:00:00.000Z",
  });
  local.setScenario({ offline: true });
  const actor = createActor(
    createLocalShellMachine({ organization: service }),
  ).start();
  await settle();
  assertEquals(actor.getSnapshot().value, "error");
  assertEquals(actor.getSnapshot().context.error?.code, "offline");
  assert(actor.getSnapshot().context.error?.retryable === true);
  local.setScenario({ offline: false });
  actor.send({ type: "shell.retry" });
  await settle();
  assert(actor.getSnapshot().hasTag("project-ready"));
  actor.stop();
});
