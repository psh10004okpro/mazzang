import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { compression } from "vite-plugin-compression2";
import { visualizer } from "rollup-plugin-visualizer";

export default defineConfig(({ mode }) => ({
  // 👇 이 줄을 반드시 추가해야 합니다! (저장소 이름이 mazzang이므로)
  base: "/mazzang/", 

  plugins: [
    react(),
    // Brotli + gzip 압축
    compression({ algorithm: "gzip" }),
    compression({ algorithm: "brotliCompress" }),
    // 번들 분석 (npm run build:analyze)
    mode === "analyze" &&
      visualizer({ open: true, gzipSize: true, brotliSize: true }),
  ].filter(Boolean),

  build: {
    target: "es2020",
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes("node_modules/react-dom") || id.includes("node_modules/react/")) {
            return "vendor-react";
          }
          if (id.includes("node_modules/zustand") || id.includes("node_modules/break_infinity")) {
            return "vendor-game";
          }
        },
      },
    },
    assetsInlineLimit: 4096,
    chunkSizeWarningLimit: 200,
  },

  envPrefix: "VITE_",

  server: {
    host: true,
    port: 3000,
  },
}));
