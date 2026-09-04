// d190_w2_apply.mjs — 2027_9월 W2 수리 (발주 D-190)
//
// 대상 2세트 4건
//   ① l20279a — [A] [B] 미정박 (annotations.json 에 bracket 없음)
//   ② l20279d — [A] 미정박 1건 + cs_span 불일치 1건
//
// ★ 구간은 원본 PDF 판독으로만 정했다 (D-104 — 자동 생성 금지)
//   l20279a [A]  p6  라벨 x443.8 y268.6~280.4 · 들여쓴 인용 블록(x475.3) 5행
//                → 「‘내가 사 년을 남복…」 ~ 「…과거를 보러 가리라.’」 = s4~s8
//   l20279a [B]  p7  라벨 x95.1 y536.4 · 들여쓴 인용 블록(x126.7) 5행
//                → 「“어질다, 너의 소견이여…」 ~ 「…속절없이 되었도다.”」 = s68~s72
//   l20279d [A]  p12 꺾쇠 세로선 x340.1 y518.5~595.9 + 610.0~687.4
//                (라벨 [A] 가 y598.3~610.1 에 끼어 선이 두 토막이다. 합치면 518.5~687.4)
//                → 그 구간의 verse 10행 = s38~s47. 문장 10개 전문 대조 10/10 일치.
//                  구간 밖 첫 행 s48「두어라 왕께서…」도 PDF 와 일치함을 확인했다.
//
// ★ cs_span 불일치 — 어구를 「고친다」이지 새로 만들지 않는다
//   l20279d Q32#1 의 span 「객회는 쓸쓸한데」 가 원문에 없다.
//   원문 s2 = 「㉠ 가을이 점점 깊고 객회(客懷)는 쓸쓸한데」 — 한자 괄호가 빠져 있었다.
//   원문 그대로 「객회(客懷)는 쓸쓸한데」 로 고친다. 같은 선지의 다른 span 2개는 손대지 않는다.
//
// ★ annotations.json 은 2칸 들여쓰기 · 끝 개행 없음 (D-154 사고)
//
// 사용: node pipeline/d190_w2_apply.mjs [--apply]

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = path.join(ROOT, "data-source/all_data_204.json");
const ANN = path.join(ROOT, "public/data/annotations.json");
const APPLY = process.argv.includes("--apply");
const md5 = (b) => crypto.createHash("md5").update(b).digest("hex");
const YK = "2027_9월";

// ── SPEC ────────────────────────────────────────────────────────────────
const BRACKETS = [
  { sid: "l20279a", label: "A", from: "l20279as4", to: "l20279as8",
    head: "‘내가 사 년을 남복(男服)으로 세상에 용납하니 사람들이", tail: "전할지니 과거를 보러 가리라.’" },
  { sid: "l20279a", label: "B", from: "l20279as68", to: "l20279as72",
    head: "“어질다, 너의 소견이여. 밝고 높음이 오히려 내가 미치지", tail: "아니하리오. 칠 년 공명이 속절없이 되었도다.”" },
  { sid: "l20279d", label: "A", from: "l20279ds38", to: "l20279ds47",
    head: "연잎으로 옷을 짓고 연꽃으로 치마 지어", tail: "어느 날 이내 꿈을 생시로 삼을런가" },
];

const SPANFIX = [
  { sid: "l20279d", qid: 32, num: 1, was: "객회는 쓸쓸한데", now: "객회(客懷)는 쓸쓸한데" },
];

const findSet = (data, sid) => {
  for (const sec of ["reading", "literature"]) {
    const s = (data[YK]?.[sec] || []).find((x) => (x.setId || x.id) === sid);
    if (s) return { sec, s };
  }
  return null;
};

const beforeData = fs.readFileSync(DATA);
const beforeAnn = fs.readFileSync(ANN);
const data = JSON.parse(beforeData.toString("utf8"));
const ann = JSON.parse(beforeAnn.toString("utf8"));

console.log("# 2027_9월 W2 수리 — l20279a · l20279d (D-190)");
console.log("");
console.log(`- all_data MD5 \`${md5(beforeData)}\` · annotations MD5 \`${md5(beforeAnn)}\``);
console.log("");

const miss = [];

