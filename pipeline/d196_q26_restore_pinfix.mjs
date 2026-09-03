// d196_q26_restore_pinfix.mjs — Q26 기존본 복원 + 📌 인용 2건 수리 (발주 D-196 · 심사관 판정)
//
// ① 복원 — Q26 5선지를 재생성 직전 상태로 되돌린다.
//    심사관 판정: 재생성본이 기존본보다 나은 항목이 하나도 없다.
//    선지1 재생성본은 [C]를 「(다)에서」로 지칭해 구간 지시가 흐려졌고, 선지3 은 라벨
//    [대조 혼동]이 pat=L5 와 어긋났으며, 선지4·5 는 📌 verbatim 원칙을 깼다.
//    백업은 빈칸 복원 **뒤** 시점이라 발문은 그대로 유지된다 — 문항 본문은 건드리지 않는다.
//
// ② 📌 수리 — 두 건은 원인이 다르다. 한 묶음으로 다루지 않는다(심사관 진단 정정).
//    #1 종결 부호: 인용 끝 「…소리가 난다.'」의 닫는 작은따옴표가 원문에서는 그 자리에서
//       닫히지 않는다. 원문이 끝나는 자리에 맞춰 자른다.
//    #3 다문장 이음: 두 구간을 「~」로 이었다. 연속 substring 이 아니므로 규약 위반이다.
//       두 인용으로 분리한다 — 같은 세트 Q26#5 기존본이 이미 " / " 분리 형식을 쓴다.
//
// ★ 인용문을 손으로 다시 치지 않는다. 본문 문장을 한 칸 공백으로 이어 만든 원문에서
//   시작·끝 지점을 찾아 **잘라낸다**. 그래야 결과가 원문의 연속 부분문자열임이 보장된다.
//   (게이트의 HAY 도 sents 를 이어 공백을 한 칸으로 줄여 대조한다 — 같은 형태다)
//
// 본문 서술(🔍)과 결론줄은 손대지 않는다. 📌 줄만 고친다.
//
// 사용: node pipeline/d196_q26_restore_pinfix.mjs [--apply]

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "pipeline/test_data/d196_l20279b/step3_result.json");
const BAK = SRC + ".before_q26regen";
const SID = "l20279b", QID = "26";
const APPLY = process.argv.includes("--apply");
const md5 = (s) => crypto.createHash("md5").update(s).digest("hex");

const raw = fs.readFileSync(SRC, "utf8");
const j = JSON.parse(raw);
const bak = JSON.parse(fs.readFileSync(BAK, "utf8"));
const pick = (o) => (o.literature || []).find((x) => (x.setId || x.id) === SID);
const set = pick(j), bset = pick(bak);
const q = (set?.questions || []).find((x) => String(x.id) === QID);
const bq = (bset?.questions || []).find((x) => String(x.id) === QID);

// 본문을 한 칸 공백으로 이은 원문 — 여기서 잘라낸다
const JOINED = (set.sents || []).map((s) => String(s.t)).join(" ");
// 원문에 닫는 인용부호가 붙어 있으면 함께 가져온다 — 반쪽만 열린 인용을 화면에 남기지
// 않으려는 것이고, 여전히 원문의 연속 부분문자열이다. (U+201D 」 · U+2019 ')
const RE_CLOSER = /[”’]/;
function carve(startAt, endAfter) {
  const i = JOINED.indexOf(startAt);
  if (i < 0) return { err: `시작 어구를 원문에서 못 찾았다: ${startAt}` };
  const k = JOINED.indexOf(endAfter, i);
  if (k < 0) return { err: `끝 어구를 원문에서 못 찾았다: ${endAfter}` };
  if (JOINED.indexOf(startAt, i + 1) >= 0) return { err: `시작 어구가 원문에 두 곳 이상 있다: ${startAt}` };
  let end = k + endAfter.length;
  if (RE_CLOSER.test(JOINED[end] || "")) end += 1;
  return { text: JOINED.slice(i, end) };
}

// #1 은 아이의 말이 끝나는 자리까지 가져온다. 기존본 🔍 ①·②가 「피리 부는 것 같기도
//   하고 생황을 부는 것 같기도 한데 동글동글한 게 꼭 별 같다」를 근거로 쓰는데 📌 가
//   그 앞에서 끊겨 있었다 — 📌 는 🔍 가 기대는 대목을 덮어야 한다.
const CUT = {
  head: "한 아이가 뜰에서 놀다가",
  saidEnd: "이렇게 말했다.",
  ringEnd: "꼭 별 같단다.",
  friend: "그 동무가 자기 귀를 기울여",
  friendEnd: "한스럽게 여겼다.",
};

console.log("# Q26 기존본 복원 + 📌 인용 2건 수리 (D-196)");
console.log("");
console.log(`- 원천 MD5 \`${md5(raw)}\` · 백업 \`${path.basename(BAK)}\``);
console.log("");

const fail = [];
if (!q || !bq) fail.push("Q26 을 찾지 못했다");
if (q && bq && String(q.t) !== String(bq.t)) fail.push("발문이 백업과 다르다 — 빈칸 복원 시점이 어긋났다");
if (q && bq && q.choices.length !== bq.choices.length) fail.push("선지 수가 다르다");

// 잘라내기
const c1 = carve(CUT.head, CUT.ringEnd);
const c3a = carve(CUT.head, CUT.saidEnd);
const c3b = carve(CUT.friend, CUT.friendEnd);
for (const [k, v] of [["#1", c1], ["#3 앞", c3a], ["#3 뒤", c3b]]) if (v.err) fail.push(`${k} — ${v.err}`);

