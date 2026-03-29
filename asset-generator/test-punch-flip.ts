import sharp from "sharp";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import path from "path";
import { CONFIG } from "./config.js";

const OUTPUT_DIR = "./output/player_v6";
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

async function main() {
  // 1. 펀치 1종만 생성 (풀바디 강조)
  console.log("펀치 생성 중...");
  const punchBuf = await generateWithRef(
    "This exact same character in the same art style. Throwing a straight punch with one fist extended forward with speed lines, other hand guarding face. Do not crop, show complete full body from head to feet including shoes. White background. Single character.",
    refBase64
  );
  const punchPath = path.join(OUTPUT_DIR, "punch_base.png");
  writeFileSync(punchPath, punchBuf);
  console.log("  저장: punch_base.png");

  // 2. 좌우반전으로 반대쪽 펀치 생성
  console.log("좌우반전 생성 중...");
  const flippedBuf = await sharp(punchBuf).flop().png().toBuffer();
  const flippedPath = path.join(OUTPUT_DIR, "punch_flipped.png");
  writeFileSync(flippedPath, flippedBuf);
  console.log("  저장: punch_flipped.png");

  // 3. 대기 포즈도 생성 (비교용)
  console.log("대기 생성 중...");
  const idleBuf = await generateWithRef(
    "This exact same character in the same art style. Fighting stance with fists up near chin, ready to fight. Do not crop, show complete full body from head to feet including shoes. White background. Single character.",
    refBase64
  );
  const idlePath = path.join(OUTPUT_DIR, "idle.png");
  writeFileSync(idlePath, idleBuf);
  console.log("  저장: idle.png");

  // 4. 비교 이미지: 참조 + idle + 펀치 + 반전펀치
  console.log("비교 이미지 생성...");
  const allPoses = [
    { path: "./output/samples_v2/style_i.png", label: "참조: Style I" },
    { path: idlePath, label: "대기" },
    { path: punchPath, label: "펀치 (원본)" },
    { path: flippedPath, label: "펀치 (좌우반전)" },
  ];

  const CELL = 400, GAP = 10, LBL = 32;
  const W = allPoses.length * CELL + (allPoses.length - 1) * GAP;
  const H = CELL + LBL;
  const comp: sharp.OverlayOptions[] = [];

  for (let i = 0; i < allPoses.length; i++) {
    const x = i * (CELL + GAP);
    comp.push({
      input: Buffer.from(`<svg width="${CELL}" height="${LBL}"><rect width="${CELL}" height="${LBL}" fill="white"/><text x="${CELL/2}" y="24" text-anchor="middle" font-family="Arial,sans-serif" font-size="18" font-weight="bold" fill="#333">${allPoses[i].label}</text></svg>`),
      left: x, top: 0,
    });
    const buf = await sharp(allPoses[i].path)
      .resize(CELL, CELL, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } })
      .png().toBuffer();
    comp.push({ input: buf, left: x, top: LBL });
  }

  const cmpPath = path.join(OUTPUT_DIR, "comparison_v6.png");
  await sharp({
    create: { width: W, height: H, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
  }).composite(comp).png().toFile(cmpPath);
  console.log(`비교: ${cmpPath}`);
  console.log("완료!");
}

main().catch(console.error);
