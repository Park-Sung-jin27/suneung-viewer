// question_roster_audit.mjs — 「문항 대장」 축 (발주 D-151 ①)
//
// ★ 왜 만드나
//   `answer_key_audit` 은 **정답표에 있는 문항을 데이터에서 찾아** ok 를 맞춘다.
//   데이터에 그 문항이 없으면 맞출 게 없으니 **조용히 건너뛴다.**
//   그래서 문항이 통째로 빠져도 「정답 불일치 0건」이 뜬다. 그 빈자리를 메운다.
//
//   정답표(`answer_key.json`)는 원본 정답 PDF 에서 뽑은 것이라
//   **문항 번호 집합을 원본 대조와 같은 값으로 쓸 수 있다.** API 0.
//
// 무엇을 보나
//   ⓐ 구간 누락   정답표엔 있는데 데이터에 없는 번호가 **연속 2개 이상** → 지문 세트 하나가 통째로 없다 🔴
//   ⓑ 단발 누락   빠진 번호가 하나뿐 → 지문 없는 단독 문항(문법·화법)일 수 있다 ⚠ 원본 대조 필요
//   ⓒ 유령 문항   데이터엔 있는데 정답표에 없는 번호 🔴
//   ⓓ 중복 번호   같은 회차에서 문항 번호가 두 번 나온다 🔴
//
// ★ 비교 범위는 「데이터가 담당하는 구간」으로 좁힌다 (S-13 · 오탐 예방)
//   2021학년도 이전은 국어가 45문항이지만 뷰어는 **독서·문학만** 담는다.
//   정답표 45개를 그대로 대면 31개 회차가 통째로 걸린다.
//   그래서 **데이터 문항 번호의 최소~최대 구간 안에서만** 대조한다.
//   구간 밖(선택과목·화법작문 앞머리)은 「담당 밖」으로 따로 적는다.
//
// ★ 실물 확인 (S-13) — 이 규칙으로 49회차를 돌려 걸린 2건을 원본 PDF 로 봤다
//   · 2017_9월 26~29 누락 → 원본에 `[25～30] 콘크리트` 지문이 있다. **진짜 누락** 🔴
//   · 2014_6월A 30번 누락 → 원본 30번은 「학생의 독서 과정」 **단독 문항**이라 미수록이 자연스럽다 ⚠
//   두 성격이 달라 ⓐ(연속)와 ⓑ(단발)로 등급을 갈랐다.
//
// 진단만 한다. 아무것도 쓰지 않는다.
//
// 사용:
//   node pipeline/question_roster_audit.mjs                 전 회차
//   node pipeline/question_roster_audit.mjs --year 2027_9월  회차 지정 (스프린트 게이트)
//   node pipeline/question_roster_audit.mjs --live           LIVE 세트를 가진 회차만

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const data = JSON.parse(fs.readFileSync(path.join(ROOT, "public/data/all_data_204.json"), "utf8"));
const akey = JSON.parse(fs.readFileSync(path.join(ROOT, "pipeline/answer_key.json"), "utf8"));
const src = fs.readFileSync(path.join(ROOT, "src/dataLoader.js"), "utf8");
const at = src.indexOf("const RELEASE_KEYS = new Set([");
const REL = new Set([...src.slice(at, src.indexOf("]);", at)).matchAll(/"([^"]+)"/g)]
  .map((m) => m[1]).filter((k) => k.includes("::")));

const argv = process.argv.slice(2);
const LIVE_ONLY = argv.includes("--live");
const yi = argv.indexOf("--year");
const YEAR = yi >= 0 ? argv[yi + 1] : null;

// 연속 번호를 덩어리로 묶는다 — [26,27,28,29,14] → [[26,27,28,29],[14]]
const runs = (nums) => {
  const out = [];
  for (const n of [...nums].sort((a, b) => a - b)) {
    const last = out[out.length - 1];
    if (last && n === last[last.length - 1] + 1) last.push(n);
    else out.push([n]);
  }
  return out;
};
const fmt = (r) => (r.length === 1 ? `${r[0]}` : `${r[0]}~${r[r.length - 1]}`);

