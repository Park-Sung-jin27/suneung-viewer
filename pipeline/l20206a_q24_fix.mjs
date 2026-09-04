// l20206a_q24_fix.mjs — 2020_6월::l20206a 선지 오염 수리 (발주 D-154 ①②⑤)
//
// 무엇을 고치나
//   ① Q24 선지 5개를 원본 시험지 문면으로 교체
//      ①~④ 는 같은 시험지 16번(박경리 「토지」) 문항 것이 통째로 들어와 있었다.
//      ⑤ 도 조사가 다르다 — `[A]는` → `[A]에서는`, `[B]는` → `[B]에서는`(원본 대조).
//   ② 세트 제목에서 「박경리, 토지」를 뺀다. 본문 끝(s22)이 `- 작자 미상, 「조웅전」 -` 이다.
//   ⑤ [B] 구간을 s14~s15 에 정박한다 (심사관 실측 확정).
//
// 무엇을 안 하나
//   · Q24 #1~#4 의 `analysis`·`cs_ids`·`pat` 은 **건드리지 않는다** — 재작성안 판정 대기(발주 ③).
//     그동안은 **선지와 해설이 어긋난 상태**로 남는다. 비노출 세트라 학생 영향은 없으나
//     **판정 전에는 절대 노출하지 않는다.**
//   · [A] 정박은 하지 않는다 — s2 분리가 선행돼야 한다(발주 ⑤, 아래 보고 참조).
//   · 본문 문장은 한 글자도 안 건드린다.
//
// 안전 절차: 백업 → MD5 → node fs.writeFileSync(§13⑪) → 되읽기 검산(S-02)
//
// 사용:
//   node pipeline/l20206a_q24_fix.mjs           미리보기
//   node pipeline/l20206a_q24_fix.mjs --apply

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = path.join(ROOT, "data-source/all_data_204.json");
const ANN = path.join(ROOT, "public/data/annotations.json");
const APPLY = process.argv.includes("--apply");
const md5 = (b) => crypto.createHash("md5").update(b).digest("hex");
const YK = "2020_6월", SID = "l20206a";

// 원본 시험지 문면 (심사관 원본 PDF 대조 확정본 — D-154 ①)
const CHOICES = [
  "[A]에서는 공간의 광활함을 통해 인물의 진취적인 기상이 드러나고 있다.",
  "[B]에서는 시간의 흐름을 통해 인물의 낙관적 태도가 드러나고 있다.",
  "[A]에서는 낭만적인 사건에 의한 환상성이, [B]에서는 구체적인 시대적 상황에 의한 현실성이 부각되고 있다.",
  "[A]에서는 공간적 변화에서 비롯되는 긴장감이, [B]에서는 계절적 상황에서 비롯되는 쓸쓸함이 강조되고 있다.",
  "[A]에서는 비현실적 공간에서 느껴지는 신비로움이, [B]에서는 현실 공간에서 느껴지는 불길함이 드러나고 있다.",
];
const TITLE = "작자 미상, 조웅전 - 조웅의 영웅적 면모와 초월적 세계의 비호";
const BRACKET_B = { type: "bracket", label: "B", sentFrom: `${SID}s14`, sentTo: `${SID}s15` };

const before = fs.readFileSync(DATA);
const annBefore = fs.readFileSync(ANN);
const data = JSON.parse(before.toString("utf8"));
const ann = JSON.parse(annBefore.toString("utf8"));
const set = (data[YK]?.literature || []).find((x) => (x.setId || x.id) === SID);
if (!set) { console.log("🔴 세트를 못 찾았다."); process.exit(1); }
const q24 = (set.questions || []).find((q) => q.id === 24);
if (!q24 || (q24.choices || []).length !== 5) { console.log("🔴 Q24 선지가 5개가 아니다."); process.exit(1); }
const byId = new Set((set.sents || []).map((x) => String(x.id)));

console.log("# l20206a Q24 선지 오염 수리");
console.log("");
console.log(`- 대상: \`${YK}::${SID}\` — 비노출`);
console.log(`- 적용 전 all_data MD5 \`${md5(before)}\` · annotations MD5 \`${md5(annBefore)}\``);
console.log("");

// ── 안전장치 ──────────────────────────────────────────────
const bad = [];
for (const id of [BRACKET_B.sentFrom, BRACKET_B.sentTo]) if (!byId.has(id)) bad.push(`${id} 부재`);
if (!/작자 미상/.test(String((set.sents || []).at(-1)?.t || ""))) bad.push("본문 끝이 「작자 미상」이 아니다 — 제목 정정 근거 확인 필요");
if (bad.length) { console.log("🔴 안전장치 위반 — 아무것도 쓰지 않는다"); bad.forEach((x) => console.log("- " + x)); process.exit(1); }

