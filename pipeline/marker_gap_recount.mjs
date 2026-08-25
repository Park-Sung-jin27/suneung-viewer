// marker_gap_recount.mjs — D-94 클래스(마커 미정박) 재집계 (발주 D-109 ②)
//
// ★ 기존 집계는 all_data_204.json 의 set.annotations 를 봤다. 화면은 그 값을 읽지 않는다.
//   화면 bracket = (annotations.json 이 있으면 그것, 없으면 all_data) ∪ visual_marks.json
//   그중 sentIds.indexOf 로 실제 잡히는 것만 그려진다(src/PassagePanel.jsx:655).
//   판정 단위는 **라벨**이다 — 후보 여럿 중 하나만 맞아도 그 라벨은 나온다.
//
// (c) 관점만 센다: **문항이 [X] 를 가리키는데 화면에 그 구간이 없다** = 학생이 못 보는 구간.
//   (a)workTag·(b)역방향은 데이터 비대칭일 뿐 화면 결함이 아니므로 참고로만 낸다.
//
// 사용: node pipeline/marker_gap_recount.mjs [--md]

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const P = (f) => path.join(ROOT, "public/data", f);
const data = JSON.parse(fs.readFileSync(P("all_data_204.json"), "utf8"));
const ann = JSON.parse(fs.readFileSync(P("annotations.json"), "utf8"));
const vmRaw = JSON.parse(fs.readFileSync(P("visual_marks.json"), "utf8"));
const src = fs.readFileSync(path.join(ROOT, "src/dataLoader.js"), "utf8");
const at = src.indexOf("const RELEASE_KEYS = new Set([");
const REL = new Set([...src.slice(at, src.indexOf("]);", at)).matchAll(/"([^"]+)"/g)]
  .map((m) => m[1]).filter((k) => k.includes("::")));

const vmBy = new Map();
for (const m of vmRaw.marks || []) {
  if (!m?.setId) continue;
  const k = `${m.yearKey}::${m.setId}`;
  vmBy.set(k, [...(vmBy.get(k) || []), m]);
}
const flat = (v) => (v == null ? "" : typeof v === "string" ? v : JSON.stringify(v));

const rows = [];
let sets = 0;
for (const [yk, v] of Object.entries(data))
  for (const sec of ["reading", "literature"])
    for (const s of v[sec] || []) {
      const setId = s.setId || s.id;
      const live = REL.has(`${yk}::${setId}`);
      const ids = (s.sents || []).map((x) => String(x.id));

      // 문항이 가리키는 라벨
      const ref = new Set();
      for (const q of s.questions || []) {
        const parts = [flat(q.t), flat(q.bogi), ...(q.choices || []).map((c) => c.t || "")];
        for (const m of parts.join(" ").match(/\[[A-F]\]/g) || []) ref.add(m[1]);
      }
      if (!ref.size) continue;
      sets++;

      // 화면에 실제로 그려지는 라벨
      const annList = ann[yk]?.[setId];
      const effAnn = Array.isArray(annList) && annList.length > 0 ? annList : (s.annotations || []);
      const cands = [
        ...(vmBy.get(`${yk}::${setId}`) || [])
          .filter((m) => m.type === "bracket" && m.target === "sent_range" && m.status !== "broken"
            && Array.isArray(m.sentIds) && m.sentIds.length)
          .map((m) => ({ label: m.label, from: m.sentIds[0], to: m.sentIds[m.sentIds.length - 1] })),
        ...effAnn.filter((a) => a?.type === "bracket" && a.sentFrom && a.sentTo && (!a.target || a.target === "passage"))
          .map((a) => ({ label: a.label, from: a.sentFrom, to: a.sentTo })),
      ];
      const drawn = new Set();
      for (const b of cands) {
        const f = ids.indexOf(String(b.from)), t = ids.indexOf(String(b.to));
        if (f >= 0 && t >= 0 && f <= t) drawn.add(b.label);
      }
      const miss = [...ref].filter((l) => !drawn.has(l)).sort();
      if (!miss.length) continue;
      rows.push({ yk, sid: setId, live, miss, ref: [...ref].sort().join(""), drawn: [...drawn].sort().join("") || "없음" });
    }

const L = (a) => a.filter((x) => x.live).length;
const liveRows = rows.filter((r) => r.live);
const out = [];
out.push(`# D-94 클래스 재집계 — 화면 원천 기준 (D-109 ②)`);
out.push(``);
out.push(`> 생성: \`node pipeline/marker_gap_recount.mjs --md\``);
out.push(`> 기존 집계는 all_data 의 \`set.annotations\` 를 봤다. 화면은 그 값을 읽지 않는다.`);
out.push(`> 여기서는 화면 원천(annotations.json ∪ visual_marks.json)에서 **실제로 그려지는 라벨**과`);
out.push(`> 문항이 가리키는 라벨을 맞춰 본다. 판정 단위는 라벨이다.`);
out.push(``);
out.push(`| 항목 | 세트 | LIVE 세트 |`);
out.push(`|---|--:|--:|`);
out.push(`| 문항이 [A]~[F] 를 가리키는 세트 | ${sets} | — |`);
out.push(`| **가리키는데 화면에 없는 세트** | **${rows.length}** | **${L(rows)}** |`);
out.push(``);
out.push(`빠진 라벨 수: 전체 ${rows.reduce((a, r) => a + r.miss.length, 0)}개 · LIVE ${liveRows.reduce((a, r) => a + r.miss.length, 0)}개`);
out.push(``);
if (liveRows.length) {
  out.push(`## 🔴 LIVE — 학생이 못 보는 구간`);
  out.push(``);
  out.push(`| 회차 | 세트 | 문항이 가리키는 라벨 | 화면에 그려지는 라벨 | **빠진 라벨** |`);
  out.push(`|---|---|---|---|---|`);
  for (const r of liveRows)
    out.push(`| ${r.yk} | \`${r.sid}\` | ${r.ref} | ${r.drawn} | **${r.miss.join("")}** |`);
  out.push(``);
}
const rest = rows.filter((r) => !r.live);
if (rest.length) {
  out.push(`## 비노출`);
  out.push(``);
  out.push(`| 회차 | 세트 | 가리키는 라벨 | 그려지는 라벨 | 빠진 라벨 |`);
  out.push(`|---|---|---|---|---|`);
  for (const r of rest)
    out.push(`| ${r.yk} | \`${r.sid}\` | ${r.ref} | ${r.drawn} | ${r.miss.join("")} |`);
  out.push(``);
}
console.log(out.join("\n"));
