// audit_ab_stem.mjs — A/B형 회차 발문 존재 여부 전수 확인 (발주 D-18 · 2026-08-18)
//
// 각 문항 발문이
//   ① 자형 PDF 에 있으면        → 정상
//   ② 없고 타형 PDF 에 있으면   → 「타형 수록」 (정상)
//   ③ 양쪽 다 없으면            → 「원문 부재」
//
// ★ 읽기 전용. 원인을 단정하지 않는다. 목록까지만 낸다(발주 D-18).
// 사용: node pipeline/audit_ab_stem.mjs <pdf텍스트디렉터리>

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIR = process.argv[2];
if (!DIR) {
  console.error("사용: node pipeline/audit_ab_stem.mjs <pdf텍스트디렉터리>");
  process.exit(1);
}

const data = JSON.parse(
  fs.readFileSync(path.join(ROOT, "public/data/all_data_204.json"), "utf8"),
);
const src = fs.readFileSync(path.join(ROOT, "src/dataLoader.js"), "utf8");
const _s = src.indexOf("const RELEASE_KEYS = new Set([");
const RELEASE_KEYS = new Set(
  [...src.slice(_s, src.indexOf("]);", _s)).matchAll(/"([^"]+)"/g)]
    .map((m) => m[1])
    .filter((k) => k.includes("::")),
);

const uni = (s) =>
  String(s || "")
    .replace(/[‘’＇']/g, "'")
    .replace(/[“”＂"]/g, '"')
    .replace(/[｢「『]/g, "[")
    .replace(/[｣」』]/g, "]")
    .replace(/\u{F0854}/gu, "[")
    .replace(/\u{F0855}/gu, "]")
    .replace(//g, "[")
    .replace(//g, "]")
    .replace(/[·・･․‧∙⋅ㆍ]/g, "·")
    .replace(/[○◦◯⚬〇]/g, "○")
    .replace(/[～~〜]/g, "~")
    .replace(/[－–—―]/g, "-")
    .replace(/[（(]/g, "(")
    .replace(/[）)]/g, ")")
    .replace(/：/g, ":");
const flat = (s) => uni(s).replace(/[\s ]+/g, "").replace(/\[[A-E]\]/g, "");

// A/B형 회차 (2014수능A/B 는 대조 불가라 제외)
const PAIRS = [
  ["2014_6월A", "2014_6월B"],
  ["2014_9월A", "2014_9월B"],
  ["2015_6월A", "2015_6월B"],
  ["2015_9월A", "2015_9월B"],
  ["2015수능A", "2015수능B"],
  ["2016_6월A", "2016_6월B"],
  ["2016_9월A", "2016_9월B"],
  ["2016수능A", "2016수능B"],
];

const cache = {};
const pdf = (yk) => {
  if (!(yk in cache)) {
    const p = path.join(DIR, `pdf_${yk}.txt`);
    cache[yk] = fs.existsSync(p) ? flat(fs.readFileSync(p, "utf8")) : null;
  }
  return cache[yk];
};

const absent = [];
const perYear = {};
let total = 0;

for (const pair of PAIRS) {
  for (const yk of pair) {
    const other = pair[0] === yk ? pair[1] : pair[0];
    const own = pdf(yk),
      oth = pdf(other);
    perYear[yk] = { q: 0, own: 0, other: 0, none: 0 };
    for (const sec of ["reading", "literature"]) {
      for (const s of data[yk]?.[sec] || []) {
        const live = RELEASE_KEYS.has(`${yk}::${s.id}`);
        for (const q of s.questions || []) {
          const n = flat(q.t);
          if (n.length < 8) continue;
          total++;
          perYear[yk].q++;
          if (own && own.includes(n)) perYear[yk].own++;
          else if (oth && oth.includes(n)) perYear[yk].other++;
          else {
            perYear[yk].none++;
            absent.push({ yk, set: s.id, q: q.id, live, t: String(q.t).slice(0, 40) });
          }
        }
      }
    }
  }
}

console.log(`검사 발문 ${total}개 · 원문 부재 ${absent.length}개\n`);
console.log("## 회차별");
console.log("| 회차 | 발문 | 자형 수록 | 타형 수록 | 🔴 원문 부재 |");
console.log("|---|--:|--:|--:|--:|");
for (const [yk, v] of Object.entries(perYear))
  console.log(`| ${yk} | ${v.q} | ${v.own} | ${v.other} | ${v.none ? "**" + v.none + "**" : 0} |`);

if (absent.length) {
  console.log("\n## 🔴 원문 부재 목록");
  console.log("| 회차 | 세트 | 문항 | LIVE | 발문 앞 40자 |");
  console.log("|---|---|--:|:-:|---|");
  for (const a of absent)
    console.log(`| ${a.yk} | ${a.set} | ${a.q} | ${a.live ? "**LIVE**" : "-"} | ${a.t} |`);
  console.log(`\nLIVE 세트 소속: ${absent.filter((a) => a.live).length}개 / 전체 ${absent.length}개`);
}
