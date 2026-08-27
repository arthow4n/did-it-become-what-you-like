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

export async function withComponentHarness<T>(
  callback: (harness: ComponentHarness) => T | Promise<T>,
): Promise<T> {
  const testWindow = new Window({ url: "http://component.test/" });
  const previous = new Map<PropertyKey, unknown>();
  const globals: Record<string, unknown> = {
    window: testWindow,
    document: testWindow.document,
    navigator: testWindow.navigator,
    Document: testWindow.Document,
    Element: testWindow.Element,
    File: testWindow.File,
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
    await new Promise<void>((resolve) => setTimeout(resolve, 25));
    return result;
  } finally {
    for (const [key, value] of previous) {
      Object.assign(globalThis, { [key]: value });
    }
    testWindow.close();
  }
}
