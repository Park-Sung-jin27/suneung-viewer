// l20199a_cs_apply.mjs — 2019_9월 l20199a 근거 16선지 (발주 D-171 C)
//
// 권호문 「한거십팔곡」 · 박재삼 「추억에서」 · 리듬 평론.
//
// ★ 어구 대조는 한자 괄호와 공백을 무시한다 (발주 C 말미 지시)
//   데이터는 「공명(功名)이 늦었어라」인데 발주 어구는 「공명이 늦었어라」다.
//   「은(隱)커나 현(見) 커나」처럼 괄호 뒤 공백까지 달라지는 자리가 있어
//   괄호만 지워서는 안 되고 공백도 같이 무시해야 맞는다.
//
// ★ 옛한글(아래아)은 **이 세트 데이터에 이미 빠져 있다**
//   s4 는 「마음에 고져 야 … 노라」로, ᄒᆞ 계열 글자가 통째로 없다.
//   발주 어구도 같은 모양이라 대조는 통과하지만, **원문 복원은 별건이다**
//   (ZWSP·한양PUA 손상 백로그). 이 도구는 근거만 걸고 본문은 손대지 않는다.
//
// ★ Q20#5 연 위치는 심사관 원본 실측으로 확정됐다 (D-172 ⑤)
//   데이터에는 연 구분 정보가 없어 이 도구로는 검산이 안 됐다. 쉼표 규칙도 반례가 있었다.
//   같은 종류의 물음이 또 오면 **데이터로 답하려 들지 말고 원본 대조를 요청한다.**
//
// 사용: node pipeline/l20199a_cs_apply.mjs [--apply]

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = path.join(ROOT, "data-source/all_data_204.json");
const APPLY = process.argv.includes("--apply");
const md5 = (b) => crypto.createHash("md5").update(b).digest("hex");
const YK = "2019_9월", SID = "l20199a";
const NON_HL = new Set(["footnote", "author", "omission", "workTag", "image", "figure"]);
const HANJA = /\([一-鿿㐀-䶿豈-﫿]+\)/g;
const loose = (t) => String(t).replace(HANJA, "").replace(/\s+/g, "");

// [Q, #, [ [문장 접미, 어구], … ] ]
const CS = [
  [16, 4, [["s30", "해 다 진 어스름을"], ["s40", "신새벽이나 밤빛에 보는 것을"]]],
  [16, 5, [["s4", "십재황황"], ["s39", "오명 가명"]]],
  [17, 1, [["s6", "부급동남"], ["s9", "성주를 섬기자 니"]]],
  [17, 2, [["s5", "공명이 늦었어라"], ["s17", "성현의 가신 길이 만고에 가지라"]]],
  [17, 3, [["s8", "강호에 놀자 니"], ["s13", "하물며 부귀 위기ㅣ라 빈천거를 오리라"]]],
  [17, 4, [["s10", "호온자 기로에 서서 갈 데 몰라 노라"], ["s19", "일도ㅣ오 다르지 아니커니"]]],
  [17, 5, [["s13", "빈천거를 오리라"], ["s18", "은커나 현커나 도ㅣ 어찌 다르리"]]],
  [18, 1, [["s2", "생평에 원니 다만 충효뿐이로다"]]],
  [18, 2, [["s4", "마음에 고져 야 십재황황 노라"]]],
  [18, 3, [["s14", "행장유도니 버리면 구태 구랴"]]],
  [18, 4, [["s15", "산지남 수지북 병들고 늙은 나를"], ["s16", "뉘라서 회보미방니 오라 말라 뇨"]]],
  [18, 5, [["s16", "뉘라서 회보미방니 오라 말라 뇨"]]],
  [20, 2, [["s4", "마음에 고져 야 십재황황 노라"], ["s48", "가령 시조는 4음보를 기본으로"]]],
  [20, 3, [["s34", "울 엄매야 울 엄매,"]]],
  [20, 4, [["s39", "오명 가명"], ["s47", "그런데 고전 시가의 리듬에는 외적 규율이 전제되어"]]],
  [20, 5, [["s30", "해 다 진 어스름을,"], ["s34", "울 엄매야 울 엄매,"], ["s37", "손 시리게 떨던가 손 시리게 떨던가,"]]],
];

const before = fs.readFileSync(DATA);
const data = JSON.parse(before.toString("utf8"));
const set = (data[YK]?.literature || []).find((x) => (x.setId || x.id) === SID);
if (!set) { console.log("🔴 세트 없음"); process.exit(1); }
const byId = new Map((set.sents || []).map((x) => [String(x.id), x]));
const C = (qid, num) => set.questions.find((q) => q.id === qid)?.choices?.find((c) => c.num === num);

console.log("# l20199a 근거 16선지 (D-171 C)");
console.log("");
console.log(`- 적용 전 all_data MD5 \`${md5(before)}\``);
console.log("");

const miss = [], plans = [], loosely = [];
for (const [qid, num, frs] of CS) {
  const c = C(qid, num);
  if (!c) { miss.push(`Q${qid}#${num} 선지 없음`); continue; }
  const ids = [];
  for (const [sfx, frag] of frs) {
    const id = SID + sfx, x = byId.get(id);
    if (!x) { miss.push(`Q${qid}#${num} — 문장 ${id} 없음`); continue; }
    if (String(x.t).includes(frag)) ids.push(id);
    else if (loose(x.t).includes(loose(frag))) { ids.push(id); loosely.push(`Q${qid}#${num}→${sfx}`); }
    else { miss.push(`Q${qid}#${num} — ${id} 에 「${frag}」 없음 / 데이터: ${String(x.t).slice(0, 48)}`); continue; }
    if (NON_HL.has(x.sentType || "body")) miss.push(`Q${qid}#${num} — ${id} 가 ${x.sentType} (형광펜 안 켜짐)`);
  }
  plans.push({ qid, num, ids: [...new Set(ids)], old: [...(c.cs_ids || [])] });
}

