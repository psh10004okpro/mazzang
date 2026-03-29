import sharp from "sharp";
import path from "path";

const OUTPUT_DIR = "./output/player_final";
const PREV_CELL = 200, GAP = 4, LBL = 24;

const MOTIONS = [
  { name: "idle", label: "대기 (idle)", frames: 4 },
  { name: "punch_left", label: "왼손 펀치 (punch_left)", frames: 4 },
  { name: "punch_right", label: "오른손 펀치 (punch_right)", frames: 4 },
  { name: "kick_front", label: "정면 킥 (kick_front)", frames: 4 },
  { name: "kick_side", label: "옆차기 (kick_side)", frames: 4 },
  { name: "hit", label: "피격 (hit)", frames: 3 },
];

async function main() {
  const MAX_COLS = 4;
  const prevW = MAX_COLS * PREV_CELL + (MAX_COLS - 1) * GAP;
  const prevH = MOTIONS.length * (PREV_CELL + LBL) + (MOTIONS.length - 1) * GAP;
  const comp: sharp.OverlayOptions[] = [];

  for (let row = 0; row < MOTIONS.length; row++) {
    const m = MOTIONS[row];
    const y = row * (PREV_CELL + LBL + GAP);

    comp.push({
      input: Buffer.from(`<svg width="${prevW}" height="${LBL}"><text x="4" y="18" font-family="Arial,sans-serif" font-size="14" font-weight="bold" fill="#333">${m.label}</text></svg>`),
      left: 0, top: y,
    });

    for (let col = 0; col < m.frames; col++) {
      const x = col * (PREV_CELL + GAP);
      const buf = await sharp(path.join(OUTPUT_DIR, m.name, `frame_${col + 1}.png`))
        .resize(PREV_CELL, PREV_CELL, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } })
        .png().toBuffer();
      comp.push({ input: buf, left: x, top: y + LBL });
    }
  }

  await sharp({
    create: { width: prevW, height: prevH, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
  }).composite(comp).png().toFile(path.join(OUTPUT_DIR, "preview_all.png"));

  console.log("미리보기 재빌드 완료");
}

main();
