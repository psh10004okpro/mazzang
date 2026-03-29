import sharp from "sharp";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import path from "path";
import { CONFIG, IMG2IMG_SUFFIX, PUNCH_SUFFIX } from "./config.js";

// ─── 설정 ─────────────────────────────────────────────────

const FRAME_SIZE = 256;
const OUTPUT_DIR = "./output/player_final";
const SPRITE_DIR = "./sprites/player";
const REF_PATH = "./output/samples_v2/style_i.png";

mkdirSync(OUTPUT_DIR, { recursive: true });
mkdirSync(SPRITE_DIR, { recursive: true });

const refBase64 = readFileSync(REF_PATH).toString("base64");

// ─── 모션 정의 (v7: 최소 프롬프트, 좌우 반전 적용) ──────

interface Motion {
  name: string;
  label: string;
  isPunch: boolean;
  frames: {
    prompt: string;
  }[];
}

const MOTIONS: Motion[] = [
  {
    name: "idle",
    label: "대기",
    isPunch: false,
    frames: [
      { prompt: "Relaxed fighting stance, fists raised near chin, weight centered, calm expression." },
      { prompt: "Relaxed fighting stance, fists raised near chin, weight slightly shifted to back foot, breathing in." },
      { prompt: "Relaxed fighting stance, fists raised near chin, weight centered, shoulders slightly raised." },
      { prompt: "Relaxed fighting stance, fists raised near chin, weight slightly shifted to front foot, breathing out." },
    ],
  },
  {
    name: "punch_left",
    label: "왼손 펀치",
    isPunch: true,
    frames: [
      // v7: 좌우 반전 — 왼손 펀치이므로 프롬프트에는 RIGHT로 지시
      { prompt: "Preparing to punch, pulling RIGHT fist back near shoulder, weight shifting to back foot, focused expression." },
      { prompt: "Mid-punch, RIGHT arm halfway extended forward, body starting to rotate, intense expression." },
      { prompt: "Full punch extension, RIGHT fist fully extended forward at shoulder height, LEFT fist guarding chin, maximum reach, speed lines behind fist." },
      { prompt: "Punch follow through, RIGHT arm slightly past target, body momentum forward, recovering stance." },
    ],
  },
  {
    name: "punch_right",
    label: "오른손 펀치",
    isPunch: true,
    frames: [
      // v7: 좌우 반전 — 오른손 펀치이므로 프롬프트에는 LEFT로 지시
      { prompt: "Preparing to punch, pulling LEFT fist back near shoulder, weight shifting to back foot, determined expression." },
      { prompt: "Mid-punch, LEFT arm halfway extended forward, body rotating into the punch, fierce expression." },
      { prompt: "Full punch extension, LEFT fist fully extended forward at shoulder height, RIGHT fist guarding chin, powerful strike, speed lines behind fist." },
      { prompt: "Punch follow through, LEFT arm slightly past target, body leaning forward from momentum, recovering." },
    ],
  },
  {
    name: "kick_front",
    label: "정면 킥",
    isPunch: false,
    frames: [
      { prompt: "Preparing front kick, lifting RIGHT knee up toward chest, arms in guard, weight on LEFT foot." },
      { prompt: "Mid-kick, RIGHT leg extending forward at waist height, body leaning back slightly for balance." },
      { prompt: "Full front kick, RIGHT leg fully extended forward at chest height, foot flexed, arms spread for balance, intense expression." },
      { prompt: "Kick recovery, RIGHT leg pulling back down, returning to fighting stance, balanced." },
    ],
  },
  {
    name: "kick_side",
    label: "옆차기",
    isPunch: false,
    frames: [
      { prompt: "Preparing side kick, lifting RIGHT knee up across body, turning hip, arms up for balance." },
      { prompt: "Mid side kick, RIGHT leg extending sideways at waist height, body turned sideways, powerful form." },
      { prompt: "Full side kick, RIGHT leg fully extended horizontally at chest height, body turned sideways, arms spread wide, strong expression." },
      { prompt: "Side kick recovery, RIGHT leg pulling back, body turning back to fighting stance." },
    ],
  },
  {
    name: "hit",
    label: "피격",
    isPunch: false,
    frames: [
      { prompt: "Getting hit in the face, head snapping back, pain expression, body starting to stagger backward." },
      { prompt: "Recoiling from hit, upper body leaning far back, arms flung out, grimacing in pain, sweat drops." },
      { prompt: "Recovering from hit, body still leaning back but starting to regain balance, one foot stepping back, determined expression." },
    ],
  },
];

// ─── API 호출 ─────────────────────────────────────────────

