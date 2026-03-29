import sharp from "sharp";
import { readdirSync, existsSync, copyFileSync, mkdirSync } from "fs";

const BG_DIR = "./output/backgrounds_final/bg_only";
const SPRITE_DIR = "./sprites/backgrounds";
const GAME_DIR = "../public/assets/backgrounds";

mkdirSync(GAME_DIR, { recursive: true });

async function main() {
  const raws = readdirSync(BG_DIR).filter(f => f.endsWith("_raw.png")).sort();
  console.log(`${raws.length}장 배경 → sprites + game 복사\n`);

  for (const raw of raws) {
    const name = raw.replace("_raw.png", "");
    const rawPath = `${BG_DIR}/${raw}`;
    const jpgPath = `${SPRITE_DIR}/${name}.jpg`;
    const webpPath = `${SPRITE_DIR}/${name}.webp`;

    await sharp(rawPath).resize(750, 1334, { fit: "cover" }).jpeg({ quality: 80 }).toFile(jpgPath);
    await sharp(rawPath).resize(750, 1334, { fit: "cover" }).webp({ quality: 80 }).toFile(webpPath);

    copyFileSync(jpgPath, `${GAME_DIR}/${name}.jpg`);
    copyFileSync(webpPath, `${GAME_DIR}/${name}.webp`);

    process.stdout.write(`${name} ✅  `);
  }

  console.log("\n\n✅ 완료");
}

main();
