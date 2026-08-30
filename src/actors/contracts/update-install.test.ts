import { createActor, fromPromise } from "xstate";
import { updateInstallMachine } from "./update-install.ts";
import type { UpdateCheckOutput } from "../../adapters/ports/update-install.ts";

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

Deno.test("update actor exposes update-ready and blocks reload for dirty input", async () => {
  let reloads = 0;
  const machine = updateInstallMachine.provide({
    actors: {
      checkForUpdate: fromPromise((): Promise<UpdateCheckOutput> =>
        Promise.resolve({ status: "update-ready", version: "abc1234" })
      ),
      reloadApp: fromPromise(() => {
        reloads++;
        return Promise.resolve();
      }),
    },
  });
  const actor = createActor(machine).start();

  actor.send({ type: "update.check" });
  await waitFor(
    () => actor.getSnapshot().matches("updateReady"),
    "update actor did not expose update-ready",
  );
  if (actor.getSnapshot().context.version !== "abc1234") {
    throw new Error("update-ready should retain the build version");
  }
  actor.send({ type: "update.blocked-by-dirty" });
  if (!actor.getSnapshot().matches("blocked")) {
    throw new Error("dirty input should enter the blocked state");
  }
  actor.send({ type: "update.reload" });
  await waitFor(
    () => actor.getSnapshot().matches("reloaded"),
    "update actor did not finish reload",
  );
  if (reloads !== 1) throw new Error("reload should be invoked once");
  actor.stop();
});

Deno.test("install actor supports a later choice without installing", () => {
  const actor = createActor(updateInstallMachine).start();
  actor.send({ type: "install.available" });
  actor.send({ type: "install.later" });
  if (!actor.getSnapshot().matches("dismissed")) {
    throw new Error("later should dismiss the optional install offer");
  }
  actor.stop();
});

Deno.test("update actor treats unsupported checks as a quiet up-to-date state", async () => {
  const actor = createActor(
    updateInstallMachine.provide({
      actors: {
        checkForUpdate: fromPromise(() =>
          Promise.reject({ code: "unsupported" })
        ),
      },
    }),
  ).start();
  actor.send({ type: "update.check" });
  await waitFor(
    () => actor.getSnapshot().matches("upToDate"),
    "unsupported update checks should settle quietly",
  );
  if (actor.getSnapshot().context.error !== null) {
    throw new Error("unsupported checks must not retain an error");
  }
  actor.stop();
});

Deno.test("install actor remains reusable for offline updates after install", async () => {
  const actor = createActor(
    updateInstallMachine.provide({
      actors: {
        installApp: fromPromise(async (): Promise<void> => {}),
      },
    }),
  ).start();
  actor.send({ type: "install.available" });
  actor.send({ type: "install.request" });
  await waitFor(
    () => actor.getSnapshot().matches("installed"),
    "install actor did not return to its reusable installed state",
  );
  actor.send({ type: "network.offline" });
  if (!actor.getSnapshot().matches("offline")) {
    throw new Error("installed actor should continue receiving offline events");
  }
  actor.stop();
});
