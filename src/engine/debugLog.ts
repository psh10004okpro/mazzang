import Decimal from "break_infinity.js";
import { gameStore } from "./store";
import {
  minionHp,
  bossHp,
  manualDamage,
  upgradeCost,
  BASE_COSTS,
  MINIONS_PER_ALLEY,
  battleDrop,
} from "./formulas";

/**
 * 콘솔에 현재 게임 밸런스 상태 출력
 */
export function logBalance() {
  const s = gameStore.getState();
  const { punch, kick } = s.player;
  const won = s.currencies.won;

  const punchDmg = manualDamage(punch, kick);
  const kickDmgAvg = kick.mul((1.3 + 1.3 + 1.5) / 3);
  const avg3 = punchDmg.mul(2).add(kickDmgAvg).div(3);
  const avgCrit = avg3.mul(1.1); // 10% crit × 2배

  console.group("%c맞짱로 밸런스", "font-weight:bold;font-size:14px;color:#ffd700");

  console.log(
    `스탯: 펀치=${punch} 킥=${kick} | DPS(5탭/초)=${avgCrit.mul(5).toFixed(1)}/s`,
  );
  console.log(`보유: ${won.toFixed(0)}원`);

  console.group("골목별 필요 탭 수");
  for (let a = 1; a <= 5; a++) {
    const mHp = minionHp(a);
    const bHp = bossHp(a);
    const mTaps = Math.ceil(mHp.div(avgCrit).toNumber());
    const bTaps = Math.ceil(bHp.div(avgCrit).toNumber());
    const total = mTaps * MINIONS_PER_ALLEY + bTaps;
    const drop =
      battleDrop(a, false).mul(MINIONS_PER_ALLEY).add(battleDrop(a, true));
    const cleared = s.meta.clearedAlleys.includes(a) ? "✅" : "  ";
    console.log(
      `${cleared} 골목${a}: 잡몹${mTaps}탭×5 + 보스${bTaps}탭 = ${total}탭 | 드롭 ${drop.toFixed(0)}원`,
    );
  }
  console.groupEnd();

  console.group("강화 비용 vs 잔액");
  for (const stat of ["punch", "kick", "hp", "evasion", "sparring"] as const) {
    const lv = s.upgrades[stat].level;
    const cost = upgradeCost(BASE_COSTS[stat], lv);
    const affordable = won.gte(cost) ? "✅" : "❌";
    console.log(`${stat} Lv${lv} → ${lv + 1}: ${cost.toFixed(0)}원 ${affordable}`);
  }
  console.groupEnd();

  console.groupEnd();
}

// 글로벌에 노출 (콘솔에서 직접 호출 가능)
if (typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>).mazzangDebug = {
    logBalance,
    getState: () => gameStore.getState(),
    addWon: (n: number) => gameStore.getState().devAddWon(n),
    clearAll: () => gameStore.getState().devClearAll(),
    reset: () => gameStore.getState().reset(),
  };
}
