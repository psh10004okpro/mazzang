import sharp from "sharp";
import path from "path";

const DIR = "./output/player";
const files = ["idle.png", "punch_left.png", "punch_right.png", "kick.png"];
const labels = ["idle", "punch_left", "punch_right", "kick"];

async function main() {
  // 각 이미지의 캐릭터 영역(비투명 바운딩박스) 분석
  for (let i = 0; i < files.length; i++) {
    const img = sharp(path.join(DIR, files[i]));
    const meta = await img.metadata();
    console.log(`\n[${labels[i]}] 원본: ${meta.width}x${meta.height}`);

    // 알파 채널 기반으로 캐릭터 바운딩박스 추정 (비흰색 영역)
    const { data, info } = await img
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    let minX = info.width, maxX = 0, minY = info.height, maxY = 0;
    const threshold = 240; // 흰색에 가까운 픽셀은 배경으로 판단

    for (let y = 0; y < info.height; y++) {
      for (let x = 0; x < info.width; x++) {
        const idx = (y * info.width + x) * 4;
        const r = data[idx], g = data[idx + 1], b = data[idx + 2];
        // 흰색이 아닌 픽셀 = 캐릭터 영역
        if (r < threshold || g < threshold || b < threshold) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    const charW = maxX - minX;
    const charH = maxY - minY;
    const ratio = charH / charW;
    const headEstimate = charH / 5; // 5등신 기준 머리 크기

    console.log(`  캐릭터 영역: x(${minX}-${maxX}) y(${minY}-${maxY})`);
    console.log(`  캐릭터 크기: ${charW} x ${charH}`);
    console.log(`  세로/가로 비율: ${ratio.toFixed(2)}`);
    console.log(`  이미지 대비 캐릭터 비율: ${((charW * charH) / (info.width * info.height) * 100).toFixed(1)}%`);
    console.log(`  5등신 기준 머리높이: ~${headEstimate.toFixed(0)}px`);
  }
}

main();
