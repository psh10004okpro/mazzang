import OpenAI from "openai";
import sharp from "sharp";
import fs from "fs-extra";
import path from "path";
import { CONFIG } from "./config.js";

const client = new OpenAI({
  baseURL: CONFIG.API_BASE_URL,
  apiKey: CONFIG.API_KEY,
});

const OUTPUT_DIR = "./output/test_punch";

const STYLE_BASE = `2D mobile game character, Korean webtoon meets cartoon game style,
Korean young man in his 20s, short black hair, lean muscular build,
wearing white sleeveless shirt and dark training pants with sneakers,
stylized proportions with 5 head ratio, slightly bigger fists and shoulders,
bold clean black outlines, cel-shaded coloring with strong shadows,
muscular arms with bandaged knuckles, veins visible on forearms,
solid white background, mobile action game character sprite, game-ready 2D art`;

const PUNCH_FRAMES = [
  {
    name: "frame_000",
    prompt: `${STYLE_BASE},
fighting idle stance, fists up in guard position near chin, weight centered,
ready to punch, tense muscles, determined fierce expression with slight grin,
full body, facing right side`,
  },
  {
    name: "frame_001",
    prompt: `${STYLE_BASE},
winding up right fist punch, right arm pulled back behind shoulder, left fist still guarding chin,
body twisting to the left to load power, weight shifting to back foot,
intense focused expression, full body, facing right side`,
  },
  {
    name: "frame_002",
    prompt: `${STYLE_BASE},
throwing powerful right straight punch, right fist fully extended forward hitting target,
left arm pulled back, body rotated into the punch, weight on front foot,
impact moment, aggressive yelling expression, speed lines near fist,
full body, facing right side`,
  },
  {
    name: "frame_003",
    prompt: `${STYLE_BASE},
punch follow-through, right arm still extended but slightly past target,
body leaning forward from momentum, left arm back for balance,
powerful impact pose, confident expression,
full body, facing right side`,
  },
  {
    name: "frame_004",
    prompt: `${STYLE_BASE},
recovering from punch, pulling right fist back to guard position,
body returning to center, both arms coming back up,
transitioning back to idle stance, alert expression,
full body, facing right side`,
  },
];

