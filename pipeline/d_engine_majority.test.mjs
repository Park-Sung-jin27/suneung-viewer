/**
 * §4.2 applyMajority 회귀 테스트 (v2 — intersection 보강)
 *
 * 실행:
 *   node C:\Users\downf\suneung-viewer\pipeline\d_engine_majority.test.mjs
 *
 * 4건 사양 + 5건 엣지 + 6건 보강 = 15건. 1건 실패 시 exit code 1.
 */

import { applyMajority } from "./d_engine_majority.mjs";

let passed = 0;
let failed = 0;
const failures = [];

function assertEqual(actual, expected, label) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    passed++;
    console.log(`  ✅ ${label}`);
  } else {
    failed++;
    failures.push({ label, actual, expected });
    console.log(`  ❌ ${label}`);
    console.log(`     expected: ${e}`);
    console.log(`     actual:   ${a}`);
  }
}

function assertThrows(fn, label) {
  try {
    fn();
    failed++;
    failures.push({ label, note: "did not throw" });
    console.log(`  ❌ ${label} (did not throw)`);
  } catch (e) {
    passed++;
    console.log(`  ✅ ${label} (threw: ${e.message.slice(0, 60)}...)`);
  }
}

// ─── 사양 4건 ────────────────────────────────────────────────────
console.log("\n[사양 회귀 테스트 4건]");

console.log("\n1. [NONE, NONE, NONE] all high → majority_accepted, NONE, high");
{
  const out = applyMajority([
    { pass: true, error_type: "NONE", rule_hits: [], reason: "ok", confidence: "high" },
    { pass: true, error_type: "NONE", rule_hits: [], reason: "ok", confidence: "high" },
    { pass: true, error_type: "NONE", rule_hits: [], reason: "ok", confidence: "high" },
  ]);
  assertEqual(out.decision, "majority_accepted", "decision");
  assertEqual(out.final.error_type, "NONE", "final.error_type");
  assertEqual(out.final.confidence, "high", "final.confidence");
  assertEqual(out.final.rule_hits, [], "final.rule_hits intersection");
  assertEqual(out.metadata.low_confidence_flag, false, "low_flag");
  assertEqual(out.metadata.candidate_for_human_review, false, "candidate (et=NONE 면 empty 무관)");
  assertEqual(out.metadata.discarded_rule_hits, [], "discarded");
  assertEqual(out.metadata.diversity_count, 1, "diversity");
  assertEqual(out.metadata.majority_count, 3, "majority_count");
}

console.log("\n2. [NONE, NONE, P_MISMATCH] → majority_accepted, NONE, mid, low_flag, candidate=false");
{
  const out = applyMajority([
    { pass: true, error_type: "NONE", rule_hits: [], reason: "a", confidence: "high" },
    { pass: true, error_type: "NONE", rule_hits: [], reason: "b", confidence: "high" },
    { pass: false, error_type: "P_MISMATCH", rule_hits: ["RULE_1"], reason: "c", confidence: "mid" },
  ]);
  assertEqual(out.decision, "majority_accepted", "decision");
  assertEqual(out.final.error_type, "NONE", "final.error_type");
  assertEqual(out.final.confidence, "mid", "final.confidence");
  assertEqual(out.final.rule_hits, [], "final.rule_hits = NONE majority intersection");
  assertEqual(out.metadata.low_confidence_flag, true, "low_flag (2/3)");
  assertEqual(out.metadata.candidate_for_human_review, false, "candidate (et=NONE)");
  assertEqual(out.metadata.discarded_rule_hits, ["RULE_1"], "discarded = 소수 rule_hits");
}

console.log("\n3. [NONE, P_MISMATCH, E_LOGIC_UNCLEAR] → needs_human, null + runs 보존");
{
  const out = applyMajority([
    { pass: true, error_type: "NONE", rule_hits: [], reason: "a", confidence: "high" },
    { pass: false, error_type: "P_MISMATCH", rule_hits: ["RULE_1"], reason: "b", confidence: "mid" },
    { pass: false, error_type: "E_LOGIC_UNCLEAR", rule_hits: ["RULE_7"], reason: "c", confidence: "mid" },
  ]);
  assertEqual(out.decision, "needs_human", "decision");
  assertEqual(out.final, null, "final");
  assertEqual(out.metadata.diversity_count, 3, "diversity");
  assertEqual(out.metadata.majority_count, 1, "majority_count");
  assertEqual(out.metadata.discarded_rule_hits, null, "discarded null (5-3 미산출)");
  assertEqual(out.metadata.candidate_for_human_review, false, "candidate false (needs_human은 별도)");
  assertEqual(out.metadata.runs.length, 3, "runs 3개 보존");
  assertEqual(out.metadata.runs[0].rule_hits, [], "runs[0].rule_hits");
  assertEqual(out.metadata.runs[1].rule_hits, ["RULE_1"], "runs[1].rule_hits");
  assertEqual(out.metadata.runs[2].rule_hits, ["RULE_7"], "runs[2].rule_hits");
}

