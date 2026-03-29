import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { compression } from "vite-plugin-compression2";
import { visualizer } from "rollup-plugin-visualizer";

export default defineConfig(({ mode }) => ({
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
    // 에셋 인라인 임계치 (4KB 이하 인라인)
    assetsInlineLimit: 4096,
    // 청크 크기 경고 임계치
    chunkSizeWarningLimit: 200,
  },

  // 환경 변수 접두사
  envPrefix: "VITE_",

  // 개발 서버
  server: {
    host: true, // 네트워크 접근 허용 (모바일 테스트)
    port: 3000,
  },
}));
