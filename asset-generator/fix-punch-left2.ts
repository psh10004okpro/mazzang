import sharp from "sharp";
import { readFileSync, writeFileSync } from "fs";
import { CONFIG, IMG2IMG_SUFFIX, PUNCH_SUFFIX } from "./config.js";

const OUTPUT_DIR = "./output/player_final/punch_left";
const SPRITE_DIR = "./sprites/player";
const FRAME_SIZE = 256;
const refBase64 = readFileSync("./output/samples_v2/style_i.png").toString("base64");

// v7 좌우 반전 규칙 재확인:
// 왼손 펀치 = 캐릭터의 왼손 = 뷰어에서 뒤쪽 팔
// 프롬프트에서 LEFT로 써야 실제 왼손이 나감
const FRAMES = [
  {
    frame: 1,
    prompt: `This exact same character in the same art style. Preparing a left jab. The LEFT arm is pulling back to load power near the shoulder. The other arm stays bent with fist near chin as guard. Only one arm punches. ${PUNCH_SUFFIX} ${IMG2IMG_SUFFIX}`,
  },
  {
    frame: 2,
    prompt: `This exact same character in the same art style. Mid left jab punch. The LEFT arm is extending halfway forward. The other arm remains bent with fist tucked near chin protecting face. Only one arm punches. ${PUNCH_SUFFIX} ${IMG2IMG_SUFFIX}`,
  },
  {
    frame: 3,
    prompt: `This exact same character in the same art style. Full left jab. The LEFT fist is fully extended forward at shoulder height with speed lines behind it. The other fist stays near chin as guard, elbow bent. Only one arm punches, one arm guards. ${PUNCH_SUFFIX} ${IMG2IMG_SUFFIX}`,
  },
  {
    frame: 4,
    prompt: `This exact same character in the same art style. Recovering from left jab. The LEFT arm is retracting back after punching. The other arm still guards near chin. Returning to fighting stance. ${PUNCH_SUFFIX} ${IMG2IMG_SUFFIX}`,
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
      model: CONFIG.MODEL, prompt, n: 1, size: "1024x1024", image: refBase64,
    }),
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  const json = (await res.json()) as any;
  const data = json.data?.[0];
  if (data.b64_json) return Buffer.from(data.b64_json, "base64");
  if (data.url) { const r = await fetch(data.url); return Buffer.from(await r.arrayBuffer()); }
  throw new Error("no image");
}

async function removeWhiteBg(input: Buffer): Promise<Buffer> {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const px = Buffer.from(data);
  for (let i = 0; i < px.length; i += 4) {
    const d = Math.sqrt((px[i]-255)**2 + (px[i+1]-255)**2 + (px[i+2]-255)**2);
    if (d <= 30) px[i+3] = 0;
    else if (d <= 60) px[i+3] = Math.min(px[i+3], Math.round(((d-30)/30)*255));
  }
  return sharp(px, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
}

async function main() {
  for (const f of FRAMES) {
    console.log(`frame_${f.frame} 재생성...`);
    for (let a = 1; a <= 3; a++) {
      try {
        const raw = await generateWithRef(f.prompt);
        writeFileSync(`${OUTPUT_DIR}/frame_${f.frame}_raw.png`, raw);
        const resized = await sharp(await removeWhiteBg(raw))
          .resize(FRAME_SIZE, FRAME_SIZE, { fit: "contain", background: { r:0,g:0,b:0,alpha:0 } })
          .png().toBuffer();
        writeFileSync(`${OUTPUT_DIR}/frame_${f.frame}.png`, resized);
        console.log(`  ✅ frame_${f.frame}`);
        break;
      } catch (e: any) {
        console.error(`  시도 ${a} 실패: ${e.message}`);
        if (a < 3) await new Promise(r => setTimeout(r, 3000));
      }
    }
  }

  // 스프라이트 시트
  const comp: sharp.OverlayOptions[] = [];
  for (let i = 0; i < 4; i++)
    comp.push({ input: readFileSync(`${OUTPUT_DIR}/frame_${i+1}.png`), left: i*FRAME_SIZE, top: 0 });
  await sharp({ create: { width: FRAME_SIZE*4, height: FRAME_SIZE, channels: 4, background: {r:0,g:0,b:0,alpha:0} } })
    .composite(comp).png().toFile(`${SPRITE_DIR}/player_punch_left.png`);
  await sharp(`${SPRITE_DIR}/player_punch_left.png`).webp({ quality: 90 }).toFile(`${SPRITE_DIR}/player_punch_left.webp`);
  console.log("✅ 완료");
}

main().catch(console.error);
