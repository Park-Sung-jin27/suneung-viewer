/**
 * §4.1 D엔진 wrapper — callDEngineWithMajority
 *
 * RULE_7_ANALYSIS_TOO_VAGUE 트리거 시 3회 호출 후 applyMajority(§4.2) 위임.
 * 미트리거 시 single_pass로 1차 응답 그대로 반환.
 *
 * 사양: HANDOVER_D_ENGINE_4_1_SPEC.md v1.1 (2026-04-27)
 * 자가 검토: 통과 (모호점 6건 minor, 구현 차단 0건)
 *
 * minor 5건 처리 정책 (v1.1-1, 2, 3, 4, 6) — 코드 내 주석으로 명시.
 * v1.1-5 결정 (single_pass low_confidence_flag = false 강제) — Step 3 분기에 적용.
 *
 * 변경 시 d_engine_wrapper.test.mjs 12건 회귀 통과 필수.
 */

import { applyMajority } from "./d_engine_majority.mjs";

// ─── [v1.1-1 결정: D_ENGINE_PROMPT const 인라인] ──────────────────
// 사유: I/O 1회 회피 + 단순화
// v1.2 통합 대상: config/d_engine_prompt.txt와 SSoT 통합
// 본문은 config/d_engine_prompt.txt 2026-04-27 시점 그대로
const D_ENGINE_PROMPT = `역할: 수능 국어 오답 pat 검증 심판.
너는 pat을 새로 만들지 않는다.
Claude가 제시한 pat이 실제 오류 구조와 맞는지, 틀렸는지만 판정한다.
"맞다"를 증명할 책임은 없고, "틀렸다"를 구조적으로 지적하는 역할만 한다.
중요:
- ok는 참고 메타데이터일 뿐, pat 정당화 근거가 아니다.
- passage + question_text + choice_text + analysis를 기준으로만 fail 여부를 판단하라.
- 애매하면 통과시키지 말고 fail로 보내라.
- confidence=low이면 pass=true를 절대 주지 마라.
입력 JSON:
{여기에 sample의 input JSON을 붙여넣기}
판정 규칙:
Rule 0. 도메인 유효성 위반 여부
Rule 1. pat 정의와 analysis의 실제 오류 구조 일치 여부
Rule 2. analysis의 근거가 선지 판단에 직접 쓰이는가
Rule 3. 선지의 주요 조건이 analysis에 반영되었는가
Rule 4. 복합 오류가 단일 pat에 꽂혀 있는가
Rule 5. analysis가 너무 vague해서 pat 검증이 불가능한가
pat 정의:
- R1 팩트 왜곡: 수치/상태/방향 불일치
- R2 관계·인과 전도: 주체-객체/원인-결과 반전
- R3 과도한 추론: 지문에 없는 내용/1단계 이상 비약
- R4 개념 짜깁기: 서로 다른 문단 개념 혼합
- L1 표현·형식 오독
- L2 정서·태도 오독
- L3 주제·의미 과잉
- L4 구조·맥락 오류
- L5 보기 대입 오류
- V 어휘 치환·문맥 의미 오류
도메인 제약:
- reading: R1~R4, V만 허용
- literature: L1~L5, V만 허용
error_type 우선순위 (다중 위반 시 대표값 1개만):
1. E_DOMAIN_INVALID
2. E_COMPOSITE_ERROR
3. P_MISMATCH
4. E_CONDITION_MISSING
5. E_EVIDENCE_WEAK
6. E_LOGIC_UNCLEAR
7. NONE

error_type 선택 시 우선순위 보정 규칙:
- RULE_0 또는 RULE_5 또는 RULE_6이 hit된 경우,
  error_type은 E_DOMAIN_INVALID 또는 P_MISMATCH 중 하나로 선택한다.

rule_hits IDs (매칭된 규칙 모두 기록):
- RULE_0_DOMAIN_INVALID
- RULE_1_PAT_DEFINITION_MISMATCH
- RULE_2_EVIDENCE_NOT_DIRECT
- RULE_3_CONDITION_MISSING
- RULE_4_COMPOSITE_ERROR
- RULE_5_OK_TRUE_WITH_PAT
- RULE_6_PAT_MISSING_ON_OK_FALSE
- RULE_7_ANALYSIS_TOO_VAGUE
출력 JSON 스키마 (엄수):
{
  "pass": boolean,
  "error_type": "NONE|P_MISMATCH|E_EVIDENCE_WEAK|E_LOGIC_UNCLEAR|E_CONDITION_MISSING|E_DOMAIN_INVALID|E_COMPOSITE_ERROR",
  "rule_hits": ["RULE_ID"],
  "reason": "1-2문장",
  "confidence": "high|mid|low"
}
출력 규칙:
- suggested_pat 출력 금지
- confidence=low 이면 반드시 pass=false
- rule_hits는 실제 매칭된 규칙만 넣어라
- error_type은 우선순위에 따라 대표값 1개만 선택하라
- reason은 fail 시 구조적 근거를 간결하게 써라
- JSON 외 다른 설명 텍스트 추가 금지, 순수 JSON만 출력
지금 위 입력 JSON에 대한 판정을 JSON 형식으로만 출력하라.`;

