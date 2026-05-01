/**
 * pipeline/validate_choice_consistency.mjs
 *
 * migrate 전 차단 규칙 고정. 이 파일이 통과해야 migrate 허용.
 *
 * [GPT 검수 반영 — 2026-04-20]
 *   - R→L 자동 도메인 교체는 기본 OFF.
 *     예외 허용 조건 3개를 모두 만족해야 semantic auto_fix 허용:
 *       ① domain mismatch 외 다른 BLOCK 없음 (solo)
 *       ② analysis에 대상 pat의 signal 키워드 명시적 존재
 *       ③ choice_text 판단 축이 pat 정의와 직접 일치
 *     아니면 needs_human_quality 로 라우팅.
 *   - polarity unknown 세분화:
 *       ① analysis=="" → empty_analysis
 *       ② non-empty + conclusion signal 없음 → needs_human_release_sensitive
 *       ③ non-empty + positive/negative 충돌 → needs_human_release_sensitive
 *       ④ non-empty + polarity unknown + 📌 quote/🔍 reason 존재 → reanalyze_format_queue
 *
 * CRITICAL (BLOCK):
 *   1. ok↔결론 polarity 충돌
 *   2. ok:true & pat != null                   (formal auto_fix)
 *   3. ok:false & pat == null (R3/V 제외)
 *   4. domain ↔ pat / 라벨 mismatch             (semantic auto_fix only if exception)
 *   5. cs_ids 필수인데 empty (R3/V 제외)
 *   6. cs_spans.sent_id ⊄ cs_ids
 *   7. empty_analysis / no_conclusion_signal / unknown_polarity_with_quote
 *
 * WARNING:
 *   A. 문학 quote signal 누락
 *   B. 문학 복수 작품 태그 누락
 *
 * 라우팅 (route 필드):
 *   - auto_fix_formal              : 기계적 정리 (ok:true pat→null)
 *   - auto_fix_semantic            : 예외 조건 만족하는 도메인 교체
 *   - needs_human_quality          : 도메인 교체지만 신호 미충족
 *   - needs_human_release_sensitive: polarity 충돌·결론 신호 부재·cs_ids 필수 부재 등
 *   - reanalyze_format_queue       : unknown polarity + quote/reason 존재 → AI 재생성 큐
 *
 * 추가 report 필드 (choice findings):
 *   - route
 *   - auto_fix_confidence: "formal" | "semantic" | null
 *   - semantic_preservation: boolean | null
 *   - semantic_basis: string[]  (["analysis_pattern_signal","choice_axis_match"] 등)
 *
 * CLI (PowerShell):
 *   cd C:/Users/downf/suneung-viewer
 *   node pipeline/validate_choice_consistency.mjs --exam 2026수능
 *   node pipeline/validate_choice_consistency.mjs --exam 2026수능 --set l2026a
 *   node pipeline/validate_choice_consistency.mjs --fix
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DATA_PATH = path.join(ROOT, "public", "data", "all_data_204.json");
const REPORT_DIR = path.join(__dirname, "reports");

// ─── CLI ─────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
function getArg(name) {
  const i = args.indexOf(name);
  return i >= 0 && i + 1 < args.length && !args[i + 1].startsWith("--")
    ? args[i + 1]
    : null;
}
const EXAM_FILTER = getArg("--exam");
const SET_FILTER = getArg("--set");
const FIX = args.includes("--fix");

// ─── 상수 ────────────────────────────────────────────────────────────────────
const REQUIRES_CS_PATS = new Set(["R1", "R2", "R4", "L1", "L2", "L4", "L5"]);
const AUTO_EMPTY_PATS = new Set(["R3", "V"]);
const VALID_PATS = new Set([
  "R1", "R2", "R3", "R4",
  "L1", "L2", "L3", "L4", "L5",
  "V",
]);

// 도메인 위반 코드 집합
const DOMAIN_CODES = new Set([
  "reading_L_pat",
  "literature_R_pat",
  "label_domain_mismatch",
]);

// R→L / L→R 교차 매핑 (오류 성격 보존)
const CROSS_L_TO_R = { L1: "R1", L2: "R1", L3: "R3", L4: "R2", L5: "R4" };
const CROSS_R_TO_L = { R1: "L1", R2: "L4", R3: "L3", R4: "L1" };

// pat → analysis signal 키워드
const PAT_SIGNAL = {
  R1: /사실\s*왜곡|팩트\s*왜곡|정반대|역전|수치\s*왜곡|상태\s*왜곡/,
  R2: /인과|관계\s*전도|주체-객체|뒤바|바꿔치기/,
  R3: /과도한\s*추론|과잉\s*추론|지문에\s*없|근거\s*부재|비약|외삽/,
  R4: /개념\s*혼합|개념\s*짜깁기|개념어\s*혼동/,
  L1: /시어|이미지|표현|수사|형식\s*오독|표기\s*오독/,
  L2: /정서|감정|심리|태도\s*오독|정서\s*오독/,
  L3: /주제\s*과잉|의미\s*과잉|확대\s*해석|지문에\s*없/,
  L4: /구조|맥락|시점|시간\s*관계|순서|구성|장면\s*전환|서사/,
  L5: /보기\s*대입|보기\s*조건|보기\s*오독/,
  V: /문맥\s*속\s*의미|치환|바꿔\s*쓰/,
};

// pat → choice text 축 키워드
const CHOICE_AXIS = {
  R1: /(이다|있다|없다|된다|한다|서술|명시|직접)/,
  R2: /(때문|~으로|으로 인해|원인|결과|따라서|그래서)/,
  R3: /(일반화|~으므로|따라서|모든|항상|결코)/,
  R4: /(개념|정의|용어|분류)/,
  L1: /(표현|시어|이미지|수사|반복|변주|대구|점층)/,
  L2: /(정서|감정|태도|심리|마음|느끼|생각)/,
  L3: /(의미|상징|주제|암시|비유)/,
  L4: /(구조|시점|시간|공간|전환|장면|배경|시간 관계)/,
  L5: /(보기|조건|관점|전제)/,
  V: /.*/, // 어휘 문제는 choice 형식만으로 판단 불가
};

