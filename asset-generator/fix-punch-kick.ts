import sharp from "sharp";
import { readFileSync, writeFileSync } from "fs";
import { CONFIG, IMG2IMG_SUFFIX, PUNCH_SUFFIX } from "./config.js";

const FRAME_SIZE = 256;
const SPRITE_DIR = "./sprites/player";
const refBase64 = readFileSync("./output/samples_v2/style_i.png").toString("base64");

// attempt_8 성공 프롬프트 기반: "chest visible, body rotated toward viewer"
const PUNCH_LEFT_DIR = "./output/player_final/punch_left";
const PUNCH_LEFT_FRAMES = [
  `This exact same character. Preparing to punch, chest and stomach visible, body rotated toward viewer. One fist pulled back near shoulder loading power, other fist near chin guarding. ${PUNCH_SUFFIX} ${IMG2IMG_SUFFIX}`,
  `This exact same character punching forward. Chest visible because body rotated toward viewer. Near arm extending halfway forward, far arm bent near chin guarding. ${PUNCH_SUFFIX} ${IMG2IMG_SUFFIX}`,
  `This exact same character punching forward. Chest is more visible because body is rotated toward viewer. One fist extended with speed lines, other fist guards chin. ${PUNCH_SUFFIX} ${IMG2IMG_SUFFIX}`,
  `This exact same character recovering from punch. Chest still visible, body rotating back. Punching arm pulling back, guard arm near chin. Returning to stance. ${PUNCH_SUFFIX} ${IMG2IMG_SUFFIX}`,
];

// 정면 킥: "front kick, foot sole facing forward" — 옆차기와 구분
const KICK_FRONT_DIR = "./output/player_final/kick_front";
const KICK_FRONT_FRAMES = [
  `This exact same character. Lifting right knee up high toward chest, preparing a front kick. Both fists up guarding face. Left foot planted firmly. Only two legs. ${IMG2IMG_SUFFIX}`,
  `This exact same character. Front kick, right leg pushing straight forward, the sole of the shoe faces the target. Knee was bent, now extending. Fists up guarding. Left foot on ground. Only two legs. ${IMG2IMG_SUFFIX}`,
  `This exact same character. Full front kick, right foot thrust straight forward at stomach height, sole of shoe visible facing forward. Body leaning slightly back for balance. Fists up. Left foot planted. Only two legs. Motion lines on foot. ${IMG2IMG_SUFFIX}`,
  `This exact same character. Recovering from front kick, right leg coming back down, returning to fighting stance. Both feet almost on ground. Fists up near chin. Only two legs. ${IMG2IMG_SUFFIX}`,
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

async function generateFrames(dir: string, prompts: string[], label: string) {
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

async function buildSheet(dir: string, frameCount: number, outName: string) {
  const comp: sharp.OverlayOptions[] = [];
  for (let i = 0; i < frameCount; i++)
    comp.push({ input: readFileSync(`${dir}/frame_${i+1}.png`), left: i * FRAME_SIZE, top: 0 });
  const outPath = `${SPRITE_DIR}/${outName}.png`;
  await sharp({ create: { width: FRAME_SIZE * frameCount, height: FRAME_SIZE, channels: 4, background: {r:0,g:0,b:0,alpha:0} } })
    .composite(comp).png().toFile(outPath);
  await sharp(outPath).webp({ quality: 90 }).toFile(outPath.replace(".png", ".webp"));
}

async function main() {
  await generateFrames(PUNCH_LEFT_DIR, PUNCH_LEFT_FRAMES, "왼손 펀치");
  await generateFrames(KICK_FRONT_DIR, KICK_FRONT_FRAMES, "정면 킥");

  console.log("\n스프라이트 시트 재빌드...");
  await buildSheet(PUNCH_LEFT_DIR, 4, "player_punch_left");
  await buildSheet(KICK_FRONT_DIR, 4, "player_kick_front");

  console.log("✅ 완료");
}

main().catch(console.error);