// ─── 상수 ────────────────────────────────────────────────────────
const VALID_ERROR_TYPES = new Set([
  "NONE",
  "P_MISMATCH",
  "E_EVIDENCE_WEAK",
  "E_CONDITION_MISSING",
  "E_LOGIC_UNCLEAR",
  "E_COMPOSITE_ERROR",
  "E_DOMAIN_INVALID",
]);
const VALID_CONFIDENCE = new Set(["high", "mid", "low"]);
const REQUIRED_INPUT_FIELDS = [
  "passage",
  "question_text",
  "choice_text",
  "analysis",
  "pat",
  "ok",
  "questionType",
  "bogi",
  "domain",
  "precheck_signals",
];
const REQUIRED_RESPONSE_FIELDS = [
  "pass",
  "error_type",
  "rule_hits",
  "reason",
  "confidence",
];
const RULE_7 = "RULE_7_ANALYSIS_TOO_VAGUE";

// ─── 유틸 ────────────────────────────────────────────────────────

// §4-5: prompt 빌드
function buildPrompt(input) {
  return `${D_ENGINE_PROMPT}

입력 JSON:
${JSON.stringify(input, null, 2)}

위 JSON에 대한 판정을 JSON 형식으로만 출력하라.`;
}

// Step 1 보조: input 필수 필드 검증
function validateInput(input) {
  if (input === null || typeof input !== "object") {
    throw new Error(
      "callDEngineWithMajority: input must be an object"
    );
  }
  for (const f of REQUIRED_INPUT_FIELDS) {
    if (!(f in input)) {
      throw new Error(
        `callDEngineWithMajority: missing required field '${f}'`
      );
    }
  }
}

// Step 2/4 보조: caller 응답 검증
function validateResponse(response) {
  if (response === null || typeof response !== "object") {
    throw new Error("response must be an object");
  }
  for (const f of REQUIRED_RESPONSE_FIELDS) {
    if (!(f in response)) {
      throw new Error(`response missing required field '${f}'`);
    }
  }
  if (typeof response.pass !== "boolean") {
    throw new Error(`response.pass must be boolean`);
  }
  if (!VALID_ERROR_TYPES.has(response.error_type)) {
    throw new Error(
      `response.error_type='${response.error_type}' not in valid enum`
    );
  }
  if (!Array.isArray(response.rule_hits)) {
    throw new Error("response.rule_hits must be an array");
  }
  if (typeof response.reason !== "string") {
    throw new Error("response.reason must be a string");
  }
  if (!VALID_CONFIDENCE.has(response.confidence)) {
    throw new Error(
      `response.confidence='${response.confidence}' not in valid enum`
    );
  }
}

// E7: timeout 적용 caller 호출
// caller가 sync 객체 반환 시도 Promise.resolve로 흡수 (defensive)
function withTimeout(promise, timeoutMs) {
  let timer;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`caller timeout after ${timeoutMs}ms`)),
      timeoutMs
    );
  });
  return Promise.race([
    Promise.resolve(promise).finally(() => clearTimeout(timer)),
    timeoutPromise,
  ]);
}

