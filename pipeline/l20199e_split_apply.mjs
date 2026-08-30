// l20199e_split_apply.mjs — 재분할 + cs_ids 재정박 **한 커밋** (발주 D-171 A)
//
// ★ 왜 한 번에 하나
//   재분할만 하면 cs_ids 14곳이 「첫 조각」을 가리킨 채 남는데, 원래 가리키던 대목이
//   첫 조각에 있다는 보장이 없다. 형광펜이 엉뚱한 문장에 켜져도 되읽기 검산은 통과한다.
//   그래서 S-11 예외가 **재분할과 재정박을 한 커밋에** 하라고 못박고 있다.
//
// 분할 방식 (D-161 상신 · D-171 A-2 승인)
//   · S-11 의 **경계 규칙만** 빌린다 — resplitProse 는 쓰지 않는다(id 를 s1 부터 다시 매긴다)
//   · body 문장만 자른다. omission·author 는 손대지 않는다
//   · 자르는 자리 = 종결어미 + 종결부호 + 공백. 인용부호 안에서는 자르지 않는다
//   · **첫 조각은 기존 id 를 그대로 쓰고**, 뒤 조각만 s9NN 으로 새로 만들어 제자리에 끼운다
//
// 재정박 (D-171 A-3 · S-24)
//   심사관이 준 어구를 **분할 뒤 조각에서 찾아** 그 조각 id 를 cs_ids 로 준다.
//   어구를 못 찾으면 그 건만 멈추고 보고한다(전체는 쓰지 않는다).
//
// 사용:
//   node pipeline/l20199e_split_apply.mjs            미리보기
//   node pipeline/l20199e_split_apply.mjs --apply

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = path.join(ROOT, "public/data/all_data_204.json");
const APPLY = process.argv.includes("--apply");
const md5 = (b) => crypto.createHash("md5").update(b).digest("hex");
const YK = "2019_9월", SID = "l20199e";
const NON_HL = new Set(["footnote", "author", "omission", "workTag", "image", "figure"]);

// S-11 경계 규칙 (step2_postprocess 와 같은 판정, 호출은 하지 않는다)
const END = "다라요죠까군네지오소서라마쟈랴리라니냐느야어아여워";
const OPEN = "'‘“「『(〈《", CLOSE = "'’”」』)〉》", CLOSERS = "\"'’”」』)]";
function splitSentences(text) {
  const out = []; let depth = 0, start = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "'" || ch === '"') { depth = depth > 0 ? depth - 1 : 1; continue; }
    if (OPEN.includes(ch)) { depth++; continue; }
    if (CLOSE.includes(ch)) { if (depth > 0) depth--; continue; }
    if (depth > 0) continue;
    if (!".?!".includes(ch)) continue;
    if (!END.includes(text[i - 1] || "")) continue;
    let k = i + 1;
    while (k < text.length && CLOSERS.includes(text[k])) k++;
    if (k >= text.length) break;
    if (!/\s/.test(text[k])) continue;
    const p = text.slice(start, k).trim(); if (p) out.push(p);
    while (k < text.length && /\s/.test(text[k])) k++;
    start = k; i = k - 1;
  }
  const t = text.slice(start).trim(); if (t) out.push(t);
  return out;
}

// 어구 매칭은 2단계다 (S-24)
//   ① 원문 그대로 포함하는가
//   ② 안 되면 **원문자 마커·공백을 지우고** 대조한다 — 발주 표기에서 마커가 빠지는 일이 있다.
//      D-171 A-3 의 Q42#4·Q43#5 가 그랬다: 데이터는 「…서 있는 ⓓ 누각을…」·「…사진사의 ⓔ 코 고는…」
//      인데 발주 어구에는 ⓓ·ⓔ 가 없었다. 마커를 빼고 보면 나머지가 100% 일치하고
//      조각도 유일하게 특정된다 — 추측이 아니라 기계적으로 확정된다.
//      ②로 맞은 건은 🟡 로 찍어 보고에 남긴다.
const MK = /[ⓐ-ⓩ㉠-㉾]/g;
const loose = (t) => String(t).replace(MK, "").replace(/\s+/g, "");

