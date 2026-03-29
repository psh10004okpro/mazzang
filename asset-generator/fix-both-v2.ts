import sharp from "sharp";
import { readFileSync, writeFileSync } from "fs";
import { CONFIG, IMG2IMG_SUFFIX, PUNCH_SUFFIX } from "./config.js";

const FRAME_SIZE = 256;
const SPRITE_DIR = "./sprites/player";
const refBase64 = readFileSync("./output/samples_v2/style_i.png").toString("base64");

// ── 왼손 펀치: 3/4 뷰로 가슴이 보이게 ──
// 핵심: "three quarter view showing chest", "body facing slightly toward viewer"
const PUNCH_LEFT_DIR = "./output/player_final/punch_left";
const PUNCH_LEFT = [
  `This exact same character in three quarter view, body angled toward viewer showing chest. Preparing to punch, pulling near fist back, far fist guards chin. ${PUNCH_SUFFIX} ${IMG2IMG_SUFFIX}`,
  `This exact same character in three quarter view, chest visible. Throwing a jab with the near arm, arm halfway extended forward. Far arm bent guarding chin. ${PUNCH_SUFFIX} ${IMG2IMG_SUFFIX}`,
  `This exact same character in three quarter view, chest visible. Near fist fully extended forward with speed lines. Far fist guards chin. Powerful jab punch. ${PUNCH_SUFFIX} ${IMG2IMG_SUFFIX}`,
  `This exact same character in three quarter view, chest visible. Recovering from jab, near arm pulling back. Far arm still guarding chin. Returning to stance. ${PUNCH_SUFFIX} ${IMG2IMG_SUFFIX}`,
];

// ── 정면 킥: 원근 과장 없이, 옆차기와 구분 ──
// 핵심: "pushing kick straight ahead" (옆차기는 옆으로), 발 확대 금지
const KICK_FRONT_DIR = "./output/player_final/kick_front";
const KICK_FRONT = [
  `This exact same character. Lifting knee up high preparing to kick forward. Both fists up guarding. Left foot on ground. Only two legs, normal proportions. ${IMG2IMG_SUFFIX}`,
  `This exact same character. Pushing a straight kick forward, leg extending ahead at waist height. Not a side kick. Fists up. Left foot planted. Only two legs, no exaggerated foot size. ${IMG2IMG_SUFFIX}`,
  `This exact same character. Full straight push kick, right leg extended forward at stomach height. Not a side kick, not a roundhouse. Fists guarding face. Left foot planted. Only two legs, no exaggerated foot size, normal proportions. Motion lines near foot. ${IMG2IMG_SUFFIX}`,
  `This exact same character. Recovering from kick, right leg coming back down to ground. Returning to fighting stance. Both feet nearly on ground. Fists up. Only two legs. ${IMG2IMG_SUFFIX}`,
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

async function generateMotion(dir: string, prompts: string[], label: string) {
  console.log(`\n── ${label} ──`);
  for (let i = 0; i < prompts.length; i++) {
    console.log(`  frame_${i+1}...`);
    for (let a = 1; a <= 3; a++) {
      try {
        const raw = await gen(prompts[i]);
        writeFileSync(`${dir}/frame_${i+1}_raw.png`, raw);
        const resized = await sharp(await removeBg(raw))
          .resize(FRAME_SIZE, FRAME_SIZE, { fit: "contain", background: {r:0,g:0,b:0,alpha:0} })
          .png().toBuffer();
        writeFileSync(`${dir}/frame_${i+1}.png`, resized);
        console.log(`    ✅`);
        break;
      } catch (e: any) {
        console.error(`    시도 ${a} 실패: ${e.message}`);
        if (a < 3) await new Promise(r => setTimeout(r, 3000));
      }
    }
  }
}

async function buildSheet(dir: string, count: number, name: string) {
  const comp: sharp.OverlayOptions[] = [];
  for (let i = 0; i < count; i++)
    comp.push({ input: readFileSync(`${dir}/frame_${i+1}.png`), left: i*FRAME_SIZE, top: 0 });
  const out = `${SPRITE_DIR}/${name}.png`;
  await sharp({ create: { width: FRAME_SIZE*count, height: FRAME_SIZE, channels: 4, background: {r:0,g:0,b:0,alpha:0} } })
    .composite(comp).png().toFile(out);
  await sharp(out).webp({ quality: 90 }).toFile(out.replace(".png", ".webp"));
}

async function main() {
  await generateMotion(PUNCH_LEFT_DIR, PUNCH_LEFT, "왼손 펀치 (3/4 뷰)");
  await generateMotion(KICK_FRONT_DIR, KICK_FRONT, "정면 킥 (원근 과장 없음)");

  console.log("\n스프라이트 시트 재빌드...");
  await buildSheet(PUNCH_LEFT_DIR, 4, "player_punch_left");
  await buildSheet(KICK_FRONT_DIR, 4, "player_kick_front");
  console.log("✅ 완료");
}

main().catch(console.error);
