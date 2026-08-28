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
  if (typeof q.bogi === "string")
    q.bogi = q.bogi.replace(BOGI_LABEL_HEAD, "").trim();
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
    if (/^-\s?.+\s?-$/.test(t) && t.length < 40) {
      x.sentType = "author";
      stats.typed++;
    } else if (/^\*\s?.{1,24}?\s?:/.test(t)) {
      x.sentType = "footnote";
      stats.typed++;
    } else if (/^\((가|나|다|라)\)$/.test(t)) {
      x.sentType = "workTag";
      stats.typed++;
    } else if (/^\(중략\)$|^\(중\s?략\)$/.test(t)) {
      x.sentType = "omission";
      stats.typed++;
    }
  }
  // ④ 문학 verse 추정: author/workTag 경계로 작품 구간 분할 → 평균 행 길이 ≤ 32자 && 행 3+ → verse
  if (sec === "literature") {
    let seg = [];
    const flush = () => {
      const bodies = seg.filter((x) => (x.sentType || "body") === "body");
      if (bodies.length >= 3) {
        const avg =
          bodies.reduce((a, x) => a + (x.t || "").length, 0) / bodies.length;
        const maxLen = Math.max(...bodies.map((x) => (x.t || "").length));
        // 시 행: 짧고(평균 ≤26자) 최장 행도 컬럼 폭 미달(≤38자). 소설 줄글은 꽉 차므로 배제.
        if (avg <= 26 && maxLen <= 38 && bodies.length <= 45) {
          bodies.forEach((x) => {
            x.sentType = "verse";
          });
          stats.verse += bodies.length;
        }
      }
      seg = [];
    };
    for (const x of set.sents) {
      if ((x.sentType || "") === "author") {
        flush();
        continue;
      }
      seg.push(x);
    }
    flush();
  }
  // ⑤ 문학 title: author 안 ｢작품명｣ 수집
  if (
    sec === "literature" &&
    (!set.title || /물음에 답하시오/.test(set.title))
  ) {
    const names = [];
    for (const x of set.sents) {
      if ((x.sentType || "") !== "author") continue;
      const m = (x.t || "").match(/｢([^｣]+)｣/);
      if (m) names.push(m[1]);
      else {
        const m2 = (x.t || "").match(/^-\s?(.+?)\s?-$/);
        if (m2) names.push(m2[1] + " 시조");
      }
    }
    if (names.length) {
      set.title = names.join(", ");
      stats.title = true;
    }
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

  // [D-138 ①] 산문 문장 재분할 — 독서만.
  //   문학은 실측상 이미 기존과 문장 수가 일치한다(2027_6월 l20276a~d 74/80/90/25).
  //   verse 는 행이 곧 의미 단위라 어느 영역에서도 건드리지 않는다(resplitProse 안에서 보호).
  if (sec === "reading")
    for (const set of sets) {
      const before = (set.sents || []).length;
      set.sents = resplitProse(set.sents || []);
      const after = set.sents.length;
      if (before !== after) stats.resplit = (stats.resplit || 0) + 1;
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

// ── [D-138 ①] 문장 재분할 — 산문만, 운문은 그대로 ──────────────────────
//
//   왜 필요한가
//     pdf-parse 경로는 PDF 렌더 그대로 줄바꿈 단위로 문장을 만든다
//     (pdf_text_extractor.mjs:17 — 「문장 단위 splitting 은 상위 단계 책임」).
//     그런데 그 상위 단계가 실제로는 재분할을 하지 않아, 독서 지문이 한 문장을
//     여러 조각으로 쪼갠 채 나온다(D-137 재리허설: 21 → 33개).
//     문장 id 가 달라지면 step4 가 붙이는 cs_ids 알갱이가 기존 6,840개 해설과
//     어긋나므로 여기서 맞춘다.
//
//   무엇을 건드리지 않는가
//     · sentType 이 body 가 아닌 것 — verse(운문)·workTag·author·footnote·omission
//       운문은 줄바꿈이 곧 행이고 행이 곧 의미 단위다. 이어 붙이면 안 된다.
//     · 문학 영역 전체 — 실측상 이미 기존과 문장 수가 정확히 일치한다
//       (2027_6월 l20276a~d: 74/80/90/25 전건 일치). 손대면 오히려 깨진다.
//     즉 재분할은 **독서(reading)의 body 문장**에만 건다.
//
//   종결 판정
//     단순 ". " 는 쓰지 않는다 — 「3.5」 「㉠.」 「1．」 에 걸린다.
//     한국어 종결어미 뒤의 문장부호만 경계로 본다. 인용 닫는 부호도 함께 넘긴다.

// 종결어미 마지막 글자 — 넓게 잡되 숫자·마커·영문은 제외된다
const _END_SYLLABLE = "다자까가라";   // 기존 독서 body 4,507문장 실측 — 이 5종이 99.9%를 덮는다
//   (다:4412 자:46 까:25 가:9 라:9 · 나머지는 1회씩). 넓게 잡으면 문장 중간에서 잘린다.
// 종결부호 + 닫는 인용부(있으면) + 공백(없을 수도 있다)
//   PDF 한 줄 안에 두 문장이 이어지면 「…간주된다.채권자가…」처럼 공백이 없다.
//   \s* 로 두어도 숫자(3.5)·마커(㉠.)는 앞이 종결어미가 아니라 걸리지 않는다.
const _SENT_BREAK = new RegExp(
  `(?<=[${_END_SYLLABLE}][.?!])["'’”」』\\)\\]]*\\s+`,
  "g",
);

/**
 * 산문 한 덩어리를 문장 단위로 나눈다.
 *   ★ 인용부호 안에서는 자르지 않는다 — 「'모임에 꼭 참석해 주세요. 불참 시 …'」처럼
 *     따옴표 안에 종결부가 들어 있는 문장이 흔하다(2024_6월 r20246b 실측).
 *     여는 따옴표를 만나면 깊이를 올리고 닫는 따옴표에서 내린다. 깊이가 0 일 때만 자른다.
 */
function splitSentences(text) {
  const OPEN = "'‘“「『(〈《";
  const CLOSE = "'’”」』)〉》";
  const CLOSERS = "\"'’”」』)]";
  const out = [];
  let depth = 0, start = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    // 곧은 따옴표는 여닫이가 같아 토글로 다룬다
    if (ch === "'" || ch === '"') { depth = depth > 0 ? depth - 1 : 1; continue; }
    if (OPEN.includes(ch)) { depth++; continue; }
    if (CLOSE.includes(ch)) { if (depth > 0) depth--; continue; }
    if (depth > 0) continue;
    if (!".?!".includes(ch)) continue;
    const prev = text[i - 1] || "";
    if (!_END_SYLLABLE.includes(prev)) continue;   // 숫자·마커·영문 뒤는 종결이 아니다
    let k = i + 1;
    while (k < text.length && CLOSERS.includes(text[k])) k++;   // 닫는 인용부 흡수
    if (k >= text.length) break;
    if (!/\s/.test(text[k])) continue;                          // 공백이 있어야 문장 경계
    const piece = text.slice(start, k).trim();
    if (piece) out.push(piece);
    while (k < text.length && /\s/.test(text[k])) k++;
    start = k; i = k - 1;
  }
  const tail = text.slice(start).trim();
  if (tail) out.push(tail);
  return out;
}

/** 줄바꿈으로 쪼개진 산문 조각을 이어 붙인 뒤 문장 단위로 다시 나눈다. */
export function resplitProse(sents) {
  const out = [];
  let buf = null;   // 이어 붙이는 중인 body 조각들

  const flushBuf = () => {
    if (!buf) return;
    const joined = buf.parts.join(" ").replace(/\s+/g, " ").trim();
    for (const t of splitSentences(joined)) out.push({ ...buf.proto, t });
    buf = null;
  };
  for (const x of sents) {
    const type = x.sentType || "body";
    if (type !== "body") { flushBuf(); out.push(x); continue; }
    if (!buf) buf = { proto: { ...x }, parts: [] };
    buf.parts.push(String(x.t ?? ""));
  }
  flushBuf();

  // id 재부여 — prefix 는 첫 문장 id 에서 딴다 (rXXXXas1 → rXXXXa)
  const first = sents.find((x) => x.id);
  const prefix = first ? String(first.id).replace(/s\d+[a-z]?$/, "") : "";
  if (prefix) out.forEach((x, i) => { x.id = `${prefix}s${i + 1}`; });
  return out;
}