function sectionOf(setId) {
  const s = String(setId || "");
  if (s[0] === "r" || s.startsWith("kor") || s.startsWith("sep")) return "reading";
  if (s[0] === "l" || s.startsWith("lsep")) return "literature";
  return null;
}

// ─── polarity 탐지 ───────────────────────────────────────────────────────────
// 반환: { polarity: 'positive'|'negative'|'unknown', signal: 'emoji'|'text'|'none' }
function detectPolarity(analysis) {
  if (typeof analysis !== "string" || !analysis.trim())
    return { polarity: "unknown", signal: "none" };
  const a = analysis;

  const lastCheck = Math.max(a.lastIndexOf("✅"), a.lastIndexOf("❌"));
  if (lastCheck >= 0) {
    const tail = a.slice(lastCheck);
    if (tail.startsWith("✅")) return { polarity: "positive", signal: "emoji" };
    if (tail.startsWith("❌")) return { polarity: "negative", signal: "emoji" };
  }

  const negPatterns = [
    /부적절/,
    /어긋나/,
    /잘못\s*(읽|이해|해석|분류|파악)/,
    /왜곡/,
    /맞지\s*않/,
    /일치하지\s*않/,
    /정반대/,
    /적절하지\s*않/,
    /적절치\s*않/,
    /옳지\s*않/,
    /지문과\s*어긋/,
  ];
  for (const re of negPatterns) if (re.test(a))
    return { polarity: "negative", signal: "text" };

  const posPatterns = [
    /(?<!부)적절(?!하지|치\s*않)/,
    /일치(?!하지)/,
    /부합/,
    /올바르/,
    /합당/,
    /적절한\s*진술/,
    /적절한\s*설명/,
  ];
  for (const re of posPatterns) if (re.test(a))
    return { polarity: "positive", signal: "text" };

  return { polarity: "unknown", signal: "none" };
}

