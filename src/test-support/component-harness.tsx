import { Window } from "happy-dom";
import { createElement } from "react";
import { DesignSystemProvider } from "../design-system/provider.tsx";

export type ComponentHarness = {
  window: Window;
  render: typeof import("@testing-library/react").render;
  renderBare: typeof import("@testing-library/react").render;
  screen: typeof import("@testing-library/react").screen;
  fireEvent: typeof import("@testing-library/react").fireEvent;
  waitFor: typeof import("@testing-library/react").waitFor;
};

let harnessTurn = Promise.resolve();

async function acquireHarnessTurn(): Promise<() => void> {
  const previousTurn = harnessTurn;
  let release!: () => void;
  harnessTurn = new Promise<void>((resolve) => release = resolve);
  await previousTurn;
  return release;
}

export async function withComponentHarness<T>(
  callback: (harness: ComponentHarness) => T | Promise<T>,
): Promise<T> {
  const release = await acquireHarnessTurn();
  const testWindow = new Window({ url: "http://component.test/" });
  const previous = new Map<PropertyKey, unknown>();
  const globals: Record<string, unknown> = {
    window: testWindow,
    document: testWindow.document,
    navigator: testWindow.navigator,
    Document: testWindow.Document,
    Element: testWindow.Element,
    File: testWindow.File,
    HTMLAnchorElement: testWindow.HTMLAnchorElement,
    HTMLElement: testWindow.HTMLElement,
    MutationObserver: testWindow.MutationObserver,
    Node: testWindow.Node,
    NodeFilter: testWindow.NodeFilter,
    ResizeObserver: testWindow.ResizeObserver,
    ShadowRoot: testWindow.ShadowRoot,
    SVGElement: testWindow.SVGElement,
    Event: testWindow.Event,
    MouseEvent: testWindow.MouseEvent,
    KeyboardEvent: testWindow.KeyboardEvent,
    requestAnimationFrame: testWindow.requestAnimationFrame,
    cancelAnimationFrame: testWindow.cancelAnimationFrame,
    getComputedStyle: testWindow.getComputedStyle.bind(testWindow),
  };
  for (const [key, value] of Object.entries(globals)) {
    previous.set(key, globalThis[key as keyof typeof globalThis]);
    Object.assign(globalThis, { [key]: value });
  }

  try {
    const { fireEvent, render, screen, waitFor } = await import(
      "@testing-library/react"
    );
    const renderWithProvider = ((
      ui: Parameters<typeof render>[0],
      options?: Parameters<typeof render>[1],
    ) =>
      render(ui, {
        ...(options ?? {}),
        wrapper: ({ children }) =>
          createElement(DesignSystemProvider, null, children),
      })) as typeof render;
    const result = await callback({
      window: testWindow,
      render: renderWithProvider,
      renderBare: render,
      screen,
      fireEvent,
      waitFor,
    });
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    await new Promise<void>((resolve) => setTimeout(resolve, 100));
    return result;
  } finally {
    for (const [key, value] of previous) {
      Object.assign(globalThis, { [key]: value });
    }
    testWindow.close();
    release();
  }
}

export async function withAriaGlobals<T>(
  windowOrCallback: unknown | (() => T | Promise<T>),
  maybeCallback?: () => T | Promise<T>,
): Promise<T> {
  const callback = typeof windowOrCallback === "function"
    ? windowOrCallback as () => T | Promise<T>
    : maybeCallback!;
  const testWindow = typeof windowOrCallback === "function"
    ? (globalThis as unknown as { window?: { [key: string]: unknown } }).window
    : windowOrCallback as { [key: string]: unknown };
  if (!testWindow) return await callback();
  const names = [
    "HTMLButtonElement",
    "FocusEvent",
    "HTMLInputElement",
    "MutationObserver",
    "NodeFilter",
    "requestAnimationFrame",
    "cancelAnimationFrame",
    "HTMLSelectElement",
    "SVGElement",
    "HTMLTextAreaElement",
  ] as const;
  const previous = new Map<string, unknown>();
  const previousCss = globalThis.CSS;
  for (const name of names) {
    previous.set(name, globalThis[name as keyof typeof globalThis]);
    Object.assign(globalThis, { [name]: testWindow[name] });
  }
  Object.assign(globalThis, {
    CSS: previousCss ?? {
      escape: (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, "\\$&"),
    },
  });
  try {
    return await callback();
  } finally {
    for (const [name, value] of previous) {
      Object.assign(globalThis, { [name]: value });
    }
    Object.assign(globalThis, { CSS: previousCss });
  }
}
