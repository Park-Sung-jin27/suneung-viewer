// d208_r20256d_delete.mjs — r20256d Q14 활동지 주석 5건 삭제 (발주 D-208)
//
// 삭제 근거 3중 (심사관 판정):
//   ① 지면에 밑줄이 없다 — 활동지 구간(2025_6월 p5 우단 y470~790)의 가로선 19개가
//      전부 폭 289.5/306.5 상자·구분선이고 밑줄 폭의 짧은 선이 0개다. 같은 지면의
//      진짜 밑줄(y262.4 폭158.0 「㉠몇몇 논리학자들이 제기한 문제였」· y459.8 폭20.7
//      「않은」)은 같은 판독기가 잡는다. **허위 주석이다.**
//   ② 화면에 안 그려진다 — text 가 bogi 에도 선지에도 그대로는 없어(구분 기호
//      「:」 vs 「―」) 어느 렌더 경로도 집지 않는다. 표시 0건.
//   ③ 정보가 중복이다 — 활동지 항목 ①~⑤ 는 이미 선지 1~5 로 이관돼 있고
//      선지 num 이 곧 ①~⑤ 다(D-207 구두점 무시 대조 5/5 일치).
//
// ★ 표기 오탈 3건(「에이어 : 」 공백)은 이 삭제로 소멸한다 — 별건 수리 불요.
//
// ★ 대상을 손으로 적지 않는다. 조건으로 도출하고 건수가 맞는지 확인한다.
//     조건: r20256d · target="bogi" · qId=14 · marker ∈ ①~⑤
//
// 사용: node pipeline/d208_r20256d_delete.mjs [--apply]

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { foldIfAnnSafe } from "file:///C:/Users/downf/jippi-bo/src/layoutBreaks.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ANN = path.join(ROOT, "public/data/annotations.json");
const DATA = path.join(ROOT, "public/data/all_data_204.json");
const APPLY = process.argv.includes("--apply");
const md5 = (b) => crypto.createHash("md5").update(b).digest("hex");

const YK = "2025_6월", SID = "r20256d", QID = 14, EXPECT = 5;
const MARK = /^[①②③④⑤]$/;

const before = fs.readFileSync(ANN);
const ann = JSON.parse(before.toString("utf8"));
const data = JSON.parse(fs.readFileSync(DATA, "utf8"));
const set = (data[YK]?.reading || []).find((x) => (x.setId || x.id) === SID);
const q = set && (set.questions || []).find((x) => x.id === QID);

console.log("# r20256d Q14 활동지 주석 5건 삭제 (D-208)");
console.log("");
console.log(`- annotations MD5 \`${md5(before)}\``);
console.log("");

const fail = [];
if (!q) fail.push(`${SID} Q${QID} 를 못 찾았다`);

// ★ 스냅샷을 뜬다 — ann[YK][SID] 를 그대로 들고 있으면 아래 splice 에 같이 줄어
//   되읽기 검산의 「항목 수 N-5 ≠ N」 이 항상 틀린 값으로 비교된다(D-199 재발).
const live = (ann[YK] || {})[SID] || [];
const list = JSON.parse(JSON.stringify(live));
const plans = [];
list.forEach((a, i) => {
  if (a.target !== "bogi" || a.qId !== QID || !MARK.test(String(a.marker || ""))) return;
  plans.push({ i, a });
});

// ── 렌더 경로 — 지금 정말 0건인가. 그려지는 것을 지우면 표시가 준다 ──────
const bogiText = (b) => (typeof b === "string" ? b : (b && typeof b.text === "string" ? b.text : null));
function drawnBogi(L) {
  const sib = L.filter((x) => x.target === "bogi" && x.qId === QID && (x.type === "underline" || x.type === "box"));
  const bt = q ? bogiText(q.bogi) : null;
  if (bt == null) return [];
  const folded = foldIfAnnSafe(bt, sib);
  const out = [];
  let cur = 0;
  for (const o of sib.map((x) => ({ x, i: folded.indexOf(x.text) })).filter((o) => o.i >= 0).sort((m, n) => m.i - n.i)) {
    if (o.i < cur) continue;
    out.push(o.x.marker || o.x.text.slice(0, 8));
    cur = o.i + String(o.x.text).length;
  }
  return out;
}
function drawnChoice(L) {
  const picked = L.filter((a) => a.target === "choice" && a.qId === QID && (a.type === "underline" || a.type === "box"));
  const out = [];
  for (const c of q.choices || []) {
    const t = String(c.t);
    let cur = 0;
    for (const o of picked.filter((a) => a.choiceNum === c.num).map((a) => ({ a, i: t.indexOf(a.text) }))
      .filter((o) => o.i >= 0).sort((m, n) => m.i - n.i)) {
      if (o.i < cur) continue;
      out.push(`선지${c.num}`); cur = o.i + String(o.a.text).length;
    }
  }
  return out;
}
const passageOf = (L) => L.filter((a) => !a.target || a.target === "passage").map((a) => JSON.stringify(a)).sort().join("|");

