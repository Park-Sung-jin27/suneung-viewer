// respan_alldata.mjs — 병합된 all_data 안에서 깨진 cs_spans 재정박 (발주 D-100 ③ 후속)
//
// 잔존 수리로 본문(sent.t)의 공백이 바뀌면 그 문장을 가리키던 span 이 어긋난다.
// respan_reextract.mjs 와 **같은 재정박 원리**를 all_data 에 적용한다:
//   텍스트를 만들지 않는다 — 본문에서 그 구절이 실제로 있는 위치를 찾아
//   span.text 를 그 자리 원문 그대로로 맞춘다. 내용이 달라지면 채택하지 않는다.
//
// 사용: node pipeline/respan_alldata.mjs [--apply]

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = path.join(ROOT, "public/data/all_data_204.json");
const STEP3 = path.join(ROOT, "pipeline/reextract/step3");
const APPLY = process.argv.includes("--apply");

const QUOTE = /[“”„‟"‘’‚‛']/;
const MARKER = /[㉠-㉾㈀-㈞①-⓿]/;
const HANJA_PAREN = /\([一-鿿豈-﫿][^)]*\)/g;
const BRACKET = /\[[A-Z]\]/g;
function normMap(s, dropHanja) {
  const skip = new Set();
  BRACKET.lastIndex = 0;
  let bm;
  while ((bm = BRACKET.exec(s)) !== null)
    for (let k = bm.index; k < bm.index + bm[0].length; k++) skip.add(k);
  if (dropHanja) {
    HANJA_PAREN.lastIndex = 0;
    let m;
    while ((m = HANJA_PAREN.exec(s)) !== null)
      for (let k = m.index; k < m.index + m[0].length; k++) skip.add(k);
  }
  let out = "", idx = [];
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (skip.has(i) || /\s/.test(ch) || MARKER.test(ch)) continue;
    if (ch === "*" || ch === "(" || ch === ")" || QUOTE.test(ch)) continue;
    out += ch; idx.push(i);          // out 과 idx 는 반드시 1:1
  }
  return { out, idx };
}
function reanchor(t, quote) {
  for (const dropHanja of [false, true]) {
    const A = normMap(t, dropHanja), B = normMap(quote, dropHanja);
    if (B.out.length < 4) continue;
    let at = A.out.indexOf(B.out);
    if (at < 0 && /(\.\.\.|…)$/.test(quote)) {
      const head = normMap(quote.replace(/(\.\.\.|…)+$/, ""), dropHanja).out;
      if (head.length >= 8) at = A.out.indexOf(head);
      if (at >= 0) return t.slice(A.idx[at], A.idx[at + head.length - 1] + 1);
    }
    if (at < 0) continue;
    if (A.out.indexOf(B.out, at + 1) >= 0) continue;   // 두 곳 이상이면 포기
    return t.slice(A.idx[at], A.idx[at + B.out.length - 1] + 1);
  }
  return null;
}
const bare = (s) => String(s).replace(/\s/g, "").replace(/\[[A-Z]\]/g, "").replace(/[*()]/g, "")
  .replace(/[㉠-㉾㈀-㈞①-⓿]/g, "").replace(/[“”‘’"']/g, "")
  .replace(/[一-鿿豈-﫿]/g, "").replace(/[.…]/g, "");
const sameQuote = (a, b) => {
  const A = bare(a), B = bare(b);
  return !!A && !!B && (A === B || A.includes(B) || B.includes(A));
};

// 신규 43세트만 대상
const newKeys = new Set();
for (const d of fs.readdirSync(STEP3)) {
  const p = path.join(STEP3, d, "step4_result.json");
  if (!fs.existsSync(p)) continue;
  const j = JSON.parse(fs.readFileSync(p, "utf8"));
  for (const s of [...(j.reading || []), ...(j.literature || [])]) newKeys.add(`${d}::${s.id}`);
}

const data = JSON.parse(fs.readFileSync(DATA, "utf8"));
let fixed = 0, left = 0;
const rows = [];
for (const [yk, v] of Object.entries(data))
  for (const sec of ["reading", "literature"])
    for (const s of v[sec] || []) {
      if (!newKeys.has(`${yk}::${s.id}`)) continue;
      const sm = {}; for (const x of s.sents || []) sm[x.id] = String(x.t ?? "");
      for (const q of s.questions || []) for (const c of q.choices || []) {
        if (!Array.isArray(c.cs_spans)) continue;
        for (const sp of c.cs_spans) {
          const t = sm[sp.sent_id];
          if (t === undefined || t.includes(String(sp.text))) continue;
          const hit = reanchor(t, String(sp.text));
          if (hit && sameQuote(String(sp.text), hit)) {
            rows.push({ yk, sid: s.id, q: q.id, c: c.num, sent: sp.sent_id, from: String(sp.text), to: hit });
            if (APPLY) sp.text = hit;
            fixed++;
          } else {
            rows.push({ yk, sid: s.id, q: q.id, c: c.num, sent: sp.sent_id, from: String(sp.text), to: null });
            left++;
          }
        }
      }
    }
console.log(`## all_data 재정박 ${APPLY ? "적용" : "DRY-RUN"} — 복구 ${fixed} · 실패 ${left}\n`);
for (const r of rows) {
  console.log(`  [${r.yk}] ${r.sid} Q${r.q}#${r.c} ${r.sent}`);
  console.log(`     전: ${r.from.slice(0, 62)}`);
  console.log(`     후: ${r.to === null ? "🔴 정박 실패 — 손대지 않음" : r.to.slice(0, 62)}`);
}
if (APPLY && fixed) {
  fs.writeFileSync(DATA, JSON.stringify(data), "utf8");
  console.log(`\n  all_data 갱신 ${(fs.statSync(DATA).size / 1048576).toFixed(2)}MB`);
}
if (!APPLY) console.log(`\n### DRY-RUN — 아무것도 쓰지 않았다. 적용하려면 --apply`);
