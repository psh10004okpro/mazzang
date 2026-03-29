import sharp from "sharp";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { CONFIG } from "./config.js";

const OUTPUT_DIR = "./output/backgrounds_final";
const SPRITE_DIR = "./sprites/backgrounds";
const WIDTH = 750;
const HEIGHT = 1334;
const styleRefBase64 = readFileSync("./output/samples_v2/style_i.png").toString("base64");

mkdirSync(`${OUTPUT_DIR}/scenes`, { recursive: true });
mkdirSync(`${OUTPUT_DIR}/bg_only`, { recursive: true });
mkdirSync(SPRITE_DIR, { recursive: true });

const ILLUST = "2D Korean webtoon cartoon illustration, bold outlines, cel-shaded coloring";
const NO_UI = "This is a game illustration, NOT a game screenshot. No UI elements, no health bars, no buttons, no text, no HUD, no score, no game interface";

interface BgDef {
  name: string;
  title: string;
  scenePrompt: string; // 캐릭터+배경
  bgPrompt: string;    // 배경만
}

const BACKGROUNDS: BgDef[] = [
  { name: "training_room", title: "수련장",
    scenePrompt: `${ILLUST}. A young fighter in white tank top hitting a punching sandbag in a dark Korean dojo interior. Wooden floor, training equipment on walls, dim warm orange lighting. Full body character. ${NO_UI}. Vertical 9:16.`,
    bgPrompt: `Same background scene but completely empty, no characters, no people. Dark Korean dojo interior, wooden floor, punching bags hanging, training equipment, dim warm lighting. ${NO_UI}. Vertical 9:16.` },
  { name: "upgrade_shop", title: "강화소",
    scenePrompt: `${ILLUST}. A young fighter in white tank top standing in an underground blacksmith forge workshop. Anvil, glowing embers, dark metal walls with tools, sparks. Full body character. ${NO_UI}. Vertical 9:16.`,
    bgPrompt: `Same background but empty, no characters. Underground forge workshop, anvil, glowing embers, dark metal walls, sparks floating. ${NO_UI}. Vertical 9:16.` },
  { name: "alley_01", title: "골목1: 주택가",
    scenePrompt: `${ILLUST}. A young fighter in white tank top on left versus a teenage thug in school uniform on right. Dark narrow Korean residential back alley at night, streetlight, graffiti walls, wet pavement. Full body. ${NO_UI}. Vertical 9:16.`,
    bgPrompt: `Same dark Korean residential alley but empty, no characters. Streetlight, graffiti walls, wet pavement, apartments. ${NO_UI}. Vertical 9:16.` },
  { name: "alley_02", title: "골목2: 상가",
    scenePrompt: `${ILLUST}. A young fighter in white tank top versus a punk in leather jacket. Dark Korean shopping street back alley at night, closed shop shutters, Korean signs, trash cans, flickering neon. Full body. ${NO_UI}. Vertical 9:16.`,
    bgPrompt: `Same shopping street alley but empty, no characters. Closed shutters, Korean signs, neon lights, trash cans. ${NO_UI}. Vertical 9:16.` },
  { name: "alley_03", title: "골목3: 시장",
    scenePrompt: `${ILLUST}. A young fighter versus a muscular market worker in stained tank top. Dark Korean market alley at night, closed tent stalls, fluorescent lights, wooden crates. Full body. ${NO_UI}. Vertical 9:16.`,
    bgPrompt: `Same market alley but empty, no characters. Tent stalls, fluorescent lights, crates, wet concrete. ${NO_UI}. Vertical 9:16.` },
  { name: "alley_04", title: "골목4: 유흥가",
    scenePrompt: `${ILLUST}. A young fighter versus a suited man with gold chain in entertainment district. Colorful neon signs pink and blue, bar signs in Korean, foggy air, wet street. Full body. ${NO_UI}. Vertical 9:16.`,
    bgPrompt: `Same entertainment district but empty, no characters. Neon signs, bar signs, foggy air, wet reflective street. ${NO_UI}. Vertical 9:16.` },
  { name: "alley_05", title: "골목5: 공사장",
    scenePrompt: `${ILLUST}. A young fighter versus a big man in work coveralls at construction site. Steel rebar piles, warning tape, unfinished concrete, harsh work light, dust. Full body. ${NO_UI}. Vertical 9:16.`,
    bgPrompt: `Same construction site but empty, no characters. Rebar, warning tape, concrete, work light, dust. ${NO_UI}. Vertical 9:16.` },
  { name: "alley_06", title: "골목6: 항구",
    scenePrompt: `${ILLUST}. A young fighter versus a sailor thug at dark harbor dock. Wooden pier, fishing boats, moonlight on water, fog, ropes. Full body. ${NO_UI}. Vertical 9:16.`,
    bgPrompt: `Same harbor dock but empty, no characters. Pier, boats, moonlight, fog, lighthouse. ${NO_UI}. Vertical 9:16.` },
  { name: "alley_07", title: "골목7: 부두 창고",
    scenePrompt: `${ILLUST}. A young fighter versus a tattooed dock worker inside dark warehouse. Shipping containers, dim industrial lights, oil stains. Full body. ${NO_UI}. Vertical 9:16.`,
    bgPrompt: `Same warehouse but empty, no characters. Containers, industrial lights, oil stains. ${NO_UI}. Vertical 9:16.` },
  { name: "alley_08", title: "골목8: 뒷골목",
    scenePrompt: `${ILLUST}. A young fighter versus a hooded mugger in extremely dark narrow alley. Dumpsters, fire escapes, flickering neon, graffiti. Full body. ${NO_UI}. Vertical 9:16.`,
    bgPrompt: `Same dark alley but empty, no characters. Dumpsters, fire escapes, neon, graffiti. ${NO_UI}. Vertical 9:16.` },
  { name: "alley_09", title: "골목9: 지하주차장",
    scenePrompt: `${ILLUST}. A young fighter versus a man in security uniform in underground parking garage. Concrete pillars, flickering fluorescent lights, oil stains. Full body. ${NO_UI}. Vertical 9:16.`,
    bgPrompt: `Same parking garage but empty, no characters. Pillars, fluorescent lights, shadows. ${NO_UI}. Vertical 9:16.` },
  { name: "alley_10", title: "골목10: 폐공장",
    scenePrompt: `${ILLUST}. A young fighter versus a huge factory brute in abandoned factory. Broken machinery, rusty beams, moonlight through shattered windows. Full body. ${NO_UI}. Vertical 9:16.`,
    bgPrompt: `Same abandoned factory but empty, no characters. Machinery, rusty beams, moonlight, debris. ${NO_UI}. Vertical 9:16.` },
  { name: "alley_11", title: "골목11: 조직 입구",
    scenePrompt: `${ILLUST}. A young fighter versus a man in black suit at organized crime entrance. Heavy metal door, dim red lighting, black cars. Full body. ${NO_UI}. Vertical 9:16.`,
    bgPrompt: `Same crime territory entrance but empty, no characters. Metal door, red lighting, black cars. ${NO_UI}. Vertical 9:16.` },
  { name: "alley_12", title: "골목12: 도박장",
    scenePrompt: `${ILLUST}. A young fighter versus a gambler in vest at underground gambling den. Green tables, dim lamps, smoke, cards. Full body. ${NO_UI}. Vertical 9:16.`,
    bgPrompt: `Same gambling den but empty, no characters. Green tables, hanging lamps, smoke, cards. ${NO_UI}. Vertical 9:16.` },
  { name: "alley_13", title: "골목13: 사채업",
    scenePrompt: `${ILLUST}. A young fighter versus a debt collector in suit at dark loan shark office. Fluorescent light, stacked money, concrete walls. Full body. ${NO_UI}. Vertical 9:16.`,
    bgPrompt: `Same loan shark office but empty, no characters. Fluorescent light, money, filing cabinets. ${NO_UI}. Vertical 9:16.` },
  { name: "alley_14", title: "골목14: 지하 클럽",
    scenePrompt: `${ILLUST}. A young fighter versus a club enforcer in all-black at underground nightclub. Purple blue neon, leather booths, smoke haze. Full body. ${NO_UI}. Vertical 9:16.`,
    bgPrompt: `Same underground club but empty, no characters. Neon lights, booths, smoke, speakers. ${NO_UI}. Vertical 9:16.` },
  { name: "alley_15", title: "골목15: 암흑가 경계",
    scenePrompt: `${ILLUST}. A young fighter versus a masked man at boundary between city and underworld. Chain-link fence, razor wire, graffiti, fog. Full body. ${NO_UI}. Vertical 9:16.`,
    bgPrompt: `Same boundary but empty, no characters. Chain fence, razor wire, graffiti, fog. ${NO_UI}. Vertical 9:16.` },
  { name: "alley_16", title: "골목16: 격투가의 거리",
    scenePrompt: `${ILLUST}. A young fighter versus an ex-boxer with tape on hands on rooftop arena. City skyline, spotlight, wind. Full body. ${NO_UI}. Vertical 9:16.`,
    bgPrompt: `Same rooftop arena but empty, no characters. City skyline, spotlight, concrete floor. ${NO_UI}. Vertical 9:16.` },
  { name: "alley_17", title: "골목17: 무술 도장가",
    scenePrompt: `${ILLUST}. A young fighter versus a martial arts master in white gi at ancient Korean dojo. Dark wood, calligraphy scrolls, incense, moonlight. Full body. ${NO_UI}. Vertical 9:16.`,
    bgPrompt: `Same dojo but empty, no characters. Dark wood, scrolls, incense smoke, moonlight. ${NO_UI}. Vertical 9:16.` },
  { name: "alley_18", title: "골목18: 용병 지대",
    scenePrompt: `${ILLUST}. A young fighter versus a soldier in tactical gear at military compound. Barbed wire, tents, weapon crates, searchlight. Full body. ${NO_UI}. Vertical 9:16.`,
    bgPrompt: `Same military compound but empty, no characters. Barbed wire, tents, crates, searchlight. ${NO_UI}. Vertical 9:16.` },
  { name: "alley_19", title: "골목19: 암흑가 본부",
    scenePrompt: `${ILLUST}. A young fighter versus a crime boss in expensive suit at dark penthouse. Floor-to-ceiling windows, city lights, dark furniture, red lighting. Full body. ${NO_UI}. Vertical 9:16.`,
    bgPrompt: `Same penthouse but empty, no characters. Windows, city lights, dark furniture, red accent. ${NO_UI}. Vertical 9:16.` },
  { name: "alley_20", title: "골목20: 최종 결전",
    scenePrompt: `${ILLUST}. A young fighter versus a legendary warrior in white gi on epic rooftop. Storm clouds, lightning, city far below, spotlight. Full body. ${NO_UI}. Vertical 9:16.`,
    bgPrompt: `Same epic rooftop but empty, no characters. Storm clouds, lightning, city below, spotlight. ${NO_UI}. Vertical 9:16.` },
  { name: "underground_arena", title: "지하 격투장",
    scenePrompt: `${ILLUST}. A young fighter versus a massive scarred fighter in underground cage arena. Concrete floor, single spotlight, crowd silhouettes, chain-link cage. Full body. ${NO_UI}. Vertical 9:16.`,
    bgPrompt: `Same underground arena but empty, no characters. Concrete octagon, spotlight, crowd silhouettes, cage walls. ${NO_UI}. Vertical 9:16.` },
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

  console.log(`🏙️ 배경 최종 생성 (씬+배경만, ${bgs.length}장 × 2 = ${bgs.length * 2}장)\n`);

  let generated = 0;

  for (const bg of bgs) {
    console.log(`\n📍 ${bg.title}`);

    const sceneRaw = `${OUTPUT_DIR}/scenes/${bg.name}_raw.png`;
    const scenePng = `${OUTPUT_DIR}/scenes/${bg.name}.png`;
    const bgRaw = `${OUTPUT_DIR}/bg_only/${bg.name}_raw.png`;
    const bgJpg = `${SPRITE_DIR}/${bg.name}.jpg`;
    const bgWebp = `${SPRITE_DIR}/${bg.name}.webp`;
    const sceneJpg = `${SPRITE_DIR}/${bg.name}_scene.jpg`;
    const sceneWebp = `${SPRITE_DIR}/${bg.name}_scene.webp`;

    // STEP 1: 씬 (캐릭터+배경) 생성
    if (!existsSync(scenePng)) {
      console.log(`  씬 생성...`);
      for (let a = 1; a <= 3; a++) {
        try {
          const buf = await gen(bg.scenePrompt, styleRefBase64);
          writeFileSync(sceneRaw, buf);
          await sharp(buf).resize(WIDTH, HEIGHT, { fit: "cover" }).png().toFile(scenePng);
          await sharp(buf).resize(WIDTH, HEIGHT, { fit: "cover" }).jpeg({ quality: 80 }).toFile(sceneJpg);
          await sharp(buf).resize(WIDTH, HEIGHT, { fit: "cover" }).webp({ quality: 80 }).toFile(sceneWebp);
          generated++;
          console.log(`  ✅ 씬`);
          break;
        } catch (e: any) {
          console.error(`  ⚠️ 씬 시도 ${a}: ${e.message}`);
          if (a < 3) await sleep(3000 * a);
        }
      }
      await sleep(1000);
    } else { generated++; console.log(`  ⏭️ 씬`); }

    // STEP 2: 배경만 (씬 참조로 캐릭터 없이)
    if (!existsSync(bgJpg)) {
      let sceneRef = styleRefBase64;
      if (existsSync(sceneRaw)) {
        sceneRef = readFileSync(sceneRaw).toString("base64");
      }

      console.log(`  배경만 생성...`);
      for (let a = 1; a <= 3; a++) {
        try {
          const buf = await gen(bg.bgPrompt, sceneRef);
          writeFileSync(bgRaw, buf);
          await sharp(buf).resize(WIDTH, HEIGHT, { fit: "cover" }).jpeg({ quality: 80 }).toFile(bgJpg);
          await sharp(buf).resize(WIDTH, HEIGHT, { fit: "cover" }).webp({ quality: 80 }).toFile(bgWebp);
          generated++;
          console.log(`  ✅ 배경`);
          break;
        } catch (e: any) {
          console.error(`  ⚠️ 배경 시도 ${a}: ${e.message}`);
          if (a < 3) await sleep(3000 * a);
        }
      }
      await sleep(1000);
    } else { generated++; console.log(`  ⏭️ 배경`); }
  }

  // 미리보기
  if (startIdx === 0 && endIdx >= BACKGROUNDS.length - 1) {
    console.log("\n📋 미리보기 생성...");
    const TW = 120, TH = 213, GAP = 3, LBL = 16, COLS = 6;
    const ROWS = Math.ceil(BACKGROUNDS.length / COLS);
    const prevW = COLS * (TW * 2 + GAP * 2) + (COLS - 1) * GAP * 2;
    // 심플하게: 씬과 배경 나란히
    const ROW_H = TH + LBL + GAP;
    const simpleW = BACKGROUNDS.length * (TW + GAP) - GAP;

    // 2행: 씬 / 배경만
    const pW = Math.min(BACKGROUNDS.length, 12) * (TW + GAP) - GAP;
    const rows2 = Math.ceil(BACKGROUNDS.length / 12);
    const pH = rows2 * 2 * (TH + LBL + GAP);
    const comp: sharp.OverlayOptions[] = [];

    for (let i = 0; i < BACKGROUNDS.length; i++) {
      const bg = BACKGROUNDS[i];
      const col = i % 12;
      const rowGroup = Math.floor(i / 12);
      const x = col * (TW + GAP);
      const yScene = rowGroup * 2 * (TH + LBL + GAP);
      const yBg = yScene + TH + LBL + GAP;

      // 씬
      const sp = `${OUTPUT_DIR}/scenes/${bg.name}.png`;
      if (existsSync(sp)) {
        comp.push({
          input: Buffer.from(`<svg width="${TW}" height="${LBL}"><text x="${TW/2}" y="12" text-anchor="middle" font-family="Arial" font-size="8" fill="#333">${bg.title}</text></svg>`),
          left: x, top: yScene,
        });
        const buf = await sharp(sp).resize(TW, TH, { fit: "cover" }).png().toBuffer();
        comp.push({ input: buf, left: x, top: yScene + LBL });
      }

      // 배경만
      const bp = `${SPRITE_DIR}/${bg.name}.jpg`;
      if (existsSync(bp)) {
        const buf = await sharp(bp).resize(TW, TH, { fit: "cover" }).png().toBuffer();
        comp.push({ input: buf, left: x, top: yBg + LBL });
        comp.push({
          input: Buffer.from(`<svg width="${TW}" height="${LBL}"><text x="${TW/2}" y="12" text-anchor="middle" font-family="Arial" font-size="8" fill="#999">bg only</text></svg>`),
          left: x, top: yBg,
        });
      }
    }

    if (comp.length > 0) {
      await sharp({
        create: { width: pW, height: pH, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
      }).composite(comp).png().toFile(`${OUTPUT_DIR}/preview_final.png`);
      console.log(`✅ preview_final.png`);
    }
  }

  console.log(`\n✅ 완료! ${generated}장`);
}

main().catch(e => { console.error("❌", e); process.exit(1); });
