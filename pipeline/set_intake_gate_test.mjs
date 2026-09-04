// set_intake_gate_test.mjs — 세트 탑재 검사 회귀 (발주 D-199 ①)
//
// 게이트를 만들 때 가장 위험한 것은 「아무것도 못 잡는 게이트」다. 통과만 보고
// 안심하게 되기 때문이다. 그래서 두 방향을 함께 시험한다.
//   양성 — 결함이 있는 입력에서 축별로 정확한 건수가 나오는가
//   음성 — 정상 세트에서 FAIL 0 인가 (검사 A 오탐 재발 방지)
//
// 사용: node pipeline/set_intake_gate_test.mjs

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const GATE = path.join(ROOT, "pipeline/set_intake_gate.mjs");
const TMP = path.join(ROOT, "pipeline/fixtures/.set_intake_tmp");
const FX = JSON.parse(fs.readFileSync(path.join(ROOT, "pipeline/fixtures/set_intake_defects.json"), "utf8"));

fs.mkdirSync(TMP, { recursive: true });
const dataPath = path.join(TMP, "fixtures_data.json");
const annPath = path.join(TMP, "fixtures_ann.json");
fs.writeFileSync(dataPath, JSON.stringify({ _fx_year: FX._fixture }, null, 1), "utf8");
fs.writeFileSync(annPath, JSON.stringify(FX._annotations, null, 1), "utf8");

const run = (args) => {
  try { return execFileSync("node", [GATE, ...args], { encoding: "utf8" }); }
  catch (e) { return String(e.stdout || "") + String(e.stderr || ""); }
};

console.log("# 세트 탑재 검사 회귀 (D-199)");
console.log("");

// ── 양성 — fixture ──────────────────────────────────────────────────────
const out = run(["--data", dataPath, "--ann", annPath, "_fx_year::_fx_intake"]);
const got = {};
for (const line of out.split("\n")) {
  const m = line.match(/^\|\s*(\S+)\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|$/);
  if (m) got[m[1]] = Number(m[2]);
}
console.log("## 양성 — 결함 fixture");
console.log("");
console.log("| 축 | 기대 FAIL | 실제 FAIL | |");
console.log("|---|--:|--:|---|");
let bad = 0;
for (const [ax, want] of Object.entries(FX._expect)) {
  const have = got[ax] ?? 0;
  if (have !== want) bad++;
  console.log(`| ${ax} | ${want} | ${have} | ${have === want ? "✅" : "🔴"} |`);
}
console.log("");

// ── 음성 — 정상 세트 (검사 A 오탐이 났던 그 세트) ───────────────────────
console.log("## 음성 — 정상 세트에서 FAIL 0");
console.log("");
console.log("| 세트 | 결과 | |");
console.log("|---|---|---|");
for (const key of ["2027_6월::l20276a", "2027_9월::l20279b"]) {
  const o = run([key]);
  const m = o.match(/🔴 FAIL (\d+)건/);
  const n = m ? Number(m[1]) : 0;
  if (n !== 0) bad++;
  console.log(`| \`${key}\` | FAIL ${n} | ${n === 0 ? "✅" : "🔴"} |`);
}
console.log("");
fs.rmSync(TMP, { recursive: true, force: true });
if (bad) { console.log(`## 🔴 회귀 실패 ${bad}건 — 게이트를 신뢰할 수 없다`); process.exit(1); }
console.log("## ✅ 회귀 통과 — 결함은 잡고 정상은 통과시킨다");