// ── bracket 사전 대조 ───────────────────────────────────────────────────
console.log("## 구간 대조 (원본 PDF 판독 ↔ 데이터)");
console.log("");
console.log("| 세트 | 라벨 | 시작 | 끝 | 행수 | 첫 행 | 끝 행 |");
console.log("|---|---|---|---|--:|---|---|");
for (const b of BRACKETS) {
  const f = findSet(data, b.sid);
  if (!f) { miss.push(`${b.sid} 세트 없음`); continue; }
  const sents = f.s.sents || [];
  const i0 = sents.findIndex((x) => String(x.id) === b.from);
  const i1 = sents.findIndex((x) => String(x.id) === b.to);
  if (i0 < 0) { miss.push(`${b.sid} ${b.from} 없음`); continue; }
  if (i1 < 0) { miss.push(`${b.sid} ${b.to} 없음`); continue; }
  if (i1 < i0) { miss.push(`${b.sid} [${b.label}] 시작이 끝보다 뒤다`); continue; }
  if (String(sents[i0].t).trim() !== b.head) { miss.push(`${b.sid} ${b.from} 첫 행이 판독본과 다르다`); continue; }
  if (String(sents[i1].t).trim() !== b.tail) { miss.push(`${b.sid} ${b.to} 끝 행이 판독본과 다르다`); continue; }
  // 이미 등재돼 있지 않은가
  const cur = (ann[YK] || {})[b.sid] || [];
  if (cur.some((a) => a.type === "bracket" && a.label === b.label)) { miss.push(`${b.sid} [${b.label}] 이미 등재돼 있다`); continue; }
  // 문항·선지가 실제로 이 라벨을 쓰는가
  let used = false;
  for (const q of f.s.questions || []) {
    let t = String(q.t || ""); for (const c of q.choices || []) t += String(c.t || "");
    if (t.includes(`[${b.label}]`)) used = true;
  }
  if (!used) { miss.push(`${b.sid} [${b.label}] 을 쓰는 문항이 없다 — 정박 불필요`); continue; }
  b._n = i1 - i0 + 1;
  console.log(`| \`${b.sid}\` | [${b.label}] | \`${b.from}\` | \`${b.to}\` | ${b._n} | ${b.head.slice(0, 20)}… | …${b.tail.slice(-18)} |`);
}
console.log("");

// ── span 사전 대조 ──────────────────────────────────────────────────────
console.log("## cs_span 어구 정정");
console.log("");
for (const s of SPANFIX) {
  const f = findSet(data, s.sid);
  const q = f && (f.s.questions || []).find((x) => x.id === s.qid);
  const c = q && (q.choices || []).find((x) => x.num === s.num);
  if (!c) { miss.push(`${s.sid} Q${s.qid}#${s.num} 선지 없음`); continue; }
  const sp = (c.cs_spans || []).filter((x) => x.text === s.was);
  if (sp.length !== 1) { miss.push(`${s.sid} Q${s.qid}#${s.num} — 「${s.was}」 span 이 ${sp.length}개다 (1개여야 한다)`); continue; }
  const sent = (f.s.sents || []).find((x) => String(x.id) === sp[0].sent_id);
  if (!sent) { miss.push(`${s.sid} span 문장 ${sp[0].sent_id} 없음`); continue; }
  if (String(sent.t).includes(s.was)) { miss.push(`${s.sid} 「${s.was}」 가 원문에 이미 있다 — 정정 불필요`); continue; }
  const n = String(sent.t).split(s.now).length - 1;
  if (n !== 1) { miss.push(`${s.sid} 새 어구 「${s.now}」 가 원문에 ${n}회 (1회여야 한다)`); continue; }
  console.log(`- \`${s.sid}\` Q${s.qid}#${s.num} · \`${sp[0].sent_id}\``);
  console.log(`  - 원문   ${JSON.stringify(sent.t)}`);
  console.log(`  - 현재   \`${s.was}\`  → 원문에 없음 (형광펜 안 켜짐)`);
  console.log(`  - 정정   \`${s.now}\`  → 원문 그대로 1회`);
  s._c = c; s._sp = sp[0];
}
console.log("");

if (miss.length) {
  console.log("## 🔴 사전 대조 실패 — 아무것도 쓰지 않는다");
  console.log("");
  miss.forEach((x) => console.log(`- ${x}`));
  process.exit(1);
}
console.log("✅ 사전 대조 통과 — bracket 3건 · span 1건");
console.log("");
if (!APPLY) { console.log("### 미리보기 — 아무것도 쓰지 않았다. `--apply`"); process.exit(0); }

// ── 적용 ────────────────────────────────────────────────────────────────
fs.mkdirSync(path.join(ROOT, "pipeline/backups"), { recursive: true });
fs.writeFileSync(path.join(ROOT, "pipeline/backups/all_data_204.before_d190w2.json"), beforeData);
fs.writeFileSync(path.join(ROOT, "pipeline/backups/annotations.before_d190w2.json"), beforeAnn);

const annSnap = JSON.stringify(ann);
(ann[YK] ||= {});
for (const b of BRACKETS) {
  (ann[YK][b.sid] ||= []).push({ type: "bracket", label: b.label, sentFrom: b.from, sentTo: b.to });
}
for (const s of SPANFIX) s._sp.text = s.now;

