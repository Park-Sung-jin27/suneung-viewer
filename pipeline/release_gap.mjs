// release_gap.mjs — 노출 갭 목록 (발주 D-128 ⓪)
//
// RELEASE_KEYS 와 all_data 를 **복합 키 `yearKey::setId`** 로 대조한다.
// setId 는 연도 안에서만 고유하다(D-113 ①) — 2014~2016 A/B형은 같은 id 가 여러 연도에 있어
// 문자열 대조로는 갭이 부정확해진다.
//
// 진단만 한다. 아무것도 쓰지 않는다.
//
// 사용: node pipeline/release_gap.mjs [--md]

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const data = JSON.parse(fs.readFileSync(path.join(ROOT, "public/data/all_data_204.json"), "utf8"));
const src = fs.readFileSync(path.join(ROOT, "src/dataLoader.js"), "utf8");
const at = src.indexOf("const RELEASE_KEYS = new Set([");
const REL = new Set([...src.slice(at, src.indexOf("]);", at)).matchAll(/"([^"]+)"/g)]
  .map((m) => m[1]).filter((k) => k.includes("::")));

// 회차를 배치로 묶는다. 최근 회차일수록 앞 배치다.
const BATCH = [
  ["A", "2021~2022 잔여", ["2021_6월", "2021_9월", "2021수능", "2022_6월", "2022_9월", "2022수능", "2022예시"]],
  ["B", "2019~2020", ["2019_6월", "2019_9월", "2019수능", "2020_6월", "2020_9월", "2020수능"]],
  ["C", "2017~2018", ["2017_6월", "2017_9월", "2017수능", "2018_6월", "2018_9월", "2018수능"]],
  ["D", "2014~2016 (A/B형)", null],   // 나머지 전부
];
// 원본 시험지 PDF 에 텍스트층이 없는 회차 — 좌표 대조가 원리적으로 불가능하다.
//   실측: 2014수능A 앞 6면 211자 · 2014수능B 193자. 같은 2014 라도 6월·9월은 11,000자대다.
//   D-112 가 「판독 불가 3세트」로 기록한 것은 그 시점의 구간 표시 작업 대상만 센 것이고,
//   원본 대조 불가 범위는 이 두 회차 **전체**다.
const SCAN_UNREADABLE = new Set(["2014수능A", "2014수능B"]);
// D-112 가 명시적으로 「판독 불가」로 남긴 3세트 (구간 표시 트랙)
const D112_HELD = new Set(["2014수능A::l2014c", "2014수능B::l2014bB", "2014수능B::l2014dB"]);

const rows = [];
for (const [yk, v] of Object.entries(data))
  for (const sec of ["reading", "literature"])
    for (const s of v[sec] || []) {
      const setId = s.setId || s.id;
      const key = `${yk}::${setId}`;
      rows.push({
        yk, setId, key, sec,
        live: REL.has(key),
        qn: (s.questions || []).length,
        sn: (s.sents || []).length,
      });
    }

const batchOf = (yk) => {
  for (const [name, , yks] of BATCH) if (yks && yks.includes(yk)) return name;
  return "D";
};

// 문자열 대조가 왜 부정확한지 — 같은 setId 가 여러 연도에 걸친 경우를 센다
const dupe = new Map();
for (const r of rows) {
  if (!dupe.has(r.setId)) dupe.set(r.setId, []);
  dupe.get(r.setId).push(r.yk);
}
const dupeIds = [...dupe.entries()].filter(([, ys]) => ys.length > 1);
const dupeGapRisk = rows.filter((r) => !r.live && (dupe.get(r.setId) || []).length > 1
  && (dupe.get(r.setId) || []).some((y) => REL.has(`${y}::${r.setId}`)));

const gap = rows.filter((r) => !r.live);
const out = [];
out.push(`# 노출 갭 목록 — 복합 키 대조 (D-128 ⓪)`);
out.push(``);
out.push(`> 생성: \`node pipeline/release_gap.mjs --md\``);
out.push(`> **\`yearKey::setId\` 복합 키로 대조한다** — setId 는 연도 안에서만 고유하다(D-113 ①).`);
out.push(``);
out.push(`| 항목 | 수 |`);
out.push(`|---|--:|`);
out.push(`| all_data 전체 세트 | ${rows.length} |`);
out.push(`| RELEASE_KEYS (노출) | ${rows.filter((r) => r.live).length} |`);
out.push(`| **갭 (미노출)** | **${gap.length}** |`);
out.push(``);
out.push(`RELEASE_KEYS 원본 항목 수는 ${REL.size} 건이다.`);
out.push(``);
out.push(`## setId 문자열 대조가 부정확한 이유`);
out.push(``);
out.push(`같은 \`setId\` 가 둘 이상의 회차에 있는 경우가 **${dupeIds.length}건**이다.`);
out.push(`그중 **${dupeGapRisk.length}개 세트**는 「같은 id 가 다른 회차에서는 노출 중」이라,`);
out.push(`문자열로만 대조하면 노출된 것으로 잘못 세어 갭에서 빠진다.`);
if (dupeGapRisk.length) {
  out.push(``);
  out.push(`| 회차 | setId | 같은 id 를 쓰는 회차 |`);
  out.push(`|---|---|---|`);
  for (const r of dupeGapRisk.slice(0, 24))
    out.push(`| ${r.yk} | \`${r.setId}\` | ${(dupe.get(r.setId) || []).map((y) => REL.has(`${y}::${r.setId}`) ? `**${y}**🔴` : y).join(" · ")} |`);
  if (dupeGapRisk.length > 24) out.push(`| … | | 외 ${dupeGapRisk.length - 24}건 |`);
}
out.push(``);

