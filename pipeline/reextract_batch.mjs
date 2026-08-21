// reextract_batch.mjs — 잔여 회차 step3 전개 (발주 D-89 2단계)
//
// 회차 하나의 완결 = step3 → answer_key 대조 → 꼬리코드 후처리 → 후처리 검산
// 하나라도 실패하면 **그 회차만 보류**하고 다음으로 간다(전체 중단 아님).
//
// 예산 가드: 누적 실비가 한도를 넘으면 즉시 정지한다.
//   회차당 $1.9 가 예상치다. 넘으면 뭔가 다른 것이므로 사람이 봐야 한다.
//
// 재개: step3_result.json 이 이미 있으면 그 회차는 건너뛴다.
//
// 사용: node pipeline/reextract_batch.mjs [--limit N] [--budget 30]
// 금지: all_data 병합. RELEASE_KEYS 변경.

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const LIMIT = Number(arg("--limit", "99"));
const BUDGET = Number(arg("--budget", "30"));
const STATE = path.join(ROOT, "pipeline/reextract/batch_state.json");
const USAGE = path.join(ROOT, "pipeline/reextract/api_usage.jsonl");

// 노출 우선 순서 (D-87 순서 그대로). 2016_6월B 는 파일럿에서 완료.
const ORDER = [
  "2015_9월B", "2020_9월", "2014_9월A", "2016_9월B", "2022_9월",
  "2014_6월A", "2014_6월B", "2015_6월B", "2014_9월B", "2019_9월",
  "2015_9월A", "2017_6월", "2016_9월A", "2016_6월A", "2020_6월",
  "2021_9월", "2018_9월", "2017_9월",
];

const spend = () => {
  if (!fs.existsSync(USAGE)) return 0;
  let i = 0, o = 0;
  for (const line of fs.readFileSync(USAGE, "utf8").trim().split("\n")) {
    if (!line) continue;
    try { const r = JSON.parse(line); i += r.in || 0; o += r.out || 0; } catch { /* 깨진 줄 무시 */ }
  }
  return i / 1e6 * 3 + o / 1e6 * 15;   // Sonnet 4.5 $3/$15 per 1M
};

const run = (args, label) => {
  try {
    execFileSync("node", args, { cwd: ROOT, maxBuffer: 256 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] });
    return { ok: true };
  } catch (e) {
    return { ok: false, why: `${label}: ${String(e.stderr || e.message).slice(0, 180)}` };
  }
};

// answer_key 대조
function checkAnswers(yk) {
  const f = path.join(ROOT, `pipeline/reextract/step3/${yk}/step3_result.json`);
  const key = JSON.parse(fs.readFileSync(path.join(ROOT, `pipeline/reextract/step3/${yk}/answer_key.json`), "utf8"));
  const r = JSON.parse(fs.readFileSync(f, "utf8"));
  let ok = 0, ng = 0; const bad = [];
  for (const s of [...(r.reading || []), ...(r.literature || [])])
    for (const q of s.questions || []) {
      const neg = /않은|아닌|없는|적절하지/.test(String(q.t || ""));
      const hits = (q.choices || []).filter((c) => c.ok === !neg).map((c) => c.num);
      if (hits.length === 1 && hits[0] === key[String(q.id)]) ok++;
      else { ng++; bad.push(`Q${q.id}(공식=${key[String(q.id)]} 도출=${hits.join("/") || "-"})`); }
    }
  return { ok, ng, bad };
}

const state = fs.existsSync(STATE) ? JSON.parse(fs.readFileSync(STATE, "utf8")) : { rounds: {} };
const save = () => fs.writeFileSync(STATE, JSON.stringify(state, null, 2), "utf8");

console.log(`## 잔여 회차 step3 전개 — 예산 한도 $${BUDGET}`);
console.log(`  시작 시점 누적 실비 $${spend().toFixed(2)}\n`);

let done = 0;
for (const yk of ORDER) {
  if (done >= LIMIT) { console.log(`\n[정지] --limit ${LIMIT} 도달`); break; }
  const cur = spend();
  if (cur > BUDGET) { console.log(`\n🔴 [정지] 예산 초과 — 누적 $${cur.toFixed(2)} > 한도 $${BUDGET}`); break; }

  const dir = path.join(ROOT, `pipeline/reextract/step3/${yk}`);
  if (fs.existsSync(path.join(dir, "step3_result.json"))) { console.log(`  ${yk}: 이미 완료 — 건너뜀`); continue; }

  const t0 = Date.now(), s0 = cur;
  process.stdout.write(`  ${yk}: 준비…`);
  let r = run([path.join(ROOT, "pipeline/reextract_step3.mjs"), yk, "literature"], "입력준비");
  if (!r.ok) { state.rounds[yk] = { status: "보류", why: r.why }; save(); console.log(` 🔴 ${r.why}`); continue; }

  process.stdout.write(` step3…`);
  r = run([path.join(ROOT, "pipeline/step3_analysis.js"),
    path.join(dir, "step2_result.json"), path.join(dir, "answer_key.json")], "step3");
  if (!r.ok) { state.rounds[yk] = { status: "보류", why: r.why }; save(); console.log(` 🔴 ${r.why}`); continue; }

  const ans = checkAnswers(yk);
  process.stdout.write(` 정답 ${ans.ok}/${ans.ok + ans.ng}`);
  if (ans.ng > 0) {
    state.rounds[yk] = { status: "보류", why: `answer_key 불일치 ${ans.ng}건: ${ans.bad.slice(0, 4).join(" ")}` };
    save(); console.log(` 🔴 불일치 ${ans.ng}건`); continue;
  }

  process.stdout.write(` 후처리…`);
  r = run([path.join(ROOT, "pipeline/reextract_postprocess.mjs"), yk, "--apply"], "후처리");
  if (!r.ok) { state.rounds[yk] = { status: "보류", why: r.why }; save(); console.log(` 🔴 ${r.why}`); continue; }

  const mins = ((Date.now() - t0) / 60000).toFixed(0), cost = (spend() - s0).toFixed(2);
  state.rounds[yk] = { status: "완료", 문항: ans.ok, 분: Number(mins), 실비: Number(cost) };
  save();
  console.log(` ✅ ${ans.ok}/${ans.ok} · ${mins}분 · $${cost}`);
  done++;
}

const rs = Object.entries(state.rounds);
console.log(`\n## 현황 — 완료 ${rs.filter(([, v]) => v.status === "완료").length} · 보류 ${rs.filter(([, v]) => v.status === "보류").length}`);
console.log(`  누적 실비 $${spend().toFixed(2)}`);
for (const [k, v] of rs)
  console.log(`  ${k.padEnd(11)} ${v.status === "완료" ? `✅ ${v.문항}문항 · ${v.분}분 · $${v.실비}` : `🔴 ${v.why}`}`);
