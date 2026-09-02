// d190_w4a_apply.mjs — 2027_9월 l20279c 수리 (발주 D-190 W4 분할 · 오늘분)
//
// 결함 7건 — [A]~[E] 미정박 5건 + Q29#5 cs_span 1건 + (s1·title 해당 없음: 문학)
//
// ★ 구간은 원본 PDF p10 판독으로만 정했다 (D-104)
//   라벨 [A]~[D] 는 좌단(x≈95)에, [E] 는 우단(x≈444)에 있고, 각각 **들여쓴 대화
//   블록**(x≈126.5) 옆에 세로 중앙 배치된 조판이다. l20279a 와 같은 형태로,
//   원본에 꺾쇠 세로선은 그려져 있지 않다(x87.9·405.4 선은 지문 박스 테두리이며
//   줄마다 세그먼트로 그려진다 — 꺾쇠가 아니다).
//   라벨 중앙 y 와 들여쓴 연속 블록의 중앙 y 가 맞는 것으로 구간을 확정했다.
//
//     [A] 라벨중앙 530.3 ↔ 블록 514.4·532.8            (2행)
//     [B] 라벨중앙 658.6 ↔ 블록 643.1·661.4            (2행)
//     [C] 라벨중앙 769.1 ↔ 블록 753.4·771.7            (2행)
//     [D] 라벨중앙 888.1 ↔ 블록 863.6·882.0·900.4      (3행)
//     [E] 라벨중앙 183.2 ↔ 블록 158.8·177.1·195.5      (3행, 우단)
//
// ★ 독립 교차 검증 — 데이터가 같은 답을 말한다
//   Q29#5 선지가 「[E]에서 … [B]에서도」인데 그 cs_ids 가
//   [s36 s37 s38] + [s13 s14] 다. 내 [E]·[B] 판독과 정확히 일치한다.
//   이 도구는 그 일치를 사전 대조에서 기계로 확인한 뒤에만 쓴다.
//
// ★ cs_span 은 어구를 고친다 — 「당구 삼 년에 음풍월」 이 원문에 없다.
//   원문은 「당구(堂狗) 삼 년에 음풍월」 로 한자 괄호가 빠져 있었다(l20279d 客懷 와 같은 유형).
//   본문에서 잘라내 쓴다. 재타이핑하지 않는다.
//
// 사용: node pipeline/d190_w4a_apply.mjs [--apply]

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = path.join(ROOT, "public/data/all_data_204.json");
const ANN = path.join(ROOT, "public/data/annotations.json");
const APPLY = process.argv.includes("--apply");
const md5 = (b) => crypto.createHash("md5").update(b).digest("hex");
const YK = "2027_9월", SID = "l20279c";

const BRACKETS = [
  { label: "A", from: "l20279cs6", to: "l20279cs7", head: "마누라가 방에서 고개를 내밀었다.", tail: "“덕근 어메도 잘 있고 덕근이 남매도 잘 있다고 했소?”" },
  { label: "B", from: "l20279cs13", to: "l20279cs14", head: "“그러면 그렇지, 우리같이 없는 놈이 어디 가면 별수", tail: "있을라고.”" },
  { label: "C", from: "l20279cs19", to: "l20279cs20", head: "“어째서 그럴까? 지어 논 집에 논 스무 마지기씩 주고", tail: "소 한 마리씩 주고 왼통 농사 기계 다 주고 그런다는디.”" },
  { label: "D", from: "l20279cs25", to: "l20279cs27", head: "“그리고 장난감같이 생긴 삽 하나, 쇠스랑 하나, 괭이 하나,", tail: "버리드라네그랴.”" },
  { label: "E", from: "l20279cs36", to: "l20279cs38", head: "“흥, 당구(堂狗) 삼 년에 음풍월이라더니 작년 내― 하도", tail: "썩 유식해졌네.”" },
];

// 교차 검증 — Q29#5 cs_ids 가 [E]+[B] 구간과 같아야 한다
const CROSS = { qid: 29, num: 5, labels: ["E", "B"] };

