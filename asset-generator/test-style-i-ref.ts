import sharp from "sharp";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import path from "path";
import { CONFIG } from "./config.js";

const OUTPUT_DIR = "./output/player_v5";
mkdirSync(OUTPUT_DIR, { recursive: true });

// 원본 스타일 I 이미지를 참조로 사용 (5등신, 카툰+웹툰 하이브리드)
const styleI_Base64 = readFileSync("./output/samples_v2/style_i.png").toString("base64");

// 최소 프롬프트 — 참조 이미지에 의존
const POSES = [
  {
    name: "idle",
    label: "대기",
    prompt: "This exact same character in the same art style. Fighting stance with fists up near chin, ready to fight. White background. Full body. Single character.",
  },
  {
    name: "punch_left",
    label: "왼손 펀치",
    prompt: "This exact same character in the same art style. Throwing a left jab punch, left fist extended forward with speed lines, right hand guarding face. White background. Full body. Single character.",
  },
  {
    name: "punch_right",
    label: "오른손 펀치",
    prompt: "This exact same character in the same art style. Throwing a right cross punch, right fist extended forward with speed lines, left hand guarding face. White background. Full body. Single character.",
  },
  {
    name: "kick",
    label: "발차기",
    prompt: "This exact same character in the same art style. Executing a high roundhouse kick with right leg, left foot on ground, arms spread for balance. White background. Full body. Single character.",
  },
  {
    name: "hurt",
    label: "피격",
    prompt: "This exact same character in the same art style. Getting hit and recoiling backward, pain expression, body leaning back from impact. White background. Full body. Single character.",
  },
  {
    name: "victory",
    label: "승리",
    prompt: "This exact same character in the same art style. Victory celebration pose, fist pumped in the air, big triumphant grin. White background. Full body. Single character.",
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

async function getBoundingBox(buf: Buffer) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
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
  const saved: { path: string; label: string }[] = [];

  for (let i = 0; i < POSES.length; i++) {
    const pose = POSES[i];
    const out = path.join(OUTPUT_DIR, `${pose.name}.png`);
    console.log(`[${i + 1}/${POSES.length}] ${pose.label} 생성 중...`);

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const buf = await generateWithRef(pose.prompt, styleI_Base64);
        writeFileSync(out, buf);
        const bb = await getBoundingBox(buf);
        console.log(`  ${bb.charW}x${bb.charH}  비율=${(bb.charH / bb.charW).toFixed(2)}`);
        saved.push({ path: out, label: pose.label });
        break;
      } catch (e: any) {
        console.error(`  시도 ${attempt} 실패: ${e.message}`);
        if (attempt < 3) await new Promise((r) => setTimeout(r, 3000));
      }
    }
  }

  // 비교 이미지: 원본 style_i + 6포즈 = 7장 (2행)
  const allPoses = [
    { path: "./output/samples_v2/style_i.png", label: "참조: Style I 원본" },
    ...saved,
  ];

  const CELL = 300, GAP = 8, LBL = 28, COLS = 4;
  const ROWS = Math.ceil(allPoses.length / COLS);
  const W = COLS * CELL + (COLS - 1) * GAP;
  const H = ROWS * (CELL + LBL) + (ROWS - 1) * GAP;
  const comp: sharp.OverlayOptions[] = [];

  for (let i = 0; i < allPoses.length; i++) {
    const col = i % COLS, row = Math.floor(i / COLS);
    const x = col * (CELL + GAP), y = row * (CELL + LBL + GAP);
    comp.push({
      input: Buffer.from(`<svg width="${CELL}" height="${LBL}"><rect width="${CELL}" height="${LBL}" fill="white"/><text x="${CELL / 2}" y="20" text-anchor="middle" font-family="Arial,sans-serif" font-size="14" font-weight="bold" fill="#333">${allPoses[i].label}</text></svg>`),
      left: x, top: y,
    });
    const buf = await sharp(allPoses[i].path)
      .resize(CELL, CELL, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } })
      .png().toBuffer();
    comp.push({ input: buf, left: x, top: y + LBL });
  }

  const cmpPath = path.join(OUTPUT_DIR, "comparison_v5.png");
  await sharp({
    create: { width: W, height: H, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
  }).composite(comp).png().toFile(cmpPath);

  console.log(`\n비교: ${cmpPath}`);
  console.log("완료!");
}

main().catch(console.error);
