// d175_pat0_fix.mjs — 2016_6월B::r20166d Q29#4 pat 0 → R4 + 근거 (발주 D-175 ②)
//
// D-174 전수 조사에서 나온 유일한 「정의에 없는 pat 값」이다.
// 10종(L1~L5 · R1~R4 · V) 어디에도 없는 `0` 이 LIVE 세트에 하나 남아 있었다.
//
// ★ 이 해설에는 📌 줄이 없다
//   `[지문 근거 확인]` 절에 인용이 들어 있는 옛 형식이다. 그래서 검산을
//   「📌 줄 대조」가 아니라 **「해설 어딘가에 인용이 있고, 그 인용이 cs_ids
//   문장 안에도 있는가」**로 건다. 형식이 달라도 정합은 같은 뜻이다.
//   해설 문면은 손대지 않는다 — 발주에 없다.
//
// 사용: node pipeline/d175_pat0_fix.mjs [--apply]

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = path.join(ROOT, "public/data/all_data_204.json");
const APPLY = process.argv.includes("--apply");
const md5 = (b) => crypto.createHash("md5").update(b).digest("hex");
const YK = "2016_6월B", SID = "r20166d", QID = 29, NUM = 4;
const NON_HL = new Set(["footnote", "author", "omission", "workTag", "image", "figure"]);
const loose = (t) => String(t).replace(/[ⓐ-ⓩ㉠-㉿]/g, "").replace(/\s+/g, "");

const NEW_PAT = "R4";   // 개념 혼합 — 민사적 제재와 행정적 제재를 뒤섞었다
const CS = [
  ["s16", "민사적 제재의 성격을 갖는다고 보아야 하므로"],
  ["s2", "민사적 수단인 손해 배상, 형사적 수단인 벌금, 행정적 수단인 과징금"],
];

const before = fs.readFileSync(DATA);
const data = JSON.parse(before.toString("utf8"));
const set = (data[YK]?.reading || []).find((x) => (x.setId || x.id) === SID);
if (!set) { console.log("🔴 세트 없음"); process.exit(1); }
const byId = new Map((set.sents || []).map((x) => [String(x.id), x]));
const c = set.questions.find((q) => q.id === QID)?.choices?.find((x) => x.num === NUM);
if (!c) { console.log("🔴 선지 없음"); process.exit(1); }

console.log("# r20166d Q29#4 pat 0 → R4 (D-175 ②)");
console.log("");
console.log(`- 적용 전 all_data MD5 \`${md5(before)}\``);
console.log(`- 현재: \`pat\` ${JSON.stringify(c.pat)} · \`ok\` ${c.ok} · \`cs_ids\` ${JSON.stringify(c.cs_ids)}`);
console.log(`- 선지: ${c.text ?? c.t}`);
console.log("");

const ana = String(c.analysis || "");
const miss = [], ids = [];
for (const [sfx, frag] of CS) {
  const id = SID + sfx, x = byId.get(id);
  if (!x) { miss.push(`문장 ${id} 없음`); continue; }
  if (!String(x.t).includes(frag) && !loose(x.t).includes(loose(frag))) { miss.push(`${id} 에 「${frag.slice(0, 24)}…」 없음`); continue; }
  if (NON_HL.has(x.sentType || "body")) { miss.push(`${id} 가 ${x.sentType} (형광펜 안 켜짐)`); continue; }
  if (!loose(ana).includes(loose(frag))) { miss.push(`해설이 「${frag.slice(0, 24)}…」 를 인용하지 않는다`); continue; }
  ids.push(id);
}
console.log("## 근거 ↔ 해설 인용 대조");
console.log("");
console.log("| 문장 | 어구 | 문장 안 | 해설 안 |");
console.log("|---|---|---|---|");
for (const [sfx, frag] of CS) {
  const x = byId.get(SID + sfx);
  console.log(`| \`${sfx}\` | ${frag.slice(0, 34)}… | ${x && loose(x.t).includes(loose(frag)) ? "✅" : "🔴"} | ${loose(ana).includes(loose(frag)) ? "✅" : "🔴"} |`);
}
console.log("");
if (miss.length) { console.log("## 🔴 실패 — 아무것도 쓰지 않는다"); miss.forEach((x) => console.log(`- ${x}`)); process.exit(1); }
console.log(`✅ 어구 ${CS.length}개 — 지문 문장과 해설 **양쪽 모두**에 있다`);
console.log("");
console.log(`- \`pat\` \`0\` → **\`${NEW_PAT}\`** (개념 혼합 — 민사적 제재와 행정적 제재를 뒤섞었다)`);
console.log(`- \`cs_ids\` \`[]\` → **${JSON.stringify(ids)}**`);
console.log("- ⚠ 이 해설에는 📌 줄이 없다. `[지문 근거 확인]` 절을 쓰는 옛 형식이라 **해설 문면은 손대지 않는다**(발주 밖).");
console.log("");

