// d190_w3_tail.mjs — W3 꼬리 수리 3건 (발주 D-190 · 심사관 gate3 조건)
//
// gate3 에서 두 세트 모두 r20279a 와 같은 결함이 남아 있는 것이 드러났다.
// 판정 1-c(「각자 웨이브에서 수리」)를 W3 범위에서 빠뜨린 것이다.
//
//   ① r20279c  s1 안내문 접두 제거 + title = 「어댑터의 전원 변환 방식」
//   ② r20279d  s1 안내문 접두 제거 + title = 「오피니언 리더와 2단계 유통 이론」
//   ③ r20279d  Q16#4 해설의 역고아 ⓐ·ⓑ 제거 (심사관 본안 승인)
//
// ★ title 문안은 심사관 확정본이다. 내가 짓지 않는다.
// ★ ③ 은 해설이 만든 라벨을 <보기> 원문 지칭으로 바꾸는 최소 수정이다.
//   본문 ⓐ 는 l20279ds9 의 「ⓐ 벗어나」로 어휘 문항용 마커이고, 해설의 ⓐ·ⓑ 와 무관하다.
//   본문에 ⓑ 가 없어 학생이 찾을 수 없던 자리다. 🔍 논지·결론줄·📌 줄은 건드리지 않는다.
//
// 사용: node pipeline/d190_w3_tail.mjs [--apply]

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = path.join(ROOT, "public/data/all_data_204.json");
const APPLY = process.argv.includes("--apply");
const md5 = (b) => crypto.createHash("md5").update(b).digest("hex");
const YK = "2027_9월";
const PREFIX = "다음 글을 읽고 물음에 답하시오. ";
const TITLE_WAS = "다음 글을 읽고 물음에 답하시오.";

const SETS = [
  { sid: "r20279c", title: "어댑터의 전원 변환 방식" },
  { sid: "r20279d", title: "오피니언 리더와 2단계 유통 이론" },
];

// ③ 역고아 — 심사관 본안. [was, now] 를 글자 그대로 치환한다.
const ANA = {
  sid: "r20279d", qid: 16, num: 4,
  edits: [
    ["ⓐ뉴스 사이트에서 직접 정보를 얻기도 하고(1단계), ⓑ친구가 신문을 읽고 전달해 주는 것을 받기도 한다(2단계)",
      "뉴스 사이트에서 직접 정보를 얻기도 하고(1단계), 친구가 신문을 읽고 전달해 주는 것을 받기도 한다(2단계)"],
    ["을의 ⓐ가 이에 해당한다. 그런데 을의 ⓑ는 신문→친구(오피니언 리더)→을(일반 이용자)의 2단계 경로이다.",
      "을이 뉴스 사이트에서 직접 얻는 경우가 이에 해당한다. 그런데 을이 친구에게서 전달받는 경우는 신문→친구(오피니언 리더)→을(일반 이용자)의 2단계 경로이다."],
  ],
};

const before = fs.readFileSync(DATA);
const data = JSON.parse(before.toString("utf8"));
const findSet = (dd, sid) => (dd[YK]?.reading || []).find((x) => (x.setId || x.id) === sid);

console.log("# W3 꼬리 수리 3건 (D-190 · gate3 조건)");
console.log("");
console.log(`- 적용 전 MD5 \`${md5(before)}\``);
console.log("");

const miss = [], plans = [];
console.log("## ①② s1 안내문 + title");
console.log("");
console.log("| 세트 | title (현재 → 확정) | s1 접두 제거 | s1 참조 |");
console.log("|---|---|---|--:|");
for (const t of SETS) {
  const set = findSet(data, t.sid);
  if (!set) { miss.push(`${t.sid} 세트 없음`); continue; }
  if (set.title !== TITLE_WAS) { miss.push(`${t.sid} title 이 ${JSON.stringify(set.title)} 다`); continue; }
  const s1 = (set.sents || [])[0];
  if (!s1) { miss.push(`${t.sid} 문장 없음`); continue; }
  if (!String(s1.t).startsWith(PREFIX)) { miss.push(`${t.sid} ${s1.id} 이 안내문으로 시작하지 않는다`); continue; }
  const rest = String(s1.t).slice(PREFIX.length);
  if (!rest.trim()) { miss.push(`${t.sid} 접두 제거하면 빈 문장이 된다`); continue; }
  let ref = 0;
  for (const q of set.questions || []) for (const c of q.choices || []) {
    ref += (c.cs_ids || []).filter((x) => String(x) === String(s1.id)).length;
    ref += (c.cs_spans || []).filter((x) => String(x.sent_id) === String(s1.id)).length;
  }
  if (ref) { miss.push(`🔴 ${t.sid} ${s1.id} 참조 ${ref}건 — 재정박이 먼저다`); continue; }
  plans.push({ ...t, set, s1, rest });
  console.log(`| \`${t.sid}\` | ${JSON.stringify(TITLE_WAS)} → **${JSON.stringify(t.title)}** | ${JSON.stringify(rest.slice(0, 34) + (rest.length > 34 ? "…" : ""))} | ${ref} |`);
}
console.log("");

