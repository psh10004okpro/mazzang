import sharp from "sharp";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { CONFIG } from "./config.js";
import OpenAI from "openai";

const FRAME_SIZE = 256;
const OUTPUT_DIR = "./output/ui";
const SPRITE_DIR = "./sprites/ui";

mkdirSync(`${OUTPUT_DIR}/effects`, { recursive: true });
mkdirSync(`${OUTPUT_DIR}/icons`, { recursive: true });
mkdirSync(`${OUTPUT_DIR}/buttons`, { recursive: true });
mkdirSync(SPRITE_DIR, { recursive: true });

const client = new OpenAI({ baseURL: CONFIG.API_BASE_URL, apiKey: CONFIG.API_KEY });

interface UiAsset {
  category: string;
  name: string;
  title: string;
  prompt: string;
  size: number;
}

const ASSETS: UiAsset[] = [
  // 타격 이펙트
  { category: "effects", name: "punch_impact", title: "펀치 임팩트", size: 256,
    prompt: "manga style punch impact effect, star-shaped shockwave burst, yellow and white explosion, comic book action hit effect, dynamic radial lines, transparent background, game VFX sprite, no characters, effect only" },
  { category: "effects", name: "kick_impact", title: "킥 임팩트", size: 256,
    prompt: "manga style kick impact effect, crescent moon shaped shockwave, red and orange burst, comic book action hit effect, sweeping arc motion lines, transparent background, game VFX sprite, no characters, effect only" },
  { category: "effects", name: "critical_impact", title: "크리티컬 임팩트", size: 256,
    prompt: "manga style critical hit massive explosion effect, large golden and white starburst, intense light rays radiating outward, comic book super impact, screen-shaking power effect, transparent background, game VFX sprite, no characters" },
  { category: "effects", name: "ko_effect", title: "KO 이펙트", size: 256,
    prompt: "comic book KO text effect, large bold letters K.O. with explosion burst behind, red and yellow dramatic typography, manga knockout effect, action comic style, transparent background, game VFX sprite" },

  // 상태 아이콘
  { category: "icons", name: "icon_punch", title: "펀치 아이콘", size: 128,
    prompt: "game UI icon of a clenched fist, powerful punch symbol, bold outlines, orange-red glow, clean simple design, solid white background, 2D game icon sprite" },
  { category: "icons", name: "icon_kick", title: "킥 아이콘", size: 128,
    prompt: "game UI icon of a kicking leg, dynamic kick symbol, bold outlines, blue glow, clean simple design, solid white background, 2D game icon sprite" },
  { category: "icons", name: "icon_gold", title: "골드 아이콘", size: 128,
    prompt: "game UI icon of shiny gold coins stacked, Korean won symbol, golden sparkle, clean bold design, solid white background, 2D game currency icon sprite" },
  { category: "icons", name: "icon_gem", title: "보석 아이콘", size: 128,
    prompt: "game UI icon of brilliant blue diamond gemstone, sparkling facets, premium quality, glowing blue, clean bold design, solid white background, 2D game jewel icon sprite" },
  { category: "icons", name: "icon_hp", title: "HP 아이콘", size: 128,
    prompt: "game UI icon of red heart with pulse line, health symbol, glowing red, clean bold design, solid white background, 2D game health icon sprite" },
  { category: "icons", name: "icon_star", title: "별 아이콘", size: 128,
    prompt: "game UI icon of golden star, shining bright, achievement clear symbol, sparkle effects, clean bold design, solid white background, 2D game star icon sprite" },

  // 버튼 배경
  { category: "buttons", name: "btn_normal", title: "일반 버튼", size: 128,
    prompt: "game UI button background, dark metallic panel, subtle gradient, rounded rectangle, dark steel texture, clean edges, 2D game button asset, solid dark background" },
  { category: "buttons", name: "btn_highlight", title: "강조 버튼", size: 128,
    prompt: "game UI highlighted button background, golden orange glowing edge, warm gradient center, rounded rectangle, premium action button, 2D game button asset, dark background with golden border" },
  { category: "buttons", name: "btn_disabled", title: "비활성 버튼", size: 128,
    prompt: "game UI disabled button background, dark gray flat panel, desaturated, rounded rectangle, inactive muted look, 2D game button asset, dark gray background" },
];

