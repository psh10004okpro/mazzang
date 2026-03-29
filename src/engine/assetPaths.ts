// ── 에셋 경로 관리 ──
// 모든 에셋은 public/assets/ 에 WebP로 배포

const BASE = "/assets";

// ── 주인공 스프라이트 시트 ──
export const PLAYER = {
  idle: `${BASE}/player/player_idle.webp`,
  punchLeft: `${BASE}/player/player_punch_left.webp`,
  punchRight: `${BASE}/player/player_punch_right.webp`,
  kickFront: `${BASE}/player/player_kick_front.webp`,
  kickSide: `${BASE}/player/player_kick_side.webp`,
  hit: `${BASE}/player/player_hit.webp`,
  spritesheet: `${BASE}/player/player_spritesheet.webp`,
} as const;

// ── 주인공 개별 프레임 (단일 이미지) ──
export const PLAYER_FRAMES = {
  idle: `${BASE}/player/frames/idle.png`,
  punchLeft: `${BASE}/player/frames/punch_left.png`,
  punchRight: `${BASE}/player/frames/punch_right.png`,
  kick: `${BASE}/player/frames/kick.png`,
  hit: `${BASE}/player/frames/hit.png`,
} as const;

// 주인공 스프라이트 메타
export const PLAYER_META = {
  idle: { frames: 4, width: 512, height: 512 },
  punchLeft: { frames: 4, width: 512, height: 512 },
  punchRight: { frames: 4, width: 512, height: 512 },
  kickFront: { frames: 4, width: 512, height: 512 },
  kickSide: { frames: 4, width: 512, height: 512 },
  hit: { frames: 3, width: 512, height: 512 },
} as const;

// ── 잡졸 스프라이트 시트 (골목별) ──
export function enemySheet(alleyNum: number): string {
  return `${BASE}/enemies/alley${alleyNum}_enemies.webp`;
}

// ── 잡졸 개별 프레임 ──
export function enemyFrame(alleyNum: number, pose: "idle" | "hit"): string {
  return `${BASE}/enemies/frames/alley${alleyNum}_${pose}.png`;
}

// ── 보스 개별 프레임 ──
export function bossFrame(alleyNum: number, pose: "idle" | "attack" | "defeat"): string {
  return `${BASE}/bosses/frames/boss${alleyNum}_${pose}.png`;
}

// ── 도구 개별 프레임 ──
export function toolFrame(grade: number): string {
  return `${BASE}/tools/frames/grade${grade}.png`;
}

// ── 수련 씬 이미지 (캐릭터+도구+배경 통합) ──
export function trainingSceneImage(grade: number): string {
  return `${BASE}/training/grade${grade}.png`;
}

// 잡졸 메타: 5종 × 2포즈(idle, hit) = 10프레임, 512px
export const ENEMY_META = {
  framesPerEnemy: 2, // idle + hit
  enemiesPerAlley: 5,
  frameWidth: 512,
  frameHeight: 512,
} as const;

// 잡졸 프레임 오프셋 계산 (enemyIndex 0~4, pose: 'idle'|'hit')
export function enemyFrameOffset(enemyIndex: number, pose: "idle" | "hit"): number {
  return enemyIndex * 2 + (pose === "hit" ? 1 : 0);
}

// ── 보스 스프라이트 시트 ──
const BOSS_NAMES = [
  "boss1_alley_captain", "boss2_shop_owner", "boss3_market_dragon",
  "boss4_nightlife_boss", "boss5_iron_worker", "boss6_harbor_wave",
  "boss7_port_ruler", "boss8_neon_king", "boss9_shadow", "boss10_mad_bear",
  "boss11_blade_wind", "boss12_golden_teeth", "boss13_pit_fighter",
  "boss14_chain_master", "boss15_silent_giant", "boss16_ex_champion",
  "boss17_martial_sage", "boss18_merc_captain", "boss19_dark_lord",
  "boss20_street_legend",
] as const;

export function bossSheet(alleyNum: number): string {
  const name = BOSS_NAMES[alleyNum - 1] ?? BOSS_NAMES[0];
  return `${BASE}/bosses/${name}.webp`;
}

