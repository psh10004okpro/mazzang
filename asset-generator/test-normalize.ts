import sharp from "sharp";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import path from "path";

const OUTPUT_DIR = "./output/player_v3";
const NORM_DIR = "./output/player_normalized";
mkdirSync(NORM_DIR, { recursive: true });

/** 이미지에서 캐릭터 바운딩박스 계산 (비흰색 영역) */
async function getBoundingBox(filePath: string) {
  const { data, info } = await sharp(filePath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

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
  return {
    minX, maxX, minY, maxY,
    charW: maxX - minX,
    charH: maxY - minY,
    imgW: info.width,
    imgH: info.height,
  };
}

async function main() {
  const poses = [
    { file: "idle.png", name: "idle", label: "대기" },
    { file: "punch_left_fix.png", name: "punch_left", label: "왼손 펀치" },
    { file: "punch_right_fix.png", name: "punch_right", label: "오른손 펀치" },
    { file: "kick.png", name: "kick", label: "발차기" },
  ];

  // 1. 기준: idle의 캐릭터 높이
  const idleBB = await getBoundingBox(path.join(OUTPUT_DIR, "idle.png"));
  const targetH = idleBB.charH;
  console.log(`기준 idle 캐릭터 높이: ${targetH}px (이미지 ${idleBB.imgW}x${idleBB.imgH})`);

  // 2. 통일 캔버스 크기 (모든 포즈를 담을 수 있을 만큼)
  const CANVAS = 1024;

  const results: { path: string; label: string }[] = [];

  for (const pose of poses) {
    const srcPath = path.join(OUTPUT_DIR, pose.file);
    const bb = await getBoundingBox(srcPath);

    // 현재 캐릭터 높이 대비 목표 높이 스케일
    const scale = targetH / bb.charH;
    console.log(`\n[${pose.label}] 원본: ${bb.charW}x${bb.charH}, scale: ${scale.toFixed(3)}`);

    // 캐릭터 영역만 크롭
    const cropped = await sharp(srcPath)
      .extract({
        left: bb.minX,
        top: bb.minY,
        width: bb.charW,
        height: bb.charH,
      })
      .png()
      .toBuffer();

    // 목표 높이에 맞게 리사이즈 (비율 유지)
    const newH = targetH;
    const newW = Math.round(bb.charW * scale);
    console.log(`  리사이즈: ${newW}x${newH}`);

    const resized = await sharp(cropped)
      .resize(newW, newH, { fit: "fill" })
      .png()
      .toBuffer();

    // 캔버스 중앙에 배치 (하단 정렬 — 발 위치 통일)
    const left = Math.round((CANVAS - newW) / 2);
    const top = CANVAS - newH - 20; // 하단 20px 마진

    const outPath = path.join(NORM_DIR, `${pose.name}.png`);
    await sharp({
      create: {
        width: CANVAS,
        height: CANVAS,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      },
    })
      .composite([{ input: resized, left, top }])
      .png()
      .toFile(outPath);

    console.log(`  저장: ${outPath}`);
    results.push({ path: outPath, label: pose.label });
  }

  // 3. 비교 이미지
  console.log("\n비교 이미지 생성...");
  const CELL = 420, GAP = 10, LBL = 36;
  const W = results.length * CELL + (results.length - 1) * GAP;
  const H = CELL + LBL;
  const comp: sharp.OverlayOptions[] = [];

  for (let i = 0; i < results.length; i++) {
    const x = i * (CELL + GAP);
    comp.push({
      input: Buffer.from(`<svg width="${CELL}" height="${LBL}"><rect width="${CELL}" height="${LBL}" fill="white"/><text x="${CELL/2}" y="26" text-anchor="middle" font-family="Arial,sans-serif" font-size="20" font-weight="bold" fill="#333">${results[i].label}</text></svg>`),
      left: x, top: 0,
    });
    const buf = await sharp(results[i].path)
      .resize(CELL, CELL, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } })
      .png().toBuffer();
    comp.push({ input: buf, left: x, top: LBL });
  }

  const cmpPath = path.join(NORM_DIR, "comparison_normalized.png");
  await sharp({
    create: { width: W, height: H, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
  }).composite(comp).png().toFile(cmpPath);
  console.log(`비교: ${cmpPath}`);

  // 4. 보정 후 수치 확인
  console.log("\n── 보정 후 비율 ──");
  for (const r of results) {
    const bb = await getBoundingBox(r.path);
    console.log(`[${r.label}] ${bb.charW}x${bb.charH}  높이채움=${(bb.charH/CANVAS*100).toFixed(0)}%`);
  }

  console.log("\n완료!");
}

main().catch(console.error);
