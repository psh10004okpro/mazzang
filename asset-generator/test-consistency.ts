import OpenAI from "openai";
import sharp from "sharp";
import fs from "fs-extra";
import path from "path";
import { CONFIG } from "./config.js";

const client = new OpenAI({
  baseURL: CONFIG.API_BASE_URL,
  apiKey: CONFIG.API_KEY,
});

const OUTPUT_DIR = "./output/player";

// ── 일관성 유지를 위한 스타일 프리픽스 ──
const STYLE_PREFIX = `2D mobile game character sprite, Korean webtoon meets cartoon game style,
consistent character design, same face and body proportions across all poses,
Korean young man in his 20s, short black hair swept to the right, lean muscular build,
wearing white sleeveless shirt and dark charcoal gray training pants with black sneakers,
bandaged knuckles on both hands, slight veins on forearms,
stylized proportions with 5 head ratio, slightly bigger fists and broader shoulders,
bold clean black outlines with consistent line weight,
cel-shaded coloring with strong shadows, warm skin tone,
solid white background, full body, facing right side,
mobile action game character sprite, game-ready 2D art,`;

const POSES = [
  {
    name: "idle",
    label: "대기 (Idle)",
    prompt: `${STYLE_PREFIX}
relaxed fighting stance, both fists loosely raised near chin in boxing guard,
weight evenly distributed on both feet, legs shoulder-width apart,
neutral confident expression with slight smirk, calm but ready to fight`,
  },
  {
    name: "punch_left",
    label: "왼손 펀치",
    prompt: `${STYLE_PREFIX}
throwing left jab punch, left arm fully extended forward with fist,
right fist still up guarding chin, body slightly rotated right,
weight shifted to front foot, intense focused expression,
motion lines trailing behind left fist showing speed`,
  },
  {
    name: "punch_right",
    label: "오른손 펀치",
    prompt: `${STYLE_PREFIX}
throwing powerful right cross punch, right arm fully extended forward with fist,
left fist pulled back guarding chin, body rotated into the punch,
weight on front foot leaning forward, fierce aggressive expression,
motion lines trailing behind right fist showing power and speed`,
  },
  {
    name: "kick",
    label: "발차기 (Kick)",
    prompt: `${STYLE_PREFIX}
executing high roundhouse kick with right leg extended to the side,
left foot firmly planted on ground, arms spread for balance,
right leg fully extended with foot at head height, dynamic powerful pose,
intense yelling expression, motion lines around the kicking leg`,
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

  const savedPaths: string[] = [];
  const savedLabels: string[] = [];

  for (let i = 0; i < POSES.length; i++) {
    const pose = POSES[i];
    const outputPath = path.join(OUTPUT_DIR, `${pose.name}.png`);
    console.log(`\n[${i + 1}/${POSES.length}] ${pose.label} 생성 중...`);

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const buffer = await generateImage(pose.prompt);
        await fs.writeFile(outputPath, buffer);
        console.log(`  저장: ${outputPath}`);
        savedPaths.push(outputPath);
        savedLabels.push(pose.label);
        break;
      } catch (err: any) {
        console.error(`  시도 ${attempt} 실패: ${err.message}`);
        if (attempt < 3) await new Promise((r) => setTimeout(r, 3000));
      }
    }
  }

  // ── 비교 이미지 생성 ──
  if (savedPaths.length > 0) {
    console.log(`\n비교 이미지 생성 (${savedPaths.length}장)...`);

    const CELL = 420;
    const GAP = 10;
    const LABEL_H = 36;
    const totalW = savedPaths.length * CELL + (savedPaths.length - 1) * GAP;
    const totalH = CELL + LABEL_H;

    const composites: sharp.OverlayOptions[] = [];

    for (let i = 0; i < savedPaths.length; i++) {
      const x = i * (CELL + GAP);

      // 라벨
      const svg = Buffer.from(`
        <svg width="${CELL}" height="${LABEL_H}">
          <rect width="${CELL}" height="${LABEL_H}" fill="white"/>
          <text x="${CELL / 2}" y="26" text-anchor="middle"
                font-family="Arial, sans-serif" font-size="20" font-weight="bold"
                fill="#333">${savedLabels[i]}</text>
        </svg>
      `);
      composites.push({ input: svg, left: x, top: 0 });

      // 이미지
      const buf = await sharp(savedPaths[i])
        .resize(CELL, CELL, {
          fit: "contain",
          background: { r: 255, g: 255, b: 255, alpha: 1 },
        })
        .png()
        .toBuffer();
      composites.push({ input: buf, left: x, top: LABEL_H });
    }

    const compPath = path.join(OUTPUT_DIR, "player_poses_test.png");
    await sharp({
      create: {
        width: totalW,
        height: totalH,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      },
    })
      .composite(composites)
      .png()
      .toFile(compPath);

    console.log(`비교 이미지: ${compPath}`);
  }

  console.log("\n완료!");
}

main().catch((err) => {
  console.error("오류:", err);
  process.exit(1);
});
