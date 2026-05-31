// annotation_delete.mjs - JSON spec 의 deletions[] 처리 → annotations.json 안 entry 제거
// 사용: node pipeline/annotation_delete.mjs --batch=path/to/spec.json [--apply]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const ANN_PATH = path.join(ROOT, "public/data/annotations.json");
const BACKUP_DIR = path.join(ROOT, "pipeline/backups");

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? true];
  })
);
const dryRun = !args.apply;
const batchPath = args.batch;
if (!batchPath) {
  console.error("usage: --batch=path/to/spec.json");
  process.exit(1);
}

const ann = JSON.parse(fs.readFileSync(ANN_PATH, "utf-8"));
const spec = JSON.parse(fs.readFileSync(batchPath, "utf-8"));

const yk = spec.year;
const sid = spec.setId;
const deletions = spec.deletions || [];

if (!ann[yk] || !Array.isArray(ann[yk][sid])) {
  console.error("setId not found: " + yk + ":" + sid);
  process.exit(1);
}

function eq(a, b) {
  // 일치 비교: type 일치 + 명시된 모든 필드 일치
  if (a.type !== b.type) return false;
  for (const k of ["sentId","sentFrom","sentTo","marker","text","label","target","qId"]) {
    if (b[k] != null && a[k] !== b[k]) return false;
  }
  return true;
}

const before = ann[yk][sid].length;
const removed = [];
const remaining = [];
for (const a of ann[yk][sid]) {
  const match = deletions.find((d) => eq(a, d));
  if (match) removed.push(a);
  else remaining.push(a);
}

console.log("setId: " + yk + ":" + sid);
console.log("before: " + before + " entries");
console.log("delete spec: " + deletions.length);
console.log("matched for deletion: " + removed.length);

if (removed.length > 0) {
  for (const r of removed) {
    console.log("  - " + JSON.stringify({type:r.type, sentId:r.sentId, marker:r.marker, text:(r.text||"").slice(0,50)}));
  }
}

if (!dryRun && removed.length > 0) {
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  fs.copyFileSync(ANN_PATH, path.join(BACKUP_DIR, "annotations." + ts + ".json"));
  ann[yk][sid] = remaining;
  fs.writeFileSync(ANN_PATH, JSON.stringify(ann, null, 2), "utf-8");
  console.log("APPLIED. backup saved.");
} else {
  console.log("[DRY-RUN] add --apply to remove.");
}
