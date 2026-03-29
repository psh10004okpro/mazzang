import sharp from "sharp";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import path from "path";
import { CONFIG } from "./config.js";

const OUTPUT_DIR = "./output/player_v7";
mkdirSync(OUTPUT_DIR, { recursive: true });

const refBase64 = readFileSync("./output/samples_v2/style_i.png").toString("base64");

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

const POSES = [
  {
    name: "idle",
    label: "대기",
    prompt: "This exact same character in the same art style. Fighting stance with fists up near chin. Do not crop, show full body head to feet. Character facing right. White background. Single character.",
  },
  {
    name: "punch_left",
    label: "왼손 펀치",
    prompt: "This exact same character in the same art style and proportions. Character facing right. Throwing a punch with the LEFT arm extended straight forward at shoulder height, RIGHT fist guarding near chin. Side view, no foreshortening, no exaggerated fist size, fist stays the same size as in idle pose. Do not crop, show full body head to feet. White background. Single character.",
  },
  {
    name: "punch_right",
    label: "오른손 펀치",
    prompt: "This exact same character in the same art style and proportions. Character facing right. Throwing a punch with the RIGHT arm extended straight forward at shoulder height, LEFT fist guarding near chin. Side view, no foreshortening, no exaggerated fist size, fist stays the same size as in idle pose. Do not crop, show full body head to feet. White background. Single character.",
  },
  {
    name: "kick",
    label: "발차기",
    prompt: "This exact same character in the same art style. Character facing right. High roundhouse kick with right leg extended, left foot on ground, arms spread for balance. Do not crop, show full body head to feet. White background. Single character.",
  },
  {
    name: "hurt",
    label: "피격",
    prompt: "This exact same character in the same art style. Character facing right. Getting hit, recoiling backward, pain expression. Do not crop, show full body head to feet. White background. Single character.",
  },
  {
    name: "victory",
    label: "승리",
    prompt: "This exact same character in the same art style. Character facing right. Victory pose, one fist pumped up in the air, big happy grin. Do not crop, show full body head to feet. White background. Single character.",
  },
];

async function main() {
  const saved: { path: string; label: string }[] = [];

  for (let i = 0; i < POSES.length; i++) {
    const pose = POSES[i];
    const out = path.join(OUTPUT_DIR, `${pose.name}.png`);
    console.log(`[${i + 1}/${POSES.length}] ${pose.label}...`);

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const buf = await generateWithRef(pose.prompt, refBase64);
        writeFileSync(out, buf);
        saved.push({ path: out, label: pose.label });
        console.log(`  저장: ${out}`);
        break;
      } catch (e: any) {
        console.error(`  시도 ${attempt} 실패: ${e.message}`);
        if (attempt < 3) await new Promise((r) => setTimeout(r, 3000));
      }
    }
  }

  // 비교: 참조 + 6포즈 = 7장
  const allPoses = [
    { path: "./output/samples_v2/style_i.png", label: "참조: Style I" },
    ...saved,
  ];

  const CELL = 300, GAP = 6, LBL = 28, COLS = 4;
  const ROWS = Math.ceil(allPoses.length / COLS);
  const W = COLS * CELL + (COLS - 1) * GAP;
  const H = ROWS * (CELL + LBL) + (ROWS - 1) * GAP;
  const comp: sharp.OverlayOptions[] = [];

  for (let i = 0; i < allPoses.length; i++) {
    const col = i % COLS, row = Math.floor(i / COLS);
    const x = col * (CELL + GAP), y = row * (CELL + LBL + GAP);
    comp.push({
      input: Buffer.from(`<svg width="${CELL}" height="${LBL}"><rect width="${CELL}" height="${LBL}" fill="white"/><text x="${CELL/2}" y="20" text-anchor="middle" font-family="Arial,sans-serif" font-size="14" font-weight="bold" fill="#333">${allPoses[i].label}</text></svg>`),
      left: x, top: y,
    });
    const buf = await sharp(allPoses[i].path)
      .resize(CELL, CELL, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } })
      .png().toBuffer();
    comp.push({ input: buf, left: x, top: y + LBL });
  }

  await sharp({
    create: { width: W, height: H, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
  }).composite(comp).png().toFile(path.join(OUTPUT_DIR, "comparison_v7.png"));

  console.log(`\n비교: ${OUTPUT_DIR}/comparison_v7.png`);
  console.log("완료!");
}

main().catch(console.error);
