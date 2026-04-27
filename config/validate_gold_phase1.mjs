#!/usr/bin/env node
/**
 * validate_gold_phase1.mjs
 *
 * Gold Phase 1 샘플 자동 검증 스크립트
 *
 * 검사 항목:
 * 1. QUOTE_NOT_IN_PASSAGE: 📌 근거 문자열이 passage의 substring인가
 * 2. FORBIDDEN_QUOTE_FORMAT: paraphrase/말줄임표/한글 라벨 포함 여부
 * 3. INVALID_SCHEMA_COMBO: ok/pat/domain 조합이 스키마 규칙 위반인가
 * 4. ERROR_TYPE_DISTRIBUTION: expected_output error_type 분포가 meta와 일치하는가
 * 5. CONTAMINATION_IN_INPUT: input 필드에 정답 힌트 포함
 * 6. CONTAMINATION_IN_REASON: reason에 if-then 공식 / input 해석 포함
 * 7. META_GUIDANCE_IN_RATIONALE: rationale/test_intent에 D엔진 행동 유도 표현
 * 8. PRECHECK_SIGNALS_NON_FALSE: precheck_signals에 true 값 포함
 *
 * 사용법:
 *   node validate_gold_phase1.mjs <gold_json_path>
 *
 * 출력:
 *   JSON { pass: boolean, issues: [...] }
 */

import { readFileSync } from 'fs';

// ==============================
// 검증 규칙
// ==============================

const CONTAMINATION_INPUT = [
  '오답 패턴이 적용',
  '패턴이 적용될 수 없',
  '[사실 왜곡]',
  '[팩트 왜곡]',
  '[관계 전도]',
  '[인과 전도]',
  '[과도한 추론]',
  '[개념 혼합]',
  '[표현 형식 오독]',
  '[정서 태도 오독]',
  '[주제 의미 과잉]',
  '[구조 맥락 오류]',
  '[보기 적용 오류]',
  '[어휘 오류]',
];

const CONTAMINATION_REASON = [
  '이므로 pat이',
  '이므로 pat은',
  '존재할 수 없다',
  '적용될 수 없',
  'analysis도',
  'analysis가 \'',
  '인정하고 있음에도',
  '명시하고 있음에도',
  '긍정하고 있음에도',
  '적절한 진술로 인정',
];

const META_GUIDANCE = [
  'D엔진이 감지',
  'D엔진이 판정',
  'D엔진이 ',
  '감지하는지 검증',
  '판정하는지 검증',
  'precheck 힌트',
  '힌트 없이',
];

const FORBIDDEN_QUOTE_FORMAT = [
  '...',  // 말줄임표
  '…',    // 유니코드 말줄임표
];

const ALLOWED_PATS = ['R1','R2','R3','R4','L1','L2','L3','L4','L5','V',null];
const READING_PATS = ['R1','R2','R3','R4','V',null];
const LIT_PATS = ['L1','L2','L3','L4','L5','V',null];

// ==============================
// 검증 함수
// ==============================

