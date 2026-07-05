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

const DATA_PATH = path.resolve(__dirname, "../public/data/all_data_204.json");
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
const SCOPE = (() => {
  const scopeArg = args.find((a) => a.startsWith("--scope="));
  if (!scopeArg) return null;
  return scopeArg.split("=")[1];
})();
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

// ─── --scope=release: 출시 set 198건만 검사 ──────────────────────────────────
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
  const block = src.slice(idx, src.indexOf("]", idx));
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
const issues = []; // 발견된 문제 전체
const autoFixed = []; // 자동 수정된 항목
const manual = []; // 수동 처리 필요 항목
// ── 발주1 후보 리스트 (read-only triage 입력, 발주2·3의 입력) ──
const cslessAnchorCands = []; // 1-A W_csless_with_anchor
const metaLeakCands = []; // 1-B F_meta_leak (해설 메타-누출)
const footnoteMarkerCands = []; // 1-C FOOTNOTE_MARKER_INTEGRITY
const structMissingCands = []; // 1-D W_struct_missing (§7 3단 구조 미달)

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

function issue(type, yearKey, loc, message, severity = "warn") {
  issues.push({
    type,
    yearKey,
    loc,
    message,
    severity,
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

      for (const q of set.questions) {
        // [Gate 7] --golden 지정 시 골든셋 외 스킵
        if (GOLDEN_ONLY && !goldenMatch(yearKey, set.id, q.id)) continue;
        const qLoc = `${yearKey} ${set.id} Q${q.id}`;

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

          if (contentReversed && !conclusionMismatch) {
            needsManual(
              "F_content_reversed",
              yearKey,
              cLoc,
              "결론 이모지(✅/❌) vs ok 불일치 → reanalyze 필요",
            );
          }

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

            // [Gate 5] C_vpat_dirty — pat=V 인데 cs_ids/cs_spans 비어있지 않음
            //   어휘 문항(V)은 cs_ids=[], cs_spans 없음이 규칙.
            //   --fix 시 cs_ids=[], cs_spans 제거.
            if (c.pat === "V") {
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

  // 결론줄=ok 검사 (§13⑤) — 출시 차단 CRITICAL 승격 (이전 WARNING)
  F_content_reversed: "CRITICAL",
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

// 릴리스 판정 — CRITICAL 0건이면 release_ready
console.log("\n" + "═".repeat(60));
if (bySeverity.CRITICAL.length === 0) {
  console.log("✅ release_ready — CRITICAL 0건");
} else {
  console.log(
    `🔴 release_blocked — CRITICAL ${bySeverity.CRITICAL.length}건 남음`,
  );
}
console.log("═".repeat(60) + "\n");