// Step 2/4 본체: 단일 호출 + retry (format + caller 독립)
//
// [v1.1-4 결정: max_format_retries와 max_caller_retries 독립 카운터]
// 사유: 일반적 패턴 + 누적 호출 비용 예측 가능
// v1.2 통합 대상: 두 retry 상호작용 정책 정식 명시
async function callOnce(
  caller,
  prompt,
  callerOptions,
  max_format_retries,
  max_caller_retries,
  timeout
) {
  // caller_retries: 네트워크/throw 실패 retry (지수 백오프)
  let callerLastError = null;
  for (
    let callerAttempt = 0;
    callerAttempt <= max_caller_retries;
    callerAttempt++
  ) {
    if (callerAttempt > 0) {
      const backoffMs = 1000 * Math.pow(2, callerAttempt - 1); // 1s, 2s, 4s
      await new Promise((r) => setTimeout(r, backoffMs));
    }

    let rawResponse;
    try {
      rawResponse = await withTimeout(caller(prompt, callerOptions), timeout);
    } catch (e) {
      callerLastError = e;
      continue; // caller_retries 다음 시도
    }

    // 응답 받음 → format_retries로 검증
    let formatLastError = null;
    let validResponse = null;
    let currentResponse = rawResponse;
    for (
      let formatAttempt = 0;
      formatAttempt <= max_format_retries;
      formatAttempt++
    ) {
      try {
        validateResponse(currentResponse);
        validResponse = currentResponse;
        break;
      } catch (e) {
        formatLastError = e;
        if (formatAttempt < max_format_retries) {
          // 형식 오류 → caller 1회 추가 호출 (format retry)
          try {
            currentResponse = await withTimeout(
              caller(prompt, callerOptions),
              timeout
            );
          } catch (callErr) {
            formatLastError = callErr;
            // format retry 도중 caller 실패 — format retry 실패로 처리
          }
        }
      }
    }

    if (validResponse !== null) {
      return validResponse;
    }
    // format_retries 모두 실패 → caller_retries 다음 시도로 흘려보냄
    callerLastError = formatLastError;
  }

  throw new Error(
    `callOnce failed after ${max_caller_retries + 1} caller attempts: ${
      callerLastError?.message ?? "unknown"
    }`
  );
}

