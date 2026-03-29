import sharp from "sharp";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { CONFIG, IMG2IMG_SUFFIX, PUNCH_SUFFIX } from "./config.js";

const FRAME_SIZE = 512;
const OUTPUT_DIR = "./output/equipment";
const SPRITE_DIR = "./sprites/equipment";
const styleRefBase64 = readFileSync("./output/samples_v2/style_i.png").toString("base64");
// 왼손 펀치 참조 (3/4 뷰)
const punchLeftRefBase64 = readFileSync("./output/player_final/punch_left/attempt_8.png").toString("base64");

mkdirSync(OUTPUT_DIR, { recursive: true });
mkdirSync(SPRITE_DIR, { recursive: true });

interface Outfit {
  num: number;
  name: string;
  title: string;
  desc: string;
}

const OUTFITS: Outfit[] = [
  { num: 1, name: "bare_trainee", title: "맨몸 수련생",
    desc: "Korean young man, white sleeveless tank top, dark training pants, bare fists, beginner fighter, simple humble look" },
  { num: 2, name: "street_scrapper", title: "동네 싸움꾼",
    desc: "Korean young man, black sleeveless shirt, dark pants, white bandage wraps on both hands, tougher look, street-hardened" },
  { num: 3, name: "alley_fighter", title: "골목 파이터",
    desc: "Korean young man, dark gray hoodie with sleeves pushed up, brown leather fighting gloves, confident stance, experienced" },
  { num: 4, name: "street_fist", title: "거리의 주먹",
    desc: "Korean young man, torn denim jacket open over tank top, heavy tape wrapping on both fists, battle scars, dangerous aura" },
  { num: 5, name: "amateur_boxer", title: "아마추어 복서",
    desc: "Korean young man, red boxing tank top, red boxing gloves, boxing shorts, athletic build, trained fighter look" },
  { num: 6, name: "dojo_student", title: "도장 수련생",
    desc: "Korean young man, white martial arts gi with black belt, barefoot, disciplined stance, traditional martial artist" },
  { num: 7, name: "street_warrior", title: "스트릿 워리어",
    desc: "Korean young man, olive military tactical vest over black shirt, MMA fingerless gloves, combat pants, boots, soldier-fighter hybrid" },
  { num: 8, name: "wulin_disciple", title: "무림 제자",
    desc: "Korean young man, traditional Chinese-style dark blue martial arts uniform, cloth-wrapped fists, kung fu stance, inner power aura" },
  { num: 9, name: "iron_fist", title: "철권 파이터",
    desc: "Korean young man, black leather biker jacket open, steel brass knuckles on both hands, chain necklace, hardcore fighter" },
  { num: 10, name: "pit_fighter", title: "지하 투사",
    desc: "Korean young man, torn martial arts gi top hanging at waist, bare scarred torso wrapped in tape, scars everywhere, underground champion" },
  { num: 11, name: "fight_champion", title: "격투 챔피언",
    desc: "Korean young man, shiny championship belt around waist, sparkling boxing trunks, champion robe draped on shoulders, victory aura" },
  { num: 12, name: "golden_warrior", title: "황금 전사",
    desc: "Korean young man, gold-colored fighting gloves, gold-trimmed outfit, gold chain, flashy golden warrior aesthetic, luxury fighter" },
  { num: 13, name: "dark_boss", title: "암흑가 보스",
    desc: "Korean young man, all-black tailored suit with rolled sleeves, black leather gloves, dark sunglasses, crime boss fighter aura" },
  { num: 14, name: "dragon_disciple", title: "용의 제자",
    desc: "Korean young man, red martial arts uniform with golden dragon embroidery, dragon pattern wrapping around body, mystical warrior" },
  { num: 15, name: "storm_fist", title: "폭풍의 주먹",
    desc: "Korean young man, electric blue lightning crackling around both fists, torn shirt, wind-blown hair, storm energy surrounding hands" },
  { num: 16, name: "flame_fighter", title: "불꽃 투사",
    desc: "Korean young man, red-orange flame aura surrounding body, fire effects on fists, dark clothes with ember patterns, burning warrior" },
  { num: 17, name: "legendary_martial", title: "전설의 무인",
    desc: "Korean young man, pristine white martial arts gi, dark swirling aura around body, wind effect blowing clothes, legendary master presence" },
  { num: 18, name: "mythic_king", title: "신화의 권왕",
    desc: "Korean young man, golden armor-like outfit with ornate details, crown-like headband, radiant golden glow, mythical warrior king" },
  { num: 19, name: "transcendent", title: "초월자",
    desc: "Korean young man, semi-transparent ethereal aura, glowing bright eyes, floating energy particles, clothes rippling with power, transcended human form" },
  { num: 20, name: "god_of_streets", title: "골목의 신",
    desc: "Korean young man, pure white flowing martial arts robes, blinding white aura radiating outward, serene godlike expression, ultimate final form, divine power" },
];

