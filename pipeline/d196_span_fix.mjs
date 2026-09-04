// d196_span_fix.mjs — l20279b cs_spans.text 2건 수리 (발주 D-196 · gate1 CRITICAL)
//
// step4 가 만든 span 문자열이 문장과 어긋나 형광펜이 안 켜진다. 원인이 둘 다 다르다.
//   Q22#4 s43 「말이란 거창할 필요가 없으며…」 — 원문에 없는 말줄임표를 붙였다
//   Q27#3 s25 「내 자전거 바퀴가 치르르치르르 도는 소리」 — 원문자 ㉢ 을 빠뜨렸다
//                (원문 「내 자전거 바퀴가 ㉢ 치르르치르르 도는 소리」)
//
// ★ span 은 문장의 연속 부분문자열이어야 한다. 그래서 새 문자열을 짓지 않고
//   문장에서 **잘라낸다** — 시작·끝 어구를 찾아 그 사이를 원문 그대로 가져온다.
//
// 사용: node pipeline/d196_span_fix.mjs [--apply]

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = path.join(ROOT, "data-source/all_data_204.json");
const YK = "2027_9월", SID = "l20279b";
const APPLY = process.argv.includes("--apply");
const md5 = (b) => crypto.createHash("md5").update(b).digest("hex");

const before = fs.readFileSync(DATA);
const data = JSON.parse(before.toString("utf8"));
const set = data[YK].literature.find((x) => (x.setId || x.id) === SID);
const sent = (id) => String((set.sents.find((s) => String(s.id) === String(id)) || {}).t || "");

// 잘라낼 자리 — 시작 어구부터 끝 어구까지, 문장 원문 그대로
const SPEC = [
  { qId: "22", num: 4, sid: "l20279bs43", was: "말이란 거창할 필요가 없으며…", from: "말이란", to: "필요가 없으며" },
  { qId: "27", num: 3, sid: "l20279bs25", was: "내 자전거 바퀴가 치르르치르르 도는 소리", from: "내 자전거 바퀴가", to: "도는 소리" },
];

console.log("# l20279b cs_spans 수리 (D-196)");
console.log("");
console.log(`- all_data MD5 \`${md5(before)}\``);
console.log("");
console.log("| 선지 | 문장 | 전 | 후 |");
console.log("|---|---|---|---|");

const fail = [], plans = [];
for (const S of SPEC) {
  const q = set.questions.find((x) => String(x.id) === S.qId);
  const c = q && q.choices.find((x) => x.num === S.num);
  if (!c) { fail.push(`Q${S.qId}#${S.num} 없음`); continue; }
  const t = sent(S.sid);
  if (!t) { fail.push(`${S.sid} 문장 없음`); continue; }
  const i = t.indexOf(S.from), k = t.indexOf(S.to);
  if (i < 0 || k < 0) { fail.push(`${S.sid} 어구를 문장에서 못 찾았다`); continue; }
  if (k < i) { fail.push(`${S.sid} 끝 어구가 시작보다 앞이다`); continue; }
  const next = t.slice(i, k + S.to.length);
  if (!t.includes(next)) { fail.push(`${S.sid} 잘라낸 결과가 문장의 부분문자열이 아니다`); continue; }
  const hits = (c.cs_spans || []).map((sp, n) => [sp, n]).filter(([sp]) => String(sp.sent_id) === S.sid && sp.text === S.was);
  if (hits.length !== 1) { fail.push(`Q${S.qId}#${S.num} 대상 span 이 ${hits.length}개`); continue; }
  if ((c.cs_spans || []).some((sp) => String(sp.sent_id) === S.sid && sp.text === next)) { fail.push(`Q${S.qId}#${S.num} 같은 span 이 이미 있다`); continue; }
  plans.push({ ...S, c, idx: hits[0][1], next, t });
  console.log(`| Q${S.qId}#${S.num} | \`${S.sid}\` | ${JSON.stringify(S.was)} | **${JSON.stringify(next)}** |`);
}
console.log("");
if (fail.length || plans.length !== SPEC.length) {
  console.log("## 🔴 사전 검사 실패 — 아무것도 쓰지 않는다");
  fail.forEach((x) => console.log(`- ${x}`));
  process.exit(1);
}
console.log("✅ 사전 검사 통과 — 2건 · 잘라낸 결과가 모두 문장의 부분문자열");
console.log("");
if (!APPLY) { console.log("### 미리보기 — 아무것도 쓰지 않았다. `--apply`"); process.exit(0); }

fs.writeFileSync(path.join(ROOT, "pipeline/backups/all_data_204.before_d196span.json"), before);
const pre = JSON.parse(before.toString("utf8"));
for (const p of plans) p.c.cs_spans[p.idx].text = p.next;
fs.writeFileSync(DATA, JSON.stringify(data), "utf8");

const after = fs.readFileSync(DATA);
const back = JSON.parse(after.toString("utf8"));
const bad = [];
let nl = 0; for (const x of after) if (x === 10) nl++;
if (nl) bad.push(`개행 ${nl} — minified 위반`);
const bset = back[YK].literature.find((x) => (x.setId || x.id) === SID);
for (const p of plans) {
  const c = bset.questions.find((x) => String(x.id) === p.qId).choices.find((x) => x.num === p.num);
  const sp = (c.cs_spans || []).filter((s) => String(s.sent_id) === p.sid && s.text === p.next);
  if (sp.length !== 1) bad.push(`Q${p.qId}#${p.num} 새 span 이 ${sp.length}개`);
  if ((c.cs_spans || []).some((s) => s.text === p.was)) bad.push(`Q${p.qId}#${p.num} 옛 span 잔존`);
  if (!sent(p.sid).includes(p.next)) bad.push(`${p.sid} 새 span 이 문장에 없다`);
}
for (const [yk, v] of Object.entries(pre)) for (const sec of ["reading", "literature"]) for (const st of v[sec] || []) {
  const sid = st.setId || st.id;
  const cur = (back[yk]?.[sec] || []).find((x) => (x.setId || x.id) === sid);
  if (yk === YK && sid === SID) {
    if (JSON.stringify(st.sents) !== JSON.stringify(cur.sents)) bad.push("본문이 달라졌다");
    continue;
  }
  if (JSON.stringify(st) !== JSON.stringify(cur)) bad.push(`${yk}::${sid} 가 달라졌다`);
}
console.log(`- 적용 후 MD5 \`${md5(after)}\` (${after.length - before.length >= 0 ? "+" : ""}${after.length - before.length}B)`);
if (bad.length) { console.log("## 🔴 되읽기 검산 실패"); bad.forEach((x) => console.log(`- ${x}`)); process.exit(1); }
console.log("## ✅ 되읽기 검산 통과 — span 2건만 교체 · 본문·다른 세트·회차 무변 · minified 유지");
