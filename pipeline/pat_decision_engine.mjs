/**
 * pipeline/pat_decision_engine.mjs
 *
 * ok:false 선지에 대해 analysis·choice·도메인 규칙을 조합해 pat을 제안한다.
 * 첫 번째 목표: 현재 데이터와의 일치율 검증(--dry-run), 다음 단계에서 --apply 로 교정.
 *
 * 입력:
 *   - public/data/all_data_204.json
 *   - config/pat_decision_rules.json
 *   - config/pat_signal_map.json
 *   - config/pat_override_cases.json
 *
 * 우선순위:
 *   1. override_cases → 무조건 적용
 *   2. auto_empty (R3/V 또는 ok:true) → 제안 없음 (no_change)
 *   3. domain_guard (도메인 위반 pat은 교차 매핑 후 signal로 재검토)
 *   4. analysis_signal (pat별 signal 키워드 weighted hit)
 *   5. choice_axis (tie-breaker)
 *   6. label_hint (analysis 말미 라벨)
 *   7. fallback (domain default)
 *
 * CLI (PowerShell):
 *   node pipeline/pat_decision_engine.mjs --exam 2026수능 --dry-run
 *   node pipeline/pat_decision_engine.mjs --exam 2022수능 --set r2022c --dry-run
 *   node pipeline/pat_decision_engine.mjs --apply --exam 2026수능   (미구현 경고)
 *
 * 출력 (dry-run):
 *   pipeline/reports/pat_decision_report.json
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DATA_PATH = path.join(ROOT, "public", "data", "all_data_204.json");
const CONFIG_DIR = path.join(ROOT, "config");
const REPORT_DIR = path.join(__dirname, "reports");

// ─── CLI ─────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
function getArg(name) {
  const i = args.indexOf(name);
  return i >= 0 && i + 1 < args.length && !args[i + 1].startsWith("--")
    ? args[i + 1]
    : null;
}
const EXAM = getArg("--exam");
const SET = getArg("--set");
const DRY_RUN = args.includes("--dry-run");
const APPLY = args.includes("--apply");

if (!DRY_RUN && !APPLY) {
  console.error(
    "사용법: node pipeline/pat_decision_engine.mjs --exam <yearKey> [--set <setId>] (--dry-run | --apply)",
  );
  process.exit(1);
}
if (APPLY) {
  console.warn("⚠️  --apply 모드는 이 1차 구현에서 미지원. --dry-run 권장.");
  process.exit(1);
}

// ─── 설정 로드 ────────────────────────────────────────────────────────────────
const rules = JSON.parse(fs.readFileSync(path.join(CONFIG_DIR, "pat_decision_rules.json"), "utf8"));
const signalMap = JSON.parse(fs.readFileSync(path.join(CONFIG_DIR, "pat_signal_map.json"), "utf8"));
const overrideFile = JSON.parse(fs.readFileSync(path.join(CONFIG_DIR, "pat_override_cases.json"), "utf8"));
// 선택적 — 파일 없으면 빈 큐
let okRecheckFile = { queue: [] };
try {
  okRecheckFile = JSON.parse(
    fs.readFileSync(path.join(CONFIG_DIR, "pat_ok_recheck_queue.json"), "utf8"),
  );
} catch {}

const AUTO_EMPTY = new Set(rules.auto_empty_pats);
const VALID = rules.valid_pats_by_section;
const FALLBACK = rules.domain_fallback;
const CROSS = rules.cross_domain_mapping;

const overrideIndex = new Map();
for (const c of overrideFile.cases || []) {
  overrideIndex.set(`${c.exam}/${c.setId}/${c.qId}/${c.num}`, c.pat);
}
const okRecheckIndex = new Set();
for (const q of okRecheckFile.queue || []) {
  okRecheckIndex.add(`${q.exam}/${q.setId}/${q.qId}/${q.num}`);
}

// ─── 의미 중심 rule id 매핑 ─────────────────────────────────────────────────
const RULE_INTENT = {
  R1: "signal.fact_distortion",
  R2: "signal.causal_inversion",
  R3: "signal.overreach",
  R4: "signal.concept_confusion",
  L1: "signal.form_misread",
  L2: "signal.emotion_misread",
  L3: "signal.theme_overextension",
  L4: "signal.structure_misread",
  L5: "signal.bogi_misapplication",
  V:  "signal.vocab_substitution",
};
function intentOf(pat) {
  return RULE_INTENT[pat] || `signal.${String(pat).toLowerCase()}`;
}

// ─── 유틸 ────────────────────────────────────────────────────────────────────
function sectionOf(setId) {
  const s = String(setId || "");
  if (s[0] === "r" || s.startsWith("kor") || s.startsWith("sep")) return "reading";
  if (s[0] === "l" || s.startsWith("lsep")) return "literature";
  return null;
}

// 점수 + 매칭된 키워드 반환
function scoreSignals(text, patEntry) {
  const hits = [];
  let score = 0;
  if (!text || !patEntry) return { score, hits };
  for (const sig of patEntry.analysis_signals || []) {
    const re = new RegExp(sig.pattern);
    const m = text.match(re);
    if (m) {
      score += sig.weight || 1;
      hits.push(m[0]);
    }
  }
  return { score, hits };
}
function scoreAxis(text, patEntry) {
  const hits = [];
  let score = 0;
  if (!text || !patEntry) return { score, hits };
  for (const ax of patEntry.choice_axis || []) {
    const re = new RegExp(ax.pattern);
    const m = text.match(re);
    if (m) {
      score += ax.weight || 1;
      hits.push(m[0]);
    }
  }
  return { score, hits };
}

// analysis polarity 탐지 (validate_choice_consistency와 동형)
function detectPolarity(analysis) {
  if (typeof analysis !== "string" || !analysis.trim())
    return { polarity: "unknown", signal: "none" };
  const a = analysis;
  const lastCheck = Math.max(a.lastIndexOf("✅"), a.lastIndexOf("❌"));
  const negPatterns = [
    /부적절/, /어긋나/, /잘못\s*(읽|이해|해석|분류|파악)/, /왜곡/,
    /맞지\s*않/, /일치하지\s*않/, /정반대/, /적절하지\s*않/,
    /적절치\s*않/, /옳지\s*않/, /지문과\s*어긋/,
  ];
  const posPatterns = [
    /(?<!부)적절(?!하지|치\s*않)/, /일치(?!하지)/, /부합/,
    /올바르/, /합당/, /적절한\s*진술/, /적절한\s*설명/,
  ];
  const hasNeg = negPatterns.some((r) => r.test(a));
  const hasPos = posPatterns.some((r) => r.test(a));
  let emoji = null;
  if (lastCheck >= 0) {
    const tail = a.slice(lastCheck);
    if (tail.startsWith("✅")) emoji = "positive";
    if (tail.startsWith("❌")) emoji = "negative";
  }
  const polarity = emoji || (hasNeg && !hasPos ? "negative" : hasPos && !hasNeg ? "positive" : "unknown");
  const selfConflict = hasNeg && hasPos;
  return { polarity, selfConflict, emoji, hasNeg, hasPos };
}

// 도메인에 따라 후보 pat 집합 결정
function candidatesFor(section) {
  return (VALID[section] || []).filter((p) => !AUTO_EMPTY.has(p) && p !== "V");
}

// ─── 판정 엔진 ───────────────────────────────────────────────────────────────
function decide(c, setId, exam, qId, sectionOverride) {
  const key = `${exam}/${setId}/${qId}/${c.num}`;
  const matchedRules = [];

  // 1. override_cases.locked
  if (overrideIndex.has(key)) {
    matchedRules.push("override_cases.locked");
    return {
      suggested: overrideIndex.get(key),
      source: "override_case",
      applied_rule_id: "override.locked",
      matched_rules: matchedRules,
      candidate_scores: null,
      top2_candidates: [],
      top2_gap: null,
      matched_signals: { choice: [], analysis: [] },
    };
  }

  // 2. ok_recheck_required — 판정 보류
  if (okRecheckIndex.has(key)) {
    matchedRules.push("ok_recheck_required");
    return {
      suggested: null,
      source: "ok_recheck_required",
      applied_rule_id: "queue.ok_recheck",
      matched_rules: matchedRules,
      candidate_scores: null,
      top2_candidates: [],
      top2_gap: null,
      matched_signals: { choice: [], analysis: [] },
      note: "ok 값 재검토 필요",
    };
  }

  // 3. 선제 통과 — ok:true / auto_empty / V
  if (c.ok === true)
    return {
      suggested: null,
      source: "ok_true",
      applied_rule_id: "pass.ok_true",
      matched_rules: ["pass.ok_true"],
      candidate_scores: null,
      top2_candidates: [],
      top2_gap: null,
      matched_signals: { choice: [], analysis: [] },
    };
  if (typeof c.pat === "string" && AUTO_EMPTY.has(c.pat))
    return {
      suggested: c.pat,
      source: "auto_empty",
      applied_rule_id: "pass.auto_empty",
      matched_rules: ["pass.auto_empty"],
      candidate_scores: null,
      top2_candidates: [],
      top2_gap: null,
      matched_signals: { choice: [], analysis: [] },
    };
  if (c.pat === "V")
    return {
      suggested: "V",
      source: "vocab_keep",
      applied_rule_id: "pass.vocab_keep",
      matched_rules: ["pass.vocab_keep"],
      candidate_scores: null,
      top2_candidates: [],
      top2_gap: null,
      matched_signals: { choice: [], analysis: [] },
    };

  // 4. domain_filter — section 결정
  const section = sectionOf(setId) || sectionOverride;
  if (!section)
    return {
      suggested: null,
      source: "unknown_section",
      applied_rule_id: "unknown_section",
      matched_rules: [],
      candidate_scores: null,
      top2_candidates: [],
      top2_gap: null,
      matched_signals: { choice: [], analysis: [] },
    };
  const cands = candidatesFor(section);
  matchedRules.push(`domain_filter_${section}`);

  // 5. decision_rules — signal + axis + label
  const ana = c.analysis || "";
  const choiceT = c.t || "";
  const scores = {};
  const hitsByPat = {};
  const signalHitCountByPat = {};
  for (const p of cands) {
    const entry = signalMap[p] || {};
    const ss = scoreSignals(ana, entry);
    const as = scoreAxis(choiceT, entry);
    scores[p] = { signal: ss.score, axis: as.score, total: ss.score * 2 + as.score, penalty: 0, bonus: 0 };
    hitsByPat[p] = { analysis: ss.hits, choice: as.hits };
    signalHitCountByPat[p] = ss.hits.length;
  }

  // 5-A. 경계 감점/가점 (L1↔L4, R1↔R2, R1↔R4)
  //   - pat의 analysis signal hit 가 2개 이상이면 상대 pat(boundary_against)를 감점
  //   - 동시에 자기 자신에 작은 보너스 (경계 강화 효과)
  for (const p of cands) {
    const hits = signalHitCountByPat[p] || 0;
    const entry = signalMap[p] || {};
    if (hits >= 2 && Array.isArray(entry.boundary_against)) {
      scores[p].bonus += 2;
      scores[p].total += 2;
      for (const rival of entry.boundary_against) {
        if (scores[rival]) {
          scores[rival].penalty += 2;
          scores[rival].total -= 2;
        }
      }
    }
  }
  const sorted = Object.entries(scores).sort((a, b) => b[1].total - a[1].total);
  const top1 = sorted[0];
  const top2 = sorted[1];
  const top2Gap = top1 && top2 ? top1[1].total - top2[1].total : null;

  // label_hint
  const labelMatch = ana.match(/\[(L[1-5]|R[1-4]|V)\]/g);
  const labelHint = labelMatch ? labelMatch[labelMatch.length - 1].replace(/[\[\]]/g, "") : null;
  const labelDomainOK = labelHint && cands.includes(labelHint);

  const minScore = (rules.signal_threshold || {}).min_score || 1;
  let suggested, source, appliedRuleId;

  if (top1 && top1[1].total >= minScore) {
    suggested = top1[0];
    source = "analysis_signal";
    appliedRuleId = intentOf(suggested); // 의미 중심: signal.structure_misread 등
    matchedRules.push("decision_rules.signal");
  } else if (labelDomainOK) {
    suggested = labelHint;
    source = "label_hint";
    appliedRuleId = `label_hint.${intentOf(suggested).replace("signal.", "")}`;
    matchedRules.push("decision_rules.label_hint");
  } else {
    // [Fallback 약화]
    //   signal·label 둘 다 실패 시 기존 pat이 section 도메인에 맞으면 유지
    //   (fallback.keep_existing) — "no-op" 제안으로 자연 match 유도
    //   기존 pat이 없거나 도메인 위반일 때만 domain default fallback 적용
    if (c.pat && cands.includes(c.pat)) {
      suggested = c.pat;
      source = "fallback_keep_existing";
      appliedRuleId = "fallback.keep_existing";
      matchedRules.push("decision_rules.fallback_keep_existing");
    } else {
      suggested = FALLBACK[section] || cands[0];
      source = "fallback";
      appliedRuleId = `fallback.${section}_default`;
      matchedRules.push("decision_rules.fallback");
    }
  }

  // 매칭된 키워드 — 최종 선택된 pat의 hits만 노출
  const chosenHits = hitsByPat[suggested] || { analysis: [], choice: [] };

  // 후보 점수 정규화 (0~1 범위)
  const maxTotal = Math.max(1, ...Object.values(scores).map((s) => s.total));
  const candidateScoresNorm = {};
  for (const [p, s] of Object.entries(scores)) {
    candidateScoresNorm[p] = +(s.total / maxTotal).toFixed(3);
  }
  const top2Normalized = sorted.slice(0, 2).map(([p, s]) => ({
    pat: p,
    score: +(s.total / maxTotal).toFixed(3),
    raw_total: s.total,
  }));
  const top2GapNorm = top2Normalized.length >= 2
    ? +(top2Normalized[0].score - top2Normalized[1].score).toFixed(3)
    : null;

  return {
    suggested,
    source,
    applied_rule_id: appliedRuleId,
    matched_rules: matchedRules,
    candidate_scores: candidateScoresNorm,
    candidate_scores_raw: scores,
    top2_candidates: top2Normalized,
    top2_gap: top2GapNorm,
    matched_signals: { choice: chosenHits.choice, analysis: chosenHits.analysis },
    signal_hits_by_pat: signalHitCountByPat,
    labelHint,
  };
}

// ─── mismatch 버킷 분류 ──────────────────────────────────────────────────────
// 반환: { bucket, bucket_basis: string[] }
function classifyMismatch(row, pairCounts) {
  if (row.match) return { bucket: null, basis: [] };
  if (row.suggested_pat === null || row.suggested_pat === undefined)
    return { bucket: null, basis: [] };
  if (row.source === "ok_recheck_required") return { bucket: null, basis: [] };

  const cf = row.conflict_flags || [];
  const basis = [];

  // D. ok_recheck_missing — hard 신호 + ok 모순
  const hardSignals = [];
  if (cf.includes("analysis_polarity_conflict")) hardSignals.push("analysis_polarity_conflict");
  if (cf.includes("hard_self_conflict")) hardSignals.push("hard_self_conflict");
  if (cf.includes("admit_correctness_but_false")) hardSignals.push("admit_correctness_but_false");
  if (cf.includes("deny_correctness_but_true")) hardSignals.push("deny_correctness_but_true");
  if (hardSignals.length > 0) {
    for (const s of hardSignals) basis.push(`flag:${s}`);
    return { bucket: "ok_recheck_missing", basis };
  }

  // A. priority_issue — top2 gap 작고 양쪽 다 signal hit
  const top2 = row.top2_candidates || [];
  if (top2.length >= 2 && row.top2_gap !== null && row.top2_gap < 0.25) {
    const t2Raw = top2[1].raw_total || 0;
    if (t2Raw >= 1) {
      basis.push(`top2_gap_small:${row.top2_gap}`);
      basis.push(`top2_both_signaled:${top2[0].pat}/${top2[1].pat}`);
      return { bucket: "priority_issue", basis };
    }
  }

  // C. override_missing — pair 반복 (≥2)
  const pairKey = `${row.existing_pat || "null"}→${row.suggested_pat || "null"}`;
  if ((pairCounts[pairKey] || 0) >= 2) {
    basis.push(`pair_recurrence:${pairCounts[pairKey]}`);
    if (cf.includes("soft_self_conflict")) basis.push("flag:soft_self_conflict");
    return { bucket: "override_missing", basis };
  }

  // B. signal_issue — 기본
  basis.push("default:no_other_trigger");
  if (cf.includes("fallback_used")) basis.push("flag:fallback_used");
  if (cf.includes("label_vs_signal_disagree")) basis.push("flag:label_vs_signal_disagree");
  return { bucket: "signal_issue", basis };
}

// conflict flags 수집 (row 생성 후)
// self_conflict 구분:
//   hard_self_conflict: emoji 없음 + pos/neg 공존 → 판정 신호 자체가 부재해 ambiguous
//   soft_self_conflict: emoji 있음 + 반대 방향 텍스트 신호 동시 존재 → 해설이 대비를 서술하는 정상 패턴이지만
//                        강도(신호 개수)가 높으면 사람 재검 대상. 3건 이상 반대 신호 적재 시 flag.
function countMatches(a, patterns) {
  let n = 0;
  for (const re of patterns) if (re.test(a)) n++;
  return n;
}
const NEG_TEXT = [
  /부적절/, /어긋나/, /잘못\s*(읽|이해|해석|분류|파악)/, /왜곡/,
  /맞지\s*않/, /일치하지\s*않/, /정반대/, /적절하지\s*않/,
  /적절치\s*않/, /옳지\s*않/, /지문과\s*어긋/,
];
const POS_TEXT = [
  /(?<!부)적절(?!하지|치\s*않)/, /일치(?!하지)/, /부합/,
  /올바르/, /합당/, /적절한\s*진술/, /적절한\s*설명/,
];

function detectConflictFlags(c, row, polarity) {
  const flags = [];
  if (row.top2_gap !== null && row.top2_gap < 0.25) flags.push("top2_gap_small");
  if (row.source === "fallback") flags.push("fallback_used");

  const a = c.analysis || "";
  const negCount = countMatches(a, NEG_TEXT);
  const posCount = countMatches(a, POS_TEXT);

  // hard_self_conflict: emoji 없음 + pos/neg 공존
  if (polarity.selfConflict && !polarity.emoji) flags.push("hard_self_conflict");
  // soft_self_conflict: emoji 있음 + 반대 방향 신호도 비정상적으로 많이 섞임
  //   예: ok:false + emoji:negative 인데 pos 텍스트 신호 3+ 건 → ok 재검 후보
  if (polarity.emoji === "negative" && posCount >= 3) flags.push("soft_self_conflict");
  if (polarity.emoji === "positive" && negCount >= 3) flags.push("soft_self_conflict");

  // emoji vs ok 정반대 (강한 모순)
  if (c.ok === true && polarity.emoji === "negative") flags.push("analysis_polarity_conflict");
  if (c.ok === false && polarity.emoji === "positive") flags.push("analysis_polarity_conflict");
  // emoji 부재 + 단방향 신호가 ok와 반대
  if (!polarity.emoji && c.ok === true && polarity.hasNeg && !polarity.hasPos)
    flags.push("admit_correctness_but_false");
  if (!polarity.emoji && c.ok === false && polarity.hasPos && !polarity.hasNeg)
    flags.push("deny_correctness_but_true");

  if (row.label_hint && row.suggested_pat && row.label_hint !== row.suggested_pat) {
    flags.push("label_vs_signal_disagree");
  }
  row.__pos_count = posCount;
  row.__neg_count = negCount;
  return flags;
}

// ─── 메인 ────────────────────────────────────────────────────────────────────
if (!EXAM) {
  console.error("❌ --exam 필수");
  process.exit(1);
}
const data = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
if (!data[EXAM]) {
  console.error(`❌ ${EXAM} 없음`);
  process.exit(1);
}
fs.mkdirSync(REPORT_DIR, { recursive: true });

const rows = [];
let counts = {
  total: 0,
  ok_true: 0,
  auto_empty: 0,
  ok_recheck: 0,
  match: 0,
  mismatch: 0,
  override_applied: 0,
  by_source: {},
  mismatch_by_type: {},
  mismatch_reason_counts: {
    priority_issue: 0,
    signal_issue: 0,
    override_missing: 0,
    ok_recheck_missing: 0,
  },
  applied_rule_counts: {},
  ok_recheck_missed_suspects: 0,
};

// 1차 패스: row 생성 + polarity + conflict_flags
for (const sec of ["reading", "literature"]) {
  for (const set of data[EXAM][sec] || []) {
    if (SET && set.id !== SET) continue;
    for (const q of set.questions || []) {
      for (const c of q.choices || []) {
        counts.total++;
        const decision = decide(c, set.id, EXAM, q.id, sec);
        const polarity = detectPolarity(c.analysis);
        const row = {
          loc: `${EXAM}/${set.id}/Q${q.id}/#${c.num}`,
          choice_id: `${EXAM}/${set.id}/Q${q.id}/#${c.num}`,
          exam: EXAM,
          setId: set.id,
          qId: q.id,
          num: c.num,
          ok: c.ok,
          existing_pat: c.pat === undefined ? null : c.pat,
          suggested_pat: decision.suggested,
          route: decision.source,
          source: decision.source,
          applied_rule_id: decision.applied_rule_id,
          matched_rules: decision.matched_rules,
          candidate_scores: decision.candidate_scores,
          top2_candidates: decision.top2_candidates,
          top2_gap: decision.top2_gap,
          matched_signals: decision.matched_signals,
          signal_hits_by_pat: decision.signal_hits_by_pat || null,
          label_hint: decision.labelHint || null,
          match: c.pat === decision.suggested,
          polarity: polarity.polarity,
          polarity_emoji: polarity.emoji,
          conflict_flags: [],
          mismatch_reason_code: null,
        };
        row.conflict_flags = detectConflictFlags(c, row, polarity);
        rows.push(row);

        counts.by_source[decision.source] = (counts.by_source[decision.source] || 0) + 1;
        counts.applied_rule_counts[decision.applied_rule_id] =
          (counts.applied_rule_counts[decision.applied_rule_id] || 0) + 1;
        if (decision.source === "ok_true") counts.ok_true++;
        else if (decision.source === "auto_empty" || decision.source === "vocab_keep")
          counts.auto_empty++;
        else if (decision.source === "override_case") counts.override_applied++;
        else if (decision.source === "ok_recheck_required") counts.ok_recheck++;

        if (decision.source === "ok_recheck_required") continue;

        if (row.match) counts.match++;
        else {
          counts.mismatch++;
          const mtype = `${row.existing_pat || "null"} → ${row.suggested_pat || "null"}`;
          counts.mismatch_by_type[mtype] = (counts.mismatch_by_type[mtype] || 0) + 1;
        }
      }
    }
  }
}

// 2차 패스: mismatch pair count + 버킷 분류
const pairCounts = {};
for (const r of rows) {
  if (!r.match && r.suggested_pat !== null && r.source !== "ok_recheck_required" && r.source !== "ok_true") {
    const key = `${r.existing_pat || "null"}→${r.suggested_pat || "null"}`;
    pairCounts[key] = (pairCounts[key] || 0) + 1;
  }
}
for (const r of rows) {
  const { bucket, basis } = classifyMismatch(r, pairCounts);
  r.mismatch_reason_code = bucket;
  r.bucket_basis = basis;
  if (bucket) {
    counts.mismatch_reason_counts[bucket] =
      (counts.mismatch_reason_counts[bucket] || 0) + 1;
    if (bucket === "ok_recheck_missing") counts.ok_recheck_missed_suspects++;
  }
}

// ─── rule_candidate_pairs vs true_override_pairs 분리 ───────────────────────
// pair 내 모든 mismatch row의 applied_rule_id가 동일 + matched_signals overlap 높음
// → rule_candidate (규칙 흡수 가능)
// 아니면 true_override (개별 수동 확정 필요)
function signatureOf(r) {
  const ax = (r.matched_signals?.choice || []).slice().sort().join("|");
  const sg = (r.matched_signals?.analysis || []).slice().sort().join("|");
  return `${r.applied_rule_id}::ax[${ax}]::sg[${sg}]`;
}
const pairGroups = {}; // pair → rows[]
for (const r of rows) {
  if (r.mismatch_reason_code === null) continue;
  const pair = `${r.existing_pat || "null"}→${r.suggested_pat || "null"}`;
  if (!pairGroups[pair]) pairGroups[pair] = [];
  pairGroups[pair].push(r);
}

const ruleCandidatePairs = []; // 규칙 흡수 후보
const trueOverridePairs = []; // 개별 override 필요
const batchOverrideGroups = []; // (pair, applied_rule_id, axis, signals) 동일 + ≥2건

for (const [pair, group] of Object.entries(pairGroups)) {
  if (group.length < 2) {
    trueOverridePairs.push({ pair, count: group.length, reason: "single_occurrence" });
    continue;
  }
  // applied_rule_id 일관성
  const ruleIds = new Set(group.map((r) => r.applied_rule_id));
  const sameRule = ruleIds.size === 1;
  // signature 집계
  const sigCounts = {};
  for (const r of group) {
    const sig = signatureOf(r);
    sigCounts[sig] = (sigCounts[sig] || 0) + 1;
  }
  const dominantSig = Object.entries(sigCounts).sort((a, b) => b[1] - a[1])[0];
  const dominantSigCount = dominantSig ? dominantSig[1] : 0;
  const dominantRatio = group.length > 0 ? dominantSigCount / group.length : 0;

  if (sameRule && dominantRatio >= 0.5) {
    ruleCandidatePairs.push({
      pair,
      count: group.length,
      applied_rule_id: [...ruleIds][0],
      dominant_signature: dominantSig[0],
      dominant_sig_count: dominantSigCount,
      dominant_ratio: +dominantRatio.toFixed(3),
    });
  } else {
    trueOverridePairs.push({
      pair,
      count: group.length,
      distinct_rules: [...ruleIds],
      dominant_ratio: +dominantRatio.toFixed(3),
      reason: sameRule ? "signature_mixed" : "rule_mixed",
    });
  }

  // batch_override 후보 (강화 기준): pair + applied_rule_id + choice_axis + analysis signature 모두 동일 + count ≥ 2
  for (const [sig, n] of Object.entries(sigCounts)) {
    if (n >= 2) {
      const members = group.filter((r) => signatureOf(r) === sig);
      const sampleRow = members[0];
      batchOverrideGroups.push({
        pair,
        count: n,
        applied_rule_id: sampleRow.applied_rule_id,
        dominant_choice_axis: (sampleRow.matched_signals?.choice || []).slice().sort(),
        dominant_signal_signature: (sampleRow.matched_signals?.analysis || []).slice().sort(),
        sample_choice_ids: members.slice(0, 3).map((r) => r.choice_id || r.loc),
        safe_batch_candidate: true, // 4축 모두 동일 + ≥2건 → safe
      });
    }
  }
}
ruleCandidatePairs.sort((a, b) => b.count - a.count);
trueOverridePairs.sort((a, b) => b.count - a.count);
batchOverrideGroups.sort((a, b) => b.count - a.count);

// ─── row 단위 match_type 주입 ────────────────────────────────────────────────
function matchTypeOf(r) {
  if (r.source === "ok_true") return "ok_true_pass";
  if (r.source === "auto_empty") return "auto_empty_pass";
  if (r.source === "vocab_keep") return "vocab_keep";
  if (r.source === "ok_recheck_required") return "ok_recheck_queue";
  if (!r.match) return "mismatch";
  if (r.source === "override_case") return "override_match";
  if (r.source === "fallback_keep_existing") return "keep_existing_match";
  if (r.source === "analysis_signal" || r.source === "label_hint")
    return "engine_true_match";
  return "mismatch";
}
for (const r of rows) r.match_type = matchTypeOf(r);

// self_conflict 및 polarity 보조 지표
let softSelfConflict = 0;
let hardSelfConflict = 0;
let polarityEmojiPresent = 0;
let emojiPresentAndCoexist = 0;
let softSelfConflictSuppressed = 0;

for (const r of rows) {
  if (r.conflict_flags?.includes("soft_self_conflict")) softSelfConflict++;
  if (r.conflict_flags?.includes("hard_self_conflict")) hardSelfConflict++;
  if (r.polarity_emoji) polarityEmojiPresent++;
  const bothSignals = (r.__pos_count || 0) > 0 && (r.__neg_count || 0) > 0;
  if (r.polarity_emoji && bothSignals) emojiPresentAndCoexist++;
  if (r.polarity_emoji && bothSignals && !r.conflict_flags?.includes("soft_self_conflict"))
    softSelfConflictSuppressed++;
}

// ─── soft_conflict_risk_tier + ok_recheck_candidate_score 계산 ──────────────
function classifySoftRisk(r) {
  const bothSignals = (r.__pos_count || 0) > 0 && (r.__neg_count || 0) > 0;
  const hasHardFlag = r.conflict_flags?.includes("hard_self_conflict");
  const hasSoftFlag = r.conflict_flags?.includes("soft_self_conflict");
  const hasPolarityConflict = r.conflict_flags?.includes("analysis_polarity_conflict");
  const hasAdmitDeny =
    r.conflict_flags?.includes("admit_correctness_but_false") ||
    r.conflict_flags?.includes("deny_correctness_but_true");
  const isMismatch = r.match_type === "mismatch";
  const isKeepExisting = r.match_type === "keep_existing_match";
  const hasLabelDisagree = r.conflict_flags?.includes("label_vs_signal_disagree");

  // 위험 신호가 하나도 없으면 tier 없음
  const anySoftSignal = bothSignals || hasSoftFlag || hasHardFlag || hasPolarityConflict || hasAdmitDeny;
  if (!anySoftSignal) return { tier: null, basis: [] };

  const basis = [];
  let tier = "low";

  // HIGH 조건
  if (
    hasPolarityConflict ||
    hasHardFlag ||
    hasAdmitDeny ||
    (hasSoftFlag && (isMismatch || isKeepExisting))
  ) {
    tier = "high";
    if (hasPolarityConflict) basis.push("polarity_conflict");
    if (hasHardFlag) basis.push("hard_self_conflict");
    if (hasAdmitDeny) basis.push("admit_or_deny_conflict");
    if (hasSoftFlag) basis.push("soft_flag_triggered");
    if (isMismatch) basis.push("in_mismatch");
    if (isKeepExisting) basis.push("in_keep_existing");
    return { tier, basis };
  }

  // MEDIUM 조건 — suppressed coexistence + (mismatch/keep_existing) OR (hasLabelDisagree + coexist)
  if ((isMismatch || isKeepExisting) && bothSignals) {
    basis.push("suppressed_coexistence");
    if (isMismatch) basis.push("in_mismatch");
    if (isKeepExisting) basis.push("in_keep_existing");
    return { tier: "medium", basis };
  }
  if (hasLabelDisagree && bothSignals) {
    basis.push("label_vs_signal_disagree");
    basis.push("suppressed_coexistence");
    return { tier: "medium", basis };
  }

  // LOW — 단순 pos/neg 공존만 존재, polarity는 ok와 일치, 모든 route 문제 없음
  basis.push("coexistence_only");
  return { tier: "low", basis };
}

function scoreOkRecheck(r) {
  let score = 0;
  const cf = r.conflict_flags || [];
  if (cf.includes("analysis_polarity_conflict")) score += 0.35;
  if (cf.includes("hard_self_conflict")) score += 0.25;
  if (cf.includes("admit_correctness_but_false")) score += 0.20;
  if (cf.includes("deny_correctness_but_true")) score += 0.20;
  if (cf.includes("soft_self_conflict")) score += 0.15;
  const pos = r.__pos_count || 0, neg = r.__neg_count || 0;
  if (pos > 0 && neg > 0) {
    const strength = Math.min(pos, neg) / 3;
    score += Math.min(0.15, strength * 0.15);
  }
  if (r.match_type === "keep_existing_match") score += 0.10;
  if (r.match_type === "mismatch") score += 0.10;
  if (cf.includes("label_vs_signal_disagree")) score += 0.10;
  return Math.min(1, +score.toFixed(3));
}

for (const r of rows) {
  const { tier, basis } = classifySoftRisk(r);
  r.soft_conflict_risk_tier = tier;
  r.soft_conflict_basis = basis;
  r.ok_recheck_candidate_score = scoreOkRecheck(r);
}

// 랭킹 부여 (exam 내)
const rankedBySoft = rows
  .map((r, idx) => ({ idx, score: r.ok_recheck_candidate_score }))
  .sort((a, b) => b.score - a.score);
rankedBySoft.forEach((e, rank) => {
  rows[e.idx].ok_recheck_candidate_rank = rank + 1;
});

// soft risk counts + match_type 교차 집계
const softRiskCounts = { low: 0, medium: 0, high: 0 };
const softByMatchType = {
  engine_true_match: 0,
  keep_existing_match: 0,
  override_match: 0,
  mismatch: 0,
  ok_true_pass: 0,
  auto_empty_pass: 0,
  vocab_keep: 0,
};
for (const r of rows) {
  if (!r.soft_conflict_risk_tier) continue;
  softRiskCounts[r.soft_conflict_risk_tier]++;
  if (softByMatchType[r.match_type] !== undefined)
    softByMatchType[r.match_type]++;
}

// review 후보군 3종
function metaOf(r) {
  return {
    choice_id: r.choice_id || r.loc,
    existing_pat: r.existing_pat,
    suggested_pat: r.suggested_pat,
    route: r.source,
    match_type: r.match_type,
    soft_conflict_risk_tier: r.soft_conflict_risk_tier,
    ok_recheck_candidate_score: r.ok_recheck_candidate_score,
    polarity: r.polarity,
    polarity_emoji: r.polarity_emoji,
    conflict_flags: r.conflict_flags,
  };
}
const sortByScore = (a, b) => b.ok_recheck_candidate_score - a.ok_recheck_candidate_score;
const okRecheckPriorityCandidates = rows
  .filter((r) =>
    r.soft_conflict_risk_tier === "high" ||
    (r.soft_conflict_risk_tier === "medium" &&
      (r.match_type === "mismatch" || r.match_type === "keep_existing_match")),
  )
  .sort(sortByScore)
  .slice(0, 10)
  .map(metaOf);

const keepExistingRiskCandidates = rows
  .filter((r) =>
    r.match_type === "keep_existing_match" &&
    (r.soft_conflict_risk_tier === "high" || r.soft_conflict_risk_tier === "medium"),
  )
  .sort(sortByScore)
  .slice(0, 10)
  .map(metaOf);

const mismatchSoftConflictCandidates = rows
  .filter((r) => r.match_type === "mismatch" && r.soft_conflict_risk_tier)
  .sort(sortByScore)
  .slice(0, 10)
  .map(metaOf);

const keepExistingRiskCount = rows.filter(
  (r) => r.match_type === "keep_existing_match" &&
    (r.soft_conflict_risk_tier === "high" || r.soft_conflict_risk_tier === "medium"),
).length;

const okRecheckCandidateTop10 = rows
  .slice()
  .sort(sortByScore)
  .filter((r) => r.ok_recheck_candidate_score > 0)
  .slice(0, 10)
  .map((r) => ({
    choice_id: r.choice_id || r.loc,
    score: r.ok_recheck_candidate_score,
    risk_tier: r.soft_conflict_risk_tier,
    match_type: r.match_type,
  }));

// ─── human_review_pack 생성 ─────────────────────────────────────────────────
// 3종 대표 샘플 1건씩:
//   A. mismatch + medium
//   B. keep_existing_match + medium
//   C. conflict_flags 에 label_vs_signal_disagree 포함 (A/B 중복 배제)
function pickSample(predicate, excludeIds) {
  return rows
    .filter((r) => predicate(r))
    .filter((r) => !excludeIds.has(r.choice_id || r.loc))
    .sort(sortByScore)[0];
}

// 짧은 이유 + decision target + 질문 템플릿 생성
function shortReasonOf(r) {
  const parts = [];
  if (r.match_type === "mismatch") parts.push(`mismatch ${r.existing_pat||"null"}→${r.suggested_pat||"null"}`);
  if (r.match_type === "keep_existing_match") parts.push(`keep_existing (fallback 유지) pat=${r.existing_pat||"null"}`);
  if (r.soft_conflict_risk_tier)
    parts.push(`risk=${r.soft_conflict_risk_tier}`);
  if (r.conflict_flags?.includes("label_vs_signal_disagree"))
    parts.push("label↔signal 불일치");
  if (r.conflict_flags?.includes("top2_gap_small"))
    parts.push("top2 경합");
  if ((r.__pos_count || 0) > 0 && (r.__neg_count || 0) > 0)
    parts.push(`pos/neg 공존(+${r.__pos_count}/-${r.__neg_count})`);
  return parts.join(" · ");
}

// 이중 후보 + 확신도로 변경 — ok/pat 쏠림 방지
// 규칙:
//   strong polarity conflict + admit/deny + hard_self_conflict → ok_recheck primary, confidence 0.9
//   keep_existing + medium                                     → ok primary, pat secondary, confidence 0.55
//   mismatch + boundary 문제 (pos/neg 공존 없음)                → pat primary, confidence 0.7
//   mismatch + boundary 문제 + pos/neg 공존                      → pat primary, ok secondary, confidence 0.5
//   나머지 mismatch                                             → pat primary, confidence 0.6
//   그 외                                                       → leave_as_is, confidence 0.4
function decisionTargetOf(r) {
  const cf = r.conflict_flags || [];
  const hasStrongPolarity =
    cf.includes("analysis_polarity_conflict") ||
    cf.includes("admit_correctness_but_false") ||
    cf.includes("deny_correctness_but_true") ||
    cf.includes("hard_self_conflict");
  const hasAxisIssue =
    cf.includes("label_vs_signal_disagree") ||
    cf.includes("top2_gap_small");
  const bothSignals = (r.__pos_count || 0) > 0 && (r.__neg_count || 0) > 0;

  let primary = "leave_as_is",
    secondary = null,
    confidence = 0.4;

  if (hasStrongPolarity) {
    primary = "send_to_ok_recheck_queue";
    secondary = "leave_as_is";
    confidence = 0.9;
  } else if (
    r.match_type === "keep_existing_match" &&
    (r.soft_conflict_risk_tier === "medium" || r.soft_conflict_risk_tier === "high")
  ) {
    primary = "send_to_ok_recheck_queue";
    secondary = "send_to_pat_review_queue";
    confidence = 0.55;
  } else if (r.match_type === "mismatch" && hasAxisIssue && !bothSignals) {
    primary = "send_to_pat_review_queue";
    secondary = "leave_as_is";
    confidence = 0.7;
  } else if (r.match_type === "mismatch" && hasAxisIssue && bothSignals) {
    primary = "send_to_pat_review_queue";
    secondary = "send_to_ok_recheck_queue";
    confidence = 0.5;
  } else if (r.match_type === "mismatch") {
    primary = "send_to_pat_review_queue";
    secondary = "leave_as_is";
    confidence = 0.6;
  }
  return { primary_decision: primary, secondary_decision: secondary, decision_confidence: +confidence.toFixed(2) };
}

// 이유 자동 추천 (사람이 최종 선택)
function suggestOkIssueReason(r) {
  const cf = r.conflict_flags || [];
  if (
    cf.includes("analysis_polarity_conflict") ||
    cf.includes("admit_correctness_but_false") ||
    cf.includes("deny_correctness_but_true")
  )
    return "polarity_conflict";
  if (cf.includes("hard_self_conflict")) return "analysis_self_conflict";
  // keep_existing_match + medium/high tier → fallback로 겉보기 match이지만 해설 축이 어긋날 위험
  if (
    r.match_type === "keep_existing_match" &&
    (r.soft_conflict_risk_tier === "medium" || r.soft_conflict_risk_tier === "high")
  )
    return "keep_existing_risk";
  const bothSignals = (r.__pos_count || 0) > 0 && (r.__neg_count || 0) > 0;
  if ((cf.includes("label_vs_signal_disagree") || cf.includes("top2_gap_small")) && bothSignals)
    return "axis_mismatch";
  return "unclear";
}
function suggestPatIssueReason(r) {
  const pair = `${r.existing_pat || ""}→${r.suggested_pat || ""}`;
  if (["L1→L4", "L4→L1"].includes(pair)) return "structure_vs_form";
  if (["R1→R2", "R2→R1"].includes(pair)) return "cause_vs_fact";
  if (["R1→R4", "R4→R1", "R2→R4", "R4→R2"].includes(pair)) return "concept_confusion";
  if (["L1→L3", "L3→L1", "L3→L2", "L1→L2"].includes(pair)) return "theme_vs_expression";
  if ((r.existing_pat || "").startsWith(r.suggested_pat?.[0] || "")) return "unclear";
  return "unclear";
}
const OK_ISSUE_REASON_OPTIONS = [
  "axis_mismatch",
  "analysis_self_conflict",
  "polarity_conflict",
  "keep_existing_risk",
  "unclear",
  "none",
];
const PAT_ISSUE_REASON_OPTIONS = [
  "structure_vs_form",
  "cause_vs_fact",
  "concept_confusion",
  "theme_vs_expression",
  "unclear",
  "none",
];

function questionTemplateOf(r) {
  const existing = r.existing_pat || "null";
  const suggested = r.suggested_pat || "null";
  const okRecheckQ = (() => {
    if (r.match_type === "keep_existing_match")
      return `fallback로 유지된 pat=${existing}가 해설 논지와 실제로 맞는가, 아니면 해설이 다른 축을 설명해서 ok 자체를 재검토해야 하는가?`;
    if (r.conflict_flags?.includes("analysis_polarity_conflict"))
      return `결론 이모지(${r.polarity_emoji})가 ok=${r.ok}와 정반대다. ok 값 자체가 뒤집혀야 하는가?`;
    return `해설이 선지의 핵심 판단을 실제로 반박/지지하는가, 아니면 엉뚱한 축을 설명하는가? ok=${r.ok} 판정이 해설 본문과 일관된가?`;
  })();
  const patRecheckQ = (() => {
    if (r.conflict_flags?.includes("label_vs_signal_disagree"))
      return `ok는 유지된다고 가정할 때, label [${r.label_hint || "-"}]과 signal top1 [${suggested}] 중 어느 쪽이 실제 오류 축에 더 직접적인가?`;
    return `existing=${existing} vs suggested=${suggested} 중 어느 쪽이 선지의 실제 오류 구조(표현/정서/의미과잉/구조맥락/인과/개념/보기대입 중)에 더 직접 일치하는가?`;
  })();
  return { ok_recheck_question: okRecheckQ, pat_recheck_question: patRecheckQ };
}

function enrichSample(r) {
  if (!r) return null;
  const { ok_recheck_question, pat_recheck_question } = questionTemplateOf(r);
  const dec = decisionTargetOf(r);
  return {
    choice_id: r.choice_id || r.loc,
    existing_pat: r.existing_pat,
    suggested_pat: r.suggested_pat,
    match_type: r.match_type,
    soft_conflict_risk_tier: r.soft_conflict_risk_tier,
    ok_recheck_candidate_score: r.ok_recheck_candidate_score,
    applied_rule_id: r.applied_rule_id,
    conflict_flags: r.conflict_flags,
    bucket_basis: r.bucket_basis,
    polarity: r.polarity,
    polarity_emoji: r.polarity_emoji,
    short_reason: shortReasonOf(r),
    ok_recheck_question,
    pat_recheck_question,
    primary_decision: dec.primary_decision,
    secondary_decision: dec.secondary_decision,
    decision_confidence: dec.decision_confidence,
    // 사람이 최종 선택 — 자동 추천값은 engine 제시
    ok_issue_reason_options: OK_ISSUE_REASON_OPTIONS,
    ok_issue_reason_suggested: suggestOkIssueReason(r),
    pat_issue_reason_options: PAT_ISSUE_REASON_OPTIONS,
    pat_issue_reason_suggested: suggestPatIssueReason(r),
  };
}

// keep_existing 위험도를 먼저 계산 (샘플 구성이 이에 따라 달라짐)
const keepExistingTotal = rows.filter((r) => r.match_type === "keep_existing_match").length;
const keepExistingMediumHighCount = keepExistingRiskCount;
const keepExistingMediumRatio =
  keepExistingTotal > 0
    ? +(keepExistingMediumHighCount / keepExistingTotal).toFixed(3)
    : 0;
const keepExistingReviewPriority =
  keepExistingTotal > 0 && keepExistingMediumRatio > 0.5
    ? "high"
    : keepExistingMediumRatio > 0.3
      ? "medium"
      : "low";

// 샘플 구성
// - 기본:          mismatch 1 + keep_existing 1 + label_disagree 1
// - keep_existing_review_priority == "high": mismatch 1 + keep_existing 2
const pickedIds = new Set();
function pickAndRecord(predicate) {
  const r = pickSample(predicate, pickedIds);
  if (r) pickedIds.add(r.choice_id || r.loc);
  return r;
}

let sampleSlots = [];
if (keepExistingReviewPriority === "high") {
  const s1 = pickAndRecord((r) => r.match_type === "mismatch" && r.soft_conflict_risk_tier === "medium");
  const s2 = pickAndRecord((r) => r.match_type === "keep_existing_match" && r.soft_conflict_risk_tier === "medium");
  const s3 = pickAndRecord((r) => r.match_type === "keep_existing_match" && r.soft_conflict_risk_tier === "medium");
  sampleSlots = [
    { tag: "mismatch_medium", row: s1 },
    { tag: "keep_existing_medium", row: s2 },
    { tag: "keep_existing_medium_2", row: s3 },
  ];
} else {
  const s1 = pickAndRecord((r) => r.match_type === "mismatch" && r.soft_conflict_risk_tier === "medium");
  const s2 = pickAndRecord((r) => r.match_type === "keep_existing_match" && r.soft_conflict_risk_tier === "medium");
  const s3 = pickAndRecord(
    (r) =>
      (r.conflict_flags || []).includes("label_vs_signal_disagree") &&
      r.match_type !== "ok_true_pass" &&
      r.match_type !== "auto_empty_pass",
  );
  sampleSlots = [
    { tag: "mismatch_medium", row: s1 },
    { tag: "keep_existing_medium", row: s2 },
    { tag: "label_signal_disagree", row: s3 },
  ];
}

const recommendedSamples = sampleSlots.map(({ tag, row }) => {
  const enriched = enrichSample(row);
  if (!enriched) return { category: tag, sample: null, note: "후보 없음" };
  return { category: tag, sample: enriched };
});

// 이유/결정 집계 (자동 추천값 기준 — 사람 입력 전 단계)
const okIssueReasonCounts = Object.fromEntries(OK_ISSUE_REASON_OPTIONS.map((k) => [k, 0]));
const patIssueReasonCounts = Object.fromEntries(PAT_ISSUE_REASON_OPTIONS.map((k) => [k, 0]));
const decisionTargetDistribution = {
  send_to_ok_recheck_queue: 0,
  send_to_pat_review_queue: 0,
  send_to_override_candidate_queue: 0,
  leave_as_is: 0,
};
let confidenceSum = 0;
let confidenceCount = 0;

for (const r of rows) {
  if (r.match_type === "ok_true_pass" || r.match_type === "auto_empty_pass" || r.match_type === "vocab_keep")
    continue;
  const d = decisionTargetOf(r);
  decisionTargetDistribution[d.primary_decision] =
    (decisionTargetDistribution[d.primary_decision] || 0) + 1;
  confidenceSum += d.decision_confidence;
  confidenceCount++;
  if (r.soft_conflict_risk_tier) {
    okIssueReasonCounts[suggestOkIssueReason(r)]++;
  }
  if (r.match_type === "mismatch") {
    patIssueReasonCounts[suggestPatIssueReason(r)]++;
  }
}
const decisionConfidenceAvg =
  confidenceCount > 0 ? +(confidenceSum / confidenceCount).toFixed(3) : 0;

const humanReviewPack = {
  recommended_3_samples: recommendedSamples,
  decision_targets: [
    "send_to_ok_recheck_queue",
    "send_to_pat_review_queue",
    "leave_as_is",
  ],
  review_question_template: {
    ok_recheck_question:
      "해설이 선지의 핵심 판단을 실제로 반박/지지하는가, 아니면 엉뚱한 축을 설명하는가? ok 값 자체가 흔들리는가?",
    pat_recheck_question:
      "ok는 유지된다고 가정할 때, existing_pat 와 suggested_pat 중 어느 쪽이 실제 오류 구조(구조/표현/정서/개념/인과/보기 대입)에 더 직접적인가?",
  },
};

// ─── match 분해 ──────────────────────────────────────────────────────────────
// natural_match      = existing === suggested (전체)
// engine_true_match  = signal/label_hint 기반 판정이 실제 existing과 일치
// keep_existing_match= fallback.keep_existing 로 existing 유지해 match
// override_match     = override_case 경로로 match
// fallback_keep_existing_match = keep_existing_match 와 동일 (부분집합 요약)
let engineTrueMatch = 0;
let keepExistingMatch = 0;
let overrideMatch = 0;
let naturalMatch = 0;
for (const r of rows) {
  if (!r.match) continue;
  if (r.source === "ok_true" || r.source === "auto_empty" || r.source === "vocab_keep") continue;
  if (r.source === "ok_recheck_required") continue;
  naturalMatch++;
  if (r.source === "override_case") overrideMatch++;
  else if (r.source === "fallback_keep_existing") keepExistingMatch++;
  else if (r.source === "analysis_signal" || r.source === "label_hint") engineTrueMatch++;
}

// ─── soft conflict 경고 + review candidates ─────────────────────────────────
const softRate =
  counts.total > 0 ? +(softSelfConflictSuppressed / counts.total).toFixed(3) : 0;
const sensitivityWarning = softRate > 0.15;

const softReviewCandidates = rows
  .filter((r) => {
    const bothSignals = (r.__pos_count || 0) > 0 && (r.__neg_count || 0) > 0;
    if (!(r.polarity_emoji && bothSignals)) return false;
    const inMismatch = !r.match && r.source !== "ok_recheck_required" && r.source !== "ok_true";
    const inKeepExisting = r.match && r.source === "fallback_keep_existing";
    return inMismatch || inKeepExisting;
  })
  .slice(0, 10)
  .map((r) => ({
    choice_id: r.choice_id || r.loc,
    existing_pat: r.existing_pat,
    suggested_pat: r.suggested_pat,
    source: r.source,
    polarity_emoji: r.polarity_emoji,
    pos_count: r.__pos_count || 0,
    neg_count: r.__neg_count || 0,
  }));

// ─── boundary_pair_counts ────────────────────────────────────────────────────
const BOUNDARY_KEYS = [
  "L1→L4", "L4→L1", "L1→L3", "L3→L1",
  "R1→R2", "R2→R1", "R1→R4", "R4→R1",
];
const boundaryPairCounts = Object.fromEntries(BOUNDARY_KEYS.map((k) => [k, 0]));
for (const r of rows) {
  if (r.match || r.source === "ok_true" || r.source === "ok_recheck_required") continue;
  const key = `${r.existing_pat || "null"}→${r.suggested_pat || "null"}`;
  if (key in boundaryPairCounts) boundaryPairCounts[key]++;
}

// top mismatch pairs (정렬)
const topPairs = Object.entries(pairCounts)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 15)
  .map(([k, n]) => {
    const [from, to] = k.split("→");
    return { from, to, count: n };
  });

// 보고서
const reportPath = path.join(REPORT_DIR, "pat_decision_report.json");
const summary = {
  choice_count: counts.total,
  match: counts.match,
  match_breakdown: {
    natural_match: naturalMatch,
    engine_true_match: engineTrueMatch,
    keep_existing_match: keepExistingMatch,
    override_match: overrideMatch,
    fallback_keep_existing_match: keepExistingMatch,
  },
  mismatch: counts.mismatch,
  override: counts.override_applied,
  ok_recheck: counts.ok_recheck,
  mismatch_reason_counts: counts.mismatch_reason_counts,
  top_mismatch_pairs: topPairs,
  applied_rule_counts: counts.applied_rule_counts,
  ok_recheck_missed_suspects: counts.ok_recheck_missed_suspects,
  self_conflict: {
    soft: softSelfConflict,
    hard: hardSelfConflict,
  },
  polarity_emoji_present_count: polarityEmojiPresent,
  emoji_present_and_pos_neg_coexist_count: emojiPresentAndCoexist,
  soft_self_conflict_suppressed_count: softSelfConflictSuppressed,
  soft_self_conflict_rate: softRate,
  ok_recheck_sensitivity_warning: sensitivityWarning,
  soft_conflict_review_candidates: softReviewCandidates,
  soft_conflict_risk_counts: softRiskCounts,
  soft_conflict_by_match_type: softByMatchType,
  keep_existing_risk_count: keepExistingRiskCount,
  ok_recheck_candidate_top10: okRecheckCandidateTop10,
  ok_recheck_priority_candidates: okRecheckPriorityCandidates,
  keep_existing_risk_candidates: keepExistingRiskCandidates,
  mismatch_soft_conflict_candidates: mismatchSoftConflictCandidates,
  keep_existing_medium_ratio: keepExistingMediumRatio,
  keep_existing_review_priority: keepExistingReviewPriority,
  human_review_pack: humanReviewPack,
  ok_issue_reason_counts: okIssueReasonCounts,
  pat_issue_reason_counts: patIssueReasonCounts,
  decision_target_distribution: decisionTargetDistribution,
  decision_confidence_avg: decisionConfidenceAvg,
  boundary_pair_counts: boundaryPairCounts,
  rule_candidate_pairs: ruleCandidatePairs.slice(0, 10),
  true_override_pairs: trueOverridePairs.slice(0, 10),
  batch_override_candidates: batchOverrideGroups.slice(0, 10),
};
const report = {
  meta: {
    generated_at: new Date().toISOString(),
    exam: EXAM,
    set_filter: SET,
    mode: DRY_RUN ? "dry-run" : "apply",
    rules_version: rules.version,
    signal_map_version: signalMap.version,
    override_version: overrideFile.version,
  },
  summary,
  counts,
  rows,
};
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");

// ─── 콘솔 ────────────────────────────────────────────────────────────────────
console.log("═".repeat(60));
console.log(` pat_decision_engine — ${EXAM}${SET ? ` / ${SET}` : ""} (${DRY_RUN ? "dry-run" : "apply"})`);
console.log("═".repeat(60));
console.log(`\n[총계] 선지 ${counts.total}`);
console.log(`  일치(match):       ${counts.match}`);
console.log(`  불일치(mismatch):  ${counts.mismatch}`);
console.log(`  ok:true:           ${counts.ok_true}`);
console.log(`  auto_empty/V:      ${counts.auto_empty}`);
console.log(`  override 적용:     ${counts.override_applied}`);
console.log(`  ok_recheck_queue:  ${counts.ok_recheck}`);

console.log(`\n[source별 분포]`);
for (const [s, n] of Object.entries(counts.by_source))
  console.log(`  ${s.padEnd(18)} ${n}`);

console.log(`\n[mismatch 버킷]`);
for (const [b, n] of Object.entries(counts.mismatch_reason_counts))
  console.log(`  ${b.padEnd(20)} ${n}`);
console.log(`  ok_recheck_missed_suspects: ${counts.ok_recheck_missed_suspects}`);

console.log(`\n[match 분해]`);
console.log(`  natural_match              ${naturalMatch}`);
console.log(`  ├ engine_true_match        ${engineTrueMatch}`);
console.log(`  ├ keep_existing_match      ${keepExistingMatch}${keepExistingMatch > 0 ? "  (← 엔진 정확도 아님, fallback 유지)" : ""}`);
console.log(`  └ override_match           ${overrideMatch}`);

console.log(`\n[self_conflict] soft ${softSelfConflict} / hard ${hardSelfConflict}`);
console.log(`[polarity 보조]`);
console.log(`  polarity_emoji_present_count:            ${polarityEmojiPresent}`);
console.log(`  emoji_present_and_pos_neg_coexist_count: ${emojiPresentAndCoexist}`);
console.log(`  soft_self_conflict_suppressed_count:     ${softSelfConflictSuppressed}`);
console.log(`  soft_self_conflict_rate:                 ${softRate}${sensitivityWarning ? "  ⚠️ WARNING (> 0.15)" : ""}`);
console.log(`  ok_recheck_sensitivity_warning:          ${sensitivityWarning}`);

console.log(`\n[boundary_pair_counts]`);
const col1 = BOUNDARY_KEYS.slice(0, 4);
const col2 = BOUNDARY_KEYS.slice(4);
for (let i = 0; i < col1.length; i++) {
  console.log(`  ${col1[i].padEnd(8)} ${String(boundaryPairCounts[col1[i]]).padStart(2)}    ${col2[i].padEnd(8)} ${String(boundaryPairCounts[col2[i]]).padStart(2)}`);
}

console.log(`\n[soft_conflict_risk_counts]  low ${softRiskCounts.low} / medium ${softRiskCounts.medium} / high ${softRiskCounts.high}`);
console.log(`[soft_conflict_by_match_type]`);
for (const [k, v] of Object.entries(softByMatchType)) {
  if (v > 0) console.log(`  ${k.padEnd(22)} ${v}`);
}
console.log(`[keep_existing_risk_count]  ${keepExistingRiskCount} (keep_existing_match 중 risk medium/high)`);

function printCandidateList(label, list) {
  console.log(`\n[${label} top ${list.length}]`);
  if (list.length === 0) { console.log("  (없음)"); return; }
  for (const c of list) {
    console.log(
      `  ${c.choice_id}  score=${c.ok_recheck_candidate_score}  tier=${c.soft_conflict_risk_tier}  mt=${c.match_type}  route=${c.route}  emoji=${c.polarity_emoji || "-"}`,
    );
  }
}
if (args.includes("--verbose")) {
  printCandidateList("ok_recheck_priority_candidates", okRecheckPriorityCandidates);
  printCandidateList("keep_existing_risk_candidates", keepExistingRiskCandidates);
  printCandidateList("mismatch_soft_conflict_candidates", mismatchSoftConflictCandidates);

  console.log(
    `\n[keep_existing_review_priority] ${keepExistingReviewPriority}  (medium/high 비율 = ${keepExistingMediumRatio}, total ${keepExistingTotal})`,
  );

  console.log(`\n[decision_target_distribution] OK:${decisionTargetDistribution.send_to_ok_recheck_queue} / PAT:${decisionTargetDistribution.send_to_pat_review_queue} / leave_as_is:${decisionTargetDistribution.leave_as_is}  (decision_confidence_avg=${decisionConfidenceAvg})`);
  console.log(`[ok_issue_reason_counts (자동 추천 분포)]`);
  for (const [k, v] of Object.entries(okIssueReasonCounts))
    if (v > 0) console.log(`  ${k.padEnd(28)} ${v}`);
  console.log(`[pat_issue_reason_counts (자동 추천 분포)]`);
  for (const [k, v] of Object.entries(patIssueReasonCounts))
    if (v > 0) console.log(`  ${k.padEnd(28)} ${v}`);

  console.log(`\n[human_review_pack — recommended samples (${recommendedSamples.length})]`);
  for (const entry of recommendedSamples) {
    console.log(`\n── [${entry.category}] ──`);
    if (!entry.sample) {
      console.log(`  (후보 없음 — ${entry.note || ""})`);
      continue;
    }
    const s = entry.sample;
    console.log(`  choice_id:      ${s.choice_id}`);
    console.log(`  existing→sugg:  ${s.existing_pat}→${s.suggested_pat}  (match_type=${s.match_type}, tier=${s.soft_conflict_risk_tier}, score=${s.ok_recheck_candidate_score})`);
    console.log(`  applied_rule:   ${s.applied_rule_id}`);
    console.log(`  flags:          ${(s.conflict_flags||[]).join(", ") || "(없음)"}`);
    console.log(`  short_reason:   ${s.short_reason}`);
    console.log(`  primary→${s.primary_decision}  (conf=${s.decision_confidence})`);
    console.log(`  secondary→${s.secondary_decision || "(없음)"}`);
    console.log(`  ok_recheck_Q:   ${s.ok_recheck_question}`);
    console.log(`  pat_recheck_Q:  ${s.pat_recheck_question}`);
    console.log(`  ok_issue_reason options: [${s.ok_issue_reason_options.join("|")}]  suggested=${s.ok_issue_reason_suggested}`);
    console.log(`  pat_issue_reason options: [${s.pat_issue_reason_options.join("|")}]  suggested=${s.pat_issue_reason_suggested}`);
  }
}

console.log(`\n[rule_candidate_pairs (규칙 흡수 후보, 상위 5)]`);
for (const r of ruleCandidatePairs.slice(0, 5))
  console.log(`  ${r.pair.padEnd(14)} ×${r.count}  rule=${r.applied_rule_id}  sig_ratio=${r.dominant_ratio}`);

console.log(`\n[true_override_pairs (개별 override 필요, 상위 5)]`);
for (const r of trueOverridePairs.slice(0, 5))
  console.log(`  ${r.pair.padEnd(14)} ×${r.count}  reason=${r.reason}${r.distinct_rules ? ` rules=${r.distinct_rules.join("|")}` : ""}`);

console.log(`\n[batch_override 후보 그룹 수: ${batchOverrideGroups.length}] (safe=강화 기준 충족, 상위 5)`);
for (const g of batchOverrideGroups.slice(0, 5)) {
  const axis = (g.dominant_choice_axis || []).slice(0, 3).join(",");
  const sig = (g.dominant_signal_signature || []).slice(0, 3).join(",");
  console.log(`  ${g.pair.padEnd(12)} ×${g.count}  rule=${g.applied_rule_id.padEnd(28)}  axis=[${axis}]  signal=[${sig}]  safe=${g.safe_batch_candidate}`);
  console.log(`    samples: ${(g.sample_choice_ids || []).join(", ")}`);
}

const VERBOSE = args.includes("--verbose");

if (VERBOSE) {
  console.log(`\n[top_mismatch_pairs (상위 10)]`);
  for (const p of topPairs.slice(0, 10))
    console.log(`  ${p.from.padEnd(6)} → ${p.to.padEnd(6)}  ${p.count}`);

  console.log(`\n[applied_rule_counts (상위 15)]`);
  const ranked = Object.entries(counts.applied_rule_counts).sort((a, b) => b[1] - a[1]);
  for (const [r, n] of ranked.slice(0, 15)) console.log(`  ${r.padEnd(36)} ${n}`);

  console.log(`\n[mismatch 상세 (버킷 포함, 상위 20)]`);
  const mrows = rows
    .filter((r) => !r.match && r.source !== "ok_true" && r.source !== "ok_recheck_required")
    .slice(0, 20);
  for (const r of mrows) {
    const flags = r.conflict_flags.length ? ` [${r.conflict_flags.join(",")}]` : "";
    const gap = r.top2_gap !== null ? ` gap=${r.top2_gap}` : "";
    console.log(
      `  ${r.loc}  ${r.existing_pat || "null"}→${r.suggested_pat || "null"}  [${r.mismatch_reason_code || "-"}]  (${r.applied_rule_id})${gap}${flags}`,
    );
  }
} else if (counts.mismatch > 0) {
  console.log(`\n[top_mismatch_pairs (상위 5)]`);
  for (const p of topPairs.slice(0, 5))
    console.log(`  ${p.from.padEnd(6)} → ${p.to.padEnd(6)}  ${p.count}`);
  console.log(`\n(상세는 --verbose 또는 pipeline/reports/pat_decision_report.json 참조)`);
}

console.log(`\n📄 저장: ${path.relative(ROOT, reportPath)}`);