// D-171 A-3 — [Q, #, [ [옛 문장 id, 어구], … ] ]
const SPEC = [
  [42, 2, [["l20199es3", "주인의 이러한 감시에 처음 얼마 동안은"]]],
  [42, 4, [["l20199es6", "수없는 빗발에 씻기며 서 있는 누각을 박쥐조차 나들지 않았다"]]],
  [43, 1, [["l20199es1", "아직도 자리 잡히지 않은 이 거리의 누렇던 길이 매연과 발걸음에 나날이 짙어서"]]],
  [43, 2, [["l20199es2", "사무실 마루를 쓸고, 훔치고, 손님에게 차와 점심 그릇을 나르고"]]],
  [43, 3, [["l20199es6", "피곤한 병일이는 사무실에서 돌아올 때마다 이 지루한 ⓒ장마는 언제까지나 계속할 셈인가고 중얼거렸다"]]],
  [43, 5, [["l20199es8", "벌써 깊이 잠들었을 사진사의 코 고는 소리가 들리는 듯하여 잠이 오지 않았다"]]],
  [44, 1, [["l20199es3", "2년 내로 구하여도 얻지 못하는 신원 보증인"]]],
  [44, 2, [["l20199es3", "취직한 첫날부터 지금까지 하루도 변함없이 자기를 감시하는 주인의 꾸준한 태도에"]]],
  [44, 3, [["l20199es5", "신문 외에는 활자와 인연이 없이 살아갈 수 있는 그들의 생활이 부럽도록 경쾌한 것 같았다"]]],
  [44, 4, [["l20199es5", "월급에서 하숙비를 제하고 몇 푼 안 남는 돈으로 탐내어 사들인 책들이"]]],
  [44, 5, [["l20199es7", "문득 자기를 기다릴 듯한 어젯밤 펴놓은 대로 있을 책을 생각하고"]]],
  [45, 1, [["l20199es6", "어떤 유혹에 끌리듯이 사진관으로 찾아가게 되었다"],
           ["l20199es8", "책상 앞에 돌아온 병일이는"]]],
  [45, 2, [["l20199es5", "근자에 병일이는 사무실에서 장부 정리를 할 때에도"],
           ["l20199es7", "거기는 술과 한담이 있었다"]]],
  [45, 3, [["l20199es6", "어떤 유혹에 끌리듯이 사진관으로 찾아가게 되었다"]]],
];

const before = fs.readFileSync(DATA);
const data = JSON.parse(before.toString("utf8"));
const set = (data[YK]?.literature || []).find((x) => (x.setId || x.id) === SID);
if (!set) { console.log("🔴 세트를 못 찾았다."); process.exit(1); }
const sents = set.sents || [];
if (sents.length > 9) { console.log(`⚠ 문장이 이미 ${sents.length}개다. 재분할된 것으로 보인다.`); process.exit(0); }

console.log("# l20199e 재분할 + cs_ids 재정박");
console.log("");
console.log(`- 적용 전 all_data MD5 \`${md5(before)}\` · 문장 ${sents.length}`);

// ── ① 분할 ────────────────────────────────────────────────
const norm = (s) => String(s).replace(/\s+/g, "");
const srcAll = norm(sents.map((x) => x.t).join(""));
const out = [];
let seq = 901;
const fragOf = new Map();   // 옛 id → [새 조각 …]
for (const x of sents) {
  const type = x.sentType || "body";
  if (type !== "body") { out.push(x); fragOf.set(String(x.id), [x]); continue; }
  const parts = splitSentences(String(x.t));
  const frags = parts.map((t, i) => (i === 0 ? { ...x, t } : { ...x, id: `${SID}s${seq++}`, t }));
  out.push(...frags);
  fragOf.set(String(x.id), frags);
}
const gotAll = norm(out.map((x) => x.t).join(""));
console.log(`- 분할 ${sents.length} → **${out.length}문장**`);
console.log(`- 글자 검산(공백 제외): ${srcAll.length} → ${gotAll.length} ${srcAll === gotAll ? "✅ 완전 일치" : "🔴 불일치"}`);
if (srcAll !== gotAll) { console.log("🔴 글자가 어긋난다. 멈춘다."); process.exit(1); }
const dupId = out.map((x) => String(x.id)).filter((v, i, a) => a.indexOf(v) !== i);
if (dupId.length) { console.log(`🔴 id 중복 ${dupId.join(" ")}`); process.exit(1); }
console.log("");
console.log("| 옛 문장 | 자수 | 조각 수 | 새 id |");
console.log("|---|--:|--:|---|");
for (const x of sents) {
  const f = fragOf.get(String(x.id));
  if (f.length > 1 || (x.sentType || "body") === "body")
    console.log(`| ${x.id} | ${String(x.t).length} | ${f.length} | ${f.map((y) => String(y.id).replace(SID, "")).join(" ")} |`);
}
console.log("");

