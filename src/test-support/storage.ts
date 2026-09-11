export type MemoryStorage = Storage & {
  readonly values: Map<string, string>;
  readonly storage: Storage;
};

export function createMemoryStorage(): MemoryStorage {
  const values = new Map<string, string>();
  const instance = {
    values,
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    key: (index: number) => [...values.keys()][index] ?? null,
    get length() {
      return values.size;
    },
    removeItem: (key: string) => values.delete(key),
    setItem: (key: string, value: string) => values.set(key, value),
  } as unknown as MemoryStorage;

  Object.defineProperty(instance, "storage", {
    value: instance,
    enumerable: true,
    writable: false,
  });

  return instance;
}
