// fidelity_gate.mjs — 출시 문항의 발문·선지가 시험지 PDF 원문과 일치하는지 검사하는 영구 게이트.
// release_ready 의 공백(발문·선지 원문 일치 미검사) 보강. (2026-06-12 신설)
// 사용: node pipeline/fidelity_gate.mjs [--all] [--yk=2025수능]
//  - 기본: RELEASED_SETS 만. --all: 전체 set.
//  - 각 문항의 선지 텍스트가 해당 yearKey 시험지 PDF 본문에 (정규화 substring) 존재하는 비율(coverage) 산출.
//  - coverage<0.5 = 오/환각(가짜 문항), 0.5~0.9 = 부분 리워딩, ≥0.9 = 정상.
import fs from "fs";
import { execSync } from "child_process";
const ROOT = process.cwd();
const d = JSON.parse(fs.readFileSync("data-source/all_data_204.json", "utf8"));
const args = process.argv.slice(2);
const ALL = args.includes("--all");
const ykFilter = (args.find((a) => a.startsWith("--yk=")) || "").split("=")[1];
let RELEASED = null;
if (!ALL) {
  const c = fs.readFileSync("src/constants.js", "utf8");
  RELEASED = new Set(
    c
      .match(/RELEASED_SETS\s*=\s*\[([\s\S]*?)\]/)[1]
      .match(/['"]([^'"]+)['"]/g)
      .map((x) => x.replace(/['"]/g, "")),
  );
}
const norm = (t) =>
  t
    .replace(/[\s ]/g, "")
    .replace(/['"“”‘’]/g, "")
    .replace(/[㉠-㉤ⓐ-ⓩ①-⑮㉮-㉱]/g, "")
    .replace(/[()（）]/g, "");
const cache = {};
function sheji(yk) {
  if (cache[yk] !== undefined) return cache[yk];
  let f = null;
  for (const p of [`_done/${yk}/${yk}_시험지.pdf`, `_done/${yk}_시험지.pdf`])
    if (fs.existsSync(p)) {
      f = p;
      break;
    }
  if (!f) {
    cache[yk] = null;
    return null;
  }
  let t = "";
  try {
    t = execSync(
      `python3 -c "import fitz;dd=fitz.open('${f}');print(''.join(p.get_text() for p in dd))"`,
      { maxBuffer: 1e8 },
    ).toString();
  } catch (e) {}
  cache[yk] = norm(t);
  return cache[yk];
}
const rows = [];
for (const yk of Object.keys(d)) {
  if (ykFilter && yk !== ykFilter) continue;
  const st = sheji(yk);
  for (const cat of ["reading", "literature"])
    for (const s of d[yk][cat] || []) {
      if (RELEASED && !RELEASED.has(s.id)) continue;
      for (const q of s.questions) {
        if (!st || st.length < 500) {
          rows.push({
            yk,
            id: s.id,
            q: q.id,
            cov: -1,
            bad: [],
            t: q.t.slice(0, 38),
          });
          continue;
        }
        let hit = 0,
          tot = 0,
          bad = [];
        for (const ch of q.choices) {
          const ct = norm(ch.t);
          if (ct.length < 6) continue;
          tot++;
          const probe = ct.length > 30 ? ct.slice(0, 24) : ct;
          if (st.includes(probe)) hit++;
          else bad.push(ch.num);
        }
        rows.push({
          yk,
          id: s.id,
          q: q.id,
          cov: tot ? hit / tot : 1,
          bad,
          tot,
          t: q.t.slice(0, 38),
        });
      }
    }
}
const flagged = rows
  .filter((r) => r.cov >= 0 && r.cov < 0.9)
  .sort((a, b) => a.cov - b.cov);
const noShe = rows.filter((r) => r.cov === -1);
let out =
  "# 기출 충실도 게이트 리포트 (" +
  new Date().toISOString().slice(0, 10) +
  ")\n\n";
out += `검사 문항 ${rows.length - noShe.length} | 비충실(<90%) ${flagged.length} | 시험지없음 ${noShe.length}\n\n`;
out +=
  "| cov | yearKey | setId | Q | 불일치 선지 | 발문 |\n|---|---|---|---|---|---|\n";
for (const r of flagged)
  out += `| ${Math.round(r.cov * 100)}% | ${r.yk} | ${r.id} | ${r.q} | ${r.bad.join(",")} | ${r.t} |\n`;
fs.mkdirSync("pipeline/output", { recursive: true });
fs.writeFileSync("pipeline/output/fidelity_report.md", out);
console.log(
  "비충실 문항:",
  flagged.length,
  "(오<50%:",
  flagged.filter((r) => r.cov < 0.5).length,
  "/ 부분:",
  flagged.filter((r) => r.cov >= 0.5).length,
  ")",
);
console.log("리포트: pipeline/output/fidelity_report.md");
