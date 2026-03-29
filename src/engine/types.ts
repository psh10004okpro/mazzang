import Decimal from "break_infinity.js";

// ── 씬 ──
export type SceneName = "training" | "map" | "battle" | "upgrade";

// ── 공격 페이즈 ──
export type AttackPhase = "left_punch" | "right_punch" | "kick";

// ── 킥 위치 ──
export type KickPosition = "front" | "side" | "back";

// ── 수련 도구 등급 (1~5) ──
export type ToolTier = 1 | 2 | 3 | 4 | 5;

// ── 강화 가능한 스탯 ──
export type UpgradeStat = "punch" | "kick" | "hp" | "evasion" | "sparring";

// ── 플레이어 ──
export interface PlayerState {
  punch: Decimal;
  kick: Decimal;
  hp: Decimal;
  maxHp: Decimal;
  /** 회피율 (0~1) */
  evasion: number;
  /** 수련 배율 */
  sparring: Decimal;
}

// ── 재화 ──
export interface CurrencyState {
  won: Decimal;
  gems: Decimal;
}

// ── 전투 ──
export interface BattleState {
  currentAlley: number;
  enemyIndex: number;
  enemyHp: Decimal;
  enemyMaxHp: Decimal;
  attackPhase: AttackPhase;
  isBoss: boolean;
  isActive: boolean;
}

// ── 수련 ──
export interface TrainingState {
  toolTier: ToolTier;
  toolDurability: Decimal;
  toolMaxDurability: Decimal;
  autoAttackActive: boolean;
  /** 자동 공격 남은 시간 (초) */
  autoAttackTimeLeft: number;
}

// ── 강화 레벨 ──
export type UpgradesState = Record<UpgradeStat, { level: number }>;

// ── 메타 ──
export interface MetaState {
  lastSaveTime: number;
  clearedAlleys: number[];
}

// ── 전투 탭 결과 ──
export interface TapResult {
  damage: Decimal;
  attackPhase: AttackPhase;
  isCritical: boolean;
  isKill: boolean;
}

// ── 전체 게임 상태 ──
export interface GameState {
  scene: SceneName;
  player: PlayerState;
  currencies: CurrencyState;
  battle: BattleState;
  training: TrainingState;
  upgrades: UpgradesState;
  meta: MetaState;
}

// ── 수련 탭 결과 ──
export interface TrainingTapResult {
  punchGain: Decimal;
  kickGain: Decimal;
  wonGain: Decimal;
  toolBroken: boolean;
}

// ── 게임 액션 ──
export interface GameActions {
  /** 수련 씬에서 탭 */
  processTrainingTap: () => TrainingTapResult | null;
  /** 배틀 씬에서 탭 → 결과 반환 */
  processBattleTap: () => TapResult | null;
  /** 강화 구매 */
  purchaseUpgrade: (stat: UpgradeStat) => boolean;
  /** 씬 전환 */
  changeScene: (scene: SceneName) => void;
  /** 골목 선택 → 전투 시작 */
  startBattle: (alleyNumber: number) => void;
  /** 자동 공격 토글 */
  toggleAutoAttack: () => void;
  /** 광고 보상 (자동 공격 시간 추가) */
  addAutoAttackTime: (seconds: number) => void;
  /** 도구 등급 업그레이드 */
  upgradeToolTier: () => boolean;
  /** 보스 공격 → 플레이어 HP 감소, 회피 판��� 포함. 회피 시 true 반환 */
  bossAttackPlayer: () => boolean;
  /** 전투 도망 → 수련 씬 복�� (진행도 유지) */
  fleeBattle: () => void;
  /** localStorage에 저장 */
  saveGame: () => void;
  /** localStorage에서 로드 */
  loadGame: () => boolean;
  /** 게임 리셋 */
  reset: () => void;
  /** [DEV] 원 추가 */
  devAddWon: (amount: number) => void;
  /** [DEV] 전체 골목 클리어 */
  devClearAll: () => void;
}

export type GameStore = GameState & GameActions;
