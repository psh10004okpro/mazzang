import OpenAI from "openai";
import sharp from "sharp";
import { writeFileSync, mkdirSync } from "fs";
import path from "path";
import { CONFIG, PLAYER_PREFIX } from "./config.js";

const client = new OpenAI({
  baseURL: CONFIG.API_BASE_URL,
  apiKey: CONFIG.API_KEY,
});

const OUTPUT_DIR = "./output/player_v2";
mkdirSync(OUTPUT_DIR, { recursive: true });

const POSES = [
  {
    name: "idle",
    label: "대기 (Idle)",
    prompt: `${PLAYER_PREFIX},
relaxed fighting stance, both fists raised near chin in boxing guard position,
weight evenly on both feet shoulder-width apart,
neutral confident expression with slight smirk, calm and ready`,
  },
  {
    name: "punch_left",
    label: "왼손 펀치",
    prompt: `${PLAYER_PREFIX},
throwing a left jab punch, left arm fully extended forward with clenched fist,
right fist stays up guarding chin, torso rotated slightly to the right,
front foot planted forward, intense focused expression,
three speed lines behind left fist`,
  },
  {
    name: "punch_right",
    label: "오른손 펀치",
    prompt: `${PLAYER_PREFIX},
throwing a powerful right cross punch, right arm fully extended forward with clenched fist,
left fist pulled back near chin for guard, torso rotated into the punch,
weight on front foot leaning forward, fierce aggressive expression with gritted teeth,
three speed lines behind right fist`,
  },
  {
    name: "kick",
    label: "발차기 (Kick)",
    prompt: `${PLAYER_PREFIX},
executing a high roundhouse kick, right leg extended horizontally at chest height,
left foot firmly planted on ground, both arms spread out for balance,
dynamic powerful kicking pose, intense yelling expression,
curved motion lines around the kicking leg`,
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
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  }
  throw new Error("no image");
}

async function main() {
  const saved: { path: string; label: string }[] = [];

  for (let i = 0; i < POSES.length; i++) {
    const pose = POSES[i];
    const out = path.join(OUTPUT_DIR, `${pose.name}.png`);
    console.log(`\n[${i + 1}/${POSES.length}] ${pose.label} 생성 중...`);

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const buf = await generateImage(pose.prompt);
        writeFileSync(out, buf);
        console.log(`  저장: ${out}`);
        saved.push({ path: out, label: pose.label });
        break;
      } catch (e: any) {
        console.error(`  시도 ${attempt} 실패: ${e.message}`);
        if (attempt < 3) await new Promise((r) => setTimeout(r, 3000));
      }
    }
  }

  // 비교 이미지
  if (saved.length > 0) {
    console.log(`\n비교 이미지 생성...`);
    const CELL = 420, GAP = 10, LBL = 36;
    const W = saved.length * CELL + (saved.length - 1) * GAP;
    const H = CELL + LBL;
    const comp: sharp.OverlayOptions[] = [];

    for (let i = 0; i < saved.length; i++) {
      const x = i * (CELL + GAP);
      comp.push({
        input: Buffer.from(`<svg width="${CELL}" height="${LBL}"><rect width="${CELL}" height="${LBL}" fill="white"/><text x="${CELL / 2}" y="26" text-anchor="middle" font-family="Arial,sans-serif" font-size="20" font-weight="bold" fill="#333">${saved[i].label}</text></svg>`),
        left: x, top: 0,
      });
      const buf = await sharp(saved[i].path)
        .resize(CELL, CELL, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } })
        .png().toBuffer();
      comp.push({ input: buf, left: x, top: LBL });
    }

    const cmpPath = path.join(OUTPUT_DIR, "comparison_v2.png");
    await sharp({
      create: { width: W, height: H, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
    }).composite(comp).png().toFile(cmpPath);
    console.log(`비교: ${cmpPath}`);
  }

  // 비율 분석
  console.log("\n── 비율 분석 ──");
  for (const s of saved) {
    const { data, info } = await sharp(s.path).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let minX = info.width, maxX = 0, minY = info.height, maxY = 0;
    for (let y = 0; y < info.height; y++) {
      for (let x = 0; x < info.width; x++) {
        const idx = (y * info.width + x) * 4;
        if (data[idx] < 240 || data[idx + 1] < 240 || data[idx + 2] < 240) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    const cW = maxX - minX, cH = maxY - minY;
    const fillPct = (cH / info.height * 100).toFixed(0);
    console.log(`[${s.label}] ${cW}x${cH}  비율=${(cH / cW).toFixed(2)}  높이채움=${fillPct}%`);
  }

  console.log("\n완료!");
}

main().catch(console.error);