// 6포즈 정의
const POSES = [
  { name: "idle", promptFn: (desc: string) =>
    `This exact same art style. ${desc}. Fighting stance with fists up, ready to fight. ${IMG2IMG_SUFFIX}` },
  { name: "punch_left", promptFn: (desc: string) =>
    `This exact same character in the same pose angle. ${desc}. Punching forward with one fist extended, other fist guards chin. ${PUNCH_SUFFIX} ${IMG2IMG_SUFFIX}` },
  { name: "punch_right", promptFn: (desc: string) =>
    `This exact same character. ${desc}. Throwing a punch forward with fist extended and speed lines, other hand guarding. ${PUNCH_SUFFIX} ${IMG2IMG_SUFFIX}` },
  { name: "kick", promptFn: (desc: string) =>
    `This exact same character. ${desc}. Executing a high kick with leg extended, arms spread for balance. Only two legs. ${IMG2IMG_SUFFIX}` },
  { name: "hit", promptFn: (desc: string) =>
    `This exact same character. ${desc}. Getting punched, head snapping back, pain expression, staggering. ${IMG2IMG_SUFFIX}` },
  { name: "victory", promptFn: (desc: string) =>
    `This exact same character. ${desc}. Victory pose, one fist pumped up in the air, triumphant grin. ${IMG2IMG_SUFFIX}` },
];

// ─── 유틸 ─────────────────────────────────────────────────

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

// ─── 메인 ─────────────────────────────────────────────────

