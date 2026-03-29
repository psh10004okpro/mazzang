import sharp from "sharp";
import { readFileSync, writeFileSync } from "fs";
import { CONFIG, IMG2IMG_SUFFIX, PUNCH_SUFFIX } from "./config.js";

const OUTPUT_DIR = "./output/player_final/punch_left";
const FRAME_SIZE = 256;
const refBase64 = readFileSync("./output/samples_v2/style_i.png").toString("base64");

// 다양한 프롬프트 시도 — 왼손 펀치를 구분하기 위한 표현들
const ATTEMPTS = [
  // 1: 뒤쪽 팔 강조
  `This exact same character. Punching forward with the arm closer to the viewer (the back arm). The front arm stays bent guarding chin. Jab with the rear hand. ${PUNCH_SUFFIX} ${IMG2IMG_SUFFIX}`,
  // 2: 어깨 회전 강조
  `This exact same character. Left hand jab punch. The character's body rotates so the LEFT shoulder comes forward. LEFT fist extended. RIGHT fist guards face. The viewer can see the character's back because the left shoulder leads. ${PUNCH_SUFFIX} ${IMG2IMG_SUFFIX}`,
  // 3: 아예 다른 각도 — 상체 회전
  `This exact same character. Throwing a jab with the arm that is currently behind/closer to viewer. The torso twists so the back shoulder rotates forward. Back fist punches forward, front fist stays at chin. ${PUNCH_SUFFIX} ${IMG2IMG_SUFFIX}`,
  // 4: 심플하게
  `This exact same character. Left jab punch. Body turned showing more of the back. Left shoulder forward, left fist punching. Right hand near face. ${PUNCH_SUFFIX} ${IMG2IMG_SUFFIX}`,
  // 5: 뷰어 기준
  `This exact same character. Punching with the near arm (the arm closest to the camera). The far arm stays bent guarding. Upper body rotated toward viewer. ${PUNCH_SUFFIX} ${IMG2IMG_SUFFIX}`,
  // 6: cross punch 표현
  `This exact same character. Cross punch where the rear arm crosses over and extends forward. Front arm tucked at chin. Body twists to deliver the cross. Rear shoulder comes forward. ${PUNCH_SUFFIX} ${IMG2IMG_SUFFIX}`,
  // 7: 극단적 표현
  `This exact same character. The character is punching with the arm on the NEAR side (viewer side). This arm reaches forward. The far arm stays bent. We can see the character's chest because of the body rotation. ${PUNCH_SUFFIX} ${IMG2IMG_SUFFIX}`,
  // 8: 매우 심플
  `This exact same character punching forward. His chest is more visible because his body is rotated toward the viewer. One fist extended, other fist guards chin. ${PUNCH_SUFFIX} ${IMG2IMG_SUFFIX}`,
  // 9: 명확한 신체 방향
  `This exact same character. Jab punch with torso rotated to show chest to viewer. The punching arm is the one closer to viewer. Guard hand near chin. Speed lines on fist. ${PUNCH_SUFFIX} ${IMG2IMG_SUFFIX}`,
  // 10: 최후 시도
  `This exact same character throwing a punch. His chest and stomach are visible because body is turned toward camera. Near arm punches forward, far arm guards chin. ${PUNCH_SUFFIX} ${IMG2IMG_SUFFIX}`,
];

async function generateWithRef(prompt: string): Promise<Buffer> {
  const res = await fetch(`${CONFIG.API_BASE_URL}/images/generations`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${CONFIG.API_KEY}` },
    body: JSON.stringify({ model: CONFIG.MODEL, prompt, n: 1, size: "1024x1024", image: refBase64 }),
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  const json = (await res.json()) as any;
  const data = json.data?.[0];
  if (data.b64_json) return Buffer.from(data.b64_json, "base64");
  if (data.url) { const r = await fetch(data.url); return Buffer.from(await r.arrayBuffer()); }
  throw new Error("no image");
}

async function main() {
  for (let i = 0; i < ATTEMPTS.length; i++) {
    console.log(`\n── 시도 ${i + 1}/10 ──`);
    console.log(`프롬프트: ${ATTEMPTS[i].substring(0, 80)}...`);

    try {
      const buf = await generateWithRef(ATTEMPTS[i]);
      const outPath = `${OUTPUT_DIR}/attempt_${i + 1}.png`;
      writeFileSync(outPath, buf);
      console.log(`저장: ${outPath}`);
      console.log(">>> 확인 필요: 왼손 펀치가 오른손 펀치와 구분되는지 체크 <<<");

      // 여기서 중단 — 사용자가 확인
      break;
    } catch (e: any) {
      console.error(`실패: ${e.message}`);
    }
  }
}

main().catch(console.error);