console.log("| # | type | 마커 | text | 보기에 있나 | 본문에 있나 |");
console.log("|--:|---|---|---|:-:|:-:|");
const N = (s) => String(s || "").replace(/\s+/g, "");
for (const p of plans) {
  const bt = bogiText(q.bogi);
  const inB = bt != null && N(bt).includes(N(p.a.text));
  const inS = (set.sents || []).some((s) => N(s.t).includes(N(p.a.text)));
  console.log(`| ${p.i} | ${p.a.type} | ${p.a.marker} | ${JSON.stringify(String(p.a.text).slice(0, 24))} | ${inB ? "✅" : "✗"} | ${inS ? "✅" : "✗"} |`);
  if (inB) fail.push(`${p.a.marker} 가 보기에 실재한다 — 지우면 표시가 사라질 수 있다`);
}
console.log("");

if (plans.length !== EXPECT) fail.push(`대상이 ${plans.length}건 — ${EXPECT}건이어야 한다`);

const b0 = drawnBogi(list), c0 = drawnChoice(list), p0 = passageOf(list);
if (b0.length) fail.push(`지금 보기에 ${b0.length}건이 그려지고 있다: ${b0.join(",")}`);

const after = list.filter((_, i) => !plans.some((p) => p.i === i));
const b1 = drawnBogi(after), c1 = drawnChoice(after), p1 = passageOf(after);

console.log("## 렌더 경로 전후");
console.log("");
console.log("| 축 | 전 | 후 |");
console.log("|---|--:|--:|");
console.log(`| 보기 밑줄 | ${b0.length} | ${b1.length} |`);
console.log(`| 선지 밑줄 | ${c0.length} | ${c1.length} |`);
console.log(`| 본문 주석 | ${p0.split("|").filter(Boolean).length} | ${p1.split("|").filter(Boolean).length} |`);
console.log("");
if (b0.length !== b1.length) fail.push("보기 표시가 달라진다");
if (c0.length !== c1.length) fail.push("선지 표시가 달라진다");
if (p0 !== p1) fail.push("본문 주석이 달라진다");

if (fail.length) { console.log("## 🔴 사전 검사 실패 — 아무것도 쓰지 않는다"); fail.forEach((x) => console.log(`- ${x}`)); process.exit(1); }
console.log(`✅ 사전 검사 통과 — ${plans.length}건 · 표시 전후 무변(원래 0건)`);
console.log("");
if (!APPLY) { console.log("### 미리보기 — 아무것도 쓰지 않았다. `--apply`"); process.exit(0); }

// ── 적용 ─────────────────────────────────────────────────────────────────
fs.writeFileSync(path.join(ROOT, "pipeline/backups/annotations.before_d208b.json"), before);
for (const i of plans.map((p) => p.i).sort((a, b) => b - a)) ann[YK][SID].splice(i, 1);
fs.writeFileSync(ANN, JSON.stringify(ann, null, 2), "utf8");

// ── 되읽기 검산 ─────────────────────────────────────────────────────────
const back0 = fs.readFileSync(ANN);
const back = JSON.parse(back0.toString("utf8"));
const bad = [];
if (back0[back0.length - 1] === 10) bad.push("끝 개행");
const bl = (back[YK] || {})[SID] || [];
if (bl.length !== list.length - EXPECT) bad.push(`항목 수 ${list.length}-${EXPECT} ≠ ${bl.length}`);
if (bl.some((a) => a.target === "bogi" && a.qId === QID && MARK.test(String(a.marker || "")))) bad.push("삭제 대상이 남아 있다");
if (JSON.stringify(bl) !== JSON.stringify(after)) bad.push("남은 항목이 계획과 다르다");
if (drawnBogi(bl).length !== b0.length || drawnChoice(bl).length !== c0.length || passageOf(bl) !== p0)
  bad.push("🔴 되읽은 뒤 표시가 달라졌다");
// ★ 역방향 — 지운 5건을 제자리에 되돌리면 파일 전체가 원본과 바이트 일치해야 한다
const rev = JSON.parse(back0.toString("utf8"));
const restored = [...bl];
for (const p of plans) restored.splice(p.i, 0, p.a);
rev[YK][SID] = restored;
if (JSON.stringify(rev, null, 2) !== before.toString("utf8")) bad.push("🔴 역방향 바이트 일치 실패 — 삭제 외에 달라진 곳이 있다");

console.log(`- 적용 후 MD5 \`${md5(back0)}\` (${back0.length - before.length}B)`);
console.log("- 백업 `pipeline/backups/annotations.before_d208b.json`");
console.log("");
if (bad.length) { console.log("## 🔴 되읽기 검산 실패 — 백업으로 되돌리십시오"); bad.forEach((x) => console.log(`- ${x}`)); process.exit(1); }
console.log("## ✅ 되읽기 검산 통과 (S-02)");
console.log(`- ${EXPECT}건 삭제 · 보기·선지·본문 표시 전건 무변 · 역방향 바이트 일치`);
console.log("- all_data 는 열기만 했다");
