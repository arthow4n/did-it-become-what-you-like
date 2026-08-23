export type IdFactory = {
  next(label?: string): string;
  peek(label?: string): string;
  count(): number;
};

export function createIdFactory(prefix = "test"): IdFactory {
  let sequence = 0;
  const normalizedPrefix = prefix.trim().replace(/[^a-z0-9-]+/gi, "-") ||
    "test";

  const format = (label: string | undefined, value: number): string => {
    const normalizedLabel = label?.trim().replace(/[^a-z0-9-]+/gi, "-");
    const suffix = normalizedLabel ? `-${normalizedLabel}` : "";
    return `${normalizedPrefix}${suffix}-${String(value).padStart(4, "0")}`;
  };

  return {
    next: (label) => format(label, ++sequence),
    peek: (label) => format(label, sequence + 1),
    count: () => sequence,
  };
}