async function main() {
  const startNum = parseInt(process.argv[2] || "1");
  const endNum = parseInt(process.argv[3] || "20");

  const outfits = OUTFITS.filter(o => o.num >= startNum && o.num <= endNum);
  const totalFrames = outfits.length * POSES.length;
  let generated = 0;
  let skipped = 0;

  console.log(`👔 맞짱로 장비 외형 에셋 생성 (${startNum}~${endNum})`);
  console.log(`   ${outfits.length}외형 × ${POSES.length}포즈 = ${totalFrames}장\n`);

  for (const outfit of outfits) {
    const outDir = `${OUTPUT_DIR}/outfit${String(outfit.num).padStart(2,"0")}_${outfit.name}`;
    mkdirSync(outDir, { recursive: true });

    console.log(`\n${"═".repeat(50)}`);
    console.log(`👔 #${outfit.num} ${outfit.title} (${outfit.name})`);
    console.log(`${"═".repeat(50)}`);

    // idle 먼저 (style_i 참조)
    const idleRawPath = `${outDir}/idle_raw.png`;
    const idlePath = `${outDir}/idle.png`;

    if (!existsSync(idlePath)) {
      const prompt = POSES[0].promptFn(outfit.desc);
      for (let a = 1; a <= 3; a++) {
        try {
          const raw = await gen(prompt, styleRefBase64);
          writeFileSync(idleRawPath, raw);
          const resized = await sharp(await removeBg(raw))
            .resize(FRAME_SIZE, FRAME_SIZE, { fit: "contain", background: {r:0,g:0,b:0,alpha:0} })
            .png().toBuffer();
          writeFileSync(idlePath, resized);
          generated++;
          console.log(`  ✅ idle [${generated}/${totalFrames}]`);
          break;
        } catch (e: any) {
          console.error(`  ⚠️ idle 시도 ${a}: ${e.message}`);
          if (a < 3) await sleep(3000 * a);
        }
      }
      await sleep(1000);
    } else { skipped++; generated++; console.log(`  ⏭️ idle`); }

    // idle_raw를 참조로 나머지 포즈
    let idleRef = styleRefBase64;
    if (existsSync(idleRawPath)) {
      idleRef = readFileSync(idleRawPath).toString("base64");
    }

    for (let p = 1; p < POSES.length; p++) {
      const pose = POSES[p];
      const rawPath = `${outDir}/${pose.name}_raw.png`;
      const framePath = `${outDir}/${pose.name}.png`;

      if (existsSync(framePath)) {
        skipped++; generated++;
        console.log(`  ⏭️ ${pose.name}`);
        continue;
      }

      // punch_left는 왼손 펀치 참조 사용
      const ref = pose.name === "punch_left" ? punchLeftRefBase64 : idleRef;
      const prompt = pose.promptFn(outfit.desc);

      for (let a = 1; a <= 3; a++) {
        try {
          const raw = await gen(prompt, ref);
          writeFileSync(rawPath, raw);
          const resized = await sharp(await removeBg(raw))
            .resize(FRAME_SIZE, FRAME_SIZE, { fit: "contain", background: {r:0,g:0,b:0,alpha:0} })
            .png().toBuffer();
          writeFileSync(framePath, resized);
          generated++;
          console.log(`  ✅ ${pose.name} [${generated}/${totalFrames}]`);
          break;
        } catch (e: any) {
          console.error(`  ⚠️ ${pose.name} 시도 ${a}: ${e.message}`);
          if (a < 3) await sleep(3000 * a);
        }
      }
      await sleep(1000);
    }

    // 외형별 스프라이트 시트 (6포즈 가로)
    const comp: sharp.OverlayOptions[] = [];
    let col = 0;
    for (const pose of POSES) {
      const fp = `${outDir}/${pose.name}.png`;
      if (existsSync(fp)) {
        comp.push({ input: readFileSync(fp), left: col * FRAME_SIZE, top: 0 });
        col++;
      }
    }
    if (comp.length > 0) {
      const sheetPath = `${SPRITE_DIR}/outfit${String(outfit.num).padStart(2,"0")}_${outfit.name}.png`;
      await sharp({
        create: { width: FRAME_SIZE * col, height: FRAME_SIZE, channels: 4, background: {r:0,g:0,b:0,alpha:0} },
      }).composite(comp).png().toFile(sheetPath);
      await sharp(sheetPath).webp({ quality: 90 }).toFile(sheetPath.replace(".png", ".webp"));
    }
  }

  // ── 카탈로그 (idle 모아보기, 5×4) ──
  if (startNum === 1 && endNum === 20) {
    console.log("\n📋 외형 카탈로그 생성...");
    const THUMB = 200, GAP = 4, LBL = 22, COLS = 5;
    const ROWS = Math.ceil(OUTFITS.length / COLS);
    const catW = COLS * (THUMB + GAP) - GAP;
    const catH = ROWS * (THUMB + LBL + GAP) - GAP;
    const catComp: sharp.OverlayOptions[] = [];

    for (let i = 0; i < OUTFITS.length; i++) {
      const o = OUTFITS[i];
      const col = i % COLS, row = Math.floor(i / COLS);
      const x = col * (THUMB + GAP), y = row * (THUMB + LBL + GAP);

      catComp.push({
        input: Buffer.from(`<svg width="${THUMB}" height="${LBL}"><text x="${THUMB/2}" y="16" text-anchor="middle" font-family="Arial,sans-serif" font-size="11" font-weight="bold" fill="#333">${o.num}. ${o.title}</text></svg>`),
        left: x, top: y,
      });

      const fp = `${OUTPUT_DIR}/outfit${String(o.num).padStart(2,"0")}_${o.name}/idle.png`;
      if (existsSync(fp)) {
        const buf = await sharp(fp)
          .resize(THUMB, THUMB, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } })
          .png().toBuffer();
        catComp.push({ input: buf, left: x, top: y + LBL });
      }
    }

    const catPath = `${SPRITE_DIR}/equipment_catalog.png`;
    await sharp({
      create: { width: catW, height: catH, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
    }).composite(catComp).png().toFile(catPath);
    console.log(`  ✅ ${catPath}`);
  }

  console.log(`\n✅ 완료! 생성 ${generated - skipped}장, 스킵 ${skipped}장, 총 ${generated}/${totalFrames}장`);
}

main().catch(e => { console.error("❌", e); process.exit(1); });
