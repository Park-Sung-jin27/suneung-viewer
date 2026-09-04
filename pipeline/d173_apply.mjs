// d173_apply.mjs — l20199e 잔여 3선지 근거 (발주 D-173 ①②③)
//
// D-172 의 Q42 3건과 다른 점 — **해설은 손대지 않는다.**
//   Q42 는 📌 가 「작품 전체 서술 방식」이라 어구로 바꿔야 했다.
//   여기 3건은 📌 가 **이미 그 어구를 인용하고 있다**. cs_ids 만 비어 있었다.
//   발주의 「📌 인용:」은 새 문면이 아니라 어구가 어디서 왔는지 알려준 것이다.
//
// ★ 검산 방향이 반대다
//   D-172 는 「📌 를 새로 썼으니 그 어구가 문장에 있나」를 봤다.
//   여기는 「이미 있는 📌 가 새로 거는 cs_ids 문장을 실제로 가리키나」를 본다.
//   해설이 인용한 어구가 cs_ids 문장 밖에 있으면 형광펜과 해설이 따로 논다.
//
// 사용: node pipeline/d173_apply.mjs [--apply]

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = path.join(ROOT, "data-source/all_data_204.json");
const APPLY = process.argv.includes("--apply");
const md5 = (b) => crypto.createHash("md5").update(b).digest("hex");
const YK = "2019_9월", SID = "l20199e";
const NON_HL = new Set(["footnote", "author", "omission", "workTag", "image", "figure"]);
const MK = /[ⓐ-ⓩ㉠-㉿]/g;
const loose = (t) => String(t).replace(MK, "").replace(/\s+/g, "");

// [Q, #, [ [문장 접미, 📌 가 인용한 어구], … ] ]
const CS = [
  [43, 4, [["s920", "수없는 빗발에 씻기며 서 있는 누각을 박쥐조차 나들지 않았다"],
           ["s7", "사진사도 병일이를 환영하였다"],
           ["s923", "그리고 거기는 술과 한담이 있었다"]]],
  [45, 4, [["s3", "주인에게 작별 인사를 하고 공장 문밖을 나서면"],
           ["s7", "사진사도 병일이를 환영하였다"],
           ["s923", "그리고 거기는 술과 한담이 있었다"],
           ["s924", "아직껏 취흥을 향락해 본 경험이 없던 병일이는"]]],
  [45, 5, [["s3", "하루의 고역에서 벗어났다는 시원한 느낌"]]],
];

const before = fs.readFileSync(DATA);
const data = JSON.parse(before.toString("utf8"));
const set = (data[YK]?.literature || []).find((x) => (x.setId || x.id) === SID);
if (!set) { console.log("🔴 세트 없음"); process.exit(1); }
const byId = new Map((set.sents || []).map((x) => [String(x.id), x]));
const C = (qid, num) => set.questions.find((q) => q.id === qid)?.choices?.find((c) => c.num === num);

console.log("# l20199e 잔여 3선지 근거 (D-173)");
console.log("");
console.log(`- 적용 전 all_data MD5 \`${md5(before)}\``);
console.log("");

const miss = [], plans = [], loosely = [];
for (const [qid, num, frs] of CS) {
  const c = C(qid, num);
  if (!c) { miss.push(`Q${qid}#${num} 선지 없음`); continue; }
  const pin = String(c.analysis || "").split("\n")[0];
  const ids = [];
  for (const [sfx, frag] of frs) {
    const id = SID + sfx, x = byId.get(id);
    if (!x) { miss.push(`Q${qid}#${num} — 문장 ${id} 없음`); continue; }
    if (String(x.t).includes(frag)) ids.push(id);
    else if (loose(x.t).includes(loose(frag))) { ids.push(id); loosely.push(`Q${qid}#${num}→${sfx}`); }
    else { miss.push(`Q${qid}#${num} — ${id} 에 「${frag.slice(0, 24)}…」 없음`); continue; }
    if (NON_HL.has(x.sentType || "body")) miss.push(`Q${qid}#${num} — ${id} 가 ${x.sentType} (형광펜 안 켜짐)`);
    // 📌 ↔ cs_ids 정합 (발주 ④)
    if (!loose(pin).includes(loose(frag))) miss.push(`Q${qid}#${num} — 📌 가 「${frag.slice(0, 20)}…」 를 인용하지 않는다`);
  }
  plans.push({ qid, num, ids: [...new Set(ids)], pin });
}

