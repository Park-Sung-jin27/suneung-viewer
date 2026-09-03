// d196_q26_regen.mjs — l20279b Q26 5선지만 해설 재생성 (발주 D-196 선결 후속)
//
// 왜 이 문항만인가: 빈칸 기입란 복원(d196_blank_restore) 이 발문을 바꿨다. Q26 해설은
//   빈칸이 없는 발문으로 만들어졌으므로 그 5선지만 다시 만든다. 다른 5문항의 발문은
//   그대로이므로 재생성 대상이 아니다 — 「l20279b 외 세트 재생성 금지」와 같은 취지로
//   **바뀐 입력에 딸린 것만** 다시 만든다.
//
// 세트 단위 재생성(--retry)을 쓰지 않는 이유: 멀쩡한 25선지까지 다시 만들고,
//   Q27#5 의 채택 게이트 교착(pat 미정 → regenGate 거부)을 다시 밟는다.
//
// 사용: node pipeline/d196_q26_regen.mjs [--apply]

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { reanalyzeSingleChoice } from "./step3_analysis.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "pipeline/test_data/d196_l20279b/step3_result.json");
const SID = "l20279b", QID = "26";
const APPLY = process.argv.includes("--apply");

const raw = fs.readFileSync(SRC, "utf8");
const j = JSON.parse(raw);
const set = (j.literature || []).find((x) => (x.setId || x.id) === SID);
const q = (set?.questions || []).find((x) => String(x.id) === QID);

console.log("# l20279b Q26 해설 재생성 (D-196)");
console.log("");
if (!q) { console.error("🔴 Q26 없음"); process.exit(1); }
if (!String(q.t).includes("______")) {
  console.error("🔴 발문에 빈칸이 없다 — d196_blank_restore 를 먼저 돌리십시오");
  process.exit(1);
}
console.log(`- 발문 빈칸 확인 ✅ ${JSON.stringify(String(q.t).slice(-40))}`);
console.log(`- 대상 ${q.choices.length}선지 · 다른 5문항은 손대지 않는다`);
console.log("");
if (!APPLY) {
  for (const c of q.choices)
    console.log(`  #${c.num} ok=${c.ok} pat=${JSON.stringify(c.pat)} 현재 ${String(c.analysis || "").length}자`);
  console.log("");
  console.log("### 미리보기 — 아무것도 쓰지 않았다. `--apply`");
  process.exit(0);
}

const olds = new Map(q.choices.map((c) => [c.num, String(c.analysis || "")]));
let done = 0, kept = 0;
for (const c of q.choices) {
  const out = await reanalyzeSingleChoice(set, q, c);
  const next = out && typeof out === "object" ? (out.analysis ?? out) : out;
  if (typeof next === "string" && next.trim().length >= 100) {
    c.analysis = next; done++;
    console.log(`  #${c.num} ✅ 재생성 ${olds.get(c.num).length} → ${next.length}자`);
  } else {
    kept++;
    console.log(`  #${c.num} ⚠ 반환값이 부실해 기존 해설을 유지한다 (${JSON.stringify(next).slice(0, 80)})`);
  }
}
console.log("");

fs.writeFileSync(SRC + ".before_q26regen", raw, "utf8");
fs.writeFileSync(SRC, JSON.stringify(j, null, 2), "utf8");

// ── 되읽기 검산 ─────────────────────────────────────────────────────────
const back = JSON.parse(fs.readFileSync(SRC, "utf8"));
const pre = JSON.parse(raw);
const bad = [];
const bset = (back.literature || []).find((x) => (x.setId || x.id) === SID);
const bq = (bset?.questions || []).find((x) => String(x.id) === QID);
if (!bq) bad.push("Q26 이 사라졌다");
for (const c of bq?.choices || []) {
  if (!c.analysis || String(c.analysis).trim().length < 100) bad.push(`#${c.num} 해설이 부실하다`);
  const p = (pre.literature.find((x) => (x.setId || x.id) === SID).questions.find((x) => String(x.id) === QID).choices || []).find((x) => x.num === c.num);
  if (c.ok !== p.ok) bad.push(`#${c.num} ok 이 달라졌다`);
  if (JSON.stringify(c.pat) !== JSON.stringify(p.pat)) bad.push(`#${c.num} pat 이 달라졌다`);
  if (c.t !== p.t) bad.push(`#${c.num} 선지 본문이 달라졌다`);
}
// 다른 문항·세트 전건 무변
for (const sec of ["reading", "literature"]) for (const s of pre[sec] || []) {
  const sid = s.setId || s.id;
  const cur = (back[sec] || []).find((x) => (x.setId || x.id) === sid);
  for (const oq of s.questions || []) {
    if (sid === SID && String(oq.id) === QID) continue;
    const cq = (cur?.questions || []).find((x) => String(x.id) === String(oq.id));
    if (JSON.stringify(oq) !== JSON.stringify(cq)) bad.push(`${sid} Q${oq.id} 가 달라졌다`);
  }
}
if (JSON.stringify(bq.t) !== JSON.stringify(q.t)) bad.push("Q26 발문이 달라졌다");

console.log(`- 재생성 ${done}건 · 기존 유지 ${kept}건`);
console.log(`- 백업 \`${path.basename(SRC)}.before_q26regen\``);
console.log("");
if (bad.length) { console.log("## 🔴 되읽기 검산 실패"); bad.forEach((x) => console.log(`- ${x}`)); process.exit(1); }
console.log("## ✅ 되읽기 검산 통과 (S-02)");
console.log("- Q26 5선지 해설 실재 · ok·pat·선지본문·발문 무변");
console.log("- 다른 5문항·다른 세트 전건 무변");
