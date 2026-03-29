import sharp from "sharp";
import fs from "fs-extra";
import path from "path";

interface SpriteSheetOptions {
  /** 각 프레임의 통일 너비 */
  frameWidth: number;
  /** 각 프레임의 통일 높이 */
  frameHeight: number;
  /** 프레임 간 패딩 (기본 0) */
  padding?: number;
  /** 가로 배치 (기본 true) / 세로 배치 */
  horizontal?: boolean;
}

interface SpriteSheetResult {
  /** 생성된 스프라이트 시트 경로 */
  path: string;
  /** 프레임 수 */
  frameCount: number;
  /** 프레임 너비 */
  frameWidth: number;
  /** 프레임 높이 */
  frameHeight: number;
  /** 전체 시트 너비 */
  sheetWidth: number;
  /** 전체 시트 높이 */
  sheetHeight: number;
}

/**
 * 여러 프레임 이미지를 하나의 스프라이트 시트로 조합
 */
export async function createSpriteSheet(
  framePaths: string[],
  outputPath: string,
  options: SpriteSheetOptions
): Promise<SpriteSheetResult> {
  const {
    frameWidth,
    frameHeight,
    padding = 0,
    horizontal = true,
  } = options;

  if (framePaths.length === 0) {
    throw new Error("프레임 이미지가 없습니다.");
  }

  await fs.ensureDir(path.dirname(outputPath));

  const frameCount = framePaths.length;
  const cellWidth = frameWidth + padding;
  const cellHeight = frameHeight + padding;

  const sheetWidth = horizontal
    ? cellWidth * frameCount - padding
    : frameWidth;
  const sheetHeight = horizontal
    ? frameHeight
    : cellHeight * frameCount - padding;

  // 각 프레임을 통일 크기로 리사이즈
  const resizedFrames: Buffer[] = [];
  for (const framePath of framePaths) {
    const buf = await sharp(framePath)
      .resize(frameWidth, frameHeight, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toBuffer();
    resizedFrames.push(buf);
  }

  // 스프라이트 시트 합성
  const composites: sharp.OverlayOptions[] = resizedFrames.map((buf, i) => ({
    input: buf,
    left: horizontal ? i * cellWidth : 0,
    top: horizontal ? 0 : i * cellHeight,
  }));

  await sharp({
    create: {
      width: sheetWidth,
      height: sheetHeight,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(composites)
    .png()
    .toFile(outputPath);

  const result: SpriteSheetResult = {
    path: outputPath,
    frameCount,
    frameWidth,
    frameHeight,
    sheetWidth,
    sheetHeight,
  };

  console.log(
    `  🎞️ 스프라이트 시트 생성: ${frameCount}프레임 ${sheetWidth}x${sheetHeight} → ${outputPath}`
  );

  return result;
}

/**
 * 특정 카테고리의 모든 에셋에 대해 스프라이트 시트를 일괄 생성
 * outputDir/[assetName]/ 폴더 내의 frame_*.png 파일들을 시트로 조합
 */
export async function buildSpriteSheetsForCategory(
  categoryOutputDir: string,
  spriteOutputDir: string,
  defaultFrameSize: { width: number; height: number }
): Promise<SpriteSheetResult[]> {
  await fs.ensureDir(spriteOutputDir);

  const assetDirs = await fs.readdir(categoryOutputDir);
  const results: SpriteSheetResult[] = [];

  for (const assetName of assetDirs) {
    const assetDir = path.join(categoryOutputDir, assetName);
    const stat = await fs.stat(assetDir);
    if (!stat.isDirectory()) continue;

    const files = (await fs.readdir(assetDir))
      .filter((f) => f.startsWith("frame_") && f.endsWith(".png"))
      .sort()
      .map((f) => path.join(assetDir, f));

    if (files.length === 0) continue;

    const sheetPath = path.join(spriteOutputDir, `${assetName}.png`);
    const result = await createSpriteSheet(files, sheetPath, {
      frameWidth: defaultFrameSize.width,
      frameHeight: defaultFrameSize.height,
      padding: 1,
    });
    results.push(result);
  }

  return results;
}

/**
 * 스프라이트 시트 메타데이터 JSON 생성 (게임 엔진에서 사용)
 */
export async function writeSpriteMetadata(
  result: SpriteSheetResult,
  metadataPath: string
): Promise<void> {
  const metadata = {
    image: path.basename(result.path),
    frameCount: result.frameCount,
    frameWidth: result.frameWidth,
    frameHeight: result.frameHeight,
    sheetWidth: result.sheetWidth,
    sheetHeight: result.sheetHeight,
    frames: Array.from({ length: result.frameCount }, (_, i) => ({
      index: i,
      x: i * (result.frameWidth + 1), // +1 for padding
      y: 0,
      w: result.frameWidth,
      h: result.frameHeight,
    })),
  };

  await fs.writeJson(metadataPath, metadata, { spaces: 2 });
  console.log(`  📋 메타데이터: ${metadataPath}`);
}
