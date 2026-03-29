import { useState, useCallback, useEffect, useRef, lazy, Suspense } from "react";
import { useGameStore } from "./hooks/useGameStore";
import { useGameLoop } from "./hooks/useGameLoop";
import { WonDisplay } from "./ui/WonDisplay";
import { SceneTransition } from "./ui/SceneTransition";
import { formatCurrency } from "./engine/numberFormat";
import * as sfx from "./engine/soundManager";
import { DevTools } from "./ui/DevTools";
import "./engine/debugLog";
import type { SceneName } from "./engine/types";

// 씬 lazy import (코드 스플리팅)
const TrainingScene = lazy(() => import("./scenes/TrainingScene").then((m) => ({ default: m.TrainingScene })));
const MapScene = lazy(() => import("./scenes/MapScene").then((m) => ({ default: m.MapScene })));
const BattleScene = lazy(() => import("./scenes/BattleScene").then((m) => ({ default: m.BattleScene })));
const UpgradeScene = lazy(() => import("./scenes/UpgradeScene").then((m) => ({ default: m.UpgradeScene })));

const SCENES: Record<SceneName, React.FC> = {
  training: TrainingScene,
  map: MapScene,
  battle: BattleScene,
  upgrade: UpgradeScene,
};

// 하단 네비 탭 정의
const NAV_TABS: { scene: SceneName; icon: string; label: string }[] = [
  { scene: "training", icon: "/assets/ui/icon_punch.webp", label: "수련" },
  { scene: "map", icon: "/assets/ui/icon_star.webp", label: "골목" },
  { scene: "upgrade", icon: "/assets/ui/icon_gem.webp", label: "강화" },
];

