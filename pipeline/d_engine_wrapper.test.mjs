/**
 * §4.1 D엔진 wrapper 회귀 테스트 12건
 *
 * 실행:
 *   node C:\Users\downf\suneung-viewer\pipeline\d_engine_wrapper.test.mjs
 *
 * 사양: HANDOVER_D_ENGINE_4_1_SPEC.md v1.1 §4-7
 *
 * mockCaller 매핑 정책 (§4-6):
 *   Gold 17개 expected_output을 fixture로 사용. JSON 파일 그대로 import.
 *   prompt에서 input.choice_text 인식하여 sample 매칭.
 *   variant: 기본 (Gold 매핑) / throw / invalid / 의도적 변형 / 호출별 다른 응답
 *
 * 1건 실패 시 exit code 1.
 */

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve as pathResolve } from "path";
import { callDEngineWithMajority } from "./d_engine_wrapper.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const GOLD_PATH = pathResolve(
  __dirname,
  "../config/d_engine_gold_samples_phase1.json"
);
const GOLD = JSON.parse(readFileSync(GOLD_PATH, "utf-8"));
const SAMPLES = GOLD.samples; // 17개

let passed = 0;
let failed = 0;
const failures = [];

function ok(label, condition, info) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${label}`);
  } else {
    failed++;
    failures.push({ label, info });
    console.log(`  ❌ ${label}`);
    if (info !== undefined) console.log(`     info: ${JSON.stringify(info)}`);
  }
}

async function expectThrow(label, fn) {
  try {
    await fn();
    failed++;
    failures.push({ label, info: "did not throw" });
    console.log(`  ❌ ${label} (did not throw)`);
  } catch (e) {
    passed++;
    console.log(`  ✅ ${label} (threw: ${e.message.slice(0, 60)}…)`);
  }
}

// ─── mockCaller variants ──────────────────────────────────────────

// prompt 안의 choice_text로 sample 매칭
function findSampleByPrompt(prompt) {
  for (const s of SAMPLES) {
    if (prompt.includes(s.input.choice_text)) return s;
  }
  return null;
}

// 기본: Gold expected_output 그대로 반환
// §4-5 사양: caller는 async (Promise 반환). spec 일치성.
async function defaultMockCaller(prompt /*, options */) {
  const s = findSampleByPrompt(prompt);
  if (!s) throw new Error(`mockCaller: sample not found in prompt`);
  // expected_output 복사 (참조 공유 회피)
  return JSON.parse(JSON.stringify(s.expected_output));
}

// throw 항상
async function throwingMockCaller() {
  throw new Error("mock: caller failure");
}

// 호출 카운트별 다른 응답 (factory)
function makeMockCallerWithSequence(responses) {
  let i = 0;
  return async function (/* prompt, options */) {
    if (i >= responses.length) {
      throw new Error(`mock: sequence exhausted (i=${i})`);
    }
    const r = responses[i++];
    if (r instanceof Error) throw r;
    return r;
  };
}

// invalid 응답 반환 (필드 누락)
async function invalidMockCaller() {
  return { pass: true /* missing fields */ };
}

// ─── input fixtures ──────────────────────────────────────────────

function getInput(sampleId) {
  const s = SAMPLES.find((x) => x.sample_id === sampleId);
  if (!s) throw new Error(`getInput: sample_id '${sampleId}' not found`);
  // input 복사 + bogi 명시 (선지에 따라 null/객체)
  return JSON.parse(JSON.stringify(s.input));
}

// ─── 테스트 시작 ──────────────────────────────────────────────────

async function main() {
  console.log("\n[§4.1 wrapper 회귀 테스트 12건]");

  // ── 케이스 1: Phase 1 Gold 17개 회귀 ────────────────────────────
  console.log("\n1. Phase 1 Gold 17개 회귀 (single_pass 16 + majority_accepted 1)");
  {
    let countSinglePass = 0;
    let countMajorityAccepted = 0;
    let countNeedsHuman = 0;
    for (const s of SAMPLES) {
      const out = await callDEngineWithMajority(s.input, {
        caller: defaultMockCaller,
      });
      if (out.decision === "single_pass") countSinglePass++;
      else if (out.decision === "majority_accepted") countMajorityAccepted++;
      else if (out.decision === "needs_human") countNeedsHuman++;
    }
    ok("17개 처리 완료", true);
    ok("single_pass 16건", countSinglePass === 16, {
      countSinglePass,
      countMajorityAccepted,
      countNeedsHuman,
    });
    ok("majority_accepted 1건 (R1_006)", countMajorityAccepted === 1);
    ok("needs_human 0건", countNeedsHuman === 0);
  }

  // ── 케이스 2: RULE_7 트리거 검증 (R1_006) ───────────────────────
  console.log("\n2. RULE_7 트리거 검증 (gold_R1_006)");
  {
    const input = getInput("gold_R1_006");
    const out = await callDEngineWithMajority(input, {
      caller: defaultMockCaller,
    });
    ok("decision = majority_accepted", out.decision === "majority_accepted", {
      decision: out.decision,
    });
    ok(
      "trigger_reason = rule_7_detected",
      out.metadata.trigger_reason === "rule_7_detected"
    );
    ok("run_count = 3", out.metadata.run_count === 3);
    ok("runs.length = 3", out.metadata.runs.length === 3);
    ok(
      "final.error_type = E_LOGIC_UNCLEAR",
      out.final.error_type === "E_LOGIC_UNCLEAR"
    );
    ok(
      "final.rule_hits intersection 보존",
      JSON.stringify(out.final.rule_hits) ===
        JSON.stringify(["RULE_7_ANALYSIS_TOO_VAGUE"])
    );
  }

  // ── 케이스 3: single_pass (R1_001) ──────────────────────────────
  console.log("\n3. single_pass 케이스 (gold_R1_001)");
  {
    const input = getInput("gold_R1_001");
    const out = await callDEngineWithMajority(input, {
      caller: defaultMockCaller,
    });
    ok("decision = single_pass", out.decision === "single_pass");
    ok(
      "trigger_reason = no_trigger",
      out.metadata.trigger_reason === "no_trigger"
    );
    ok("run_count = 1", out.metadata.run_count === 1);
    ok("runs.length = 1", out.metadata.runs.length === 1);
    ok("low_confidence_flag = false (v1.1-5)", out.metadata.low_confidence_flag === false);
    ok("discarded_rule_hits = null", out.metadata.discarded_rule_hits === null);
    ok(
      "candidate_for_human_review = false",
      out.metadata.candidate_for_human_review === false
    );
  }

  // ── 케이스 4: 입력 검증 throw (E5) ──────────────────────────────
  console.log("\n4. 입력 검증 throw (E5)");
  {
    let callerCalled = false;
    const spyCaller = async (/* prompt, options */) => {
      callerCalled = true;
      return defaultMockCaller("");
    };
    await expectThrow("필수 필드 누락 throw", async () => {
      await callDEngineWithMajority(
        { passage: "x" /* 나머지 9개 누락 */ },
        { caller: spyCaller }
      );
    });
    ok("caller 호출 안 됨", callerCalled === false);
  }

  // ── 케이스 5: caller 실패 throw (E1) ────────────────────────────
  console.log("\n5. caller 실패 throw (E1, max_caller_retries 후)");
  {
    const input = getInput("gold_R1_001");
    let attempts = 0;
    const counter = async (/* prompt, options */) => {
      attempts++;
      throw new Error("network");
    };
    await expectThrow("max_caller_retries 후 throw", async () => {
      await callDEngineWithMajority(input, {
        caller: counter,
        max_caller_retries: 1, // 짧게
        max_format_retries: 0,
      });
    });
    ok(
      "caller 호출 정확히 max_caller_retries+1회 (= 2회)",
      attempts === 2,
      { attempts }
    );
  }

  // ── 케이스 6: 형식 오류 후 정상 회복 (E2 보강) ──────────────────
  console.log("\n6. 응답 형식 오류 후 회복 (E2)");
  {
    const input = getInput("gold_R1_001");
    const validResponse = JSON.parse(
      JSON.stringify(SAMPLES[0].expected_output)
    );
    const seq = makeMockCallerWithSequence([
      { pass: true /* invalid */ }, // 1차: 형식 오류
      validResponse, // format retry 1: 정상
    ]);
    const out = await callDEngineWithMajority(input, {
      caller: seq,
      max_format_retries: 3,
      max_caller_retries: 0,
    });
    ok("회복 후 single_pass", out.decision === "single_pass");
  }

  // ── 케이스 7: 부분 실패 처리 (E3) ───────────────────────────────
  console.log("\n7. 부분 실패 처리 (E3, 2차 throw)");
  {
    const input = getInput("gold_R1_006"); // RULE_7 트리거 sample
    const expected = JSON.parse(
      JSON.stringify(
        SAMPLES.find((s) => s.sample_id === "gold_R1_006").expected_output
      )
    );
    const seq = makeMockCallerWithSequence([
      expected, // 1차 정상
      new Error("2차 실패"),
      new Error("2차 실패 retry 1"),
      expected, // 3차 정상
    ]);
    const out = await callDEngineWithMajority(input, {
      caller: seq,
      max_caller_retries: 1, // 1회 retry → 2차는 최종 실패
      max_format_retries: 0,
    });
    ok("decision = needs_human (length<3)", out.decision === "needs_human");
    ok("final = null", out.final === null);
    ok(
      "candidate_for_human_review = true",
      out.metadata.candidate_for_human_review === true
    );
    ok("errors 기록", Array.isArray(out.metadata.errors) && out.metadata.errors.length >= 1);
    ok(
      "errors[0].error_level = caller (v1.1-6)",
      out.metadata.errors[0].error_level === "caller"
    );
  }

  // ── 케이스 8: metadata 출력 스키마 검증 ──────────────────────────
  console.log("\n8. metadata 출력 스키마 검증");
  {
    const input = getInput("gold_R1_006");
    const out = await callDEngineWithMajority(input, {
      caller: defaultMockCaller,
    });
    const m = out.metadata;
    ok("run_count 존재", typeof m.run_count === "number");
    ok("trigger_reason 존재", typeof m.trigger_reason === "string");
    ok("diversity_count 존재", typeof m.diversity_count === "number");
    ok("majority_count 존재", typeof m.majority_count === "number");
    ok(
      "low_confidence_flag boolean",
      typeof m.low_confidence_flag === "boolean"
    );
    ok(
      "discarded_rule_hits string[] | null",
      m.discarded_rule_hits === null || Array.isArray(m.discarded_rule_hits)
    );
    ok(
      "candidate_for_human_review boolean",
      typeof m.candidate_for_human_review === "boolean"
    );
    ok("runs Array", Array.isArray(m.runs));
    ok("timestamp ISO 8601", typeof m.timestamp === "string" && m.timestamp.includes("T"));
    ok(
      "api_call_durations_ms Array",
      Array.isArray(m.api_call_durations_ms)
    );
  }

  // ── 케이스 9: timestamp + api_call_durations_ms 정확성 ──────────
  console.log("\n9. timestamp + api_call_durations_ms 기록");
  {
    const input = getInput("gold_R1_001");
    const before = Date.now();
    const out = await callDEngineWithMajority(input, {
      caller: defaultMockCaller,
    });
    const after = Date.now();
    const tsMs = new Date(out.metadata.timestamp).getTime();
    ok("timestamp in [before, after]", tsMs >= before && tsMs <= after, {
      before,
      tsMs,
      after,
    });
    ok(
      "api_call_durations_ms.length === 1 (single_pass)",
      out.metadata.api_call_durations_ms.length === 1
    );
    ok(
      "duration is number >= 0",
      typeof out.metadata.api_call_durations_ms[0] === "number" &&
        out.metadata.api_call_durations_ms[0] >= 0
    );
  }

  // ── 케이스 10: parallel 옵션 동작 ───────────────────────────────
  console.log("\n10. parallel 옵션 (true) — RULE_7 트리거 sample에서 3회 호출");
  {
    const input = getInput("gold_R1_006");
    const out = await callDEngineWithMajority(input, {
      caller: defaultMockCaller,
      parallel: true,
    });
    ok(
      "decision = majority_accepted",
      out.decision === "majority_accepted"
    );
    ok("runs.length === 3", out.metadata.runs.length === 3);
    ok(
      "api_call_durations_ms.length === 3",
      out.metadata.api_call_durations_ms.length === 3
    );
  }

  // ── 케이스 11: self-fulfilling 방지 (의도적 변형) ───────────────
  console.log("\n11. caller 응답 의도적 변형 (self-fulfilling 방지)");
  {
    const input = getInput("gold_R1_001"); // expected: pass=true, NONE
    const variantCaller = async () => ({
      pass: false,
      error_type: "P_MISMATCH", // 의도적 변형
      rule_hits: ["RULE_1_PAT_DEFINITION_MISMATCH"],
      reason: "의도적 변형",
      confidence: "high",
    });
    const out = await callDEngineWithMajority(input, {
      caller: variantCaller,
    });
    ok(
      "decision = single_pass (RULE_7 미발동)",
      out.decision === "single_pass"
    );
    ok(
      "final.error_type = P_MISMATCH (caller 그대로)",
      out.final.error_type === "P_MISMATCH"
    );
    ok("final.pass = false (caller 그대로)", out.final.pass === false);
  }

  // ── 케이스 12: needs_human 분기 (1/1/1) ─────────────────────────
  console.log("\n12. needs_human 분기 (1/1/1, RULE_7 발동 + 다른 et)");
  {
    const input = getInput("gold_R1_006"); // RULE_7 트리거 발동시킴
    const seq = makeMockCallerWithSequence([
      {
        pass: false,
        error_type: "E_LOGIC_UNCLEAR",
        rule_hits: ["RULE_7_ANALYSIS_TOO_VAGUE"],
        reason: "1차",
        confidence: "high",
      },
      {
        pass: false,
        error_type: "P_MISMATCH",
        rule_hits: ["RULE_1_PAT_DEFINITION_MISMATCH"],
        reason: "2차",
        confidence: "high",
      },
      {
        pass: false,
        error_type: "E_EVIDENCE_WEAK",
        rule_hits: ["RULE_2_EVIDENCE_NOT_DIRECT"],
        reason: "3차",
        confidence: "high",
      },
    ]);
    const out = await callDEngineWithMajority(input, {
      caller: seq,
    });
    ok("decision = needs_human", out.decision === "needs_human", {
      decision: out.decision,
    });
    ok("final = null", out.final === null);
    ok("runs.length === 3", out.metadata.runs.length === 3);
    ok("diversity_count === 3", out.metadata.diversity_count === 3);
  }

  // ─── 종료 ──────────────────────────────────────────────────────
  console.log(`\n────────────────────────────────────────`);
  console.log(`결과: passed=${passed}, failed=${failed}`);
  if (failed > 0) {
    console.log(`\n실패 ${failed}건:`);
    for (const f of failures) {
      console.log(`  - ${f.label}`);
      if (f.info !== undefined) console.log(`    info: ${JSON.stringify(f.info)}`);
    }
    process.exit(1);
  } else {
    console.log(`✅ 전체 통과`);
    process.exit(0);
  }
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