console.log("## ③ 역고아 ⓐ·ⓑ 제거 (심사관 본안)");
console.log("");
const aset = findSet(data, ANA.sid);
const ac = aset?.questions?.find((q) => q.id === ANA.qid)?.choices?.find((x) => x.num === ANA.num);
let A0 = null, A1 = null;
if (!ac) miss.push(`${ANA.sid} Q${ANA.qid}#${ANA.num} 선지 없음`);
else {
  A0 = String(ac.analysis || ""); A1 = A0;
  for (const [was, now] of ANA.edits) {
    const n = A1.split(was).length - 1;
    if (n !== 1) { miss.push(`${ANA.sid} Q${ANA.qid}#${ANA.num} — 대상 문구가 ${n}곳이다: ${JSON.stringify(was.slice(0, 30))}…`); continue; }
    A1 = A1.split(was).join(now);
    console.log(`- 현재 ${JSON.stringify(was)}`);
    console.log(`- 정정 ${JSON.stringify(now)}`);
    console.log("");
  }
  const leftA = (A1.match(/ⓐ/g) || []).length, leftB = (A1.match(/ⓑ/g) || []).length;
  if (leftA || leftB) miss.push(`${ANA.sid} Q${ANA.qid}#${ANA.num} — 정정 후에도 ⓐ ${leftA}개 · ⓑ ${leftB}개 남는다`);
  // 결론줄·📌 줄 무변 확인
  const tail0 = A0.trimEnd().split("\n").pop(), tail1 = A1.trimEnd().split("\n").pop();
  if (tail0 !== tail1) miss.push("결론줄이 달라진다");
  const pin0 = A0.split("\n").filter((l) => l.includes("📌")).join("|");
  const pin1 = A1.split("\n").filter((l) => l.includes("📌")).join("|");
  if (pin0 !== pin1) miss.push("📌 줄이 달라진다");
  console.log(`- 결론줄 무변 ✅ · 📌 줄 무변 ✅ · 정정 후 해설 안 ⓐ ${leftA}개 · ⓑ ${leftB}개`);
  console.log("");
}

if (miss.length) { console.log("## 🔴 사전 대조 실패 — 아무것도 쓰지 않는다"); console.log(""); miss.forEach((x) => console.log(`- ${x}`)); process.exit(1); }
if (plans.length !== SETS.length) { console.log("## 🔴 계획 수 불일치"); process.exit(1); }
console.log("✅ 사전 대조 통과 — s1 2건 · title 2건 · 해설 1건");
console.log("");
if (!APPLY) { console.log("### 미리보기 — 아무것도 쓰지 않았다. `--apply`"); process.exit(0); }

fs.writeFileSync(path.join(ROOT, "pipeline/backups/all_data_204.before_d190w3tail.json"), before);
const pre = JSON.parse(before.toString("utf8"));
for (const p of plans) { p.set.title = p.title; p.s1.t = p.rest; }
ac.analysis = A1;
fs.writeFileSync(DATA, JSON.stringify(data), "utf8");   // §13⑪

// ── 되읽기 검산 ─────────────────────────────────────────────────────────
const after = fs.readFileSync(DATA);
const fail = [];
if (after[0] === 0xef) fail.push("BOM");
let nl = 0; for (const x of after) if (x === 10) nl++;
if (nl !== 0) fail.push(`개행 ${nl}`);
const back = JSON.parse(after.toString("utf8"));

