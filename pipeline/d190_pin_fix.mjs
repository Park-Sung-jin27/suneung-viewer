// d190_pin_fix.mjs — 📌 인용 어구를 본문 원문에 맞춘다 (발주 D-190 트랙1 ①②)
//
// span 은 W3 에서 본문에 맞췄는데 해설의 📌 인용은 옛 형태로 남아
// C_anchor_exact_fail 이 세트마다 1건씩 걸려 있다.
//   r20279c Q10#5  「…교류 전압은 정류기에서 전류를…」  ↔ 본문 「정류기 에서」
//   r20279d Q16#3  「…개입 없이도 미디어에서 정보를…」  ↔ 본문 「미디어 에서」
//
// 본문의 그 공백은 원본 텍스트층에도 있다(심사관 오경보 2번 확정) — 본문이 맞다.
// 그러므로 고칠 것은 인용 쪽이다.
//
// ★ 어구를 다시 타이핑하지 않는다 — d190_w3_apply 와 같은 방식으로 본문에서 잘라낸다.
//   정규화로 위치를 찾고 원문 인덱스로 되짚어 slice 한다.
//
// ★ 해설 문면을 건드리는 작업이라 검산을 좁게 건다
//   바뀌는 것은 「그 📌 줄의 그 인용 한 곳」뿐이어야 한다.
//   인용을 도로 옛 문자열로 되돌리면 원래 해설과 글자 그대로 같아지는지 확인한다.
//
// 사용: node pipeline/d190_pin_fix.mjs [--apply]

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = path.join(ROOT, "data-source/all_data_204.json");
const APPLY = process.argv.includes("--apply");
const md5 = (b) => crypto.createHash("md5").update(b).digest("hex");
const YK = "2027_9월";

// 심사관 승인분 (트랙1 ①②)
const SPEC = [
  { sid: "r20279c", qid: 10, num: 5, sentId: "r20279cs7" },
  { sid: "r20279d", qid: 16, num: 3, sentId: "r20279ds17" },
];

const Q = (s) => s.replace(/[‘’‚‛']/g, "'").replace(/[“”„‟"]/g, '"');
function normMap(s) {
  let out = ""; const map = []; const q = Q(s);
  for (let i = 0; i < q.length; i++) { if (/\s/.test(q[i])) continue; out += q[i]; map.push(i); }
  return { out, map };
}
const normPlain = (s) => Q(s).replace(/\s+/g, "");
function carve(sent, needleRaw) {
  const { out, map } = normMap(sent);
  const needle = normPlain(needleRaw);
  if (!needle) return null;
  const at = out.indexOf(needle);
  if (at < 0) return null;
  if (out.indexOf(needle, at + 1) >= 0) return { ambiguous: true };
  return { text: sent.slice(map[at], map[at + needle.length - 1] + 1) };
}

const before = fs.readFileSync(DATA);
const data = JSON.parse(before.toString("utf8"));
const findSet = (dd, sid) => (dd[YK]?.reading || []).find((x) => (x.setId || x.id) === sid)
  || (dd[YK]?.literature || []).find((x) => (x.setId || x.id) === sid);

console.log("# 📌 인용 어구를 본문에 맞춘다 (D-190 트랙1 ①②)");
console.log("");
console.log(`- 적용 전 MD5 \`${md5(before)}\``);
console.log("");

const plans = [], miss = [];
for (const sp of SPEC) {
  const at = `${sp.sid} Q${sp.qid}#${sp.num}`;
  const set = findSet(data, sp.sid);
  if (!set) { miss.push(`${sp.sid} 세트 없음`); continue; }
  const c = set.questions?.find((q) => q.id === sp.qid)?.choices?.find((x) => x.num === sp.num);
  if (!c) { miss.push(`${at} 선지 없음`); continue; }
  const sent = (set.sents || []).find((x) => String(x.id) === sp.sentId);
  if (!sent) { miss.push(`${at} 문장 ${sp.sentId} 없음`); continue; }
  const A0 = String(c.analysis || "");

  // 📌 줄에서 본문에 없는 인용을 찾는다
  const pinLines = A0.split("\n").filter((l) => l.includes("📌"));
  const bad = [];
  for (const line of pinLines)
    for (const m of line.matchAll(/"([^"]+)"/g)) {
      const qt = m[1];
      if (String(sent.t).includes(qt)) continue;          // 이미 맞음
      const r = carve(String(sent.t), qt);
      if (!r) continue;                                   // 이 문장 것이 아니다
      if (r.ambiguous) { miss.push(`${at} 인용이 본문에 2회 이상`); continue; }
      if (r.text === qt) continue;
      bad.push({ was: qt, now: r.text });
    }
  if (bad.length !== 1) { miss.push(`${at} — 고칠 인용이 ${bad.length}개다 (1개여야 한다)`); continue; }
  const { was, now } = bad[0];
  const n = A0.split(was).length - 1;
  if (n !== 1) { miss.push(`${at} — 옛 인용이 해설에 ${n}곳이다 (1곳이어야 한다)`); continue; }
  const A1 = A0.split(was).join(now);
  if (!String(sent.t).includes(now)) { miss.push(`${at} — 새 인용이 본문에 없다`); continue; }
  plans.push({ ...sp, c, A0, A1, was, now, sentText: String(sent.t) });

  console.log(`### \`${sp.sid}\` Q${sp.qid}#${sp.num} · \`${sp.sentId}\``);
  console.log("");
  console.log(`- 본문   ${JSON.stringify(sent.t)}`);
  console.log(`- 인용(현재) ${JSON.stringify(was)}`);
  console.log(`- 인용(정정) ${JSON.stringify(now)}   ← 본문에서 잘라냄`);
  console.log("");
}

