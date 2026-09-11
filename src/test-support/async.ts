export async function settle(turns = 16): Promise<void> {
  for (let turn = 0; turn < turns; turn += 1) {
    for (let index = 0; index < 8; index += 1) {
      await Promise.resolve();
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
  for (let turn = 0; turn < 8; turn += 1) {
    await Promise.resolve();
  }
}

export type StateSnapshot = {
  readonly value: unknown;
  readonly status?: unknown;
  readonly context?: { readonly error?: unknown };
};

export type ActorWithSnapshot = {
  getSnapshot(): StateSnapshot | { value: unknown };
};

export async function waitForActorState(
  actor: ActorWithSnapshot,
  expected: string,
  maxAttempts = 12,
): Promise<void> {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    await settle();
    const snapshot = actor.getSnapshot();
    if (snapshot.value === expected) return;
  }
  const snapshot = actor.getSnapshot();
  throw new Error(
    `Expected actor state "${expected}", got ${
      JSON.stringify(snapshot.value ?? snapshot)
    }`,
  );
}

export async function waitFor(
  predicate: () => boolean,
  message = "Condition not met",
  maxAttempts = 50,
): Promise<void> {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (predicate()) return;
    for (let index = 0; index < 8; index += 1) {
      await Promise.resolve();
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
  if (predicate()) return;
  throw new Error(message);
}

export async function assertRejects(
  operation: () => unknown | Promise<unknown>,
  expected?: string | ((error: unknown) => boolean),
): Promise<unknown> {
  try {
    await operation();
  } catch (error) {
    if (typeof expected === "function") {
      if (!expected(error)) {
        throw new Error(
          `Expected error to satisfy predicate, got ${String(error)}`,
        );
      }
    } else if (typeof expected === "string") {
      const code = (error as { readonly code?: unknown })?.code;
      const message = error instanceof Error ? error.message : String(error);
      if (code !== expected && !message.includes(expected)) {
        throw new Error(
          `Expected error code to be "${expected}" or message to include "${expected}", got code="${
            String(code)
          }" message="${message}"`,
        );
      }
    }
    return error;
  }
  throw new Error("Expected operation to reject");
}