// ─── 검사기 ──────────────────────────────────────────────────────────────────
function check_analysis_state(c) {
  // ① empty_analysis
  if (typeof c.analysis !== "string" || !c.analysis.trim()) {
    return {
      code: "empty_analysis",
      severity: "BLOCK",
      route: "needs_human_release_sensitive",
      message: "analysis 비어있음",
    };
  }
  const pol = detectPolarity(c.analysis);
  const hasQuote = /📌\s*지문\s*근거\s*:\s*["“]([^"”]{4,})["”]/.test(c.analysis);
  const hasReason = /🔍[^\n]{15,}/.test(c.analysis);

  // ③ polarity 충돌
  if (c.ok === true && pol.polarity === "negative")
    return {
      code: "ok_true_conclusion_negative",
      severity: "BLOCK",
      route: "needs_human_release_sensitive",
      message: `ok:true 인데 analysis polarity=negative (${pol.signal})`,
    };
  if (c.ok === false && pol.polarity === "positive")
    return {
      code: "ok_false_conclusion_positive",
      severity: "BLOCK",
      route: "needs_human_release_sensitive",
      message: `ok:false 인데 analysis polarity=positive (${pol.signal})`,
    };

  // ② no conclusion signal (non-empty + polarity unknown + quote/reason 없음)
  if (pol.polarity === "unknown" && !hasQuote && !hasReason)
    return {
      code: "no_conclusion_signal",
      severity: "BLOCK",
      route: "needs_human_release_sensitive",
      message: "결론 신호(✅/❌ or 텍스트 polarity) 부재",
    };
  // ④ unknown polarity + quote/reason 존재 → reanalyze 큐
  if (pol.polarity === "unknown" && (hasQuote || hasReason))
    return {
      code: "unknown_polarity_with_quote",
      severity: "BLOCK",
      route: "reanalyze_format_queue",
      message: "결론 신호 없음 — 📌 인용 또는 🔍 reasoning 존재 → reanalyze_format 큐",
    };
  return null;
}

function check_true_has_pat(c) {
  if (c.ok === true && c.pat != null)
    return {
      code: "true_has_pat",
      severity: "BLOCK",
      route: "auto_fix_formal",
      message: `ok:true 인데 pat=${c.pat} (null 이어야 함)`,
    };
  return null;
}

function check_false_null_pat(c) {
  if (c.ok === false && c.pat == null)
    return {
      code: "false_null_pat",
      severity: "BLOCK",
      route: "needs_human_release_sensitive",
      message: "ok:false 인데 pat==null (R3/V 예외 아님)",
    };
  return null;
}

function check_domain(c, setId) {
  const sec = sectionOf(setId);
  const isR = typeof c.pat === "string" && /^R[1-4]$/.test(c.pat);
  const isL = typeof c.pat === "string" && /^L[1-5]$/.test(c.pat);
  if (sec === "reading" && isL)
    return {
      code: "reading_L_pat",
      severity: "BLOCK",
      route: "needs_human_quality", // 기본 → 예외 검증 후 승격
      message: `독서 세트(${setId})인데 pat=${c.pat} (L계열)`,
      target_pat: CROSS_L_TO_R[c.pat] || "R1",
    };
  if (sec === "literature" && isR)
    return {
      code: "literature_R_pat",
      severity: "BLOCK",
      route: "needs_human_quality",
      message: `문학 세트(${setId})인데 pat=${c.pat} (R계열)`,
      target_pat: CROSS_R_TO_L[c.pat] || "L1",
    };
  const ana = c.analysis || "";
  if (isR && /\[L[1-5]\]/.test(ana))
    return {
      code: "label_domain_mismatch",
      severity: "BLOCK",
      route: "needs_human_quality",
      message: `pat=${c.pat} 인데 analysis에 [L*] 라벨`,
      target_pat: c.pat,
    };
  if (isL && /\[R[1-4]\]/.test(ana))
    return {
      code: "label_domain_mismatch",
      severity: "BLOCK",
      route: "needs_human_quality",
      message: `pat=${c.pat} 인데 analysis에 [R*] 라벨`,
      target_pat: c.pat,
    };
  return null;
}

