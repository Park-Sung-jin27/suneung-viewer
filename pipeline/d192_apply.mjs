// d192_apply.mjs — l20279c 해설 수리 5건 (발주 D-192 개정 · 1번 즉시 적용분)
//
//   ⓐ Q29#3 📌 오자 「왠통」 → 「왼통」            (s20 verbatim)
//   ⓑ Q31#1 📌 보기 인용 「이들은」 → 「인물들은」  (bogi verbatim)
//   ⓒ Q29#2 cs_spans s18 중복 2건 → 1건
//   ⓓ Q29#1 📌 [A] 인용을 s7 실인용으로 교체 + cs_ids 에 l20279cs7 추가 (s5 유지)
//   ⓔ Q29#3 📌 [D] 인용을 s25~s27 실인용으로 교체, s21~s23 인용은 라벨 없이 유지
//            + cs_ids 에 s25·s26·s27 편입
//
// ★ 인용은 전부 원문에서 만든다 — 재타이핑하지 않는다
//   문장 여러 개에 걸친 인용은 sents[i..j] 를 공백 하나로 잇고 바깥 겹따옴표만 뗀다.
//   이 규칙이 맞는지는 **기존 📌 인용으로 자체 검증**한다 — s21~s23 을 같은 규칙으로
//   이으면 지금 해설에 있는 [D] 인용과 글자 그대로 같아야 한다. 다르면 멈춘다.
//
// ★ #2·#4 는 이 커밋에 없다 — 🔍 재작성이라 문안 상신 → 심사관 검토 뒤에 적용한다.
//
// 사용: node pipeline/d192_apply.mjs [--apply]

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = path.join(ROOT, "data-source/all_data_204.json");
const APPLY = process.argv.includes("--apply");
const md5 = (b) => crypto.createHash("md5").update(b).digest("hex");
const YK = "2027_9월", SID = "l20279c";

const before = fs.readFileSync(DATA);
const data = JSON.parse(before.toString("utf8"));
const set = (data[YK]?.literature || []).find((x) => (x.setId || x.id) === SID);
if (!set) { console.log("🔴 세트 없음"); process.exit(1); }
const sents = set.sents || [];
const at = new Map(sents.map((x, i) => [String(x.id), i]));
const ch = (qid, num) => set.questions.find((q) => q.id === qid)?.choices?.find((x) => x.num === num);

// 문장 구간을 인용문으로 — 공백 하나로 잇고 바깥 겹따옴표만 뗀다
function quoteOf(fromId, toId) {
  const i0 = at.get(fromId), i1 = at.get(toId);
  if (i0 == null || i1 == null || i1 < i0) return null;
  let s = sents.slice(i0, i1 + 1).map((x) => String(x.t)).join(" ");
  s = s.replace(/^[“"]/, "").replace(/[”"]$/, "");
  return s;
}

console.log("# l20279c 해설 수리 5건 (D-192 개정 · 1번)");
console.log("");
console.log(`- 적용 전 MD5 \`${md5(before)}\``);
console.log("");

const miss = [];

// ── 인용 생성 규칙 자체 검증 ────────────────────────────────────────────
const c3 = ch(29, 3);
const legacyD = quoteOf("l20279cs21", "l20279cs23");
console.log("## 인용 생성 규칙 자체 검증");
console.log("");
if (!c3) miss.push("Q29#3 선지 없음");
else if (!String(c3.analysis).includes(legacyD)) {
  miss.push("🔴 규칙 검증 실패 — s21~s23 을 이어 만든 인용이 현재 해설의 [D] 인용과 다르다");
  console.log(`- 🔴 만든 것: ${JSON.stringify(legacyD)}`);
} else {
  console.log("- ✅ `s21~s23` 을 규칙대로 이으면 **현재 해설의 [D] 인용과 글자 그대로 같다**");
  console.log("  → 「공백 하나로 잇고 바깥 겹따옴표 제거」가 이 세트의 인용 규칙이다");
}
console.log("");

// ── 편집 SPEC ───────────────────────────────────────────────────────────
const A_new = quoteOf("l20279cs7", "l20279cs7");
const D_new = quoteOf("l20279cs25", "l20279cs27");
const C_ok = quoteOf("l20279cs19", "l20279cs20");   // 오자 확인용

