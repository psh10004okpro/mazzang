import sharp from "sharp";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { CONFIG, IMG2IMG_SUFFIX, PUNCH_SUFFIX } from "./config.js";

const FRAME_SIZE = 512;
const OUTPUT_DIR = "./output/enemies";
const SPRITE_DIR = "./sprites/enemies";
const styleRefBase64 = readFileSync("./output/samples_v2/style_i.png").toString("base64");

mkdirSync(OUTPUT_DIR, { recursive: true });
mkdirSync(SPRITE_DIR, { recursive: true });

// ─── 20골목 × 5잡졸 정의 ──────────────────────────────────

interface Enemy {
  name: string;
  desc: string; // 외형 설명 (프롬프트용)
}

interface Alley {
  num: number;
  theme: string;
  enemies: Enemy[];
}

const ALLEYS: Alley[] = [
  // 골목 1: 동네 골목
  {
    num: 1, theme: "neighborhood alley",
    enemies: [
      { name: "kid_bully", desc: "scrawny teenage boy in school uniform, sleeves rolled up, cocky smirk, thin arms" },
      { name: "school_thug", desc: "tall high school student in unbuttoned school uniform, messy hair, intimidating stare" },
      { name: "alley_punk", desc: "young man in oversized hoodie and baggy pants, backwards cap, slouching posture" },
      { name: "street_hustler", desc: "skinny young man in cheap tracksuit, cigarette behind ear, shifty eyes" },
      { name: "local_thug", desc: "stocky young man in black tracksuit, gold chain, buzz cut, aggressive stance" },
    ],
  },
  // 골목 2: 상가 거리
  {
    num: 2, theme: "shopping street",
    enemies: [
      { name: "karaoke_rowdy", desc: "drunk young man in wrinkled dress shirt untucked, loosened tie, red face, swaying" },
      { name: "store_thief", desc: "nervous young man in dark hoodie with hood up, backpack, looking around suspiciously" },
      { name: "biker_gang", desc: "young man in leather jacket with motorcycle helmet under arm, fingerless gloves, boots" },
      { name: "pcbang_bully", desc: "pale young man in graphic tee and sweatpants, energy drink in hand, dark circles under eyes" },
      { name: "mall_gangster", desc: "young man in flashy streetwear, gold earring, designer knockoff jacket, arrogant expression" },
    ],
  },
  // 골목 3: 시장통
  {
    num: 3, theme: "traditional market",
    enemies: [
      { name: "market_thug", desc: "muscular man in stained white tank top, tattoo on arm, rubber boots, market worker build" },
      { name: "vendor_bully", desc: "broad-shouldered man in apron over t-shirt, thick forearms, shaved head, mean look" },
      { name: "food_stall_fighter", desc: "stocky man in greasy apron, bandana on head, flour-dusted arms, rolling up sleeves" },
      { name: "fish_market_brawler", desc: "big man in rubber overalls, wet gloves, scarred hands, weathered tough face" },
      { name: "market_mob", desc: "intimidating man in running shirt showing tattoos, gold bracelet, slicked back hair" },
    ],
  },
  // 골목 4: 유흥가
  {
    num: 4, theme: "entertainment district nightlife",
    enemies: [
      { name: "club_bouncer", desc: "huge muscular man in tight black t-shirt, earpiece, crossed arms, shaved head, stone cold face" },
      { name: "street_hawker", desc: "slick man in shiny suit jacket over black turtleneck, gold rings, greasy smile" },
      { name: "drunk_brawler", desc: "large red-faced man in torn dress shirt, sleeves rolled up, bottle in hand, wild eyes" },
      { name: "gambler", desc: "sharp-eyed man in dark vest over white shirt, thin mustache, rings on fingers, calculating look" },
      { name: "nightlife_gangster", desc: "tall man in open collar black shirt, gold chain necklace, sunglasses at night, scar on cheek" },
    ],
  },
  // 골목 5: 공사장
  {
    num: 5, theme: "construction site",
    enemies: [
      { name: "labor_thug", desc: "rough man in dirty work coveralls, steel toe boots, calloused hands, menacing squint" },
      { name: "rebar_swinger", desc: "big man in torn work vest, hard hat tilted back, thick arms, holding fists up" },
      { name: "forklift_guy", desc: "barrel-chested man in orange safety vest over flannel, work gloves, stubble, angry frown" },
      { name: "cement_fist", desc: "massive forearms man in gray work clothes covered in dust, tape-wrapped fists, stone-faced" },
      { name: "site_boss", desc: "tall thick man in open work jacket, hard hat, clipboard under arm, commanding presence, scarred knuckles" },
    ],
  },
  // 골목 6: 항구
  {
    num: 6, theme: "harbor docks",
    enemies: [
      { name: "dock_loader", desc: "sweaty muscular man in striped sailor tank top, cargo pants, rope-burned hands" },
      { name: "sailor_thug", desc: "weathered man in navy peacoat, anchor tattoo on neck, salt-stained boots, grizzled face" },
      { name: "smuggler", desc: "lean man in dark waterproof jacket, beanie hat, scar across nose, shifty dangerous eyes" },
      { name: "container_lurker", desc: "hooded man in dark cargo jacket, steel pipe in belt, cold expressionless face" },
      { name: "harbor_enforcer", desc: "broad man in rain-stained leather coat, chain around waist, broken nose, fearsome look" },
    ],
  },
  // 골목 7: 부두 심화
  {
    num: 7, theme: "industrial waterfront",
    enemies: [
      { name: "crane_worker", desc: "huge man in oil-stained overalls, thick neck, industrial gloves, permanent scowl" },
      { name: "shipping_thug", desc: "tattooed man in ripped tank top, dragon tattoo on chest, dock worker boots" },
      { name: "fish_gang", desc: "scarred man in wet rubber apron, hook-shaped scar on hand, dead eyes" },
      { name: "port_racketeer", desc: "man in cheap suit with salt stains, counting money gesture, threatening smile" },
      { name: "waterfront_boss", desc: "massive man in naval captain coat modified, gold tooth, crossed arms, towering presence" },
    ],
  },
  // 골목 8: 뒷골목
  {
    num: 8, theme: "dark back alley",
    enemies: [
      { name: "alley_mugger", desc: "lean man in black hoodie, face half covered by mask, crouching predator stance" },
      { name: "knife_thug", desc: "wiry man in torn leather jacket, bandaged hand, intense crazy eyes, jagged scar on lip" },
      { name: "fence_dealer", desc: "hunched man in oversized trenchcoat, suspicious bulges in pockets, darting eyes" },
      { name: "street_brawler", desc: "muscular man covered in old scars, torn tank top, tape on knuckles, battle-hardened" },
      { name: "alley_king", desc: "tall intimidating man in dark bomber jacket, multiple scars, cold dead stare, reputation aura" },
    ],
  },
  // 골목 9: 지하주차장
  {
    num: 9, theme: "underground parking lot",
    enemies: [
      { name: "parking_guard", desc: "stocky man in security uniform, baton at belt, aggressive posture, crew cut" },
      { name: "car_thief", desc: "agile man in black athletic wear, gloves, ski mask pulled up on forehead, lean build" },
      { name: "debt_collector", desc: "intimidating man in cheap suit, loose tie, thick rings on fists, threatening finger point" },
      { name: "loan_shark_muscle", desc: "big man in black turtleneck, leather gloves, emotionless face, professional enforcer look" },
      { name: "underground_fighter", desc: "scarred shirtless man with tape-wrapped hands, cauliflower ears, broken nose, fight-ready" },
    ],
  },
  // 골목 10: 폐공장
  {
    num: 10, theme: "abandoned factory",
    enemies: [
      { name: "factory_squatter", desc: "dirty man in torn factory uniform, wild unkempt hair, feral look, rusty tool in hand" },
      { name: "junkyard_fighter", desc: "muscular man in makeshift armor from scrap metal, welding goggles on forehead, savage" },
      { name: "chemical_thug", desc: "man in stained chemical suit half unzipped, gas mask hanging on neck, burns on arms" },
      { name: "assembly_brute", desc: "huge man in torn coveralls, machine grease on skin, mechanical arm brace, merciless eyes" },
      { name: "factory_warden", desc: "tall man in foreman jacket, safety glasses, commanding voice pose, scars from factory work" },
    ],
  },
  // 골목 11: 조직 입구
  {
    num: 11, theme: "organized crime territory",
    enemies: [
      { name: "gang_recruit", desc: "young man in black suit slightly too big, nervous but dangerous, fresh face tattoo" },
      { name: "lookout", desc: "alert man in dark casual suit, earpiece, scanning eyes, hand inside jacket, tense posture" },
      { name: "gang_soldier", desc: "man in fitted black suit, dragon pin on lapel, controlled menace, disciplined stance" },
      { name: "enforcer", desc: "large man in black shirt and suit pants, neck tattoo, cracking knuckles, dead serious" },
      { name: "underboss_guard", desc: "imposing man in expensive black suit, scar across eye, military bearing, stone cold" },
    ],
  },
  // 골목 12: 도박장
  {
    num: 12, theme: "illegal gambling den",
    enemies: [
      { name: "card_cheat", desc: "slim man in vest and rolled sleeves, playing card tucked behind ear, sly grin" },
      { name: "dice_thug", desc: "rough man in hawaiian shirt open over tank top, gold chain, sweating, aggressive" },
      { name: "pit_guard", desc: "muscular man in tight black polo, arms crossed, no-nonsense expression, buzz cut" },
      { name: "debt_breaker", desc: "huge man in leather vest no shirt, full sleeve tattoos, bat stance, terrifying smile" },
      { name: "den_boss_guard", desc: "well-dressed man in red suit jacket, dragon ring, calm but extremely dangerous aura" },
    ],
  },
  // 골목 13: 사채업
  {
    num: 13, theme: "loan shark territory",
    enemies: [
      { name: "collector_junior", desc: "lean man in cheap suit, notepad in pocket, nervous energy, first time enforcing" },
      { name: "repo_man", desc: "stocky man in dark jacket, carrying crowbar impression, determined merciless expression" },
      { name: "bone_breaker", desc: "large man in rolled-up dress shirt, muscular forearms, scars on hands, enjoys his work" },
      { name: "shark_lieutenant", desc: "cold man in expensive suit, leather gloves, calculating eyes behind glasses, methodical" },
      { name: "money_boss_guard", desc: "massive man in tailored suit, gold cufflinks, emotionless, professional killer vibe" },
    ],
  },
  // 골목 14: 지하 클럽
  {
    num: 14, theme: "underground club",
    enemies: [
      { name: "club_enforcer", desc: "tall man in all-black tactical outfit, combat boots, muscular, night vision on forehead" },
      { name: "vip_guard", desc: "suited man with sunglasses indoors, earpiece, hands clasped in front, immovable stance" },
      { name: "drug_runner", desc: "wiry fast-looking man in track jacket, cornrows, multiple rings, twitchy aggressive" },
      { name: "underground_boxer", desc: "shirtless man with boxing tape on hands, swollen knuckles, cauliflower ears, war-torn body" },
      { name: "crime_prince", desc: "young man in designer suit, slicked hair, arrogant smirk, but visibly dangerous build" },
    ],
  },
  // 골목 15: 암흑가 경계
  {
    num: 15, theme: "criminal underworld border",
    enemies: [
      { name: "border_patrol", desc: "alert man in black tactical vest over hoodie, military boots, scarred face, combat ready" },
      { name: "street_assassin", desc: "thin man in long dark coat, gloves, emotionless pale face, silent killer aura" },
      { name: "weapons_dealer", desc: "stocky man in military surplus jacket, dog tags, multiple pockets, dangerous knowledge" },
      { name: "territory_enforcer", desc: "huge scarred man in tank top, full body tattoos, missing finger, primal fighter" },
      { name: "gatekeeper", desc: "tall man in armored-looking black coat, metal accessories, mask over lower face, final wall" },
    ],
  },
  // 골목 16: 격투가의 거리
  {
    num: 16, theme: "fighters street",
    enemies: [
      { name: "ex_boxer", desc: "middle-aged muscular man in boxing shorts and robe, taped fists, flat nose, veteran eyes" },
      { name: "kickboxer", desc: "lean athletic man in muay thai shorts, shin guards, wrapped hands, fight-ready stance" },
      { name: "wrestler", desc: "massive thick man in wrestling singlet, cauliflower ears, neck like tree trunk, grappler stance" },
      { name: "karate_master", desc: "disciplined man in worn white gi, black belt, calloused knuckles, focused piercing stare" },
      { name: "street_champion", desc: "battle-scarred man in torn tank top, championship belt around waist, undefeated aura" },
    ],
  },
  // 골목 17: 무술 도장가
  {
    num: 17, theme: "martial arts district",
    enemies: [
      { name: "taekwondo_fighter", desc: "tall athletic man in dobok uniform, high guard stance, flexible body, fast-kick ready" },
      { name: "judo_giant", desc: "huge stocky man in blue judogi, thick grip hands, low center gravity, throwing stance" },
      { name: "kung_fu_student", desc: "lean man in traditional Chinese martial arts uniform, open palm stance, flowing movement" },
      { name: "hapkido_expert", desc: "calm man in black hapkido uniform, joint-lock ready hands, deceptively relaxed stance" },
      { name: "dojo_champion", desc: "battle-hardened man in modified martial arts gi, multiple style patches, mastery in eyes" },
    ],
  },
  // 골목 18: 용병 지대
  {
    num: 18, theme: "mercenary zone",
    enemies: [
      { name: "hired_muscle", desc: "huge man in black tactical gear, military haircut, dog tags, professional soldier stance" },
      { name: "combat_veteran", desc: "scarred man in camo pants and black shirt, military tattoos, thousand-yard stare" },
      { name: "spec_ops_washout", desc: "lean dangerous man in tactical vest, balaclava around neck, precise calculated movements" },
      { name: "war_mercenary", desc: "massive man in modified military gear, face paint streaks, battle scars everywhere, deadly calm" },
      { name: "merc_commander", desc: "imposing man in black officer-style coat, beret, cigar, commanding presence, ultimate authority" },
    ],
  },
  // 골목 19: 암흑가 간부
  {
    num: 19, theme: "crime syndicate inner circle",
    enemies: [
      { name: "syndicate_guard", desc: "tall man in expensive black suit, tie pin, hidden weapon impression, elite bodyguard" },
      { name: "shadow_fighter", desc: "lean man in all-black with hood, face mostly hidden, ghost-like movement stance" },
      { name: "iron_fist", desc: "massive man in sleeveless suit vest, arms covered in scars and tattoos, iron-conditioned hands" },
      { name: "blood_oath", desc: "scarred man in ceremonial dark outfit, ritual scars on arms, fanatical devotion in eyes" },
      { name: "inner_circle", desc: "powerful man in pristine dark suit, dragon embroidery, absolute authority, killing intent aura" },
    ],
  },
  // 골목 20: 최종 골목
  {
    num: 20, theme: "final street ultimate fighters",
    enemies: [
      { name: "legendary_brawler", desc: "giant scarred man in torn clothes, body covered in battle scars, mythical street fighter" },
      { name: "iron_body", desc: "enormous muscular man with body like steel, veins bulging, minimal clothes, superhuman build" },
      { name: "death_match_vet", desc: "terrifying man covered in scars and burns, wild eyes, wrapped in bandages, no fear" },
      { name: "shadow_king", desc: "tall mysterious man in long black coat, face half-shadowed, overwhelming menacing presence" },
      { name: "final_guardian", desc: "ultimate fighter, massive imposing figure in dark modified martial arts wear, final boss energy, absolute power stance" },
    ],
  },
];

