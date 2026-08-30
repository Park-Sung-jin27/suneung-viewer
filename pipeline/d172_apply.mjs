// d172_apply.mjs — 2019_9월 마감 (발주 D-172)
//
//   ①②③ l20199e Q42 #1·#3·#5 cs_ids — 회차 마지막 CRITICAL 6건이 이 3선지다
//   ④    같은 3건 해설 📌 를 「작품 전체 …」에서 **실제 어구 인용**으로 교체
//   ⑥    r20199c Q37 발문 공백 정리 — 박스를 지운 흔적이 남아 있었다
//
// ★ 왜 ④ 를 같이 하나
//   근거를 걸어도 해설이 「작품 전체 서술 방식」이라고만 하면, 화면에서 형광펜은
//   한 문장에 켜지는데 해설은 그 문장을 언급하지 않는다. 근거와 해설이 따로 논다.
//   D-168 에서 같은 어긋남을 고쳤다. 근거를 걸 때 해설도 같이 맞춘다.
//
// ★ 해설은 📌 첫 줄만 바꾼다
//   🔍 풀이와 ❌ 결론줄은 손대지 않는다. 검산에서 📌 줄을 뺀 나머지가
//   적용 전후로 같은지 대조해 문면 훼손을 막는다.
//
// 사용: node pipeline/d172_apply.mjs [--apply]

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = path.join(ROOT, "public/data/all_data_204.json");
const APPLY = process.argv.includes("--apply");
const md5 = (b) => crypto.createHash("md5").update(b).digest("hex");
const YK = "2019_9월";
const NON_HL = new Set(["footnote", "author", "omission", "workTag", "image", "figure"]);
const MK = /[ⓐ-ⓩ㉠-㉿]/g;
const loose = (t) => String(t).replace(MK, "").replace(/[․·・]/g, "·").replace(/\s+/g, "");

// ①②③④ — [#, [ [문장 접미, 어구], … ], 새 📌 줄]
const Q42 = [
  [1, [["s918", "자기의 신경은 확실히 피곤하여졌다고 병일은 생각하였다"]],
      '📌 지문 근거: "자기의 신경은 확실히 피곤하여졌다고 병일은 생각하였다."'],
  [3, [["s912", "주인 앞에서 참고 있었던 담배를 가슴 속 깊이 빨아 들이켜며"]],
      '📌 지문 근거: "주인 앞에서 참고 있었던 담배를 가슴 속 깊이 빨아 들이켜며"'],
  [5, [["s905", "병일이는 이 길을 2년간이나 걸었다"], ["s906", "아침에는 집에서 공장으로, 저녁에는 공장에서 집으로"]],
      '📌 지문 근거: "병일이는 이 길을 2년간이나 걸었다." "아침에는 집에서 공장으로, 저녁에는 공장에서 집으로"'],
];
// ⑥ — 박스가 지워지면서 「도시」와 「를」 사이에 공백이 남았다
const STEM = { sid: "r20199c", qid: 37, from: "벤야민이 말한 근대 도시 를", to: "벤야민이 말한 근대 도시를" };

const before = fs.readFileSync(DATA);
const data = JSON.parse(before.toString("utf8"));
const setE = (data[YK]?.literature || []).find((x) => (x.setId || x.id) === "l20199e");
const setC = (data[YK]?.reading || []).find((x) => (x.setId || x.id) === STEM.sid);
if (!setE || !setC) { console.log("🔴 세트 없음"); process.exit(1); }
const byId = new Map((setE.sents || []).map((x) => [String(x.id), x]));
const q42 = setE.questions.find((q) => q.id === 42);

console.log("# 2019_9월 마감 (D-172)");
console.log("");
console.log(`- 적용 전 all_data MD5 \`${md5(before)}\``);
console.log("");

// ── ①②③④ ────────────────────────────────────────────
const miss = [], plans = [], loosely = [];
for (const [num, frs, pin] of Q42) {
  const c = q42.choices.find((x) => x.num === num);
  if (!c) { miss.push(`Q42#${num} 선지 없음`); continue; }
  const ids = [];
  for (const [sfx, frag] of frs) {
    const id = "l20199e" + sfx, x = byId.get(id);
    if (!x) { miss.push(`Q42#${num} — 문장 ${id} 없음`); continue; }
    if (String(x.t).includes(frag)) ids.push(id);
    else if (loose(x.t).includes(loose(frag))) { ids.push(id); loosely.push(`Q42#${num}→${sfx}`); }
    else { miss.push(`Q42#${num} — ${id} 에 「${frag.slice(0, 26)}…」 없음`); continue; }
    if (NON_HL.has(x.sentType || "body")) miss.push(`Q42#${num} — ${id} 가 ${x.sentType} (형광펜 안 켜짐)`);
  }
  const a0 = String(c.analysis || "");
  const lines = a0.split("\n");
  if (!lines[0].startsWith("📌 ")) { miss.push(`Q42#${num} — 첫 줄이 📌 가 아니다`); continue; }
  if (lines[0].includes('"')) { miss.push(`Q42#${num} — 📌 가 이미 어구를 인용하고 있다(중복 적용 의심)`); continue; }
  plans.push({ num, c, ids: [...new Set(ids)], a0, a1: [pin, ...lines.slice(1)].join("\n"), oldPin: lines[0] });
}
console.log("## ①②③ 근거 + ④ 해설 📌");
console.log("");
console.log("| 선지 | 새 cs_ids | 옛 📌 | 새 📌 |");
console.log("|---|---|---|---|");
for (const p of plans)
  console.log(`| Q42#${p.num} | **${p.ids.map((x) => x.replace("l20199e", "")).join(" ")}** | ${p.oldPin.replace("📌 지문 근거: ", "")} | ${p.a1.split("\n")[0].replace("📌 지문 근거: ", "").slice(0, 46)}… |`);
