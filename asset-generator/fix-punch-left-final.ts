import sharp from "sharp";
import { readFileSync, writeFileSync } from "fs";
import { CONFIG, IMG2IMG_SUFFIX, PUNCH_SUFFIX } from "./config.js";

const OUTPUT_DIR = "./output/player_final/punch_left";
const SPRITE_DIR = "./sprites/player";
const FRAME_SIZE = 256;
const refBase64 = readFileSync("./output/samples_v2/style_i.png").toString("base64");

// attempt_8 성공 핵심: "chest visible, body rotated toward viewer"
const FRAMES = [
  {
    frame: 1,
    prompt: `This exact same character preparing to punch. Chest visible because body rotated toward viewer. Pulling back the near arm to load power, far arm guards chin. ${PUNCH_SUFFIX} ${IMG2IMG_SUFFIX}`,
  },
  {
    frame: 2,
    prompt: `This exact same character mid-punch. Chest and stomach visible because body rotated toward viewer. Near arm extending halfway forward, far arm bent guarding chin. ${PUNCH_SUFFIX} ${IMG2IMG_SUFFIX}`,
  },
  {
    frame: 3,
    prompt: `This exact same character punching forward. Chest is more visible because body is rotated toward viewer. One fist extended with speed lines, other fist guards chin. ${PUNCH_SUFFIX} ${IMG2IMG_SUFFIX}`,
  },
  {
    frame: 4,
    prompt: `This exact same character recovering from punch. Chest still partially visible, body rotating back to normal stance. Punching arm retracting, other arm guarding chin. ${PUNCH_SUFFIX} ${IMG2IMG_SUFFIX}`,
  },
];

async function gen(prompt: string): Promise<Buffer> {
  const res = await fetch(`${CONFIG.API_BASE_URL}/images/generations`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${CONFIG.API_KEY}` },
    body: JSON.stringify({ model: CONFIG.MODEL, prompt, n: 1, size: "1024x1024", image: refBase64 }),
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  const json = (await res.json()) as any;
  const d = json.data[0];
  if (d.b64_json) return Buffer.from(d.b64_json, "base64");
  if (d.url) { const r = await fetch(d.url); return Buffer.from(await r.arrayBuffer()); }
  throw new Error("no image");
}

async function removeBg(input: Buffer): Promise<Buffer> {
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
    console.log(`frame_${f.frame} 생성...`);
    for (let a = 1; a <= 3; a++) {
      try {
        const raw = await gen(f.prompt);
        writeFileSync(`${OUTPUT_DIR}/frame_${f.frame}_raw.png`, raw);
        const resized = await sharp(await removeBg(raw))
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
