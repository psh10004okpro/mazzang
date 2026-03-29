import sharp from "sharp";
import { readdirSync, readFileSync, writeFileSync, existsSync } from "fs";
import path from "path";

const FRAME_SIZE = 512;

async function removeBgFloodFill(input: Buffer, threshold: number = 30): Promise<Buffer> {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const w = info.width, h = info.height;
  const px = Buffer.from(data);
  const visited = new Uint8Array(w * h);
  const isBg = new Uint8Array(w * h);
  function isWhite(idx: number) {
    return Math.sqrt((px[idx*4]-255)**2 + (px[idx*4+1]-255)**2 + (px[idx*4+2]-255)**2) <= threshold;
  }
  const queue: number[] = [];
  for (let x = 0; x < w; x++) {
    for (const idx of [x, (h-1)*w+x]) {
      if (!visited[idx] && isWhite(idx)) { queue.push(idx); visited[idx] = 1; isBg[idx] = 1; }
    }
  }
  for (let y = 0; y < h; y++) {
    for (const idx of [y*w, y*w+(w-1)]) {
      if (!visited[idx] && isWhite(idx)) { queue.push(idx); visited[idx] = 1; isBg[idx] = 1; }
    }
  }
  const dx = [-1,1,0,0], dy = [0,0,-1,1];
  let head = 0;
  while (head < queue.length) {
    const idx = queue[head++];
    const x = idx % w, y = Math.floor(idx / w);
    for (let d = 0; d < 4; d++) {
      const nx = x+dx[d], ny = y+dy[d];
      if (nx<0||nx>=w||ny<0||ny>=h) continue;
      const nIdx = ny*w+nx;
      if (visited[nIdx]) continue;
      visited[nIdx] = 1;
      if (isWhite(nIdx)) { isBg[nIdx] = 1; queue.push(nIdx); }
    }
  }
  for (let i = 0; i < w*h; i++) { if (isBg[i]) px[i*4+3] = 0; }
  return sharp(px, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer();
}

async function reprocessDir(baseDir: string, label: string) {
  if (!existsSync(baseDir)) return;
  const dirs = readdirSync(baseDir, { withFileTypes: true }).filter(d => d.isDirectory());
  let count = 0;

  for (const dir of dirs) {
    const dirPath = path.join(baseDir, dir.name);
    const raws = readdirSync(dirPath).filter(f => f.endsWith("_raw.png"));

    for (const raw of raws) {
      const rawPath = path.join(dirPath, raw);
      const outPath = path.join(dirPath, raw.replace("_raw.png", ".png"));
      const buf = readFileSync(rawPath);
      const noBg = await removeBgFloodFill(buf);
      const resized = await sharp(noBg)
        .resize(FRAME_SIZE, FRAME_SIZE, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png().toBuffer();
      writeFileSync(outPath, resized);
      count++;
    }
  }
  console.log(`✅ ${label}: ${count}프레임`);
}

async function rebuildBossSheets() {
  const baseDir = "./output/bosses";
  const spriteDir = "./sprites/bosses";
  if (!existsSync(baseDir)) return;

  const dirs = readdirSync(baseDir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name)
    .sort();

  for (const dir of dirs) {
    const dirPath = path.join(baseDir, dir);
    const poses = ["idle", "attack", "defeat"];
    const comp: sharp.OverlayOptions[] = [];
    let col = 0;

    for (const pose of poses) {
      const fp = path.join(dirPath, `${pose}.png`);
      if (existsSync(fp)) {
        comp.push({ input: readFileSync(fp), left: col * FRAME_SIZE, top: 0 });
        col++;
      }
    }

    if (comp.length > 0) {
      const sheetPath = path.join(spriteDir, `${dir}.png`);
      await sharp({
        create: { width: FRAME_SIZE * col, height: FRAME_SIZE, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
      }).composite(comp).png().toFile(sheetPath);
      await sharp(sheetPath).webp({ quality: 90 }).toFile(sheetPath.replace(".png", ".webp"));
    }
  }
  console.log(`✅ 보스 시트 재빌드: ${dirs.length}종`);
}

async function rebuildEquipmentSheets() {
  const baseDir = "./output/equipment";
  const spriteDir = "./sprites/equipment";
  if (!existsSync(baseDir)) return;

  const dirs = readdirSync(baseDir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name)
    .sort();

  const poses = ["idle", "punch_left", "punch_right", "kick", "hit", "victory"];

  for (const dir of dirs) {
    const dirPath = path.join(baseDir, dir);
    const comp: sharp.OverlayOptions[] = [];
    let col = 0;

    for (const pose of poses) {
      const fp = path.join(dirPath, `${pose}.png`);
      if (existsSync(fp)) {
        comp.push({ input: readFileSync(fp), left: col * FRAME_SIZE, top: 0 });
        col++;
      }
    }

    if (comp.length > 0) {
      const sheetPath = path.join(spriteDir, `${dir}.png`);
      await sharp({
        create: { width: FRAME_SIZE * col, height: FRAME_SIZE, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
      }).composite(comp).png().toFile(sheetPath);
      await sharp(sheetPath).webp({ quality: 90 }).toFile(sheetPath.replace(".png", ".webp"));
    }
  }
  console.log(`✅ 장비 시트 재빌드: ${dirs.length}종`);
}

async function main() {
  console.log("🔄 보스+장비 flood fill 재처리 + 시트 재빌드\n");

  await reprocessDir("./output/bosses", "보스");
  await reprocessDir("./output/equipment", "장비");

  await rebuildBossSheets();
  await rebuildEquipmentSheets();

  console.log("\n✅ 완료");
}

main().catch(console.error);
