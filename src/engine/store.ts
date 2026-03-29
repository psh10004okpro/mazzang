import { createStore } from "zustand/vanilla";
import Decimal from "break_infinity.js";
import type {
  GameStore,
  GameState,
  ToolTier,
  TapResult,
  AttackPhase,
} from "./types";
import {
  upgradeCost,
  BASE_COSTS,
  TOOL_UPGRADE_COSTS,
  minionHp,
  bossHp,
  battleDrop,
  manualDamage,
  kickDamage,
  toolMultiplier,
  toolMaxDurability,
  MINIONS_PER_ALLEY,
} from "./formulas";

// ─── 세이브 ───
const SAVE_KEY = "mazzang_save";
const SAVE_VERSION = 1;

// ─── 초기 상태 ───
function initialState(): GameState {
  const tier: ToolTier = 1;
  return {
    scene: "training",
    player: {
      punch: new Decimal(10),
      kick: new Decimal(8),
      hp: new Decimal(100),
      maxHp: new Decimal(100),
      evasion: 0,
      sparring: new Decimal(1),
    },
    currencies: {
      won: new Decimal(0),
      gems: new Decimal(0),
    },
    battle: {
      currentAlley: 1,
      enemyIndex: 0,
      enemyHp: new Decimal(0),
      enemyMaxHp: new Decimal(0),
      attackPhase: "left_punch",
      isBoss: false,
      isActive: false,
    },
    training: {
      toolTier: tier,
      toolDurability: toolMaxDurability(tier),
      toolMaxDurability: toolMaxDurability(tier),
      autoAttackActive: false,
      autoAttackTimeLeft: 0,
    },
    upgrades: {
      punch: { level: 0 },
      kick: { level: 0 },
      hp: { level: 0 },
      evasion: { level: 0 },
      sparring: { level: 0 },
    },
    meta: {
      lastSaveTime: Date.now(),
      clearedAlleys: [],
    },
  };
}

// ─── 다음 공격 페이즈 ───
const PHASE_ORDER: AttackPhase[] = ["left_punch", "right_punch", "kick"];

function nextPhase(current: AttackPhase): AttackPhase {
  const idx = PHASE_ORDER.indexOf(current);
  return PHASE_ORDER[(idx + 1) % PHASE_ORDER.length];
}

// ─── 적 처치 내부 로직 ───
function handleEnemyDefeated(state: GameState): Partial<GameState> {
  const { battle, currencies, meta } = state;
  const drop = battleDrop(battle.currentAlley, battle.isBoss);
  const newWon = currencies.won.add(drop);

  // 보스 처치 → 골목 클리어 (씬 전환은 컴포넌트에서 처리)
  if (battle.isBoss) {
    const cleared = meta.clearedAlleys.includes(battle.currentAlley)
      ? meta.clearedAlleys
      : [...meta.clearedAlleys, battle.currentAlley];
    return {
      currencies: { ...currencies, won: newWon },
      battle: { ...battle, isActive: false, enemyHp: new Decimal(0) },
      meta: { ...meta, clearedAlleys: cleared },
    };
  }

  const nextIndex = battle.enemyIndex + 1;

  // 잡몹 5마리 처치 → 보스전
  if (nextIndex >= MINIONS_PER_ALLEY) {
    const hp = bossHp(battle.currentAlley);
    return {
      currencies: { ...currencies, won: newWon },
      battle: {
        ...battle,
        enemyIndex: nextIndex,
        enemyHp: hp,
        enemyMaxHp: hp,
        attackPhase: "left_punch",
        isBoss: true,
      },
    };
  }

  // 다음 잡몹
  const hp = minionHp(battle.currentAlley);
  return {
    currencies: { ...currencies, won: newWon },
    battle: {
      ...battle,
      enemyIndex: nextIndex,
      enemyHp: hp,
      enemyMaxHp: hp,
      attackPhase: "left_punch",
    },
  };
}

// ─── Decimal 직렬화 ───
interface SaveData {
  version: number;
  state: GameState;
}

function serializeState(state: GameState): string {
  const save: SaveData = { version: SAVE_VERSION, state };
  return JSON.stringify(save, (_key, value) => {
    if (value instanceof Decimal) {
      return { __type: "Decimal", value: value.toString() };
    }
    return value;
  });
}

/** 값이 Decimal이 아니면 Decimal로 변환 */
function ensureDecimal(v: unknown): Decimal {
  if (v instanceof Decimal) return v;
  if (typeof v === "number" || typeof v === "string") return new Decimal(v);
  if (v && typeof v === "object" && "mantissa" in v) return new Decimal(v as Decimal);
  return new Decimal(0);
}