console.log("| 선지 | 새 cs_ids | 📌 (이미 있던 문면 — 안 건드린다) |");
console.log("|---|---|---|");
for (const p of plans)
  console.log(`| Q${p.qid}#${p.num} | **${p.ids.map((x) => x.replace(SID, "")).join(" ")}** | ${p.pin.replace("📌 지문 근거: ", "").slice(0, 62)}… |`);
console.log("");
if (miss.length) { console.log("## 🔴 실패 — 아무것도 쓰지 않는다"); miss.forEach((x) => console.log(`- ${x}`)); process.exit(1); }
console.log(`✅ 어구 ${CS.reduce((a, x) => a + x[2].length, 0)}개 전건 확인 · **📌 가 전건을 인용하고 있다** (발주 ④)`);
console.log(loosely.length ? `> 🟡 정규화 대조로 맞은 건: ${loosely.join(" · ")} (원문자 ⓓ)` : "> 정규화 불필요");
console.log("");

if (!APPLY) { console.log("### 미리보기 — 아무것도 쓰지 않았다. --apply"); process.exit(0); }

fs.mkdirSync(path.join(ROOT, "pipeline/backups"), { recursive: true });
fs.writeFileSync(path.join(ROOT, "pipeline/backups/all_data_204.before_d173.json"), before);
const sents0 = JSON.stringify(set.sents);
const ana0 = plans.map((p) => String(C(p.qid, p.num).analysis));
for (const p of plans) C(p.qid, p.num).cs_ids = [...p.ids];
fs.writeFileSync(DATA, JSON.stringify(data), "utf8");   // §13⑪

const after = fs.readFileSync(DATA);
if (after[0] === 0xef) { console.log("🔴 BOM"); process.exit(1); }
const back = JSON.parse(after.toString("utf8"));
const s2 = back[YK].literature.find((x) => (x.setId || x.id) === SID);
const ids2 = new Set(s2.sents.map((x) => String(x.id)));
const fail = [];
if (JSON.stringify(s2.sents) !== sents0) fail.push("**본문이 달라졌다**");
plans.forEach((p, i) => {
  const c = s2.questions.find((q) => q.id === p.qid).choices.find((x) => x.num === p.num);
  if (JSON.stringify(c.cs_ids) !== JSON.stringify(p.ids)) fail.push(`Q${p.qid}#${p.num} cs_ids`);
  if (String(c.analysis) !== ana0[i]) fail.push(`Q${p.qid}#${p.num} **해설이 달라졌다** — 근거만 걸어야 한다`);
  for (const id of c.cs_ids) {
    if (!ids2.has(id)) fail.push(`Q${p.qid}#${p.num} 끊긴 ${id}`);
    else if (NON_HL.has(s2.sents.find((y) => String(y.id) === id).sentType || "body")) fail.push(`Q${p.qid}#${p.num} 비-하이라이트 ${id}`);
  }
  for (const [, frag] of CS.find((x) => x[0] === p.qid && x[1] === p.num)[2]) {
    const inSent = c.cs_ids.some((id) => loose(s2.sents.find((y) => String(y.id) === id)?.t || "").includes(loose(frag)));
    if (!inSent) fail.push(`Q${p.qid}#${p.num} 어구가 cs_ids 문장에 없다`);
    if (!loose(String(c.analysis).split("\n")[0]).includes(loose(frag))) fail.push(`Q${p.qid}#${p.num} 📌↔cs_ids 어긋남`);
  }
});
// 세트 전체 근거 공백이 0 이 됐는지
const gaps = [];
for (const q of s2.questions) for (const c of q.choices || []) if (!(c.cs_ids || []).length) gaps.push(`Q${q.id}#${c.num}(ok=${c.ok} pat=${c.pat})`);

console.log(`- 적용 후 MD5 \`${md5(after)}\` (+${after.length - before.length}B)`);
console.log("");
if (fail.length) { console.log("## 🔴 되읽기 검산 실패 — 백업으로 되돌리십시오"); fail.forEach((x) => console.log(`- ${x}`)); process.exit(1); }
console.log("## ✅ 되읽기 검산 통과 (S-02)");
console.log("");
console.log("- cs_ids 3선지 · 끊긴 id 0 · 비-하이라이트 0");
console.log("- 📌 가 인용한 어구가 **전건 cs_ids 문장 안에 실재**한다 (발주 ④)");
console.log("- **해설·본문은 한 글자도 안 달라졌다**");
console.log(`- 세트 근거 공백: ${gaps.length ? `🔴 ${gaps.length}건 — ${gaps.join(" · ")}` : "**0건 / 20선지**"}`);
