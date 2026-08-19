// analysis_verdict_audit.mjs — ok ↔ 해설 결론 표지 모순 (발주 D-55)
//
// 해설은 「✅ …적절한 진술」 / 「❌ …부적절한 진술」로 끝난다.
// 이 표지는 ok 와 **같은 축**이다 — 둘 다 「선지 진술의 참/거짓」이다.
// 발문 극성은 정답을 고를 때만 필요하고, 여기서는 필요 없다.
//   ok=true  인데 해설이 ❌ 로 끝남  → 🔴 모순
//   ok=false 인데 해설이 ✅ 로 끝남  → 🔴 모순
//
// ★ 원문·앵커·사람 판독이 전혀 필요 없다. 데이터 내부 모순이다.
// ★ 실증: r20249d Q14 선지③ 은 정답인데 해설이 「❌ 부적절한 진술」이었다.
//   학생이 정답을 맞히고도 틀렸다고 배우는 상태다.
// 사용: node pipeline/analysis_verdict_audit.mjs [--all]

import fs from "node:fs";

const data = JSON.parse(fs.readFileSync(new URL("../public/data/all_data_204.json", import.meta.url), "utf8"));
const src = fs.readFileSync(new URL("../src/dataLoader.js", import.meta.url), "utf8");
const _s = src.indexOf("const RELEASE_KEYS = new Set([");
const RK = new Set(
  [...src.slice(_s, src.indexOf("]);", _s)).matchAll(/"([^"]+)"/g)]
    .map((m) => m[1]).filter((k) => k.includes("::")),
);

const rows = [], noMark = [];
let checked = 0;
for (const yk of Object.keys(data)) {
  for (const sec of ["reading", "literature"]) {
    for (const set of data[yk][sec] || []) {
      const live = RK.has(`${yk}::${set.id}`);
      for (const q of set.questions || []) {
        for (const c of q.choices || []) {
          const a = String(c.analysis || "").trim();
          if (!a) continue;
          const m = a.match(/[✅❌]/g);
          if (!m) { noMark.push({ yk, sid: set.id, n: q.id, c: c.num, live }); continue; }
          checked++;
          const said = m[m.length - 1] === "✅";     // 해설이 「적절하다」고 결론지었는가
          if (said === !!c.ok) continue;
          const tail = (a.split("\n").filter((x) => x.trim()).pop() || "").trim();
          rows.push({ yk, sid: set.id, n: q.id, c: c.num, live, ok: !!c.ok,
            said, stem: String(q.t || "").slice(0, 38), tail: tail.slice(0, 46) });
        }
      }
    }
  }
}
console.log(`## ok ↔ 해설 결론 모순 — 대조 ${checked}선지\n`);
console.log(`🔴 모순 ${rows.length}건 (LIVE ${rows.filter((r) => r.live).length})`);
console.log(`   ok=true 인데 ❌ : ${rows.filter((r) => r.ok).length}건  ← 정답을 오답이라 설명`);
console.log(`   ok=false 인데 ✅: ${rows.filter((r) => !r.ok).length}건  ← 오답을 정답이라 설명`);
console.log(`⚪ 표지 없는 해설 : ${noMark.length}건\n`);
if (rows.length) {
  console.log("| 회차 | 세트 | 문항 | 선지 | ok | 해설 | LIVE |");
  console.log("|---|---|--:|--:|:-:|:-:|:-:|");
  const SHOW = process.argv.includes("--all") ? rows : rows.slice(0, 30);
  for (const r of SHOW)
    console.log(`| ${r.yk} | \`${r.sid}\` | Q${r.n} | ${r.c} | ${r.ok ? "true" : "false"} | ${r.said ? "✅" : "❌"} | ${r.live ? "**LIVE**" : "-"} |`);
  if (SHOW.length < rows.length) console.log(`\n… 외 ${rows.length - SHOW.length}건 (--all)`);
}
