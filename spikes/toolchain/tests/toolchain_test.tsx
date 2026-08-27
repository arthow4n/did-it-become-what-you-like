/// <reference path="../deno.d.ts" />

import { assertEquals, assertStringIncludes } from "../assert.ts";
import { Window } from "happy-dom";

const testWindow = new Window({ url: "http://localhost/" });
Object.assign(globalThis, {
  window: testWindow,
  document: testWindow.document,
  navigator: testWindow.navigator,
  HTMLElement: testWindow.HTMLElement,
  Node: testWindow.Node,
  Event: testWindow.Event,
  MouseEvent: testWindow.MouseEvent,
  KeyboardEvent: testWindow.KeyboardEvent,
  getComputedStyle: testWindow.getComputedStyle.bind(testWindow),
});

const { fireEvent, render, screen, waitFor } = await import(
  "@testing-library/react"
);
const { proofAmount, proofSchema, ToolchainProof } = await import(
  "../src/compatibility.tsx"
);

Deno.test("the toolchain renders an accessible native button and handles its click", async () => {
  render(<ToolchainProof />);

  const button = screen.getByRole("button", {
    name: "Increment proof counter",
  });
  assertStringIncludes(button.textContent ?? "", "Count 0");

  fireEvent.click(button);

  await waitFor(() =>
    assertStringIncludes(button.textContent ?? "", "Count 1")
  );
  assertEquals(button.getAttribute("type"), "button");
});

Deno.test("Zod 4 and big.js preserve the proof value", () => {
  assertEquals(proofAmount, "0.3");
  const parsed = proofSchema.parse({ amount: proofAmount, currency: "SEK" });
  assertEquals(parsed.amount, "0.3");
  assertEquals(parsed.currency, "SEK");
});
