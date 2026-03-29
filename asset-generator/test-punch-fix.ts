import sharp from "sharp";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import path from "path";
import { CONFIG, PLAYER_PREFIX } from "./config.js";

const OUTPUT_DIR = "./output/player_v3";
const refBase64 = readFileSync("./output/player_v2/idle.png").toString("base64");

// 펀치 전용 프롬프트 — 체형 유지 강조
const PUNCH_FIX_PREFIX = `${PLAYER_PREFIX},
IMPORTANT: maintain the exact same body height and head-to-body ratio as the reference image,
the character must stand at the same height as the idle pose,
do not shrink or compress the torso or legs,
only the arm position changes, everything else stays the same proportions,
the character's standing height from feet to top of head must be identical to reference`;

const POSES = [
  {
    name: "punch_left_fix",
    label: "왼손 펀치 (fix)",
    prompt: `${PUNCH_FIX_PREFIX},
same standing posture as idle but with left arm extended forward throwing a jab punch,
left fist punching forward at shoulder height, right fist near chin guarding,
legs remain in the same wide stance as idle, torso stays upright and tall,
intense expression, three speed lines behind left fist`,
  },
  {
    name: "punch_right_fix",
    label: "오른손 펀치 (fix)",
    prompt: `${PUNCH_FIX_PREFIX},
same standing posture as idle but with right arm extended forward throwing a cross punch,
right fist punching forward at shoulder height, left fist near chin guarding,
legs remain in the same wide stance as idle, torso stays upright and tall,
fierce expression gritting teeth, three speed lines behind right fist`,
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

async function analyzeSize(filePath: string, label: string) {
  const { data, info } = await sharp(filePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
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
  console.log(`[${label}] ${cW}x${cH}  비율=${(cH/cW).toFixed(2)}  높이채움=${(cH/info.height*100).toFixed(0)}%`);
}

async function main() {
  const saved: { path: string; label: string }[] = [];

  for (const pose of POSES) {
    const out = path.join(OUTPUT_DIR, `${pose.name}.png`);
    console.log(`\n${pose.label} 생성 중...`);
    try {
      const buf = await generateWithRef(pose.prompt, refBase64);
      writeFileSync(out, buf);
      console.log(`  저장: ${out}`);
      saved.push({ path: out, label: pose.label });
    } catch (e: any) {
      console.error(`  실패: ${e.message}`);
    }
  }

  // 기존 + 수정본 전체 비교
  console.log("\n── 전체 비율 비교 ──");
  console.log("--- v3 원본 ---");
  await analyzeSize(path.join(OUTPUT_DIR, "idle.png"), "대기");
  await analyzeSize(path.join(OUTPUT_DIR, "punch_left.png"), "왼손 펀치 (원본)");
  await analyzeSize(path.join(OUTPUT_DIR, "punch_right.png"), "오른손 펀치 (원본)");
  await analyzeSize(path.join(OUTPUT_DIR, "kick.png"), "발차기");
  console.log("--- fix ---");
  for (const s of saved) await analyzeSize(s.path, s.label);

  // 6장 비교 이미지 (2행 3열)
  const allPoses = [
    { path: path.join(OUTPUT_DIR, "idle.png"), label: "대기" },
    { path: path.join(OUTPUT_DIR, "punch_left.png"), label: "왼펀치 (원본)" },
    { path: path.join(OUTPUT_DIR, "punch_right.png"), label: "오펀치 (원본)" },
    { path: path.join(OUTPUT_DIR, "kick.png"), label: "발차기" },
    ...saved,
  ];

  const CELL = 360, GAP = 8, LBL = 32, COLS = 3;
  const ROWS = Math.ceil(allPoses.length / COLS);
  const W = COLS * CELL + (COLS - 1) * GAP;
  const H = ROWS * (CELL + LBL) + (ROWS - 1) * GAP;
  const comp: sharp.OverlayOptions[] = [];

  for (let i = 0; i < allPoses.length; i++) {
    const col = i % COLS, row = Math.floor(i / COLS);
    const x = col * (CELL + GAP), y = row * (CELL + LBL + GAP);
    comp.push({
      input: Buffer.from(`<svg width="${CELL}" height="${LBL}"><rect width="${CELL}" height="${LBL}" fill="white"/><text x="${CELL/2}" y="24" text-anchor="middle" font-family="Arial,sans-serif" font-size="17" font-weight="bold" fill="#333">${allPoses[i].label}</text></svg>`),
      left: x, top: y,
    });
    const buf = await sharp(allPoses[i].path)
      .resize(CELL, CELL, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } })
      .png().toBuffer();
    comp.push({ input: buf, left: x, top: y + LBL });
  }

  const cmpPath = path.join(OUTPUT_DIR, "comparison_fix.png");
  await sharp({
    create: { width: W, height: H, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
  }).composite(comp).png().toFile(cmpPath);
  console.log(`\n비교: ${cmpPath}`);
  console.log("완료!");
}

main().catch(console.error);