fs.writeFileSync(DATA, JSON.stringify(data), "utf8");                       // §13⑪ minified
fs.writeFileSync(ANN, JSON.stringify(ann, null, 2), "utf8");                // 2칸 · 끝 개행 없음

// ── 되읽기 검산 (S-02) ──────────────────────────────────────────────────
const afterData = fs.readFileSync(DATA);
const afterAnn = fs.readFileSync(ANN);
const fail = [];
if (afterData[0] === 0xef || afterAnn[0] === 0xef) fail.push("BOM");
let nl = 0; for (const x of afterData) if (x === 10) nl++;
if (nl !== 0) fail.push(`all_data 개행 ${nl} (minified 아님)`);
if (afterAnn[afterAnn.length - 1] === 10) fail.push("annotations 끝에 개행이 붙었다");

const back = JSON.parse(afterData.toString("utf8"));
const backAnn = JSON.parse(afterAnn.toString("utf8"));

for (const b of BRACKETS) {
  const list = (backAnn[YK] || {})[b.sid] || [];
  const hit = list.filter((a) => a.type === "bracket" && a.label === b.label);
  if (hit.length !== 1) { fail.push(`${b.sid} [${b.label}] 등재 ${hit.length}건`); continue; }
  if (hit[0].sentFrom !== b.from || hit[0].sentTo !== b.to) fail.push(`${b.sid} [${b.label}] 구간 미반영`);
  const f = findSet(back, b.sid);
  const ids = new Set((f.s.sents || []).map((x) => String(x.id)));
  if (!ids.has(b.from) || !ids.has(b.to)) fail.push(`${b.sid} [${b.label}] 끊긴 문장 참조`);
}
for (const s of SPANFIX) {
  const f = findSet(back, s.sid);
  const c = f.s.questions.find((q) => q.id === s.qid).choices.find((x) => x.num === s.num);
  const sent = f.s.sents.find((x) => String(x.id) === "l20279ds2");
  if ((c.cs_spans || []).some((x) => x.text === s.was)) fail.push(`${s.sid} 옛 어구 잔존`);
  const now = (c.cs_spans || []).filter((x) => x.text === s.now);
  if (now.length !== 1) fail.push(`${s.sid} 새 어구 ${now.length}건`);
  else if (!String(sent.t).includes(now[0].text)) fail.push(`${s.sid} 새 어구가 원문에 없다`);
  if ((c.cs_spans || []).length !== 3) fail.push(`${s.sid} span 개수가 ${(c.cs_spans || []).length} (3이어야 한다)`);
}
// 본문·해설·선지 무변 — 2027_9월 전 세트
for (const sid of ["l20279a", "l20279d"]) {
  const a = findSet(data, sid), b2 = findSet(back, sid);
  if (JSON.stringify(a.s.sents) !== JSON.stringify(b2.s.sents)) fail.push(`${sid} 본문이 달라졌다`);
  const anaA = (a.s.questions || []).flatMap((q) => (q.choices || []).map((c) => c.analysis));
  const anaB = (b2.s.questions || []).flatMap((q) => (q.choices || []).map((c) => c.analysis));
  if (JSON.stringify(anaA) !== JSON.stringify(anaB)) fail.push(`${sid} 해설이 달라졌다`);
}
// annotations 다른 회차 무변
const preAnn = JSON.parse(annSnap);
for (const k of Object.keys(preAnn)) {
  if (k === YK) continue;
  if (JSON.stringify(preAnn[k]) !== JSON.stringify(backAnn[k])) fail.push(`annotations ${k} 가 달라졌다`);
}

console.log(`- 적용 후 all_data MD5 \`${md5(afterData)}\` (${afterData.length - beforeData.length >= 0 ? "+" : ""}${afterData.length - beforeData.length}B)`);
console.log(`- 적용 후 annotations MD5 \`${md5(afterAnn)}\` (${afterAnn.length - beforeAnn.length >= 0 ? "+" : ""}${afterAnn.length - beforeAnn.length}B)`);
console.log("- 백업 `pipeline/backups/{all_data_204,annotations}.before_d190w2.json`");
console.log("");
if (fail.length) {
  console.log("## 🔴 되읽기 검산 실패 — 백업으로 되돌리십시오");
  fail.forEach((x) => console.log(`- ${x}`));
  process.exit(1);
}
console.log("## ✅ 되읽기 검산 통과 (S-02)");
console.log("");
console.log("- bracket 3건 등재 · 구간 문장 실재 · 끊긴 참조 0");
console.log("- cs_span 어구 정정 1건 · 원문 그대로 1회 · 같은 선지의 다른 span 2개 무변");
console.log("- **본문·해설·선지 무변** · 다른 회차 annotations 무변");
console.log("- all_data minified 유지 · annotations 2칸 들여쓰기 · 끝 개행 없음");
