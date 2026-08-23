import { Window } from "happy-dom";

export type ComponentHarness = {
  window: Window;
  render: typeof import("@testing-library/react").render;
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
    HTMLElement: testWindow.HTMLElement,
    Node: testWindow.Node,
    Event: testWindow.Event,
    MouseEvent: testWindow.MouseEvent,
    KeyboardEvent: testWindow.KeyboardEvent,
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
    return await callback({
      window: testWindow,
      render,
      screen,
      fireEvent,
      waitFor,
    });
  } finally {
    for (const [key, value] of previous) {
      Object.assign(globalThis, { [key]: value });
    }
    testWindow.close();
  }
}
