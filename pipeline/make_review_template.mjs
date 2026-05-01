/**
 * pipeline/make_review_template.mjs
 *
 * 최신 pat_decision_report.json 의 human_review_pack.recommended_3_samples 를
 * human_review_results 템플릿으로 변환해 저장한다.
 * 사람은 이 파일의 "TODO:" 필드만 채우면 된다.
 *
 * 사용법 (PowerShell):
 *   cd C:/Users/downf/suneung-viewer
 *   node pipeline/make_review_template.mjs --exam 2026수능
 *   node pipeline/make_review_template.mjs --exam 2025수능 --reviewer 성진 --round 2026-04-20-R1
 *
 * 출력: pipeline/reports/human_review_template_<exam>.json
 *
 * 주의: 엔진이 재실행되어 report가 새로 쓰여야 최신 샘플을 뽑을 수 있다.
 *        따라서 사용 순서는:
 *          1) node pipeline/pat_decision_engine.mjs --exam <exam> --dry-run
 *          2) node pipeline/make_review_template.mjs --exam <exam>
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const REPORT_PATH = path.join(__dirname, "reports", "pat_decision_report.json");
const OUT_DIR = path.join(__dirname, "reports");

const args = process.argv.slice(2);
function getArg(name) {
  const i = args.indexOf(name);
  return i >= 0 && i + 1 < args.length && !args[i + 1].startsWith("--")
    ? args[i + 1]
    : null;
}
const EXAM = getArg("--exam");
const REVIEWER = getArg("--reviewer") || "TODO: reviewer_name";
const ROUND = getArg("--round") || `TODO: ${new Date().toISOString().slice(0, 10)}-R?`;

if (!EXAM) {
  console.error(
    "사용법: node pipeline/make_review_template.mjs --exam <연도키> [--reviewer <이름>] [--round <라운드라벨>]",
  );
  process.exit(1);
}
if (!fs.existsSync(REPORT_PATH)) {
  console.error(`❌ 리포트 없음: ${REPORT_PATH}. pat_decision_engine 먼저 실행.`);
  process.exit(1);
}

const report = JSON.parse(fs.readFileSync(REPORT_PATH, "utf8"));

// ── 원문 보강용 데이터 로더 ─────────────────────────────────────────────────
const DATA_PATH = path.join(ROOT, "public", "data", "all_data_204.json");
let __allData = null;
function ensureAllData() {
  if (__allData) return __allData;
  __allData = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
  return __allData;
}
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
  // 1차: 문자열 정확 일치
  for (const q of questions) if (String(q.id) === qStr) return q;
  // 2차: 숫자 일치
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
  const base = {
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
  if (!sEntry) return base;
  const q = findQuestion(sEntry.set, p.qId);
  if (!q) {
    base._match_status = "question_missing";
    return base;
  }
  const ch = findChoice(q, p.num);
  base.question_text = q.t ?? null;
  base.bogi_text = q.bogi ?? null;
  if (!ch) {
    base._match_status = "choice_missing";
    return base;
  }
  base.choice_text = ch.t ?? null;
  base.analysis_text = ch.analysis ?? null;
  base._match_status = "ok";
  return base;
}
const __examIndex = buildExamIndex(ensureAllData(), EXAM);
if (!report.meta || report.meta.exam !== EXAM) {
  console.error(
    `❌ 리포트의 exam이 "${report.meta?.exam || "알 수 없음"}" — 템플릿 대상 "${EXAM}"과 불일치. 엔진을 해당 exam으로 재실행 후 재시도.`,
  );
  process.exit(1);
}

const samples = report.summary?.human_review_pack?.recommended_3_samples || [];
if (samples.length === 0) {
  console.error(`❌ human_review_pack 샘플이 비어있음.`);
  process.exit(1);
}

const reviews = samples
  .filter((entry) => entry.sample)
  .map((entry) => {
    const s = entry.sample;
    const src = enrichmentFor(s.choice_id, __examIndex) || {};
    return {
      choice_id: s.choice_id,
      exam: EXAM,
      category: entry.category,
      // ── 원문 (검수용, 읽기 전용) — _match_status 는 schema 에 포함하지 않음
      set_id: src.set_id ?? null,
      question_id: src.question_id ?? null,
      choice_num: src.choice_num ?? null,
      domain: src.domain ?? null,
      question_text: src.question_text ?? null,
      bogi_text: src.bogi_text ?? null,
      choice_text: src.choice_text ?? null,
      analysis_text: src.analysis_text ?? null,
      engine_snapshot: {
        existing_pat: s.existing_pat ?? null,
        suggested_pat: s.suggested_pat ?? null,
        match_type: s.match_type,
        soft_conflict_risk_tier: s.soft_conflict_risk_tier,
        ok_recheck_candidate_score: s.ok_recheck_candidate_score,
        applied_rule_id: s.applied_rule_id,
        conflict_flags: s.conflict_flags || [],
        primary_decision: s.primary_decision,
        secondary_decision: s.secondary_decision,
        decision_confidence: s.decision_confidence,
        ok_issue_reason_suggested: s.ok_issue_reason_suggested,
        pat_issue_reason_suggested: s.pat_issue_reason_suggested,
      },
      // ── 사람이 채울 부분 ────────────────────────────
      ok_issue_reason: `TODO: [axis_mismatch|analysis_self_conflict|polarity_conflict|keep_existing_risk|unclear|none] (엔진 제안=${s.ok_issue_reason_suggested})`,
      pat_issue_reason: `TODO: [structure_vs_form|cause_vs_fact|concept_confusion|theme_vs_expression|unclear|none] (엔진 제안=${s.pat_issue_reason_suggested})`,
      final_decision: `TODO: [send_to_ok_recheck_queue|send_to_pat_review_queue|send_to_override_candidate_queue|leave_as_is] (엔진 primary=${s.primary_decision}, secondary=${s.secondary_decision})`,
      human_pat_suggestion: null,
      human_ok_suggestion: null,
      agreed_with_engine: "TODO: true|false",
      notes: "TODO: 간단 메모 (해설이 어느 축을 설명하는지, 선지가 어느 축에서 틀렸는지)",
      // ── 검수 참고용 (읽기 전용) ─────────────────────
      _engine_questions: {
        ok_recheck_question: s.ok_recheck_question,
        pat_recheck_question: s.pat_recheck_question,
      },
      _engine_short_reason: s.short_reason,
    };
  });

const template = {
  meta: {
    reviewer: REVIEWER,
    reviewed_at: "TODO: 2026-04-20T12:00:00Z",
    round_label: ROUND,
    report_snapshot: {
      exam: EXAM,
      report_generated_at: report.meta.generated_at,
      rules_version: report.meta.rules_version,
      signal_map_version: report.meta.signal_map_version,
      override_version: report.meta.override_version,
    },
    notes:
      "engine이 채워둔 engine_snapshot 와 _engine_* 필드는 읽기 전용. TODO: 로 표시된 필드만 채우세요.",
  },
  reviews,
};

fs.mkdirSync(OUT_DIR, { recursive: true });
const outPath = path.join(OUT_DIR, `human_review_template_${EXAM}.json`);
fs.writeFileSync(outPath, JSON.stringify(template, null, 2), "utf8");

console.log("═".repeat(60));
console.log(` make_review_template — ${EXAM}`);
console.log("═".repeat(60));
console.log(`\n생성된 샘플: ${reviews.length}건`);
for (const r of reviews)
  console.log(
    `  [${r.category}] ${r.choice_id}  (engine_primary=${r.engine_snapshot.primary_decision}, conf=${r.engine_snapshot.decision_confidence})`,
  );

// ── 매핑 정확도 점검 — PDF 대조용 덤프 ───────────────────────────────────
console.log(`\n[원문 매핑 점검 — PDF 와 대조하세요]`);
const verifySamples = reviews.slice(0, Math.min(5, reviews.length));
for (const rv of verifySamples) {
  const st = enrichmentFor(rv.choice_id, __examIndex)?._match_status || "?";
  console.log(`\n  • ${rv.choice_id}  [status=${st}]`);
  console.log(`    set/q/#:       ${rv.set_id} / Q${rv.question_id} / #${rv.choice_num}  (domain=${rv.domain})`);
  console.log(`    question_text: ${(rv.question_text || "(null)").slice(0, 100)}`);
  console.log(`    choice_text:   ${(rv.choice_text || "(null)").slice(0, 100)}`);
}
const badMatches = reviews.filter((rv) => {
  const st = enrichmentFor(rv.choice_id, __examIndex)?._match_status;
  return st !== "ok";
});
if (badMatches.length > 0) {
  console.log(`\n  🔴 매핑 실패 ${badMatches.length}건: ${badMatches.map((r) => r.choice_id).join(", ")}`);
}

console.log(`\n📄 저장: ${path.relative(ROOT, outPath)}`);
console.log(
  `\n다음 단계:
  1) 템플릿을 복사해 config/human_review_results.json 으로 저장
  2) TODO: 필드 채우기 (ok_issue_reason / pat_issue_reason / final_decision / agreed_with_engine / notes)
  3) final_decision = send_to_override_candidate_queue 선택 시 human_pat_suggestion 권장 (후보 큐에서 추가 검토됨)
  4) 채운 뒤 스키마 검증: config/human_review_results.schema.json 참조
  5) 다음 라운드 엔진이 결과를 loop back 으로 읽음`,
);
