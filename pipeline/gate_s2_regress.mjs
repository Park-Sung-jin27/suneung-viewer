/**
 * gate_s2_regress.mjs — haesol_v2 §2 인용 대조 축의 사각 수리 회귀 (참고 도구)
 *
 * 사각 4종(S1 따옴표 짝 · S2 운문 ' / ' · S3 choice.t · S4 q.t)이
 * 수리 후 FAIL 에서 빠지는지(양성), 진짜 실패는 계속 잡히는지(음성) 확인한다.
 *
 * ★ fixture 의 보존 원문으로만 돌린다. 현행 데이터로 돌리면 데이터가 고쳐진 만큼
 *   검출이 떨어져 '게이트 고장'과 구분되지 않는다(§7-29 초안, 발주 do·dp 실증).
 *
 * 사용: node pipeline/gate_s2_regress.mjs
 * exit 0 = 양성·음성 전건 통과
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { s2QuoteMiss } from "./haesol_v2_gate.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FX = JSON.parse(fs.readFileSync(path.join(ROOT, "pipeline/fixtures/gate_quote_pairing.json"), "utf8"));
const RC = FX.repair_cases;
if (!RC) { console.log("★ fixture 에 repair_cases 없음"); process.exit(1); }

/** fixture 케이스 → §2 FAIL 로 남는 인용 목록 */
const missOf = (c) => s2QuoteMiss(c.analysis, {
  sents: c.sents, bogi: c.bogi, qt: c.qt, choices: c.choices,
});

let fail = 0;
console.log("■ 양성 — 사각이므로 수리 후 FAIL 이 되면 안 된다\n");
for (const k of ["S1_quote_pairing", "S2_verse_slash", "S3_choice_text", "S4_question_text"]) {
  const spec = RC[k];
  if (!spec) continue;
  const miss = missOf(spec.positive);
  const ok = miss.length === 0;
  if (!ok) fail++;
  console.log(`  ${ok ? "✅" : "🔴"} ${k.padEnd(20)} ${spec.count}건  ${spec.positive.set} Q${spec.positive.qid}c${spec.positive.num}`);
  if (!ok) for (const m of miss) console.log(`        잔존 FAIL: «${m.slice(0, 56)}»`);
}

console.log("\n■ 음성 대조 — 진짜 실패이므로 수리 후에도 FAIL 로 잡혀야 한다\n");
for (const c of RC.negative_must_still_fail.cases) {
  const miss = missOf(c);
  const ok = miss.length > 0;
  if (!ok) fail++;
  console.log(`  ${ok ? "✅" : "🔴 놓침"} ${c.set} Q${c.qid}c${c.num}  FAIL ${miss.length}건`);
  for (const m of miss.slice(0, 2)) console.log(`        «${m.slice(0, 56)}»`);
  if (!ok) console.log(`        ${c.why}`);
}

console.log(`\n${fail ? `★ 회귀 실패 ${fail}건 — 수리가 사각을 못 없앴거나 게이트를 무디게 만들었다` : "회귀 전건 통과 — 사각 제거 · 진짜 실패 검출 유지"}`);
process.exit(fail ? 1 : 0);
