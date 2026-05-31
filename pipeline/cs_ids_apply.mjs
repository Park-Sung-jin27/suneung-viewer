/**
 * cs_ids_apply.mjs — Day 2 자동 반영 도구
 *
 * 입력:
 *   - pipeline/output/cs_ids_candidates.json (Day 1 산출물)
 *
 * 동작:
 *   - decision="auto_apply" 인 후보만 처리
 *   - all_data_204.json 안 해당 choice 의 cs_ids 갱신
 *   - audit_log.jsonl 에 source/score/quote/ts/tool_version 기록
 *
 * 안전장치:
 *   - --dry-run (default): 실제 반영 X, 변경 예정 출력만
 *   - --apply: 실제 반영
 *   - 기존 cs_ids 비어있지 않은 choice 는 skip (덮어쓰기 금지)
 *   - all_data_204.json 백업 자동 생성 (pipeline/backups/all_data_204.YYYY-MM-DD.json)
 *
 * 사용:
 *   node pipeline/cs_ids_apply.mjs                # dry-run
 *   node pipeline/cs_ids_apply.mjs --apply        # 실제 반영
 *   node pipeline/cs_ids_apply.mjs --apply --scope=2025수능
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

const DATA_PATH = path.join(ROOT, "public/data/all_data_204.json");
const CAND_PATH = path.join(ROOT, "pipeline/output/cs_ids_candidates.json");
const AUDIT_LOG_PATH = path.join(ROOT, "pipeline/output/audit_log.jsonl");
const BACKUP_DIR = path.join(ROOT, "pipeline/backups");

const TOOL_VERSION = "1.0";

// ── CLI args ─────────────────────────────────────────────
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? true];
  }),
);
const dryRun = !args.apply;
const scopeYear = args.scope || null;
const scopeSetId = args.setId || null;

// ── load ─────────────────────────────────────────────────
const data = JSON.parse(fs.readFileSync(DATA_PATH, "utf-8"));
const cand = JSON.parse(fs.readFileSync(CAND_PATH, "utf-8"));

// ── all_data_204 navigate helper ─────────────────────────
function findChoice(yearKey, setId, qId, choiceNum) {
  const year = data[yearKey];
  if (!year) return null;
  for (const areaArr of Object.values(year)) {
    if (!Array.isArray(areaArr)) continue;
    for (const set of areaArr) {
      if (set.id !== setId) continue;
      for (const q of set.questions || []) {
        if (q.id !== qId) continue;
        for (const c of q.choices || []) {
          if (c.num === choiceNum) return { set, q, c };
        }
      }
    }
  }
  return null;
}

// ── 처리 ────────────────────────────────────────────────
const targets = cand.candidates.filter(
  (e) =>
    e.decision === "auto_apply" &&
    (!scopeYear || e.yearKey === scopeYear) &&
    (!scopeSetId || e.setId === scopeSetId),
);

const auditEntries = [];
const skipped = [];
const applied = [];

for (const t of targets) {
  const ref = findChoice(t.yearKey, t.setId, t.questionId, t.choiceNum);
  if (!ref) {
    skipped.push({ ...t, skip_reason: "choice_not_found" });
    continue;
  }
  const existing = ref.c.cs_ids || [];
  if (existing.length > 0) {
    skipped.push({ ...t, skip_reason: "existing_cs_ids_nonempty" });
    continue;
  }
  const top = t.candidates[0];
  if (!top) {
    skipped.push({ ...t, skip_reason: "no_candidate" });
    continue;
  }
  // 반영
  const newCsIds = [top.sentId];
  if (!dryRun) {
    ref.c.cs_ids = newCsIds;
  }
  const entry = {
    ts: new Date().toISOString(),
    tool: "cs_ids_apply.mjs",
    tool_version: TOOL_VERSION,
    yearKey: t.yearKey,
    setId: t.setId,
    questionId: t.questionId,
    choiceNum: t.choiceNum,
    action: "set_cs_ids",
    before: existing,
    after: newCsIds,
    source: "auto",
    score: top.normalized_score,
    score_gap_to_runner_up: t.hard_checks?.gap ?? null,
    quote_used: top.quotes_matched?.[0] || null,
    set_safety: t.set_safety,
    hard_checks: t.hard_checks,
  };
  auditEntries.push(entry);
  applied.push({
    yearKey: t.yearKey,
    setId: t.setId,
    qId: t.questionId,
    cNum: t.choiceNum,
    sentId: top.sentId,
    score: top.normalized_score,
  });
}

// ── 백업 + 반영 + audit_log ─────────────────────────────
if (!dryRun && applied.length > 0) {
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = path.join(BACKUP_DIR, `all_data_204.${ts}.json`);
  fs.copyFileSync(DATA_PATH, backupPath);
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), "utf-8");
  console.log(`백업 생성: ${backupPath}`);

  // audit_log.jsonl append
  const auditLines = auditEntries.map((e) => JSON.stringify(e)).join("\n") + "\n";
  fs.appendFileSync(AUDIT_LOG_PATH, auditLines, "utf-8");
  console.log(`audit_log: +${auditEntries.length}건 → ${AUDIT_LOG_PATH}`);
}

// ── 출력 ────────────────────────────────────────────────
console.log(`\n=== cs_ids_apply.mjs ${dryRun ? "[DRY-RUN]" : "[APPLIED]"} ===`);
console.log(`scope: yearKey=${scopeYear || "all"} setId=${scopeSetId || "all"}`);
console.log(`auto_apply 후보: ${targets.length}`);
console.log(`반영: ${applied.length}`);
console.log(`skip: ${skipped.length}`);
if (skipped.length > 0) {
  const reasons = {};
  for (const s of skipped) reasons[s.skip_reason] = (reasons[s.skip_reason] || 0) + 1;
  console.log(`  skip 사유:`, reasons);
}
if (dryRun) {
  console.log(`\n[DRY-RUN] 실제 반영 X. 실제 반영하려면 --apply 추가.`);
  if (applied.length > 0) {
    console.log(`\n반영 예정 sample (앞 10건):`);
    for (const a of applied.slice(0, 10)) {
      console.log(
        `  ${a.yearKey} ${a.setId} Q${a.qId} 선지${a.cNum} → cs_ids=[${a.sentId}] (score=${a.score.toFixed(2)})`,
      );
    }
  }
}
