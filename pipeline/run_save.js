// 재추출 러너: step1(정답) + step2(구조) 를 JSON 파일로 저장
// 사용법: node pipeline/run_save.js <연도키> [최대문항수=34] [섹션=all]
//   예) node pipeline/run_save.js 2025_9월 34
// 입력 PDF: _done/<연도키>/ 안의 *정답.pdf , *시험지.pdf (파일명 자동 탐색)
// 출력:
//   - test_data/answer_key_<연도키>.json   (이미 있으면 스킵)
//   - output/step2_result_<연도키>.json    (git 추적 — 검수용)
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { extractAnswers } from "./step1_answer.js";
import { extractStructure } from "./step2_extract.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEST_DIR = path.resolve(__dirname, "test_data");
const OUT_DIR = path.resolve(__dirname, "output");
const DONE_DIR = path.resolve(__dirname, "..", "_done");

const YEAR_KEY = process.argv[2];
const MAX_Q = parseInt(process.argv[3]) || 34;
const SECTION = process.argv[4] || "all";

if (!YEAR_KEY) {
  console.error(
    "사용법: node pipeline/run_save.js <연도키> [최대문항수=34] [섹션=all]",
  );
  console.error("  예) node pipeline/run_save.js 2025_9월 34");
  process.exit(1);
}

// _done/<연도키>/ 안에서 파일명 끝으로 PDF 자동 탐색 (한글 NFC/NFD 차이 안전)
function findPdf(dir, suffix) {
  if (!fs.existsSync(dir)) return null;
  const hit = fs.readdirSync(dir).find((f) => f.endsWith(suffix));
  return hit ? path.join(dir, hit) : null;
}

const yearDir = path.join(DONE_DIR, YEAR_KEY);
const ANSWER_PDF = findPdf(yearDir, "정답.pdf");
const EXAM_PDF = findPdf(yearDir, "시험지.pdf");

if (!ANSWER_PDF || !EXAM_PDF) {
  console.error(`❌ 입력 PDF 탐색 실패. 폴더 확인: ${yearDir}`);
  console.error(`   정답 PDF: ${ANSWER_PDF || "없음"}`);
  console.error(`   시험지 PDF: ${EXAM_PDF || "없음"}`);
  process.exit(1);
}

async function main() {
  // Step 1: 정답키 추출 (이미 존재하면 스킵)
  const answerPath = path.join(TEST_DIR, `answer_key_${YEAR_KEY}.json`);
  if (fs.existsSync(answerPath)) {
    console.log(`[run_save] 정답키 이미 존재, 스킵: ${answerPath}`);
  } else {
    console.log("[run_save] Step 1: 정답키 추출 중...");
    const _akMaxQ =
      parseInt((YEAR_KEY.match(/^\d{4}/) || ["9999"])[0]) <= 2021 ? 45 : 34;
    const raw = await extractAnswers(ANSWER_PDF, _akMaxQ);
    const answerKey = {};
    Object.keys(raw).forEach((k) => {
      if (parseInt(k) <= MAX_Q) answerKey[k] = raw[k];
    });
    fs.mkdirSync(TEST_DIR, { recursive: true });
    fs.writeFileSync(answerPath, JSON.stringify(answerKey, null, 2), "utf8");
    console.log(
      `[run_save] 정답키 저장 완료: ${answerPath} (${Object.keys(answerKey).length}문항)`,
    );
  }

  // Step 2: 구조 추출
  console.log(
    `[run_save] Step 2: 시험지 구조 추출 중... (${YEAR_KEY}, 1~${MAX_Q}, ${SECTION})`,
  );
  const structure = await extractStructure(EXAM_PDF, YEAR_KEY, MAX_Q, SECTION);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const structurePath = path.join(OUT_DIR, `step2_result_${YEAR_KEY}.json`);
  fs.writeFileSync(structurePath, JSON.stringify(structure, null, 2), "utf8");
  console.log(`[run_save] 구조 저장 완료: ${structurePath}`);
  console.log(`  - 독서 세트 수: ${structure.reading.length}`);
  console.log(`  - 문학 세트 수: ${structure.literature.length}`);
}

main().catch((err) => {
  console.error("오류:", err.message);
  process.exit(1);
});
