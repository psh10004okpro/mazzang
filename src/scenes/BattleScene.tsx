import { useCallback, useEffect, useRef, useState } from "react";
import Decimal from "break_infinity.js";
import { useGameStore } from "../hooks/useGameStore";
import { formatNumber, formatCurrency } from "../engine/numberFormat";
import { battleDrop, MINIONS_PER_ALLEY } from "../engine/formulas";
import { ProgressBar } from "../ui/ProgressBar";
import { DamageNumber, type DamageNumberHandle } from "../ui/DamageNumber";
import { ScreenShake, type ScreenShakeHandle } from "../ui/ScreenShake";
import {
  battleBg, PLAYER_FRAMES, enemyFrame, bossFrame, ICONS,
} from "../engine/assetPaths";
import { usePositionConfig, PositionDebugPanel } from "../ui/PositionDebug";
import * as sfx from "../engine/soundManager";

// ── 적 이름 ──
const ENEMY_NAMES: Record<number, string[]> = {
  1: ["동네 꼬마", "학교 짱", "골목 양아치", "담배 삐끼", "골목 대장"],
  2: ["노래방 진상", "편의점 도둑", "오토바이 폭주", "PC방 양아치", "상가 터줏대감"],
  3: ["공원 불량배", "지하도 건달", "시장 깡패", "골목 조폭", "뒷골목 형님"],
  4: ["클럽 용심이", "사채업자", "주먹 고수", "거리의 무법자", "야시장 보스"],
  5: ["격투 챔피언", "싸움 달인", "도장 파괴자", "무림 고수", "전설의 짱"],
};

function getEnemyName(alley: number, index: number, isBoss: boolean): string {
  const names = ENEMY_NAMES[alley] ?? ENEMY_NAMES[1];
  if (isBoss) return names[4] ?? "보스";
  return names[Math.min(index, 3)] ?? "잡졸";
}

const PHASE_ICON_SRCS = { left_punch: ICONS.punch, right_punch: ICONS.punch, kick: ICONS.kick } as const;
const PHASE_LABELS = { left_punch: "왼손", right_punch: "오른손", kick: "발차기" } as const;

const BOSS_ATTACK_INTERVAL = 2000;
const BOSS_WARN_DURATION = 800;
const COMBO_TIMEOUT = 1000;

export function BattleScene() {
  const shakeRef = useRef<ScreenShakeHandle>(null);
  const dmgRef = useRef<DamageNumberHandle>(null);

  return (
    <ScreenShake ref={shakeRef}>
      <DamageNumber ref={dmgRef} />
      <BattleContent shakeRef={shakeRef} dmgRef={dmgRef} />
    </ScreenShake>
  );
}

