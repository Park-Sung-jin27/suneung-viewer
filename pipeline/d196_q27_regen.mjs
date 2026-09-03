// d196_q27_regen.mjs — l20279b Q27#5 해설 생성 (발주 D-196 · pat=L2 확정 후)
//
// 이 선지는 본 생성에서 해설이 통째로 비어 나왔다. 채택 게이트가 3회 거부했고
// 사유는 3회 모두 「축2 pat≠ok(ok=false, pat=undefined)」 하나였다 — pat 이 비었다는
// 사실만으로 거부하는 축이라 내용도 근거도 판정에 개입하지 않았다.
// pat=L2 를 심사관이 확정해 넣었으므로 축2 는 풀린 상태다.
//
// ★ 이 도구는 채택 게이트를 우회하지 않는다. 생성한 뒤 acceptRegenChoice 를 직접
//   돌려 4축(스탬프·pat·오염·형식)을 통과할 때만 적는다. 거부되면 사유를 그대로 내고
//   아무것도 쓰지 않는다 — 억지로 채택시키지 않는다(§결정B③ 취지).
//
// 사용: node pipeline/d196_q27_regen.mjs [--apply]

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { reanalyzeSingleChoice, applyDeterministicFooter } from "./step3_analysis.js";
import { acceptRegenChoice, extractQuotes, quoteResolved } from "./haesol_v2_gate.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "pipeline/test_data/d196_l20279b/step3_result.json");
const SID = "l20279b", QID = "27", NUM = 5;
const APPLY = process.argv.includes("--apply");

const raw = fs.readFileSync(SRC, "utf8");
const j = JSON.parse(raw);
const set = (j.literature || []).find((x) => (x.setId || x.id) === SID);
const q = (set?.questions || []).find((x) => String(x.id) === QID);
const c = (q?.choices || []).find((x) => x.num === NUM);

console.log(`# l20279b Q${QID}#${NUM} 해설 생성 (D-196)`);
console.log("");
if (!c) { console.error("🔴 선지 없음"); process.exit(1); }
if (c.pat !== "L2") { console.error(`🔴 pat 이 L2 가 아니다 (${JSON.stringify(c.pat)}) — d196_pat_fix 를 먼저 돌리십시오`); process.exit(1); }
if (c.ok !== false) { console.error(`🔴 ok 가 false 가 아니다`); process.exit(1); }
console.log(`- 선지 ${JSON.stringify(String(c.t).replace(/\n/g, " "))}`);
console.log(`- ok=${c.ok} · pat=${c.pat} · 현재 해설 ${String(c.analysis || "").length}자`);
console.log("");
if (!APPLY) { console.log("### 미리보기 — 아무것도 쓰지 않았다. `--apply`"); process.exit(0); }

const out = await reanalyzeSingleChoice(set, q, c);
let next = out && typeof out === "object" ? (out.analysis ?? "") : String(out || "");
next = String(next);
console.log(`- 생성 ${next.length}자`);
if (next.trim().length < 100) { console.log("## 🔴 반환값이 부실하다 — 아무것도 쓰지 않는다"); console.log("```\n" + next.slice(0, 400) + "\n```"); process.exit(1); }

// 결론줄을 정형구로 맞춘다 — reanalyzeSingleChoice 는 postProcess 를 안 거치므로
// applyDeterministicFooter 가 적용되지 않는다(Q26 재생성에서 자유문구가 나온 원인).
const stamped = applyDeterministicFooter({ ...c, analysis: next });
if (stamped !== next) console.log(`- 결론줄 정형화 적용`);

const v = acceptRegenChoice(stamped, c.pat, c.ok);
console.log(`- 채택 게이트: ${v.accept ? "✅ 통과" : "🔴 거부 — " + v.reason}${v.warn ? ` (경고 ${v.warn})` : ""}`);
if (!v.accept) { console.log("\n## 🔴 게이트가 거부했다 — 아무것도 쓰지 않는다. 억지로 채택시키지 않는다"); console.log("```\n" + stamped.slice(0, 600) + "\n```"); process.exit(1); }

const ctx = { sents: set.sents, bogi: q.bogi || "", qt: q.t, choices: q.choices };
const qs = extractQuotes(stamped).map((x) => ({ x, how: quoteResolved(x, ctx) }));
console.log(`- 📌 인용 ${qs.filter((z) => z.how).length}/${qs.length} 해소`);
for (const z of qs) console.log(`   ${z.how ? "✅ " + z.how : "🔴 미해소"} ${JSON.stringify(z.x.slice(0, 60))}`);
console.log("");
console.log("```");
console.log(stamped);
console.log("```");
console.log("");

fs.writeFileSync(SRC + ".before_q27regen", raw, "utf8");
c.analysis = stamped;
delete c._pat_error;
fs.writeFileSync(SRC, JSON.stringify(j, null, 2), "utf8");

// ── 되읽기 검산 ─────────────────────────────────────────────────────────
const back = JSON.parse(fs.readFileSync(SRC, "utf8"));
const pre = JSON.parse(raw);
const bad = [];
const bc = back.literature.find((x) => (x.setId || x.id) === SID).questions.find((x) => String(x.id) === QID).choices.find((x) => x.num === NUM);
if (String(bc.analysis || "").trim().length < 100) bad.push("해설이 부실하다");
if (bc.pat !== "L2") bad.push("pat 이 달라졌다");
if (bc.ok !== false) bad.push("ok 가 달라졌다");
if ("_pat_error" in bc) bad.push("_pat_error 가 남아 있다");
for (const sec of ["reading", "literature"]) for (const s of pre[sec] || []) {
  const sid = s.setId || s.id;
  const cur = (back[sec] || []).find((x) => (x.setId || x.id) === sid);
  for (const oq of s.questions || []) {
    const cq = (cur?.questions || []).find((x) => String(x.id) === String(oq.id));
    for (const oc of oq.choices || []) {
      if (sid === SID && String(oq.id) === QID && oc.num === NUM) continue;
      const cc = (cq?.choices || []).find((x) => x.num === oc.num);
      if (JSON.stringify(oc) !== JSON.stringify(cc)) bad.push(`${sid} Q${oq.id}#${oc.num} 가 달라졌다`);
    }
  }
}
if (bad.length) { console.log("## 🔴 되읽기 검산 실패"); bad.forEach((x) => console.log(`- ${x}`)); process.exit(1); }
console.log("## ✅ 되읽기 검산 통과 (S-02)");
console.log("- 해설 실재 · pat=L2 · ok=false · _pat_error 제거");
console.log("- 다른 선지·문항·세트 전건 무변");