console.log("## ① Q24 선지 교체");
console.log("");
console.log("| # | 현행 | 원본 확정본 | |");
console.log("|---|---|---|---|");
for (let i = 0; i < 5; i++) {
  const cur = String(q24.choices[i].t || "");
  const same = cur === CHOICES[i];
  console.log(`| ${i + 1} | ${cur.slice(0, 40)}… | ${CHOICES[i].slice(0, 40)}… | ${same ? "동일" : "🔴 교체"} |`);
}
console.log("");
console.log("## ② 제목");
console.log("");
console.log(`- 현행: ${JSON.stringify(set.title)}`);
console.log(`- 정정: ${JSON.stringify(TITLE)}`);
console.log(`- 근거: 본문 끝 \`${String((set.sents || []).at(-1)?.t || "").trim()}\``);
console.log("");
console.log("## ⑤ [B] 정박");
console.log("");
const list = (ann[YK]?.[SID]) || [];
console.log(`- 현행 annotations: ${list.length}건`);
console.log(`- 넣을 것: ${JSON.stringify(BRACKET_B)}`);
console.log(`  · \`s14\` ${String((set.sents || []).find((x) => x.id === `${SID}s14`).t).slice(0, 46)}…`);
console.log(`  · \`s15\` ${String((set.sents || []).find((x) => x.id === `${SID}s15`).t).slice(0, 46)}…`);
console.log("");
console.log("## 손대지 않는 것");
console.log("");
console.log("- Q24 #1~#4 의 `analysis`·`cs_ids`·`pat` — 재작성안 판정 대기(발주 ③)");
console.log("- `[A]` 정박 — `s2` 분리 선행 필요(발주 ⑤)");
console.log("- 본문 문장 전부");

if (!APPLY) { console.log("\n### 미리보기 — 아무것도 쓰지 않았다. 적용하려면 --apply"); process.exit(0); }

// ── 적용 ──────────────────────────────────────────────────
const bakDir = path.join(ROOT, "pipeline/backups");
fs.mkdirSync(bakDir, { recursive: true });
fs.writeFileSync(path.join(bakDir, "all_data_204.before_l20206a_q24.json"), before);
fs.writeFileSync(path.join(bakDir, "annotations.before_l20206a_q24.json"), annBefore);
console.log(`\n- 백업: \`pipeline/backups/all_data_204.before_l20206a_q24.json\` · \`annotations.before_l20206a_q24.json\``);

const snapSents = JSON.stringify(set.sents);
for (let i = 0; i < 5; i++) q24.choices[i].t = CHOICES[i];
set.title = TITLE;
(ann[YK] ||= {});
(ann[YK][SID] ||= []);
if (!ann[YK][SID].some((a) => a?.type === "bracket" && a.label === "B")) ann[YK][SID].push(BRACKET_B);

// 🔴 직렬화 형식을 원본과 맞춘다 — 안 맞추면 diff 가 파일 전체가 되어 검토가 불가능해진다
//   all_data_204.json 은 minified 한 줄이 정본
//   annotations.json 은 2칸 들여쓰기 · 끝 개행 없음 (실측)
//   첫 구현에서 annotations 를 minify 했다가 6,142줄이 통째로 지워진 diff 가 났다
fs.writeFileSync(DATA, JSON.stringify(data), "utf8");        // §13⑪
fs.writeFileSync(ANN, JSON.stringify(ann, null, 2), "utf8");

// ── 되읽기 검산 (S-02) ────────────────────────────────────
const after = fs.readFileSync(DATA), annAfter = fs.readFileSync(ANN);
for (const [name, buf] of [["all_data", after], ["annotations", annAfter]])
  if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) { console.log(`\n🔴 ${name} 에 BOM.`); process.exit(1); }
const back = JSON.parse(after.toString("utf8"));
const annBack = JSON.parse(annAfter.toString("utf8"));
const s2 = (back[YK]?.literature || []).find((x) => (x.setId || x.id) === SID);
const fail = [];
if (!s2) fail.push("세트가 사라졌다");
else {
  const q = (s2.questions || []).find((x) => x.id === 24);
  for (let i = 0; i < 5; i++) if (q.choices[i].t !== CHOICES[i]) fail.push(`Q24#${i + 1} 선지가 확정본과 다르다`);
  if (s2.title !== TITLE) fail.push("제목이 반영되지 않았다");
  if (/토지|박경리/.test(JSON.stringify(s2.title))) fail.push("제목에 「토지」가 남았다");
  if (JSON.stringify(s2.sents) !== snapSents) fail.push("**본문 문장이 바뀌었다**");
  const b = (annBack[YK]?.[SID] || []).find((a) => a?.type === "bracket" && a.label === "B");
  if (!b) fail.push("[B] bracket 이 없다");
  else if (b.sentFrom !== BRACKET_B.sentFrom || b.sentTo !== BRACKET_B.sentTo) fail.push("[B] 범위가 다르다");
}
if (Object.keys(back).length !== Object.keys(data).length) fail.push("회차 수가 변했다");

console.log(`- 적용 후 all_data MD5 \`${md5(after)}\` · ${after.length - before.length > 0 ? "+" : ""}${after.length - before.length} bytes`);
console.log(`- 적용 후 annotations MD5 \`${md5(annAfter)}\` · ${annAfter.length - annBefore.length > 0 ? "+" : ""}${annAfter.length - annBefore.length} bytes`);
console.log("");
if (fail.length) { console.log("## 🔴 되읽기 검산 실패 — 백업으로 되돌리십시오"); fail.forEach((x) => console.log(`- ${x}`)); process.exit(1); }
console.log("## ✅ 되읽기 검산 통과 (S-02)");
console.log("");
console.log("- Q24 선지 5개 원본 확정본과 일치");
console.log("- 제목에 「토지」 잔존 0");
console.log("- `[B]` = `s14`~`s15` 정박");
console.log("- 본문 문장 **바이트 단위 무변경**");
console.log("");
console.log("🔴 **Q24 #1~#4 의 해설은 아직 토지 문항 것이다. 판정 전 노출 금지.**");
console.log("");
console.log("다음: `answer_key_audit --expect 2020_6월` · `choice_contamination_audit` · `build_split --verify`");