export default function App() {
  const { offlineEarnings, dismissOffline } = useGameLoop();
  const scene = useGameStore((s) => s.scene);
  const changeScene = useGameStore((s) => s.changeScene);
  const [muted, setMuted] = useState(sfx.isMuted());

  // iOS AudioContext resume on first touch
  useEffect(() => {
    const handler = () => {
      sfx.ensureAudioResumed();
      document.removeEventListener("pointerdown", handler);
    };
    document.addEventListener("pointerdown", handler, { once: true });
    return () => document.removeEventListener("pointerdown", handler);
  }, []);

  const toggleMute = useCallback(() => {
    const next = !muted;
    setMuted(next);
    sfx.setMuted(next);
  }, [muted]);

  // 오프라인 골드 사운드
  useEffect(() => {
    if (offlineEarnings) sfx.goldPickup();
  }, [offlineEarnings]);

  // PWA 설치 배너
  const [showInstall, setShowInstall] = useState(false);
  const deferredPromptRef = useRef<Event | null>(null);

  useEffect(() => {
    // standalone이면 이미 설치됨
    if (window.matchMedia("(display-mode: standalone)").matches) return;

    const handler = (e: Event) => {
      e.preventDefault();
      deferredPromptRef.current = e;
      setShowInstall(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = useCallback(() => {
    const prompt = deferredPromptRef.current as { prompt?: () => void } | null;
    if (prompt?.prompt) prompt.prompt();
    setShowInstall(false);
  }, []);

  const isBattle = scene === "battle";

  return (
    <div
      onPointerDown={sfx.ensureAudioResumed}
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        maxWidth: 430,
        margin: "0 auto",
        background: "linear-gradient(180deg, var(--bg-primary) 0%, #0d0d1a 100%)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* 상단 원 표시 (배틀 제외 — 배틀은 자체 UI) */}
      {!isBattle && <WonDisplay />}

      {/* 음소거 토글 */}
      <button
        onPointerDown={(e) => {
          e.stopPropagation();
          toggleMute();
        }}
        style={{
          position: "absolute",
          top: 8,
          right: 8,
          zIndex: 110,
          width: 36,
          height: 36,
          borderRadius: "50%",
          border: "none",
          background: "rgba(0,0,0,0.4)",
          color: "var(--text-secondary)",
          fontSize: "1.1rem",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: 0.7,
        }}
      >
        {muted ? "🔇" : "🔊"}
      </button>

      {/* 씬 영역 */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          paddingTop: isBattle ? 0 : 40,
        }}
      >
        <SceneTransition scene={scene} scenes={SCENES} />
      </div>

      {/* 개발자 도구 */}
      <DevTools />

      {/* 하단 네비게이션 (배틀 씬 제외) */}
      {!isBattle && (
        <nav
          style={{
            display: "flex",
            background: "var(--bg-secondary)",
            borderTop: "1px solid rgba(255,255,255,0.08)",
            flexShrink: 0,
          }}
        >
          {NAV_TABS.map((tab) => {
            const active = tab.scene === scene;
            return (
              <button
                key={tab.scene}
                onPointerDown={() => changeScene(tab.scene)}
                style={{
                  flex: 1,
                  minHeight: 56,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 2,
                  border: "none",
                  background: active
                    ? "rgba(255,255,255,0.06)"
                    : "transparent",
                  cursor: "pointer",
                  transition: "background 0.15s",
                  padding: 0,
                }}
              >
                <img
                  src={tab.icon}
                  alt=""
                  style={{
                    width: 30,
                    height: 30,
                    objectFit: "contain",
                    opacity: active ? 1 : 0.5,
                    transition: "opacity 0.15s",
                  }}
                />
                <span
                  style={{
                    fontSize: "0.7rem",
                    fontWeight: 700,
                    color: active
                      ? "var(--text-primary)"
                      : "var(--text-dim)",
                    transition: "color 0.15s",
                  }}
                >
                  {tab.label}
                </span>
                {active && (
                  <div
                    style={{
                      width: 20,
                      height: 2,
                      borderRadius: 1,
                      background: "var(--color-won)",
                      marginTop: 1,
                    }}
                  />
                )}
              </button>
            );
          })}
        </nav>
      )}

      {/* PWA 설치 배너 */}
      {showInstall && (
        <div
          style={{
            position: "absolute",
            bottom: 70,
            left: 12,
            right: 12,
            zIndex: 150,
            background: "var(--bg-surface)",
            borderRadius: "var(--radius-md)",
            padding: "12px 16px",
            display: "flex",
            alignItems: "center",
            gap: 12,
            boxShadow: "var(--shadow-float)",
            border: "1px solid rgba(255,255,255,0.12)",
            animation: "scene-fade-in 0.3s ease-out",
          }}
        >
          <span style={{ fontSize: "1.5rem" }}>📲</span>
          <div style={{ flex: 1, fontSize: "var(--font-sm)" }}>
            <div style={{ fontWeight: 700 }}>홈 화면에 추가</div>
            <div style={{ color: "var(--text-secondary)", fontSize: "0.75rem" }}>
              앱처럼 바로 실행!
            </div>
          </div>
          <button
            onPointerDown={handleInstall}
            style={{
              padding: "6px 14px",
              borderRadius: "var(--radius-md)",
              border: "none",
              background: "var(--color-won)",
              color: "#1a1a2e",
              fontSize: "var(--font-sm)",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            설치
          </button>
          <button
            onPointerDown={() => setShowInstall(false)}
            style={{
              width: 24,
              height: 24,
              border: "none",
              background: "none",
              color: "var(--text-dim)",
              cursor: "pointer",
              fontSize: "0.9rem",
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* 오프라인 복귀 팝업 */}
      {offlineEarnings && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 200,
            background: "rgba(0,0,0,0.8)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            animation: "scene-fade-in 0.3s ease-out",
          }}
        >
          <div
            style={{
              background: "var(--bg-secondary)",
              borderRadius: "var(--radius-lg)",
              padding: "28px 24px",
              maxWidth: 320,
              width: "90%",
              textAlign: "center",
              boxShadow: "0 16px 48px rgba(0,0,0,0.5)",
              border: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            <img src="/assets/ui/icon_gold.webp" alt="" style={{ width: 48, height: 48, marginBottom: 12 }} />
            <div
              style={{
                fontSize: "var(--font-base)",
                color: "var(--text-secondary)",
                marginBottom: 8,
              }}
            >
              자리 비운 동안
            </div>
            <div
              style={{
                fontSize: "var(--font-xl)",
                fontWeight: 800,
                color: "var(--color-won)",
                marginBottom: 16,
              }}
            >
              {formatCurrency(offlineEarnings)} 벌었다!
            </div>
            <button
              onPointerDown={dismissOffline}
              style={{
                width: "100%",
                minHeight: "var(--touch-min)",
                padding: "12px 0",
                borderRadius: "var(--radius-md)",
                border: "none",
                background: "var(--color-won)",
                color: "#1a1a2e",
                fontSize: "var(--font-base)",
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              확인
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