console.log("\n4. [E_COMPOSITE_ERROR×3] all high (R2_010 케이스) → intersection 보존, 잉여 discarded");
{
  const out = applyMajority([
    { pass: false, error_type: "E_COMPOSITE_ERROR", rule_hits: ["RULE_4_COMPOSITE_ERROR", "RULE_1_PAT_DEFINITION_MISMATCH"], reason: "x", confidence: "high" },
    { pass: false, error_type: "E_COMPOSITE_ERROR", rule_hits: ["RULE_4_COMPOSITE_ERROR"], reason: "y", confidence: "high" },
    { pass: false, error_type: "E_COMPOSITE_ERROR", rule_hits: ["RULE_4_COMPOSITE_ERROR"], reason: "z", confidence: "high" },
  ]);
  assertEqual(out.decision, "majority_accepted", "decision");
  assertEqual(out.final.error_type, "E_COMPOSITE_ERROR", "final.error_type");
  assertEqual(out.final.confidence, "high", "final.confidence");
  assertEqual(out.final.rule_hits, ["RULE_4_COMPOSITE_ERROR"], "final.rule_hits = intersection (RULE_1 빠짐)");
  assertEqual(out.metadata.discarded_rule_hits, ["RULE_1_PAT_DEFINITION_MISMATCH"], "discarded = RULE_1");
  assertEqual(out.metadata.low_confidence_flag, false, "low_flag false");
  assertEqual(out.metadata.candidate_for_human_review, false, "candidate false");
}

// ─── 엣지 5건 ────────────────────────────────────────────────────
console.log("\n[엣지 케이스 5건]");

console.log("\n5. 응답 1개 → throw");
assertThrows(
  () => applyMajority([{ pass: true, error_type: "NONE", rule_hits: [], reason: "x", confidence: "high" }]),
  "length 1 throws"
);

console.log("\n6. 응답 4개 → throw");
assertThrows(
  () => applyMajority([
    { pass: true, error_type: "NONE", rule_hits: [], reason: "x", confidence: "high" },
    { pass: true, error_type: "NONE", rule_hits: [], reason: "x", confidence: "high" },
    { pass: true, error_type: "NONE", rule_hits: [], reason: "x", confidence: "high" },
    { pass: true, error_type: "NONE", rule_hits: [], reason: "x", confidence: "high" },
  ]),
  "length 4 throws"
);

console.log("\n7. 잘못된 error_type enum → throw");
assertThrows(
  () => applyMajority([
    { pass: true, error_type: "INVALID_TYPE", rule_hits: [], reason: "x", confidence: "high" },
    { pass: true, error_type: "NONE", rule_hits: [], reason: "x", confidence: "high" },
    { pass: true, error_type: "NONE", rule_hits: [], reason: "x", confidence: "high" },
  ]),
  "invalid enum throws"
);

console.log("\n8. 3/3 일치인데 1개 mid → confidence=mid (intersection 빈 배열이지만 et=NONE)");
{
  const out = applyMajority([
    { pass: true, error_type: "NONE", rule_hits: [], reason: "a", confidence: "high" },
    { pass: true, error_type: "NONE", rule_hits: [], reason: "b", confidence: "high" },
    { pass: true, error_type: "NONE", rule_hits: [], reason: "c", confidence: "mid" },
  ]);
  assertEqual(out.final.confidence, "mid", "3/3 with 1 mid → mid");
  assertEqual(out.metadata.low_confidence_flag, false, "low_flag false (et=NONE 이라 empty intersection 무관)");
  assertEqual(out.metadata.candidate_for_human_review, false, "candidate false");
}

