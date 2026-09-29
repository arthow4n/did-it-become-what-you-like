import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import {
  type AnyActorLogic,
  createActor,
  type Snapshot,
  type SnapshotFrom,
} from "xstate";
import type { FileSharePort } from "../../adapters/ports/index.ts";
import { type StableId, StableIdSchema } from "../../domain/index.ts";
import {
  type DestructionStorage,
  isDestructionStorage,
} from "../../domain/destruction.ts";

export type RuntimeIds = {
  readonly next: (kind: string) => StableId;
};

export function createRuntimeIds(): RuntimeIds {
  let sequence = 0;
  return {
    next: (kind) => {
      sequence += 1;
      const suffix = globalThis.crypto?.randomUUID?.() ??
        `${Date.now()}-${sequence}`;
      return StableIdSchema.parse(`${kind}-${suffix}`);
    },
  };
}

export const runtimeClock = {
  now: () => new Date().toISOString(),
  delay: async (milliseconds: number, options?: { signal?: AbortSignal }) => {
    if (options?.signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }
    await new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
  },
};

export function createBrowserFileShare(): FileSharePort {
  const save = async (payload: {
    readonly name: string;
    readonly mimeType: string;
    readonly bytes: Uint8Array;
  }): Promise<void> => {
    if (
      globalThis.document === undefined ||
      globalThis.URL?.createObjectURL === undefined
    ) {
      throw { code: "unavailable" };
    }
    const blob = new Blob([payload.bytes.slice().buffer as ArrayBuffer], {
      type: payload.mimeType,
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = payload.name;
    anchor.click();
    URL.revokeObjectURL(url);
    await Promise.resolve();
  };

  return {
    save,
    share: async (payload) => {
      const share = globalThis.navigator?.share;
      if (typeof share !== "function" || payload.file === undefined) {
        throw { code: "unsupported" };
      }
      const file = new File(
        [payload.file.bytes.slice().buffer as ArrayBuffer],
        payload.file.name,
        { type: payload.file.mimeType },
      );
      if (
        typeof globalThis.navigator.canShare === "function" &&
        !globalThis.navigator.canShare({ files: [file] })
      ) {
        throw { code: "unsupported" };
      }
      await share.call(globalThis.navigator, {
        title: payload.title,
        files: [file],
      });
      return "shared";
    },
  };
}

export async function saveDestructionSafetyExport(
  json: string,
): Promise<void> {
  const bytes = new TextEncoder().encode(json);
  await createBrowserFileShare().save({
    name: "did-it-become-what-you-like-delete-everywhere-safety.json",
    mimeType: "application/json",
    bytes,
  });
}

export function destructionStorage(): DestructionStorage | undefined {
  try {
    return isDestructionStorage(globalThis.localStorage)
      ? globalThis.localStorage
      : undefined;
  } catch {
    return undefined;
  }
}

export function useRestartableActor<TLogic extends AnyActorLogic>(
  logic: TLogic,
  restartKey: number,
  initialSnapshot?: Snapshot<unknown>,
): [SnapshotFrom<TLogic>, ReturnType<typeof createActor<TLogic>>["send"]] {
  const actor = useMemo(
    () =>
      createActor(
        logic,
        initialSnapshot === undefined
          ? undefined
          : ({ snapshot: initialSnapshot } as never),
      ),
    [initialSnapshot, logic, restartKey],
  );
  useEffect(() => {
    actor.start();
    return () => {
      actor.stop();
    };
  }, [actor]);
  const subscribe = useCallback(
    (listener: () => void) => {
      const subscription = actor.subscribe(listener);
      return () => subscription.unsubscribe();
    },
    [actor],
  );
  const getSnapshot = useCallback(() => actor.getSnapshot(), [actor]);
  return [
    useSyncExternalStore(subscribe, getSnapshot, getSnapshot),
    actor.send,
  ];
}
