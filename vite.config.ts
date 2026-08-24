import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export const REPOSITORY_BASE_PATH = "/did-it-become-what-you-like/";

type CommandOutput = { readonly stdout: Uint8Array };
type DenoLike = {
  readonly Command: new (
    command: string,
    options: {
      readonly args: readonly string[];
      readonly stdout: "piped";
      readonly stderr: "null";
    },
  ) => { readonly outputSync: () => CommandOutput };
};

function buildCommit(): string {
  try {
    const deno = (globalThis as unknown as { readonly Deno?: DenoLike }).Deno;
    if (!deno) return "development";
    const output = new deno.Command("git", {
      args: ["rev-parse", "--short", "HEAD"],
      stdout: "piped",
      stderr: "null",
    }).outputSync();
    const commit = new TextDecoder().decode(output.stdout).trim();
    return commit || "development";
  } catch {
    return "development";
  }
}

const developmentCspBypass: Plugin = {
  name: "development-csp-bypass",
  transformIndexHtml(html, context) {
    if (!context.server) return html;
    return html.replace(
      /<meta\b(?=[^>]*\bhttp-equiv=["']Content-Security-Policy["'])[^>]*>\s*/i,
      "",
    );
  },
};

export default defineConfig({
  base: REPOSITORY_BASE_PATH,
  define: {
    __APP_COMMIT__: JSON.stringify(buildCommit()),
  },
  optimizeDeps: {
    // Automerge's bundled WASM entrypoint must remain a native Vite module;
    // the dependency optimizer's generated wrapper throws during browser init.
    exclude: ["@automerge/automerge"],
  },
  plugins: [
    developmentCspBypass,
    react(),
    VitePWA({
      registerType: "prompt",
      injectRegister: null,
      workbox: {
        // Cache only repository-owned build output and use the cached shell for
        // hash-route launches. No cross-origin runtime cache is configured.
        cleanupOutdatedCaches: true,
        globPatterns: ["**/*"],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: `${REPOSITORY_BASE_PATH}index.html`,
      },
      includeAssets: ["icons/icon-192.svg", "icons/icon-512.svg"],
      manifest: {
        name: "After Midnight · Expenses",
        short_name: "After Midnight",
        description: "A local-first expense app that works offline.",
        start_url: REPOSITORY_BASE_PATH,
        scope: REPOSITORY_BASE_PATH,
        display: "standalone",
        background_color: "#ffffff",
        theme_color: "#ffffff",
        icons: [
          {
            src: `${REPOSITORY_BASE_PATH}icons/icon-192.svg`,
            sizes: "192x192",
            type: "image/svg+xml",
            purpose: "any",
          },
          {
            src: `${REPOSITORY_BASE_PATH}icons/icon-512.svg`,
            sizes: "512x512",
            type: "image/svg+xml",
            purpose: "any maskable",
          },
        ],
      },
    }),
  ],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: false,
  },
});