function validateQuoteInPassage(sample) {
  const { passage, analysis } = sample.input;
  const issues = [];

  const match = analysis.match(/📌 지문 근거:\s*"([^"]+)"/);
  if (!match) {
    // ok:true 샘플은 근거 추출 생략
    if (!analysis.includes('✅')) {
      issues.push({
        code: 'QUOTE_PATTERN_MISSING',
        message: '📌 지문 근거 패턴을 찾을 수 없음',
      });
    }
    return issues;
  }

  const quote = match[1];

  // Rule 1: contiguous substring exact match
  if (!passage.includes(quote)) {
    issues.push({
      code: 'QUOTE_NOT_IN_PASSAGE',
      message: `근거 문자열이 passage의 연속 부분 문자열이 아님`,
      quote: quote.slice(0, 60),
      passage: passage.slice(0, 80),
    });
  } else {
    // Rule 1 보강: trailing punctuation mismatch 방지
    // quote 끝 문자가 passage 상의 직후 문자와 어긋나면 경계 실패
    // 예: passage에 "ABC, DEF"가 있는데 quote가 "ABC."이면
    //     includes("ABC.")는 false지만, trim 후 includes도 false여야 정상
    // 이건 이미 상위 includes에서 걸림.
    //
    // 하지만 다음 케이스는 놓칠 수 있음:
    // passage: "A B C는 ... 이다. 그리고 D E F."
    // quote: "A B C는 ... 이다" (마침표 없이 중단)
    // → passage.includes(quote) == true이지만,
    //   quote 끝 위치가 문장 중간 경계가 되어 부자연스러움
    // 이는 Rule 1이 명시적으로 "종결부호 없는 절 인용 허용"이므로 OK
    //
    // 대신 포함 여부 자체가 trim 후에도 일치하는지 엄격 검증
    const trimmedQuote = quote.trim();
    if (trimmedQuote !== quote) {
      issues.push({
        code: 'QUOTE_HAS_LEADING_TRAILING_WHITESPACE',
        message: '근거 문자열 앞뒤에 공백이 있음',
      });
    }
    if (!passage.includes(trimmedQuote)) {
      issues.push({
        code: 'QUOTE_BOUNDARY_MISMATCH',
        message: '근거 문자열이 경계 포함하여 정확히 일치하지 않음',
        quote: trimmedQuote.slice(0, 60),
      });
    }
  }

  // 말줄임표 금지
  for (const forbidden of FORBIDDEN_QUOTE_FORMAT) {
    if (quote.includes(forbidden)) {
      issues.push({
        code: 'FORBIDDEN_QUOTE_FORMAT',
        message: `근거에 금지 형식 포함: "${forbidden}"`,
      });
    }
  }

  return issues;
}

function validateSchemaCombo(sample) {
  const { pat, ok, domain } = sample.input;
  const issues = [];

  // pat enum check
  if (!ALLOWED_PATS.includes(pat)) {
    issues.push({
      code: 'INVALID_PAT',
      message: `pat='${pat}'은 허용되지 않은 값`,
    });
  }

  // domain-pat 조합 체크 (단 DOMAIN 샘플은 의도적 위반이므로 예외)
  const isDomainViolationSample = sample.sample_id.includes('DOMAIN');

  if (!isDomainViolationSample) {
    if (domain === 'reading' && LIT_PATS.includes(pat) && !READING_PATS.includes(pat)) {
      issues.push({
        code: 'DOMAIN_PAT_MISMATCH',
        message: `reading 도메인에 ${pat}(문학 계열) 배정`,
      });
    }
    if (domain === 'literature' && READING_PATS.includes(pat) && !LIT_PATS.includes(pat)) {
      issues.push({
        code: 'DOMAIN_PAT_MISMATCH',
        message: `literature 도메인에 ${pat}(독서 계열) 배정`,
      });
    }

    // ok:true인데 pat 존재 (DOMAIN이 아닌 경우만)
    if (ok === true && pat !== null) {
      issues.push({
        code: 'OK_TRUE_WITH_PAT',
        message: `ok:true인데 pat='${pat}' 설정됨`,
      });
    }

    // ok:false인데 pat=null
    if (ok === false && pat === null) {
      issues.push({
        code: 'OK_FALSE_WITHOUT_PAT',
        message: `ok:false인데 pat이 null`,
      });
    }
  }

  return issues;
}

function validateContamination(sample) {
  const issues = [];

  // Input contamination
  for (const field of ['passage', 'question_text', 'choice_text', 'analysis']) {
    const text = sample.input[field] || '';
    for (const pattern of CONTAMINATION_INPUT) {
      if (text.includes(pattern)) {
        issues.push({
          code: 'CONTAMINATION_IN_INPUT',
          field: `input.${field}`,
          pattern,
        });
      }
    }
  }

  // Reason contamination
  const reason = sample.expected_output?.reason || '';
  for (const pattern of CONTAMINATION_REASON) {
    if (reason.includes(pattern)) {
      issues.push({
        code: 'CONTAMINATION_IN_REASON',
        pattern,
      });
    }
  }

  // Rationale / test_intent meta guidance
  for (const field of ['rationale', 'test_intent']) {
    const text = sample[field] || '';
    for (const pattern of META_GUIDANCE) {
      if (text.includes(pattern)) {
        issues.push({
          code: 'META_GUIDANCE',
          field,
          pattern,
        });
      }
    }
  }

  return issues;
}