function BattleContent({
  shakeRef,
  dmgRef,
}: {
  shakeRef: React.RefObject<ScreenShakeHandle | null>;
  dmgRef: React.RefObject<DamageNumberHandle | null>;
}) {
  const alley = useGameStore((s) => s.battle.currentAlley);
  const enemyIndex = useGameStore((s) => s.battle.enemyIndex);
  const isBoss = useGameStore((s) => s.battle.isBoss);
  const isActive = useGameStore((s) => s.battle.isActive);
  const attackPhase = useGameStore((s) => s.battle.attackPhase);
  const playerHp = useGameStore((s) => s.player.hp);
  const playerMaxHp = useGameStore((s) => s.player.maxHp);
  const evasion = useGameStore((s) => s.player.evasion);
  const enemyHpRatio = useGameStore((s) =>
    s.battle.enemyMaxHp.gt(0) ? s.battle.enemyHp.div(s.battle.enemyMaxHp).toNumber() : 1,
  );
  const processBattleTap = useGameStore((s) => s.processBattleTap);
  const bossAttackPlayer = useGameStore((s) => s.bossAttackPlayer);
  const changeScene = useGameStore((s) => s.changeScene);
  const fleeBattle = useGameStore((s) => s.fleeBattle);

  // ── 로컬 상태 ──
  const [enemyAnim, setEnemyAnim] = useState<"" | "hit" | "hit-crit" | "ko">("");
  const [bgFlash, setBgFlash] = useState(false);
  const [bossEntrance, setBossEntrance] = useState(false);
  const [bossWarn, setBossWarn] = useState(false);
  const [playerHitFlash, setPlayerHitFlash] = useState(false);
  const [dodgeText, setDodgeText] = useState(false);
  const [clearOverlay, setClearOverlay] = useState<string | null>(null);
  const [defeatOverlay, setDefeatOverlay] = useState(false);
  const [koText, setKoText] = useState(false);
  const [comboCount, setComboCount] = useState(0);
  const [comboDisplay, setComboDisplay] = useState(0);
  const [frozen, setFrozen] = useState(false);
  const { config: pos, update: posUpdate, reset: posReset } = usePositionConfig("battle");
  const [goldFly, setGoldFly] = useState(false);

  const bossTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevBossRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const comboTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tapBlockedRef = useRef(false);

  const enemyName = getEnemyName(alley, enemyIndex, isBoss);
  const isLowHp = enemyHpRatio < 0.3 && enemyHpRatio > 0;

  // ── 보스 등장 ──
  useEffect(() => {
    if (isBoss && !prevBossRef.current) {
      setBossEntrance(true);
      sfx.bossAppear();
      setTimeout(() => setBossEntrance(false), 1200);
    }
    prevBossRef.current = isBoss;
  }, [isBoss]);

  // ── 보스 자동 공격 ──
  useEffect(() => {
    if (isBoss && isActive) {
      bossTimerRef.current = setInterval(() => {
        setBossWarn(true);
        setTimeout(() => {
          setBossWarn(false);
          const dodged = bossAttackPlayer();
          if (dodged) {
            setDodgeText(true);
            setTimeout(() => setDodgeText(false), 500);
          } else {
            setPlayerHitFlash(true);
            shakeRef.current?.shake(false);
            navigator.vibrate?.(40);
            setTimeout(() => setPlayerHitFlash(false), 200);
          }
        }, BOSS_WARN_DURATION);
      }, BOSS_ATTACK_INTERVAL);
    }
    return () => {
      if (bossTimerRef.current) clearInterval(bossTimerRef.current);
    };
  }, [isBoss, isActive, bossAttackPlayer, shakeRef]);

  // ── 플레이어 사망 ──
  useEffect(() => {
    if (playerHp.lte(0) && !isActive) {
      setDefeatOverlay(true);
      const t = setTimeout(() => {
        setDefeatOverlay(false);
        fleeBattle();
      }, 2000);
      return () => clearTimeout(t);
    }
  }, [playerHp, isActive, fleeBattle]);

  // ── 보스 클리어 ──
  useEffect(() => {
    if (!isActive && isBoss && playerHp.gt(0)) {
      const drop = battleDrop(alley, true);
      sfx.enemyKo();
      sfx.levelUp();
      setKoText(true);
      setGoldFly(true);
      setTimeout(() => setKoText(false), 600);
      setTimeout(() => {
        setGoldFly(false);
        setClearOverlay(`골목 ${alley} 클리어!\n+${formatCurrency(drop)}`);
      }, 700);
      const t = setTimeout(() => {
        setClearOverlay(null);
        changeScene("map");
      }, 3000);
      return () => clearTimeout(t);
    }
  }, [isActive, isBoss, playerHp, alley, changeScene]);

  // ── 탭 핸들러 ──
  const handleTap = useCallback(
    (e: React.PointerEvent) => {
      if (!isActive || tapBlockedRef.current) return;

      const result = processBattleTap();
      if (!result) return;

      // 데미지 숫자
      const rect = containerRef.current?.getBoundingClientRect();
      const x = e.clientX - (rect?.left ?? 0);
      const y = e.clientY - (rect?.top ?? 0) - 30;

      let dmgType: "normal" | "crit" | "kick" = "normal";
      if (result.isCritical) dmgType = "crit";
      else if (result.attackPhase === "kick") dmgType = "kick";

      dmgRef.current?.spawn(x, y, result.damage, dmgType);

      // 사운드
      if (result.isCritical) sfx.critical();
      else if (result.attackPhase === "kick") sfx.kick();
      else sfx.punch();

      // 배경 임팩트 플래시
      setBgFlash(true);
      requestAnimationFrame(() => requestAnimationFrame(() => setBgFlash(false)));

      // 진동
      navigator.vibrate?.(result.isCritical ? 40 : 12);

      // 콤보
      if (comboTimerRef.current) clearTimeout(comboTimerRef.current);
      setComboCount((c) => {
        const next = c + 1;
        if (next >= 3) setComboDisplay(next);
        return next;
      });
      comboTimerRef.current = setTimeout(() => {
        setComboCount(0);
        setComboDisplay(0);
      }, COMBO_TIMEOUT);

      if (result.isCritical) {
        // 크리티컬: 프리즈 프레임 50ms → 헤비 셰이크
        tapBlockedRef.current = true;
        setFrozen(true);
        setTimeout(() => {
          setFrozen(false);
          tapBlockedRef.current = false;
          shakeRef.current?.shake(true);
        }, 50);
        setEnemyAnim("hit-crit");
        setTimeout(() => setEnemyAnim(""), 200);
      } else {
        shakeRef.current?.shake(false);
        setEnemyAnim("hit");
        setTimeout(() => setEnemyAnim(""), 120);
      }

      // 적 처치
      if (result.isKill) {
        sfx.enemyKo();
        sfx.goldPickup();
        setKoText(true);
        setGoldFly(true);
        setEnemyAnim("ko");
        setTimeout(() => {
          setKoText(false);
          setEnemyAnim("");
        }, 500);
        setTimeout(() => setGoldFly(false), 600);
      }
    },
    [isActive, processBattleTap, dmgRef, shakeRef],
  );

  const progressText = isBoss
    ? "BOSS"
    : `${Math.min(enemyIndex + 1, MINIONS_PER_ALLEY)}/${MINIONS_PER_ALLEY}`;

  const showComboGlow = comboCount >= 10;

  return (
    <div
      ref={containerRef}
      onPointerDown={handleTap}
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        touchAction: "none",
        cursor: "crosshair",
        position: "relative",
        overflow: "hidden",
        backgroundImage: `url(${battleBg(alley)})`,
        backgroundSize: "cover",
        backgroundPosition: "center bottom",
        transition: "background-image 0.5s",
        animation: showComboGlow ? "combo-glow 0.8s ease-in-out infinite" : "none",
      }}
    >
      {/* 배경 임팩트 플래시 */}
      {bgFlash && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(255,255,255,0.08)",
            zIndex: 1,
            pointerEvents: "none",
            animation: "bg-impact 0.12s ease-out forwards",
          }}
        />
      )}

      {/* 보스 시네마틱 바 (상단) */}
      {bossEntrance && (
        <>
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              background: "#000",
              zIndex: 65,
              animation: "cinema-in 0.3s ease-out forwards, cinema-out 0.3s ease-in 0.9s forwards",
            }}
          />
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              background: "#000",
              zIndex: 65,
              animation: "cinema-in 0.3s ease-out forwards, cinema-out 0.3s ease-in 0.9s forwards",
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              zIndex: 66,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              pointerEvents: "none",
            }}
          >
            <span
              style={{
                fontSize: "var(--font-xxl)",
                fontWeight: 900,
                color: "var(--color-boss)",
                textShadow: "0 0 30px rgba(255,0,0,0.7), 0 0 60px rgba(255,0,0,0.3)",
                letterSpacing: "4px",
                animation: "scene-fade-in 0.3s ease-out, scene-fade-out 0.3s ease-in 0.8s forwards",
              }}
            >
              ⚠️ WARNING ⚠️
            </span>
          </div>
        </>
      )}

      {/* 보스 공격 경고 (테두리 깜빡) */}
      {bossWarn && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 55,
            pointerEvents: "none",
            animation: "boss-warn-border 0.4s ease-in-out infinite",
            borderRadius: 0,
          }}
        />
      )}

      {/* 회피 텍스트 */}
      {dodgeText && (
        <div
          style={{
            position: "absolute",
            left: "50%",
            bottom: 130,
            transform: "translateX(-50%)",
            zIndex: 55,
            fontSize: "var(--font-xl)",
            fontWeight: 900,
            color: "var(--color-gem)",
            textShadow: "0 2px 12px rgba(167,139,250,0.6)",
            animation: "damage-float 0.5s ease-out forwards",
            pointerEvents: "none",
          }}
        >
          DODGE!
        </div>
      )}

      {/* KO 텍스트 */}
      {koText && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 60,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
          }}
        >
          <span
            style={{
              fontSize: "4rem",
              fontWeight: 900,
              color: "var(--color-won)",
              textShadow: "0 0 20px rgba(255,215,0,0.7), 0 4px 12px rgba(0,0,0,0.8)",
              animation: "ko-pop 0.5s ease-out forwards",
            }}
          >
            KO!
          </span>
        </div>
      )}

      {/* 골드 날아가기 효과 */}
      {goldFly && (
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "45%",
            zIndex: 58,
            fontSize: "1.5rem",
            pointerEvents: "none",
            // @ts-expect-error CSS custom properties
            "--fly-x": "0px",
            "--fly-y": "-200px",
            animation: "gold-fly 0.6s ease-in forwards",
          }}
        >
          <img src={ICONS.gold} alt="" style={{ width: 32, height: 32 }} />
        </div>
      )}

      {/* 콤보 표시 */}
      {comboDisplay >= 3 && (
        <div
          key={comboDisplay}
          style={{
            position: "absolute",
            right: 16,
            top: 80,
            zIndex: 45,
            pointerEvents: "none",
            animation: "combo-pop 0.6s ease-out forwards",
          }}
        >
          <div
            style={{
              fontSize: comboDisplay >= 10 ? "var(--font-xxl)" : "var(--font-xl)",
              fontWeight: 900,
              color: comboDisplay >= 10 ? "var(--color-won)" : "var(--color-crit)",
              textShadow: "0 2px 8px rgba(0,0,0,0.7)",
              textAlign: "right",
            }}
          >
            {comboDisplay}
          </div>
          <div
            style={{
              fontSize: "var(--font-sm)",
              fontWeight: 800,
              color: comboDisplay >= 10 ? "var(--color-won)" : "var(--text-secondary)",
              textAlign: "right",
              letterSpacing: "2px",
            }}
          >
            COMBO!
          </div>
        </div>
      )}

      {/* 클리어 오버레이 */}
      {clearOverlay && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 70,
            background: "rgba(0,0,0,0.8)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            animation: "scene-fade-in 0.3s ease-out",
            pointerEvents: "none",
          }}
        >
          <span style={{ fontSize: "3.5rem" }}>🏆</span>
          {clearOverlay.split("\n").map((line, i) => (
            <span
              key={i}
              style={{
                fontSize: i === 0 ? "var(--font-xl)" : "var(--font-lg)",
                fontWeight: 800,
                color: i === 0 ? "var(--color-won)" : "var(--color-hp)",
                textShadow: "0 2px 8px rgba(0,0,0,0.5)",
              }}
            >
              {line}
            </span>
          ))}
        </div>
      )}

      {/* 패배 오버레이 */}
      {defeatOverlay && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 70,
            background: "rgba(0,0,0,0.85)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            animation: "scene-fade-in 0.3s ease-out",
            pointerEvents: "none",
          }}
        >
          <span style={{ fontSize: "var(--font-xxl)", fontWeight: 900, color: "var(--color-punch)" }}>
            패배...
          </span>
          <span style={{ fontSize: "var(--font-sm)", color: "var(--text-secondary)" }}>
            더 수련이 필요하다
          </span>
        </div>
      )}

      {/* ── 상단: 골목 정보 ── */}
      <div
        style={{
          padding: "12px 16px",
          background: "var(--bg-secondary)",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          zIndex: 2,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <span style={{ fontSize: "var(--font-sm)", color: "var(--text-secondary)" }}>골목 {alley}</span>
          <span style={{ fontSize: "var(--font-sm)", fontWeight: 700, color: isBoss ? "var(--color-boss)" : "var(--text-secondary)" }}>{progressText}</span>
        </div>
        <div style={{ fontSize: "var(--font-lg)", fontWeight: 800, color: isBoss ? "var(--color-boss)" : "var(--text-primary)", textAlign: "center", marginBottom: 8 }}>
          {isBoss && "👑 "}{enemyName}
        </div>
        <EnemyHpBar />
      </div>

      {/* ── 중앙: 배틀 필드 ── */}
      <div
        style={{
          flex: 1,
          position: "relative",
          zIndex: 2,
          overflow: "hidden",
          filter: frozen ? "brightness(2) contrast(1.2)" : "none",
          transition: frozen ? "none" : "filter 0.05s",
        }}
      >
        {/* 바닥 그라데이션 (캐릭터 아래 어둡게) */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: "40%",
            background: "linear-gradient(transparent, rgba(0,0,0,0.6))",
            zIndex: 1,
            pointerEvents: "none",
          }}
        />

        {/* 주인공 — left=중심X, height로 크기 제어 */}
        <img
          src={
            enemyAnim === "hit" || enemyAnim === "hit-crit"
              ? (attackPhase === "kick" ? PLAYER_FRAMES.kick
                : attackPhase === "right_punch" ? PLAYER_FRAMES.punchRight
                : PLAYER_FRAMES.punchLeft)
              : PLAYER_FRAMES.idle
          }
          alt=""
          draggable={false}
          style={{
            position: "absolute",
            left: `${pos.playerLeft}%`,
            bottom: `${pos.playerBottom}%`,
            height: `${pos.playerHeight}%`,
            width: "auto",
            zIndex: 3,
            transform: "translateX(-50%)",
          }}
        />

        {/* 적 — right=중심X, height로 크기 제어 */}
        <div
          style={{
            position: "absolute",
            right: `${pos.enemyRight}%`,
            bottom: `${pos.enemyBottom}%`,
            height: isBoss ? `${pos.enemyHeight + 5}%` : `${pos.enemyHeight}%`,
            zIndex: 3,
            transform: "translateX(50%)",
            animation:
              enemyAnim === "ko"
                ? "enemy-ko 0.5s ease-in forwards"
                : enemyAnim === "hit-crit"
                  ? "enemy-hit-crit 0.2s ease-out"
                  : enemyAnim === "hit"
                    ? "enemy-hit 0.12s ease-out"
                    : "none",
            transform: isLowHp ? "rotate(5deg)" : "none",
            transition: "transform 0.3s",
            filter:
              enemyAnim === "hit" || enemyAnim === "hit-crit"
                ? "brightness(2.5)"
                : "none",
          }}
        >
          <img
            src={
              isBoss
                ? bossFrame(alley, enemyAnim === "ko" ? "defeat" : bossWarn ? "attack" : "idle")
                : enemyFrame(alley, enemyAnim ? "hit" : "idle")
            }
            alt=""
            draggable={false}
            style={{
              height: "100%",
              width: "auto",
              transform: "scaleX(-1)",
            }}
          />
        </div>
      </div>

      {/* ── 공격 순서 ── */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: 16,
          padding: "10px 0",
          background: "var(--bg-secondary)",
          borderTop: "1px solid rgba(255,255,255,0.06)",
          zIndex: 2,
        }}
      >
        {(["left_punch", "right_punch", "kick"] as const).map((phase, i) => {
          const active = phase === attackPhase;
          return (
            <div key={phase} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              {i > 0 && (
                <span style={{ color: "var(--text-dim)", fontSize: "0.7rem" }}>→</span>
              )}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 2,
                  opacity: active ? 1 : 0.35,
                  transform: active ? "scale(1.25)" : "scale(1)",
                  transition: "all 0.1s",
                }}
              >
                <img src={PHASE_ICON_SRCS[phase]} alt="" style={{ width: 36, height: 36, objectFit: "contain" }} />
                <span
                  style={{
                    fontSize: "0.65rem",
                    fontWeight: 700,
                    color: active
                      ? phase === "kick" ? "var(--color-kick)" : "var(--color-punch)"
                      : "var(--text-dim)",
                  }}
                >
                  {PHASE_LABELS[phase]}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── 하단: 플레이어 HP ── */}
      <div
        style={{
          padding: "10px 16px 16px",
          background: "var(--bg-secondary)",
          display: "flex",
          flexDirection: "column",
          gap: 8,
          borderTop: "1px solid rgba(255,255,255,0.06)",
          zIndex: 2,
          filter: playerHitFlash ? "brightness(1.6) saturate(2)" : "none",
          transition: "filter 0.15s",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: "var(--font-sm)",
          }}
        >
          <img src={ICONS.hp} alt="" style={{ width: 24, height: 24, objectFit: "contain" }} />
          <span style={{ fontWeight: 700 }}>
            {formatNumber(playerHp)} / {formatNumber(playerMaxHp)}
          </span>
          {isBoss && evasion > 0 && (
            <span style={{ marginLeft: "auto", color: "var(--color-gem)", fontSize: "0.75rem" }}>
              회피 {(evasion * 100).toFixed(1)}%
            </span>
          )}
        </div>
        <ProgressBar value={playerHp} max={playerMaxHp} color="var(--color-hp)" height={14} />
        <button
          onPointerDown={(e) => {
            e.stopPropagation();
            fleeBattle();
          }}
          style={{
            minHeight: 40,
            padding: "8px 0",
            borderRadius: "var(--radius-md)",
            border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(255,255,255,0.06)",
            color: "var(--text-secondary)",
            fontSize: "var(--font-sm)",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          🏃 도망치기
        </button>
      </div>

      {/* 위치 디버그 패널 (개발용) */}
      <PositionDebugPanel config={pos} update={posUpdate} mode="battle" onReset={posReset} />
    </div>
  );
}

function EnemyHpBar() {
  const enemyHp = useGameStore((s) => s.battle.enemyHp);
  const enemyMaxHp = useGameStore((s) => s.battle.enemyMaxHp);
  const isBoss = useGameStore((s) => s.battle.isBoss);

  return (
    <ProgressBar
      value={enemyHp}
      max={enemyMaxHp}
      color={isBoss ? "var(--color-boss)" : "var(--color-punch)"}
      height={18}
      label={formatNumber(enemyHp)}
    />
  );
}
