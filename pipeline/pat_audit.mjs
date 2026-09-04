// pat_audit.mjs — pat 분포 집계 + R1 표본 추출 (발주 D-103)
//
// **읽기 전용.** 데이터 파일을 수정하지 않는다.
//
// 배경: D-88 심사에서 pat 필드의 R1 쏠림이 관찰됐다. 쏠림이 실제 지문 특성인지
//       step3 프롬프트의 편향 산출인지 판별한다.
//
// 사용: node pipeline/pat_audit.mjs [--sample 50] [--seed 20260825]

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = path.join(ROOT, "data-source/all_data_204.json");
const STEP3 = path.join(ROOT, "pipeline/reextract/step3");
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const N = Number(arg("--sample", 50));
const SEED = Number(arg("--seed", 20260825));
// --zone new|old|all : 표본 모집단. 재추출분 R1 은 13건뿐이라 50건 추출이 불가능하다.
//   D-88 이 관찰한 쏠림은 기존 353세트(독서 오답의 41.2%)에 있다.
const ZONE = arg("--zone", "new");
// --dump : 표본의 검증 자료(선지·해설 결론·지문 근거)를 함께 출력
const DUMP = process.argv.includes("--dump");

// 재현 가능한 난수 (Math.random 은 매번 달라져 표본을 되짚을 수 없다)
let _s = SEED >>> 0;
const rnd = () => ((_s = (_s * 1664525 + 1013904223) >>> 0) / 4294967296);

const newKeys = new Set();
for (const d of fs.readdirSync(STEP3)) {
  const p = path.join(STEP3, d, "step4_result.json");
  if (!fs.existsSync(p)) continue;
  const j = JSON.parse(fs.readFileSync(p, "utf8"));
  for (const s of [...(j.reading || []), ...(j.literature || [])]) newKeys.add(`${d}::${s.id}`);
}

const data = JSON.parse(fs.readFileSync(DATA, "utf8"));
const rows = [];   // 재추출분 전체 선지
for (const [yk, v] of Object.entries(data))
  for (const sec of ["reading", "literature"])
    for (const s of v[sec] || []) {
      const zone = newKeys.has(`${yk}::${s.id}`) ? "new" : "old";
      if (ZONE !== "all" && zone !== ZONE) continue;
      for (const q of s.questions || [])
        for (const c of q.choices || [])
          rows.push({ zone, yk, sec, sid: s.id, qid: q.id, num: c.num, ok: c.ok, pat: c.pat ?? null,
            t: String(c.t ?? ""), analysis: String(c.analysis ?? ""), cs_ids: c.cs_ids || [],
            qt: String(q.t ?? ""), set: s });
    }

// ── 1. 분포 ──
const byPat = new Map(), byYkPat = new Map();
for (const r of rows) {
  const p = r.pat === null || r.pat === undefined ? "(null)" : String(r.pat);
  byPat.set(p, (byPat.get(p) || 0) + 1);
  const k = `${r.yk}|${p}`;
  byYkPat.set(k, (byYkPat.get(k) || 0) + 1);
}
console.log(`## pat 분포 — 재추출 ${newKeys.size}세트 · 선지 ${rows.length}\n`);
const sorted = [...byPat].sort((a, b) => b[1] - a[1]);
console.log(`| pat | 건수 | 비율 |`);
console.log(`|---|--:|--:|`);
for (const [p, n] of sorted) console.log(`| \`${p}\` | ${n} | ${(n / rows.length * 100).toFixed(1)}% |`);

// ok=false 선지만 (pat 은 오답 선지에 붙는 필드다)
const wrong = rows.filter((r) => r.ok === false);
const wrongPat = new Map();
for (const r of wrong) {
  const p = r.pat === null || r.pat === undefined ? "(null)" : String(r.pat);
  wrongPat.set(p, (wrongPat.get(p) || 0) + 1);
}
console.log(`\n## ok=false 선지만 — ${wrong.length}건\n`);
console.log(`| pat | 건수 | 비율 |`);
console.log(`|---|--:|--:|`);
for (const [p, n] of [...wrongPat].sort((a, b) => b[1] - a[1]))
  console.log(`| \`${p}\` | ${n} | ${(n / wrong.length * 100).toFixed(1)}% |`);

