// l20206d_apply.mjs — s29/s31 병합 + [A] 정박 (발주 D-156 ②③)
//
// 무엇을 고치나
//   ③ s29/s31 병합 — 원본에서 `[A]` 라벨이 여백에 있었는데 추출이 그 자리에서 줄을 끊었다.
//      s29 「언덕 위의 최 참판댁은 어둠에」 + s31 「묻혀 위엄에 찬 그 형태는 보이지 않는다.」
//      한 문장이 두 동강 나 화면에서 두 줄로 갈라지고 형광펜도 반쪽만 켜진다.
//      → s29 에 합치고 s31 을 없앤다. s31 을 가리키던 cs_ids 는 s29 로 보낸다.
//   ② [A] = s25~s32 정박 — Q16#4 「시제가 과거형에서 현재형으로 바뀌면서」가 근거다.
//      s25·s26(과거) → s27~s32(현재). 심사관 승인.
//
// 무엇을 안 하나
//   · s30(`[A]` workTag 라벨)은 그대로 둔다 — 렌더가 영역 종료 표시로 쓴다
//   · 다른 문장은 한 글자도 안 건드린다. id 재부여 없음
//
// 안전 절차: 백업 → MD5 → node fs.writeFileSync(§13⑪) → 되읽기 검산(S-02)
//
// 사용:
//   node pipeline/l20206d_apply.mjs           미리보기
//   node pipeline/l20206d_apply.mjs --apply

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = path.join(ROOT, "data-source/all_data_204.json");
const ANN = path.join(ROOT, "public/data/annotations.json");
const APPLY = process.argv.includes("--apply");
const NL = String.fromCharCode(10);
const md5 = (b) => crypto.createHash("md5").update(b).digest("hex");
const YK = "2020_6월", SID = "l20206d";
const KEEP = `${SID}s29`, DROP = `${SID}s31`;
const BRACKET_A = { type: "bracket", label: "A", sentFrom: `${SID}s25`, sentTo: `${SID}s32` };
const NON_HL = new Set(["footnote", "author", "omission", "workTag", "image", "figure"]);

const before = fs.readFileSync(DATA), annBefore = fs.readFileSync(ANN);
const data = JSON.parse(before.toString("utf8"));
const ann = JSON.parse(annBefore.toString("utf8"));
const set = (data[YK]?.literature || []).find((x) => (x.setId || x.id) === SID);
if (!set) { console.log("🔴 세트를 못 찾았다."); process.exit(1); }
const sents = set.sents;
const iK = sents.findIndex((x) => x.id === KEEP), iD = sents.findIndex((x) => x.id === DROP);
if (iK < 0 || iD < 0) { console.log(`⚠ ${KEEP} 또는 ${DROP} 이 없다. 병합된 것으로 보인다.`); process.exit(0); }
const tK = String(sents[iK].t), tD = String(sents[iD].t);
const merged = `${tK} ${tD}`;

// cs_ids 영향 조사
const hits = [];
for (const q of set.questions || []) for (const c of q.choices || []) {
  const has = (c.cs_ids || []).includes(DROP), hasK = (c.cs_ids || []).includes(KEEP);
  if (has) hits.push({ q: q.id, n: c.num, dup: hasK });
}

console.log("# l20206d — s29/s31 병합 + [A] 정박");
console.log("");
console.log(`- 적용 전 all_data MD5 \`${md5(before)}\` · annotations MD5 \`${md5(annBefore)}\``);
console.log("");
console.log("## ③ s29/s31 병합");
console.log("");
console.log(`- \`${KEEP}\` ${JSON.stringify(tK)}`);
console.log(`- \`${DROP}\` ${JSON.stringify(tD)}`);
console.log(`- 병합 → \`${KEEP}\` ${JSON.stringify(merged)}`);
console.log(`- 사이에 낀 것: \`${sents[iK + 1].id}\` [${sents[iK + 1].sentType}] ${JSON.stringify(String(sents[iK + 1].t))} — **그대로 둔다**`);
console.log(`- 문장 ${sents.length} → ${sents.length - 1}`);
console.log("");
console.log(`### \`cs_ids\` 영향 — \`${DROP}\` 참조 ${hits.length}건`);
console.log("");
if (!hits.length) console.log("- 없음");
for (const h of hits) console.log(`- Q${h.q}#${h.n} — \`${DROP}\` → \`${KEEP}\`${h.dup ? " **(이미 s29 도 있어 중복 제거)**" : ""}`);
console.log("");
console.log("## ② [A] 정박");
console.log("");
console.log(`\`${JSON.stringify(BRACKET_A)}\``);
console.log(`- 시작 \`${SID}s25\` ${JSON.stringify(String(sents.find((x) => x.id === `${SID}s25`).t).slice(0, 40))}`);
console.log(`- 끝   \`${SID}s32\` …${JSON.stringify(String(sents.find((x) => x.id === `${SID}s32`).t).slice(-40))}`);
console.log(`- 현재 annotations: ${(ann[YK]?.[SID] || []).map((a) => `[${a.label}]`).join(" ") || "없음"}`);
console.log("");

