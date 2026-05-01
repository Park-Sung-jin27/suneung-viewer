/**
 * pipeline/evaluate_compatibility.mjs
 *
 * 기존 all_data_204.json choice 구조 ↔ 새 structured choice 스키마 호환성 평가.
 * choice / set / exam 3단 집계.
 *
 * 점수 체계 (총 100점):
 *   1. 구조 존재성 (20점)
 *   2. 정합성       (30점)
 *   3. 파생 가능성  (20점)
 *   4. 학습 효용    (20점)
 *   5. 운영 리스크  (10점)
 *
 * 즉시 감점 (release-sensitive):
 *   - ok ↔ analysis 결론 충돌         -40
 *   - pat 도메인 불일치                -40
 *   - cs_ids 필수인데 empty            -40
 *   - cs_spans ↔ cs_ids sent_id 불일치 -20
 *   - cs_spans 전부 fallback 성격      -20
 *
 * release-sensitive blocking:
 *   - ok ↔ 결론 충돌
 *   - pat 도메인 불일치
 *   - cs_ids 필수 empty
 *   - 문학 작품/인용 대응 신호 전무
 *   - source text 오염 의심
 *
 * 등급: A 85~100 / B 70~84 / C 50~69 / D 0~49
 *
 * 사용법 (PowerShell):
 *   cd C:/Users/downf/suneung-viewer
 *   node pipeline/evaluate_compatibility.mjs
 *   node pipeline/evaluate_compatibility.mjs --exam 2026수능
 *   node pipeline/evaluate_compatibility.mjs --exam 2026수능 --set l2026c
 *   node pipeline/evaluate_compatibility.mjs --exam 2026수능 --verbose
 *
 * 출력:
 *   pipeline/reports/compatibility_choice.json
 *   pipeline/reports/compatibility_set.json
 *   pipeline/reports/compatibility_exam.json
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// ─── 경로 ─────────────────────────────────────────────────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DATA_PATH = path.join(ROOT, "public", "data", "all_data_204.json");
const REPORT_DIR = path.join(__dirname, "reports");

// ─── CLI 파싱 ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
function getArg(name) {
  const i = args.indexOf(name);
  return i >= 0 && i + 1 < args.length && !args[i + 1].startsWith("--")
    ? args[i + 1]
    : null;
}
const EXAM_FILTER = getArg("--exam");
const SET_FILTER = getArg("--set");
const VERBOSE = args.includes("--verbose");

// ─── 로드 ─────────────────────────────────────────────────────────────────────
if (!fs.existsSync(DATA_PATH)) {
  console.error(`❌ 데이터 없음: ${DATA_PATH}`);
  process.exit(1);
}
const data = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
fs.mkdirSync(REPORT_DIR, { recursive: true });

// ─── 상수 / 유틸 ──────────────────────────────────────────────────────────────
const REQUIRES_CS = new Set(["R1", "R2", "R4", "L1", "L2", "L4", "L5"]);
const AUTO_EMPTY_PATS = new Set(["R3", "V", null, undefined]);
const VALID_PATS = new Set([
  "R1", "R2", "R3", "R4",
  "L1", "L2", "L3", "L4", "L5",
  "V",
]);

// 정규화: 공백·원문자·괄호·한자·구두점 제거 후 비교
const _NORM_RE =
  /[ⓐ-ⓩⒶ-Ⓩ㉠-㉯①-⑳]|\[[A-E]\]|[「」『』【】〔〕⟨⟩《》()（）\[\]{}]|[\u4E00-\u9FFF\u3400-\u4DBF]|[·ㆍ‧,.!?;:*…"“”'‘’`´]/g;
const norm = (s) => String(s || "").replace(_NORM_RE, "").replace(/\s+/g, "");

// 내부 ID 노출 패턴 (독서/문학 공통)
const ID_LEAK_RE = /\b[rl]\d{4}[a-z_0-9]*s\d+\b|\[[a-z_0-9]+s\d+\]/;

// 원문자 마커
const MARKER_RE = /[ⓐ-ⓘ㉠-㉦①-⑨]|\[[A-E]\]/;

function sectionOf(setId) {
  if (!setId) return null;
  const s = String(setId);
  if (s[0] === "r" || s.startsWith("kor") || s.startsWith("sep")) return "reading";
  if (s[0] === "l" || s.startsWith("lsep")) return "literature";
  return null;
}

// ─── 즉시 감점 탐지 ──────────────────────────────────────────────────────────
function detectOkConflict(c) {
  const a = c.analysis || "";
  if (!a.trim()) return false;
  const lastPos = Math.max(a.lastIndexOf("✅"), a.lastIndexOf("❌"));
  if (lastPos < 0) return true;
  const conclusion = a.slice(lastPos);
  if (c.ok === true && conclusion.startsWith("❌")) return true;
  if (c.ok === false && conclusion.startsWith("✅")) return true;
  return false;
}

function detectPatDomainMismatch(c, setId) {
  const section = sectionOf(setId);
  // 1) pat 값 자체 도메인 (ok:false만 pat 가짐)
  if (c.ok === false && typeof c.pat === "string") {
    const isR = /^R[1-4]$/.test(c.pat);
    const isL = /^L[1-5]$/.test(c.pat);
    if (section === "literature" && isR) return true;
    if (section === "reading" && isL) return true;
  }
  // 2) analysis 라벨 도메인
  const ana = c.analysis || "";
  if (typeof c.pat === "string") {
    if (/^R[1-4]$/.test(c.pat) && /\[L[1-5]\]/.test(ana)) return true;
    if (/^L[1-5]$/.test(c.pat) && /\[R[1-4]\]/.test(ana)) return true;
  }
  return false;
}

function detectMissingRequiredCsIds(c) {
  const empty = !Array.isArray(c.cs_ids) || c.cs_ids.length === 0;
  if (!empty) return false;
  if (c.ok === true) return true;
  if (
    c.ok === false &&
    typeof c.pat === "string" &&
    REQUIRES_CS.has(c.pat)
  )
    return true;
  return false;
}

function detectCsSpansIdMismatch(c) {
  if (!Array.isArray(c.cs_spans) || c.cs_spans.length === 0) return false;
  const ids = new Set(c.cs_ids || []);
  for (const s of c.cs_spans) {
    if (!s || !s.sent_id) return true;
    if (!ids.has(s.sent_id)) return true;
  }
  return false;
}

function detectAllSpansFallback(c, sents) {
  if (!Array.isArray(c.cs_spans) || c.cs_spans.length === 0) return false;
  const sentById = new Map(sents.map((s) => [s.id, s]));
  // 모든 span이 sent 전체와 동일(=축소 없음)이면 fallback 성격
  for (const span of c.cs_spans) {
    const sent = sentById.get(span.sent_id);
    if (!sent) return false;
    const sentNorm = norm(sent.t || "");
    const spanNorm = norm(span.text || "");
    if (!sentNorm) return false;
    if (spanNorm !== sentNorm) return false;
  }
  return true;
}

// ─── 추가 blocking 탐지 ─────────────────────────────────────────────────────
function detectLitCorrespondenceAbsent(c, setId) {
  // 문학 세트 + 선지에 (가)/(나)/(다) 지시 또는 인용 표현 또는 원문자 있는데
  // cs_ids 비어있거나 cs_spans 전부 fallback이면 "작품/인용 대응 신호 전무"
  const section = sectionOf(setId);
  if (section !== "literature") return false;
  const t = c.t || "";
  const hasWorkTag = /\((가|나|다|라)\)/.test(t);
  const hasMarker = MARKER_RE.test(t);
  const hasQuote = /['‘][^'’]{2,}['’]|["“][^"”]{2,}["”]/.test(t);
  if (!hasWorkTag && !hasMarker && !hasQuote) return false;
  const emptyCs = !Array.isArray(c.cs_ids) || c.cs_ids.length === 0;
  const emptySpans = !Array.isArray(c.cs_spans) || c.cs_spans.length === 0;
  if (emptyCs && c.ok !== false) return true;
  if (emptyCs && c.ok === false && !AUTO_EMPTY_PATS.has(c.pat)) return true;
  return false;
}

function detectSourceTextPollution(c, sents) {
  // cs_ids가 가리키는 sent text에 내부 ID 노출·원문자 대량·깨진 라벨이 있으면 오염 의심
  const ids = c.cs_ids || [];
  if (ids.length === 0) return false;
  const sentById = new Map(sents.map((s) => [s.id, s]));
  for (const id of ids) {
    const s = sentById.get(id);
    if (!s) continue;
    const t = s.t || "";
    if (ID_LEAK_RE.test(t)) return true;
    if (/\[\[[RL]\d\]\d\]/.test(t)) return true;
    // 원문자가 1문장에 3개 이상 몰려 있으면 파싱 흔적 의심
    const mc = (t.match(/[①-⑳]/g) || []).length;
    if (mc >= 3) return true;
  }
  return false;
}

// ─── 필드 상태 분류 ─────────────────────────────────────────────────────────
function classifyField(c, field, ctx) {
  const { setId, sents } = ctx;
  switch (field) {
    case "ok": {
      if (c.ok === true || c.ok === false) return "direct";
      return "invalid";
    }
    case "pat": {
      if (c.ok === true) return c.pat == null ? "direct" : "transformable";
      if (c.ok === false) {
        if (typeof c.pat === "string" && VALID_PATS.has(c.pat)) {
          return detectPatDomainMismatch(c, setId) ? "transformable" : "direct";
        }
        return c.pat == null ? "regenerate" : "transformable";
      }
      return "invalid";
    }
    case "analysis": {
      const a = c.analysis || "";
      if (!a.trim()) return "regenerate";
      if (detectOkConflict(c)) return "transformable"; // 결론 수정으로 복구
      if (/📌\s*지문\s*근거\s*:\s*["“]/.test(a)) return "direct";
      if (/📌\s*지문\s*근거\s*:/.test(a)) return "transformable";
      return "regenerate";
    }
    case "cs_ids": {
      if (!Array.isArray(c.cs_ids)) return "invalid";
      const emptyOk = c.cs_ids.length === 0;
      if (detectMissingRequiredCsIds(c)) return "regenerate";
      if (emptyOk && AUTO_EMPTY_PATS.has(c.pat)) return "direct";
      const validIds = new Set(sents.map((s) => s.id));
      if (c.cs_ids.some((id) => !validIds.has(id))) return "regenerate"; // DEAD
      return "direct";
    }
    case "cs_spans": {
      if (!Array.isArray(c.cs_spans)) {
        // 필드 자체가 없더라도 analysis 인용에서 파생 가능
        const a = c.analysis || "";
        if (/📌\s*지문\s*근거\s*:\s*["“]/.test(a)) return "transformable";
        return "regenerate";
      }
      if (c.cs_spans.length === 0) {
        if (AUTO_EMPTY_PATS.has(c.pat) && c.ok === false) return "direct";
        const a = c.analysis || "";
        if (/📌\s*지문\s*근거\s*:\s*["“]/.test(a)) return "transformable";
        return "regenerate";
      }
      if (detectCsSpansIdMismatch(c)) return "transformable";
      if (detectAllSpansFallback(c, sents)) return "transformable";
      return "direct";
    }
    case "conditions": {
      // 신규 스키마 필드. 현재 데이터에 미존재 → analysis에서 ①②③ 분해 있으면 transformable
      if (Array.isArray(c.conditions) && c.conditions.length > 0) return "direct";
      const a = c.analysis || "";
      if (/①|②|③|❶|❷|❸|첫째|둘째|조건\s*분해/.test(a)) return "transformable";
      return c.ok === false ? "regenerate" : "transformable";
    }
    case "reasoning": {
      if (typeof c.reasoning === "string" && c.reasoning.length > 40)
        return "direct";
      const a = c.analysis || "";
      // 🔍 블록이 있으면 추출 가능
      if (/🔍[^✅❌]{20,}/.test(a)) return "transformable";
      return "regenerate";
    }
    case "evidence_quote": {
      if (typeof c.evidence_quote === "string" && c.evidence_quote.length >= 4)
        return "direct";
      const a = c.analysis || "";
      const m = a.match(/📌\s*지문\s*근거\s*:\s*["“]([^"”]{4,})["”]/);
      if (m) return "transformable";
      return "regenerate";
    }
    default:
      return "invalid";
  }
}

// ─── 5축 점수 ───────────────────────────────────────────────────────────────
function score5Axis(c, ctx) {
  const { setId, sents } = ctx;
  const ana = c.analysis || "";

  // 1) 구조 존재성 (20)
  let a1 = 0;
  if (typeof c.t === "string" && c.t.length > 0) a1 += 3;
  if (c.ok === true || c.ok === false) a1 += 4;
  if ("pat" in c) a1 += 3;
  if (typeof c.analysis === "string" && c.analysis.length > 0) a1 += 4;
  if (Array.isArray(c.cs_ids)) a1 += 3;
  if (Array.isArray(c.cs_spans)) a1 += 3;
  if (a1 > 20) a1 = 20;

  // 2) 정합성 (30)
  let a2 = 30;
  if (!/📌\s*지문\s*근거\s*:\s*["“]/.test(ana)) a2 -= 8;
  if (!/[✅❌]/.test(ana) && ana.trim()) a2 -= 4;
  if (typeof c.pat === "string") {
    const wrong =
      /^R[1-4]$/.test(c.pat)
        ? /\[L[1-5]\]/
        : /^L[1-5]$/.test(c.pat)
          ? /\[R[1-4]\]/
          : null;
    if (wrong && wrong.test(ana)) a2 -= 6;
  }
  if (c.ok === true && c.pat != null) a2 -= 4;
  if (c.pat === "V") {
    if ((c.cs_ids || []).length > 0) a2 -= 2;
    if ((c.cs_spans || []).length > 0) a2 -= 2;
  }
  if (Array.isArray(c.cs_spans) && c.cs_spans.length > 0) {
    const ids = new Set(c.cs_ids || []);
    if (c.cs_spans.some((s) => !ids.has(s.sent_id))) a2 -= 4;
  }
  if (ID_LEAK_RE.test(ana)) a2 -= 4;
  if (/\[\[[RL]\d\]\d\]/.test(ana)) a2 -= 2;
  if (a2 < 0) a2 = 0;

  // 3) 파생 가능성 (20)
  let a3 = 0;
  if (/📌\s*지문\s*근거\s*:\s*["“]([^"”]{4,})["”]/.test(ana)) a3 += 8;
  else if (/📌\s*지문\s*근거\s*:/.test(ana)) a3 += 3;
  if (
    Array.isArray(c.cs_spans) &&
    c.cs_spans.length > 0 &&
    !detectAllSpansFallback(c, sents)
  )
    a3 += 6;
  const validIds = new Set(sents.map((s) => s.id));
  if (Array.isArray(c.cs_ids)) {
    const allValid = c.cs_ids.every((id) => validIds.has(id));
    if (allValid && (c.cs_ids.length > 0 || AUTO_EMPTY_PATS.has(c.pat)))
      a3 += 4;
  }
  if (c.ok === false && /\[[RL][1-5]\]|\[V\]/.test(ana)) a3 += 2;
  if (a3 > 20) a3 = 20;

  // 4) 학습 효용 (20)
  let a4 = 0;
  if (c.ok === false && /①|②|③|❶|❷|❸|첫째|둘째/.test(ana)) a4 += 6;
  const hasMarker = MARKER_RE.test(c.t || "") || /['‘][^'’]{2,}['’]|["“][^"”]{2,}["”]/.test(c.t || "");
  if (hasMarker) {
    if (/기능|상징|효과|평가|표현|의미|강조/.test(ana)) a4 += 6;
    else a4 += 2;
  } else a4 += 4;
  if (c.ok === false && /왜|때문|으므로|으로 인해/.test(ana)) a4 += 4;
  else if (c.ok === true && /일치|부합|확인|해당/.test(ana)) a4 += 4;
  if (ana.length >= 200) a4 += 4;
  else if (ana.length >= 100) a4 += 2;
  if (a4 > 20) a4 = 20;

  // 5) 운영 리스크 (10, 감점식)
  let a5 = 10;
  if (/\[\[[RL]\d\]\d\]/.test(ana)) a5 -= 3;
  if (Array.isArray(c.cs_ids) && c.cs_ids.some((id) => !validIds.has(id))) a5 -= 5;
  if (!ana.trim()) a5 -= 4;
  if (detectSourceTextPollution(c, sents)) a5 -= 2;
  if (a5 < 0) a5 = 0;

  let base = a1 + a2 + a3 + a4 + a5;

  // 즉시 감점
  const penalties = [];
  if (detectOkConflict(c)) penalties.push({ code: "ok_conclusion_conflict", minus: 40 });
  if (detectPatDomainMismatch(c, setId))
    penalties.push({ code: "pat_domain_mismatch", minus: 40 });
  if (detectMissingRequiredCsIds(c))
    penalties.push({ code: "missing_required_cs_ids", minus: 40 });
  if (detectCsSpansIdMismatch(c))
    penalties.push({ code: "cs_spans_id_mismatch", minus: 20 });
  if (detectAllSpansFallback(c, sents))
    penalties.push({ code: "all_spans_fallback", minus: 20 });

  let total = base;
  for (const p of penalties) total -= p.minus;
  if (total < 0) total = 0;
  if (total > 100) total = 100;

  // release-sensitive blocking (상위 카테고리)
  const blockingCodes = new Set();
  if (penalties.some((p) => p.code === "ok_conclusion_conflict"))
    blockingCodes.add("ok_conclusion_conflict");
  if (penalties.some((p) => p.code === "pat_domain_mismatch"))
    blockingCodes.add("pat_domain_mismatch");
  if (penalties.some((p) => p.code === "missing_required_cs_ids"))
    blockingCodes.add("missing_required_cs_ids");
  if (detectLitCorrespondenceAbsent(c, setId))
    blockingCodes.add("lit_correspondence_absent");
  if (detectSourceTextPollution(c, sents))
    blockingCodes.add("source_text_pollution");

  return {
    total,
    axes: { a1, a2, a3, a4, a5 },
    penalties,
    blocking: [...blockingCodes],
  };
}

function gradeOf(total) {
  if (total >= 85) return "A";
  if (total >= 70) return "B";
  if (total >= 50) return "C";
  return "D";
}

// ─── 시험 수준 마이그레이션 라우트 추천 ─────────────────────────────────────
function recommendRoute(examSummary) {
  const { avg, grades, blockingPct, fieldPct } = examSummary;
  const aPct = grades.A_pct;
  const dPct = grades.D_pct;
  const regenHeavy =
    fieldPct.cs_spans.regenerate > 40 ||
    fieldPct.analysis.regenerate > 30 ||
    fieldPct.evidence_quote.regenerate > 50;

  if (avg >= 85 && blockingPct <= 3 && !regenHeavy)
    return {
      route: "direct_port",
      note: "현 데이터를 신규 스키마로 그대로 이식. 린트만 확인.",
    };
  if (avg >= 70 && blockingPct <= 10 && !regenHeavy)
    return {
      route: "lint_and_port",
      note: "pat·라벨 자동 교정 + extract-spans 적용 후 이식.",
    };
  if (avg >= 60 && blockingPct <= 25)
    return {
      route: "transform_and_port",
      note: "cs_spans / evidence_quote 변환 파생 + analysis 포맷 재정렬 후 이식.",
    };
  if (avg >= 50 || dPct < 25)
    return {
      route: "partial_regen",
      note: "blocking 선지 우선 재생성(reanalyze_format 등) + 나머지 변환 이식.",
    };
  return {
    route: "full_regen",
    note: "재사용 어려움. 신규 스키마 기준으로 재생성 파이프 전면 가동.",
  };
}

// ─── 메인 평가 루프 ─────────────────────────────────────────────────────────
const examsToProcess = EXAM_FILTER
  ? [EXAM_FILTER]
  : Object.keys(data);

const choiceReport = []; // per-choice rows
const setReport = []; // per-set aggregates
const examReport = {}; // per-exam aggregates

const FIELDS = [
  "ok",
  "pat",
  "analysis",
  "cs_ids",
  "cs_spans",
  "conditions",
  "reasoning",
  "evidence_quote",
];

function emptyFieldCounter() {
  const o = {};
  for (const f of FIELDS) o[f] = { direct: 0, transformable: 0, regenerate: 0, invalid: 0 };
  return o;
}

for (const exam of examsToProcess) {
  if (!data[exam]) {
    console.warn(`⚠️ ${exam} 없음 — 스킵`);
    continue;
  }
  const examFields = emptyFieldCounter();
  const examGrades = { A: 0, B: 0, C: 0, D: 0 };
  const examBlockingCounts = {};
  const examPenaltyCounts = {};
  let examChoiceCount = 0;
  let examSumTotal = 0;
  let examBlockingCount = 0;

  for (const sec of ["reading", "literature"]) {
    for (const set of data[exam][sec] || []) {
      if (SET_FILTER && set.id !== SET_FILTER) continue;
      const sents = set.sents || [];
      const setFields = emptyFieldCounter();
      const setGrades = { A: 0, B: 0, C: 0, D: 0 };
      let setChoiceCount = 0;
      let setSumTotal = 0;
      let setBlockingCount = 0;

      for (const q of set.questions || []) {
        for (const c of q.choices || []) {
          const ctx = { setId: set.id, sents };
          const s = score5Axis(c, ctx);
          const fieldStatus = {};
          for (const f of FIELDS) {
            fieldStatus[f] = classifyField(c, f, ctx);
            setFields[f][fieldStatus[f]]++;
            examFields[f][fieldStatus[f]]++;
          }
          const g = gradeOf(s.total);
          setGrades[g]++;
          examGrades[g]++;
          setSumTotal += s.total;
          examSumTotal += s.total;
          setChoiceCount++;
          examChoiceCount++;
          if (s.blocking.length > 0) {
            setBlockingCount++;
            examBlockingCount++;
            for (const b of s.blocking)
              examBlockingCounts[b] = (examBlockingCounts[b] || 0) + 1;
          }
          for (const p of s.penalties)
            examPenaltyCounts[p.code] =
              (examPenaltyCounts[p.code] || 0) + 1;

          choiceReport.push({
            exam,
            section: sec,
            setId: set.id,
            qId: q.id,
            num: c.num,
            ok: c.ok,
            pat: c.pat,
            total: s.total,
            grade: g,
            axes: s.axes,
            penalties: s.penalties.map((p) => p.code),
            blocking: s.blocking,
            fields: fieldStatus,
          });
        }
      }

      if (setChoiceCount > 0) {
        const avg = setSumTotal / setChoiceCount;
        const fieldPct = {};
        for (const f of FIELDS) {
          fieldPct[f] = {
            direct: +((setFields[f].direct / setChoiceCount) * 100).toFixed(1),
            transformable: +(
              (setFields[f].transformable / setChoiceCount) * 100
            ).toFixed(1),
            regenerate: +(
              (setFields[f].regenerate / setChoiceCount) * 100
            ).toFixed(1),
            invalid: +((setFields[f].invalid / setChoiceCount) * 100).toFixed(1),
          };
        }
        setReport.push({
          exam,
          section: sec,
          setId: set.id,
          choice_count: setChoiceCount,
          average_score: +avg.toFixed(2),
          grade_counts: setGrades,
          blocking_count: setBlockingCount,
          blocking_pct: +((setBlockingCount / setChoiceCount) * 100).toFixed(1),
          field_pct: fieldPct,
        });
      }
    }
  }

  if (examChoiceCount > 0) {
    const avg = examSumTotal / examChoiceCount;
    const grades = {
      A: examGrades.A,
      B: examGrades.B,
      C: examGrades.C,
      D: examGrades.D,
      A_pct: +((examGrades.A / examChoiceCount) * 100).toFixed(1),
      B_pct: +((examGrades.B / examChoiceCount) * 100).toFixed(1),
      C_pct: +((examGrades.C / examChoiceCount) * 100).toFixed(1),
      D_pct: +((examGrades.D / examChoiceCount) * 100).toFixed(1),
    };
    const fieldPct = {};
    for (const f of FIELDS) {
      fieldPct[f] = {
        direct: +((examFields[f].direct / examChoiceCount) * 100).toFixed(1),
        transformable: +(
          (examFields[f].transformable / examChoiceCount) * 100
        ).toFixed(1),
        regenerate: +(
          (examFields[f].regenerate / examChoiceCount) * 100
        ).toFixed(1),
        invalid: +((examFields[f].invalid / examChoiceCount) * 100).toFixed(1),
      };
    }
    const blockingPct = +(
      (examBlockingCount / examChoiceCount) * 100
    ).toFixed(1);

    const summary = {
      avg,
      grades,
      blockingPct,
      fieldPct,
    };
    const recommendation = recommendRoute(summary);

    examReport[exam] = {
      choice_count: examChoiceCount,
      average_score: +avg.toFixed(2),
      grade_counts: {
        A: examGrades.A,
        B: examGrades.B,
        C: examGrades.C,
        D: examGrades.D,
      },
      grade_pct: {
        A: grades.A_pct,
        B: grades.B_pct,
        C: grades.C_pct,
        D: grades.D_pct,
      },
      release_sensitive_blocking: {
        count: examBlockingCount,
        pct: blockingPct,
        by_code: examBlockingCounts,
      },
      immediate_penalty_counts: examPenaltyCounts,
      field_compatibility: fieldPct,
      migration_route: recommendation,
    };
  }
}

// ─── 저장 ────────────────────────────────────────────────────────────────────
const generatedAt = new Date().toISOString();
const meta = {
  generated_at: generatedAt,
  exam_filter: EXAM_FILTER,
  set_filter: SET_FILTER,
  grade_thresholds: { A: 85, B: 70, C: 50, D: 0 },
};
const outChoice = path.join(REPORT_DIR, "compatibility_choice.json");
const outSet = path.join(REPORT_DIR, "compatibility_set.json");
const outExam = path.join(REPORT_DIR, "compatibility_exam.json");

fs.writeFileSync(
  outChoice,
  JSON.stringify({ meta, choices: choiceReport }, null, 2),
  "utf8",
);
fs.writeFileSync(
  outSet,
  JSON.stringify({ meta, sets: setReport }, null, 2),
  "utf8",
);
fs.writeFileSync(
  outExam,
  JSON.stringify({ meta, exams: examReport }, null, 2),
  "utf8",
);

// ─── 콘솔 출력 ───────────────────────────────────────────────────────────────
console.log("═".repeat(60));
console.log(" evaluate_compatibility — 결과 요약");
console.log("═".repeat(60));
for (const [exam, r] of Object.entries(examReport)) {
  console.log(`\n[${exam}]`);
  console.log(`  선지: ${r.choice_count}  평균: ${r.average_score}`);
  console.log(
    `  A ${r.grade_counts.A} (${r.grade_pct.A}%) / B ${r.grade_counts.B} (${r.grade_pct.B}%) / C ${r.grade_counts.C} (${r.grade_pct.C}%) / D ${r.grade_counts.D} (${r.grade_pct.D}%)`,
  );
  console.log(
    `  blocking: ${r.release_sensitive_blocking.count} (${r.release_sensitive_blocking.pct}%)`,
  );
  console.log(`  blocking by_code: ${JSON.stringify(r.release_sensitive_blocking.by_code)}`);
  console.log(`  immediate_penalty: ${JSON.stringify(r.immediate_penalty_counts)}`);
  if (VERBOSE) {
    console.log(`  field_compatibility:`);
    for (const [f, pct] of Object.entries(r.field_compatibility)) {
      console.log(
        `    ${f.padEnd(16)} direct ${pct.direct}% / transformable ${pct.transformable}% / regenerate ${pct.regenerate}% / invalid ${pct.invalid}%`,
      );
    }
  }
  console.log(
    `  migration_route: ${r.migration_route.route} — ${r.migration_route.note}`,
  );
}

if (VERBOSE && setReport.length > 0) {
  console.log("\n--- 세트별 요약 ---");
  for (const s of setReport) {
    console.log(
      `  [${s.exam}] ${s.setId.padEnd(14)} 선지 ${s.choice_count}  평균 ${s.average_score}  blocking ${s.blocking_count} (${s.blocking_pct}%)`,
    );
  }
}

console.log(`\n📄 저장: ${path.relative(ROOT, outChoice)}`);
console.log(`📄 저장: ${path.relative(ROOT, outSet)}`);
console.log(`📄 저장: ${path.relative(ROOT, outExam)}`);
