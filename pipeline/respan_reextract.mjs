// respan_reextract.mjs — 정리된 본문 기준으로 cs_spans 재생성 (발주 2026-08-24 ②)
//
// step4_csids.js --extract-spans 는 all_data 형식({yearKey:{reading,literature}})을
// 읽는다. 재추출 산출물은 {reading,literature} 형식이라 임시 래퍼를 씌워 돌리고
// 결과를 되돌린다. AI 호출 없음(§B-14) — analysis 인용문을 본문에서 찾을 뿐이다.
//
// 순서
//   1. 래퍼 → --extract-spans → 정리된 본문에서 span 재추출 (mergeSpans: 추가만)
//   2. 그래도 본문에서 못 찾는 span 은 **형광펜이 조용히 꺼진 상태**라 제거한다.
//      제거분은 전건 목록으로 남긴다(어떤 근거가 사라졌는지 추적 가능해야 한다).
//
// 사용: node pipeline/respan_reextract.mjs [--only <yearKey>] [--apply]

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const STEP3 = path.join(ROOT, "pipeline/reextract/step3");
const APPLY = process.argv.includes("--apply");
const ONLY = (() => { const i = process.argv.indexOf("--only"); return i > 0 ? process.argv[i + 1] : null; })();

const rounds = fs.readdirSync(STEP3).filter((d) => fs.existsSync(path.join(STEP3, d, "step4_result.json")));
const targets = ONLY ? rounds.filter((r) => r === ONLY) : rounds;

// ── 재정박 ──
//   본문 t 안에서 인용문 q 가 가리키는 구간을 찾아 **본문 원문 부분문자열**을 돌려준다.
//   비교는 표기 차이를 걷어낸 뒤에 하되, 돌려주는 값은 언제나 본문 원문이다.
//   정규화 문자 ↔ 원본 인덱스 대응표를 들고 다녀 원문 경계를 정확히 복원한다.
const QUOTE = /[“”„‟"‘’‚‛']/;
// ㉠㉡㉢…(U+3260~) · ㈀㈎…(U+3200~) · ①ⓐ…(U+2460~U+24FF)
const MARKER = /[㉠-㉾㈀-㈞①-⓿]/;
// 무시할 문자는 **건너뛰기만** 한다 — idx 는 언제나 원본 인덱스를 가리키므로
// 반환값은 항상 본문 원문 구간이 된다(변형본에서 잘라내는 사고 방지).
const HANJA_PAREN = /\([一-鿿豈-﫿][^)]*\)/g;
function normMap(s, dropHanja) {
  // 한자 병기 구간을 미리 표시해 둔다 (인덱스는 원본 그대로 유지)
  const skip = new Set();
  if (dropHanja) {
    HANJA_PAREN.lastIndex = 0;
    let m;
    while ((m = HANJA_PAREN.exec(s)) !== null)
      for (let k = m.index; k < m.index + m[0].length; k++) skip.add(k);
  }
  let out = "", idx = [];
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (skip.has(i)) continue;                   // (立身) 등 한자 병기 무시
    if (/\s/.test(ch)) continue;                 // 공백 무시
    if (MARKER.test(ch)) continue;               // ㉠ ⓐ ① 등 마커 무시
    if (ch === "*" || ch === "(" || ch === ")") continue;  // 각주표·마커 괄호 무시
    if (QUOTE.test(ch)) continue;                // 따옴표 종류 차이 무시
    // 🔴 여기서 out 과 idx 는 반드시 1:1 이어야 한다.
    //    한쪽만 push 하면 idx[at] 매핑이 밀려 경계가 어긋난 span 이 만들어진다.
    out += ch;
    idx.push(i);
  }
  return { out, idx };
}
// 한자 괄호 (漢字) 는 통째로 지운 판도 함께 시도한다
const stripHanja = (s) => s.replace(/\([一-鿿豈-﫿][^)]*\)/g, "");
// step4 는 마커를 꼬리에 괄호로 붙이기도 한다: "상이 크게 근심하사(㉠)"
const stripMarkerParen = (s) => s.replace(/\(\s*[㉠-㉾㈀-㈞①-⓿]\s*\)/g, "");
function reanchor(t, quote) {
  // 한자 병기 무시 여부만 바꿔 두 번 시도한다. 본문 문자열 자체는 절대 바꾸지 않는다.
  for (const dropHanja of [false, true]) {
    const q = quote;
    const A = normMap(t, dropHanja), B = normMap(q, dropHanja);
    if (B.out.length < 4) continue;
    let at = A.out.indexOf(B.out);
    // 인용이 「…」로 잘린 경우 — 앞쪽만으로 맞춰 본다
    if (at < 0 && /(\.\.\.|…)$/.test(q)) {
      const head = normMap(q.replace(/(\.\.\.|…)+$/, "")).out;
      if (head.length >= 8) at = A.out.indexOf(head);
      if (at >= 0) {
        const from = A.idx[at], to = A.idx[at + head.length - 1];
        return t.slice(from, to + 1);
      }
    }
    if (at < 0) continue;
    if (A.out.indexOf(B.out, at + 1) >= 0) continue;   // 두 곳 이상이면 포기(오정박 방지)
    const from = A.idx[at], to = A.idx[at + B.out.length - 1];
    return t.slice(from, to + 1);
  }
  return null;
}

