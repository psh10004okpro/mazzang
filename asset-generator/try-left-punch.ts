import { readFileSync, writeFileSync } from "fs";
import { CONFIG, IMG2IMG_SUFFIX, PUNCH_SUFFIX } from "./config.js";

const refBase64 = readFileSync("./output/samples_v2/style_i.png").toString("base64");
const DIR = "./output/player_final/punch_left";

const PROMPTS = [
  "This exact same character. Punching forward with the arm closer to the viewer (the back arm). The front arm stays bent guarding chin. Jab with the rear hand.",
  "This exact same character. Left hand jab. Body rotates so LEFT shoulder comes forward. LEFT fist extended. RIGHT fist guards face. Viewer can see character's back because left shoulder leads.",
  "This exact same character. Throwing a jab with the arm that is behind. Torso twists so back shoulder rotates forward. Back fist punches, front fist at chin.",
  "This exact same character. Left jab punch. Body turned showing more of the back. Left shoulder forward, left fist punching. Right hand near face.",
  "This exact same character. Punching with the near arm closest to camera. Far arm stays bent guarding. Upper body rotated toward viewer.",
  "This exact same character. Cross punch where rear arm crosses over and extends forward. Front arm tucked at chin. Body twists. Rear shoulder comes forward.",
  "This exact same character punching with the arm on the NEAR side. This arm reaches forward. Far arm stays bent. Chest more visible due to body rotation.",
  "This exact same character punching forward. Chest is more visible because body is rotated toward viewer. One fist extended, other fist guards chin.",
  "This exact same character. Jab punch with torso rotated to show chest to viewer. Punching arm is the one closer to viewer. Guard hand near chin. Speed lines.",
  "This exact same character throwing a punch. Chest and stomach visible because body turned toward camera. Near arm punches forward, far arm guards chin.",
];

async function gen(prompt: string): Promise<Buffer> {
  const res = await fetch(`${CONFIG.API_BASE_URL}/images/generations`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${CONFIG.API_KEY}` },
    body: JSON.stringify({
      model: CONFIG.MODEL,
      prompt: `${prompt} ${PUNCH_SUFFIX} ${IMG2IMG_SUFFIX}`,
      n: 1, size: "1024x1024", image: refBase64,
    }),
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  const json = (await res.json()) as any;
  const d = json.data[0];
  if (d.b64_json) return Buffer.from(d.b64_json, "base64");
  if (d.url) { const r = await fetch(d.url); return Buffer.from(await r.arrayBuffer()); }
  throw new Error("no image");
}

async function main() {
  for (let i = 0; i < PROMPTS.length; i++) {
    console.log(`\n시도 ${i + 1}/10...`);
    try {
      const buf = await gen(PROMPTS[i]);
      writeFileSync(`${DIR}/attempt_${i + 1}.png`, buf);
      console.log(`저장: attempt_${i + 1}.png`);
    } catch (e: any) {
      console.error(`실패: ${e.message}`);
    }
  }
  console.log("\n10회 시도 완료");
}

main();
