import { useState } from "react";

interface PositionConfig {
  playerLeft: number;
  playerBottom: number;
  playerHeight: number;
  playerWidth: number;
  enemyRight: number;
  enemyBottom: number;
  enemyHeight: number;
  enemyWidth: number;
  toolLeft: number;
  toolBottom: number;
  toolHeight: number;
  toolWidth: number;
}

const BATTLE_KEY = "mazzang_pos_battle";
const TRAINING_KEY = "mazzang_pos_training";

const BATTLE_DEFAULTS: PositionConfig = {
  playerLeft: 25,
  playerBottom: 0,
  playerHeight: 60,
  playerWidth: 70,
  enemyRight: 25,
  enemyBottom: 0,
  enemyHeight: 60,
  enemyWidth: 70,
  toolLeft: 55,
  toolBottom: 5,
  toolHeight: 50,
  toolWidth: 40,
};

const TRAINING_DEFAULTS: PositionConfig = {
  playerLeft: 30,
  playerBottom: 0,
  playerHeight: 65,
  playerWidth: 70,
  enemyRight: 25,
  enemyBottom: 0,
  enemyHeight: 60,
  enemyWidth: 70,
  toolLeft: 70,
  toolBottom: 5,
  toolHeight: 50,
  toolWidth: 40,
};

function loadConfig(mode: "battle" | "training"): PositionConfig {
  const key = mode === "battle" ? BATTLE_KEY : TRAINING_KEY;
  const defaults = mode === "battle" ? BATTLE_DEFAULTS : TRAINING_DEFAULTS;
  try {
    const raw = localStorage.getItem(key);
    if (raw) return { ...defaults, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return defaults;
}

function saveConfig(mode: "battle" | "training", config: PositionConfig) {
  const key = mode === "battle" ? BATTLE_KEY : TRAINING_KEY;
  localStorage.setItem(key, JSON.stringify(config));
}

export function usePositionConfig(mode: "battle" | "training" = "battle") {
  const [config, setConfig] = useState<PositionConfig>(() => loadConfig(mode));

  const update = (key: keyof PositionConfig, value: number) => {
    setConfig(prev => {
      const next = { ...prev, [key]: value };
      saveConfig(mode, next);
      return next;
    });
  };

  const reset = () => {
    const defaults = mode === "battle" ? BATTLE_DEFAULTS : TRAINING_DEFAULTS;
    const key = mode === "battle" ? BATTLE_KEY : TRAINING_KEY;
    localStorage.removeItem(key);
    setConfig(defaults);
  };

  return { config, update, reset };
}

export function PositionDebugPanel({
  config,
  update,
  mode,
  onReset,
}: {
  config: PositionConfig;
  update: (key: keyof PositionConfig, value: number) => void;
  mode: "battle" | "training";
  onReset?: () => void;
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          position: "fixed",
          top: 50,
          right: 4,
          zIndex: 9999,
          background: "rgba(255,0,0,0.8)",
          color: "#fff",
          border: "none",
          borderRadius: 4,
          padding: "4px 8px",
          fontSize: 11,
          cursor: "pointer",
        }}
      >
        📐
      </button>
    );
  }

  const sliders: { key: keyof PositionConfig; label: string; min: number; max: number }[] =
    mode === "battle"
      ? [
          { key: "playerLeft", label: "주인공 X(중심)%", min: 5, max: 45 },
          { key: "playerBottom", label: "주인공 Bottom%", min: -10, max: 30 },
          { key: "playerHeight", label: "주인공 Height%", min: 20, max: 90 },
          { key: "enemyRight", label: "적 X(중심)%", min: 5, max: 45 },
          { key: "enemyBottom", label: "적 Bottom%", min: -10, max: 30 },
          { key: "enemyHeight", label: "적 Height%", min: 20, max: 90 },
        ]
      : [
          { key: "playerLeft", label: "주인공 X(중심)%", min: 5, max: 60 },
          { key: "playerBottom", label: "주인공 Bottom%", min: -10, max: 30 },
          { key: "playerHeight", label: "주인공 Height%", min: 20, max: 90 },
          { key: "toolLeft", label: "도구 Left%", min: 20, max: 90 },
          { key: "toolBottom", label: "도구 Bottom%", min: -10, max: 30 },
          { key: "toolHeight", label: "도구 Height%", min: 10, max: 70 },
        ];

  return (
    <div
      style={{
        position: "fixed",
        top: 40,
        right: 4,
        zIndex: 9999,
        background: "rgba(0,0,0,0.9)",
        color: "#fff",
        borderRadius: 8,
        padding: 8,
        fontSize: 11,
        width: 200,
        maxHeight: "60vh",
        overflow: "auto",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <strong>위치 조정</strong>
        <button onClick={() => setOpen(false)} style={{ background: "none", border: "none", color: "#fff", cursor: "pointer" }}>✕</button>
      </div>
      {sliders.map(s => (
        <div key={s.key} style={{ marginBottom: 6 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>{s.label}</span>
            <span style={{ color: "#0f0" }}>{config[s.key]}%</span>
          </div>
          <input
            type="range"
            min={s.min}
            max={s.max}
            value={config[s.key]}
            onChange={e => update(s.key, Number(e.target.value))}
            style={{ width: "100%" }}
          />
        </div>
      ))}
      {onReset && (
        <button
          onClick={onReset}
          style={{ width: "100%", marginTop: 6, padding: "4px", background: "#c00", color: "#fff", border: "none", borderRadius: 4, fontSize: 11, cursor: "pointer" }}
        >
          기본값 리셋
        </button>
      )}
      <div style={{ fontSize: 9, color: "#888", marginTop: 4 }}>
        슬라이더 조정 → 실시간 적용 (새로고침 불필요)
      </div>
    </div>
  );
}
