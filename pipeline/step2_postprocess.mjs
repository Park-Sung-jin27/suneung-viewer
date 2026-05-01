/**
 * pipeline/step2_postprocess.mjs
 *
 * step2_extract.js의 extractStructure() 반환 직전에 호출.
 * Gemini 추출 결과의 구조적 오염을 자동 제거.
 *
 * 연동:
 *   step2_extract.js 하단 extractStructure() 에서:
 *     import { postprocess } from './step2_postprocess.mjs';
 *     result[sec] = postprocess(sets, sec);   ← cachePath 저장 전에 호출
 */

const NEG_PATTERNS = [
  "않은",
  "않는",
  "틀린",
  "아닌",
  "없는",
  "거리가 먼",
  "잘못",
  "적절하지",
  "맞지 않",
  "옳지 않",
  "부적절",
  "해당하지",
  "일치하지",
  "어색한",
  "알 수 없는",
  "옳지않",
  "적합하지",
];

function detectQuestionType(t) {
  for (const p of NEG_PATTERNS) if ((t || "").includes(p)) return "negative";
  return "positive";
}

function splitBogiFromQt(q) {
  const t = q.t || "";
  // <보 기> (공백 포함) — Gemini가 보기 내용을 q.t에 붙여서 추출한 케이스
  const bogiIdx = t.search(/<보\s기>/);
  if (bogiIdx !== -1) {
    if (!q.bogi || q.bogi === "") q.bogi = t.slice(bogiIdx).trim();
    q.t = t.slice(0, bogiIdx).trim();
    return true;
  }
  // <학습 활동> 두 번 등장 — 두 번째부터 bogi로 이동
  const first = t.indexOf("<학습 활동>");
  const second = first !== -1 ? t.indexOf("<학습 활동>", first + 1) : -1;
  if (second !== -1 && (!q.bogi || q.bogi === "")) {
    q.bogi = t.slice(second).trim();
    q.t = t.slice(0, second).trim();
    return true;
  }
  return false;
}

// [NEW] 규칙 이름화 — 어떤 tail-cutter 가 발동했는지 추적 가능하도록.
const CHOICE_CLEAN_RULES = [
  {
    id: "R1_page_number_tail",
    regex: /\s+\d{1,2}\s+\d\s*$/,
    desc: '끝에 " NN N" 페이지번호 패턴',
  },
  {
    id: "R2_copyright_tail",
    regex: /\s*20\s+이 문제지에 관한 저작권은.*$/,
    desc: "저작권 고지 문구",
  },
  {
    id: "R3_verification_tail",
    regex: /\s*\*\s*확인 사항[\s\S]*$/,
    desc: "* 확인 사항 + 이후 전부",
  },
  {
    id: "R4_next_passage_tail",
    regex: /\s*\[\d+[～~]\d+\][\s\S]*$/,
    desc: "다음 지문 시작 표시 [NN~NN]",
  },
];

function cleanChoiceText(c, ctx = {}) {
  let t = c.t || "";
  const before = t;
  const firedRules = [];

  for (const rule of CHOICE_CLEAN_RULES) {
    const next = t.replace(rule.regex, "").trim();
    if (next !== t) {
      firedRules.push({
        rule_id: rule.id,
        desc: rule.desc,
        removed: t.slice(next.length),
      });
      t = next;
    }
  }

  c.t = t;
  const mutated = t !== before;
  if (mutated) {
    // [NEW] 변경 전/후 추적 로그 — yearKey/set/question/choice + 발동 규칙 포함
    console.warn("[postprocess mutation]", {
      year_key: ctx.yearKey ?? null,
      set_id: ctx.set_id ?? null,
      question_id: ctx.question_id ?? null,
      choice_num: c.num,
      rules_fired: firedRules.map((r) => r.rule_id),
      rule_details: firedRules,
      before,
      after: t,
    });
  }
  return mutated;
}

/**
 * postprocess(sets, sec)
 * @param {Array}  sets - step2 추출 결과 세트 배열
 * @param {string} sec  - 'reading' | 'literature'
 * @returns {Array}      - 정제된 세트 배열 (원본 mutate)
 */
export function postprocess(sets, sec, ctx = {}) {
  const stats = { qt: 0, bogi: 0, choice: 0 };
  const yearKey = ctx.yearKey ?? null;

  for (const set of sets) {
    for (const q of set.questions) {
      // 1. questionType 자동 설정
      if (!q.questionType || q.questionType === "N/A") {
        q.questionType = detectQuestionType(q.t);
        stats.qt++;
      }
      // 2. bogi 분리
      if (splitBogiFromQt(q)) stats.bogi++;
      // 3. 선지 텍스트 정제 — yearKey/set_id/question_id 를 cleanChoiceText 로 전달
      for (const c of q.choices) {
        if (
          cleanChoiceText(c, {
            yearKey,
            set_id: set.id,
            question_id: q.id,
          })
        )
          stats.choice++;
      }
    }
  }

  const parts = [];
  if (stats.qt) parts.push(`questionType:${stats.qt}`);
  if (stats.bogi) parts.push(`bogi분리:${stats.bogi}`);
  if (stats.choice) parts.push(`선지정제:${stats.choice}`);
  if (parts.length) console.log(`  [postprocess] ${parts.join(" ")}`);
  else console.log(`  [postprocess] 정제 항목 없음 ✅`);

  return sets;
}
