import { reactCompiler } from "./scripts/react-compiler.ts";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export const REPOSITORY_BASE_PATH = "/did-it-become-what-you-like/";

export default defineConfig({
  root: "src/design-system",
  base: REPOSITORY_BASE_PATH,
  plugins: [react(), ...reactCompiler()],
  build: {
    outDir: "../../dist-gallery",
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      input: "gallery.html",
    },
  },
});
