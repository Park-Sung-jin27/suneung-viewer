// join_d102.mjs — MeCab 후보 건별 처리 (발주 D-102)
//
// 심사관이 클라우드에서 돌린 MeCab 판정 결과를 받아 **건별로** 처리한다.
// 파일 주의사항: 「자동 일괄 적용 금지. 각 건은 PDF 줄끝 공백 증거 우선,
//                 없으면 어법 판단. 으로서/로서/에서의 등 복합조사와 고전어는
//                 MeCab 이 오분석한다.」
//
// 처리 원칙 (D-101 방식 그대로)
//   ① PDF 줄 끝 공백 — 그 자리가 PDF 에서 **한 줄 안**에 있으면 그 공백 배치가 정답.
//      두 줄에 걸치면 앞 줄 끝 공백을 본다. 단 blockLast 줄은 근거가 못 된다
//      (PyMuPDF 가 줄마다 블록을 쪼개 어절 경계에서도 공백 없이 끝난다 — D-101 규명).
//   ② 증거가 없으면 어법 — 판정과 근거를 한 줄로 남긴다.
//   ③ **기존 353세트는 손대지 않는다.** 「기존 변동 0」 원칙. 판정만 보고한다.
//
// 사용: node pipeline/join_d102.mjs [--group <키>] [--apply]

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = path.join(ROOT, "data-source/all_data_204.json");
const STEP3 = path.join(ROOT, "pipeline/reextract/step3");
const CAND = "C:/Users/downf/suneung-viewer/pipeline/test_data/join_mecab_candidates.json";
const APPLY = process.argv.includes("--apply");
const GROUP = (() => { const i = process.argv.indexOf("--group"); return i > 0 ? process.argv[i + 1] : null; })();
const W = (s) => String(s).replace(/\s/g, "");

// ── 건별 판정 확정표 (아래 REPORT 를 보고 사람이 채운다) ──
//   "yk|sid|q|where|앞▸뒤" → { sp: true(띄움)/false(붙임유지), why: "근거" }
const VERDICT = JSON.parse(
  fs.existsSync(path.join(ROOT, "pipeline/join_d102_verdict.json"))
    ? fs.readFileSync(path.join(ROOT, "pipeline/join_d102_verdict.json"), "utf8")
    : "{}");

const newKeys = new Set();
for (const d of fs.readdirSync(STEP3)) {
  const p = path.join(STEP3, d, "step4_result.json");
  if (!fs.existsSync(p)) continue;
  const x = JSON.parse(fs.readFileSync(p, "utf8"));
  for (const s of [...(x.reading || []), ...(x.literature || [])]) newKeys.add(`${d}::${s.id}`);
}

// ── PDF 줄 정보 (회차별 캐시) ──
const lineCache = {};
function pdfLines(yk) {
  if (yk in lineCache) return lineCache[yk];
  const dir = path.join(ROOT, "_done", yk);
  if (!fs.existsSync(dir)) return (lineCache[yk] = null);
  const f = fs.readdirSync(dir).find((x) => x.endsWith(".pdf") && x.includes("시험지"));
  if (!f) return (lineCache[yk] = null);
  const out = path.join(os.tmpdir(), `lines_${yk}.json`);
  if (!fs.existsSync(out))
    execFileSync("python", [path.join(ROOT, "pipeline/pdf_line_ends.py"), path.join(dir, f), out],
      { cwd: ROOT, maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] });
  return (lineCache[yk] = JSON.parse(fs.readFileSync(out, "utf8")).lines);
}

// 그 자리가 PDF 한 줄 안에 있으면 원문의 공백 배치를 읽는다
function pdfEvidence(yk, a, b) {
  const lines = pdfLines(yk);
  if (!lines) return null;
  for (const n of [8, 6, 5, 4]) {
    const A = W(a), B = W(b);
    if (A.length < n || B.length < n) continue;
    const key = A.slice(-n) + B.slice(0, n);
    const votes = [];
    for (const l of lines) {
      const lw = W(l.t);
      const at = lw.indexOf(key);
      if (at < 0) continue;
      const map = [];
      for (let i = 0; i < l.t.length; i++) if (!/\s/.test(l.t[i])) map.push(i);
      const pos = map[at + n - 1];
      votes.push(/\s/.test(l.t.slice(pos + 1, pos + 2)));
    }
    if (votes.length && votes.every((v) => v === votes[0]))
      return { sp: votes[0], how: `PDF 한 줄 ${n}자` };
  }
  // 두 줄에 걸친 경우 — 앞 줄 끝 공백이 **있을 때만** 근거로 쓴다(없음은 근거가 못 된다)
  for (const n of [12, 9, 7]) {
    const A = W(a);
    if (A.length < n) continue;
    const hits = lines.filter((l) => W(l.t).endsWith(A.slice(-n)));
    if (hits.length && hits.every((h) => h.sp)) return { sp: true, how: `PDF 줄 끝 공백 ${n}자` };
  }
  return null;
}