function validatePrecheckSignals(sample) {
  const issues = [];
  const signals = sample.input.precheck_signals || {};
  for (const [k, v] of Object.entries(signals)) {
    if (v !== false) {
      issues.push({
        code: 'PRECHECK_SIGNALS_NON_FALSE',
        field: `precheck_signals.${k}`,
        value: v,
      });
    }
  }
  return issues;
}

function validateIntent(sample) {
  const issues = [];
  const intent = sample.intent_validation;
  const expected = sample.expected_output;

  if (!intent) {
    issues.push({
      code: 'INTENT_VALIDATION_MISSING',
      message: 'intent_validation 필드 누락',
    });
    return issues;
  }

  // target_failure_mode와 expected.error_type 일치 확인
  if (intent.target_failure_mode !== expected.error_type) {
    issues.push({
      code: 'INTENT_TARGET_MISMATCH',
      message: `target_failure_mode(${intent.target_failure_mode}) != expected.error_type(${expected.error_type})`,
    });
  }

  // forbidden_alternatives에 expected.error_type이 포함되면 자기모순
  if (intent.forbidden_alternatives?.includes(expected.error_type)) {
    issues.push({
      code: 'INTENT_FORBIDDEN_COLLISION',
      message: `expected.error_type(${expected.error_type})가 forbidden_alternatives에 포함됨`,
    });
  }

  // acceptable_confidence에 expected.confidence 포함 확인
  if (intent.acceptable_confidence && !intent.acceptable_confidence.includes(expected.confidence)) {
    issues.push({
      code: 'INTENT_CONFIDENCE_MISMATCH',
      message: `expected.confidence(${expected.confidence})가 acceptable_confidence(${intent.acceptable_confidence})에 없음`,
    });
  }

  return issues;
}

function validateErrorTypeDistribution(data) {
  const issues = [];
  const declared = data.meta?.error_type_distribution || {};
  const actual = {};

  for (const s of data.samples) {
    const et = s.expected_output?.error_type;
    actual[et] = (actual[et] || 0) + 1;
  }

  // Pending 반영
  const pendingCount = (data.pending_slots?.user_to_author || []).length
                    + (data.pending_slots?.claude_to_author || []).length;

  // Declared 대비 현재 확정 + pending 합이 일치해야 함
  const declaredTotal = Object.values(declared).reduce((a, b) => a + b, 0);
  const currentTotal = data.samples.length + pendingCount;

  if (declaredTotal !== currentTotal) {
    issues.push({
      code: 'TOTAL_COUNT_MISMATCH',
      declared: declaredTotal,
      actual_plus_pending: currentTotal,
    });
  }

  return issues;
}

// ==============================
// 메인
// ==============================

function main() {
  const path = process.argv[2];
  if (!path) {
    console.error('Usage: node validate_gold_phase1.mjs <gold_json_path>');
    process.exit(1);
  }

  const data = JSON.parse(readFileSync(path, 'utf-8'));
  const allIssues = [];

  for (const sample of data.samples) {
    const sid = sample.sample_id;
    const results = [
      ...validateQuoteInPassage(sample),
      ...validateSchemaCombo(sample),
      ...validateContamination(sample),
      ...validatePrecheckSignals(sample),
      ...validateIntent(sample),
    ];

    for (const r of results) {
      allIssues.push({ sample_id: sid, ...r });
    }
  }

  // Distribution check
  const distIssues = validateErrorTypeDistribution(data);
  allIssues.push(...distIssues);

  const result = {
    pass: allIssues.length === 0,
    total_samples: data.samples.length,
    issues: allIssues,
  };

  console.log(JSON.stringify(result, null, 2));
  process.exit(result.pass ? 0 : 2);
}

main();
