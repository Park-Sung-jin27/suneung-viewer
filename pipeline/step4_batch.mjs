// step4_batch.mjs — 잔여 회차 step4(cs_ids) 전개 (발주 D-93 후속 ③)
//
// 회차 완결 = step4 실행 → cs_ids 보유율 확인.
// 실패 회차는 보류하고 다음으로. 예산 가드 초과 시 즉시 정지.
// 재개: step4_result.json 이 있으면 건너뛴다.
//
// 사용: node pipeline/step4_batch.mjs [--budget 20]
// 금지: all_data 병합.

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const STEP3 = path.join(ROOT, "pipeline/reextract/step3");
const USAGE = path.join(ROOT, "pipeline/reextract/api_usage.jsonl");
const STATE = path.join(ROOT, "pipeline/reextract/step4_state.json");
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const BUDGET = Number(arg("--budget", "20"));

// step3 배치와 같은 노출 우선 순서
const ORDER = ["2015_9월B", "2020_9월", "2014_9월A", "2016_9월B", "2022_9월",
  "2014_6월A", "2014_6월B", "2015_6월B", "2014_9월B", "2019_9월",
  "2015_9월A", "2017_6월", "2016_9월A", "2016_6월A", "2020_6월",
  "2021_9월", "2018_9월", "2017_9월"];

const spend = () => {
  if (!fs.existsSync(USAGE)) return 0;
  let i = 0, o = 0;
  for (const line of fs.readFileSync(USAGE, "utf8").trim().split("\n")) {
    if (!line) continue;
    try { const r = JSON.parse(line); if (r.stage === "step4") { i += r.in || 0; o += r.out || 0; } } catch { /* skip */ }
  }
  return i / 1e6 * 3 + o / 1e6 * 15;
};

const state = fs.existsSync(STATE) ? JSON.parse(fs.readFileSync(STATE, "utf8")) : { rounds: {} };
const save = () => fs.writeFileSync(STATE, JSON.stringify(state, null, 2), "utf8");

console.log(`## step4(cs_ids) 전개 — 예산 한도 $${BUDGET}`);
console.log(`  시작 시점 step4 누적 $${spend().toFixed(2)}\n`);

for (const yk of ORDER) {
  const dir = path.join(STEP3, yk);
  const p3 = path.join(dir, "step3_result.json"), p4 = path.join(dir, "step4_result.json");
  if (!fs.existsSync(p3)) { console.log(`  ${yk}: step3 결과 없음 — 건너뜀`); continue; }
  if (fs.existsSync(p4)) { console.log(`  ${yk}: 이미 완료 — 건너뜀`); continue; }

  const cur = spend();
  if (cur > BUDGET) { console.log(`\n🔴 [정지] 예산 초과 — step4 누적 $${cur.toFixed(2)} > $${BUDGET}`); break; }

  const t0 = Date.now(), s0 = cur;
  process.stdout.write(`  ${yk}: step4…`);
  try {
    execFileSync("node", [path.join(ROOT, "pipeline/step4_csids.js"), p3],
      { cwd: ROOT, maxBuffer: 256 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] });
  } catch (e) {
    state.rounds[yk] = { status: "보류", why: String(e.stderr || e.message).slice(0, 180) };
    save(); console.log(` 🔴 실패`); continue;
  }
  if (!fs.existsSync(p4)) {
    state.rounds[yk] = { status: "보류", why: "step4_result.json 미생성" };
    save(); console.log(` 🔴 산출물 없음`); continue;
  }
  const j = JSON.parse(fs.readFileSync(p4, "utf8"));
  const ch = [...(j.reading || []), ...(j.literature || [])]
    .flatMap((s) => (s.questions || []).flatMap((q) => q.choices || []));
  const has = ch.filter((c) => c.cs_ids !== undefined).length;
  const filled = ch.filter((c) => Array.isArray(c.cs_ids) && c.cs_ids.length).length;
  const mins = ((Date.now() - t0) / 60000).toFixed(0), cost = (spend() - s0).toFixed(2);
  state.rounds[yk] = { status: "완료", 선지: ch.length, cs_ids보유: has, 채워짐: filled, 분: Number(mins), 실비: Number(cost) };
  save();
  console.log(` ✅ cs_ids ${has}/${ch.length} (채워짐 ${filled}) · ${mins}분 · $${cost}`);
}

const rs = Object.entries(state.rounds);
console.log(`\n## 현황 — 완료 ${rs.filter(([, v]) => v.status === "완료").length} · 보류 ${rs.filter(([, v]) => v.status === "보류").length}`);
console.log(`  step4 누적 실비 $${spend().toFixed(2)} / 한도 $${BUDGET}`);
for (const [k, v] of rs)
  console.log(`  ${k.padEnd(11)} ${v.status === "완료" ? `✅ ${v.cs_ids보유}/${v.선지} · ${v.분}분 · $${v.실비}` : `🔴 ${v.why}`}`);
