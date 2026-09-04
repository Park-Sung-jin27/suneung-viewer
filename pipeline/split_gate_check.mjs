// split_gate_check.mjs — 병합 완료 후 분리 게이트 재확인 (발주 D-100 ③)
//
// merge_reextract.mjs 는 **병합 전** all_data 를 전제로 한다(다시 돌리면 중복 병합).
// 병합이 끝난 뒤에는 이 도구로 같은 판정만 다시 낸다 — 데이터는 건드리지 않는다.
//   기존만 / 신규만 / 병합본 세 벌을 각각 게이트에 넣어 수를 직접 뺀다.
//   기존 변동 = 병합본 − 기존만 − 신규만  (0 이어야 한다)
//
// 사용: node pipeline/split_gate_check.mjs

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = path.join(ROOT, "data-source/all_data_204.json");
const STEP3 = path.join(ROOT, "pipeline/reextract/step3");

// 신규 43세트 복합키
const newKeys = new Set();
for (const d of fs.readdirSync(STEP3)) {
  const p = path.join(STEP3, d, "step4_result.json");
  if (!fs.existsSync(p)) continue;
  const j = JSON.parse(fs.readFileSync(p, "utf8"));
  for (const s of [...(j.reading || []), ...(j.literature || [])]) newKeys.add(`${d}::${s.id}`);
}

const data = JSON.parse(fs.readFileSync(DATA, "utf8"));
const subset = (keep) => {
  const out = {};
  for (const [yk, v] of Object.entries(data)) {
    out[yk] = { ...v };
    for (const sec of ["reading", "literature"])
      if (v[sec]) out[yk][sec] = v[sec].filter((s) => keep(yk, s));
  }
  return out;
};
const count = (d) => {
  let sets = 0, ch = 0;
  for (const v of Object.values(d))
    for (const sec of ["reading", "literature"])
      for (const s of v[sec] || []) { sets++; for (const q of s.questions || []) ch += (q.choices || []).length; }
  return { sets, ch };
};
function gate(label, obj) {
  const tmp = path.join(os.tmpdir(), `sgc_${label}.json`);
  fs.writeFileSync(tmp, JSON.stringify(obj), "utf8");
  try {
    execFileSync("node", [path.join(ROOT, "pipeline/quality_gate.mjs"), "--report", `--data=${tmp}`],
      { cwd: ROOT, maxBuffer: 256 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] });
  } catch { /* release_blocked 는 비정상 종료가 아니다 */ }
  const rep = JSON.parse(fs.readFileSync(path.join(ROOT, "pipeline/quality_report.json"), "utf8"));
  const byType = new Map();
  for (const it of rep.critical || []) byType.set(it.type, (byType.get(it.type) || 0) + 1);
  const c = count(obj);
  return { label, sets: c.sets, ch: c.ch, total: (rep.issues || []).length, critical: (rep.critical || []).length, byType };
}

const isNew = (yk, s) => newKeys.has(`${yk}::${s.id}`);
const g0 = gate("old", subset((yk, s) => !isNew(yk, s)));
const gN = gate("new", subset(isNew));
const gM = gate("merged", data);

const drift = gM.critical - g0.critical - gN.critical;
const rate = gN.ch ? gN.critical / gN.ch * 100 : 0;
const base = g0.ch ? g0.critical / g0.ch * 100 : 0;

console.log(`## 분리 게이트 재확인 (병합 후, 읽기 전용)\n`);
console.log(`  기존만  세트 ${g0.sets} · 선지 ${g0.ch} → CRITICAL ${g0.critical} (전체 ${g0.total})`);
console.log(`  신규만  세트 ${gN.sets} · 선지 ${gN.ch} → CRITICAL ${gN.critical} (전체 ${gN.total})`);
console.log(`  병합본  세트 ${gM.sets} · 선지 ${gM.ch} → CRITICAL ${gM.critical} (전체 ${gM.total})`);
console.log(`\n  기존 변동 = ${gM.critical} − ${g0.critical} − ${gN.critical} = **${drift}** ${drift === 0 ? "✅" : "🔴"}`);
console.log(`  신규 CRITICAL 위반율 **${rate.toFixed(1)}%** (기존 ${base.toFixed(1)}%)`);
if (gN.byType.size) {
  console.log(`\n  신규 CRITICAL 코드별:`);
  for (const [t, n] of [...gN.byType].sort((a, b) => b[1] - a[1])) console.log(`     ${t.padEnd(30)} ${n}`);
}
process.exit(drift === 0 ? 0 : 1);
