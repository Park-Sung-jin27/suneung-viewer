// d190_w4b_apply.mjs — 2027_9월 r20279b 기계적 수리 (발주 D-190 트랙2)
//
//   ① cs_span 4건 — 본문에서 잘라내 맞춘다
//        Q7#1 s18  중간 조사 공백(「강화 하는」·「표준적 입장 이」) + 따옴표 곡선
//        Q8#1 s9   span 끝 「…」 말줄임표
//        Q8#5 s28  원문자 ⓑ 생략  ← 신규 유형
//        Q9#1 s28  span 끝 「...」 말줄임표
//   ② Q5#2 📌 줄 끝의 내부 ID 「(r20279bs17)」 괄호째 제거
//   ③ Q6#3 📌 인용을 본문에 맞춤 (「부정하거나」 → 「부정 하거나」)
//   ④ s1 안내문 접두 제거
//
// ★ 원문자 생략은 「대조 관용」으로만 넘긴다 — 저장되는 span 은 원문 verbatim
//   한자 괄호 때와 같은 원칙이다(심사관 확정). 정규화에서 ⓐ~ⓩ·㉠~㉿ 를 건너뛰고
//   위치를 잡으면, 잘라낸 원문에는 그 원문자가 **포함**된다. 형광펜은 원문 일치가
//   필요하므로 이게 맞다.
//
// ★ title 은 이 도구에 없다 — 문안이 심사관 확정 사항이고 아직 안 왔다.
// ★ F_content_reversed 3선지(Q7#2·Q7#5·Q8#3)도 없다 — 해설 수정이라 건별 상신 뒤에 간다.
//
// 사용: node pipeline/d190_w4b_apply.mjs [--apply]

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = path.join(ROOT, "public/data/all_data_204.json");
const APPLY = process.argv.includes("--apply");
const md5 = (b) => crypto.createHash("md5").update(b).digest("hex");
const YK = "2027_9월", SID = "r20279b";
const PREFIX = "다음 글을 읽고 물음에 답하시오. ";

const Q = (s) => s.replace(/[‘’‚‛']/g, "'").replace(/[“”„‟"]/g, '"');
const HANJA_PAREN = /^\([一-鿿]+\)/;
const MARKER = /[ⓐ-ⓩ㉠-㉿]/;
// 정규화 — 공백·한자 괄호·원문자를 건너뛰되 원문 인덱스는 들고 간다 (대조 관용)
function normMap(s) {
  let out = ""; const map = []; const q = Q(s);
  for (let i = 0; i < q.length; i++) {
    if (/\s/.test(q[i])) continue;
    if (MARKER.test(q[i])) continue;
    if (q[i] === "(") { const m = q.slice(i).match(HANJA_PAREN); if (m) { i += m[0].length - 1; continue; } }
    out += q[i]; map.push(i);
  }
  return { out, map };
}
const normPlain = (s) => normMap(s).out;
// span 은 끝의 말줄임표를 떼고 맞춘다 — 「…」 는 원문에 없는 축약 기호다.
// ★ 📌 인용에는 쓰지 않는다. 인용의 끝 마침표는 원문에도 있는 글자라
//   같이 떼면 인용이 한 글자 짧게 잘린다(미리보기에서 실제로 그렇게 나왔다).
const stripSpanTail = (s) => s.replace(/(?:\.{2,}|…)[.\s]*$/, "");
function carveWith(sent, needleRaw) {
  const { out, map } = normMap(sent);
  const needle = normPlain(needleRaw);
  if (!needle) return null;
  const at = out.indexOf(needle);
  if (at < 0) return null;
  if (out.indexOf(needle, at + 1) >= 0) return { ambiguous: true };
  return { text: sent.slice(map[at], map[at + needle.length - 1] + 1) };
}
const carve = (sent, spanText) => carveWith(sent, stripSpanTail(spanText));   // span 용
const carvePin = (sent, quote) => carveWith(sent, quote);                      // 📌 인용 용

