import sharp from "sharp";
import { readFileSync, writeFileSync } from "fs";

const raw = readFileSync("./output/player_final/idle/frame_1_raw.png");

async function removeBgFloodFill(input: Buffer, threshold: number): Promise<Buffer> {
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

async function main() {
  // 여러 threshold로 테스트 — 검은 배경 위에 올려서 비교
  const thresholds = [10, 15, 20, 30];

  for (const t of thresholds) {
    const noBg = await removeBgFloodFill(raw, t);
    const resized = await sharp(noBg)
      .resize(512, 512, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png().toBuffer();

    // 검은 배경에 올려서 확인
    const onBlack = await sharp({
      create: { width: 512, height: 512, channels: 4, background: { r: 30, g: 30, b: 30, alpha: 255 } },
    }).composite([{ input: resized, left: 0, top: 0 }]).png().toBuffer();

    writeFileSync(`./output/player_final/idle/test_t${t}_black.png`, onBlack);

    // 게임 배경에 올려서 확인
    const bgPath = "./sprites/backgrounds/alley_01.jpg";
    const onBg = await sharp(bgPath)
      .resize(512, 512, { fit: "cover" })
      .composite([{ input: resized, left: 0, top: 0 }])
      .png().toBuffer();

    writeFileSync(`./output/player_final/idle/test_t${t}_bg.png`, onBg);
    console.log(`threshold ${t} 완료`);
  }

  // 비교 이미지
  const comp: sharp.OverlayOptions[] = [];
  const CELL = 256, LBL = 20;
  for (let i = 0; i < thresholds.length; i++) {
    const t = thresholds[i];
    const x = i * (CELL + 4);

    comp.push({
      input: Buffer.from(`<svg width="${CELL}" height="${LBL}"><rect width="${CELL}" height="${LBL}" fill="#222"/><text x="${CELL/2}" y="15" text-anchor="middle" font-family="Arial" font-size="14" fill="white">threshold=${t}</text></svg>`),
      left: x, top: 0,
    });

    const buf = readFileSync(`./output/player_final/idle/test_t${t}_black.png`);
    const resized = await sharp(buf).resize(CELL, CELL, { fit: "contain", background: { r: 30, g: 30, b: 30, alpha: 255 } }).png().toBuffer();
    comp.push({ input: resized, left: x, top: LBL });
  }

  await sharp({
    create: { width: thresholds.length * (CELL + 4) - 4, height: CELL + LBL, channels: 4, background: { r: 30, g: 30, b: 30, alpha: 255 } },
  }).composite(comp).png().toFile("./output/player_final/idle/threshold_comparison.png");

  console.log("비교 이미지 생성 완료");
}

main();
