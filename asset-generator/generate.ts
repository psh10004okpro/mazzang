import OpenAI from "openai";
import fs from "fs-extra";
import path from "path";
import {
  CONFIG,
  CATEGORY_STYLES,
  PLAYER_REFERENCE_PATH,
  IMG2IMG_SUFFIX,
  PUNCH_SUFFIX,
} from "./config.js";
import { processImage } from "./utils/imageProcessor.js";
import {
  buildSpriteSheetsForCategory,
  writeSpriteMetadata,
} from "./utils/spriteSheet.js";

// ─── API 클라이언트 ───────────────────────────────────────

const client = new OpenAI({
  baseURL: CONFIG.API_BASE_URL,
  apiKey: CONFIG.API_KEY,
});

// ─── 타입 정의 ────────────────────────────────────────────

interface AssetDefinition {
  name: string;
  prompt: string;
  frames: number;
  size: string;
  aspectRatio?: string;
  note?: string;
}

interface PromptFile {
  category: string;
  assets: AssetDefinition[];
}

// ─── 핵심 이미지 생성 ────────────────────────────────────

/**
 * img2img 생성: 참조 이미지 + 최소 프롬프트
 * image 필드에 raw base64 (data URI 없이) 전달
 */
async function generateWithReference(
  prompt: string,
  referenceBase64: string,
  size?: string
): Promise<string> {
  const res = await fetch(`${CONFIG.API_BASE_URL}/images/generations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${CONFIG.API_KEY}`,
    },
    body: JSON.stringify({
      model: CONFIG.MODEL,
      prompt,
      n: 1,
      size: size || CONFIG.IMAGE_SIZE,
      image: referenceBase64,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`API ${res.status}: ${errText.substring(0, 200)}`);
  }

  const json = (await res.json()) as any;
  const data = json.data?.[0];
  if (!data) throw new Error("API 응답에 data 없음");

  if (data.b64_json) return `data:image/png;base64,${data.b64_json}`;
  return data.url!;
}

/**
 * 텍스트 전용 생성 (비캐릭터 에셋: 도구, 배경, 아이콘)
 */
async function generateTextOnly(
  prompt: string,
  size?: string
): Promise<string> {
  const response = await client.images.generate({
    model: CONFIG.MODEL,
    prompt,
    n: 1,
    size: (size as "1024x1024") || "1024x1024",
  });

  const data = response.data[0];
  if (data.b64_json) return `data:image/png;base64,${data.b64_json}`;
  return data.url!;
}

/** 재시도 래퍼 */
async function withRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  for (let attempt = 1; attempt <= CONFIG.RETRY_COUNT; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      console.error(`  ⚠️ 시도 ${attempt}/${CONFIG.RETRY_COUNT} 실패: ${err?.message}`);
      if (attempt < CONFIG.RETRY_COUNT) {
        const delay = CONFIG.RETRY_DELAY_MS * attempt;
        console.log(`  ⏳ ${delay}ms 후 재시도...`);
        await sleep(delay);
      }
    }
  }
  throw new Error(`${label}: ${CONFIG.RETRY_COUNT}회 시도 후 생성 실패`);
}

// ─── 참조 이미지 관리 ─────────────────────────────────────

const referenceCache: Record<string, string> = {};

/** 카테고리별 참조 이미지 로드 */
async function getReferenceBase64(category: string): Promise<string | undefined> {
  if (referenceCache[category]) return referenceCache[category];

  // player는 Style I 원본 사용
  if (category === "player" && (await fs.pathExists(PLAYER_REFERENCE_PATH))) {
    const buf = await fs.readFile(PLAYER_REFERENCE_PATH);
    referenceCache[category] = buf.toString("base64");
    console.log(`  📎 참조: ${PLAYER_REFERENCE_PATH}`);
    return referenceCache[category];
  }

  // 다른 카테고리는 _reference.png
  const refPath = path.join(CONFIG.OUTPUT_DIR, category, "_reference.png");
  if (await fs.pathExists(refPath)) {
    const buf = await fs.readFile(refPath);
    referenceCache[category] = buf.toString("base64");
    console.log(`  📎 참조: ${refPath}`);
    return referenceCache[category];
  }

  return undefined;
}