const Q = (s) => s.replace(/[‘’‚‛']/g, "'").replace(/[“”„‟"]/g, '"');
// 정규화 — 공백과 한자 괄호를 건너뛰되 원문 인덱스는 그대로 들고 간다.
//   span 이 「당구 삼 년에 음풍월」처럼 한자 괄호를 생략한 축약형이라 그냥은 못 찾는다.
//   괄호를 건너뛰고 위치를 잡으면, 잘라낸 원문에는 괄호가 자연히 **포함**된다
//   → 「당구(堂狗) 삼 년에 음풍월」. 형광펜은 원문 일치가 필요하므로 이게 맞다.
const HANJA_PAREN = /^\([一-鿿]+\)/;
function normMap(s) {
  let out = ""; const map = []; const q = Q(s);
  for (let i = 0; i < q.length; i++) {
    if (/\s/.test(q[i])) continue;
    if (q[i] === "(") {
      const m = q.slice(i).match(HANJA_PAREN);
      if (m) { i += m[0].length - 1; continue; }
    }
    out += q[i]; map.push(i);
  }
  return { out, map };
}
const normPlain = (s) => normMap(s).out;
function carve(sent, needleRaw) {
  const { out, map } = normMap(sent);
  const needle = normPlain(needleRaw);
  if (!needle) return null;
  const at = out.indexOf(needle);
  if (at < 0) return null;
  if (out.indexOf(needle, at + 1) >= 0) return { ambiguous: true };
  return { text: sent.slice(map[at], map[at + needle.length - 1] + 1) };
}

const beforeData = fs.readFileSync(DATA);
const beforeAnn = fs.readFileSync(ANN);
const data = JSON.parse(beforeData.toString("utf8"));
const ann = JSON.parse(beforeAnn.toString("utf8"));
const set = (data[YK]?.literature || []).find((x) => (x.setId || x.id) === SID);

console.log(`# ${SID} 수리 — [A]~[E] 정박 5건 + cs_span 1건 (D-190 W4a)`);
console.log("");
console.log(`- all_data MD5 \`${md5(beforeData)}\` · annotations MD5 \`${md5(beforeAnn)}\``);
console.log("");

const miss = [];
if (!set) { console.log("🔴 세트 없음"); process.exit(1); }
const sents = set.sents || [];
const idx = new Map(sents.map((x, i) => [String(x.id), i]));
const byId = new Map(sents.map((x) => [String(x.id), String(x.t)]));

console.log("## 구간 대조 (원본 p10 판독 ↔ 데이터)");
console.log("");
console.log("| 라벨 | 시작 | 끝 | 행수 | 첫 행 | 끝 행 |");
console.log("|---|---|---|--:|---|---|");
for (const b of BRACKETS) {
  const i0 = idx.get(b.from), i1 = idx.get(b.to);
  if (i0 == null) { miss.push(`${b.from} 없음`); continue; }
  if (i1 == null) { miss.push(`${b.to} 없음`); continue; }
  if (i1 < i0) { miss.push(`[${b.label}] 시작이 끝보다 뒤다`); continue; }
  if (byId.get(b.from).trim() !== b.head) { miss.push(`[${b.label}] 첫 행이 판독본과 다르다`); continue; }
  if (byId.get(b.to).trim() !== b.tail) { miss.push(`[${b.label}] 끝 행이 판독본과 다르다`); continue; }
  if ((ann[YK]?.[SID] || []).some((a) => a.type === "bracket" && a.label === b.label)) { miss.push(`[${b.label}] 이미 등재`); continue; }
  let used = false;
  for (const q of set.questions || []) {
    let t = String(q.t || ""); for (const c of q.choices || []) t += String(c.t || "");
    if (t.includes(`[${b.label}]`)) used = true;
  }
  if (!used) { miss.push(`[${b.label}] 을 쓰는 문항이 없다`); continue; }
  b._n = i1 - i0 + 1; b._i0 = i0; b._i1 = i1;
  console.log(`| [${b.label}] | \`${b.from}\` | \`${b.to}\` | ${b._n} | ${b.head.slice(0, 22)}… | …${b.tail.slice(-16)} |`);
}
console.log("");

