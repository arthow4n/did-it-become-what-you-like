import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useRef,
} from "react";
import type { ReactNode } from "react";
import type { SyncConnectionViewModel } from "./types.ts";

export type SyncStatusContextValue = {
  readonly view: SyncConnectionViewModel;
  readonly onOpenSync: () => void;
  readonly onReconnect: () => void;
  readonly notifyLocalMutation: () => void;
  readonly onCheckConnection?: () => void;
};

const SyncStatusContext = createContext<SyncStatusContextValue | null>(null);
const SyncMutationContext = createContext<(() => void) | null>(null);

export function SyncStatusProvider({
  value,
  children,
}: {
  readonly value: SyncStatusContextValue;
  readonly children?: ReactNode;
}) {
  const notifyRef = useRef(value.notifyLocalMutation);
  useLayoutEffect(() => {
    notifyRef.current = value.notifyLocalMutation;
  }, [value.notifyLocalMutation]);
  const notifyLocalMutation = useCallback(() => notifyRef.current(), []);
  return (
    <SyncMutationContext.Provider value={notifyLocalMutation}>
      <SyncStatusContext.Provider value={value}>
        {children}
      </SyncStatusContext.Provider>
    </SyncMutationContext.Provider>
  );
}

export function useSyncStatus(): SyncStatusContextValue | null {
  return useContext(SyncStatusContext);
}

// Save effects need the current action, but do not render synchronization status.
export function useNotifyLocalMutation(): (() => void) | null {
  return useContext(SyncMutationContext);
}