const EDITS = [];
// ⓐ 오자
EDITS.push({ tag: "ⓐ Q29#3 오자", qid: 29, num: 3, kind: "text", was: "왠통", now: "왼통" });
// ⓑ 보기 인용
EDITS.push({ tag: "ⓑ Q31#1 보기 인용", qid: 31, num: 1, kind: "text", was: '"이들은 고향에 대한 애착과 환멸', now: '"인물들은 고향에 대한 애착과 환멸' });
// ⓓ Q29#1 [A] 인용 교체
EDITS.push({
  tag: "ⓓ Q29#1 [A] 인용", qid: 29, num: 1, kind: "text",
  was: '[A] "어디서 왔소? 아마 덕근 아배한테서 왔는감만, 저리도 좋아하게."',
  now: `[A] "${A_new}"`,
});
// ⓔ Q29#3 [D] 인용 교체 + s21~23 라벨 없이 유지
EDITS.push({
  tag: "ⓔ Q29#3 [D] 인용", qid: 29, num: 3, kind: "text",
  was: `[D] "${legacyD}"`,
  now: `[D] "${D_new}" / "${legacyD}"`,
});
// cs_ids 편입
const CSADD = [
  { tag: "ⓓ Q29#1 cs_ids", qid: 29, num: 1, add: ["l20279cs7"] },
  { tag: "ⓔ Q29#3 cs_ids", qid: 29, num: 3, add: ["l20279cs25", "l20279cs26", "l20279cs27"] },
];
// ⓒ span 중복 제거
const SPANDEDUP = [{ tag: "ⓒ Q29#2 cs_spans", qid: 29, num: 2 }];

console.log("## 편집 대상");
console.log("");
for (const e of EDITS) {
  const c = ch(e.qid, e.num);
  if (!c) { miss.push(`${e.tag} 선지 없음`); continue; }
  const n = String(c.analysis).split(e.was).length - 1;
  if (n !== 1) { miss.push(`${e.tag} — 대상 문구가 ${n}곳이다: ${JSON.stringify(e.was.slice(0, 40))}`); continue; }
  console.log(`### ${e.tag}`);
  console.log(`- 현재 ${JSON.stringify(e.was)}`);
  console.log(`- 정정 ${JSON.stringify(e.now)}`);
  console.log("");
}
// 새 인용이 원문 부분인가
for (const [label, from, to, q] of [["[A]", "l20279cs7", "l20279cs7", A_new], ["[D]", "l20279cs25", "l20279cs27", D_new], ["[C]", "l20279cs19", "l20279cs20", C_ok]]) {
  const joined = sents.slice(at.get(from), at.get(to) + 1).map((x) => String(x.t)).join(" ");
  if (!joined.includes(q)) miss.push(`${label} 인용이 원문 이음과 다르다`);
}
if (!C_ok.includes("왼통")) miss.push("s19~s20 원문에 「왼통」이 없다 — 오자 정정 근거가 흔들린다");

for (const a of CSADD) {
  const c = ch(a.qid, a.num);
  if (!c) { miss.push(`${a.tag} 선지 없음`); continue; }
  const cur = (c.cs_ids || []).map(String);
  const dup = a.add.filter((x) => cur.includes(x));
  if (dup.length) { miss.push(`${a.tag} — 이미 있다: ${dup.join(",")}`); continue; }
  const bad = a.add.filter((x) => !at.has(x));
  if (bad.length) { miss.push(`${a.tag} — 없는 문장: ${bad.join(",")}`); continue; }
  console.log(`### ${a.tag}`);
  console.log(`- ${JSON.stringify(cur)} → **${JSON.stringify([...cur, ...a.add])}**`);
  console.log("");
}
for (const s of SPANDEDUP) {
  const c = ch(s.qid, s.num);
  if (!c) { miss.push(`${s.tag} 선지 없음`); continue; }
  const spans = c.cs_spans || [];
  const norm = (x) => `${x.sent_id}|${String(x.text).replace(/[.。]\s*$/, "").trim()}`;
  const seen = new Map();
  const keep = [];
  for (const sp of spans) { const k = norm(sp); if (seen.has(k)) continue; seen.set(k, 1); keep.push(sp); }
  if (keep.length === spans.length) { miss.push(`${s.tag} — 중복이 없다`); continue; }
  s._keep = keep;
  console.log(`### ${s.tag}`);
  console.log(`- ${spans.length}건 → **${keep.length}건** (마침표 유무만 다른 동일 구간 제거)`);
  spans.forEach((sp) => console.log(`  - ${keep.includes(sp) ? "유지" : "제거"} ${sp.sent_id} ${JSON.stringify(sp.text)}`));
  console.log("");
}

if (miss.length) { console.log("## 🔴 사전 대조 실패 — 아무것도 쓰지 않는다"); console.log(""); miss.forEach((x) => console.log(`- ${x}`)); process.exit(1); }
console.log("✅ 사전 대조 통과 — 해설 4곳 · cs_ids 2건 · cs_spans 1건");
console.log("");
if (!APPLY) { console.log("### 미리보기 — 아무것도 쓰지 않았다. `--apply`"); process.exit(0); }

fs.writeFileSync(path.join(ROOT, "pipeline/backups/all_data_204.before_d192.json"), before);
const pre = JSON.parse(before.toString("utf8"));
const snap = new Map();
for (const e of EDITS) { const c = ch(e.qid, e.num); if (!snap.has(c)) snap.set(c, String(c.analysis)); }
for (const e of EDITS) { const c = ch(e.qid, e.num); c.analysis = String(c.analysis).split(e.was).join(e.now); }
for (const a of CSADD) { const c = ch(a.qid, a.num); c.cs_ids = [...(c.cs_ids || []), ...a.add]; }
for (const s of SPANDEDUP) { const c = ch(s.qid, s.num); c.cs_spans = s._keep; }
fs.writeFileSync(DATA, JSON.stringify(data), "utf8");   // §13⑪

