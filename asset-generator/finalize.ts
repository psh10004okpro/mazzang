import { readdirSync, statSync, existsSync, mkdirSync, copyFileSync, writeFileSync } from "fs";
import path from "path";

const SPRITE_DIR = "./sprites";
const GAME_ASSETS_DIR = "../public/assets";
const MANIFEST_PATH = "./asset-manifest.json";
const REPORT_PATH = "./asset-report.txt";

// ─── 파일 스캔 ────────────────────────────────────────────

interface FileInfo {
  path: string;
  size: number;
  category: string;
  ext: string;
}

function scanDir(dir: string, category: string): FileInfo[] {
  const results: FileInfo[] = [];
  if (!existsSync(dir)) return results;

  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...scanDir(fullPath, category));
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if ([".png", ".webp", ".jpg", ".jpeg", ".json"].includes(ext)) {
        results.push({
          path: fullPath,
          size: statSync(fullPath).size,
          category,
          ext,
        });
      }
    }
  }
  return results;
}

// ─── 매니페스트 생성 ──────────────────────────────────────

function buildManifest(): Record<string, any> {
  const manifest: Record<string, any> = {
    version: "1.0.0",
    generatedAt: new Date().toISOString(),
    player: {} as Record<string, string>,
    enemies: {} as Record<string, string>,
    bosses: {} as Record<string, string>,
    tools: {} as Record<string, string>,
    backgrounds: {} as Record<string, string>,
    equipment: {} as Record<string, string>,
    ui: {} as Record<string, string>,
  };

  // Player
  const playerDir = `${SPRITE_DIR}/player`;
  if (existsSync(playerDir)) {
    for (const f of readdirSync(playerDir).filter(f => f.endsWith(".webp"))) {
      const key = f.replace(".webp", "").replace("player_", "");
      manifest.player[key] = `assets/player/${f}`;
    }
  }

  // Enemies
  const enemiesDir = `${SPRITE_DIR}/enemies`;
  if (existsSync(enemiesDir)) {
    for (const f of readdirSync(enemiesDir).filter(f => f.endsWith(".webp"))) {
      const key = f.replace(".webp", "");
      manifest.enemies[key] = `assets/enemies/${f}`;
    }
  }

  // Bosses
  const bossesDir = `${SPRITE_DIR}/bosses`;
  if (existsSync(bossesDir)) {
    for (const f of readdirSync(bossesDir).filter(f => f.endsWith(".webp") && !f.includes("catalog"))) {
      const key = f.replace(".webp", "");
      manifest.bosses[key] = `assets/bosses/${f}`;
    }
  }

  // Tools
  const toolsDir = `${SPRITE_DIR}/tools`;
  if (existsSync(toolsDir)) {
    for (const f of readdirSync(toolsDir).filter(f => f.endsWith(".webp"))) {
      const key = f.replace(".webp", "");
      manifest.tools[key] = `assets/tools/${f}`;
    }
  }

  // Backgrounds
  const bgDir = `${SPRITE_DIR}/backgrounds`;
  if (existsSync(bgDir)) {
    for (const f of readdirSync(bgDir).filter(f => f.endsWith(".webp"))) {
      const key = f.replace(".webp", "");
      manifest.backgrounds[key] = `assets/backgrounds/${f}`;
    }
  }

  // Equipment
  const equipDir = `${SPRITE_DIR}/equipment`;
  if (existsSync(equipDir)) {
    for (const f of readdirSync(equipDir).filter(f => f.endsWith(".webp") && !f.includes("catalog"))) {
      const key = f.replace(".webp", "");
      manifest.equipment[key] = `assets/equipment/${f}`;
    }
  }

  // UI
  const uiDir = `${SPRITE_DIR}/ui`;
  if (existsSync(uiDir)) {
    for (const f of readdirSync(uiDir).filter(f => f.endsWith(".webp"))) {
      const key = f.replace(".webp", "");
      manifest.ui[key] = `assets/ui/${f}`;
    }
  }

  return manifest;
}

// ─── 용량 리포트 ──────────────────────────────────────────

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── 게임 프로젝트에 복사 ─────────────────────────────────

function copyToGame() {
  const categories = ["player", "enemies", "bosses", "tools", "backgrounds", "equipment", "ui"];

  for (const cat of categories) {
    const srcDir = `${SPRITE_DIR}/${cat}`;
    const destDir = `${GAME_ASSETS_DIR}/${cat}`;

    if (!existsSync(srcDir)) continue;
    mkdirSync(destDir, { recursive: true });

    const files = readdirSync(srcDir).filter(f => f.endsWith(".webp") || f.endsWith(".json"));
    for (const file of files) {
      copyFileSync(path.join(srcDir, file), path.join(destDir, file));
    }
  }

  // 배경은 jpg도 복사 (webp 없을 수 있으므로)
  const bgSrc = `${SPRITE_DIR}/backgrounds`;
  const bgDest = `${GAME_ASSETS_DIR}/backgrounds`;
  if (existsSync(bgSrc)) {
    for (const f of readdirSync(bgSrc).filter(f => f.endsWith(".jpg"))) {
      copyFileSync(path.join(bgSrc, f), path.join(bgDest, f));
    }
  }
}