console.log("\n9. 최빈 응답이 pass=true & error_type≠NONE 비정상 → low_flag 강제 (intersection 비어있지 않음)");
{
  const out = applyMajority([
    { pass: true, error_type: "P_MISMATCH", rule_hits: ["RULE_1"], reason: "malformed", confidence: "high" },
    { pass: true, error_type: "P_MISMATCH", rule_hits: ["RULE_1"], reason: "malformed", confidence: "high" },
    { pass: true, error_type: "NONE", rule_hits: [], reason: "x", confidence: "high" },
  ]);
  assertEqual(out.decision, "majority_accepted", "decision");
  assertEqual(out.final.error_type, "P_MISMATCH", "final.error_type");
  assertEqual(out.final.rule_hits, ["RULE_1"], "intersection");
  assertEqual(out.metadata.low_confidence_flag, true, "low_flag forced (pass=true malformed)");
  assertEqual(out.metadata.candidate_for_human_review, false, "candidate false (intersection nonempty)");
  assertEqual(out.metadata.discarded_rule_hits, [], "discarded empty");
}

// ─── 보강 6건 (intersection / discarded / candidate) ──────────────
console.log("\n[보강 회귀 테스트 6건]");

console.log("\n10. 3/3 일치 + rule_hits 다름 → intersection 보존");
{
  const out = applyMajority([
    { pass: false, error_type: "P_MISMATCH", rule_hits: ["RULE_1_PAT_DEFINITION_MISMATCH", "RULE_4_COMPOSITE_ERROR"], reason: "x", confidence: "high" },
    { pass: false, error_type: "P_MISMATCH", rule_hits: ["RULE_1_PAT_DEFINITION_MISMATCH", "RULE_5_OK_TRUE_WITH_PAT"], reason: "y", confidence: "high" },
    { pass: false, error_type: "P_MISMATCH", rule_hits: ["RULE_1_PAT_DEFINITION_MISMATCH", "RULE_6_PAT_MISSING_ON_OK_FALSE"], reason: "z", confidence: "high" },
  ]);
  assertEqual(out.final.rule_hits, ["RULE_1_PAT_DEFINITION_MISMATCH"], "intersection = [RULE_1_PAT_DEFINITION_MISMATCH]");
  assertEqual(out.metadata.discarded_rule_hits, ["RULE_4_COMPOSITE_ERROR", "RULE_5_OK_TRUE_WITH_PAT", "RULE_6_PAT_MISSING_ON_OK_FALSE"], "discarded = [RULE_4, RULE_5, RULE_6]");
  assertEqual(out.metadata.low_confidence_flag, false, "low_flag false");
  assertEqual(out.metadata.candidate_for_human_review, false, "candidate false");
}

console.log("\n11. 2/3 일치 + majority 그룹 rule_hits 다름 + 소수 rule_hits 포함");
{
  const out = applyMajority([
    { pass: false, error_type: "P_MISMATCH", rule_hits: ["A", "B"], reason: "x", confidence: "high" },
    { pass: false, error_type: "P_MISMATCH", rule_hits: ["A", "C"], reason: "y", confidence: "high" },
    { pass: true, error_type: "NONE", rule_hits: ["X"], reason: "z", confidence: "high" },
  ]);
  assertEqual(out.final.error_type, "P_MISMATCH", "majority et");
  assertEqual(out.final.rule_hits, ["A"], "majority intersection = [A]");
  assertEqual(out.metadata.discarded_rule_hits, ["B", "C", "X"], "discarded = [B, C, X] (소수 X 포함)");
  assertEqual(out.metadata.low_confidence_flag, true, "low_flag (2/3)");
  assertEqual(out.metadata.candidate_for_human_review, false, "candidate false (intersection nonempty)");
}

console.log("\n12. 3/3 일치 + intersection 빈 배열 + et≠NONE → low_flag + candidate 강제");
{
  const out = applyMajority([
    { pass: false, error_type: "P_MISMATCH", rule_hits: ["A"], reason: "x", confidence: "high" },
    { pass: false, error_type: "P_MISMATCH", rule_hits: ["B"], reason: "y", confidence: "high" },
    { pass: false, error_type: "P_MISMATCH", rule_hits: ["C"], reason: "z", confidence: "high" },
  ]);
  assertEqual(out.final.rule_hits, [], "intersection empty");
  assertEqual(out.metadata.low_confidence_flag, true, "low_flag 강제");
  assertEqual(out.metadata.candidate_for_human_review, true, "candidate 강제");
  assertEqual(out.metadata.discarded_rule_hits, ["A", "B", "C"], "discarded = 전체");
}

