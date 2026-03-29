import sharp from "sharp";
import { readFileSync, writeFileSync } from "fs";
import { CONFIG, IMG2IMG_SUFFIX, PUNCH_SUFFIX } from "./config.js";

const OUTPUT_DIR = "./output/player_final/punch_left";
const SPRITE_DIR = "./sprites/player";
const FRAME_SIZE = 256;
const refBase64 = readFileSync("./output/samples_v2/style_i.png").toString("base64");

// 핵심: "only ONE arm punches, the OTHER arm stays bent near chin"
const FRAMES = [
  {
    frame: 1,
    prompt: `This exact same character in the same art style. Preparing to punch. Only the RIGHT arm is pulling back to load power. The LEFT arm stays bent with fist near chin as a guard. Do NOT extend both arms. ${PUNCH_SUFFIX} ${IMG2IMG_SUFFIX}`,
  },
  {
    frame: 2,
    prompt: `This exact same character in the same art style. Mid-punch. Only the RIGHT arm is extending halfway forward. The LEFT arm remains bent with fist tucked near chin protecting the face. Do NOT punch with both arms. ${PUNCH_SUFFIX} ${IMG2IMG_SUFFIX}`,
  },
  {
    frame: 3,
    prompt: `This exact same character in the same art style. Full punch. Only the RIGHT fist is fully extended forward at shoulder height with speed lines. The LEFT fist stays near the chin as a guard, elbow bent. One arm punches, one arm guards. ${PUNCH_SUFFIX} ${IMG2IMG_SUFFIX}`,
  },
  {
    frame: 4,
    prompt: `This exact same character in the same art style. Recovering from punch. The RIGHT arm is retracting back after punching. The LEFT arm is still bent near the chin guarding. Returning to fighting stance. ${PUNCH_SUFFIX} ${IMG2IMG_SUFFIX}`,
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
  for (const f of FRAMES) {
    console.log(`frame_${f.frame} 재생성 중...`);
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const rawBuf = await generateWithRef(f.prompt);
        writeFileSync(`${OUTPUT_DIR}/frame_${f.frame}_raw.png`, rawBuf);

        const noBg = await removeWhiteBackground(rawBuf);
        const resized = await sharp(noBg)
          .resize(FRAME_SIZE, FRAME_SIZE, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
          .png().toBuffer();
        writeFileSync(`${OUTPUT_DIR}/frame_${f.frame}.png`, resized);

        console.log(`  ✅ frame_${f.frame}`);
        break;
      } catch (e: any) {
        console.error(`  시도 ${attempt} 실패: ${e.message}`);
        if (attempt < 3) await new Promise((r) => setTimeout(r, 3000));
      }
    }
  }

  // 스프라이트 시트 재빌드
  console.log("스프라이트 시트 재빌드...");
  const composites: sharp.OverlayOptions[] = [];
  for (let i = 0; i < 4; i++) {
    composites.push({
      input: readFileSync(`${OUTPUT_DIR}/frame_${i + 1}.png`),
      left: i * FRAME_SIZE,
      top: 0,
    });
  }
  await sharp({
    create: { width: FRAME_SIZE * 4, height: FRAME_SIZE, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  }).composite(composites).png().toFile(`${SPRITE_DIR}/player_punch_left.png`);
  await sharp(`${SPRITE_DIR}/player_punch_left.png`).webp({ quality: 90 }).toFile(`${SPRITE_DIR}/player_punch_left.webp`);

  console.log("✅ 완료");
}

main().catch(console.error);