/** 로드된 상태의 모든 Decimal 필드를 보장 */
function ensureDecimals(state: GameState): GameState {
  return {
    ...state,
    player: {
      ...state.player,
      punch: ensureDecimal(state.player.punch),
      kick: ensureDecimal(state.player.kick),
      hp: ensureDecimal(state.player.hp),
      maxHp: ensureDecimal(state.player.maxHp),
      sparring: ensureDecimal(state.player.sparring),
    },
    currencies: {
      won: ensureDecimal(state.currencies.won),
      gems: ensureDecimal(state.currencies.gems),
    },
    battle: {
      ...state.battle,
      enemyHp: ensureDecimal(state.battle.enemyHp),
      enemyMaxHp: ensureDecimal(state.battle.enemyMaxHp),
    },
    training: {
      ...state.training,
      toolDurability: ensureDecimal(state.training.toolDurability),
      toolMaxDurability: ensureDecimal(state.training.toolMaxDurability),
    },
  };
}

function deserializeState(json: string): GameState | null {
  try {
    const parsed = JSON.parse(json, (_key, value) => {
      if (value && typeof value === "object" && value.__type === "Decimal") {
        return new Decimal(value.value);
      }
      return value;
    });
    // 버전 필드가 있는 새 형식
    if (parsed && typeof parsed.version === "number" && parsed.state) {
      return ensureDecimals(parsed.state as GameState);
    }
    // 버전 필드 없는 레거시 형식 (기존 세이브 호환)
    if (parsed && parsed.scene && parsed.player) {
      return ensureDecimals(parsed as GameState);
    }
    return null;
  } catch {
    return null;
  }
}