function check_required_cs_ids(c) {
  const empty = !Array.isArray(c.cs_ids) || c.cs_ids.length === 0;
  if (!empty) return null;
  if (c.ok === true)
    return {
      code: "missing_cs_ids_true",
      severity: "BLOCK",
      route: "needs_human_release_sensitive",
      message: "ok:true 인데 cs_ids=[]",
    };
  if (
    c.ok === false &&
    typeof c.pat === "string" &&
    REQUIRES_CS_PATS.has(c.pat)
  )
    return {
      code: "missing_cs_ids_required_pat",
      severity: "BLOCK",
      route: "needs_human_release_sensitive",
      message: `ok:false + pat=${c.pat} 인데 cs_ids=[]`,
    };
  return null;
}

function check_spans_ids_mismatch(c) {
  if (!Array.isArray(c.cs_spans) || c.cs_spans.length === 0) return null;
  const ids = new Set(c.cs_ids || []);
  const bad = c.cs_spans.filter((s) => !s || !ids.has(s.sent_id));
  if (bad.length === 0) return null;
  return {
    code: "spans_sent_id_mismatch",
    severity: "BLOCK",
    route: "needs_human_release_sensitive",
    message: `cs_spans.sent_id ⊄ cs_ids (${bad.length}건)`,
  };
}

