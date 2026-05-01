/**
 * pipeline/generate_tuning_suggestions.mjs
 *
 * 사람 검수 결과(config/human_review_results*.json)를 읽어
 * signal_map / override_cases / decision threshold 에 대한
 * "제안(suggestion)"만 생성한다. **자동 적용 금지.**
 *
 * 사용법 (PowerShell):
 *   cd C:/Users/downf/suneung-viewer
 *   node pipeline/generate_tuning_suggestions.mjs --exam 2026수능 --results config/human_review_results.json
 *   node pipeline/generate_tuning_suggestions.mjs --exam 2025수능 --results config/human_review_results_2025.json
 *
 * 출력: pipeline/reports/tuning_suggestion_report_<exam>.json
 *
 * [제안 범위]
 * 1) signal_weight_candidates
 *    - pat_issue_reason 버킷별 반복 → 해당 경계 신호 조정 후보
 *    - structure_vs_form  → L1↔L4 (signal.structure_misread)
 *    - cause_vs_fact      → R1↔R2 (signal.fact_distortion / signal.causal_inversion)
 *    - concept_confusion  → R4    (signal.concept_misuse)
 *    - theme_vs_expression→ L1↔L3 (signal.theme_vs_expression)
 *
 * 2) override_candidates
 *    - final_decision == send_to_override_candidate_queue 인 리뷰만 수집
 *    - 자동 승격 금지. 이 리스트는 human pat_override 후보 큐 입력용.
 *
 * 3) decision_threshold_candidates
 *    - keep_existing_risk 반복   → fallback.keep_existing 에서 ok_recheck 승격 임계 조정
 *    - agreed_with_engine=false 반복 → primary/secondary 스왑 임계 조정
 *    - ok_issue_reason 특정 축 몰림 → ok_recheck_candidate_score 가중치 조정
 *
 * [강도]
 *   evidence_count 1  → low
 *   evidence_count 2  → medium
 *   evidence_count 3+ → high
 *
 * 주의: 이 스크립트는 config/ 아래 파일을 **수정하지 않는다**.
 *       제안 리포트만 쓴다.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const args = process.argv.slice(2);
function getArg(name, fallback = null) {
  const i = args.indexOf(name);
  return i >= 0 && i + 1 < args.length && !args[i + 1].startsWith("--")
    ? args[i + 1]
    : fallback;
}
const EXAM = getArg("--exam");
const RESULTS_PATH = getArg("--results")
  ? path.resolve(ROOT, getArg("--results"))
  : null;
const REPORT_PATH = path.resolve(
  ROOT,
  getArg("--report", "pipeline/reports/pat_decision_report.json"),
);
const OUT_DIR = path.resolve(ROOT, "pipeline/reports");

if (!EXAM || !RESULTS_PATH) {
  console.error(
    "사용법: node pipeline/generate_tuning_suggestions.mjs --exam <연도키> --results <경로>",
  );
  process.exit(1);
}
if (!fs.existsSync(RESULTS_PATH)) {
  console.error(`❌ 결과 파일 없음: ${RESULTS_PATH}`);
  process.exit(1);
}

const results = JSON.parse(fs.readFileSync(RESULTS_PATH, "utf8"));
if (!results.meta || results.meta.report_snapshot?.exam !== EXAM) {
  console.error(
    `❌ results.meta.report_snapshot.exam="${results.meta?.report_snapshot?.exam}" — 요청 exam="${EXAM}"과 불일치`,
  );
  process.exit(1);
}

// ── 엔진 리포트 (옵션, 존재하면 참조) ────────────────────────────────────────
let engineReport = null;
if (fs.existsSync(REPORT_PATH)) {
  engineReport = JSON.parse(fs.readFileSync(REPORT_PATH, "utf8"));
  if (engineReport.meta?.exam !== EXAM) {
    console.warn(
      `⚠️  엔진 리포트의 exam(${engineReport.meta?.exam}) 과 요청 exam(${EXAM}) 불일치 — 일부 교차 검증 스킵`,
    );
    engineReport = null;
  }
}

// ── 강도 매핑 ────────────────────────────────────────────────────────────────
function strengthOf(n) {
  if (n >= 3) return "high";
  if (n === 2) return "medium";
  if (n === 1) return "low";
  return null;
}

// ── pat_issue_reason → 신호/경계 매핑 ────────────────────────────────────────
const PAT_REASON_TO_SIGNAL = {
  structure_vs_form: {
    target: "signal.structure_misread",
    boundary: "L1↔L4",
    hint:
      "구조/서사 전개(L4) vs 표현 방식(L1) 경계 — L4 측 키워드 가중치 상향 후보",
  },
  cause_vs_fact: {
    target: "signal.fact_distortion / signal.causal_inversion",
    boundary: "R1↔R2",
    hint:
      "사실 왜곡(R1) vs 인과 뒤집기(R2) 경계 — existing/suggested 방향성 확인 후 해당 signal keyword 가중치 조정 후보",
  },
  concept_confusion: {
    target: "signal.concept_misuse",
    boundary: "R4 축 강화",
    hint: "개념 혼동(R4) signal 강화 후보",
  },
  theme_vs_expression: {
    target: "signal.theme_vs_expression",
    boundary: "L1↔L3",
    hint: "주제/의미 과잉(L3) vs 표현 방식(L1) 경계",
  },
};

// ── ok_issue_reason 집계 기준 ────────────────────────────────────────────────
const OK_REASON_SIGNALS = ["axis_mismatch", "analysis_self_conflict", "polarity_conflict", "keep_existing_risk"];

// ── 리뷰 집계 ────────────────────────────────────────────────────────────────
const reviews = Array.isArray(results.reviews) ? results.reviews : [];
const patBuckets = {}; // pat_issue_reason → {count, choice_ids, pat_directions}
const okBuckets = {};  // ok_issue_reason → {count, choice_ids}
const overrideCands = [];
const disagreeRows = [];
let agreedCount = 0;

for (const r of reviews) {
  if (r.agreed_with_engine === true) agreedCount++;
  else if (r.agreed_with_engine === false) disagreeRows.push(r);

  const pr = r.pat_issue_reason;
  if (pr && pr !== "none" && pr !== "unclear") {
    if (!patBuckets[pr]) patBuckets[pr] = { count: 0, choice_ids: [], pat_directions: [] };
    patBuckets[pr].count++;
    patBuckets[pr].choice_ids.push(r.choice_id);
    const snap = r.engine_snapshot || {};
    if (snap.existing_pat || snap.suggested_pat) {
      patBuckets[pr].pat_directions.push(
        `${snap.existing_pat || "?"}→${snap.suggested_pat || "?"}`,
      );
    }
  }

  const okr = r.ok_issue_reason;
  if (okr && OK_REASON_SIGNALS.includes(okr)) {
    if (!okBuckets[okr]) okBuckets[okr] = { count: 0, choice_ids: [] };
    okBuckets[okr].count++;
    okBuckets[okr].choice_ids.push(r.choice_id);
  }

  if (r.final_decision === "send_to_override_candidate_queue") {
    const snap = r.engine_snapshot || {};
    overrideCands.push({
      choice_id: r.choice_id,
      current_pat: snap.existing_pat ?? null,
      suggested_pat: r.human_pat_suggestion ?? snap.suggested_pat ?? null,
      engine_match_type: snap.match_type ?? null,
      ok_issue_reason: r.ok_issue_reason,
      pat_issue_reason: r.pat_issue_reason,
      reason:
        r.human_pat_suggestion
          ? `human 제안 pat=${r.human_pat_suggestion} — 후보 큐 승격 검토`
          : "human이 override_candidate_queue 로 라우팅 — 후보 큐 승격 검토",
      confidence: "low", // human 1건 신호. 집계상 한 샘플 = low
      notes: r.notes || null,
    });
  }
}

const agreedRate =
  reviews.length > 0 ? +(agreedCount / reviews.length).toFixed(3) : 0;

// ── 1) signal_weight_candidates ─────────────────────────────────────────────
const signalWeightCandidates = [];
for (const [reason, info] of Object.entries(patBuckets)) {
  const map = PAT_REASON_TO_SIGNAL[reason];
  if (!map) continue;
  signalWeightCandidates.push({
    type: "increase",
    target: map.target,
    boundary: map.boundary,
    reason: `pat_issue_reason="${reason}" 반복. ${map.hint}`,
    evidence_count: info.count,
    strength: strengthOf(info.count),
    choice_ids: info.choice_ids,
    pat_directions: info.pat_directions,
  });
}

// ── 2) override_candidates ──────────────────────────────────────────────────
const overrideCandidates = overrideCands;

// ── 3) decision_threshold_candidates ────────────────────────────────────────
const thresholdCandidates = [];

// 3-a. keep_existing_risk 반복 → fallback.keep_existing 승격 임계 낮춤 후보
const kerCount = okBuckets.keep_existing_risk?.count || 0;
if (kerCount >= 1) {
  thresholdCandidates.push({
    target: "fallback.keep_existing → ok_recheck 승격 임계",
    direction: "lower",
    reason:
      `ok_issue_reason="keep_existing_risk" ${kerCount}건 — fallback 유지된 pat이 해설 축과 어긋날 위험. ` +
      `ok_recheck_candidate_score 승격 컷(medium tier)을 낮춰 더 많이 큐로 승격하는 안 검토.`,
    evidence_count: kerCount,
    strength: strengthOf(kerCount),
    choice_ids: okBuckets.keep_existing_risk.choice_ids,
  });
}

// 3-b. agreed_with_engine=false 반복 → primary/secondary 스왑 임계
if (disagreeRows.length >= 1) {
  thresholdCandidates.push({
    target: "decision primary/secondary swap 임계 (decision_confidence)",
    direction: "raise",
    reason:
      `agreed_with_engine=false ${disagreeRows.length}건 — engine primary 와 human final_decision 불일치. ` +
      `decision_confidence 하한을 올려 불확실 구간에서 secondary 경로 비중을 늘리는 안 검토.`,
    evidence_count: disagreeRows.length,
    strength: strengthOf(disagreeRows.length),
    choice_ids: disagreeRows.map((r) => r.choice_id),
  });
}

// 3-c. ok_issue_reason 특정 축 몰림 → ok_recheck_candidate_score 가중치 축 조정
const okMax = Object.entries(okBuckets).sort((a, b) => b[1].count - a[1].count)[0];
if (okMax && okMax[1].count >= 2) {
  thresholdCandidates.push({
    target: `ok_recheck_candidate_score 가중치 — "${okMax[0]}" 축`,
    direction: "raise",
    reason:
      `ok_issue_reason 분포가 "${okMax[0]}" ${okMax[1].count}건으로 몰림. ` +
      `해당 축 기여 가중치를 올려 ok_recheck 승격 민감도 조정 검토.`,
    evidence_count: okMax[1].count,
    strength: strengthOf(okMax[1].count),
    choice_ids: okMax[1].choice_ids,
  });
}

// ── notes ────────────────────────────────────────────────────────────────────
const notes = [];
notes.push(
  `입력 reviews ${reviews.length}건 · agreed_with_engine 비율 ${(agreedRate * 100).toFixed(1)}%`,
);
notes.push(
  "이 리포트는 제안만 포함합니다. config/*.json 은 수정되지 않았습니다.",
);
if (reviews.length < 3) {
  notes.push(
    `⚠️ reviews ${reviews.length}건은 표본이 작아 strength가 과대평가될 수 있음. 다음 라운드 누적 후 재평가 권장.`,
  );
}
if (signalWeightCandidates.length === 0) {
  notes.push(
    "signal_weight_candidates 0건 — pat_issue_reason 이 unclear/none 위주이거나 근거 부족.",
  );
}
if (overrideCandidates.length === 0) {
  notes.push(
    "override_candidates 0건 — final_decision 에 send_to_override_candidate_queue 없음.",
  );
}

// ── 리포트 ───────────────────────────────────────────────────────────────────
const out = {
  meta: {
    generated_at: new Date().toISOString(),
    generator: "generate_tuning_suggestions.mjs",
    results_file: path.relative(ROOT, RESULTS_PATH),
    engine_report: engineReport ? path.relative(ROOT, REPORT_PATH) : null,
    round_label: results.meta?.round_label || null,
    reviewer: results.meta?.reviewer || null,
    report_snapshot: results.meta?.report_snapshot || null,
  },
  exam: EXAM,
  input_reviews: reviews.length,
  agreed_with_engine_rate: agreedRate,
  suggestions: {
    signal_weight_candidates: signalWeightCandidates,
    override_candidates: overrideCandidates,
    decision_threshold_candidates: thresholdCandidates,
  },
  notes,
};

fs.mkdirSync(OUT_DIR, { recursive: true });
const OUT_PATH = path.join(OUT_DIR, `tuning_suggestion_report_${EXAM}.json`);
fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2), "utf8");

// ── 콘솔 요약 ────────────────────────────────────────────────────────────────
console.log("═".repeat(60));
console.log(` generate_tuning_suggestions — ${EXAM}`);
console.log("═".repeat(60));
console.log(`\n입력:        ${path.relative(ROOT, RESULTS_PATH)}`);
console.log(`엔진 리포트: ${engineReport ? path.relative(ROOT, REPORT_PATH) : "(없음/exam 불일치)"}`);
console.log(`\n[요약]`);
console.log(`  reviews:               ${reviews.length}`);
console.log(`  agreed_with_engine:    ${(agreedRate * 100).toFixed(1)}%`);
console.log(`  signal_weight:         ${signalWeightCandidates.length}건`);
console.log(`  override_candidates:   ${overrideCandidates.length}건`);
console.log(`  threshold_candidates:  ${thresholdCandidates.length}건`);

if (signalWeightCandidates.length > 0) {
  console.log(`\n[signal_weight_candidates]`);
  for (const s of signalWeightCandidates)
    console.log(`  · [${s.strength}] ${s.target} (${s.boundary}) ×${s.evidence_count}`);
}
if (overrideCandidates.length > 0) {
  console.log(`\n[override_candidates]`);
  for (const o of overrideCandidates)
    console.log(`  · ${o.choice_id}  ${o.current_pat}→${o.suggested_pat}  (${o.confidence})`);
}
if (thresholdCandidates.length > 0) {
  console.log(`\n[decision_threshold_candidates]`);
  for (const t of thresholdCandidates)
    console.log(`  · [${t.strength}] ${t.target} · ${t.direction} ×${t.evidence_count}`);
}
for (const n of notes) console.log(`  ℹ ${n}`);

console.log(`\n📄 저장: ${path.relative(ROOT, OUT_PATH)}`);
console.log(
  `\n※ 자동 적용 금지. 이 제안은 signal_map / override_cases / rules 를 수정하지 않음.`,
);