console.log("\n13. RULE_7 격하 정책 검증 (3/3 RULE_7_ANALYSIS_TOO_VAGUE 만 살아남음, 부수 규칙은 discarded)");
{
  const out = applyMajority([
    { pass: false, error_type: "E_LOGIC_UNCLEAR", rule_hits: ["RULE_7_ANALYSIS_TOO_VAGUE"], reason: "x", confidence: "high" },
    { pass: false, error_type: "E_LOGIC_UNCLEAR", rule_hits: ["RULE_7_ANALYSIS_TOO_VAGUE", "RULE_3_CONDITION_MISSING"], reason: "y", confidence: "high" },
    { pass: false, error_type: "E_LOGIC_UNCLEAR", rule_hits: ["RULE_7_ANALYSIS_TOO_VAGUE", "RULE_5_OK_TRUE_WITH_PAT"], reason: "z", confidence: "high" },
  ]);
  assertEqual(out.final.rule_hits, ["RULE_7_ANALYSIS_TOO_VAGUE"], "RULE_7_ANALYSIS_TOO_VAGUE 만 intersection");
  assertEqual(out.metadata.discarded_rule_hits, ["RULE_3_CONDITION_MISSING", "RULE_5_OK_TRUE_WITH_PAT"], "RULE_3, RULE_5 discarded");
  assertEqual(out.metadata.low_confidence_flag, false, "low_flag false");
  assertEqual(out.metadata.candidate_for_human_review, false, "candidate false");
}

console.log("\n14. discarded_rule_hits 정확성 검증 (사용자 명시 스펙)");
{
  const out = applyMajority([
    { pass: false, error_type: "E_COMPOSITE_ERROR", rule_hits: ["RULE_4_COMPOSITE_ERROR", "RULE_7_ANALYSIS_TOO_VAGUE"], reason: "x", confidence: "high" },
    { pass: false, error_type: "E_COMPOSITE_ERROR", rule_hits: ["RULE_4_COMPOSITE_ERROR", "RULE_1_PAT_DEFINITION_MISMATCH"], reason: "y", confidence: "high" },
    { pass: false, error_type: "E_COMPOSITE_ERROR", rule_hits: ["RULE_4_COMPOSITE_ERROR"], reason: "z", confidence: "high" },
  ]);
  assertEqual(out.final.rule_hits, ["RULE_4_COMPOSITE_ERROR"], "intersection = [RULE_4_COMPOSITE_ERROR]");
  assertEqual(out.metadata.discarded_rule_hits, ["RULE_7_ANALYSIS_TOO_VAGUE", "RULE_1_PAT_DEFINITION_MISMATCH"], "discarded = union - intersection");
  assertEqual(out.final.confidence, "high", "confidence high");
  assertEqual(out.metadata.low_confidence_flag, false, "low_flag false");
  assertEqual(out.metadata.candidate_for_human_review, false, "candidate false");
}

console.log("\n15. candidate_for_human_review 마커 검증 (사용자 명시 스펙)");
{
  const out = applyMajority([
    { pass: false, error_type: "P_MISMATCH", rule_hits: ["RULE_1_PAT_DEFINITION_MISMATCH"], reason: "x", confidence: "mid" },
    { pass: false, error_type: "P_MISMATCH", rule_hits: ["RULE_5_OK_TRUE_WITH_PAT"], reason: "y", confidence: "mid" },
    { pass: false, error_type: "P_MISMATCH", rule_hits: ["RULE_6_PAT_MISSING_ON_OK_FALSE"], reason: "z", confidence: "mid" },
  ]);
  assertEqual(out.decision, "majority_accepted", "decision (needs_human 자동 분기 X)");
  assertEqual(out.final.rule_hits, [], "intersection 빈 배열");
  assertEqual(out.metadata.discarded_rule_hits, ["RULE_1_PAT_DEFINITION_MISMATCH", "RULE_5_OK_TRUE_WITH_PAT", "RULE_6_PAT_MISSING_ON_OK_FALSE"], "discarded = 전체 union");
  assertEqual(out.metadata.low_confidence_flag, true, "low_flag true (강제)");
  assertEqual(out.metadata.candidate_for_human_review, true, "candidate true (마커)");
}

// ─── 종료 ────────────────────────────────────────────────────────
console.log(`\n────────────────────────────────────────`);
console.log(`결과: passed=${passed}, failed=${failed}`);
if (failed > 0) {
  console.log(`\n실패 ${failed}건:`);
  for (const f of failures) {
    console.log(`  - ${f.label}`);
  }
  process.exit(1);
} else {
  console.log(`✅ 전체 통과`);
  process.exit(0);
}
