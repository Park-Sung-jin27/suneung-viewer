// d206_bogi_delete.mjs — 보기에 못 그리는 target:"bogi" 주석 삭제 (발주 D-206)
//
// 이 주석들은 target:"bogi" 를 달고 있지만 text 가 <보기> 에 없다. 대신 **본문에**
// 있다 — 본문 주석을 복제하면서 target 만 잘못 붙인 것이다. 화면에는 영원히
// 안 그려지고, 같은 자리를 가리키는 본문 주석(짝)이 이미 정상 작동 중이다.
//
// ★ 대상을 손으로 적지 않는다. 판정 조건으로 도출하고 건수가 맞는지 확인한다 —
//   목록을 옮겨 적는 과정이 사람 실수의 자리다.
//     조건: target="bogi" · text 가 그 문항 <보기> 에 없음 · 그 세트 본문에는 있음
//
// ★ 지면으로 확정한 것만 다룬다.
//   · r2024a Q3 — 발문이 「㉠~㉤과 관련하여 ⓐ~ⓔ를」. ㉠~㉤은 본문 마커이고
//     지면에서 본문에만 밑줄이 있다. 보기 ⓐ~ⓔ 줄에는 밑줄이 없다
//   · l2025a Q18 · l2025d Q33 — **지면에 <보기> 상자 자체가 없다.** 발문 뒤에
//     곧바로 선지가 온다. bogi:undefined 가 정상이고 주석이 잘못 붙은 것이다
//   · r20246a ㉢ — 🔴 **본문 짝이 없다.** 이 세트는 주석 7건이 전부 target:"bogi" 라
//     본문에 그려지는 주석이 0건이다. 상신 때 「짝이 남는다」고 적은 것은 사실이
//     아니었다. 다만 삭제해도 본문 표시는 그대로 0 이다.
//
// ★ 그래서 검산을 「짝이 남는가」(대리 지표)에서 **렌더 경로 전후 비교**로 바꾼다.
//   요구된 것은 「본문 표시 무변」 자체다. 삭제 전 데이터와 삭제 후 데이터를 각각
//   프론트와 같은 필터에 통과시켜 **본문에 그려지는 주석 집합이 같은지** 본다.
//     · 본문(PassagePanel:738)  = !target || target==="passage"
//     · 보기(QuizPanel:1424)    = target==="bogi" && type∈{underline,box} && 보기에 실재
//
// ★ r20256d Q14 는 여기 들어오지 않는다 — 그쪽은 주석이 옳고 bogi 가 지면의
//   「학습 활동지」와 다르다(D-207 복원 대상). 조건상 「본문에도 없음」이라 제외된다.
//
// 사용: node pipeline/d206_bogi_delete.mjs [--apply]

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { foldIfAnnSafe } from "file:///C:/Users/downf/jippi-bo/src/layoutBreaks.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ANN = path.join(ROOT, "public/data/annotations.json");
const DATA = path.join(ROOT, "public/data/all_data_204.json");
const EXPECT = 11;
const APPLY = process.argv.includes("--apply");
const md5 = (b) => crypto.createHash("md5").update(b).digest("hex");
const N = (s) => String(s || "").replace(/\s+/g, "");

const before = fs.readFileSync(ANN);
const ann = JSON.parse(before.toString("utf8"));
const data = JSON.parse(fs.readFileSync(DATA, "utf8"));
const bogiText = (b) => (typeof b === "string" ? b : (b && typeof b.text === "string" ? b.text : null));

console.log("# 보기에 못 그리는 주석 삭제 (D-206)");
console.log("");
console.log(`- annotations MD5 \`${md5(before)}\``);
console.log("");