async function generateImage(prompt: string): Promise<Buffer> {
  const response = await client.images.generate({
    model: CONFIG.MODEL,
    prompt,
    n: 1,
    size: "1024x1024",
  });
  const data = response.data[0];
  if (data.b64_json) return Buffer.from(data.b64_json, "base64");
  if (data.url) {
    const res = await fetch(data.url);
    if (!res.ok) throw new Error(`다운로드 실패: ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  }
  throw new Error("API 응답에 이미지 데이터 없음");
}

async function main() {
  await fs.ensureDir(OUTPUT_DIR);

  const framePaths: string[] = [];

  // 1. 각 프레임 생성
  for (let i = 0; i < PUNCH_FRAMES.length; i++) {
    const frame = PUNCH_FRAMES[i];
    const outputPath = path.join(OUTPUT_DIR, `${frame.name}.png`);
    console.log(`\n[${i + 1}/${PUNCH_FRAMES.length}] ${frame.name} 생성 중...`);

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const buffer = await generateImage(frame.prompt);
        await fs.writeFile(outputPath, buffer);
        console.log(`  저장: ${outputPath}`);
        framePaths.push(outputPath);
        break;
      } catch (err: any) {
        console.error(`  시도 ${attempt} 실패: ${err.message}`);
        if (attempt < 2) await new Promise((r) => setTimeout(r, 3000));
      }
    }
  }

  if (framePaths.length === 0) {
    console.error("프레임 생성 실패");
    return;
  }

  // 2. 개별 프레임 미리보기 (가로 나열)
  console.log(`\n프레임 미리보기 생성 (${framePaths.length}장)...`);

  const PREVIEW_CELL = 300;
  const GAP = 8;
  const LABEL_H = 32;
  const previewW = framePaths.length * PREVIEW_CELL + (framePaths.length - 1) * GAP;
  const previewH = PREVIEW_CELL + LABEL_H;

  const previewComposites: sharp.OverlayOptions[] = [];
  const labels = ["1: 대기", "2: 와인드업", "3: 펀치!", "4: 팔로우스루", "5: 복귀"];

  for (let i = 0; i < framePaths.length; i++) {
    const x = i * (PREVIEW_CELL + GAP);

    const svg = Buffer.from(`
      <svg width="${PREVIEW_CELL}" height="${LABEL_H}">
        <rect width="${PREVIEW_CELL}" height="${LABEL_H}" fill="white"/>
        <text x="${PREVIEW_CELL / 2}" y="22" text-anchor="middle"
              font-family="Arial, sans-serif" font-size="16" font-weight="bold"
              fill="#333">${labels[i] || `Frame ${i + 1}`}</text>
      </svg>
    `);
    previewComposites.push({ input: svg, left: x, top: 0 });

    const buf = await sharp(framePaths[i])
      .resize(PREVIEW_CELL, PREVIEW_CELL, {
        fit: "contain",
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      })
      .png()
      .toBuffer();
    previewComposites.push({ input: buf, left: x, top: LABEL_H });
  }

  const previewPath = path.join(OUTPUT_DIR, "punch_preview.png");
  await sharp({
    create: {
      width: previewW,
      height: previewH,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .composite(previewComposites)
    .png()
    .toFile(previewPath);
  console.log(`미리보기: ${previewPath}`);

  // 3. 스프라이트 시트 (64x64 프레임)
  console.log("\n스프라이트 시트 생성 (64x64 프레임)...");

  const SPRITE_SIZE = 64;
  const sheetW = SPRITE_SIZE * framePaths.length;
  const sheetH = SPRITE_SIZE;

  const spriteComposites: sharp.OverlayOptions[] = [];
  for (let i = 0; i < framePaths.length; i++) {
    const buf = await sharp(framePaths[i])
      .resize(SPRITE_SIZE, SPRITE_SIZE, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toBuffer();
    spriteComposites.push({ input: buf, left: i * SPRITE_SIZE, top: 0 });
  }

  const sheetPath = path.join(OUTPUT_DIR, "punch_sprite_64.png");
  await sharp({
    create: {
      width: sheetW,
      height: sheetH,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(spriteComposites)
    .png()
    .toFile(sheetPath);
  console.log(`스프라이트 시트 (64px): ${sheetPath}`);

  // 4. 스프라이트 시트 (128x128 프레임) — 더 디테일한 버전
  console.log("스프라이트 시트 생성 (128x128 프레임)...");

  const SPRITE_LG = 128;
  const sheetLgW = SPRITE_LG * framePaths.length;

  const spriteLgComposites: sharp.OverlayOptions[] = [];
  for (let i = 0; i < framePaths.length; i++) {
    const buf = await sharp(framePaths[i])
      .resize(SPRITE_LG, SPRITE_LG, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toBuffer();
    spriteLgComposites.push({ input: buf, left: i * SPRITE_LG, top: 0 });
  }

  const sheetLgPath = path.join(OUTPUT_DIR, "punch_sprite_128.png");
  await sharp({
    create: {
      width: sheetLgW,
      height: SPRITE_LG,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(spriteLgComposites)
    .png()
    .toFile(sheetLgPath);
  console.log(`스프라이트 시트 (128px): ${sheetLgPath}`);

  // 5. 메타데이터
  const metadata = {
    name: "player_right_punch",
    style: "I",
    frameCount: framePaths.length,
    sprites: {
      "64x64": { file: "punch_sprite_64.png", frameWidth: 64, frameHeight: 64 },
      "128x128": { file: "punch_sprite_128.png", frameWidth: 128, frameHeight: 128 },
    },
    frames: framePaths.map((_, i) => ({
      index: i,
      label: labels[i],
    })),
  };
  await fs.writeJson(path.join(OUTPUT_DIR, "metadata.json"), metadata, { spaces: 2 });

  console.log("\n완료!");
}

main().catch((err) => {
  console.error("오류:", err);
  process.exit(1);
});