// ── 교차 검증 ───────────────────────────────────────────────────────────
console.log("## 교차 검증 — Q29#5 cs_ids 가 판독 구간과 같은가");
console.log("");
{
  const c = set.questions?.find((q) => q.id === CROSS.qid)?.choices?.find((x) => x.num === CROSS.num);
  if (!c) miss.push(`Q${CROSS.qid}#${CROSS.num} 선지 없음`);
  else {
    const want = [];
    for (const L of CROSS.labels) {
      const b = BRACKETS.find((x) => x.label === L);
      for (let i = b._i0; i <= b._i1; i++) want.push(String(sents[i].id));
    }
    const got = (c.cs_ids || []).map(String);
    const same = want.length === got.length && want.every((x, i) => x === got[i]);
    console.log(`- 선지: ${c.t.replace(/\n/g, " ")}`);
    console.log(`- 판독 [${CROSS.labels.join("]+[")}] → ${JSON.stringify(want)}`);
    console.log(`- 데이터 cs_ids        → ${JSON.stringify(got)}`);
    console.log(`- ${same ? "✅ **완전 일치** — 판독이 데이터와 독립으로 맞는다" : "🔴 불일치"}`);
    if (!same) miss.push("교차 검증 실패 — Q29#5 cs_ids 가 판독 구간과 다르다");
  }
}
console.log("");

// ── cs_span 정정 ────────────────────────────────────────────────────────
console.log("## cs_span 어구 정정 — 본문에서 잘라낸다");
console.log("");
const spanPlans = [];
for (const q of set.questions || [])
  for (const c of q.choices || [])
    (c.cs_spans || []).forEach((sp) => {
      const sent = byId.get(String(sp.sent_id));
      if (sent == null) { miss.push(`Q${q.id}#${c.num} ${sp.sent_id} 문장 없음`); return; }
      if (sent.includes(sp.text)) return;
      const r = carve(sent, sp.text);
      if (!r) { miss.push(`🔴 Q${q.id}#${c.num} ${sp.sent_id} — 본문에서 못 찾는다: ${JSON.stringify(sp.text.slice(0, 36))}`); return; }
      if (r.ambiguous) { miss.push(`🔴 Q${q.id}#${c.num} ${sp.sent_id} — 본문에 2회 이상`); return; }
      spanPlans.push({ qid: q.id, num: c.num, sp, was: sp.text, now: r.text });
      console.log(`- Q${q.id}#${c.num} \`${sp.sent_id}\``);
      console.log(`  - 본문 ${JSON.stringify(sent)}`);
      console.log(`  - 현재 ${JSON.stringify(sp.text)} → 원문에 없음`);
      console.log(`  - 정정 ${JSON.stringify(r.text)}`);
    });
if (!spanPlans.length) console.log("- (없음)");
console.log("");

if (miss.length) { console.log("## 🔴 사전 대조 실패 — 아무것도 쓰지 않는다"); console.log(""); miss.forEach((x) => console.log(`- ${x}`)); process.exit(1); }
if (BRACKETS.some((b) => b._n == null)) { console.log("## 🔴 구간 계획이 빠진 라벨이 있다"); process.exit(1); }
console.log(`✅ 사전 대조 통과 — bracket ${BRACKETS.length}건 · span ${spanPlans.length}건`);
console.log("");
if (!APPLY) { console.log("### 미리보기 — 아무것도 쓰지 않았다. `--apply`"); process.exit(0); }

fs.writeFileSync(path.join(ROOT, "pipeline/backups/all_data_204.before_d190w4a.json"), beforeData);
fs.writeFileSync(path.join(ROOT, "pipeline/backups/annotations.before_d190w4a.json"), beforeAnn);
const preData = JSON.parse(beforeData.toString("utf8"));
const preAnn = JSON.parse(beforeAnn.toString("utf8"));

(ann[YK] ||= {});
(ann[YK][SID] ||= []);
for (const b of BRACKETS) ann[YK][SID].push({ type: "bracket", label: b.label, sentFrom: b.from, sentTo: b.to });
for (const p of spanPlans) p.sp.text = p.now;

fs.writeFileSync(DATA, JSON.stringify(data), "utf8");
fs.writeFileSync(ANN, JSON.stringify(ann, null, 2), "utf8");

