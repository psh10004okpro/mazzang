import Decimal from "break_infinity.js";
import type { KickPosition, ToolTier } from "./types";

/**
 * 강화 비용 = baseCost × 1.15^level
 */
export function upgradeCost(baseCost: number, level: number): Decimal {
  return new Decimal(baseCost).mul(Decimal.pow(1.15, level));
}

/** 각 스탯별 기본 강화 비용 */
export const BASE_COSTS: Record<string, number> = {
  punch: 50,
  kick: 50,
  hp: 50,
  evasion: 50,
  sparring: 100,
};

/** 도구 업그레이드 비용 (tier 1→2, 2→3, 3→4, 4→5) */
export const TOOL_UPGRADE_COSTS: number[] = [500, 2000, 8000, 30000];

/**
 * 잡몹 HP = 50 × alleyNumber^1.8
 */
export function minionHp(alleyNumber: number): Decimal {
  return new Decimal(50).mul(Decimal.pow(alleyNumber, 1.8));
}

/**
 * 보스 HP = 잡몹HP × 4
 */
export function bossHp(alleyNumber: number): Decimal {
  return minionHp(alleyNumber).mul(4);
}

/**
 * 패시브 수입 = 클리어한 각 골목번호 × 5 의 합 (분당)
 */
export function passiveIncome(clearedAlleys: number[]): Decimal {
  let total = new Decimal(0);
  for (const alley of clearedAlleys) {
    total = total.add(new Decimal(alley).mul(5));
  }
  return total;
}

/**
 * 전투 드롭 = 10 × alleyNumber^1.5 (보스는 ×15)
 */
export function battleDrop(alleyNumber: number, isBoss: boolean): Decimal {
  const base = new Decimal(10).mul(Decimal.pow(alleyNumber, 1.5));
  return isBoss ? base.mul(15) : base;
}

/**
 * 수동 데미지 (주먹 페이즈) = (punch + kick) × 0.5
 */
export function manualDamage(punch: Decimal, kick: Decimal): Decimal {
  return punch.add(kick).mul(0.5);
}

/** 킥 위치별 배율 */
const KICK_MULTIPLIERS: Record<KickPosition, number> = {
  front: 1.3,
  side: 1.3,
  back: 1.5,
};

/**
 * 킥 데미지 = kick × 위치배율
 */
export function kickDamage(kick: Decimal, position: KickPosition): Decimal {
  return kick.mul(KICK_MULTIPLIERS[position]);
}

/** 수련 도구 등급별 배율 [tier 1~5] */
const TOOL_MULTIPLIERS: Record<ToolTier, number> = {
  1: 1.0,
  2: 1.5,
  3: 2.5,
  4: 4.0,
  5: 6.0,
};

/**
 * 수련 도구 배율
 */
export function toolMultiplier(tier: ToolTier): number {
  return TOOL_MULTIPLIERS[tier];
}

/** 수련 도구 최대 내구도 (등급별) */
export function toolMaxDurability(tier: ToolTier): Decimal {
  return new Decimal(50).mul(tier);
}

/** 골목당 잡몹 수 */
export const MINIONS_PER_ALLEY = 5;
