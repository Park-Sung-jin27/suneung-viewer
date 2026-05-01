/**
 * gen_qa_payload.js
 *
 * GPT 통합 QA 엔진에 바로 넣을 payload 자동 생성
 *
 * 사용법:
 *   node pipeline/gen_qa_payload.js 2026수능 l2026c 29
 *   node pipeline/gen_qa_payload.js 2026수능 l2026c 29 3
 *   node pipeline/gen_qa_payload.js 2026수능 l2026c --all
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DATA_PATH = path.join(ROOT, "public", "data", "all_data_204.json");

const allData = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));

const YEAR   = process.argv[2];
const SET_ID = process.argv[3];
const ARG3   = process.argv[4];
const ARG4   = process.argv[5];

const Q_ID = ARG3 && ARG3 !== "--all" && !Number.isNaN(parseInt(ARG3, 10))
  ? parseInt(ARG3, 10) : null;
const C_NUM = ARG4 && !Number.isNaN(parseInt(ARG4, 10))
  ? parseInt(ARG4, 10) : null;
const ALL_MODE = ARG3 === "--all";

if (!YEAR || !SET_ID) {
  console.error("사용법: node pipeline/gen_qa_payload.js <연도> <세트ID> [문제번호] [선지번호]");
  console.error("예시1: node pipeline/gen_qa_payload.js 2026수능 l2026c 29");
  console.error("예시2: node pipeline/gen_qa_payload.js 2026수능 l2026c 29 3");
  console.error("예시3: node pipeline/gen_qa_payload.js 2026수능 l2026c --all");
  process.exit(1);
}

const yearData = allData[YEAR];
if (!yearData) { console.error(`❌ 연도 없음: ${YEAR}`); process.exit(1); }

let targetSet = null;
let section = null;
for (const sec of ["reading", "literature"]) {
  const found = (yearData[sec] || []).find((s) => s.id === SET_ID);
  if (found) { targetSet = found; section = sec; break; }
}
if (!targetSet) { console.error(`❌ 세트 없음: ${SET_ID}`); process.exit(1); }

const isLiterature = section === "literature";
const sectionLabel = isLiterature ? "문학" : "독서";

const sentMap = {};
for (const s of targetSet.sents || []) sentMap[s.id] = s.t || "";

function normalizeBogi(bogi) {
  if (!bogi) return "없음";
  if (typeof bogi === "string") return bogi;
  try { return JSON.stringify(bogi, null, 2); } catch { return String(bogi); }
}

function getSentTexts(choice) {
  const cs_ids = choice.cs_ids || [];
  if (cs_ids.length === 0) return "없음";
  const lines = cs_ids.map((id, i) => `${i+1}. [${id}] ${sentMap[id] || "(문장 없음)"}`);
  if (Array.isArray(choice.cs_spans) && choice.cs_spans.length > 0) {
    lines.push("");
    lines.push("[cs_spans]");
    choice.cs_spans.forEach((sp, i) => {
      lines.push(`${i+1}. sent_id=${sp.sent_id}, text=${sp.text || ""}${sp.occurrence ? `, occurrence=${sp.occurrence}` : ""}`);
    });
  }
  return lines.join("\n");
}

function genUnifiedPayload(question, choice) {
  const pat = choice.pat || "null";
  return [
    "다음 선지를 통합 검수해라.",
    "",
    "[문항 정보]",
    `- 연도: ${YEAR}`,
    `- 세트: ${SET_ID}`,
    `- 영역: ${sectionLabel}`,
    `- 문제 번호: ${question.id}번`,
    `- 선지 번호: ${choice.num}번`,
    `- 문제 유형: ${question.questionType}`,
    `- ok: ${choice.ok}`,
    `- 패턴: ${pat}`,
    "",
    "[발문]",
    question.t || "",
    "",
    "[보기]",
    normalizeBogi(question.bogi),
    "",
    "[선지]",
    choice.t || "",
    "",
    "[해설]",
    choice.analysis || "(해설 없음)",
    "",
    "[현재 근거 문장]",
    getSentTexts(choice),
    "",
    "검수:",
    "- A 해설 품질",
    "- B 선지-근거 적합성",
    `- C 문학 특화 검수(${isLiterature ? "적용" : "비적용"})`,
    "- D 오답 패턴 검증",
    "",
    "반드시 JSON만 출력.",
  ].join("\n");
}

const questions = ALL_MODE
  ? targetSet.questions || []
  : Q_ID
    ? (targetSet.questions || []).filter((q) => q.id === Q_ID)
    : [];

if (questions.length === 0) {
  console.error(ALL_MODE ? `❌ 세트에 문제 없음: ${SET_ID}` : `❌ 문제 없음: ${SET_ID} Q${Q_ID}`);
  process.exit(1);
}

console.log(`\n${"═".repeat(70)}`);
console.log(`${YEAR} ${SET_ID} ${ALL_MODE ? "전체" : `Q${Q_ID}${C_NUM ? ` 선지${C_NUM}` : ""}`} — 통합 QA Payload`);
console.log(`${"═".repeat(70)}\n`);

for (const q of questions) {
  const choices = C_NUM
    ? (q.choices || []).filter((c) => c.num === C_NUM)
    : q.choices || [];

  for (const c of choices) {
    console.log("─".repeat(70));
    console.log(`[통합 QA] Q${q.id} 선지${c.num}`);
    console.log("─".repeat(70));
    console.log(genUnifiedPayload(q, c));
    console.log("");
  }
}