// ── ② 재정박 — 어구를 조각에서 찾는다 (S-24) ────────────────
const plans = [], miss = [], loosely = [];
for (const [qid, num, frs] of SPEC) {
  const ids = [];
  for (const [oldId, frag] of frs) {
    const cands = fragOf.get(oldId) || [];
    let hit = cands.find((y) => String(y.t).includes(frag)), how = "";
    if (!hit) {
      const lf = loose(frag);
      const alt = cands.filter((y) => loose(y.t).includes(lf));
      if (alt.length === 1) { hit = alt[0]; how = " 🟡(마커·공백 무시)"; }
      else if (alt.length > 1) { miss.push(`Q${qid}#${num} — 정규화 대조에서 조각 ${alt.length}개가 걸린다(유일하지 않음)`); continue; }
    }
    if (!hit) { miss.push(`Q${qid}#${num} — ${oldId} 조각 ${cands.length}개 어디에도 「${frag.slice(0, 24)}…」 없음(정규화 대조도 실패)`); continue; }
    if (how) loosely.push(`Q${qid}#${num} → ${hit.id}${how}`);
    if (NON_HL.has(hit.sentType || "body")) { miss.push(`Q${qid}#${num} — ${hit.id} 가 ${hit.sentType} (형광펜 안 켜짐)`); continue; }
    ids.push(String(hit.id));
  }
  plans.push({ qid, num, ids: [...new Set(ids)], frs });
}
console.log("## 재정박 — 어구가 속한 조각");
console.log("");
console.log("| 위치 | 옛 cs_ids | 새 cs_ids | 어구 |");
console.log("|---|---|---|---|");
for (const p of plans) {
  const c = set.questions.find((q) => q.id === p.qid)?.choices?.find((c2) => c2.num === p.num);
  console.log(`| Q${p.qid}#${p.num} | ${(c?.cs_ids || []).join(" ") || "—"} | **${p.ids.map((x) => x.replace(SID, "")).join(" ")}** | ${p.frs.map(([, f]) => f.slice(0, 20) + "…").join(" / ")} |`);
}
console.log("");
if (miss.length) { console.log("## 🔴 어구를 못 찾았다 — 아무것도 쓰지 않는다"); miss.forEach((x) => console.log(`- ${x}`)); process.exit(1); }
console.log(`✅ 어구 ${SPEC.reduce((a, s) => a + s[2].length, 0)}개 전건 조각에서 확인 (S-24)`);
if (loosely.length) {
  console.log("");
  console.log(`> 🟡 **${loosely.length}건은 원문자 마커를 무시해야 맞았다** — 발주 표기에서 마커가 빠진 자리다.`);
  loosely.forEach((x) => console.log(`> - ${x}`));
}
console.log("");

if (!APPLY) { console.log("### 미리보기 — 아무것도 쓰지 않았다. 적용하려면 --apply"); process.exit(0); }

const bakDir = path.join(ROOT, "pipeline/backups");
fs.mkdirSync(bakDir, { recursive: true });
fs.writeFileSync(path.join(bakDir, "all_data_204.before_l20199e_split.json"), before);
console.log(`- 백업: \`pipeline/backups/all_data_204.before_l20199e_split.json\``);

set.sents = out;
for (const p of plans) {
  const c = set.questions.find((q) => q.id === p.qid).choices.find((c2) => c2.num === p.num);
  c.cs_ids = [...p.ids];
}
fs.writeFileSync(DATA, JSON.stringify(data), "utf8");   // §13⑪

// ── 되읽기 검산 (S-02) ────────────────────────────────────
const after = fs.readFileSync(DATA);
if (after[0] === 0xef) { console.log("\n🔴 BOM"); process.exit(1); }
const back = JSON.parse(after.toString("utf8"));
const s2 = (back[YK].literature).find((x) => (x.setId || x.id) === SID);
const ids2 = new Set(s2.sents.map((x) => String(x.id)));
const fail = [];
if (s2.sents.length !== out.length) fail.push("문장 수 불일치");
if (norm(s2.sents.map((x) => x.t).join("")) !== srcAll) fail.push("**본문 글자가 달라졌다**");
for (const p of plans) {
  const c = s2.questions.find((q) => q.id === p.qid).choices.find((c2) => c2.num === p.num);
  if (JSON.stringify(c.cs_ids) !== JSON.stringify(p.ids)) fail.push(`Q${p.qid}#${p.num} cs_ids 불일치`);
  for (const [, frag] of p.frs) {
    const ok = (c.cs_ids || []).some((id) => {
      const tt = String(s2.sents.find((y) => String(y.id) === id)?.t || "");
      return tt.includes(frag) || loose(tt).includes(loose(frag));
    });
    if (!ok) fail.push(`Q${p.qid}#${p.num} 어구가 cs_ids 문장에 없다`);
  }
}
let dead = 0, nonhl = 0;
for (const q of s2.questions) for (const c of q.choices || []) for (const id of c.cs_ids || []) {
  if (!ids2.has(id)) dead++;
  else if (NON_HL.has(s2.sents.find((y) => String(y.id) === id).sentType || "body")) nonhl++;
}
if (dead) fail.push(`끊긴 cs_id ${dead}건`);
if (nonhl) fail.push(`비-하이라이트 cs_id ${nonhl}건`);

console.log(`- 적용 후 MD5 \`${md5(after)}\` (+${after.length - before.length}B)`);
console.log("");
if (fail.length) { console.log("## 🔴 되읽기 검산 실패 — 백업으로 되돌리십시오"); fail.forEach((x) => console.log(`- ${x}`)); process.exit(1); }
console.log("## ✅ 되읽기 검산 통과 (S-02)");
console.log("");
console.log(`- 문장 ${sents.length} → **${s2.sents.length}** · 본문 글자 **완전 일치**`);
console.log(`- 재정박 ${plans.length}선지 · 어구가 전부 해당 cs_ids 문장 안에 있음`);
console.log(`- 끊긴 \`cs_id\` **0** · 비-하이라이트 **0**`);
