/// <reference path="../deno.d.ts" />

import { assertEquals } from "../assert.ts";
import { createActor } from "xstate";
import { proofMachine } from "../src/compatibility.tsx";

Deno.test("XState v5 actor performs a typed transition", () => {
  const actor = createActor(proofMachine).start();

  actor.send({ type: "increment" });

  assertEquals(actor.getSnapshot().value, "ready");
  assertEquals(actor.getSnapshot().context.count, 1);

  actor.stop();
});
