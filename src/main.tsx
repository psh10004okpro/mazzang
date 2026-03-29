import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// ── 가로 모드 경고 DOM ──
const warn = document.createElement("div");
warn.id = "landscape-warn";
Object.assign(warn.style, {
  display: "none",
  position: "fixed",
  inset: "0",
  zIndex: "10000",
  background: "#1a1a2e",
  color: "#eee",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: "12px",
  fontFamily: "sans-serif",
  textAlign: "center",
  padding: "20px",
});
warn.innerHTML = `
  <div style="font-size:3rem">📱</div>
  <div style="font-size:1.2rem;font-weight:700">세로로 돌려주세요!</div>
  <div style="font-size:0.85rem;color:#a0a0b8">맞짱로는 세로 모드에서 플레이합니다</div>
`;
document.body.appendChild(warn);

// ── 서비스 워커 등록 ──
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // SW 등록 실패 무시 (개발/localhost)
    });
  });
}

// ── 앱 렌더 ──
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
