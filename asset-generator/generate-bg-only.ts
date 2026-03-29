import sharp from "sharp";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { CONFIG } from "./config.js";

const SCENE_DIR = "./output/backgrounds_final/scenes";
const BG_DIR = "./output/backgrounds_final/bg_only";
const SPRITE_DIR = "./sprites/backgrounds";
const WIDTH = 750;
const HEIGHT = 1334;

mkdirSync(BG_DIR, { recursive: true });

const NO_UI = "This is a game illustration, NOT a game screenshot. No UI, no text, no HUD";

const BACKGROUNDS = [
  { name: "training_room", bgPrompt: `Same background but completely empty, no characters, no people. Dark Korean dojo interior, wooden floor, punching bags, training equipment, dim warm lighting. ${NO_UI}. Vertical 9:16.` },
  { name: "upgrade_shop", bgPrompt: `Same background but empty, no characters, no people. Underground forge workshop, anvil, glowing embers, dark metal walls, sparks. ${NO_UI}. Vertical 9:16.` },
  { name: "alley_01", bgPrompt: `Same dark Korean residential alley but empty, no characters, no people. Streetlight, graffiti walls, wet pavement, apartments. ${NO_UI}. Vertical 9:16.` },
  { name: "alley_02", bgPrompt: `Same shopping street alley but empty, no characters, no people. Closed shutters, Korean signs, neon lights, trash cans. ${NO_UI}. Vertical 9:16.` },
  { name: "alley_03", bgPrompt: `Same market alley but empty, no characters, no people. Tent stalls, fluorescent lights, crates, wet concrete. ${NO_UI}. Vertical 9:16.` },
  { name: "alley_04", bgPrompt: `Same entertainment district but empty, no characters, no people. Neon signs, bar signs, foggy air, wet street. ${NO_UI}. Vertical 9:16.` },
  { name: "alley_05", bgPrompt: `Same construction site but empty, no characters, no people. Rebar, warning tape, concrete, work light, dust. ${NO_UI}. Vertical 9:16.` },
  { name: "alley_06", bgPrompt: `Same harbor dock but empty, no characters, no people. Pier, boats, moonlight, fog, lighthouse. ${NO_UI}. Vertical 9:16.` },
  { name: "alley_07", bgPrompt: `Same warehouse but empty, no characters, no people. Containers, industrial lights, oil stains. ${NO_UI}. Vertical 9:16.` },
  { name: "alley_08", bgPrompt: `Same dark alley but empty, no characters, no people. Dumpsters, fire escapes, neon, graffiti. ${NO_UI}. Vertical 9:16.` },
  { name: "alley_09", bgPrompt: `Same parking garage but empty, no characters, no people. Pillars, fluorescent lights, shadows. ${NO_UI}. Vertical 9:16.` },
  { name: "alley_10", bgPrompt: `Same abandoned factory but empty, no characters, no people. Machinery, rusty beams, moonlight, debris. ${NO_UI}. Vertical 9:16.` },
  { name: "alley_11", bgPrompt: `Same crime territory entrance but empty, no characters, no people. Metal door, red lighting, black cars. ${NO_UI}. Vertical 9:16.` },
  { name: "alley_12", bgPrompt: `Same gambling den but empty, no characters, no people. Green tables, hanging lamps, smoke, cards. ${NO_UI}. Vertical 9:16.` },
  { name: "alley_13", bgPrompt: `Same loan shark office but empty, no characters, no people. Fluorescent light, money, filing cabinets. ${NO_UI}. Vertical 9:16.` },
  { name: "alley_14", bgPrompt: `Same underground club but empty, no characters, no people. Neon lights, booths, smoke, speakers. ${NO_UI}. Vertical 9:16.` },
  { name: "alley_15", bgPrompt: `Same boundary area but empty, no characters, no people. Chain fence, razor wire, graffiti, fog. ${NO_UI}. Vertical 9:16.` },
  { name: "alley_16", bgPrompt: `Same rooftop arena but empty, no characters, no people. City skyline, spotlight, concrete floor. ${NO_UI}. Vertical 9:16.` },
  { name: "alley_17", bgPrompt: `Same dojo but empty, no characters, no people. Dark wood, scrolls, incense smoke, moonlight. ${NO_UI}. Vertical 9:16.` },
  { name: "alley_18", bgPrompt: `Same military compound but empty, no characters, no people. Barbed wire, tents, crates, searchlight. ${NO_UI}. Vertical 9:16.` },
  { name: "alley_19", bgPrompt: `Same penthouse but empty, no characters, no people. Windows, city lights, dark furniture, red accent. ${NO_UI}. Vertical 9:16.` },
  { name: "alley_20", bgPrompt: `Same epic rooftop but empty, no characters, no people. Storm clouds, lightning, city below, spotlight. ${NO_UI}. Vertical 9:16.` },
  { name: "underground_arena", bgPrompt: `Same underground arena but empty, no characters, no people. Concrete octagon, spotlight, crowd silhouettes, cage walls. ${NO_UI}. Vertical 9:16.` },
];

