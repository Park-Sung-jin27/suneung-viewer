// pipeline/track2c/track2c_4d2_patcher.mjs
// 트랙 2-c 작업 4-d-2 — r2023b Q9 #2 analysis 내부 ID 제거
//
// 지휘부 lock 사항:
//   - 분기 (a-i) 채택: 4-d 패치 #7만 정정 (단순 analysis 본문 수정)
//   - V 분류 자체는 정합 (pat 변경 0건)
//   - 정정 대상: analysis 본문에서 ` (r\d{4}[a-z]_?s\d+)` 패턴 제거
//   - 백업: public/data/all_data_204.json.bak.4d2 (4-d 적용 상태에서 백업)
//   - 다른 set/qid/choice 정정 금지

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const DATA_PATH = path.resolve(ROOT, "public/data/all_data_204.json");
const BACKUP_PATH = path.resolve(
  ROOT,
  "public/data/all_data_204.json.bak.4d2",
);

console.log("[4-d-2] r2023b Q9 #2 analysis 내부 ID 제거 진입");
console.log("[4-d-2] CWD:", process.cwd());
console.log("[4-d-2] DATA_PATH:", DATA_PATH);
console.log("[4-d-2] BACKUP_PATH:", BACKUP_PATH);

// ============================================================
// STEP 1: 백업 자동 (재실행 시 보호)
// ============================================================
console.log("\n[STEP 1] 백업 확인");
if (!fs.existsSync(BACKUP_PATH)) {
  fs.copyFileSync(DATA_PATH, BACKUP_PATH);
  const sz = fs.statSync(BACKUP_PATH).size;
  console.log(`  백업 생성: ${BACKUP_PATH} (${sz} bytes)`);
} else {
  const sz = fs.statSync(BACKUP_PATH).size;
  console.log(`  백업 이미 존재 (보호됨): ${BACKUP_PATH} (${sz} bytes)`);
}

// ============================================================
// STEP 2: 입력 로드
// ============================================================
console.log("\n[STEP 2] 입력 로드");
const dataBackup = JSON.parse(fs.readFileSync(BACKUP_PATH, "utf8"));
const data = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));

// ============================================================
// STEP 3: 정정 대상 위치 + analysis 정규식 정정
// ============================================================
console.log("\n[STEP 3] 정정 적용");
const sets = data["2023수능"].reading;
const sIdx = sets.findIndex((s) => s.id === "r2023b");
if (sIdx < 0) throw new Error("set not found: r2023b");
const set = sets[sIdx];
const qIdx = set.questions.findIndex((q) => q.id === 9);
if (qIdx < 0) throw new Error("question not found: r2023b Q9");
const q = set.questions[qIdx];
const cIdx = q.choices.findIndex((c) => c.num === 2);
if (cIdx < 0) throw new Error("choice not found: r2023b Q9 #2");
const choice = q.choices[cIdx];

const oldAnalysis = choice.analysis;
const oldPat = choice.pat;

let newAnalysis = oldAnalysis;
newAnalysis = newAnalysis.replace(/\s*\(r\d{4}[a-z]_?s\d+\)/g, "");
newAnalysis = newAnalysis.replace(/\s*\(r\d{4}[a-z]s\d+\)/g, "");

choice.analysis = newAnalysis;
// pat 변경 없음 (V 유지)

console.log(
  `  대상: r2023b Q9 #2 (set_idx=${sIdx}, q_idx=${qIdx}, c_idx=${cIdx})`,
);
console.log(`  pat 유지: ${JSON.stringify(oldPat)} (변경 없음)`);
console.log(
  `  analysis 변경: ${oldAnalysis !== newAnalysis ? "Yes" : "No"} (old.length=${oldAnalysis.length}, new.length=${newAnalysis.length})`,
);

// ============================================================
// STEP 4: 저장
// ============================================================
console.log("\n[STEP 4] 저장");
fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), "utf8");
const newSize = fs.statSync(DATA_PATH).size;
console.log(`  저장 완료: ${DATA_PATH} (${newSize} bytes)`);

// ============================================================
// STEP 5: Acceptance Tests
// ============================================================
console.log("\n=== Acceptance Tests ===");

// 패치 후 다시 읽기
const dataAfter = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
const targetChoice =
  dataAfter["2023수능"].reading[sIdx].questions[qIdx].choices[cIdx];

// (1) 백업 파일 존재
const t1 = fs.existsSync(BACKUP_PATH);
console.log(`(1) 백업 파일 존재 (.bak.4d2): ${t1 ? "PASS ✓" : "FAIL ✗"}`);

