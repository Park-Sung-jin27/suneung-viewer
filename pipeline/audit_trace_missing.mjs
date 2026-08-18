// audit_trace_missing.mjs — 발문 부재 (나) 역추적 + 회차 단위 점검 (발주 D-19)
//
// A. 대상 4건에 대해
//    A-1 선지 5개를 353세트 전체에서 검색
//    A-2 발문을 49회차 PDF 전체에서 검색
//    A-3 그 세트의 지문이 어느 PDF 에 있는가
// B. 2014_9월B 전 세트 지문의 수록 PDF 확인
//
// ★ 읽기 전용. 원인을 단정하지 않는다. 사실만 낸다(발주 D-19).
// 사용: node pipeline/audit_trace_missing.mjs <pdf텍스트디렉터리>

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIR = process.argv[2];
const data = JSON.parse(
  fs.readFileSync(path.join(ROOT, "public/data/all_data_204.json"), "utf8"),
);
const src = fs.readFileSync(path.join(ROOT, "src/dataLoader.js"), "utf8");
const _s = src.indexOf("const RELEASE_KEYS = new Set([");
const RK = new Set(
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

const YKS = Object.keys(data);
const PDF = {};
for (const yk of YKS) {
  const p = path.join(DIR, `pdf_${yk}.txt`);
  PDF[yk] = fs.existsSync(p) ? flat(fs.readFileSync(p, "utf8")) : null;
}
// 대조 불가 회차 (쪽당 500자 미만)
const UNUSABLE = new Set(["2014수능A", "2014수능B"]);

const findSet = (yk, id) => {
  for (const sec of ["reading", "literature"]) {
    const x = (data[yk][sec] || []).find((v) => v.id === id);
    if (x) return x;
  }
  return null;
};
const inPdfs = (txt, minLen = 20) => {
  const n = flat(txt);
  if (n.length < minLen) return [];
  const probe = n.length > 60 ? n.slice(0, 60) : n;
  return YKS.filter((yk) => PDF[yk] && !UNUSABLE.has(yk) && PDF[yk].includes(probe));
};

// ── A. (나) 4건 역추적 ──────────────────────────────────────────
const TARGETS = [
  ["2014_9월B", "r20149b", 18],
  ["2014_9월B", "r20149b", 20],
  ["2014_9월B", "r20149d", 27],
  ["2016수능B", "r2016cB", 26],
];

console.log("# A. 발문 부재 (나) 4건 역추적\n");
for (const [yk, id, qn] of TARGETS) {
  const set = findSet(yk, id);
  const q = set.questions.find((x) => x.id === qn);
  const live = RK.has(`${yk}::${id}`);
  console.log(`## ${yk} ${id} Q${qn} ${live ? "🔴 LIVE" : "(비노출)"}`);
  console.log(`발문: ${String(q.t).slice(0, 60)}`);

  // A-1 선지를 353세트 전체에서 검색
  const hits = [];
  for (const c of q.choices || []) {
    const n = flat(c.t);
    if (n.length < 15) continue;
    for (const yk2 of YKS)
      for (const sec of ["reading", "literature"])
        for (const s2 of data[yk2][sec] || [])
          for (const q2 of s2.questions || [])
            for (const c2 of q2.choices || []) {
              if (yk2 === yk && s2.id === id && q2.id === qn) continue;
              if (flat(c2.t) === n) hits.push(`선지${c.num} ↔ ${yk2} ${s2.id} Q${q2.id}#${c2.num}`);
            }
  }
  console.log(`A-1 선지 중복(353세트): ${hits.length ? hits.join(" / ") : "없음"}`);

  // A-2 발문을 49회차 PDF 전체에서 검색
  const stemIn = inPdfs(q.t, 12);
  console.log(`A-2 발문 수록 PDF: ${stemIn.length ? stemIn.join(", ") : "🔴 어느 회차 PDF에도 없음"}`);

  // A-3 그 세트의 지문이 어느 PDF 에 있는가
  const sentHits = {};
  let checked = 0;
  for (const t of set.sents || []) {
    if (!t.t || flat(t.t).length < 30 || t.sentType === "footnote") continue;
    checked++;
    for (const y of inPdfs(t.t, 30)) sentHits[y] = (sentHits[y] || 0) + 1;
  }
  const top = Object.entries(sentHits).sort((a, b) => b[1] - a[1]);
  console.log(
    `A-3 지문 수록(문장 ${checked}개 기준): ${top.length ? top.map(([y, c]) => `${y} ${c}개`).join(" / ") : "🔴 어느 PDF에도 없음"}`,
  );
  console.log("");
}

// ── B. 2014_9월B 회차 단위 점검 ────────────────────────────────
console.log("\n# B. 2014_9월B 회차 단위 점검\n");
console.log("| 세트 | LIVE | 문항 | 지문문장 | 자형(2014_9월B) | 타형(2014_9월A) | 그 외 |");
console.log("|---|:-:|--:|--:|--:|--:|---|");
for (const sec of ["reading", "literature"]) {
  for (const s of data["2014_9월B"][sec] || []) {
    let own = 0,
      oth = 0,
      checked = 0;
    const other = {};
    for (const t of s.sents || []) {
      if (!t.t || flat(t.t).length < 30 || t.sentType === "footnote") continue;
      checked++;
      const ys = inPdfs(t.t, 30);
      if (ys.includes("2014_9월B")) own++;
      if (ys.includes("2014_9월A")) oth++;
      for (const y of ys) if (y !== "2014_9월B" && y !== "2014_9월A") other[y] = (other[y] || 0) + 1;
    }
    const oStr = Object.entries(other).map(([y, c]) => `${y} ${c}`).join(" ");
    console.log(
      `| ${s.id} | ${RK.has(`2014_9월B::${s.id}`) ? "**LIVE**" : "-"} | ${(s.questions || []).length} | ${checked} | ${own} | ${oth} | ${oStr || "-"} |`,
    );
  }
}