// 보스 메타: 3포즈(idle, attack, defeat), 512px
export const BOSS_META = {
  frames: 3,
  frameWidth: 512,
  frameHeight: 512,
  poses: { idle: 0, attack: 1, defeat: 2 },
} as const;

// ── 배경 ──
export function battleBg(alleyNum: number): string {
  if (alleyNum <= 0) return `${BASE}/backgrounds/training_room.webp`;
  return `${BASE}/backgrounds/alley_${String(alleyNum).padStart(2, "0")}.webp`;
}

export const BACKGROUNDS = {
  training: `${BASE}/backgrounds/training_room.webp`,
  upgrade: `${BASE}/backgrounds/upgrade_shop.webp`,
  underground: `${BASE}/backgrounds/underground_arena.webp`,
} as const;

// 씬 일러스트 (캐릭터+배경)
export function sceneBg(alleyNum: number): string {
  return `${BASE}/backgrounds/alley_${String(alleyNum).padStart(2, "0")}_scene.webp`;
}

// ── 수련 도구 ──
export const TOOLS = {
  spritesheet: `${BASE}/tools/tools_spritesheet.webp`,
  meta: {
    grades: 5,
    statesPerGrade: 2, // normal, breaking
    frameWidth: 512,
    frameHeight: 512,
  },
} as const;

// 도구 프레임 오프셋 (grade 1~5, state: 'normal'|'breaking')
export function toolFrameOffset(grade: number, state: "normal" | "breaking"): number {
  return (grade - 1) * 2 + (state === "breaking" ? 1 : 0);
}

// ── 장비 외형 ──
const OUTFIT_NAMES = [
  "outfit01_bare_trainee", "outfit02_street_scrapper", "outfit03_alley_fighter",
  "outfit04_street_fist", "outfit05_amateur_boxer", "outfit06_dojo_student",
  "outfit07_street_warrior", "outfit08_wulin_disciple", "outfit09_iron_fist",
  "outfit10_pit_fighter", "outfit11_fight_champion", "outfit12_golden_warrior",
  "outfit13_dark_boss", "outfit14_dragon_disciple", "outfit15_storm_fist",
  "outfit16_flame_fighter", "outfit17_legendary_martial", "outfit18_mythic_king",
  "outfit19_transcendent", "outfit20_god_of_streets",
] as const;

export function outfitSheet(outfitNum: number): string {
  const name = OUTFIT_NAMES[outfitNum - 1] ?? OUTFIT_NAMES[0];
  return `${BASE}/equipment/${name}.webp`;
}

// 장비 메타: 6포즈, 512px
export const OUTFIT_META = {
  frames: 6,
  frameWidth: 512,
  frameHeight: 512,
  poses: { idle: 0, punchLeft: 1, punchRight: 2, kick: 3, hit: 4, victory: 5 },
} as const;

// ── UI 이펙트 ──
export const EFFECTS = {
  punchImpact: `${BASE}/ui/punch_impact.webp`,
  kickImpact: `${BASE}/ui/kick_impact.webp`,
  criticalImpact: `${BASE}/ui/critical_impact.webp`,
  koEffect: `${BASE}/ui/ko_effect.webp`,
} as const;

export const EFFECT_META = {
  frames: 4,
  frameWidth: 256,
  frameHeight: 256,
} as const;

// ── UI 아이콘 ──
export const ICONS = {
  punch: `${BASE}/ui/icon_punch.webp`,
  kick: `${BASE}/ui/icon_kick.webp`,
  gold: `${BASE}/ui/icon_gold.webp`,
  gem: `${BASE}/ui/icon_gem.webp`,
  hp: `${BASE}/ui/icon_hp.webp`,
  star: `${BASE}/ui/icon_star.webp`,
} as const;

// ── UI 버튼 ──
export const BUTTONS = {
  normal: `${BASE}/ui/btn_normal.webp`,
  highlight: `${BASE}/ui/btn_highlight.webp`,
  disabled: `${BASE}/ui/btn_disabled.webp`,
} as const;
