import sharp from "sharp";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { CONFIG } from "./config.js";

const FRAME_SIZE = 256;
const OUTPUT_DIR = "./output/ui/effects";
const SPRITE_DIR = "./sprites/ui";
const styleRefBase64 = readFileSync("./output/samples_v2/style_i.png").toString("base64");

const STYLE = "2D manga comic book style, bold outlines, cel-shaded, game VFX sprite, transparent background, no characters, effect only";

interface Effect {
  name: string;
  title: string;
  frames: { prompt: string }[];
}

const EFFECTS: Effect[] = [
  {
    name: "punch_impact",
    title: "펀치 임팩트",
    frames: [
      { prompt: `${STYLE}, small star-shaped impact flash, yellow white burst, beginning of punch hit, tiny shockwave` },
      { prompt: `${STYLE}, medium star-shaped impact explosion, yellow white burst expanding, punch hit shockwave, radial speed lines` },
      { prompt: `${STYLE}, large star-shaped impact explosion at maximum size, bright yellow white starburst, punch hit shockwave fully expanded, bold radial lines` },
      { prompt: `${STYLE}, fading star-shaped impact, yellow white burst dissipating, particles scattering outward, punch hit ending` },
    ],
  },
  {
    name: "kick_impact",
    title: "킥 임팩트",
    frames: [
      { prompt: `${STYLE}, small crescent moon shaped impact flash, red orange burst, beginning of kick hit, arc shockwave` },
      { prompt: `${STYLE}, medium crescent arc impact, red orange burst expanding, kick hit sweeping shockwave, curved speed lines` },
      { prompt: `${STYLE}, large crescent arc impact at maximum, bright red orange burst, kick hit fully expanded, bold curved motion lines` },
      { prompt: `${STYLE}, fading crescent impact, red orange burst dissipating, sparks scattering, kick hit ending` },
    ],
  },
  {
    name: "critical_impact",
    title: "크리티컬 임팩트",
    frames: [
      { prompt: `${STYLE}, tiny bright flash point, golden white light, critical hit starting, intense energy gathering` },
      { prompt: `${STYLE}, golden explosion expanding, bright white center, critical hit burst, intense light rays radiating, screen flash` },
      { prompt: `${STYLE}, massive golden starburst explosion at maximum, blinding white center, critical hit fully expanded, lightning bolts radiating` },
      { prompt: `${STYLE}, golden explosion fading, sparkles and debris scattering outward, critical hit dissipating, residual glow` },
    ],
  },
  {
    name: "ko_effect",
    title: "KO 이펙트",
    frames: [
      { prompt: `${STYLE}, small KO text appearing, red bold comic letters, knockout effect starting, slight zoom burst behind text` },
      { prompt: `${STYLE}, medium KO text with explosion burst, large red and yellow bold comic letters K.O., dramatic impact behind, shaking effect` },
      { prompt: `${STYLE}, maximum size KO text with massive explosion, huge bold red yellow K.O. letters, dramatic starburst, screen-filling knockout effect` },
      { prompt: `${STYLE}, KO text fading with sparkles, red yellow letters dissolving into particles, knockout effect ending, residual stars` },
    ],
  },
];

async function gen(prompt: string): Promise<Buffer> {
  const res = await fetch(`${CONFIG.API_BASE_URL}/images/generations`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${CONFIG.API_KEY}` },
    body: JSON.stringify({ model: CONFIG.MODEL, prompt, n: 1, size: "1024x1024", image: styleRefBase64 }),
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  const json = (await res.json()) as any;
  const d = json.data[0];
  if (d.b64_json) return Buffer.from(d.b64_json, "base64");
  if (d.url) { const r = await fetch(d.url); return Buffer.from(await r.arrayBuffer()); }
  throw new Error("no image");
}

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
  const totalFrames = EFFECTS.reduce((s, e) => s + e.frames.length, 0);
  let generated = 0;

  console.log(`💥 이펙트 스프라이트 생성 (${EFFECTS.length}종 × 4프레임 = ${totalFrames}장)\n`);

  for (const effect of EFFECTS) {
    const effectDir = `${OUTPUT_DIR}/${effect.name}`;
    mkdirSync(effectDir, { recursive: true });

    console.log(`\n⚡ ${effect.title} (${effect.frames.length}프레임)`);

    // 첫 프레임 생성 → 나머지는 첫 프레임 참조
    let effectRef = styleRefBase64;

    for (let f = 0; f < effect.frames.length; f++) {
      const rawPath = `${effectDir}/frame_${f+1}_raw.png`;
      const framePath = `${effectDir}/frame_${f+1}.png`;

      console.log(`  frame_${f+1}...`);

      const ref = f === 0 ? styleRefBase64 : effectRef;

      for (let a = 1; a <= 3; a++) {
        try {
          const raw = await gen(effect.frames[f].prompt);
          writeFileSync(rawPath, raw);

          if (f === 0) effectRef = raw.toString("base64");

          const resized = await sharp(await removeBg(raw))
            .resize(FRAME_SIZE, FRAME_SIZE, { fit: "contain", background: { r:0,g:0,b:0,alpha:0 } })
            .png().toBuffer();
          writeFileSync(framePath, resized);

          generated++;
          console.log(`    ✅ [${generated}/${totalFrames}]`);
          break;
        } catch (e: any) {
          console.error(`    ⚠️ 시도 ${a}: ${e.message}`);
          if (a < 3) await sleep(3000 * a);
        }
      }
      await sleep(1000);
    }

    // 이펙트별 스프라이트 시트 (가로 나열)
    const comp: sharp.OverlayOptions[] = [];
    for (let f = 0; f < effect.frames.length; f++) {
      const fp = `${effectDir}/frame_${f+1}.png`;
      if (existsSync(fp)) {
        comp.push({ input: readFileSync(fp), left: f * FRAME_SIZE, top: 0 });
      }
    }

    const sheetPath = `${SPRITE_DIR}/${effect.name}.png`;
    await sharp({
      create: { width: FRAME_SIZE * effect.frames.length, height: FRAME_SIZE, channels: 4, background: {r:0,g:0,b:0,alpha:0} },
    }).composite(comp).png().toFile(sheetPath);
    await sharp(sheetPath).webp({ quality: 90 }).toFile(sheetPath.replace(".png", ".webp"));
    console.log(`  🎞️ ${effect.name} 시트 완료`);
  }

  console.log(`\n✅ 완료! ${generated}/${totalFrames}장`);
}

main().catch(console.error);
