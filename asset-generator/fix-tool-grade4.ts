import sharp from "sharp";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { CONFIG } from "./config.js";
import OpenAI from "openai";

const FRAME_SIZE = 512;
const OUTPUT_DIR = "./output/tools/grade4_iron_dummy";
const SPRITE_DIR = "./sprites/tools";

const client = new OpenAI({ baseURL: CONFIG.API_BASE_URL, apiKey: CONFIG.API_KEY });

// 3등급 목인장을 참조로 사용 → 비슷한 형태의 철제 버전
const grade3Ref = readFileSync("./output/tools/grade3_wooden_dummy/normal_raw.png").toString("base64");

const STATES = [
  {
    name: "normal",
    prompt: "Same wooden dummy shape but made of dark iron metal instead of wood. Metallic wing chun training dummy, steel body with same three-arm structure, glowing orange joints and rivets, dark industrial metal texture, advanced martial arts equipment. 2D game item sprite, centered, solid white background, single object, no characters.",
  },
  {
    name: "breaking",
    prompt: "Same iron metal training dummy breaking apart. Metal plates cracking open, orange sparks flying from joints, molten glow from fractures, steel warping and bending, same three-arm structure shattering. 2D game item sprite, centered, solid white background, single object, no characters.",
  },
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

async function main() {
  console.log("⚒️ 4등급 철제 목인장 재생성 (3등급 참조)\n");

  let normalRef = grade3Ref;

  for (const state of STATES) {
    const rawPath = `${OUTPUT_DIR}/${state.name}_raw.png`;
    const framePath = `${OUTPUT_DIR}/${state.name}.png`;

    console.log(`${state.name} 생성...`);

    const ref = state.name === "normal" ? grade3Ref : normalRef;

    const res = await fetch(`${CONFIG.API_BASE_URL}/images/generations`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${CONFIG.API_KEY}` },
      body: JSON.stringify({ model: CONFIG.MODEL, prompt: state.prompt, n: 1, size: "1024x1024", image: ref }),
    });
    const json = (await res.json()) as any;
    const buf = Buffer.from(json.data[0].b64_json, "base64");

    writeFileSync(rawPath, buf);

    if (state.name === "normal") {
      normalRef = buf.toString("base64");
    }

    const resized = await sharp(await removeBg(buf))
      .resize(FRAME_SIZE, FRAME_SIZE, { fit: "contain", background: {r:0,g:0,b:0,alpha:0} })
      .png().toBuffer();
    writeFileSync(framePath, resized);
    console.log(`  ✅ ${state.name}`);
  }

  // 스프라이트 시트 재빌드
  console.log("\n스프라이트 시트 재빌드...");
  const allTools = [
    { dir: "grade1_wooden_board" }, { dir: "grade2_sandbag" },
    { dir: "grade3_wooden_dummy" }, { dir: "grade4_iron_dummy" },
    { dir: "grade5_soul_dummy" },
  ];
  const comp: sharp.OverlayOptions[] = [];
  let col = 0;
  for (const tool of allTools) {
    for (const state of ["normal", "breaking"]) {
      const fp = `./output/tools/${tool.dir}/${state}.png`;
      if (existsSync(fp)) {
        comp.push({ input: readFileSync(fp), left: col * FRAME_SIZE, top: 0 });
        col++;
      }
    }
  }
  await sharp({
    create: { width: FRAME_SIZE * col, height: FRAME_SIZE, channels: 4, background: {r:0,g:0,b:0,alpha:0} },
  }).composite(comp).png().toFile(`${SPRITE_DIR}/tools_spritesheet.png`);
  await sharp(`${SPRITE_DIR}/tools_spritesheet.png`).webp({ quality: 90 })
    .toFile(`${SPRITE_DIR}/tools_spritesheet.webp`);

  console.log("✅ 완료");
}

main().catch(console.error);
