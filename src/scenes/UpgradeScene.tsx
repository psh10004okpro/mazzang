import { useState, useCallback, memo } from "react";
import Decimal from "break_infinity.js";
import { useGameStore } from "../hooks/useGameStore";
import { formatNumber, formatCurrency } from "../engine/numberFormat";
import { upgradeCost, BASE_COSTS, TOOL_UPGRADE_COSTS } from "../engine/formulas";
import { ICONS, BACKGROUNDS } from "../engine/assetPaths";
import type { UpgradeStat, ToolTier } from "../engine/types";
import * as sfx from "../engine/soundManager";

// ── 스탯 메타 정보 ──
interface StatMeta {
  stat: UpgradeStat;
  icon: string;
  label: string;
  getValue: (p: ReturnType<typeof usePlayerSnapshot>) => string;
  getNext: (p: ReturnType<typeof usePlayerSnapshot>) => string;
}

function usePlayerSnapshot() {
  return {
    punch: useGameStore((s) => s.player.punch),
    kick: useGameStore((s) => s.player.kick),
    maxHp: useGameStore((s) => s.player.maxHp),
    evasion: useGameStore((s) => s.player.evasion),
    sparring: useGameStore((s) => s.player.sparring),
  };
}

const STAT_META: StatMeta[] = [
  {
    stat: "punch",
    icon: ICONS.punch,
    label: "펀치",
    getValue: (p) => formatNumber(p.punch),
    getNext: (p) => formatNumber(p.punch.add(5)),
  },
  {
    stat: "kick",
    icon: ICONS.kick,
    label: "킥",
    getValue: (p) => formatNumber(p.kick),
    getNext: (p) => formatNumber(p.kick.add(4)),
  },
  {
    stat: "hp",
    icon: ICONS.hp,
    label: "체력",
    getValue: (p) => formatNumber(p.maxHp),
    getNext: (p) => formatNumber(p.maxHp.add(20)),
  },
  {
    stat: "evasion",
    icon: ICONS.star,
    label: "동체시력",
    getValue: (p) => `${(p.evasion * 100).toFixed(1)}%`,
    getNext: (p) => `${(Math.min(0.75, p.evasion + 0.005) * 100).toFixed(1)}%`,
  },
  {
    stat: "sparring",
    icon: ICONS.punch,
    label: "스파링",
    getValue: (p) => formatNumber(p.sparring),
    getNext: (p) => formatNumber(p.sparring.add(0.5)),
  },
];

// ── 도구 이름 ──
const TOOL_NAMES: Record<ToolTier, string> = {
  1: "나무판자",
  2: "샌드백",
  3: "철봉",
  4: "돌기둥",
  5: "강철벽",
};

const TOOL_EMOJI: Record<ToolTier, string> = {
  1: "🪵",
  2: "🎒",
  3: "🔩",
  4: "🪨",
  5: "🛡️",
};

