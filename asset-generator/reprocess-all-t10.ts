import sharp from "sharp";
import { readdirSync, readFileSync, writeFileSync, existsSync } from "fs";
import path from "path";

const FRAME_SIZE = 512;
const THRESHOLD = 10;

async function removeBg(input: Buffer): Promise<Buffer> {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const w = info.width, h = info.height;
  const px = Buffer.from(data);
  const visited = new Uint8Array(w * h);
  const isBg = new Uint8Array(w * h);
  function isWhite(idx: number) {
    return Math.sqrt((px[idx*4]-255)**2 + (px[idx*4+1]-255)**2 + (px[idx*4+2]-255)**2) <= THRESHOLD;
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
      const buf = readFileSync(path.join(dirPath, raw));
      const noBg = await removeBg(buf);
      const resized = await sharp(noBg)
        .resize(FRAME_SIZE, FRAME_SIZE, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png().toBuffer();
      writeFileSync(path.join(dirPath, raw.replace("_raw.png", ".png")), resized);
      count++;
    }
  }
  console.log(`✅ ${label}: ${count}프레임`);
}

async function main() {
  console.log(`🔄 전체 재처리 (threshold=${THRESHOLD})\n`);

  await reprocessDir("./output/player_final", "주인공");
  await reprocessDir("./output/enemies", "잡졸");
  await reprocessDir("./output/bosses", "보스");
  await reprocessDir("./output/equipment", "장비");

  // 도구는 별도 (grade 폴더)
  if (existsSync("./output/tools")) {
    const toolDirs = readdirSync("./output/tools", { withFileTypes: true }).filter(d => d.isDirectory());
    let count = 0;
    for (const dir of toolDirs) {
      const dirPath = path.join("./output/tools", dir.name);
      const raws = readdirSync(dirPath).filter(f => f.endsWith("_raw.png"));
      for (const raw of raws) {
        const buf = readFileSync(path.join(dirPath, raw));
        const noBg = await removeBg(buf);
        const resized = await sharp(noBg)
          .resize(FRAME_SIZE, FRAME_SIZE, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
          .png().toBuffer();
        writeFileSync(path.join(dirPath, raw.replace("_raw.png", ".png")), resized);
        count++;
      }
    }
    console.log(`✅ 수련 도구: ${count}프레임`);
  }

  // UI effects
  if (existsSync("./output/ui/effects")) {
    const effectDirs = readdirSync("./output/ui/effects", { withFileTypes: true }).filter(d => d.isDirectory());
    let count = 0;
    for (const dir of effectDirs) {
      const dirPath = path.join("./output/ui/effects", dir.name);
      const raws = readdirSync(dirPath).filter(f => f.endsWith("_raw.png"));
      for (const raw of raws) {
        const buf = readFileSync(path.join(dirPath, raw));
        const noBg = await removeBg(buf);
        const resized = await sharp(noBg)
          .resize(256, 256, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
          .png().toBuffer();
        writeFileSync(path.join(dirPath, raw.replace("_raw.png", ".png")), resized);
        count++;
      }
    }
    console.log(`✅ 이펙트: ${count}프레임`);
  }

  console.log("\n✅ 재처리 완료. 시트 재빌드 필요.");
}

main().catch(console.error);
