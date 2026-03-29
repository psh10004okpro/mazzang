import sharp from "sharp";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { CONFIG, IMG2IMG_SUFFIX, PUNCH_SUFFIX } from "./config.js";

const FRAME_SIZE = 512;
const OUTPUT_DIR = "./output/bosses";
const SPRITE_DIR = "./sprites/bosses";
const styleRefBase64 = readFileSync("./output/samples_v2/style_i.png").toString("base64");

mkdirSync(OUTPUT_DIR, { recursive: true });
mkdirSync(SPRITE_DIR, { recursive: true });

// ─── 보스 정의 ────────────────────────────────────────────

interface Boss {
  num: number;
  name: string;
  title: string;
  desc: string;
  attackDesc: string;
}

const BOSSES: Boss[] = [
  { num: 1, name: "alley_captain", title: "골목 대장",
    desc: "teenage gang leader in torn school uniform with military-style student cap, scar on cheek, cocky arrogant expression, lean but tough build",
    attackDesc: "throwing a wild haymaker punch with full body rotation" },
  { num: 2, name: "shop_owner", title: "상가 터줏대감",
    desc: "burly middle-aged man in stained apron over tank top, tattoo sleeves on both arms, thick neck, intimidating shop owner build",
    attackDesc: "grabbing forward with massive hands, bear-hug attack pose" },
  { num: 3, name: "market_dragon", title: "시장 용왕",
    desc: "huge man with fish-scale pattern tattoo on arms, thick powerful forearms, wet tank top, market boss with fearsome reputation look",
    attackDesc: "swinging a powerful overhand strike downward, crushing blow" },
  { num: 4, name: "nightlife_boss", title: "유흥가 사장",
    desc: "slick man with gelled-back hair in expensive dark suit, gold tooth glinting, cigar in mouth, rings on every finger, boss aura",
    attackDesc: "delivering a backhanded slap with ringed hand, dismissive powerful strike" },
  { num: 5, name: "iron_worker", title: "공사장 철인",
    desc: "massive man in hard hat and torn work coveralls, arms like steel rebar, cement dust on skin, industrial strength build",
    attackDesc: "throwing a devastating straight punch with concrete-hardened fist" },
  { num: 6, name: "harbor_wave", title: "부두 파도",
    desc: "giant man in captain hat and open naval coat, anchor tattoo across chest, enormous build, weathered sea-tough face",
    attackDesc: "delivering a crushing two-handed overhead smash, tsunami force" },
  { num: 7, name: "port_ruler", title: "항만 지배자",
    desc: "tall imposing man in long dark coat blowing in wind, standing with absolute authority, dock master presence, cold commanding eyes",
    attackDesc: "throwing a precise powerful straight kick, calculated strike" },
  { num: 8, name: "neon_king", title: "밤거리 왕",
    desc: "stylish man with sunglasses reflecting light, both fists taped heavily, open leather jacket showing muscular chest, nightlife ruler vibe",
    attackDesc: "throwing rapid one-two combination punches, speed and power" },
  { num: 9, name: "shadow", title: "쉐도우",
    desc: "thin man in deep hood covering face, only glowing eyes visible, lean assassin build, dark wrappings on hands, ghost-like presence",
    attackDesc: "striking from a low stance with a quick jab, snake-like attack" },
  { num: 10, name: "mad_bear", title: "난폭한 곰",
    desc: "enormous muscular man with bear tattoo covering entire back, brass knuckles on both hands, wild untamed hair, berserker eyes",
    attackDesc: "charging forward with a massive shoulder tackle, unstoppable force" },
  { num: 11, name: "blade_wind", title: "칼바람",
    desc: "tall man in long trenchcoat, sharp narrow eyes, long scar diagonally across entire face, silver hair, blade-like presence",
    attackDesc: "slashing forward with knife-hand strike, cutting wind motion lines" },
  { num: 12, name: "golden_teeth", title: "황금 이빨",
    desc: "flashy man covered in gold accessories, gold sunglasses, gold rings, gold chain, wide menacing grin showing gold teeth, gaudy suit",
    attackDesc: "throwing a flashy spinning backfist, showoff fighting style" },
  { num: 13, name: "pit_fighter", title: "지하 투사",
    desc: "battle-scarred man in torn martial arts gi, scars covering entire body, warrior eyes, bandaged torso, underground champion presence",
    attackDesc: "executing a devastating flying knee strike, all-out attack" },
  { num: 14, name: "chain_master", title: "사슬",
    desc: "bald muscular man with chains wrapped around both arms, dragon tattoo covering entire back, prison-hardened build, dead cold stare",
    attackDesc: "swinging chain-wrapped fist in a wide arc, chain whip attack" },
  { num: 15, name: "silent_giant", title: "침묵의 거인",
    desc: "extremely tall 2-meter man in suit bursting at seams from massive muscles, expressionless face, towering over everyone, quiet menace",
    attackDesc: "bringing down a colossal hammer fist from above, earth-shattering blow" },
  { num: 16, name: "ex_champion", title: "전직 챔피언",
    desc: "middle-aged muscular man with faded boxing tape marks on hands, championship belt around waist, retired legend aura, weathered but deadly",
    attackDesc: "throwing a perfect textbook boxing cross, champion-level technique" },
  { num: 17, name: "martial_sage", title: "무림 도사",
    desc: "elderly man in traditional martial arts robe, long white beard, thin squinting eyes, taeguk symbol on chest, calm overwhelming power",
    attackDesc: "executing an open palm strike with chi energy lines radiating outward" },
  { num: 18, name: "merc_captain", title: "용병 대장",
    desc: "imposing man in military tactical gear, black beret, knife scars across face and arms, dog tags, cigar, special forces commander presence",
    attackDesc: "delivering a brutal military combat elbow strike, efficient and lethal" },
  { num: 19, name: "dark_lord", title: "어둠의 왕",
    desc: "terrifying man in all-black with glowing red eyes, shadow-like aura surrounding body, final boss level intimidation, absolute darkness presence",
    attackDesc: "throwing a darkness-infused punch with dark energy trailing behind fist" },
  { num: 20, name: "street_legend", title: "골목의 전설",
    desc: "serene powerful man in white martial arts gi, bare fists, quiet overwhelming charisma, ultimate street fighter, eyes of a true master, legendary aura",
    attackDesc: "delivering a single perfect straight punch, ultimate technique, absolute power in simplicity" },
];

