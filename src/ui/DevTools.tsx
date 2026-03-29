import { useState } from "react";
import { useGameStore } from "../hooks/useGameStore";
import { logBalance } from "../engine/debugLog";

const IS_DEV = import.meta.env.DEV;

export function DevTools() {
  const [open, setOpen] = useState(false);
  const devAddWon = useGameStore((s) => s.devAddWon);
  const devClearAll = useGameStore((s) => s.devClearAll);
  const reset = useGameStore((s) => s.reset);

  if (!IS_DEV) return null;

  if (!open) {
    return (
      <button
        onPointerDown={() => setOpen(true)}
        style={{
          position: "absolute",
          bottom: 60,
          right: 4,
          zIndex: 999,
          width: 28,
          height: 28,
          borderRadius: "50%",
          border: "none",
          background: "rgba(255,255,255,0.08)",
          color: "var(--text-dim)",
          fontSize: "0.7rem",
          cursor: "pointer",
          opacity: 0.4,
        }}
      >
        🛠
      </button>
    );
  }

  const btn = (label: string, fn: () => void) => (
    <button
      onPointerDown={(e) => {
        e.stopPropagation();
        fn();
      }}
      style={{
        padding: "6px 10px",
        borderRadius: 4,
        border: "1px solid rgba(255,255,255,0.15)",
        background: "rgba(255,255,255,0.1)",
        color: "#eee",
        fontSize: "0.75rem",
        cursor: "pointer",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </button>
  );

  return (
    <div
      style={{
        position: "absolute",
        bottom: 60,
        right: 4,
        zIndex: 999,
        background: "rgba(0,0,0,0.9)",
        borderRadius: 8,
        padding: 8,
        display: "flex",
        flexDirection: "column",
        gap: 4,
        border: "1px solid rgba(255,255,255,0.15)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: "0.7rem", color: "var(--text-dim)" }}>DEV</span>
        <button
          onPointerDown={() => setOpen(false)}
          style={{
            width: 20,
            height: 20,
            border: "none",
            background: "none",
            color: "var(--text-dim)",
            cursor: "pointer",
            fontSize: "0.8rem",
          }}
        >
          ✕
        </button>
      </div>
      {btn("💰 +1만원", () => devAddWon(10000))}
      {btn("🗺️ 전체 클리어", () => devClearAll())}
      {btn("📊 밸런스 로그", () => logBalance())}
      {btn("🗑️ 리셋", () => {
        if (confirm("정말 리셋?")) reset();
      })}
    </div>
  );
}
