/**
 * Gate 1 v3 — Release Validator for public/data/all_data_204.json
 *
 * 정의: 현재 release 데이터의 구조적 안전성 검증기.
 *       canonical naming 강제기가 아니다.
 *
 * v2 → v3 변경:
 *   - SET_ID_RE 완화: legacy id (s1, kor25_a, sep25_a, l25b 등) 통과
 *   - domain 판정: section 인자 (array 위치 reading[] / literature[]) 사용. set.id prefix 의존 폐기.
 *   - sentId prefix 검사: set 내부 일관성만. set.id 와 일치 강제 X. 불일치 시 canonical debt warning.
 *   - pat=0: needs_human 카테고리 (release block 아님). step3_analysis.js 의 manual-review-flag 정합.
 *   - underscore sentId: canonical debt warning. cs_ids cascade 차단 룰 유지.
 *
 * 유지 (v2와 동일):
 *   - ok ↔ pat 정합 error (true 에 pat 박힘 / false 에 pat 누락)
 *   - ok 분포 vs questionType error
 *   - cs_ids broken ref error (실물 sentId 집합 기준)
 *   - cs_ids empty 분기 (정답 → error / R3·V → warning / 그 외 오답 → error)
 *   - analysis blank error
 *   - answer-key cross-check = needs_human
 *
 * 절대 금지:
 *   - 자동 patch / override 적용
 *   - canonical migration 강제 (별도 Phase)
 */

'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// 상수
// ─────────────────────────────────────────────────────────────────────────────

// canonical set.id (r2026a, l2026b)
const SET_ID_CANONICAL_RE = /^[rl]\d{4}[a-z]$/;

const VALID_QTYPES = new Set(['positive', 'negative']);

// 실물 데이터에서 관찰되는 sentType. 모르는 값은 warning 으로만.
// 다음 턴에 데이터 grep 후 확정.
const VALID_SENT_TYPES = new Set([
  'body', 'footnote', 'omission', 'workTag', 'verseLine',
  'verse', 'author', 'figure', 'image',
]);

// 전체 valid pat (분포 [Confirmed]: R1~R4/L1~L5/V/null/0)
const VALID_PATS_ALL = new Set([
  'R1', 'R2', 'R3', 'R4',
  'L1', 'L2', 'L3', 'L4', 'L5',
  'V',
  0,      // 수동 검토 플래그 — needs_human 으로만 보고
  null,
]);

const PAT_ALLOW_EMPTY_CS = new Set(['R3', 'V', 0]);

