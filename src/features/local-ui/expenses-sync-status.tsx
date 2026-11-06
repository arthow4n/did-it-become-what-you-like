import { Banner, Button, Inline } from "../../design-system/index.ts";
import { SyncStatusIndicator, useSyncStatus } from "../sync-ui/index.ts";

// Keep changing sync status out of the expense list's subscription boundary.
export function ExpensesSyncStatus() {
  const syncStatus = useSyncStatus();
  return syncStatus
    ? (
      <SyncStatusIndicator
        view={syncStatus.view}
        onOpenSync={syncStatus.onOpenSync}
        onReconnect={syncStatus.onReconnect}
      />
    )
    : null;
}

export function ExpensesOfflineNotice({ onCheckConnection }: {
  onCheckConnection?: () => void;
}) {
  const syncStatus = useSyncStatus();
  const checkConnection = onCheckConnection ?? syncStatus?.onCheckConnection;
  return (
    <Banner tone="warning" title="Offline">
      Local browsing and manual entry are available. AI scanning
      {syncStatus?.view.mode === "configured" ? " and Drive sync" : ""}{" "}
      will resume when your connection is restored.
      {checkConnection
        ? (
          <Inline>
            <Button variant="secondary" onPress={checkConnection}>
              Check connection
            </Button>
          </Inline>
        )
        : null}
    </Banner>
  );
}
