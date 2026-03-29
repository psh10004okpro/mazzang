import sharp from "sharp";
import path from "path";

const DIR = "./output/player";
const poses = [
  { file: "idle.png", label: "대기 (Idle)" },
  { file: "punch_left.png", label: "왼손 펀치" },
  { file: "punch_right.png", label: "오른손 펀치" },
  { file: "kick.png", label: "발차기 (Kick)" },
];

const CELL = 420;
const GAP = 10;
const LABEL_H = 36;
const totalW = poses.length * CELL + (poses.length - 1) * GAP;
const totalH = CELL + LABEL_H;

async function main() {
  const composites: sharp.OverlayOptions[] = [];

  for (let i = 0; i < poses.length; i++) {
    const x = i * (CELL + GAP);
    const svg = Buffer.from(`
      <svg width="${CELL}" height="${LABEL_H}">
        <rect width="${CELL}" height="${LABEL_H}" fill="white"/>
        <text x="${CELL / 2}" y="26" text-anchor="middle"
              font-family="Arial, sans-serif" font-size="20" font-weight="bold"
              fill="#333">${poses[i].label}</text>
      </svg>
    `);
    composites.push({ input: svg, left: x, top: 0 });

    const buf = await sharp(path.join(DIR, poses[i].file))
      .resize(CELL, CELL, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } })
      .png()
      .toBuffer();
    composites.push({ input: buf, left: x, top: LABEL_H });
  }

  await sharp({
    create: { width: totalW, height: totalH, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
  })
    .composite(composites)
    .png()
    .toFile(path.join(DIR, "player_poses_test.png"));

  console.log("비교 이미지 재생성 완료");
}

main();
