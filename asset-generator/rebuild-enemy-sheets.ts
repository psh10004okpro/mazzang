import sharp from "sharp";
import { readdirSync, readFileSync, existsSync } from "fs";
import path from "path";

const ENEMY_SIZE = 512;
const baseDir = "./output/enemies";
const spriteDir = "./sprites/enemies";

async function main() {
  for (let n = 1; n <= 20; n++) {
    const alleyDir = path.join(baseDir, `alley${n}`);
    if (!existsSync(alleyDir)) continue;

    const enemies = readdirSync(alleyDir)
      .filter(d => existsSync(path.join(alleyDir, d, "idle.png")))
      .sort();

    const comp: sharp.OverlayOptions[] = [];
    let col = 0;
    for (const enemy of enemies) {
      for (const pose of ["idle", "hit"]) {
        const fp = path.join(alleyDir, enemy, `${pose}.png`);
        if (existsSync(fp)) {
          comp.push({ input: readFileSync(fp), left: col * ENEMY_SIZE, top: 0 });
          col++;
        }
      }
    }

    if (comp.length > 0) {
      const out = path.join(spriteDir, `alley${n}_enemies.png`);
      await sharp({
        create: { width: ENEMY_SIZE * col, height: ENEMY_SIZE, channels: 4, background: { r:0,g:0,b:0,alpha:0 } },
      }).composite(comp).png().toFile(out);
      await sharp(out).webp({ quality: 90 }).toFile(out.replace(".png", ".webp"));
      process.stdout.write(`골목 ${n} ✅  `);
    }
  }
  console.log("\n완료");
}

main();
