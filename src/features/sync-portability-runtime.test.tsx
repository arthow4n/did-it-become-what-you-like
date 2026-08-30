import {
  conflictIdsForResolution,
  conflictIdsForResolutions,
  createConfiguredDriveAdapter,
  deviceViewModels,
  formatApproximateLastSeen,
  observationsFromSyncConflicts,
  reconnectAuthorizationOptions,
  requestLocalShellRefreshAfterSync,
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

Deno.test(
  "sync runtime scopes a resolution to the causal conflict parents it observed",
  () => {
    const conflicts = [
      {
        id: "conflict-old",
        recordType: "expense",
        recordId: "expense-1",
        local: { merchant: "Local" },
        remote: { merchant: "Remote" },
        relatedChangeIds: ["change-old"],
      },
      {
        id: "conflict-new",
        recordType: "expense",
        recordId: "expense-1",
        local: { merchant: "Local" },
        remote: { merchant: "Newest" },
        relatedChangeIds: ["change-new"],
      },
    ];
    assert(
      JSON.stringify(
        conflictIdsForResolution(
          conflicts,
          "conflict-expense-expense-1-merchant",
          [
            "change-old",
            "conflict-old-merchant-local",
            "conflict-old-merchant-remote",
          ],
        ),
      ) === JSON.stringify(["conflict-old"]),
    );
  },
);

Deno.test("sync runtime accumulates all conflict groups before acknowledging sync", () => {
  const conflicts = [
    {
      id: "conflict-a",
      recordType: "expense",
      recordId: "expense-a",
      local: { merchant: "Local A" },
      remote: { merchant: "Remote A" },
      relatedChangeIds: ["change-a"],
    },
    {
      id: "conflict-b",
      recordType: "expense",
      recordId: "expense-b",
      local: { merchant: "Local B" },
      remote: { merchant: "Remote B" },
      relatedChangeIds: ["change-b"],
    },
  ];
  const resolutions = [
    {
      groupId: "conflict-expense-expense-a-merchant",
      parentRevisionIds: [
        "change-a",
        "conflict-a-merchant-local",
        "conflict-a-merchant-remote",
      ],
    },
    {
      groupId: "conflict-expense-expense-b-merchant",
      parentRevisionIds: [
        "change-b",
        "conflict-b-merchant-local",
        "conflict-b-merchant-remote",
      ],
    },
  ];
  assert(
    JSON.stringify(conflictIdsForResolutions(conflicts, resolutions)) ===
      JSON.stringify(["conflict-a", "conflict-b"]),
    "all successfully committed groups must be acknowledged together",
  );
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

Deno.test("sync runtime reconnect options reuse the configured account hint", () => {
  const options = reconnectAuthorizationOptions({
    mode: "configured",
    accountEmail: "owner@example.com",
    network: "online",
    sync: "authorization-error",
    lastSyncedAt: null,
    pendingChangeCount: 0,
    unresolvedConflictCount: 0,
  });
  assert(options.prompt === "");
  assert(options.loginHint === "owner@example.com");
  assert(
    reconnectAuthorizationOptions({ mode: "disconnected" }).loginHint ===
      undefined,
  );
});

Deno.test(
  "sync runtime requests one local-shell refresh after a successful exchange",
  () => {
    const handled = { current: null as string | null };
    let refreshRequests = 0;
    const refresh = () => refreshRequests += 1;
    const completed = {
      value: "idle",
      context: { lastSyncedAt: "2026-08-25T12:00:00.000Z" },
    };

    requestLocalShellRefreshAfterSync(completed, handled, refresh);
    requestLocalShellRefreshAfterSync(completed, handled, refresh);
    requestLocalShellRefreshAfterSync(
      {
        value: "synchronizing",
        context: { lastSyncedAt: "2026-08-25T12:01:00.000Z" },
      },
      handled,
      refresh,
    );

    assert(refreshRequests === 1);
  },
);