// ─── WARNING ────────────────────────────────────────────────────────────────
function _norm(s) {
  return String(s || "")
    .replace(/[ⓐ-ⓩⒶ-Ⓩ㉠-㉯①-⑳]|\[[A-E]\]|[「」『』【】()（）\[\]{}]|[\u4E00-\u9FFF]|[·ㆍ‧,.!?;:*…"“”'‘’`´]/g, "")
    .replace(/\s+/g, "");
}
function check_literature_signals(c, setId) {
  const sec = sectionOf(setId);
  if (sec !== "literature") return [];
  const t = c.t || "";
  const ana = c.analysis || "";
  const warns = [];
  const innerQuoteRe = /['‘]([^'’\n]{3,})['’]|["“]([^"”\n]{3,})["”]/g;
  const quotes = [];
  for (const m of t.matchAll(innerQuoteRe)) {
    const q = (m[1] || m[2] || "").trim();
    if (q.length >= 3) quotes.push(q);
  }
  if (quotes.length > 0) {
    const anaNorm = _norm(ana);
    const missing = quotes.filter((q) => !anaNorm.includes(_norm(q)));
    if (missing.length > 0) {
      warns.push({
        code: "literature_quote_signal_missing",
        severity: "WARNING",
        route: "needs_human_quality",
        message: `선지 인용 ${missing.length}건이 analysis에 부재`,
      });
    }
  }
  const tagsInT = [...new Set((t.match(/\((가|나|다|라)\)/g) || []))];
  if (tagsInT.length >= 2 && !/\((가|나|다|라)\)/.test(ana)) {
    warns.push({
      code: "literature_work_target_missing",
      severity: "WARNING",
      route: "needs_human_quality",
      message: `선지 복수 작품 언급(${tagsInT.join("·")})인데 analysis에 작품 태그 없음`,
    });
  }
  return warns;
}

// ─── 예외 허용 판정 (domain mismatch → semantic auto_fix) ───────────────────
function evaluateSemanticException(c, setId, domainFinding, allFindings) {
  // ① 다른 BLOCK 없음 (도메인 코드만 단독)
  const otherBlocks = allFindings.filter(
    (f) => f.severity === "BLOCK" && !DOMAIN_CODES.has(f.code),
  );
  if (otherBlocks.length > 0)
    return {
      allowed: false,
      reason: "other_blocks_exist",
      basis: [],
    };
  const targetPat = domainFinding.target_pat;
  const signalRe = PAT_SIGNAL[targetPat];
  const axisRe = CHOICE_AXIS[targetPat];
  // ② analysis signal
  const analysisSignal = signalRe ? signalRe.test(c.analysis || "") : false;
  // ③ choice axis
  const choiceAxis = axisRe ? axisRe.test(c.t || "") : false;
  if (analysisSignal && choiceAxis) {
    return {
      allowed: true,
      auto_fix_confidence: "semantic",
      semantic_preservation: true,
      semantic_basis: ["analysis_pattern_signal", "choice_axis_match"],
    };
  }
  return {
    allowed: false,
    reason: analysisSignal
      ? "choice_axis_mismatch"
      : choiceAxis
        ? "analysis_signal_missing"
        : "signals_missing",
    basis: [],
  };
}

// ─── 자동 수정 적용 (--fix) ─────────────────────────────────────────────────
function applyFixFormal(c, finding) {
  if (finding.code === "true_has_pat") {
    c.pat = null;
    return true;
  }
  return false;
}
function applyFixSemantic(c, finding) {
  const target = finding.target_pat;
  if (!target) return false;
  const prev = c.pat;
  c.pat = target;
  if (c.analysis && typeof c.analysis === "string") {
    const wrongRe =
      finding.code === "reading_L_pat"
        ? /\[L[1-5]\]/g
        : finding.code === "literature_R_pat"
          ? /\[R[1-4]\]/g
          : /^R[1-4]$/.test(target)
            ? /\[L[1-5]\]/g
            : /\[R[1-4]\]/g;
    c.analysis = c.analysis.replace(wrongRe, `[${target}]`);
  }
  return prev !== target;
}

// ─── 로드 ────────────────────────────────────────────────────────────────────
if (!fs.existsSync(DATA_PATH)) {
  console.error(`❌ 데이터 없음: ${DATA_PATH}`);
  process.exit(1);
}
const data = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
fs.mkdirSync(REPORT_DIR, { recursive: true });

// ─── 메인 ────────────────────────────────────────────────────────────────────
const examsToProcess = EXAM_FILTER ? [EXAM_FILTER] : Object.keys(data);
const allFindings = [];
const appliedFixes = [];

const byExam = {};
const bySet = {};

function bump(bucket, key, n = 1) {
  bucket[key] = (bucket[key] || 0) + n;
}

for (const exam of examsToProcess) {
  if (!data[exam]) {
    console.warn(`⚠️ ${exam} 없음 — 스킵`);
    continue;
  }
  byExam[exam] = {
    block: 0,
    warn: 0,
    auto_fix_formal: 0,
    auto_fix_semantic: 0,
    needs_human_quality: 0,
    needs_human_release_sensitive: 0,
    reanalyze_format_queue: 0,
  };
  for (const sec of ["reading", "literature"]) {
    for (const set of data[exam][sec] || []) {
      if (SET_FILTER && set.id !== SET_FILTER) continue;
      const setKey = `${exam}/${set.id}`;
      bySet[setKey] = {
        exam,
        setId: set.id,
        block: 0,
        warn: 0,
        auto_fix_formal: 0,
        auto_fix_semantic: 0,
        needs_human_quality: 0,
        needs_human_release_sensitive: 0,
        reanalyze_format_queue: 0,
      };

      for (const q of set.questions || []) {
        for (const c of q.choices || []) {
          const loc = `${exam}/${set.id}/Q${q.id}/#${c.num}`;
          // 1) 기본 검사 결과 수집
          const raw = [];
          const ana = check_analysis_state(c);
          if (ana) raw.push(ana);
          const f2 = check_true_has_pat(c);
          if (f2) raw.push(f2);
          const f3 = check_false_null_pat(c);
          if (f3) raw.push(f3);
          const f4 = check_domain(c, set.id);
          if (f4) raw.push(f4);
          const f5 = check_required_cs_ids(c);
          if (f5) raw.push(f5);
          const f6 = check_spans_ids_mismatch(c);
          if (f6) raw.push(f6);
          raw.push(...check_literature_signals(c, set.id));

          // 2) domain mismatch 예외 허용 재평가
          for (const f of raw) {
            if (!DOMAIN_CODES.has(f.code)) continue;
            const ev = evaluateSemanticException(c, set.id, f, raw);
            if (ev.allowed) {
              f.route = "auto_fix_semantic";
              f.auto_fix_confidence = "semantic";
              f.semantic_preservation = true;
              f.semantic_basis = ev.semantic_basis;
            } else {
              f.route = "needs_human_quality";
              f.auto_fix_confidence = null;
              f.semantic_preservation = false;
              f.semantic_basis = [];
              f.semantic_decline_reason = ev.reason;
            }
          }

          // 3) formal confidence 지정 (ok:true pat!=null)
          for (const f of raw) {
            if (f.code === "true_has_pat") {
              f.auto_fix_confidence = "formal";
              f.semantic_preservation = null;
              f.semantic_basis = [];
            }
          }

          // 4) --fix 적용
          for (const f of raw) {
            const rec = { loc, exam, setId: set.id, qId: q.id, num: c.num, ...f };
            if (FIX && f.severity === "BLOCK") {
              if (f.route === "auto_fix_formal" && applyFixFormal(c, f)) {
                rec.fixed = true;
                appliedFixes.push(rec);
              } else if (
                f.route === "auto_fix_semantic" &&
                applyFixSemantic(c, f)
              ) {
                rec.fixed = true;
                appliedFixes.push(rec);
              }
            }
            allFindings.push(rec);

            // 집계
            if (f.severity === "BLOCK") {
              byExam[exam].block++;
              bySet[setKey].block++;
              byExam[exam][f.route] = (byExam[exam][f.route] || 0) + 1;
              bySet[setKey][f.route] = (bySet[setKey][f.route] || 0) + 1;
            } else {
              byExam[exam].warn++;
              bySet[setKey].warn++;
            }
          }
        }
      }
    }
  }
}

// 저장 (--fix)
if (FIX && appliedFixes.length > 0) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), "utf8");
}