const rows = [];
for (const [yk, v] of Object.entries(data)) {
  if (YEAR && yk !== YEAR) continue;
  const ids = [], setOf = new Map(), live = [];
  for (const sec of ["reading", "literature"])
    for (const s of v[sec] || []) {
      const setId = s.setId || s.id;
      if (REL.has(`${yk}::${setId}`)) live.push(setId);
      for (const q of s.questions || []) { ids.push(Number(q.id)); (setOf.get(Number(q.id)) || setOf.set(Number(q.id), []).get(Number(q.id))).push(setId); }
    }
  if (LIVE_ONLY && !live.length) continue;

  const uniq = [...new Set(ids)].sort((a, b) => a - b);
  const dup = [...setOf].filter(([, v2]) => v2.length > 1).map(([n, v2]) => `${n}(${v2.join(" ")})`);
  const key = akey[yk] ? Object.keys(akey[yk].ans || {}).map(Number).sort((a, b) => a - b) : null;

  if (!uniq.length) { rows.push({ yk, live: live.length, note: "세트 없음", keyN: key ? key.length : null }); continue; }
  if (!key) { rows.push({ yk, live: live.length, note: "정답표 미등록 — 이 축으로 판정 불가", dataN: uniq.length, span: `${uniq[0]}~${uniq[uniq.length - 1]}` }); continue; }

  const lo = uniq[0], hi = uniq[uniq.length - 1];
  const inSpan = key.filter((n) => n >= lo && n <= hi);
  const outSpan = key.filter((n) => n < lo || n > hi);
  const missRuns = runs(inSpan.filter((n) => !uniq.includes(n)));
  const ghost = uniq.filter((n) => !key.includes(n));
  rows.push({
    yk, live: live.length, dataN: uniq.length, keyN: key.length, span: `${lo}~${hi}`,
    gapRuns: missRuns.filter((r) => r.length >= 2), soloRuns: missRuns.filter((r) => r.length === 1),
    ghost, dup, outSpan: outSpan.length,
  });
}

const gap = rows.filter((r) => r.gapRuns?.length || r.ghost?.length || r.dup?.length);
const solo = rows.filter((r) => !gap.includes(r) && r.soloRuns?.length);
const nokey = rows.filter((r) => r.note);

console.log("# 문항 대장 축 — 정답표 문항 번호 ↔ 데이터 문항 번호");
console.log("");
console.log(`> 생성: \`node pipeline/question_roster_audit.mjs ${argv.join(" ")}\``);
console.log("> 진단만 한다. **아무것도 쓰지 않는다.**");
console.log("");
console.log("| 항목 | 수 |");
console.log("|---|--:|");
console.log(`| 검사한 회차 | ${rows.length} |`);
console.log(`| 🔴 **구간 누락·유령·중복** | **${gap.length}** (LIVE 보유 ${gap.filter((r) => r.live).length}) |`);
console.log(`| ⚠ 단발 누락 — 원본 대조 필요 | ${solo.length} |`);
console.log(`| 정답표 미등록 — 판정 불가 | ${nokey.filter((r) => r.note?.startsWith("정답표")).length} |`);
console.log("");

if (gap.length) {
  console.log("## 🔴 구간 누락 · 유령 문항 · 중복 번호");
  console.log("");
  console.log("| 회차 | LIVE | 데이터 | 정답표 | 담당 구간 | 구간 누락 | 단발 누락 | 유령 | 중복 |");
  console.log("|---|--:|--:|--:|---|---|---|---|---|");
  for (const r of gap.sort((a, b) => b.live - a.live))
    console.log(`| ${r.yk} | ${r.live || "—"} | ${r.dataN} | ${r.keyN} | ${r.span} | `
      + `${r.gapRuns.length ? "🔴 " + r.gapRuns.map(fmt).join(" · ") : "—"} | `
      + `${r.soloRuns.length ? "⚠ " + r.soloRuns.map(fmt).join(" · ") : "—"} | `
      + `${r.ghost.length ? "🔴 " + r.ghost.join(" ") : "—"} | ${r.dup.length ? "🔴 " + r.dup.join(" ") : "—"} |`);
  console.log("");
  console.log("> **구간 누락은 지문 세트 하나가 통째로 빠졌다는 뜻이다.** 원본에서 그 번호대의 지문을 확인할 것.");
  console.log("");
}

if (solo.length) {
  console.log("## ⚠ 단발 누락 — 지문 없는 단독 문항일 수 있다");
  console.log("");
  console.log("문법·화법작문의 **단독 문항**은 지문 세트가 없어 뷰어에 안 담는 것이 자연스럽다.");
  console.log("**원본에서 그 번호가 지문 문항인지 단독 문항인지 확인해야 판정된다**(S-01).");
  console.log("");
  for (const r of solo.sort((a, b) => b.live - a.live))
    console.log(`- ${r.live ? `🔴 LIVE ${r.live}세트 ` : ""}\`${r.yk}\` — 담당 ${r.span} 중 **${r.soloRuns.map(fmt).join(" · ")}** 없음 (데이터 ${r.dataN} / 정답표 ${r.keyN})`);
  console.log("");
}

if (nokey.length) {
  console.log("## 판정 불가");
  console.log("");
  for (const r of nokey) console.log(`- \`${r.yk}\` — ${r.note}${r.span ? ` (데이터 ${r.dataN}문항 ${r.span})` : ""}`);
  console.log("");
}

const ok = rows.length - gap.length - solo.length - nokey.length;
console.log(`✅ 이상 없음 ${ok}회차`);
console.log("");
console.log("> ⚠ **담당 구간 밖은 보지 않는다.** 뷰어는 독서·문학만 담으므로 선택과목·화법작문");
console.log("> 번호대는 애초에 대조 대상이 아니다. 그 구간의 결손은 이 축이 못 잡는다.");
console.log("> 정답표가 없는 회차(2014수능 A/B)는 원본이 스캔본이라 이 축으로 판정할 수 없다.");
