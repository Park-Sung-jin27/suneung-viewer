// question_count_audit.mjs — 원본 문항 수 ↔ 데이터 문항 수 대조 (발주 D-79)
//
// 목적: "원본에는 있는데 데이터에 없는 문항" 이 있는 회차를 확정한다.
//       재추출·데이터 수정은 이번 범위 밖. 규모·노출교차 확정만 한다.
//
// 스코프 — 화법과작문·언어와매체(문법)는 서비스 대상이 아니다. 독서·문학만 본다.
//   · 2022학년도~ : 공통 Q1~34 가 독서+문학. 35~45 는 선택과목 → 제외
//   · ~2021학년도 : Q16~45 가 독서+문학. 1~15 는 화작문 → 제외
//   yearKey 앞 4자리로 판별한다.
//
// 두 가지 부족을 나눠 센다 (경계 논란을 피하려고 분리했다)
//   구멍(hole) : 데이터 q.id 최소~최대 **사이**에 빠진 번호.
//                그 구간은 이미 독서/문학이므로 화작문이 낄 수 없다 → 확실한 미추출.
//   꼬리(tail) : 스코프 상한(34 또는 45) - 데이터 최대 번호.
//                회차 뒷부분을 통째로 안 넣은 경우다.
//
// 원본은 pdftotext -layout 으로 문항 번호를 뽑아 대조한다.
//   🔴 -enc UTF-8 을 반드시 준다. 없으면 원문자·특수기호가 드롭된다.
//
// 사용: node pipeline/question_count_audit.mjs
// 금지: 재추출·데이터 수정. 화작/문법 포함. (읽기 전용 스크립트다)

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DONE = path.join(ROOT, "_done");
const SRC = path.join(ROOT, "data-source/all_data_204.json");
const OUT = path.join(ROOT, "docs/question_count_audit_20260820.md");

const data = JSON.parse(fs.readFileSync(SRC, "utf8"));

// ── RELEASE_KEYS (노출 교차용) — src/ 는 읽기만 한다 ──
const RELEASE = (() => {
  const src = fs.readFileSync(path.join(ROOT, "src/dataLoader.js"), "utf8");
  const at = src.indexOf("const RELEASE_KEYS = new Set([");
  const end = src.indexOf("]);", at);
  return new Set([...src.slice(at, end).matchAll(/"([^"]+)"/g)].map((m) => m[1]).filter((k) => k.includes("::")));
})();

const scopeTop = (yk) => (Number(yk.slice(0, 4)) >= 2022 ? 34 : 45);
const scopeBottom = (yk) => (Number(yk.slice(0, 4)) >= 2022 ? 1 : 16);

// ── 원본 PDF 에서 문항 번호 뽑기 ──
function pdfNumbers(pdf) {
  let txt;
  try {
    txt = execFileSync("pdftotext", ["-layout", "-enc", "UTF-8", pdf, "-"],
      { maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] }).toString("utf8");
    // stderr 는 버린다 — 이 poppler 빌드는 Adobe-Korea1 CMap 경고를 쏟지만 본문 추출은 정상이다.
  } catch (e) {
    return { err: String(e.message || e).slice(0, 120) };
  }
  const nums = new Set();
  const ranges = [];
  for (const line of txt.split(/\r?\n/)) {
    // -layout 은 단 구분을 공백으로 남긴다. 3칸 이상 공백으로 쪼개 각 조각의 머리를 본다.
    for (const seg of line.split(/ {3,}/)) {
      const m = seg.trim().match(/^(\d{1,2})\.\s*\S/);
      if (m) { const n = Number(m[1]); if (n >= 1 && n <= 45) nums.add(n); }
    }
    for (const m of line.matchAll(/\[\s*(\d{1,2})\s*[~～∼-]\s*(\d{1,2})\s*\]/g)) {
      ranges.push([Number(m[1]), Number(m[2])]);
    }
  }
  return { nums, ranges, chars: txt.length };
}

// ── 회차별 집계 ──
const rows = [];
for (const yk of Object.keys(data)) {
  const y = data[yk];
  const R = y.reading || [], L = y.literature || [];
  const qs = [...R, ...L].flatMap((s) => (s.questions || []).map((q) => Number(q.id)))
    .filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  const lo = qs[0], hi = qs[qs.length - 1];
  const have = new Set(qs);

  const top = scopeTop(yk), bot = scopeBottom(yk);
  const holes = [];
  if (qs.length) for (let n = lo; n <= hi; n++) if (!have.has(n)) holes.push(n);
  const tail = qs.length ? Math.max(0, top - hi) : top - bot + 1;
  const head = qs.length ? Math.max(0, lo - bot) : 0;

  // 원본
  const dir = path.join(DONE, yk);
  let pdf = null;
  if (fs.existsSync(dir)) {
    for (const f of fs.readdirSync(dir)) if (f.endsWith(".pdf") && f.includes("시험지")) { pdf = path.join(dir, f); break; }
  }
  const src = pdf ? pdfNumbers(pdf) : { err: "시험지 PDF 없음" };
  // 원본에서 스코프 안 번호만
  const srcIn = src.nums ? [...src.nums].filter((n) => n >= bot && n <= top).sort((a, b) => a - b) : [];
  // 구멍·꼬리 번호가 원본에 실제로 있는가
  const holesConfirmed = src.nums ? holes.filter((n) => src.nums.has(n)) : [];
  const tailNums = [];
  if (qs.length) for (let n = hi + 1; n <= top; n++) if (!src.nums || src.nums.has(n)) tailNums.push(n);

  // 노출 교차
  const sets = [...R.map((s) => [s.id, "reading"]), ...L.map((s) => [s.id, "literature"])];
  const live = sets.filter(([id]) => RELEASE.has(`${yk}::${id}`));

  rows.push({
    yk, top, bot,
    rSets: R.length, lSets: L.length,
    rQ: R.reduce((a, s) => a + (s.questions || []).length, 0),
    lQ: L.reduce((a, s) => a + (s.questions || []).length, 0),
    n: qs.length, lo, hi, holes, holesConfirmed, tail, tailNums, head,
    srcCount: srcIn.length, srcLo: srcIn[0], srcHi: srcIn[srcIn.length - 1],
    srcErr: src.err || null,
    liveSets: live.length, allSets: sets.length,
    liveLit: live.filter(([, k]) => k === "literature").length,
  });
}

