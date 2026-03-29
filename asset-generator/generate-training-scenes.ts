import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { CONFIG } from "./config.js";

const OUTPUT_DIR = "./output/training_scenes";
mkdirSync(OUTPUT_DIR, { recursive: true });

const styleRefBase64 = readFileSync("./output/samples_v2/style_i.png").toString("base64");

const ILLUST = "2D Korean webtoon cartoon illustration, bold outlines, cel-shaded coloring";
const NO_UI = "This is a game illustration, NOT a game screenshot. No UI elements, no health bars, no buttons, no text, no HUD, no game interface";

const TOOLS = [
  { grade: 1, name: "wooden_board", desc: "hitting a wooden training board with his fist, wood cracking slightly" },
  { grade: 2, name: "sandbag", desc: "punching a red leather heavy punching bag hanging from chain, bag swinging from impact" },
  { grade: 3, name: "wooden_dummy", desc: "striking a traditional wooden wing chun dummy with three arms, martial arts training" },
  { grade: 4, name: "iron_dummy", desc: "punching a dark iron metallic training dummy with glowing orange joints, sparks flying" },
  { grade: 5, name: "soul_dummy", desc: "hitting a mystical glowing purple training dummy with ethereal energy, magical runes glowing" },
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
  console.log("🥋 수련 씬 이미지 생성 (5등급)\n");

  for (const tool of TOOLS) {
    console.log(`${tool.grade}등급 ${tool.name}...`);
    const prompt = `${ILLUST}. A young Korean fighter in white tank top ${tool.desc}. Dark Korean dojo interior, wooden floor, dim warm lighting. Full body character standing on ground. ${NO_UI}. Vertical 9:16.`;

    for (let a = 1; a <= 3; a++) {
      try {
        const buf = await gen(prompt);
        writeFileSync(`${OUTPUT_DIR}/training_grade${tool.grade}.png`, buf);
        console.log(`  ✅`);
        break;
      } catch (e: any) {
        console.error(`  시도 ${a}: ${e.message}`);
        if (a < 3) await new Promise(r => setTimeout(r, 3000));
      }
    }
  }

  console.log("\n✅ 완료");
}

main().catch(console.error);
