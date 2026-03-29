import sharp from "sharp";
import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import path from "path";

const PLAYER_SIZE = 512;
const ENEMY_SIZE = 512;

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

async function reprocessFile(rawPath: string, outPath: string, size: number) {
  const raw = readFileSync(rawPath);
  const noBg = await removeBg(raw);
  const resized = await sharp(noBg)
    .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  writeFileSync(outPath, resized);
}

// ─── 주인공 재처리 (256 → 512) ───────────────────────────

async function reprocessPlayer() {
  const baseDir = "./output/player_final";
  const motions = ["idle", "punch_left", "punch_right", "kick_front", "kick_side", "hit"];
  let count = 0;

  console.log(`\n🥊 주인공 재처리 (${PLAYER_SIZE}×${PLAYER_SIZE})`);

  for (const motion of motions) {
    const motionDir = path.join(baseDir, motion);
    if (!existsSync(motionDir)) continue;

    const rawFiles = readdirSync(motionDir).filter(f => f.endsWith("_raw.png")).sort();
    for (const rawFile of rawFiles) {
      const frameName = rawFile.replace("_raw.png", ".png");
      const rawPath = path.join(motionDir, rawFile);
      const outPath = path.join(motionDir, frameName);

      await reprocessFile(rawPath, outPath, PLAYER_SIZE);
      count++;
    }
    process.stdout.write(`  ${motion}: ${rawFiles.length}프레임 ✅\n`);
  }

  // 스프라이트 시트 재빌드
  console.log("  스프라이트 시트 재빌드...");
  const spriteDir = "./sprites/player";

  for (const motion of motions) {
    const motionDir = path.join(baseDir, motion);
    if (!existsSync(motionDir)) continue;

    const frames = readdirSync(motionDir)
      .filter(f => f.match(/^frame_\d+\.png$/) && !f.includes("raw"))
      .sort();

    if (frames.length === 0) continue;

    const comp: sharp.OverlayOptions[] = [];
    for (let i = 0; i < frames.length; i++) {
      comp.push({ input: readFileSync(path.join(motionDir, frames[i])), left: i * PLAYER_SIZE, top: 0 });
    }

    const sheetPath = path.join(spriteDir, `player_${motion}.png`);
    await sharp({
      create: { width: PLAYER_SIZE * frames.length, height: PLAYER_SIZE, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    }).composite(comp).png().toFile(sheetPath);
    await sharp(sheetPath).webp({ quality: 90 }).toFile(sheetPath.replace(".png", ".webp"));
  }

  // 통합 시트
  const motionFrames = motions.map(m => {
    const dir = path.join(baseDir, m);
    if (!existsSync(dir)) return [];
    return readdirSync(dir).filter(f => f.match(/^frame_\d+\.png$/) && !f.includes("raw")).sort();
  });
  const maxCols = Math.max(...motionFrames.map(f => f.length));
  const rows = motions.length;
  const fullComp: sharp.OverlayOptions[] = [];

  for (let row = 0; row < rows; row++) {
    const dir = path.join(baseDir, motions[row]);
    for (let col = 0; col < motionFrames[row].length; col++) {
      fullComp.push({
        input: readFileSync(path.join(dir, motionFrames[row][col])),
        left: col * PLAYER_SIZE,
        top: row * PLAYER_SIZE,
      });
    }
  }

  const fullPath = path.join(spriteDir, "player_spritesheet.png");
  await sharp({
    create: { width: PLAYER_SIZE * maxCols, height: PLAYER_SIZE * rows, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  }).composite(fullComp).png().toFile(fullPath);
  await sharp(fullPath).webp({ quality: 90 }).toFile(fullPath.replace(".png", ".webp"));

  console.log(`  ✅ 주인공 ${count}프레임 + 시트 완료`);
}

// ─── 잡졸 재처리 (128 → 512) ─────────────────────────────

async function reprocessEnemies() {
  const baseDir = "./output/enemies";
  const spriteDir = "./sprites/enemies";
  let count = 0;

  console.log(`\n👊 잡졸 재처리 (${ENEMY_SIZE}×${ENEMY_SIZE})`);

  for (let alleyNum = 1; alleyNum <= 20; alleyNum++) {
    const alleyDir = path.join(baseDir, `alley${alleyNum}`);
    if (!existsSync(alleyDir)) continue;

    const enemyDirs = readdirSync(alleyDir).filter(d => {
      return existsSync(path.join(alleyDir, d, "idle_raw.png"));
    });

    for (const enemyName of enemyDirs) {
      const enemyDir = path.join(alleyDir, enemyName);

      for (const pose of ["idle", "hit"]) {
        const rawPath = path.join(enemyDir, `${pose}_raw.png`);
        const outPath = path.join(enemyDir, `${pose}.png`);
        if (!existsSync(rawPath)) continue;

        await reprocessFile(rawPath, outPath, ENEMY_SIZE);
        count++;
      }
    }

    // 골목별 스프라이트 시트 재빌드
    const sheetComp: sharp.OverlayOptions[] = [];
    let col = 0;
    for (const enemyName of enemyDirs.sort()) {
      for (const pose of ["idle", "hit"]) {
        const framePath = path.join(alleyDir, enemyName, `${pose}.png`);
        if (existsSync(framePath)) {
          sheetComp.push({ input: readFileSync(framePath), left: col * ENEMY_SIZE, top: 0 });
          col++;
        }
      }
    }

    if (sheetComp.length > 0) {
      const sheetPath = path.join(spriteDir, `alley${alleyNum}_enemies.png`);
      await sharp({
        create: { width: ENEMY_SIZE * col, height: ENEMY_SIZE, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
      }).composite(sheetComp).png().toFile(sheetPath);
      await sharp(sheetPath).webp({ quality: 90 }).toFile(sheetPath.replace(".png", ".webp"));
    }

    process.stdout.write(`  골목 ${alleyNum}: ${enemyDirs.length}종 ✅\n`);
    col = 0;
  }

  console.log(`  ✅ 잡졸 ${count}프레임 + 시트 완료`);
}

// ─── 메인 ─────────────────────────────────────────────────

async function main() {
  console.log("📐 전체 에셋 512×512 재처리 시작\n");

  await reprocessPlayer();
  await reprocessEnemies();

  // 주인공 미리보기 재빌드
  console.log("\n🖼️ 주인공 미리보기 재빌드...");
  const PREV_CELL = 200, GAP = 4, LBL = 24;
  const motions = [
    { name: "idle", label: "대기 (idle)", frames: 4 },
    { name: "punch_left", label: "왼손 펀치 (punch_left)", frames: 4 },
    { name: "punch_right", label: "오른손 펀치 (punch_right)", frames: 4 },
    { name: "kick_front", label: "정면 킥 (kick_front)", frames: 4 },
    { name: "kick_side", label: "옆차기 (kick_side)", frames: 4 },
    { name: "hit", label: "피격 (hit)", frames: 3 },
  ];
  const MAX_COLS = 4;
  const prevW = MAX_COLS * PREV_CELL + (MAX_COLS - 1) * GAP;
  const prevH = motions.length * (PREV_CELL + LBL) + (motions.length - 1) * GAP;
  const prevComp: sharp.OverlayOptions[] = [];

  for (let row = 0; row < motions.length; row++) {
    const m = motions[row];
    const y = row * (PREV_CELL + LBL + GAP);
    prevComp.push({
      input: Buffer.from(`<svg width="${prevW}" height="${LBL}"><text x="4" y="18" font-family="Arial,sans-serif" font-size="14" font-weight="bold" fill="#333">${m.label}</text></svg>`),
      left: 0, top: y,
    });
    for (let col = 0; col < m.frames; col++) {
      const fp = `./output/player_final/${m.name}/frame_${col + 1}.png`;
      if (existsSync(fp)) {
        const buf = await sharp(fp)
          .resize(PREV_CELL, PREV_CELL, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } })
          .png().toBuffer();
        prevComp.push({ input: buf, left: col * (PREV_CELL + GAP), top: y + LBL });
      }
    }
  }

  await sharp({
    create: { width: prevW, height: prevH, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
  }).composite(prevComp).png().toFile("./output/player_final/preview_all.png");

  console.log("\n✅ 전체 재처리 완료!");
}

main().catch(e => { console.error("❌", e); process.exit(1); });
