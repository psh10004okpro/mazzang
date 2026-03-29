import sharp from "sharp";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { CONFIG } from "./config.js";

const OUTPUT_DIR = "./output/backgrounds";
const SPRITE_DIR = "./sprites/backgrounds";
const WIDTH = 750;
const HEIGHT = 1334;
const styleRefBase64 = readFileSync("./output/samples_v2/style_i.png").toString("base64");

mkdirSync(OUTPUT_DIR, { recursive: true });
mkdirSync(SPRITE_DIR, { recursive: true });

// 공통 스타일: 카툰/웹툰 배경 강조
const STYLE = "2D illustrated game background, Korean webtoon cartoon art style, bold outlines, cel-shaded coloring, stylized not photorealistic, mobile game backdrop";

interface BgDef {
  name: string;
  title: string;
  prompt: string;
}

const BACKGROUNDS: BgDef[] = [
  { name: "training_room", title: "수련장",
    prompt: `${STYLE}, dark Korean dojo interior, wooden floor, punching bags hanging, dim warm lighting, training equipment on walls, moody atmosphere. Vertical 9:16, bottom half is empty dark floor for characters. No characters no people.` },
  { name: "upgrade_shop", title: "강화소",
    prompt: `${STYLE}, underground workshop forge, anvil, glowing orange embers, dark metal walls with tools, sparks floating, warm fire glow. Vertical 9:16, bottom half empty dark floor. No characters no people.` },
  { name: "alley_01", title: "골목1: 주택가",
    prompt: `${STYLE}, dark narrow Korean residential back alley at night, old apartments, dim streetlight, graffiti on walls, wet pavement. Vertical 9:16, bottom area clear dark ground. No characters no people.` },
  { name: "alley_02", title: "골목2: 상가",
    prompt: `${STYLE}, dark Korean shopping street back alley at night, closed shop shutters with Korean signs, trash cans, flickering neon. Vertical 9:16, bottom area clear. No characters no people.` },
  { name: "alley_03", title: "골목3: 시장",
    prompt: `${STYLE}, dark Korean market alley at night, closed tent stalls, hanging fluorescent lights, wooden crates, wet floor. Vertical 9:16, bottom area clear. No characters no people.` },
  { name: "alley_04", title: "골목4: 유흥가",
    prompt: `${STYLE}, dark Korean entertainment district at night, colorful neon signs pink and blue, bar signs in Korean, foggy air, wet reflective street. Vertical 9:16, bottom area clear. No characters no people.` },
  { name: "alley_05", title: "골목5: 공사장",
    prompt: `${STYLE}, dark construction site at night, steel rebar piles, yellow warning tape, unfinished concrete, harsh work light, dust. Vertical 9:16, bottom area clear. No characters no people.` },
  { name: "alley_06", title: "골목6: 항구",
    prompt: `${STYLE}, dark harbor dock at night, wooden pier, fishing boats, moonlight on water, fog, ropes, distant lighthouse. Vertical 9:16, bottom area clear. No characters no people.` },
  { name: "alley_07", title: "골목7: 부두 창고",
    prompt: `${STYLE}, dark warehouse interior, stacked shipping containers, dim industrial lights, oil stains on floor. Vertical 9:16, bottom area clear. No characters no people.` },
  { name: "alley_08", title: "골목8: 뒷골목",
    prompt: `${STYLE}, extremely dark narrow back alley, dumpsters, fire escape ladders, flickering neon sign, graffiti everywhere, dangerous. Vertical 9:16, bottom area clear. No characters no people.` },
  { name: "alley_09", title: "골목9: 지하주차장",
    prompt: `${STYLE}, dark underground parking garage, concrete pillars, flickering fluorescent lights, oil stains, eerie shadows. Vertical 9:16, bottom area clear. No characters no people.` },
  { name: "alley_10", title: "골목10: 폐공장",
    prompt: `${STYLE}, abandoned dark factory, broken machinery, shattered windows with moonlight, rusty beams, debris. Vertical 9:16, bottom area clear. No characters no people.` },
  { name: "alley_11", title: "골목11: 조직 입구",
    prompt: `${STYLE}, dark organized crime territory, heavy metal door, dim red lighting, black luxury cars, surveillance cameras. Vertical 9:16, bottom area clear. No characters no people.` },
  { name: "alley_12", title: "골목12: 도박장",
    prompt: `${STYLE}, underground gambling den, green felt tables, dim hanging lamps with smoke, scattered cards, dark wood paneling. Vertical 9:16, bottom area clear. No characters no people.` },
  { name: "alley_13", title: "골목13: 사채업",
    prompt: `${STYLE}, dark loan shark office, cheap fluorescent light, stacked money, filing cabinets, concrete walls, oppressive. Vertical 9:16, bottom area clear. No characters no people.` },
  { name: "alley_14", title: "골목14: 지하 클럽",
    prompt: `${STYLE}, underground nightclub, purple and blue neon lights, leather booths, smoke haze, speaker stacks. Vertical 9:16, bottom area clear dark floor. No characters no people.` },
  { name: "alley_15", title: "골목15: 암흑가 경계",
    prompt: `${STYLE}, dark boundary with chain-link fence and razor wire, graffiti warning signs, one side lit one side dark, fog. Vertical 9:16, bottom area clear. No characters no people.` },
  { name: "alley_16", title: "골목16: 격투가의 거리",
    prompt: `${STYLE}, rooftop fighting arena at night, boxing ring ropes, city skyline background, dramatic spotlight, wind. Vertical 9:16, bottom area clear. No characters no people.` },
  { name: "alley_17", title: "골목17: 무술 도장가",
    prompt: `${STYLE}, ancient Korean martial arts dojo at night, dark wooden interior, calligraphy scrolls, incense smoke, moonlight through paper doors. Vertical 9:16, bottom area clear. No characters no people.` },
  { name: "alley_18", title: "골목18: 용병 지대",
    prompt: `${STYLE}, military compound at night, barbed wire, military tents, weapon crates, searchlight, mercenary camp. Vertical 9:16, bottom area clear. No characters no people.` },
  { name: "alley_19", title: "골목19: 암흑가 본부",
    prompt: `${STYLE}, dark luxurious crime boss penthouse, floor-to-ceiling windows showing city lights, dark furniture, red accent lighting. Vertical 9:16, bottom area clear. No characters no people.` },
  { name: "alley_20", title: "골목20: 최종 결전",
    prompt: `${STYLE}, epic rooftop arena on tallest building, dramatic storm clouds, lightning, city far below, single spotlight, final battle atmosphere. Vertical 9:16, bottom area clear. No characters no people.` },
  { name: "underground_arena", title: "지하 격투장",
    prompt: `${STYLE}, underground cage fight arena, concrete octagon, single harsh spotlight, blood stains on floor, crowd silhouettes in shadows, chain-link cage. Vertical 9:16, bottom area clear. No characters no people.` },
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

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  let generated = 0;

  console.log(`🏙️ 맞짱로 배경 에셋 재생성 (카툰 스타일, ${BACKGROUNDS.length}장)\n`);

  for (const bg of BACKGROUNDS) {
    const rawPath = `${OUTPUT_DIR}/${bg.name}_raw.png`;
    const jpgPath = `${SPRITE_DIR}/${bg.name}.jpg`;
    const webpPath = `${SPRITE_DIR}/${bg.name}.webp`;

    console.log(`🖼️ [${generated+1}/${BACKGROUNDS.length}] ${bg.title}...`);

    for (let a = 1; a <= 3; a++) {
      try {
        const buf = await gen(bg.prompt);
        writeFileSync(rawPath, buf);

        await sharp(buf).resize(WIDTH, HEIGHT, { fit: "cover" }).jpeg({ quality: 80 }).toFile(jpgPath);
        await sharp(buf).resize(WIDTH, HEIGHT, { fit: "cover" }).webp({ quality: 80 }).toFile(webpPath);

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

  // 미리보기
  console.log("\n📋 미리보기 생성...");
  const THUMB_W = 150, THUMB_H = 267, GAP = 4, LBL = 18, COLS = 6;
  const ROWS = Math.ceil(BACKGROUNDS.length / COLS);
  const prevW = COLS * (THUMB_W + GAP) - GAP;
  const prevH = ROWS * (THUMB_H + LBL + GAP) - GAP;
  const comp: sharp.OverlayOptions[] = [];

  for (let i = 0; i < BACKGROUNDS.length; i++) {
    const bg = BACKGROUNDS[i];
    const col = i % COLS, row = Math.floor(i / COLS);
    const x = col * (THUMB_W + GAP), y = row * (THUMB_H + LBL + GAP);
    comp.push({
      input: Buffer.from(`<svg width="${THUMB_W}" height="${LBL}"><text x="${THUMB_W/2}" y="13" text-anchor="middle" font-family="Arial,sans-serif" font-size="10" font-weight="bold" fill="#333">${bg.title}</text></svg>`),
      left: x, top: y,
    });
    if (existsSync(jpgPath)) {
      const buf = await sharp(`${SPRITE_DIR}/${bg.name}.jpg`)
        .resize(THUMB_W, THUMB_H, { fit: "cover" }).png().toBuffer();
      comp.push({ input: buf, left: x, top: y + LBL });
    }
  }

  await sharp({
    create: { width: prevW, height: prevH, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
  }).composite(comp).png().toFile(`${OUTPUT_DIR}/backgrounds_preview.png`);

  console.log(`\n✅ 완료! ${generated}/${BACKGROUNDS.length}장`);
}

main().catch(e => { console.error("❌", e); process.exit(1); });
