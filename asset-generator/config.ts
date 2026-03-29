import path from "path";

export const CONFIG = {
  API_BASE_URL: "https://mlapi.run/820ebe88-0383-4fa4-b5e9-06fcf26b3420/v1",
  API_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3NzMwMjQ0NDYsIm5iZiI6MTc3MzAyNDQ0Niwia2V5X2lkIjoiNWQ5NmVkOTEtNzZlMy00MmY0LTllZGItOWM0YzQ4NjQ5MjFmIn0.D8sK3v9F4cVXA-LAXHi1RbOnuq5VQb42DzaKJLUL0Xw",
  MODEL: "google/gemini-3-pro-image-preview",
  OUTPUT_DIR: "./output",
  SPRITE_DIR: "./sprites",
  IMAGE_SIZE: "1024x1024",
  CONCURRENCY: 2,
  RETRY_COUNT: 3,
  RETRY_DELAY_MS: 2000,
} as const;

// ── 확정 전략: v7 (img2img 참조 + 최소 프롬프트) ──
//
// 핵심 원칙:
// 1. Style I 원본(style_i.png)을 참조 이미지로 사용 → 스타일/비율 자동 일치
// 2. 프롬프트는 포즈 변경만 간결하게 (길면 참조를 덮어씀)
// 3. images/generations에 image 필드 = raw base64 (data URI 없이)
//
// 캐릭터 카테고리(player, enemies, bosses): 참조 이미지 사용
// 비캐릭터 카테고리(tools, backgrounds, equipment): 텍스트 프롬프트만 사용

/** 주인공 참조 이미지 경로 (Style I 원본) */
export const PLAYER_REFERENCE_PATH = path.resolve("./output/samples_v2/style_i.png");

/** img2img 프롬프트에 항상 붙이는 공통 지시 */
export const IMG2IMG_SUFFIX = "Do not crop, show complete full body from head to feet including shoes. Character facing right. White background. Single character.";

/** 펀치 포즈에 추가하는 원근 과장 방지 */
export const PUNCH_SUFFIX = "Side view, no foreshortening, no exaggerated fist size, fist stays the same size as in idle pose.";

// 비캐릭터 에셋용 텍스트 전용 스타일
export const CATEGORY_STYLES: Record<string, string> = {
  tools:
    "2D game item icon, clean recognizable design, martial arts training gear, bold outlines, cel-shaded, solid white background, single item centered, no character",
  backgrounds:
    "2D mobile game background, Korean urban alley scene, atmospheric, moody lighting, wide aspect ratio, detailed environment, no characters",
  equipment:
    "2D game UI icon, clean bold design, cel-shaded, glowing effect, martial arts themed, solid white background, single icon centered, no character",
};
