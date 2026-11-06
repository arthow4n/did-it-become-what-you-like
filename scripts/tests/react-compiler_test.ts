/// <reference path="../deno.d.ts" />
// @deno-types="@types/babel__core"
import { transformSync } from "@babel/core";
import compiler from "babel-plugin-react-compiler";
import jsx from "@babel/plugin-transform-react-jsx";
import { createElement } from "react";
import { createActor, fromTransition } from "xstate";
import { withComponentHarness } from "../../src/test-support/component-harness.tsx";
import { reactCompilerOptions } from "../react-compiler-options.ts";

function compile(source: string, filename: string): string {
  const result = transformSync(source, {
    filename,
    configFile: false,
    babelrc: false,
    parserOpts: { plugins: ["typescript", "jsx"] },
    plugins: [[compiler, reactCompilerOptions], [jsx, {
      runtime: "automatic",
    }]],
  });
  if (!result?.code) {
    throw new Error(`Compiler produced no code for ${filename}`);
  }
  return result.code;
}

Deno.test("React Compiler transforms a real shared expense component for React 19", async () => {
  const path = "src/design-system/components/domain/expense-row.tsx";
  const result = compile(await Deno.readTextFile(path), path);
  if (!result.includes("react/compiler-runtime")) {
    throw new Error("ExpenseRow did not receive automatic memoization");
  }
});

Deno.test("compiled components preserve actor updates while reusing unchanged child JSX", async () => {
  const source = `
    import { useSelector } from "@xstate/react";
    let renders = 0;
    function Child() {
      "use no memo";
      renders += 1;
      return <span>Unchanged child</span>;
    }
    export function Probe({ actor }) {
      const count = useSelector(actor, snapshot => snapshot.context.count);
      return <><output>{count}</output><Child /><button onClick={() => actor.send({ type: "increment" })}>Increment</button></>;
    }
    export function childRenders() { return renders; }
  `;
  const compiled = compile(source, "src/compiler-probe.tsx");
  if (!compiled.includes("react/compiler-runtime")) {
    throw new Error("Probe was not compiled");
  }
  const probe = await import(
    `data:text/javascript;charset=utf-8,${encodeURIComponent(compiled)}`
  );
  const actor = createActor(
    fromTransition(
      (context, _event: { type: "increment" }) => ({
        count: context.count + 1,
      }),
      { count: 0 },
    ),
  ).start();
  try {
    await withComponentHarness(({ render, fireEvent }) => {
      const mounted = render(createElement(probe.Probe, { actor }));
      try {
        if (mounted.getByRole("status").textContent !== "0") {
          throw new Error("Initial actor snapshot missing");
        }
        const before = probe.childRenders();
        fireEvent.click(mounted.getByRole("button", { name: "Increment" }));
        if (mounted.getByRole("status").textContent !== "1") {
          throw new Error("Compiler cached a stale actor snapshot");
        }
        if (probe.childRenders() !== before) {
          throw new Error("Compiler did not reuse unchanged child JSX");
        }
      } finally {
        mounted.unmount();
      }
    });
  } finally {
    actor.stop();
  }
});
