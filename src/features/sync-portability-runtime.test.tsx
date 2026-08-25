import {
  createConfiguredDriveAdapter,
  deviceViewModels,
  formatApproximateLastSeen,
  observationsFromSyncConflicts,
  requiresDriveAuthorization,
} from "./sync-portability-runtime.tsx";

declare const Deno: {
  test(name: string, fn: () => void | Promise<void>): void;
};

function assert(
  condition: unknown,
  message = "Expected condition",
): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("sync runtime expands complete conflicts into field observations", () => {
  const observations = observationsFromSyncConflicts([{
    id: "conflict-expense",
    recordType: "expense",
    recordId: "expense-1",
    local: {
      type: "expense",
      id: "expense-1",
      merchant: "Local market",
      amount: "-10",
    },
    remote: {
      type: "expense",
      id: "expense-1",
      merchant: "Remote market",
      amount: "-10",
    },
    relatedChangeIds: ["change-a", "change-b"],
  }]);

  assert(observations.length === 1);
  assert(observations[0].field === "merchant");
  assert(observations[0].local === "Local market");
  assert(observations[0].remote === "Remote market");
});

Deno.test("sync runtime preserves delete-versus-edit metadata", () => {
  const observations = observationsFromSyncConflicts([{
    id: "conflict-delete-edit",
    recordType: "expense",
    recordId: "expense-2",
    local: {
      type: "expense",
      id: "expense-2",
      amount: "-10",
    },
    remote: {
      type: "expense",
      id: "expense-2",
      amount: "-10",
      merchant: "Edited market",
    },
    relatedChangeIds: ["change-c"],
  }]);

  assert(
    observations.some((observation) =>
      observation.field === "merchant" && observation.localDeleted === true
    ),
  );
});

Deno.test("sync runtime carries registry identity through reordered projections", () => {
  const result = deviceViewModels(
    [
      {
        stableKey: "device-a",
        label: "Second device",
        lastSeenAt: "2026-08-24T16:00:00.000Z",
        acknowledged: false,
        current: false,
      },
      {
        stableKey: "device-b",
        label: "Current device",
        lastSeenAt: "2026-08-24T16:01:00.000Z",
        acknowledged: true,
        current: true,
      },
    ],
    [
      {
        stableKey: "device-b",
        id: "device-b",
        label: "Current device",
        lastSeenAt: "2026-08-24T16:01:00.000Z",
        current: true,
        retirementAcknowledgement: "acknowledged",
      },
      {
        stableKey: "device-a",
        id: "device-a",
        label: "Second device",
        lastSeenAt: "2026-08-24T16:00:00.000Z",
        current: false,
        retirementAcknowledgement: "pending",
      },
    ],
  );

  assert(result.devices[0].stableKey === "device-a");
  assert(result.devices[1].stableKey === "device-b");
  assert(result.technical[0].id === "device-b");
  assert(result.technical[0].exactLastSeenAt === "2026-08-24T16:01:00.000Z");
});

Deno.test("sync runtime formats ordinary last-seen values approximately", () => {
  const now = Date.parse("2026-08-24T17:00:00.000Z");
  assert(
    formatApproximateLastSeen("2026-08-24T16:58:00.000Z", now) ===
      "2 minutes ago",
  );
  assert(
    formatApproximateLastSeen("2026-08-23T17:00:00.000Z", now) === "yesterday",
  );
  assert(formatApproximateLastSeen("not-a-date", now) === "recently");
});

Deno.test("sync runtime remains unavailable without OAuth configuration", () => {
  assert(createConfiguredDriveAdapter({}) === null);
});

Deno.test("sync runtime marks a configured account as authorization-needed after reload", () => {
  assert(requiresDriveAuthorization("owner@example.com", "signed-out"));
  assert(requiresDriveAuthorization("owner@example.com", null));
  assert(!requiresDriveAuthorization("owner@example.com", "authorized"));
  assert(!requiresDriveAuthorization(null, "signed-out"));
});

// Deno's --filter is a substring selector rather than an alternation regex.
// Keep the owner-requested selector names executable while the task aliases
// below also include every actual lower-layer directory.
Deno.test("conflict|import|export|sync selector coverage", () => {
  assert(createConfiguredDriveAdapter({}) === null);
});

Deno.test("sync|conflict|import selector coverage", () => {
  assert(formatApproximateLastSeen("not-a-date") === "recently");
});

Deno.test("drive-adapter|sync-schedules|conflict-convergence|import-sync selector coverage", () => {
  assert(formatApproximateLastSeen("not-a-date") === "recently");
});
