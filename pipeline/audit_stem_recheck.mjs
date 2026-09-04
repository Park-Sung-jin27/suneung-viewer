// audit_stem_recheck.mjs — 발문 부재 16건이 진짜 부재인지 탐지 실패인지 판별 (발주 D-20)
//
// T-1 기호·따옴표·공백을 전부 없앤 뒤 재검색
// T-2 LIVE 2건을 A형 원문 발문과 나란히 비교
// T-3 l20149a 지문 문장 0개 원인
//
// ★ 읽기 전용. 사용: node pipeline/audit_stem_recheck.mjs <pdf텍스트디렉터리>

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIR = process.argv[2];
const data = JSON.parse(
  fs.readFileSync(path.join(ROOT, "data-source/all_data_204.json"), "utf8"),
);

// 강한 정규화 — 기호·따옴표·구두점·공백을 전부 지운다.
//   남는 것은 한글·한자·라틴 문자·숫자뿐이다.
const hard = (s) =>
  String(s || "")
    .normalize("NFKC")
    .replace(/[^\p{Script=Hangul}\p{Script=Han}\p{Script=Latin}0-9]/gu, "");

const YKS = Object.keys(data);
const PDF = {};
for (const yk of YKS) {
  const p = path.join(DIR, `pdf_${yk}.txt`);
  PDF[yk] = fs.existsSync(p) ? hard(fs.readFileSync(p, "utf8")) : null;
}
const UNUSABLE = new Set(["2014수능A", "2014수능B"]);
const findSet = (yk, id) => {
  for (const sec of ["reading", "literature"]) {
    const x = (data[yk][sec] || []).find((v) => v.id === id);
    if (x) return x;
  }
  return null;
};
const whereIn = (txt) => {
  const n = hard(txt);
  if (n.length < 8) return { n, hits: [] };
  return { n, hits: YKS.filter((y) => PDF[y] && !UNUSABLE.has(y) && PDF[y].includes(n)) };
};

// ── T-1 ────────────────────────────────────────────────────────
const LIST = [
  ["2014_9월B", "r20149b", 18], ["2014_9월B", "r20149b", 20],
  ["2014_9월B", "r20149c", 22], ["2014_9월B", "r20149c", 23],
  ["2014_9월B", "r20149d", 26], ["2014_9월B", "r20149d", 27],
  ["2015_9월A", "l20159b", 35], ["2015수능A", "l2015b", 36],
  ["2015수능B", "r2015aB", 18], ["2015수능B", "r2015aB", 20],
  ["2016_9월A", "r20169c", 28], ["2016_9월A", "r20169c", 30],
  ["2016수능B", "r2016aB", 17], ["2016수능B", "r2016aB", 18],
  ["2016수능B", "r2016bB", 23], ["2016수능B", "r2016cB", 26],
];
const OTHER = (y) => (y.endsWith("A") ? y.slice(0, -1) + "B" : y.slice(0, -1) + "A");

console.log("# T-1. 기호·공백 전부 제거 후 재검색\n");
console.log("| 회차 | 세트 | 문항 | 자형 | 타형 | 그 외 회차 | 판정 |");
console.log("|---|---|--:|:-:|:-:|---|---|");
let recovered = 0, still = 0;
const stillList = [];
for (const [yk, id, qn] of LIST) {
  const q = findSet(yk, id).questions.find((x) => x.id === qn);
  const { hits } = whereIn(q.t);
  const own = hits.includes(yk), oth = hits.includes(OTHER(yk));
  const rest = hits.filter((h) => h !== yk && h !== OTHER(yk));
  const ok = own || oth;
  if (ok) recovered++; else { still++; stillList.push([yk, id, qn]); }
  console.log(
    `| ${yk} | ${id} | ${qn} | ${own ? "✅" : "-"} | ${oth ? "✅" : "-"} | ${rest.join(", ") || "-"} | ${ok ? "**탐지 실패였음**" : "🔴 여전히 부재"} |`,
  );
}
console.log(`\n**탐지 실패 ${recovered}건 / 여전히 부재 ${still}건**`);

// ── T-2 ────────────────────────────────────────────────────────
console.log("\n\n# T-2. LIVE 2건 — A형 원문 발문과 나란히\n");
const PAIRS = [
  ["2014_9월B", "r20149d", 27, "2014_9월A", "r20149c", 25],
  ["2016수능B", "r2016cB", 26, "2016수능A", "r2016c", 28],
];
for (const [byk, bid, bq, ayk, aid, aq] of PAIRS) {
  const B = findSet(byk, bid).questions.find((x) => x.id === bq);
  const A = findSet(ayk, aid).questions.find((x) => x.id === aq);
  console.log(`## ${byk} ${bid} Q${bq}  ↔  ${ayk} ${aid} Q${aq}`);
  console.log(`  B형 데이터 발문: ${B.t}`);
  console.log(`  A형 데이터 발문: ${A.t}`);
  const ra = whereIn(A.t), rb = whereIn(B.t);
  console.log(`  A형 발문 수록 PDF: ${ra.hits.join(", ") || "🔴 없음"}`);
  console.log(`  B형 발문 수록 PDF: ${rb.hits.join(", ") || "🔴 없음"}`);
  console.log(`  두 발문 동일(강정규화): ${ra.n === rb.n ? "예" : "아니오"}`);
  console.log("");
}

// ── T-3 ────────────────────────────────────────────────────────
console.log("\n# T-3. l20149a 지문 문장 점검\n");
const s = findSet("2014_9월B", "l20149a");
console.log(`sents 개수: ${(s.sents || []).length} · questions: ${(s.questions || []).length}`);
console.log(`title: ${s.title} · range: ${s.range}`);
const lens = (s.sents || []).map((t) => hard(t.t).length);
console.log(`문장 길이(강정규화): ${JSON.stringify(lens)}`);
console.log(`30자 이상 문장: ${lens.filter((l) => l >= 30).length}개`);
console.log("\n문장 전문:");
for (const t of s.sents || [])
  console.log(`  [${t.id} ${t.sentType || "-"}] ${String(t.t).slice(0, 70)}`);