for (const p of plans) {
  const s2 = findSet(back, p.sid), s0 = findSet(pre, p.sid);
  if (s2.title !== p.title) fail.push(`${p.sid} title 미반영`);
  const b1 = (s2.sents || [])[0];
  if (b1.t !== p.rest) fail.push(`${p.sid} s1 미반영`);
  if (String(b1.t).startsWith("다음 글을 읽고")) fail.push(`${p.sid} s1 에 안내문 잔존`);
  if ((s2.sents || []).length !== (s0.sents || []).length) fail.push(`${p.sid} 문장 수가 달라졌다`);
  const rest0 = (s0.sents || []).slice(1).map((x) => x.t).join("§");
  const rest1 = (s2.sents || []).slice(1).map((x) => x.t).join("§");
  if (rest0 !== rest1) fail.push(`${p.sid} s1 밖 본문이 달라졌다`);
  // 해설·선지는 r20279d Q16#4 하나 말고 전부 무변
  for (const q of s2.questions || []) for (const c of q.choices || []) {
    const c0 = s0.questions.find((x) => x.id === q.id).choices.find((x) => x.num === c.num);
    const isTarget = p.sid === ANA.sid && q.id === ANA.qid && c.num === ANA.num;
    if (!isTarget && String(c.analysis) !== String(c0.analysis)) fail.push(`${p.sid} Q${q.id}#${c.num} 해설이 달라졌다`);
    if (JSON.stringify(c.cs_ids) !== JSON.stringify(c0.cs_ids)) fail.push(`${p.sid} Q${q.id}#${c.num} cs_ids 가 달라졌다`);
    if (JSON.stringify(c.cs_spans) !== JSON.stringify(c0.cs_spans)) fail.push(`${p.sid} Q${q.id}#${c.num} cs_spans 가 달라졌다`);
    if (c.ok !== c0.ok || String(c.pat) !== String(c0.pat)) fail.push(`${p.sid} Q${q.id}#${c.num} ok/pat 이 달라졌다`);
  }
}
{
  const s2 = findSet(back, ANA.sid);
  const c2 = s2.questions.find((q) => q.id === ANA.qid).choices.find((x) => x.num === ANA.num);
  const got = String(c2.analysis);
  if ((got.match(/ⓐ/g) || []).length || (got.match(/ⓑ/g) || []).length) fail.push("해설에 ⓐ·ⓑ 잔존");
  // 되돌리면 원문과 같아야 한다
  let rev = got;
  for (const [was, now] of ANA.edits) rev = rev.split(now).join(was);
  if (rev !== A0) fail.push("**해설이 지정 문구 밖에서 달라졌다**");
}
// 제너릭 전체 트리 비교 — 5경로 (title 2 · s1 2 · analysis 1)
const paths = [];
(function walk(a, b, pth) {
  if (a === b) return;
  if (typeof a !== typeof b || a === null || b === null || typeof a !== "object") { paths.push(pth); return; }
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) walk(a[k], b[k], pth ? `${pth}.${k}` : k);
})(pre, back, "");
if (paths.length !== 5) fail.push(`바뀐 경로가 ${paths.length}개다 (5 여야 한다) — ${paths.slice(0, 8).join(" / ")}`);

console.log(`- 적용 후 MD5 \`${md5(after)}\` (${after.length - before.length >= 0 ? "+" : ""}${after.length - before.length}B)`);
console.log(`- 바뀐 경로 **${paths.length}개**`);
paths.forEach((x) => console.log(`  - \`${x}\``));
console.log("- 백업 `pipeline/backups/all_data_204.before_d190w3tail.json`");
console.log("");
if (fail.length) { console.log("## 🔴 되읽기 검산 실패 — 백업으로 되돌리십시오"); fail.forEach((x) => console.log(`- ${x}`)); process.exit(1); }
console.log("## ✅ 되읽기 검산 통과 (S-02)");
console.log("- s1 안내문 잔존 0 · 문장 수 무변 · s1 밖 본문 무변");
console.log("- 해설은 Q16#4 하나만 바뀌었고, 되돌리면 원문과 글자 그대로 같다");
console.log("- 결론줄·📌 줄 무변 · cs_ids·cs_spans·ok·pat 무변");
console.log("- 바뀐 경로가 정확히 5개다 (title 2 · s1 2 · analysis 1)");
