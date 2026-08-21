// missing_scope_audit.mjs — 진짜 미추출 문항 확정 (발주 D-87 ⓪)
//
// 왜 다시 세나
//   D-79 는 「머리·꼬리」를 번호 범위로 셌다. 그런데 2016_6월B Q16 은
//   「중세 국어 'ㅎ' 종성 체언」= **문법**이라 애초에 서비스 대상이 아니었다.
//   범위로 세면 화작·문법이 부족분에 섞여 과다 계상된다.
//   → 세는 단위를 **세트 구간**으로 바꾼다. 원본 지시문 [a~b] 가 기준이다.
//
// 판정
//   구간의 문항이 데이터에 하나도 없다  → 미추출 후보
//   구간의 문항이 일부만 있다            → 부분 미추출
//   단독 문항(지시문 없음)               → 화작·문법일 가능성이 높다. 별도로 센다.
//   각 후보 구간의 지문 앞부분을 표본으로 찍어 육안 판정을 돕는다.
//
// 사용: node pipeline/missing_scope_audit.mjs [yearKey]      (인자 없으면 22회차 전체)
// 금지: 데이터 수정. (읽기 전용이다)

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { scanSetRanges, pdfText } from "./set_ranges.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const data = JSON.parse(fs.readFileSync(path.join(ROOT, "public/data/all_data_204.json"), "utf8"));
const RELEASE = (() => {
  const src = fs.readFileSync(path.join(ROOT, "src/dataLoader.js"), "utf8");
  const at = src.indexOf("const RELEASE_KEYS = new Set([");
  return new Set([...src.slice(at, src.indexOf("]);", at)).matchAll(/"([^"]+)"/g)]
    .map((m) => m[1]).filter((k) => k.includes("::")));
})();

const only = process.argv[2];
const OUT = path.join(ROOT, "docs/missing_scope_20260821.md");

// 지시문 문구로 1차 성격 추정 (확정은 사람이 한다)
const kindOf = (head) => {
  if (/화법과 작문|작문|화법/.test(head)) return "화작?";
  if (/언어와 매체|문법|국어의|음운|형태소/.test(head)) return "문법?";
  return "독서·문학?";
};

const rows = [];
for (const yk of Object.keys(data)) {
  if (only && yk !== only) continue;
  const dir = path.join(ROOT, "_done", yk);
  if (!fs.existsSync(dir)) continue;
  const pdfName = fs.readdirSync(dir).find((f) => f.endsWith(".pdf") && f.includes("시험지"));
  if (!pdfName) continue;
  const pdfPath = path.join(dir, pdfName);

  const have = new Set();
  const setsData = [];
  for (const sec of ["reading", "literature"])
    for (const s of data[yk][sec] || []) {
      setsData.push({ id: s.id, sec, live: RELEASE.has(`${yk}::${s.id}`), qs: (s.questions || []).map((q) => Number(q.id)) });
      for (const q of s.questions || []) have.add(Number(q.id));
    }

  const ranges = scanSetRanges(pdfPath, { min: 1, max: 45 });
  const raw = pdfText(pdfPath, false);

  // 각 구간의 지문 표본 — 지시문 뒤 텍스트
  const sample = (from, to) => {
    const re = new RegExp(`\\[\\s*${from}\\s*[~～∼]\\s*${to}\\s*\\]([\\s\\S]{0,260})`);
    const m = raw.match(re);
    return m ? m[1].replace(/\s+/g, " ").trim().slice(0, 150) : "";
  };

  // 🔴 서비스 스코프 필터 — 이게 없으면 화작·문법·선택과목이 부족분에 섞인다.
  //    2022학년도~ : 공통 Q1~34 만 (35~45 는 선택과목)
  //    ~2021학년도 : Q16~45 만 (1~15 는 화작문)
  const isNew = Number(yk.slice(0, 4)) >= 2022;
  const inScope = (r) => (isNew ? r.to <= 34 : r.from >= 16);

  for (const r of ranges) {
    if (!inScope(r)) continue;
    const nums = [];
    for (let n = r.from; n <= r.to; n++) nums.push(n);
    const got = nums.filter((n) => have.has(n));
    if (got.length === nums.length) continue;             // 다 있음 — 대상 아님
    const head = sample(r.from, r.to);
    rows.push({
      yk, from: r.from, to: r.to, kind: r.kind,
      total: nums.length, got: got.length,
      missing: nums.filter((n) => !have.has(n)),
      guess: r.kind === "single" ? "단독(화작·문법 유력)" : kindOf(head),
      head,
      liveSets: setsData.filter((s) => s.live).length, allSets: setsData.length,
    });
  }
}