const before = fs.readFileSync(DATA);
const data = JSON.parse(before.toString("utf8"));
const set = (data[YK]?.reading || []).find((x) => (x.setId || x.id) === SID);
if (!set) { console.log("🔴 세트 없음"); process.exit(1); }
const byId = new Map((set.sents || []).map((x) => [String(x.id), String(x.t)]));
const ch = (qid, num) => set.questions.find((q) => q.id === qid)?.choices?.find((x) => x.num === num);

console.log(`# ${SID} 기계적 수리 (D-190 트랙2)`);
console.log("");
console.log(`- 적용 전 MD5 \`${md5(before)}\``);
console.log("");

const miss = [], spanPlans = [], anaPlans = [];

// ── ① span ─────────────────────────────────────────────────────────────
console.log("## ① cs_span — 본문에서 잘라낸다");
console.log("");
console.log("| 위치 | 문장 | 원인 | 현재 → 정정 |");
console.log("|---|---|---|---|");
for (const q of set.questions || [])
  for (const c of q.choices || [])
    (c.cs_spans || []).forEach((sp) => {
      const sent = byId.get(String(sp.sent_id));
      if (sent == null) { miss.push(`Q${q.id}#${c.num} ${sp.sent_id} 문장 없음`); return; }
      if (sent.includes(sp.text)) return;
      const r = carve(sent, sp.text);
      if (!r) { miss.push(`🔴 Q${q.id}#${c.num} ${sp.sent_id} — 본문에서 못 찾는다: ${JSON.stringify(sp.text.slice(0, 40))}`); return; }
      if (r.ambiguous) { miss.push(`🔴 Q${q.id}#${c.num} ${sp.sent_id} — 본문에 2회 이상`); return; }
      const cause = [];
      if (/[…]|\.\.\./.test(sp.text)) cause.push("말줄임표");
      if (MARKER.test(r.text) && !MARKER.test(sp.text)) cause.push("원문자 생략");
      if (Q(sp.text) !== sp.text || Q(sent) !== sent) cause.push("따옴표");
      if (!cause.length) cause.push("조사 공백");
      spanPlans.push({ qid: q.id, num: c.num, sp, was: sp.text, now: r.text });
      console.log(`| Q${q.id}#${c.num} | \`${sp.sent_id}\` | ${cause.join("+")} | ${JSON.stringify(sp.text.slice(0, 26) + "…")} → ${JSON.stringify(r.text.slice(0, 26) + "…")} |`);
    });
console.log("");

// ── ② 내부 ID 노출 ─────────────────────────────────────────────────────
console.log("## ② 📌 줄의 내부 ID 제거");
console.log("");
{
  const c = ch(5, 2);
  if (!c) miss.push("Q5#2 선지 없음");
  else {
    const A0 = String(c.analysis);
    const re = /\s*\(r20279bs\d+\)/g;
    const hits = A0.match(re) || [];
    if (hits.length !== 1) miss.push(`Q5#2 — 내부 ID 가 ${hits.length}곳이다`);
    else {
      const A1 = A0.replace(re, "");
      anaPlans.push({ tag: "Q5#2 내부 ID", qid: 5, num: 2, A0, A1, note: hits[0] });
      console.log(`- Q5#2 — 제거: \`${hits[0].trim()}\``);
    }
  }
}
console.log("");

