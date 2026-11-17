import { execFileSync } from "node:child_process";
import { reactCompiler } from "./scripts/react-compiler.ts";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export const REPOSITORY_BASE_PATH = "/did-it-become-what-you-like/";

function buildCommit(): string {
  try {
    return execFileSync("git", ["rev-parse", "--short", "HEAD"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim() || "development";
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
    ...reactCompiler(),
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
      includeAssets: [
        "icons/icon-192.png",
        "icons/icon-512.png",
        "icons/icon-maskable-512.png",
        "apple-touch-icon.png",
        "favicon.ico",
      ],
      manifest: {
        id: `${REPOSITORY_BASE_PATH}?app=dibwyl`,
        name: "Dibwyl · Expenses",
        short_name: "Dibwyl",
        description: "A local-first expense app that works offline.",
        start_url: REPOSITORY_BASE_PATH,
        scope: REPOSITORY_BASE_PATH,
        display: "standalone",
        background_color: "#101315",
        theme_color: "#101315",
        icons: [
          {
            src: `${REPOSITORY_BASE_PATH}icons/icon-192.png`,
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: `${REPOSITORY_BASE_PATH}icons/icon-512.png`,
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: `${REPOSITORY_BASE_PATH}icons/icon-maskable-512.png`,
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
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