/** 참조 이미지 저장 (enemies, bosses 첫 생성 시) */
async function saveReference(category: string, source: string): Promise<void> {
  const refPath = path.join(CONFIG.OUTPUT_DIR, category, "_reference.png");
  let buf: Buffer;
  if (source.startsWith("data:")) {
    buf = Buffer.from(source.split(",")[1], "base64");
  } else {
    const res = await fetch(source);
    buf = Buffer.from(await res.arrayBuffer());
  }
  await fs.writeFile(refPath, buf);
  referenceCache[category] = buf.toString("base64");
  console.log(`  📎 참조 저장: ${refPath}`);
}

// ─── 에셋 생성 ────────────────────────────────────────────

/** 단일 에셋의 모든 프레임 생성 */
async function generateAsset(
  category: string,
  asset: AssetDefinition
): Promise<string[]> {
  const outputDir = path.join(CONFIG.OUTPUT_DIR, category, asset.name);
  await fs.ensureDir(outputDir);

  const [targetW, targetH] = asset.size.split("x").map(Number);
  const savedPaths: string[] = [];

  // 캐릭터 카테고리 → img2img, 비캐릭터 → 텍스트
  const isCharacter = ["player", "enemies", "bosses"].includes(category);
  const refBase64 = isCharacter ? await getReferenceBase64(category) : undefined;
  const isPunch = asset.name.includes("punch");

  console.log(
    `\n🎨 [${category}/${asset.name}] ${asset.frames}프레임${refBase64 ? " (img2img)" : ""}`
  );

  for (let frame = 0; frame < asset.frames; frame++) {
    const frameLabel =
      asset.frames > 1
        ? `, animation frame ${frame + 1} of ${asset.frames}, slight pose variation`
        : "";

    console.log(`  🖼️ 프레임 ${frame + 1}/${asset.frames}`);

    let source: string;

    if (refBase64) {
      // img2img: 최소 프롬프트 + 참조 이미지
      const prompt = [
        "This exact same character in the same art style.",
        asset.prompt,
        isPunch ? PUNCH_SUFFIX : "",
        IMG2IMG_SUFFIX,
        frameLabel,
      ]
        .filter(Boolean)
        .join(" ");

      source = await withRetry(
        () => generateWithReference(prompt, refBase64),
        asset.name
      );

      // 첫 에셋의 첫 프레임을 참조로 저장 (enemies, bosses)
      if (category !== "player" && !referenceCache[category] && frame === 0) {
        await saveReference(category, source);
      }
    } else {
      // 텍스트 전용
      const categoryStyle = CATEGORY_STYLES[category] || "";
      const prompt = [categoryStyle, asset.prompt, frameLabel]
        .filter(Boolean)
        .join(", ");

      source = await withRetry(
        () => generateTextOnly(prompt, asset.aspectRatio ? undefined : CONFIG.IMAGE_SIZE),
        asset.name
      );
    }

    const outputPath = path.join(
      outputDir,
      `frame_${String(frame).padStart(3, "0")}.png`
    );

    const removeBg = category !== "backgrounds";
    const result = await processImage(source, outputPath, {
      width: targetW,
      height: targetH,
      removeBg,
      bgThreshold: 30,
    });

    savedPaths.push(result.png);
  }

  console.log(`  ✅ [${asset.name}] 완료: ${savedPaths.length}프레임`);
  return savedPaths;
}

/** 카테고리 전체 생성 */
async function generateCategory(category: string): Promise<void> {
  const promptPath = path.join("./prompts", `${category}.json`);

  if (!(await fs.pathExists(promptPath))) {
    console.error(`❌ 프롬프트 파일 없음: ${promptPath}`);
    return;
  }

  const promptFile: PromptFile = await fs.readJson(promptPath);
  console.log(
    `\n${"═".repeat(50)}\n📂 카테고리: ${category} (${promptFile.assets.length}개 에셋)\n${"═".repeat(50)}`
  );

  for (const asset of promptFile.assets) {
    await generateAsset(category, asset);
  }
}

/** 전체 카테고리 생성 */
async function generateAll(): Promise<void> {
  const categories = ["player", "enemies", "bosses", "tools", "backgrounds", "equipment"];
  for (const cat of categories) {
    await generateCategory(cat);
  }
}

// ─── 스프라이트 시트 빌드 ─────────────────────────────────

