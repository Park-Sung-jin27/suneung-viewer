// marker_range_check.mjs — 발문 마커 범위 ↔ 선지 마커 계열 충족 검사 (발주 bt-1b ⑤)
//
// ⚠ 심사관 사양이 미수신되어 데이터 엔지니어가 독립 작성함. 기준선 "85/5"는 이 구현의
//   수치가 아닐 수 있음. 판정식을 전달받지 않은 상태의 독립 매처이므로 §13⑱(2) 정합.
//
// 판정: 발문(+보기)이 마커를 참조하는 문항에서, 선지가 쓰는 마커가 그 참조 집합 안에 있는가.
//   · 양성(충족)   = 선지 마커 ⊆ 발문·보기 참조 마커      → 정상
//   · 의심(불충족) = 선지에 참조 집합 밖 마커가 등장       → 환각/치환 후보
// 선지 번호(①~⑤ 중 그 문항의 선지 수 이내 + 줄머리)는 마커로 세지 않는다.
// 읽기 전용. 데이터 기록 없음.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { expandMarkerRanges } from "./marker_range.mjs";   // 공용 파서 공유(사각 분기 방지)

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const D = JSON.parse(fs.readFileSync(path.join(ROOT, "public/data/all_data_204.json"), "utf8"));
const dl = fs.readFileSync(path.join(ROOT, "src/dataLoader.js"), "utf8");
const RK = new Set([...dl.match(/const RELEASE_KEYS = new Set\(\[([\s\S]*?)\]\)/)[1]
  .matchAll(/"([^"]+)"/g)].map((m) => m[1]));

const MARKER = /[㉠-㉯ⓐ-ⓩⒶ-Ⓩ①-⑳]/g;
const flat = (v) => { const a = []; (function w(x) {
  if (typeof x === "string") a.push(x);
  else if (Array.isArray(x)) x.forEach(w);
  else if (x && typeof x === "object") Object.values(x).forEach(w);
})(v); return a.join(" "); };

const rows = [];
for (const yk of Object.keys(D)) for (const g of ["reading", "literature"]) for (const s of (D[yk] || {})[g] || []) {
  const live = RK.has(`${yk}::${s.id}`);
  // 본문·annotations 가 제공하는 마커(참조 가능 집합의 상한)
  const bodyMk = new Set();
  for (const sn of s.sents || []) for (const m of (sn.t || "").match(MARKER) || []) bodyMk.add(m);

  for (const q of s.questions || []) {
    const stem = String(q.t || "");
    const bogi = flat(q.bogi);
    const ref = new Set();
    for (const m of expandMarkerRanges(stem)) ref.add(m);
    for (const m of expandMarkerRanges(bogi)) ref.add(m);
    for (const m of stem.match(MARKER) || []) ref.add(m);
    for (const m of bogi.match(MARKER) || []) ref.add(m);
    if (!ref.size) continue;                       // 마커 문항이 아님 → 검사 대상 밖

    const n = (q.choices || []).length;
    const NUMS = "①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳";
    const used = new Set();
    for (const c of q.choices || []) {
      const t = String(c.t || "");
      for (const m of t.match(MARKER) || []) {
        const ni = NUMS.indexOf(m);
        if (ni >= 0 && ni < n && !ref.has(m)) continue;   // 선지 번호로 해석 가능 → 제외
        used.add(m);
      }
    }
    if (!used.size) continue;
    const bad = [...used].filter((m) => !ref.has(m));
    rows.push({ yk, setId: s.id, qid: q.id, live,
      ref: [...ref].join(""), used: [...used].join(""), bad,
      bodyMissing: [...ref].filter((m) => !bodyMk.has(m)) });
  }
}
const ok = rows.filter((r) => !r.bad.length);
const sus = rows.filter((r) => r.bad.length);
console.log(`검사 대상(발문·보기가 마커를 참조하는 문항) : ${rows.length}  [LIVE ${rows.filter((r)=>r.live).length}]`);
console.log(`  ✅ 양성(선지 마커 ⊆ 참조 집합) : ${ok.length}  [LIVE ${ok.filter((r)=>r.live).length}]`);
console.log(`  🔴 의심(참조 집합 밖 마커)      : ${sus.length}  [LIVE ${sus.filter((r)=>r.live).length}]`);
for (const r of sus) console.log(`     ${r.live ? "🔴LIVE  " : "⚪미출시"} ${r.yk}|${r.setId} Q${r.qid}  참조=[${r.ref}] 선지=[${r.used}] ★범위밖=[${r.bad.join("")}]`);
const orphan = rows.filter((r) => r.bodyMissing.length);
console.log(`\n  [부가] 발문 참조 마커가 본문 sent.t 에 없는 문항 : ${orphan.length}  [LIVE ${orphan.filter((r)=>r.live).length}]`);
for (const r of orphan.slice(0, 12)) console.log(`     ${r.live ? "🔴" : "⚪"} ${r.yk}|${r.setId} Q${r.qid} 미정박=[${r.bodyMissing.join("")}]`);
if (orphan.length > 12) console.log(`     외 ${orphan.length - 12}건`);
