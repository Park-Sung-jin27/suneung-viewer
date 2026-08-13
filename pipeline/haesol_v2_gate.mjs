// haesol_v2_gate.mjs — v2 해설 재생성 세트 6축 자동 검증 harness
// 사용: node pipeline/haesol_v2_gate.mjs --sets=2023수능::r2023b,2024수능::r2024d
//   재생성 세트 → 6축 검증 → 전선지 로그 → PASS(대표 검수 큐) / FAIL(반려).
// 6축: ① §2 인용 exact(전선지·다문장 WARNING 별도) ② C_anchor ③ W_bogi_anchor
//      ④ W_analysis_marker_mismatch ⑤ cs_anchor_mismatch ⑥ 결론줄=ok + DEAD_csid + CRITICAL 0.
// 권위 게이트(quality_gate)를 1회 실행해 output JSON을 갱신, 그 결과를 세트별로 필터.
// PASS 기준(§2 완화 조건 b): 해당 세트 CRITICAL 0 AND §2 real-FAIL 0. WARNING은 비차단(검수 큐).
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(__dirname, "output");

// [결정A] §2 exact 오탐 필터용 정규화 — step4 _normSpan과 동일 KNOWN 구조표기 strip + 전각↔반각.
//   제거: 마커(ⓐ㉠①[A])·각주 등 구두점(* 포함)·괄호류·한자(병기 포함)·공백, 그리고 전각ASCII→반각(＋→+).
//   ⚠ §13⑥: char-level(오타·古語 하난↔하나)은 손대지 않음 → 정규화 후에도 불일치면 계속 FAIL.
//   용도 한정: §2 FAIL 직전, "구조표기만 다를 뿐 본문에 실재"하는 인용을 오탐에서 제외(cs·anchorGap 무영향).
const _S2_NORM_RE =
  /[ⓐ-ⓩⒶ-Ⓩ㉠-㉯①-⑳]|\[[A-E]\]|[「」『』【】〔〕⟨⟩《》()（）[\]{}]|[一-鿿㐀-䶿]|[·ㆍ‧,.!?;:*…"“”'‘’`´]/g;
// export: step3_v2 결정론 검증(결정B)이 동일 정규화를 재사용(drift 방지, §13⑮).
export const _s2norm = (s) =>
  String(s || "")
    .replace(/[！-～]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(_S2_NORM_RE, "")
    .replace(/\s+/g, "");

// [축5] 해설 본문 오염 검출 (발주 y④/z①)
//   배경: P0 정답교정 배치에서 검수 용어·내부 스키마가 해설 본문에 유입돼
//   읽을 수 없는 문장이 LIVE에 노출됐다(확정 18선지 = LIVE 14 / 미출시 4).
//   축4는 📌 인용만 보고 🔍 본문은 안 보므로 이 클래스를 구조적으로 못 잡는다(§13⑳).
//
//   ★ 판정은 **코드성 사전** 방식이다. "로마자 2자 이상 = FAIL" 같은 광역 규칙은
//     정상 해설을 대량 오탐한다 — 실측상 DNA(31)·PCR(9)·Hz(10)·pH(6)·ID(10)·
//     CPU/GPU 는 비문학 지문의 정당한 용어이고, '치환'(118)·'배치'(80)는 정상 국어 용어다.
//   ⚠ [알려진 한계] 사전에 없는 **신종 오염은 놓친다.**
//     따라서 "축5 통과 = 오염 없음"이 아니라 "알려진 오염 패턴 없음"으로만 읽어야 한다.
const POLLUTION_PATTERNS = [
  // 내부 스키마 필드가 학생용 해설에 노출
  { name: "ok스키마", re: /\bok\s*[:=]\s*(true|false)\b/i },
  { name: "필드명노출", re: /questionType|cs_ids|\bpat\s*=/ },
  // 검수 용어가 본문에 유입된 확정 오염구
  {
    name: "사양path정합",
    re: /사양\s*(안|X)?\s*path|path\s*정합|사실\s*정합|사양\s*안\b/,
  },
  // 코드 리터럴. `path` 단독 토큰 포함 — 국어 해설에 등장할 이유가 없고,
  //   실측상 코퍼스의 path 13건이 전부 오염이며 음성 대조군 539건에는 0건이다
  //   (r2023a Q2-4 "개념 path 안 다른 문단" 형태는 '사양 path' 사전으로는 안 잡혔다).
  { name: "코드리터럴", re: /\b(null|undefined|JSON|path)\b/ },
];
export function detectAnalysisPollution(analysis) {
  const a = String(analysis || "");
  const hits = POLLUTION_PATTERNS.filter((p) => p.re.test(a));
  return {
    clean: hits.length === 0,
    patterns: hits.map((h) => h.name),
    reason: hits.length
      ? `축5 해설 오염(${hits.map((h) => h.name).join(",")})`
      : "OK",
  };
}

// [축6] 형식 결함 검출 (발주 ab ①)
//   문자열만 보고 확정 가능한 2종만 담는다. 원문 대조가 필요한 것(📌 인용 말줄임·운문 '/' 이음·
//   각주 '*' 누락)은 축4 소관이며, 문자열 규칙으로 만들면 정상 해설을 대량 오탐한다.
//
//   (a) 마크다운 강조 노출 — src/QuizPanel.jsx AnalysisBlock 이 {clean}을 plain text 로
//       렌더한다(whiteSpace: pre-wrap, 마크다운 파서 없음). **강조**가 학생 화면에 별표로
//       그대로 보인다. [Confirmed 2026-08-05, 발주 aa 재생성 6건 실측]
//   (b) 결론줄 마커 단독 — 축1은 결론줄의 **첫 코드포인트만** 보므로 "❌" 한 글자가 통과한다.
//       이 검사로 축1의 알려진 구멍을 함께 막는다.
//
//   ⚠ [알려진 한계] "축6 통과 = 알려진 형식 결함 없음"이지 **형식 정상이 아니다.**
//     여기 없는 형식 결함(표 깨짐·중복 문단·잘린 문장 등)은 그대로 통과한다.
export function detectFormatDefect(analysis) {
  const a = String(analysis || "");
  const hits = [];
  if (/\*\*[^*\n]+\*\*|__[^_\n]+__/.test(a)) hits.push("마크다운강조");
  const last = (a.trim().split("\n").pop() || "").trim();
  const head = Array.from(last)[0];
  if (head === "✅" || head === "❌") {
    // 마커 뒤 실질 텍스트: 마커·구두점·공백을 걷어내고 남는 글자가 있는가.
    const rest = Array.from(last)
      .slice(1)
      .join("")
      .replace(/[\s.,!?·…\-—~"'“”‘’()[\]]/g, "");
    if (rest.length === 0) hits.push("마커단독");
  }
  return {
    clean: hits.length === 0,
    patterns: hits,
    reason: hits.length ? `축6 형식결함(${hits.join(",")})` : "OK",
  };
}

// [축2 도메인 확장] (발주 ab ② — 측정 전용, acceptRegenChoice 미연결)
//   현행 축2는 pat != null 만 본다. 문학 세트에 R* 가 붙어도 통과한다(l20229a Q19-1 pat=R2 실증).
//   §6 도메인 엄수: 독서에 L* 금지, 문학에 R* 금지. V(어휘)는 양쪽 공통.
//   ⚠ 연결 금지 — 음성 대조군 결과를 심사관이 판정한 뒤에만 붙인다.
const PAT_READING = new Set(["R1", "R2", "R3", "R4", "V"]);
const PAT_LIT = new Set(["L1", "L2", "L3", "L4", "L5", "V"]);
export function detectPatDomainMismatch(pat, group) {
  if (!pat) return { clean: true, reason: "OK" };
  const allowed = group === "literature" ? PAT_LIT : PAT_READING;
  if (allowed.has(pat)) return { clean: true, reason: "OK" };
  return {
    clean: false,
    reason: `축2 도메인위반(${group === "literature" ? "문학" : "독서"} 세트에 pat=${pat})`,
  };
}

// [재생성 채택 게이트] 상위모델 재생성 산출을 3자 정합으로 판정 — 통과분만 채택, 나머지 거부.
//   축1 ok↔결론줄 스탬프: ok:true→마지막줄 ✅ / ok:false→❌.
//   축2 ok↔pat: ok:true→pat null / ok:false→pat 있음.
//   축3 ok↔서술 방향: ok:true인데 결론줄에 부적절 어휘(부적절·어긋·오독…)=역전 서술 → 거부.
//   게이트 없이 재생성물을 덮어쓰면 A/B처럼 나빠진 결과가 조용히 반영된다(심사관 지시: 게이트 선행).
// ── 축1·2·3 판정식 노출 (발주 ac ② — 로직 변경 없음, 축별 독립 측정용) ──────
//   전수 스윕에서 축별 FAIL을 따로 세려면 각 판정식이 개별 호출 가능해야 한다.
//   acceptRegenChoice의 reason은 캐스케이드(먼저 걸린 축만 표기)라서 합산으로는
//   한 축이 다른 축에 가려진다(§13⑮(6)). 아래 3함수는 acceptRegenChoice가
//   그대로 호출하므로 판정 결과는 이전과 동일하다.
export function conclusionLineOf(analysis) {
  const lines = String(analysis || "")
    .trim()
    .split("\n");
  return (lines[lines.length - 1] || "").trim();
}
export function detectStampMismatch(analysis, ok) {
  // ✅/❌ are surrogate-pair code points in UTF-16. String indexing returns
  // only the first code unit, so read the first Unicode code point instead.
  const head = Array.from(conclusionLineOf(analysis))[0];
  const clean = ok ? head === "✅" : head === "❌";
  return {
    clean,
    head,
    reason: clean ? "OK" : `축1 스탬프≠ok(ok=${ok}, 결론두자="${head || "?"}")`,
  };
}
export function detectPatNullMismatch(pat, ok) {
  const clean = ok ? pat == null : pat != null;
  return { clean, reason: clean ? "OK" : `축2 pat≠ok(ok=${ok}, pat=${pat})` };
}
// ok:true 결론줄에 나오면 자기모순인 표현(부적절 단정 + '부합/일치하지 않아 적절' 류).
//   상위모델이 하드제약을 못 이겨 "지문에 부합하지 않아 적절한 선지" 같은 역전-결론을
//   내면 스탬프(✅)만 보고 통과되던 사각(2018_6월 l20186c Q36-1 실증) 차단.
export function detectNarrativeReversal(analysis, ok) {
  const negLang =
    /부적절|어긋나|오독|과잉|짜깁기|전도|착각|혼동|오인|틀린|잘못|부합하지\s*(않|아니)|일치하지\s*(않|아니)|맞지\s*않/.test(
      conclusionLineOf(analysis),
    );
  const clean = ok ? !negLang : true;
  return { clean, reason: clean ? "OK" : "축3 서술역전 의심(경고·비차단)" };
}

export function acceptRegenChoice(analysis, pat, ok) {
  const stamp = detectStampMismatch(analysis, ok);
  const head = stamp.head;
  const stampOk = stamp.clean;
  const patOk = detectPatNullMismatch(pat, ok).clean;
  const narrativeOk = detectNarrativeReversal(analysis, ok).clean;
  // [축3 강등: 거부축 → 경고축] (심사관 2026-07-30 지시)
  //   축3(서술역전)은 키워드 휴리스틱이라 (a)의미적으로 우회한 역전을 못 잡고(l20186c Q36-1 실증,
  //   §13⑰: 형식 게이트로 내용역전 보증 불가) (b)정상 해설을 오탐할 수 있다. 따라서 채택은
  //   기계적으로 확정적인 축1(스탬프)·축2(pat)로만 판정하고, 축3은 비차단 경고로만 표기한다.
  //   의미 역전의 최종 방어선은 대표/옵션B 검수(§13⑰)이며 게이트는 보조 신호다.
  // [축5 연결] (발주 z ① — 양성 18/18 AND 음성 539/539 동시 충족 확인 후 연결)
  //   재생성 산출물에 검수 용어·내부 스키마가 섞이면 즉시 거부한다. 축4(측정 전용)와 달리
  //   차단축인 이유: D1 30선지 + 오염 18선지 재생성이 곧 시작되는데, 축5가 없으면
  //   같은 오염이 재주입돼도 통과한다(오염 원인 경로 일부 미규명 상태).
  // [축6 연결] (발주 ac ① — 양성 7/7, 오탐 0 확인 후 승인)
  //   음성 대조군 FAIL 56은 오탐이 아니라 기존 LIVE 결함이다(배포본 DOM 렌더로 직접 확인:
  //   2022수능 r2022d Q14① 해설에 "**전후좌우에 장착된 여러 대의 카메라**"가 별표째 노출).
  //   acceptRegenChoice는 신규 산출물에만 걸리므로 연결해도 기존 56건은 막히지 않는다 —
  //   막히는 것은 앞으로의 재생성분이며 그것이 목적이다.
  const poll = detectAnalysisPollution(analysis);
  const fmt = detectFormatDefect(analysis);
  const accept = stampOk && patOk && poll.clean && fmt.clean;
  const warn = accept && !narrativeOk ? "축3 서술역전 의심(경고·비차단)" : null;
  const reason = accept
    ? "OK"
    : !stampOk
      ? `축1 스탬프≠ok(ok=${ok}, 결론두자="${head || "?"}")`
      : !patOk
        ? `축2 pat≠ok(ok=${ok}, pat=${pat})`
        : !poll.clean
          ? poll.reason
          : fmt.reason;
  return { accept, reason, warn };
}

// 재생성 산출물을 기존 해설에 원자적으로 적용한다.
// 채택 게이트가 거부하면 기존 해설을 그대로 돌려줘 부분 덮어쓰기를 막는다.
export function chooseRegenAnalysis(
  currentAnalysis,
  regeneratedAnalysis,
  pat,
  ok,
) {
  const verdict = acceptRegenChoice(regeneratedAnalysis, pat, ok);
  return {
    ...verdict,
    analysis: verdict.accept
      ? String(regeneratedAnalysis || "")
      : String(currentAnalysis || ""),
  };
}

// [verse 매처] 📌 인용이 " / "로 이은 "연속 verse 행"이면 각 행의 verse sent.id 배열 반환(아니면 null).
//   §13⑬ 운문 다행 인용을 자동 유효 처리(형광펜 다중 정박). 단일 소스 — step4·gate §2·verifyAnchors 공용.
//   가드1 연속성(adjacency): 매칭 verse 행이 sents 순서상 인접(i,i+1,…)일 때만. 비인접=스티칭 오류 → null.
//   가드2 전행성: 각 조각이 그 verse 행의 대부분(정규화 길이 ≥60%)을 차지 — 짧은 substring 후렴 오정박 방지.
//   가드3 유일성: 한 조각이 복수 verse 행에 매칭(후렴)돼 유일 결정 불가 → null(옵션B 유지).
//   산문 " / "는 verse sent 부재라 자동 null. _s2norm 재사용.
/**
 * [S1 따옴표 짝] 해설에서 인용 문자열을 추출한다.
 *   구판 `/"([^"]{12,})"/g` 는 12자 미만 인용을 건너뛰면서 따옴표 짝이 어긋나,
 *   닫는 따옴표와 다음 여는 따옴표 사이의 평문을 인용으로 오인했다(실측 88건).
 *   여는 따옴표는 짝수번째 " 다 — 짝을 먼저 맞춘 뒤 길이로 거른다.
 */
export function extractQuotes(text, minLen = 12) {
  // [스코프 — 대표 확정 2026-08-12] 인용 대조는 📌 근거 블록만 본다.
  //   📌 지문 근거 / 보기 근거 → 원문 연속 문자열 그대로여야 한다(요약·재구성·설명괄호 금지).
  //   🔍 해설 블록            → 설명이므로 원문 인용 의무가 없다. 검사 대상에서 제외한다.
  //   사유: 형광펜 근거 연결이 제품의 핵심이라 근거 블록의 정확성이 곧 제품 정확성이다.
  const out = [];
  for (const line of String(text || "").split(/\r?\n/)) {
    if (!line.includes("📌")) continue;
    const pos = [];
    for (let i = 0; i < line.length; i++) if (line[i] === '"') pos.push(i);
    for (let i = 0; i + 1 < pos.length; i += 2) {
      const q = line.slice(pos[i] + 1, pos[i + 1]);
      if (q.length >= minLen) out.push(q);
    }
  }
  return out;
}

/**
 * [S2 운문 ' / '] 여러 행을 " / "로 이은 인용의 각 조각이 본문·보기에 실재하는가.
 *   matchVerseMultiSent 가 sentType=verse 인 연속 행만 다루므로 그 밖의 조판을 놓친다(실측 90건).
 */
export function verseSlashResolved(quote, sents, bogi) {
  if (!String(quote).includes(" / ")) return false;
  const parts = String(quote).split(" / ").map((x) => x.trim()).filter(Boolean);
  if (parts.length < 2) return false;
  return parts.every(
    (p) =>
      (sents || []).some((s) => String(s.t || "").includes(p)) ||
      (bogi && String(bogi).includes(p)),
  );
}

/**
 * [오탐 ① 마커 삽입] 대조 시 마커 문자를 제거한다.
 *   ★ 반드시 양쪽(인용·원문)에 대칭 적용한다. 한쪽만 하면 일치가 불일치로 뒤집힌다(§7-26).
 *   실증: 해설 «갑은 이들과 함께 공동 소송을 하여» / 원문 «갑은 이들과 함께 ㉠ 공동 소송을 하여»
 */
//   [오탐 ⑥ 각주 기호] 시험지 본문의 각주 표시(*, †, ‡, ※, ⁎)도 함께 제거한다.
//   실증: 원문 «가시광선의 파장의 범위는 390∼780 nm* 정도인데» / 해설 «… nm 정도인데»
export const stripMarks = (x) =>
  String(x || "")
    .replace(/[㉠-㉿ⓐ-ⓩ①-⑳㈀-㈜⑴-⒇]/g, "")
    .replace(/[*＊†‡※⁎]/g, "")
    .replace(/\^/g, "")            // 위첨자 표기 — 원문 「(체중)0.75」 vs 해설 「(체중)^0.75」
    .replace(/\s+/g, " ")
    .trim();

/**
 * [오탐 ② 조사 부착] 조각이 원문에 있는가. 끝의 조사 1~2자를 허용 오차로 둔다.
 *   실증: 해설 «이와 무관한 명제는» / 원문 «… 이와 무관한 명제 "은주는 학생이다."는 …»
 *   ★ 허용 폭을 넓히면 요약을 인용으로 표기한 규약위반(⑤)이 통과해 버린다. 2자로 고정한다.
 */
export function fragmentIn(frag, hay) {
  const f = String(frag).trim();
  if (!f) return false;
  const H = String(hay);
  if (H.includes(f)) return true;
  const sf = stripMarks(f), sh = stripMarks(H);          // 양쪽 대칭
  if (sf.length >= 4 && sh.includes(sf)) return true;
  for (let k = 1; k <= 2; k++) {
    const cut = sf.slice(0, sf.length - k);
    if (cut.length >= 4 && sh.includes(cut)) return true;
  }
  return false;
}

/**
 * [오탐 ②] 말줄임표로 자른 인용 — 각 조각이 원문에 있으면 해소.
 *   조각이 하나라도 없으면 해소되지 않는다(그 조각이 환각 후보다).
 */
export function ellipsisResolved(quote, hay) {
  const q = String(quote);
  if (!/…|\.{2,}/.test(q)) return false;
  const parts = q.split(/\s*(?:…|\.{2,})\s*/).map((x) => x.trim()).filter((x) => x.length >= 4);
  if (parts.length < 2) return false;
  return parts.every((p) => fragmentIn(p, hay));
}

/**
 * 인용 1건이 원문으로 해소되는가. 해소되면 §2 FAIL 이 아니다.
 *   ctx = { sents, bogi, qt(발문), choices }
 *   S3 choice.t · S4 q.t 는 §13⑭ "전 텍스트 필드" 원칙에 따라 대조 대상에 포함한다.
 */
export function quoteResolved(quote, ctx) {
  const { sents = [], bogi = "", qt = "", choices = [] } = ctx || {};
  const q = String(quote);
  // ③④ 대조 대상은 sents ∪ bogi 합집합으로 통일한다(한쪽만 보면 오탐).
  const HAY = (sents || []).map((s) => s.t || "").join("\n") + "\n" + String(bogi || "");
  if (sents.some((s) => String(s.t || "").includes(q))) return "sents";
  if (bogi && String(bogi).includes(q)) return "bogi";
  const nq = _s2norm(q);
  if (nq.length >= 6) {
    if (sents.some((s) => _s2norm(s.t || "").includes(nq))) return "sents~";
    if (bogi && _s2norm(bogi).includes(nq)) return "bogi~";
  }
  // ① 마커 삽입 — 양쪽 대칭 제거 후 재대조
  const sq = stripMarks(q);
  if (sq.length >= 4 && stripMarks(HAY).includes(sq)) return "marker~";
  if (matchVerseMultiSent(q, sents)) return "verse";
  if (verseSlashResolved(q, sents, bogi)) return "verse/";        // S2
  // ② 말줄임표 조각 — 조각 전건이 원문에 있으면 해소(끝 조사 2자 허용)
  if (ellipsisResolved(q, HAY)) return "ellipsis";
  const ct = choices.map((c) => String(c.t || "")).join("  ");
  if (ct.includes(q)) return "choice.t";                           // S3
  if (nq.length >= 6 && _s2norm(ct).includes(nq)) return "choice.t~";
  if (qt && String(qt).includes(q)) return "q.t";                  // S4
  if (nq.length >= 6 && qt && _s2norm(qt).includes(nq)) return "q.t~";
  return null;
}

/** 회귀용 — 한 선지에서 §2 FAIL 로 남는 인용 목록(WARNING 은 제외). */
export function s2QuoteMiss(analysis, ctx) {
  const out = [];
  for (const q of extractQuotes(analysis)) {
    if (quoteResolved(q, ctx)) continue;
    if (q.split(/[.!?]/).filter(Boolean).length > 1 || /…|\.{2,}/.test(q)) continue; // WARNING
    out.push(q);
  }
  return out;
}

export function matchVerseMultiSent(quote, sents) {
  const q = String(quote || "");
  if (!/\s\/\s/.test(q)) return null;
  const parts = q
    .split(/\s*\/\s*/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length < 2) return null;
  const verses = (sents || []).filter((s) => s.sentType === "verse");
  if (!verses.length) return null;
  const pos = new Map(verses.map((v, i) => [v.id, i]));
  const ids = [];
  for (const p of parts) {
    const np = _s2norm(p);
    if (np.length < 6) return null; // 가드2: 너무 짧은 조각(느슨 매칭 금지)
    const hits = verses.filter((v) => {
      const nv = _s2norm(v.t);
      return nv.includes(np) && np.length >= nv.length * 0.6; // 가드2: 전행 대부분
    });
    if (hits.length !== 1) return null; // 가드3: 0개 or 후렴 다중 → null
    ids.push(hits[0].id);
  }
  const idx = ids.map((id) => pos.get(id));
  for (let i = 1; i < idx.length; i++)
    if (idx[i] !== idx[i - 1] + 1) return null; // 가드1: 연속성
  return ids;
}

// [발주2] 산출물 읽기 — 파일 부재(정상)와 파싱 실패/필수 부재를 구분해 삼키지 않는다.
//   기존 try/catch → [] 는 "게이트 미실행/산출물 손상"을 "결함 0"으로 오인시켰다.
//   required=true(필수 산출물)는 부재 시 throw. 어느 경우든 JSON.parse 실패는 throw.
//   순수 함수로 분리(dir 인자) → §13⑮(7) 양성 회귀를 import해 재현 가능하게 한다.
export function readOutSafe(dir, f, required = false) {
  const p = path.join(dir, f);
  if (!fs.existsSync(p)) {
    if (required)
      throw new Error(`필수 산출물 부재: ${f} — quality_gate 미실행/실패 의심`);
    return [];
  }
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch (e) {
    throw new Error(`산출물 파싱 실패: ${f} — ${e.message}`);
  }
}
// import 시(양성 회귀 등)엔 본체 미실행 — readOutSafe 등 함수만 노출.
//   가드가 없으면 import만으로 execSync(quality_gate)가 돌아 부작용이 난다.
const IS_CLI =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

const args = process.argv.slice(2);
const setsArg =
  (args.find((a) => a.startsWith("--sets=")) || "").split("=")[1] || "";
const targets = setsArg
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
if (IS_CLI && !targets.length) {
  console.error(
    "사용: node pipeline/haesol_v2_gate.mjs --sets=<yk>::<setId>[,...] [--target=v2_dryrun]",
  );
  process.exit(2);
}
if (IS_CLI) {
  // ── [발주1] --target=v2_dryrun : 생성 직후 v2 산출물을 검사한다 ──
  //   배포본 all_data는 아직 v2 반영 전(미커밋)이라 그대로 검사하면 옛 해설을 본다.
  //   배포본 복사 → v2 산출물({qId,num,pat,analysis}) 주입 → 임시 파일 → quality_gate --data=<임시>.
  //   인자 없으면 기존대로 배포본(하위호환).
  const ALLDATA = path.join(ROOT, "public/data/all_data_204.json");
  const TARGET = (args.find((a) => a.startsWith("--target=")) || "").split(
    "=",
  )[1];
  // --data=<경로> : 사전 구축된 임시(v2 analysis + step4 cs_ids)를 재주입 없이 직접 검사.
  //   step4 --data=임시로 cs_ids를 재산출한 뒤, 그 결과를 그대로 판정해야 하므로
  //   --target(재주입=cs_ids 원복)과 상호 배타. quality_gate와 동일 패턴.
  const DATA_OVERRIDE = (args.find((a) => a.startsWith("--data=")) || "").split(
    "=",
  )[1];
  let GATE_DATA = null; // quality_gate에 넘길 --data (null=배포본)
  if (TARGET === "v2_dryrun" && DATA_OVERRIDE) {
    console.error(
      "[gate] 🔴 --target=v2_dryrun 과 --data 는 동시 사용 불가(재주입이 step4 cs_ids를 원복시킴)",
    );
    process.exit(2);
  }
  if (DATA_OVERRIDE) {
    GATE_DATA = path.resolve(process.cwd(), DATA_OVERRIDE);
    console.log(
      `[gate] --data=${GATE_DATA} (사전 구축 임시 직접 검사, 재주입 없음)`,
    );
  }
  if (TARGET === "v2_dryrun") {
    const base = JSON.parse(fs.readFileSync(ALLDATA, "utf8"));
    const findIn = (yk, sid) => {
      for (const sec of ["reading", "literature"])
        for (const s of (base[yk] || {})[sec] || [])
          if ((s.setId || s.id) === sid) return s;
      return null;
    };
    let injected = 0;
    for (const t of targets) {
      const [yk, sid] = t.split("::");
      const rf = path.join(OUT, "v2_dryrun", `${yk}_${sid}_result.json`);
      if (!fs.existsSync(rf)) {
        console.error(
          `[gate] 🔴 필수 v2 산출물 부재: v2_dryrun/${yk}_${sid}_result.json`,
        );
        process.exit(3);
      }
      let rows;
      try {
        rows = JSON.parse(fs.readFileSync(rf, "utf8"));
      } catch (e) {
        console.error(
          `[gate] 🔴 v2 산출물 파싱 실패: ${yk}_${sid}_result.json — ${e.message}`,
        );
        process.exit(3);
      }
      const set = findIn(yk, sid);
      if (!set) {
        console.error(`[gate] 🔴 배포본에 세트 없음: ${yk}::${sid}`);
        process.exit(3);
      }
      for (const r of rows) {
        const q = (set.questions || []).find(
          (x) => String(x.id) === String(r.qId),
        );
        const c = q && (q.choices || []).find((x) => x.num === r.num);
        if (c) {
          c.pat = r.pat;
          c.analysis = r.analysis;
          injected++;
        }
      }
    }
    GATE_DATA = path.join(OUT, "_v2_gate_tmp.json"); // 임시 — 커밋 금지
    fs.writeFileSync(GATE_DATA, JSON.stringify(base), "utf8");
    console.log(
      `[gate] --target=v2_dryrun : ${injected}선지 주입 → ${GATE_DATA}`,
    );
  }

  // 1) 권위 게이트 1회 실행(output JSON 갱신)
  //   ⚠ --target 모드는 --scope=release 를 쓰지 않는다(release는 --data 무시 = 배포본).
  //   임시 데이터를 검사하려면 --data 경로 + 스코프 없이(전 코퍼스) 실행 후 세트 필터.
  const gateCmd = GATE_DATA
    ? `node pipeline/quality_gate.mjs --data=${GATE_DATA}`
    : `node pipeline/quality_gate.mjs --scope=release`;
  console.log(`[1/3] ${gateCmd} 실행(권위 게이트 output 갱신)…`);
  try {
    execSync(gateCmd, { cwd: ROOT, stdio: "ignore" });
  } catch (e) {
    // quality_gate는 release_blocked 시 exit≠0일 수 있음 — output JSON은 이미 기록됨
  }

  // all_critical.json 은 quality_gate가 항상 기록 → 필수(부재=게이트 미실행 증거).
  const readOut = (f, required = false) => {
    try {
      return readOutSafe(OUT, f, required);
    } catch (e) {
      console.error(`[gate] 🔴 ${e.message}`);
      process.exit(4);
    }
  };
  const allCritical = readOut("all_critical.json", true);
  const csAnchor = readOut("cs_anchor_mismatch.json");
  const bogiAnchor = readOut("bogi_anchor.json");
  const markerMis = readOut("analysis_marker_mismatch.json");

  // 2) all_data 로드 + 세트 찾기 (--target 모드면 임시, 아니면 배포본)
  const d = JSON.parse(fs.readFileSync(GATE_DATA || ALLDATA, "utf8"));
  function findSet(yk, sid) {
    for (const sec of ["reading", "literature"])
      for (const s of (d[yk] || {})[sec] || [])
        if ((s.setId || s.id) === sid) return s;
    return null;
  }
  // CRITICAL loc은 setId/yearKey 순서가 섞여 있어, setId 문자열 포함으로 매칭
  const criticalForSet = (yk, sid) =>
    allCritical.filter(
      (i) =>
        (i.yearKey === yk || String(i.loc || "").includes(yk)) &&
        String(i.loc || "").includes(sid),
    );

  // 3) 세트별 6축 판정
  const conclOf = (a) => {
    const ls = String(a || "")
      .trim()
      .split("\n");
    return ls[ls.length - 1].trim();
  };
  let scopeSets = 0,
    scopeQ = 0,
    scopeC = 0; // 검사 스코프 분모(§13⑮)
  const results = [];
  for (const t of targets) {
    const [yk, sid] = t.split("::");
    const s = findSet(yk, sid);
    if (!s) {
      results.push({ set: t, verdict: "ERROR", reason: "세트 없음" });
      continue;
    }
    scopeSets++;
    scopeQ += (s.questions || []).length;
    scopeC += (s.questions || []).reduce(
      (a, _q) => a + (_q.choices || []).length,
      0,
    );
    const sents = new Set((s.sents || []).map((x) => x.id));
    const sentArr = s.sents || [];
    const hay = sentArr.map((x) => x.t).join("\n");
    // 문학 세트는 어휘(V) 판정 제외 — '의미/가까운' <보기> 문항은 L*(보기/감상)이지 어휘 아님
    const isLit = ((d[yk] || {}).literature || []).some(
      (x) => (x.setId || x.id) === sid,
    );
    let s2fail = 0,
      s2warn = 0,
      revBad = 0,
      dead = 0,
      vDirty = 0,
      vocabPatBad = 0,
      anchorGap = 0;
    const s2failEx = [];
    for (const q of s.questions || []) {
      // 객체형 보기(annotated_image 등)도 텍스트를 살려야 함 — 빈 문자열로 두면
      // 정당한 <보기> 인용이 전부 §2 FAIL로 오탐(실증 2026-07-20 r2026c Q12).
      const bogi =
        typeof q.bogi === "string"
          ? q.bogi
          : q.bogi
            ? JSON.stringify(q.bogi)
            : "";
      // 어휘 문항 판별(§6): 발문 키워드(문맥상 의미·바꿔 쓰기·가장 가까운)
      // 어휘 판별(확장): 의미/뜻·바꿔쓰기(삽입어 허용)·가장 가까운 의미로 쓰인.
      //   제외: '의미를 추론/파악'(추론 문항)·'주장/관점/내용…가까운'(내용 문항) — 어휘 아님.
      const qtStr = String(q.t || "");
      const isVocab =
        !/의미를 (추론|파악)|(주장|관점|내용).{0,6}가까운/.test(qtStr) &&
        /문맥[상적].{0,8}(의미|뜻)|(의미|뜻)[가와]? 가장 가까운|가장 가까운 의미로 쓰인|바꿔\s?쓰기?.{0,8}적절|바꿔 쓸 수 있는/.test(
          qtStr,
        );
      for (const c of q.choices || []) {
        const a = c.analysis || "";
        // [결정1(A)] 근거누락(anchor_gap) 면제 — ok:false + pat∈{R3,V} + cs_ids=[] 선지만.
        //   R3(지문 밖 내용)·V(어휘)는 규칙상 cs_ids=[](release_ready #4가 R3 면제, §6 V 면제)이므로
        //   해설이 📌로 지문을 인용해 sent가 잡혀도 "근거누락"으로 집계하지 않는다(AUTO_EMPTY 정합).
        //   ⚠ 좁게: R3/V AND cs=[] 만. R1·R2·R4·L*(근거 필수 pat) 및 cs 비어있지 않은 선지는 그대로 flag.
        const anchorExempt =
          c.ok === false &&
          (c.pat === "R3" || c.pat === "V") &&
          (c.cs_ids || []).length === 0;
        // ① §2 전선지: 📌 인용(12+) ⊆ sents∪bogi. 다문장=WARNING, 그 외=FAIL
        // ④ 근거완전성(발주#4): 지문 인용 sent가 cs_ids에 없으면 FAIL(⚡·🧠 참조 누락 색출)
        // [사각 4종 수리 — 발주 dq]
        //   S1 extractQuotes  : 따옴표 짝을 먼저 맞춘 뒤 길이로 거른다(구판은 짝이 어긋났다)
        //   S2 verseSlashResolved · S3 choice.t · S4 q.t → quoteResolved 안에서 처리
        //   ★ 해소 판정만 넓혔다. 원문 어디에도 없는 인용은 그대로 FAIL 로 남는다(음성 대조 보유).
        const _ctx = { sents: sentArr, bogi, qt: String(q.t || ""), choices: q.choices || [] };
        for (const qt of extractQuotes(a)) {
          const hit = sentArr.find((sn) => (sn.t || "").includes(qt));
          if (hit) {
            if (!(c.cs_ids || []).includes(hit.id) && !anchorExempt) {
              anchorGap++;
              if (s2failEx.length < 6)
                s2failEx.push(
                  `Q${q.id}c${c.num} 근거누락(cs∌${hit.id.replace(sid, "")}): ${qt.slice(0, 26)}`,
                );
            }
            continue;
          }
          if (quoteResolved(qt, _ctx)) continue;
          if (
            qt.split(/[.!?]/).filter(Boolean).length > 1 ||
            /…|\.{2,}/.test(qt)
          )
            s2warn++;
          else {
            s2fail++;
            if (s2failEx.length < 6)
              s2failEx.push(`Q${q.id}c${c.num}: ${qt.slice(0, 34)}`);
          }
        }
        // ⑥ 결론줄=ok
        if (a.trim()) {
          const cc = conclOf(a);
          if (!(c.ok ? cc.startsWith("✅") : cc.startsWith("❌"))) revBad++;
        }
        // DEAD_csid
        for (const id of c.cs_ids || []) if (!sents.has(id)) dead++;
        // V 오답 cs 규칙(C_vpat_dirty 선제)
        if (c.ok === false && c.pat === "V" && (c.cs_ids || []).length)
          vDirty++;
        // 어휘 문항 오답 pat != V (기존 데이터 pat 오분류 색출 겸용) — 독서만(문학 제외)
        if (isVocab && !isLit && c.ok === false && c.pat !== "V") vocabPatBad++;
      }
    }
    const crit = criticalForSet(yk, sid);
    const setCs = csAnchor.filter((x) => x.setId === sid);
    const setBogi = bogiAnchor.filter((x) => x.setId === sid);
    const setMk = markerMis.filter((x) => x.setId === sid);
    // PASS: CRITICAL 0 AND §2 real-FAIL 0 AND 결론줄 위반 0 AND DEAD 0 AND V-dirty 0 AND 어휘pat 0
    const blocking =
      crit.length + s2fail + revBad + dead + vDirty + vocabPatBad + anchorGap;
    const verdict = blocking === 0 ? "PASS" : "FAIL";
    results.push({
      set: t,
      verdict,
      critical: crit.length,
      s2_fail: s2fail,
      s2_warn: s2warn,
      concl_bad: revBad,
      dead,
      v_dirty: vDirty,
      vocab_pat_bad: vocabPatBad,
      anchor_gap: anchorGap,
      warn: {
        bogi_anchor: setBogi.length,
        marker_mismatch: setMk.length,
        cs_anchor: setCs.length,
      },
      s2failEx,
      critTypes: [...new Set(crit.map((c) => c.type))],
    });
  }

  // 로그 출력 + 파일
  console.log("\n========== v2 게이트 판정 (전선지 로그) ==========");
  for (const r of results) {
    console.log(`\n■ ${r.set} → ${r.verdict}`);
    if (r.verdict === "ERROR") {
      console.log("  " + r.reason);
      continue;
    }
    console.log(
      `  [차단축] CRITICAL ${r.critical}${r.critTypes.length ? "(" + r.critTypes.join(",") + ")" : ""} · §2 FAIL ${r.s2_fail} · 결론줄위반 ${r.concl_bad} · DEAD ${r.dead} · V-dirty ${r.v_dirty} · 어휘pat오분류 ${r.vocab_pat_bad} · 근거누락 ${r.anchor_gap}`,
    );
    console.log(
      `  [비차단 WARNING] §2 다문장 ${r.s2_warn} · bogi_anchor ${r.warn.bogi_anchor} · marker ${r.warn.marker_mismatch} · cs_anchor ${r.warn.cs_anchor}`,
    );
    r.s2failEx.forEach((x) => console.log("    §2 FAIL " + x));
  }
  const pass = results.filter((r) => r.verdict === "PASS").map((r) => r.set);
  const fail = results.filter((r) => r.verdict === "FAIL").map((r) => r.set);
  // ── 검사 스코프 분모 + 가드 (§13⑮: 분모 없는 판정은 무효 신호) ──
  console.log(
    `\n검사 스코프: 세트 ${scopeSets} / 문항 ${scopeQ} / 선지 ${scopeC} → 요청 ${targets.length}세트 · FAIL ${fail.length}건`,
  );
  if (scopeSets === 0) {
    console.error("🔴 SCOPE_EMPTY — 검사 대상 0건. clean 판정 무효");
    process.exit(1);
  }
  if (scopeSets !== targets.length)
    console.warn(
      `⚠️  SCOPE_DIFF — 검사 ${scopeSets} ≠ 요청 ${targets.length}세트 (미발견 ${targets.length - scopeSets})`,
    );
  console.log(`\n========== 요약 ==========`);
  console.log(`PASS(대표 검수 큐): ${pass.length} [${pass.join(", ")}]`);
  console.log(`FAIL(반려·재생성): ${fail.length} [${fail.join(", ")}]`);
  fs.writeFileSync(
    path.join(OUT, "haesol_v2_gate.json"),
    JSON.stringify(results, null, 2),
  );
  console.log("→ output/haesol_v2_gate.json 기록");
  process.exit(fail.length ? 1 : 0);
} // end if (IS_CLI)
