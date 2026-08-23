declare const Deno: {
  test(name: string, fn: () => void | Promise<void>): void;
};
