import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  root: "spikes/toolchain",
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      manifest: {
        name: "Deno frontend toolchain proof",
        short_name: "Toolchain proof",
        start_url: ".",
        display: "standalone",
        background_color: "#101315",
        theme_color: "#101315",
        icons: [],
      },
    }),
  ],
  build: {
    outDir: ".tmp/dist",
    emptyOutDir: true,
  },
});