// ─── 스토어 ───
export const gameStore = createStore<GameStore>((set, get) => ({
  ...initialState(),

  // ── 씬 전환 (+ 자동 저장) ──
  changeScene: (scene) => {
    set({ scene });
    // 비동기 저장 (다음 틱에서)
    setTimeout(() => get().saveGame(), 0);
  },

  // ── 수련 탭 ──
  processTrainingTap: () => {
    const { training, player, currencies } = get();
    if (training.toolDurability.lte(0)) return null;

    const mult = toolMultiplier(training.toolTier);
    const baseGain = player.sparring.mul(mult);

    // 랜덤 배분: 40~60% 펀치, 나머지 킥
    const punchRatio = 0.4 + Math.random() * 0.2;
    let punchGain = baseGain.mul(punchRatio);
    let kickGain = baseGain.mul(1 - punchRatio);

    const newDurability = Decimal.max(0, training.toolDurability.sub(1));
    const baseWon = new Decimal(1 + training.toolTier);
    const toolBroken = newDurability.lte(0);

    // 도구 파괴 체크
    if (toolBroken) {
      const breakBonus = baseGain.mul(3);
      punchGain = punchGain.add(breakBonus.mul(0.5));
      kickGain = kickGain.add(breakBonus.mul(0.5));
      const maxDur = toolMaxDurability(training.toolTier);
      const wonGain = baseWon.mul(5);

      set({
        player: {
          ...player,
          punch: player.punch.add(punchGain),
          kick: player.kick.add(kickGain),
        },
        currencies: {
          ...currencies,
          won: currencies.won.add(wonGain),
        },
        training: {
          ...training,
          toolDurability: maxDur,
          toolMaxDurability: maxDur,
        },
      });

      return { punchGain, kickGain, wonGain, toolBroken };
    }

    set({
      player: {
        ...player,
        punch: player.punch.add(punchGain),
        kick: player.kick.add(kickGain),
      },
      currencies: {
        ...currencies,
        won: currencies.won.add(baseWon),
      },
      training: {
        ...training,
        toolDurability: newDurability,
      },
    });

    return { punchGain, kickGain, wonGain: baseWon, toolBroken };
  },

  // ── 배틀 탭 ──
  processBattleTap: () => {
    const { player, battle } = get();
    if (!battle.isActive) return null;

    const phase = battle.attackPhase;
    const isCritical = Math.random() < 0.1; // 10% 크리티컬
    const critMult = isCritical ? 2 : 1;

    let dmg: Decimal;
    if (phase === "kick") {
      // 킥 페이즈: 위치 랜덤 선택
      const positions = ["front", "side", "back"] as const;
      const pos = positions[Math.floor(Math.random() * positions.length)];
      dmg = kickDamage(player.kick, pos).mul(critMult);
    } else {
      dmg = manualDamage(player.punch, player.kick).mul(critMult);
    }

    const newHp = Decimal.max(0, battle.enemyHp.sub(dmg));
    const advancing = nextPhase(phase);
    const isKill = newHp.lte(0);

    set({
      battle: { ...battle, enemyHp: newHp, attackPhase: advancing },
    });

    if (isKill) {
      const state = get();
      set(handleEnemyDefeated(state));
    }

    return { damage: dmg, attackPhase: phase, isCritical, isKill };
  },

  // ── 강화 구매 ──
  purchaseUpgrade: (stat) => {
    const { currencies, upgrades, player } = get();
    const level = upgrades[stat].level;
    const cost = upgradeCost(BASE_COSTS[stat], level);

    if (currencies.won.lt(cost)) return false;

    const newLevel = level + 1;
    const newPlayer = { ...player };

    switch (stat) {
      case "punch":
        newPlayer.punch = player.punch.add(5);
        break;
      case "kick":
        newPlayer.kick = player.kick.add(4);
        break;
      case "hp": {
        newPlayer.maxHp = player.maxHp.add(20);
        newPlayer.hp = newPlayer.maxHp;
        break;
      }
      case "evasion":
        newPlayer.evasion = Math.min(0.75, player.evasion + 0.005);
        break;
      case "sparring":
        newPlayer.sparring = player.sparring.add(0.5);
        break;
    }

    set({
      upgrades: { ...upgrades, [stat]: { level: newLevel } },
      currencies: { ...currencies, won: currencies.won.sub(cost) },
      player: newPlayer,
    });

    return true;
  },

  // ── 전투 시작 ──
  startBattle: (alleyNumber) => {
    const hp = minionHp(alleyNumber);
    set({
      scene: "battle",
      battle: {
        currentAlley: alleyNumber,
        enemyIndex: 0,
        enemyHp: hp,
        enemyMaxHp: hp,
        attackPhase: "left_punch",
        isBoss: false,
        isActive: true,
      },
    });
  },

  // ── 자동 공격 토글 ──
  toggleAutoAttack: () => {
    const { training } = get();
    set({
      training: {
        ...training,
        autoAttackActive: !training.autoAttackActive,
      },
    });
  },

  // ── 광고 보상 (자동 공격 시간 추가) ──
  addAutoAttackTime: (seconds) => {
    const { training } = get();
    set({
      training: {
        ...training,
        autoAttackActive: true,
        autoAttackTimeLeft: training.autoAttackTimeLeft + seconds,
      },
    });
  },

  // ── 보스 공격 → 플레이어 피격 ──
  bossAttackPlayer: () => {
    const { player, battle } = get();
    if (!battle.isActive || !battle.isBoss) return false;

    // 회피 판정
    if (Math.random() < player.evasion) return true;

    // 보스 공격력 = 적 최대HP의 5%
    const dmg = battle.enemyMaxHp.mul(0.05);
    const newHp = Decimal.max(0, player.hp.sub(dmg));

    set({ player: { ...player, hp: newHp } });

    // 플레이어 사망
    if (newHp.lte(0)) {
      set({
        battle: { ...battle, isActive: false },
      });
    }

    return false;
  },

  // ── 전투 도망 ──
  fleeBattle: () => {
    const { battle, player } = get();
    set({
      scene: "training",
      player: { ...player, hp: player.maxHp },
      battle: { ...battle, isActive: false },
    });
  },

  // ── 도구 등급 업그레이드 ──
  upgradeToolTier: () => {
    const { training, currencies } = get();
    const tierIndex = training.toolTier - 1; // 0~3
    if (tierIndex >= TOOL_UPGRADE_COSTS.length) return false; // 이미 최대

    const cost = new Decimal(TOOL_UPGRADE_COSTS[tierIndex]);
    if (currencies.won.lt(cost)) return false;

    const newTier = (training.toolTier + 1) as ToolTier;
    const maxDur = toolMaxDurability(newTier);

    set({
      currencies: { ...currencies, won: currencies.won.sub(cost) },
      training: {
        ...training,
        toolTier: newTier,
        toolDurability: maxDur,
        toolMaxDurability: maxDur,
      },
    });

    return true;
  },

  // ── 저장 ──
  saveGame: () => {
    const state = get();
    const stateOnly: GameState = {
      scene: state.scene,
      player: state.player,
      currencies: state.currencies,
      battle: state.battle,
      training: state.training,
      upgrades: state.upgrades,
      meta: { ...state.meta, lastSaveTime: Date.now() },
    };
    localStorage.setItem(SAVE_KEY, serializeState(stateOnly));
  },

  // ── 로드 ──
  loadGame: () => {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;

    const loaded = deserializeState(raw);
    if (!loaded) return false;

    set(loaded);
    return true;
  },

  // ── 리셋 ──
  reset: () => {
    localStorage.removeItem(SAVE_KEY);
    set(initialState());
  },

  // ── [DEV] 원 추가 ──
  devAddWon: (amount) => {
    const { currencies } = get();
    set({
      currencies: { ...currencies, won: currencies.won.add(amount) },
    });
  },

  // ── [DEV] 전체 골목 클리어 ──
  devClearAll: () => {
    const { meta } = get();
    set({
      meta: { ...meta, clearedAlleys: [1, 2, 3, 4, 5] },
    });
  },
}));