// 배치별 집계
const byBatch = {};
for (const r of gap) {
  const b = batchOf(r.yk);
  (byBatch[b] = byBatch[b] || []).push(r);
}
out.push(`## 배치 분류`);
out.push(``);
out.push(`| 배치 | 범위 | 갭 세트 | 회차 수 |`);
out.push(`|---|---|--:|--:|`);
for (const [name, label] of BATCH) {
  const g = byBatch[name] || [];
  const yks = [...new Set(g.map((r) => r.yk))];
  out.push(`| ${name} | ${label} | ${g.length} | ${yks.length} |`);
}
out.push(`| | **합계** | **${gap.length}** | |`);
out.push(``);

for (const [name, label] of BATCH) {
  const g = byBatch[name] || [];
  if (!g.length) continue;
  out.push(`### 배치 ${name} — ${label} (${g.length}세트)`);
  out.push(``);
  out.push(`| 회차 | 세트 | 영역 | 문항 | 문장 | 비고 |`);
  out.push(`|---|---|---|--:|--:|---|`);
  const yks = [...new Set(g.map((r) => r.yk))].sort();
  for (const yk of yks)
    for (const r of g.filter((x) => x.yk === yk))
      out.push(`| ${yk} | \`${r.setId}\` | ${r.sec === "reading" ? "독서" : "문학"} | ${r.qn} | ${r.sn} | ${SCAN_UNREADABLE.has(yk) ? (D112_HELD.has(r.key) ? "**검수 불가 — 제외 상신 (스캔 PDF · D-112 명시 3세트)**" : "**검수 불가 — 제외 상신 (스캔 PDF)**") : ""} |`);
  out.push(``);
}

const unread = gap.filter((r) => SCAN_UNREADABLE.has(r.yk));
out.push(`## 검수 불가 — 제외 상신`);
out.push(``);
out.push(`2014수능 A·B 는 원본 시험지 PDF 에 **텍스트층이 없다**(스캔본). 좌표 대조가 원리적으로 불가능하다.`);
out.push(``);
out.push(`실측 — 앞 6면 추출 글자 수:`);
out.push(``);
out.push(`| 회차 | 글자 수 | 판정 |`);
out.push(`|---|--:|---|`);
out.push(`| 2014_6월A | 11,024 | ✅ 텍스트층 있음 |`);
out.push(`| 2014_6월B | 11,926 | ✅ |`);
out.push(`| 2014_9월A | 13,167 | ✅ |`);
out.push(`| 2014_9월B | 11,823 | ✅ |`);
out.push(`| **2014수능A** | **211** | 🔴 스캔본 |`);
out.push(`| **2014수능B** | **193** | 🔴 스캔본 |`);
out.push(``);
out.push(`⚠ D-112 가 「판독 불가 3세트」(\`l2014c\` · \`l2014bB\` · \`l2014dB\`)로 기록한 것은`);
out.push(`**그 시점의 구간 표시 작업 대상만** 센 것이다. 텍스트층 부재는 회차 전체에 걸리므로`);
out.push(`원본 대조가 불가능한 범위는 이 두 회차 전부다.`);
out.push(`해당 갭 세트는 **${unread.length}건**이다.`);
if (unread.length) {
  out.push(``);
  for (const r of unread) out.push(`- \`${r.yk}::${r.setId}\` (${r.sec === "reading" ? "독서" : "문학"} · 문항 ${r.qn})`);
}
out.push(``);
out.push(`검수 가능한 갭은 **${gap.length - unread.length}세트**다.`);
out.push(``);
out.push(`### 판정 — 웨이브 3 범위에서 제외 (D-130 ⓪ 대표 승인)`);
out.push(``);
out.push(`이 ${unread.length}세트는 **스캔본·원본 대조 불가**로 보류한다.`);
out.push(`텍스트층이 있는 PDF 를 확보하면 재개한다 — 폐기가 아니라 보류다.`);
out.push(``);
out.push(`OCR 로 대체하지 않는다(§13⑬ — OCR 결과를 원문으로 삼지 않는다).`);
out.push(``);
out.push(`**웨이브 3 범위 = ${gap.length - unread.length}세트**다.`);

if (process.argv.includes("--md")) console.log(out.join("\n"));
else console.log(out.slice(0, out.indexOf("## setId 문자열 대조가 부정확한 이유")).join("\n") + "\n(전체 표는 --md 로)");