// ─── API ──────────────────────────────────────────────────

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

/** Flood fill 배경 제거 — 가장자리 흰색만 제거, 캐릭터 내부 흰색 보존 */
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

  for (let i = 0; i < w*h; i++) {
    if (isBg[i]) px[i*4+3] = 0;
  }

  return sharp(px, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer();
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

// ─── 메인 ─────────────────────────────────────────────────

async function main() {
  const startAlley = parseInt(process.argv[2] || "1");
  const endAlley = parseInt(process.argv[3] || "20");

  const alleys = ALLEYS.filter(a => a.num >= startAlley && a.num <= endAlley);
  const totalEnemies = alleys.reduce((s, a) => s + a.enemies.length, 0);
  const totalFrames = totalEnemies * 2;
  let generated = 0;
  let skipped = 0;

  console.log(`🥊 맞짱로 잡졸 에셋 생성 (골목 ${startAlley}~${endAlley})`);
  console.log(`   ${alleys.length}골목 × 5잡졸 × 2포즈 = ${totalFrames}장\n`);

  for (const alley of alleys) {
    const alleyDir = `${OUTPUT_DIR}/alley${alley.num}`;
    mkdirSync(alleyDir, { recursive: true });

    console.log(`\n${"═".repeat(50)}`);
    console.log(`📂 골목 ${alley.num}/20: ${alley.theme} (${alley.enemies.length}종)`);
    console.log(`${"═".repeat(50)}`);

    for (let e = 0; e < alley.enemies.length; e++) {
      const enemy = alley.enemies[e];
      const enemyDir = `${alleyDir}/${enemy.name}`;
      mkdirSync(enemyDir, { recursive: true });

      console.log(`\n  [${e+1}/5] ${enemy.name}`);

      const idleRawPath = `${enemyDir}/idle_raw.png`;
      const idleFramePath = `${enemyDir}/idle.png`;
      const hitRawPath = `${enemyDir}/hit_raw.png`;
      const hitFramePath = `${enemyDir}/hit.png`;

      // ── STEP 1: idle 생성 (style_i 참조) ──
      if (!existsSync(idleFramePath)) {
        const idlePrompt = `This exact same art style but a different enemy character. ${enemy.desc}. Standing menacingly, ready to fight, facing left. Do not crop, show full body head to feet. White background. Single character.`;

        for (let a = 1; a <= 3; a++) {
          try {
            const raw = await gen(idlePrompt, styleRefBase64);
            writeFileSync(idleRawPath, raw);
            const resized = await sharp(await removeBg(raw))
              .resize(FRAME_SIZE, FRAME_SIZE, { fit: "contain", background: { r:0,g:0,b:0,alpha:0 } })
              .png().toBuffer();
            writeFileSync(idleFramePath, resized);
            generated++;
            console.log(`    ✅ idle [${generated}/${totalFrames}]`);
            break;
          } catch (err: any) {
            console.error(`    ⚠️ idle 시도 ${a}/3: ${err.message}`);
            if (a < 3) await sleep(3000 * a);
          }
        }
        await sleep(1000);
      } else {
        skipped++;
        generated++;
        console.log(`    ⏭️ idle (이미 존재)`);
      }

      // ── STEP 2: hit 생성 (idle_raw를 참조 → 동일 캐릭터) ──
      if (!existsSync(hitFramePath)) {
        // idle_raw를 참조 이미지로 사용
        let hitRef = styleRefBase64;
        if (existsSync(idleRawPath)) {
          hitRef = readFileSync(idleRawPath).toString("base64");
        }

        const hitPrompt = `This exact same character. Getting punched hard, head snapping back, pain expression, staggering backward. Do not crop, show full body head to feet. White background. Single character.`;

        for (let a = 1; a <= 3; a++) {
          try {
            const raw = await gen(hitPrompt, hitRef);
            writeFileSync(hitRawPath, raw);
            const resized = await sharp(await removeBg(raw))
              .resize(FRAME_SIZE, FRAME_SIZE, { fit: "contain", background: { r:0,g:0,b:0,alpha:0 } })
              .png().toBuffer();
            writeFileSync(hitFramePath, resized);
            generated++;
            console.log(`    ✅ hit [${generated}/${totalFrames}]`);
            break;
          } catch (err: any) {
            console.error(`    ⚠️ hit 시도 ${a}/3: ${err.message}`);
            if (a < 3) await sleep(3000 * a);
          }
        }
        await sleep(1000);
      } else {
        skipped++;
        generated++;
        console.log(`    ⏭️ hit (이미 존재)`);
      }
    }

    // 골목별 스프라이트 시트 (5종 × 2포즈 = 10프레임)
    console.log(`\n  🎞️ 골목 ${alley.num} 스프라이트 시트...`);
    const sheetComp: sharp.OverlayOptions[] = [];
    let col = 0;
    for (const enemy of alley.enemies) {
      for (const pose of ["idle", "hit"]) {
        const framePath = `${alleyDir}/${enemy.name}/${pose}.png`;
        if (existsSync(framePath)) {
          sheetComp.push({ input: readFileSync(framePath), left: col * FRAME_SIZE, top: 0 });
          col++;
        }
      }
    }

    if (sheetComp.length > 0) {
      const sheetPath = `${SPRITE_DIR}/alley${alley.num}_enemies.png`;
      await sharp({
        create: { width: FRAME_SIZE * col, height: FRAME_SIZE, channels: 4, background: { r:0,g:0,b:0,alpha:0 } },
      }).composite(sheetComp).png().toFile(sheetPath);
      await sharp(sheetPath).webp({ quality: 90 }).toFile(sheetPath.replace(".png", ".webp"));
      console.log(`  ✅ alley${alley.num}_enemies.png (${col}프레임)`);
    }
  }

  console.log(`\n\n✅ 완료! 생성 ${generated - skipped}장, 스킵 ${skipped}장, 총 ${generated}/${totalFrames}장`);
}

main().catch(e => { console.error("❌ 오류:", e); process.exit(1); });
