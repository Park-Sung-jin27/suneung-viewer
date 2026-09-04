// r20199c_apply.mjs — 2019_9월 r20199c 일괄 (발주 D-171 B)
//
// 넷을 한 번에 한다 — 전부 같은 세트라 따로 하면 되읽기 검산을 네 번 돌려야 한다.
//   B-1 cs_ids 8선지 신규          어구는 해당 문장 t 에서 그대로 확인한다(S-24)
//   B-2 Q36#1 pat = L5 + 결론줄 라벨 표기 통일(② 제거 — D-170 끝 라벨 형식)
//   B-3 Q36#1 해설 📌 라벨 맞바꿈  첫 인용이 지문(s30~31), 둘째가 <보기>인데 반대로 적혀 있었다
//   B-4 지문 박스 표지 1곳         annotations.json 에 넣는다(F-25 2단계 이후 단일 원천)
//
// ★ 어구 대조는 마커·가운뎃점·공백을 무시하는 2단계다 (D-171 A 에서 만든 것과 같은 규칙)
//   s41 은 「시선을 ⓔ 바로잡는 데」라 발주 어구와 원문자 하나가 다르다.
//   s34 는 「시․공간」의 가운뎃점이 U+2024 다. 눈으로는 구별이 안 된다.
//
// 사용: node pipeline/r20199c_apply.mjs [--apply]

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = path.join(ROOT, "data-source/all_data_204.json");
const ANN = path.join(ROOT, "public/data/annotations.json");
const APPLY = process.argv.includes("--apply");
const md5 = (b) => crypto.createHash("md5").update(b).digest("hex");
const YK = "2019_9월", SID = "r20199c";
const NON_HL = new Set(["footnote", "author", "omission", "workTag", "image", "figure"]);
const MK = /[ⓐ-ⓩ㉠-㉿㈜-㈞]/g;
const loose = (t) => String(t).replace(MK, "").replace(/[․·・]/g, "·").replace(/\s+/g, "");

// B-1 — [Q, #, [ [문장 접미, 어구], … ] ]
const CS = [
  [33, 1, [["s27", "벤야민은 근대 도시의 복합적 특성이 영화라는 새로운 예술 형식에 드러난다고 주장했다"]]],
  [33, 2, [["s41", "벤야민의 견해는 근대 도시에 대한 일면적인 시선을 바로잡는 데 도움을 준다"]]],
  [33, 3, [["s27", "벤야민은 근대 도시의 복합적 특성이 영화라는 새로운 예술 형식에 드러난다고 주장했다"]]],
  [33, 4, [["s41", "벤야민의 견해는 근대 도시에 대한 일면적인 시선을 바로잡는 데 도움을 준다"]]],
  [34, 2, [["s11", "결핍을 충족시키려는 욕망과 실제로 욕망이 충족된 상태 사이에는 시간적 간극이"],
           ["s12", "이 간극이 좌절이 아니라 오히려 욕망이 충족된 미래 상태에 대한 주관적 환상을"]]],
  [34, 5, [["s6", "어떤 훈육 전략이 동원되었는지 연구하였다"],
           ["s12", "주관적 환상을 자아낸다"],
           ["s13", "실현 가능한 현실이 될 것이라는 기대를 불러일으킨다"]]],
  [35, 2, [["s34", "서로 다른 시․공간의 연결, 카메라가 움직일 때마다 변화하는 시점"]]],
  [36, 1, [["s31", "분업화로 인해 노동으로부터 소외되는 근대 도시인의 모습이 영화 제작 과정에서도 드러나는 것이다"]]],
];
// B-4 — 지문 박스 (관례 실측: {type:"box", sentId, text} · 전 데이터 37건이 이 꼴)
const BOX = { type: "box", sentId: `${SID}s40`, text: "벤야민이 말한 근대 도시" };

const before = fs.readFileSync(DATA);
const data = JSON.parse(before.toString("utf8"));
const set = (data[YK]?.reading || []).find((x) => (x.setId || x.id) === SID);
if (!set) { console.log("🔴 세트 없음"); process.exit(1); }
const byId = new Map((set.sents || []).map((x) => [String(x.id), x]));
const Q = (id) => set.questions.find((q) => q.id === id);
const C = (qid, num) => Q(qid)?.choices?.find((c) => c.num === num);

console.log("# r20199c 일괄 (D-171 B)");
console.log("");
console.log(`- 적용 전 all_data MD5 \`${md5(before)}\``);
console.log("");