// ─── 본 함수 ──────────────────────────────────────────────────────
//
// [v1.1-3 결정: wrapper-level vs caller-level options 분리 주석]
// wrapper-level: caller, timeout, parallel, max_format_retries, max_caller_retries
// caller-level: model, temperature, max_tokens
// v1.2 통합 대상: options.callerOptions로 중첩 또는 별도 인자
//
// [v1.1-2 정책: caller 내부 markdown fence (```json ... ```) strip 책임]
// 본 wrapper는 caller가 객체를 반환한다고 가정. raw text 처리는 caller 내부.
// mock 단계는 영향 없음. real GPT-5 caller(§4.1.5)에서 strip 처리 의무.
// v1.2 통합 대상: caller 인터페이스 사양에 strip 책임 정식 명시
export async function callDEngineWithMajority(input, options = {}) {
  const {
    // wrapper-level
    caller,
    timeout = 60000,
    max_format_retries = 3,
    max_caller_retries = 3,
    parallel = false,
    // caller-level
    model = "gpt-5",
    temperature = 0,
    max_tokens = 1000,
  } = options;

  // ── Step 1: 입력 검증 ──────────────────────────────────────────
  validateInput(input);
  if (typeof caller !== "function") {
    throw new Error(
      "callDEngineWithMajority: options.caller must be a function"
    );
  }

  const callerOptions = { model, temperature, max_tokens };
  const prompt = buildPrompt(input);

  const runs = [];
  const errors = [];
  const api_call_durations_ms = [];

  // ── Step 2: 1차 D엔진 호출 ──────────────────────────────────────
  const start1 = Date.now();
  let response1;
  try {
    response1 = await callOnce(
      caller,
      prompt,
      callerOptions,
      max_format_retries,
      max_caller_retries,
      timeout
    );
  } catch (e) {
    throw new Error(
      `callDEngineWithMajority: 1차 호출 max_retries 실패 — ${e.message}`
    );
  }
  api_call_durations_ms.push(Date.now() - start1);
  runs.push(response1);

  // ── Step 3: 재호출 트리거 검사 ─────────────────────────────────
  const triggerDetected = response1.rule_hits.includes(RULE_7);

  if (!triggerDetected) {
    // single_pass 분기
    //
    // [v1.1-5 결정: low_confidence_flag = false 강제]
    // 사유: low_confidence_flag = "majority 그룹 신뢰도 우려 마커"
    //   single_pass에는 majority 그룹 자체 없음 → 마커 발동 의미 부재
    //   confidence 정보는 final.confidence 필드로만 보존
    // v1.2 통합 대상: low_confidence_flag 의미 정식 명시
    return {
      decision: "single_pass",
      final: response1,
      metadata: {
        run_count: 1,
        trigger_reason: "no_trigger",
        diversity_count: 1,
        majority_count: 1,
        low_confidence_flag: false,
        discarded_rule_hits: null,
        candidate_for_human_review: false,
        runs: [response1],
        timestamp: new Date().toISOString(),
        api_call_durations_ms,
      },
    };
  }

  // ── Step 4: 2회 추가 호출 ──────────────────────────────────────
  if (parallel) {
    // [v1.1: E8 Promise.allSettled — E3 부분 실패 호환]
    const tasks = [0, 1].map(async () => {
      const start = Date.now();
      const response = await callOnce(
        caller,
        prompt,
        callerOptions,
        max_format_retries,
        max_caller_retries,
        timeout
      );
      return { response, duration: Date.now() - start };
    });
    const results = await Promise.allSettled(tasks);
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      if (r.status === "fulfilled") {
        runs.push(r.value.response);
        api_call_durations_ms.push(r.value.duration);
      } else {
        // [v1.1-6 결정: errors 배열에 error_level field 추가]
        // 사유: caller-level vs wrapper-level 구분
        // v1.2 통합 대상: errors 배열 스키마 정식 분리
        errors.push({
          run_index: i + 1,
          error_level: "caller",
          error_type: "caller_failure",
          message: r.reason?.message ?? String(r.reason),
        });
      }
    }
  } else {
    // 순차 호출
    for (let i = 0; i < 2; i++) {
      const start = Date.now();
      try {
        const response = await callOnce(
          caller,
          prompt,
          callerOptions,
          max_format_retries,
          max_caller_retries,
          timeout
        );
        runs.push(response);
        api_call_durations_ms.push(Date.now() - start);
      } catch (e) {
        errors.push({
          run_index: i + 1,
          error_level: "caller",
          error_type: "caller_failure",
          message: e.message,
        });
      }
    }
  }

  // Step 4 후 검증: runs.length < 3 → needs_human (Step 5 skip)
  if (runs.length < 3) {
    return {
      decision: "needs_human",
      final: null,
      metadata: {
        run_count: 3,
        trigger_reason: "rule_7_detected",
        diversity_count: null,
        majority_count: null,
        low_confidence_flag: false,
        discarded_rule_hits: null,
        candidate_for_human_review: true,
        runs,
        timestamp: new Date().toISOString(),
        api_call_durations_ms,
        errors: errors.length > 0 ? errors : undefined,
      },
    };
  }

  // ── Step 5: applyMajority 호출 ──────────────────────────────────
  let result;
  try {
    result = applyMajority(runs);
  } catch (e) {
    // E6: applyMajority throw → needs_human + wrapper-level error 기록
    return {
      decision: "needs_human",
      final: null,
      metadata: {
        run_count: 3,
        trigger_reason: "rule_7_detected",
        diversity_count: null,
        majority_count: null,
        low_confidence_flag: false,
        discarded_rule_hits: null,
        candidate_for_human_review: true,
        runs,
        timestamp: new Date().toISOString(),
        api_call_durations_ms,
        errors: [
          ...errors,
          {
            run_index: -1,
            error_level: "wrapper",
            error_type: "majority_failure",
            message: e.message,
          },
        ],
      },
    };
  }

  // ── Step 6: metadata 통합 ──────────────────────────────────────
  return {
    decision: result.decision,
    final: result.final,
    metadata: {
      run_count: 3,
      trigger_reason: "rule_7_detected",
      diversity_count: result.metadata.diversity_count,
      majority_count: result.metadata.majority_count,
      low_confidence_flag: result.metadata.low_confidence_flag,
      discarded_rule_hits: result.metadata.discarded_rule_hits,
      candidate_for_human_review: result.metadata.candidate_for_human_review,
      runs,
      timestamp: new Date().toISOString(),
      api_call_durations_ms,
      errors: errors.length > 0 ? errors : undefined,
    },
  };
}
