// d194_apply.mjs — r20279b s10 재분리 + 📌 3건 (발주 D-194)
//
// ★ s10 은 「분리」가 아니라 「글자 복원 + 분리」다
//   원본 p2 는 두 문단이고 그 경계에 「한다.」가 있다.
//       … 차별도 정당화되어야 한다.
//       종 차별주의는 우리가 다른 종과 달리 …
//   데이터 s10 은 그 「한다.」 3자를 잃고 두 문단이 한 문장으로 붙어 있었다.
//   러너의 문장 분할이 줄바꿈 「\n한다.\n」 을 삼킨 것으로 보인다.
//   내가 지어낸 글자가 아니라 원본에 있는 3자를 되돌린다 (§13⑬).
//
// ★ id 규약 — l20199e 전례 그대로 (심사관 승인)
//   앞 조각은 r20279bs10 을 **보존**하고, 뒤 조각만 900번대 신규 id 를 받아
//   배열상 바로 뒤에 삽입한다. 재번호하지 않는다.
//   재번호하면 s11~s29 열아홉 개 id 가 바뀌고 이 세트 근거를 전부 다시 걸어야 한다.
//   얻는 것은 「번호 연속」뿐이다.
//
//   s10 참조는 Q8#2 하나뿐이고(cs_ids 1 · cs_span 1), 그 span 「정신 능력의 수준」은
//   앞 조각 안에 있으므로 파급이 없다. 적용 전후로 확인한다.
//
// ★ 📌 인용은 전부 원문에서 만든다 — 「공백 하나로 잇고 바깥 겹따옴표 제거」
//   이 세트가 이미 쓰던 규칙인지 기존 인용으로 재현해 확인한 뒤에 쓴다.
//
// 사용: node pipeline/d194_apply.mjs [--apply]

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = path.join(ROOT, "data-source/all_data_204.json");
const APPLY = process.argv.includes("--apply");
const md5 = (b) => crypto.createHash("md5").update(b).digest("hex");
const YK = "2027_9월", SID = "r20279b";
const S10 = "r20279bs10", S901 = "r20279bs901";
const SPLIT_AT = "종 차별주의는";
// 원본은 「정당화되어야 한다.」 — 「되어야」와 「한다.」 사이에 공백이 있다.
// 앞 조각 끝의 공백을 trim 한 뒤 붙이므로 여기에 공백을 포함해 둔다.
// (공백 없이 붙였다가 「정당화되어야한다.」가 나온 것을 미리보기에서 잡았다)
const RESTORE = " 한다.";

const before = fs.readFileSync(DATA);
const data = JSON.parse(before.toString("utf8"));
const set = (data[YK]?.reading || []).find((x) => (x.setId || x.id) === SID);
if (!set) { console.log("🔴 세트 없음"); process.exit(1); }
const ch = (q, n) => set.questions.find((x) => x.id === q)?.choices?.find((y) => y.num === n);

console.log("# r20279b s10 재분리 + 📌 3건 (D-194)");
console.log("");
console.log(`- 적용 전 MD5 \`${md5(before)}\``);
console.log("");

const miss = [];