const plans = [], fail = [], renderCheck = new Map();
for (const [yk, sets] of Object.entries(ann)) for (const [sid, list] of Object.entries(sets)) {
  let set = null;
  for (const sec of ["reading", "literature"]) {
    const x = (data[yk]?.[sec] || []).find((y) => (y.setId || y.id) === sid);
    if (x) { set = x; break; }
  }
  if (!set) continue;
  list.forEach((a, i) => {
    if (a.target !== "bogi" || !a.text) return;
    const q = (set.questions || []).find((x) => x.id === a.qId);
    const bt = q ? bogiText(q.bogi) : null;
    if (bt != null && N(bt).includes(N(a.text))) return;          // 보기에 있다 — 정상
    const sn = a.sentId ? (set.sents || []).find((x) => String(x.id) === String(a.sentId)) : null;
    if (!sn || !N(sn.t).includes(N(a.text))) return;              // 본문에도 없다 — 다른 문제(D-207)
    // 본문 짝(같은 자리를 가리키는 target 없는 주석)이 남는가
    const mate = list.some((b, j) => j !== i && !b.target && b.type === a.type
      && String(b.sentId) === String(a.sentId) && b.text === a.text);
    plans.push({ yk, sid, i, a, mate, hasBogi: bt != null, set });
  });
}

console.log("| 세트 | Q | type | 마커 | text | 보기 | 본문 짝 |");
console.log("|---|--:|---|---|---|---|:-:|");
for (const p of plans)
  console.log(`| \`${p.yk}::${p.sid}\` | ${p.a.qId} | ${p.a.type} | ${p.a.marker || p.a.label || "-"} | ${JSON.stringify(String(p.a.text).slice(0, 28))} | ${p.hasBogi ? "있으나 어구 없음" : "**보기 자체가 없음**"} | ${p.mate ? "✅" : "🔴 없음"} |`);
console.log("");

if (plans.length !== EXPECT) fail.push(`대상이 ${plans.length}건 — ${EXPECT}건이어야 한다. 조건이나 데이터가 바뀌었다`);

// ── 렌더 경로 — 프론트 필터를 그대로 옮긴다 ──────────────────────────────
//   이 주석이 지금 화면에 그려지고 있는가. 그려지는 것을 지우면 표시가 준다.
function drawn(setObj, list) {
  const out = new Set();
  list.forEach((a, i) => {
    if (!a.target || a.target === "passage") { out.add(`본문#${i}`); return; }
    if (a.target !== "bogi") return;
    if (!(a.type === "underline" || a.type === "box")) return;
    const q = (setObj.questions || []).find((x) => x.id === a.qId);
    const bt = q ? bogiText(q.bogi) : null;
    if (bt == null) return;
    const sib = list.filter((x) => x.target === "bogi" && x.qId === a.qId && (x.type === "underline" || x.type === "box"));
    const folded = foldIfAnnSafe(bt, sib);
    const at = folded.indexOf(a.text);
    if (at < 0) return;
    // 앞 항목과 겹치면 프론트가 건너뛴다
    let cur = 0;
    for (const o of sib.map((x) => ({ x, i: folded.indexOf(x.text) })).filter((o) => o.i >= 0).sort((m, n) => m.i - n.i)) {
      if (o.i < cur) continue;
      if (o.x === a) { out.add(`보기#${i}`); return; }
      cur = o.i + String(o.x.text).length;
    }
  });
  return out;
}
for (const p of plans) {
  const key = `${p.yk}::${p.sid}`;
  if (renderCheck.has(key)) continue;
  renderCheck.set(key, true);
}
for (const p of plans) {
  const list = ann[p.yk][p.sid];
  if (drawn(p.set, list).has(`보기#${p.i}`))
    fail.push(`${p.yk}::${p.sid} Q${p.a.qId} ${p.a.marker || ""} — 지금 화면에 그려지고 있다. 지우면 표시가 준다`);
}
if (fail.length) { console.log("## 🔴 사전 검사 실패 — 아무것도 쓰지 않는다"); fail.forEach((x) => console.log(`- ${x}`)); process.exit(1); }

const mateless = plans.filter((p) => !p.mate);
console.log(`✅ 사전 검사 통과 — ${plans.length}건`);
console.log(`   본문 짝 있음 ${plans.length - mateless.length}건 · 짝 없음 ${mateless.length}건(지면에 <보기> 자체가 없어 주석이 잉여다)`);
console.log("");
if (!APPLY) { console.log("### 미리보기 — 아무것도 쓰지 않았다. `--apply`"); process.exit(0); }

