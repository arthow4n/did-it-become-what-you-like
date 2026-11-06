import babel from "@rolldown/plugin-babel";
import { reactCompilerPreset } from "@vitejs/plugin-react";
import type { PluginOption } from "vite";

import { reactCompilerOptions } from "./react-compiler-options.ts";

/** Shared by the application and gallery. */
export function reactCompiler(): PluginOption[] {
  const compiled = new Set<string>();
  const skipped = new Map<string, string>();
  return [
    babel({
      include:
        /[\\/]src[\\/](?:app|features|design-system)[\\/].*\.[jt]sx?(?:$|\?)/,
      exclude: [
        /[\\/]node_modules[\\/]/,
        /\.(?:test|spec)\.[jt]sx?(?:$|\?)/,
        /[\\/]test-support[\\/]/,
      ],
      presets: [reactCompilerPreset({
        ...reactCompilerOptions,
        logger: {
          logEvent(filename, event) {
            if (!("fnLoc" in event)) return;
            const location = `${filename}:${event.fnLoc?.start.line ?? "?"}`;
            if (event.kind === "CompileSuccess") compiled.add(location);
            if (event.kind === "PipelineError") {
              skipped.set(location, event.data);
            }
            if (event.kind === "CompileError" || event.kind === "CompileSkip") {
              skipped.set(
                location,
                event.kind === "CompileError"
                  ? event.detail.reason
                  : event.reason,
              );
            }
          },
        },
      })],
    }),
    {
      name: "react-compiler-summary",
      buildEnd(error) {
        if (!error) {
          for (const [location, reason] of skipped) {
            this.warn(`${location}: ${reason}`);
          }
          this.info(
            `React Compiler: ${compiled.size} functions compiled, ${skipped.size} skipped.`,
          );
        }
      },
    },
  ];
}
