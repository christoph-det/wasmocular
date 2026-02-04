/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  base: "./",
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      workbox: {
        // Cache all static assets
        globPatterns: [
          "**/*.{js,css,html,ico,png,svg,webp,wasm,json,woff,woff2}"
        ],
        // Increase the maximum file size for precaching (for WASM files)
        maximumFileSizeToCacheInBytes: 50 * 1024 * 1024 // 50MB
      },
      manifest: {
        name: "WasmOcular",
        short_name: "WasmOcular",
        description: "Repository visualization tool",
        theme_color: "#1a1a1a",
        background_color: "#1a1a1a",
        display: "standalone",
        start_url: "./",
        scope: "./",
        icons: [
          {
            src: "wasmocular-logo.png",
            sizes: "192x192",
            type: "image/png"
          },
          {
            src: "wasmocular-logo.png",
            sizes: "512x512",
            type: "image/png"
          },
          {
            src: "wasmocular-logo.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable"
          }
        ]
      }
    })
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src")
    }
  },
  test: {
    setupFiles: ["./tests/setup.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/workers/wasm-gix-library/**", "src/components/ui/**"]
    }
  }
});
