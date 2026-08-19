// sentence_head_audit.mjs — 문장 사이 누락 (발주 D-65)
//
// 데이터 문장이 원문의 **부분 문자열**이면 모든 대조가 「일치」로 본다.
// 그래서 문장 앞이 잘린 결함은 다른 어떤 축도 잡지 못한다.
//   실증: 2025수능 r2025as7 「보면 밑줄이…」  원문 「그러다 보면 밑줄이…」
//         문법적으로 자연스럽고 게이트도 통과한다.
//
// [판정식] 「앞 글자가 종결부호인가」로는 안 된다 —
//   데이터는 긴 문장을 여러 sents 로 쪼개므로 두 번째 조각의 앞은 종결부호가 아니다.
//   대신 **직전 문장의 끝과 현재 문장의 시작이 원문에서 연속인가**를 본다.
//     연속        → 정상 (문장 분할일 뿐)
//     사이에 글자 → 🔴 그 글자가 누락된 것
//
// ★ 읽기 전용. 지문 문장만 본다.
// 사용: node pipeline/sentence_head_audit.mjs <pdf텍스트디렉터리> [--all]

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildIndex, hard } from "./anchor.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIR = process.argv[2];
if (!DIR) { console.error("사용: node pipeline/sentence_head_audit.mjs <pdf텍스트디렉터리>"); process.exit(1); }
const data = JSON.parse(fs.readFileSync(path.join(ROOT, "public/data/all_data_204.json"), "utf8"));
const src = fs.readFileSync(path.join(ROOT, "src/dataLoader.js"), "utf8");
const _s = src.indexOf("const RELEASE_KEYS = new Set([");
const RK = new Set(
  [...src.slice(_s, src.indexOf("]);", _s)).matchAll(/"([^"]+)"/g)]
    .map((m) => m[1]).filter((k) => k.includes("::")),
);

const rows = [];
let pairs = 0, skip = 0;
for (const yk of Object.keys(data)) {
  const p = path.join(DIR, `pdf_${yk}.txt`);
  if (!fs.existsSync(p)) continue;
  const idx = buildIndex(fs.readFileSync(p, "utf8"));
  const find = (t) => {
    const n = hard(t);
    if (n.length < 16) return null;
    const a = idx.H.indexOf(n);
    if (a < 0 || idx.H.indexOf(n, a + 1) >= 0) return null;   // 없거나 다중 출현
    return { a, b: a + n.length };                             // H 상의 [시작, 끝)
  };
  for (const sec of ["reading", "literature"]) {
    for (const set of data[yk][sec] || []) {
      const live = RK.has(`${yk}::${set.id}`);
      const sents = (set.sents || []).filter((t) => t.sentType !== "footnote");
      for (let i = 1; i < sents.length; i++) {
        const A = find(sents[i - 1].t), B = find(sents[i].t);
        if (!A || !B) { skip++; continue; }
        pairs++;
        const gap = B.a - A.b;
        if (gap <= 0) continue;                    // 겹치거나 붙어 있음 = 정상
        if (B.a < A.a) continue;                   // 순서가 뒤집힘 = 다른 곳을 잡음
        if (gap > 60) continue;                    // 너무 멀면 쪽·단 경계다
        const lost = idx.raw.slice(idx.map[A.b - 1] + 1, idx.map[B.a]).replace(/\s+/g, " ").trim();
        if (!lost) continue;
        // 쪽 머리글·지문 구분 표기((가)/(나))·연 표시(<제N수>)·[A] 구간표는 본문이 아니다.
        const NOISE = /문제지에 관한 저작권|한국교육과정평가원|홀수형|짝수형|국어 영역|^[.,)\]』」”'"\s]*$|^[.\s]*\([가-하]\)[\s]*$|^[.\s]*<제\s*\d+\s*수>[\s]*$|^[.\s]*\[[A-Z]\][\s]*$/;
        if (NOISE.test(lost)) continue;
        if (!lost) continue;
        rows.push({ yk, setId: set.id, prev: sents[i - 1].id, sid: sents[i].id, live,
          gap, lost: lost.slice(0, 40), head: String(sents[i].t).slice(0, 24) });
      }
    }
  }
}
const L = rows.filter((r) => r.live);
console.log(`## 문장 사이 누락 — 이웃 쌍 ${pairs}개 대조 (앵커 실패로 건너뜀 ${skip})\n`);
console.log(`🔴 누락 의심 ${rows.length}건 (LIVE ${L.length})\n`);
console.log("| 회차 | 세트 | 문장 | 원문에만 있는 글자 | 데이터 문장 시작 | LIVE |");
console.log("|---|---|---|---|---|:-:|");
const SHOW = process.argv.includes("--all") ? rows : rows.slice(0, 30);
for (const r of SHOW)
  console.log(`| ${r.yk} | \`${r.setId}\` | ${r.sid} | **${r.lost}** | ${r.head}… | ${r.live ? "**LIVE**" : "-"} |`);
if (SHOW.length < rows.length) console.log(`\n… 외 ${rows.length - SHOW.length}건 (--all)`);
