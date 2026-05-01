// pipeline/track2c/track2c_4d_patcher.mjs
// 트랙 2-c 작업 4-d — 패치 8건 (운영 데이터 직접 수정)
//
// 지휘부 lock 사항:
//   - 패치 항목 8건 (직전 회기 §4 표 그대로)
//   - source: 4c run 1 (5건) + 4a run 1 (2건) + 4a run 3 (1건, V 분류 정합성 우선)
//   - 백업: public/data/all_data_204.json.bak.4d (스크립트 시작 시 자동, 이미 존재 시 skip)
//   - 입력: 4a_results.json, 4c_results.json (read-only)
//   - 패치 대상: public/data/all_data_204.json (write)
//   - 다른 항목 변경 금지 (acceptance test 4 강제)
//   - step3_analysis.js / 4-a runner / 4-c runner 본체 미수정

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const DATA_PATH = path.resolve(ROOT, "public/data/all_data_204.json");
const BACKUP_PATH = path.resolve(ROOT, "public/data/all_data_204.json.bak.4d");
const RES_4A_PATH = path.resolve(__dirname, "./4a_results.json");
const RES_4C_PATH = path.resolve(__dirname, "./4c_results.json");

console.log("[4-d] 트랙 2-c 4-d 패치 진입");
console.log("[4-d] CWD:", process.cwd());
console.log("[4-d] DATA_PATH:", DATA_PATH);
console.log("[4-d] BACKUP_PATH:", BACKUP_PATH);

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
const res4a = JSON.parse(fs.readFileSync(RES_4A_PATH, "utf8"));
const res4c = JSON.parse(fs.readFileSync(RES_4C_PATH, "utf8"));
console.log(`  data 최상위 키 수: ${Object.keys(data).length}`);
console.log(
  `  4a results: mode_a=${res4a.mode_a.length} mode_b=${res4a.mode_b.length}`,
);
console.log(`  4c results: mode_a_opt_i=${res4c.mode_a_opt_i.length}`);

// ============================================================
// STEP 3: source 추출 헬퍼
// ============================================================
function find4cRun1(qid, num) {
  const id = `2026-04-30-MA_optI-1-r2023a-q${qid}-c${num}`;
  const found = res4c.mode_a_opt_i.find((r) => r.run_id === id);
  if (!found) throw new Error(`4c run 1 not found: ${id}`);
  if (!found.parsed || !found.parsed[0])
    throw new Error(`4c run 1 parsed missing: ${id}`);
  return found.parsed[0];
}

function find4aRun(setId, qid, num, run) {
  const id = `2026-04-30-MA-${run}-${setId}-q${qid}-c${num}`;
  const found = res4a.mode_a.find((r) => r.run_id === id);
  if (!found) throw new Error(`4a run ${run} not found: ${id}`);
  if (!found.parsed || !found.parsed[0])
    throw new Error(`4a run ${run} parsed missing: ${id}`);
  return found.parsed[0];
}

// ============================================================
// STEP 4: 패치 정의
// ============================================================
const patches = [
  { id: 1, set: "r2023a", qid: 2, num: 1, source: "4c-run1", expected_pat: "R4" },
  { id: 2, set: "r2023a", qid: 2, num: 2, source: "4c-run1", expected_pat: "R3" },
  { id: 3, set: "r2023a", qid: 2, num: 3, source: "4c-run1", expected_pat: "R2" },
  { id: 4, set: "r2023a", qid: 2, num: 4, source: "4c-run1", expected_pat: null },
  { id: 5, set: "r2023a", qid: 2, num: 5, source: "4c-run1", expected_pat: null },
  { id: 6, set: "r2023b", qid: 5, num: 5, source: "4a-run1", expected_pat: "R1" },
  { id: 7, set: "r2023b", qid: 9, num: 2, source: "4a-run3", expected_pat: "V" },
  { id: 8, set: "r2023c", qid: 11, num: 5, source: "4a-run1", expected_pat: null },
];

// ============================================================
// STEP 5: 적용
// ============================================================
console.log("\n[STEP 5] 패치 적용");
const sets = data["2023수능"].reading;
const appliedPatches = [];

for (const p of patches) {
  const sIdx = sets.findIndex((s) => s.id === p.set);
  if (sIdx < 0) throw new Error(`set not found: ${p.set}`);
  const set = sets[sIdx];
  const qIdx = set.questions.findIndex((qq) => qq.id === p.qid);
  if (qIdx < 0) throw new Error(`question not found: ${p.set} Q${p.qid}`);
  const q = set.questions[qIdx];
  const cIdx = q.choices.findIndex((cc) => cc.num === p.num);
  if (cIdx < 0)
    throw new Error(`choice not found: ${p.set} Q${p.qid} #${p.num}`);
  const c = q.choices[cIdx];

  let src;
  if (p.source === "4c-run1") src = find4cRun1(p.qid, p.num);
  else if (p.source === "4a-run1") src = find4aRun(p.set, p.qid, p.num, 1);
  else if (p.source === "4a-run3") src = find4aRun(p.set, p.qid, p.num, 3);
  else throw new Error(`unknown source: ${p.source}`);

  const oldAnalysis = c.analysis;
  const oldPat = c.pat;
  c.analysis = src.analysis;
  c.pat = src.pat;

  appliedPatches.push({
    id: p.id,
    target: `${p.set} Q${p.qid} #${p.num}`,
    set_idx: sIdx,
    q_idx: qIdx,
    c_idx: cIdx,
    source: p.source,
    old_pat: oldPat,
    new_pat: c.pat,
    expected_pat: p.expected_pat,
    pat_match: c.pat === p.expected_pat,
    analysis_changed: oldAnalysis !== c.analysis,
  });

  console.log(
    `  #${p.id} ${p.set} Q${p.qid} #${p.num}: pat ${JSON.stringify(oldPat)} → ${JSON.stringify(c.pat)} (source=${p.source}, expected=${JSON.stringify(p.expected_pat)})`,
  );
}

