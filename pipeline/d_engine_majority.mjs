/**
 * §4.2 D엔진 majority 판정 함수
 *
 * 3개 D엔진 응답을 입력 받아 최빈값 기반 판정을 반환한다.
 * §4.1 wrapper(RULE_7 트리거)에서 3회 호출 후 본 함수에 위임한다.
 *
 * 사양: 2026-04-27 v2 (intersection + discarded + candidate 보강).
 *   - rule_hits 채택 = majority 응답의 intersection
 *   - discarded_rule_hits = (전체 union) - (final intersection) 보존
 *   - intersection 빈 배열 + error_type≠NONE → low_confidence_flag 강제 true
 *   - 동시에 candidate_for_human_review=true 마커 (Stage 2 후 분기 정식 결정)
 *
 * 변경 시 d_engine_majority.test.mjs 15개 회귀 테스트 통과 필수.
 *
 * 입력
 *   responses: D엔진 응답 3개 배열
 *   각 응답: { pass: bool, error_type: enum, rule_hits: string[], reason: string, confidence: "high"|"mid"|"low" }
 *
 * 출력
 *   {
 *     decision: "majority_accepted" | "needs_human",
 *     final: { pass, error_type, rule_hits, confidence } | null,
 *     metadata: {
 *       diversity_count,
 *       majority_count,
 *       low_confidence_flag,
 *       discarded_rule_hits: string[] | null,   // null when needs_human (5-3 미산출)
 *       candidate_for_human_review: boolean,
 *       runs?: [{ error_type, rule_hits, confidence }, ...]  // present only when needs_human (5-3)
 *     }
 *   }
 *
 * 엣지
 *   - 응답 3개 미만/초과 → throw
 *   - error_type enum 외 → throw
 *   - 최빈 응답이 pass=true & error_type≠NONE → low_confidence_flag 강제 true
 *   - intersection 빈 배열 + error_type≠NONE → low_confidence_flag + candidate_for_human_review 강제 true
 *
 * 설계 근거
 *   - rule_hits는 "판정 근거"가 아니라 "디버깅 신호"
 *   - final.rule_hits = 보수적 채택 (intersection)
 *   - discarded_rule_hits = 전체 디버깅 신호 (Stage 2 측정용)
 *   - 자동 needs_human 분기 X — 트리거 #1 오발동 회피, Stage 2 후 정식 결정
 */

const VALID_ERROR_TYPES = new Set([
  "NONE",
  "P_MISMATCH",
  "E_EVIDENCE_WEAK",
  "E_CONDITION_MISSING",
  "E_LOGIC_UNCLEAR",
  "E_COMPOSITE_ERROR",
  "E_DOMAIN_INVALID",
]);

// ── 집합 유틸리티 (외부 의존 0) ──────────────────────────────────
function intersect(arrays) {
  if (arrays.length === 0) return [];
  const sets = arrays.map((a) => new Set(a));
  // 첫 배열을 기준으로 순회하여 삽입 순서 유지
  return [...sets[0]].filter((item) => sets.every((s) => s.has(item)));
}

function union(arrays) {
  const u = new Set();
  for (const arr of arrays) for (const item of arr) u.add(item);
  return [...u];
}

function difference(superArr, subsetArr) {
  const subSet = new Set(subsetArr);
  return superArr.filter((item) => !subSet.has(item));
}

// ── 본 함수 ───────────────────────────────────────────────────────
export function applyMajority(responses) {
  // 엣지: 입력 형식 검증
  if (!Array.isArray(responses) || responses.length !== 3) {
    throw new Error(
      `applyMajority: responses must be array of length 3, got ${
        Array.isArray(responses) ? responses.length : typeof responses
      }`
    );
  }
  for (const [i, r] of responses.entries()) {
    if (r === null || typeof r !== "object") {
      throw new Error(`applyMajority: response[${i}] is not an object`);
    }
    if (!VALID_ERROR_TYPES.has(r.error_type)) {
      throw new Error(
        `applyMajority: response[${i}].error_type='${r.error_type}' not in valid enum`
      );
    }
    if (!Array.isArray(r.rule_hits)) {
      throw new Error(
        `applyMajority: response[${i}].rule_hits is not an array`
      );
    }
  }

  // 1. error_type 최빈값 카운트
  const counts = new Map();
  for (const r of responses) {
    counts.set(r.error_type, (counts.get(r.error_type) ?? 0) + 1);
  }
  const diversity_count = counts.size;
  const majority_count = Math.max(...counts.values());

  // 4. 1/1/1 (전부 다름) → needs_human (5-3: discarded 미산출, runs 보존)
  if (diversity_count === 3) {
    return {
      decision: "needs_human",
      final: null,
      metadata: {
        diversity_count,
        majority_count, // 1
        low_confidence_flag: false,
        discarded_rule_hits: null, // 미산출 (final 자체가 null)
        candidate_for_human_review: false,
        runs: responses.map((r) => ({
          error_type: r.error_type,
          rule_hits: r.rule_hits,
          confidence: r.confidence,
        })),
      },
    };
  }

  // 2~3. 3/3 또는 2/3 → majority_accepted
  // 최빈 error_type
  let majorityErrorType = null;
  for (const [et, c] of counts) {
    if (c === majority_count) {
      majorityErrorType = et;
      break;
    }
  }

  // 최빈 그룹 응답들 (3/3은 전부, 2/3은 동일 et 응답 2개)
  const majorityResponses = responses.filter(
    (r) => r.error_type === majorityErrorType
  );

  // 5-1, 5-2: rule_hits = majority 그룹 intersection
  const finalRuleHits = intersect(majorityResponses.map((r) => r.rule_hits));

  // discarded = (전체 union) - (final intersection)
  // → 5-2의 "소수 응답 rule_hits 포함" 자동 만족
  const allRuleHitsUnion = union(responses.map((r) => r.rule_hits));
  const discardedRuleHits = difference(allRuleHitsUnion, finalRuleHits);

  // 6. confidence 산출
  let confidence;
  let low_confidence_flag = false;
  if (majority_count === 3) {
    const allHigh = responses.every((r) => r.confidence === "high");
    confidence = allHigh ? "high" : "mid";
  } else {
    confidence = "mid";
    low_confidence_flag = true;
  }

  // 엣지: pass=true & error_type≠NONE → low_flag 강제 (기존)
  // majority 응답 중 첫 번째를 pass 출처로 (3/3은 첫, 2/3은 majority 그룹 첫)
  const primaryMajority = majorityResponses[0];
  if (primaryMajority.pass === true && majorityErrorType !== "NONE") {
    low_confidence_flag = true;
  }

  // 5-4: intersection 빈 배열 + et≠NONE → low_flag + candidate 강제 (신규)
  let candidate_for_human_review = false;
  if (finalRuleHits.length === 0 && majorityErrorType !== "NONE") {
    low_confidence_flag = true;
    candidate_for_human_review = true;
  }

  return {
    decision: "majority_accepted",
    final: {
      pass: primaryMajority.pass,
      error_type: majorityErrorType,
      rule_hits: finalRuleHits,
      confidence,
    },
    metadata: {
      diversity_count,
      majority_count,
      low_confidence_flag,
      discarded_rule_hits: discardedRuleHits,
      candidate_for_human_review,
    },
  };
}
