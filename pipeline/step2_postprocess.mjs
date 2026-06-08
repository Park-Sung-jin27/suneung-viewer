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

// bogi 맨 앞의 중복 <보기> 라벨 strip — 뷰어가 〈보기〉 헤더를 자동 렌더하므로 중복.
//   문자열 bogi / annotated_image·diagram 등 object.text 양형 지원 (2026-06-08).
const BOGI_LABEL_HEAD = /^\s*(-\s*)?[<〈]\s*보\s*기\s*[>〉](\s*-)?\s*\n?/;
function stripBogiLabel(q) {
  if (typeof q.bogi === "string") q.bogi = q.bogi.replace(BOGI_LABEL_HEAD, "").trim();
  else if (q.bogi && typeof q.bogi.text === "string")
    q.bogi.text = q.bogi.text.replace(BOGI_LABEL_HEAD, "").trim();
}

function splitBogiFromQt(q) {
  const t = q.t || "";
  // <보 기> (공백 포함) — Gemini가 보기 내용을 q.t에 붙여서 추출한 케이스
  const bogiIdx = t.search(/<보\s기>/);
  if (bogiIdx !== -1) {
    if (!q.bogi || q.bogi === "") q.bogi = t.slice(bogiIdx).trim();
    q.t = t.slice(0, bogiIdx).trim();
    stripBogiLabel(q);
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
    id: "R2b_copyright_multiline_tail",
    // [2026-06-05] 2027_6월 l20276a/b/c c5 — 페이지 경계 선지 꼬리에 줄바꿈 포함 푸터 혼입
    //   "...있다.\n이 문제지에 관한 저작권은...\n-- 8 of 20 --\n9\n9 20" 형태 전체 절단
    regex: /\s*이 문제지에 관한 저작권은[\s\S]*$/,
    desc: "줄바꿈 포함 저작권 고지 + 페이지 푸터 전체",
  },
  {
    id: "R2c_page_footer_tail",
    regex: /\s*--\s*\d+\s*of\s*\d+\s*--[\s\S]*$/,
    desc: "-- N of M -- 페이지 푸터 + 이후 전부",
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
// [NEW 2026-06-05] sents 구조 정제 — 2027_6월 검수에서 발견된 오염 class 자동화
//   ① 발문 sent 혼입 제거 ② 페이지 노이즈("7 20") 제거 ③ author/footnote/workTag/omission 분류
//   ④ 문학 verse 추정 (작품 구간 평균 행 길이 기준) ⑤ 문학 title 작품명 자동 추출
//   한계: 독서 (가)(나) prefix 소실·시각 marker 검증은 추출기(extractor) 책임 — 본 모듈 범위 밖.
export function cleanSentStructure(set, sec) {
  const stats = { removed: 0, typed: 0, verse: 0, title: false };
  if (!Array.isArray(set.sents)) return stats;
  // ①② 제거
  const before = set.sents.length;
  set.sents = set.sents.filter((x) => {
    const t = (x.t || "").trim();
    if (t === "다음 글을 읽고 물음에 답하시오.") return false;
    if (/^\d{1,2}\s+\d{1,2}$/.test(t)) return false;
    if (/^이 문제지에 관한 저작권/.test(t)) return false;
    return true;
  });
  stats.removed = before - set.sents.length;
  // ③ 분류
  for (const x of set.sents) {
    const t = (x.t || "").trim();
    if (x.sentType && x.sentType !== "body") continue;
    if (/^-\s?.+\s?-$/.test(t) && t.length < 40) { x.sentType = "author"; stats.typed++; }
    else if (/^\*\s?.{1,24}?\s?:/.test(t)) { x.sentType = "footnote"; stats.typed++; }
    else if (/^\((가|나|다|라)\)$/.test(t)) { x.sentType = "workTag"; stats.typed++; }
    else if (/^\(중략\)$|^\(중\s?략\)$/.test(t)) { x.sentType = "omission"; stats.typed++; }
  }
  // ④ 문학 verse 추정: author/workTag 경계로 작품 구간 분할 → 평균 행 길이 ≤ 32자 && 행 3+ → verse
  if (sec === "literature") {
    let seg = [];
    const flush = () => {
      const bodies = seg.filter((x) => (x.sentType || "body") === "body");
      if (bodies.length >= 3) {
        const avg = bodies.reduce((a, x) => a + (x.t || "").length, 0) / bodies.length;
        const maxLen = Math.max(...bodies.map((x) => (x.t || "").length));
        // 시 행: 짧고(평균 ≤26자) 최장 행도 컬럼 폭 미달(≤38자). 소설 줄글은 꽉 차므로 배제.
        if (avg <= 26 && maxLen <= 38 && bodies.length <= 45) { bodies.forEach((x) => { x.sentType = "verse"; }); stats.verse += bodies.length; }
      }
      seg = [];
    };
    for (const x of set.sents) {
      if ((x.sentType || "") === "author") { flush(); continue; }
      seg.push(x);
    }
    flush();
  }
  // ⑤ 문학 title: author 안 ｢작품명｣ 수집
  if (sec === "literature" && (!set.title || /물음에 답하시오/.test(set.title))) {
    const names = [];
    for (const x of set.sents) {
      if ((x.sentType || "") !== "author") continue;
      const m = (x.t || "").match(/｢([^｣]+)｣/);
      if (m) names.push(m[1]);
      else { const m2 = (x.t || "").match(/^-\s?(.+?)\s?-$/); if (m2) names.push(m2[1] + " 시조"); }
    }
    if (names.length) { set.title = names.join(", "); stats.title = true; }
  }
  return stats;
}

export function postprocess(sets, sec, ctx = {}) {
  const stats = { qt: 0, bogi: 0, choice: 0, sent: 0 };
  const yearKey = ctx.yearKey ?? null;

  for (const set of sets) {
    for (const q of set.questions) {
      // 1. questionType 자동 설정
      if (!q.questionType || q.questionType === "N/A") {
        q.questionType = detectQuestionType(q.t);
        stats.qt++;
      }
      // 2. bogi 분리 + 맨 앞 중복 <보기> 라벨 strip (이미 bogi에 있는 경우 포함)
      if (splitBogiFromQt(q)) stats.bogi++;
      stripBogiLabel(q);
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

  for (const set of sets) {
    const st = cleanSentStructure(set, sec);
    stats.sent += st.removed + st.typed + st.verse + (st.title ? 1 : 0);
  }

  const parts = [];
  if (stats.qt) parts.push(`questionType:${stats.qt}`);
  if (stats.sent) parts.push(`sents구조:${stats.sent}`);
  if (stats.bogi) parts.push(`bogi분리:${stats.bogi}`);
  if (stats.choice) parts.push(`선지정제:${stats.choice}`);
  if (parts.length) console.log(`  [postprocess] ${parts.join(" ")}`);
  else console.log(`  [postprocess] 정제 항목 없음 ✅`);

  return sets;
}
