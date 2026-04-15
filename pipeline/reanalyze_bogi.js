// pipeline/reanalyze_bogi.js
// bogi가 있는 문항의 analysis를 재생성하여 all_data_204.json에 직접 반영
// 사용법: node pipeline/reanalyze_bogi.js <yearKey>
// 예:     node pipeline/reanalyze_bogi.js 2026수능

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { retrySet } from "./step3_analysis.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DATA_PATH = path.resolve(__dirname, "../public/data/all_data_204.json");
const BACKUP_DIR = path.resolve(__dirname, "backups");
const TEST_DATA_DIR = path.resolve(__dirname, "test_data");

const yearKey = process.argv[2];
if (!yearKey) {
  console.error("사용법: node pipeline/reanalyze_bogi.js <yearKey>");
  console.error("예:     node pipeline/reanalyze_bogi.js 2026수능");
  process.exit(1);
}

// ── 정답키 로드 ──────────────────────────────────────────────
const answerKeyFile = path.join(TEST_DATA_DIR, `answer_key_${yearKey}.json`);
if (!fs.existsSync(answerKeyFile)) {
  console.error(`❌ 정답키 파일 없음: ${answerKeyFile}`);
  process.exit(1);
}
const answerKey = JSON.parse(fs.readFileSync(answerKeyFile, "utf-8"));

// ── all_data_204.json 로드 ───────────────────────────────────
if (!fs.existsSync(DATA_PATH)) {
  console.error(`❌ 데이터 파일 없음: ${DATA_PATH}`);
  process.exit(1);
}
const allData = JSON.parse(fs.readFileSync(DATA_PATH, "utf-8"));

if (!allData[yearKey]) {
  console.error(`❌ yearKey 없음: "${yearKey}"`);
  console.error(`사용 가능한 키: ${Object.keys(allData).join(", ")}`);
  process.exit(1);
}

// ── 백업 ────────────────────────────────────────────────────
if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const backupPath = path.join(BACKUP_DIR, `all_data_204_${timestamp}.json`);
fs.copyFileSync(DATA_PATH, backupPath);
console.log(`✅ 백업 완료: ${backupPath}`);

// ── bogi 있는 세트 필터링 ────────────────────────────────────
const yearData = allData[yearKey];
const bogiSets = { reading: [], literature: [] };

for (const section of ["reading", "literature"]) {
  for (const set of yearData[section] || []) {
    const hasBogiQuestion = set.questions.some(
      (q) => q.bogi && q.bogi.trim() !== "",
    );
    if (hasBogiQuestion) {
      bogiSets[section].push(set);
    }
  }
}

const totalSets = bogiSets.reading.length + bogiSets.literature.length;
const totalQuestions = [...bogiSets.reading, ...bogiSets.literature].flatMap(
  (s) => s.questions.filter((q) => q.bogi && q.bogi.trim() !== ""),
).length;

if (totalSets === 0) {
  console.log(`ℹ️  ${yearKey}에 bogi가 있는 문항이 없습니다.`);
  process.exit(0);
}

console.log(`\n🔍 ${yearKey} — bogi 문항 발견`);
console.log(`   세트 수: ${totalSets}개`);
console.log(`   문항 수: ${totalQuestions}개`);
console.log("");

// ── retrySet 호출 및 반영 ────────────────────────────────────
let updatedSetCount = 0;
let updatedQuestionCount = 0;

for (const section of ["reading", "literature"]) {
  for (const set of bogiSets[section]) {
    const bogiQIds = set.questions
      .filter((q) => q.bogi && q.bogi.trim() !== "")
      .map((q) => q.id);

    console.log(
      `\n[${section}] ${set.id} (${set.range}) — bogi 문항: ${bogiQIds.join(", ")}번`,
    );

    try {
      const updatedSet = await retrySet(set, answerKey);

      // all_data_204.json의 해당 세트만 교체
      const idx = allData[yearKey][section].findIndex((s) => s.id === set.id);
      if (idx !== -1) {
        allData[yearKey][section][idx] = updatedSet;
        updatedSetCount++;
        updatedQuestionCount += bogiQIds.length;
        console.log(`  ✅ ${set.id} 재분석 완료`);
      } else {
        console.warn(`  ⚠️ ${set.id} — allData에서 세트를 찾지 못해 반영 스킵`);
      }
    } catch (err) {
      console.error(`  ❌ ${set.id} 재분석 실패: ${err.message}`);
    }
  }
}

// ── 저장 ────────────────────────────────────────────────────
fs.writeFileSync(DATA_PATH, JSON.stringify(allData, null, 2), "utf-8");

console.log("\n" + "═".repeat(50));
console.log("✅ reanalyze_bogi 완료");
console.log(`   yearKey:  ${yearKey}`);
console.log(`   세트:     ${updatedSetCount}개 반영`);
console.log(`   문항:     ${updatedQuestionCount}개`);
console.log(`   저장:     ${DATA_PATH}`);
console.log(`   백업:     ${backupPath}`);
console.log("═".repeat(50));