// ─── API + 유틸 ───────────────────────────────────────────

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
    const r = px[idx*4], g = px[idx*4+1], b = px[idx*4+2];
    return Math.sqrt((r-255)**2 + (g-255)**2 + (b-255)**2) <= threshold;
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
  const startBoss = parseInt(process.argv[2] || "1");
  const endBoss = parseInt(process.argv[3] || "20");

  const bosses = BOSSES.filter(b => b.num >= startBoss && b.num <= endBoss);
  const totalFrames = bosses.length * 3;
  let generated = 0;
  let skipped = 0;

  console.log(`🥊 맞짱로 보스 에셋 생성 (보스 ${startBoss}~${endBoss})`);
  console.log(`   ${bosses.length}보스 × 3포즈 = ${totalFrames}장\n`);

  for (const boss of bosses) {
    const bossDir = `${OUTPUT_DIR}/boss${boss.num}_${boss.name}`;
    mkdirSync(bossDir, { recursive: true });

    console.log(`\n${"═".repeat(50)}`);
    console.log(`👑 보스 ${boss.num}: ${boss.title} (${boss.name})`);
    console.log(`${"═".repeat(50)}`);

    const idleRawPath = `${bossDir}/idle_raw.png`;
    const idlePath = `${bossDir}/idle.png`;
    const attackRawPath = `${bossDir}/attack_raw.png`;
    const attackPath = `${bossDir}/attack.png`;
    const defeatRawPath = `${bossDir}/defeat_raw.png`;
    const defeatPath = `${bossDir}/defeat.png`;

    // ── idle (style_i 참조) ──
    if (!existsSync(idlePath)) {
      const prompt = `This exact same art style but a BOSS enemy character, larger and more imposing. ${boss.desc}. Standing with intimidating presence, ready to fight, facing left. Do not crop, show full body head to feet. White background. Single character.`;
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
          console.error(`  ⚠️ idle 시도 ${a}/3: ${e.message}`);
          if (a < 3) await sleep(3000 * a);
        }
      }
      await sleep(1000);
    } else { skipped++; generated++; console.log(`  ⏭️ idle`); }

    // idle_raw를 참조로 attack/defeat 생성
    let bossRef = styleRefBase64;
    if (existsSync(idleRawPath)) {
      bossRef = readFileSync(idleRawPath).toString("base64");
    }

    // ── attack (idle 참조) ──
    if (!existsSync(attackPath)) {
      const prompt = `This exact same character. ${boss.attackDesc}. Powerful attack pose, facing left. Do not crop, show full body head to feet. White background. Single character.`;
      for (let a = 1; a <= 3; a++) {
        try {
          const raw = await gen(prompt, bossRef);
          writeFileSync(attackRawPath, raw);
          const resized = await sharp(await removeBg(raw))
            .resize(FRAME_SIZE, FRAME_SIZE, { fit: "contain", background: {r:0,g:0,b:0,alpha:0} })
            .png().toBuffer();
          writeFileSync(attackPath, resized);
          generated++;
          console.log(`  ✅ attack [${generated}/${totalFrames}]`);
          break;
        } catch (e: any) {
          console.error(`  ⚠️ attack 시도 ${a}/3: ${e.message}`);
          if (a < 3) await sleep(3000 * a);
        }
      }
      await sleep(1000);
    } else { skipped++; generated++; console.log(`  ⏭️ attack`); }

    // ── defeat (idle 참조) ──
    if (!existsSync(defeatPath)) {
      const prompt = `This exact same character. Defeated, falling to one knee, exhausted, bruised and beaten, pain expression but still defiant look. Do not crop, show full body head to feet. White background. Single character.`;
      for (let a = 1; a <= 3; a++) {
        try {
          const raw = await gen(prompt, bossRef);
          writeFileSync(defeatRawPath, raw);
          const resized = await sharp(await removeBg(raw))
            .resize(FRAME_SIZE, FRAME_SIZE, { fit: "contain", background: {r:0,g:0,b:0,alpha:0} })
            .png().toBuffer();
          writeFileSync(defeatPath, resized);
          generated++;
          console.log(`  ✅ defeat [${generated}/${totalFrames}]`);
          break;
        } catch (e: any) {
          console.error(`  ⚠️ defeat 시도 ${a}/3: ${e.message}`);
          if (a < 3) await sleep(3000 * a);
        }
      }
      await sleep(1000);
    } else { skipped++; generated++; console.log(`  ⏭️ defeat`); }

    // ── 보스별 스프라이트 시트 (3포즈) ──
    const poses = ["idle", "attack", "defeat"];
    const comp: sharp.OverlayOptions[] = [];
    let col = 0;
    for (const pose of poses) {
      const fp = `${bossDir}/${pose}.png`;
      if (existsSync(fp)) {
        comp.push({ input: readFileSync(fp), left: col * FRAME_SIZE, top: 0 });
        col++;
      }
    }
    if (comp.length > 0) {
      const sheetPath = `${SPRITE_DIR}/boss${boss.num}_${boss.name}.png`;
      await sharp({
        create: { width: FRAME_SIZE * col, height: FRAME_SIZE, channels: 4, background: {r:0,g:0,b:0,alpha:0} },
      }).composite(comp).png().toFile(sheetPath);
      await sharp(sheetPath).webp({ quality: 90 }).toFile(sheetPath.replace(".png", ".webp"));
    }
  }

  // ── 보스 카탈로그 (idle 모아보기, 4x5 그리드) ──
  if (startBoss === 1 && endBoss === 20) {
    console.log("\n📋 보스 카탈로그 생성...");
    const THUMB = 256, GAP = 4, LBL = 20, COLS = 5;
    const ROWS = Math.ceil(BOSSES.length / COLS);
    const catW = COLS * THUMB + (COLS - 1) * GAP;
    const catH = ROWS * (THUMB + LBL) + (ROWS - 1) * GAP;
    const catComp: sharp.OverlayOptions[] = [];

    for (let i = 0; i < BOSSES.length; i++) {
      const b = BOSSES[i];
      const col = i % COLS, row = Math.floor(i / COLS);
      const x = col * (THUMB + GAP), y = row * (THUMB + LBL + GAP);

      catComp.push({
        input: Buffer.from(`<svg width="${THUMB}" height="${LBL}"><text x="${THUMB/2}" y="15" text-anchor="middle" font-family="Arial,sans-serif" font-size="11" font-weight="bold" fill="#333">${b.num}. ${b.title}</text></svg>`),
        left: x, top: y,
      });

      const idlePath = `${OUTPUT_DIR}/boss${b.num}_${b.name}/idle.png`;
      if (existsSync(idlePath)) {
        const buf = await sharp(idlePath)
          .resize(THUMB, THUMB, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } })
          .png().toBuffer();
        catComp.push({ input: buf, left: x, top: y + LBL });
      }
    }

    const catPath = `${SPRITE_DIR}/bosses_catalog.png`;
    await sharp({
      create: { width: catW, height: catH, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
    }).composite(catComp).png().toFile(catPath);
    console.log(`  ✅ ${catPath}`);
  }

  console.log(`\n\n✅ 완료! 생성 ${generated - skipped}장, 스킵 ${skipped}장, 총 ${generated}/${totalFrames}장`);
}

main().catch(e => { console.error("❌ 오류:", e); process.exit(1); });
