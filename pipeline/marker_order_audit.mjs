// marker_order_audit.mjs — (e4) 마커 뒤바뀜 후보 축소 (발주 D-32)
//
// 뒤바뀜은 마커 집합이 같고 「역할(순서)」만 교차한다. 그래서 집합 비교로는
// 원리적으로 못 잡는다(D-31 실증). 순서를 본다.
//
//   [축 C] 같은 문항의 두 선지가 동일한 마커 쌍을 반대 순서로 언급 → 후보
//   [축 D] 선지의 마커 등장 순서 ≠ 그 선지 해설의 마커 등장 순서 → 후보
//          (해설은 사람이 쓴 것이라 순서 정보를 신뢰한다)
//
// ★ 자동 판정이 아니라 후보 축소가 목적이다. 47회차 전수 원문 대조 대신
//   후보만 대조하면 된다. 오탐이 섞이는 것은 정상이다.
// ★ 읽기 전용. 복원하지 않는다.
// 사용: node pipeline/marker_order_audit.mjs [데이터경로]

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = process.argv[2] || path.join(ROOT, "public/data/all_data_204.json");
const data = JSON.parse(fs.readFileSync(DATA, "utf8"));
const src = fs.readFileSync(path.join(ROOT, "src/dataLoader.js"), "utf8");
const _s = src.indexOf("const RELEASE_KEYS = new Set([");
const RK = new Set(
  [...src.slice(_s, src.indexOf("]);", _s)).matchAll(/"([^"]+)"/g)]
    .map((m) => m[1]).filter((k) => k.includes("::")),
);

const MARK = /[ⓐ-ⓩⒶ-Ⓩ㉠-㉿㈀-㈜]/g;
// 등장 순서를 유지한 채 중복만 없앤다. 「ⓑ…ⓐ…ⓐ」 → "ⓑⓐ"
const seq = (s) => {
  const out = [];
  for (const m of String(s || "").match(MARK) || []) if (!out.includes(m)) out.push(m);
  return out.join("");
};
const same = (a, b) => a.length === b.length && [...a].every((c) => b.includes(c));

const rows = [];
for (const yk of Object.keys(data)) {
  for (const sec of ["reading", "literature"]) {
    for (const set of data[yk][sec] || []) {
      const live = RK.has(`${yk}::${set.id}`);
      for (const q of set.questions || []) {
        const cs = (q.choices || []).map((c) => ({ n: c.num, s: seq(c.t), a: seq(c.analysis) }));
        // ── 축 C — 같은 마커 쌍을 반대 순서로 쓴 선지 짝 ──
        for (let i = 0; i < cs.length; i++)
          for (let j = i + 1; j < cs.length; j++) {
            const x = cs[i], y = cs[j];
            if (x.s.length < 2 || !same(x.s, y.s) || x.s === y.s) continue;
            rows.push({ yk, setId: set.id, q: q.id, n: `${x.n}↔${y.n}`, live,
              axis: "C", ord: `${x.s} ↔ ${y.s}` });
          }
        // ── 축 D — 선지와 그 해설의 마커 순서가 다름 ──
        for (const c of cs) {
          if (c.s.length < 2 || !c.a || !same(c.s, c.a) || c.s === c.a) continue;
          rows.push({ yk, setId: set.id, q: q.id, n: String(c.n), live,
            axis: "D", ord: `선지 ${c.s} / 해설 ${c.a}` });
        }
      }
    }
  }
}
const C = rows.filter((r) => r.axis === "C"), D = rows.filter((r) => r.axis === "D");
console.log(`## (e4) 마커 뒤바뀜 후보 — ${rows.length}건 (축 C ${C.length} / 축 D ${D.length})`);
console.log(`   LIVE ${rows.filter((r) => r.live).length}건\n`);
console.log("| 회차 | 세트 | 문항 | 선지 | 축 | 마커 순서 |");
console.log("|---|---|--:|---|:-:|---|");
const SHOW = process.argv.includes("--all") ? rows : rows.slice(0, 30);
for (const r of SHOW)
  console.log(`| ${r.yk} | ${r.setId} | Q${r.q} | ${r.n} | ${r.axis} | ${r.ord} |${r.live ? " **LIVE**" : ""}`);
if (rows.length > 30) console.log(`\n… 외 ${rows.length - 30}건`);
