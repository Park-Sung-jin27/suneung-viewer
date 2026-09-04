// worktag_insert.mjs — 구획 표지(workTag) 한 줄 삽입 (발주 D-147 ④ · D-149 ①)
//
// 왜 필요한가
//   발문이 「(가)와 (나)」를 묻는데 본문에 (가) 이름표만 빠진 세트가 있다.
//   본문은 멀쩡한데 표지 한 줄이 없어 학생이 어느 작품인지 못 가린다.
//   `passage_gap_audit` ⓐ축이 잡아 주는 자리다.
//
// 무엇을 안 하나
//   기존 문장은 **한 글자도 안 건드린다.** id 재부여도 하지 않는다.
//   새 문장은 안 겹치는 id(`<setId>s9NN`)로 만들어 지정 위치에 끼울 뿐이다.
//
// 안전 절차: 백업 → MD5 → node fs.writeFileSync(§13⑪) → 되읽기 검산(S-02)
//
// 사용:
//   node pipeline/worktag_insert.mjs "2019수능::r2019b" "(가)" --at 0
//   node pipeline/worktag_insert.mjs "2019수능::r2019b" "(가)" --at 0 --apply
//   (--at 은 삽입할 배열 위치. 0 = 맨 앞)

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = path.join(ROOT, "data-source/all_data_204.json");
const argv = process.argv.slice(2);
const APPLY = argv.includes("--apply");
const key = argv.find((x) => x.includes("::"));
const tag = argv.find((x) => /^\(.\)$/.test(x));
const ai = argv.indexOf("--at");
const AT = ai >= 0 ? Number(argv[ai + 1]) : 0;
if (!key || !tag) { console.error('사용법: node pipeline/worktag_insert.mjs "<yk>::<setId>" "(가)" --at 0 [--apply]'); process.exit(1); }

const md5 = (b) => crypto.createHash("md5").update(b).digest("hex");
const [YK, SID] = key.split("::");
const before = fs.readFileSync(DATA);
const data = JSON.parse(before.toString("utf8"));
let set = null;
for (const sec of ["reading", "literature"]) {
  const f = (data[YK]?.[sec] || []).find((x) => (x.setId || x.id) === SID);
  if (f) set = f;
}
if (!set) { console.log(`🔴 \`${key}\` 를 못 찾았다.`); process.exit(1); }
const sents = set.sents || [];

console.log(`# 구획 표지 삽입 — \`${key}\` ${tag}`);
console.log("");
console.log(`- 적용 전 all_data: ${(before.length / 1048576).toFixed(2)}MB · MD5 \`${md5(before)}\``);
console.log(`- 기존 문장 ${sents.length}`);

if (sents.some((x) => x.sentType === "workTag" && String(x.t || "").trim() === tag)) {
  console.log(`\n⚠ ${tag} workTag 가 이미 있다. 아무것도 하지 않는다.`); process.exit(0);
}
// 안 겹치는 id — s900 부터 비어 있는 번호를 찾는다
let nid = "";
for (let n = 900; n < 999; n++) { const c = `${SID}s${n}`; if (!sents.some((x) => x.id === c)) { nid = c; break; } }
if (!nid) { console.log("\n🔴 쓸 id 를 못 만들었다."); process.exit(1); }

const row = { id: nid, t: tag, sentType: "workTag" };
console.log(`- 넣을 문장: ${JSON.stringify(row)} → 배열 ${AT}번 자리`);
console.log(`- ${AT === 0 ? "맨 앞" : `기존 \`${sents[AT]?.id}\` 앞`}`);
console.log(`- 기존 ${sents.length}개 **무변경** · id 재부여 없음`);

if (!APPLY) { console.log("\n### 미리보기 — 아무것도 쓰지 않았다. 적용하려면 --apply"); process.exit(0); }

const bakDir = path.join(ROOT, "pipeline/backups");
fs.mkdirSync(bakDir, { recursive: true });
const bak = path.join(bakDir, `all_data_204.before_${SID}_${nid}.json`);
fs.writeFileSync(bak, before);
console.log(`\n- 백업: \`pipeline/backups/${path.basename(bak)}\``);

const snap = JSON.stringify(sents);
set.sents = [...sents.slice(0, AT), row, ...sents.slice(AT)];
fs.writeFileSync(DATA, JSON.stringify(data), "utf8");   // §13⑪

const after = fs.readFileSync(DATA);
if (after[0] === 0xef && after[1] === 0xbb && after[2] === 0xbf) { console.log("\n🔴 BOM."); process.exit(1); }
const back = JSON.parse(after.toString("utf8"));
let s2 = null;
for (const sec of ["reading", "literature"]) {
  const f = (back[YK]?.[sec] || []).find((x) => (x.setId || x.id) === SID);
  if (f) s2 = f;
}
const fail = [];
if (!s2) fail.push("세트가 사라졌다");
else {
  if (s2.sents.length !== sents.length + 1) fail.push(`문장 수 ${s2.sents.length} ≠ ${sents.length + 1}`);
  if (s2.sents[AT]?.id !== nid) fail.push(`${AT}번 자리에 새 문장이 없다`);
  const rest = [...s2.sents.slice(0, AT), ...s2.sents.slice(AT + 1)];
  if (JSON.stringify(rest) !== snap) fail.push("**기존 문장이 바뀌었다**");
}
if (Object.keys(back).length !== Object.keys(data).length) fail.push("회차 수가 변했다");

console.log(`- 적용 후 all_data: ${(after.length / 1048576).toFixed(2)}MB · MD5 \`${md5(after)}\` · +${after.length - before.length} bytes`);
console.log("");
if (fail.length) { console.log("## 🔴 되읽기 검산 실패 — 백업으로 되돌리십시오"); fail.forEach((x) => console.log(`- ${x}`)); process.exit(1); }
console.log("## ✅ 되읽기 검산 통과 (S-02)");
console.log(`- 문장 ${sents.length} → ${s2.sents.length} · 기존 ${sents.length}개 바이트 단위 동일`);
