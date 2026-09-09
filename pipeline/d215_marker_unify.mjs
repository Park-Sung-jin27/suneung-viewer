// d215_marker_unify.mjs — <보기> 기반 문항 ok=true 선지 표지 통일 (발주 D-215 ⓑ)
//
// Q8·Q21·Q24·Q31·Q34 는 <보기>를 판단 기준으로 삼는 문항인데, ok=true 선지의
// 표지가 「✅ 지문과 일치하는 적절한 진술」로 되어 있었다. 판단 기준이 지문인
// 문항용 표기다. <보기> 문항의 정본 표기로 바꾼다.
//
// ★ 정본 근거 — 「✅ 보기 조건과 지문이 일치하는 적절한 진술」은 코퍼스 542건이고
//   그중 513건이 <보기> 문항이다(94.6%). 반대로 「✅ 지문과 일치하는 적절한 진술」은
//   2466건 중 <보기> 문항이 446건뿐이다.
//
// ★ 바꾸는 것은 **마지막 표지 줄 하나**다. 📌 인용·[풀이] 본문·ok·pat·cs_ids·
//   cs_spans 전부 불가침.
//
// ★ ok=false 5건은 손대지 않는다 — <보기> 전용 ❌ 정본 표기가 ✅ 쪽처럼 뚜렷하지
//   않고(최다가 「❌ 지문과 어긋나는 부적절한 진술」 165건, <보기> 전용은
//   「❌ 보기를 잘못 적용한 부적절한 감상」 11건뿐), 현행 5건은 이미 [pat] 태그를
//   달고 있어 정보가 더 많다. 심사관 판정 대기(발주 「먼저 보고」).
//
// 사용: node pipeline/d215_marker_unify.mjs [--apply]

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = path.join(ROOT, "data-source/all_data_204.json");
const APPLY = process.argv.includes("--apply");
const md5 = (s) => crypto.createHash("md5").update(s).digest("hex");

const YK = "2027_9월";
const QIDS = [8, 21, 24, 31, 34];
const NEW = "✅ 보기 조건과 지문이 일치하는 적절한 진술";
const OLD = "✅ 지문과 일치하는 적절한 진술";

const raw = fs.readFileSync(DATA, "utf8");
const j = JSON.parse(raw);

console.log("# <보기> 문항 ok=true 표지 통일 (D-215 ⓑ)");
console.log("");
console.log(`- \`data-source/all_data_204.json\` 적용 전 MD5 \`${md5(raw)}\``);
console.log("");

const fail = [], plans = [], already = [], skipped = [];
for (const s of [...(j[YK].reading || []), ...(j[YK].literature || [])]) {
  const sid = s.setId || s.id;
  for (const q of s.questions || []) {
    if (!QIDS.includes(q.id)) continue;
    const bt = typeof q.bogi === "string" ? q.bogi : (q.bogi?.text || "");
    // ★ 정말 <보기> 기반 문항인가 — 발문에 <보기> 가 있고 bogi 가 실재해야 한다
    if (!/<보기>|〈보기〉/.test(String(q.t)) || !String(bt).trim()) { skipped.push(`${sid} Q${q.id} — <보기> 문항이 아니다`); continue; }
    for (const c of q.choices || []) {
      if (c.ok !== true) { skipped.push(`${sid} Q${q.id}#${c.num} — ok=${c.ok}(범위 밖)`); continue; }
      const a = String(c.analysis || "");
      const lines = a.split("\n");
      const li = lines.length - 1 - [...lines].reverse().findIndex((x) => x.trim());
      const tail = lines[li].trim();
      if (tail === NEW) { already.push(`${sid} Q${q.id}#${c.num}`); continue; }
      if (tail !== OLD) { fail.push(`${sid} Q${q.id}#${c.num} 표지가 예상 밖이다: ${tail.slice(0, 40)}`); continue; }
      plans.push({ sid, qId: q.id, num: c.num, c, li, lines, before: a });
    }
  }
}