// ─── 집계 ────────────────────────────────────────────────────────────────────
const routeCounts = {
  release_sensitive: 0,
  quality: 0,
  auto_fixed_formal: 0,
  auto_fixed_semantic: 0,
  reanalyze_queue: 0,
};
const routeTopCodes = {
  release_sensitive: {},
  quality: {},
  auto_fixed_formal: {},
  auto_fixed_semantic: {},
  reanalyze_queue: {},
};
function pushCode(bucket, code) {
  bucket[code] = (bucket[code] || 0) + 1;
}
for (const f of allFindings) {
  if (f.severity !== "BLOCK") continue;
  if (f.route === "needs_human_release_sensitive") {
    routeCounts.release_sensitive++;
    pushCode(routeTopCodes.release_sensitive, f.code);
  } else if (f.route === "needs_human_quality") {
    routeCounts.quality++;
    pushCode(routeTopCodes.quality, f.code);
  } else if (f.route === "auto_fix_formal") {
    routeCounts.auto_fixed_formal++;
    pushCode(routeTopCodes.auto_fixed_formal, f.code);
  } else if (f.route === "auto_fix_semantic") {
    routeCounts.auto_fixed_semantic++;
    pushCode(routeTopCodes.auto_fixed_semantic, f.code);
  } else if (f.route === "reanalyze_format_queue") {
    routeCounts.reanalyze_queue++;
    pushCode(routeTopCodes.reanalyze_queue, f.code);
  }
}

