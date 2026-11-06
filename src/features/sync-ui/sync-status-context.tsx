import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";
import type { ReactNode } from "react";
import { shallowEqual } from "@xstate/react";
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
  const actions = useRef(value);
  useLayoutEffect(() => {
    actions.current = value;
  }, [value]);
  const notifyLocalMutation = useCallback(
    () => actions.current.notifyLocalMutation(),
    [],
  );
  const onOpenSync = useCallback(() => actions.current.onOpenSync(), []);
  const onReconnect = useCallback(() => actions.current.onReconnect(), []);
  const onCheckConnection = useCallback(
    () => actions.current.onCheckConnection?.(),
    [],
  );
  // Runtime forms and device projections can update without changing sync status.
  const previousView = useRef(value.view);
  if (!shallowEqual(previousView.current, value.view)) {
    previousView.current = value.view;
  }
  const view = previousView.current;
  const hasCheckConnection = value.onCheckConnection !== undefined;
  const status = useMemo<SyncStatusContextValue>(() => ({
    view,
    onOpenSync,
    onReconnect,
    notifyLocalMutation,
    onCheckConnection: hasCheckConnection ? onCheckConnection : undefined,
  }), [
    view,
    onOpenSync,
    onReconnect,
    notifyLocalMutation,
    hasCheckConnection,
    onCheckConnection,
  ]);
  return (
    <SyncMutationContext.Provider value={notifyLocalMutation}>
      <SyncStatusContext.Provider value={status}>
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