// ── B-1 어구 대조 ────────────────────────────────────────
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
    else { miss.push(`Q${qid}#${num} — ${id} 에 「${frag.slice(0, 26)}…」 없음`); continue; }
    if (NON_HL.has(x.sentType || "body")) miss.push(`Q${qid}#${num} — ${id} 가 ${x.sentType}`);
  }
  plans.push({ qid, num, ids: [...new Set(ids)], old: [...(c.cs_ids || [])] });
}
console.log("## B-1 근거 8선지");
console.log("");
console.log("| 위치 | 옛 | 새 cs_ids | 어구 |");
console.log("|---|---|---|---|");
for (const p of plans) {
  const frs = CS.find((x) => x[0] === p.qid && x[1] === p.num)[2];
  console.log(`| Q${p.qid}#${p.num} | ${p.old.join(" ").split(SID).join("") || "—"} | **${p.ids.map((x) => x.replace(SID, "")).join(" ")}** | ${frs.map(([, f]) => f.slice(0, 18) + "…").join(" / ")} |`);
}
console.log("");
if (miss.length) { console.log("## 🔴 어구 대조 실패 — 아무것도 쓰지 않는다"); miss.forEach((x) => console.log(`- ${x}`)); process.exit(1); }
console.log(`✅ 어구 ${CS.reduce((a, x) => a + x[2].length, 0)}개 전건 확인 (S-24)`);
if (loosely.length) console.log(`> 🟡 ${loosely.length}건은 원문자·가운뎃점을 무시해야 맞았다: ${loosely.join(" · ")}`);
console.log("");

// ── B-2·B-3 Q36#1 해설 ───────────────────────────────────
const c361 = C(36, 1);
const A0 = String(c361.analysis || "");
let a = A0;
const L1 = '📌 보기 근거: "배우나... 스태프는 작품의 전체적인 모습을 파악하기 어렵다. 분업화로 인해 노동으로부터 소외되는 근대 도시인의 모습이 영화 제작 과정에서도 드러나는 것이다."';
const L2 = '📌 지문 근거: "베르토프는... 주체적이고 자율적으로 영화를 제작하는 영화인의 모습을 보여 준다."';
const bad3 = [];
if (!a.includes(L1) || !a.includes(L2)) bad3.push("📌 두 줄을 원문 그대로 찾지 못했다");
else a = a.replace(L1, L1.replace("보기 근거", "지문 근거")).replace(L2, L2.replace("지문 근거", "보기 근거"));
const nLab = (a.match(/\[보기 대입 오류②\]/g) || []).length;
if (!nLab) bad3.push("`[보기 대입 오류②]` 를 찾지 못했다");
a = a.split("[보기 대입 오류②]").join("[보기 대입 오류]");
console.log("## B-2·B-3 Q36#1");
console.log("");
console.log(`- \`pat\`: ${JSON.stringify(c361.pat)} → **"L5"** (보기의 베르토프를 지문의 소외론으로 잘못 대입)`);
console.log("- 📌 라벨 맞바꿈: 첫 인용(s30~31 소외) **보기 근거 → 지문 근거** · 둘째 인용(베르토프 자율) **지문 근거 → 보기 근거**");
console.log(`- 라벨 표기 통일: \`[보기 대입 오류②]\` → \`[보기 대입 오류]\` **${nLab}곳** (D-170 끝 라벨 형식 · L5 명칭 그대로)`);
console.log("");
if (bad3.length) { console.log("## 🔴 해설 수정 실패 — 아무것도 쓰지 않는다"); bad3.forEach((x) => console.log(`- ${x}`)); process.exit(1); }
console.log(`- 결론줄: \`${a.trim().split("\n").pop()}\``);
console.log("");

// ── B-4 박스 ─────────────────────────────────────────────
const annBefore = fs.readFileSync(ANN);
const ann = JSON.parse(annBefore.toString("utf8"));
const s40 = byId.get(BOX.sentId);
if (!s40 || !String(s40.t).includes(BOX.text)) { console.log(`🔴 ${BOX.sentId} 에 「${BOX.text}」 없음`); process.exit(1); }
const cur = (ann[YK] && ann[YK][SID]) || [];
const dupBox = cur.some((o) => o.type === "box" && o.sentId === BOX.sentId && o.text === BOX.text);
console.log("## B-4 박스 표지");
console.log("");
console.log("- 관례 실측(S-14): 지문 박스는 전 데이터 **37건이 모두 `{type,sentId,text}`** 한 꼴이다.");
console.log(`- 지문 1곳 → \`${JSON.stringify(BOX)}\` ${dupBox ? "⏭ 이미 있음" : "**신규**"}`);
console.log("- 37번 발문 1곳 → **적용하지 않는다. 방식 상신한다** (프론트가 아는 target 은 passage·bogi·choice 뿐)");
console.log("");

