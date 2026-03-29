import { readdirSync, copyFileSync, existsSync, mkdirSync, writeFileSync, statSync } from "fs";
import path from "path";

const FINAL_DIR = "./final";
const SPRITE_DIR = "./sprites";

// 폴더 구조
const DIRS = [
  "player",
  "enemies",
  "bosses",
  "tools",
  "backgrounds/battle",
  "backgrounds/scene",
  "equipment",
  "ui/effects",
  "ui/icons",
  "ui/buttons",
];

function ensureDirs() {
  for (const d of DIRS) {
    mkdirSync(`${FINAL_DIR}/${d}`, { recursive: true });
  }
}

function copyFiles(srcDir: string, destDir: string, filter?: (f: string) => boolean) {
  if (!existsSync(srcDir)) return 0;
  const files = readdirSync(srcDir).filter(f => {
    if (filter && !filter(f)) return false;
    return f.endsWith(".webp") || f.endsWith(".json");
  });
  for (const f of files) {
    copyFileSync(path.join(srcDir, f), path.join(destDir, f));
  }
  return files.length;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getDirSize(dir: string): { count: number; size: number } {
  if (!existsSync(dir)) return { count: 0, size: 0 };
  let count = 0, size = 0;
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const fp = path.join(dir, e.name);
    if (e.isDirectory()) {
      const sub = getDirSize(fp);
      count += sub.count;
      size += sub.size;
    } else {
      count++;
      size += statSync(fp).size;
    }
  }
  return { count, size };
}

function main() {
  console.log("📦 최종 에셋 정리 → final/ 폴더\n");

  ensureDirs();
  let totalFiles = 0;

  // 1. 주인공
  let n = copyFiles(`${SPRITE_DIR}/player`, `${FINAL_DIR}/player`);
  totalFiles += n;
  console.log(`✅ player: ${n}파일`);

  // 2. 잡졸
  n = copyFiles(`${SPRITE_DIR}/enemies`, `${FINAL_DIR}/enemies`);
  totalFiles += n;
  console.log(`✅ enemies: ${n}파일`);

  // 3. 보스
  n = copyFiles(`${SPRITE_DIR}/bosses`, `${FINAL_DIR}/bosses`);
  totalFiles += n;
  console.log(`✅ bosses: ${n}파일`);

  // 4. 수련 도구
  n = copyFiles(`${SPRITE_DIR}/tools`, `${FINAL_DIR}/tools`);
  totalFiles += n;
  console.log(`✅ tools: ${n}파일`);

  // 5. 배경 — battle(배경만) / scene(캐릭터+배경) 분리
  n = copyFiles(`${SPRITE_DIR}/backgrounds`, `${FINAL_DIR}/backgrounds/battle`,
    f => !f.includes("_scene"));
  totalFiles += n;
  console.log(`✅ backgrounds/battle: ${n}파일`);

  n = copyFiles(`${SPRITE_DIR}/backgrounds`, `${FINAL_DIR}/backgrounds/scene`,
    f => f.includes("_scene"));
  totalFiles += n;
  console.log(`✅ backgrounds/scene: ${n}파일`);

  // 6. 장비 외형
  n = copyFiles(`${SPRITE_DIR}/equipment`, `${FINAL_DIR}/equipment`);
  totalFiles += n;
  console.log(`✅ equipment: ${n}파일`);

  // 7. UI — effects / icons / buttons 분리
  if (existsSync(`${SPRITE_DIR}/ui`)) {
    const uiFiles = readdirSync(`${SPRITE_DIR}/ui`).filter(f => f.endsWith(".webp"));
    for (const f of uiFiles) {
      let dest: string;
      if (f.includes("impact") || f.includes("ko_effect")) {
        dest = `${FINAL_DIR}/ui/effects/${f}`;
      } else if (f.includes("btn_")) {
        dest = `${FINAL_DIR}/ui/buttons/${f}`;
      } else {
        dest = `${FINAL_DIR}/ui/icons/${f}`;
      }
      copyFileSync(`${SPRITE_DIR}/ui/${f}`, dest);
      totalFiles++;
    }
    console.log(`✅ ui: ${uiFiles.length}파일`);
  }

  // 8. 매니페스트
  if (existsSync("./asset-manifest.json")) {
    copyFileSync("./asset-manifest.json", `${FINAL_DIR}/asset-manifest.json`);
    totalFiles++;
  }

  // 9. 용량 리포트
  console.log("\n═══════════════════════════════════════");
  console.log("  최종 에셋 용량 리포트");
  console.log("═══════════════════════════════════════\n");

  const categories = [
    { label: "주인공 (player)", dir: "player" },
    { label: "잡졸 (enemies)", dir: "enemies" },
    { label: "보스 (bosses)", dir: "bosses" },
    { label: "수련 도구 (tools)", dir: "tools" },
    { label: "배경-배틀 (backgrounds/battle)", dir: "backgrounds/battle" },
    { label: "배경-씬 (backgrounds/scene)", dir: "backgrounds/scene" },
    { label: "장비 외형 (equipment)", dir: "equipment" },
    { label: "이펙트 (ui/effects)", dir: "ui/effects" },
    { label: "아이콘 (ui/icons)", dir: "ui/icons" },
    { label: "버튼 (ui/buttons)", dir: "ui/buttons" },
  ];

  let grandTotal = 0;
  let grandSize = 0;
  const lines: string[] = [];

  for (const cat of categories) {
    const { count, size } = getDirSize(`${FINAL_DIR}/${cat.dir}`);
    grandTotal += count;
    grandSize += size;
    const line = `  ${cat.label.padEnd(35)} ${String(count).padStart(4)}파일  ${formatSize(size).padStart(10)}`;
    console.log(line);
    lines.push(line);
  }

  console.log("─────────────────────────────────────");
  console.log(`  ${"합계".padEnd(35)} ${String(grandTotal).padStart(4)}파일  ${formatSize(grandSize).padStart(10)}`);
  console.log();

  // 리포트 파일 저장
  const report = [
    "맞짱로 에셋 최종 리포트",
    `생성일: ${new Date().toISOString()}`,
    "",
    ...lines,
    "─────────────────────────────────────",
    `  합계: ${grandTotal}파일, ${formatSize(grandSize)}`,
    "",
    "폴더 구조:",
    "final/",
    "├── player/          주인공 스프라이트 시트",
    "├── enemies/         잡졸 20골목 스프라이트 시트",
    "├── bosses/          보스 20종 스프라이트 시트 + 카탈로그",
    "├── tools/           수련 도구 5등급 스프라이트 시트",
    "├── backgrounds/",
    "│   ├── battle/      배틀 배경 (캐릭터 없음)",
    "│   └── scene/       씬 일러스트 (캐릭터+배경)",
    "├── equipment/       장비 외형 20종 스프라이트 시트 + 카탈로그",
    "├── ui/",
    "│   ├── effects/     타격 이펙트 스프라이트 시트",
    "│   ├── icons/       상태 아이콘",
    "│   └── buttons/     버튼 에셋",
    "└── asset-manifest.json",
  ].join("\n");

  writeFileSync(`${FINAL_DIR}/ASSET-REPORT.txt`, report);

  console.log(`\n✅ 완료! final/ 폴더에 ${grandTotal}파일 (${formatSize(grandSize)})`);
}

main();
