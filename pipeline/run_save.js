// 임시 러너: step1 + step2 결과를 JSON 파일로 저장
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { extractAnswers } from "./step1_answer.js";
import { extractStructure } from "./step2_extract.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, "test_data");

const ANSWER_PDF =
  "C:/Users/downf/OneDrive/Desktop/논리맵핑/국어 기출/국어 정답/2022학년도-대학수학능력시험-국어-답지.pdf";
const EXAM_PDF =
  "C:/Users/downf/OneDrive/Desktop/논리맵핑/국어 기출/2022학년도-대학수학능력시험-국어-문제.pdf";
const MAX_Q = 34;
const YEAR_KEY = "2022수능";

async function main() {
  // Step 1: 정답키 추출 (이미 존재하면 스킵)
  const answerPath = path.join(OUT_DIR, "answer_key_2022.json");
  if (fs.existsSync(answerPath)) {
    console.log(`[run_save] ⏭️  정답키 이미 존재, 스킵: ${answerPath}`);
  } else {
    console.log("[run_save] Step 1: 정답키 추출 중...");
    const raw = await extractAnswers(ANSWER_PDF);
    const answerKey = {};
    Object.keys(raw).forEach((k) => {
      if (parseInt(k) <= MAX_Q) answerKey[k] = raw[k];
    });
    fs.writeFileSync(answerPath, JSON.stringify(answerKey, null, 2), "utf8");
    console.log(
      `[run_save] ✅ 정답키 저장 완료: ${answerPath} (${Object.keys(answerKey).length}문항)`,
    );
  }

  // Step 2: 구조 추출
  console.log("[run_save] Step 2: 시험지 구조 추출 중...");
  const structure = await extractStructure(EXAM_PDF, YEAR_KEY, MAX_Q);
  const structurePath = path.join(OUT_DIR, "step2_result_2022.json");
  fs.writeFileSync(structurePath, JSON.stringify(structure, null, 2), "utf8");
  console.log(`[run_save] ✅ 구조 저장 완료: ${structurePath}`);
  console.log(`  - 독서 세트 수: ${structure.reading.length}`);
  console.log(`  - 문학 세트 수: ${structure.literature.length}`);
}

main().catch((err) => {
  console.error("오류:", err.message);
  process.exit(1);
});