// ── 출력 ──
const byYk = {};
for (const r of rows) (byYk[r.yk] ??= []).push(r);

const full = rows.filter((r) => r.got === 0 && r.kind === "set");
const part = rows.filter((r) => r.got > 0);
const single = rows.filter((r) => r.kind === "single");
const nq = (arr) => arr.reduce((a, r) => a + r.missing.length, 0);

console.log(`## 미추출 후보 — 회차 ${Object.keys(byYk).length}개`);
console.log(`  세트 통째 미추출: 구간 ${full.length}개 · ${nq(full)}문항`);
console.log(`  부분 미추출:      구간 ${part.length}개 · ${nq(part)}문항`);
console.log(`  단독 문항:        ${single.length}개 · ${nq(single)}문항  ← 화작·문법 유력, 스코프 밖 가능`);
console.log(`  ─ 합계 ${nq(rows)}문항 (D-79 의 「부족 171」과 비교)\n`);

for (const [yk, list] of Object.entries(byYk)) {
  const f = list.filter((r) => r.kind === "set" && r.got === 0);
  if (!f.length) continue;
  console.log(`  ${yk}: ` + f.map((r) => `[${r.from}~${r.to}]`).join(" ") +
    `  (${f.reduce((a, r) => a + r.missing.length, 0)}문항)`);
}

const md = ["# 진짜 미추출 문항 확정 (발주 D-87 ⓪ · 2026-08-21)", ""];
md.push("> D-79 는 번호 범위(머리·꼬리)로 셌다. 그 방식은 화작·문법을 부족분에 섞는다.",
  "> (2016_6월B Q16 = 「중세 국어 'ㅎ' 종성 체언」 → 문법. 누락이 아니었다.)",
  "> 여기서는 **원본 지시문 [a~b] 로 잡은 세트 구간**을 단위로 센다.", "");
md.push("## 요약", "");
md.push("| 구분 | 구간 | 문항 |", "|---|--:|--:|");
md.push(`| 세트 통째 미추출 | ${full.length} | **${nq(full)}** |`);
md.push(`| 부분 미추출 | ${part.length} | ${nq(part)} |`);
md.push(`| 단독 문항(화작·문법 유력) | ${single.length} | ${nq(single)} |`);
md.push(`| 합계 | ${rows.length} | ${nq(rows)} |`);
md.push("");
md.push("## 회차별 — 세트 통째 미추출 (위임 작업 범위 후보)", "");
md.push("| 회차 | 구간 | 문항 | 성격 추정 | 지문 앞부분 |", "|---|---|--:|---|---|");
for (const r of full)
  md.push(`| ${r.yk} | [${r.from}~${r.to}] | ${r.missing.length} | ${r.guess} | ${r.head.slice(0, 70).replace(/\|/g, "\\|")}… |`);
md.push("");
md.push("## 부분 미추출 (세트는 있는데 문항이 빠짐)", "");
md.push("| 회차 | 구간 | 있음/전체 | 빠진 번호 |", "|---|---|--:|---|");
for (const r of part) md.push(`| ${r.yk} | [${r.from}~${r.to}] | ${r.got}/${r.total} | ${r.missing.join(",")} |`);
md.push("");
md.push("## 단독 문항 — 스코프 밖 가능성 (위임 범위에서 뺀다)", "");
md.push("| 회차 | 번호 | 앞부분 |", "|---|--:|---|");
for (const r of single) md.push(`| ${r.yk} | ${r.from} | ${(r.head || "(지시문 없음)").slice(0, 70).replace(/\|/g, "\\|")}… |`);
md.push("");
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, md.join("\n"), "utf8");
console.log(`\n문서: ${path.relative(ROOT, OUT)}`);
