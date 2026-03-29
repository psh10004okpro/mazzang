import sharp from "sharp";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import path from "path";
import { CONFIG, PLAYER_PREFIX } from "./config.js";

const OUTPUT_DIR = "./output/player_v3";
mkdirSync(OUTPUT_DIR, { recursive: true });

// idle.png (v2)를 참조 이미지로 사용
const refBase64 = readFileSync("./output/player_v2/idle.png").toString("base64");

const POSES = [
  {
    name: "idle",
    label: "대기 (Idle)",
    prompt: `${PLAYER_PREFIX},
relaxed fighting stance, both fists raised near chin in boxing guard,
weight evenly on both feet, neutral confident expression with slight smirk`,
  },
  {
    name: "punch_left",
    label: "왼손 펀치",
    prompt: `${PLAYER_PREFIX},
throwing a left jab punch, left arm fully extended forward with clenched fist,
right fist guarding chin, torso rotated slightly right,
weight on front foot, intense focused expression, speed lines behind left fist`,
  },
  {
    name: "punch_right",
    label: "오른손 펀치",
    prompt: `${PLAYER_PREFIX},
throwing powerful right cross punch, right arm fully extended forward,
left fist pulled back near chin, body rotated into punch,
weight on front foot, fierce expression, speed lines behind right fist`,
  },
  {
    name: "kick",
    label: "발차기 (Kick)",
    prompt: `${PLAYER_PREFIX},
executing high roundhouse kick with right leg extended horizontally,
left foot planted on ground, arms spread for balance,
intense expression, motion lines around kicking leg`,
  },
];

async function generateWithRef(prompt: string, refImage: string): Promise<Buffer> {
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
      image: refImage,
    }),
  });

  if (!res.ok) throw new Error(`API ${res.status}: ${(await res.text()).substring(0, 200)}`);

  const json = (await res.json()) as any;
  const data = json.data?.[0];
  if (!data) throw new Error("no data");

  if (data.b64_json) return Buffer.from(data.b64_json, "base64");
  if (data.url) {
    const r = await fetch(data.url);
    return Buffer.from(await r.arrayBuffer());
  }
  throw new Error("no image");
}

async function main() {
  const saved: { path: string; label: string }[] = [];

  for (let i = 0; i < POSES.length; i++) {
    const pose = POSES[i];
    const out = path.join(OUTPUT_DIR, `${pose.name}.png`);
    console.log(`\n[${i + 1}/${POSES.length}] ${pose.label} (img2img)...`);

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const buf = await generateWithRef(pose.prompt, refBase64);
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
        input: Buffer.from(`<svg width="${CELL}" height="${LBL}"><rect width="${CELL}" height="${LBL}" fill="white"/><text x="${CELL/2}" y="26" text-anchor="middle" font-family="Arial,sans-serif" font-size="20" font-weight="bold" fill="#333">${saved[i].label}</text></svg>`),
        left: x, top: 0,
      });
      const buf = await sharp(saved[i].path)
        .resize(CELL, CELL, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } })
        .png().toBuffer();
      comp.push({ input: buf, left: x, top: LBL });
    }

    await sharp({
      create: { width: W, height: H, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
    }).composite(comp).png().toFile(path.join(OUTPUT_DIR, "comparison_v3.png"));
    console.log(`비교: ${OUTPUT_DIR}/comparison_v3.png`);
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
          if (x < minX) minX = x; if (x > maxX) maxX = x;
          if (y < minY) minY = y; if (y > maxY) maxY = y;
        }
      }
    }
    const cW = maxX - minX, cH = maxY - minY;
    console.log(`[${s.label}] ${cW}x${cH}  비율=${(cH/cW).toFixed(2)}  높이채움=${(cH/info.height*100).toFixed(0)}%`);
  }

  console.log("\n완료!");
}

main().catch(console.error);
