import type { PluginOptions } from "babel-plugin-react-compiler";

/** Safe inference with the memo runtime built into React 19. */
export const reactCompilerOptions = {
  target: "19",
  compilationMode: "infer",
  panicThreshold: "none",
} satisfies PluginOptions;
