import { useCallback, useRef, useState } from "react";
import { useGameStore } from "../hooks/useGameStore";
import { formatNumber } from "../engine/numberFormat";
import { ProgressBar } from "../ui/ProgressBar";
import { StatDisplay } from "../ui/StatDisplay";
import { BACKGROUNDS, PLAYER_FRAMES, toolFrame, ICONS } from "../engine/assetPaths";
import { usePositionConfig, PositionDebugPanel } from "../ui/PositionDebug";
import type { ToolTier } from "../engine/types";
import * as sfx from "../engine/soundManager";

// ── 도구 이름 ──
const TOOL_NAMES: Record<ToolTier, string> = {
  1: "나무 판자",
  2: "샌드백",
  3: "목인장",
  4: "철제 목인장",
  5: "영혼 목인장",
};

export function TrainingScene() {
  // ── 셀렉터 ──
  const punch = useGameStore((s) => s.player.punch);
  const kick = useGameStore((s) => s.player.kick);
  const hp = useGameStore((s) => s.player.hp);
  const maxHp = useGameStore((s) => s.player.maxHp);
  const evasion = useGameStore((s) => s.player.evasion);
  const toolTier = useGameStore((s) => s.training.toolTier);
  const durability = useGameStore((s) => s.training.toolDurability);
  const maxDurability = useGameStore((s) => s.training.toolMaxDurability);
  const autoActive = useGameStore((s) => s.training.autoAttackActive);
  const autoTimeLeft = useGameStore((s) => s.training.autoAttackTimeLeft);
  const processTrainingTap = useGameStore((s) => s.processTrainingTap);
  const toggleAutoAttack = useGameStore((s) => s.toggleAutoAttack);
  const addAutoAttackTime = useGameStore((s) => s.addAutoAttackTime);

  // ── 로컬 상태 ──
  const [toolShake, setToolShake] = useState(false);
  const [flashVisible, setFlashVisible] = useState(false);
  const [adCooldown, setAdCooldown] = useState(false);
  const [playerAnim, setPlayerAnim] = useState<"idle" | "punch">("idle");
  const [toolHit, setToolHit] = useState(false);
  const toolRef = useRef<HTMLDivElement>(null);
  const { config: pos, update: posUpdate, reset: posReset } = usePositionConfig("training");

  // ── 탭 핸들러 ──
  const handleTap = useCallback(() => {
    const result = processTrainingTap();
    if (!result) return;

    sfx.punch();

    // 주인공 펀치 모션
    setPlayerAnim("punch");
    setTimeout(() => setPlayerAnim("idle"), 200);

    // 도구 타격 반응
    setToolHit(true);
    setToolShake(true);
    setTimeout(() => {
      setToolHit(false);
      setToolShake(false);
    }, 150);

    // 도구 파괴 이펙트
    if (result.toolBroken) {
      sfx.toolBreak();
      sfx.goldPickup();
      setFlashVisible(true);
      setTimeout(() => setFlashVisible(false), 300);
    }
  }, [processTrainingTap]);

  // ── 광고 시청 (3초 대기 시뮬레이션) ──
  const handleWatchAd = useCallback(() => {
    if (adCooldown) return;
    setAdCooldown(true);
    setTimeout(() => {
      addAutoAttackTime(180);
      setAdCooldown(false);
    }, 3000);
  }, [addAutoAttackTime, adCooldown]);

  const autoMinutes = Math.floor(autoTimeLeft / 60);
  const autoSeconds = Math.floor(autoTimeLeft % 60);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        touchAction: "none",
      }}
    >
      {/* 메인 탭 영역 */}
      <div
        ref={toolRef}
        onPointerDown={handleTap}
        style={{
          flex: 1,
          position: "relative",
          backgroundImage: `url(${BACKGROUNDS.training})`,
          backgroundSize: "cover",
          backgroundPosition: "center bottom",
          cursor: "pointer",
        }}
      >
        {/* 파괴 플래시 */}
        {flashVisible && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(255,215,0,0.3)",
              zIndex: 10,
              pointerEvents: "none",
              animation: "scene-fade-out 0.3s ease-out forwards",
            }}
          />
        )}

        {/* 주인공 — 중심점 기준, height로 크기 */}
        <img
          src={playerAnim === "punch" ? PLAYER_FRAMES.punchRight : PLAYER_FRAMES.idle}
          alt=""
          draggable={false}
          style={{
            position: "absolute",
            left: `${pos.playerLeft}%`,
            bottom: `${pos.playerBottom}%`,
            height: `${pos.playerHeight}%`,
            width: "auto",
            transform: `translateX(-50%) ${playerAnim === "punch" ? "translateX(10%)" : ""}`,
            transition: "transform 0.1s",
          }}
        />
        {/* 도구 — 중심점 기준, height로 크기 */}
        <img
          src={toolFrame(toolTier)}
          alt=""
          draggable={false}
          style={{
            position: "absolute",
            left: `${pos.toolLeft}%`,
            bottom: `${pos.toolBottom}%`,
            height: `${pos.toolHeight}%`,
            width: "auto",
            transform: `translateX(-50%) ${toolHit ? "rotate(3deg) scale(1.05)" : ""}`,
            transition: "transform 0.08s, filter 0.08s",
            filter: toolHit ? "brightness(1.5)" : "none",
          }}
        />

        {/* 탭 안내 */}
        <div
          style={{
            position: "absolute",
            bottom: "3%",
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(0,0,0,0.5)",
            padding: "6px 16px",
            borderRadius: 20,
            fontSize: "var(--font-sm)",
            color: "var(--text-secondary)",
            pointerEvents: "none",
          }}
        >
          탭해서 수련!
        </div>

        {/* 내구도 바 */}
        <div style={{ width: "100%", maxWidth: 280 }}>
          <ProgressBar
            value={durability}
            max={maxDurability}
            color="var(--color-upgrade)"
            height={16}
            label={`${formatNumber(durability)} / ${formatNumber(maxDurability)}`}
          />
          <div
            style={{
              textAlign: "center",
              fontSize: "var(--font-sm)",
              color: "var(--text-secondary)",
              marginTop: 4,
            }}
          >
            등급 {toolTier} · {TOOL_NAMES[toolTier]}
          </div>
        </div>
      </div>

      {/* 스탯 패널 */}
      <div
        style={{
          padding: "12px 20px",
          background: "var(--bg-secondary)",
          borderTop: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "6px 16px",
          }}
        >
          <StatDisplay icon={ICONS.punch} label="펀치" value={punch} color="var(--color-punch)" />
          <StatDisplay icon={ICONS.kick} label="킥" value={kick} color="var(--color-kick)" />
          <StatDisplay icon={ICONS.hp} label="체력" value={hp} color="var(--color-hp)" />
          <StatDisplay
            icon={ICONS.star}
            label="동체시력"
            value={Math.round(evasion * 1000) / 10}
            color="var(--color-gem)"
          />
        </div>
        {/* HP 바 */}
        <div style={{ marginTop: 8 }}>
          <ProgressBar
            value={hp}
            max={maxHp}
            color="var(--color-hp)"
            height={10}
          />
        </div>
      </div>

      {/* 자동 공격 패널 */}
      <div
        style={{
          padding: "12px 20px 20px",
          background: "var(--bg-secondary)",
          display: "flex",
          flexDirection: "column",
          gap: 8,
          alignItems: "center",
        }}
      >
        <button
          onPointerDown={toggleAutoAttack}
          style={{
            width: "100%",
            minHeight: "var(--touch-min)",
            padding: "10px 16px",
            borderRadius: "var(--radius-md)",
            border: "none",
            background: autoActive
              ? "var(--color-hp)"
              : "rgba(255,255,255,0.1)",
            color: autoActive ? "#fff" : "var(--text-secondary)",
            fontSize: "var(--font-base)",
            fontWeight: 700,
            cursor: "pointer",
            transition: "background 0.2s",
          }}
        >
          자동 공격: {autoActive ? "ON" : "OFF"}
        </button>

        {autoTimeLeft > 0 && (
          <span style={{ fontSize: "var(--font-sm)", color: "var(--text-secondary)" }}>
            남은 시간: {autoMinutes}분 {autoSeconds.toString().padStart(2, "0")}초
          </span>
        )}

        <button
          onPointerDown={handleWatchAd}
          disabled={adCooldown}
          style={{
            width: "100%",
            minHeight: "var(--touch-min)",
            padding: "10px 16px",
            borderRadius: "var(--radius-md)",
            border: "2px dashed rgba(255,255,255,0.2)",
            background: adCooldown
              ? "rgba(255,255,255,0.05)"
              : "rgba(255,215,0,0.1)",
            color: adCooldown ? "var(--text-dim)" : "var(--color-won)",
            fontSize: "var(--font-sm)",
            fontWeight: 600,
            cursor: adCooldown ? "not-allowed" : "pointer",
            opacity: adCooldown ? 0.5 : 1,
          }}
        >
          {adCooldown ? "광고 시청 중..." : "📺 광고 시청 +3분"}
        </button>
      </div>

      {/* 위치 디버그 패널 */}
      <PositionDebugPanel config={pos} update={posUpdate} mode="training" onReset={posReset} />
    </div>
  );
}
