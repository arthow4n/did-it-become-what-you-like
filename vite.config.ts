import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export const REPOSITORY_BASE_PATH = "/did-it-become-what-you-like/";

export default defineConfig({
  base: REPOSITORY_BASE_PATH,
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      injectRegister: null,
      includeAssets: ["icons/icon-192.svg", "icons/icon-512.svg"],
      manifest: {
        name: "did-it-become-what-you-like foundation",
        short_name: "Expense foundation",
        description: "A local-first expense application foundation fixture.",
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
