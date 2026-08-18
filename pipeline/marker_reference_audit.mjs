// marker_reference_audit.mjs — (e3) 마커 참조 정합성 (발주 D-28 ①)
//
// 발문·선지가 참조하는 마커가 지문에 실제로 있는가만 본다.
//   A = 발문 + 선지가 참조하는 마커 집합
//   B = 지문(sents) + 그 문항 <보기> 에 존재하는 마커 집합
//   A − B ≠ ∅  →  결함
//
// ★ 원문 PDF 가 필요 없다. 데이터 내부 모순이기 때문이다.
//   그래서 미대조 139건에도 그대로 돌아간다(발주 D-28).
// ★ 읽기 전용. 데이터를 쓰지 않는다. quality_gate 에 축을 붙이지 않는다(§13⑱).
// 사용: node pipeline/marker_reference_audit.mjs [--all]

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const data = JSON.parse(fs.readFileSync(path.join(ROOT, "public/data/all_data_204.json"), "utf8"));
const src = fs.readFileSync(path.join(ROOT, "src/dataLoader.js"), "utf8");
const _s = src.indexOf("const RELEASE_KEYS = new Set([");
const RK = new Set(
  [...src.slice(_s, src.indexOf("]);", _s)).matchAll(/"([^"]+)"/g)]
    .map((m) => m[1]).filter((k) => k.includes("::")),
);

// 참조 마커로 인정하는 표기. 선지 번호 ①~⑤ 는 아래에서 따로 떼어낸다.
const MARK = /[㈠-㈭ⓐ-ⓩⒶ-Ⓩ㉠-㉿①-⑳]/g;
const marks = (s) => new Set(String(s || "").match(MARK) || []);
// 선지 맨 앞의 번호는 참조가 아니다.
const dropLead = (s) => String(s || "").replace(/^\s*[①-⑤]\s*/, "");

const rows = [];
for (const yk of Object.keys(data)) {
  for (const sec of ["reading", "literature"]) {
    for (const set of data[yk][sec] || []) {
      const live = RK.has(`${yk}::${set.id}`);
      // B — 지문에 실제로 존재하는 마커
      const B = new Set();
      for (const t of set.sents || []) for (const m of marks(t.t)) B.add(m);
      for (const q of set.questions || []) {
        // <보기> 는 그 안에서 마커를 정의하는 경우가 많다. 정의로 본다.
        const Bq = new Set(B);
        // <보기> 는 객체(표·도식)인 경우가 있다. 문자열만 보면 그 안에서 정의된
        //   마커를 놓쳐 「지문에 없다」로 오판한다(표본 10건 중 5건이 이 원인).
        if (q.bogi) for (const m of marks(typeof q.bogi === "string" ? q.bogi : JSON.stringify(q.bogi))) Bq.add(m);
        // 「학습 활동지」·「탐구 활동」류는 활동지 안에서 마커를 정의한다. 지문 참조가 아니다.
        const inSelf = /학습 활동|독서 활동|탐구 활동|활동지/.test(String(q.t));
        // A — 발문·선지가 참조하는 마커
        const A = new Set(marks(q.t));
        for (const c of q.choices || []) {
          if (/src:|\[\[sym:/.test(c.t || "")) continue;
          for (const m of marks(dropLead(c.t))) A.add(m);
        }
        const diff = inSelf ? [] : [...A].filter((m) => !Bq.has(m));
        if (diff.length)
          rows.push({ yk, setId: set.id, q: q.id, live,
            A: [...A].join(""), B: [...Bq].join(""), diff: diff.join(""),
            stem: String(q.t).slice(0, 45) });
      }
    }
  }
}

const liveN = rows.filter((r) => r.live).length;
console.log(`## (e3) 마커 참조 정합성 — 검출 ${rows.length}건 (LIVE ${liveN} / 비노출 ${rows.length - liveN})\n`);
console.log("| 회차 | 세트 | 문항 | LIVE | 참조 A | 지문 B | 🔴 없는 마커 |");
console.log("|---|---|--:|:-:|---|---|---|");
const show = process.argv.includes("--all") ? rows : rows.slice(0, 40);
for (const r of show)
  console.log(`| ${r.yk} | ${r.setId} | Q${r.q} | ${r.live ? "**LIVE**" : "-"} | ${r.A} | ${r.B || "(없음)"} | **${r.diff}** |`);
if (!process.argv.includes("--all") && rows.length > 40)
  console.log(`\n… 외 ${rows.length - 40}건 (--all 로 전량)`);