if (!APPLY) { console.log("### 미리보기 — 아무것도 쓰지 않았다. --apply"); process.exit(0); }

fs.mkdirSync(path.join(ROOT, "pipeline/backups"), { recursive: true });
fs.writeFileSync(path.join(ROOT, "pipeline/backups/all_data_204.before_d175.json"), before);
const sents0 = JSON.stringify(set.sents);
c.pat = NEW_PAT;
c.cs_ids = [...ids];
fs.writeFileSync(DATA, JSON.stringify(data), "utf8");   // §13⑪

const after = fs.readFileSync(DATA);
if (after[0] === 0xef) { console.log("🔴 BOM"); process.exit(1); }
const back = JSON.parse(after.toString("utf8"));
const s2 = back[YK].reading.find((x) => (x.setId || x.id) === SID);
const c2 = s2.questions.find((q) => q.id === QID).choices.find((x) => x.num === NUM);
const fail = [];
if (JSON.stringify(s2.sents) !== sents0) fail.push("**본문이 달라졌다**");
if (c2.pat !== NEW_PAT) fail.push("pat 미반영");
if (JSON.stringify(c2.cs_ids) !== JSON.stringify(ids)) fail.push("cs_ids 미반영");
if (String(c2.analysis) !== ana) fail.push("**해설이 달라졌다**");
const ids2 = new Set(s2.sents.map((x) => String(x.id)));
for (const id of c2.cs_ids) {
  if (!ids2.has(id)) fail.push(`끊긴 ${id}`);
  else if (NON_HL.has(s2.sents.find((y) => String(y.id) === id).sentType || "body")) fail.push(`비-하이라이트 ${id}`);
}
for (const [, frag] of CS)
  if (!c2.cs_ids.some((id) => loose(s2.sents.find((y) => String(y.id) === id)?.t || "").includes(loose(frag))))
    fail.push("어구가 cs_ids 문장에 없다");
// 정의에 없는 pat 이 LIVE 에 또 있는지
const src = fs.readFileSync(path.join(ROOT, "src/dataLoader.js"), "utf8");
const at = src.indexOf("const RELEASE_KEYS = new Set([");
const REL = new Set([...src.slice(at, src.indexOf("]);", at)).matchAll(/"([^"]+)"/g)].map((m) => m[1]).filter((k) => k.includes("::")));
const OK_PAT = new Set(["L1", "L2", "L3", "L4", "L5", "R1", "R2", "R3", "R4", "V"]);
const odd = [];
for (const [yk, v] of Object.entries(back)) for (const sec of ["reading", "literature"]) for (const st of v[sec] || []) {
  const k = `${yk}::${st.setId || st.id}`;
  if (!REL.has(k)) continue;
  for (const q of st.questions || []) for (const ch of q.choices || [])
    if (ch.pat != null && ch.pat !== "" && !OK_PAT.has(String(ch.pat).trim())) odd.push(`${k} Q${q.id}#${ch.num} pat=${JSON.stringify(ch.pat)}`);
}

console.log(`- 적용 후 MD5 \`${md5(after)}\` (+${after.length - before.length}B)`);
console.log("");
if (fail.length) { console.log("## 🔴 되읽기 검산 실패 — 백업으로 되돌리십시오"); fail.forEach((x) => console.log(`- ${x}`)); process.exit(1); }
console.log("## ✅ 되읽기 검산 통과 (S-02)");
console.log("");
console.log(`- \`pat\` = \`${NEW_PAT}\` · \`cs_ids\` = ${JSON.stringify(c2.cs_ids)} · 끊긴 id 0 · 비-하이라이트 0`);
console.log("- 인용 어구가 **해설과 cs_ids 문장 양쪽**에 있다");
console.log("- **해설·본문은 한 글자도 안 달라졌다**");
console.log(`- LIVE 전수 재확인 — 정의에 없는 \`pat\` 값: ${odd.length ? `🔴 ${odd.length}건 ${odd.join(" · ")}` : "**0건**"}`);
