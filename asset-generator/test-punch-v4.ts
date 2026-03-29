import sharp from "sharp";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import path from "path";
import { CONFIG } from "./config.js";

const OUTPUT_DIR = "./output/player_v4";
mkdirSync(OUTPUT_DIR, { recursive: true });

const refBase64 = readFileSync("./output/player_v2/idle.png").toString("base64");

// 테스트: 프롬프트 길이별 참조 이미지 반영도 비교
const TESTS = [
  {
    name: "A_minimal",
    label: "A: 최소 프롬프트",
    prompt: "Same character, same proportions, same style. Change pose to: throwing a right straight punch with RIGHT fist extended forward, LEFT hand guarding face. White background.",
  },
  {
    name: "B_short",
    label: "B: 짧은 프롬프트",
    prompt: "This exact same character in the exact same art style and body proportions. New pose: right arm punching forward with RIGHT fist, LEFT fist guarding chin. Torso stays upright, same leg stance. White background. Single character only.",
  },
  {
    name: "C_pose_only",
    label: "C: 포즈만 지시",
    prompt: "Keep this character exactly as-is. Only change: extend the RIGHT arm forward in a punching motion, keep LEFT arm bent near face. Do not change the character's proportions, face, outfit, or art style at all. White background.",
  },
  {
    name: "D_left_punch",
    label: "D: 왼손 펀치",
    prompt: "Keep this character exactly as-is. Only change: extend the LEFT arm forward in a punching motion with speed lines, keep RIGHT arm bent near face guarding. Do not change proportions or style. White background.",
  },
  {
    name: "E_kick",
    label: "E: 발차기",
    prompt: "Keep this character exactly as-is. Only change: raise RIGHT leg in a high kick to the right side, LEFT foot stays on ground. Arms spread for balance. Do not change proportions or style. White background.",
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
  if (data.b64_json) return Buffer.from(data.b64_json, "base64");
  if (data.url) {
    const r = await fetch(data.url);
    return Buffer.from(await r.arrayBuffer());
  }
  throw new Error("no image");
}

async function getBoundingBox(filePath: string) {
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
  return { charW: maxX - minX, charH: maxY - minY, imgW: info.width, imgH: info.height };
}

async function main() {
  // 참조 이미지(idle) 비율 기준
  const idleBB = await getBoundingBox("./output/player_v2/idle.png");
  console.log(`참조 idle: ${idleBB.charW}x${idleBB.charH}  비율=${(idleBB.charH/idleBB.charW).toFixed(2)}\n`);

  const saved: { path: string; label: string }[] = [];

  for (const test of TESTS) {
    const out = path.join(OUTPUT_DIR, `${test.name}.png`);
    console.log(`${test.label} 생성 중...`);
    try {
      const buf = await generateWithRef(test.prompt, refBase64);
      writeFileSync(out, buf);
      const bb = await getBoundingBox(out);
      const ratio = (bb.charH / bb.charW).toFixed(2);
      const diff = ((bb.charH - idleBB.charH) / idleBB.charH * 100).toFixed(1);
      console.log(`  크기: ${bb.charW}x${bb.charH}  비율=${ratio}  높이차=${diff}%`);
      saved.push({ path: out, label: test.label });
    } catch (e: any) {
      console.error(`  실패: ${e.message}`);
    }
  }

  // 비교 이미지 (참조 idle 포함 6장, 2x3)
  const allPoses = [
    { path: "./output/player_v2/idle.png", label: "참조: idle (원본)" },
    ...saved,
  ];

  const CELL = 350, GAP = 8, LBL = 30, COLS = 3;
  const ROWS = Math.ceil(allPoses.length / COLS);
  const W = COLS * CELL + (COLS - 1) * GAP;
  const H = ROWS * (CELL + LBL) + (ROWS - 1) * GAP;
  const comp: sharp.OverlayOptions[] = [];

  for (let i = 0; i < allPoses.length; i++) {
    const col = i % COLS, row = Math.floor(i / COLS);
    const x = col * (CELL + GAP), y = row * (CELL + LBL + GAP);
    comp.push({
      input: Buffer.from(`<svg width="${CELL}" height="${LBL}"><rect width="${CELL}" height="${LBL}" fill="white"/><text x="${CELL/2}" y="22" text-anchor="middle" font-family="Arial,sans-serif" font-size="15" font-weight="bold" fill="#333">${allPoses[i].label}</text></svg>`),
      left: x, top: y,
    });
    const buf = await sharp(allPoses[i].path)
      .resize(CELL, CELL, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } })
      .png().toBuffer();
    comp.push({ input: buf, left: x, top: y + LBL });
  }

  const cmpPath = path.join(OUTPUT_DIR, "comparison_v4.png");
  await sharp({
    create: { width: W, height: H, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
  }).composite(comp).png().toFile(cmpPath);
  console.log(`\n비교: ${cmpPath}`);
  console.log("완료!");
}

main().catch(console.error);
