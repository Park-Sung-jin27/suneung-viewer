/**
 * pipeline/extraction_validator.mjs
 *
 * step2 추출 결과(pdf-parse 또는 Gemini) 에 대한 구조·마커 완결성 검증.
 * 이 파일은 텍스트를 수정하지 않는다. 위반 사항만 리포트.
 *
 * 검증 항목:
 *   [S1] 문항 번호 범위 정상 (startQ~endQ, 연속성)
 *   [S2] 각 문항 choice 수 == 5 (수능 표준)
 *   [S3] 보존 기호: <보기>, (가)(나)(다), [A][B], ㉠㉤, ⓐⓔ, ①⑤ 계열 중 발문에 나타나는 것 보존
 *   [M1] 마커 완결성: 발문이 ㉠~㉤ 같은 범위를 지시하면 범위 내 각 마커가 최소 1회 본문(choice 전체) 에 등장
 *   [M2] 마커 집중 위반: 발문 범위가 N개 마커이면 각 마커가 1회 이상 + 한 마커가 전체의 >60% 차지하면 integrity_fail
 *
 * 사용:
 *   import { validateQuestion, validateQuestionSet } from "./extraction_validator.mjs";
 *   const report = validateQuestion(questionObj);  // { passed: bool, issues: [...] }
 */

const MARKER_RANGE_RE =
  /([㉠-㉤]|[ⓐ-ⓔ]|[①-⑤])\s*[~～\-–—]\s*([㉠-㉤]|[ⓐ-ⓔ]|[①-⑤])/;

function codePointRangeChars(startCh, endCh) {
  const chars = [];
  const s = startCh.codePointAt(0);
  const e = endCh.codePointAt(0);
  for (let c = s; c <= e; c++) chars.push(String.fromCodePoint(c));
  return chars;
}

// 발문에서 마커 범위 해석. 예: "㉠~㉤" → ["㉠","㉡","㉢","㉣","㉤"]
export function parseMarkerRange(stem) {
  const m = stem.match(MARKER_RANGE_RE);
  if (!m) return null;
  const chars = codePointRangeChars(m[1], m[2]);
  return { start: m[1], end: m[2], expected: chars };
}

// 본문(choices 합산) 에서 각 마커 빈도
function countMarkersInChoices(choices, expected) {
  const joined = (choices || []).map((c) => c.t || "").join("\n");
  const freq = {};
  for (const ch of expected) {
    const esc = ch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    freq[ch] = (joined.match(new RegExp(esc, "g")) || []).length;
  }
  return freq;
}

export function validateQuestion(q, opts = {}) {
  const { expectedChoiceCount = 5 } = opts;
  const issues = [];

  // [S2] choice 수
  const n = (q.choices || []).length;
  if (n !== expectedChoiceCount) {
    issues.push({
      code: "S2_choice_count",
      severity: "error",
      got: n,
      expected: expectedChoiceCount,
    });
  }

  // [S3] stem 내 <보기> 참조가 있는데 bogi 가 비어있으면 경고
  if (/<\s*보\s*기\s*>/.test(q.stem || "") && !(q.bogi && q.bogi.trim())) {
    issues.push({ code: "S3_bogi_referenced_but_missing", severity: "warn" });
  }

  // [M1/M2] 마커 완결성
  const range = parseMarkerRange(q.stem || "");
  let marker_report = null;
  if (range) {
    const freq = countMarkersInChoices(q.choices, range.expected);
    const missing = range.expected.filter((ch) => (freq[ch] || 0) === 0);
    const total = Object.values(freq).reduce((a, b) => a + b, 0);
    const maxCh = range.expected.reduce(
      (best, ch) => (freq[ch] > (freq[best] || 0) ? ch : best),
      range.expected[0],
    );
    const dominance = total > 0 ? (freq[maxCh] || 0) / total : 0;

    marker_report = {
      range_label: `${range.start}~${range.end}`,
      expected_markers: range.expected,
      observed_freq: freq,
      missing_markers: missing,
      total_marker_hits: total,
      dominant_marker: maxCh,
      dominance_ratio: +dominance.toFixed(3),
    };

    if (missing.length > 0) {
      issues.push({
        code: "M1_marker_missing",
        severity: "error",
        missing_markers: missing,
        observed_freq: freq,
      });
    }
    if (range.expected.length >= 3 && dominance > 0.6) {
      issues.push({
        code: "M2_marker_dominance",
        severity: "error",
        dominant_marker: maxCh,
        dominance_ratio: dominance,
        observed_freq: freq,
        note: `한 마커가 전체의 ${(dominance * 100).toFixed(0)}% — OCR 오인식 의심`,
      });
    }
  }

  const errorCount = issues.filter((x) => x.severity === "error").length;
  return {
    qId: q.id ?? null,
    passed: errorCount === 0,
    issues,
    marker_report,
  };
}

export function validateQuestionSet(questions, opts = {}) {
  const perQ = questions.map((q) => validateQuestion(q, opts));
  const errorQs = perQ.filter((r) => !r.passed);

  // [S1] 번호 연속성
  const ids = questions.map((q) => q.id).filter((n) => Number.isFinite(n));
  const sorted = [...ids].sort((a, b) => a - b);
  const gaps = [];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] - sorted[i - 1] > 1) {
      gaps.push(`${sorted[i - 1]}→${sorted[i]}`);
    }
  }

  return {
    total: questions.length,
    passed: errorQs.length === 0 && gaps.length === 0,
    error_questions: errorQs.map((r) => ({
      qId: r.qId,
      issue_codes: r.issues.map((x) => x.code),
    })),
    id_gaps: gaps,
    per_question: perQ,
  };
}