// ── ③ 📌 인용 정정 ─────────────────────────────────────────────────────
console.log("## ③ 📌 인용을 본문에 맞춤");
console.log("");
{
  const c = ch(6, 3);
  if (!c) miss.push("Q6#3 선지 없음");
  else {
    const A0 = String(c.analysis);
    const pin = A0.split("\n").filter((l) => l.includes("📌")).join("\n");
    const bad = [];
    for (const m of pin.matchAll(/"([^"]+)"/g)) {
      const qt = m[1];
      for (const [id, t] of byId) {
        if (t.includes(qt)) { bad.length = 0; break; }
        const r = carvePin(t, qt);
        if (r && !r.ambiguous && r.text !== qt) { bad.push({ was: qt, now: r.text, id }); break; }
      }
    }
    if (bad.length !== 1) miss.push(`Q6#3 — 고칠 인용이 ${bad.length}개다`);
    else {
      const n = A0.split(bad[0].was).length - 1;
      if (n !== 1) miss.push(`Q6#3 — 옛 인용이 ${n}곳이다`);
      else {
        const A1 = A0.split(bad[0].was).join(bad[0].now);
        anaPlans.push({ tag: "Q6#3 📌 인용", qid: 6, num: 3, A0, A1, note: bad[0].id });
        console.log(`- Q6#3 \`${bad[0].id}\``);
        console.log(`  - 현재 ${JSON.stringify(bad[0].was)}`);
        console.log(`  - 정정 ${JSON.stringify(bad[0].now)}`);
        console.log(`  - ⚠ 이 선지는 \`cs_ids\` 가 비어 있다(pat 면제). 근거 편입은 발주 범위 밖이라 하지 않았다.`);
      }
    }
  }
}
console.log("");

// ── ④ s1 접두 ──────────────────────────────────────────────────────────
console.log("## ④ s1 안내문 접두 제거");
console.log("");
const s1 = (set.sents || [])[0];
let s1New = null;
if (!s1) miss.push("문장 없음");
else if (!String(s1.t).startsWith(PREFIX)) miss.push("s1 이 안내문으로 시작하지 않는다");
else {
  s1New = String(s1.t).slice(PREFIX.length);
  if (!s1New.trim()) miss.push("접두 제거하면 빈 문장이 된다");
  let ref = 0, spanRef = 0;
  for (const q of set.questions || []) for (const c of q.choices || []) {
    ref += (c.cs_ids || []).filter((x) => String(x) === String(s1.id)).length;
    spanRef += (c.cs_spans || []).filter((x) => String(x.sent_id) === String(s1.id)).length;
  }
  if (spanRef) miss.push(`🔴 s1 을 가리키는 cs_span 이 ${spanRef}건 — 어구 재정렬이 먼저다`);
  console.log(`- \`${s1.id}\` → ${JSON.stringify(s1New)}`);
  console.log(`- 참조: cs_ids ${ref}건 · cs_spans ${spanRef}건 (id 는 유지되므로 cs_ids 는 안 깨진다)`);
}
console.log("");

if (miss.length) { console.log("## 🔴 사전 대조 실패 — 아무것도 쓰지 않는다"); console.log(""); miss.forEach((x) => console.log(`- ${x}`)); process.exit(1); }
for (const p of spanPlans) if (!byId.get(String(p.sp.sent_id)).includes(p.now)) { console.log(`## 🔴 Q${p.qid}#${p.num} 새 span 이 본문에 없다`); process.exit(1); }
console.log(`✅ 사전 대조 통과 — span ${spanPlans.length}건 · 해설 ${anaPlans.length}건 · s1 1건`);
console.log("");
if (!APPLY) { console.log("### 미리보기 — 아무것도 쓰지 않았다. `--apply`"); process.exit(0); }

fs.writeFileSync(path.join(ROOT, "pipeline/backups/all_data_204.before_d190w4b.json"), before);
const pre = JSON.parse(before.toString("utf8"));
for (const p of spanPlans) p.sp.text = p.now;
for (const p of anaPlans) ch(p.qid, p.num).analysis = p.A1;
s1.t = s1New;
fs.writeFileSync(DATA, JSON.stringify(data), "utf8");   // §13⑪

// ── 되읽기 검산 ─────────────────────────────────────────────────────────
const after = fs.readFileSync(DATA);
const fail = [];
if (after[0] === 0xef) fail.push("BOM");
let nl = 0; for (const x of after) if (x === 10) nl++;
if (nl !== 0) fail.push(`개행 ${nl}`);
const back = JSON.parse(after.toString("utf8"));
const s2 = (back[YK]?.reading || []).find((x) => (x.setId || x.id) === SID);
const s0 = (pre[YK]?.reading || []).find((x) => (x.setId || x.id) === SID);
const byId2 = new Map((s2.sents || []).map((x) => [String(x.id), String(x.t)]));