// ── 되읽기 검산 ─────────────────────────────────────────────────────────
const after = fs.readFileSync(DATA);
const fail = [];
if (after[0] === 0xef) fail.push("BOM");
let nl = 0; for (const x of after) if (x === 10) nl++;
if (nl !== 0) fail.push(`개행 ${nl}`);
const back = JSON.parse(after.toString("utf8"));
const s2 = (back[YK]?.literature || []).find((x) => (x.setId || x.id) === SID);
const s0 = (pre[YK]?.literature || []).find((x) => (x.setId || x.id) === SID);
if (JSON.stringify(s2.sents) !== JSON.stringify(s0.sents)) fail.push("**본문이 달라졌다**");

const byId2 = new Map((s2.sents || []).map((x) => [String(x.id), String(x.t)]));
for (const e of EDITS) {
  const c2 = s2.questions.find((q) => q.id === e.qid).choices.find((x) => x.num === e.num);
  if (String(c2.analysis).includes(e.was)) fail.push(`${e.tag} 옛 문구 잔존`);
  if (!String(c2.analysis).includes(e.now)) fail.push(`${e.tag} 새 문구 미반영`);
}
// 되돌리면 원문과 같아야 한다
for (const [c, a0] of snap) {
  const c2 = s2.questions.flatMap((q) => q.choices).find((x) => x === c) || null;
}
for (const e of [...new Set(EDITS.map((x) => `${x.qid}#${x.num}`))]) {
  const [qid, num] = e.split("#").map(Number);
  const c2 = s2.questions.find((q) => q.id === qid).choices.find((x) => x.num === num);
  let rev = String(c2.analysis);
  for (const x of EDITS.filter((y) => y.qid === qid && y.num === num)) rev = rev.split(x.now).join(x.was);
  const c0 = s0.questions.find((q) => q.id === qid).choices.find((x) => x.num === num);
  if (rev !== String(c0.analysis)) fail.push(`Q${qid}#${num} **해설이 지정 문구 밖에서 달라졌다**`);
}
for (const a of CSADD) {
  const c2 = s2.questions.find((q) => q.id === a.qid).choices.find((x) => x.num === a.num);
  const c0 = s0.questions.find((q) => q.id === a.qid).choices.find((x) => x.num === a.num);
  const want = [...(c0.cs_ids || []), ...a.add];
  if (JSON.stringify(c2.cs_ids) !== JSON.stringify(want)) fail.push(`${a.tag} 미반영`);
  for (const id of c2.cs_ids) if (!byId2.has(String(id))) fail.push(`${a.tag} 끊긴 cs_id ${id}`);
}
for (const s of SPANDEDUP) {
  const c2 = s2.questions.find((q) => q.id === s.qid).choices.find((x) => x.num === s.num);
  if ((c2.cs_spans || []).length !== s._keep.length) fail.push(`${s.tag} 개수 미반영`);
}
// span 전건 본문 부분 문자열 · ok/pat 무변 · 다른 세트 무변
let spanTotal = 0;
for (const q of s2.questions || []) for (const c of q.choices || []) {
  const c0 = s0.questions.find((x) => x.id === q.id).choices.find((x) => x.num === c.num);
  if (c.ok !== c0.ok || String(c.pat) !== String(c0.pat)) fail.push(`Q${q.id}#${c.num} ok/pat 이 달라졌다`);
  for (const sp of c.cs_spans || []) {
    spanTotal++;
    const t = byId2.get(String(sp.sent_id));
    if (t == null || !t.includes(sp.text)) fail.push(`Q${q.id}#${c.num} ${sp.sent_id} span 이 본문에 없다`);
  }
}
for (const [yk, v] of Object.entries(pre)) for (const sec of ["reading", "literature"]) for (const st of v[sec] || []) {
  const sid = st.setId || st.id;
  if (yk === YK && sid === SID) continue;
  const now = (back[yk]?.[sec] || []).find((x) => (x.setId || x.id) === sid);
  if (JSON.stringify(st) !== JSON.stringify(now)) fail.push(`${yk}::${sid} 가 달라졌다`);
}

console.log(`- 적용 후 MD5 \`${md5(after)}\` (${after.length - before.length >= 0 ? "+" : ""}${after.length - before.length}B)`);
console.log("- 백업 `pipeline/backups/all_data_204.before_d192.json`");
console.log("");
if (fail.length) { console.log("## 🔴 되읽기 검산 실패 — 백업으로 되돌리십시오"); fail.forEach((x) => console.log(`- ${x}`)); process.exit(1); }
console.log("## ✅ 되읽기 검산 통과 (S-02)");
console.log("- 해설은 지정 문구 밖에서 한 글자도 안 달라졌다 (되돌림 대조)");
console.log(`- cs_ids 편입 4건 · 끊긴 id 0 · cs_spans ${spanTotal}건 전건 본문 부분 문자열`);
console.log("- **본문·ok·pat 무변** · 다른 세트·다른 회차 무변 · minified 유지");
