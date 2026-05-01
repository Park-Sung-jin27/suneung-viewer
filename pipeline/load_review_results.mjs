/**
 * pipeline/load_review_results.mjs
 *
 * config/human_review_results.json 을 읽어 스키마·업무 규칙 기준으로 검증한다.
 * 이 파일은 "자동 튜닝 제안"을 내지 않는다.
 * 오직 불완전/불일치 입력을 사람이 알아볼 수 있게 경고하는 게 목적이다.
 * 자동 튜닝 단계로 넘어가기 전 게이트.
 *
 * 사용법 (PowerShell):
 *   cd C:/Users/downf/suneung-viewer
 *   node pipeline/load_review_results.mjs
 *   node pipeline/load_review_results.mjs --results config/human_review_results.json
 *   node pipeline/load_review_results.mjs --report pipeline/reports/pat_decision_report.json
 *   node pipeline/load_review_results.mjs --strict    (경고 있어도 exit 2)
 *
 * 출력: pipeline/reports/review_feedback_report.json
 *
 * [규칙]
 * BLOCK (자동 튜닝 진입 차단):
 *   B-1 schema_violation                          schema/ajv 위반
 *   B-2 still_has_TODO                            TODO: 문자열 잔존
 *   B-3 invalid_enum                              enum 외 값
 *   B-4 choice_id_not_in_engine_report            엔진 리포트에 없는 choice_id
 *   B-5 required_field_missing                    필수 필드 누락
 *   B-6 engine_snapshot_stale                     review.engine_snapshot 값이 현재 엔진 리포트 row와 다름
 *                                                  → 사람이 적어둔 snapshot이 stale 상태. 엔진 재실행 후 재기입 필요.
 *
 * WARN (집계하되 튜닝 전 재검토 권장):
 *   W-1 missing_pat_suggestion_for_override_candidate
 *        final_decision=send_to_override_candidate_queue 이지만 human_pat_suggestion=null
 *   W-2 polarity_reason_but_not_ok_queue
 *        ok_issue_reason=polarity_conflict 인데 final_decision != send_to_ok_recheck_queue
 *   W-3 keep_existing_reason_but_not_keep_existing_match
 *        ok_issue_reason=keep_existing_risk 인데 engine match_type != keep_existing_match
 *   W-4 pat_reason_given_but_leave_as_is
 *        pat_issue_reason != none 인데 final_decision=leave_as_is
 *   W-5 agreed_true_but_decision_differs
 *        agreed_with_engine=true 지만 final_decision != engine primary_decision
 *   W-6 agreed_false_but_decision_same
 *        agreed_with_engine=false 지만 final_decision == engine primary_decision
 *   W-7 ok_suggestion_without_ok_reason
 *        human_ok_suggestion != null 인데 ok_issue_reason=none
 *   W-8 unclear_both (튜닝 차단급 — conflicting 처리)
 *        ok/pat 둘 다 unclear — 다음 라운드 학습 신호 없음. 이 상태에서는 signal_map/rule 개선 근거 0.
 *        → INCONSISTENT_CODES 에 포함되어 completeness_tier=conflicting 으로 상향.
 *   W-9 notes_too_short
 *        notes < 10자 (왜 그렇게 결정했는지 근거 부재)
 *
 * [completeness_tier]
 *   complete       : BLOCK 0, WARN 0
 *   near_complete  : BLOCK 0, WARN 1~2 (W-8/W-9 같은 soft 포함)
 *   conflicting    : BLOCK 0, 논리 모순 WARN 존재 (W-2/W-3/W-5/W-6)
 *   incomplete     : BLOCK >= 1
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import Ajv from "ajv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const args = process.argv.slice(2);
function getArg(name, fallback = null) {
  const i = args.indexOf(name);
  return i >= 0 && i + 1 < args.length && !args[i + 1].startsWith("--")
    ? args[i + 1]
    : fallback;
}
const RESULTS_PATH = path.resolve(
  ROOT,
  getArg("--results", "config/human_review_results.json"),
);
const REPORT_PATH = path.resolve(
  ROOT,
  getArg("--report", "pipeline/reports/pat_decision_report.json"),
);
const SCHEMA_PATH = path.resolve(
  ROOT,
  getArg("--schema", "config/human_review_results.schema.json"),
);
const STRICT = args.includes("--strict");

// ── 입력 체크 ───────────────────────────────────────────────────────────────
if (!fs.existsSync(RESULTS_PATH)) {
  console.error(`❌ 결과 파일 없음: ${RESULTS_PATH}`);
  console.error(
    `   템플릿 생성: node pipeline/make_review_template.mjs --exam <연도키>`,
  );
  process.exit(1);
}
if (!fs.existsSync(SCHEMA_PATH)) {
  console.error(`❌ 스키마 없음: ${SCHEMA_PATH}`);
  process.exit(1);
}

const results = JSON.parse(fs.readFileSync(RESULTS_PATH, "utf8"));
const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, "utf8"));

// 엔진 리포트(옵션) — choice_id 존재 검증용
let engineReport = null;
let engineChoiceIds = new Set();
let engineMatchTypeById = new Map();
let engineRowById = new Map();
if (fs.existsSync(REPORT_PATH)) {
  engineReport = JSON.parse(fs.readFileSync(REPORT_PATH, "utf8"));
  // human_review_pack 의 샘플에는 primary/secondary/confidence가 들어있으므로, row 기준 비교 시
  // 그 값도 함께 접근 가능하도록 보조 맵 구성
  const packByChoiceId = new Map();
  const samples =
    engineReport.summary?.human_review_pack?.recommended_3_samples || [];
  for (const entry of samples) {
    if (entry?.sample?.choice_id) packByChoiceId.set(entry.sample.choice_id, entry.sample);
  }
  for (const r of engineReport.rows || []) {
    const id = r.choice_id || r.loc;
    engineChoiceIds.add(id);
    engineMatchTypeById.set(id, r.match_type);
    // row에 없는 primary/secondary/confidence는 sample 병합
    const pack = packByChoiceId.get(id) || {};
    engineRowById.set(id, {
      existing_pat: r.existing_pat ?? null,
      suggested_pat: r.suggested_pat ?? null,
      match_type: r.match_type,
      applied_rule_id: r.applied_rule_id,
      soft_conflict_risk_tier: r.soft_conflict_risk_tier,
      ok_recheck_candidate_score: r.ok_recheck_candidate_score,
      primary_decision: pack.primary_decision,
      secondary_decision: pack.secondary_decision,
      decision_confidence: pack.decision_confidence,
    });
  }
} else {
  console.warn(
    `⚠️  엔진 리포트 없음(${REPORT_PATH}) — choice_id 및 engine_snapshot 검증 스킵`,
  );
}

// ── ajv 스키마 검증 ─────────────────────────────────────────────────────────
// ajv-formats 미설치 환경에서도 동작. format 키워드는 무시(validate 대신 통과).
const ajv = new Ajv({ allErrors: true, strict: false });
ajv.addFormat("date-time", { validate: () => true });
const validate = ajv.compile(schema);
const schemaOk = validate(results);
const schemaErrors = schemaOk
  ? []
  : (validate.errors || []).map((e) => ({
      code: "B-1",
      severity: "BLOCK",
      path: e.instancePath || "(root)",
      message: `schema: ${e.message} ${e.params ? JSON.stringify(e.params) : ""}`,
    }));

// ── 업무 규칙 검증 (review 단위) ────────────────────────────────────────────
const OK_ISSUE_ENUM = [
  "axis_mismatch",
  "analysis_self_conflict",
  "polarity_conflict",
  "keep_existing_risk",
  "unclear",
  "none",
];
const PAT_ISSUE_ENUM = [
  "structure_vs_form",
  "cause_vs_fact",
  "concept_confusion",
  "theme_vs_expression",
  "unclear",
  "none",
];
const FINAL_DECISION_ENUM = [
  "send_to_ok_recheck_queue",
  "send_to_pat_review_queue",
  "send_to_override_candidate_queue",
  "leave_as_is",
];

// W-8 는 "다음 라운드 학습 신호 0"이라 튜닝 차단급 — conflicting 에 포함
const INCONSISTENT_CODES = new Set(["W-2", "W-3", "W-5", "W-6", "W-8"]);

// engine_snapshot 에서 stale 검사 대상 필드 (현 엔진 리포트 row 와 직접 비교)
const SNAPSHOT_COMPARE_FIELDS = [
  "existing_pat",
  "suggested_pat",
  "match_type",
  "applied_rule_id",
  "soft_conflict_risk_tier",
  "ok_recheck_candidate_score",
  "primary_decision",
  "secondary_decision",
  "decision_confidence",
];

function snapshotMismatches(snap, engineRow) {
  const diffs = [];
  if (!snap || !engineRow) return diffs;
  for (const f of SNAPSHOT_COMPARE_FIELDS) {
    if (!(f in snap)) continue; // snapshot이 갖지 않는 필드는 skip
    const now = engineRow[f];
    const then = snap[f];
    // 느슨한 비교 (number, null 고려)
    const eq =
      now === then ||
      (typeof now === "number" && typeof then === "number" && Math.abs(now - then) < 1e-9);
    if (!eq) diffs.push({ field: f, snapshot: then, current: now });
  }
  return diffs;
}

function isTodoString(v) {
  return typeof v === "string" && v.trim().startsWith("TODO:");
}

function validateReview(rev, idx) {
  const out = [];
  const required = [
    "choice_id",
    "exam",
    "category",
    "ok_issue_reason",
    "pat_issue_reason",
    "final_decision",
    "agreed_with_engine",
  ];
  for (const k of required) {
    if (rev[k] === undefined || rev[k] === null) {
      out.push({
        code: "B-5",
        severity: "BLOCK",
        path: `reviews[${idx}].${k}`,
        message: `필수 필드 누락`,
      });
    }
  }
  // TODO: 잔존
  for (const [k, v] of Object.entries(rev)) {
    if (isTodoString(v)) {
      out.push({
        code: "B-2",
        severity: "BLOCK",
        path: `reviews[${idx}].${k}`,
        message: `TODO 미입력: "${String(v).slice(0, 60)}…"`,
      });
    }
  }
  // enum 체크
  if (rev.ok_issue_reason && !OK_ISSUE_ENUM.includes(rev.ok_issue_reason) && !isTodoString(rev.ok_issue_reason)) {
    out.push({ code: "B-3", severity: "BLOCK", path: `reviews[${idx}].ok_issue_reason`,
      message: `enum 외 값: ${rev.ok_issue_reason}` });
  }
  if (rev.pat_issue_reason && !PAT_ISSUE_ENUM.includes(rev.pat_issue_reason) && !isTodoString(rev.pat_issue_reason)) {
    out.push({ code: "B-3", severity: "BLOCK", path: `reviews[${idx}].pat_issue_reason`,
      message: `enum 외 값: ${rev.pat_issue_reason}` });
  }
  if (rev.final_decision && !FINAL_DECISION_ENUM.includes(rev.final_decision) && !isTodoString(rev.final_decision)) {
    out.push({ code: "B-3", severity: "BLOCK", path: `reviews[${idx}].final_decision`,
      message: `enum 외 값: ${rev.final_decision}` });
  }

  // choice_id 엔진 리포트 존재 (리포트 있을 때만)
  if (engineReport && rev.choice_id && !engineChoiceIds.has(rev.choice_id)) {
    out.push({
      code: "B-4",
      severity: "BLOCK",
      path: `reviews[${idx}].choice_id`,
      message: `엔진 리포트에 없는 choice_id: ${rev.choice_id}`,
    });
  }
  // B-6 engine_snapshot_stale — 리포트에 해당 choice가 있고 snapshot도 있을 때만
  if (engineReport && rev.choice_id && engineRowById.has(rev.choice_id) && rev.engine_snapshot) {
    const diffs = snapshotMismatches(rev.engine_snapshot, engineRowById.get(rev.choice_id));
    if (diffs.length > 0) {
      for (const d of diffs) {
        out.push({
          code: "B-6",
          severity: "BLOCK",
          path: `reviews[${idx}].engine_snapshot.${d.field}`,
          message: `stale — snapshot=${JSON.stringify(d.snapshot)} vs current=${JSON.stringify(d.current)}. 엔진 재실행 후 템플릿 재생성 필요.`,
        });
      }
    }
  }

  // ── WARN 규칙 ─────────────────────────────────────────────────────────────
  const snap = rev.engine_snapshot || {};
  const enginePrimary = snap.primary_decision;
  const engineMatchType = snap.match_type;

  // W-1
  if (
    rev.final_decision === "send_to_override_candidate_queue" &&
    (rev.human_pat_suggestion === null || rev.human_pat_suggestion === undefined)
  ) {
    out.push({ code: "W-1", severity: "WARN", path: `reviews[${idx}]`,
      message: "override_candidate_queue 인데 human_pat_suggestion 미제시 (다음 라운드 튜닝 신호 약화)" });
  }
  // W-2
  if (
    rev.ok_issue_reason === "polarity_conflict" &&
    rev.final_decision &&
    rev.final_decision !== "send_to_ok_recheck_queue"
  ) {
    out.push({ code: "W-2", severity: "WARN", path: `reviews[${idx}]`,
      message: "ok_issue_reason=polarity_conflict 인데 final_decision이 ok_recheck_queue 아님" });
  }
  // W-3
  if (
    rev.ok_issue_reason === "keep_existing_risk" &&
    engineMatchType &&
    engineMatchType !== "keep_existing_match"
  ) {
    out.push({ code: "W-3", severity: "WARN", path: `reviews[${idx}]`,
      message: `ok_issue_reason=keep_existing_risk 인데 engine match_type=${engineMatchType}` });
  }
  // W-4 (actionable pat reason만: unclear/none 제외)
  if (
    rev.pat_issue_reason &&
    rev.pat_issue_reason !== "none" &&
    rev.pat_issue_reason !== "unclear" &&
    rev.final_decision === "leave_as_is"
  ) {
    out.push({ code: "W-4", severity: "WARN", path: `reviews[${idx}]`,
      message: "actionable pat_issue_reason 지정됐는데 final_decision=leave_as_is (pat 변경 신호 버려짐)" });
  }
  // W-5 / W-6
  if (enginePrimary && rev.final_decision && typeof rev.agreed_with_engine === "boolean") {
    const same = rev.final_decision === enginePrimary;
    if (rev.agreed_with_engine === true && !same) {
      out.push({ code: "W-5", severity: "WARN", path: `reviews[${idx}]`,
        message: `agreed_with_engine=true 인데 final_decision(${rev.final_decision}) != engine primary(${enginePrimary})` });
    }
    if (rev.agreed_with_engine === false && same) {
      out.push({ code: "W-6", severity: "WARN", path: `reviews[${idx}]`,
        message: `agreed_with_engine=false 인데 final_decision == engine primary(${enginePrimary})` });
    }
  }
  // W-7
  if (
    rev.human_ok_suggestion !== null &&
    rev.human_ok_suggestion !== undefined &&
    rev.ok_issue_reason === "none"
  ) {
    out.push({ code: "W-7", severity: "WARN", path: `reviews[${idx}]`,
      message: "human_ok_suggestion 값이 있는데 ok_issue_reason=none" });
  }
  // W-8
  if (rev.ok_issue_reason === "unclear" && rev.pat_issue_reason === "unclear") {
    out.push({ code: "W-8", severity: "WARN", path: `reviews[${idx}]`,
      message: "ok/pat 둘 다 unclear — 이 row는 다음 라운드 학습 신호 0" });
  }
  // W-9
  if (typeof rev.notes === "string" && rev.notes.trim().length > 0 && rev.notes.trim().length < 10 && !isTodoString(rev.notes)) {
    out.push({ code: "W-9", severity: "WARN", path: `reviews[${idx}]`,
      message: `notes가 너무 짧음 (${rev.notes.trim().length}자, 근거 추적 약함)` });
  }
  return out;
}

// ── 검증 실행 ───────────────────────────────────────────────────────────────
const reviews = Array.isArray(results.reviews) ? results.reviews : [];
const perReview = [];
for (let i = 0; i < reviews.length; i++) {
  const issues = validateReview(reviews[i], i);
  const blocks = issues.filter((x) => x.severity === "BLOCK");
  const warns = issues.filter((x) => x.severity === "WARN");
  let tier;
  if (blocks.length > 0) tier = "incomplete";
  else if (warns.some((w) => INCONSISTENT_CODES.has(w.code))) tier = "conflicting";
  else if (warns.length >= 3) tier = "incomplete";
  else if (warns.length > 0) tier = "near_complete";
  else tier = "complete";
  perReview.push({
    index: i,
    choice_id: reviews[i].choice_id || `(reviews[${i}])`,
    category: reviews[i].category || null,
    completeness_tier: tier,
    block_issues: blocks.map((b) => ({ code: b.code, path: b.path, message: b.message })),
    warn_issues: warns.map((w) => ({ code: w.code, path: w.path, message: w.message })),
  });
}

// 집계
const overall = {
  block_total: schemaErrors.length + perReview.reduce((a, r) => a + r.block_issues.length, 0),
  warn_total: perReview.reduce((a, r) => a + r.warn_issues.length, 0),
  complete: perReview.filter((r) => r.completeness_tier === "complete").length,
  near_complete: perReview.filter((r) => r.completeness_tier === "near_complete").length,
  conflicting: perReview.filter((r) => r.completeness_tier === "conflicting").length,
  incomplete: perReview.filter((r) => r.completeness_tier === "incomplete").length,
  schema_ok: schemaOk,
};

const report = {
  meta: {
    generated_at: new Date().toISOString(),
    results_file: path.relative(ROOT, RESULTS_PATH),
    engine_report: engineReport ? path.relative(ROOT, REPORT_PATH) : null,
    schema_file: path.relative(ROOT, SCHEMA_PATH),
    reviews_count: reviews.length,
  },
  overall,
  schema_errors: schemaErrors,
  reviews: perReview,
  tuning_suggestions_gate: (() => {
    const allow = overall.block_total === 0 && overall.conflicting === 0;
    const strict = allow && overall.warn_total === 0;
    const baseReason =
      overall.block_total > 0
        ? `BLOCK ${overall.block_total}건 — 입력 수정 후 재실행`
        : overall.conflicting > 0
          ? `conflicting ${overall.conflicting}건 — 논리 모순 먼저 해소`
          : "튜닝 단계 진입 가능";
    const strictReason = strict
      ? "완전 통과 — WARN 0, 엄격 모드에서도 튜닝 허용"
      : allow
        ? `WARN ${overall.warn_total}건 남음 — 엄격 모드 차단 (soft 경고라도 해소 후 튜닝 권장)`
        : baseReason;
    return {
      allow_tuning: allow,
      allow_tuning_strict: strict,
      reason: baseReason,
      strict_reason: strictReason,
    };
  })(),
};

const OUT_PATH = path.join(ROOT, "pipeline", "reports", "review_feedback_report.json");
fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
fs.writeFileSync(OUT_PATH, JSON.stringify(report, null, 2), "utf8");

// ── 콘솔 ────────────────────────────────────────────────────────────────────
console.log("═".repeat(60));
console.log(" load_review_results — 불완전 입력 경고 검증");
console.log("═".repeat(60));
console.log(`\n입력:      ${path.relative(ROOT, RESULTS_PATH)}`);
console.log(`엔진 리포트: ${engineReport ? path.relative(ROOT, REPORT_PATH) : "(없음)"}`);
console.log(`스키마:    ${path.relative(ROOT, SCHEMA_PATH)}  → ${schemaOk ? "OK" : "FAIL"}`);

console.log(`\n[총계]`);
console.log(`  reviews:        ${reviews.length}`);
console.log(`  BLOCK total:    ${overall.block_total}`);
console.log(`  WARN total:     ${overall.warn_total}`);
console.log(`  complete:       ${overall.complete}`);
console.log(`  near_complete:  ${overall.near_complete}`);
console.log(`  conflicting:    ${overall.conflicting}`);
console.log(`  incomplete:     ${overall.incomplete}`);

if (schemaErrors.length > 0) {
  console.log(`\n[스키마 오류 ${schemaErrors.length}]`);
  for (const e of schemaErrors.slice(0, 10))
    console.log(`  [${e.code}] ${e.path}: ${e.message}`);
}

for (const r of perReview) {
  if (r.block_issues.length === 0 && r.warn_issues.length === 0) continue;
  console.log(`\n── ${r.choice_id}  [${r.completeness_tier}]`);
  for (const b of r.block_issues)
    console.log(`  🔴 [${b.code}] ${b.path}: ${b.message}`);
  for (const w of r.warn_issues)
    console.log(`  🟡 [${w.code}] ${w.path}: ${w.message}`);
}

console.log(
  `\n[튜닝 게이트] ${report.tuning_suggestions_gate.allow_tuning ? "✅ 허용" : "🔴 차단"} — ${report.tuning_suggestions_gate.reason}`,
);
console.log(
  `[튜닝 게이트 엄격] ${report.tuning_suggestions_gate.allow_tuning_strict ? "✅ 허용" : "🟡 차단"} — ${report.tuning_suggestions_gate.strict_reason}`,
);
console.log(`\n📄 저장: ${path.relative(ROOT, OUT_PATH)}`);

if (STRICT && (overall.block_total > 0 || overall.warn_total > 0)) {
  process.exit(2);
}