console.log("| 위치 | 옛 | 새 cs_ids | 어구 |");
console.log("|---|---|---|---|");
for (const p of plans) {
  const frs = CS.find((x) => x[0] === p.qid && x[1] === p.num)[2];
  console.log(`| Q${p.qid}#${p.num} | ${p.old.join(" ").split(SID).join("") || "—"} | **${p.ids.map((x) => x.replace(SID, "")).join(" ")}** | ${frs.map(([, f]) => (f.length > 16 ? f.slice(0, 16) + "…" : f)).join(" / ")} |`);
}
console.log("");
if (miss.length) { console.log("## 🔴 어구 대조 실패 — 아무것도 쓰지 않는다"); miss.forEach((x) => console.log(`- ${x}`)); process.exit(1); }
console.log(`✅ 어구 ${CS.reduce((a, x) => a + x[2].length, 0)}개 전건 확인 (S-24)`);
console.log(`> 🟡 ${loosely.length}건은 한자 괄호·공백을 무시해야 맞았다: ${loosely.join(" · ")}`);
console.log("");

// Q20#5 지정 검산 — (나) 연 경계 (발주 C 말미 지시)
console.log("## Q20#5 「1~3연 각 끝 행」 검산");
console.log("");
console.log("- ✅ **확정** — 심사관 원본 실측으로 [s30, s34, s37] 이 1·2·3연 각 끝 행임이 확인됐다(D-172 ⑤).");
console.log("  D-171 에서 달았던 미검증 플래그는 해제한다.");
console.log("- 데이터만으로는 검산이 안 되는 자리였다. (나) 구간에 연 구분 정보가 없고,");
console.log("  `para` 를 쓰는 문학 세트가 98개 중 3개뿐이라 관례도 없다.");
console.log("- 쉼표 규칙으로 갈음하려던 시도는 **실패했다** — 연 끝이 아닌 행도 쉼표로 끝난다:");
for (const sfx of ["s30", "s34", "s37", "s41", "s43"]) {
  const x = byId.get(SID + sfx);
  console.log(`  - ${sfx} \`${x.t}\`${sfx === "s41" ? "  ← **쉼표인데 연 끝이 아니다(반례)**" : ""}`);
}
console.log("- 교훈: 연 위치는 데이터에 없다. **원본을 볼 수 있는 쪽만 판정할 수 있다**(S-01·§13㉑).");
console.log("");

if (!APPLY) { console.log("### 미리보기 — 아무것도 쓰지 않았다. --apply"); process.exit(0); }

fs.mkdirSync(path.join(ROOT, "pipeline/backups"), { recursive: true });
fs.writeFileSync(path.join(ROOT, "pipeline/backups/all_data_204.before_l20199a.json"), before);
const sentsBefore = JSON.stringify(set.sents);
for (const p of plans) C(p.qid, p.num).cs_ids = [...p.ids];
fs.writeFileSync(DATA, JSON.stringify(data), "utf8");   // §13⑪

const after = fs.readFileSync(DATA);
if (after[0] === 0xef) { console.log("🔴 BOM"); process.exit(1); }
const back = JSON.parse(after.toString("utf8"));
const s2 = back[YK].literature.find((x) => (x.setId || x.id) === SID);
const ids2 = new Set(s2.sents.map((x) => String(x.id)));
const fail = [];
if (JSON.stringify(s2.sents) !== sentsBefore) fail.push("**본문이 달라졌다** — 근거만 걸어야 한다");
for (const p of plans) {
  const c = s2.questions.find((q) => q.id === p.qid).choices.find((x) => x.num === p.num);
  if (JSON.stringify(c.cs_ids) !== JSON.stringify(p.ids)) fail.push(`Q${p.qid}#${p.num} cs_ids`);
  for (const id of c.cs_ids) {
    if (!ids2.has(id)) fail.push(`Q${p.qid}#${p.num} 끊긴 ${id}`);
    else if (NON_HL.has(s2.sents.find((y) => String(y.id) === id).sentType || "body")) fail.push(`Q${p.qid}#${p.num} 비-하이라이트 ${id}`);
  }
  const frs = CS.find((x) => x[0] === p.qid && x[1] === p.num)[2];
  for (const [, frag] of frs) {
    const ok = c.cs_ids.some((id) => {
      const t = String(s2.sents.find((y) => String(y.id) === id)?.t || "");
      return t.includes(frag) || loose(t).includes(loose(frag));
    });
    if (!ok) fail.push(`Q${p.qid}#${p.num} 어구가 cs_ids 문장에 없다`);
  }
}
console.log(`- 적용 후 MD5 \`${md5(after)}\` (+${after.length - before.length}B)`);
console.log("");
if (fail.length) { console.log("## 🔴 되읽기 검산 실패 — 백업으로 되돌리십시오"); fail.forEach((x) => console.log(`- ${x}`)); process.exit(1); }
console.log("## ✅ 되읽기 검산 통과 (S-02)");
console.log("");
console.log(`- cs_ids ${plans.length}선지 · 어구 전건이 해당 문장 안에 있음 · 끊긴 id 0 · 비-하이라이트 0`);
console.log("- **본문 문장은 한 글자도 안 건드렸다**");
