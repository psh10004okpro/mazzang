import sharp from "sharp";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { CONFIG } from "./config.js";

const SPRITE_DIR = "./sprites/ui";
const OUTPUT_DIR = "./output/ui/buttons";
const styleRefBase64 = readFileSync("./output/samples_v2/style_i.png").toString("base64");

const STYLE = "2D mobile game UI button, Korean webtoon cartoon art style, bold outlines, cel-shaded, stylized game interface element";

const BUTTONS = [
  {
    name: "btn_normal",
    title: "일반 버튼",
    prompt: `${STYLE}, dark metallic game button, rounded rectangle shape, dark steel gradient with subtle blue tint, riveted edges, embossed border, clean game UI panel, solid dark background, no text no characters`,
  },
  {
    name: "btn_highlight",
    title: "강조 버튼",
    prompt: `${STYLE}, glowing golden action button, rounded rectangle shape, orange-gold gradient center, bright glowing golden border, energy pulse effect, premium call-to-action game button, dark background, no text no characters`,
  },
  {
    name: "btn_disabled",
    title: "비활성 버튼",
    prompt: `${STYLE}, disabled gray game button, rounded rectangle shape, flat dark gray, desaturated muted colors, dimmed inactive look, no glow no shine, game UI inactive panel, solid dark gray background, no text no characters`,
  },
];

async function gen(prompt: string): Promise<Buffer> {
  const res = await fetch(`${CONFIG.API_BASE_URL}/images/generations`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${CONFIG.API_KEY}` },
    body: JSON.stringify({ model: CONFIG.MODEL, prompt, n: 1, size: "1024x1024", image: styleRefBase64 }),
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  const json = (await res.json()) as any;
  const d = json.data[0];
  if (d.b64_json) return Buffer.from(d.b64_json, "base64");
  if (d.url) { const r = await fetch(d.url); return Buffer.from(await r.arrayBuffer()); }
  throw new Error("no image");
}

async function main() {
  console.log("🔘 버튼 에셋 재생성 (카툰 게임 스타일)\n");

  for (const btn of BUTTONS) {
    const rawPath = `${OUTPUT_DIR}/${btn.name}_raw.png`;
    const spritePath = `${SPRITE_DIR}/${btn.name}.png`;
    const webpPath = `${SPRITE_DIR}/${btn.name}.webp`;

    console.log(`${btn.title}...`);

    for (let a = 1; a <= 3; a++) {
      try {
        const buf = await gen(btn.prompt);
        writeFileSync(rawPath, buf);

        // 버튼은 배경 제거 없이, 가로 직사각형으로 크롭 (3:1 비율)
        const resized = await sharp(buf)
          .resize(384, 128, { fit: "cover" })
          .png().toBuffer();

        writeFileSync(spritePath, resized);
        await sharp(resized).webp({ quality: 90 }).toFile(webpPath);

        console.log(`  ✅ ${btn.name}`);
        break;
      } catch (e: any) {
        console.error(`  ⚠️ 시도 ${a}: ${e.message}`);
        if (a < 3) await new Promise(r => setTimeout(r, 3000));
      }
    }
  }

  console.log("\n✅ 완료");
}

main().catch(console.error);