async function removeBg(input: Buffer, threshold: number = 30): Promise<Buffer> {
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

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  let generated = 0;

  console.log(`🎨 UI/이펙트 에셋 생성 (${ASSETS.length}장)\n`);

  for (const asset of ASSETS) {
    const rawPath = `${OUTPUT_DIR}/${asset.category}/${asset.name}_raw.png`;
    const pngPath = `${OUTPUT_DIR}/${asset.category}/${asset.name}.png`;
    const spritePath = `${SPRITE_DIR}/${asset.name}.png`;
    const webpPath = `${SPRITE_DIR}/${asset.name}.webp`;

    if (existsSync(spritePath)) {
      generated++;
      console.log(`⏭️ ${asset.title}`);
      continue;
    }

    console.log(`🖼️ [${generated+1}/${ASSETS.length}] ${asset.title}...`);

    for (let a = 1; a <= 3; a++) {
      try {
        const response = await client.images.generate({
          model: CONFIG.MODEL,
          prompt: asset.prompt,
          n: 1,
          size: "1024x1024",
        });

        const data = response.data[0];
        let buf: Buffer;
        if (data.b64_json) buf = Buffer.from(data.b64_json, "base64");
        else if (data.url) {
          const res = await fetch(data.url);
          buf = Buffer.from(await res.arrayBuffer());
        } else throw new Error("no data");

        writeFileSync(rawPath, buf);

        // 배경 제거 (버튼은 제거 안 함)
        let processed: Buffer;
        if (asset.category === "buttons") {
          processed = buf;
        } else {
          processed = await removeBg(buf);
        }

        // 리사이즈
        const resized = await sharp(processed)
          .resize(asset.size, asset.size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
          .png().toBuffer();

        writeFileSync(pngPath, resized);
        writeFileSync(spritePath, resized);
        await sharp(resized).webp({ quality: 90 }).toFile(webpPath);

        generated++;
        console.log(`  ✅ ${asset.name}`);
        break;
      } catch (e: any) {
        console.error(`  ⚠️ 시도 ${a}: ${e.message}`);
        if (a < 3) await sleep(3000 * a);
      }
    }
    await sleep(1000);
  }

  // 미리보기
  console.log("\n📋 미리보기 생성...");
  const THUMB = 128, GAP = 8, LBL = 18, COLS = 7;
  const ROWS = Math.ceil(ASSETS.length / COLS);
  const prevW = COLS * (THUMB + GAP) - GAP;
  const prevH = ROWS * (THUMB + LBL + GAP) - GAP;
  const comp: sharp.OverlayOptions[] = [];

  for (let i = 0; i < ASSETS.length; i++) {
    const a = ASSETS[i];
    const col = i % COLS, row = Math.floor(i / COLS);
    const x = col * (THUMB + GAP), y = row * (THUMB + LBL + GAP);
    comp.push({
      input: Buffer.from(`<svg width="${THUMB}" height="${LBL}"><text x="${THUMB/2}" y="13" text-anchor="middle" font-family="Arial,sans-serif" font-size="9" font-weight="bold" fill="#333">${a.title}</text></svg>`),
      left: x, top: y,
    });
    const fp = `${SPRITE_DIR}/${a.name}.png`;
    if (existsSync(fp)) {
      const buf = await sharp(fp)
        .resize(THUMB, THUMB, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } })
        .png().toBuffer();
      comp.push({ input: buf, left: x, top: y + LBL });
    }
  }

  await sharp({
    create: { width: prevW, height: prevH, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
  }).composite(comp).png().toFile(`${OUTPUT_DIR}/ui_preview.png`);

  console.log(`\n✅ 완료! ${generated}/${ASSETS.length}장`);
}

main().catch(e => { console.error("❌", e); process.exit(1); });
