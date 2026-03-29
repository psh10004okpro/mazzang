import sharp from "sharp";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { CONFIG } from "./config.js";

const OUTPUT_DIR = "./output/backgrounds/test";
mkdirSync(OUTPUT_DIR, { recursive: true });

const styleRefBase64 = readFileSync("./output/samples_v2/style_i.png").toString("base64");

// 테스트: 주인공 vs 적이 서있는 배경 씬을 통째로 생성
const TESTS = [
  {
    name: "scene_alley1",
    title: "골목1 전투 씬",
    prompt: `2D mobile fighting game battle scene, Korean webtoon cartoon art style, bold outlines, cel-shaded coloring.
A young fighter in white tank top on the left facing right, versus a street thug in school uniform on the right facing left.
They are standing in a dark narrow Korean residential back alley at night, dim streetlight, graffiti walls, wet pavement.
Full body characters standing on ground, game battle screen layout.
Vertical 9:16 mobile ratio. Dark moody atmosphere.`,
  },
  {
    name: "scene_alley10",
    title: "골목10 전투 씬",
    prompt: `2D mobile fighting game battle scene, Korean webtoon cartoon art style, bold outlines, cel-shaded coloring.
A young fighter in white tank top on the left facing right, versus a large muscular factory worker enemy on the right facing left.
They are standing in an abandoned dark factory at night, broken machinery, rusty beams, moonlight through shattered windows.
Full body characters standing on ground, game battle screen layout.
Vertical 9:16 mobile ratio. Dark industrial atmosphere.`,
  },
  {
    name: "scene_boss",
    title: "보스전 씬",
    prompt: `2D mobile fighting game boss battle scene, Korean webtoon cartoon art style, bold outlines, cel-shaded coloring.
A young fighter in white tank top on the left facing right, versus a huge intimidating boss character in dark suit on the right facing left.
They are standing in an underground fighting arena, concrete floor, single spotlight from above, crowd silhouettes in shadows.
Full body characters standing on ground, dramatic boss fight game screen layout.
Vertical 9:16 mobile ratio. Intense dark atmosphere.`,
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
  console.log("🎬 배경+캐릭터 통합 씬 테스트 (3장)\n");

  for (const test of TESTS) {
    console.log(`${test.title}...`);
    try {
      const buf = await gen(test.prompt);
      writeFileSync(`${OUTPUT_DIR}/${test.name}_raw.png`, buf);

      // 9:16 리사이즈
      await sharp(buf)
        .resize(750, 1334, { fit: "cover" })
        .png()
        .toFile(`${OUTPUT_DIR}/${test.name}.png`);

      console.log(`  ✅ ${test.name}`);
    } catch (e: any) {
      console.error(`  ❌ ${e.message}`);
    }
  }

  console.log("\n✅ 완료");
}

main().catch(console.error);
