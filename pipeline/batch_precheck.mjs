// batch_precheck.mjs — 배치 착수 전 사전 필터 (발주 D-134 ⓪)
//
// ★ 왜 만드나
//   D-132 에서 l20219d 승격 기록까지 만든 뒤 결론줄 결함이 뒤늦게 드러나 되돌렸다.
//   그 낭비를 막는다 — **진단에 들어가기 전에** 「이미 알려진 결함 표지」를 가진 세트를 골라낸다.
//
// 무엇을 보나 (release_diag ⑫⑬ 과 같은 규칙)
//   ⓐ _pat_error              pat 이 비어 있다는 결함 표지
//   ⓑ _ok_analysis_mismatch   ok 와 결론 기호가 어긋난다는 결함 표지
//   ⓒ 결론줄 위반             ok 와 판정 기호가 어긋나거나, 기호가 아예 없음
//
//   _discriminative_validation 은 세지 않는다 — LIVE 세트 포함 526건이 가진 일상 산출물이다.
//   passed:false 인 건수만 참고로 적는다.
//
// ★ 결론줄은 「마지막 줄」이 아니다
//   세트마다 형식이 다르다. A형은 결론이 마지막 줄이고, B형은 「❌ 왜 틀렸나」가 헤더 줄이며
//   설명이 뒤따른다. **마지막으로 판정 기호가 등장하는 줄**을 결론줄로 본다.
//   (D-133 에서 「마지막 줄」로 짰다가 LIVE 19세트를 오탐한 적이 있다)
//
// 진단만 한다. 아무것도 쓰지 않는다.
//
// 사용:
//   node pipeline/batch_precheck.mjs "2019_9월::r20199c" "2019_9월::l20199a" …
//   node pipeline/batch_precheck.mjs --batch B        갭 대장의 배치를 통째로
//   node pipeline/batch_precheck.mjs --all            전 데이터 (대장 검산용)

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const data = JSON.parse(fs.readFileSync(path.join(ROOT, "data-source/all_data_204.json"), "utf8"));
const src = fs.readFileSync(path.join(ROOT, "src/dataLoader.js"), "utf8");
const at = src.indexOf("const RELEASE_KEYS = new Set([");
const REL = new Set([...src.slice(at, src.indexOf("]);", at)).matchAll(/"([^"]+)"/g)]
  .map((m) => m[1]).filter((k) => k.includes("::")));

const flat = (v) => (v == null ? "" : typeof v === "string" ? v : JSON.stringify(v));
const NL = String.fromCharCode(10);
const DEFECT_KEYS = ["_pat_error", "_ok_analysis_mismatch"];

// 갭 대장과 같은 배치 구분 (release_gap.mjs)
const BATCH = {
  A: ["2021_6월", "2021_9월", "2021수능", "2022_6월", "2022_9월", "2022수능", "2022예시"],
  B: ["2019_6월", "2019_9월", "2019수능", "2020_6월", "2020_9월", "2020수능"],
  C: ["2017_6월", "2017_9월", "2017수능", "2018_6월", "2018_9월", "2018수능"],
};

const argv = process.argv.slice(2);
const ALL = argv.includes("--all");
const bIdx = argv.indexOf("--batch");   // 0 도 유효한 위치다 — >0 으로 보면 첫 인자를 놓친다
const batchName = bIdx >= 0 ? argv[bIdx + 1] : null;

// 대상 세트 모으기
const targets = [];
for (const [yk, v] of Object.entries(data))
  for (const sec of ["reading", "literature"])
    for (const s of v[sec] || []) {
      const id = s.setId || s.id;
      const key = `${yk}::${id}`;
      const live = REL.has(key);
      if (ALL) { targets.push({ yk, id, key, s, live }); continue; }
      if (batchName) {
        const yks = BATCH[batchName];
        const inBatch = yks ? yks.includes(yk) : !Object.values(BATCH).some((a) => a.includes(yk));
        if (inBatch && !live) targets.push({ yk, id, key, s, live });
        continue;
      }
      if (argv.includes(key)) targets.push({ yk, id, key, s, live });
    }

if (!targets.length) {
  console.log("대상이 없다. `yearKey::setId` 를 주거나 --batch <A|B|C|D> · --all 을 쓴다.");
  process.exit(1);
}

