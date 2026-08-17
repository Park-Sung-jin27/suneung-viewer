// audit_diverge.mjs — 데이터와 원문이 갈라지는 지점을 짚어 보여준다 (발주 fz 검증용)
// 사용: node pipeline/audit_diverge.mjs <yearKey> <setId> <qId> <pdf텍스트경로>
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const [YK, SID, QID, TXT] = process.argv.slice(2);
const data = JSON.parse(
  fs.readFileSync(path.join(ROOT, "public/data/all_data_204.json"), "utf8"),
);
const raw = fs.readFileSync(TXT, "utf8");

function norm(s) {
  return String(s || "")
    .replace(/[\s ]+/g, "")
    .replace(/[‘’＇']/g, "'")
    .replace(/[“”＂"]/g, '"')
    .replace(/[｢「『]/g, "[")
    .replace(/[｣」』]/g, "]")
    .replace(/[～~〜]/g, "~")
    .replace(/[－–—―]/g, "-")
    .replace(/[（(]/g, "(")
    .replace(/[）)]/g, ")")
    .replace(/[·・･]/g, "·")
    .replace(/\u0003/g, "[")
    .replace(/\u0004/g, "]")
    .replace(/：/g, ":")
    .replace(/\[[A-E]\]/g, "");
}
const PDF = norm(raw);

let set = null;
for (const sec of ["reading", "literature"]) {
  const f = (data[YK][sec] || []).find((s) => s.id === SID);
  if (f) set = f;
}
const q = (set.questions || []).find((x) => x.id === Number(QID));
const bs = typeof q.bogi === "string" ? q.bogi : JSON.stringify(q.bogi);
const clean = bs.replace(/\[[^\]]*src:[^\]]*\]/g, "");
const n = norm(clean);

// 데이터 보기의 가장 긴 앞부분이 원문에 있는지 이분 탐색
let lo = 0,
  hi = n.length;
while (lo < hi) {
  const mid = Math.ceil((lo + hi) / 2);
  if (PDF.includes(n.slice(0, mid))) lo = mid;
  else hi = mid - 1;
}
const at = PDF.indexOf(n.slice(0, lo));
console.log(`=== ${YK} ${SID} Q${QID} ===`);
console.log(`데이터 보기 정규화 길이 ${n.length}자 · 원문과 일치하는 앞부분 ${lo}자`);
console.log("");
console.log("--- 데이터 (갈라지는 지점 앞뒤) ---");
console.log("…" + n.slice(Math.max(0, lo - 40), lo) + "  ▶◀  " + n.slice(lo, lo + 60) + "…");
console.log("");
console.log("--- 원문 (같은 지점) ---");
console.log("…" + PDF.slice(Math.max(0, at + lo - 40), at + lo) + "  ▶◀  " + PDF.slice(at + lo, at + lo + 60) + "…");
console.log("");
console.log("--- 데이터 보기 원문(비정규화) ---");
console.log(bs);
