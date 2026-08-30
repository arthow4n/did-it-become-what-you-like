import { createContext, useContext } from "react";
import type { ReactNode } from "react";
import type { SyncConnectionViewModel } from "./types.ts";

export type SyncStatusContextValue = {
  readonly view: SyncConnectionViewModel;
  readonly onOpenSync: () => void;
  readonly onReconnect: () => void;
  readonly notifyLocalMutation: () => void;
};

const SyncStatusContext = createContext<SyncStatusContextValue | null>(null);

export function SyncStatusProvider({
  value,
  children,
}: {
  readonly value: SyncStatusContextValue;
  readonly children?: ReactNode;
}) {
  return (
    <SyncStatusContext.Provider value={value}>
      {children}
    </SyncStatusContext.Provider>
  );
}

export function useSyncStatus(): SyncStatusContextValue | null {
  return useContext(SyncStatusContext);
}
