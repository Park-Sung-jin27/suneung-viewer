import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const step3Path =
  process.argv[2] ||
  path.resolve(__dirname, "test_data/step3_result_2022.json");
const answerKeyPath =
  process.argv[3] || path.resolve(__dirname, "test_data/answer_key_2022.json");

const data = JSON.parse(fs.readFileSync(step3Path, "utf8"));
const answerKey = JSON.parse(fs.readFileSync(answerKeyPath, "utf8"));

const allSets = [...data.reading, ...data.literature];

// ─────────────────────────────────────────────
// 1. 정답 선지 ok값 검증
// ─────────────────────────────────────────────
console.log("=".repeat(60));
console.log("1. 정답 선지 ok값 검증");
console.log("=".repeat(60));

const mismatchList = [];

for (const set of allSets) {
  for (const q of set.questions) {
    const correctNum = answerKey[String(q.id)];
    if (correctNum === undefined) continue;

    const correctChoice = q.choices.find((c) => c.num === correctNum);
    if (!correctChoice) {
      console.warn(
        `  ⚠️  ${set.id} ${q.id}번: 정답 선지(${correctNum}번) 없음`,
      );
      continue;
    }

    const expectedOk = q.questionType === "positive" ? true : false;
    if (correctChoice.ok !== expectedOk) {
      mismatchList.push({
        set: set.id,
        range: set.range,
        qId: q.id,
        questionType: q.questionType,
        correctNum,
        actualOk: correctChoice.ok,
        expectedOk,
      });
    }
  }
}

if (mismatchList.length === 0) {
  console.log("✅ 모든 정답 선지의 ok값이 questionType과 일치합니다.");
} else {
  console.log(`❌ 불일치 ${mismatchList.length}건:`);
  for (const m of mismatchList) {
    console.log(
      `  - [${m.set}] ${m.qId}번 (${m.questionType}) 정답:${m.correctNum}번 → ok=${m.actualOk} (기대값: ${m.expectedOk})`,
    );
  }
}

// ─────────────────────────────────────────────
// 2. analysis 샘플 출력
// ─────────────────────────────────────────────
console.log("\n" + "=".repeat(60));
console.log("2. analysis 샘플 출력");
console.log("=".repeat(60));

for (const targetId of ["r2022a", "l2022a"]) {
  const set = allSets.find((s) => s.id === targetId);
  if (!set) {
    console.log(`\n[${targetId}] 세트 없음`);
    continue;
  }

  const q = set.questions[0];
  console.log(`\n[${targetId}] ${q.id}번 문항: "${q.t}"`);
  console.log(
    `questionType: ${q.questionType}  /  정답: ${answerKey[String(q.id)]}번`,
  );
  console.log("-".repeat(50));

  for (const c of q.choices) {
    const okLabel = c.ok ? "✅ TRUE " : "❌ FALSE";
    const patLabel = c.pat !== null ? `[pat:${c.pat}]` : "[pat:null]";
    console.log(`\n  선지 ${c.num} ${okLabel} ${patLabel}`);
    console.log(`  "${c.t}"`);
    if (c.analysis) {
      console.log(`  ${c.analysis.replace(/\n/g, "\n  ")}`);
    }
  }
}

// ─────────────────────────────────────────────
// 3. pat 검증
// ─────────────────────────────────────────────
console.log("\n" + "=".repeat(60));
console.log("3. pat 검증");
console.log("=".repeat(60));

let okFalsePatNull = 0;
let okTruePatNotNull = 0;
const okFalsePatNullList = [];
const okTruePatNotNullList = [];

for (const set of allSets) {
  for (const q of set.questions) {
    for (const c of q.choices) {
      if (c.ok === false && c.pat === null) {
        okFalsePatNull++;
        okFalsePatNullList.push(`[${set.id}] ${q.id}번 선지${c.num}`);
      }
      if (c.ok === true && c.pat !== null) {
        okTruePatNotNull++;
        okTruePatNotNullList.push(
          `[${set.id}] ${q.id}번 선지${c.num} (pat:${c.pat})`,
        );
      }
    }
  }
}

console.log(`\nok:false인데 pat이 null인 선지: ${okFalsePatNull}개`);
if (okFalsePatNullList.length > 0) {
  okFalsePatNullList.forEach((s) => console.log(`  - ${s}`));
}

console.log(`\nok:true인데 pat이 null이 아닌 선지: ${okTruePatNotNull}개`);
if (okTruePatNotNullList.length > 0) {
  okTruePatNotNullList.forEach((s) => console.log(`  - ${s}`));
}
