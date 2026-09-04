// audit_choice_diff.mjs — 선지·발문 불일치의 갈라지는 지점을 한 줄로 보여준다 (발주 fz 검증용)
// 사용: node pipeline/audit_choice_diff.mjs <yearKey> <pdf텍스트경로>
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const [YK, TXT] = process.argv.slice(2);
const data = JSON.parse(
  fs.readFileSync(path.join(ROOT, "data-source/all_data_204.json"), "utf8"),
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

function diverge(text) {
  const n = norm(text);
  let lo = 0,
    hi = n.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (PDF.includes(n.slice(0, mid))) lo = mid;
    else hi = mid - 1;
  }
  if (lo === n.length) return null;
  const at = lo > 0 ? PDF.indexOf(n.slice(0, lo)) : -1;
  return {
    lo,
    total: n.length,
    dataAfter: n.slice(lo, lo + 34),
    pdfAfter: at >= 0 ? PDF.slice(at + lo, at + lo + 34) : "(앞부분조차 없음)",
    before: n.slice(Math.max(0, lo - 22), lo),
  };
}

for (const sec of ["reading", "literature"]) {
  for (const s of data[YK][sec] || []) {
    for (const q of s.questions || []) {
      const items = [["발문", q.t]];
      for (const c of q.choices || [])
        if (!/src:/.test(c.t || "")) items.push([`선지${c.num}`, c.t]);
      for (const [label, txt] of items) {
        if (!txt || norm(txt).length < 8) continue;
        const d = diverge(txt);
        if (!d) continue;
        console.log(`${s.id} Q${q.id} ${label}  (${d.lo}/${d.total}자 일치)`);
        console.log(`   …${d.before} ▶ 데이터: ${d.dataAfter}`);
        console.log(`   …${d.before} ▶ 원문  : ${d.pdfAfter}`);
      }
    }
  }
}
