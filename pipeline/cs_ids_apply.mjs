// cs_ids_apply.mjs - 2 modes: auto (cs_ids_candidates.json) and batch (--batch=<path>)
// Common safety: --dry-run default, --apply to write, skips non-empty cs_ids, backups + audit_log
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
const TOOL_VERSION = "1.2"; // v1.2: ambiguous_choice_ref skip 안전장치 (setId 충돌 대응)

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? true];
  })
);
const dryRun = !args.apply;
const scopeYear = args.scope || null;
const scopeSetId = args.setId || null;
const batchPath = args.batch || null;

const data = JSON.parse(fs.readFileSync(DATA_PATH, "utf-8"));
let mode = "auto";
let targets = [];

if (batchPath) {
  mode = "batch";
  const batchRaw = batchPath === "-" ? fs.readFileSync(0, "utf-8") : fs.readFileSync(batchPath, "utf-8");
  const batch = JSON.parse(batchRaw);
  if (!Array.isArray(batch.approvals)) {
    console.error("batch JSON missing approvals[]");
    process.exit(1);
  }
  targets = batch.approvals
    .filter((a) => (!scopeYear || a.yearKey === scopeYear) && (!scopeSetId || a.setId === scopeSetId))
    .map((a) => ({
      yearKey: a.yearKey,
      area: a.area, // v1.2: 선택. setId 충돌 시 ambiguous_choice_ref skip 회피.
      setId: a.setId,
      questionId: a.questionId,
      choiceNum: a.choiceNum,
      decision: "human_batch_approval",
      candidates: [{ sentId: (a.cs_ids || [])[0] || null, normalized_score: a.score ?? null, quotes_matched: a.quote ? [a.quote] : [] }],
      hard_checks: { source: "human" },
      set_safety: "human_approved",
    }));
} else {
  const cand = JSON.parse(fs.readFileSync(CAND_PATH, "utf-8"));
  targets = cand.candidates.filter(
    (e) => e.decision === "auto_apply" && (!scopeYear || e.yearKey === scopeYear) && (!scopeSetId || e.setId === scopeSetId)
  );
}

// v1.2: 정확히 1개 매칭만 허용. 2+ 매칭 시 ambiguous_choice_ref skip.
// 입력 area 가 있으면 area 도 일치 의무 (setId 충돌 + 동일 yearKey 안 다중 area 대응).
function findChoice(yearKey, setId, qId, choiceNum, area) {
  const year = data[yearKey];
  if (!year) return { ref: null, count: 0 };
  const matches = [];
  for (const [areaKey, areaArr] of Object.entries(year)) {
    if (!Array.isArray(areaArr)) continue;
    if (area && areaKey !== area) continue;
    for (const set of areaArr) {
      if (set.id !== setId) continue;
      for (const q of set.questions || []) {
        if (q.id !== qId) continue;
        for (const c of q.choices || []) {
          if (c.num === choiceNum) matches.push({ set, q, c, area: areaKey });
        }
      }
    }
  }
  return { ref: matches.length === 1 ? matches[0] : null, count: matches.length };
}

const auditEntries = [];
const skipped = [];
const applied = [];

for (const t of targets) {
  const { ref, count } = findChoice(t.yearKey, t.setId, t.questionId, t.choiceNum, t.area);
  if (!ref) {
    skipped.push({ ...t, skip_reason: count > 1 ? "ambiguous_choice_ref" : "choice_not_found", match_count: count });
    continue;
  }
  const existing = ref.c.cs_ids || [];
  if (existing.length > 0) { skipped.push({ ...t, skip_reason: "existing_cs_ids_nonempty" }); continue; }
  const top = t.candidates[0];
  if (!top || !top.sentId) { skipped.push({ ...t, skip_reason: "no_candidate_or_sentid_null" }); continue; }
  const newCsIds = [top.sentId];
  if (!dryRun) ref.c.cs_ids = newCsIds;
  auditEntries.push({
    ts: new Date().toISOString(),
    tool: "cs_ids_apply.mjs",
    tool_version: TOOL_VERSION,
    mode,
    yearKey: t.yearKey, setId: t.setId, questionId: t.questionId, choiceNum: t.choiceNum,
    action: "set_cs_ids", before: existing, after: newCsIds,
    source: mode === "batch" ? "human_batch_approval" : "auto",
    score: top.normalized_score,
    score_gap_to_runner_up: t.hard_checks ? (t.hard_checks.gap ?? null) : null,
    quote_used: top.quotes_matched && top.quotes_matched[0] ? top.quotes_matched[0] : null,
    set_safety: t.set_safety,
    hard_checks: t.hard_checks,
  });
  applied.push({ yearKey: t.yearKey, setId: t.setId, qId: t.questionId, cNum: t.choiceNum, sentId: top.sentId, score: top.normalized_score });
}

if (!dryRun && applied.length > 0) {
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = path.join(BACKUP_DIR, "all_data_204." + ts + ".json");
  fs.copyFileSync(DATA_PATH, backupPath);
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), "utf-8");
  console.log("backup: " + backupPath);
  const auditLines = auditEntries.map((e) => JSON.stringify(e)).join("\n") + "\n";
  fs.appendFileSync(AUDIT_LOG_PATH, auditLines, "utf-8");
  console.log("audit_log: +" + auditEntries.length + " entries -> " + AUDIT_LOG_PATH);
}

console.log("\n=== cs_ids_apply.mjs [" + mode + "] " + (dryRun ? "[DRY-RUN]" : "[APPLIED]") + " ===");
console.log("scope: yearKey=" + (scopeYear || "all") + " setId=" + (scopeSetId || "all") + (batchPath ? " batch=" + batchPath : ""));
console.log("targets: " + targets.length);
console.log("applied: " + applied.length);
console.log("skipped: " + skipped.length);
if (skipped.length > 0) {
  const reasons = {};
  for (const s of skipped) reasons[s.skip_reason] = (reasons[s.skip_reason] || 0) + 1;
  console.log("  skip reasons:", reasons);
}
if (dryRun) {
  console.log("\n[DRY-RUN] no write. add --apply to write.");
  if (applied.length > 0) {
    console.log("\nSample (first 10):");
    for (const a of applied.slice(0, 10)) {
      const sc = (a.score == null ? 0 : a.score).toFixed(2);
      console.log("  " + a.yearKey + " " + a.setId + " Q" + a.qId + " choice" + a.cNum + " -> cs_ids=[" + a.sentId + "] (score=" + sc + ")");
    }
  }
}
