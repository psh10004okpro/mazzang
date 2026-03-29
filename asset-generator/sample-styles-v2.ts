import OpenAI from "openai";
import sharp from "sharp";
import fs from "fs-extra";
import path from "path";
import { CONFIG } from "./config.js";

const client = new OpenAI({
  baseURL: CONFIG.API_BASE_URL,
  apiKey: CONFIG.API_KEY,
});

const SAMPLES_DIR = "./output/samples_v2";

const CHARACTER_BASE = `Korean young man in his 20s, short black hair, lean muscular build,
wearing white sleeveless shirt and dark training pants with sneakers,
fighting stance with fists up`;

const STYLES = [
  {
    name: "style_d",
    label: "D: 치비/SD 극단",
    prompt: `${CHARACTER_BASE}, cute chibi style, super deformed proportions with 2.5 head ratio,
big round head, tiny body, oversized fists, big expressive eyes,
thick bold outlines, flat vibrant colors, no shading,
cute but fierce expression, kawaii fighter,
full body, front facing, solid white background,
mobile idle game character, chibi mascot design`,
  },
  {
    name: "style_e",
    label: "E: 스트리트파이터 도트",
    prompt: `${CHARACTER_BASE}, pixel art style, 32-bit era fighting game sprite,
similar to Street Fighter III pixel art aesthetic,
detailed pixel shading, limited color palette,
clean pixel outlines, retro arcade game look,
dynamic fighting pose, nostalgic 90s game art,
full body, front facing, solid white background,
pixel art game character sprite sheet style`,
  },
  {
    name: "style_f",
    label: "F: 플랫 미니멀",
    prompt: `${CHARACTER_BASE}, modern flat design illustration,
minimalist geometric shapes, simple clean silhouette,
no outlines, flat color blocks with minimal detail,
modern app game style, simple face with minimal features,
trendy mobile game aesthetic like Monument Valley or Alto's Adventure,
full body, front facing, solid white background,
flat design game character, UI-friendly minimal art`,
  },
  {
    name: "style_g",
    label: "G: 90년대 아케이드",
    prompt: `${CHARACTER_BASE}, 1990s arcade beat-em-up game art style,
similar to Streets of Rage or Final Fight character design,
semi-realistic proportions, detailed muscle definition,
bold cel-shaded coloring, dramatic shading and highlights,
gritty urban fighter look, confident tough expression,
full body, front facing, solid white background,
retro arcade game character art, 16-bit era enhanced`,
  },
  {
    name: "style_h",
    label: "H: 만화 펜터치",
    prompt: `${CHARACTER_BASE}, Korean manhwa ink drawing style,
hand-drawn pen and ink linework, crosshatching shading,
raw sketchy energy, dynamic brush strokes,
black and white with selective color accents on fists and shoes,
gritty street manhwa aesthetic, Lookism or Viral Hit webtoon vibes,
intense determined expression, detailed facial features,
full body, front facing, solid white background,
manhwa character illustration, editorial style`,
  },
  {
    name: "style_i",
    label: "I: 카툰+웹툰 v2",
    prompt: `${CHARACTER_BASE}, determined fierce expression with slight grin,
stylized proportions with 5 head ratio, slightly bigger fists and shoulders,
bold clean black outlines, cel-shaded coloring with strong shadows,
Korean webtoon shading style but with cartoon game proportions,
vibrant saturated colors, dynamic pose weight on front foot,
muscular arms with bandaged knuckles, veins visible on forearms,
urban street fighter energy, underdog hero vibe,
full body, three quarter view facing slightly right, solid white background,
mobile action game character design, game-ready 2D art`,
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
  await fs.ensureDir(SAMPLES_DIR);

  const savedPaths: string[] = [];
  const savedLabels: string[] = [];

  for (const style of STYLES) {
    const outputPath = path.join(SAMPLES_DIR, `${style.name}.png`);
    console.log(`\n🎨 ${style.label} 생성 중...`);

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const buffer = await generateImage(style.prompt);
        await fs.writeFile(outputPath, buffer);
        console.log(`  저장: ${outputPath}`);
        savedPaths.push(outputPath);
        savedLabels.push(style.label);
        break;
      } catch (err: any) {
        console.error(`  시도 ${attempt} 실패: ${err.message}`);
        if (attempt < 2) await new Promise((r) => setTimeout(r, 3000));
      }
    }
  }

  // ── 비교 이미지: 2행 3열 그리드 ──
  if (savedPaths.length > 0) {
    console.log(`\n🖼️ 비교 이미지 생성 (${savedPaths.length}장)...`);

    const CELL = 480;
    const GAP = 12;
    const LABEL_H = 40;
    const COLS = 3;
    const ROWS = Math.ceil(savedPaths.length / COLS);
    const totalWidth = COLS * CELL + (COLS - 1) * GAP;
    const totalHeight = ROWS * (CELL + LABEL_H) + (ROWS - 1) * GAP;

    const composites: sharp.OverlayOptions[] = [];

    for (let i = 0; i < savedPaths.length; i++) {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const x = col * (CELL + GAP);
      const y = row * (CELL + LABEL_H + GAP);

      // 라벨
      const svg = Buffer.from(`
        <svg width="${CELL}" height="${LABEL_H}">
          <rect width="${CELL}" height="${LABEL_H}" fill="white"/>
          <text x="${CELL / 2}" y="28" text-anchor="middle"
                font-family="Arial, sans-serif" font-size="20" font-weight="bold"
                fill="#333">${savedLabels[i]}</text>
        </svg>
      `);
      composites.push({ input: svg, left: x, top: y });

      // 이미지
      const buf = await sharp(savedPaths[i])
        .resize(CELL, CELL, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } })
        .png()
        .toBuffer();
      composites.push({ input: buf, left: x, top: y + LABEL_H });
    }

    const compPath = path.join(SAMPLES_DIR, "comparison_v2.png");
    await sharp({
      create: {
        width: totalWidth,
        height: totalHeight,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      },
    })
      .composite(composites)
      .png()
      .toFile(compPath);

    console.log(`비교 이미지: ${compPath}`);
  }

  // ── 전체 비교 (v1 3장 + v2 6장 = 9장, 3x3 그리드) ──
  const v1Dir = "./output/samples";
  const v1Exists = await fs.pathExists(v1Dir);
  if (v1Exists && savedPaths.length > 0) {
    console.log("\n🖼️ 전체 비교 이미지 (9장) 생성...");

    const allPaths: string[] = [];
    const allLabels: string[] = [];

    const v1Styles = [
      { file: "style_a.png", label: "A: 펀치킹 카툰" },
      { file: "style_b.png", label: "B: 웹툰 격투" },
      { file: "style_c.png", label: "C: 하이브리드" },
    ];
    for (const s of v1Styles) {
      const p = path.join(v1Dir, s.file);
      if (await fs.pathExists(p)) {
        allPaths.push(p);
        allLabels.push(s.label);
      }
    }
    allPaths.push(...savedPaths);
    allLabels.push(...savedLabels);

    const CELL = 400;
    const GAP = 10;
    const LABEL_H = 36;
    const COLS = 3;
    const ROWS = Math.ceil(allPaths.length / COLS);
    const totalWidth = COLS * CELL + (COLS - 1) * GAP;
    const totalHeight = ROWS * (CELL + LABEL_H) + (ROWS - 1) * GAP;

    const composites: sharp.OverlayOptions[] = [];

    for (let i = 0; i < allPaths.length; i++) {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const x = col * (CELL + GAP);
      const y = row * (CELL + LABEL_H + GAP);

      const svg = Buffer.from(`
        <svg width="${CELL}" height="${LABEL_H}">
          <rect width="${CELL}" height="${LABEL_H}" fill="white"/>
          <text x="${CELL / 2}" y="26" text-anchor="middle"
                font-family="Arial, sans-serif" font-size="18" font-weight="bold"
                fill="#222">${allLabels[i]}</text>
        </svg>
      `);
      composites.push({ input: svg, left: x, top: y });

      const buf = await sharp(allPaths[i])
        .resize(CELL, CELL, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } })
        .png()
        .toBuffer();
      composites.push({ input: buf, left: x, top: y + LABEL_H });
    }

    const fullPath = path.join(SAMPLES_DIR, "comparison_all.png");
    await sharp({
      create: {
        width: totalWidth,
        height: totalHeight,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      },
    })
      .composite(composites)
      .png()
      .toFile(fullPath);

    console.log(`전체 비교 이미지: ${fullPath}`);
  }

  console.log("\n완료!");
}

main().catch((err) => {
  console.error("오류:", err);
  process.exit(1);
});