export function UpgradeScene() {
  const won = useGameStore((s) => s.currencies.won);
  const upgrades = useGameStore((s) => s.upgrades);
  const toolTier = useGameStore((s) => s.training.toolTier);
  const purchaseUpgrade = useGameStore((s) => s.purchaseUpgrade);
  const upgradeToolTier = useGameStore((s) => s.upgradeToolTier);
  const player = usePlayerSnapshot();

  // 강화 성공 플래시 추적
  const [flashStat, setFlashStat] = useState<string | null>(null);

  const handleUpgrade = useCallback(
    (stat: UpgradeStat) => {
      const ok = purchaseUpgrade(stat);
      if (ok) {
        sfx.upgrade();
        setFlashStat(stat);
        setTimeout(() => setFlashStat(null), 400);
      }
    },
    [purchaseUpgrade],
  );

  const handleToolUpgrade = useCallback(() => {
    const ok = upgradeToolTier();
    if (ok) {
      sfx.upgrade();
      sfx.levelUp();
      setFlashStat("tool");
      setTimeout(() => setFlashStat(null), 400);
    }
  }, [upgradeToolTier]);

  const canUpgradeTool = toolTier < 5;
  const toolCost = canUpgradeTool
    ? new Decimal(TOOL_UPGRADE_COSTS[toolTier - 1])
    : null;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        touchAction: "none",
        backgroundImage: `url(${BACKGROUNDS.upgrade})`,
        backgroundSize: "cover",
        backgroundPosition: "center bottom",
      }}
    >
      {/* 스크롤 영역 */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "8px 16px 24px",
          touchAction: "pan-y",
        }}
      >
        {/* 스탯 강화 섹션 */}
        <SectionHeader title="스탯 강화" />

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {STAT_META.map((meta) => {
            const level = upgrades[meta.stat].level;
            const cost = upgradeCost(BASE_COSTS[meta.stat], level);
            const canAfford = won.gte(cost);
            const isFlash = flashStat === meta.stat;

            return (
              <UpgradeRow
                key={meta.stat}
                icon={meta.icon}
                label={meta.label}
                level={level}
                currentVal={meta.getValue(player)}
                nextVal={meta.getNext(player)}
                cost={cost}
                canAfford={canAfford}
                flash={isFlash}
                onBuy={() => handleUpgrade(meta.stat)}
              />
            );
          })}
        </div>

        {/* 수련 도구 섹션 */}
        <SectionHeader title="수련 도구" />

        <div
          style={{
            background: "var(--bg-secondary)",
            borderRadius: "var(--radius-md)",
            padding: 16,
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 12,
            }}
          >
            <span style={{ fontSize: "2rem" }}>{TOOL_EMOJI[toolTier]}</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: "var(--font-base)" }}>
                현재: {toolTier}등급 {TOOL_NAMES[toolTier]}
              </div>
              {canUpgradeTool && (
                <div
                  style={{
                    fontSize: "var(--font-sm)",
                    color: "var(--text-secondary)",
                  }}
                >
                  다음: {toolTier + 1}등급{" "}
                  {TOOL_NAMES[(toolTier + 1) as ToolTier]}
                </div>
              )}
            </div>
          </div>

          {canUpgradeTool && toolCost ? (
            <button
              onPointerDown={handleToolUpgrade}
              disabled={won.lt(toolCost)}
              style={{
                width: "100%",
                minHeight: "var(--touch-min)",
                padding: "10px 16px",
                borderRadius: "var(--radius-md)",
                border: "none",
                background: won.gte(toolCost)
                  ? "var(--color-upgrade)"
                  : "rgba(255,255,255,0.08)",
                color: won.gte(toolCost) ? "#fff" : "var(--text-dim)",
                fontSize: "var(--font-base)",
                fontWeight: 700,
                cursor: won.gte(toolCost) ? "pointer" : "not-allowed",
                transition: "background 0.15s",
                animation: flashStat === "tool" ? "stat-highlight 0.4s ease-out" : "none",
              }}
            >
              업그레이드 — {formatCurrency(toolCost)}
            </button>
          ) : (
            <div
              style={{
                textAlign: "center",
                color: "var(--color-won)",
                fontWeight: 700,
                padding: 10,
              }}
            >
              최대 등급!
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── 섹션 헤더 ──
function SectionHeader({ title }: { title: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        margin: "16px 0 10px",
      }}
    >
      <div
        style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.12)" }}
      />
      <span
        style={{
          fontSize: "var(--font-sm)",
          fontWeight: 700,
          color: "var(--text-secondary)",
          letterSpacing: "0.5px",
        }}
      >
        {title}
      </span>
      <div
        style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.12)" }}
      />
    </div>
  );
}

// ── 강화 행 (memo) ──
const UpgradeRow = memo(function UpgradeRow({
  icon,
  label,
  level,
  currentVal,
  nextVal,
  cost,
  canAfford,
  flash,
  onBuy,
}: {
  icon: string;
  label: string;
  level: number;
  currentVal: string;
  nextVal: string;
  cost: Decimal;
  canAfford: boolean;
  flash: boolean;
  onBuy: () => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 12px",
        background: "var(--bg-secondary)",
        borderRadius: "var(--radius-md)",
        border: flash
          ? "1px solid var(--color-won)"
          : "1px solid rgba(255,255,255,0.08)",
        transition: "border-color 0.3s",
      }}
    >
      {/* 아이콘 + 라벨 */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontWeight: 700,
            fontSize: "var(--font-base)",
          }}
        >
          {icon.startsWith("/") ? (
            <img src={icon} alt="" style={{ width: 28, height: 28, objectFit: "contain" }} />
          ) : (
            <span>{icon}</span>
          )}
          {label}
          <span
            style={{
              fontSize: "var(--font-sm)",
              color: "var(--text-secondary)",
              fontWeight: 400,
            }}
          >
            Lv.{level}
          </span>
        </div>
        <div
          style={{
            fontSize: "var(--font-sm)",
            color: "var(--text-secondary)",
            marginTop: 2,
          }}
        >
          <span
            style={{
              animation: flash ? "stat-highlight 0.4s ease-out" : "none",
            }}
          >
            {currentVal}
          </span>
          <span style={{ color: "var(--color-hp)", margin: "0 4px" }}>→</span>
          <span style={{ color: "var(--color-won)" }}>{nextVal}</span>
        </div>
      </div>

      {/* 강화 버튼 */}
      <button
        onPointerDown={onBuy}
        disabled={!canAfford}
        style={{
          flexShrink: 0,
          minWidth: 80,
          minHeight: 40,
          padding: "6px 12px",
          borderRadius: "var(--radius-md)",
          border: "none",
          background: canAfford
            ? "var(--color-upgrade)"
            : "rgba(255,255,255,0.08)",
          color: canAfford ? "#fff" : "var(--text-dim)",
          fontSize: "var(--font-sm)",
          fontWeight: 700,
          cursor: canAfford ? "pointer" : "not-allowed",
          transition: "background 0.15s",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 1,
        }}
      >
        <span>강화</span>
        <span style={{ fontSize: "0.7rem", opacity: 0.85 }}>
          {formatCurrency(cost)}
        </span>
      </button>
    </div>
  );
});