fs.writeFileSync(path.join(ROOT, "pipeline/backups/annotations.before_d206del.json"), before);
const pre = JSON.parse(before.toString("utf8"));
const byList = new Map();
for (const p of plans) {
  const k = `${p.yk}::${p.sid}`;
  if (!byList.has(k)) byList.set(k, { yk: p.yk, sid: p.sid, idx: [] });
  byList.get(k).idx.push(p.i);
}
for (const { yk, sid, idx } of byList.values())
  for (const i of [...idx].sort((a, b) => b - a)) ann[yk][sid].splice(i, 1);
fs.writeFileSync(ANN, JSON.stringify(ann, null, 2), "utf8");

// ── 되읽기 검산 ─────────────────────────────────────────────────────────
const after = fs.readFileSync(ANN);
const back = JSON.parse(after.toString("utf8"));
const bad = [];
if (after[after.length - 1] === 10) bad.push("끝 개행");
for (const p of plans) {
  const list = (back[p.yk] || {})[p.sid] || [];
  if (list.some((b) => b.target === "bogi" && b.qId === p.a.qId && b.text === p.a.text && b.type === p.a.type))
    bad.push(`${p.yk}::${p.sid} Q${p.a.qId} 삭제 대상이 남아 있다`);
  // ★ 본문 짝은 반드시 살아 있어야 한다 — 화면 표시가 줄면 안 된다
  if (p.mate && !list.some((b) => !b.target && b.type === p.a.type && String(b.sentId) === String(p.a.sentId) && b.text === p.a.text))
    bad.push(`🔴 ${p.yk}::${p.sid} 본문 짝이 사라졌다`);
}
// ★ 본문 표시 무변 — 삭제 전/후 데이터를 같은 렌더 필터에 통과시켜 대조한다
const rend = [];
for (const key of renderCheck.keys()) {
  const [yk, sid] = key.split("::");
  const setObj = plans.find((p) => p.yk === yk && p.sid === sid).set;
  const b0 = [...drawn(setObj, pre[yk][sid])].filter((x) => x.startsWith("본문")).map((x) => pre[yk][sid][+x.slice(3)]);
  const a1 = [...drawn(setObj, back[yk][sid])].filter((x) => x.startsWith("본문")).map((x) => back[yk][sid][+x.slice(3)]);
  const norm = (L) => L.map((x) => JSON.stringify(x)).sort().join("|");
  rend.push({ key, n0: b0.length, n1: a1.length, ok: norm(b0) === norm(a1) });
  if (norm(b0) !== norm(a1)) bad.push(`🔴 ${key} 본문에 그려지는 주석이 달라졌다 (${b0.length} → ${a1.length})`);
}

for (const [yk, sets] of Object.entries(pre)) for (const [sid, list] of Object.entries(sets)) {
  const dropped = plans.filter((p) => p.yk === yk && p.sid === sid).length;
  const now = (back[yk] || {})[sid] || [];
  if (now.length !== list.length - dropped) bad.push(`${yk}::${sid} 항목 수 ${list.length}-${dropped} ≠ ${now.length}`);
  const kept = list.filter((_, i) => !plans.some((p) => p.yk === yk && p.sid === sid && p.i === i));
  if (JSON.stringify(kept) !== JSON.stringify(now)) bad.push(`${yk}::${sid} 남은 항목이 달라졌다`);
}
console.log(`- 적용 후 MD5 \`${md5(after)}\` (${after.length - before.length}B)`);
console.log("- 백업 `pipeline/backups/annotations.before_d206del.json`");
console.log("");
if (bad.length) { console.log("## 🔴 되읽기 검산 실패 — 백업으로 되돌리십시오"); bad.forEach((x) => console.log(`- ${x}`)); process.exit(1); }
console.log("## ✅ 되읽기 검산 통과 (S-02)");
console.log(`- ${plans.length}건 삭제 · 남은 항목 순서·내용 무변`);
console.log("");
console.log("### 본문 표시 무변 — 렌더 경로 전후 대조");
console.log("");
console.log("| 세트 | 본문에 그려지는 주석 (전 → 후) | 동일 |");
console.log("|---|---|:-:|");
for (const r of rend) console.log(`| \`${r.key}\` | ${r.n0} → ${r.n1} | ${r.ok ? "✅" : "🔴"} |`);
console.log("");
console.log("- 다른 세트·회차 무변 · all_data 는 열지도 쓰지도 않았다");
