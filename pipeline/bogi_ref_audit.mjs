// bogi_ref_audit.mjs — 「발문 참조 상자 부재」 감사 축 (발주 D-101 ①)
//
// 발문이 <보기>·<학습 활동>·<자료> 같은 **참조 상자**를 가리키는데 그 상자가
// 데이터에 없으면, 학생은 발문이 말하는 것을 볼 수 없다. 화면에는 아무 표시도
// 안 나므로 다른 축이 잡지 못한다.
//
// 규칙 준수: 새 축은 **기존 353세트에 먼저 돌려 오탐률을 확인**한 뒤 편입한다.
// 이 도구는 게이트에 넣지 않고 별도로 돌린다(§13⑱ — 감사 축은 별도 스크립트).
//
// 사용: node pipeline/bogi_ref_audit.mjs [--scope new|old|all]

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = path.join(ROOT, "public/data/all_data_204.json");
const STEP3 = path.join(ROOT, "pipeline/reextract/step3");
const SCOPE = (() => { const i = process.argv.indexOf("--scope"); return i > 0 ? process.argv[i + 1] : "all"; })();

// 발문이 가리키는 참조 상자 이름들. 꺾쇠 안 공백은 조판에 따라 들쭉날쭉하다.
const REF = /[<〈＜]\s*(보\s*기(?:\s*\d)?|학습\s*활동(?:\s*과제)?|자\s*료(?:\s*\d)?|참고\s*자료|보\s*기\s*카드)\s*[>〉＞]/;

const newKeys = new Set();
for (const d of fs.readdirSync(STEP3)) {
  const p = path.join(STEP3, d, "step4_result.json");
  if (!fs.existsSync(p)) continue;
  const j = JSON.parse(fs.readFileSync(p, "utf8"));
  for (const s of [...(j.reading || []), ...(j.literature || [])]) newKeys.add(`${d}::${s.id}`);
}

// 상자를 담을 수 있는 자리 — 어느 하나라도 내용이 있으면 「있다」로 본다
const hasBox = (q) => {
  const b = q.bogi;
  if (typeof b === "string" && b.trim()) return true;
  if (Array.isArray(b) && b.length) return true;
  if (b && typeof b === "object" && Object.values(b).some((v) => v && String(v).trim())) return true;
  if (q.bogiImage || q.bogiImages || q.bogiTable) return true;
  return false;
};

const data = JSON.parse(fs.readFileSync(DATA, "utf8"));
const rows = { new: [], old: [] };
let checked = { new: 0, old: 0 }, refd = { new: 0, old: 0 };

for (const [yk, v] of Object.entries(data))
  for (const sec of ["reading", "literature"])
    for (const s of v[sec] || []) {
      const zone = newKeys.has(`${yk}::${s.id}`) ? "new" : "old";
      for (const q of s.questions || []) {
        checked[zone]++;
        const t = String(q.t ?? "");
        const m = t.match(REF);
        if (!m) continue;
        refd[zone]++;
        if (hasBox(q)) continue;
        rows[zone].push({ yk, sid: s.id, q: q.id, ref: m[1].replace(/\s+/g, ""), t: t.replace(/\n/g, " ").slice(0, 66) });
      }
    }

const show = (zone, label) => {
  console.log(`\n## ${label} — 문항 ${checked[zone]} · 참조 발문 ${refd[zone]} · **상자 부재 ${rows[zone].length}**`);
  if (refd[zone]) console.log(`   부재율 ${(rows[zone].length / refd[zone] * 100).toFixed(1)}%`);
  for (const r of rows[zone]) console.log(`   [${r.yk}] ${r.sid} Q${r.q}  <${r.ref}>\n      ${r.t}`);
};
if (SCOPE === "all" || SCOPE === "old") show("old", "기존 353세트 (오탐률 확인용)");
if (SCOPE === "all" || SCOPE === "new") show("new", "신규 43세트");

if (SCOPE === "all") {
  const rp = path.join(ROOT, "docs/bogi_ref_audit_20260825.md");
  const md = ["# 발문 참조 상자 부재 감사 (2026-08-25)", "",
    "> 발문이 `<보기>`·`<학습 활동>` 등을 가리키는데 그 상자가 데이터에 없는 문항.",
    "> 화면에는 아무 표시도 안 나므로 다른 축이 잡지 못한다.", "",
    `| 구간 | 문항 | 참조 발문 | 상자 부재 | 부재율 |`, `|---|--:|--:|--:|--:|`,
    `| 기존 353세트 | ${checked.old} | ${refd.old} | ${rows.old.length} | ${(rows.old.length / (refd.old || 1) * 100).toFixed(1)}% |`,
    `| 신규 43세트 | ${checked.new} | ${refd.new} | ${rows.new.length} | ${(rows.new.length / (refd.new || 1) * 100).toFixed(1)}% |`, "",
    "## 전건", "", "| 구간 | 회차 | 세트 | 문항 | 참조 | 발문 |", "|---|---|---|--:|---|---|"];
  for (const [zone, label] of [["old", "기존"], ["new", "신규"]])
    for (const r of rows[zone])
      md.push(`| ${label} | ${r.yk} | ${r.sid} | ${r.q} | \`<${r.ref}>\` | ${r.t.replace(/\|/g, "\\|")} |`);
  fs.writeFileSync(rp, md.join("\n"), "utf8");
  console.log(`\n   전건 → docs/bogi_ref_audit_20260825.md`);
}