// section → 허용 pat 도메인
function isPatInDomain(pat, section) {
  if (pat === null || pat === undefined || pat === 0) return true;
  if (pat === 'V') return true;
  if (section === 'reading') return /^R[1-4]$/.test(pat);
  if (section === 'literature') return /^L[1-5]$/.test(pat);
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const err = (a, code, ctx = {}) => a.push({ severity: 'error', code, ...ctx });
const warn = (a, code, ctx = {}) => a.push({ severity: 'warning', code, ...ctx });
const nh = (a, code, ctx = {}) => a.push({ severity: 'needs_human', code, ...ctx });

function normalizeUnderscore(id) {
  if (typeof id !== 'string') return id;
  return id.replace(/_s/, 's');
}

/**
 * sentId 들에서 dominant base prefix 추론.
 * 예) ["r2026a_s1", "r2026a_s2", "r2026a_s3"] → "r2026a"
 *     ["s1_x", "s1_y"] → null (canonical 불가)
 */
function inferBaseFromSentIds(sents) {
  if (!Array.isArray(sents) || sents.length === 0) return null;
  const counts = {};
  for (const s of sents) {
    if (!s || typeof s.id !== 'string') continue;
    // strip underscore + trailing sNNN... 까지
    const m = s.id.match(/^([a-z]+\d{2,4}[a-z])_?s\d+/);
    if (m) {
      counts[m[1]] = (counts[m[1]] || 0) + 1;
    }
  }
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return entries[0]?.[0] || null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Validators
// ─────────────────────────────────────────────────────────────────────────────

function validateTopLevel(set, errors) {
  for (const f of ['id', 'title', 'range', 'sents', 'questions']) {
    if (set[f] === undefined || set[f] === null) {
      err(errors, 'MISSING_REQUIRED_FIELD', { field: f });
    }
  }
  if (set.id !== undefined && (typeof set.id !== 'string' || set.id.trim() === '')) {
    err(errors, 'BAD_SET_ID', { value: set.id });
  }
  if (set.sents !== undefined && !Array.isArray(set.sents)) {
    err(errors, 'SENTS_NOT_ARRAY');
  }
  if (set.questions !== undefined && !Array.isArray(set.questions)) {
    err(errors, 'QUESTIONS_NOT_ARRAY');
  }
}

/**
 * sentId 검사:
 *   - 실물 그대로 actualIds 에 등록 (cs_ids 검사 기준)
 *   - underscore 포함 → canonical debt warning (cascade 차단)
 *   - set 내부 prefix 일관성 검사
 *   - 추론된 base 가 set.id 와 다르면 canonical debt warning (block X)
 */
function validateSents(set, warnings, errors) {
  const actualIds = new Set();
  const canonicalIds = new Set();
  const prefixHist = {};

  if (!Array.isArray(set.sents)) return { actualIds, canonicalIds, inferredBase: null };

  for (const sent of set.sents) {
    if (!sent || typeof sent !== 'object') {
      err(errors, 'SENT_NOT_OBJECT');
      continue;
    }
    if (!sent.id || typeof sent.id !== 'string') {
      err(errors, 'SENT_MISSING_ID');
      continue;
    }
    if (actualIds.has(sent.id)) {
      err(errors, 'SENT_ID_DUPLICATE', { sentId: sent.id });
    }
    actualIds.add(sent.id);
    canonicalIds.add(normalizeUnderscore(sent.id));

    if (sent.id.includes('_s')) {
      warn(warnings, 'SENTID_UNDERSCORE_LEGACY', {
        sentId: sent.id,
        canonical: normalizeUnderscore(sent.id),
      });
    }

    // prefix 추출 (sNNN 부분 떼어내기)
    const m = sent.id.match(/^([a-z]+\d{0,4}[a-z]*)_?s\d+/);
    if (m) {
      prefixHist[m[1]] = (prefixHist[m[1]] || 0) + 1;
    } else {
      warn(warnings, 'SENTID_UNRECOGNIZED_FORMAT', { sentId: sent.id });
    }

    // text / image 분기
    const hasText = typeof sent.t === 'string' && sent.t.trim() !== '';
    const isImage = sent.sentType === 'image' || sent.sentType === 'figure';
    const hasUrl = typeof sent.url === 'string' && sent.url.trim() !== '';
    if (!hasText && !(isImage && hasUrl)) {
      err(errors, 'SENT_MISSING_TEXT', { sentId: sent.id, sentType: sent.sentType });
    }

    if (sent.sentType && !VALID_SENT_TYPES.has(sent.sentType)) {
      warn(warnings, 'SENT_TYPE_UNKNOWN', { sentId: sent.id, value: sent.sentType });
    }
  }

  // prefix 일관성: 가장 빈도 높은 prefix 가 dominant base
  const sortedPrefixes = Object.entries(prefixHist).sort((a, b) => b[1] - a[1]);
  const inferredBase = sortedPrefixes[0]?.[0] || null;

  // sentId prefix 가 set 내에서 둘 이상 → 진짜 결함
  if (sortedPrefixes.length > 1) {
    err(errors, 'SENTID_PREFIX_INCONSISTENT', {
      prefixes: prefixHist,
      dominant: inferredBase,
    });
  }

  // canonical debt: set.id 가 inferredBase 와 다르면 warning (release block 아님)
  if (
    inferredBase &&
    typeof set.id === 'string' &&
    set.id !== inferredBase &&
    !SET_ID_CANONICAL_RE.test(set.id)
  ) {
    warn(warnings, 'SET_ID_LEGACY_FORMAT', {
      setId: set.id,
      inferredCanonical: inferredBase,
      hint: 'release validator passes; canonical migration is a separate phase',
    });
  }

  return { actualIds, canonicalIds, inferredBase };
}

function validateChoices(q, set, section, sentSets, errors, warnings, needsHuman) {
  if (!Array.isArray(q.choices)) {
    err(errors, 'CHOICES_NOT_ARRAY', { qid: q.id });
    return;
  }
  if (q.choices.length !== 5) {
    err(errors, 'CHOICES_COUNT_NOT_5', { qid: q.id, count: q.choices.length });
  }

  let okTrue = 0;
  let okFalse = 0;
  const numsSeen = new Set();

  for (const c of q.choices) {
    if (!c || typeof c !== 'object') {
      err(errors, 'CHOICE_NOT_OBJECT', { qid: q.id });
      continue;
    }

    if (typeof c.num !== 'number' || c.num < 1 || c.num > 5) {
      err(errors, 'CHOICE_BAD_NUM', { qid: q.id, num: c.num });
    } else if (numsSeen.has(c.num)) {
      err(errors, 'CHOICE_NUM_DUPLICATE', { qid: q.id, num: c.num });
    } else {
      numsSeen.add(c.num);
    }

    if (typeof c.t !== 'string' || c.t.trim() === '') {
      err(errors, 'CHOICE_MISSING_TEXT', { qid: q.id, num: c.num });
    }

    if (typeof c.ok !== 'boolean') {
      err(errors, 'CHOICE_OK_NOT_BOOLEAN', { qid: q.id, num: c.num, value: c.ok });
      continue;
    }
    if (c.ok) okTrue++;
    else okFalse++;

    const pat = c.pat;

    // pat 값 자체 invalid
    if (!VALID_PATS_ALL.has(pat)) {
      err(errors, 'CHOICE_PAT_INVALID', { qid: q.id, num: c.num, pat });
    } else if (!isPatInDomain(pat, section)) {
      err(errors, 'CHOICE_PAT_DOMAIN_MISMATCH', {
        qid: q.id, num: c.num, pat, section,
      });
    }

    // pat=0 (manual review flag) — needs_human 으로만, release block 아님
    if (pat === 0) {
      nh(needsHuman, 'CHOICE_PAT_MANUAL_REVIEW_FLAG', {
        qid: q.id, num: c.num,
        hint: 'step3 manual-review marker; resolve before release',
      });
    }

    // ok ↔ pat 정합
    if (c.ok === true && pat !== null && pat !== undefined) {
      err(errors, 'CHOICE_PAT_PRESENT_ON_TRUE', { qid: q.id, num: c.num, pat });
    }
    if (c.ok === false && (pat === null || pat === undefined)) {
      err(errors, 'CHOICE_PAT_MISSING_ON_FALSE', { qid: q.id, num: c.num });
    }

    // analysis blank
    if (typeof c.analysis !== 'string' || c.analysis.trim() === '') {
      err(errors, 'CHOICE_ANALYSIS_BLANK', { qid: q.id, num: c.num });
    }

    // cs_ids
    if (!Array.isArray(c.cs_ids)) {
      err(errors, 'CHOICE_CS_IDS_NOT_ARRAY', { qid: q.id, num: c.num });
    } else {
      const empty = c.cs_ids.length === 0;
      if (empty) {
        if (c.ok === true) {
          err(errors, 'CHOICE_CS_IDS_EMPTY_ON_TRUE', { qid: q.id, num: c.num });
        } else if (c.ok === false && !PAT_ALLOW_EMPTY_CS.has(pat)) {
          err(errors, 'CHOICE_CS_IDS_EMPTY_REQUIRED_PAT', {
            qid: q.id, num: c.num, pat,
            hint: 'R1/R2/R4/L1/L2/L4/L5 require cs_ids; only R3/V/0 allow empty',
          });
        } else {
          warn(warnings, 'CHOICE_CS_IDS_EMPTY', { qid: q.id, num: c.num, pat });
        }
      }
      // ref 검사 — actualIds 기준 (cascade 차단)
      for (const ref of c.cs_ids) {
        if (!sentSets.actualIds.has(ref)) {
          const canonRef = normalizeUnderscore(ref);
          if (sentSets.canonicalIds.has(canonRef)) {
            warn(warnings, 'CS_IDS_REF_UNDERSCORE_FORMAT_MISMATCH', {
              qid: q.id, num: c.num, ref, canonical: canonRef,
            });
          } else {
            err(errors, 'CHOICE_CS_IDS_BROKEN_REF', { qid: q.id, num: c.num, ref });
          }
        }
      }
    }
  }

  if (q.questionType === 'negative' && okFalse !== 1) {
    err(errors, 'OK_DIST_NEGATIVE_EXPECT_1_FALSE', { qid: q.id, okTrue, okFalse });
  } else if (q.questionType === 'positive' && okTrue !== 1) {
    err(errors, 'OK_DIST_POSITIVE_EXPECT_1_TRUE', { qid: q.id, okTrue, okFalse });
  }
}

function validateQuestions(set, section, sentSets, errors, warnings, needsHuman) {
  if (!Array.isArray(set.questions)) return;
  const qIdsSeen = new Set();
  for (const q of set.questions) {
    if (!q || typeof q !== 'object') {
      err(errors, 'QUESTION_NOT_OBJECT');
      continue;
    }
    if (q.id === undefined || q.id === null) {
      err(errors, 'QUESTION_MISSING_ID');
    } else if (qIdsSeen.has(q.id)) {
      err(errors, 'QUESTION_ID_DUPLICATE', { qid: q.id });
    } else {
      qIdsSeen.add(q.id);
    }
    if (typeof q.t !== 'string' || q.t.trim() === '') {
      err(errors, 'QUESTION_MISSING_TEXT', { qid: q.id });
    }
    if (!VALID_QTYPES.has(q.questionType)) {
      err(errors, 'QUESTION_BAD_TYPE', { qid: q.id, value: q.questionType });
    }
    validateChoices(q, set, section, sentSets, errors, warnings, needsHuman);
  }
}

function validateVocab(set, sentSets, warnings) {
  if (!Array.isArray(set.vocab)) return;
  for (const v of set.vocab) {
    if (!v || typeof v !== 'object') continue;
    if (!v.word) warn(warnings, 'VOCAB_MISSING_WORD');
    if (!v.mean) warn(warnings, 'VOCAB_MISSING_MEAN', { word: v.word });
    if (v.sentId && !sentSets.actualIds.has(v.sentId)) {
      const canon = normalizeUnderscore(v.sentId);
      if (sentSets.canonicalIds.has(canon)) {
        warn(warnings, 'VOCAB_SENT_REF_UNDERSCORE_MISMATCH', {
          word: v.word, ref: v.sentId, canonical: canon,
        });
      } else {
        warn(warnings, 'VOCAB_BROKEN_SENT_REF', { word: v.word, ref: v.sentId });
      }
    }
  }
}

function crossCheckAnswerKey(set, answerKey, needsHuman) {
  if (!answerKey) return;
  for (const q of set.questions || []) {
    const expected = answerKey[q.id];
    if (expected === undefined) continue;
    const choice =
      q.questionType === 'negative'
        ? (q.choices || []).find((c) => c.ok === false)
        : (q.choices || []).find((c) => c.ok === true);
    const got = choice ? choice.num : null;
    if (got !== expected) {
      nh(needsHuman, 'ANSWER_KEY_MISMATCH', {
        qid: q.id, questionType: q.questionType, expected, got,
        hint: 'auxiliary check; release block 아님',
      });
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {object} set       단일 set 객체
 * @param {object} opts
 * @param {'reading'|'literature'} opts.section  array 위치로 호출자가 전달
 * @param {object} [opts.answerKey]              { [qid]: correctChoiceNum }
 */
function validateSet(set, opts = {}) {
  const errors = [];
  const warnings = [];
  const needsHuman = [];

  const section = opts.section;
  if (section !== 'reading' && section !== 'literature') {
    err(errors, 'SECTION_NOT_PROVIDED', {
      hint: "validateSet requires opts.section ('reading'|'literature')",
    });
  }

  validateTopLevel(set, errors);

  const fatal = errors.some((e) =>
    ['MISSING_REQUIRED_FIELD', 'SENTS_NOT_ARRAY', 'QUESTIONS_NOT_ARRAY', 'SECTION_NOT_PROVIDED'].includes(e.code)
  );
  if (fatal) {
    return {
      passed: false, errors, warnings, needsHuman,
      stats: { sents: 0, questions: 0, choices: 0, cs_ids_filled: 0 },
    };
  }

  const sentSets = validateSents(set, warnings, errors);
  validateQuestions(set, section, sentSets, errors, warnings, needsHuman);
  validateVocab(set, sentSets, warnings);
  crossCheckAnswerKey(set, opts.answerKey, needsHuman);

  const stats = {
    sents: (set.sents || []).length,
    questions: (set.questions || []).length,
    choices: (set.questions || []).reduce(
      (n, q) => n + (Array.isArray(q.choices) ? q.choices.length : 0), 0
    ),
    cs_ids_filled: (set.questions || []).reduce(
      (n, q) =>
        n + (Array.isArray(q.choices)
          ? q.choices.filter((c) => Array.isArray(c.cs_ids) && c.cs_ids.length > 0).length
          : 0),
      0
    ),
    pat_zero_count: (set.questions || []).reduce(
      (n, q) =>
        n + (Array.isArray(q.choices)
          ? q.choices.filter((c) => c.pat === 0).length
          : 0),
      0
    ),
  };

  return {
    passed: errors.length === 0,
    errors, warnings, needsHuman, stats,
    inferredBase: sentSets.inferredBase,
  };
}

module.exports = { validateSet };
