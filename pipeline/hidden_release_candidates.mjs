// hidden_release_candidates.mjs — 비노출 세트 출시 후보 재산출 (발주 ft-A · 2026-08-17)
//
// ★ 후보 선정 기준을 이 스크립트가 만들지 않는다(§13⑱).
//   기준은 발주 ft 가 정한 「quality_gate 의 CRITICAL 0」 하나뿐이다.
//   나머지 열(WARNING · annotations · pat · cs_ids · needsReview)은
//   판정이 아니라 참고 수치이며, 후보 포함/제외에 쓰지 않는다.
//
// ★ 읽기 전용이다. all_data_204.json · annotations.json · dataLoader.js 를 쓰지 않는다.
//
// 선행 실행 (전수 353세트 · 데이터 무수정):
//   node pipeline/quality_gate.mjs --report
// 그 다음:
//   node pipeline/hidden_release_candidates.mjs

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const P = (r) => path.join(ROOT, r);

const data = JSON.parse(fs.readFileSync(P("data-source/all_data_204.json"), "utf8"));
const ann = JSON.parse(fs.readFileSync(P("public/data/annotations.json"), "utf8"));
const report = JSON.parse(fs.readFileSync(P("pipeline/quality_report.json"), "utf8"));

// RELEASE_KEYS — 기존 파서 6종과 동일 방식
const src = fs.readFileSync(P("src/dataLoader.js"), "utf8");
const _s = src.indexOf("const RELEASE_KEYS = new Set([");
const _blk = src.slice(_s, src.indexOf("]);", _s));
const RELEASE_KEYS = new Set(
  [..._blk.matchAll(/"([^"]+)"/g)].map((m) => m[1]).filter((k) => k.includes("::")),
);

const REQUIRES_CS = ["R1", "R2", "R4", "L1", "L2", "L4", "L5"];

// ── 세트 인덱스 ─────────────────────────────────────────────────────
const sets = new Map(); // "yk::id" -> rec
const idsByYear = new Map();
for (const yk of Object.keys(data)) {
  const ids = new Set();
  for (const sec of ["reading", "literature"]) {
    for (const s of data[yk][sec] || []) {
      ids.add(s.id);
      let choices = 0,
        patMissing = 0,
        csHave = 0,
        needsReview = 0,
        csRequiredMissing = 0;
      for (const q of s.questions || []) {
        if (q.needsReview === true) needsReview++;
        for (const c of q.choices || []) {
          choices++;
          const noPat = c.pat === undefined || c.pat === null || c.pat === "";
          if (c.ok !== true && noPat) patMissing++;
          const n = Array.isArray(c.cs_ids) ? c.cs_ids.length : 0;
          if (n > 0) csHave++;
          else if (c.ok === true) csRequiredMissing++;
          else if (REQUIRES_CS.includes(c.pat)) csRequiredMissing++;
        }
      }
      const list = ann?.[yk]?.[s.id];
      sets.set(`${yk}::${s.id}`, {
        yk,
        id: s.id,
        section: sec,
        title: s.title || "",
        range: s.range || "",
        questions: (s.questions || []).length,
        choices,
        live: RELEASE_KEYS.has(`${yk}::${s.id}`),
        critical: 0,
        warning: 0,
        warnTypes: new Map(),
        annHas: Array.isArray(list) && list.length > 0,
        patMissing,
        csHave,
        csRequiredMissing,
        needsReview,
      });
    }
  }
  idsByYear.set(yk, ids);
}

// ── 게이트 findings 를 세트에 귀속 ──────────────────────────────────
let unattributed = 0;
function attribute(f) {
  const ids = idsByYear.get(f.yearKey);
  if (!ids || !f.loc) return null;
  for (const tok of String(f.loc).split(/[\s:,()[\]]+/)) if (ids.has(tok)) return tok;
  return null;
}
for (const [sev, arr] of [
  ["critical", report.critical || []],
  ["warning", report.warning || []],
]) {
  for (const f of arr) {
    const id = attribute(f);
    if (!id) {
      unattributed++;
      continue;
    }
    const rec = sets.get(`${f.yearKey}::${id}`);
    if (!rec) {
      unattributed++;
      continue;
    }
    if (sev === "critical") rec.critical++;
    else {
      rec.warning++;
      rec.warnTypes.set(f.type, (rec.warnTypes.get(f.type) || 0) + 1);
    }
  }
}

// ── LIVE 세트당 WARNING 평균 (A-3 기준선) ──────────────────────────
const liveAll = [...sets.values()].filter((r) => r.live);
const liveWarnTotal = liveAll.reduce((a, r) => a + r.warning, 0);
const liveAvg = liveWarnTotal / liveAll.length;

// ── A-1: 비노출 중 CRITICAL 0 ──────────────────────────────────────
const hidden = [...sets.values()].filter((r) => !r.live);
const cand = hidden
  .filter((r) => r.critical === 0)
  .sort((a, b) => a.yk.localeCompare(b.yk) || a.id.localeCompare(b.id));

// ── 출력 ───────────────────────────────────────────────────────────
const warnTop = (m) => {
  const e = [...m.entries()].sort((a, b) => b[1] - a[1]);
  return e.length ? e.map(([t, n]) => `${t} ${n}`).join(" · ") : "—";
};
const pct = (n, d) => (d ? `${((n / d) * 100).toFixed(1)}%` : "—");

console.log(`[ft-A1] 비노출 ${hidden.length}세트 중 CRITICAL 0 = ${cand.length}세트`);
console.log(
  `[ft-A3] LIVE ${liveAll.length}세트 WARNING 합계 ${liveWarnTotal} → 세트당 평균 ${liveAvg.toFixed(2)}건`,
);
console.log(`[ft] 게이트 findings 귀속 실패 = ${unattributed}건`);
console.log("");
console.log(
  "| # | yearKey | setId | 제목 | range | 문항 | 선지 | WARN | WARNING 유형별 | ann | pat누락 | cs보유율 | cs결손 | needsRev | 평균이하 |",
);
console.log("|--:|---|---|---|---|--:|--:|--:|---|:-:|--:|--:|--:|--:|:-:|");
cand.forEach((r, i) => {
  console.log(
    `| ${i + 1} | ${r.yk} | ${r.id} | ${r.title} | ${r.range} | ${r.questions} | ${r.choices} | ${r.warning} | ${warnTop(r.warnTypes)} | ${r.annHas ? "O" : "—"} | ${r.patMissing} | ${pct(r.csHave, r.choices)} | ${r.csRequiredMissing} | ${r.needsReview} | ${r.warning <= liveAvg ? "✅" : ""} |`,
  );
});

const below = cand.filter((r) => r.warning <= liveAvg);
console.log("");
console.log(`[ft-A3] 후보 중 WARNING 이 LIVE 평균(${liveAvg.toFixed(2)}) 이하 = ${below.length}세트`);
const byYk = new Map();
for (const r of cand) byYk.set(r.yk, (byYk.get(r.yk) || 0) + 1);
console.log(
  `[ft-A1] 회차별 후보 수: ${[...byYk.entries()].map(([k, v]) => `${k} ${v}`).join(" · ")}`,
);
console.log("");
console.log("[ft-B1] 승인 시 RELEASE_KEYS 에 추가할 복합키 (참고 · 아직 수정하지 않음)");
for (const r of cand) console.log(`  "${r.yk}::${r.id}",`);
