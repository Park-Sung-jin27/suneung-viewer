// bogi_restate_audit.mjs — 해설의 <보기> 재진술 (발주 D-72)
//
// 해설은 <보기> 항목을 「ㄴ(…)」 형태로 다시 진술한다. 그 진술이 실제 항목과
// 다르면 학생은 <보기>를 잘못 배운다. 인용이 아니라 재진술이라 글자 겹침이
// 낮고, (d) 축(축약 인용 대조)으로는 잡히지 않는다.
//
//   축 A — 항목 내부 모순 : 같은 문항에서 같은 기호의 재진술이 서로 다르면 검출
//                            ★ 원문도 의미 판단도 필요 없다. 데이터 내부 모순이다.
//   축 B — 서술형만 추출  : 괄호 안이 25자 이상이고 종결어미로 끝나는 것
//                            라벨·기호·인용은 여기서 걸러진다
//
// ★ 읽기 전용. 판정하지 않는다. 사용: node pipeline/bogi_restate_audit.mjs [--all]

import fs from "node:fs";

const data = JSON.parse(fs.readFileSync(new URL("../public/data/all_data_204.json", import.meta.url), "utf8"));
const src = fs.readFileSync(new URL("../src/dataLoader.js", import.meta.url), "utf8");
const _s = src.indexOf("const RELEASE_KEYS = new Set([");
const RK = new Set(
  [...src.slice(_s, src.indexOf("]);", _s)).matchAll(/"([^"]+)"/g)]
    .map((m) => m[1]).filter((k) => k.includes("::")),
);
const FREE5 = new Set(["2022수능", "2023수능", "2024수능", "2025수능", "2026수능"]);
const OPEN = String.fromCharCode(40), CLOSE = String.fromCharCode(41);
const ITEM = /^\s*([ㄱ-ㅎA-Ea-e①-⑤ⓐ-ⓔ])[.．]\s*(.+)$/;
// 서술형 판정 — 종결어미로 끝나는가
const NARRATIVE = /(다|군|까|요)[.。]?$/;

const rows = [];
for (const yk of Object.keys(data)) {
  for (const sec of ["reading", "literature"]) {
    for (const set of data[yk][sec] || []) {
      const live = RK.has(`${yk}::${set.id}`);
      for (const q of set.questions || []) {
        if (typeof q.bogi !== "string") continue;
        const items = {};
        for (const line of q.bogi.split("\n")) { const m = ITEM.exec(line); if (m) items[m[1]] = m[2].trim(); }
        if (Object.keys(items).length < 2) continue;
        for (const c of q.choices || []) {
          const a = String(c.analysis || ""); if (!a) continue;
          for (const k of Object.keys(items)) {
            // 「기호(」 바로 뒤부터 첫 「)」 까지. 정규식 없이 잘라 백슬래시 문제를 피한다.
            let from = 0;
            for (;;) {
              const i = a.indexOf(k + OPEN, from);
              if (i < 0) break;
              const s = i + k.length + 1;
              const e = a.indexOf(CLOSE, s);
              from = i + 1;
              if (e < 0) continue;
              const said = a.slice(s, e).trim();
              if (said.length < 6 || said.length > 200) continue;
              if (said.includes(OPEN)) continue;                 // 중첩 괄호는 건너뛴다
              if (/[ㄱ-ㅎ]\s*[.．]/.test(said)) continue;        // 「ㄷ. …」 인용 나열
              rows.push({ yk, setId: set.id, q: q.id, n: c.num, live, free: FREE5.has(yk),
                key: k, said, bogi: items[k],
                narrative: said.length >= 25 && NARRATIVE.test(said) });
            }
          }
        }
      }
    }
  }
}

// ── 축 A — 같은 문항·같은 기호의 재진술이 서로 다른가 ──
const groups = {};
for (const r of rows) (groups[`${r.yk}|${r.setId}|${r.q}|${r.key}`] ??= []).push(r);
const conflict = [];
for (const [k, v] of Object.entries(groups)) {
  const uniq = [...new Set(v.map((x) => x.said))];
  if (uniq.length > 1) conflict.push({ key: k, items: v, uniq });
}
console.log(`## 축 A — 항목 내부 모순 (같은 기호의 재진술이 서로 다름)\n`);
console.log(`전체 재진술 ${rows.length}건 · 기호 묶음 ${Object.keys(groups).length}개`);
console.log(`🔴 모순 ${conflict.length}묶음 (LIVE ${conflict.filter((c) => c.items[0].live).length} · 무료 5개년 ${conflict.filter((c) => c.items[0].free).length})\n`);
for (const c of conflict) {
  const [yk, sid, qn, key] = c.key.split("|");
  console.log(`${c.items[0].free ? "🔴무료 " : "      "}${yk} ${sid} Q${qn} [${key}] — 서로 다른 진술 ${c.uniq.length}가지`);
  console.log(`   <보기>: ${c.items[0].bogi.slice(0, 66)}`);
  for (const r of c.items) console.log(`   선지${r.n}: ${r.said.slice(0, 66)}`);
}

// ── 축 B — 서술형 재진술 ──
const narr = rows.filter((r) => r.narrative);
console.log(`\n## 축 B — 서술형 재진술 (25자 이상 · 종결어미)\n`);
console.log(`모수 ${narr.length}건 (LIVE ${narr.filter((r) => r.live).length} · 무료 5개년 ${narr.filter((r) => r.free).length})`);
console.log(`문항 ${new Set(narr.map((r) => r.yk + r.setId + r.q)).size}개\n`);
const SHOW = process.argv.includes("--all") ? narr : narr.slice(0, 20);
for (const r of SHOW) {
  console.log(`${r.free ? "🔴무료 " : "      "}${r.yk} ${r.setId} Q${r.q}#${r.n} [${r.key}]`);
  console.log(`   <보기>: ${r.bogi.slice(0, 70)}`);
  console.log(`   재진술: ${r.said.slice(0, 70)}`);
}
if (SHOW.length < narr.length) console.log(`\n… 외 ${narr.length - SHOW.length}건 (--all)`);
