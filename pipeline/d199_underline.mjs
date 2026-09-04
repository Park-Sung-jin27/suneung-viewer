// d199_underline.mjs — l20279b 「치르르치르르」 밑줄 1건 추가 (발주 D-199)
//
// 지면상 ㉢ 뒤 「치르르치르르」에 밑줄이 있는데 이 세트 annotations 에는 bracket 3건뿐이고
// underline 항목이 없다(심사관 지면 실측).
//
// ★ text 에 마커를 넣지 않는다. 지면에서 밑줄이 그어진 것은 ㉢ 다음의 어구다.
//   기존 데이터의 관례는 갈린다 — 마커가 문장 중간인 underline 331건 중 text 에 마커를
//   포함한 것이 158건, 뺀 것이 173건이다. 관례가 반반이면 지면이 정본이다.
//   marker 필드에는 ㉢ 을 적어 어느 마커의 밑줄인지 남긴다(A′ 앵커 검사도 이 필드를 본다).
//
// ★ cs_spans 는 건드리지 않는다. 그쪽은 선지 근거 하이라이트라 ㉢ 을 포함한 현행이 옳다
//   (gate3 판정 — 지면 밑줄 재현이 아니다). 밑줄과 근거는 서로 다른 것이다.
//
// 사용: node pipeline/d199_underline.mjs [--apply]

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ANN = path.join(ROOT, "public/data/annotations.json");
const DATA = path.join(ROOT, "data-source/all_data_204.json");
const YK = "2027_9월", SID = "l20279b";
const SPEC = { type: "underline", sentId: "l20279bs25", marker: "㉢", text: "치르르치르르" }; // ㉢ · 치르르치르르
const APPLY = process.argv.includes("--apply");
const md5 = (b) => crypto.createHash("md5").update(b).digest("hex");

const before = fs.readFileSync(ANN);
const ann = JSON.parse(before.toString("utf8"));
const data = JSON.parse(fs.readFileSync(DATA, "utf8"));
const set = data[YK].literature.find((x) => (x.setId || x.id) === SID);
const sent = set.sents.find((s) => String(s.id) === SPEC.sentId);
// ★ 스냅샷을 뜬다. 아래에서 같은 배열에 push 하므로 참조를 그대로 들고 있으면
//   검산 시점에 「전」도 함께 늘어나 길이 비교가 무의미해진다(첫 실행에서 실제로
//   "항목 수 4 → 4" 라는 헛된 실패가 났다 — 데이터는 정상이었다).
const list = JSON.parse(JSON.stringify((ann[YK] || {})[SID] || []));

console.log("# l20279b 밑줄 1건 추가 (D-199)");
console.log("");
console.log(`- annotations MD5 \`${md5(before)}\``);
console.log("");

const fail = [];
if (!sent) fail.push(`${SPEC.sentId} 문장이 없다`);
else {
  const t = String(sent.t);
  if (!t.includes(SPEC.text)) fail.push(`문장에 ${JSON.stringify(SPEC.text)} 가 없다: ${JSON.stringify(t)}`);
  if ((t.split(SPEC.text).length - 1) !== 1) fail.push(`어구가 문장에 ${t.split(SPEC.text).length - 1}곳이다 — 밑줄 위치가 특정되지 않는다`);
  if (!t.includes(SPEC.marker)) fail.push(`문장에 마커 ${SPEC.marker} 가 없다`);
  if (t.indexOf(SPEC.marker) > t.indexOf(SPEC.text)) fail.push(`마커가 어구보다 뒤에 있다 — 지면과 어긋난다`);
  console.log(`- 대상 문장 \`${SPEC.sentId}\` ${JSON.stringify(t)}`);
}
if (list.some((a) => a.type === "underline" && String(a.sentId) === SPEC.sentId && a.text === SPEC.text)) fail.push("같은 밑줄이 이미 있다");
console.log(`- 현재 항목 ${list.length}건 (${[...new Set(list.map((a) => a.type))].join(", ") || "없음"})`);
console.log(`- 추가할 항목 \`${JSON.stringify(SPEC)}\``);
console.log("");
if (fail.length) { console.log("## 🔴 사전 검사 실패 — 아무것도 쓰지 않는다"); fail.forEach((x) => console.log(`- ${x}`)); process.exit(1); }
console.log("✅ 사전 검사 통과 — 어구가 문장에 1곳 · 마커가 앞에 있음 · 중복 없음");
console.log("");
if (!APPLY) { console.log("### 미리보기 — 아무것도 쓰지 않았다. `--apply`"); process.exit(0); }

fs.writeFileSync(path.join(ROOT, "pipeline/backups/annotations.before_d199ul.json"), before);
((ann[YK] ||= {})[SID] ||= []).push({ ...SPEC });
fs.writeFileSync(ANN, JSON.stringify(ann, null, 2), "utf8");

const after = fs.readFileSync(ANN);
const back = JSON.parse(after.toString("utf8"));
const pre = JSON.parse(before.toString("utf8"));
const bad = [];
if (after[after.length - 1] === 10) bad.push("끝 개행");
const now = (back[YK] || {})[SID] || [];
if (now.length !== list.length + 1) bad.push(`항목 수 ${list.length} → ${now.length}`);
const hit = now.filter((a) => a.type === "underline" && String(a.sentId) === SPEC.sentId && a.text === SPEC.text);
if (hit.length !== 1) bad.push(`추가된 밑줄이 ${hit.length}건`);
if (hit[0] && hit[0].marker !== SPEC.marker) bad.push("marker 가 다르다");
if (JSON.stringify(now.slice(0, list.length)) !== JSON.stringify(list)) bad.push("기존 항목이 달라졌다");
for (const [yk, sets] of Object.entries(pre)) for (const [sid, l] of Object.entries(sets)) {
  if (yk === YK && sid === SID) continue;
  if (JSON.stringify(l) !== JSON.stringify((back[yk] || {})[sid])) bad.push(`${yk}::${sid} 가 달라졌다`);
}
console.log(`- 적용 후 MD5 \`${md5(after)}\` (+${after.length - before.length}B)`);
if (bad.length) { console.log("## 🔴 되읽기 검산 실패"); bad.forEach((x) => console.log(`- ${x}`)); process.exit(1); }
console.log("## ✅ 되읽기 검산 통과 — 1건 추가 · 기존 항목 무변 · 타 세트·회차 무변");
