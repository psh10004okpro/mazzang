import sharp from "sharp";
import { readFileSync } from "fs";
import path from "path";

const FRAME_SIZE = 256;
const OUTPUT_DIR = "./output/player_final";
const SPRITE_DIR = "./sprites/player";

const MOTIONS = [
  { name: "idle", frames: 4 },
  { name: "punch_left", frames: 4 },
  { name: "punch_right", frames: 4 },
  { name: "kick_front", frames: 4 },
  { name: "kick_side", frames: 4 },
  { name: "hit", frames: 3 },
];

async function main() {
  const MAX_COLS = 4;
  const ROWS = MOTIONS.length;
  const fullW = FRAME_SIZE * MAX_COLS;
  const fullH = FRAME_SIZE * ROWS;

  const composites: sharp.OverlayOptions[] = [];
  for (let row = 0; row < MOTIONS.length; row++) {
    const m = MOTIONS[row];
    for (let col = 0; col < m.frames; col++) {
      const buf = readFileSync(
        path.join(OUTPUT_DIR, m.name, `frame_${col + 1}.png`)
      );
      composites.push({
        input: buf,
        left: col * FRAME_SIZE,
        top: row * FRAME_SIZE,
      });
    }
  }

  const fullPath = path.join(SPRITE_DIR, "player_spritesheet.png");
  await sharp({
    create: {
      width: fullW,
      height: fullH,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(composites)
    .png()
    .toFile(fullPath);

  await sharp(fullPath)
    .webp({ quality: 90 })
    .toFile(fullPath.replace(".png", ".webp"));

  console.log("통합 스프라이트 시트 재빌드 완료");
}

main();