// 📌 줄 교체 SPEC — 대상 줄이 정확히 1곳이어야 한다
const PIN = [];
if (!fail.length) {
  const mk = (num, matchFrag, next) => {
    const c = bq.choices.find((x) => x.num === num);
    const lines = String(c.analysis).split("\n");
    const idx = lines.findIndex((l) => l.includes("📌") && l.includes(matchFrag));
    if (idx < 0) return fail.push(`#${num} — 대상 📌 줄을 못 찾았다 (${matchFrag})`);
    if (lines.filter((l) => l.includes("📌") && l.includes(matchFrag)).length !== 1) return fail.push(`#${num} — 대상 📌 줄이 2곳 이상이다`);
    PIN.push({ num, idx, before: lines[idx], after: next });
  };
  mk(1, "한 아이가 뜰에서", `📌 지문 근거: "${c1.text}"`);
  mk(3, "~", `📌 지문 근거: [C] "${c3a.text}" / "${c3b.text}"`);
}

if (fail.length || PIN.length !== 2) {
  console.log("## 🔴 사전 검사 실패 — 아무것도 쓰지 않는다");
  console.log("");
  fail.forEach((x) => console.log(`- ${x}`));
  process.exit(1);
}

console.log("## ① 복원 — Q26 5선지");
console.log("");
console.log("| 선지 | 현재(재생성본) | 복원할 기존본 |");
console.log("|---|--:|--:|");
for (const c of q.choices) {
  const b = bq.choices.find((x) => x.num === c.num);
  console.log(`| #${c.num} | ${String(c.analysis || "").length}자 | ${String(b.analysis || "").length}자 |`);
}
console.log("");
console.log("## ② 📌 수리 — 원문에서 잘라낸 결과");
console.log("");
for (const p of PIN) {
  console.log(`**#${p.num}**`);
  console.log("```");
  console.log("전: " + p.before);
  console.log("후: " + p.after);
  console.log("```");
  console.log("");
}
console.log("✅ 사전 검사 통과");
console.log("");
if (!APPLY) { console.log("### 미리보기 — 아무것도 쓰지 않았다. `--apply`"); process.exit(0); }

fs.writeFileSync(SRC + ".before_q26restore", raw, "utf8");
// 복원 — 기존본 선지를 통째로 되돌린다(pat·ok·표지 포함). 발문은 건드리지 않는다.
q.choices = JSON.parse(JSON.stringify(bq.choices));
for (const p of PIN) {
  const c = q.choices.find((x) => x.num === p.num);
  const lines = String(c.analysis).split("\n");
  lines[p.idx] = p.after;
  c.analysis = lines.join("\n");
}
fs.writeFileSync(SRC, JSON.stringify(j, null, 2), "utf8");

// ── 되읽기 검산 ─────────────────────────────────────────────────────────
const back = JSON.parse(fs.readFileSync(SRC, "utf8"));
const pre = JSON.parse(raw);
const bad = [];
const kq = pick(back).questions.find((x) => String(x.id) === QID);
if (String(kq.t) !== String(q.t)) bad.push("발문이 달라졌다");
for (const c of kq.choices) {
  const b = bq.choices.find((x) => x.num === c.num);
  const p = PIN.find((x) => x.num === c.num);
  if (c.ok !== b.ok || JSON.stringify(c.pat) !== JSON.stringify(b.pat) || c.t !== b.t) bad.push(`#${c.num} ok·pat·선지본문이 기존본과 다르다`);
  if (!p) { if (String(c.analysis) !== String(b.analysis)) bad.push(`#${c.num} 해설이 기존본과 다르다 (수리 대상이 아닌데 바뀌었다)`); continue; }
  const la = String(c.analysis).split("\n"), lb = String(b.analysis).split("\n");
  if (la.length !== lb.length) bad.push(`#${c.num} 줄 수가 달라졌다`);
  for (let i = 0; i < la.length; i++) {
    if (i === p.idx) { if (la[i] !== p.after) bad.push(`#${c.num} 📌 줄이 계획과 다르다`); continue; }
    if (la[i] !== lb[i]) bad.push(`#${c.num} ${i}번째 줄(📌 아님)이 달라졌다`);
  }
  if (la[p.idx].includes(" ~ ")) bad.push(`#${c.num} ~ 이음이 남아 있다`);
}
// Q26 외 전건 무변
for (const sec of ["reading", "literature"]) for (const s of pre[sec] || []) {
  const sid = s.setId || s.id;
  const cur = (back[sec] || []).find((x) => (x.setId || x.id) === sid);
  for (const oq of s.questions || []) {
    if (sid === SID && String(oq.id) === QID) continue;
    const cq = (cur?.questions || []).find((x) => String(x.id) === String(oq.id));
    if (JSON.stringify(oq) !== JSON.stringify(cq)) bad.push(`${sid} Q${oq.id} 가 달라졌다`);
  }
}
console.log(`- 적용 후 MD5 \`${md5(fs.readFileSync(SRC, "utf8"))}\``);
console.log(`- 백업 \`${path.basename(SRC)}.before_q26restore\``);
console.log("");
if (bad.length) { console.log("## 🔴 되읽기 검산 실패"); bad.forEach((x) => console.log(`- ${x}`)); process.exit(1); }
console.log("## ✅ 되읽기 검산 통과 (S-02)");
console.log("- Q26 5선지가 기존본 · ok·pat·선지본문 동일 · 발문 무변");
console.log("- 📌 두 줄만 교체 · 나머지 줄(🔍·결론줄) 전건 무변 · ~ 이음 0");
console.log("- Q26 외 문항·세트 전건 무변");