// ============================================================
// STEP 6: 저장
// ============================================================
console.log("\n[STEP 6] 저장");
fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), "utf8");
const newSize = fs.statSync(DATA_PATH).size;
console.log(`  저장 완료: ${DATA_PATH} (${newSize} bytes)`);

// ============================================================
// STEP 7: Acceptance Tests
// ============================================================
console.log("\n=== Acceptance Tests ===");

// (1) 백업 파일 존재
const t1 = fs.existsSync(BACKUP_PATH);
console.log(`(1) 백업 파일 존재: ${t1 ? "PASS ✓" : "FAIL ✗"}`);

// 패치 후 다시 읽기
const dataAfter = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));

// 재귀 flat diff
function flatDiff(before, after, prefix = "") {
  const diffs = [];
  // null/undefined 처리
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
      diffs.push({ path: prefix, before, after });
    }
    return diffs;
  }
  if (typeof before !== "object" || typeof after !== "object") {
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      diffs.push({ path: prefix, before, after });
    }
    return diffs;
  }
  if (Array.isArray(before) !== Array.isArray(after)) {
    diffs.push({ path: prefix, type: "array_mismatch" });
    return diffs;
  }
  if (Array.isArray(before)) {
    if (before.length !== after.length) {
      diffs.push({
        path: prefix,
        type: "length_diff",
        before: before.length,
        after: after.length,
      });
    }
    const len = Math.max(before.length, after.length);
    for (let i = 0; i < len; i++) {
      diffs.push(...flatDiff(before[i], after[i], `${prefix}[${i}]`));
    }
  } else {
    const allKeys = new Set([
      ...Object.keys(before),
      ...Object.keys(after),
    ]);
    for (const k of allKeys) {
      diffs.push(...flatDiff(before[k], after[k], `${prefix}.${k}`));
    }
  }
  return diffs;
}

const allDiffs = flatDiff(dataBackup, dataAfter);

// 8건 expected paths (analysis + pat × 8 = 16 paths)
const expectedPaths = new Set();
for (const ap of appliedPatches) {
  const base = `.2023수능.reading[${ap.set_idx}].questions[${ap.q_idx}].choices[${ap.c_idx}]`;
  expectedPaths.add(`${base}.analysis`);
  expectedPaths.add(`${base}.pat`);
}

const expectedDiffs = allDiffs.filter((d) => expectedPaths.has(d.path));
const unexpectedDiffs = allDiffs.filter((d) => !expectedPaths.has(d.path));

// (2) diff = 16 paths (analysis + pat × 8)
const t2 = expectedDiffs.length === 16 && unexpectedDiffs.length === 0;
console.log(
  `(2) 백업 vs 현재 diff 8건 (analysis+pat=16 paths): ${t2 ? "PASS ✓" : "FAIL ✗"}`,
);
console.log(`    expected paths matched: ${expectedDiffs.length}/16`);
console.log(`    unexpected diffs: ${unexpectedDiffs.length}`);
if (unexpectedDiffs.length > 0) {
  console.log("    UNEXPECTED PATHS:");
  unexpectedDiffs
    .slice(0, 10)
    .forEach((d) => console.log(`      ${JSON.stringify(d).slice(0, 300)}`));
  if (unexpectedDiffs.length > 10) {
    console.log(`      ... (+${unexpectedDiffs.length - 10} more)`);
  }
}

// (3) 8건 pat 값 일치
const t3 = appliedPatches.every((p) => p.pat_match);
console.log(`(3) 8건 pat 값 일치: ${t3 ? "PASS ✓" : "FAIL ✗"}`);
appliedPatches.forEach((p) => {
  console.log(
    `    #${p.id} ${p.target}: expected=${JSON.stringify(p.expected_pat)} new=${JSON.stringify(p.new_pat)} ${p.pat_match ? "✓" : "✗"}`,
  );
});

// (4) 다른 항목 변경 0건
const t4 = unexpectedDiffs.length === 0;
console.log(`(4) 다른 항목 변경 0건: ${t4 ? "PASS ✓" : "FAIL ✗"}`);

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

console.log("\n=== Summary ===");
console.log(`(1) 백업 파일 존재    : ${t1 ? "PASS" : "FAIL"}`);
console.log(`(2) diff 16 paths     : ${t2 ? "PASS" : "FAIL"}`);
console.log(`(3) 8건 pat 일치      : ${t3 ? "PASS" : "FAIL"}`);
console.log(`(4) 외부 변경 0건     : ${t4 ? "PASS" : "FAIL"}`);
console.log(`(5) JSON parse 정상   : ${t5 ? "PASS" : "FAIL"}`);
const allPass = t1 && t2 && t3 && t4 && t5;
console.log(
  `\n[4-d] All Acceptance Tests: ${allPass ? "PASS ✓" : "FAIL ✗"}`,
);
process.exit(allPass ? 0 : 1);