// ── ① s10 분리 계획 ────────────────────────────────────────────────────
const i10 = (set.sents || []).findIndex((x) => String(x.id) === S10);
if (i10 < 0) miss.push(`${S10} 없음`);
if ((set.sents || []).some((x) => String(x.id) === S901)) miss.push(`${S901} 이 이미 있다`);
let headT = null, tailT = null;
if (i10 >= 0) {
  const cur = String(set.sents[i10].t);
  const at = cur.indexOf(SPLIT_AT);
  if (at < 0) miss.push(`s10 에 「${SPLIT_AT}」 가 없다`);
  else if (cur.indexOf(SPLIT_AT, at + 1) >= 0) miss.push(`s10 에 「${SPLIT_AT}」 가 2회 이상이다`);
  else {
    headT = cur.slice(0, at).replace(/\s+$/, "") + RESTORE;
    tailT = cur.slice(at);
    if (!/정당화되어야$/.test(cur.slice(0, at).replace(/\s+$/, ""))) miss.push("분리점 앞이 「정당화되어야」로 끝나지 않는다");
    if (!/옹호되기도 한다\.$/.test(tailT)) miss.push("분리점 뒤가 「옹호되기도 한다.」로 끝나지 않는다");
  }
  console.log("## ① s10 분리 + 「한다.」 복원");
  console.log("");
  console.log(`- 현재 \`${S10}\` (${cur.length}자)`);
  console.log(`  ${JSON.stringify(cur)}`);
  console.log("");
  console.log(`- 앞 \`${S10}\` (보존) → ${JSON.stringify(headT)}`);
  console.log(`- 뒤 \`${S901}\` (신규) → ${JSON.stringify(tailT)}`);
  console.log(`- 배열 위치: index ${i10} 뒤에 삽입 · 재번호 없음`);
  // 참조 파급
  let cid = 0, csp = 0; const spanTexts = [];
  for (const q of set.questions || []) for (const c of q.choices || []) {
    cid += (c.cs_ids || []).filter((x) => String(x) === S10).length;
    for (const sp of c.cs_spans || []) if (String(sp.sent_id) === S10) { csp++; spanTexts.push(sp.text); }
  }
  const spanInHead = spanTexts.every((t) => headT && headT.includes(t));
  console.log(`- \`${S10}\` 참조: cs_ids ${cid}건 · cs_spans ${csp}건 ${spanTexts.map((t) => JSON.stringify(t)).join(" ")}`);
  console.log(`- span 이 전부 앞 조각 안에 있나: ${spanInHead ? "✅" : "🔴"}`);
  if (!spanInHead) miss.push("s10 span 이 앞 조각 밖이다 — 재정박이 먼저다");
  console.log("");
}

// ── 인용 이음 규칙 자체 검증 ────────────────────────────────────────────
const joinQ = (fromId, toId, sents) => {
  const a = sents.findIndex((x) => String(x.id) === fromId), b = sents.findIndex((x) => String(x.id) === toId);
  if (a < 0 || b < 0 || b < a) return null;
  return sents.slice(a, b + 1).map((x) => String(x.t)).join(" ").replace(/^[“"]/, "").replace(/[”"]$/, "");
};
{
  const legacy = joinQ("r20279bs13", "r20279bs13", set.sents);
  const c45 = ch(4, 5);
  if (!c45 || !String(c45.analysis).includes(legacy)) miss.push("이음 규칙 검증 실패 — s13 재현이 기존 인용과 다르다");
  else console.log("- ✅ 이음 규칙 자체 검증 통과 (기존 Q4#5 의 s13 인용 재현)\n");
}

// ── 적용 후 문장 배열을 미리 만들어 인용을 뽑는다 ───────────────────────
const nextSents = i10 < 0 ? set.sents : [
  ...set.sents.slice(0, i10),
  { ...set.sents[i10], t: headT },
  { id: S901, t: tailT, sentType: set.sents[i10].sentType || "body" },
  ...set.sents.slice(i10 + 1),
];
const Q_s10 = joinQ(S10, S10, nextSents);
const Q_s9 = joinQ("r20279bs9", "r20279bs9", nextSents);
const Q_s9s10 = joinQ("r20279bs9", S10, nextSents);
const Q_s12s13 = joinQ("r20279bs12", "r20279bs13", nextSents);

