import OpenAI from "openai";
import { readFileSync, writeFileSync } from "fs";
import { CONFIG } from "./config.js";

// Gemini image generation은 chat completions의 멀티모달 입력으로
// 참조 이미지 + 텍스트 프롬프트를 함께 보낼 수 있음.
// OpenAI 호환 API의 images.generate 대신 chat.completions를 사용해본다.

const client = new OpenAI({
  baseURL: CONFIG.API_BASE_URL,
  apiKey: CONFIG.API_KEY,
});

async function main() {
  // idle.png를 참조 이미지로 사용
  const refImage = readFileSync("./output/player/idle.png");
  const refBase64 = refImage.toString("base64");

  console.log("참조 이미지(idle.png) 기반 왼손 펀치 생성 테스트...");
  console.log("방법 1: chat.completions 멀티모달 (이미지 입력 + 텍스트)");

  try {
    const response = await client.chat.completions.create({
      model: CONFIG.MODEL,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: {
                url: `data:image/png;base64,${refBase64}`,
              },
            },
            {
              type: "text",
              text: `Using this exact same character (same face, hair, body proportions, outfit, art style, line weight, and coloring), generate a new image of him throwing a left jab punch. His left fist should be extended forward with speed lines behind it, right hand guarding his face. Same white background. Same bold outlines and cel-shaded style. Keep the character's proportions, head size, body width, and leg length exactly the same as the reference image. Only change the pose.`,
            },
          ],
        },
      ],
    });

    console.log("응답:", JSON.stringify(response.choices[0].message, null, 2).substring(0, 500));

    // 응답에서 이미지 추출 시도
    const msg = response.choices[0].message;
    if (msg.content) {
      // base64 이미지가 content에 포함되어 있는지 확인
      const b64Match = msg.content.match(/data:image\/[^;]+;base64,([A-Za-z0-9+/=]+)/);
      if (b64Match) {
        writeFileSync("./output/player/punch_left_ref.png", Buffer.from(b64Match[1], "base64"));
        console.log("이미지 추출 저장 완료");
      } else {
        console.log("텍스트 응답 (이미지 아님):", msg.content.substring(0, 300));
      }
    }

    // parts가 있는 경우 (Gemini 스타일 응답)
    const anyMsg = msg as any;
    if (anyMsg.parts) {
      for (const part of anyMsg.parts) {
        if (part.inline_data) {
          writeFileSync(
            "./output/player/punch_left_ref.png",
            Buffer.from(part.inline_data.data, "base64")
          );
          console.log("parts에서 이미지 추출 저장 완료");
        }
      }
    }
  } catch (e: any) {
    console.error("방법 1 실패:", e.message);
    if (e.response) {
      console.error("상태:", e.response.status);
    }
  }

  // 방법 2: images.edit (OpenAI 호환)
  console.log("\n방법 2: images.edit 시도...");
  try {
    const response = await (client.images as any).edit({
      model: CONFIG.MODEL,
      image: new File([refImage], "idle.png", { type: "image/png" }),
      prompt: "Same character throwing a left jab punch, left fist extended forward with speed lines, right hand guarding face, same art style and proportions, white background",
      n: 1,
      size: "1024x1024",
    });
    console.log("edit 응답:", JSON.stringify(response.data[0]).substring(0, 200));
  } catch (e: any) {
    console.error("방법 2 실패:", e.message);
  }
}

main().catch(console.error);