// 결론줄 = 마지막으로 판정 기호가 등장하는 줄
const conclusionOf = (c) => {
  const t = flat(c.analysis).replace(/\s+$/, "");
  if (!t.trim()) return undefined;              // 해설 자체가 없음
  const lines = t.split(NL);
  for (let i = lines.length - 1; i >= 0; i--)
    if (/[✅❌]/.test(lines[i])) return lines[i].trim();
  return null;                                   // 해설은 있는데 기호가 없음
};

const rows = [];
for (const { yk, id, key, s, live } of targets) {
  const marks = { _pat_error: [], _ok_analysis_mismatch: [] };
  const wrong = [], noMark = [], noAna = [];
  let dvFalse = 0, choices = 0;
  for (const q of s.questions || [])
    for (const c of q.choices || []) {
      choices++;
      const at2 = `Q${q.id}#${c.num}`;
      for (const k of DEFECT_KEYS) if (k in c) marks[k].push(at2);
      if (c._discriminative_validation?.passed === false) dvFalse++;
      const line = conclusionOf(c);
      if (line === undefined) { noAna.push(at2); continue; }
      if (line === null) { noMark.push(at2); continue; }
      const want = c.ok === false ? "❌" : "✅";
      const nope = c.ok === false ? "✅" : "❌";
      if (!line.includes(want) || line.includes(nope)) wrong.push(at2);
    }
  const total = marks._pat_error.length + marks._ok_analysis_mismatch.length
    + wrong.length + noMark.length + noAna.length;
  rows.push({ yk, id, key, live, marks, wrong, noMark, noAna, dvFalse, choices, total });
}

const flagged = rows.filter((r) => r.total);
const clean = rows.filter((r) => !r.total);

console.log(`# 배치 사전 필터 — ${rows.length}세트`);
console.log("");
console.log(`> 생성: \`node pipeline/batch_precheck.mjs ${argv.join(" ")}\``);
console.log(`> 진단 착수 전에 **이미 알려진 결함 표지**를 가진 세트를 골라낸다. 판정은 원본 대조로만 한다.`);
console.log("");
console.log("| 항목 | 수 |");
console.log("|---|--:|");
console.log(`| 검사한 세트 | ${rows.length} (LIVE ${rows.filter((r) => r.live).length}) |`);
console.log(`| **표지·위반 보유** | **${flagged.length}** (LIVE ${flagged.filter((r) => r.live).length}) |`);
console.log(`| 깨끗함 | ${clean.length} |`);
console.log("");

if (flagged.length) {
  console.log("## 표지·위반 보유 세트");
  console.log("");
  console.log("| 회차 | 세트 | 노출 | _pat_error | _ok_mismatch | 결론줄 위반 | 위치 |");
  console.log("|---|---|---|--:|--:|--:|---|");
  for (const r of flagged.sort((a, b) => (b.live - a.live) || a.yk.localeCompare(b.yk))) {
    const where = [
      ...r.marks._pat_error.map((x) => `${x}(pat_error)`),
      ...r.marks._ok_analysis_mismatch.map((x) => `${x}(ok_mismatch)`),
      ...r.wrong.map((x) => `${x}(기호어긋남)`),
      ...r.noMark.map((x) => `${x}(기호없음)`),
      ...r.noAna.map((x) => `${x}(해설없음)`),
    ];
    console.log(`| ${r.yk} | \`${r.id}\` | ${r.live ? "🔴" : "—"} | ${r.marks._pat_error.length} | `
      + `${r.marks._ok_analysis_mismatch.length} | ${r.wrong.length + r.noMark.length + r.noAna.length} | ${where.join(" · ")} |`);
  }
  console.log("");
}

if (clean.length && !ALL) {
  console.log("## 깨끗한 세트 — 진단 바로 착수 가능");
  console.log("");
  for (const r of clean.sort((a, b) => a.yk.localeCompare(b.yk)))
    console.log(`- \`${r.key}\` (선지 ${r.choices}${r.dvFalse ? ` · _discriminative_validation passed:false ${r.dvFalse}건` : ""})`);
  console.log("");
}

console.log("> ⚠ 이 도구가 통과시켰다고 결함이 없다는 뜻은 아니다 — **이미 표지가 남은 것**만 본다.");
console.log("> 구간 표시·마커 소실·근거 누락은 `release_diag` 13축이 따로 본다.");