if (!APPLY) { console.log("### 미리보기 — 아무것도 쓰지 않았다. --apply"); process.exit(0); }

fs.mkdirSync(path.join(ROOT, "pipeline/backups"), { recursive: true });
fs.writeFileSync(path.join(ROOT, "pipeline/backups/all_data_204.before_r20199c.json"), before);
fs.writeFileSync(path.join(ROOT, "pipeline/backups/annotations.before_r20199c.json"), annBefore);

for (const p of plans) C(p.qid, p.num).cs_ids = [...p.ids];
c361.pat = "L5";
c361.analysis = a;
fs.writeFileSync(DATA, JSON.stringify(data), "utf8");                       // §13⑪
if (!dupBox) {
  if (!ann[YK]) ann[YK] = {};
  if (!ann[YK][SID]) ann[YK][SID] = [];
  ann[YK][SID].push(BOX);
  fs.writeFileSync(ANN, JSON.stringify(ann, null, 2), "utf8");              // 2칸 · 끝 개행 없음
}

// ── 되읽기 검산 (S-02) ───────────────────────────────────
const after = fs.readFileSync(DATA);
if (after[0] === 0xef) { console.log("🔴 BOM"); process.exit(1); }
const back = JSON.parse(after.toString("utf8"));
const s2 = back[YK].reading.find((x) => (x.setId || x.id) === SID);
const ids2 = new Set(s2.sents.map((x) => String(x.id)));
const fail = [];
for (const p of plans) {
  const c = s2.questions.find((q) => q.id === p.qid).choices.find((x) => x.num === p.num);
  if (JSON.stringify(c.cs_ids) !== JSON.stringify(p.ids)) fail.push(`Q${p.qid}#${p.num} cs_ids`);
  for (const id of c.cs_ids) {
    if (!ids2.has(id)) fail.push(`Q${p.qid}#${p.num} 끊긴 ${id}`);
    else if (NON_HL.has(s2.sents.find((y) => String(y.id) === id).sentType || "body")) fail.push(`Q${p.qid}#${p.num} 비-하이라이트 ${id}`);
  }
}
const b1 = s2.questions.find((q) => q.id === 36).choices.find((x) => x.num === 1);
if (b1.pat !== "L5") fail.push("pat 미반영");
if (!b1.analysis.includes('📌 지문 근거: "배우나')) fail.push("📌 첫 줄 라벨 미반영");
if (!b1.analysis.includes('📌 보기 근거: "베르토프는')) fail.push("📌 둘째 줄 라벨 미반영");
if (b1.analysis.includes("보기 대입 오류②")) fail.push("② 잔존");
if (!b1.analysis.trim().endsWith("[보기 대입 오류]")) fail.push("결론줄 끝 라벨 아님");
const strip = (s) => s.split("보기 근거").join("§").split("지문 근거").join("§").split("보기 대입 오류②").join("¶").split("보기 대입 오류").join("¶");
if (strip(b1.analysis) !== strip(A0)) fail.push("**해설 본문이 라벨 밖에서 달라졌다**");
const annTxt = fs.readFileSync(ANN, "utf8");
const annBack = JSON.parse(annTxt);
if (!(annBack[YK]?.[SID] || []).some((o) => o.type === "box" && o.sentId === BOX.sentId && o.text === BOX.text)) fail.push("박스 미반영");
if (annTxt.endsWith("\n")) fail.push("annotations.json 끝 개행 생김");

console.log(`- 적용 후 all_data MD5 \`${md5(after)}\` (+${after.length - before.length}B) · annotations +${annTxt.length - annBefore.toString("utf8").length}자`);
console.log("");
if (fail.length) { console.log("## 🔴 되읽기 검산 실패 — 백업으로 되돌리십시오"); fail.forEach((x) => console.log(`- ${x}`)); process.exit(1); }
console.log("## ✅ 되읽기 검산 통과 (S-02)");
console.log("");
console.log(`- cs_ids ${plans.length}선지 · 끊긴 id 0 · 비-하이라이트 0`);
console.log("- pat L5 · 📌 라벨 맞바꿈 · 끝 라벨 `[보기 대입 오류]`");
console.log("- **해설 본문은 라벨 밖에서 한 글자도 안 달라졌다**");
console.log("- annotations.json 2칸 들여쓰기 · 끝 개행 없음 유지");
