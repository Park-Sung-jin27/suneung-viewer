/**
 * pipeline/make_review_template_extended.mjs
 *
 * 기존 human_review_template_<exam>.json (3건) 에 추가 샘플 7건을 붙여
 * 확장 템플릿(10건)을 만든다. config/* 는 수정하지 않는다.
 *
 * 우선순위:
 *   1) mismatch + medium + conflict_flags.label_vs_signal_disagree
 *   2) keep_existing_match + medium
 *   3) mismatch + medium (기타)
 *   4) 잔여 — medium risk 중에서 채움
 *
 * 사용법 (PowerShell):
 *   cd C:/Users/downf/suneung-viewer
 *   node pipeline/pat_decision_engine.mjs --exam 2026수능 --dry-run
 *   node pipeline/make_review_template_extended.mjs --exam 2026수능
 *
 * 출력: pipeline/reports/human_review_template_extended_<exam>.json
 *
 * [주의] 이 스크립트는 signal_map / override_cases / rules / threshold 를 변경하지 않음.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const REPORT_PATH = path.join(__dirname, "reports", "pat_decision_report.json");
const OUT_DIR = path.join(__dirname, "reports");

const args = process.argv.slice(2);
function getArg(name, fallback = null) {
  const i = args.indexOf(name);
  return i >= 0 && i + 1 < args.length && !args[i + 1].startsWith("--")
    ? args[i + 1]
    : fallback;
}
const EXAM = getArg("--exam");
const ADD = Number(getArg("--add", "7"));
const BASE_PATH = path.join(OUT_DIR, `human_review_template_${EXAM}.json`);

if (!EXAM) {
  console.error(
    "사용법: node pipeline/make_review_template_extended.mjs --exam <연도키> [--add 7]",
  );
  process.exit(1);
}
if (!fs.existsSync(REPORT_PATH)) {
  console.error(`❌ 엔진 리포트 없음: ${REPORT_PATH}`);
  process.exit(1);
}
const report = JSON.parse(fs.readFileSync(REPORT_PATH, "utf8"));
if (report.meta?.exam !== EXAM) {
  console.error(
    `❌ 엔진 리포트 exam="${report.meta?.exam}" ≠ 요청 exam="${EXAM}". 엔진을 해당 exam으로 재실행 후 재시도.`,
  );
  process.exit(1);
}
if (!fs.existsSync(BASE_PATH)) {
  console.error(
    `❌ 기존 템플릿 없음: ${BASE_PATH}. 먼저 make_review_template.mjs 실행.`,
  );
  process.exit(1);
}
const base = JSON.parse(fs.readFileSync(BASE_PATH, "utf8"));
const baseIds = new Set((base.reviews || []).map((r) => r.choice_id));

// ── 원문 보강용 데이터 로더 ─────────────────────────────────────────────────
const DATA_PATH = path.join(ROOT, "public", "data", "all_data_204.json");
const __allData = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
function parseChoiceId(cid) {
  const parts = String(cid).split("/");
  if (parts.length < 4) return null;
  const setId = parts[1];
  const qm = parts[2].match(/^Q(.+)$/);
  const cm = parts[3].match(/^#(\d+)$/);
  if (!qm || !cm) return null;
  return { setId, qId: qm[1], num: Number(cm[1]) };
}
function buildExamIndex(data, exam) {
  const idx = new Map();
  const e = data[exam];
  if (!e) return idx;
  for (const [section, domainChar] of [["reading", "R"], ["literature", "L"]]) {
    const sets = e[section] || [];
    for (const set of sets) {
      idx.set(set.id, { domain: domainChar, section, set });
    }
  }
  return idx;
}
function findQuestion(setObj, qIdRaw) {
  const qStr = String(qIdRaw);
  const qNum = Number(qIdRaw);
  const questions = setObj.questions || [];
  for (const q of questions) if (String(q.id) === qStr) return q;
  if (!Number.isNaN(qNum)) {
    for (const q of questions) if (Number(q.id) === qNum) return q;
  }
  return null;
}
function findChoice(questionObj, numRaw) {
  const nStr = String(numRaw);
  const nNum = Number(numRaw);
  const choices = questionObj.choices || [];
  for (const c of choices) if (String(c.num) === nStr) return c;
  if (!Number.isNaN(nNum)) {
    for (const c of choices) if (Number(c.num) === nNum) return c;
  }
  return null;
}
function enrichmentFor(choiceId, index) {
  const p = parseChoiceId(choiceId);
  if (!p) return null;
  const sEntry = index.get(p.setId);
  const out = {
    set_id: p.setId,
    question_id: p.qId,
    choice_num: p.num,
    domain: sEntry?.domain ?? null,
    question_text: null,
    bogi_text: null,
    choice_text: null,
    analysis_text: null,
    _match_status: sEntry ? "set_found" : "set_missing",
  };
  if (!sEntry) return out;
  const q = findQuestion(sEntry.set, p.qId);
  if (!q) {
    out._match_status = "question_missing";
    return out;
  }
  out.question_text = q.t ?? null;
  out.bogi_text = q.bogi ?? null;
  const ch = findChoice(q, p.num);
  if (!ch) {
    out._match_status = "choice_missing";
    return out;
  }
  out.choice_text = ch.t ?? null;
  out.analysis_text = ch.analysis ?? null;
  out._match_status = "ok";
  return out;
}
const __examIndex = buildExamIndex(__allData, EXAM);

// 기존 base.reviews 항목에 원문 필드가 없으면 채워 넣는다 (기존 3건 보강)
for (const rv of base.reviews || []) {
  const src = enrichmentFor(rv.choice_id, __examIndex);
  if (!src) continue;
  rv.set_id ??= src.set_id;
  rv.question_id ??= src.question_id;
  rv.choice_num ??= src.choice_num;
  rv.domain ??= src.domain;
  rv.question_text ??= src.question_text;
  rv.bogi_text ??= src.bogi_text;
  rv.choice_text ??= src.choice_text;
  rv.analysis_text ??= src.analysis_text;
}

// ── 후보 버킷 구성 ──────────────────────────────────────────────────────────
const rows = report.rows || [];
function isMedium(r) {
  return r.soft_conflict_risk_tier === "medium";
}
function hasLabelDisagree(r) {
  return Array.isArray(r.conflict_flags) && r.conflict_flags.includes("label_vs_signal_disagree");
}

const bucketA = []; // mismatch + medium + label_vs_signal_disagree
const bucketB = []; // keep_existing_match + medium
const bucketC = []; // mismatch + medium (nonA)
const bucketD = []; // 기타 medium

for (const r of rows) {
  if (baseIds.has(r.choice_id)) continue;
  if (!isMedium(r)) continue;
  if (r.match_type === "mismatch" && hasLabelDisagree(r)) bucketA.push(r);
  else if (r.match_type === "keep_existing_match") bucketB.push(r);
  else if (r.match_type === "mismatch") bucketC.push(r);
  else bucketD.push(r);
}

// ok_recheck_candidate_score 내림차순 정렬로 "중요해 보이는" 샘플 우선
const byScoreDesc = (a, b) =>
  (b.ok_recheck_candidate_score || 0) - (a.ok_recheck_candidate_score || 0);
bucketA.sort(byScoreDesc);
bucketB.sort(byScoreDesc);
bucketC.sort(byScoreDesc);
bucketD.sort(byScoreDesc);

// ── 7건 선택: A 최대 3, B 최대 3, C 잔여, D 최후 ────────────────────────────
function take(bucket, n, out, taken) {
  for (const r of bucket) {
    if (out.length >= n) break;
    if (taken.has(r.choice_id)) continue;
    out.push(r);
    taken.add(r.choice_id);
  }
}
const picked = [];
const takenSet = new Set();
take(bucketA, Math.min(3, ADD), picked, takenSet);
take(bucketB, Math.min(picked.length + 3, ADD), picked, takenSet);
take(bucketC, ADD, picked, takenSet);
take(bucketD, ADD, picked, takenSet);
const added = picked.slice(0, ADD);

// ── 카테고리 라벨 ────────────────────────────────────────────────────────────
function categoryOf(r) {
  if (r.match_type === "keep_existing_match") return "keep_existing_medium";
  if (r.match_type === "mismatch" && hasLabelDisagree(r)) return "label_signal_disagree";
  if (r.match_type === "mismatch") return "mismatch_medium";
  return "other";
}

// ── suggestion 간이 도출 (sample 레벨 필드가 rows엔 없음 — 근사치) ──────────
function okIssueReasonSuggested(r) {
  if (r.match_type === "keep_existing_match") return "keep_existing_risk";
  // polarity 기반: emoji + pos/neg 공존이면 polarity_conflict 후보
  const mix = (r.__pos_count || 0) > 0 && (r.__neg_count || 0) > 0;
  if (r.polarity_emoji && mix) return "polarity_conflict";
  return "axis_mismatch";
}
function patIssueReasonSuggested(r) {
  const rid = r.applied_rule_id || "";
  if (rid.includes("fact_distortion") || rid.includes("causal_inversion")) return "cause_vs_fact";
  if (rid.includes("structure_misread")) return "structure_vs_form";
  if (rid.includes("concept_misuse")) return "concept_confusion";
  if (rid.includes("theme_vs_expression")) return "theme_vs_expression";
  return "unclear";
}
function primaryOf(r) {
  if (r.match_type === "keep_existing_match") return "send_to_ok_recheck_queue";
  if (r.match_type === "mismatch") return "send_to_pat_review_queue";
  return "leave_as_is";
}
function secondaryOf(r) {
  if (r.match_type === "keep_existing_match") return "send_to_pat_review_queue";
  if (r.match_type === "mismatch") return "send_to_ok_recheck_queue";
  return null;
}
function confOf(r) {
  if (r.match_type === "keep_existing_match") return 0.55;
  if (r.match_type === "mismatch") return 0.5;
  return 0.6;
}

// ── review entry 구성 ────────────────────────────────────────────────────────
function buildReview(r) {
  const okSugg = okIssueReasonSuggested(r);
  const patSugg = patIssueReasonSuggested(r);
  const prim = primaryOf(r);
  const sec = secondaryOf(r);
  const conf = confOf(r);
  const src = enrichmentFor(r.choice_id, __examIndex) || {};
  return {
    choice_id: r.choice_id,
    exam: EXAM,
    category: categoryOf(r),
    // ── 원문 (검수용, 읽기 전용) ────────────────────
    set_id: src.set_id ?? null,
    question_id: src.question_id ?? null,
    choice_num: src.choice_num ?? null,
    domain: src.domain ?? null,
    question_text: src.question_text ?? null,
    bogi_text: src.bogi_text ?? null,
    choice_text: src.choice_text ?? null,
    analysis_text: src.analysis_text ?? null,
    engine_snapshot: {
      existing_pat: r.existing_pat ?? null,
      suggested_pat: r.suggested_pat ?? null,
      match_type: r.match_type,
      soft_conflict_risk_tier: r.soft_conflict_risk_tier,
      ok_recheck_candidate_score: r.ok_recheck_candidate_score,
      applied_rule_id: r.applied_rule_id,
      conflict_flags: r.conflict_flags || [],
      primary_decision: prim,
      secondary_decision: sec,
      decision_confidence: conf,
      ok_issue_reason_suggested: okSugg,
      pat_issue_reason_suggested: patSugg,
    },
    ok_issue_reason: `TODO: [axis_mismatch|analysis_self_conflict|polarity_conflict|keep_existing_risk|unclear|none] (엔진 제안=${okSugg})`,
    pat_issue_reason: `TODO: [structure_vs_form|cause_vs_fact|concept_confusion|theme_vs_expression|unclear|none] (엔진 제안=${patSugg})`,
    final_decision: `TODO: [send_to_ok_recheck_queue|send_to_pat_review_queue|send_to_override_candidate_queue|leave_as_is] (엔진 primary=${prim}, secondary=${sec})`,
    human_pat_suggestion: null,
    human_ok_suggestion: null,
    agreed_with_engine: "TODO: true|false",
    notes: "TODO: 간단 메모 (해설이 어느 축을 설명하는지, 선지가 어느 축에서 틀렸는지)",
    _engine_short_reason: `${r.match_type} ${r.existing_pat || "?"}→${r.suggested_pat || "?"} · risk=${r.soft_conflict_risk_tier} · rule=${r.applied_rule_id}`,
  };
}

const addedReviews = added.map(buildReview);
const allReviews = [...(base.reviews || []), ...addedReviews];

// ── 엔진 제안 분포 (사람 검수 아님) ─────────────────────────────────────────
// ⚠️ 이 수치는 engine primary_decision 기반 "제안" 분포이며, 실제 human_confirmed 가 아님.
// ⚠️ 샘플링 편향(예: 2025의 keep_existing_review_priority=high) 이 그대로 반영됨.
function snapOf(rev) {
  return rev.engine_snapshot || {};
}
const total = allReviews.length;
let nOkRecheck = 0, nPatReview = 0, nOverride = 0, nLeave = 0;
let nKeepExistingSampled = 0;
for (const rv of allReviews) {
  const p = snapOf(rv).primary_decision;
  if (p === "send_to_ok_recheck_queue") nOkRecheck++;
  else if (p === "send_to_pat_review_queue") nPatReview++;
  else if (p === "send_to_override_candidate_queue") nOverride++;
  else if (p === "leave_as_is") nLeave++;
  if (snapOf(rv).match_type === "keep_existing_match") nKeepExistingSampled++;
}
function pct(n) {
  return total ? +(n / total).toFixed(3) : 0;
}
// 엔진 제안 분포 — 사람 검수 결과 아님
const engineSuggested = {
  reviews_total: total,
  ok_recheck_rate_suggested: pct(nOkRecheck),
  pat_review_rate_suggested: pct(nPatReview),
  override_candidate_rate_suggested: pct(nOverride),
  leave_as_is_rate_suggested: pct(nLeave),
  keep_existing_sampled_rate: pct(nKeepExistingSampled),
};
// human_confirmed 와 agreement 는 검수 입력 후에만 채워짐 — 여기서는 자리표시
const humanConfirmedPlaceholder = {
  status: "pending_human_review",
  reviews_total: total,
  engine_primary_retained_rate: null,
  flipped_to_ok_recheck_rate: null,
  retained_as_pat_review_rate: null,
  keep_existing_confirmed_risk_rate: null,
  per_boundary_agreement: {
    "R1↔R2": null,
    "L1↔L4": null,
    "L1↔L3": null,
  },
  note:
    "값은 load_review_results 통과 후 generate_tuning_suggestions 의 human_vs_engine_diff 단계에서 채워진다.",
};

// ── 출력 템플릿 ──────────────────────────────────────────────────────────────
const out = {
  meta: {
    ...(base.meta || {}),
    reviewer: base.meta?.reviewer || "TODO: reviewer_name",
    round_label: base.meta?.round_label || `TODO: ${new Date().toISOString().slice(0, 10)}-R?`,
    report_snapshot: {
      exam: EXAM,
      report_generated_at: report.meta.generated_at,
      rules_version: report.meta.rules_version,
      signal_map_version: report.meta.signal_map_version,
      override_version: report.meta.override_version,
    },
    notes:
      "확장 템플릿: 기존 3건 + 신규 7건 = 10건. engine_snapshot / _engine_* 는 읽기 전용. TODO: 필드만 채우세요.",
    _extension: {
      base_reviews: (base.reviews || []).length,
      added_reviews: addedReviews.length,
      generated_by: "make_review_template_extended.mjs",
    },
  },
  _engine_suggested_distribution: engineSuggested,
  _human_confirmed_distribution: humanConfirmedPlaceholder,
  reviews: allReviews,
};

fs.mkdirSync(OUT_DIR, { recursive: true });
const OUT_PATH = path.join(OUT_DIR, `human_review_template_extended_${EXAM}.json`);
fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2), "utf8");

// ── 콘솔 ────────────────────────────────────────────────────────────────────
console.log("═".repeat(60));
console.log(` make_review_template_extended — ${EXAM}`);
console.log("═".repeat(60));
console.log(`\n기존 reviews:   ${(base.reviews || []).length}`);
console.log(`신규 추가:      ${addedReviews.length}`);
console.log(`총계:           ${allReviews.length}`);

console.log(`\n[신규 7건 분포]`);
const catCounts = {};
for (const rv of addedReviews) catCounts[rv.category] = (catCounts[rv.category] || 0) + 1;
for (const [k, v] of Object.entries(catCounts)) console.log(`  · ${k}: ${v}건`);

console.log(`\n[엔진 제안 분포 — 사람 검수 아님 / 샘플링 편향 포함]`);
console.log(`  ok_recheck (제안):        ${(engineSuggested.ok_recheck_rate_suggested * 100).toFixed(1)}%`);
console.log(`  pat_review (제안):        ${(engineSuggested.pat_review_rate_suggested * 100).toFixed(1)}%`);
console.log(`  override_candidate (제안):${(engineSuggested.override_candidate_rate_suggested * 100).toFixed(1)}%`);
console.log(`  leave_as_is (제안):       ${(engineSuggested.leave_as_is_rate_suggested * 100).toFixed(1)}%`);
console.log(`  keep_existing_sampled:    ${(engineSuggested.keep_existing_sampled_rate * 100).toFixed(1)}%  (※ 샘플링 비율일 뿐, 실제 risk 적중률 아님)`);
console.log(`\n[human_confirmed 분포]  → pending — 10건 검수 입력 후 generate_tuning_suggestions 가 채움`);
console.log(`  · engine_primary_retained_rate`);
console.log(`  · flipped_to_ok_recheck_rate`);
console.log(`  · retained_as_pat_review_rate`);
console.log(`  · keep_existing_confirmed_risk_rate`);
console.log(`  · per_boundary_agreement: R1↔R2 / L1↔L4 / L1↔L3`);

// ── 매핑 정확도 점검 — PDF 대조용 덤프 ───────────────────────────────────
console.log(`\n[원문 매핑 점검 — PDF 와 대조하세요 · 랜덤 5건]`);
function pickN(arr, n) {
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, Math.min(n, copy.length));
}
const verify = pickN(allReviews, 5);
for (const rv of verify) {
  const st = enrichmentFor(rv.choice_id, __examIndex)?._match_status || "?";
  console.log(`\n  • ${rv.choice_id}  [status=${st}]`);
  console.log(`    set/q/#:       ${rv.set_id} / Q${rv.question_id} / #${rv.choice_num}  (domain=${rv.domain})`);
  console.log(`    question_text: ${(rv.question_text || "(null)").slice(0, 100)}`);
  console.log(`    choice_text:   ${(rv.choice_text || "(null)").slice(0, 100)}`);
}
const badMatches = allReviews.filter((rv) => {
  const st = enrichmentFor(rv.choice_id, __examIndex)?._match_status;
  return st !== "ok";
});
if (badMatches.length > 0) {
  console.log(`\n  🔴 매핑 실패 ${badMatches.length}건: ${badMatches.map((r) => r.choice_id).join(", ")}`);
} else {
  console.log(`\n  ✅ 전체 ${allReviews.length}건 매핑 status=ok`);
}

console.log(`\n📄 저장: ${path.relative(ROOT, OUT_PATH)}`);

console.log(`\n${"─".repeat(60)}`);
console.log("⚠️  현재 제안은 샘플 3건 기반 — 적용 금지");
console.log("⚠️  위 분포는 '엔진 제안'이며 샘플링 편향 포함 — 사실이 아닌 가설");
console.log("⚠️  다음 단계: 10건 사람 검수 입력 → engine vs human diff 로 판단");
console.log(`${"─".repeat(60)}`);