// ─── 메인 ─────────────────────────────────────────────────

function main() {
  console.log("📦 맞짱로 에셋 최종 통합\n");

  // 1. 스캔
  const categories = ["player", "enemies", "bosses", "tools", "backgrounds", "equipment", "ui"];
  const allFiles: FileInfo[] = [];
  for (const cat of categories) {
    allFiles.push(...scanDir(`${SPRITE_DIR}/${cat}`, cat));
  }

  // 2. 매니페스트
  console.log("📋 매니페스트 생성...");
  const manifest = buildManifest();
  writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
  console.log(`  ✅ ${MANIFEST_PATH}`);

  // 3. 용량 리포트
  console.log("\n📊 용량 리포트 생성...");

  const catStats: Record<string, { png: { count: number; size: number }; webp: { count: number; size: number }; other: { count: number; size: number } }> = {};

  for (const cat of categories) {
    catStats[cat] = { png: { count: 0, size: 0 }, webp: { count: 0, size: 0 }, other: { count: 0, size: 0 } };
  }

  for (const f of allFiles) {
    const stat = catStats[f.category];
    if (!stat) continue;
    if (f.ext === ".png") { stat.png.count++; stat.png.size += f.size; }
    else if (f.ext === ".webp") { stat.webp.count++; stat.webp.size += f.size; }
    else { stat.other.count++; stat.other.size += f.size; }
  }

  let totalPng = 0, totalWebp = 0, totalOther = 0;
  let totalPngSize = 0, totalWebpSize = 0, totalOtherSize = 0;

  const lines: string[] = [
    "═══════════════════════════════════════════════════",
    "  맞짱로 에셋 용량 리포트",
    `  생성일: ${new Date().toISOString()}`,
    "═══════════════════════════════════════════════════",
    "",
    "카테고리별 현황:",
    "─────────────────────────────────────────────────",
    `${"카테고리".padEnd(14)} ${"PNG".padStart(6)} ${"PNG용량".padStart(10)} ${"WebP".padStart(6)} ${"WebP용량".padStart(10)}`,
    "─────────────────────────────────────────────────",
  ];

  for (const cat of categories) {
    const s = catStats[cat];
    totalPng += s.png.count;
    totalWebp += s.webp.count;
    totalOther += s.other.count;
    totalPngSize += s.png.size;
    totalWebpSize += s.webp.size;
    totalOtherSize += s.other.size;

    lines.push(
      `${cat.padEnd(14)} ${String(s.png.count).padStart(6)} ${formatSize(s.png.size).padStart(10)} ${String(s.webp.count).padStart(6)} ${formatSize(s.webp.size).padStart(10)}`
    );
  }

  lines.push("─────────────────────────────────────────────────");
  lines.push(
    `${"합계".padEnd(14)} ${String(totalPng).padStart(6)} ${formatSize(totalPngSize).padStart(10)} ${String(totalWebp).padStart(6)} ${formatSize(totalWebpSize).padStart(10)}`
  );
  lines.push("");
  lines.push(`총 파일 수: ${allFiles.length}`);
  lines.push(`PNG 총 용량: ${formatSize(totalPngSize)}`);
  lines.push(`WebP 총 용량: ${formatSize(totalWebpSize)}`);
  lines.push(`기타 (JSON 등): ${totalOther}개, ${formatSize(totalOtherSize)}`);
  lines.push(`WebP 절약률: ${totalPngSize > 0 ? ((1 - totalWebpSize / totalPngSize) * 100).toFixed(1) : 0}%`);
  lines.push("");

  const report = lines.join("\n");
  writeFileSync(REPORT_PATH, report);
  console.log(report);
  console.log(`  ✅ ${REPORT_PATH}`);

  // 4. 게임 프로젝트에 복사
  console.log("\n📁 게임 프로젝트에 복사...");
  copyToGame();

  // 매니페스트도 복사
  mkdirSync(GAME_ASSETS_DIR, { recursive: true });
  copyFileSync(MANIFEST_PATH, path.join(GAME_ASSETS_DIR, "asset-manifest.json"));

  console.log(`  ✅ ${GAME_ASSETS_DIR}/`);
  console.log("\n✅ 최종 통합 완료!");
}

main();