// ── 되읽기 검산 ─────────────────────────────────────────────────────────
const afterData = fs.readFileSync(DATA), afterAnn = fs.readFileSync(ANN);
const fail = [];
if (afterData[0] === 0xef || afterAnn[0] === 0xef) fail.push("BOM");
let nl = 0; for (const x of afterData) if (x === 10) nl++;
if (nl !== 0) fail.push(`all_data 개행 ${nl}`);
if (afterAnn[afterAnn.length - 1] === 10) fail.push("annotations 끝 개행");
const back = JSON.parse(afterData.toString("utf8"));
const backAnn = JSON.parse(afterAnn.toString("utf8"));
const s2 = (back[YK]?.literature || []).find((x) => (x.setId || x.id) === SID);
const s0 = (preData[YK]?.literature || []).find((x) => (x.setId || x.id) === SID);

if (JSON.stringify(s2.sents) !== JSON.stringify(s0.sents)) fail.push("**본문이 달라졌다**");
const list = (backAnn[YK] || {})[SID] || [];
for (const b of BRACKETS) {
  const hit = list.filter((a) => a.type === "bracket" && a.label === b.label);
  if (hit.length !== 1) { fail.push(`[${b.label}] 등재 ${hit.length}건`); continue; }
  if (hit[0].sentFrom !== b.from || hit[0].sentTo !== b.to) fail.push(`[${b.label}] 구간 미반영`);
  const ids = new Set((s2.sents || []).map((x) => String(x.id)));
  if (!ids.has(b.from) || !ids.has(b.to)) fail.push(`[${b.label}] 끊긴 참조`);
}
let spanTotal = 0, spanBad = 0;
const byId2 = new Map((s2.sents || []).map((x) => [String(x.id), String(x.t)]));
for (const q of s2.questions || []) for (const c of q.choices || []) {
  const c0 = s0.questions.find((x) => x.id === q.id).choices.find((x) => x.num === c.num);
  if (String(c.analysis) !== String(c0.analysis)) fail.push(`Q${q.id}#${c.num} 해설이 달라졌다`);
  if (JSON.stringify(c.cs_ids) !== JSON.stringify(c0.cs_ids)) fail.push(`Q${q.id}#${c.num} cs_ids 가 달라졌다`);
  if (c.ok !== c0.ok || String(c.pat) !== String(c0.pat)) fail.push(`Q${q.id}#${c.num} ok/pat 이 달라졌다`);
  for (const sp of c.cs_spans || []) {
    spanTotal++;
    const t = byId2.get(String(sp.sent_id));
    if (t == null || !t.includes(sp.text)) { spanBad++; fail.push(`Q${q.id}#${c.num} ${sp.sent_id} span 이 본문에 없다`); }
  }
}
for (const k of Object.keys(preAnn)) if (k !== YK && JSON.stringify(preAnn[k]) !== JSON.stringify(backAnn[k])) fail.push(`annotations ${k} 가 달라졌다`);
for (const [yk, v] of Object.entries(preData)) for (const sec of ["reading", "literature"]) for (const st of v[sec] || []) {
  const sid = st.setId || st.id;
  if (yk === YK && sid === SID) continue;
  const now = (back[yk]?.[sec] || []).find((x) => (x.setId || x.id) === sid);
  if (JSON.stringify(st) !== JSON.stringify(now)) fail.push(`${yk}::${sid} 가 달라졌다`);
}

console.log(`- 적용 후 all_data MD5 \`${md5(afterData)}\` (${afterData.length - beforeData.length >= 0 ? "+" : ""}${afterData.length - beforeData.length}B)`);
console.log(`- 적용 후 annotations MD5 \`${md5(afterAnn)}\` (+${afterAnn.length - beforeAnn.length}B)`);
console.log("- 백업 `pipeline/backups/{all_data_204,annotations}.before_d190w4a.json`");
console.log("");
if (fail.length) { console.log("## 🔴 되읽기 검산 실패 — 백업으로 되돌리십시오"); fail.forEach((x) => console.log(`- ${x}`)); process.exit(1); }
console.log("## ✅ 되읽기 검산 통과 (S-02)");
console.log(`- bracket 5건 등재 · 구간 문장 실재 · 끊긴 참조 0`);
console.log(`- cs_spans ${spanTotal}건 전건이 본문 부분 문자열 · 어긋남 ${spanBad}`);
console.log("- **본문·해설·cs_ids·ok·pat 무변** · 다른 세트·다른 회차·다른 annotations 무변");
