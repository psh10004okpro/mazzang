import sharp from "sharp";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { CONFIG } from "./config.js";

const FRAME_SIZE = 512;
const OUTPUT_DIR = "./output/tools";
const SPRITE_DIR = "./sprites/tools";
const styleRefBase64 = readFileSync("./output/samples_v2/style_i.png").toString("base64");

mkdirSync(OUTPUT_DIR, { recursive: true });
mkdirSync(SPRITE_DIR, { recursive: true });

interface Tool {
  grade: number;
  name: string;
  title: string;
  normalDesc: string;
  breakingDesc: string;
}

const TOOLS: Tool[] = [
  {
    grade: 1, name: "wooden_board", title: "나무 판자",
    normalDesc: "simple wooden training board, pine wood plank standing upright, slightly worn and splintered edges, humble beginner training equipment, 2D game item sprite",
    breakingDesc: "wooden training board cracking apart, deep cracks with light shining through, wood splintering, about to shatter into pieces, glowing fracture lines, 2D game item sprite",
  },
  {
    grade: 2, name: "sandbag", title: "샌드백",
    normalDesc: "leather punching heavy bag hanging from chain, red-brown worn leather, stitched seams, dented from punches, boxing gym training equipment, 2D game item sprite",
    breakingDesc: "leather punching bag bursting open, sand spilling out from tears, leather ripping apart, chain straining, glowing cracks on surface, about to explode, 2D game item sprite",
  },
  {
    grade: 3, name: "wooden_dummy", title: "목인장",
    normalDesc: "traditional wooden wing chun dummy on wooden post, three wooden arms extending outward, polished dark wood, Chinese kung fu martial arts training equipment, 2D game item sprite",
    breakingDesc: "wooden wing chun dummy cracking and breaking, arms splintering, deep glowing cracks across body, wood fragments flying off, about to collapse, 2D game item sprite",
  },
  {
    grade: 4, name: "iron_dummy", title: "철제 목인장",
    normalDesc: "iron metallic wing chun training dummy, dark steel body, glowing orange joints and seams, reinforced industrial martial arts equipment, advanced technology look, 2D game item sprite",
    breakingDesc: "iron training dummy breaking apart, metal plates cracking, sparks flying from joints, orange molten glow from fractures, steel warping and bending, about to explode, 2D game item sprite",
  },
  {
    grade: 5, name: "soul_dummy", title: "영혼 깃든 목인장",
    normalDesc: "mystical spirit-possessed training dummy, wooden body with glowing purple-blue aura, ethereal energy swirling around it, magical runes carved and glowing on surface, ghostly eyes on the dummy, supernatural legendary martial arts equipment, 2D game item sprite",
    breakingDesc: "spirit training dummy overloading with energy, purple-blue aura exploding outward, runes blazing with light, cracks releasing pure energy, spiritual explosion imminent, legendary item shattering, 2D game item sprite",
  },
];