async function buildSprites(category?: string): Promise<void> {
  const categories = category
    ? [category]
    : ["player", "enemies", "bosses", "tools", "backgrounds", "equipment"];

  const frameSizes: Record<string, { width: number; height: number }> = {
    player: { width: 64, height: 64 },
    enemies: { width: 64, height: 64 },
    bosses: { width: 96, height: 96 },
    tools: { width: 64, height: 80 },
    backgrounds: { width: 1024, height: 576 },
    equipment: { width: 48, height: 48 },
  };

  for (const cat of categories) {
    const catOutputDir = path.join(CONFIG.OUTPUT_DIR, cat);
    const spriteDir = path.join(CONFIG.SPRITE_DIR, cat);

    if (!(await fs.pathExists(catOutputDir))) {
      console.log(`⏭️ ${cat} 출력 폴더 없음, 건너뜀`);
      continue;
    }

    console.log(`\n🎞️ [${cat}] 스프라이트 시트 빌드`);
    const size = frameSizes[cat] || { width: 64, height: 64 };
    const results = await buildSpriteSheetsForCategory(catOutputDir, spriteDir, size);

    for (const result of results) {
      const metaPath = result.path.replace(/\.png$/, ".json");
      await writeSpriteMetadata(result, metaPath);
    }

    console.log(`  ✅ [${cat}] ${results.length}개 스프라이트 시트 완료`);
  }
}

// ─── 단일 에셋 생성 ──────────────────────────────────────

async function generateSingle(category: string, assetName: string): Promise<void> {
  const promptPath = path.join("./prompts", `${category}.json`);
  if (!(await fs.pathExists(promptPath))) {
    console.error(`❌ 프롬프트 파일 없음: ${promptPath}`);
    return;
  }

  const promptFile: PromptFile = await fs.readJson(promptPath);
  const asset = promptFile.assets.find((a) => a.name === assetName);
  if (!asset) {
    console.error(`❌ 에셋 없음: ${assetName}`);
    console.log(`   사용 가능: ${promptFile.assets.map((a) => a.name).join(", ")}`);
    return;
  }

  await generateAsset(category, asset);
}

// ─── 에셋 목록 ──────────────────────────────────────────

async function listAssets(): Promise<void> {
  const categories = ["player", "enemies", "bosses", "tools", "backgrounds", "equipment"];

  console.log("\n📋 맞짱로 에셋 목록\n");

  for (const cat of categories) {
    const promptPath = path.join("./prompts", `${cat}.json`);
    if (!(await fs.pathExists(promptPath))) continue;

    const promptFile: PromptFile = await fs.readJson(promptPath);
    console.log(`📂 ${cat} (${promptFile.assets.length}개)`);
    for (const asset of promptFile.assets) {
      const existDir = path.join(CONFIG.OUTPUT_DIR, cat, asset.name);
      const exists = await fs.pathExists(existDir);
      const status = exists ? "✅" : "⬜";
      console.log(`   ${status} ${asset.name} — ${asset.frames}프레임 ${asset.size} ${asset.note || ""}`);
    }
    console.log();
  }
}

// ─── 유틸리티 ─────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function printUsage(): void {
  console.log(`
맞짱로 에셋 생성기 (v7 — img2img 참조 방식)
═══════════════════════════════════════

사용법:
  npx tsx generate.ts                              전체 에셋 생성
  npx tsx generate.ts --category player             특정 카테고리 생성
  npx tsx generate.ts --single player player_idle   특정 에셋 하나 생성
  npx tsx generate.ts --sprites                     스프라이트 시트 빌드
  npx tsx generate.ts --sprites player              특정 카테고리 스프라이트 빌드
  npx tsx generate.ts --list                        에셋 목록 확인
`);
}

// ─── 메인 ─────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  process.chdir(
    path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1"))
  );

  if (args.length === 0) {
    console.log("🥊 맞짱로 에셋 생성기 (v7) — 전체 생성 시작\n");
    await generateAll();
    console.log("\n\n🎞️ 스프라이트 시트 빌드 시작\n");
    await buildSprites();
    console.log("\n✅ 전체 완료!");
    return;
  }

  switch (args[0]) {
    case "--category":
      if (!args[1]) {
        console.error("카테고리를 지정하세요: player, enemies, bosses, tools, backgrounds, equipment");
        return;
      }
      await generateCategory(args[1]);
      break;
    case "--single":
      if (!args[1] || !args[2]) {
        console.error("사용법: --single <category> <asset_name>");
        return;
      }
      await generateSingle(args[1], args[2]);
      break;
    case "--sprites":
      await buildSprites(args[1]);
      break;
    case "--list":
      await listAssets();
      break;
    case "--help":
    case "-h":
      printUsage();
      break;
    default:
      console.error(`알 수 없는 명령: ${args[0]}`);
      printUsage();
  }
}

main().catch((err) => {
  console.error("❌ 치명적 오류:", err);
  process.exit(1);
});
