// d190_w3_apply.mjs — 2027_9월 W3 span 수리 (발주 D-190)
//
// 대상 r20279c 6건 · r20279d 5건 = 11건. 원인은 네 갈래다(심사관 판정 반영).
//   ① 따옴표 종류   span 이 직선 '온' 인데 본문은 곡선 ‘온’
//   ② 중간 조사 공백 본문에 「정류기 에서」·「비롯 하였음을」·「미디어 에서」·「전달 되는」
//                    — 원본 텍스트층에도 있는 공백이다(오경보 2번 확정).
//                    ★ 본문은 손대지 않는다. span 을 본문에 맞춘다.
//   ③ 괄호 조각     span 끝에 " (" / 앞에 ") " 가 딸려 있다
//   ④ 중복 span     r20279d Q15#5 의 세 번째 span 삭제 (아래 조건 확인 후)
//
// ★ 어구를 다시 타이핑하지 않는다 — 본문에서 잘라낸다
//   정규화(따옴표 통일 · 공백 제거 · span 앞뒤 괄호 조각 제거)로 본문 안 위치를 찾고,
//   그 위치의 **원문 문자열을 그대로 slice** 해 새 span 으로 삼는다.
//   그래서 새 span 은 정의상 본문 원문의 부분 문자열이다. 손으로 적을 여지가 없다.
//
// ★ ④ 삭제 조건 (심사관 지정)
//   남는 span 들이 그 선지 📌 인용 어구를 모두 커버해야 삭제한다.
//   못 하면 삭제 대신 그 span 을 원문 어구로 교체한다. 어느 쪽이었는지 출력한다.
//
// 사용: node pipeline/d190_w3_apply.mjs [--apply]

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = path.join(ROOT, "data-source/all_data_204.json");
const APPLY = process.argv.includes("--apply");
const md5 = (b) => crypto.createHash("md5").update(b).digest("hex");
const YK = "2027_9월";
const TARGETS = ["r20279c", "r20279d"];

// 삭제 후보 — 세 번째 span (0-based index 2)
const DELETE = [{ sid: "r20279d", qid: 15, num: 5, idx: 2 }];