async function generateWithRef(prompt: string): Promise<Buffer> {
  const fullPrompt = `This exact same character in the same art style. ${prompt} ${IMG2IMG_SUFFIX}`;

  const res = await fetch(`${CONFIG.API_BASE_URL}/images/generations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${CONFIG.API_KEY}`,
    },
    body: JSON.stringify({
      model: CONFIG.MODEL,
      prompt: fullPrompt,
      n: 1,
      size: "1024x1024",
      image: refBase64,
    }),
  });

  if (!res.ok) throw new Error(`API ${res.status}: ${(await res.text()).substring(0, 200)}`);
  const json = (await res.json()) as any;
  const data = json.data?.[0];
  if (data.b64_json) return Buffer.from(data.b64_json, "base64");
  if (data.url) {
    const r = await fetch(data.url);
    return Buffer.from(await r.arrayBuffer());
  }
  throw new Error("no image data");
}

async function generateWithRetry(prompt: string, label: string): Promise<Buffer> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      return await generateWithRef(prompt);
    } catch (e: any) {
      console.error(`    ⚠️ 시도 ${attempt}/3 실패: ${e.message}`);
      if (attempt < 3) await new Promise((r) => setTimeout(r, 3000 * attempt));
    }
  }
  throw new Error(`${label}: 3회 시도 후 실패`);
}

// ─── 배경 제거 ────────────────────────────────────────────

async function removeWhiteBackground(input: Buffer): Promise<Buffer> {
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixels = Buffer.from(data);
  const threshold = 30;

  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
    const dist = Math.sqrt((r - 255) ** 2 + (g - 255) ** 2 + (b - 255) ** 2);
    if (dist <= threshold) {
      pixels[i + 3] = 0;
    } else if (dist <= threshold * 2) {
      const alpha = Math.round(((dist - threshold) / threshold) * 255);
      pixels[i + 3] = Math.min(pixels[i + 3], alpha);
    }
  }

  return sharp(pixels, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png()
    .toBuffer();
}

// ─── 메인 ─────────────────────────────────────────────────