if (miss.length) { console.log("## 🔴 사전 대조 실패 — 아무것도 쓰지 않는다"); console.log(""); miss.forEach((x) => console.log(`- ${x}`)); process.exit(1); }
if (plans.length !== SPEC.length) { console.log(`## 🔴 계획 ${plans.length} ≠ SPEC ${SPEC.length}`); process.exit(1); }
console.log(`✅ 사전 대조 통과 — ${plans.length}건, 새 인용 전건이 본문 부분 문자열`);
console.log("");
if (!APPLY) { console.log("### 미리보기 — 아무것도 쓰지 않았다. `--apply`"); process.exit(0); }

fs.writeFileSync(path.join(ROOT, "pipeline/backups/all_data_204.before_d190pin.json"), before);
const pre = JSON.parse(before.toString("utf8"));
for (const p of plans) p.c.analysis = p.A1;
fs.writeFileSync(DATA, JSON.stringify(data), "utf8");   // §13⑪

// ── 되읽기 검산 ─────────────────────────────────────────────────────────
const after = fs.readFileSync(DATA);
const fail = [];
if (after[0] === 0xef) fail.push("BOM");
let nl = 0; for (const x of after) if (x === 10) nl++;
if (nl !== 0) fail.push(`개행 ${nl}`);
const back = JSON.parse(after.toString("utf8"));

for (const p of plans) {
  const at = `${p.sid} Q${p.qid}#${p.num}`;
  const s2 = findSet(back, p.sid);
  const c2 = s2.questions.find((q) => q.id === p.qid).choices.find((x) => x.num === p.num);
  const got = String(c2.analysis);
  if (got.includes(p.was)) fail.push(`${at} 옛 인용 잔존`);
  if (!got.includes(p.now)) fail.push(`${at} 새 인용 미반영`);
  // 되돌리면 원문과 글자 그대로 같아야 한다 — 인용 한 곳 말고는 안 건드렸다는 증명
  if (got.split(p.now).join(p.was) !== p.A0) fail.push(`${at} **해설이 인용 밖에서 달라졌다**`);
  if (got.split(p.now).length - 1 !== 1) fail.push(`${at} 새 인용이 ${got.split(p.now).length - 1}곳이다`);
  const sent = (s2.sents || []).find((x) => String(x.id) === p.sentId);
  if (!String(sent.t).includes(p.now)) fail.push(`${at} 새 인용이 본문에 없다`);
}
// 그 밖은 전부 무변 — 제너릭 전체 트리 비교
const paths = [];
(function walk(a, b, pth) {
  if (a === b) return;
  if (typeof a !== typeof b || a === null || b === null || typeof a !== "object") { paths.push(pth); return; }
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) walk(a[k], b[k], pth ? `${pth}.${k}` : k);
})(pre, back, "");
if (paths.length !== SPEC.length) fail.push(`바뀐 경로가 ${paths.length}개다 — ${paths.slice(0, 6).join(" / ")}`);

console.log(`- 적용 후 MD5 \`${md5(after)}\` (${after.length - before.length >= 0 ? "+" : ""}${after.length - before.length}B)`);
console.log(`- 바뀐 경로 **${paths.length}개**`);
paths.forEach((x) => console.log(`  - \`${x}\``));
console.log("- 백업 `pipeline/backups/all_data_204.before_d190pin.json`");
console.log("");
if (fail.length) { console.log("## 🔴 되읽기 검산 실패 — 백업으로 되돌리십시오"); fail.forEach((x) => console.log(`- ${x}`)); process.exit(1); }
console.log("## ✅ 되읽기 검산 통과 (S-02)");
console.log("- 새 인용이 본문 부분 문자열 · 옛 인용 잔존 0");
console.log("- **해설이 인용 한 곳 말고는 한 글자도 안 달라졌다** (되돌림 대조)");
console.log("- 본문·선지·cs_ids·cs_spans·ok·pat 무변 (바뀐 경로가 analysis 2개뿐)");