async function gen(prompt: string, refBase64: string): Promise<Buffer> {
  const res = await fetch(`${CONFIG.API_BASE_URL}/images/generations`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${CONFIG.API_KEY}` },
    body: JSON.stringify({ model: CONFIG.MODEL, prompt, n: 1, size: "1024x1024", image: refBase64 }),
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

  function isWhite(idx: number): boolean {
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
  const totalFrames = TOOLS.length * 2;
  let generated = 0;

  console.log(`🔨 맞짱로 수련 도구 에셋 생성 (5등급 × 2상태 = ${totalFrames}장)\n`);

  for (const tool of TOOLS) {
    const toolDir = `${OUTPUT_DIR}/grade${tool.grade}_${tool.name}`;
    mkdirSync(toolDir, { recursive: true });

    console.log(`\n⚒️ ${tool.grade}등급: ${tool.title} (${tool.name})`);

    const states = [
      { name: "normal", prompt: `${tool.normalDesc}. Centered in frame, solid white background. Single object, no characters.` },
      { name: "breaking", prompt: `${tool.breakingDesc}. Centered in frame, solid white background. Single object, no characters.` },
    ];

    // normal 먼저 생성, breaking은 normal 참조
    let normalRef = styleRefBase64;

    for (const state of states) {
      const rawPath = `${toolDir}/${state.name}_raw.png`;
      const framePath = `${toolDir}/${state.name}.png`;

      if (existsSync(framePath)) {
        generated++;
        console.log(`  ⏭️ ${state.name} (이미 존재)`);
        if (state.name === "normal" && existsSync(rawPath)) {
          normalRef = readFileSync(rawPath).toString("base64");
        }
        continue;
      }

      const ref = state.name === "normal" ? styleRefBase64 : normalRef;

      for (let a = 1; a <= 3; a++) {
        try {
          const raw = await gen(state.prompt, ref);
          writeFileSync(rawPath, raw);
          const resized = await sharp(await removeBg(raw))
            .resize(FRAME_SIZE, FRAME_SIZE, { fit: "contain", background: {r:0,g:0,b:0,alpha:0} })
            .png().toBuffer();
          writeFileSync(framePath, resized);
          generated++;
          console.log(`  ✅ ${state.name} [${generated}/${totalFrames}]`);

          // normal의 raw를 breaking 참조로 보관
          if (state.name === "normal") {
            normalRef = raw.toString("base64");
          }
          break;
        } catch (e: any) {
          console.error(`  ⚠️ ${state.name} 시도 ${a}/3: ${e.message}`);
          if (a < 3) await sleep(3000 * a);
        }
      }
      await sleep(1000);
    }
  }

  // ── 스프라이트 시트 (5등급 × 2상태 = 10프레임) ──
  console.log("\n🎞️ 스프라이트 시트 생성...");
  const comp: sharp.OverlayOptions[] = [];
  let col = 0;
  for (const tool of TOOLS) {
    const toolDir = `${OUTPUT_DIR}/grade${tool.grade}_${tool.name}`;
    for (const state of ["normal", "breaking"]) {
      const fp = `${toolDir}/${state}.png`;
      if (existsSync(fp)) {
        comp.push({ input: readFileSync(fp), left: col * FRAME_SIZE, top: 0 });
        col++;
      }
    }
  }

  const sheetPath = `${SPRITE_DIR}/tools_spritesheet.png`;
  await sharp({
    create: { width: FRAME_SIZE * col, height: FRAME_SIZE, channels: 4, background: {r:0,g:0,b:0,alpha:0} },
  }).composite(comp).png().toFile(sheetPath);
  await sharp(sheetPath).webp({ quality: 90 }).toFile(sheetPath.replace(".png", ".webp"));
  console.log(`✅ ${sheetPath} (${col}프레임)`);

  // ── 미리보기 (2행 5열, normal/breaking) ──
  console.log("📋 미리보기 생성...");
  const THUMB = 256, GAP = 4, LBL = 24;
  const prevW = TOOLS.length * (THUMB + GAP) - GAP;
  const prevH = 2 * (THUMB + LBL) + GAP;
  const prevComp: sharp.OverlayOptions[] = [];

  for (let i = 0; i < TOOLS.length; i++) {
    const tool = TOOLS[i];
    const toolDir = `${OUTPUT_DIR}/grade${tool.grade}_${tool.name}`;
    const x = i * (THUMB + GAP);

    // 라벨
    prevComp.push({
      input: Buffer.from(`<svg width="${THUMB}" height="${LBL}"><text x="${THUMB/2}" y="17" text-anchor="middle" font-family="Arial,sans-serif" font-size="12" font-weight="bold" fill="#333">${tool.grade}등급 ${tool.title}</text></svg>`),
      left: x, top: 0,
    });

    for (let s = 0; s < 2; s++) {
      const state = s === 0 ? "normal" : "breaking";
      const fp = `${toolDir}/${state}.png`;
      if (existsSync(fp)) {
        const buf = await sharp(fp)
          .resize(THUMB, THUMB, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } })
          .png().toBuffer();
        prevComp.push({ input: buf, left: x, top: LBL + s * (THUMB + GAP) });
      }
    }
  }

  const prevPath = `${OUTPUT_DIR}/tools_preview.png`;
  await sharp({
    create: { width: prevW, height: prevH, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
  }).composite(prevComp).png().toFile(prevPath);
  console.log(`✅ ${prevPath}`);

  console.log(`\n✅ 완료! ${generated}/${totalFrames}장`);
}

main().catch(e => { console.error("❌", e); process.exit(1); });
