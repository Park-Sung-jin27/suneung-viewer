// d196_marker_gate_compare.mjs — checkMarkerAnchored 수정 전/후 판정 비교 + fixture 회귀 (발주 D-196)
//
// 게이트 코드가 아니라 **검증 도구**다. 아무것도 쓰지 않는다(읽기 전용).
//   ① fixture 회귀 — 실패 케이스는 실패 유지, 통과 케이스는 통과 유지
//   ② 전 세트 skip 판정 전/후 비교 — 변화가 l20279b 하나뿐임을 증명한다
//
// 「전」은 수정 전 함수를 이 파일 안에 그대로 복제해 쓴다. 파일을 되돌려 두 번
// 실행하는 방식은 실행 사이에 데이터가 바뀔 여지가 있어 쓰지 않는다.
//
// 사용: node pipeline/d196_marker_gate_compare.mjs

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { checkMarkerAnchored } from "./step3_analysis.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// ── 「전」 판정 — 수정 전 원본 그대로 (정박 원천 = sents + q.bogi) ──────────
const _flat = (v) => { const a = []; (function w(x) {
  if (typeof x === "string") a.push(x);
  else if (Array.isArray(x)) x.forEach(w);
  else if (x && typeof x === "object") Object.values(x).forEach(w);
})(v); return a.join("\n"); };
function checkMarkerAnchored_BEFORE(set) {
  const MARK = /[ⓐ-ⓔ㉠-㉤㉮-㉲]/g;
  const anchored = new Set();
  for (const sn of set?.sents || [])
    for (const m of String(sn.t || "").match(MARK) || []) anchored.add(m);
  for (const q of set?.questions || [])
    for (const m of _flat(q.bogi).match(MARK) || []) anchored.add(m);
  const missing = new Map();
  for (const q of set?.questions || []) {
    const refs = new Set();
    const rm = String(q.t || "").match(/([ⓐ-ⓔ㉠-㉤㉮-㉲])\s*[~～∼]\s*([ⓐ-ⓔ㉠-㉤㉮-㉲])/);
    if (rm) for (const pool of ["ⓐⓑⓒⓓⓔ", "㉠㉡㉢㉣㉤", "㉮㉯㉰㉱㉲"])
      if (pool.includes(rm[1]) && pool.includes(rm[2])) {
        pool.slice(pool.indexOf(rm[1]), pool.indexOf(rm[2]) + 1).split("").forEach((x) => refs.add(x));
        break;
      }
    for (const m of String(q.t || "").match(MARK) || []) refs.add(m);
    for (const c of q.choices || []) for (const m of String(c.t || "").match(MARK) || []) refs.add(m);
    for (const r of refs) if (!anchored.has(r)) {
      if (!missing.has(r)) missing.set(r, []);
      missing.get(r).push(q.id);
    }
  }
  return { ok: missing.size === 0, reasons: [...missing.entries()].map(([m, qs]) => `${m}(Q${[...new Set(qs)].join(",")})`) };
}

console.log("# checkMarkerAnchored 수정 전/후 비교 (D-196)");
console.log("");

// ── ① fixture 회귀 ──────────────────────────────────────────────────────
const FX = JSON.parse(fs.readFileSync(path.join(ROOT, "pipeline/fixtures/step3_marker_order.json"), "utf8"));
console.log("## ① fixture 회귀 — `pipeline/fixtures/step3_marker_order.json`");
console.log("");
console.log("| 케이스 | 기대 | 전 | 후 | 판정 |");
console.log("|---|---|---|---|---|");
let fxFail = 0;
for (const c of FX.cases) {
  const b = checkMarkerAnchored_BEFORE(c.set), a = checkMarkerAnchored(c.set);
  const okB = b.ok === c.expect.ok, okA = a.ok === c.expect.ok;
  const missOk = (c.expect.missingIncludes || []).every((m) => a.reasons.some((r) => r.startsWith(m)));
  const pass = okB && okA && missOk && b.ok === a.ok;
  if (!pass) fxFail++;
  console.log(`| \`${c.name}\` | ok=${c.expect.ok} | ok=${b.ok} | ok=${a.ok} \`${a.reasons.join(" ") || "—"}\` | ${pass ? "✅ 유지" : "🔴 변화"} |`);
}
console.log("");
console.log(fxFail ? `## 🔴 fixture ${fxFail}건 실패` : "✅ fixture 2/2 — 전·후 판정 동일, 기대값 일치");
console.log("");

// ── ② 전 세트 판정 비교 ─────────────────────────────────────────────────
const SRC = [
  ["all_data_204 (LIVE·비노출 전부)", path.join(ROOT, "public/data/all_data_204.json"), "byYear"],
  ["step2_2027_9월 (l20279b 원천)", path.join(ROOT, "pipeline/test_data/step2_2027_9월.json"), "flat"],
];
const rows = [];
let total = 0;
for (const [label, file, shape] of SRC) {
  const j = JSON.parse(fs.readFileSync(file, "utf8"));
  const buckets = shape === "byYear"
    ? Object.entries(j).flatMap(([yk, v]) => ["reading", "literature"].map((s) => [yk, v?.[s] || []]))
    : ["reading", "literature"].map((s) => ["2027_9월", j?.[s] || []]);
  for (const [yk, arr] of buckets) for (const set of arr) {
    const s = { ...set, id: set.id || set.setId };
    total++;
    const b = checkMarkerAnchored_BEFORE(s), a = checkMarkerAnchored(s);
    if (b.ok !== a.ok || b.reasons.join("|") !== a.reasons.join("|"))
      rows.push({ label, key: `${yk}::${s.id}`, b, a });
  }
}
console.log(`## ② 전 세트 skip 판정 비교 — 검사 ${total}세트`);
console.log("");
if (!rows.length) console.log("🔴 변화 0건 — l20279b 도 안 바뀌었다면 수정이 듣지 않은 것이다");
else {
  console.log("| 세트 | 원천 | 전 | 후 |");
  console.log("|---|---|---|---|");
  for (const r of rows)
    console.log(`| \`${r.key}\` | ${r.label} | ${r.b.ok ? "통과" : "🔴skip"} \`${r.b.reasons.join(" ") || "—"}\` | ${r.a.ok ? "✅통과" : "🔴skip"} \`${r.a.reasons.join(" ") || "—"}\` |`);
}
console.log("");
const others = rows.filter((r) => !r.key.endsWith("::l20279b"));
const target = rows.filter((r) => r.key.endsWith("::l20279b"));
console.log(`- 판정이 바뀐 세트: **${rows.length}건**`);
console.log(`- 그중 l20279b: ${target.length}건 (skip→통과 ${target.filter((r) => !r.b.ok && r.a.ok).length}건)`);
console.log(`- **l20279b 외 변화: ${others.length}건**`);
console.log("");
const bad = fxFail || others.length || target.length !== 1 || !target[0]?.a.ok;
console.log(bad ? "## 🔴 조건 미충족 — 승인 요청 불가" : "## ✅ l20279b 하나만 skip→통과 · 나머지 전 세트 판정 불변 · fixture 유지");
process.exit(bad ? 1 : 0);