// ── ②③④⑤ 📌 편집 ─────────────────────────────────────────────────────
const EDITS = [];
{
  // Q4#3 — 첫 인용을 수리된 s10 verbatim 으로. 원문은 「또한」인데 「이러한」으로 시작해 있었다.
  const c = ch(4, 3);
  if (!c) miss.push("Q4#3 선지 없음");
  else {
    const A0 = String(c.analysis);
    const m = A0.match(/"이러한 고차원적[^"]*"/);
    if (!m) miss.push("Q4#3 — 대상 인용을 못 찾는다");
    else EDITS.push({ tag: "② Q4#3 📌 재슬라이스", qid: 4, num: 3, was: m[0], now: `"${Q_s10}"`, note: "「이러한」→「또한」 · 끝 「한다.」 포함" });
  }
}
{
  // Q4#5 — 원문 순서 s12→s13 · 접속어 「그러나」 살림
  const c = ch(4, 5);
  if (!c) miss.push("Q4#5 선지 없음");
  else {
    const A0 = String(c.analysis);
    const m = A0.match(/"인간이 같은 집단[^"]*"/);
    if (!m) miss.push("Q4#5 — 대상 인용을 못 찾는다");
    else EDITS.push({ tag: "③ Q4#5 📌 원문 순서", qid: 4, num: 5, was: m[0], now: `"${Q_s12s13}"`, note: "s13→s12 역순·「또한」 → s12→s13 순서·「그러나」" });
  }
}
{
  // Q8#2 — "(가)" 를 따옴표 밖으로 + 끝을 「…정당화되어야 한다.」까지 확장
  const c = ch(8, 2);
  if (!c) miss.push("Q8#2 선지 없음");
  else {
    const A0 = String(c.analysis);
    const m = A0.match(/"\(가\) 하지만[^"]*"/);
    if (!m) miss.push("Q8#2 — 대상 인용을 못 찾는다");
    else EDITS.push({ tag: "④⑤ Q8#2 📌 (가) 밖으로 + 끝 확장", qid: 8, num: 2, was: m[0], now: `(가) "${Q_s9s10}"`, note: "(가) 따옴표 밖 · 끝 「정당화되어야」 → 「정당화되어야 한다.」" });
  }
}

console.log("## ②~⑤ 📌 편집");
console.log("");
for (const e of EDITS) {
  const c = ch(e.qid, e.num);
  const n = String(c.analysis).split(e.was).length - 1;
  if (n !== 1) { miss.push(`${e.tag} — 대상이 ${n}곳이다`); continue; }
  console.log(`### ${e.tag}`);
  console.log(`- ${e.note}`);
  console.log(`- 현재 ${JSON.stringify(e.was.length > 90 ? e.was.slice(0, 90) + "…\"" : e.was)}`);
  console.log(`- 정정 ${JSON.stringify(e.now.length > 90 ? e.now.slice(0, 90) + "…\"" : e.now)}`);
  console.log("");
}

if (miss.length) { console.log("## 🔴 사전 대조 실패 — 아무것도 쓰지 않는다"); console.log(""); miss.forEach((x) => console.log(`- ${x}`)); process.exit(1); }
if (EDITS.length !== 3) { console.log(`## 🔴 편집 ${EDITS.length} ≠ 3`); process.exit(1); }
console.log("✅ 사전 대조 통과 — s10 분리 1건 · 📌 3건");
console.log("");
if (!APPLY) { console.log("### 미리보기 — 아무것도 쓰지 않았다. `--apply`"); process.exit(0); }

fs.writeFileSync(path.join(ROOT, "pipeline/backups/all_data_204.before_d194.json"), before);
const pre = JSON.parse(before.toString("utf8"));
set.sents = nextSents;
for (const e of EDITS) { const c = ch(e.qid, e.num); c.analysis = String(c.analysis).split(e.was).join(e.now); }
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

// 문장 — 개수 +1 · s10 밖 무변 · 글자 합계는 「한다.」 만큼만 늘어난다
if ((s2.sents || []).length !== (s0.sents || []).length + 1) fail.push(`문장 수 ${(s0.sents || []).length} → ${(s2.sents || []).length} (+1 이어야 한다)`);
const others0 = (s0.sents || []).filter((x) => String(x.id) !== S10).map((x) => `${x.id}|${x.t}`).join("§");
const others1 = (s2.sents || []).filter((x) => String(x.id) !== S10 && String(x.id) !== S901).map((x) => `${x.id}|${x.t}`).join("§");
if (others0 !== others1) fail.push("**s10 밖 문장이 달라졌다**");
const joined1 = byId2.get(S10) + " " + byId2.get(S901);
const old10 = (s0.sents || []).find((x) => String(x.id) === S10).t;
if (joined1.replace(/\s+/g, "") !== (old10.slice(0, old10.indexOf(SPLIT_AT)).replace(/\s+$/, "") + RESTORE + " " + old10.slice(old10.indexOf(SPLIT_AT))).replace(/\s+/g, "")) fail.push("분리 결과가 원본+복원과 다르다");
if (!byId2.get(S10).endsWith("정당화되어야 한다.")) fail.push("앞 조각이 「정당화되어야 한다.」로 끝나지 않는다");
if (!byId2.get(S901).startsWith(SPLIT_AT)) fail.push("뒤 조각이 「종 차별주의는」으로 시작하지 않는다");
// 삽입 위치
const idx10 = (s2.sents || []).findIndex((x) => String(x.id) === S10);
if ((s2.sents || [])[idx10 + 1]?.id !== S901) fail.push("s901 이 s10 바로 뒤가 아니다");

