import sharp from "sharp";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { CONFIG } from "./config.js";
import OpenAI from "openai";

const OUTPUT_DIR = "./output/backgrounds";
const SPRITE_DIR = "./sprites/backgrounds";
const WIDTH = 750;
const HEIGHT = 1334;

mkdirSync(OUTPUT_DIR, { recursive: true });
mkdirSync(SPRITE_DIR, { recursive: true });

const client = new OpenAI({
  baseURL: CONFIG.API_BASE_URL,
  apiKey: CONFIG.API_KEY,
});

interface BgDef {
  name: string;
  title: string;
  prompt: string;
}

const BACKGROUNDS: BgDef[] = [
  // 수련장
  {
    name: "training_room",
    title: "수련장",
    prompt: "Dark traditional Korean dojo interior, wooden floor, punching bags hanging from ceiling, dim warm orange lighting, training equipment on walls, sweat-stained atmosphere, old scrolls on wall, moody shadows. Vertical mobile game background 9:16 ratio, bottom half is mostly empty dark floor for characters to stand on. No characters.",
  },
  // 강화소
  {
    name: "upgrade_shop",
    title: "강화소",
    prompt: "Underground blacksmith forge workshop, Korean traditional meets industrial, anvil in corner, glowing orange embers, dark metal walls with tools hanging, sparks floating in air, warm fire glow illuminating dark space. Vertical mobile game background 9:16 ratio, bottom half is mostly empty dark floor. No characters.",
  },
  // 골목 1~5: 동네~공사장
  {
    name: "alley_01",
    title: "골목1: 주택가",
    prompt: "Dark narrow Korean residential back alley at night, old apartment buildings on both sides, single dim streetlight, graffiti on brick walls, laundry hanging above, wet pavement reflecting light, moody urban atmosphere. Vertical 9:16 ratio, bottom area is clear dark ground. No characters.",
  },
  {
    name: "alley_02",
    title: "골목2: 상가",
    prompt: "Dark Korean shopping street back alley at night, closed shop shutters with Korean signs, overflowing trash cans, flickering neon light, puddles on ground, rats scurrying, gritty commercial district. Vertical 9:16 ratio, bottom area clear dark ground. No characters.",
  },
  {
    name: "alley_03",
    title: "골목3: 시장",
    prompt: "Dark Korean traditional market alley at night, closed tent stalls, hanging fluorescent tube lights some broken, wooden crates stacked, fish market smell atmosphere, wet concrete floor. Vertical 9:16 ratio, bottom area clear. No characters.",
  },
  {
    name: "alley_04",
    title: "골목4: 유흥가",
    prompt: "Dark Korean entertainment district alley at night, colorful neon signs glowing pink and blue, beer bar signs in Korean, karaoke signs, foggy air, wet reflective street, adult nightlife atmosphere. Vertical 9:16 ratio, bottom area clear dark ground. No characters.",
  },
  {
    name: "alley_05",
    title: "골목5: 공사장",
    prompt: "Dark construction site at night, steel rebar piles, yellow warning tape, unfinished concrete walls, single harsh work light, dust in air, crane silhouette above, industrial danger atmosphere. Vertical 9:16 ratio, bottom area clear dark ground. No characters.",
  },
  // 골목 6~10: 항구/부두
  {
    name: "alley_06",
    title: "골목6: 항구",
    prompt: "Dark harbor dock at night, wooden pier, moored fishing boats, moonlight reflecting on dark water, rope coils, fog rolling in, distant lighthouse, salty maritime atmosphere. Vertical 9:16 ratio, bottom area clear dark ground. No characters.",
  },
  {
    name: "alley_07",
    title: "골목7: 부두 창고",
    prompt: "Dark warehouse interior at harbor, stacked shipping containers, dim overhead industrial lights, oil stains on concrete floor, forklift parked, smuggling den atmosphere. Vertical 9:16 ratio, bottom area clear. No characters.",
  },
  {
    name: "alley_08",
    title: "골목8: 뒷골목",
    prompt: "Extremely dark narrow back alley, barely any light, dumpsters overflowing, fire escape ladders above, single flickering neon sign, dangerous criminal territory atmosphere, graffiti everywhere. Vertical 9:16 ratio, bottom area clear. No characters.",
  },
  {
    name: "alley_09",
    title: "골목9: 지하주차장",
    prompt: "Dark underground parking garage, concrete pillars, flickering fluorescent lights, car headlights casting shadows, oil stains, empty parking spots, echoing eerie atmosphere. Vertical 9:16 ratio, bottom area clear dark ground. No characters.",
  },
  {
    name: "alley_10",
    title: "골목10: 폐공장",
    prompt: "Abandoned dark factory interior at night, broken machinery, shattered windows with moonlight streaming in, rusty metal beams, debris on floor, industrial wasteland atmosphere. Vertical 9:16 ratio, bottom area clear. No characters.",
  },
  // 골목 11~15: 지하세계
  {
    name: "alley_11",
    title: "골목11: 조직 입구",
    prompt: "Dark organized crime territory entrance, heavy metal door ajar, dim red lighting inside, black luxury cars parked, surveillance cameras, yakuza-style office building, intimidating atmosphere. Vertical 9:16 ratio, bottom area clear. No characters.",
  },
  {
    name: "alley_12",
    title: "골목12: 도박장",
    prompt: "Underground illegal gambling den, green felt tables, dim hanging lamps with smoke, scattered cards and chips, dark wood paneling, secretive criminal atmosphere. Vertical 9:16 ratio, bottom area clear. No characters.",
  },
  {
    name: "alley_13",
    title: "골목13: 사채업",
    prompt: "Dark loan shark office back room, cheap fluorescent light, stacked money, filing cabinets, intimidating bare concrete walls, single desk with lamp, oppressive debt collector atmosphere. Vertical 9:16 ratio, bottom area clear. No characters.",
  },
  {
    name: "alley_14",
    title: "골목14: 지하 클럽",
    prompt: "Underground nightclub VIP area, purple and blue neon lights, leather booths, smoke machine haze, DJ booth in background, bass speaker stacks, exclusive criminal underworld club. Vertical 9:16 ratio, bottom area clear dark floor. No characters.",
  },
  {
    name: "alley_15",
    title: "골목15: 암흑가 경계",
    prompt: "Dark boundary between normal city and criminal underworld, chain-link fence with razor wire, graffiti warning signs, one side lit one side dark, point of no return atmosphere, fog. Vertical 9:16 ratio, bottom area clear. No characters.",
  },
  // 골목 16~20: 최강자
  {
    name: "alley_16",
    title: "골목16: 격투가의 거리",
    prompt: "Rooftop fighting arena at night, boxing ring ropes, city skyline in background, dramatic spotlight from above, wind blowing, concrete rooftop floor, legendary fighter atmosphere. Vertical 9:16 ratio, bottom area clear. No characters.",
  },
  {
    name: "alley_17",
    title: "골목17: 무술 도장가",
    prompt: "Ancient Korean martial arts dojo at night, dark wooden interior, hanging scrolls with calligraphy, incense smoke, moonlight through paper doors, sacred training ground atmosphere. Vertical 9:16 ratio, bottom area clear dark floor. No characters.",
  },
  {
    name: "alley_18",
    title: "골목18: 용병 지대",
    prompt: "Military compound at night, barbed wire, military tents, weapon crates, camouflage netting, harsh searchlight, mercenary base camp atmosphere, war zone feeling. Vertical 9:16 ratio, bottom area clear. No characters.",
  },
  {
    name: "alley_19",
    title: "골목19: 암흑가 본부",
    prompt: "Dark luxurious crime boss penthouse, floor-to-ceiling windows showing city lights, expensive dark furniture, red accent lighting, power and darkness atmosphere, throne-like chair. Vertical 9:16 ratio, bottom area clear dark floor. No characters.",
  },
  {
    name: "alley_20",
    title: "골목20: 최종 결전",
    prompt: "Epic rooftop arena on tallest building, dramatic storm clouds, lightning in sky, city far below, wind whipping, single spotlight, final battle legendary atmosphere, destiny awaits. Vertical 9:16 ratio, bottom area clear. No characters.",
  },
  // 지하 격투장
  {
    name: "underground_arena",
    title: "지하 격투장",
    prompt: "Underground cage fight arena, concrete octagon walls, single harsh spotlight from above, blood stains on cracked concrete floor, crowd silhouettes in deep shadows cheering, chain-link cage walls, smoke and sweat atmosphere, ultimate underground fighting pit. Vertical 9:16 ratio, bottom area clear for fighters. No characters.",
  },
];

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const totalBgs = BACKGROUNDS.length;
  let generated = 0;
  let skipped = 0;

  console.log(`🏙️ 맞짱로 배경 에셋 생성 (${totalBgs}장)\n`);

  for (const bg of BACKGROUNDS) {
    const rawPath = `${OUTPUT_DIR}/${bg.name}_raw.png`;
    const jpgPath = `${SPRITE_DIR}/${bg.name}.jpg`;
    const webpPath = `${SPRITE_DIR}/${bg.name}.webp`;

    if (existsSync(jpgPath)) {
      skipped++;
      generated++;
      console.log(`⏭️ ${bg.title} (이미 존재)`);
      continue;
    }

    console.log(`🖼️ [${generated + 1}/${totalBgs}] ${bg.title}...`);

    for (let a = 1; a <= 3; a++) {
      try {
        const response = await client.images.generate({
          model: CONFIG.MODEL,
          prompt: bg.prompt,
          n: 1,
          size: "1024x1024",
        });

        const data = response.data[0];
        let buf: Buffer;
        if (data.b64_json) {
          buf = Buffer.from(data.b64_json, "base64");
        } else if (data.url) {
          const res = await fetch(data.url);
          buf = Buffer.from(await res.arrayBuffer());
        } else {
          throw new Error("no image data");
        }

        // raw 저장
        writeFileSync(rawPath, buf);

        // 750x1334 리사이즈 (9:16) + JPEG
        await sharp(buf)
          .resize(WIDTH, HEIGHT, { fit: "cover" })
          .jpeg({ quality: 80 })
          .toFile(jpgPath);

        // WebP
        await sharp(buf)
          .resize(WIDTH, HEIGHT, { fit: "cover" })
          .webp({ quality: 80 })
          .toFile(webpPath);

        generated++;
        console.log(`  ✅ ${bg.name} [${generated}/${totalBgs}]`);
        break;
      } catch (e: any) {
        console.error(`  ⚠️ 시도 ${a}/3: ${e.message}`);
        if (a < 3) await sleep(3000 * a);
      }
    }
    await sleep(1000);
  }

  // ── 미리보기 (4열 그리드) ──
  console.log("\n📋 미리보기 생성...");
  const THUMB_W = 150, THUMB_H = 267, GAP = 4, LBL = 18;
  const COLS = 6;
  const ROWS = Math.ceil(BACKGROUNDS.length / COLS);
  const prevW = COLS * (THUMB_W + GAP) - GAP;
  const prevH = ROWS * (THUMB_H + LBL + GAP) - GAP;
  const prevComp: sharp.OverlayOptions[] = [];

  for (let i = 0; i < BACKGROUNDS.length; i++) {
    const bg = BACKGROUNDS[i];
    const col = i % COLS, row = Math.floor(i / COLS);
    const x = col * (THUMB_W + GAP), y = row * (THUMB_H + LBL + GAP);

    prevComp.push({
      input: Buffer.from(`<svg width="${THUMB_W}" height="${LBL}"><text x="${THUMB_W/2}" y="13" text-anchor="middle" font-family="Arial,sans-serif" font-size="10" font-weight="bold" fill="#333">${bg.title}</text></svg>`),
      left: x, top: y,
    });

    const jpgPath = `${SPRITE_DIR}/${bg.name}.jpg`;
    if (existsSync(jpgPath)) {
      const buf = await sharp(jpgPath)
        .resize(THUMB_W, THUMB_H, { fit: "cover" })
        .png().toBuffer();
      prevComp.push({ input: buf, left: x, top: y + LBL });
    }
  }

  const prevPath = `${OUTPUT_DIR}/backgrounds_preview.png`;
  await sharp({
    create: { width: prevW, height: prevH, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
  }).composite(prevComp).png().toFile(prevPath);
  console.log(`✅ ${prevPath}`);

  console.log(`\n✅ 완료! 생성 ${generated - skipped}장, 스킵 ${skipped}장, 총 ${generated}/${totalBgs}장`);
}

main().catch(e => { console.error("❌", e); process.exit(1); });