if ((s2.sents || []).length !== (s0.sents || []).length) fail.push("문장 수가 달라졌다");
if ((s2.sents || []).slice(1).map((x) => x.t).join("§") !== (s0.sents || []).slice(1).map((x) => x.t).join("§")) fail.push("s1 밖 본문이 달라졌다");
if (String(s2.sents[0].t).startsWith("다음 글을 읽고")) fail.push("s1 에 안내문 잔존");
if (s2.title !== s0.title) fail.push("title 이 달라졌다 (이 도구는 title 을 안 건드린다)");

let spanTotal = 0;
for (const q of s2.questions || []) for (const c of q.choices || []) {
  const c0 = s0.questions.find((x) => x.id === q.id).choices.find((x) => x.num === c.num);
  const isAna = anaPlans.some((p) => p.qid === q.id && p.num === c.num);
  if (!isAna && String(c.analysis) !== String(c0.analysis)) fail.push(`Q${q.id}#${c.num} 해설이 달라졌다`);
  if (JSON.stringify(c.cs_ids) !== JSON.stringify(c0.cs_ids)) fail.push(`Q${q.id}#${c.num} cs_ids 가 달라졌다`);
  if (c.ok !== c0.ok || String(c.pat) !== String(c0.pat)) fail.push(`Q${q.id}#${c.num} ok/pat 이 달라졌다`);
  for (const sp of c.cs_spans || []) {
    spanTotal++;
    const t = byId2.get(String(sp.sent_id));
    if (t == null || !t.includes(sp.text)) fail.push(`Q${q.id}#${c.num} ${sp.sent_id} span 이 본문에 없다`);
  }
}
for (const p of anaPlans) {
  const c2 = s2.questions.find((q) => q.id === p.qid).choices.find((x) => x.num === p.num);
  if (String(c2.analysis) !== p.A1) fail.push(`${p.tag} 미반영`);
  const t0 = p.A0.trimEnd().split("\n").pop(), t1 = String(c2.analysis).trimEnd().split("\n").pop();
  if (t0 !== t1) fail.push(`${p.tag} **결론줄이 달라졌다**`);
}
if (/\(r20279bs\d+\)/.test(String(s2.questions.find((q) => q.id === 5).choices.find((x) => x.num === 2).analysis))) fail.push("Q5#2 내부 ID 잔존");
for (const [yk, v] of Object.entries(pre)) for (const sec of ["reading", "literature"]) for (const st of v[sec] || []) {
  const sid = st.setId || st.id;
  if (yk === YK && sid === SID) continue;
  if (JSON.stringify(st) !== JSON.stringify((back[yk]?.[sec] || []).find((x) => (x.setId || x.id) === sid))) fail.push(`${yk}::${sid} 가 달라졌다`);
}

console.log(`- 적용 후 MD5 \`${md5(after)}\` (${after.length - before.length >= 0 ? "+" : ""}${after.length - before.length}B)`);
console.log("- 백업 `pipeline/backups/all_data_204.before_d190w4b.json`");
console.log("");
if (fail.length) { console.log("## 🔴 되읽기 검산 실패 — 백업으로 되돌리십시오"); fail.forEach((x) => console.log(`- ${x}`)); process.exit(1); }
console.log("## ✅ 되읽기 검산 통과 (S-02)");
console.log(`- cs_spans ${spanTotal}건 전건이 본문 부분 문자열 · 새 span 에 원문자·한자 괄호 그대로 포함`);
console.log("- 해설은 지정 2곳만 · 결론줄 무변 · cs_ids·ok·pat 무변");
console.log("- s1 안내문 잔존 0 · 문장 수 무변 · s1 밖 본문 무변 · title 무변");
console.log("- 다른 세트·다른 회차 무변 · minified 유지");
