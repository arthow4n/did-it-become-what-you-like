export type TestClock = {
  now(): Date;
  nowIso(): string;
  advance(milliseconds: number): Date;
  set(value: string | number | Date): Date;
  sleep(milliseconds: number): Promise<void>;
};

export function createTestClock(
  initial: string | number | Date = "2026-01-01T00:00:00.000Z",
): TestClock {
  let current = toMilliseconds(initial);

  return {
    now: () => new Date(current),
    nowIso: () => new Date(current).toISOString(),
    advance: (milliseconds) => {
      if (!Number.isFinite(milliseconds) || milliseconds < 0) {
        throw new Error("Test clock advances must be finite and non-negative.");
      }
      current += milliseconds;
      return new Date(current);
    },
    set: (value) => {
      current = toMilliseconds(value);
      return new Date(current);
    },
    sleep: (milliseconds) => {
      if (!Number.isFinite(milliseconds) || milliseconds < 0) {
        throw new Error("Test clock sleeps must be finite and non-negative.");
      }
      current += milliseconds;
      return Promise.resolve();
    },
  };
}

function toMilliseconds(value: string | number | Date): number {
  const milliseconds = value instanceof Date
    ? value.getTime()
    : typeof value === "number"
    ? value
    : Date.parse(value);
  if (!Number.isFinite(milliseconds)) {
    throw new Error(`Invalid deterministic clock value: ${String(value)}`);
  }
  return milliseconds;
}
