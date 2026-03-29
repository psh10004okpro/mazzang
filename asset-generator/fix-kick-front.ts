import sharp from "sharp";
import { readFileSync, writeFileSync, unlinkSync } from "fs";
import { CONFIG, IMG2IMG_SUFFIX } from "./config.js";

const OUTPUT_DIR = "./output/player_final/kick_front";
const SPRITE_DIR = "./sprites/player";
const FRAME_SIZE = 256;
const refBase64 = readFileSync("./output/samples_v2/style_i.png").toString("base64");

// 다리 3개 문제 → "only two legs, anatomically correct" 강조
const FIXES = [
  {
    frame: 3,
    prompt: `This exact same character in the same art style. Full front kick, right leg fully extended forward at chest height, foot flexed forward, LEFT leg firmly planted on ground. Only two legs, anatomically correct human body. Arms in guard position near face. ${IMG2IMG_SUFFIX}`,
  },
  {
    frame: 4,
    prompt: `This exact same character in the same art style. Recovering from a kick, right leg coming back down toward the ground, returning to normal fighting stance. Both feet nearly on the ground. Only two legs, anatomically correct human body. ${IMG2IMG_SUFFIX}`,
  },
];

async function generateWithRef(prompt: string): Promise<Buffer> {
  const res = await fetch(`${CONFIG.API_BASE_URL}/images/generations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${CONFIG.API_KEY}`,
    },
    body: JSON.stringify({
      model: CONFIG.MODEL,
      prompt,
      n: 1,
      size: "1024x1024",
      image: refBase64,
    }),
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  const json = (await res.json()) as any;
  const data = json.data?.[0];
  if (data.b64_json) return Buffer.from(data.b64_json, "base64");
  if (data.url) {
    const r = await fetch(data.url);
    return Buffer.from(await r.arrayBuffer());
  }
  throw new Error("no image");
}

async function removeWhiteBackground(input: Buffer): Promise<Buffer> {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const pixels = Buffer.from(data);
  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
    const dist = Math.sqrt((r - 255) ** 2 + (g - 255) ** 2 + (b - 255) ** 2);
    if (dist <= 30) pixels[i + 3] = 0;
    else if (dist <= 60) pixels[i + 3] = Math.min(pixels[i + 3], Math.round(((dist - 30) / 30) * 255));
  }
  return sharp(pixels, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
}

async function main() {
  for (const fix of FIXES) {
    console.log(`\nframe_${fix.frame} 재생성 중...`);

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const rawBuf = await generateWithRef(fix.prompt);
        writeFileSync(`${OUTPUT_DIR}/frame_${fix.frame}_raw.png`, rawBuf);

        const noBg = await removeWhiteBackground(rawBuf);
        const resized = await sharp(noBg)
          .resize(FRAME_SIZE, FRAME_SIZE, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
          .png().toBuffer();
        writeFileSync(`${OUTPUT_DIR}/frame_${fix.frame}.png`, resized);

        console.log(`  ✅ frame_${fix.frame} 저장`);
        break;
      } catch (e: any) {
        console.error(`  시도 ${attempt} 실패: ${e.message}`);
        if (attempt < 3) await new Promise((r) => setTimeout(r, 3000));
      }
    }
  }

  // 스프라이트 시트 재빌드
  console.log("\n스프라이트 시트 재빌드...");
  const frames = [1, 2, 3, 4];
  const composites: sharp.OverlayOptions[] = [];
  for (let i = 0; i < frames.length; i++) {
    const buf = readFileSync(`${OUTPUT_DIR}/frame_${frames[i]}.png`);
    composites.push({ input: buf, left: i * FRAME_SIZE, top: 0 });
  }
  await sharp({
    create: { width: FRAME_SIZE * 4, height: FRAME_SIZE, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  }).composite(composites).png().toFile(`${SPRITE_DIR}/player_kick_front.png`);
  await sharp(`${SPRITE_DIR}/player_kick_front.png`).webp({ quality: 90 }).toFile(`${SPRITE_DIR}/player_kick_front.webp`);

  console.log("✅ 완료");
}

main().catch(console.error);
