import { createElement } from "react";
import { withComponentHarness } from "../../test-support/component-harness.tsx";
import {
  type SyncStatusContextValue,
  SyncStatusProvider,
  useNotifyLocalMutation,
  useSyncStatus,
} from "./sync-status-context.tsx";

declare const Deno: { test(name: string, fn: () => Promise<void>): void };

Deno.test("sync notifications do not subscribe save-only consumers to status updates", async () => {
  await withComponentHarness(({ render, fireEvent }) => {
    let mutationRenders = 0;
    let statusRenders = 0;
    let notified = "";
    function MutationConsumer() {
      mutationRenders++;
      const notify = useNotifyLocalMutation();
      return (
        <button type="button" onClick={() => notify?.()}>Notify save</button>
      );
    }
    function StatusConsumer() {
      statusRenders++;
      const status = useSyncStatus();
      return <p>{status?.view.mode}</p>;
    }
    const children = (
      <>
        <MutationConsumer />
        <StatusConsumer />
      </>
    );
    const value: SyncStatusContextValue = {
      view: { mode: "disconnected" },
      onOpenSync: () => undefined,
      onReconnect: () => undefined,
      notifyLocalMutation: () => {
        notified = "original";
      },
    };
    const mounted = render(
      createElement(SyncStatusProvider, { value }, children),
    );
    const baseline = mutationRenders;
    const statusBaseline = statusRenders;
    mounted.rerender(createElement(SyncStatusProvider, {
      value: {
        ...value,
        view: { mode: "connecting" },
        notifyLocalMutation: () => {
          notified = "current";
        },
      },
    }, children));
    if (mutationRenders !== baseline) {
      throw new Error("Sync status rerendered a save-only consumer");
    }
    if (statusRenders <= statusBaseline) {
      throw new Error("Status consumer missed the changed view");
    }
    if (!mounted.getByText("connecting")) {
      throw new Error("Status text is stale");
    }
    fireEvent.click(mounted.getByRole("button", { name: "Notify save" }));
    if (notified !== "current") {
      throw new Error("Save notification used an obsolete callback");
    }
    mounted.unmount();
  });
});

Deno.test("unchanged sync status ignores runtime callback churn and keeps actions current", async () => {
  await withComponentHarness(({ render, fireEvent }) => {
    let renders = 0;
    let invoked = "";
    function Consumer() {
      renders++;
      const status = useSyncStatus();
      return (
        <button type="button" onClick={() => status?.onReconnect()}>
          Reconnect
        </button>
      );
    }
    const child = <Consumer />;
    const value = {
      view: {
        mode: "configured",
        accountEmail: "test@example.com",
        network: "online",
        sync: "synced",
        lastSyncedAt: null,
        pendingChangeCount: 0,
        unresolvedConflictCount: 0,
      },
      onOpenSync: () => undefined,
      onReconnect: () => {
        invoked = "old";
      },
      notifyLocalMutation: () => undefined,
    } satisfies SyncStatusContextValue;
    const mounted = render(
      <SyncStatusProvider value={value}>{child}</SyncStatusProvider>,
    );
    const baseline = renders;
    mounted.rerender(
      <SyncStatusProvider
        value={{
          ...value,
          view: { ...value.view },
          onReconnect: () => {
            invoked = "current";
          },
        }}
      >
        {child}
      </SyncStatusProvider>,
    );
    if (renders !== baseline) {
      throw new Error("Equivalent sync status rerendered its consumer");
    }
    fireEvent.click(mounted.getByRole("button", { name: "Reconnect" }));
    if (invoked !== "current") {
      throw new Error("Reconnect used a stale callback");
    }
    mounted.rerender(
      <SyncStatusProvider
        value={{ ...value, view: { ...value.view, pendingChangeCount: 1 } }}
      >
        {child}
      </SyncStatusProvider>,
    );
    if (renders <= baseline) throw new Error("Pending count update was hidden");
    mounted.unmount();
  });
});
