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
  const previous = new Map<string, PropertyDescriptor | undefined>();
  const globals: Record<string, unknown> = {
    window: testWindow,
    document: testWindow.document,
    navigator: testWindow.navigator,
    localStorage: testWindow.localStorage,
    addEventListener: testWindow.addEventListener.bind(testWindow),
    removeEventListener: testWindow.removeEventListener.bind(testWindow),
    dispatchEvent: testWindow.dispatchEvent.bind(testWindow),
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
    HTMLButtonElement: testWindow.HTMLButtonElement,
    HTMLInputElement: testWindow.HTMLInputElement,
    HTMLSelectElement: testWindow.HTMLSelectElement,
    HTMLTextAreaElement: testWindow.HTMLTextAreaElement,
    FocusEvent: testWindow.FocusEvent,
    CSS: globalThis.CSS ?? {
      escape: (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, "\\$&"),
    },
    requestAnimationFrame: testWindow.requestAnimationFrame,
    cancelAnimationFrame: testWindow.cancelAnimationFrame,
    getComputedStyle: testWindow.getComputedStyle.bind(testWindow),
  };
  for (const [key, value] of Object.entries(globals)) {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, {
      configurable: true,
      writable: true,
      value,
    });
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
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
    testWindow.close();
    release();
  }
}

/**
 * Compatibility wrapper for test suites. `withComponentHarness` establishes
 * all DOM and ARIA globals directly on `globalThis`.
 */
export async function withAriaGlobals<T>(
  windowOrCallback: unknown | (() => T | Promise<T>),
  maybeCallback?: () => T | Promise<T>,
): Promise<T> {
  const callback = typeof windowOrCallback === "function"
    ? windowOrCallback as () => T | Promise<T>
    : maybeCallback!;
  return await callback();
}