// 부족 문항 추정 = 구멍 + 꼬리 + 머리
const lack = (r) => r.holes.length + r.tail + r.head;
const suspect = rows.filter((r) => lack(r) > 0 || r.lSets <= 2);
const liveSuspect = suspect.filter((r) => r.liveSets > 0);

// ── 콘솔 ──
console.log(`회차 ${rows.length} · 미추출 의심 ${suspect.length} · 그중 노출 중 ${liveSuspect.length}`);
console.log(`부족 문항 추정 합계 ${rows.reduce((a, r) => a + lack(r), 0)}문항\n`);
const L0 = ["2015_9월B", "2018_9월", "2020_9월"], L1 = ["2016_6월B", "2016_9월B"],
  L2 = ["2022_9월", "2015_6월B", "2014_9월A"];
console.log("## 발주 지정 8회차 (문학 세트 <= 2)");
for (const [tag, list] of [["L0", L0], ["L1", L1], ["L2", L2]]) {
  for (const yk of list) {
    const r = rows.find((v) => v.yk === yk);
    if (!r) { console.log(`  ${tag} ${yk} — 데이터에 없음`); continue; }
    console.log(`  ${tag} ${yk}: 데이터 ${r.n}문항(${r.lo}~${r.hi}) 문학세트 ${r.lSets} | ` +
      `원본 스코프내 ${r.srcCount}문항(${r.srcLo}~${r.srcHi}) | ` +
      `구멍 ${r.holes.length}(원본확인 ${r.holesConfirmed.length}) 꼬리 ${r.tail} 머리 ${r.head} → 부족 ${lack(r)} | ` +
      `LIVE ${r.liveSets}/${r.allSets}`);
  }
}

// ── 문서 ──
const md = [];
md.push("# 원본 문항 수 ↔ 데이터 문항 수 대조 (발주 D-79 · 2026-08-20)", "");
md.push("> 재추출·데이터 수정은 이번 범위 밖. 규모·노출교차 확정만 한다.", "");
md.push("## 세는 방법", "");
md.push("- 스코프: 2022학년도~ 공통 Q1~34 / ~2021학년도 Q16~45. 화작·문법은 제외한다.");
md.push("- **구멍** = 데이터 q.id 최소~최대 사이에 빠진 번호. 그 구간은 이미 독서/문학이라 화작문이 낄 수 없다 → 확실한 미추출.");
md.push("- **꼬리** = 스코프 상한 − 데이터 최대 번호. 뒷부분을 통째로 안 넣은 경우.");
md.push("- **머리** = 데이터 최소 번호 − 스코프 하한.");
md.push("- 원본 번호는 `pdftotext -layout -enc UTF-8` 로 뽑았다. 2단 조판이라 일부 번호를 놓칠 수 있다(위음성).");
md.push("");
md.push(`## 🔴 노출 중인데 미추출 의심 — ${liveSuspect.length}회차 (최우선)`, "");
md.push("| 회차 | LIVE/전체 세트 | 문학세트(LIVE) | 데이터 문항 | 구간 | 원본 스코프내 | 구멍 | 꼬리 | 부족 추정 |");
md.push("|---|--:|--:|--:|---|--:|--:|--:|--:|");
for (const r of liveSuspect.sort((a, b) => lack(b) - lack(a))) {
  md.push(`| ${r.yk} | ${r.liveSets}/${r.allSets} | ${r.lSets}(${r.liveLit}) | ${r.n} | ${r.lo}~${r.hi} | ` +
    `${r.srcCount} (${r.srcLo ?? "-"}~${r.srcHi ?? "-"}) | ${r.holes.length} | ${r.tail} | **${lack(r)}** |`);
}
md.push("");
md.push("## 전체 회차", "");
md.push("| 회차 | 독서 세트/문항 | 문학 세트/문항 | 데이터 구간 | 원본 스코프내 | 구멍 번호 | 꼬리 | 부족 | LIVE |");
md.push("|---|--:|--:|---|--:|---|--:|--:|--:|");
for (const r of rows) {
  const h = r.holes.length ? r.holes.join(",") : "-";
  md.push(`| ${r.yk} | ${r.rSets}/${r.rQ} | ${r.lSets}/${r.lQ} | ${r.lo ?? "-"}~${r.hi ?? "-"} | ` +
    `${r.srcErr ? "PDF오류" : `${r.srcCount} (${r.srcLo ?? "-"}~${r.srcHi ?? "-"})`} | ${h} | ${r.tail} | ${lack(r)} | ${r.liveSets}/${r.allSets} |`);
}
md.push("");
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, md.join("\n"), "utf8");
console.log(`\n문서: ${path.relative(ROOT, OUT)}`);
