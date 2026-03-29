import sharp from "sharp";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { CONFIG } from "./config.js";

const OUTPUT_DIR = "./output/backgrounds/test_no_ui";
mkdirSync(OUTPUT_DIR, { recursive: true });

const styleRefBase64 = readFileSync("./output/samples_v2/style_i.png").toString("base64");

const TESTS = [
  {
    name: "scene_alley1",
    title: "골목1 전투 씬",
    prompt: `2D Korean webtoon cartoon illustration, bold outlines, cel-shaded coloring.
A young fighter in white tank top standing on the left facing right, versus a teenage thug in school uniform standing on the right facing left.
Dark narrow Korean residential back alley at night, dim streetlight, graffiti walls, wet pavement.
Full body characters standing on ground level.
This is a game illustration, NOT a game screenshot. No UI elements, no health bars, no buttons, no text, no HUD, no score, no game interface.
Vertical 9:16 ratio. Dark moody atmosphere.`,
  },
  {
    name: "scene_alley10",
    title: "골목10 전투 씬",
    prompt: `2D Korean webtoon cartoon illustration, bold outlines, cel-shaded coloring.
A young fighter in white tank top standing on the left facing right, versus a large muscular man in torn factory coveralls standing on the right facing left.
Abandoned dark factory at night, broken machinery, rusty beams, moonlight through windows.
Full body characters standing on ground level.
This is a game illustration, NOT a game screenshot. No UI elements, no health bars, no buttons, no text, no HUD, no game interface.
Vertical 9:16 ratio. Dark industrial atmosphere.`,
  },
  {
    name: "scene_boss",
    title: "보스전 씬",
    prompt: `2D Korean webtoon cartoon illustration, bold outlines, cel-shaded coloring.
A young fighter in white tank top standing on the left facing right, versus a huge imposing man in dark suit standing on the right facing left. The boss is much larger than the fighter.
Underground fighting arena, concrete floor, single spotlight from above, crowd silhouettes in deep shadows.
Full body characters standing on ground level.
This is a game illustration, NOT a game screenshot. No UI elements, no health bars, no buttons, no text, no HUD, no game interface.
Vertical 9:16 ratio. Intense dark atmosphere.`,
  },
  {
    name: "scene_training",
    title: "수련장 씬",
    prompt: `2D Korean webtoon cartoon illustration, bold outlines, cel-shaded coloring.
A young fighter in white tank top hitting a punching sandbag in a dark Korean dojo interior.
Wooden floor, training equipment on walls, dim warm orange lighting, moody shadows.
Full body character standing on ground level.
This is a game illustration, NOT a game screenshot. No UI elements, no health bars, no buttons, no text, no HUD, no game interface.
Vertical 9:16 ratio. Dark warm atmosphere.`,
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

async function main() {
  console.log("🎬 배경+캐릭터 씬 (UI 없이) 테스트\n");

  for (const test of TESTS) {
    console.log(`${test.title}...`);
    try {
      const buf = await gen(test.prompt);
      writeFileSync(`${OUTPUT_DIR}/${test.name}_raw.png`, buf);
      await sharp(buf).resize(750, 1334, { fit: "cover" }).png().toFile(`${OUTPUT_DIR}/${test.name}.png`);
      console.log(`  ✅ ${test.name}`);
    } catch (e: any) {
      console.error(`  ❌ ${e.message}`);
    }
  }

  console.log("\n✅ 완료");
}

main().catch(console.error);
