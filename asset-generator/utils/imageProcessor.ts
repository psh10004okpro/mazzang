import sharp from "sharp";
import fs from "fs-extra";
import path from "path";

/**
 * URL 또는 base64 이미지를 다운로드하여 PNG로 저장
 */
export async function downloadAndSave(
  source: string,
  outputPath: string
): Promise<string> {
  await fs.ensureDir(path.dirname(outputPath));

  if (source.startsWith("data:")) {
    // base64 data URI
    const base64Data = source.split(",")[1];
    const buffer = Buffer.from(base64Data, "base64");
    await fs.writeFile(outputPath, buffer);
  } else if (source.startsWith("http")) {
    // URL
    const response = await fetch(source);
    if (!response.ok) {
      throw new Error(`이미지 다운로드 실패: ${response.status} ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    await fs.writeFile(outputPath, Buffer.from(arrayBuffer));
  } else {
    throw new Error(`지원하지 않는 소스 형식: ${source.substring(0, 50)}`);
  }

  console.log(`  💾 저장: ${outputPath}`);
  return outputPath;
}

/**
 * 이미지 리사이즈
 */
export async function resizeImage(
  inputPath: string,
  outputPath: string,
  width: number,
  height: number,
  options?: { fit?: keyof sharp.FitEnum; background?: sharp.Color }
): Promise<string> {
  await fs.ensureDir(path.dirname(outputPath));

  await sharp(inputPath)
    .resize(width, height, {
      fit: options?.fit ?? "contain",
      background: options?.background ?? { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toFile(outputPath);

  console.log(`  📐 리사이즈: ${width}x${height} → ${outputPath}`);
  return outputPath;
}

/**
 * 흰색/단색 배경을 투명으로 변환
 * threshold: 색상 유사도 허용 범위 (0~255, 기본 30)
 */
export async function removeBackground(
  inputPath: string,
  outputPath: string,
  options?: {
    targetColor?: { r: number; g: number; b: number };
    threshold?: number;
  }
): Promise<string> {
  await fs.ensureDir(path.dirname(outputPath));

  const target = options?.targetColor ?? { r: 255, g: 255, b: 255 };
  const threshold = options?.threshold ?? 30;

  const image = sharp(inputPath);
  const metadata = await image.metadata();
  const { width, height } = metadata;

  if (!width || !height) {
    throw new Error("이미지 메타데이터를 읽을 수 없습니다.");
  }

  // raw RGBA 픽셀 데이터 추출
  const { data, info } = await image
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixels = Buffer.from(data);

  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];

    const distance = Math.sqrt(
      (r - target.r) ** 2 + (g - target.g) ** 2 + (b - target.b) ** 2
    );

    if (distance <= threshold) {
      // 배경 픽셀 → 투명화
      pixels[i + 3] = 0;
    } else if (distance <= threshold * 2) {
      // 경계 영역 → 부분 투명 (안티앨리어싱)
      const alpha = Math.round(
        ((distance - threshold) / threshold) * 255
      );
      pixels[i + 3] = Math.min(pixels[i + 3], alpha);
    }
  }

  await sharp(pixels, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png()
    .toFile(outputPath);

  console.log(`  🔲 배경 제거: ${outputPath}`);
  return outputPath;
}

/**
 * PNG → WebP 변환
 */
export async function convertToWebP(
  inputPath: string,
  outputPath?: string,
  quality: number = 90
): Promise<string> {
  const out = outputPath ?? inputPath.replace(/\.png$/i, ".webp");
  await fs.ensureDir(path.dirname(out));

  await sharp(inputPath).webp({ quality, lossless: false }).toFile(out);

  console.log(`  🌐 WebP 변환: ${out}`);
  return out;
}

/**
 * 이미지 처리 파이프라인: 다운로드 → 리사이즈 → 배경 제거 → 저장
 */
export async function processImage(
  source: string,
  outputPath: string,
  options?: {
    width?: number;
    height?: number;
    removeBg?: boolean;
    bgThreshold?: number;
    webp?: boolean;
  }
): Promise<{ png: string; webp?: string }> {
  const tempPath = outputPath.replace(/\.png$/, "_raw.png");

  // 1. 다운로드
  await downloadAndSave(source, tempPath);

  let currentPath = tempPath;

  // 2. 리사이즈 (옵션)
  if (options?.width && options?.height) {
    const resizedPath = outputPath.replace(/\.png$/, "_resized.png");
    await resizeImage(currentPath, resizedPath, options.width, options.height);
    await fs.remove(currentPath);
    currentPath = resizedPath;
  }

  // 3. 배경 제거 (옵션)
  if (options?.removeBg !== false) {
    const bgRemovedPath = outputPath;
    await removeBackground(currentPath, bgRemovedPath, {
      threshold: options?.bgThreshold ?? 30,
    });
    if (currentPath !== outputPath) await fs.remove(currentPath);
    currentPath = bgRemovedPath;
  } else {
    // 배경 제거 안 할 경우 최종 경로로 이동
    if (currentPath !== outputPath) {
      await fs.move(currentPath, outputPath, { overwrite: true });
      currentPath = outputPath;
    }
  }

  const result: { png: string; webp?: string } = { png: currentPath };

  // 4. WebP 변환 (옵션)
  if (options?.webp) {
    result.webp = await convertToWebP(currentPath);
  }

  return result;
}