if (!APPLY) { console.log("### 미리보기 — 아무것도 쓰지 않았다. 적용하려면 --apply"); process.exit(0); }

const bakDir = path.join(ROOT, "pipeline/backups");
fs.mkdirSync(bakDir, { recursive: true });
fs.writeFileSync(path.join(bakDir, "all_data_204.before_l20206d_apply.json"), before);
fs.writeFileSync(path.join(bakDir, "annotations.before_l20206d_apply.json"), annBefore);
console.log(`- 백업 2건: \`pipeline/backups/*.before_l20206d_apply.json\``);

const snapOther = JSON.stringify(sents.filter((x) => x.id !== KEEP && x.id !== DROP));
sents[iK] = { ...sents[iK], t: merged };
sents.splice(sents.findIndex((x) => x.id === DROP), 1);
for (const q of set.questions || []) for (const c of q.choices || [])
  if ((c.cs_ids || []).includes(DROP)) c.cs_ids = [...new Set(c.cs_ids.map((x) => (x === DROP ? KEEP : x)))];
(ann[YK] ||= {}); (ann[YK][SID] ||= []);
if (!ann[YK][SID].some((a) => a?.type === "bracket" && a.label === "A")) ann[YK][SID].push(BRACKET_A);

fs.writeFileSync(DATA, JSON.stringify(data), "utf8");
fs.writeFileSync(ANN, JSON.stringify(ann, null, 2), "utf8");

// ── 되읽기 검산 (S-02) ────────────────────────────────────
const after = fs.readFileSync(DATA), annAfter = fs.readFileSync(ANN);
for (const [nm, b] of [["all_data", after], ["annotations", annAfter]])
  if (b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf) { console.log(`${NL}🔴 ${nm} BOM.`); process.exit(1); }
const back = JSON.parse(after.toString("utf8"));
const annBack = JSON.parse(annAfter.toString("utf8"));
const s2 = (back[YK].literature).find((x) => (x.setId || x.id) === SID);
const ids = new Set(s2.sents.map((x) => String(x.id)));
const fail = [];
if (s2.sents.length !== sents.length) fail.push("문장 수 불일치");
if (ids.has(DROP)) fail.push(`${DROP} 이 남아 있다`);
const k = s2.sents.find((x) => x.id === KEEP);
if (!k || k.t !== merged) fail.push("병합 결과가 다르다");
if (JSON.stringify(s2.sents.filter((x) => x.id !== KEEP)) !== snapOther) fail.push("**다른 문장이 바뀌었다**");
const a2 = (annBack[YK]?.[SID] || []).find((x) => x?.type === "bracket" && x.label === "A");
if (!a2 || a2.sentFrom !== BRACKET_A.sentFrom || a2.sentTo !== BRACKET_A.sentTo) fail.push("[A] 정박이 다르다");
let dangling = 0, nonhl = 0;
for (const q of s2.questions) for (const c of q.choices) for (const id of c.cs_ids || []) {
  if (!ids.has(id)) dangling++;
  else if (NON_HL.has(s2.sents.find((x) => x.id === id).sentType || "body")) nonhl++;
}
if (dangling) fail.push(`끊긴 cs_id ${dangling}건`);
if (nonhl) fail.push(`비-하이라이트 cs_id ${nonhl}건`);

console.log(`- 적용 후 all_data MD5 \`${md5(after)}\` (${after.length - before.length > 0 ? "+" : ""}${after.length - before.length}B) · annotations (+${annAfter.length - annBefore.length}B)`);
console.log("");
if (fail.length) { console.log("## 🔴 되읽기 검산 실패 — 백업으로 되돌리십시오"); fail.forEach((x) => console.log(`- ${x}`)); process.exit(1); }
console.log("## ✅ 되읽기 검산 통과 (S-02)");
console.log("");
console.log(`- 문장 ${sents.length + 1} → **${s2.sents.length}** · \`${DROP}\` 제거 · 다른 문장 **바이트 단위 무변경**`);
console.log(`- \`[A]\` = \`${SID}s25\` ~ \`${SID}s32\` 정박`);
console.log(`- 끊긴 \`cs_id\` **0** · 비-하이라이트 **0**`);
