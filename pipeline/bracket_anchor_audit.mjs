// bracket_anchor_audit.mjs — [A]~[F] bracket 정박 실태 재집계 (발주 D-104 ⓪)
//
// 심사관과 분류가 어긋나 기준을 명시적으로 다시 센다.
//   · LIVE 판정은 `src/dataLoader.js` 의 RELEASE_KEYS(yearKey::setId 복합키) 기준.
//   · 「기존/재추출」은 재추출 43세트 여부(pipeline/reextract/step3) 기준.
//     둘은 **다른 축**이다 — 재추출 43세트는 RELEASE_KEYS 에 없어 전부 비노출이다.
//
// 분모를 넷으로 나눠 각각 보고한다(심사관 계산과 대조하기 위함).
//   A. 문항이 [A]~[F] 를 **참조**하는 세트
//   B. workTag [A-F] 단독 문장이 있고 bracket 이 **없는** 세트 = 결함
//   C. bracket annotation 을 가진 세트
//   D. workTag 도 bracket 도 없는 세트
//
// 사용: node pipeline/bracket_anchor_audit.mjs [--live]

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = path.join(ROOT, "data-source/all_data_204.json");
const STEP3 = path.join(ROOT, "pipeline/reextract/step3");
const ONLY_LIVE = process.argv.includes("--live");

const RELEASE = (() => {
  const src = fs.readFileSync(path.join(ROOT, "src/dataLoader.js"), "utf8");
  const at = src.indexOf("const RELEASE_KEYS = new Set([");
  const end = src.indexOf("]);", at);
  const keys = [...src.slice(at, end).matchAll(/"([^"]+)"/g)].map((m) => m[1]).filter((k) => k.includes("::"));
  if (!keys.length) { console.error("🔴 RELEASE_KEYS 가 비었다 — 중단"); process.exit(1); }
  return new Set(keys);
})();

const reextracted = new Set();
for (const d of fs.readdirSync(STEP3)) {
  const p = path.join(STEP3, d, "step4_result.json");
  if (!fs.existsSync(p)) continue;
  const j = JSON.parse(fs.readFileSync(p, "utf8"));
  for (const s of [...(j.reading || []), ...(j.literature || [])]) reextracted.add(`${d}::${s.id}`);
}

const MK = /\[[A-F]\]/g;
const TAG = /^\[([A-F])\]$/;
const data = JSON.parse(fs.readFileSync(DATA, "utf8"));
const rows = [];

for (const [yk, v] of Object.entries(data))
  for (const sec of ["reading", "literature"])
    for (const s of v[sec] || []) {
      const key = `${yk}::${s.id}`;
      const refs = new Set();
      for (const q of s.questions || []) {
        const parts = [String(q.t ?? "")];
        if (typeof q.bogi === "string") parts.push(q.bogi);
        else if (q.bogi && typeof q.bogi === "object")
          for (const x of Object.values(q.bogi)) if (typeof x === "string") parts.push(x);
        for (const c of q.choices || []) parts.push(String(c.t ?? ""));
        for (const m of parts.join(" ").match(MK) || []) refs.add(m);
      }
      if (!refs.size) continue;
      const tags = (s.sents || []).filter((x) => TAG.test(String(x.t ?? "").trim()));
      const brackets = (s.annotations || []).filter((a) => a && a.type === "bracket");
      rows.push({
        yk, sid: s.id, key,
        live: RELEASE.has(key),
        zone: reextracted.has(key) ? "재추출" : "기존",
        refs: [...refs].sort().join(""),
        tags: tags.map((x) => String(x.t).trim()).join(""),
        nTags: tags.length, nBr: brackets.length,
        brLabels: brackets.map((b) => b.label).join(""),
      });
    }

const need = rows.filter((r) => r.nTags > 0 && r.nBr === 0);
const okBr = rows.filter((r) => r.nBr > 0);
const noTag = rows.filter((r) => r.nTags === 0 && r.nBr === 0);

console.log(`## 분모 정의별 집계\n`);
console.log(`| 구분 | 세트 |`);
console.log(`|---|--:|`);
console.log(`| A. 문항이 [A]~[F] 를 참조 | ${rows.length} |`);
console.log(`| B. workTag 있고 bracket 없음 (**결함**) | **${need.length}** |`);
console.log(`| C. bracket annotation 보유 | ${okBr.length} |`);
console.log(`| D. workTag 도 bracket 도 없음 | ${noTag.length} |`);

const liveNeed = need.filter((r) => r.live);
console.log(`\n## 결함 ${need.length}세트 — 노출 × 구간 교차\n`);
console.log(`| | LIVE | 비노출 | 계 |`);
console.log(`|---|--:|--:|--:|`);
for (const z of ["기존", "재추출"]) {
  const a = need.filter((r) => r.zone === z);
  console.log(`| ${z} | ${a.filter((r) => r.live).length} | ${a.filter((r) => !r.live).length} | ${a.length} |`);
}
console.log(`| **계** | **${liveNeed.length}** | ${need.length - liveNeed.length} | ${need.length} |`);

console.log(`\n## 결함 전건\n`);
console.log(`| 노출 | 구간 | 회차 | 세트 | 참조 | workTag |`);
console.log(`|---|---|---|---|---|---|`);
for (const r of (ONLY_LIVE ? liveNeed : need))
  console.log(`| ${r.live ? "🔴 LIVE" : "비노출"} | ${r.zone} | ${r.yk} | \`${r.sid}\` | ${r.refs} | ${r.tags} |`);

console.log(`\n## 참고 — bracket 보유 ${okBr.length}세트 중 라벨이 참조와 어긋나는 것`);
let mismatch = 0;
for (const r of okBr) {
  const want = new Set(r.refs.match(/[A-F]/g) || []);
  const have = new Set(r.brLabels.split(""));
  const miss = [...want].filter((x) => !have.has(x));
  if (miss.length) {
    mismatch++;
    console.log(`   ${r.live ? "🔴 LIVE" : "비노출"} ${r.yk} \`${r.sid}\` 참조 ${r.refs} · bracket [${r.brLabels}] → 빠진 것 [${miss.join("")}]`);
  }
}
if (!mismatch) console.log(`   (없음)`);
