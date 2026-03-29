import sharp from "sharp";
import { readFileSync, writeFileSync } from "fs";
import { CONFIG, IMG2IMG_SUFFIX, PUNCH_SUFFIX } from "./config.js";

const FRAME_SIZE = 256;
const SPRITE_DIR = "./sprites/player";
const PUNCH_LEFT_DIR = "./output/player_final/punch_left";

// attempt_8(성공한 왼손 펀치)을 참조 이미지로 사용
const refBase64 = readFileSync("./output/player_final/punch_left/attempt_8.png").toString("base64");

// 이 참조 이미지 자체가 "왼손 펀치 풀 익스텐션"이므로
// 프롬프트는 동작 단계만 간결하게 지시
const FRAMES = [
  `This exact same character in the same pose angle. Preparing to punch, fist pulled back near shoulder, other hand guarding chin. Not yet punching. ${PUNCH_SUFFIX} ${IMG2IMG_SUFFIX}`,
  `This exact same character in the same pose angle. Mid-punch, punching arm extending halfway forward, other hand guarding chin. ${PUNCH_SUFFIX} ${IMG2IMG_SUFFIX}`,
  `This exact same character in the same pose angle. Full punch, fist fully extended forward with speed lines. Other hand guards chin. Maximum reach. ${PUNCH_SUFFIX} ${IMG2IMG_SUFFIX}`,
  `This exact same character in the same pose angle. Recovering from punch, punching arm pulling back. Other hand still guarding. Returning to stance. ${PUNCH_SUFFIX} ${IMG2IMG_SUFFIX}`,
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
  console.log("왼손 펀치 — attempt_8을 참조 이미지로 사용\n");

  for (let i = 0; i < FRAMES.length; i++) {
    console.log(`frame_${i+1}...`);
    for (let a = 1; a <= 3; a++) {
      try {
        const raw = await gen(FRAMES[i]);
        writeFileSync(`${PUNCH_LEFT_DIR}/frame_${i+1}_raw.png`, raw);
        const resized = await sharp(await removeBg(raw))
          .resize(FRAME_SIZE, FRAME_SIZE, { fit: "contain", background: {r:0,g:0,b:0,alpha:0} })
          .png().toBuffer();
        writeFileSync(`${PUNCH_LEFT_DIR}/frame_${i+1}.png`, resized);
        console.log(`  ✅`);
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
    comp.push({ input: readFileSync(`${PUNCH_LEFT_DIR}/frame_${i+1}.png`), left: i*FRAME_SIZE, top: 0 });
  const out = `${SPRITE_DIR}/player_punch_left.png`;
  await sharp({ create: { width: FRAME_SIZE*4, height: FRAME_SIZE, channels: 4, background: {r:0,g:0,b:0,alpha:0} } })
    .composite(comp).png().toFile(out);
  await sharp(out).webp({ quality: 90 }).toFile(out.replace(".png", ".webp"));

  console.log("✅ 완료");
}

main().catch(console.error);
