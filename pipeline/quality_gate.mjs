/**
 * pipeline/quality_gate.mjs
 *
 * 전체 데이터 품질 검증 + 자동수정 단일 진입점.
 * 기존 일회성 패치 스크립트들을 모두 대체.
 *
 * 실행:
 *   node pipeline/quality_gate.mjs                → 전체 리포트 (dry-run)
 *   node pipeline/quality_gate.mjs --fix          → 자동수정 가능한 것 모두 처리
 *   node pipeline/quality_gate.mjs --fix 2025수능 → 특정 연도만
 *   node pipeline/quality_gate.mjs --report       → JSON 리포트 출력
 *
 * 자동수정 항목 (--fix):
 *   A. q.t 보기 혼재 → bogi 분리
 *   B. questionType 누락 → 발문 패턴 감지
 *   C. 선지 오염 텍스트 제거 (페이지번호/저작권/다음지문/확인사항)
 *   D. ok:true + pat → null
 *   E. ok:false + pat:0 → analysis 기반 자동 분류
 *   F. analysis 결론(✅/❌) vs ok 불일치 → 결론 줄 수정
 *   G. annotations sentId 형식 오류 (underscore 누락, 2022_6월 setKey)
 *
 * 수동 처리 목록 출력:
 *   - 선지 내용 없음 (표 파싱 실패)
 *   - analysis 🔍 내용 반전 → reanalyze_positive.mjs 호출 필요
 *   - bogi 없는 보기 문항
 *   - pat 분류 불가 (ok:false + analysis 키워드 없음)
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { auditBrackets } from "./bracket_audit.mjs";
import { expandMarkerRanges, misplacedMarkers } from "./marker_range.mjs";
// [발주 ae ①] 축6 판별식 재사용 — 새로 짜지 않는다.
//   두 게이트가 각자 판별식을 가지면 판정 불일치 자체가 결함이 된다.
import { detectFormatDefect } from "./haesol_v2_gate.mjs";

// ─── 인라인 헬퍼 (step2_postprocess / step3_rules 핵심 로직 내장) ─────────────
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
  const bogiIdx = t.search(/<보\s기>/);
  if (bogiIdx !== -1) {
    if (!q.bogi || q.bogi === "") q.bogi = t.slice(bogiIdx).trim();
    q.t = t.slice(0, bogiIdx).trim();
    return true;
  }
  const first = t.indexOf("<학습 활동>");
  const second = first !== -1 ? t.indexOf("<학습 활동>", first + 1) : -1;
  if (second !== -1 && (!q.bogi || q.bogi === "")) {
    q.bogi = t.slice(second).trim();
    q.t = t.slice(0, second).trim();
    return true;
  }
  return false;
}
function cleanChoiceText(c) {
  let t = c.t || "";
  const before = t;
  t = t.replace(/\s+\d{1,2}\s+\d\s*$/, "").trim();
  t = t.replace(/\s*20\s+이 문제지에 관한 저작권은.*$/, "").trim();
  t = t.replace(/\s*\*\s*확인 사항[\s\S]*$/, "").trim();
  t = t.replace(/\s*\[\d+[～~]\d+\][\s\S]*$/, "").trim();
  c.t = t;
  return t !== before;
}
function isEmptyChoice(c) {
  return !c.t?.trim() || /^\s*\d\s*$/.test(c.t);
}
const NEG_CONTENT = [
  "어긋나",
  "틀리",
  "왜곡",
  "오류",
  "잘못",
  "부적절",
  "맞지 않",
];
const POS_CONTENT = ["일치", "적절한", "올바르", "합당"];

function detectPatFromAnalysis(analysis, sec) {
  const a = analysis;
  if (
    /\[오류유형[①②③]/.test(a) ||
    a.includes("[L5]") ||
    a.includes("📌 보기 근거")
  )
    return "L5";
  if (a.includes("심리 오독") || a.includes("정서오독") || a.includes("[L2]"))
    return "L2";
  if (
    a.includes("팩트 왜곡") ||
    a.includes("개념 짜깁기") ||
    a.includes("[L1]") ||
    a.includes("사실 왜곡") ||
    a.includes("[R1]")
  )
    return sec === "reading" ? "R1" : "L1";
  if (
    a.includes("관계·인과") ||
    a.includes("인과 전도") ||
    a.includes("[L4]") ||
    a.includes("[R2]")
  )
    return sec === "reading" ? "R2" : "L4";
  if (
    a.includes("과도한 추론") ||
    a.includes("[L3]") ||
    a.includes("[R3]") ||
    a.includes("지문에 없")
  )
    return sec === "reading" ? "R3" : "L3";
  if (a.includes("개념 혼합") || a.includes("[R4]"))
    return sec === "reading" ? "R4" : "L1";
  if (a.includes("구조") || a.includes("대비") || a.includes("[L4]"))
    return "L4";
  if (a.includes("정서") || a.includes("감정") || a.includes("심리"))
    return "L2";
  return null;
}

function fixAnalysisConclusion(ana, ok) {
  const lines = ana.split("\n");
  for (let i = lines.length - 1; i >= 0; i--) {
    if (!lines[i].includes("✅") && !lines[i].includes("❌")) continue;
    if (ok === true && lines[i].includes("❌")) {
      lines[i] = lines[i]
        .replace(/❌.*\[.*?\]\s*$/, "✅ 지문과 일치하는 적절한 진술")
        .replace(/❌.*$/, "✅ 지문과 일치하는 적절한 진술");
    } else if (ok === false && lines[i].includes("✅")) {
      lines[i] = lines[i].replace(
        /✅.*$/,
        "❌ 지문과 어긋나는 부적절한 진술[?]",
      );
    }
    break;
  }
  return lines.join("\n");
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env"), override: true });

let DATA_PATH = path.resolve(__dirname, "../public/data/all_data_204.json");
const ANN_PATH = path.resolve(__dirname, "../public/data/annotations.json");
const BACKUP_DIR = path.resolve(__dirname, "../pipeline/backups");

const args = process.argv.slice(2);
const FIX = args.includes("--fix");
const REPORT = args.includes("--report");
// Gate 5: 확장 CRITICAL 검사 (기본 off — 점진적 활성화)
const GATE5 = args.includes("--gate5");
// Gate 7: 골든셋만 돌림 (회귀 테스트 모드)
const GOLDEN_ONLY = args.includes("--golden");
// --scope 프리셋: "suneung5" = 2022~2026수능 5개
// 인자 없이 실행하면 Object.keys(data) 전수(현재 353세트)를 돈다.
//   프리셋은 suneung5 · 모의고사전체 · release 3종뿐이며 전수 프리셋은 없다.
const SCOPE = (() => {
  const scopeArg = args.find((a) => a.startsWith("--scope="));
  if (!scopeArg) return null;
  return scopeArg.split("=")[1];
})();
// --data=<경로> : 판정 대상 데이터 오버라이드 (v2 생성물 검사용, haesol_v2_gate --target).
//   ⚠ --scope=release 에서는 무시하고 항상 배포본 — release 판정 단일 소스 보호(§13⑫).
//   기본값 불변(배포본). 실행 대상 경로는 아래에서 stdout에 1줄 출력.
{
  const dataArg = (args.find((a) => a.startsWith("--data=")) || "").split(
    "=",
  )[1];
  if (dataArg) {
    if (SCOPE === "release") {
      console.error(
        "[gate] ⚠ --data 무시 — --scope=release 는 항상 배포본 검사(§13⑫ release 판정 단일 소스)",
      );
    } else {
      DATA_PATH = path.resolve(process.cwd(), dataArg);
    }
  }
}
console.log(`[gate] data=${DATA_PATH}`);
const SCOPE_YEARS = {
  suneung5: ["2022수능", "2023수능", "2024수능", "2025수능", "2026수능"],
  모의고사전체: [
    "2022_6월",
    "2022_9월",
    "2023_6월",
    "2023_9월",
    "2024_6월",
    "2024_9월",
    "2025_6월",
    "2025_9월",
    "2026_6월",
    "2026_9월",
  ],
};
const YEAR = args.find((a) => !a.startsWith("--"));

// ─── --scope=release: 출시 set(RELEASE_KEYS 전량)만 검사 ─────────────────────
// 단일 진실 = src/dataLoader.js의 RELEASE_KEYS = new Set([...]) (composite "yearKey::setId").
// fidelity_gate가 소스 정규식 파싱을 쓰는 패턴 재사용.
const RELEASE_KEYS_SET = (() => {
  if (SCOPE !== "release") return null;
  const src = fs.readFileSync(
    path.resolve(__dirname, "../src/dataLoader.js"),
    "utf8",
  );
  const idx = src.indexOf("RELEASE_KEYS");
  if (idx < 0)
    throw new Error("RELEASE_KEYS를 src/dataLoader.js에서 찾지 못함");
  // hardening: "])"(배열 닫힘) 기준 slice — 주석 내 "]"(예 [QG-…])에 조기 중단 방지.
  //   (LIVE_KEYS_SET과 동일 robust 파싱; naive indexOf("]")는 대괄호 주석 시 RELEASE_KEYS 오인)
  const end = src.indexOf("])", idx);
  const block = src.slice(idx, end < 0 ? undefined : end);
  const keys = [...block.matchAll(/"([^"]+::[^"]+)"/g)].map((m) => m[1]);
  return new Set(keys);
})();

// LIVE_KEYS_SET: scope 무관 항상 파싱 (발주1 후보 리스트 live 플래그용).
// 파서 괄호버그 회피 위해 "])" 기준 robust slice.
const LIVE_KEYS_SET = (() => {
  try {
    const src = fs.readFileSync(
      path.resolve(__dirname, "../src/dataLoader.js"),
      "utf8",
    );
    const idx = src.indexOf("RELEASE_KEYS");
    if (idx < 0) return new Set();
    const end = src.indexOf("])", idx);
    const block = src.slice(idx, end < 0 ? undefined : end);
    return new Set([...block.matchAll(/"([^"]+::[^"]+)"/g)].map((m) => m[1]));
  } catch {
    return new Set();
  }
})();

// ─── Gate 7 골든셋 로드 ────────────────────────────────────────────────────────
const GOLDEN_PATH = path.resolve(__dirname, "golden_set.json");
let GOLDEN = [];
try {
  GOLDEN = JSON.parse(fs.readFileSync(GOLDEN_PATH, "utf8")).items || [];
} catch {}
const goldenMatch = (yearKey, setId, qId) =>
  GOLDEN.some(
    (g) =>
      g.year === yearKey &&
      (!g.setId || g.setId === setId) &&
      (!g.questionId || g.questionId === qId),
  );
// expected 코드 맵: "yearKey/setId/qId" → Set<코드>
const GOLDEN_EXPECTED = new Map();
for (const g of GOLDEN) {
  const k = `${g.year}/${g.setId || "*"}/${g.questionId || "*"}`;
  GOLDEN_EXPECTED.set(k, new Set(g.expected || []));
}
function goldenExpected(yearKey, setId, qId) {
  return (
    GOLDEN_EXPECTED.get(`${yearKey}/${setId}/${qId}`) ||
    GOLDEN_EXPECTED.get(`${yearKey}/${setId}/*`) ||
    GOLDEN_EXPECTED.get(`${yearKey}/*/*`) ||
    new Set()
  );
}

// ─── 로드 ────────────────────────────────────────────────────────────────────
const raw = fs.readFileSync(DATA_PATH, "utf8");
const data = JSON.parse(raw);

let ann = null;
let rawAnn = null; // v2: annotations 백업 의무 (--fix 시 동일 시점 백업)
try {
  rawAnn = fs.readFileSync(ANN_PATH, "utf8");
  ann = JSON.parse(rawAnn);
} catch {}

// ─── 결과 수집 ────────────────────────────────────────────────────────────────
// ── 검사 스코프 분모 (§13⑮: "0개 검사 = clean" 거짓신호 차단) — 런타임 산출 ──
let scopeSets = 0,
  scopeQ = 0,
  scopeC = 0;
// W_orphan_marker 전용 분모 (마커 보유 세트가 진짜 분모 — 전체 세트 수 아님)
let scopeMarkerSets = 0,
  scopeOrphanSets = 0,
  scopeOrphanMarkers = 0,
  scopeOrphanLiveSets = 0;
// W_choice_passage_echo 분모 (ok:false 선지가 진짜 분모)
let scopeEchoChoices = 0,
  scopeEchoHits = 0;
// W_domain_mismatch 분모 (pat 보유 선지 = V·null 제외가 진짜 분모)
let scopeDomainChoices = 0,
  scopeDomainHits = 0,
  scopeDomainSetHits = 0,
  scopeDomainChoiceSetHits = 0;
const issues = []; // 발견된 문제 전체
const autoFixed = []; // 자동 수정된 항목
const manual = []; // 수동 처리 필요 항목
// ── 발주1 후보 리스트 (read-only triage 입력, 발주2·3의 입력) ──
const cslessAnchorCands = []; // 1-A W_csless_with_anchor
const metaLeakCands = []; // 1-B F_meta_leak (해설 메타-누출)
const footnoteMarkerCands = []; // 1-C FOOTNOTE_MARKER_INTEGRITY
const structMissingCands = []; // 1-D W_struct_missing (§7 3단 구조 미달)
const csspanStaleCands = []; // B track W_csspan_stale/broken
const bracketIntegrityCands = []; // W_bracket_integrity (출전행 작품명 낫표)
const csAnchorMismatchCands = []; // 근거형광펜정합 W_cs_anchor_mismatch (📌근거 sent ⊄ cs_ids)
const annStaleCands = []; // annotation 무결성 W_annotation_stale (text ⊄ sent.t / bracket sentFrom·To 부재)
const bracketCollapseCands = []; // W_bracket_collapse (동일 sentId 2+ bracket / 초대형 단일sent bracket)
const bogiAnchorCands = []; // W_bogi_anchor (📌 보기 근거 ⊄ q.bogi exact substring)
const analysisMarkerCands = []; // W_analysis_marker_mismatch (해설 마커 ⊄ 문항 문맥)
const orphanMarkerCands = []; // W_orphan_marker (지문 마커 ⊄ 전 문항 참조 = 환각 후보)
const markerMisplacedCands = []; // W_marker_misplaced (인라인 sentId ≠ ann sentId = 오정박)
const choiceEchoCands = []; // W_choice_passage_echo (ok:false 선지 ≈ 지문 원문 = 치환형 손상)
const domainMismatchCands = []; // W_domain_mismatch (배열 ↔ pat 계열 불일치, §6 도메인 엄수)

// ─── [v2] scope / tier / action_class 분류 ────────────────────────────────────
const SCOPE_DEMO = new Set(["2026수능"]);
const SCOPE_PRIORITY = new Set([
  "2025수능",
  "2025_9월",
  "2024수능",
  "2022_6월",
  "2022수능",
  "2023수능",
  "2023_6월",
  "2023_9월",
  "2024_6월",
  "2026_9월",
]);
const SCOPE_VISIBLE_EXTRA = new Set([
  "2024_9월",
  "2022_9월",
  "2025_6월",
  "2026_6월",
]);
function getScope(yk) {
  if (SCOPE_DEMO.has(yk)) return "demo";
  if (SCOPE_PRIORITY.has(yk)) return "priority";
  if (SCOPE_VISIBLE_EXTRA.has(yk)) return "visible_extra";
  return "legacy_post_5_8";
}
function getTier(yk) {
  if (SCOPE_DEMO.has(yk)) return "T0";
  if (SCOPE_PRIORITY.has(yk) || SCOPE_VISIBLE_EXTRA.has(yk)) return "T1";
  return "T2";
}
const ACTION_CLASS_MAP = {
  // ── 기존 검사 ──
  DEAD_csid: "manual",
  F_empty_analysis: "manual",
  MISSING_csid_true: "manual",
  MISSING_csid_false: "manual",
  H_analysis_id_leak: "auto_safe",
  H_cs_concentration: "manual",
  C_figure_missing: "raw_required",
  C_marker_pollution: "auto_safe",
  C_work_mismatch: "manual",
  C_label_domain_mismatch: "auto_safe",
  C_vpat_dirty: "auto_safe",
  C_answer_derivation: "manual",
  F_distractor_reads_as_answer: "manual",
  F_answer_reads_as_distractor: "manual",
  C_quote_unreflected: "manual",
  W_quote_unreflected: "manual",
  C_highlight_analysis_divergence: "manual",
  C_pat_mismatch: "manual",
  C_choice_pollution: "auto_safe",
  C_empty_choice: "raw_required",
  D_true_has_pat: "auto_safe",
  E_pat_zero: "manual",
  E_pat_unclassifiable: "manual",
  F_conclusion_mismatch: "auto_safe",
  F_content_reversed: "manual",
  W_argument_thin: "manual",
  W_expression_analysis_missing: "manual",
  W_single_evidence: "manual",
  B_qt_missing: "auto_safe",
  G_missing_bogi: "manual",
  G_ann_sentid: "auto_safe",
  G_ann_dead: "manual",
  // ── [v2] 신규 6건 ──
  E_ok_true_no_cs_ids: "manual",
  E_required_cs_missing: "manual",
  E_empty_pat_cs_present: "auto_safe",
  E_questionType_ok_mismatch: "raw_required",
  W_analysis_placeholder_real: "manual",
  W_analysis_placeholder_suspect: "auto_safe",
  // ── 본문 품질 + 선지 수 검증 ──
  S_sent_count_zero: "raw_required",
  S_sent_count_low: "raw_required",
  S_sent_ratio_low: "raw_required",
  S_choices_missing: "raw_required",
};
function getActionClass(type) {
  return ACTION_CLASS_MAP[type] || "manual";
}

// extra: 구조화 필드(setId·qId·num). loc 문자열 파싱은 형식이 축마다 달라
//   매핑 실패를 낳는다(2026-07-21 MARKER_INTEGRITY_FAIL loc="setId 마커" 실증 —
//   parts[1] 파싱이 yearKey를 못 찾아 출시 후보 72세트 오산출 → 롤백).
//   신규 축은 loc 대신 extra로 setId를 직접 실어 소비자가 파싱하지 않게 한다.
function issue(type, yearKey, loc, message, severity = "warn", extra = null) {
  issues.push({
    type,
    yearKey,
    loc,
    message,
    severity,
    ...(extra || {}),
    tier: getTier(yearKey),
    scope: getScope(yearKey),
    action_class: getActionClass(type),
  });
}
function fixed(type, yearKey, loc, message) {
  autoFixed.push({
    type,
    yearKey,
    loc,
    message,
    tier: getTier(yearKey),
    scope: getScope(yearKey),
    action_class: getActionClass(type),
  });
}
function needsManual(type, yearKey, loc, message) {
  manual.push({
    type,
    yearKey,
    loc,
    message,
    tier: getTier(yearKey),
    scope: getScope(yearKey),
    action_class: getActionClass(type),
  });
}

// ─── sentId 유효 세트 수집 ────────────────────────────────────────────────────
const validSentIds = new Set();
for (const yd of Object.values(data))
  for (const sec of ["reading", "literature"])
    for (const s of yd[sec] || [])
      for (const sent of s.sents || []) validSentIds.add(sent.id);

// ─── 메인 순회 ────────────────────────────────────────────────────────────────
const yearsToCheck =
  SCOPE === "release"
    ? Object.keys(data) // release는 setId 단위 필터(아래) — 연도는 전체로
    : SCOPE && SCOPE_YEARS[SCOPE]
      ? SCOPE_YEARS[SCOPE]
      : YEAR
        ? [YEAR]
        : Object.keys(data);

// ─── [발주 ef 사양2] 해설 반전 축 어구 ─────────────────────────────────────
//   축 A: 오답 선지 해설이 자기를 정답이라고 말하는 어투
//   축 B: 정답 선지 해설이 자기를 오답인 듯 부정형으로 말하는 어투
//   ★ 어구 목록은 발주 ef 원문 그대로다. 임의 가감 금지 — 넓히면 오탐이 늘고,
//     좁히면 ee-2 가 잡은 실제 결함 형태를 다시 놓친다.
const ANSWER_ROLE_A_RE =
  /문제 요구에 부합|문제 요구에 맞는|문제 요구에 적합|이 문항에서 적절한 선지|문항에서 적절한 선지|정답 선지|정답이 된다|답이 된다|정답으로 적절/;
const ANSWER_ROLE_B_RE =
  /부적절한 진술이 아님|부적절하지 않|틀린 진술이 아님|잘못된 진술이 아님|올바른 분석이다|정확하여|옳은 진술이다/;

let _releaseSetCount = 0; // --scope=release 순회 set 수 검증용

for (const yearKey of yearsToCheck) {
  if (!data[yearKey]) {
    console.warn(`⚠️  ${yearKey} 없음`);
    continue;
  }

  for (const sec of ["reading", "literature"]) {
    for (const set of data[yearKey][sec] || []) {
      // ── --scope=release: 출시 set(composite key)만 검사 ──
      if (SCOPE === "release" && !RELEASE_KEYS_SET.has(yearKey + "::" + set.id))
        continue;
      if (SCOPE === "release") _releaseSetCount++;
      // 검사 스코프 분모 집계(스코프 필터 통과분만) — 세트/문항/선지
      scopeSets++;
      scopeQ += (set.questions || []).length;
      scopeC += (set.questions || []).reduce(
        (a, _q) => a + (_q.choices || []).length,
        0,
      );
      // ── [Gate] W_orphan_marker — 지문에 박혔으나 어떤 문항도 참조 않는 마커 ──
      //   기존 스캔은 전부 "문항이 참조하는데 범위 annotation 없음"(결손) 단방향.
      //   반대 방향(데이터엔 있는데 시험지·문항엔 없음 = 환각)은 미검사 = §13⑮-(3)
      //   worklist 방향 사각. 수능 지문의 ㉠~㉤·ⓐ~ⓔ는 반드시 문항이 참조하므로
      //   미참조 = 강한 환각 신호. 실증: 2019_9월 r20199a ㉣㉤(대표 육안 발견).
      //   판정식은 발문 매처 비의존 — sents ↔ questions/bogi/choices 원문 직접 대조.
      //   WARNING 고정: 시험지 대조 전이므로 자동 CRITICAL 금지(대소문자 오식 등
      //   환각 아닌 원인 잔존 — 실증 2015_9월A l20159b Ⓔ = ⓔ 오식).
      {
        const OMRK = /[㉠-㉿]|[ⓐ-ⓩⒶ-Ⓩ]|[①-⑳]/g;
        const omk = (s) => String(s || "").match(OMRK) || [];
        const inSents = new Map(); // marker → 최초 출현 sentId
        for (const sn of set.sents || [])
          for (const m of omk(sn.t)) if (!inSents.has(m)) inSents.set(m, sn.id);
        if (inSents.size) {
          scopeMarkerSets++;
          const referenced = new Set();
          for (const _q of set.questions || []) {
            for (const m of omk(_q.t)) referenced.add(m);
            // 범위표기 "ⓐ~ⓔ" 전개(ⓑⓒⓓ 생략자 포함) — 공용 파서, structure와 공유
            for (const m of expandMarkerRanges(_q.t)) referenced.add(m);
            const bogiStr =
              typeof _q.bogi === "string"
                ? _q.bogi
                : JSON.stringify(_q.bogi || "");
            for (const m of omk(bogiStr)) referenced.add(m);
            for (const m of expandMarkerRanges(bogiStr)) referenced.add(m);
            for (const _c of _q.choices || [])
              for (const m of omk(_c.t)) referenced.add(m);
          }
          const orphans = [...inSents.keys()].filter((m) => !referenced.has(m));
          if (orphans.length) {
            const live = LIVE_KEYS_SET.has(yearKey + "::" + set.id);
            scopeOrphanSets++;
            scopeOrphanMarkers += orphans.length;
            if (live) scopeOrphanLiveSets++;
            issue(
              "W_orphan_marker",
              yearKey,
              set.id,
              `지문 마커 [${orphans.join("")}] 전 문항 미참조 = 환각 후보${live ? " (LIVE)" : ""} — 시험지 대조 의무`,
            );
            orphanMarkerCands.push({
              yearKey,
              setId: set.id,
              markers: orphans,
              sentIds: orphans.map((m) => inSents.get(m)),
              live,
            });
          }
        }
      }
      // ── [Gate] W_choice_passage_echo — ok:false 선지가 지문을 그대로 옮김 ──
      //   ok:false는 정의상 지문과 어긋나야 하므로, 선지 대부분이 지문에 연속으로
      //   실재하면 = 한 단어 치환형 데이터 손상 신호(시험지의 오답 선지를 원문으로
      //   되돌려 놓아 "지문과 일치하는데 오답"이 된 상태 → 학생이 풀 수 없음).
      //   실증: 2026수능 r2026d Q14④ — 시험지 "의식을 매개로" ↔ 데이터 "신체를 매개로".
      //   answer_fidelity(번호만)·structure Layer2(유사도)·Layer4(발문 범위) 모두의 사각.
      //   WARNING 고정 — 정답 판정이 아니라 후보 색출(시험지 대조 전 자동 수정 금지).
      {
        const NRM = (s) =>
          String(s || "")
            .replace(/[㉠-㉿ⓐ-ⓩⒶ-Ⓩ①-⑳]/g, "")
            .replace(/[\s\p{P}]/gu, "");
        const passage = NRM((set.sents || []).map((s) => s.t).join(""));
        for (const q of set.questions || []) {
          for (const c of q.choices || []) {
            if (c.ok !== false) continue;
            scopeEchoChoices++;
            const ct = NRM(c.t);
            if (ct.length < 22) continue;
            // 최장 공통 부분문자열 (선지 기준 슬라이딩 — 선지가 짧아 비용 낮음)
            let best = 0;
            for (let i = 0; i < ct.length && ct.length - i > best; i++) {
              for (let len = ct.length - i; len > best; len--) {
                if (passage.includes(ct.slice(i, i + len))) {
                  best = len;
                  break;
                }
              }
            }
            if (best >= 22 && best / ct.length >= 0.7) {
              const live = LIVE_KEYS_SET.has(yearKey + "::" + set.id);
              scopeEchoHits++;
              issue(
                "W_choice_passage_echo",
                yearKey,
                `${set.id} Q${q.id}[${c.num}]`,
                `ok:false 선지가 지문과 ${best}자 연속 일치(선지의 ${Math.round((100 * best) / ct.length)}%)${live ? " (LIVE)" : ""} — 한 단어 치환형 손상 의심, 시험지 대조 의무`,
              );
              choiceEchoCands.push({
                yearKey,
                setId: set.id,
                qId: q.id,
                choice: c.num,
                matchLen: best,
                ratio: +(best / ct.length).toFixed(2),
                live,
              });
            }
          }
        }
      }
      // ── [Gate] W_domain_mismatch — 배열(reading/literature) ↔ pat 계열 불일치 ──
      //   §6 "도메인 엄수: 독서에 L* 금지, 문학에 R* 금지". 오학습은 아니나
      //   PatternReport/PatternCoach의 약점 진단이 오염된다(문학 문제를 R1로 집계 →
      //   학생에게 잘못된 약점 제시). 학원 판매 제품에서 경시 불가.
      //   실증: 2016_9월A l20169a(지방질 산패 = 과학 독서가 literature 배열, 100%) ·
      //         2016_9월B r20169g(창선감의록 = 고전소설이 reading 배열, 100%).
      //   ★ 두 층위를 분리 출력 — 처리 방법이 다르다:
      //     (A) 세트 배열 이관 = 오분율 100%(pat 보유 선지 전부가 반대 계열)
      //         → 세트를 반대 배열로 옮겨야 함(렌더·정렬·setId 충돌 확인 필요)
      //     (B) 선지 pat 계열 교정 = 오분율 < 100%(일부 선지만 반대 계열)
      //         → 해당 선지의 pat만 같은 계열로 재부여
      //   V·null은 계열이 없으므로 분모에서 제외.
      //   ⚠ WARNING 고정(계측 단계) — 지금 CRITICAL로 넣으면 기존 LIVE 세트가 걸려
      //     모든 push가 잠긴다. 51선지 교정 완료 후 CRITICAL 승격(대표 결정 2026-07-21).
      {
        const wrong = sec === "literature" ? "R" : "L";
        const bad = [];
        let patChoices = 0;
        for (const q of set.questions || []) {
          for (const c of q.choices || []) {
            const p = c.pat;
            if (!p || p === "V") continue;
            patChoices++;
            if (p[0] === wrong) bad.push({ qId: q.id, num: c.num, pat: p });
          }
        }
        scopeDomainChoices += patChoices;
        if (bad.length) {
          const live = LIVE_KEYS_SET.has(yearKey + "::" + set.id);
          const rate = bad.length / patChoices;
          const setLevel = rate === 1; // 전부 반대 계열 = 세트 자체가 반대 배열
          scopeDomainHits += bad.length;
          if (setLevel) scopeDomainSetHits++;
          else scopeDomainChoiceSetHits++;
          issue(
            "W_domain_mismatch",
            yearKey,
            set.id,
            setLevel
              ? `[A 세트 배열 이관] ${sec} 배열인데 pat 전량 ${wrong}* (${bad.length}/${patChoices} = 100%)${live ? " (LIVE)" : ""} — 세트를 반대 배열로 이관 대상`
              : `[B 선지 pat 교정] ${sec} 배열에 ${wrong}* 선지 ${bad.length}/${patChoices} (${Math.round(rate * 100)}%)${live ? " (LIVE)" : ""} — ${bad.map((b) => `Q${b.qId}[${b.num}]=${b.pat}`).join(" ")}`,
            "warn",
            { setId: set.id, section: sec, level: setLevel ? "set" : "choice" },
          );
          domainMismatchCands.push({
            yearKey,
            setId: set.id,
            section: sec,
            level: setLevel ? "set" : "choice",
            wrongFamily: wrong,
            badCount: bad.length,
            patChoices,
            rate: +rate.toFixed(2),
            choices: bad,
            live,
          });
        }
      }
      // ── [Gate] W_marker_misplaced — 인라인 마커 sentId ≠ annotation sentId ──
      //   같은 마커가 sent.t 인라인·annotation 양쪽에 있는데 sentId가 안 겹침 =
      //   인라인 기호가 잘못된 sent에 오정박(동일 어구 다출현 시 첫 출현에 오배치 등).
      //   annotation을 정본으로(payload 렌더 기준). structure Layer4(시험지↔데이터)와
      //   상보적 = 데이터 내부 인라인↔ann 정합. WARNING(자동 수정 아닌 sent.t 이설 대상).
      //   실증: r2022b ㉡(s9↔s18) · l2024b ⓓ(s19↔s18). §13⑦·⑭ 정합.
      {
        if (!globalThis.__annAll) {
          try {
            globalThis.__annAll = JSON.parse(fs.readFileSync(ANN_PATH, "utf8"));
          } catch {
            globalThis.__annAll = {};
          }
        }
        const annList = (globalThis.__annAll[yearKey] || {})[set.id] || [];
        for (const mp of misplacedMarkers(set.sents || [], annList)) {
          const live = LIVE_KEYS_SET.has(yearKey + "::" + set.id);
          issue(
            "W_marker_misplaced",
            yearKey,
            set.id,
            `인라인 마커 ${mp.marker} 위치[${mp.inline.join(",")}] ≠ annotation[${mp.ann.join(",")}]${live ? " (LIVE)" : ""} — sent.t 인라인 이설 대상`,
          );
          markerMisplacedCands.push({
            yearKey,
            setId: set.id,
            marker: mp.marker,
            inline: mp.inline,
            ann: mp.ann,
            live,
          });
        }
      }
      // ── [Gate 5] C_figure_missing — figure sent이 있으나 FIGURE_IMAGE_MAP에 미매핑 ─
      //   constants.js의 FIGURE_IMAGE_MAP을 로드해 매핑 누락 figure 탐지
      //   --golden 모드일 땐 골든셋에 등록된 세트만 검사
      const _goldenSetAllowed =
        !GOLDEN_ONLY ||
        GOLDEN.some(
          (g) => g.year === yearKey && (!g.setId || g.setId === set.id),
        );
      if (GATE5 && _goldenSetAllowed) {
        if (!globalThis.__figureMap) {
          try {
            const c = fs.readFileSync(
              path.resolve(__dirname, "../src/constants.js"),
              "utf8",
            );
            // FIGURE_IMAGE_MAP = { ... } 블록 전체 (최상위 { } 균형 탐색)
            const idx = c.indexOf("FIGURE_IMAGE_MAP");
            let body = "";
            if (idx >= 0) {
              const start = c.indexOf("{", idx);
              if (start >= 0) {
                let depth = 0;
                for (let i = start; i < c.length; i++) {
                  if (c[i] === "{") depth++;
                  else if (c[i] === "}") {
                    depth--;
                    if (depth === 0) {
                      body = c.slice(start + 1, i);
                      break;
                    }
                  }
                }
              }
            }
            const map = new Set();
            // 최상위 키만 추출 — depth 1에서 `<id>:` 패턴 (중첩 객체 내부 키 제외)
            let d = 0;
            for (const line of body.split(/\r?\n/)) {
              // 이 줄 처리 전 depth가 0이면 최상위
              if (d === 0) {
                const m2 = line.match(
                  /^\s*["']?([a-zA-Z_$][a-zA-Z0-9_$]*)["']?\s*:/,
                );
                if (m2) map.add(m2[1]);
              }
              for (const ch of line) {
                if (ch === "{") d++;
                else if (ch === "}") d--;
              }
            }
            globalThis.__figureMap = map;
          } catch {
            globalThis.__figureMap = new Set();
          }
        }
        for (const s of set.sents || []) {
          if (s.sentType === "figure" && !globalThis.__figureMap.has(s.id)) {
            issue(
              "C_figure_missing",
              yearKey,
              `${set.id} ${s.id}`,
              `figure sent 이미지 자산 미매핑 (FIGURE_IMAGE_MAP)`,
            );
          }
        }
      }

      // ── [Gate] MARKER_INTEGRITY — 문항/선지 참조 마커·bracket ⊆ (지문 sent.t ∪ annotation) ──
      //   위반 = 형광펜 정박 불가(학생이 선지의 ㉠/ⓐ를 지문에서 못 찾음) → CRITICAL.
      //   [A]~[F] bracket은 set이 bracket annotation 보유 시 제외(오탐 방지).
      {
        if (!globalThis.__mkChars) {
          try {
            globalThis.__mkChars = new Set(
              JSON.parse(
                fs.readFileSync(
                  path.resolve(__dirname, "../config/marker_chars.json"),
                  "utf8",
                ),
              ).passage_markers,
            );
          } catch {
            globalThis.__mkChars = new Set();
          }
        }
        if (!globalThis.__annAll) {
          try {
            globalThis.__annAll = JSON.parse(fs.readFileSync(ANN_PATH, "utf8"));
          } catch {
            globalThis.__annAll = {};
          }
        }
        const mkSet = globalThis.__mkChars;
        // available: 지문 sent.t ∪ annotation 마커 ∪ 보기-정의 라벨(diagram/annotated_image의
        //   description·items[].label·text 안 ㉠/ⓐ — 보기 내부 라벨은 지문 정박 불요, FP 차단)
        const avail = new Set();
        for (const s of set.sents || [])
          for (const ch of s.t || "") if (mkSet.has(ch)) avail.add(ch);
        for (const q of set.questions || []) {
          if (!q.bogi) continue;
          const bstr =
            typeof q.bogi === "string" ? q.bogi : JSON.stringify(q.bogi);
          for (const ch of bstr) if (mkSet.has(ch)) avail.add(ch);
          // 보기 구조 텍스트 내 마커 범위(예: annotated_image.text "㉠～㉣은 …위치")
          //   전개 → 중간 마커(㉡㉢)도 보기 라벨로 credit (도식 라벨 FP 차단)
          const rangeRe = /([㉠-㉿ⓐ-ⓩ])\s*[~∼～]\s*([㉠-㉿ⓐ-ⓩ])/g;
          let rm;
          while ((rm = rangeRe.exec(bstr))) {
            const a = rm[1].codePointAt(0);
            const b = rm[2].codePointAt(0);
            if (b > a && b - a < 30)
              for (let cp = a; cp <= b; cp++) {
                const c = String.fromCodePoint(cp);
                if (mkSet.has(c)) avail.add(c);
              }
          }
        }
        const annList = (globalThis.__annAll[yearKey] || {})[set.id] || [];
        let hasBracketAnn = false;
        for (const a of annList) {
          if (a.marker && mkSet.has(a.marker)) avail.add(a.marker);
          // [A]~[F]는 bracket/box/underline annotation(범위 정의) 또는 visual_marks로 제공됨.
          //   bracket 무결성은 bracket_audit.mjs(SOURCE_BODY_MARKER_MISSING)가 전담 →
          //   여기선 annotation 보유 set의 bracket 검사 제외(오탐 차단), 마커 전담.
          if (
            a.type === "bracket" ||
            a.type === "box" ||
            a.type === "underline"
          )
            hasBracketAnn = true;
        }
        // 지문 sent.t 안 [A]~[F]
        const bracketAvail = new Set();
        for (const s of set.sents || []) {
          const bm = (s.t || "").match(/\[[A-F]\]/g);
          if (bm) bm.forEach((b) => bracketAvail.add(b));
        }
        // 보기(<보기>) 내부 정의 [A]~[F]도 정박원 (bogi 마커 credit과 동형).
        //   보기가 [A]/[B]로 자료를 라벨링하면(예: 퍼셉트론 [A]설정/[B]데이터, 인용 [A]/[B])
        //   그 라벨은 보기에서 시각 확인됨 → 지문 bracket 불요, FP 차단. (r20169g·r20176a 실증)
        for (const q of set.questions || []) {
          if (!q.bogi) continue;
          const bstr =
            typeof q.bogi === "string" ? q.bogi : JSON.stringify(q.bogi);
          const bm = bstr.match(/\[[A-F]\]/g);
          if (bm) bm.forEach((b) => bracketAvail.add(b));
        }
        // visual_marks.json의 bracket/inline_label도 정박 소스 (정본 bracket 정의)
        if (!globalThis.__vmMap) {
          const vm = {};
          try {
            const vmJson = JSON.parse(
              fs.readFileSync(
                path.resolve(__dirname, "../public/data/visual_marks.json"),
                "utf8",
              ),
            );
            for (const m of vmJson.marks || []) {
              if (!m.label) continue;
              const key = (m.yearKey || "") + "::" + (m.setId || "");
              (vm[key] ||= new Set()).add(`[${m.label}]`);
            }
          } catch {
            /* visual_marks 없으면 무시 */
          }
          globalThis.__vmMap = vm;
        }
        const vmLabels = globalThis.__vmMap[yearKey + "::" + set.id];
        if (vmLabels) for (const b of vmLabels) bracketAvail.add(b);
        // referenced: 발문 + 선지만 (보기 제외 — 보기 내부 ⓐ~ⓔ 라벨은 지문 마커 아님, FP 차단)
        const refMk = new Set();
        const refBr = new Set();
        for (const q of set.questions || []) {
          let txt = q.t || "";
          for (const c of q.choices || []) txt += c.t || "";
          for (const ch of txt) if (mkSet.has(ch)) refMk.add(ch);
          const bm = txt.match(/\[[A-F]\]/g);
          if (bm) bm.forEach((b) => refBr.add(b));
        }
        // [refine] 발문이 "<보기>의/학습 활동의 [마커(범위)]"로 마커를 보기·학습활동
        //   라벨로 선언하면 그 마커는 지문 마커가 아님 → credit(제외). 보기/학습활동
        //   본문 누락은 MARKER_INTEGRITY가 아니라 별도 보기 복원 트랙 소관. (FP 영구 차단)
        const bogiLabelMk = new Set();
        for (const q of set.questions || []) {
          const stem = q.t || "";
          const declRe = /(?:보기[^가-힣]{0,3}의|학습\s*활동의)/g;
          let dm;
          while ((dm = declRe.exec(stem))) {
            const tail = stem.slice(
              dm.index + dm[0].length,
              dm.index + dm[0].length + 8,
            );
            const found = [...tail].filter((ch) => mkSet.has(ch));
            if (found.length === 0) continue;
            if (found.length >= 2 && /[~∼～]/.test(tail)) {
              // 범위 선언(예: ㉮~㉲ / ⓐ~ⓔ) → 양 끝 사이 전개
              const a = found[0].codePointAt(0);
              const b = found[found.length - 1].codePointAt(0);
              if (b > a && b - a < 30)
                for (let cp = a; cp <= b; cp++)
                  bogiLabelMk.add(String.fromCodePoint(cp));
              else found.forEach((c) => bogiLabelMk.add(c));
            } else {
              found.forEach((c) => bogiLabelMk.add(c));
            }
          }
        }
        // [refine 2] <보기> 학생 감상/이해 enumeration 라벨 credit:
        //   발문이 "학생[들] …감상/이해한 내용…이다. [마커]~[마커] 중" 문맥이면 그 범위
        //   마커(ⓐ~ⓔ 등)는 감상 선지 enumeration 라벨 = 지문 형광펜 대상 아님 → credit.
        //   가드: stem에 '학생…감상/이해' 문맥 필수 → 일반 지문 마커 문항(㉠~㉤ 정박형)은
        //   절대 credit 안 함(FP만 차단, 진짜 마커 누락 은폐 방지). (l20196b Q31 실증)
        for (const q of set.questions || []) {
          const stem = q.t || "";
          if (!/학생[들]?[^.]{0,40}(감상|이해)/.test(stem)) continue;
          const enumRe = /([㉠-㉿ⓐ-ⓩ])\s*[~∼～]\s*([㉠-㉿ⓐ-ⓩ])\s*중/g;
          let em;
          while ((em = enumRe.exec(stem))) {
            const a = em[1].codePointAt(0);
            const b = em[2].codePointAt(0);
            if (b > a && b - a < 30)
              for (let cp = a; cp <= b; cp++)
                bogiLabelMk.add(String.fromCodePoint(cp));
          }
        }
        for (const m of refMk) {
          if (!avail.has(m) && !bogiLabelMk.has(m))
            issue(
              "MARKER_INTEGRITY_FAIL",
              yearKey,
              `${set.id} ${m}`,
              `문항/선지 참조 마커 ${m}이 지문/annotation에 부재 (형광펜 정박 불가)`,
              "fatal",
            );
        }
        if (!hasBracketAnn) {
          for (const b of refBr) {
            if (!bracketAvail.has(b))
              issue(
                "MARKER_INTEGRITY_FAIL",
                yearKey,
                `${set.id} ${b}`,
                `문항/선지 참조 ${b}이 지문/bracket annotation에 부재`,
                "fatal",
              );
          }
        }
      }

      // ── [Gate] W_annotation_stale / W_bracket_collapse — annotation 무결성 ──
      //   핵심 차별점(선지↔지문 형광펜) 렌더 정합. 자동 stale-스캔이 못 잡는
      //   "존재하나 틀린" bracket collapse 축까지 색출(l2024c류: [B][C]가 동일
      //   초대형 sent에 겹침). W_annotation_stale = text ⊄ sent.t / bracket
      //   sentFrom·To 부재. W_bracket_collapse = 동일 sentId 2+ bracket /
      //   초대형 단일 sent bracket(>임계). LIVE 렌더 결함 재발 차단.
      {
        const annList2 =
          ((globalThis.__annAll || {})[yearKey] || {})[set.id] || [];
        if (annList2.length) {
          const sm = {};
          for (const s of set.sents || []) sm[s.id] = s.t;
          const OVERSIZE_LEN = 300; // 단일 sent bracket 초대형 임계(측정: 실결함 427~673)
          const live = LIVE_KEYS_SET.has(yearKey + "::" + set.id);
          // W_annotation_stale
          for (const o of annList2) {
            if (o.type === "bracket") {
              if (!sm[o.sentFrom] || !sm[o.sentTo]) {
                issue(
                  "W_annotation_stale",
                  yearKey,
                  set.id,
                  `bracket [${o.label}] sentFrom/To 부재(${o.sentFrom}~${o.sentTo})`,
                );
                annStaleCands.push({
                  yearKey,
                  setId: set.id,
                  type: "bracket",
                  label: o.label,
                  ref: `${o.sentFrom}~${o.sentTo}`,
                  reason: "sentId 부재",
                  live,
                });
              }
            } else if (o.text && o.sentId) {
              if (!sm[o.sentId] || !sm[o.sentId].includes(o.text)) {
                issue(
                  "W_annotation_stale",
                  yearKey,
                  set.id,
                  `${o.type} text ⊄ sent.t(${o.sentId}): "${String(o.text).slice(0, 20)}"`,
                );
                annStaleCands.push({
                  yearKey,
                  setId: set.id,
                  type: o.type,
                  ref: o.sentId,
                  text: String(o.text).slice(0, 40),
                  reason: !sm[o.sentId] ? "sentId 부재" : "text≠sent",
                  live,
                });
              }
            } else if (
              o.text &&
              !o.sentId &&
              (o.target === "bogi" || o.target === "choice") &&
              o.qId != null
            ) {
              // sentId 없는 bogi/choice annotation: qId/cNum → choice.t/bogi 대조
              //   (QuizPanel 선지 밑줄·보기 마커 렌더 정합 — passage 형광펜과 별 축)
              const q = (set.questions || []).find(
                (x) => String(x.id) === String(o.qId),
              );
              if (q) {
                let pool = "";
                if (o.cNum != null) {
                  const c = (q.choices || []).find(
                    (x) => String(x.num) === String(o.cNum),
                  );
                  pool = c ? c.t : "";
                } else {
                  pool =
                    typeof q.bogi === "string"
                      ? q.bogi
                      : JSON.stringify(q.bogi || "");
                }
                if (pool && !pool.includes(o.text)) {
                  issue(
                    "W_choice_anno_stale",
                    yearKey,
                    set.id,
                    `${o.type} text ⊄ ${o.cNum != null ? "choice " + o.cNum : "bogi"}(q${o.qId}): "${String(o.text).slice(0, 20)}"`,
                  );
                  annStaleCands.push({
                    yearKey,
                    setId: set.id,
                    type: o.type,
                    ref: `q${o.qId}${o.cNum != null ? "c" + o.cNum : "/bogi"}`,
                    text: String(o.text).slice(0, 40),
                    reason: "choice/bogi text≠",
                    live,
                  });
                }
              }
            }
          }
          // W_bracket_collapse: 동일 sentId 2+ bracket
          const brByRange = {};
          for (const o of annList2)
            if (o.type === "bracket") {
              const k = `${o.sentFrom}→${o.sentTo}`;
              (brByRange[k] = brByRange[k] || []).push(o.label);
            }
          for (const k in brByRange)
            if (brByRange[k].length >= 2) {
              issue(
                "W_bracket_collapse",
                yearKey,
                set.id,
                `동일 구간 ${k}에 bracket ${brByRange[k].length}개 겹침[${brByRange[k].join(",")}] = 서로 다른 구간이 한 sent에 collapse`,
              );
              bracketCollapseCands.push({
                yearKey,
                setId: set.id,
                range: k,
                labels: brByRange[k],
                kind: "overlap",
                live,
              });
            }
          // W_bracket_collapse: 초대형 단일 sent bracket
          for (const o of annList2)
            if (
              o.type === "bracket" &&
              o.sentFrom === o.sentTo &&
              sm[o.sentFrom] &&
              sm[o.sentFrom].length > OVERSIZE_LEN
            ) {
              issue(
                "W_bracket_collapse",
                yearKey,
                set.id,
                `bracket [${o.label}]=${o.sentFrom} 초대형 sent(${sm[o.sentFrom].length}자>${OVERSIZE_LEN}) = 구간 과다(narration 혼입 의심)`,
              );
              bracketCollapseCands.push({
                yearKey,
                setId: set.id,
                range: o.sentFrom,
                labels: [o.label],
                kind: "oversize",
                len: sm[o.sentFrom].length,
                live,
              });
            }
        }
      }

      // ── [Gate] BOGI_IMAGE_MISSING — 보기 이미지 파일 실존 검사 ──────────────
      //   [그림src:/images/…] 또는 bogi.image.url / bogi.images[]가 가리키는 파일이
      //   public/ 아래 실재하는지. 누락 시 학생이 보기(도식/그림)를 못 봐 답 불가.
      //   answer/structure/passage 게이트가 못 잡는 사각(파일 존재는 별 차원).
      {
        const imgPaths = new Set();
        const collectImg = (str) => {
          if (typeof str !== "string") return;
          const re = /\[그림src:([^\]]+)\]/g;
          let m;
          while ((m = re.exec(str))) imgPaths.add(m[1].trim());
        };
        for (const s of set.sents || []) collectImg(s.t);
        for (const q of set.questions || []) {
          if (typeof q.bogi === "string") collectImg(q.bogi);
          else if (q.bogi && typeof q.bogi === "object") {
            collectImg(JSON.stringify(q.bogi));
            const img = q.bogi.image;
            if (typeof img === "string") imgPaths.add(img);
            else if (img && typeof img === "object" && img.url)
              imgPaths.add(img.url);
            if (Array.isArray(q.bogi.images))
              for (const im of q.bogi.images) {
                if (typeof im === "string") imgPaths.add(im);
                else if (im && im.url) imgPaths.add(im.url);
              }
          }
          for (const c of q.choices || []) collectImg(c.t);
        }
        const PUBLIC_DIR = path.resolve(__dirname, "../public");
        for (const ip of imgPaths) {
          const rel = String(ip).replace(/^[\\/]/, "");
          if (!rel.startsWith("images/")) continue; // 자산 경로만 검사
          if (!fs.existsSync(path.join(PUBLIC_DIR, rel)))
            issue(
              "BOGI_IMAGE_MISSING",
              yearKey,
              `${set.id}`,
              `보기 이미지 파일 부재: ${ip} (학생이 보기 못 봄 = 문항 답 불가)`,
              "fatal",
            );
        }
      }

      // ── W_bracket_integrity: 출전행(author) 작품명 낫표 충실도 ──
      //   검출 ① corrupt('X」·홑겹혼용·한쪽만) ② halfwidth(｢｣) ③ stray('+낫표없음) ④ bare(작품명 무낫표 후보)
      //   제외: author_only(작가만)·genre 라벨·(analysis 『책이름』은 author sent 아니라 미해당)
      //   severity=WARNING(고순위, W_csspan 동일 논리 — 비본문·오독무영향, 출시 baseline 불변)
      {
        const GENRE =
          /사설시조|시조|가사|민요|한시|판소리|잡가|향가|경기체가|악장|창가|고려가요|악부|타령/;
        for (const x of set.sents || []) {
          const t = x.t || "";
          // 출전 포맷 라인: -/–/－ 로 시작·끝 + 짧고(≤70) 콤마(작가,작품) 또는 단독 작가명
          //   sentType==author 단독 의존 사각 보완(workTag/body 오태깅 검출).
          const isSourceFmt =
            /^\s*[-–－]\s*.{1,70}?\s*[-–－]\s*$/.test(t) &&
            (/[,，]/.test(t) ||
              /^\s*[-–－]\s*[가-힣][가-힣\s]{1,14}\s*[-–－]\s*$/.test(t));
          if (x.sentType !== "author" && !isSourceFmt) continue;
          const loc = `${set.id} ${x.id}`;
          const push = (kind, msg) => {
            issue("W_bracket_integrity", yearKey, loc, `[${kind}] ${msg}`);
            bracketIntegrityCands.push({
              yearKey,
              setId: set.id,
              sentId: x.id,
              kind,
              t: t.slice(0, 60),
              live: LIVE_KEYS_SET.has(yearKey + "::" + set.id),
            });
          };
          // 출전 포맷인데 non-author sentType = 오태깅(workTag→굵은 헤더 오렌더). 낫표와 별개 flag.
          if (x.sentType !== "author") {
            push(
              "sentType_mismatch",
              `출전 포맷인데 sentType=${x.sentType} (author 아님): "${t.slice(0, 40)}"`,
            );
          }
          if (/[｢｣]/.test(t)) {
            push("halfwidth", `반각 낫표 ｢｣ 사용: "${t.slice(0, 40)}"`);
            continue;
          }
          const o1 = (t.match(/「/g) || []).length;
          const c1 = (t.match(/」/g) || []).length;
          const o2 = (t.match(/『/g) || []).length;
          const c2 = (t.match(/』/g) || []).length;
          const hasBrk = o1 + c1 + o2 + c2 > 0;
          if (hasBrk) {
            if (
              o1 !== c1 ||
              o2 !== c2 ||
              /「[^」『』]*』/.test(t) ||
              /『[^』「」]*」/.test(t)
            )
              push("corrupt", `낫표 불균형/혼용: "${t.slice(0, 40)}"`);
            continue;
          }
          // 낫표 전무 → stray(따옴표 래핑) 또는 bare 후보
          if (/,\s*['‘’＇]/.test(t)) {
            push("stray", `따옴표 래핑(낫표 아님): "${t.slice(0, 40)}"`);
            continue;
          }
          // bare 후보: "- 작가, 작품 -" 형태 (콤마 뒤 비-genre 제목)
          const inner = t.replace(/^\s*[-–]\s*/, "").replace(/\s*[-–]\s*$/, "");
          if (inner.includes(",")) {
            const after = inner.slice(inner.indexOf(",") + 1).trim();
            if (
              after &&
              !GENRE.test(after) &&
              !/^(외|등|작자 미상)$/.test(after)
            )
              push("bare", `작품명 무낫표 후보: "${t.slice(0, 40)}"`);
          }
        }
      }

      // ── [발주1 1-C] FOOTNOTE_MARKER_INTEGRITY: 각주 정의어 X의 본문 각주표시(*) 대칭 ──
      //   footnote sent가 "*X: 정의" 형태로 정의한 용어 X에 대해, 본문(비-footnote)에
      //   X는 있으나 X*(각주표시)가 없으면 = 각주표시 누락 (l2024b 정밀*·도반* class, 4회 반복 결함).
      {
        const _footSents = (set.sents || []).filter(
          (s) => s.sentType === "footnote",
        );
        const _bodyText = (set.sents || [])
          .filter(
            (s) =>
              s.sentType &&
              !["footnote", "author", "workTag", "omission"].includes(
                s.sentType,
              ),
          )
          .map((s) => s.t || "")
          .join("\n");
        const _defined = new Set();
        for (const fsent of _footSents) {
          for (const m of (fsent.t || "").matchAll(
            /\*\s*([^\s:：*][^:：*]{0,18}?)\s*[:：]/g,
          )) {
            const term = (m[1] || "").trim();
            if (term.length >= 2) _defined.add(term);
          }
        }
        for (const term of _defined) {
          if (!_bodyText.includes(term)) continue; // 본문에 X 없음 → 미해당
          if (_bodyText.includes(term + "*")) continue; // X* 존재 → 정상
          issue(
            "FOOTNOTE_MARKER_INTEGRITY",
            yearKey,
            `${set.id} [${term}]`,
            `각주 정의어 '${term}' 본문 각주표시(*) 누락`,
          );
          footnoteMarkerCands.push({
            yearKey,
            setId: set.id,
            term,
            live: LIVE_KEYS_SET.has(yearKey + "::" + set.id),
          });
        }
      }

      // ── [발주6-D] F_encoding_corruption: U+FFFD(멀티바이트 손상) 전 텍스트 필드 검출 ──
      //   'git show|node' stdin 청크분할 손상(d85b6c4 인시던트) 재발·잠복 차단. §13⑪.
      {
        const scanFFFD = (txt, loc, field) => {
          if (typeof txt !== "string" || !txt.includes("�")) return;
          const i = txt.indexOf("�");
          issue(
            "F_encoding_corruption",
            yearKey,
            loc,
            `U+FFFD 인코딩 손상 [${field}] "…${txt.slice(Math.max(0, i - 12), i + 3)}…"`,
          );
        };
        scanFFFD(set.title, `${set.id}`, "title");
        for (const s of set.sents || [])
          scanFFFD(s.t, `${set.id} ${s.id}`, "sent.t");
        for (const q of set.questions || []) {
          scanFFFD(q.t, `${set.id} Q${q.id}`, "q.t");
          if (q.bogi)
            scanFFFD(
              typeof q.bogi === "string" ? q.bogi : JSON.stringify(q.bogi),
              `${set.id} Q${q.id}`,
              "bogi",
            );
          for (const c of q.choices || []) {
            scanFFFD(c.t, `${set.id} Q${q.id}-[${c.num}]`, "choice.t");
            scanFFFD(c.analysis, `${set.id} Q${q.id}-[${c.num}]`, "analysis");
          }
        }
      }

      // ── F_zerowidth_corruption: 제로폭/비가시 문자 검출 (F_encoding_corruption 자매) ──
      //   ZWSP(U+200B)·ZWNJ(U+200C)·ZWJ(U+200D)·BOM(U+FEFF)·SHY(U+00AD)·WJ(U+2060).
      //   PDF/추출 artifact가 단어 내 삽입되면 형광펜 indexOf·검색·verbatim 대조 실패(비가시라 육안 미검출).
      {
        const ZW = {
          "​": "ZWSP",
          "‌": "ZWNJ",
          "‍": "ZWJ",
          "﻿": "BOM",
          "­": "SHY",
          "⁠": "WJ",
        };
        const ZW_RE = /[​‌‍﻿­⁠]/;
        const scanZW = (txt, loc, field) => {
          if (typeof txt !== "string") return;
          const m = txt.match(ZW_RE);
          if (!m) return;
          const i = txt.indexOf(m[0]);
          issue(
            "F_zerowidth_corruption",
            yearKey,
            loc,
            `제로폭 ${ZW[m[0]]} [${field}] "…${txt.slice(Math.max(0, i - 8), i + 8).replace(ZW_RE, "␣")}…"`,
          );
        };
        scanZW(set.title, `${set.id}`, "title");
        for (const s of set.sents || [])
          scanZW(s.t, `${set.id} ${s.id}`, "sent.t");
        for (const q of set.questions || []) {
          scanZW(q.t, `${set.id} Q${q.id}`, "q.t");
          if (q.bogi)
            scanZW(
              typeof q.bogi === "string" ? q.bogi : JSON.stringify(q.bogi),
              `${set.id} Q${q.id}`,
              "bogi",
            );
          for (const c of q.choices || []) {
            scanZW(c.t, `${set.id} Q${q.id}-[${c.num}]`, "choice.t");
            scanZW(c.analysis, `${set.id} Q${q.id}-[${c.num}]`, "analysis");
          }
        }
      }

      for (const q of set.questions) {
        // [Gate 7] --golden 지정 시 골든셋 외 스킵
        if (GOLDEN_ONLY && !goldenMatch(yearKey, set.id, q.id)) continue;
        const qLoc = `${yearKey} ${set.id} Q${q.id}`;

        // ── C_answer_derivation: 정답 유도 결과가 정확히 1개인가 ──────────
        //   src/App.jsx:1369 가 정답표 없이 ok × questionType 조합에서 정답을 유도한다.
        //     const qt = q.questionType ?? "negative";
        //     qt === "positive" ? c.ok === true : c.ok === false
        //   조합이 깨지면 화면이 틀린 정답을 표시한다.
        //   판정식은 answer_fidelity.mjs:110-112 와 동일하다 — 그 도구가 이미 잡을 수 있었으나
        //   실행되지 않아 2022수능 r2022c Q10 이 두 달간 LIVE 였다(발주 eb 실증).
        //   여기 편입하는 이유는 새 판정을 만들기 위해서가 아니라 "돌리지 않아서 놓치는 경로"를 없애기 위함이다.
        //   ★ 편입 시점 실측: 공개 241세트 0건 · 비노출 0건 (발주 ec).
        {
          const _qt = q.questionType ?? "negative";
          const _cand = (q.choices || []).filter((c) =>
            _qt === "positive" ? c.ok === true : c.ok === false,
          );
          if ((q.choices || []).length > 0 && _cand.length !== 1) {
            needsManual(
              "C_answer_derivation",
              yearKey,
              qLoc,
              `정답 유도 ${_cand.length}개 (questionType=${_qt}${_cand.length ? ", 후보 " + _cand.map((c) => c.num).join(",") : ""}) — 화면이 정답을 ${_cand.length === 0 ? "표시하지 못함" : _cand.length + "개 표시"}`,
            );
          }
        }

        // ── [발주 ef 사양2] 해설 반전 축 2종 ─────────────────────────────
        //   결함의 성격: 정답 번호는 맞는데 해설 문장이 역할을 뒤바꿔 설명한다.
        //   실증 — 2016_9월A l20169a Q21 ③(오답)이 "이 문항에서 적절한 선지"로 끝나
        //   학생이 ③을 정답으로 읽었다(발주 ee-2). answer_fidelity 도 quality_gate 도
        //   수정 전에 0건이었다 — 두 도구 모두 정답 "번호"만 보기 때문이다.
        //   ★ 등급 WARNING 고정. CRITICAL 승격 금지(발주 ef) — 편입 시점 LIVE 0건.
        //   ★ 비노출 세트를 RELEASE_KEYS 에 올릴 때 이 두 축 0건을 통과 조건으로 둔다.
        {
          const _qt2 = q.questionType ?? "negative";
          const _isAns = (c) => (_qt2 === "positive" ? c.ok === true : c.ok === false);
          for (const c of q.choices || []) {
            const _a = String(c.analysis || "");
            if (!_a) continue;
            const cLoc = `${yearKey} ${set.id} Q${q.id}-[${c.num}]`;
            if (!_isAns(c)) {
              // 축 A — 정답 유도에서 탈락한 선지(오답)가 자신을 정답처럼 설명
              const m = _a.match(ANSWER_ROLE_A_RE);
              if (m)
                issue(
                  "F_distractor_reads_as_answer",
                  yearKey,
                  cLoc,
                  `오답 선지 해설에 정답 어투 «${m[0]}» — 학생이 이 선지를 정답으로 읽는다`,
                  "warn",
                );
            } else {
              // 축 B — 정답으로 유도된 선지가 자신을 오답처럼(부정 어투로) 설명
              const m = _a.match(ANSWER_ROLE_B_RE);
              if (m)
                issue(
                  "F_answer_reads_as_distractor",
                  yearKey,
                  cLoc,
                  `정답 선지 해설에 오답 어투 «${m[0]}» — 정답 근거가 부정형으로 흐려진다`,
                  "warn",
                );
            }
          }
        }

        // ── A: q.t 보기 혼재 ──────────────────────────────────────────────
        const beforeT = q.t || "";
        if (FIX) splitBogiFromQt(q);
        if ((q.t || "").length < beforeT.length) {
          fixed("A_bogi_split", yearKey, qLoc, `q.t에서 보기 분리`);
        }

        // ── B: questionType 누락 ──────────────────────────────────────────
        if (!q.questionType || q.questionType === "N/A") {
          const detected = detectQuestionType(q.t);
          issue(
            "B_qt_missing",
            yearKey,
            qLoc,
            `questionType 없음 → 감지: ${detected}`,
          );
          if (FIX) {
            q.questionType = detected;
            fixed("B_qt_set", yearKey, qLoc, `questionType → ${detected}`);
          }
        }

        for (const c of q.choices) {
          const cLoc = `${qLoc}-[${c.num}]`;

          // ── [Gate 5 승격] C_vpat_dirty 전수 축 (choice 루프 최상단·무조건) ──
          //   판정식(§13⑮): pat=='V' && (cs_ids.length + cs_spans.length > 0) → CRITICAL.
          //   cs_ids 단독은 결함 클래스보다 좁아 거짓0(cs_spans도 _buildSentCs로 형광펜 렌더).
          //   발문 매처(isVocab) 무관. (구 [Gate 5]는 nested 가드 dead — 본 축이 정본.)
          if (
            c.pat === "V" &&
            (c.cs_ids?.length || 0) + (c.cs_spans?.length || 0) > 0
          ) {
            if (FIX) {
              c.cs_ids = [];
              if (c.cs_spans) delete c.cs_spans;
              fixed(
                "C_vpat_dirty_fixed",
                yearKey,
                cLoc,
                `V pat 정합 — cs_ids/cs_spans 비움`,
              );
            } else {
              issue(
                "C_vpat_dirty",
                yearKey,
                cLoc,
                `pat=V인데 cs_ids=${(c.cs_ids || []).length}/cs_spans=${(c.cs_spans || []).length}건`,
              );
            }
          }

          // ── C: 선지 오염 텍스트 ────────────────────────────────────────
          const before = c.t || "";
          const wasCleaned = cleanChoiceText(c);
          if (wasCleaned) {
            issue(
              "C_choice_pollution",
              yearKey,
              cLoc,
              `선지 오염: "${before.slice(-30)}"`,
            );
            if (!FIX) {
              c.t = before;
            } else {
              fixed("C_cleaned", yearKey, cLoc, "오염 제거");
            }
          }

          // ── C-2: 선지 내용 없음 ────────────────────────────────────────
          if (isEmptyChoice(c)) {
            needsManual(
              "C_empty_choice",
              yearKey,
              cLoc,
              "선지 내용 없음 (표 파싱 실패) → 수동 입력 필요",
            );
          }

          // ── D: ok:true + pat 있음 ──────────────────────────────────────
          if (c.ok === true && c.pat !== null && c.pat !== undefined) {
            issue("D_true_has_pat", yearKey, cLoc, `ok:true인데 pat:${c.pat}`);
            if (FIX) {
              c.pat = null;
              fixed("D_pat_null", yearKey, cLoc, "pat → null");
            }
          }

          // ── E: ok:false + pat 없음/0 ───────────────────────────────────
          if (c.ok === false && (!c.pat || c.pat === "0" || c.pat === 0)) {
            const detected = detectPatFromAnalysis(c.analysis || "", sec);
            if (detected) {
              issue("E_pat_zero", yearKey, cLoc, `pat:0 → 감지: ${detected}`);
              if (FIX) {
                c.pat = detected;
                fixed("E_pat_classified", yearKey, cLoc, `pat → ${detected}`);
              }
            } else {
              needsManual(
                "E_pat_unclassifiable",
                yearKey,
                cLoc,
                "pat 분류 불가 → 수동 확인",
              );
            }
          }

          // ── F: analysis 결론 vs ok 불일치 ─────────────────────────────
          const ana = c.analysis || "";
          const hasOkMark = ana.includes("✅");
          const hasFailMark = ana.includes("❌");
          const conclusionMismatch =
            (c.ok === true && hasFailMark && !hasOkMark) ||
            (c.ok === false && hasOkMark && !hasFailMark);

          if (conclusionMismatch) {
            issue(
              "F_conclusion_mismatch",
              yearKey,
              cLoc,
              `ok:${c.ok} ↔ analysis 결론 불일치`,
            );
            if (FIX) {
              c.analysis = fixAnalysisConclusion(ana, c.ok);
              fixed("F_conclusion_fixed", yearKey, cLoc, "결론 줄 수정");
            }
          }

          // ── F-2: analysis 반전 (결론 이모지 기준, isReversed와 동기화) ─
          // 마지막 ✅/❌ 이모지가 ok 값과 일치하는지 검사
          // - ok:true + 결론 ❌ → reversed
          // - ok:false + 결론 ✅ → reversed
          // - 결론 이모지 없음 → reversed (포맷 파손)
          // §13⑤ 정밀화: 판정 기준 = 결론줄(라인) 단위.
          //   결론줄 = ✅/❌를 포함하는 마지막 줄. 그 줄의 시작 이모지(맨 앞 ✅/❌)가
          //   c.ok와 불일치하면 reversed. 본문 중간이 ✅·❌ 양쪽을 언급해도 결론줄만 보므로 오탐 방지.
          //   결론줄 자체가 없으면 reversed(포맷 파손).
          let contentReversed = false;
          if (!ana.trim()) {
            // 빈 analysis는 F_empty_analysis로 별도 처리
          } else {
            const lines = ana.split(/\r?\n/);
            let conclLine = null;
            for (let i = lines.length - 1; i >= 0; i--) {
              if (lines[i].includes("✅") || lines[i].includes("❌")) {
                conclLine = lines[i];
                break;
              }
            }
            if (conclLine === null) {
              contentReversed = true; // 결론줄 없음 = 포맷 파손
            } else {
              // 결론줄 맨 앞 이모지 = ✅/❌ 첫 출현
              const iOk = conclLine.indexOf("✅");
              const iNg = conclLine.indexOf("❌");
              const firstEmoji =
                iOk < 0 ? "❌" : iNg < 0 ? "✅" : iOk < iNg ? "✅" : "❌";
              if (c.ok === true && firstEmoji === "❌") contentReversed = true;
              if (c.ok === false && firstEmoji === "✅") contentReversed = true;
            }
          }

          // ⚠ 억제 제거 (2026-07-22) — 직전까지 `&& !conclusionMismatch` 조건이 붙어 있었다.
          //   F_content_reversed는 CRITICAL(§13⑤ 출시 차단축)이고 F_conclusion_mismatch는
          //   IGNORE인데, 해설에 ❌만 있고 ✅가 없으면 후자가 참이 되어 **CRITICAL이 IGNORE에
          //   흡수**됐다. 두 축을 따로 보면 각각 정상이라 발견이 늦었다(14건 은폐, LIVE 1건 =
          //   2026_6월 l20266a Q20③이 정답 반대로 노출 중이었음).
          //   원칙(§13⑮): CRITICAL 축은 다른 축으로 억제하지 않는다. 축별 독립 카운트.
          if (contentReversed) {
            needsManual(
              "F_content_reversed",
              yearKey,
              cLoc,
              "결론 이모지(✅/❌) vs ok 불일치 → reanalyze 필요",
            );
          }

          // ── [발주 ae ①] 축6 등재: 형식 결함 = 학생 화면 직접 노출 → CRITICAL ──
          //   판별식은 haesol_v2_gate.detectFormatDefect 재사용(판정 불일치 방지).
          //   ⚠ WARNING으로 낮추지 않는다 — WARNING 19축에 1,101건이 쌓여 아무도 열지
          //     않는 상태이고, 이번 마크다운 55건이 은폐된 구조가 정확히 그것이다.
          //   근거: AnalysisBlock/어휘 분기 모두 plain text 렌더(마크다운 파서 없음) →
          //     배포본 DOM에 별표가 그대로 노출됨(2022수능 r2022d Q14① 실물 확인, §13⑯).
          {
            const fmt6 = detectFormatDefect(ana);
            if (!fmt6.clean) {
              if (fmt6.patterns.includes("마크다운강조"))
                needsManual(
                  "F_markdown_emphasis_exposed",
                  yearKey,
                  cLoc,
                  "마크다운 강조(**/__)가 학생 화면에 별표째 노출",
                );
              if (fmt6.patterns.includes("마커단독"))
                needsManual(
                  "F_conclusion_marker_only",
                  yearKey,
                  cLoc,
                  "결론줄이 마커 한 글자 — 결론 문장 부재",
                );
            }
          }

          // ── [발주 ae ②] ok:false + pat:null — QG 사각(역방향) 등재 ──
          //   D_true_has_pat 은 ok:true+pat 만 본다. 반대 방향은 어느 축도 보지 않았다.
          //   ⚠ 잠정 WARNING — 등급은 렌더 확인 결과를 보고 심사관이 지정한다.
          if (c.ok === false && c.pat == null)
            needsManual(
              "D_false_no_pat",
              yearKey,
              cLoc,
              "ok:false 인데 pat 없음 (D_true_has_pat 역방향 사각)",
            );

          // ── C_anchor_exact_fail (§13⑥, 정밀화 v2): 📌 지문 근거 단어내 공백 artifact 한정 CRITICAL ──
          //   1차 대상은 "지문 근거"만(보기 근거는 후속). exact 판정은 raw String.includes.
          //   분류: (a)cs_ids/다문장-연결 exact → 정상  (b)말줄임표 → 비연속(정상)
          //         (c)단일 sent noSpace 매칭 안 됨 → 다문장 boundary(정상, 미flag)
          //         (d)verse sent 또는 region에 줄바꿈 → 운문 \n↔공백(정상, 미flag)
          //         (e)마커(ⓐ-ⓩ㉠-㉭) 인접 공백차 → C_anchor_marker_space (WARNING 강등)
          //         (f)순수 단어내 공백 artifact(l2022b류) → C_anchor_exact_fail (CRITICAL, sent.t 교정)
          if (ana && ana.includes("지문 근거")) {
            const csJoin = (c.cs_ids || [])
              .map((id) => (set.sents || []).find((s) => s.id === id))
              .filter(Boolean)
              .map((s) => s.t || "")
              .join(" ");
            const setJoin = (set.sents || []).map((s) => s.t || "").join(" ");
            const noSpace = (x) => x.replace(/\s/g, "");
            const MARKER_RE = /[ⓐ-ⓩ㉠-㉭]/;
            for (const line of ana.split(/\r?\n/)) {
              if (!line.includes("📌") || !line.includes("지문 근거")) continue;
              if (line.includes("보기 근거")) continue; // 1차: 지문 근거만
              const quotes = [
                ...line.matchAll(
                  /"([^"]{4,})"|“([^”]{4,})”|'([^']{4,})'|‘([^’]{4,})’/g,
                ),
              ]
                .map((m) => m[1] || m[2] || m[3] || m[4] || "")
                .filter(Boolean);
              for (const q of quotes) {
                if (csJoin.includes(q) || setJoin.includes(q)) continue; // (a) raw exact
                if (/…|\.{2,}/.test(q)) continue; // (b) 말줄임표
                const nq = noSpace(q);
                // (c) 단일 sent noSpace 매칭 (없으면 다문장 boundary → 정상)
                const ms = (set.sents || []).find((s) =>
                  noSpace(s.t || "").includes(nq),
                );
                if (!ms) continue;
                // region 복원 (noSpace 인덱스→raw)
                const st = ms.t || "";
                const map = [];
                for (let k = 0; k < st.length; k++)
                  if (!/\s/.test(st[k])) map.push(k);
                const at = noSpace(st).indexOf(nq);
                const region = st.slice(map[at], map[at + nq.length - 1] + 1);
                if (region === q) continue; // exact (도달 안 함)
                // (d) verse / 줄바꿈 → 운문 정상
                if (ms.sentType === "verse" || region.includes("\n")) continue;
                // (e) 마커 인접 공백차 → WARNING 강등
                if (MARKER_RE.test(region) || MARKER_RE.test(q)) {
                  issue(
                    "C_anchor_marker_space",
                    yearKey,
                    cLoc,
                    `📌 지문 근거 "${q.slice(0, 24)}…" 마커 인접 공백차 (관례·검수)`,
                  );
                  continue;
                }
                // (f) 순수 단어내 공백 artifact → CRITICAL
                needsManual(
                  "C_anchor_exact_fail",
                  yearKey,
                  cLoc,
                  `📌 지문 근거 "${q.slice(0, 24)}…" 단어내 공백 artifact (${ms.id} sent.t 교정 대상)`,
                );
              }
            }
          }

          // ── W_bogi_anchor (§13⑥ 보기 확장) — 📌 보기 근거 ⊆ q.bogi exact substring ──
          //   C_anchor는 지문 근거만 검사(보기 사각). 보기 인용도 verbatim 대상(§7).
          //   대상 라인: "· 보기 \"…\"" (새 대조 포맷) / "📌 보기 근거: \"…\"" (구 포맷).
          //   지문 라인·🎯 요약의 '…'(홑따옴표 풀이) 제외. 정규화 금지(exact). bogiTable(비-string) 제외.
          if (ana && typeof q.bogi === "string" && q.bogi.trim()) {
            const bogi = q.bogi;
            // bogiTable 제외(발주): 마크다운 표(--- 구분행/| 다수)·bogiType=table은
            //   셀 재구성 인용이 선형 substring 매칭 안 됨 → 별 축(표 정합).
            const isTable =
              q.bogiType === "table" ||
              (bogi.match(/\|/g) || []).length >= 3 ||
              /(^|\n)\s*-{2,}\s*\|/.test(bogi);
            for (const line of isTable ? [] : ana.split(/\r?\n/)) {
              // 보기 근거 라인만: 보기 바로 뒤 겹따옴표, 또는 📌 보기 근거:
              const isBogiLine =
                /(^|\s)보기\s*"/.test(line) || /📌\s*보기 근거/.test(line);
              if (!isBogiLine) continue;
              if (line.includes("지문")) continue; // 혼합 라인 방어
              const quotes = [...line.matchAll(/"([^"]{12,})"|“([^”]{12,})”/g)]
                .map((m) => m[1] || m[2] || "")
                .filter(Boolean);
              for (const qt of quotes) {
                if (bogi.includes(qt)) continue; // exact substring
                if (/…|\.{2,}/.test(qt)) continue; // 말줄임표(다구간)는 별 축
                issue(
                  "W_bogi_anchor",
                  yearKey,
                  cLoc,
                  `📌 보기 근거 "${qt.slice(0, 24)}…" ⊄ q.bogi (exact substring 실패)`,
                );
                bogiAnchorCands.push({
                  yearKey,
                  setId: set.id,
                  qId: q.id,
                  choice: c.num,
                  text: qt.slice(0, 60),
                  live: LIVE_KEYS_SET.has(yearKey + "::" + set.id),
                });
              }
            }
          }

          // ── W_analysis_marker_mismatch — 해설 마커 ⊄ (문항+지문+보기 ∪ 선지) ──
          //   선지 analysis가 인용/언급한 마커(㉠·ⓐ·①·[A])가 문항 문맥 어디에도
          //   없으면 = 존재하지 않는 마커 참조(오해설/오앵커). 선지 번호 ①~N은
          //   '선지 마커'로 available. annotation 마커도 포함.
          if (ana && ana.trim()) {
            const MRK = /[㉠-㉿①-⑳Ⓐ-ⓩ]|\[[A-F]\]/g;
            const mk = (str) => String(str || "").match(MRK) || [];
            const avail = new Set();
            for (const src of [
              q.t,
              typeof q.bogi === "string"
                ? q.bogi
                : JSON.stringify(q.bogi || ""),
            ])
              for (const m of mk(src)) avail.add(m);
            for (const sn of set.sents || [])
              for (const m of mk(sn.t)) avail.add(m);
            for (const ch of q.choices || [])
              for (const m of mk(ch.t)) avail.add(m);
            const CIRC = "①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮";
            for (let k = 0; k < (q.choices || []).length; k++)
              avail.add(CIRC[k]);
            const annL =
              ((globalThis.__annAll || {})[yearKey] || {})[set.id] || [];
            for (const o of annL) {
              if (o.marker) for (const m of mk(o.marker)) avail.add(m);
              if (o.text) for (const m of mk(o.text)) avail.add(m);
              if (o.label && /^[A-F]$/.test(o.label)) avail.add(`[${o.label}]`);
            }
            const bad = [...new Set(mk(ana))].filter((x) => !avail.has(x));
            if (bad.length) {
              issue(
                "W_analysis_marker_mismatch",
                yearKey,
                cLoc,
                `해설 마커 [${bad.join(",")}] 문항 문맥에 부재 (존재하지 않는 마커 참조)`,
              );
              analysisMarkerCands.push({
                yearKey,
                setId: set.id,
                qId: q.id,
                choice: c.num,
                markers: bad,
                live: LIVE_KEYS_SET.has(yearKey + "::" + set.id),
              });
            }
          }

          // ── rubric v1 신설 게이트 3종 (WARNING·비차단, 재정비 트리거) ──
          if (ana && ana.trim()) {
            // ── [발주1 1-D] W_struct_missing: §7 3단 구조 미달 (대표 지적, ok:true 확장) ──
            //   내용문항 해설(어휘 제외)이 §7 3단 미충족:
            //     · 🔍(풀이/선지분해) 부재 = 근거→결론 직행 (ok:true·false 공통) / 또는
            //     · ok==false인데 📌(지문 대조) 부재 = 결론 한 줄만
            //   제외(FP): pat==V 또는 [문맥 속 의미]·[치환 판단]·[호응 성분] 어휘 포맷.
            //   단 보기 문항(감상, bogi 존재)은 제외에서 빼냄.
            //   ⚠ 구조 존재만 검사 — 논리 설득력(semantic)은 자동 불가(재작성 후 표본 검수 필수).
            const _isLastQ =
              q.id === Math.max(...set.questions.map((x) => x.id));
            const _vocabKw =
              /사전적\s*의미|문맥(상|적)\s*의미|밑줄\s*친.*의미|단어의\s*뜻|바꾸?어\s*쓰기|바꿔\s*쓰기|가까운\s*의미|의미를\s*설명/.test(
                q.t || "",
              );
            const _hasBogi = !!(q.bogi && String(q.bogi).trim());
            // 어휘 명시 포맷([문맥 속 의미]·[치환 판단]·[호응 성분]) = 보기 무관 무조건 제외
            //   (다른 정상 구조라 §7 emoji 3단 미적용). 키워드-휴리스틱 vocab은 보기 없을 때만.
            const _vocabFormat =
              ana.includes("[문맥 속 의미]") ||
              ana.includes("[치환 판단]") ||
              ana.includes("[호응 성분]");
            const _vocabByKw = _isLastQ && _vocabKw && !_hasBogi;
            const _structFail =
              c.pat !== "V" &&
              !_vocabFormat &&
              !_vocabByKw &&
              (!ana.includes("🔍") || (c.ok === false && !ana.includes("📌")));
            if (_structFail) {
              issue(
                "W_struct_missing",
                yearKey,
                cLoc,
                !ana.includes("🔍")
                  ? "🔍(풀이/선지분해) 부재 = 근거→결론 직행"
                  : "ok:false 해설에 📌(지문 대조) 부재 = 결론 한 줄",
              );
              structMissingCands.push({
                yearKey,
                setId: set.id,
                qId: q.id,
                choice: c.num,
                pat: c.pat,
                ok: c.ok,
                live: LIVE_KEYS_SET.has(yearKey + "::" + set.id),
              });
            }
            // W_scratchpad_leak: LLM 스크래치패드 누출 패턴
            //   ① 한글 메타-고백  ② 영어 추론 어구  ③ 연속 영어 단어 3개+
            //   (국어 해설에 영어 추론문 = 거의 확실한 누출. 누출 스니펫을 메시지에 노출)
            const _scratchKo =
              /아 잠깐|아, 잠깐|정답 정보를|다시 보니|스크래치/;
            const _scratchEn =
              /\bI need to\b|\bI should\b|\bLet me\b|\bBased on\b|\bappears in\b|\blikely\b|\breconstruct\b|\bWait\b|\bActually\b|\bLooking at\b|\bThe answer\b/i;
            const _engRun = /[A-Za-z]{2,}(?:\s+[A-Za-z]{2,}){2,}/; // 영어 단어 3개+ 연속
            const _leak =
              ana.match(_scratchKo) ||
              ana.match(_scratchEn) ||
              ana.match(_engRun);
            if (_leak) {
              issue(
                "W_scratchpad_leak",
                yearKey,
                cLoc,
                `누출 스니펫: "${_leak[0].slice(0, 50)}"`,
              );
            }
            // W_verbose: 해설 과다(700자 초과 — 검수 트리거)
            if (ana.length > 700) {
              issue(
                "W_verbose",
                yearKey,
                cLoc,
                `analysis ${ana.length}자(>700 검수 트리거)`,
              );
            }

            // ── [발주1 1-B] F_meta_leak: 해설 메타-누출(좁은 한글 메타-고백) = 깨진 해설 CRITICAL ──
            //   정상 R3 표현("지문에 제시되지 않은 내용"·"지문에서 확인할 수 없는")과 구분되게
            //   좁은 패턴만 사용(넓은 패턴은 121건 과탐 실증). r2022d Q17 c1 class.
            // 주의: 발주 원안의 `문항\d+번은`은 정상 서술("문항 27번은 ~를 묻는다")을
            //   과탐(r20219c Q27 FP 실증) → 제거. 나머지 좁은 밑줄/확인불가 패턴만 사용.
            const META_LEAK_RE =
              /밑줄이 그어져 있지 않|밑줄 친 단어나|밑줄 친 부분이 무엇|무엇인지 확인할 수 없|확인할 수 없는 상태|제시되지 않아 확인|밑줄[^.]{0,6}표시되지 않아/;
            const _ml = ana.match(META_LEAK_RE);
            if (_ml) {
              issue(
                "F_meta_leak",
                yearKey,
                cLoc,
                `메타-누출: "${_ml[0].slice(0, 30)}"`,
              );
              metaLeakCands.push({
                yearKey,
                setId: set.id,
                qId: q.id,
                choice: c.num,
                pat: c.pat,
                live: LIVE_KEYS_SET.has(yearKey + "::" + set.id),
              });
            }

            // ── [발주1 1-A] W_csless_with_anchor: ok:false+cs_ids=[] 인데 📌 지문근거가 본문 실재 = 형광펜 누락 후보 ──
            //   마커(①㉠ⓐ)·공백·* 정규화 후 부분문자열 매칭. pat=V·보기 근거 라벨 제외.
            //   본문(비-footnote/author/workTag/omission) sent만 대상 → bogi-only 인용 자동 제외.
            if (
              c.ok === false &&
              (c.cs_ids || []).length === 0 &&
              c.pat !== "V" &&
              ana.includes("지문 근거")
            ) {
              const stripNorm = (x) => (x || "").replace(/[①-⓿㉠-㉿*\s]/g, "");
              const setNorm = (set.sents || [])
                .filter(
                  (s) =>
                    !["footnote", "author", "workTag", "omission"].includes(
                      s.sentType,
                    ),
                )
                .map((s) => stripNorm(s.t))
                .join("");
              let _hit = null;
              for (const line of ana.split(/\r?\n/)) {
                if (!line.includes("📌") || !line.includes("지문 근거"))
                  continue;
                if (line.includes("보기 근거")) continue;
                const quotes = [
                  ...line.matchAll(
                    /"([^"]{10,})"|“([^”]{10,})”|'([^']{10,})'|‘([^’]{10,})’/g,
                  ),
                ]
                  .map((m) => m[1] || m[2] || m[3] || m[4] || "")
                  .filter(Boolean);
                for (const qq of quotes) {
                  const nq = stripNorm(qq);
                  if (nq.length < 10) continue;
                  if (setNorm.includes(nq)) {
                    _hit = qq;
                    break;
                  }
                }
                if (_hit) break;
              }
              if (_hit) {
                issue(
                  "W_csless_with_anchor",
                  yearKey,
                  cLoc,
                  `cs_ids=[] 이나 📌 "${_hit.slice(0, 24)}…" 본문 실재 (형광펜 누락 후보, pat=${c.pat})`,
                );
                cslessAnchorCands.push({
                  yearKey,
                  setId: set.id,
                  qId: q.id,
                  choice: c.num,
                  pat: c.pat,
                  live: LIVE_KEYS_SET.has(yearKey + "::" + set.id),
                });
              }
            }
          }

          // ── F-3: analysis 비어있음 ─────────────────────────────────────
          if (!ana.trim()) {
            needsManual(
              "F_empty_analysis",
              yearKey,
              cLoc,
              "analysis 비어있음 → step3 재실행 필요",
            );
          }

          // ── DEAD cs_ids ────────────────────────────────────────────────
          for (const csId of c.cs_ids || []) {
            if (!validSentIds.has(csId)) {
              needsManual("DEAD_csid", yearKey, cLoc, `DEAD cs_id: ${csId}`);
            }
          }

          // ── W_csspan_stale / W_csspan_broken (B track, 발주B-2 정련) ──
          //   cs_span.text가 sent.t의 exact-substring이 아닌 경우 분류:
          //     제외 = 말줄임표 다문장(…/..) · 따옴표 정규화("↔') 매치 · verse \n↔공백 매치
          //     ▸ 공백만 다름(공백-collapse 매치) = render indexOf 실패 = 형광펜 깨짐 → W_csspan_broken(WARNING 고순위)
          //     ▸ 내용 불일치(collapse도 불일치) = 옛 형태/오앵커 → W_csspan_stale(WARNING)
          //   MARKER_INTEGRITY(마커 존재만)·C_anchor(📌만)가 못 잡는 사각(l2023a/l2024a/l2025d/l2026a 실증)
          for (const sp of c.cs_spans || []) {
            const st = (set.sents || []).find((x) => x.id === sp.sent_id);
            if (!st) continue; // dead sent_id는 별도(DEAD 계열)
            const txt = sp.text;
            if (typeof txt !== "string" || !txt) continue;
            if (st.t.includes(txt)) continue; // exact match
            if (/…|\.{2,}/.test(txt)) continue; // 제외: 말줄임표 다문장
            const qn = (x) => x.replace(/[“”„‟＂«»'‘’‚‛]/g, '"');
            if (qn(st.t).includes(qn(txt))) continue; // 제외: 따옴표 정규화 매치
            if (
              st.sentType === "verse" &&
              st.t.replace(/\s+/g, " ").includes(txt.replace(/\s+/g, " "))
            )
              continue; // 제외: verse \n↔공백
            const collapse = (x) => x.replace(/\s/g, "");
            const broken = collapse(st.t).includes(collapse(txt));
            const type = broken ? "W_csspan_broken" : "W_csspan_stale";
            issue(
              type,
              yearKey,
              cLoc,
              broken
                ? `cs_span "${txt.slice(0, 24)}…" 공백차로 형광펜 깨짐(indexOf 실패, ${sp.sent_id})`
                : `cs_span "${txt.slice(0, 24)}…" 내용 불일치(옛 형태/오앵커, ${sp.sent_id})`,
            );
            csspanStaleCands.push({
              yearKey,
              setId: set.id,
              qId: q.id,
              choice: c.num,
              sent_id: sp.sent_id,
              kind: broken ? "broken" : "stale",
              text: txt.slice(0, 60),
              live: LIVE_KEYS_SET.has(yearKey + "::" + set.id),
            });
          }

          // ── W_cs_anchor_mismatch (근거 형광펜 정합) ──
          //   해설 📌 지문 근거로 verbatim 인용된 sent가 cs_ids에 없으면 = 형광펜이 해설
          //   근거 문장을 안 칠함(근거↔형광펜 불일치). 정합 교차의 워크리스트.
          //   조건: 인용 길이≥12 + 세트 내 유니크 verbatim 매치(다중매치=모호→제외),
          //   보기 근거(📌 보기)·짧은 우연매치 제외. (LIVE 24건 실증)
          if (c.analysis && (c.cs_ids || []).length) {
            const NORMcs = (s) => (s || "").replace(/[\s·]/g, "");
            const csSet = new Set(c.cs_ids);
            const quotes = [
              ...c.analysis.matchAll(
                /📌 지문 근거:\s*((?:"[^"]+"(?:,\s*)?)+)/g,
              ),
            ].flatMap((m) => [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]));
            for (const qt of quotes) {
              if (qt.length < 12) continue;
              const hits = (set.sents || [])
                .filter((s) => NORMcs(s.t).includes(NORMcs(qt)))
                .map((s) => s.id);
              if (hits.length !== 1) continue; // 유니크 매치만
              if (!csSet.has(hits[0])) {
                issue(
                  "W_cs_anchor_mismatch",
                  yearKey,
                  cLoc,
                  `📌 근거 sent ${hits[0]}가 cs_ids(${c.cs_ids.join(",")})에 없음 = 형광펜↔해설근거 불일치: "${qt.slice(0, 20)}…"`,
                );
                csAnchorMismatchCands.push({
                  yearKey,
                  setId: set.id,
                  qId: q.id,
                  choice: c.num,
                  anchorSent: hits[0],
                  cs_ids: c.cs_ids,
                  quote: qt.slice(0, 50),
                  live: LIVE_KEYS_SET.has(yearKey + "::" + set.id),
                });
              }
            }
          }

          // ── CS_ALL_NONHIGHLIGHTABLE — cs_ids 전부 비-하이라이트 sentType → 형광펜 미렌더 ──
          //   getHL(PassagePanel)는 body/verse/stage/speech 등만 하이라이트. cs가 전부
          //   footnote/author/omission/workTag(각주/작가행/중략/「(가)」 표지)면 형광펜 0개.
          //   cs_ids 빈 경우(len=0)는 미해당(release_ready 1·4 관할).
          if (Array.isArray(c.cs_ids) && c.cs_ids.length > 0) {
            const NONHL = new Set([
              "footnote",
              "author",
              "omission",
              "workTag",
            ]);
            const csS = c.cs_ids
              .map((id) => set.sents.find((s) => s.id === id))
              .filter(Boolean);
            if (csS.length > 0 && csS.every((s) => NONHL.has(s.sentType))) {
              issue(
                "CS_ALL_NONHIGHLIGHTABLE",
                yearKey,
                cLoc,
                "cs_ids가 전부 비-하이라이트 sentType(각주/표지/중략/작가) → 형광펜 미렌더",
              );
            }
          }

          // ── H: analysis 내부 ID 노출 ────────────────────────────────────
          // [r2024cs11], r2024cs11, (as11), (as11~as15), q1_c3 등
          const ID_LEAK_RE =
            /\[[a-z_0-9]+s\d+\]|\[[a-z0-9]+_s\d+\]|\((?:as|cs|bs|ds|es)\d+(?:~(?:as|cs|bs|ds|es)\d+)?\)|q\d+_c\d+|\b[rl]\d{4}[a-z_0-9]*s\d+\b/;
          if (ana && ID_LEAK_RE.test(ana)) {
            if (FIX) {
              const cleaned = ana
                .replace(/\s*\[[a-z_0-9]+s\d+\]/g, "")
                .replace(/\s*\[[a-z0-9]+_s\d+\]/g, "")
                .replace(
                  /\s*\((?:as|cs|bs|ds|es)\d+(?:~(?:as|cs|bs|ds|es)\d+)?\)/g,
                  "",
                )
                .replace(/\s*q\d+_c\d+/g, "")
                .replace(/\s*\b[rl]\d{4}[a-z_0-9]*s\d+\b/g, "")
                .replace(/\s{2,}/g, " ")
                .replace(/ ([.,])/g, "$1")
                .trim();
              c.analysis = cleaned;
              fixed("H_id_leak_removed", yearKey, cLoc, "내부 ID 패턴 제거");
            } else {
              issue(
                "H_analysis_id_leak",
                yearKey,
                cLoc,
                "analysis에 내부 ID 노출",
              );
            }
          }

          // ── [Gate 5] 확장 CRITICAL 검사 (기본 off, --gate5로 활성화) ───
          if (GATE5) {
            const csSents = (c.cs_ids || [])
              .map((id) => set.sents.find((s) => s.id === id))
              .filter(Boolean);

            // [Tier 2] 인용표현 미반영 — 2단계 분리
            //   W_quote_unreflected (WARNING): cs_ids sent 본문에만 없음
            //   C_quote_unreflected (WARNING/승격후보): sent + cs_spans + analysis 전부 부재
            const quoteMatches = [
              ...(c.t || "").matchAll(
                /['‘]([^'’]{2,40})['’]|["“]([^"”]{2,40})["”]/g,
              ),
            ]
              .map((m) => (m[1] || m[2] || "").trim())
              .filter(Boolean);
            const norm = (s) => String(s || "").replace(/\s+/g, "");
            const joined = norm(csSents.map((s) => s.t || "").join(" "));
            const spansText = norm(
              (c.cs_spans || []).map((s) => s.text || "").join(" "),
            );
            const analysisText = norm(ana || "");
            for (const quote of quoteMatches) {
              const nq = norm(quote);
              if (nq.length < 2) continue;
              if (joined.includes(nq)) continue; // 정상 통과
              const inSpans = spansText.includes(nq);
              const inAnalysis = analysisText.includes(nq);
              if (!inSpans && !inAnalysis) {
                // triple miss → 강한 경고 (향후 승격 후보)
                issue(
                  "C_quote_unreflected",
                  yearKey,
                  cLoc,
                  `선지 인용 "${quote}"가 cs_ids sent / cs_spans / analysis 어디에도 없음`,
                );
              } else {
                issue(
                  "W_quote_unreflected",
                  yearKey,
                  cLoc,
                  `선지 인용 "${quote}"가 cs_ids sent 본문에 없음 (spans/analysis엔 존재)`,
                );
              }
              break;
            }

            // C_work_mismatch — 선지가 언급한 모든 작품 라벨의 합집합 범위 밖 cs_ids 탐지
            //   heuristic: 선지·stem 본문의 "(가)|(나)|(다)|(라)" 전부 수집 →
            //              각 라벨 범위 합집합 계산 → cs_ids가 합집합 밖이면 flag
            //   stem만 "(가)~(다)" 같은 포괄 언급이면 모든 작품 허용 → skip
            const workMarksChoice = [
              ...new Set(
                ((c.t || "").match(/\((가|나|다|라)\)/g) || []).map(
                  (s) => s[1],
                ),
              ),
            ];
            const stemIsGeneric =
              /\((가|나|다|라)\)\s*[~∼]\s*\((가|나|다|라)\)/.test(q.t || "");
            if (
              workMarksChoice.length > 0 &&
              csSents.length > 0 &&
              !stemIsGeneric
            ) {
              // workTag 경계 수집
              const tagIdx = [];
              set.sents.forEach((s, i) => {
                if (s.sentType === "workTag") {
                  const mm = (s.t || "").match(/\((가|나|다|라)\)/);
                  if (mm) tagIdx.push({ i, label: mm[1] });
                }
              });
              if (tagIdx.length >= 2) {
                // 선지가 언급한 각 라벨의 [lo, hi) 범위 합집합
                const allowedRanges = [];
                for (const label of workMarksChoice) {
                  const tIdx = tagIdx.findIndex((t) => t.label === label);
                  if (tIdx < 0) continue;
                  const lo = tagIdx[tIdx].i;
                  const hi =
                    tIdx + 1 < tagIdx.length
                      ? tagIdx[tIdx + 1].i
                      : set.sents.length;
                  allowedRanges.push([lo, hi]);
                }
                if (allowedRanges.length > 0) {
                  const ranges = csSents.map((s) =>
                    set.sents.findIndex((x) => x.id === s.id),
                  );
                  const outside = ranges.filter(
                    (r) =>
                      r >= 0 &&
                      !allowedRanges.some(([lo, hi]) => r >= lo && r < hi),
                  );
                  if (outside.length > 0) {
                    issue(
                      "C_work_mismatch",
                      yearKey,
                      cLoc,
                      `선지가 지시한 (${workMarksChoice.join("·")}) 작품 범위 밖 sent 참조 ${outside.length}건`,
                    );
                  }
                }
              }
            }

            // C_marker_pollution — body sent에 부당한 원문자 잔존
            //   "부당"의 heuristic: sent.sentType === 'body' 이면서, 해당 세트의 question/choice 에서
            //   그 원문자를 참조하지 않는 경우. (참조되는 원문자는 의도된 표지이므로 허용)
            // (세트 단위로 1번만 수집하여 per-choice 루프에서 중복 쿼리 방지)
            if (!set.__q5_marker_cache) {
              const referenced = new Set();
              const re = /[ⓐ-ⓘ㉠-㉦①-⑨]|\[[A-E]\]/g;
              for (const qq of set.questions) {
                for (const cc of qq.choices || []) {
                  for (const m of (cc.t || "").matchAll(re))
                    referenced.add(m[0]);
                }
                for (const m of (qq.t || "").matchAll(re)) referenced.add(m[0]);
                for (const m of String(qq.bogi || "").matchAll(re))
                  referenced.add(m[0]);
              }
              const pollution = [];
              for (const s of set.sents) {
                if (s.sentType !== "body") continue;
                for (const m of (s.t || "").matchAll(re)) {
                  if (!referenced.has(m[0]))
                    pollution.push({ id: s.id, mk: m[0] });
                }
              }
              set.__q5_marker_cache = pollution;
            }
            if (c.num === 1 && set.__q5_marker_cache.length > 0) {
              for (const p of set.__q5_marker_cache) {
                issue(
                  "C_marker_pollution",
                  yearKey,
                  `${set.id} ${p.id}`,
                  `body sent에 참조되지 않는 원문자 "${p.mk}"`,
                );
              }
              set.__q5_marker_cache = []; // 보고 후 클리어
            }

            // C_pat_mismatch — ok:false인데 analysis가 주장하는 오류 성격과 pat 명백히 불일치
            if (c.ok === false && c.pat && typeof c.pat === "string") {
              const a = ana || "";
              const claimsReverse =
                /정반대|역전|반대로 서술|뒤집|반대되는/.test(a);
              const claimsCausal = /인과|관계 전도|뒤바|주체-객체/.test(a);
              const claimsOveraim =
                /지문에 없|과잉 추론|과도한 추론|끼워 넣|외삽/.test(a);
              const p = c.pat;
              let mismatch = false;
              if (claimsOveraim && !/^(R3|L3)$/.test(p)) mismatch = true;
              else if (claimsCausal && !/^(R2|L2|L4)$/.test(p)) mismatch = true;
              else if (claimsReverse && !/^(R1|L1|L2)$/.test(p))
                mismatch = true;
              if (mismatch) {
                issue(
                  "C_pat_mismatch",
                  yearKey,
                  cLoc,
                  `pat=${p} vs analysis가 주장하는 오류 성격 불일치`,
                );
              }
            }

            // C_highlight_analysis_divergence — analysis의 📌 지문 근거 인용문이 cs_ids 본문에 완전 부재
            const anchorMatch = (ana || "").match(
              /📌\s*(?:지문 근거|보기 근거)\s*:\s*["“]([^"”]{10,200})["”]/,
            );
            if (anchorMatch && csSents.length > 0) {
              const needle = norm(anchorMatch[1].slice(0, 30));
              if (needle.length >= 10 && !joined.includes(needle)) {
                issue(
                  "C_highlight_analysis_divergence",
                  yearKey,
                  cLoc,
                  `analysis 인용문이 cs_ids 본문과 겹치지 않음`,
                );
              }
            }

            // W_argument_thin — ok:false 인데 분해 표지(①②③/첫째/둘째) 없음
            if (
              c.ok === false &&
              ana &&
              !/①|②|③|❶|❷|❸|조건 ?분해|첫째|둘째|\[선지 조건/.test(ana)
            ) {
              issue(
                "W_argument_thin",
                yearKey,
                cLoc,
                "선지 조건 분해 없음 (①②③ 미사용)",
              );
            }

            // W_expression_analysis_missing — 선지에 인용/원문자 있는데 표현 기능 키워드 부재
            const hasExprMarker =
              /[ⓐ-ⓘ㉠-㉦①-⑨]|\[[A-E]\]|['‘].+['’]|["“].+["”]/.test(c.t || "");
            if (
              hasExprMarker &&
              ana &&
              !/기능|상징|효과|평가|표현|인용|의미|전달|강조/.test(ana)
            ) {
              issue(
                "W_expression_analysis_missing",
                yearKey,
                cLoc,
                "선지 인용/원문자 있으나 표현 분석 키워드 부재",
              );
            }

            // W_single_evidence — 문학 표현/복합 문항에서만 검사 (독서는 off)
            //   "표현/복합" heuristic: 선지·stem에 원문자·인용표현·(가)(나)(다) 지시가 있을 때
            if (
              c.ok === true &&
              Array.isArray(c.cs_ids) &&
              c.cs_ids.length === 1 &&
              sec === "literature"
            ) {
              const exprComplex =
                /[ⓐ-ⓘ㉠-㉦①-⑨]|\[[A-E]\]|['‘].+['’]|["“].+["”]|\((가|나|다|라)\)/;
              if (exprComplex.test(c.t || q.t || "")) {
                issue(
                  "W_single_evidence",
                  yearKey,
                  cLoc,
                  "문학 표현/복합 문항 ok:true 단일 근거 — multi-evidence 권장",
                );
              }
            }

            // [Gate 5] C_label_domain_mismatch — pat R계열이지만 analysis [L*] (또는 반대)
            //   pat 값과 analysis 본문 라벨이 같은 도메인이어야 함.
            //   --fix 시 pat에 맞춰 라벨을 자동 교체.
            if (c.ok === false && typeof c.pat === "string" && c.analysis) {
              const isR = /^R[1-4]$/.test(c.pat);
              const isL = /^L[1-5]$/.test(c.pat);
              const wrongRe = isR ? /\[L[1-5]\]/g : isL ? /\[R[1-4]\]/g : null;
              if (wrongRe && wrongRe.test(c.analysis)) {
                if (FIX) {
                  const before = c.analysis;
                  c.analysis = before.replace(wrongRe, `[${c.pat}]`);
                  if (c.analysis !== before) {
                    fixed(
                      "C_label_domain_mismatch_fixed",
                      yearKey,
                      cLoc,
                      `라벨 도메인 교정 → [${c.pat}]`,
                    );
                  }
                } else {
                  issue(
                    "C_label_domain_mismatch",
                    yearKey,
                    cLoc,
                    `pat=${c.pat} vs analysis 라벨 도메인 불일치`,
                  );
                }
              }
            }

            // [Gate 5 — superseded] C_vpat_dirty는 choice 루프 최상단 transverse 축으로 이설.
            //   본 블록은 nested 가드에 묻혀 dead였음 → 무력화(이중 발화 방지).
            if (false && c.pat === "V") {
              const dirtyIds = Array.isArray(c.cs_ids) && c.cs_ids.length > 0;
              const dirtySpans =
                Array.isArray(c.cs_spans) && c.cs_spans.length > 0;
              if (dirtyIds || dirtySpans) {
                if (FIX) {
                  c.cs_ids = [];
                  if (c.cs_spans) delete c.cs_spans;
                  fixed(
                    "C_vpat_dirty_fixed",
                    yearKey,
                    cLoc,
                    `V pat 정합 — cs_ids/cs_spans 비움`,
                  );
                } else {
                  issue(
                    "C_vpat_dirty",
                    yearKey,
                    cLoc,
                    `pat=V인데 cs_ids=${(c.cs_ids || []).length}건 / cs_spans=${(c.cs_spans || []).length}건`,
                  );
                }
              }
            }
          }

          // ── MISSING cs_ids: 근거 있어야 할 선지에 cs_ids 없음 ───────────
          const hasCsIds = Array.isArray(c.cs_ids) && c.cs_ids.length > 0;
          if (!hasCsIds) {
            if (c.ok === true) {
              needsManual(
                "MISSING_csid_true",
                yearKey,
                cLoc,
                "ok:true인데 cs_ids 없음 (근거 문장 미매핑)",
              );
            } else if (c.ok === false) {
              const pat = c.pat;
              // R3/V/0/null은 [] 허용, 그 외 R1/R2/R4/L1/L2/L4/L5는 필수
              const REQUIRES_CS = ["R1", "R2", "R4", "L1", "L2", "L4", "L5"];
              if (REQUIRES_CS.includes(pat)) {
                needsManual(
                  "MISSING_csid_false",
                  yearKey,
                  cLoc,
                  `ok:false pat:${pat}인데 cs_ids 없음 (왜곡 출처 미매핑)`,
                );
              }
            }
          }

          // ── [v2] E_ok_true_no_cs_ids — ok:true인데 cs_ids 부재 ─────────
          if (c.ok === true && !hasCsIds) {
            issue(
              "E_ok_true_no_cs_ids",
              yearKey,
              cLoc,
              "ok=true인데 cs_ids 부재 (정답 형광펜 누락)",
            );
          }

          // ── [v2] E_required_cs_missing — pat이 cs 필수인데 cs 부재 ────
          if (c.ok === false && !hasCsIds) {
            const REQ = ["R1", "R2", "R4", "L1", "L2", "L4", "L5"];
            if (REQ.includes(c.pat)) {
              issue(
                "E_required_cs_missing",
                yearKey,
                cLoc,
                `pat=${c.pat} 인데 cs_ids 부재 (왜곡 근거 미매핑)`,
              );
            }
          }

          // ── [v2] E_empty_pat_cs_present — ok:false R3/V인데 cs 보유 ───
          //   ok:true 선지의 cs 보유는 정상(근거) → 제외. pat=null도 제외
          //   (ok:true null 정상 / ok:false null은 별도 pat-missing 검사 영역).
          //   R3(지문 밖)·V(어휘)는 규칙상 cs=[] → cs 보유 시만 flag.
          if (c.ok === false && hasCsIds && (c.pat === "R3" || c.pat === "V")) {
            issue(
              "E_empty_pat_cs_present",
              yearKey,
              cLoc,
              `ok:false pat=${c.pat}인데 cs_ids ${c.cs_ids.length}건 (R3/V는 cs=[] 규칙)`,
            );
          }

          // ── [v2] W_analysis_placeholder_real — 명시 placeholder 마커 ──
          if (
            c.analysis &&
            /\[\?\]|\[확인 필요|TODO|placeholder/.test(c.analysis)
          ) {
            issue(
              "W_analysis_placeholder_real",
              yearKey,
              cLoc,
              "analysis에 명시적 placeholder 마커 ([?], TODO, placeholder, [확인 필요])",
            );
          }

          // ── [v2] W_analysis_placeholder_suspect — 인용부호 밖 `...`만 ────
          //   📌 verbatim 인용 내부 말줄임표(작품/지문 원문)는 정상 → 제외.
          //   쌍·홑따옴표·낫표 내부를 strip 후에도 남는 `...`만 의심 대상.
          //   (표본 검증: strip 전 788건 거의 전부 인용 생략표 = 오탐 / 후 ~3건)
          if (
            c.analysis &&
            !/\[\?\]|\[확인 필요|TODO|placeholder/.test(c.analysis)
          ) {
            const _bareAna = c.analysis
              .replace(/"[^"]*"/g, "")
              .replace(/[“][^”]*[”]/g, "")
              .replace(/[「][^」]*[」]/g, "")
              .replace(/[『][^』]*[』]/g, "")
              .replace(/[‘][^’]*[’]/g, "")
              .replace(/'[^']*'/g, "");
            if (/\.\.\./.test(_bareAna)) {
              issue(
                "W_analysis_placeholder_suspect",
                yearKey,
                cLoc,
                "analysis 인용부호 밖에 줄임표 (`...`) — 미완 의심",
              );
            }
          }
        }

        // ── [v2] E_questionType_ok_mismatch — positive/negative 정합 ────
        // [2026-06-05] 메타 발문 예외 (CLAUDE.md §6, precedent r2022c Q10 2026-06-01 사용자 결정):
        //   "답을 찾을 수 없는 질문은?" 류 = 발문이 '지문 무관'을 요구 → 정답 = ok:false
        //   → positive 라도 okF=1 / okT=4 분포가 정상. false-positive 방지.
        const __isMetaStem =
          /답을 찾을 수 없는|알 수 없는 것은\?|추론할 수 없는 것은\?/.test(
            q.t || "",
          );
        const __okT = (q.choices || []).filter((c) => c.ok === true).length;
        const __okF = (q.choices || []).filter((c) => c.ok === false).length;
        if (
          q.questionType === "positive" &&
          __okT !== 1 &&
          !(__isMetaStem && __okF === 1)
        ) {
          issue(
            "E_questionType_ok_mismatch",
            yearKey,
            qLoc,
            `positive인데 okT=${__okT} (정합 1, okF=${__okF})`,
          );
        }
        if (q.questionType === "negative" && __okF !== 1) {
          issue(
            "E_questionType_ok_mismatch",
            yearKey,
            qLoc,
            `negative인데 okF=${__okF} (정합 1, okT=${__okT})`,
          );
        }

        // ── bogi 없는 보기 문항 경고 ─────────────────────────────────────
        const hasBogiKeyword = /<보기>|<보\s기>|<학습\s활동>/.test(q.t || "");
        if (hasBogiKeyword && !q.bogi) {
          needsManual(
            "G_missing_bogi",
            yearKey,
            qLoc,
            "보기 문항인데 bogi 없음",
          );
        }
      }

      // ── H2: 세트 내 cs_ids 몰빵 감지 (동일 sent_id 5회+ 반복) ───────────
      const freq = new Map();
      for (const q of set.questions || []) {
        for (const c of q.choices || []) {
          for (const id of c.cs_ids || [])
            freq.set(id, (freq.get(id) || 0) + 1);
        }
      }
      for (const [id, cnt] of freq) {
        if (cnt >= 5) {
          needsManual(
            "H_cs_concentration",
            yearKey,
            `${set.id} ${id}`,
            `동일 sent ${cnt}회 반복 — 재분석 대상`,
          );
        }
      }

      // ── S: 본문 sent 수 최소 기준 (release_ready 5번째) ──────────────────
      const sentCount = (set.sents || []).length;
      const questionCount = (set.questions || []).length;
      const setLoc = `${yearKey} ${set.id}`;

      if (sentCount === 0) {
        issue(
          "S_sent_count_zero",
          yearKey,
          setLoc,
          `본문 sent 0개 — 완전 재구축 필요 (D등급)`,
          "critical",
        );
      } else if (sec === "reading") {
        if (sentCount < 10) {
          issue(
            "S_sent_count_low",
            yearKey,
            setLoc,
            `독서 set sent_count=${sentCount} (최소 10 필요)`,
            "critical",
          );
        }
        if (questionCount > 0 && sentCount / questionCount < 3.0) {
          issue(
            "S_sent_ratio_low",
            yearKey,
            setLoc,
            `독서 set sent/question=${(sentCount / questionCount).toFixed(1)} (최소 3.0 필요)`,
            "critical",
          );
        }
      } else if (sec === "literature") {
        if (sentCount < 5) {
          issue(
            "S_sent_count_low",
            yearKey,
            setLoc,
            `문학 set sent_count=${sentCount} (최소 5 필요)`,
            "critical",
          );
        }
        if (questionCount > 0 && sentCount / questionCount < 1.5) {
          issue(
            "S_sent_ratio_low",
            yearKey,
            setLoc,
            `문학 set sent/question=${(sentCount / questionCount).toFixed(1)} (최소 1.5 필요)`,
            "critical",
          );
        }
      }

      // ── S: 선지 5개 검증 (release_ready 6번째) ───────────────────────────
      for (const q of set.questions || []) {
        const choiceCount = (q.choices || []).length;
        if (choiceCount !== 5) {
          issue(
            "S_choices_missing",
            yearKey,
            `${yearKey} ${set.id} Q${q.id}`,
            `choices=${choiceCount} (5개 필요)`,
            "critical",
          );
        }
      }
    }
  }
}

// ─── annotations 검증 (G) ─────────────────────────────────────────────────────
if (ann) {
  for (const [yearKey, yearAnn] of Object.entries(ann)) {
    for (const [setKey, items] of Object.entries(yearAnn)) {
      for (const item of items) {
        for (const field of ["sentId", "sentFrom", "sentTo"]) {
          const sid = item[field];
          if (!sid || validSentIds.has(sid)) continue;

          // 자동 수정 시도
          const fix1 = sid.replace(/^([a-zA-Z]+\d{4}[a-z])(s\d+)$/, "$1_$2");
          const fix2 = sid.replace(
            /^([rl])2022j([abcd])(s\d+)$/,
            (_, r, l, s) => `${r}20226${l}_${s}`,
          );

          if (validSentIds.has(fix1)) {
            issue(
              "G_ann_sentid",
              yearKey,
              `${setKey}[${field}]`,
              `${sid} → ${fix1}`,
            );
            if (FIX) {
              item[field] = fix1;
              fixed("G_ann_fixed", yearKey, `${setKey}`, `${sid}→${fix1}`);
            }
          } else if (validSentIds.has(fix2)) {
            issue(
              "G_ann_sentid",
              yearKey,
              `${setKey}[${field}]`,
              `${sid} → ${fix2}`,
            );
            if (FIX) {
              item[field] = fix2;
              fixed("G_ann_fixed", yearKey, `${setKey}`, `${sid}→${fix2}`);
            }
          } else {
            needsManual(
              "G_ann_dead",
              yearKey,
              `${setKey}[${field}]`,
              `DEAD sentId: ${sid}`,
            );
          }
        }
      }
    }
  }
}

// ─── 결과 출력 ────────────────────────────────────────────────────────────────
// chalk 불필요 — 단순 텍스트 출력
const chalk = {
  red: (s) => s,
  yellow: (s) => s,
  green: (s) => s,
  cyan: (s) => s,
  bold: (s) => s,
};

console.log("\n" + "═".repeat(60));
console.log(" QUALITY GATE REPORT");
console.log("═".repeat(60));

// 연도별 이슈 집계
const issuesByYear = {};
for (const iss of issues) {
  if (!issuesByYear[iss.yearKey]) issuesByYear[iss.yearKey] = 0;
  issuesByYear[iss.yearKey]++;
}

console.log("\n[ 연도별 이슈 ]");
for (const [y, cnt] of Object.entries(issuesByYear)) {
  const status = cnt === 0 ? "✅" : "🔴";
  console.log(`  ${status} ${y}: ${cnt}건`);
}

// ─── 3단계 분류: CRITICAL / WARNING / IGNORE ──────────────────────────────────
// [Gate 5] 출시 차단(critical) vs 품질 향상(warning) 명확 분리
//
// CRITICAL — 출시 차단:
//   - 형광펜 없음 (MISSING_csid_true, MISSING_csid_false)
//   - 작품 mismatch (C_work_mismatch — 선지가 가리키는 작품과 cs_ids 범위 불일치)
//   - 인용표현 미반영 (C_quote_unreflected — 선지의 '...' / "..." 인용이 cs_ids sent 안에 없음)
//   - 그림/도식 누락 (C_figure_missing — sentType=figure 인데 이미지 자산 미매핑)
//   - 원문자 오염 (C_marker_pollution — 지문 body 에 부당한 원문자 잔존)
//   - 내부 ID 노출 (H_analysis_id_leak)
//   - pat 명백한 불일치 (C_pat_mismatch — analysis 본문이 주장하는 오류 성격과 pat 값 충돌)
//   - 해설-형광펜 완전 불일치 (C_highlight_analysis_divergence)
//   - 해설 결론 파손 (F_empty_analysis)
//   - DEAD_csid
//
// WARNING — 품질 향상:
//   - F_content_reversed (결론 이모지만 뒤집힘)
//   - W_argument_thin (조건 ①②③ 분해 없음)
//   - W_expression_analysis_missing (선지 인용/원문자 있는데 analysis에 표현 분석 키워드 없음)
//   - W_single_evidence (ok:true 인데 cs_ids 1개만 — multi-evidence 권장)
//   - H_cs_concentration
//
// IGNORE — 중요도 낮음
const SEVERITY_MAP = {
  // CRITICAL (출시 차단) — Tier 1
  DEAD_csid: "CRITICAL",
  F_empty_analysis: "CRITICAL",
  MISSING_csid_true: "CRITICAL",
  MISSING_csid_false: "CRITICAL",
  H_analysis_id_leak: "CRITICAL", // Tier 1
  C_figure_missing: "CRITICAL", // Tier 1
  C_marker_pollution: "CRITICAL", // Tier 1
  C_work_mismatch: "CRITICAL", // Tier 1
  C_label_domain_mismatch: "CRITICAL", // Tier 1 (pat R ↔ 라벨 L / 반대)
  C_vpat_dirty: "CRITICAL", // Tier 1 (pat=V 인데 cs_ids/cs_spans 비어있지 않음)
  MARKER_INTEGRITY_FAIL: "CRITICAL", // Tier 1 (참조 마커/bracket이 지문·annotation에 부재 = 형광펜 정박 불가)
  CS_ALL_NONHIGHLIGHTABLE: "CRITICAL", // Tier 1 (cs_ids 전부 비-하이라이트 sentType = 형광펜 미렌더)
  BOGI_IMAGE_MISSING: "CRITICAL", // Tier 1 (보기 이미지 파일 부재 = 학생이 보기 못 봐 답 불가)

  // WARNING (품질 향상) — Tier 2·3
  // Tier 2 (검증 필요 — 승격 후보, false positive 검수 후 CRITICAL로)
  C_quote_unreflected: "WARNING", // Tier 2: sent/spans/analysis 전부 부재
  C_highlight_analysis_divergence: "WARNING", // Tier 2
  W_quote_unreflected: "WARNING", // 약한 변형: cs_ids sent 본문에만 부재

  // Tier 3 (승격 금지)
  C_pat_mismatch: "WARNING", // Tier 3
  // [발주 ef 사양2] 해설 반전 축 — WARNING 고정. CRITICAL 승격 금지(편입 시점 LIVE 0건).
  F_distractor_reads_as_answer: "WARNING",
  F_answer_reads_as_distractor: "WARNING",

  // 결론줄=ok 검사 (§13⑤) — 출시 차단 CRITICAL 승격 (이전 WARNING)
  F_content_reversed: "CRITICAL",
  // [발주 ae ①] 축6 등재 — 학생 화면 직접 노출이므로 CRITICAL. WARNING 강등 금지.
  F_markdown_emphasis_exposed: "CRITICAL",
  F_conclusion_marker_only: "CRITICAL",
  // [발주 ae ②] ok:false+pat:null — 잠정 WARNING(등급은 렌더 확인 후 심사관 지정)
  D_false_no_pat: "WARNING",
  // 📌 지문 근거 exact-substring 검사 (§13⑥) — 단어내 공백 artifact만 CRITICAL
  C_anchor_exact_fail: "CRITICAL",
  C_anchor_marker_space: "WARNING", // 마커 인접 공백차(관례·검수)

  // 기존 WARNING
  D_true_has_pat: "WARNING",
  H_cs_concentration: "WARNING",
  W_argument_thin: "WARNING",
  // rubric v1 신설 (WARNING·비차단)
  W_struct_missing: "WARNING",
  W_scratchpad_leak: "WARNING",
  W_verbose: "WARNING",
  // ── [발주6-D] 인코딩 손상 ──
  F_encoding_corruption: "CRITICAL", // U+FFFD(멀티바이트 손상) = 깨진 글자 학생 노출
  F_zerowidth_corruption: "CRITICAL", // 제로폭/비가시 문자(ZWSP 등) = 형광펜·검색·verbatim 대조 실패
  // ── B track: cs_span stale ──
  W_csspan_stale: "WARNING", // cs_span 내용 불일치(옛 형태/오앵커)
  W_csspan_broken: "WARNING", // cs_span 공백차로 형광펜 깨짐 — 고순위 WARNING(대표 재가로 출시 baseline 51 유지, §13⑩)
  W_cs_anchor_mismatch: "WARNING", // 근거형광펜정합: 📌근거 sent가 cs_ids에 없음(형광펜↔해설근거 불일치)
  W_bracket_integrity: "WARNING", // 출전행 작품명 낫표(corrupt/halfwidth/stray/bare) — 고순위 WARNING(비본문·출시 baseline 불변)
  // ── annotation 무결성(핵심 차별점 렌더 정합) — CRITICAL 승격 검토(정리 후) ──
  W_annotation_stale: "WARNING", // annotation text ⊄ sent.t / bracket sentFrom·To 부재(렌더 정박 실패)
  W_bracket_collapse: "WARNING", // 동일 sentId 2+ bracket / 초대형 단일 sent bracket(l2024c류 구간 collapse)
  W_choice_anno_stale: "WARNING", // sentId 없는 bogi/choice annotation(choice-underline·bogi marker) text ⊄ choice.t/bogi (QuizPanel 선지·보기 렌더 정합)
  W_bogi_anchor: "WARNING", // 📌 보기 근거 ⊄ q.bogi exact substring (C_anchor 보기 사각 보완, §13⑥ 확장)
  W_analysis_marker_mismatch: "WARNING", // 해설 마커 ⊄ (문항+지문+보기 ∪ 선지) = 존재하지 않는 마커 참조
  W_orphan_marker: "WARNING", // 지문 마커 ⊄ 전 문항 참조 = 환각 후보(시험지 대조 전 자동 CRITICAL 금지)
  W_marker_misplaced: "WARNING", // 인라인 마커 sentId ≠ annotation sentId = 오정박(sent.t 이설 대상)
  W_choice_passage_echo: "WARNING", // ok:false 선지가 지문 원문과 대부분 일치 = 한 단어 치환형 손상 후보
  W_domain_mismatch: "WARNING", // 배열↔pat 계열 불일치(§6) — 계측 단계. 51선지 교정 후 CRITICAL 승격
  // ── [발주1] 게이트 3종 신설 ──
  F_meta_leak: "CRITICAL", // 1-B 해설 메타-누출(좁은 한글 메타-고백) = 깨진 해설
  W_csless_with_anchor: "WARNING", // 1-A 형광펜 누락 후보(cs_ids=[] 인데 📌 본문 실재) — triage 대상
  FOOTNOTE_MARKER_INTEGRITY: "WARNING", // 1-C 각주표시(*) 대칭 누락
  W_expression_analysis_missing: "WARNING",
  W_single_evidence: "WARNING",

  // IGNORE
  E_pat_unclassifiable: "IGNORE",
  F_conclusion_mismatch: "IGNORE",
  E_pat_zero: "IGNORE",

  // ── [v2] 신규 6건 severity 분류 ──
  E_ok_true_no_cs_ids: "CRITICAL",
  E_required_cs_missing: "CRITICAL",
  E_empty_pat_cs_present: "WARNING",
  E_questionType_ok_mismatch: "CRITICAL",
  W_analysis_placeholder_real: "CRITICAL",
  W_analysis_placeholder_suspect: "WARNING",

  // ── 본문 품질 + 선지 수 검증 ──
  S_sent_count_zero: "CRITICAL",
  S_sent_count_low: "CRITICAL",
  S_sent_ratio_low: "CRITICAL",
  S_choices_missing: "CRITICAL",

  // ── bracket_audit.mjs integration (Pipeline v2 — 8 issue family) ──
  // 1. SOURCE_TEXT_DEFECT (Lock S1~S4) — sent.t 안 source-level 결함
  SOURCE_BODY_MARKER_MISSING: "CRITICAL",
  SOURCE_INLINE_OUT_OF_RANGE: "WARNING",
  // 2. SENT_SEGMENTATION_DEFECT (Lock SP1~SP3) — sent split 의무 path
  SOURCE_VERSE_LINE_OVERFLOW: "WARNING",
  // 3. VISUAL_MARK_DEFECT — workTag/marker 위치 사양
  SOURCE_WORKTAG_POSITION_MISMATCH: "CRITICAL",
  // 4. ANNOTATION_REFERENCE_DEFECT (Lock A1~A5) — annotations.json reference 결함
  ANNOTATION_DEAD_SENTFROM: "CRITICAL",
  ANNOTATION_DEAD_SENTTO: "CRITICAL",
  ANNOTATION_INVERTED_RANGE: "CRITICAL",
  ANNOTATION_NON_BODY_IN_RANGE: "WARNING",
  ANNOTATION_RANGE_SIZE_OUTLIER: "WARNING",
  // 5. DOWNSTREAM_REFERENCE_DEFECT — cs_ids/cs_spans 깨진 참조 (별도 회기 검출 path)
  // 6. RENDERER_DEFECT — visual_audit RENDER_* (별도 도구 path)
  // 7. DETECTOR_FALSE_POSITIVE — 도구 안 오탐 (release 영향 NOT, INFO 단독)
  // 8. RELEASE_POLICY_DEFECT — release_block vs non_blocking 분리 path
};

// ─── bracket_audit integration (3-tier classification) ───────────────────
try {
  const annJson = JSON.parse(fs.readFileSync(ANN_PATH, "utf8"));
  // scope/year 필터 정합: --scope 또는 --year 지정 시 같은 연도만 감사
  const bracketOpts = SCOPE || YEAR ? { years: yearsToCheck } : {};
  const bracketFindings = auditBrackets(data, annJson, bracketOpts);
  for (const bf of bracketFindings) {
    // DETECTOR_FALSE_POSITIVE (severity=INFO) — quality_gate 집계 제외
    if (bf.family === "DETECTOR_FALSE_POSITIVE") continue;
    // --scope=release: bracket findings도 출시 set만 (set 루프 밖이라 별도 필터)
    if (
      SCOPE === "release" &&
      !RELEASE_KEYS_SET.has(bf.yearKey + "::" + bf.setId)
    )
      continue;
    // bf.code already prefixed: SOURCE_* or ANNOTATION_*
    issue(
      bf.code,
      bf.yearKey,
      `${bf.setId} [${bf.label}]`,
      bf.msg,
      bf.severity.toLowerCase(),
    );
  }
} catch (e) {
  console.warn(`bracket_audit skipped: ${e.message}`);
}

if (SCOPE === "release") {
  console.log(
    `\n[ --scope=release: 출시 set ${_releaseSetCount}개 순회 (RELEASE_KEYS ${RELEASE_KEYS_SET.size}건) ]`,
  );
}

// ── [발주6-D] annotations.json U+FFFD 스캔 (전 텍스트 필드) ──
try {
  const annObj = JSON.parse(rawAnn);
  for (const [yk, sets] of Object.entries(annObj)) {
    if (!sets || typeof sets !== "object") continue;
    for (const [setId, anns] of Object.entries(sets)) {
      for (const a of anns || []) {
        for (const field of ["text", "marker"]) {
          const v = a[field];
          if (typeof v === "string" && v.includes("�")) {
            const i = v.indexOf("�");
            issue(
              "F_encoding_corruption",
              yk,
              `${setId} [annotation ${a.type || ""} ${a.sentId || ""}]`,
              `U+FFFD 인코딩 손상 [annotation.${field}] "…${v.slice(Math.max(0, i - 8), i + 3)}…"`,
            );
          }
        }
      }
    }
  }
} catch (e) {
  console.warn(`annotations U+FFFD scan skipped: ${e.message}`);
}

const ALL_FINDINGS = [...issues, ...manual];
const bySeverity = { CRITICAL: [], WARNING: [], IGNORE: [] };
for (const f of ALL_FINDINGS) {
  const sev = SEVERITY_MAP[f.type] || "WARNING";
  bySeverity[sev].push(f);
}

// ── [발주1] 후보 리스트 3종 출력 (read-only triage 입력 = 발주2·3의 입력) ──
{
  const OUT_DIR = path.resolve(__dirname, "output");
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(OUT_DIR, "csless_with_anchor.json"),
    JSON.stringify(cslessAnchorCands, null, 2),
  );
  fs.writeFileSync(
    path.join(OUT_DIR, "scratchpad_leak.json"),
    JSON.stringify(metaLeakCands, null, 2),
  );
  fs.writeFileSync(
    path.join(OUT_DIR, "footnote_marker_missing.json"),
    JSON.stringify(footnoteMarkerCands, null, 2),
  );
  fs.writeFileSync(
    path.join(OUT_DIR, "struct_missing.json"),
    JSON.stringify(structMissingCands, null, 2),
  );
  fs.writeFileSync(
    path.join(OUT_DIR, "csspan_stale.json"),
    JSON.stringify(csspanStaleCands, null, 2),
  );
  fs.writeFileSync(
    path.join(OUT_DIR, "bracket_integrity.json"),
    JSON.stringify(bracketIntegrityCands, null, 2),
  );
  fs.writeFileSync(
    path.join(OUT_DIR, "cs_anchor_mismatch.json"),
    JSON.stringify(csAnchorMismatchCands, null, 2),
  );
  fs.writeFileSync(
    path.join(OUT_DIR, "annotation_stale.json"),
    JSON.stringify(annStaleCands, null, 2),
  );
  fs.writeFileSync(
    path.join(OUT_DIR, "bracket_collapse.json"),
    JSON.stringify(bracketCollapseCands, null, 2),
  );
  fs.writeFileSync(
    path.join(OUT_DIR, "bogi_anchor.json"),
    JSON.stringify(bogiAnchorCands, null, 2),
  );
  fs.writeFileSync(
    path.join(OUT_DIR, "analysis_marker_mismatch.json"),
    JSON.stringify(analysisMarkerCands, null, 2),
  );
  fs.writeFileSync(
    path.join(OUT_DIR, "orphan_marker.json"),
    JSON.stringify(orphanMarkerCands, null, 2),
  );
  fs.writeFileSync(
    path.join(OUT_DIR, "marker_misplaced.json"),
    JSON.stringify(markerMisplacedCands, null, 2),
  );
  fs.writeFileSync(
    path.join(OUT_DIR, "choice_passage_echo.json"),
    JSON.stringify(choiceEchoCands, null, 2),
  );
  fs.writeFileSync(
    path.join(OUT_DIR, "domain_mismatch.json"),
    JSON.stringify(domainMismatchCands, null, 2),
  );
  // CRITICAL 전체 덤프 (display 20+"외 N건" 절단 우회 = 출시 재스캔 정확도) — issues + manual(F_empty/DEAD) 합침
  fs.writeFileSync(
    path.join(OUT_DIR, "all_critical.json"),
    JSON.stringify(
      [...issues, ...manual]
        .filter((i) => (SEVERITY_MAP[i.type] || "WARNING") === "CRITICAL")
        .map((i) => ({ type: i.type, yearKey: i.yearKey, loc: i.loc })),
      null,
      0,
    ),
  );
  const _liveN = (a) => a.filter((x) => x.live).length;
  console.log(
    `\n📋 [발주1] 후보 → pipeline/output/  ` +
      `csless_with_anchor=${cslessAnchorCands.length}(LIVE ${_liveN(cslessAnchorCands)}) ` +
      `scratchpad_leak=${metaLeakCands.length}(LIVE ${_liveN(metaLeakCands)}) ` +
      `footnote_marker=${footnoteMarkerCands.length}(LIVE ${_liveN(footnoteMarkerCands)}) ` +
      `struct_missing=${structMissingCands.length}(LIVE ${_liveN(structMissingCands)})`,
  );
}

function printSeverity(label, arr, icon) {
  console.log(`\n[ ${icon} ${label}: ${arr.length}건 ]`);
  const byType = {};
  for (const f of arr) byType[f.type] = (byType[f.type] || 0) + 1;
  for (const [t, cnt] of Object.entries(byType))
    console.log(`  ${t}: ${cnt}건`);
}
printSeverity("CRITICAL (기능 깨짐)", bySeverity.CRITICAL, "🔴");
printSeverity("WARNING (품질 문제)", bySeverity.WARNING, "🟡");
printSeverity("IGNORE (중요도 낮음)", bySeverity.IGNORE, "⚪");

console.log(`\n[ 자동수정 가능: ${issues.length}건 ]`);
const typeCount = {};
for (const iss of issues) typeCount[iss.type] = (typeCount[iss.type] || 0) + 1;
for (const [t, cnt] of Object.entries(typeCount))
  console.log(`  ${t}: ${cnt}건`);

// CRITICAL 상세는 항상 출력 (0건이 목표이므로 남으면 반드시 확인)
if (bySeverity.CRITICAL.length > 0 && !REPORT) {
  console.log("\n  🔴 CRITICAL 상세:");
  for (const m of bySeverity.CRITICAL.slice(0, 20))
    console.log(`    ${m.yearKey} ${m.loc}: ${m.message}`);
  if (bySeverity.CRITICAL.length > 20)
    console.log(`    ... 외 ${bySeverity.CRITICAL.length - 20}건`);
}

if (FIX) {
  console.log(`\n[ 자동수정 완료: ${autoFixed.length}건 ]`);

  // 저장
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  fs.writeFileSync(
    path.join(BACKUP_DIR, `all_data_204_backup_${ts}.json`),
    raw,
  );
  // v2: annotations.json 동일 시점 백업 의무 (덮어쓰기 전)
  if (ann && rawAnn) {
    fs.writeFileSync(
      path.join(BACKUP_DIR, `annotations_backup_${ts}.json`),
      rawAnn,
    );
  }
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), "utf8");
  if (ann) fs.writeFileSync(ANN_PATH, JSON.stringify(ann, null, 2), "utf8");
  console.log("✅ 파일 저장 완료 (all_data + annotations 백업 포함)");
}

if (REPORT) {
  const reportPath = path.resolve(__dirname, "../pipeline/quality_report.json");
  fs.writeFileSync(
    reportPath,
    JSON.stringify(
      {
        issues,
        autoFixed,
        manual,
        critical: bySeverity.CRITICAL,
        warning: bySeverity.WARNING,
        ignore: bySeverity.IGNORE,
      },
      null,
      2,
    ),
  );
  console.log(`\n📄 리포트 저장: ${reportPath}`);
}

if (!FIX && issues.length > 0) {
  console.log("\n→ 자동수정 적용: node pipeline/quality_gate.mjs --fix");
}

// [Gate 7] 골든셋 게이트 판정 — --golden 모드에서만
// 정책:
//  - 골든셋 각 문항의 issue 목록에서 expected(허용 백서)에 없는 CRITICAL이 있으면 blocked
//  - expected에 있는 코드는 '이미 알려진 알려진 이슈'로 간주되어 통과
if (GOLDEN_ONLY && GATE5) {
  console.log("\n" + "═".repeat(60));
  console.log(" GATE 7 — 골든셋 회귀 테스트");
  console.log("═".repeat(60));
  const unexpected = [];
  for (const f of ALL_FINDINGS) {
    const sev = SEVERITY_MAP[f.type] || "WARNING";
    if (sev !== "CRITICAL") continue;
    // loc에서 setId/qId 추출 — 두 포맷 지원
    //   "<yearKey> <setId> Q<n>-[<num>]"
    //   "<setId> <sentId>"  (figure·marker pollution 등 세트 레벨)
    let setId = null,
      qId = null;
    const mq = f.loc.match(/([a-zA-Z0-9_]+) Q(\d+)/);
    if (mq) {
      setId = mq[1];
      qId = +mq[2];
    } else {
      const ms = f.loc.match(/^([a-zA-Z0-9_]+)(?:\s|$)/);
      if (ms) setId = ms[1];
    }
    const expected = goldenExpected(f.yearKey, setId, qId);
    if (!expected.has(f.type)) unexpected.push(f);
  }
  if (unexpected.length === 0) {
    console.log(" ✅ 골든셋 통과 — 예상 외 CRITICAL 0건 (merge 허용)");
  } else {
    console.log(
      ` 🔴 골든셋 차단 — 예상 외 CRITICAL ${unexpected.length}건 (merge 금지)`,
    );
    for (const f of unexpected.slice(0, 20)) {
      console.log(`   [${f.type}] ${f.yearKey} ${f.loc}: ${f.message}`);
    }
    if (unexpected.length > 20)
      console.log(`   ... 외 ${unexpected.length - 20}건`);
  }
  console.log("═".repeat(60) + "\n");
}

// ── 검사 스코프 분모 출력 + 가드 (§13⑮ — 분모 없는 "clean"은 무효 신호) ──
//   분모는 데이터·RELEASE_KEYS에서 런타임 산출(하드코딩 금지).
const _dataTotalSets = Object.keys(data).reduce(
  (a, yk) =>
    a +
    ["reading", "literature"].reduce(
      (b, sec) => b + ((data[yk] || {})[sec] || []).length,
      0,
    ),
  0,
);
console.log("\n" + "═".repeat(60));
console.log(
  `검사 스코프: 세트 ${scopeSets} / 문항 ${scopeQ} / 선지 ${scopeC} → 위반 ${bySeverity.CRITICAL.length}건`,
);
// W_orphan_marker 분모 (§13⑮: 마커 보유 세트가 진짜 분모 — 전체 세트 아님)
console.log(
  `W_orphan_marker: 마커 보유 세트 ${scopeMarkerSets} 중 고아 ${scopeOrphanSets}세트 / 고아 마커 ${scopeOrphanMarkers}개 (LIVE ${scopeOrphanLiveSets}세트)`,
);
console.log(
  `W_marker_misplaced: 오정박 ${markerMisplacedCands.length}건 (LIVE ${markerMisplacedCands.filter((x) => x.live).length}) — 인라인↔ann sentId 불일치`,
);
console.log(
  `W_choice_passage_echo: ok:false 선지 ${scopeEchoChoices} 중 후보 ${scopeEchoHits}건 (LIVE ${choiceEchoCands.filter((x) => x.live).length}) — 지문 원문 반향(치환형 손상 의심)`,
);
if (scopeEchoChoices === 0 && scopeSets > 0)
  console.error("🔴 SCOPE_EMPTY(echo) — ok:false 선지 0건. 판정 무효");
// W_domain_mismatch — 두 층위 구분 출력(처리 방법이 다름). 후보 JSON도 함께 발행.
{
  const liveSet = domainMismatchCands.filter(
    (x) => x.level === "set" && x.live,
  ).length;
  const liveCho = domainMismatchCands.filter(
    (x) => x.level === "choice" && x.live,
  ).length;
  console.log(
    `W_domain_mismatch: pat 보유 선지 ${scopeDomainChoices} 중 계열 불일치 ${scopeDomainHits}선지 / ${domainMismatchCands.length}세트`,
  );
  console.log(
    `  ├ [A 세트 배열 이관] ${scopeDomainSetHits}세트 (LIVE ${liveSet}) — 오분율 100%, 배열 이관 대상`,
  );
  console.log(
    `  └ [B 선지 pat 교정] ${scopeDomainChoiceSetHits}세트 (LIVE ${liveCho}) — 부분 불일치, pat만 재부여`,
  );
  if (scopeDomainChoices === 0 && scopeSets > 0)
    console.error("🔴 SCOPE_EMPTY(domain) — pat 보유 선지 0건. 판정 무효");
}
if (scopeSets === 0) {
  console.error("🔴 SCOPE_EMPTY — 검사 대상 0건. clean 판정 무효");
  process.exit(1);
}
if (SCOPE === "release" && scopeSets !== RELEASE_KEYS_SET.size) {
  console.error(
    `🔴 SCOPE_MISMATCH — release 검사 ${scopeSets} ≠ RELEASE_KEYS ${RELEASE_KEYS_SET.size} (§13⑫ 스코프 붕괴)`,
  );
  process.exit(1);
}
if (!SCOPE && scopeSets !== _dataTotalSets) {
  console.warn(
    `⚠️  SCOPE_DIFF — 전수 검사 ${scopeSets} ≠ 데이터 총 ${_dataTotalSets} (차 ${_dataTotalSets - scopeSets})`,
  );
}

// 릴리스 판정 — CRITICAL 0건이면 release_ready
if (bySeverity.CRITICAL.length === 0) {
  console.log("✅ release_ready — CRITICAL 0건");
} else {
  console.log(
    `🔴 release_blocked — CRITICAL ${bySeverity.CRITICAL.length}건 남음`,
  );
}
console.log("═".repeat(60) + "\n");