async function main() {
  const totalFrames = MOTIONS.reduce((sum, m) => sum + m.frames.length, 0);
  let generated = 0;

  console.log(`🥊 맞짱로 주인공 전체 에셋 생성`);
  console.log(`   ${MOTIONS.length}개 모션, 총 ${totalFrames}프레임\n`);

  // ── 1. 프레임 생성 ──

  for (const motion of MOTIONS) {
    const motionDir = path.join(OUTPUT_DIR, motion.name);
    mkdirSync(motionDir, { recursive: true });

    console.log(`\n📂 [${motion.label}] ${motion.frames.length}프레임`);

    for (let f = 0; f < motion.frames.length; f++) {
      const frame = motion.frames[f];
      const framePath = path.join(motionDir, `frame_${f + 1}.png`);

      // 이미 생성된 프레임은 건너뜀
      if (existsSync(framePath)) {
        console.log(`  ⏭️ frame_${f + 1} (이미 존재)`);
        generated++;
        continue;
      }

      let prompt = frame.prompt;
      if (motion.isPunch) {
        prompt += ` ${PUNCH_SUFFIX}`;
      }

      console.log(`  🖼️ frame_${f + 1}/${motion.frames.length} [${generated + 1}/${totalFrames}]`);

      const rawBuf = await generateWithRetry(prompt, `${motion.name}_frame${f + 1}`);

      // 원본 저장
      const rawPath = path.join(motionDir, `frame_${f + 1}_raw.png`);
      writeFileSync(rawPath, rawBuf);

      // 배경 제거 + 리사이즈 (256x256)
      const noBg = await removeWhiteBackground(rawBuf);
      const resized = await sharp(noBg)
        .resize(FRAME_SIZE, FRAME_SIZE, {
          fit: "contain",
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .png()
        .toBuffer();

      writeFileSync(framePath, resized);
      generated++;
      console.log(`    ✅ 저장 (${generated}/${totalFrames})`);
    }
  }

  // ── 2. 모션별 스프라이트 시트 ──

  console.log(`\n\n🎞️ 스프라이트 시트 생성\n`);

  for (const motion of MOTIONS) {
    const motionDir = path.join(OUTPUT_DIR, motion.name);
    const frameCount = motion.frames.length;
    const sheetW = FRAME_SIZE * frameCount;
    const sheetH = FRAME_SIZE;

    const composites: sharp.OverlayOptions[] = [];
    for (let f = 0; f < frameCount; f++) {
      const framePath = path.join(motionDir, `frame_${f + 1}.png`);
      const buf = readFileSync(framePath);
      composites.push({ input: buf, left: f * FRAME_SIZE, top: 0 });
    }

    const sheetPath = path.join(SPRITE_DIR, `player_${motion.name}.png`);
    await sharp({
      create: { width: sheetW, height: sheetH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    })
      .composite(composites)
      .png()
      .toFile(sheetPath);

    // WebP
    const webpPath = sheetPath.replace(".png", ".webp");
    await sharp(sheetPath).webp({ quality: 90 }).toFile(webpPath);

    console.log(`  ✅ player_${motion.name}.png (${frameCount}프레임, ${sheetW}x${sheetH})`);
  }

  // ── 3. 전체 통합 시트 (6행 × 4열) ──

  console.log(`\n🎞️ 통합 스프라이트 시트`);

  const MAX_COLS = 4;
  const ROWS = MOTIONS.length;
  const fullW = FRAME_SIZE * MAX_COLS;
  const fullH = FRAME_SIZE * ROWS;

  const fullComposites: sharp.OverlayOptions[] = [];
  for (let row = 0; row < MOTIONS.length; row++) {
    const motion = MOTIONS[row];
    const motionDir = path.join(OUTPUT_DIR, motion.name);

    for (let col = 0; col < motion.frames.length; col++) {
      const framePath = path.join(motionDir, `frame_${col + 1}.png`);
      const buf = readFileSync(framePath);
      fullComposites.push({
        input: buf,
        left: col * FRAME_SIZE,
        top: row * FRAME_SIZE,
      });
    }
  }

  const fullPath = path.join(SPRITE_DIR, "player_spritesheet.png");
  await sharp({
    create: { width: fullW, height: fullH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite(fullComposites)
    .png()
    .toFile(fullPath);

  await sharp(fullPath).webp({ quality: 90 }).toFile(fullPath.replace(".png", ".webp"));
  console.log(`  ✅ player_spritesheet.png (${MAX_COLS}x${ROWS}, ${fullW}x${fullH})`);

  // ── 4. 메타데이터 ──

  const metadata = {
    character: "player",
    style: "I (카툰+웹툰 v2)",
    frameSize: FRAME_SIZE,
    motions: MOTIONS.map((m) => ({
      name: m.name,
      label: m.label,
      frameCount: m.frames.length,
      spriteSheet: `player_${m.name}.png`,
      row: MOTIONS.indexOf(m),
    })),
    fullSheet: {
      file: "player_spritesheet.png",
      cols: MAX_COLS,
      rows: ROWS,
      width: fullW,
      height: fullH,
    },
  };

  const metaPath = path.join(SPRITE_DIR, "player_metadata.json");
  writeFileSync(metaPath, JSON.stringify(metadata, null, 2));
  console.log(`  📋 메타데이터: ${metaPath}`);

  // ── 5. 미리보기 이미지 ──

  console.log(`\n🖼️ 미리보기 생성`);

  const PREV_CELL = 200, GAP = 4, LBL = 24;
  const prevW = MAX_COLS * PREV_CELL + (MAX_COLS - 1) * GAP;
  const prevH = ROWS * (PREV_CELL + LBL) + (ROWS - 1) * GAP;
  const prevComp: sharp.OverlayOptions[] = [];

  for (let row = 0; row < MOTIONS.length; row++) {
    const motion = MOTIONS[row];
    const y = row * (PREV_CELL + LBL + GAP);

    for (let col = 0; col < MAX_COLS; col++) {
      const x = col * (PREV_CELL + GAP);

      if (col < motion.frames.length) {
        const framePath = path.join(OUTPUT_DIR, motion.name, `frame_${col + 1}.png`);
        const buf = await sharp(framePath)
          .resize(PREV_CELL, PREV_CELL, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } })
          .png().toBuffer();
        prevComp.push({ input: buf, left: x, top: y + LBL });
      }

      if (col === 0) {
        prevComp.push({
          input: Buffer.from(`<svg width="${prevW}" height="${LBL}"><text x="4" y="18" font-family="Arial,sans-serif" font-size="14" font-weight="bold" fill="#333">${motion.label} (${motion.name})</text></svg>`),
          left: 0, top: y,
        });
      }
    }
  }

  const prevPath = path.join(OUTPUT_DIR, "preview_all.png");
  await sharp({
    create: { width: prevW, height: prevH, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
  }).composite(prevComp).png().toFile(prevPath);
  console.log(`  ✅ 미리보기: ${prevPath}`);

  console.log(`\n✅ 전체 완료! ${generated}프레임 생성`);
}

main().catch((e) => {
  console.error("❌ 오류:", e);
  process.exit(1);
});
