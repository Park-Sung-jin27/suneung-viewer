/**
 * cs_ids_revert.mjs — audit_log 기반 일괄 되돌리기
 *
 * 사용:
 *   node pipeline/cs_ids_revert.mjs --dry-run                # 기본
 *   node pipeline/cs_ids_revert.mjs --apply                  # 실제 revert
 *   node pipeline/cs_ids_revert.mjs --apply --since=2026-05-31 # 특정 일자 이후 batch
 *   node pipeline/cs_ids_revert.mjs --apply --setId=r2025b
 *   node pipeline/cs_ids_revert.mjs --apply --tool_version=1.0
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

const DATA_PATH = path.join(ROOT, "public/data/all_data_204.json");
const AUDIT_LOG_PATH = path.join(ROOT, "pipeline/output/audit_log.jsonl");
const BACKUP_DIR = path.join(ROOT, "pipeline/backups");

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? true];
  }),
);
const dryRun = !args.apply;
const since = args.since || null;
const scopeSetId = args.setId || null;
const scopeYear = args.scope || null;
const scopeTool = args.tool_version || null;

if (!fs.existsSync(AUDIT_LOG_PATH)) {
  console.error("audit_log.jsonl 없음");
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(DATA_PATH, "utf-8"));
const logLines = fs.readFileSync(AUDIT_LOG_PATH, "utf-8").trim().split("\n").filter(Boolean);
const logs = logLines.map((l) => JSON.parse(l));

// 필터링
const targets = logs.filter((e) => {
  if (e.action !== "set_cs_ids") return false;
  if (since && e.ts < since) return false;
  if (scopeSetId && e.setId !== scopeSetId) return false;
  if (scopeYear && e.yearKey !== scopeYear) return false;
  if (scopeTool && e.tool_version !== scopeTool) return false;
  return true;
});

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
          if (c.num === choiceNum) return c;
        }
      }
    }
  }
  return null;
}

const reverted = [];
const skipped = [];

// LIFO 순서로 revert (가장 최근 batch 먼저)
for (const e of targets.slice().reverse()) {
  const c = findChoice(e.yearKey, e.setId, e.questionId, e.choiceNum);
  if (!c) {
    skipped.push({ ...e, skip_reason: "choice_not_found" });
    continue;
  }
  // 현재 값이 audit log 의 after 와 정합하는지 확인 (그 사이 수동 변경 검출)
  const cur = JSON.stringify(c.cs_ids || []);
  const after = JSON.stringify(e.after || []);
  if (cur !== after) {
    skipped.push({ ...e, skip_reason: "current_differs_from_audit_after", current: c.cs_ids });
    continue;
  }
  if (!dryRun) c.cs_ids = e.before;
  reverted.push({ ts: e.ts, yearKey: e.yearKey, setId: e.setId, qId: e.questionId, cNum: e.choiceNum, from: e.after, to: e.before });
}

if (!dryRun && reverted.length > 0) {
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  fs.copyFileSync(DATA_PATH, path.join(BACKUP_DIR, `all_data_204.before_revert.${ts}.json`));
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), "utf-8");
  // revert 자체도 audit_log 에 기록
  for (const r of reverted) {
    fs.appendFileSync(
      AUDIT_LOG_PATH,
      JSON.stringify({
        ts: new Date().toISOString(),
        tool: "cs_ids_revert.mjs",
        action: "revert_cs_ids",
        yearKey: r.yearKey,
        setId: r.setId,
        questionId: r.qId,
        choiceNum: r.cNum,
        before: r.from,
        after: r.to,
        source: "revert",
      }) + "\n",
      "utf-8",
    );
  }
}

console.log(`\n=== cs_ids_revert.mjs ${dryRun ? "[DRY-RUN]" : "[APPLIED]"} ===`);
console.log(`scope: since=${since || "all"} setId=${scopeSetId || "all"} year=${scopeYear || "all"} tool=${scopeTool || "all"}`);
console.log(`audit entries 일치: ${targets.length}`);
console.log(`revert: ${reverted.length}`);
console.log(`skip: ${skipped.length}`);
if (skipped.length > 0) {
  const reasons = {};
  for (const s of skipped) reasons[s.skip_reason] = (reasons[s.skip_reason] || 0) + 1;
  console.log(`  skip 사유:`, reasons);
}
if (dryRun && reverted.length > 0) {
  console.log(`\n[DRY-RUN] revert 예정 sample (앞 5건):`);
  for (const r of reverted.slice(0, 5)) {
    console.log(`  ${r.yearKey} ${r.setId} Q${r.qId} 선지${r.cNum}: ${JSON.stringify(r.from)} → ${JSON.stringify(r.to)}`);
  }
}
