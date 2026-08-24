import { createTestClock } from "../../test-support/clock.ts";
import {
  createFakeIdPort,
  createFakeLocalPort,
} from "../../test-support/fakes/ports.ts";
import { createDeviceRegistry } from "./device-registry.ts";

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

Deno.test("sync-device-registry: labels, last-seen, acknowledgements, and ordinary projections persist", async () => {
  const local = createFakeLocalPort();
  const clock = createTestClock("2026-08-24T10:00:00.000Z");
  const ids = createFakeIdPort("registry");
  const registry = createDeviceRegistry({
    local,
    deviceId: "device-current",
    clock: { now: clock.nowIso },
    ids,
  });
  await registry.hydrate();
  await registry.register("device-remote", "Travel phone");
  await registry.acknowledge("device-remote");
  clock.advance(60_000);
  await registry.touch("device-remote");
  await registry.rename("device-remote", "Travel phone 2");

  const ordinary = registry.ordinaryProjection();
  assertEquals(ordinary.length, 2);
  assert(ordinary.some((device) => device.label === "Travel phone 2"));
  assert(ordinary.every((device) => !("id" in device)));
  assert(!JSON.stringify(ordinary).includes("device-remote"));
  assert(
    registry.diagnosticProjection().some((device) =>
      device.id === "device-remote"
    ),
  );

  const restarted = createDeviceRegistry({
    local,
    deviceId: "device-current",
    clock: { now: clock.nowIso },
    ids,
  });
  const state = await restarted.hydrate();
  assertEquals(state.devices.length, 2);
  assertEquals(
    restarted.ordinaryProjection().find((device) =>
      device.label === "Travel phone 2"
    )
      ?.acknowledged,
    true,
  );
  assertEquals(
    restarted.ordinaryProjection().find((device) =>
      device.label === "Travel phone 2"
    )
      ?.lastSeenAt,
    "2026-08-24T10:01:00.000Z",
  );
});

Deno.test("sync-device-registry: account switching requires explicit confirmation", async () => {
  const local = createFakeLocalPort();
  const clock = createTestClock();
  const registry = createDeviceRegistry({
    local,
    deviceId: "device-current",
    clock: { now: clock.nowIso },
  });
  await registry.hydrate();
  assertEquals(
    await registry.configureAccount("owner@example.test", false),
    "configured",
  );
  assertEquals(
    await registry.configureAccount("other@example.test", false),
    "confirmation-required",
  );
  assertEquals(
    await registry.configureAccount("other@example.test", true),
    "configured",
  );
  assertEquals(registry.state().accountEmail, "other@example.test");
});
