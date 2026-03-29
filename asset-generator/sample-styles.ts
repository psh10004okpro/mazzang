import OpenAI from "openai";
import sharp from "sharp";
import fs from "fs-extra";
import path from "path";
import { CONFIG } from "./config.js";

const client = new OpenAI({
  baseURL: CONFIG.API_BASE_URL,
  apiKey: CONFIG.API_KEY,
});

const SAMPLES_DIR = "./output/samples";

const STYLES = [
  {
    name: "style_a",
    label: "A: 펀치킹 카툰",
    prompt: `2D mobile game character, cartoon style similar to Punch King Project game,
Korean young man in his 20s, short black hair, lean muscular build,
wearing white sleeveless shirt and training pants with sneakers,
fighting stance with fists up, determined expression,
bold black outlines, vibrant colors, slightly exaggerated proportions,
full body, front facing, solid white background,
mobile game character design, clean vector-like art`,
  },
  {
    name: "style_b",
    label: "B: 웹툰 격투",
    prompt: `Korean webtoon style fighting character, similar to God of High School manhwa art style,
Korean young man in his 20s, short black hair, lean muscular build,
wearing white sleeveless shirt and training pants with sneakers,
fighting stance with fists up, intense expression,
dynamic manhwa illustration style, sharp linework, cel-shaded coloring,
detailed anatomy, street fighter vibes, full body, front facing,
solid white background, game character design sheet`,
  },
  {
    name: "style_c",
    label: "C: 하이브리드",
    prompt: `2D mobile game character, Korean webtoon meets cartoon game style,
Korean young man in his 20s, short black hair, lean muscular build,
wearing white sleeveless shirt and training pants with sneakers,
fighting stance with fists up, confident smirk,
clean bold outlines like mobile game, but with manhwa-style shading and detail,
slightly stylized proportions (bigger fists, broader shoulders),
vibrant colors with cel-shading, full body, front facing,
solid white background, mobile clicker game character art`,
  },
];

async function generateImage(prompt: string): Promise<Buffer> {
  console.log("  API 호출 중...");

  const response = await client.images.generate({
    model: CONFIG.MODEL,
    prompt,
    n: 1,
    size: "1024x1024",
  });

  const data = response.data[0];

  if (data.b64_json) {
    return Buffer.from(data.b64_json, "base64");
  }

  if (data.url) {
    console.log("  이미지 다운로드 중...");
    const res = await fetch(data.url);
    if (!res.ok) throw new Error(`다운로드 실패: ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  }

  throw new Error("API 응답에 이미지 데이터 없음");
}

async function main() {
  await fs.ensureDir(SAMPLES_DIR);

  const savedPaths: string[] = [];

  for (const style of STYLES) {
    const outputPath = path.join(SAMPLES_DIR, `${style.name}.png`);
    console.log(`\n🎨 ${style.label} 생성 중...`);

    try {
      const buffer = await generateImage(style.prompt);
      await fs.writeFile(outputPath, buffer);
      console.log(`  저장 완료: ${outputPath}`);
      savedPaths.push(outputPath);
    } catch (err: any) {
      console.error(`  실패: ${err.message}`);

      // 재시도 1회
      console.log("  재시도 중...");
      await new Promise((r) => setTimeout(r, 3000));
      try {
        const buffer = await generateImage(style.prompt);
        await fs.writeFile(outputPath, buffer);
        console.log(`  저장 완료: ${outputPath}`);
        savedPaths.push(outputPath);
      } catch (err2: any) {
        console.error(`  재시도도 실패: ${err2.message}`);
      }
    }
  }

  // 비교 이미지 생성
  if (savedPaths.length > 0) {
    console.log(`\n🖼️ 비교 이미지 생성 중... (${savedPaths.length}장)`);

    const CELL = 512;
    const GAP = 16;
    const LABEL_H = 48;
    const totalWidth = CELL * savedPaths.length + GAP * (savedPaths.length - 1);
    const totalHeight = CELL + LABEL_H;

    // 각 이미지를 512x512로 리사이즈
    const resized: { input: Buffer; left: number; top: number }[] = [];

    for (let i = 0; i < savedPaths.length; i++) {
      const buf = await sharp(savedPaths[i])
        .resize(CELL, CELL, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } })
        .png()
        .toBuffer();

      resized.push({
        input: buf,
        left: i * (CELL + GAP),
        top: LABEL_H,
      });
    }

    // 라벨 SVG 생성
    const labels: { input: Buffer; left: number; top: number }[] = [];
    for (let i = 0; i < savedPaths.length; i++) {
      const label = STYLES[i]?.label ?? `Style ${i}`;
      const svg = Buffer.from(`
        <svg width="${CELL}" height="${LABEL_H}">
          <rect width="${CELL}" height="${LABEL_H}" fill="white"/>
          <text x="${CELL / 2}" y="34" text-anchor="middle"
                font-family="Arial, sans-serif" font-size="24" font-weight="bold"
                fill="#333">${label}</text>
        </svg>
      `);
      labels.push({
        input: svg,
        left: i * (CELL + GAP),
        top: 0,
      });
    }

    const comparisonPath = path.join(SAMPLES_DIR, "comparison.png");

    await sharp({
      create: {
        width: totalWidth,
        height: totalHeight,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      },
    })
      .composite([...labels, ...resized])
      .png()
      .toFile(comparisonPath);

    console.log(`\n비교 이미지 저장: ${comparisonPath}`);
  }

  console.log("\n완료!");
}

main().catch((err) => {
  console.error("오류:", err);
  process.exit(1);
});
