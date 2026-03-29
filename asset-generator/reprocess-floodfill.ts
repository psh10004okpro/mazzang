import sharp from "sharp";
import { readdirSync, readFileSync, writeFileSync, existsSync } from "fs";
import path from "path";

const TARGET_SIZE = 512;

/**
 * Flood fill 방식 배경 제거
 * 이미지 가장자리의 흰색 픽셀부터 시작하여 연결된 흰색 영역만 투명화
 * 캐릭터 내부의 흰색(민소매, 붕대 등)은 보존
 */
async function removeBgFloodFill(input: Buffer, threshold: number = 30): Promise<Buffer> {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const w = info.width, h = info.height;
  const px = Buffer.from(data);

  // 방문 체크 배열
  const visited = new Uint8Array(w * h);
  // 배경으로 판정된 픽셀
  const isBg = new Uint8Array(w * h);

  function isWhite(idx: number): boolean {
    const r = px[idx * 4], g = px[idx * 4 + 1], b = px[idx * 4 + 2];
    const dist = Math.sqrt((r - 255) ** 2 + (g - 255) ** 2 + (b - 255) ** 2);
    return dist <= threshold;
  }

  // BFS 큐 — 이미지 가장자리의 흰색 픽셀에서 시작
  const queue: number[] = [];

  // 상하좌우 가장자리 픽셀 추가
  for (let x = 0; x < w; x++) {
    // 상단
    const topIdx = x;
    if (isWhite(topIdx)) { queue.push(topIdx); visited[topIdx] = 1; isBg[topIdx] = 1; }
    // 하단
    const botIdx = (h - 1) * w + x;
    if (isWhite(botIdx)) { queue.push(botIdx); visited[botIdx] = 1; isBg[botIdx] = 1; }
  }
  for (let y = 0; y < h; y++) {
    // 좌측
    const leftIdx = y * w;
    if (isWhite(leftIdx)) { queue.push(leftIdx); visited[leftIdx] = 1; isBg[leftIdx] = 1; }
    // 우측
    const rightIdx = y * w + (w - 1);
    if (isWhite(rightIdx)) { queue.push(rightIdx); visited[rightIdx] = 1; isBg[rightIdx] = 1; }
  }

  // BFS: 인접한 흰색 픽셀로 확산
  const dx = [-1, 1, 0, 0];
  const dy = [0, 0, -1, 1];

  let head = 0;
  while (head < queue.length) {
    const idx = queue[head++];
    const x = idx % w;
    const y = Math.floor(idx / w);

    for (let d = 0; d < 4; d++) {
      const nx = x + dx[d];
      const ny = y + dy[d];
      if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;

      const nIdx = ny * w + nx;
      if (visited[nIdx]) continue;
      visited[nIdx] = 1;

      if (isWhite(nIdx)) {
        isBg[nIdx] = 1;
        queue.push(nIdx);
      }
    }
  }

  // 배경 픽셀 투명화 + 경계 안티앨리어싱
  for (let i = 0; i < w * h; i++) {
    if (isBg[i]) {
      px[i * 4 + 3] = 0; // 완전 투명
    } else {
      // 배경과 인접한 캐릭터 픽셀은 흰색에 가까우면 부분 투명 (경계 부드럽게)
      const x = i % w;
      const y = Math.floor(i / w);
      let adjacentBg = false;
      for (let d = 0; d < 4; d++) {
        const nx = x + dx[d], ny = y + dy[d];
        if (nx >= 0 && nx < w && ny >= 0 && ny < h && isBg[ny * w + nx]) {
          adjacentBg = true;
          break;
        }
      }
      if (adjacentBg) {
        const r = px[i * 4], g = px[i * 4 + 1], b = px[i * 4 + 2];
        const dist = Math.sqrt((r - 255) ** 2 + (g - 255) ** 2 + (b - 255) ** 2);
        if (dist <= threshold * 1.5) {
          // 경계의 거의 흰색 픽셀은 부분 투명
          const alpha = Math.round((dist / (threshold * 1.5)) * 255);
          px[i * 4 + 3] = Math.min(px[i * 4 + 3], alpha);
        }
      }
    }
  }

  return sharp(px, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer();
}

async function reprocessFile(rawPath: string, outPath: string, size: number) {
  const raw = readFileSync(rawPath);
  const noBg = await removeBgFloodFill(raw, 30);
  const resized = await sharp(noBg)
    .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  writeFileSync(outPath, resized);
}

// ─── 주인공 ───────────────────────────────────────────────

async function reprocessPlayer() {
  const baseDir = "./output/player_final";
  const motions = ["idle", "punch_left", "punch_right", "kick_front", "kick_side", "hit"];
  let count = 0;

  console.log(`\n🥊 주인공 재처리 (flood fill, ${TARGET_SIZE}px)`);

  for (const motion of motions) {
    const dir = path.join(baseDir, motion);
    if (!existsSync(dir)) continue;
    const raws = readdirSync(dir).filter(f => f.endsWith("_raw.png")).sort();
    for (const raw of raws) {
      await reprocessFile(path.join(dir, raw), path.join(dir, raw.replace("_raw.png", ".png")), TARGET_SIZE);
      count++;
    }
    process.stdout.write(`  ${motion}: ${raws.length}프레임 ✅\n`);
  }
  console.log(`  총 ${count}프레임`);
}

// ─── 잡졸 ─────────────────────────────────────────────────

async function reprocessEnemies() {
  const baseDir = "./output/enemies";
  let count = 0;

  console.log(`\n👊 잡졸 재처리 (flood fill, ${TARGET_SIZE}px)`);

  for (let n = 1; n <= 20; n++) {
    const alleyDir = path.join(baseDir, `alley${n}`);
    if (!existsSync(alleyDir)) continue;

    const enemies = readdirSync(alleyDir).filter(d => existsSync(path.join(alleyDir, d, "idle_raw.png")));
    for (const enemy of enemies) {
      const eDir = path.join(alleyDir, enemy);
      for (const pose of ["idle", "hit"]) {
        const rawPath = path.join(eDir, `${pose}_raw.png`);
        if (!existsSync(rawPath)) continue;
        await reprocessFile(rawPath, path.join(eDir, `${pose}.png`), TARGET_SIZE);
        count++;
      }
    }
    process.stdout.write(`  골목 ${n}: ${enemies.length}종 ✅\n`);
  }
  console.log(`  총 ${count}프레임`);
}

// ─── 메인 ─────────────────────────────────────────────────

async function main() {
  console.log("📐 Flood fill 배경 제거로 전체 재처리\n");

  await reprocessPlayer();
  await reprocessEnemies();

  console.log("\n✅ 재처리 완료! 스프라이트 시트는 별도로 재빌드 필요.");
}

main().catch(e => { console.error("❌", e); process.exit(1); });