async function gen(prompt: string, ref: string): Promise<Buffer> {
  const res = await fetch(`${CONFIG.API_BASE_URL}/images/generations`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${CONFIG.API_KEY}` },
    body: JSON.stringify({ model: CONFIG.MODEL, prompt, n: 1, size: "1024x1024", image: ref }),
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  const json = (await res.json()) as any;
  const d = json.data[0];
  if (d.b64_json) return Buffer.from(d.b64_json, "base64");
  if (d.url) { const r = await fetch(d.url); return Buffer.from(await r.arrayBuffer()); }
  throw new Error("no image");
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const startIdx = parseInt(process.argv[2] || "0");
  const endIdx = parseInt(process.argv[3] || String(BACKGROUNDS.length - 1));
  const bgs = BACKGROUNDS.slice(startIdx, endIdx + 1);

  console.log(`🏙️ 배경만 생성 (씬 참조 → 캐릭터 제거, ${bgs.length}장)\n`);

  let generated = 0;

  for (const bg of bgs) {
    const sceneRaw = `${SCENE_DIR}/${bg.name}_raw.png`;
    const bgRaw = `${BG_DIR}/${bg.name}_raw.png`;
    const bgJpg = `${SPRITE_DIR}/${bg.name}.jpg`;
    const bgWebp = `${SPRITE_DIR}/${bg.name}.webp`;

    if (existsSync(bgRaw)) {
      generated++;
      console.log(`⏭️ ${bg.name} (이미 존재)`);
      continue;
    }

    if (!existsSync(sceneRaw)) {
      console.log(`❌ ${bg.name} — 씬 raw 없음, 스킵`);
      continue;
    }

    const sceneRef = readFileSync(sceneRaw).toString("base64");

    console.log(`🖼️ [${generated+1}/${bgs.length}] ${bg.name}...`);

    for (let a = 1; a <= 3; a++) {
      try {
        const buf = await gen(bg.bgPrompt, sceneRef);
        writeFileSync(bgRaw, buf);
        await sharp(buf).resize(WIDTH, HEIGHT, { fit: "cover" }).jpeg({ quality: 80 }).toFile(bgJpg);
        await sharp(buf).resize(WIDTH, HEIGHT, { fit: "cover" }).webp({ quality: 80 }).toFile(bgWebp);
        generated++;
        console.log(`  ✅ ${bg.name}`);
        break;
      } catch (e: any) {
        console.error(`  ⚠️ 시도 ${a}: ${e.message}`);
        if (a < 3) await sleep(3000 * a);
      }
    }
    await sleep(1000);
  }

  console.log(`\n✅ 완료! ${generated}장`);
}

main().catch(e => { console.error("❌", e); process.exit(1); });
