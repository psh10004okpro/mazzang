import OpenAI from "openai";
import { readFileSync, writeFileSync } from "fs";
import { CONFIG } from "./config.js";

const client = new OpenAI({
  baseURL: CONFIG.API_BASE_URL,
  apiKey: CONFIG.API_KEY,
});

const refImage = readFileSync("./output/player_v2/idle.png");
const refBase64 = refImage.toString("base64");

async function test(label: string, body: Record<string, any>, outFile: string) {
  console.log(`\n── ${label} ──`);
  try {
    const res = await fetch(`${CONFIG.API_BASE_URL}/images/generations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${CONFIG.API_KEY}`,
      },
      body: JSON.stringify(body),
    });
    console.log(`  status: ${res.status}`);
    const json = await res.json() as any;

    if (json.error) {
      console.log(`  error: ${JSON.stringify(json.error).substring(0, 300)}`);
      return;
    }
    if (json.detail) {
      console.log(`  detail: ${JSON.stringify(json.detail).substring(0, 300)}`);
      return;
    }

    console.log(`  keys: ${Object.keys(json)}`);
    if (json.data?.[0]) {
      const d = json.data[0];
      console.log(`  data[0] keys: ${Object.keys(d)}`);
      if (d.b64_json) {
        writeFileSync(outFile, Buffer.from(d.b64_json, "base64"));
        console.log(`  저장: ${outFile}`);
      } else if (d.url) {
        console.log(`  url: ${d.url.substring(0, 100)}`);
        const imgRes = await fetch(d.url);
        writeFileSync(outFile, Buffer.from(await imgRes.arrayBuffer()));
        console.log(`  저장: ${outFile}`);
      }
    }
  } catch (e: any) {
    console.log(`  catch error: ${e.message}`);
  }
}

async function main() {
  const posePrompt =
    "Same character throwing a left jab punch, left fist extended forward, right hand guarding face, same art style, white background";

  // 테스트 1: image 필드에 base64
  await test(
    "Test 1: image field (base64 data URI)",
    {
      model: CONFIG.MODEL,
      prompt: posePrompt,
      n: 1,
      size: "1024x1024",
      image: `data:image/png;base64,${refBase64}`,
    },
    "output/player_v2/img2img_test1.png"
  );

  // 테스트 2: image 필드에 순수 base64
  await test(
    "Test 2: image field (raw base64)",
    {
      model: CONFIG.MODEL,
      prompt: posePrompt,
      n: 1,
      size: "1024x1024",
      image: refBase64,
    },
    "output/player_v2/img2img_test2.png"
  );

  // 테스트 3: extra_body.image
  await test(
    "Test 3: extra_body.image",
    {
      model: CONFIG.MODEL,
      prompt: posePrompt,
      n: 1,
      size: "1024x1024",
      extra_body: {
        image: `data:image/png;base64,${refBase64}`,
      },
    },
    "output/player_v2/img2img_test3.png"
  );

  // 테스트 4: images 배열
  await test(
    "Test 4: images array",
    {
      model: CONFIG.MODEL,
      prompt: posePrompt,
      n: 1,
      size: "1024x1024",
      images: [`data:image/png;base64,${refBase64}`],
    },
    "output/player_v2/img2img_test4.png"
  );

  // 테스트 5: reference_image
  await test(
    "Test 5: reference_image",
    {
      model: CONFIG.MODEL,
      prompt: posePrompt,
      n: 1,
      size: "1024x1024",
      reference_image: `data:image/png;base64,${refBase64}`,
    },
    "output/player_v2/img2img_test5.png"
  );

  // 테스트 6: input_image
  await test(
    "Test 6: input_image",
    {
      model: CONFIG.MODEL,
      prompt: posePrompt,
      n: 1,
      size: "1024x1024",
      input_image: `data:image/png;base64,${refBase64}`,
    },
    "output/player_v2/img2img_test6.png"
  );

  // 테스트 7: chat/completions (Gemini 네이티브 방식)
  console.log("\n── Test 7: chat/completions multimodal ──");
  try {
    const res = await fetch(`${CONFIG.API_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${CONFIG.API_KEY}`,
      },
      body: JSON.stringify({
        model: CONFIG.MODEL,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: { url: `data:image/png;base64,${refBase64}` },
              },
              {
                type: "text",
                text: "Using this exact character, generate a new image of him throwing a left punch. Keep the same style, proportions, outfit. White background.",
              },
            ],
          },
        ],
      }),
    });
    console.log(`  status: ${res.status}`);
    const text = await res.text();
    console.log(`  response: ${text.substring(0, 500)}`);
  } catch (e: any) {
    console.log(`  error: ${e.message}`);
  }

  // 테스트 8: /v1/images/edits
  console.log("\n── Test 8: images/edits ──");
  try {
    const res = await fetch(`${CONFIG.API_BASE_URL}/images/edits`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${CONFIG.API_KEY}`,
      },
      body: JSON.stringify({
        model: CONFIG.MODEL,
        prompt: posePrompt,
        image: `data:image/png;base64,${refBase64}`,
        n: 1,
        size: "1024x1024",
      }),
    });
    console.log(`  status: ${res.status}`);
    const text = await res.text();
    console.log(`  response: ${text.substring(0, 500)}`);
  } catch (e: any) {
    console.log(`  error: ${e.message}`);
  }

  console.log("\n완료!");
}

main().catch(console.error);
