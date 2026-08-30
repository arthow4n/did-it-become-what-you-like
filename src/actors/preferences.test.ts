import { createActor } from "xstate";
import { createPreferencesMachine } from "./preferences.ts";
import { createFakeLocalPort } from "../test-support/fakes/ports.ts";
import { waitFor } from "../test-support/index.ts";

declare const Deno: {
  test(name: string, fn: () => void | Promise<void>): void;
};

Deno.test("preference actor loads, changes, and persists the day boundary", async () => {
  const local = createFakeLocalPort();
  const actor = createActor(createPreferencesMachine({ local })).start();

  actor.send({ type: "preferences.load" });
  await waitFor(
    () => actor.getSnapshot().matches("ready"),
    "preferences did not load",
  );
  if (actor.getSnapshot().context.expenseDayBoundary !== "03:00") {
    throw new Error("preferences should use the approved 03:00 default");
  }

  actor.send({
    type: "preferences.change",
    expenseDayBoundary: "04:30",
  });
  if (!actor.getSnapshot().hasTag("dirty")) {
    throw new Error("changing the boundary should make preferences dirty");
  }
  actor.send({ type: "preferences.save" });
  await waitFor(
    () => actor.getSnapshot().matches("saved"),
    "preferences did not save",
  );
  if (!local.operations.includes("put:records:settings-portable")) {
    throw new Error("preferences should persist through the local port");
  }
  actor.stop();
});

Deno.test("preference actor discards an unsaved boundary back to the saved value", async () => {
  const local = createFakeLocalPort();
  const actor = createActor(createPreferencesMachine({ local })).start();

  actor.send({ type: "preferences.load" });
  await waitFor(
    () => actor.getSnapshot().matches("ready"),
    "preferences did not load",
  );
  actor.send({
    type: "preferences.change",
    expenseDayBoundary: "04:30",
  });
  actor.send({ type: "preferences.discard" });

  if (!actor.getSnapshot().matches("ready")) {
    throw new Error("discard should return preferences to ready");
  }
  if (actor.getSnapshot().hasTag("dirty")) {
    throw new Error("discard should clear the dirty state");
  }
  if (actor.getSnapshot().context.expenseDayBoundary !== "03:00") {
    throw new Error("discard should restore the saved boundary");
  }
  if (local.operations.some((operation) => operation.startsWith("put:"))) {
    throw new Error("discard should not persist the unsaved boundary");
  }
  actor.stop();
});

Deno.test(
  "preference actor retries a failed save without reloading over the draft",
  async () => {
    const local = createFakeLocalPort();
    const actor = createActor(createPreferencesMachine({ local })).start();

    actor.send({ type: "preferences.load" });
    await waitFor(
      () => actor.getSnapshot().matches("ready"),
      "preferences did not load",
    );
    actor.send({
      type: "preferences.change",
      expenseDayBoundary: "04:30",
    });
    local.failNext("unavailable");
    actor.send({ type: "preferences.save" });
    await waitFor(
      () => actor.getSnapshot().matches("failed"),
      "preferences save did not fail",
    );
    if (actor.getSnapshot().context.failureOperation !== "save") {
      throw new Error("preferences should remember that the save failed");
    }
    if (actor.getSnapshot().context.expenseDayBoundary !== "04:30") {
      throw new Error("a failed save must retain the edited boundary");
    }

    actor.send({ type: "preferences.retry" });
    await waitFor(
      () => actor.getSnapshot().matches("saved"),
      "preferences save retry did not complete",
    );
    if (actor.getSnapshot().context.expenseDayBoundary !== "04:30") {
      throw new Error("save retry should persist the edited boundary");
    }
    actor.stop();
  },
);
