// newline_residual.mjs — 줄바꿈 판별불가 잔존 건별 대조 (발주 D-100 ①)
//
// 1차(newline_fix)에서 PDF 줄 매칭이 안 돼 `\n` 원형으로 남긴 자리들이다.
// 여기서는 **PDF 한 줄 안에서 그 구간을 직접 찾아** 공백/붙임을 확정한다.
//   · 앞뒤 조각을 이어 붙인 문자열이 PDF 어느 한 줄 안에 통째로 있으면
//     그 줄의 공백 배치가 정답이다(줄바꿈과 무관한 자리이므로).
//   · 두 줄에 걸치면 앞 줄의 끝 공백을 본다(1차와 같은 근거).
// 둘 다 안 되면 **손대지 않고** 목록으로 남긴다 — 어법 판단은 사람이 한다.
//
// `questions.bogi` 의 줄바꿈은 대상이 아니다. <보기> 는 항목 나열(1. 2. ㉠ ㉡)이라
// 줄바꿈이 **구조**다. 기존 353세트도 10%가 갖고 있다.
//
// 사용: node pipeline/newline_residual.mjs [--apply]

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = path.join(ROOT, "data-source/all_data_204.json");
const STEP3 = path.join(ROOT, "pipeline/reextract/step3");
const APPLY = process.argv.includes("--apply");
const W = (s) => String(s).replace(/\s/g, "");

// 신규 43세트만 대상
const newKeys = new Map();   // "yk::sid" → yk
for (const d of fs.readdirSync(STEP3)) {
  const p = path.join(STEP3, d, "step4_result.json");
  if (!fs.existsSync(p)) continue;
  const j = JSON.parse(fs.readFileSync(p, "utf8"));
  for (const s of [...(j.reading || []), ...(j.literature || [])]) newKeys.set(`${d}::${s.id}`, d);
}

const lineCache = {};
function pdfLines(yk) {
  if (lineCache[yk]) return lineCache[yk];
  const dir = path.join(ROOT, "_done", yk);
  const f = fs.readdirSync(dir).find((x) => x.endsWith(".pdf") && x.includes("시험지"));
  const out = path.join(os.tmpdir(), `lines_${yk}.json`);
  if (!fs.existsSync(out))
    execFileSync("python", [path.join(ROOT, "pipeline/pdf_line_ends.py"), path.join(dir, f), out],
      { cwd: ROOT, maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] });
  return (lineCache[yk] = JSON.parse(fs.readFileSync(out, "utf8")).lines);
}

// 앞 조각 꼬리 + 뒤 조각 머리가 PDF 한 줄 안에 있으면 그 줄의 공백 배치를 읽는다
function decideByLine(yk, prev, next) {
  const lines = pdfLines(yk);
  for (const n of [10, 8, 6, 4]) {
    const a = W(prev), b = W(next);
    if (a.length < n || b.length < n) continue;
    const key = a.slice(-n) + b.slice(0, n);
    const hits = [];
    for (const l of lines) {
      const lw = W(l.t);
      const at = lw.indexOf(key);
      if (at < 0) continue;
      // 원문에서 두 조각 사이에 공백이 있었나
      const map = [];
      for (let i = 0; i < l.t.length; i++) if (!/\s/.test(l.t[i])) map.push(i);
      const pos = map[at + n - 1];
      hits.push(/\s/.test(l.t.slice(pos + 1, pos + 2)));
    }
    if (hits.length && hits.every((h) => h === hits[0]))
      return { sp: hits[0], how: `PDF 한 줄 ${n}자` };
  }
  // 두 줄에 걸친 경우 — 앞 줄 끝 공백
  for (const n of [14, 10, 7]) {
    const a = W(prev);
    if (a.length < n) continue;
    const hits = lines.filter((l) => W(l.t).endsWith(a.slice(-n)));
    if (hits.length && hits.every((h) => h.sp === hits[0].sp))
      return { sp: hits[0].sp, how: `PDF 줄 끝 ${n}자` };
  }
  return null;
}

const data = JSON.parse(fs.readFileSync(DATA, "utf8"));
const fixed = [], left = [];

for (const [yk, v] of Object.entries(data))
  for (const sec of ["reading", "literature"])
    for (const s of v[sec] || []) {
      if (!newKeys.has(`${yk}::${s.id}`)) continue;
      for (const x of s.sents || []) {
        const t = String(x.t ?? "");
        if (!t.includes("\n")) continue;
        const parts = t.split("\n");
        let out = parts[0], any = false;
        for (let i = 0; i < parts.length - 1; i++) {
          const d = decideByLine(yk, parts[i], parts[i + 1]);
          if (d === null) {
            left.push({ yk, sid: x.id, a: parts[i].slice(-26), b: parts[i + 1].slice(0, 26) });
            out += "\n" + parts[i + 1];
            continue;
          }
          any = true;
          // 조각 끝/시작의 공백은 이미 문자열에 있을 수 있다 — 중복 공백을 만들지 않는다
          const head = out.replace(/\s+$/, ""), tail = parts[i + 1].replace(/^\s+/, "");
          out = head + (d.sp ? " " : "") + tail;
          fixed.push({ yk, sid: x.id, how: d.how, sp: d.sp, a: parts[i].slice(-22), b: parts[i + 1].slice(0, 22) });
        }
        if (any && APPLY) x.t = out;
      }
    }

console.log(`## 줄바꿈 잔존 건별 대조 ${APPLY ? "적용" : "DRY-RUN"}\n`);
console.log(`### PDF 로 확정 — ${fixed.length}건`);
for (const f of fixed)
  console.log(`  [${f.yk}] ${f.sid}  ${f.sp ? "공백" : "붙임"} (${f.how})\n     …${f.a} ⏎ ${f.b}…`);
console.log(`\n### PDF 로도 판별 불가 — ${left.length}건 (손대지 않음)`);
for (const l of left) console.log(`  [${l.yk}] ${l.sid}\n     …${l.a} ⏎ ${l.b}…`);

if (APPLY && fixed.length) {
  fs.writeFileSync(DATA, JSON.stringify(data), "utf8");
  console.log(`\n  all_data 갱신 ${(fs.statSync(DATA).size / 1048576).toFixed(2)}MB`);
}
if (!APPLY) console.log(`\n### DRY-RUN — 아무것도 쓰지 않았다. 적용하려면 --apply`);