console.log("");
if (miss.length) { console.log("## 🔴 실패 — 아무것도 쓰지 않는다"); miss.forEach((x) => console.log(`- ${x}`)); process.exit(1); }
console.log(`✅ 어구 ${Q42.reduce((a, x) => a + x[1].length, 0)}개 **전건 원문 그대로** 확인 (S-24)`);
console.log(loosely.length ? `> 🟡 정규화 대조로 맞은 건: ${loosely.join(" · ")}` : "> 정규화 대조가 필요한 건은 없었다 — 마커·공백까지 그대로 맞았다.");
console.log("");

// ── ⑥ 발문 공백 ──────────────────────────────────────
const q37 = setC.questions.find((q) => q.id === STEM.qid);
const t0 = String(q37?.t || "");
let stemOk = false;
if (t0.includes(STEM.to) && !t0.includes(STEM.from)) console.log(`## ⑥ Q37 발문 — ⏭ 이미 정리됨`);
else if (!t0.includes(STEM.from)) { console.log(`🔴 Q37 발문에서 「${STEM.from}」 를 못 찾았다`); process.exit(1); }
else stemOk = true;
if (stemOk) {
  console.log("## ⑥ Q37 발문 공백 정리");
  console.log("");
  console.log(`- 전: \`${t0}\``);
  console.log(`- 후: \`${t0.replace(STEM.from, STEM.to)}\``);
  console.log("- 박스 렌더는 **F-44**(9/3 이후 `target:'question'` 신설)까지 데이터에 넣지 않는다.");
}
console.log("");

if (!APPLY) { console.log("### 미리보기 — 아무것도 쓰지 않았다. --apply"); process.exit(0); }

fs.mkdirSync(path.join(ROOT, "pipeline/backups"), { recursive: true });
fs.writeFileSync(path.join(ROOT, "pipeline/backups/all_data_204.before_d172.json"), before);
const sentsE = JSON.stringify(setE.sents), sentsC = JSON.stringify(setC.sents);
for (const p of plans) { p.c.cs_ids = [...p.ids]; p.c.analysis = p.a1; }
if (stemOk) q37.t = t0.replace(STEM.from, STEM.to);
fs.writeFileSync(DATA, JSON.stringify(data), "utf8");   // §13⑪

// ── 되읽기 검산 (S-02) ───────────────────────────────
const after = fs.readFileSync(DATA);
if (after[0] === 0xef) { console.log("🔴 BOM"); process.exit(1); }
const back = JSON.parse(after.toString("utf8"));
const e2 = back[YK].literature.find((x) => (x.setId || x.id) === "l20199e");
const c2 = back[YK].reading.find((x) => (x.setId || x.id) === STEM.sid);
const ids2 = new Set(e2.sents.map((x) => String(x.id)));
const fail = [];
if (JSON.stringify(e2.sents) !== sentsE) fail.push("**l20199e 본문이 달라졌다**");
if (JSON.stringify(c2.sents) !== sentsC) fail.push("**r20199c 본문이 달라졌다**");
for (const p of plans) {
  const c = e2.questions.find((q) => q.id === 42).choices.find((x) => x.num === p.num);
  if (JSON.stringify(c.cs_ids) !== JSON.stringify(p.ids)) fail.push(`Q42#${p.num} cs_ids`);
  for (const id of c.cs_ids) {
    if (!ids2.has(id)) fail.push(`Q42#${p.num} 끊긴 ${id}`);
    else if (NON_HL.has(e2.sents.find((y) => String(y.id) === id).sentType || "body")) fail.push(`Q42#${p.num} 비-하이라이트 ${id}`);
  }
  // 해설의 인용 어구가 실제로 cs_ids 문장 안에 있는가 — 해설↔근거 정합
  const frs = Q42.find((x) => x[0] === p.num)[1];
  for (const [, frag] of frs) {
    if (!c.analysis.split("\n")[0].includes(frag)) fail.push(`Q42#${p.num} 📌 에 어구가 없다`);
    if (!c.cs_ids.some((id) => String(e2.sents.find((y) => String(y.id) === id)?.t || "").includes(frag)))
      fail.push(`Q42#${p.num} 어구가 cs_ids 문장에 없다`);
  }
  if (c.analysis.split("\n").slice(1).join("\n") !== p.a0.split("\n").slice(1).join("\n"))
    fail.push(`Q42#${p.num} **📌 아래 해설이 달라졌다**`);
}
const t2 = String(c2.questions.find((q) => q.id === STEM.qid).t);
if (t2.includes(STEM.from) || !t2.includes(STEM.to)) fail.push("Q37 발문 미반영");
if (t2.replace(/\s+/g, "") !== t0.replace(/\s+/g, "")) fail.push("**Q37 발문이 공백 말고도 달라졌다**");

console.log(`- 적용 후 MD5 \`${md5(after)}\` (${after.length - before.length >= 0 ? "+" : ""}${after.length - before.length}B)`);
console.log("");
if (fail.length) { console.log("## 🔴 되읽기 검산 실패 — 백업으로 되돌리십시오"); fail.forEach((x) => console.log(`- ${x}`)); process.exit(1); }
console.log("## ✅ 되읽기 검산 통과 (S-02)");
console.log("");
console.log(`- cs_ids 3선지 · 끊긴 id 0 · 비-하이라이트 0`);
console.log("- 📌 인용 어구가 **cs_ids 문장 안에 실재**한다 — 해설↔근거 정합 확인");
console.log("- 📌 아래 🔍 풀이·❌ 결론줄은 **한 글자도 안 달라졌다**");
console.log("- Q37 발문은 **공백 하나만** 달라졌다 · 본문 문장 무변");
