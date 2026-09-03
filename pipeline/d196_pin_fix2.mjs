// d196_pin_fix2.mjs — 남은 📌 규약 위반 2건 수리 (발주 D-196 · Q26 수리와 같은 계열)
//
// 세트 전체를 quoteResolved 로 훑어 남은 미해소 4건의 원인을 갈랐다.
//   🔴 고칠 것 2건 — 원문에 없는 형태다
//      Q25#2 : 인용 끝에 원문에 없는 닫는 부호를 붙였다(Q26#1 과 같은 계열)
//      Q26#5 : 두 번째 인용에 「우람하여… 남이」로 말줄임 생략을 넣었다. 📌 는 연속 원문이어야 한다
//   🟡 두는 것 2건 — 인용은 원문 그대로이고 검출기가 못 잡는 것이다
//      Q25#3 · Q27#5 : 이 산문 지문은 조판 줄이 「근심 / 하고,」처럼 **단어 중간**에서 끊긴다.
//        quoteResolved 의 sents~ 는 문장을 하나씩만 보고, marker~ 는 stripMarks 가 공백을
//        한 칸으로 **줄이므로**(제거가 아님) 이어붙인 원문과 어긋난다. 어떻게 인용해도
//        이 구간은 해소되지 않는다 — 인용을 비틀어 게이트를 통과시키지 않는다.
//
// 인용문은 손으로 치지 않고 본문에서 잘라낸다(Q26 수리와 같은 방식).
//
// 사용: node pipeline/d196_pin_fix2.mjs [--apply]

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "pipeline/test_data/d196_l20279b/step3_result.json");
const SID = "l20279b";
const APPLY = process.argv.includes("--apply");
const md5 = (s) => crypto.createHash("md5").update(s).digest("hex");

const raw = fs.readFileSync(SRC, "utf8");
const j = JSON.parse(raw);
const set = (j.literature || []).find((x) => (x.setId || x.id) === SID);
const JOINED = (set.sents || []).map((s) => String(s.t)).join(" ");
const RE_CLOSER = /[”’]/;
const fail = [];
function carve(startAt, endAfter) {
  const i = JOINED.indexOf(startAt);
  if (i < 0) { fail.push(`시작 어구 없음: ${startAt}`); return ""; }
  if (JOINED.indexOf(startAt, i + 1) >= 0) { fail.push(`시작 어구가 두 곳 이상: ${startAt}`); return ""; }
  const k = JOINED.indexOf(endAfter, i);
  if (k < 0) { fail.push(`끝 어구 없음: ${endAfter}`); return ""; }
  let end = k + endAfter.length;
  if (RE_CLOSER.test(JOINED[end] || "")) end += 1;
  return JOINED.slice(i, end);
}

const child = carve("한 아이가 뜰에서 놀다가", "꼭 별 같단다.");
const friend = carve("그 동무가 자기 귀를 기울여", "한스럽게 여겼다.");
const snore = carve("남이 흔들어 깨우자", "그런 적 없소이다!");

const SPEC = [
  { qId: "25", num: 2, frag: "한 아이가 뜰에서", line: () => `📌 지문 근거: "${child}"` },
  { qId: "26", num: 5, frag: "우람하여", line: () => `📌 지문 근거: "${friend}" / "${snore}"` },
];

console.log("# 남은 📌 규약 위반 수리 (D-196)");
console.log("");
console.log(`- 원천 MD5 \`${md5(raw)}\``);
console.log("");

const plans = [];
for (const S of SPEC) {
  const q = (set.questions || []).find((x) => String(x.id) === S.qId);
  const c = q && (q.choices || []).find((x) => x.num === S.num);
  if (!c) { fail.push(`Q${S.qId}#${S.num} 없음`); continue; }
  const lines = String(c.analysis).split("\n");
  const hits = lines.map((l, i) => [l, i]).filter(([l]) => l.includes("📌") && l.includes(S.frag));
  if (hits.length !== 1) { fail.push(`Q${S.qId}#${S.num} 대상 📌 줄이 ${hits.length}곳`); continue; }
  const [before, idx] = hits[0];
  const after = S.line();
  if (after.includes("…") || after.includes(" ~ ")) { fail.push(`Q${S.qId}#${S.num} 결과에 생략·이음 기호가 남았다`); continue; }
  plans.push({ ...S, c, idx, before, after, lines });
  console.log(`**Q${S.qId}#${S.num}**`);
  console.log("```");
  console.log("전: " + before);
  console.log("후: " + after);
  console.log("```");
  console.log("");
}
if (fail.length || plans.length !== SPEC.length) {
  console.log("## 🔴 사전 검사 실패 — 아무것도 쓰지 않는다");
  fail.forEach((x) => console.log(`- ${x}`));
  process.exit(1);
}
console.log("✅ 사전 검사 통과 — 2건");
console.log("");
if (!APPLY) { console.log("### 미리보기 — 아무것도 쓰지 않았다. `--apply`"); process.exit(0); }

fs.writeFileSync(SRC + ".before_pinfix2", raw, "utf8");
for (const p of plans) { p.lines[p.idx] = p.after; p.c.analysis = p.lines.join("\n"); }
fs.writeFileSync(SRC, JSON.stringify(j, null, 2), "utf8");

const back = JSON.parse(fs.readFileSync(SRC, "utf8"));
const pre = JSON.parse(raw);
const bad = [];
for (const p of plans) {
  const c = back.literature.find((x) => (x.setId || x.id) === SID).questions.find((x) => String(x.id) === p.qId).choices.find((x) => x.num === p.num);
  const la = String(c.analysis).split("\n");
  const pc = pre.literature.find((x) => (x.setId || x.id) === SID).questions.find((x) => String(x.id) === p.qId).choices.find((x) => x.num === p.num);
  const lb = String(pc.analysis).split("\n");
  if (la.length !== lb.length) bad.push(`Q${p.qId}#${p.num} 줄 수가 달라졌다`);
  for (let i = 0; i < la.length; i++) {
    if (i === p.idx) { if (la[i] !== p.after) bad.push(`Q${p.qId}#${p.num} 📌 줄이 계획과 다르다`); continue; }
    if (la[i] !== lb[i]) bad.push(`Q${p.qId}#${p.num} ${i}번째 줄이 달라졌다`);
  }
  if (c.ok !== pc.ok || JSON.stringify(c.pat) !== JSON.stringify(pc.pat)) bad.push(`Q${p.qId}#${p.num} ok·pat 이 달라졌다`);
}
for (const sec of ["reading", "literature"]) for (const s of pre[sec] || []) {
  const sid = s.setId || s.id;
  const cur = (back[sec] || []).find((x) => (x.setId || x.id) === sid);
  for (const oq of s.questions || []) for (const oc of oq.choices || []) {
    if (SPEC.some((S) => sid === SID && S.qId === String(oq.id) && S.num === oc.num)) continue;
    const cc = (cur?.questions || []).find((x) => String(x.id) === String(oq.id))?.choices.find((x) => x.num === oc.num);
    if (JSON.stringify(oc) !== JSON.stringify(cc)) bad.push(`${sid} Q${oq.id}#${oc.num} 가 달라졌다`);
  }
}
console.log(`- 적용 후 MD5 \`${md5(fs.readFileSync(SRC, "utf8"))}\``);
if (bad.length) { console.log("## 🔴 되읽기 검산 실패"); bad.forEach((x) => console.log(`- ${x}`)); process.exit(1); }
console.log("## ✅ 되읽기 검산 통과 — 📌 두 줄만 교체 · 그 외 전건 무변");