// (2) 내부 ID 패턴 0건 (정정 후)
const idPattern = /\(r\d{4}[a-z]_?s\d+\)/g;
const remainingMatches = targetChoice.analysis.match(idPattern) || [];
const t2 = remainingMatches.length === 0;
console.log(
  `(2) 내부 ID 패턴 0건: ${t2 ? "PASS ✓" : "FAIL ✗"} (matches: ${remainingMatches.length})`,
);
if (remainingMatches.length > 0) {
  console.log(`    remaining: ${JSON.stringify(remainingMatches)}`);
}

// (3) pat = V 유지
const t3 = targetChoice.pat === "V";
console.log(
  `(3) pat = V 유지: ${t3 ? "PASS ✓" : "FAIL ✗"} (actual: ${JSON.stringify(targetChoice.pat)})`,
);

// (4) 다른 항목 변경 0건 (vs .bak.4d2)
function flatDiff(before, after, prefix = "") {
  const diffs = [];
  if (
    before === null ||
    before === undefined ||
    after === null ||
    after === undefined
  ) {
    if (
      before !== after &&
      JSON.stringify(before) !== JSON.stringify(after)
    ) {
      diffs.push({ path: prefix });
    }
    return diffs;
  }
  if (typeof before !== "object" || typeof after !== "object") {
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      diffs.push({ path: prefix });
    }
    return diffs;
  }
  if (Array.isArray(before) !== Array.isArray(after)) {
    diffs.push({ path: prefix });
    return diffs;
  }
  if (Array.isArray(before)) {
    if (before.length !== after.length) {
      diffs.push({ path: prefix });
    }
    const len = Math.max(before.length, after.length);
    for (let i = 0; i < len; i++) {
      diffs.push(...flatDiff(before[i], after[i], `${prefix}[${i}]`));
    }
  } else {
    const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);
    for (const k of allKeys) {
      diffs.push(...flatDiff(before[k], after[k], `${prefix}.${k}`));
    }
  }
  return diffs;
}

const allDiffs = flatDiff(dataBackup, dataAfter);
const expectedPath = `.2023수능.reading[${sIdx}].questions[${qIdx}].choices[${cIdx}].analysis`;
const expectedDiffs = allDiffs.filter((d) => d.path === expectedPath);
const unexpectedDiffs = allDiffs.filter((d) => d.path !== expectedPath);

const t4 = expectedDiffs.length === 1 && unexpectedDiffs.length === 0;
console.log(`(4) 다른 항목 변경 0건: ${t4 ? "PASS ✓" : "FAIL ✗"}`);
console.log(
  `    expected path (analysis only): ${expectedDiffs.length}/1`,
);
console.log(`    unexpected paths: ${unexpectedDiffs.length}`);
if (unexpectedDiffs.length > 0) {
  console.log("    UNEXPECTED PATHS:");
  unexpectedDiffs
    .slice(0, 10)
    .forEach((d) => console.log(`      ${d.path}`));
  if (unexpectedDiffs.length > 10) {
    console.log(`      ... (+${unexpectedDiffs.length - 10} more)`);
  }
}

// (5) JSON parse 정상
let t5 = false;
let t5err = null;
try {
  JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
  t5 = true;
} catch (e) {
  t5err = e.message;
}
console.log(
  `(5) JSON parse 정상: ${t5 ? "PASS ✓" : "FAIL ✗"}${t5err ? ` (${t5err})` : ""}`,
);

// 정정된 analysis 본문 raw 출력 (검증용)
console.log("\n[정정 후 analysis raw — r2023b Q9 #2]");
console.log(targetChoice.analysis);

console.log("\n=== Summary ===");
const allPass = t1 && t2 && t3 && t4 && t5;
console.log(`(1) 백업 (.bak.4d2)    : ${t1 ? "PASS" : "FAIL"}`);
console.log(`(2) 내부 ID 0건        : ${t2 ? "PASS" : "FAIL"}`);
console.log(`(3) pat=V 유지         : ${t3 ? "PASS" : "FAIL"}`);
console.log(`(4) 외부 변경 0건      : ${t4 ? "PASS" : "FAIL"}`);
console.log(`(5) JSON parse 정상    : ${t5 ? "PASS" : "FAIL"}`);
console.log(
  `\n[4-d-2] All Acceptance Tests: ${allPass ? "PASS ✓" : "FAIL ✗"}`,
);
process.exit(allPass ? 0 : 1);
