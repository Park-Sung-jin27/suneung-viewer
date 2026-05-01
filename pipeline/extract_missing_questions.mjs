/**
 * pipeline/extract_missing_questions.mjs
 *
 * 특정 문항만 Gemini로 재추출.
 * 현재 대상:
 *   - 2026수능 Q16 (학습 활동지 표 형태)
 *   - 2025수능 Q20 (인물-소통 표 형태)
 *
 * 실행:
 *   node pipeline/extract_missing_questions.mjs
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { jsonrepair } from "jsonrepair";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env"), override: true });

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const DATA_PATH = path.resolve(__dirname, "../src/data/all_data_204.json");
const BACKUP_DIR = path.resolve(__dirname, "../pipeline/backups");

function stripMarkdown(text) {
  return text
    .trim()
    .replace(/^```[a-z]*\n?/i, "")
    .replace(/\n?```$/i, "");
}

async function callGemini(pdfPath, prompt) {
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  const pdfBuffer = fs.readFileSync(pdfPath);
  const pdfBase64 = pdfBuffer.toString("base64");

  const response = await model.generateContent([
    { inlineData: { mimeType: "application/pdf", data: pdfBase64 } },
    { text: prompt },
  ]);

  const raw = response.response.text();
  const text = stripMarkdown(raw);
  try {
    return JSON.parse(text);
  } catch {
    return JSON.parse(jsonrepair(text));
  }
}

// ─── 추출 대상 정의 ────────────────────────────────────────────────────────────
const TARGETS = [
  {
    yearKey: "2026수능",
    pdfPath: path.resolve(__dirname, "../_inbox/2026수능_시험지.pdf"),
    setId: "s4",
    qId: 16,
    prompt: `이 수능 국어 시험지 PDF에서 16번 문제만 추출해줘.

16번은 "다음은 윗글을 읽고 학생이 작성한 학습 활동지이다. 윗글을 바탕으로 할 때, 적절하지 않은 것은?" 형태야.
학습 활동지 표 안의 항목들이 선지 ①~⑤야.

순수 JSON만 출력. 설명 없음:
{
  "qId": 16,
  "choices": [
    { "num": 1, "t": "선지 전체 텍스트" },
    { "num": 2, "t": "선지 전체 텍스트" },
    { "num": 3, "t": "선지 전체 텍스트" },
    { "num": 4, "t": "선지 전체 텍스트" },
    { "num": 5, "t": "선지 전체 텍스트" }
  ]
}`,
  },
  {
    yearKey: "2025수능",
    pdfPath: path.resolve(__dirname, "../_inbox/2025수능_시험지.pdf"),
    setId: "l2025a",
    qId: 20,
    prompt: `이 수능 국어 시험지 PDF에서 20번 문제만 추출해줘.

20번은 "<학습 활동>을 수행한 결과로 적절하지 않은 것은?" 형태야.
인물A / 인물B / 소통의 내용 3열 표로 되어있고, 각 행이 선지 ①~⑤야.

순수 JSON만 출력. 설명 없음:
{
  "qId": 20,
  "bogi": "<학습 활동> 전체 텍스트 (표 위의 설명 포함)",
  "choices": [
    { "num": 1, "t": "인물A명 | 인물B명 | 소통의 내용 전체" },
    { "num": 2, "t": "인물A명 | 인물B명 | 소통의 내용 전체" },
    { "num": 3, "t": "인물A명 | 인물B명 | 소통의 내용 전체" },
    { "num": 4, "t": "인물A명 | 인물B명 | 소통의 내용 전체" },
    { "num": 5, "t": "인물A명 | 인물B명 | 소통의 내용 전체" }
  ]
}`,
  },
];

// ─── 메인 ─────────────────────────────────────────────────────────────────────
const raw = fs.readFileSync(DATA_PATH, "utf8");
const data = JSON.parse(raw);

// 백업
if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
fs.writeFileSync(path.join(BACKUP_DIR, `all_data_204_backup_${ts}.json`), raw);

for (const target of TARGETS) {
  if (!fs.existsSync(target.pdfPath)) {
    console.error(`❌ PDF 없음: ${target.pdfPath}`);
    continue;
  }

  console.log(`\n[${target.yearKey}] Q${target.qId} 추출 중...`);
  let result;
  try {
    result = await callGemini(target.pdfPath, target.prompt);
  } catch (err) {
    console.error(`❌ Gemini 실패: ${err.message}`);
    continue;
  }

  console.log("Gemini 결과:");
  console.log(JSON.stringify(result, null, 2));

  // 데이터에 반영
  const yd = data[target.yearKey];
  if (!yd) {
    console.error(`❌ 연도 없음: ${target.yearKey}`);
    continue;
  }

  let patched = false;
  for (const sec of ["reading", "literature"]) {
    for (const set of yd[sec] || []) {
      if (set.id !== target.setId) continue;
      for (const q of set.questions) {
        if (q.id !== target.qId) continue;

        // bogi 업데이트 (Q20)
        if (result.bogi) {
          q.bogi = result.bogi;
          console.log(`  bogi 설정 완료`);
        }

        // 선지 텍스트 업데이트
        for (const newC of result.choices) {
          const orig = q.choices.find((c) => c.num === newC.num);
          if (orig) {
            orig.t = newC.t;
            console.log(`  [${newC.num}] ${newC.t.slice(0, 60)}`);
          }
        }
        patched = true;
      }
    }
  }

  if (!patched)
    console.error(`❌ 세트/문항 못 찾음: ${target.setId} Q${target.qId}`);
  else console.log(`✅ ${target.yearKey} Q${target.qId} 반영 완료`);
}

fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), "utf8");
console.log("\n✅ all_data_204.json 저장 완료");
console.log("⚠️  반영된 선지의 ok값·analysis는 수동 확인 필요");