const data = JSON.parse(fs.readFileSync(DATA, "utf8"));
const ref = (yk, sid, qid, where) => {
  for (const sec of ["reading", "literature"]) {
    const s = (data[yk]?.[sec] || []).find((x) => x.id === sid);
    if (!s) continue;
    const q = (s.questions || []).find((x) => String(x.id) === String(qid));
    if (!q) return null;
    if (where === "q") return { get: () => String(q.t ?? ""), set: (v) => { q.t = v; } };
    if (where === "bogi") {
      if (typeof q.bogi === "string") return { get: () => q.bogi, set: (v) => { q.bogi = v; } };
      if (q.bogi && typeof q.bogi === "object" && !Array.isArray(q.bogi)) {
        for (const k of Object.keys(q.bogi))
          if (typeof q.bogi[k] === "string") return { get: () => q.bogi[k], set: (v) => { q.bogi[k] = v; } };
      }
      return null;
    }
    const m = where.match(/^c(\d+)$/);
    if (m) {
      const c = (q.choices || []).find((x) => String(x.num) === m[1]);
      return c ? { get: () => String(c.t ?? ""), set: (v) => { c.t = v; } } : null;
    }
    return null;
  }
  return null;
};

const cand = JSON.parse(fs.readFileSync(CAND, "utf8"));
const groups = GROUP ? { [GROUP]: cand[GROUP] } : cand;
let applied = 0;
const dirty = new Set();

for (const [gname, arr] of Object.entries(groups)) {
  if (!Array.isArray(arr)) continue;
  console.log(`\n${"═".repeat(70)}\n## ${gname} — ${arr.length}건\n`);
  for (const [yk, sid, qid, where, pair] of arr) {
    const key = `${yk}|${sid}|${qid}|${where}|${pair}`;
    const zone = newKeys.has(`${yk}::${sid}`) ? "신규" : "기존";
    const [a, b] = pair.split(/[▸|]/);
    const r = ref(yk, sid, qid, where);
    if (!r) { console.log(`  🔴 ${zone} ${yk} ${sid} Q${qid} ${where} — 대상 없음  (${pair})`); continue; }
    const cur = r.get();
    const cw = W(cur);
    const at = cw.indexOf(W(a) + W(b));
    if (at < 0) { console.log(`  ⚠ ${zone} ${yk} ${sid} Q${qid} ${where} — 붙은 형태 없음(이미 처리?)  (${pair})`); continue; }
    const map = [];
    for (let i = 0; i < cur.length; i++) if (!/\s/.test(cur[i])) map.push(i);
    const pos = map[at + W(a).length - 1];

    const ev = pdfEvidence(yk, a, b);
    const v = VERDICT[key];
    const decided = v ? { sp: v.sp, how: `판정: ${v.why}` } : ev;
    const mark = decided === null ? "❓" : decided.sp ? "띄움" : "붙임";
    console.log(`  [${zone}] ${yk} ${sid} Q${qid} ${where}  ${pair}`);
    console.log(`      현재: …${cur.slice(Math.max(0, pos - 24), pos + 26).replace(/\n/g, "⏎")}…`);
    console.log(`      ${mark}  ${decided ? decided.how : "증거·판정 없음 — 손대지 않음"}`);

    if (!decided || !decided.sp) continue;
    if (zone === "기존") { console.log(`      ⛔ 기존 세트 — 「기존 변동 0」 원칙상 손대지 않는다`); continue; }
    if (APPLY) { r.set(cur.slice(0, pos + 1) + " " + cur.slice(pos + 1)); dirty.add(yk); }
    applied++;
  }
}

if (APPLY && applied) {
  fs.writeFileSync(DATA, JSON.stringify(data), "utf8");
  console.log(`\n  all_data 갱신 ${(fs.statSync(DATA).size / 1048576).toFixed(2)}MB · 교정 ${applied}건`);
} else {
  console.log(`\n## 교정 대상 ${applied}건 ${APPLY ? "" : "(DRY-RUN — 아무것도 쓰지 않았다)"}`);
}
