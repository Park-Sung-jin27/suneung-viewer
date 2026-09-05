// d208_choice_move.mjs — r2024d Q17 선지 밑줄 5건을 렌더가 읽는 형으로 이전 (발주 D-208)
//
// 이 5건은 「target 오기」가 아니라 **누구도 안 읽는 별개 표기 체계**였다.
//   현재 {"type":"choice-underline","qId":17,"cNum":1,"text":"담겨","target":"bogi"}
//   → type·cNum·target 세 필드 모두 렌더 어휘와 다르고, choice-underline / cNum 을
//     읽는 코드가 src/·api/ 전수에 없다(정본 전체에서 이 5건이 유일한 사용처).
//
// ★ 스키마는 렌더 경로가 요구하는 필드가 곧 정본이다 — target:"choice" 주석이
//   정본에 0건이라 따를 선례가 없었다(D-208 조사). QuizPanel.jsx:1430·1598 이
//   요구하는 것: target:"choice" · qId · choiceNum · type∈{underline,box} · text.
//
// ★ r20256d Q14 5건은 이 커밋에 들어오지 않는다 — **지면에 밑줄이 없다.**
//   활동지 구간(p5 우단 y470~790)의 가로선 19개가 전부 폭 289.5/306.5 상자·구분선
//   이고 밑줄 폭의 짧은 선이 0개다. 같은 지면의 진짜 밑줄(y262.4 폭158.0 「㉠몇몇
//   논리학자들이 제기한 문제였」·y459.8 폭20.7 「않은」)은 같은 판독기가 잡는다.
//   지면에 없는 밑줄을 노출 세트 선지에 새로 그리지 않는다(심사관 판정).
//
// 사용: node pipeline/d208_choice_move.mjs [--apply]

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ANN = path.join(ROOT, "public/data/annotations.json");
const DATA = path.join(ROOT, "public/data/all_data_204.json");
const APPLY = process.argv.includes("--apply");
const md5 = (b) => crypto.createHash("md5").update(b).digest("hex");

const YK = "2024수능", SID = "r2024d", QID = 17, EXPECT = 5;

const before = fs.readFileSync(ANN);
const ann = JSON.parse(before.toString("utf8"));
const data = JSON.parse(fs.readFileSync(DATA, "utf8"));
const set = (data[YK]?.reading || []).find((x) => (x.setId || x.id) === SID);
const q = set && (set.questions || []).find((x) => x.id === QID);

console.log("# r2024d Q17 선지 밑줄 5건 이전 (D-208)");
console.log("");
console.log(`- annotations MD5 \`${md5(before)}\``);
console.log("");

const fail = [], plans = [];
const list = (ann[YK] || {})[SID] || [];
if (!q) fail.push(`${SID} Q${QID} 를 못 찾았다`);

list.forEach((a, i) => {
  if (a.type !== "choice-underline") return;
  if (a.qId !== QID) { fail.push(`choice-underline 인데 qId 가 ${a.qId} 다`); return; }
  const c = (q.choices || []).find((x) => x.num === a.cNum);
  if (!c) { fail.push(`선지 num=${a.cNum} 가 없다`); return; }
  const n = String(c.t).split(a.text).length - 1;
  if (n !== 1) { fail.push(`선지 ${a.cNum} 에 ${JSON.stringify(a.text)} 가 ${n}곳 — 1곳이어야 한다`); return; }
  plans.push({ i, a, c, next: { type: "underline", target: "choice", qId: a.qId, choiceNum: a.cNum, text: a.text } });
});

console.log("| # | 현재 | → 이전 후 | 선지 원문 | text 위치 |");
console.log("|--:|---|---|---|--:|");
for (const p of plans)
  console.log(`| ${p.i} | \`${JSON.stringify(p.a)}\` | \`${JSON.stringify(p.next)}\` | ${JSON.stringify(String(p.c.t).slice(0, 26))} | ${String(p.c.t).indexOf(p.a.text)} |`);
console.log("");

if (plans.length !== EXPECT) fail.push(`대상이 ${plans.length}건 — ${EXPECT}건이어야 한다`);
// 이전 후 (qId, choiceNum) 이 겹치지 않는가 — 겹치면 한 선지에 두 건이 몰린다
const seen = new Set();
for (const p of plans) {
  const k = `${p.next.qId}|${p.next.choiceNum}`;
  if (seen.has(k)) fail.push(`(Q${p.next.qId}, 선지 ${p.next.choiceNum}) 가 중복이다`);
  seen.add(k);
}

// ── 사전 검산 — 렌더 경로에 넣으면 정말 그려지는가 ───────────────────────
//   필터는 소스에서 떼어 쓴다(복사 금지). 겹침 판정은 applyInlineAnnsLocal 이
//   JSX 를 반환해 그대로는 못 돌리므로, 그 판정부(:내부 sorted → cursor 루프)와
//   같은 규칙을 여기서 재현하되 **소스와 나란히 두고 확인**했다:
//     sorted = anns.map(idx=text.indexOf(a.text)).filter(idx>=0).sort(idx)
//     for (a of sorted) { if (a.idx < cursor) continue; ... cursor = a.idx + len }
const src = fs.readFileSync(path.join(ROOT, "src/QuizPanel.jsx"), "utf8");
const fi = src.indexOf("const choiceAnnsAll = annotations.filter(");
const fj = src.indexOf(");", src.indexOf("a.type === \"box\"", fi)) + 2;
if (fi < 0 || fj < 2) { console.log("## 🔴 choiceAnnsAll 을 소스에서 못 찾았다"); process.exit(1); }
const pickChoiceAnns = new Function("annotations", "question",
  src.slice(fi, fj) + "\n  return choiceAnnsAll;");