const Q = (s) => s.replace(/[‘’‚‛']/g, "'").replace(/[“”„‟"]/g, '"');
const stripParen = (s) => s.replace(/^[)\s]+/, "").replace(/[(\s]+$/, "");

// 본문을 정규화하면서 「정규화 인덱스 → 원문 인덱스」 대응표를 만든다
function normMap(s) {
  let out = "";
  const map = [];
  const q = Q(s);
  for (let i = 0; i < q.length; i++) {
    if (/\s/.test(q[i])) continue;
    out += q[i];
    map.push(i);
  }
  return { out, map };
}
const normPlain = (s) => Q(s).replace(/\s+/g, "");

// span 을 본문 안에서 찾아 원문 그대로 잘라낸다. 못 찾으면 null.
function carve(sent, spanText) {
  const { out, map } = normMap(sent);
  const needle = normPlain(stripParen(spanText));
  if (!needle) return null;
  const at = out.indexOf(needle);
  if (at < 0) return null;
  if (out.indexOf(needle, at + 1) >= 0) return { ambiguous: true };
  const from = map[at], to = map[at + needle.length - 1] + 1;
  return { text: sent.slice(from, to), from, to };
}

const before = fs.readFileSync(DATA);
const data = JSON.parse(before.toString("utf8"));
const findSet = (dd, sid) => (dd[YK]?.reading || []).find((x) => (x.setId || x.id) === sid)
  || (dd[YK]?.literature || []).find((x) => (x.setId || x.id) === sid);

console.log("# 2027_9월 W3 span 수리 — r20279c · r20279d (D-190)");
console.log("");
console.log(`- 적용 전 MD5 \`${md5(before)}\``);
console.log("");

const plans = [], dels = [], miss = [];

// ── ④ 삭제 판정 먼저 ────────────────────────────────────────────────────
console.log("## ④ 중복 span 삭제 판정");
console.log("");
for (const t of DELETE) {
  const set = findSet(data, t.sid);
  const c = set?.questions?.find((q) => q.id === t.qid)?.choices?.find((x) => x.num === t.num);
  if (!c) { miss.push(`${t.sid} Q${t.qid}#${t.num} 선지 없음`); continue; }
  const spans = c.cs_spans || [];
  if (spans.length <= t.idx) { miss.push(`${t.sid} Q${t.qid}#${t.num} — span 이 ${spans.length}개라 [${t.idx}] 가 없다`); continue; }
  const byId = new Map((set.sents || []).map((x) => [String(x.id), String(x.t)]));
  // 남는 span 들이 📌 인용을 커버하는가
  const pin = String(c.analysis || "").split("\n").filter((l) => l.includes("📌")).join(" ");
  const quotes = [...pin.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  const keep = spans.filter((_, i) => i !== t.idx);
  const cover = quotes.map((qt) => {
    const n = normPlain(qt).replace(/\.{2,}$/, "").replace(/…$/, "");
    const hit = keep.some((sp) => {
      const carved = carve(byId.get(String(sp.sent_id)) || "", sp.text);
      const base = normPlain(carved?.text ?? sp.text);
      return base.includes(n) || n.includes(base);
    });
    return { qt, hit };
  });
  console.log(`### \`${t.sid}\` Q${t.qid}#${t.num} — span ${spans.length}개 중 [${t.idx}] 삭제 검토`);
  console.log("");
  console.log(`- 삭제 후보: ${JSON.stringify(spans[t.idx].text)}`);
  console.log(`- 남는 span: ${keep.map((s) => JSON.stringify(s.text.slice(0, 40) + "…")).join(" · ")}`);
  console.log("");
  console.log("| 📌 인용 | 남는 span 이 커버하나 |");
  console.log("|---|:-:|");
  for (const c2 of cover) console.log(`| ${JSON.stringify(c2.qt.slice(0, 46) + (c2.qt.length > 46 ? "…" : ""))} | ${c2.hit ? "✅" : "🔴"} |`);
  console.log("");
  if (cover.every((x) => x.hit)) {
    console.log("→ **전부 커버 — 삭제한다** (심사관 지정 조건 충족)");
    dels.push({ ...t, c, removed: spans[t.idx] });
  } else {
    console.log("→ 🔴 커버 못 함 — 삭제하지 않고 원문 어구로 교체한다");
  }
  console.log("");
}

// ── ①②③ 어구 정정 ─────────────────────────────────────────────────────
console.log("## ①②③ span 어구 정정 — 본문에서 잘라낸다");
console.log("");
console.log("| 세트 | 위치 | 문장 | 원인 | 현재 span | 본문에서 잘라낸 새 span |");
console.log("|---|---|---|---|---|---|");
for (const sid of TARGETS) {
  const set = findSet(data, sid);
  if (!set) { miss.push(`${sid} 세트 없음`); continue; }
  const byId = new Map((set.sents || []).map((x) => [String(x.id), String(x.t)]));
  for (const q of set.questions || [])
    for (const c of q.choices || [])
      (c.cs_spans || []).forEach((sp, i) => {
        if (dels.some((d) => d.c === c && d.idx === i)) return;      // 삭제 대상은 건너뛴다
        const sent = byId.get(String(sp.sent_id));
        if (sent == null) { miss.push(`${sid} Q${q.id}#${c.num} ${sp.sent_id} 문장 없음`); return; }
        if (sent.includes(sp.text)) return;                          // 이미 정상
        const r = carve(sent, sp.text);
        if (!r) { miss.push(`🔴 ${sid} Q${q.id}#${c.num} ${sp.sent_id} — 정규화로도 본문에서 못 찾는다: ${JSON.stringify(sp.text.slice(0, 40))}`); return; }
        if (r.ambiguous) { miss.push(`🔴 ${sid} Q${q.id}#${c.num} ${sp.sent_id} — 본문에 2회 이상 나온다(위치 특정 불가)`); return; }
        const cause = [];
        if (Q(sp.text) !== sp.text || Q(sent) !== sent) cause.push("①따옴표");
        if (stripParen(sp.text) !== sp.text) cause.push("③괄호조각");
        if (normPlain(sp.text).replace(/\s/g, "") === normPlain(r.text).replace(/\s/g, "") && sp.text.replace(/\s/g, "") === r.text.replace(/\s/g, "") && sp.text !== r.text) cause.push("②공백");
        if (!cause.length) cause.push("②공백");
        plans.push({ sid, qid: q.id, num: c.num, sent_id: sp.sent_id, sp, was: sp.text, now: r.text, cause: cause.join("+") });
        console.log(`| \`${sid}\` | Q${q.id}#${c.num} | \`${sp.sent_id}\` | ${cause.join("+")} | ${JSON.stringify(sp.text.slice(0, 28) + (sp.text.length > 28 ? "…" : ""))} | ${JSON.stringify(r.text.slice(0, 28) + (r.text.length > 28 ? "…" : ""))} |`);
      });
}
console.log("");
console.log(`정정 ${plans.length}건 · 삭제 ${dels.length}건`);
console.log("");

if (miss.length) { console.log("## 🔴 사전 대조 실패 — 아무것도 쓰지 않는다"); console.log(""); miss.forEach((x) => console.log(`- ${x}`)); process.exit(1); }
if (plans.length + dels.length === 0) { console.log("고칠 것이 없다"); process.exit(0); }
// 새 span 이 정말 본문의 부분 문자열인가 (쓰기 전 최종 확인)
for (const p of plans) {
  const sent = findSet(data, p.sid).sents.find((x) => String(x.id) === String(p.sent_id)).t;
  if (!String(sent).includes(p.now)) { console.log(`## 🔴 ${p.sid} ${p.sent_id} — 새 span 이 본문에 없다`); process.exit(1); }
}
console.log("✅ 사전 대조 통과 — 새 span 전건이 본문 원문의 부분 문자열이다");
console.log("");
if (!APPLY) { console.log("### 미리보기 — 아무것도 쓰지 않았다. `--apply`"); process.exit(0); }

// ── 적용 ────────────────────────────────────────────────────────────────
fs.writeFileSync(path.join(ROOT, "pipeline/backups/all_data_204.before_d190w3.json"), before);
const pre = JSON.parse(before.toString("utf8"));
for (const p of plans) p.sp.text = p.now;
for (const d of dels) d.c.cs_spans.splice(d.idx, 1);
fs.writeFileSync(DATA, JSON.stringify(data), "utf8");   // §13⑪

// ── 되읽기 검산 (S-02) ──────────────────────────────────────────────────
const after = fs.readFileSync(DATA);
const fail = [];
if (after[0] === 0xef) fail.push("BOM");
let nl = 0; for (const x of after) if (x === 10) nl++;
if (nl !== 0) fail.push(`개행 ${nl}`);
const back = JSON.parse(after.toString("utf8"));

let spanTotal = 0, spanBad = 0;
for (const sid of TARGETS) {
  const s2 = findSet(back, sid), s0 = findSet(pre, sid);
  const byId = new Map((s2.sents || []).map((x) => [String(x.id), String(x.t)]));
  if (JSON.stringify(s2.sents) !== JSON.stringify(s0.sents)) fail.push(`${sid} **본문이 달라졌다**`);
  for (const q of s2.questions || []) for (const c of q.choices || []) {
    const c0 = s0.questions.find((x) => x.id === q.id).choices.find((x) => x.num === c.num);
    if (String(c.analysis) !== String(c0.analysis)) fail.push(`${sid} Q${q.id}#${c.num} 해설이 달라졌다`);
    if (JSON.stringify(c.cs_ids) !== JSON.stringify(c0.cs_ids)) fail.push(`${sid} Q${q.id}#${c.num} cs_ids 가 달라졌다`);
    if (c.ok !== c0.ok || String(c.pat) !== String(c0.pat)) fail.push(`${sid} Q${q.id}#${c.num} ok/pat 이 달라졌다`);
    for (const sp of c.cs_spans || []) {
      spanTotal++;
      const sent = byId.get(String(sp.sent_id));
      if (sent == null) { spanBad++; fail.push(`${sid} Q${q.id}#${c.num} 끊긴 span ${sp.sent_id}`); }
      else if (!sent.includes(sp.text)) { spanBad++; fail.push(`${sid} Q${q.id}#${c.num} ${sp.sent_id} span 이 여전히 본문에 없다`); }
    }
  }
}
for (const d of dels) {
  const s2 = findSet(back, d.sid);
  const c2 = s2.questions.find((q) => q.id === d.qid).choices.find((x) => x.num === d.num);
  if ((c2.cs_spans || []).some((x) => x.text === d.removed.text)) fail.push(`${d.sid} Q${d.qid}#${d.num} 삭제 대상이 남아 있다`);
  if ((c2.cs_spans || []).length !== 2) fail.push(`${d.sid} Q${d.qid}#${d.num} span 이 ${(c2.cs_spans || []).length}개 (2 여야 한다)`);
}
// 2027_9월 밖 회차 무변
for (const k of Object.keys(pre)) if (k !== YK && JSON.stringify(pre[k]) !== JSON.stringify(back[k])) fail.push(`${k} 회차가 달라졌다`);
// 2027_9월 안 다른 세트 무변
for (const sec of ["reading", "literature"]) for (const s of pre[YK][sec] || []) {
  const sid = s.setId || s.id;
  if (TARGETS.includes(sid)) continue;
  if (JSON.stringify(s) !== JSON.stringify(findSet(back, sid))) fail.push(`${sid} 세트가 달라졌다`);
}

console.log(`- 적용 후 MD5 \`${md5(after)}\` (${after.length - before.length >= 0 ? "+" : ""}${after.length - before.length}B)`);
console.log("- 백업 `pipeline/backups/all_data_204.before_d190w3.json`");
console.log("");
if (fail.length) { console.log("## 🔴 되읽기 검산 실패 — 백업으로 되돌리십시오"); fail.forEach((x) => console.log(`- ${x}`)); process.exit(1); }
console.log("## ✅ 되읽기 검산 통과 (S-02)");
console.log("");
console.log(`- 두 세트 cs_spans **${spanTotal}건 전건이 본문 부분 문자열** · 어긋남 ${spanBad}`);
console.log(`- 정정 ${plans.length}건 · 삭제 ${dels.length}건`);
console.log("- **본문·해설·cs_ids·ok·pat 무변** · 다른 세트·다른 회차 무변 · minified 유지");