console.log("| 세트 | Q | 선지 | 현행 표지 → 새 표지 |");
console.log("|---|--:|--:|---|");
for (const p of plans) console.log(`| \`${p.sid}\` | ${p.qId} | ${p.num} | ${OLD} → **${NEW}** |`);
console.log("");
if (already.length) console.log(`- 이미 새 표지: ${already.join(" · ")} (${already.length}건)`);
console.log(`- 범위 밖(ok=false 등): ${skipped.length}건`);
console.log("");

if (plans.length + already.length !== 20) fail.push(`ok=true 대상이 ${plans.length + already.length}건 — 20건이어야 한다`);
if (fail.length) { console.log("## 🔴 사전 검사 실패 — 아무것도 쓰지 않는다"); fail.forEach((x) => console.log(`- ${x}`)); process.exit(1); }
console.log(`✅ 사전 검사 통과 — 변경 ${plans.length}건 (이미 통일 ${already.length}건 포함해 ok=true 20건)`);
console.log("");
if (!APPLY) { console.log("### 미리보기 — 아무것도 쓰지 않았다. `--apply`"); process.exit(0); }

// ── 적용 ─────────────────────────────────────────────────────────────────
fs.writeFileSync(path.join(ROOT, "pipeline/backups/all_data_204.json.before_d215b"), raw, "utf8");
for (const p of plans) {
  const L = [...p.lines];
  L[p.li] = L[p.li].replace(OLD, NEW);
  p.c.analysis = L.join("\n");
}
fs.writeFileSync(DATA, JSON.stringify(j), "utf8");   // §13⑪ minified 유지

// ── 되읽기 검산 ─────────────────────────────────────────────────────────
const raw2 = fs.readFileSync(DATA, "utf8");
const j2 = JSON.parse(raw2);
const bad = [];
const find2 = (sid, qId, num) => {
  const s = [...(j2[YK].reading || []), ...(j2[YK].literature || [])].find((x) => (x.setId || x.id) === sid);
  return s.questions.find((x) => x.id === qId).choices.find((x) => x.num === num);
};
for (const p of plans) {
  const c2 = find2(p.sid, p.qId, p.num);
  if (!c2.analysis.trim().endsWith(NEW)) bad.push(`${p.sid} Q${p.qId}#${p.num} 표지가 안 바뀌었다`);
  // ★ 표지 줄 말고는 글자 하나 안 바뀌었는가
  if (c2.analysis.replace(NEW, OLD) !== p.before) bad.push(`🔴 ${p.sid} Q${p.qId}#${p.num} 표지 외에 달라진 곳이 있다`);
  if (c2.ok !== true || c2.pat !== null) bad.push(`${p.sid} Q${p.qId}#${p.num} ok/pat 이 바뀌었다`);
}
// ★ 역방향 바이트 일치
const j3 = JSON.parse(raw2);
for (const p of plans) {
  const s = [...(j3[YK].reading || []), ...(j3[YK].literature || [])].find((x) => (x.setId || x.id) === p.sid);
  const c3 = s.questions.find((x) => x.id === p.qId).choices.find((x) => x.num === p.num);
  c3.analysis = p.before;
}
if (JSON.stringify(j3) !== JSON.stringify(JSON.parse(raw)))
  bad.push("🔴 역방향 바이트 일치 실패 — 지정 표지 외에 달라진 곳이 있다");

console.log(`- 적용 후 MD5 \`${md5(raw2)}\` (${raw2.length - raw.length}B)`);
console.log("- 백업 `pipeline/backups/all_data_204.json.before_d215b`");
console.log("");
if (bad.length) { console.log("## 🔴 되읽기 검산 실패 — 백업으로 되돌리십시오"); bad.forEach((x) => console.log(`- ${x}`)); process.exit(1); }
console.log("## ✅ 되읽기 검산 통과 (S-02)");
console.log(`- 표지 ${plans.length}건 통일 · 📌 인용·[풀이]·ok·pat·cs_ids·cs_spans 무변 · 역방향 바이트 일치`);
console.log("- ok=false 5건은 열지도 쓰지도 않았다 (심사관 판정 대기)");
