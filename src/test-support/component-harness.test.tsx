declare const Deno: {
  test(name: string, fn: () => void | Promise<void>): void;
};

import { withComponentHarness } from "./component-harness.tsx";

function assert(
  condition: unknown,
  message = "Expected condition",
): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("component harness supplies isolated accessible DOM primitives", async () => {
  await withComponentHarness(async ({ render, screen, fireEvent, waitFor }) => {
    const { createElement, useState } = await import("react");
    function HarnessFixture() {
      const [count, setCount] = useState(0);
      return createElement(
        "button",
        { type: "button", onClick: () => setCount(count + 1) },
        `Count ${count}`,
      );
    }

    render(createElement(HarnessFixture));
    const button = screen.getByRole("button", { name: "Count 0" });
    fireEvent.click(button);
    await waitFor(() => {
      assert(screen.getByRole("button", { name: "Count 1" }));
    });
  });
});
