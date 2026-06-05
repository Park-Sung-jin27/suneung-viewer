import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env"), override: true });

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// 정답표 입력 형식: PDF + 이미지(png/jpg/webp) 지원
//   2027학년도 6월 모평부터 정답표가 PNG 로 배포됨 (2026-06-05) — 본체 직접 수정 (일회성 변환 스크립트 금지 원칙)
const IMAGE_TYPES = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

function buildSourceBlock(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const data = fs.readFileSync(filePath).toString("base64");
  if (ext === ".pdf") {
    return {
      type: "document",
      source: { type: "base64", media_type: "application/pdf", data },
    };
  }
  const mediaType = IMAGE_TYPES[ext];
  if (!mediaType) {
    throw new Error(
      `지원하지 않는 정답표 형식: ${ext} (지원: .pdf, ${Object.keys(IMAGE_TYPES).join(", ")})`,
    );
  }
  return {
    type: "image",
    source: { type: "base64", media_type: mediaType, data },
  };
}

export async function extractAnswers(answerPath) {
  const response = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 1024,
    system:
      "너는 수능 정답표에서 문항번호와 정답을 추출하는 전문가다.\n" +
      "반드시 순수 JSON만 출력하라. 설명, 마크다운, 기타 텍스트 없음.\n" +
      "반드시 1번~34번만 추출하라. 35번 이상은 선택과목이므로 절대 포함하지 않는다.\n" +
      "존재하지 않는 문항은 절대 만들어내지 말 것.\n" +
      '출력 형식: { "1": 3, "2": 1, "3": 5 } (문항번호: 정답번호)',
    messages: [
      {
        role: "user",
        content: [
          buildSourceBlock(answerPath),
          {
            type: "text",
            text: "이 정답표에서 모든 문항의 정답을 추출해라.",
          },
        ],
      },
    ],
  });

  const text = response.content[0].text
    .trim()
    .replace(/^```[a-z]*\n?/i, "")
    .replace(/\n?```$/i, "");
  return JSON.parse(text);
}

// 테스트 실행
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const answerPath = process.argv[2];
  const maxQuestion = parseInt(process.argv[3]) || 45;

  if (!answerPath) {
    console.error(
      "사용법: node pipeline/step1_answer.js [정답표 PDF/PNG 경로] [최대문항수]",
    );
    process.exit(1);
  }

  extractAnswers(answerPath)
    .then((result) => {
      Object.keys(result).forEach((key) => {
        if (parseInt(key) > maxQuestion) delete result[key];
      });
      console.log(
        `추출 완료: 1~${maxQuestion}번 (총 ${Object.keys(result).length}문항)`,
      );
      console.log(JSON.stringify(result, null, 2));
    })
    .catch((err) => {
      console.error("오류:", err.message);
      process.exit(1);
    });
}