const after = list.map((a, i) => (plans.find((p) => p.i === i) ? plans.find((p) => p.i === i).next : a));
function drawn(anns) {
  const picked = pickChoiceAnns(anns, { id: QID });
  const out = [];
  for (const c of q.choices || []) {
    const mine = picked.filter((a) => a.choiceNum === c.num);
    const t = String(c.t);
    const sorted = mine.map((a) => ({ a, idx: t.indexOf(a.text) })).filter((o) => o.idx >= 0).sort((m, n) => m.idx - n.idx);
    let cur = 0;
    for (const o of sorted) {
      if (o.idx < cur) continue;                 // 겹침 건너뛰기
      out.push(`선지${c.num}:${o.a.text}`);
      cur = o.idx + String(o.a.text).length;
    }
  }
  return out;
}
const d0 = drawn(list), d1 = drawn(after);
console.log("## 사전 검산 — 렌더 경로 전후 (반영 전에 돌린 것)");
console.log("");
console.log(`- choiceAnnsAll 이 집는 주석: **${pickChoiceAnns(list, { id: QID }).length}건 → ${pickChoiceAnns(after, { id: QID }).length}건**`);
console.log(`- 실제로 그려지는 밑줄: **${d0.length}건 → ${d1.length}건**`);
console.log(`  ${d1.join(" · ") || "(없음)"}`);
console.log(`- 겹침 건너뛰기 해당: ${pickChoiceAnns(after, { id: QID }).length - d1.length}건`);
console.log("");
if (d1.length !== EXPECT) fail.push(`사전 검산에서 ${d1.length}건만 그려진다 — ${EXPECT}건이어야 한다`);

if (fail.length) { console.log("## 🔴 사전 검사 실패 — 아무것도 쓰지 않는다"); fail.forEach((x) => console.log(`- ${x}`)); process.exit(1); }
console.log(`✅ 사전 검사 통과 — ${plans.length}건 · 전건 그려짐`);
console.log("");
if (!APPLY) { console.log("### 미리보기 — 아무것도 쓰지 않았다. `--apply`"); process.exit(0); }

// ── 적용 ─────────────────────────────────────────────────────────────────
fs.writeFileSync(path.join(ROOT, "pipeline/backups/annotations.before_d208.json"), before);
for (const p of plans) ann[YK][SID][p.i] = p.next;
fs.writeFileSync(ANN, JSON.stringify(ann, null, 2), "utf8");

// ── 되읽기 검산 ─────────────────────────────────────────────────────────
const back0 = fs.readFileSync(ANN);
const back = JSON.parse(back0.toString("utf8"));
const bad = [];
if (back0[back0.length - 1] === 10) bad.push("끝 개행");
const bl = (back[YK] || {})[SID] || [];
if (bl.length !== list.length) bad.push(`항목 수 ${list.length} → ${bl.length}`);
for (const p of plans) if (JSON.stringify(bl[p.i]) !== JSON.stringify(p.next)) bad.push(`#${p.i} 가 다르다`);
if (bl.some((a) => a.type === "choice-underline" || "cNum" in a)) bad.push("옛 어휘가 남아 있다");
if (drawn(bl).length !== EXPECT) bad.push(`되읽은 뒤 ${drawn(bl).length}건만 그려진다`);
// 손대지 않은 항목·세트는 무변
const pre = JSON.parse(before.toString("utf8"));
for (const [yk, sets] of Object.entries(pre)) for (const [sid, L] of Object.entries(sets)) {
  if (yk === YK && sid === SID) {
    L.forEach((x, i) => { if (!plans.some((p) => p.i === i) && JSON.stringify(x) !== JSON.stringify(bl[i])) bad.push(`${sid} #${i} 가 달라졌다`); });
    continue;
  }
  if (JSON.stringify(L) !== JSON.stringify((back[yk] || {})[sid])) bad.push(`${yk}::${sid} 가 달라졌다`);
}
console.log(`- 적용 후 MD5 \`${md5(back0)}\` (${back0.length - before.length}B)`);
console.log("- 백업 `pipeline/backups/annotations.before_d208.json`");
console.log("");
if (bad.length) { console.log("## 🔴 되읽기 검산 실패 — 백업으로 되돌리십시오"); bad.forEach((x) => console.log(`- ${x}`)); process.exit(1); }
console.log("## ✅ 되읽기 검산 통과 (S-02)");
console.log(`- ${plans.length}건 이전 · 선지 밑줄 ${d0.length}→${drawn(bl).length}건 · 옛 어휘 잔존 0`);
console.log("- 같은 세트의 다른 주석·다른 세트 전건 무변 · all_data 는 열기만 했다");
