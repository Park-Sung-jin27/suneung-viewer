// marker_swap_audit.mjs — (e4) 마커 뒤바뀜 (발주 D-31)
//
// 뒤바뀜은 문장이 자연스럽고, 게이트를 통과하고, (e3) 도 못 잡고, 육안으로도 안 보인다.
// 두 마커가 지문에 모두 있으므로 「참조했는데 없다」가 성립하지 않기 때문이다.
// 그러나 학생은 정답과 정반대로 이해한다.
//
//   [축 A] 선지가 언급한 마커 M1 vs 그 선지의 cs_ids 가 가리키는 문장의 마커 M2
//          M1 − M2 ≠ ∅ 이고 M2 − M1 ≠ ∅  →  서로 어긋남 = 뒤바뀜 후보
//   [축 B] 선지 마커 vs 그 선지 해설이 인용한 마커
//
// ★ 원문 PDF 가 필요 없다. 데이터 내부 대조군끼리 맞춰 본다.
// ★ 읽기 전용. quality_gate 에 축을 붙이지 않는다(§13⑱).
// 사용: node pipeline/marker_swap_audit.mjs [데이터경로]

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
const marks = (s) => new Set(String(s || "").match(MARK) || []);
const D = (a, b) => [...a].filter((x) => !b.has(x));

const rows = [];
for (const yk of Object.keys(data)) {
  for (const sec of ["reading", "literature"]) {
    for (const set of data[yk][sec] || []) {
      const live = RK.has(`${yk}::${set.id}`);
      const sent = new Map((set.sents || []).map((t) => [t.id, t.t]));
      for (const q of set.questions || []) {
        for (const c of q.choices || []) {
          const M1 = marks(c.t);
          if (!M1.size) continue;
          // ── 축 A ──
          const ids = c.cs_ids || [];
          if (ids.length) {
            const M2 = new Set();
            for (const id of ids) for (const m of marks(sent.get(id))) M2.add(m);
            // 양방향으로 어긋날 때만 뒤바뀜으로 본다.
            //   한쪽만 어긋나면 단순 결손이라 (e3) 담당이다.
            if (M2.size && D(M1, M2).length && D(M2, M1).length)
              rows.push({ yk, setId: set.id, q: q.id, n: c.num, live, axis: "A",
                m1: [...M1].join(""), m2: [...M2].join(""), t: String(c.t).slice(0, 42) });
          }
          // ── 축 B ──
          const M3 = marks(c.analysis);
          if (M3.size && D(M1, M3).length && D(M3, M1).length)
            rows.push({ yk, setId: set.id, q: q.id, n: c.num, live, axis: "B",
              m1: [...M1].join(""), m2: [...M3].join(""), t: String(c.t).slice(0, 42) });
        }
      }
    }
  }
}
const A = rows.filter((r) => r.axis === "A"), B = rows.filter((r) => r.axis === "B");
console.log(`## (e4) 마커 뒤바쓰임 — 검출 ${rows.length}건 (축 A ${A.length} / 축 B ${B.length})`);
console.log(`   LIVE ${rows.filter((r) => r.live).length}건\n`);
console.log("| 회차 | 세트 | 문항 | 선지 | 축 | 선지 마커 | 대조군 마커 |");
console.log("|---|---|--:|--:|:-:|---|---|");
for (const r of rows.slice(0, 30))
  console.log(`| ${r.yk} | ${r.setId} | Q${r.q} | ${r.n} | ${r.axis} | ${r.m1} | ${r.m2} |`);
if (rows.length > 30) console.log(`\n… 외 ${rows.length - 30}건`);