// 참조·해설
let spanTotal = 0;
for (const q of s2.questions || []) for (const c of q.choices || []) {
  const c0 = s0.questions.find((x) => x.id === q.id).choices.find((x) => x.num === c.num);
  const isE = EDITS.some((e) => e.qid === q.id && e.num === c.num);
  if (!isE && String(c.analysis) !== String(c0.analysis)) fail.push(`Q${q.id}#${c.num} 해설이 달라졌다`);
  if (JSON.stringify(c.cs_ids) !== JSON.stringify(c0.cs_ids)) fail.push(`Q${q.id}#${c.num} cs_ids 가 달라졌다`);
  if (JSON.stringify(c.cs_spans) !== JSON.stringify(c0.cs_spans)) fail.push(`Q${q.id}#${c.num} cs_spans 가 달라졌다`);
  if (c.ok !== c0.ok || String(c.pat) !== String(c0.pat)) fail.push(`Q${q.id}#${c.num} ok/pat 이 달라졌다`);
  for (const id of c.cs_ids || []) if (!byId2.has(String(id))) fail.push(`Q${q.id}#${c.num} 끊긴 cs_id ${id}`);
  for (const sp of c.cs_spans || []) {
    spanTotal++;
    const t = byId2.get(String(sp.sent_id));
    if (t == null || !t.includes(sp.text)) fail.push(`Q${q.id}#${c.num} ${sp.sent_id} span 이 본문에 없다`);
  }
}
for (const e of EDITS) {
  const c2 = s2.questions.find((q) => q.id === e.qid).choices.find((x) => x.num === e.num);
  const c0 = s0.questions.find((q) => q.id === e.qid).choices.find((x) => x.num === e.num);
  if (String(c2.analysis).includes(e.was)) fail.push(`${e.tag} 옛 인용 잔존`);
  if (!String(c2.analysis).includes(e.now)) fail.push(`${e.tag} 새 인용 미반영`);
  if (String(c2.analysis).split(e.now).join(e.was) !== String(c0.analysis)) fail.push(`${e.tag} **해설이 인용 밖에서 달라졌다**`);
  const t0 = String(c0.analysis).trimEnd().split("\n").pop(), t1 = String(c2.analysis).trimEnd().split("\n").pop();
  if (t0 !== t1) fail.push(`${e.tag} 결론줄이 달라졌다`);
}
if (s2.title !== s0.title) fail.push("title 이 달라졌다");
for (const [yk, v] of Object.entries(pre)) for (const sec of ["reading", "literature"]) for (const st of v[sec] || []) {
  const sid = st.setId || st.id;
  if (yk === YK && sid === SID) continue;
  if (JSON.stringify(st) !== JSON.stringify((back[yk]?.[sec] || []).find((x) => (x.setId || x.id) === sid))) fail.push(`${yk}::${sid} 가 달라졌다`);
}

console.log(`- 적용 후 MD5 \`${md5(after)}\` (${after.length - before.length >= 0 ? "+" : ""}${after.length - before.length}B)`);
console.log("- 백업 `pipeline/backups/all_data_204.before_d194.json`");
console.log("");
if (fail.length) { console.log("## 🔴 되읽기 검산 실패 — 백업으로 되돌리십시오"); fail.forEach((x) => console.log(`- ${x}`)); process.exit(1); }
console.log("## ✅ 되읽기 검산 통과 (S-02)");
console.log(`- 문장 ${(s0.sents || []).length} → ${(s2.sents || []).length} · s901 이 s10 바로 뒤 · 재번호 0`);
console.log("- 분리 결과 = 원본 + 「한다.」 복원 · s10 밖 문장 무변");
console.log(`- cs_ids·cs_spans·ok·pat 무변 · 끊긴 id 0 · span ${spanTotal}건 전건 본문 부분 문자열`);
console.log("- 해설은 인용 밖에서 무변 · 결론줄 무변 · title 무변 · 다른 세트·회차 무변");