// 표기(공백·괄호·마커·따옴표·한자·생략표)를 걷어낸 뒤 한쪽이 다른 쪽을 품는가.
// 품지 못하면 다른 구절을 가리킨 것이다 — 채택하지 않는다.
const bare = (s) => String(s)
  .replace(/\s/g, "").replace(/[*()]/g, "")
  .replace(/[㉠-㉾㈀-㈞①-⓿]/g, "")
  .replace(/[“”‘’"']/g, "")
  .replace(/[一-鿿豈-﫿]/g, "")
  .replace(/[.…]/g, "");
function sameQuote(a, b) {
  const A = bare(a), B = bare(b);
  if (!A || !B) return false;
  return A === B || A.includes(B) || B.includes(A);
}

const stat = (j) => {
  let span = 0, fail = 0;
  for (const s of [...(j.reading || []), ...(j.literature || [])]) {
    const sm = {}; for (const x of s.sents || []) sm[x.id] = String(x.t ?? "");
    for (const q of s.questions || []) for (const c of q.choices || []) for (const sp of c.cs_spans || []) {
      const t = sm[sp.sent_id]; if (t === undefined) continue;
      span++; if (!t.includes(String(sp.text))) fail++;
    }
  }
  return { span, fail };
};

console.log(`## cs_spans 재생성 ${APPLY ? "적용" : "DRY-RUN"} — ${targets.length}회차\n`);
let b0 = 0, b1 = 0, b2 = 0, gAdd = 0, gDrop = 0, gFix = 0;
const dropped = [];

for (const yk of targets) {
  const p = path.join(STEP3, yk, "step4_result.json");
  const j = JSON.parse(fs.readFileSync(p, "utf8"));
  const s0 = stat(j);

  // ── 1. --extract-spans (래퍼) ──
  const tmp = path.join(os.tmpdir(), `respan_${yk}.json`);
  fs.writeFileSync(tmp, JSON.stringify({ [yk]: { reading: j.reading || [], literature: j.literature || [] } }), "utf8");
  try {
    execFileSync("node", [path.join(ROOT, "pipeline/step4_csids.js"), "--extract-spans", yk, `--data=${tmp}`],
      { cwd: ROOT, maxBuffer: 256 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] });
  } catch (e) {
    console.log(`  ${yk.padEnd(11)} 🔴 extract-spans 실패: ${String(e.stderr || e.message).slice(0, 100)}`);
    continue;
  }
  const back = JSON.parse(fs.readFileSync(tmp, "utf8"))[yk];
  const j1 = { ...j, reading: back.reading, literature: back.literature };
  // 🔴 extract-spans 는 analysis 인용문을 다시 찾아 같은 자리 span 을 덮어쓸 수 있다.
  //    덮어쓴 값이 원래 인용과 **다른 구절**이면 형광펜이 엉뚱한 곳에 켜지므로 되돌린다.
  //    (실측 3건: "일인 주주가 회사의 대표 이사가…" → "일인 주식회사")
  let revert = 0;
  {
    const before = new Map();
    for (const s of [...(j.reading || []), ...(j.literature || [])])
      for (const q of s.questions || []) for (const c of q.choices || [])
        for (const sp of c.cs_spans || [])
          before.set(`${s.id}|${q.id}|${c.num}|${sp.sent_id}|${sp.occurrence || 1}`, String(sp.text));
    for (const s of [...(j1.reading || []), ...(j1.literature || [])])
      for (const q of s.questions || []) for (const c of q.choices || [])
        for (const sp of c.cs_spans || []) {
          const k = `${s.id}|${q.id}|${c.num}|${sp.sent_id}|${sp.occurrence || 1}`;
          const was = before.get(k);
          if (was === undefined || was === sp.text) continue;
          if (!sameQuote(was, sp.text)) { sp.text = was; revert++; }
        }
  }
  const s1 = stat(j1);

  // ── 2. 재정박 — span.text 를 **본문 원문 구간으로 교체** ──
  //   step4 가 만든 인용문은 마커를 빼고(㉢ 성진이 → 성진이), 큰따옴표를 작은따옴표로
  //   바꾸고, 한자 병기를 지운 「읽기 좋은 인용」이다. 그래서 본문에 그대로는 없다.
  //   여기서는 **텍스트를 만들지 않는다** — 본문에서 그 구절이 실제로 있는 위치를
  //   찾아, span.text 를 그 자리의 **원문 그대로**로 맞춘다(§13⑬ 준수).
  let fix = 0;
  for (const s of [...(j1.reading || []), ...(j1.literature || [])]) {
    const sm = {}; for (const x of s.sents || []) sm[x.id] = String(x.t ?? "");
    for (const q of s.questions || []) for (const c of q.choices || []) for (const sp of c.cs_spans || []) {
      const t = sm[sp.sent_id];
      if (t === undefined || t.includes(String(sp.text))) continue;
      const hit = reanchor(t, String(sp.text));
      // 🔴 가드 — 정박 결과가 원래 인용과 **다른 구절**이면 채택하지 않는다.
      //    표기·범위 차이는 허용하되, 내용이 바뀌면 형광펜이 엉뚱한 곳에 켜진다.
      if (hit && sameQuote(String(sp.text), hit)) { sp.text = hit; fix++; }
    }
  }

  // ── 3. 그래도 못 찾는 span 제거 ──
  let drop = 0;
  for (const s of [...(j1.reading || []), ...(j1.literature || [])]) {
    const sm = {}; for (const x of s.sents || []) sm[x.id] = String(x.t ?? "");
    for (const q of s.questions || []) for (const c of q.choices || []) {
      if (!Array.isArray(c.cs_spans) || !c.cs_spans.length) continue;
      const keep = [];
      for (const sp of c.cs_spans) {
        const t = sm[sp.sent_id];
        if (t !== undefined && !t.includes(String(sp.text))) {
          drop++;
          dropped.push({ yk, set: s.id, q: q.id, c: c.num, sid: sp.sent_id, text: String(sp.text) });
          continue;
        }
        keep.push(sp);
      }
      c.cs_spans = keep;
    }
  }
  const s2 = stat(j1);
  if (APPLY) fs.writeFileSync(p, JSON.stringify(j1, null, 2), "utf8");

  const add = s1.span - s0.span;
  console.log(`  ${yk.padEnd(11)} span ${s0.span} → ${s1.span} (+${add}) · 실패 ${s0.fail} → 재추출 ${s1.fail}(되돌림 ${revert}) → 재정박 ${fix}건 → 남은 ${s2.fail + drop} → 제거 ${drop}`);
  b0 += s0.fail; b1 += s1.fail; b2 += s2.fail; gAdd += add; gDrop += drop; gFix += fix;
}

console.log(`\n## 합계`);
console.log(`   span 추가          +${gAdd}`);
console.log(`   실패 ${b0} → 재추출 후 ${b1} → **재정박 ${gFix}건 복구** → 남은 ${b2 + gDrop}`);
console.log(`   제거된 깨진 span   ${gDrop}건`);

if (dropped.length) {
  const rp = path.join(ROOT, "docs/csspan_dropped_20260824.md");
  const md = ["# 제거된 cs_spans 전건 (2026-08-24)", "",
    "> 본문 정리 + `--extract-spans` 재추출 후에도 문장에서 찾지 못한 span.",
    "> 남겨 두면 **형광펜이 조용히 꺼진 채** 화면에 아무 표시도 안 된다(CS_SPAN_UNRESOLVED).",
    "> `cs_ids` 는 유지되므로 문장 단위 근거는 남는다 — 사라지는 것은 문장 안 구절 강조뿐이다.", "",
    `총 ${dropped.length}건`, "", "| 회차 | 세트 | 문항 | 선지 | 문장 | 못 찾은 구절 |", "|---|---|--:|--:|---|---|"];
  for (const d of dropped)
    md.push(`| ${d.yk} | ${d.set} | ${d.q} | ${d.c} | ${d.sid} | ${d.text.slice(0, 60).replace(/\|/g, "\\|")} |`);
  fs.writeFileSync(rp, md.join("\n"), "utf8");
  console.log(`   전건 목록 → docs/csspan_dropped_20260824.md`);
}
if (!APPLY) console.log(`\n### DRY-RUN — 아무것도 쓰지 않았다. 적용하려면 --apply`);