const totalBlock = allFindings.filter((f) => f.severity === "BLOCK").length;
const totalWarn = allFindings.filter((f) => f.severity === "WARNING").length;

const report = {
  meta: {
    generated_at: new Date().toISOString(),
    exam_filter: EXAM_FILTER,
    set_filter: SET_FILTER,
    fix_mode: FIX,
    auto_fix_semantic_exception_rules: [
      "no_other_BLOCK_on_choice",
      "analysis_pattern_signal",
      "choice_axis_match",
    ],
  },
  totals: {
    block: totalBlock,
    warning: totalWarn,
    applied_fixes: appliedFixes.length,
    routes: routeCounts,
  },
  route_top_codes: routeTopCodes,
  by_exam: byExam,
  by_set: Object.values(bySet),
  findings: allFindings,
  auto_fixed: appliedFixes,
};
const outPath = path.join(REPORT_DIR, "consistency_report.json");
fs.writeFileSync(outPath, JSON.stringify(report, null, 2), "utf8");

// ─── 콘솔 ────────────────────────────────────────────────────────────────────
console.log("═".repeat(60));
console.log(" validate_choice_consistency");
console.log("═".repeat(60));
if (EXAM_FILTER) console.log(` 대상: ${EXAM_FILTER}${SET_FILTER ? ` / ${SET_FILTER}` : ""}`);
if (FIX) console.log(" --fix 모드 (적용된 fixes: " + appliedFixes.length + ")");

console.log(`\n[총계]`);
console.log(`  BLOCK:   ${totalBlock}`);
console.log(`  WARNING: ${totalWarn}`);
console.log(`\n[라우팅]`);
console.log(`  release_sensitive:  ${routeCounts.release_sensitive}`);
console.log(`  quality:            ${routeCounts.quality}`);
console.log(`  auto_fixed_formal:  ${routeCounts.auto_fixed_formal}`);
console.log(`  auto_fixed_semantic:${routeCounts.auto_fixed_semantic}`);
console.log(`  reanalyze_queue:    ${routeCounts.reanalyze_queue}`);

console.log(`\n[연도별]`);
for (const [exam, s] of Object.entries(byExam)) {
  console.log(
    `  ${exam.padEnd(12)}  BLOCK ${s.block}  (RS ${s.needs_human_release_sensitive || 0} / Q ${s.needs_human_quality || 0} / Ff ${s.auto_fix_formal || 0} / Fs ${s.auto_fix_semantic || 0} / Rq ${s.reanalyze_format_queue || 0})  WARN ${s.warn}`,
  );
}

if (Object.keys(bySet).length > 0) {
  console.log(`\n[세트별 (BLOCK/WARN 0 초과만)]`);
  for (const s of Object.values(bySet)) {
    if (s.block + s.warn === 0) continue;
    console.log(
      `  [${s.exam}] ${s.setId.padEnd(14)}  BLOCK ${s.block}  WARN ${s.warn}`,
    );
  }
}

const top = allFindings.filter((f) => f.severity === "BLOCK").slice(0, 15);
if (top.length > 0) {
  console.log(`\n[BLOCK 상세 (상위 15건)]`);
  for (const f of top) {
    console.log(
      `  [${f.code}|${f.route}] ${f.loc}${f.fixed ? " (fixed)" : ""}: ${f.message}`,
    );
  }
}

console.log(`\n📄 저장: ${path.relative(ROOT, outPath)}`);

const unresolvedBlock = allFindings.filter(
  (f) => f.severity === "BLOCK" && !f.fixed,
).length;
if (unresolvedBlock > 0) {
  console.log(`\n🔴 migrate 차단 — BLOCK ${unresolvedBlock}건 (auto_fix 미적용 또는 needs_human)`);
  process.exit(2);
} else {
  console.log(`\n✅ migrate 허용 — BLOCK 0건`);
}
