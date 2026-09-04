// l20216d_worktag_fix.mjs — 2021_6월::l20216d (가) 구획 표지 1줄 추가 (발주 D-147 ④)
//
// 무엇을 고치나
//   발문이 「(가)와 (나)」를 묻는데 본문에 (가) 이름표가 없다. (나)만 s18 에 있다.
//   원본 시험지 41~45번은 `(가)` → `[앞부분 줄거리] 전우치는 …` 순서다(D-146 PDF 대조).
//   본문은 멀쩡하다 — 이름표 한 줄만 없다.
//
// 무엇을 안 고치나
//   기존 문장은 **한 글자도 건드리지 않는다.** id 재부여도 하지 않는다.
//   새 문장 하나를 배열 맨 앞에 끼워 넣을 뿐이다.
//   id 는 기존과 안 겹치게 `l20216ds900` 을 쓴다(r2023b 의 `r2023bs980` 과 같은 관례).
//
// 안전 절차
//   백업 → MD5 기록 → 쓰기(node fs.writeFileSync, §13⑪) → 되읽기 검산(S-02)
//
// 사용:
//   node pipeline/l20216d_worktag_fix.mjs            미리보기
//   node pipeline/l20216d_worktag_fix.mjs --apply

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = path.join(ROOT, "data-source/all_data_204.json");
const APPLY = process.argv.includes("--apply");

const YK = "2021_6월", SID = "l20216d", NEWID = "l20216ds900";
const md5 = (b) => crypto.createHash("md5").update(b).digest("hex");

const before = fs.readFileSync(DATA);
console.log("# l20216d (가) 구획 표지 추가");
console.log("");
console.log(`- 대상: \`${YK}::${SID}\` — **LIVE 세트**`);
console.log(`- 적용 전 all_data: ${(before.length / 1048576).toFixed(2)}MB · MD5 \`${md5(before)}\``);

const data = JSON.parse(before.toString("utf8"));
const set = (data[YK]?.literature || []).find((x) => (x.setId || x.id) === SID);
if (!set) { console.log("🔴 세트를 못 찾았다."); process.exit(1); }
const sents = set.sents || [];

if (sents.some((x) => x.id === NEWID)) { console.log(`\n⚠ \`${NEWID}\` 가 이미 있다. 아무것도 하지 않는다.`); process.exit(0); }
if (sents.some((x) => x.sentType === "workTag" && String(x.t || "").trim() === "(가)")) {
  console.log("\n⚠ (가) workTag 가 이미 있다. 아무것도 하지 않는다."); process.exit(0);
}

const first = sents[0];
console.log(`- 현재 첫 문장: \`${first.id}\` [${first.sentType || "body"}] ${JSON.stringify(String(first.t).slice(0, 50))}`);
console.log(`- (나) 표지: \`${sents.find((x) => x.sentType === "workTag")?.id}\``);
console.log("");
console.log("## 넣을 문장");
console.log("");
console.log(`  ${JSON.stringify({ id: NEWID, t: "(가)", sentType: "workTag" })}`);
console.log(`  → 배열 맨 앞(기존 \`${first.id}\` 앞)에 끼운다`);
console.log("");
console.log(`- 기존 문장 ${sents.length}개 **무변경** · id 재부여 없음`);

if (!APPLY) { console.log("\n### 미리보기 — 아무것도 쓰지 않았다. 적용하려면 --apply"); process.exit(0); }

// 백업
const bakDir = path.join(ROOT, "pipeline/backups");
fs.mkdirSync(bakDir, { recursive: true });
const bak = path.join(bakDir, `all_data_204.before_l20216d_worktag.json`);
fs.writeFileSync(bak, before);
console.log(`\n- 백업: \`pipeline/backups/${path.basename(bak)}\` (MD5 \`${md5(before)}\`)`);

// 기존 배열 스냅샷 — 되읽기 검산용
const snap = JSON.stringify(sents);

set.sents = [{ id: NEWID, t: "(가)", sentType: "workTag" }, ...sents];
fs.writeFileSync(DATA, JSON.stringify(data), "utf8");   // §13⑪ — node fs.writeFileSync 만

// ── 되읽기 검산 (S-02) ────────────────────────────────────
const after = fs.readFileSync(DATA);
if (after[0] === 0xef && after[1] === 0xbb && after[2] === 0xbf) { console.log("\n🔴 BOM 이 붙었다."); process.exit(1); }
const back = JSON.parse(after.toString("utf8"));
const s2 = (back[YK]?.literature || []).find((x) => (x.setId || x.id) === SID);
const fail = [];
if (!s2) fail.push("세트가 사라졌다");
else {
  if (s2.sents.length !== sents.length + 1) fail.push(`문장 수 ${s2.sents.length} ≠ ${sents.length + 1}`);
  if (s2.sents[0]?.id !== NEWID || s2.sents[0]?.t !== "(가)" || s2.sents[0]?.sentType !== "workTag") fail.push("새 문장이 맨 앞에 없다");
  if (JSON.stringify(s2.sents.slice(1)) !== snap) fail.push("**기존 문장이 바뀌었다**");
}
if (Object.keys(back).length !== Object.keys(data).length) fail.push("회차 수가 변했다");

console.log(`- 적용 후 all_data: ${(after.length / 1048576).toFixed(2)}MB · MD5 \`${md5(after)}\` · ${after.length - before.length > 0 ? "+" : ""}${after.length - before.length} bytes`);
console.log("");
if (fail.length) {
  console.log("## 🔴 되읽기 검산 실패 — 백업으로 되돌리십시오");
  fail.forEach((x) => console.log(`- ${x}`));
  process.exit(1);
}
console.log("## ✅ 되읽기 검산 통과 (S-02)");
console.log("");
console.log(`- 문장 ${sents.length} → ${s2.sents.length}`);
console.log(`- 기존 ${sents.length}개 **바이트 단위 동일**`);
console.log(`- 맨 앞 \`${NEWID}\` [workTag] "(가)" 확인`);
console.log("");
console.log("다음: `node pipeline/build_split.mjs --verify` 로 누락 0 확인 후 push.");
