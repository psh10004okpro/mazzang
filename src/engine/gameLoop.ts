import Decimal from "break_infinity.js";
import { gameStore } from "./store";
import {
  passiveIncome,
  manualDamage,
  battleDrop,
  minionHp,
  bossHp,
  MINIONS_PER_ALLEY,
} from "./formulas";
import type { AttackPhase } from "./types";

const TICK_MS = 100; // 10Hz
const AUTO_SAVE_INTERVAL = 30_000; // 30초
const AUTO_ATTACK_RATE = 0.1; // 분당 60회 → 100ms당 0.1회

let intervalId: ReturnType<typeof setInterval> | null = null;
let msSinceLastSave = 0;

function tick() {
  const state = gameStore.getState();
  const { training, battle, player, currencies, meta, scene } = state;

  // ── 1. 패시브 수입 (클리어한 골목 기반) ──
  if (meta.clearedAlleys.length > 0) {
    const perMinute = passiveIncome(meta.clearedAlleys);
    const income = perMinute.div(600); // 분당 → 100ms당
    if (income.gt(0)) {
      gameStore.setState({
        currencies: {
          ...gameStore.getState().currencies,
          won: gameStore.getState().currencies.won.add(income),
        },
      });
    }
  }

  // ── 2. 자동 공격 처리 ──
  if (training.autoAttackActive && training.autoAttackTimeLeft > 0) {
    const remaining = training.autoAttackTimeLeft - TICK_MS / 1000;

    if (remaining <= 0) {
      gameStore.setState({
        training: {
          ...gameStore.getState().training,
          autoAttackActive: false,
          autoAttackTimeLeft: 0,
        },
      });
    } else {
      gameStore.setState({
        training: {
          ...gameStore.getState().training,
          autoAttackTimeLeft: remaining,
        },
      });

      // 수련 씬: 자동 수련 탭 (100ms당 0.1회 확률)
      if (scene === "training" && Math.random() < AUTO_ATTACK_RATE) {
        gameStore.getState().processTrainingTap();
      }

      // 전투 씬: 자동 DPS 적용
      if (scene === "battle" && battle.isActive) {
        applyAutoBattleDamage(player.punch, player.kick);
      }
    }
  }

  // ── 3. 자동 저장 (30초마다) ──
  msSinceLastSave += TICK_MS;
  if (msSinceLastSave >= AUTO_SAVE_INTERVAL) {
    msSinceLastSave = 0;
    gameStore.getState().saveGame();
  }
}

/** 자동 전투 데미지 적용 + 적 처치 처리 */
function applyAutoBattleDamage(punch: Decimal, kick: Decimal) {
  const dps = manualDamage(punch, kick);
  const dmg = dps.mul(TICK_MS / 1000);
  const currentBattle = gameStore.getState().battle;
  const newHp = Decimal.max(0, currentBattle.enemyHp.sub(dmg));

  if (newHp.gt(0)) {
    gameStore.setState({
      battle: { ...currentBattle, enemyHp: newHp },
    });
    return;
  }

  // 적 처치
  const s = gameStore.getState();
  const { battle: b, currencies: c, meta: m } = s;
  const drop = battleDrop(b.currentAlley, b.isBoss);
  const newWon = c.won.add(drop);

  if (b.isBoss) {
    const cleared = m.clearedAlleys.includes(b.currentAlley)
      ? m.clearedAlleys
      : [...m.clearedAlleys, b.currentAlley];
    gameStore.setState({
      currencies: { ...c, won: newWon },
      battle: { ...b, isActive: false, enemyHp: new Decimal(0) },
      meta: { ...m, clearedAlleys: cleared },
    });
    return;
  }

  const nextIndex = b.enemyIndex + 1;
  const lp: AttackPhase = "left_punch";

  if (nextIndex >= MINIONS_PER_ALLEY) {
    const hp = bossHp(b.currentAlley);
    gameStore.setState({
      currencies: { ...c, won: newWon },
      battle: {
        ...b,
        enemyIndex: nextIndex,
        enemyHp: hp,
        enemyMaxHp: hp,
        attackPhase: lp,
        isBoss: true,
      },
    });
  } else {
    const hp = minionHp(b.currentAlley);
    gameStore.setState({
      currencies: { ...c, won: newWon },
      battle: {
        ...b,
        enemyIndex: nextIndex,
        enemyHp: hp,
        enemyMaxHp: hp,
        attackPhase: lp,
      },
    });
  }
}

/** 오프라인 수익 계산 (최대 4시간) */
export function calcOfflineEarnings(elapsedMs: number): Decimal {
  const state = gameStore.getState();
  const maxMs = 4 * 60 * 60 * 1000; // 4시간
  const capped = Math.min(elapsedMs, maxMs);
  const minutes = capped / 60_000;

  const perMinute = passiveIncome(state.meta.clearedAlleys);
  return perMinute.mul(minutes);
}

export function startGameLoop() {
  if (intervalId !== null) return;
  msSinceLastSave = 0;
  intervalId = setInterval(tick, TICK_MS);
}

export function stopGameLoop() {
  if (intervalId === null) return;
  clearInterval(intervalId);
  intervalId = null;
}
