import { memo } from "react";
import Decimal from "break_infinity.js";
import { useGameStore } from "../hooks/useGameStore";
import { formatNumber, formatCurrency } from "../engine/numberFormat";
import { minionHp, bossHp, passiveIncome } from "../engine/formulas";
import { ICONS, battleBg, bossFrame, sceneBg } from "../engine/assetPaths";

const TOTAL_ALLEYS = 5;

export function MapScene() {
  const clearedAlleys = useGameStore((s) => s.meta.clearedAlleys);
  const startBattle = useGameStore((s) => s.startBattle);

  const totalPassive = passiveIncome(clearedAlleys);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        touchAction: "none",
      }}
    >
      {/* 헤더 */}
      <div style={{ padding: "8px 16px 0" }}>
        <h2
          style={{
            textAlign: "center",
            fontSize: "var(--font-xl)",
            fontWeight: 800,
            margin: "12px 0 4px",
            color: "var(--text-primary)",
          }}
        >
          골목의 왕이 되어라
        </h2>
      </div>

      {/* 골목 리스트 */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "8px 16px 16px",
          touchAction: "pan-y",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        {Array.from({ length: TOTAL_ALLEYS }, (_, i) => {
          const alley = i + 1;
          const cleared = clearedAlleys.includes(alley);
          const prevCleared = alley === 1 || clearedAlleys.includes(alley - 1);
          const locked = !cleared && !prevCleared;

          return (
            <AlleyCard
              key={alley}
              alley={alley}
              cleared={cleared}
              locked={locked}
              onChallenge={() => {
                startBattle(alley);
              }}
            />
          );
        })}
      </div>

      {/* 하단 패시브 요약 */}
      <div
        style={{
          padding: "12px 16px 20px",
          background: "var(--bg-secondary)",
          borderTop: "1px solid rgba(255,255,255,0.08)",
          textAlign: "center",
        }}
      >
        <span style={{ fontSize: "var(--font-sm)", color: "var(--text-secondary)" }}>
          총 패시브 수입
        </span>
        <div
          style={{
            fontSize: "var(--font-lg)",
            fontWeight: 700,
            color: "var(--color-won)",
            marginTop: 2,
          }}
        >
          {totalPassive.gt(0) ? `${formatCurrency(totalPassive)}/분` : "없음"}
        </div>
      </div>
    </div>
  );
}

// ── 골목 카드 (memo) ──
const AlleyCard = memo(function AlleyCard({
  alley,
  cleared,
  locked,
  onChallenge,
}: {
  alley: number;
  cleared: boolean;
  locked: boolean;
  onChallenge: () => void;
}) {
  const mHp = minionHp(alley);
  const bHp = bossHp(alley);
  const alleyPassive = new Decimal(alley).mul(5);

  // 공통 카드 스타일: 배경 썸네일
  const cardBg = {
    backgroundImage: `linear-gradient(to right, rgba(0,0,0,0.85) 55%, rgba(0,0,0,0.3)), url(${battleBg(alley)})`,
    backgroundSize: "cover",
    backgroundPosition: "center",
  };

  // 잠김
  if (locked) {
    return (
      <div
        style={{
          ...cardBg,
          padding: "14px 16px",
          borderRadius: "var(--radius-md)",
          border: "1px solid rgba(255,255,255,0.05)",
          opacity: 0.45,
          filter: "grayscale(1)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: "1.3rem" }}>🔒</span>
          <span style={{ fontWeight: 700, fontSize: "var(--font-base)" }}>골목 {alley}</span>
        </div>
        <div style={{ fontSize: "var(--font-sm)", color: "var(--text-dim)", marginTop: 4 }}>
          이전 골목을 클리어하세요
        </div>
      </div>
    );
  }

  // 클리어됨
  if (cleared) {
    return (
      <div
        style={{
          ...cardBg,
          padding: "14px 16px",
          borderRadius: "var(--radius-md)",
          border: "1px solid rgba(83,215,105,0.25)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <img src={ICONS.star} alt="" style={{ width: 28, height: 28, objectFit: "contain" }} />
          <span style={{ fontWeight: 700, fontSize: "var(--font-base)" }}>골목 {alley}</span>
          <span style={{ marginLeft: "auto", fontSize: "var(--font-sm)", color: "var(--color-hp)", fontWeight: 600 }}>클리어</span>
        </div>
        <div style={{ fontSize: "var(--font-sm)", color: "var(--color-won)", marginTop: 4 }}>
          패시브: {formatCurrency(alleyPassive)}/분
        </div>
      </div>
    );
  }

  // 도전 가능
  return (
    <div
      style={{
        ...cardBg,
        padding: "14px 16px",
        borderRadius: "var(--radius-md)",
        border: "1px solid rgba(233,69,96,0.3)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <img
          src={bossFrame(alley, "idle")}
          alt=""
          style={{ width: 40, height: 40, objectFit: "contain", borderRadius: "50%", background: "rgba(0,0,0,0.5)" }}
        />
        <div>
          <span style={{ fontWeight: 700, fontSize: "var(--font-base)", display: "block" }}>골목 {alley}</span>
          <div style={{ display: "flex", gap: 8, fontSize: "var(--font-sm)", color: "var(--text-secondary)", marginTop: 2 }}>
            <span>잡졸 {formatNumber(mHp)}</span>
            <span style={{ color: "var(--color-boss)" }}>보스 {formatNumber(bHp)}</span>
          </div>
        </div>
      </div>

      <button
        onPointerDown={onChallenge}
        style={{
          width: "100%",
          minHeight: "var(--touch-min)",
          padding: "10px 0",
          marginTop: 10,
          borderRadius: "var(--radius-md)",
          border: "none",
          background: "var(--color-punch)",
          color: "#fff",
          fontSize: "var(--font-base)",
          fontWeight: 800,
          cursor: "pointer",
          letterSpacing: "1px",
        }}
      >
        도전!
      </button>
    </div>
  );
});