// ── 2. 회차별 ──
const yks = [...new Set(rows.map((r) => r.yk))].sort();
const pats = sorted.map(([p]) => p).filter((p) => p !== "(null)").slice(0, 8);
console.log(`\n## 회차별 분포 (ok=false 기준)\n`);
console.log(`| 회차 | 오답선지 | ${pats.map((p) => `\`${p}\``).join(" | ")} | (null) |`);
console.log(`|---|--:|${pats.map(() => "--:").join("|")}|--:|`);
for (const yk of yks) {
  const w = wrong.filter((r) => r.yk === yk);
  if (!w.length) continue;
  const cells = pats.map((p) => w.filter((r) => String(r.pat ?? "(null)") === p).length);
  const nulls = w.filter((r) => r.pat === null || r.pat === undefined).length;
  console.log(`| ${yk} | ${w.length} | ${cells.join(" | ")} | ${nulls} |`);
}

// ── 3. R1 표본 추출 (회차 고르게) ──
const r1 = wrong.filter((r) => String(r.pat) === "R1");
console.log(`\n## R1 표본 추출 — 모집단 ${r1.length}건 중 ${N}건\n`);
const byYk = new Map();
for (const r of r1) { if (!byYk.has(r.yk)) byYk.set(r.yk, []); byYk.get(r.yk).push(r); }
const order = [...byYk.keys()].sort();
// 회차별로 돌아가며 뽑아 고르게 분포시킨다
for (const k of order) {
  const a = byYk.get(k);
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
}
const pick = [];
for (let round = 0; pick.length < N; round++) {
  let added = 0;
  for (const k of order) {
    const a = byYk.get(k);
    if (round < a.length) { pick.push(a[round]); added++; if (pick.length >= N) break; }
  }
  if (!added) break;
}
console.log(`| # | 회차 | 세트 | 문항 | 선지 |`);
console.log(`|--:|---|---|--:|--:|`);
pick.forEach((r, i) => console.log(`| ${i + 1} | ${r.yk} | \`${r.sid}\` | ${r.qid} | ${r.num} |`));

// ── 4. 검증 자료 (판정에 필요한 것만 압축) ──
if (DUMP) {
  console.log("\n" + "=".repeat(74) + "\n## 검증 자료\n");
  pick.forEach((r, i) => {
    const sm = {};
    for (const x of r.set.sents || []) sm[x.id] = String(x.t ?? "");
    const a = r.analysis;
    const at = Math.max(a.lastIndexOf("✅"), a.lastIndexOf("❌"));
    const concl = at >= 0 ? a.slice(at, at + 110).replace(/\n/g, " ") : "(결론 표지 없음)";
    const qm = a.match(/[“”"]([^“”"\n]{10,})[“”"]/);
    const quote = qm ? qm[1] : "";
    console.log(`\n[${i + 1}] ${r.yk} ${r.sid} Q${r.qid}#${r.num}`);
    console.log(`  발문: ${r.qt.replace(/\n/g, " ").slice(0, 62)}`);
    console.log(`  선지: ${r.t.replace(/\n/g, " ").slice(0, 96)}`);
    console.log(`  근거: ${(quote || "(인용 없음)").slice(0, 96)}`);
    for (const id of (r.cs_ids || []).slice(0, 2))
      console.log(`  지문: ${String(sm[id] || "(문장 없음)").replace(/\n/g, " ").slice(0, 96)}`);
    console.log(`  결론: ${concl}`);
  });
}
fs.writeFileSync(path.join(ROOT, "pipeline/pat_sample50.json"),
  JSON.stringify(pick.map(({ set, ...rest }) => rest), null, 2), "utf8");
console.log(`\n표본 → pipeline/pat_sample50.json (seed ${SEED} — 같은 seed 로 재현 가능)`);
