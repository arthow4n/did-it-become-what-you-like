import { createActor } from "xstate";
import { createPreferencesMachine } from "./preferences.ts";
import { createFakeLocalPort } from "../test-support/fakes/ports.ts";

declare const Deno: {
  test(name: string, fn: () => void | Promise<void>): void;
};

async function waitFor(
  condition: () => boolean,
  message: string,
): Promise<void> {
  for (let attempt = 0; attempt < 20; attempt++) {
    if (condition()) return;
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
  throw new Error(message);
}

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
