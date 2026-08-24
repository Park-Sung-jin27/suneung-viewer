// merge_reextract.mjs — 재추출 산출물 병합 (발주 D-93)
//
// 확정된 3결정 (심사관)
//   ① 게이트는 **귀속** 으로 본다.
//      · 기존 353세트 위반 변동 = **정확히 0**. 1건이라도 변하면 즉시 정지·원복.
//      · 신규 세트 위반은 개수 무제한 허용(비노출이라 학생 무영향). 회차별 목록만 보고.
//      · 정지선: 신규 위반율 > 기존 평균의 2배(15%) 이면 정지·보고.
//   ② 부분 병합 허용 — 병합 직전 재검사에서 걸린 세트만 빼고 진행. 제외 목록 보고.
//   ③ 데이터는 한 커밋(revert 한 번으로 원복). 커밋은 데이터/도구/문서 3분할.
//
// 기본은 dry-run. --apply 를 줘야 실제로 쓴다.
// 사용: node pipeline/merge_reextract.mjs [--apply]

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { checkSetMarkers } from "./marker_anchor_check.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "public/data/all_data_204.json");
const APPLY = process.argv.includes("--apply");
const STAMP = "20260822-D93";
const BAK = path.join(ROOT, `public/data/all_data_204.backup.${STAMP}.json`);
const STEP3 = path.join(ROOT, "pipeline/reextract/step3");

const sh = (args, opts = {}) =>
  execFileSync("node", args, { cwd: ROOT, maxBuffer: 256 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"], ...opts }).toString();

// 게이트 리포트를 세트 단위로 집계 — loc 예: "2026수능 r2026a Q1-[1]"
function gateBySet(dataPath) {
  const args = [path.join(ROOT, "pipeline/quality_gate.mjs"), "--report"];
  if (dataPath) args.push(`--data=${dataPath}`);
  try { sh(args); } catch { /* release_blocked 는 비정상 종료가 아니다 */ }
  const rep = JSON.parse(fs.readFileSync(path.join(ROOT, "pipeline/quality_report.json"), "utf8"));
  const bySet = new Map();
  let total = 0;
  for (const it of rep.issues || []) {
    total++;
    const m = String(it.loc || "").match(/^(\S+)\s+(\S+)/);
    const key = m ? `${m[1]}::${m[2]}` : `${it.yearKey}::?`;
    bySet.set(key, (bySet.get(key) || 0) + 1);
  }
  return { bySet, total, critical: (rep.critical || []).length };
}

const log = [];
const say = (s) => { console.log(s); log.push(s); };

// ── 1. 사전 확인 ──
say(`## 병합 ${APPLY ? "적용" : "DRY-RUN"} — 재추출 산출물\n`);
const rounds = fs.readdirSync(STEP3).filter((d) => fs.existsSync(path.join(STEP3, d, "step3_result.json")));
say(`### 1. 사전 확인 — 회차 ${rounds.length}`);

const excluded = [];      // 부분 병합: 제외된 세트
const incoming = [];      // {yk, sec, set}
for (const yk of rounds) {
  const j = JSON.parse(fs.readFileSync(path.join(STEP3, yk, "step3_result.json"), "utf8"));
  const key = JSON.parse(fs.readFileSync(path.join(STEP3, yk, "answer_key.json"), "utf8"));
  for (const sec of ["reading", "literature"])
    for (const s of j[sec] || []) {
      const why = [];
      // 마커 정합성
      const mk = checkSetMarkers(s);
      if (mk.length) why.push(`마커 미정박 ${mk.map((m) => `Q${m.qid}:${m.missing.join("")}`).join(" ")}`);
      // 정답 대조
      for (const q of s.questions || []) {
        const neg = /않은|아닌|없는|적절하지/.test(String(q.t || ""));
        const hits = (q.choices || []).filter((c) => c.ok === !neg).map((c) => c.num);
        if (!(hits.length === 1 && hits[0] === key[String(q.id)]))
          why.push(`Q${q.id} 정답 불일치(공식 ${key[String(q.id)]} / 도출 ${hits.join("/") || "-"})`);
      }
      // 해설 유무
      const noAna = (s.questions || []).flatMap((q) => q.choices || []).filter((c) => !c.analysis).length;
      if (noAna) why.push(`해설 없는 선지 ${noAna}개`);
      if (why.length) { excluded.push({ yk, setId: s.id, why: why.join(" · ") }); continue; }
      incoming.push({ yk, sec, set: s });
    }
}
say(`  병합 대상 ${incoming.length}세트 · 제외 ${excluded.length}세트`);
for (const e of excluded) say(`   🔴 제외 ${e.yk}::${e.setId} — ${e.why}`);
if (!incoming.length) { say("\n🔴 병합할 세트가 없다."); process.exit(1); }

// ── 2. id 충돌 ──
const raw = fs.readFileSync(SRC, "utf8");
const data = JSON.parse(raw);
const coll = incoming.filter(({ yk, set }) =>
  ["reading", "literature"].some((sec) => (data[yk][sec] || []).some((x) => x.id === set.id)));
say(`\n### 2. id 충돌 — ${coll.length}건 ${coll.length ? "🔴" : "✅"}`);
if (coll.length) { for (const c of coll) say(`   🔴 ${c.yk}::${c.set.id}`); say("\n🔴 정지 — id 충돌"); process.exit(1); }

// ── 3. 병합 전 계수·게이트 ──
const count = (d) => {
  let sets = 0, qs = 0, ch = 0;
  for (const yk of Object.keys(d)) for (const sec of ["reading", "literature"]) for (const s of d[yk][sec] || []) {
    sets++; for (const q of s.questions || []) { qs++; ch += (q.choices || []).length; }
  }
  return { sets, qs, ch };
};
const before = count(data);
say(`\n### 3. 병합 전 — 세트 ${before.sets} · 문항 ${before.qs} · 선지 ${before.ch}`);
const g0 = gateBySet(null);
say(`  게이트 위반 ${g0.total} (CRITICAL ${g0.critical})`);
const oldKeys = new Set();
for (const yk of Object.keys(data)) for (const sec of ["reading", "literature"]) for (const s of data[yk][sec] || []) oldKeys.add(`${yk}::${s.id}`);

if (!APPLY) {
  say(`\n### DRY-RUN 종료 — 아무것도 쓰지 않았다.`);
  say(`  적용하려면 --apply`);
  process.exit(0);
}

// ── 4. 백업 ──
if (!fs.existsSync(BAK)) fs.writeFileSync(BAK, raw, "utf8");
const md5 = (p) => execFileSync("md5sum", [p]).toString().split(/\s+/)[0];
const [m1, m2] = [md5(SRC), md5(BAK)];
say(`\n### 4. 백업 — ${path.basename(BAK)}`);
say(`  md5 원본 ${m1} / 백업 ${m2} ${m1 === m2 ? "✅" : "🔴"}`);
if (m1 !== m2) { say("🔴 정지 — 백업 불일치"); process.exit(1); }

// ── 5. 병합 (append) ──
for (const { yk, sec, set } of incoming) (data[yk][sec] ??= []).push(set);
const after = count(data);
say(`\n### 5. 병합 후 계수`);
say(`  세트 ${before.sets} → ${after.sets} (+${after.sets - before.sets})`);
say(`  문항 ${before.qs} → ${after.qs} (+${after.qs - before.qs})`);
say(`  선지 ${before.ch} → ${after.ch} (+${after.ch - before.ch})`);
if (after.sets - before.sets !== incoming.length) { say("🔴 정지 — 세트 증가분 불일치"); process.exit(1); }
fs.writeFileSync(SRC, JSON.stringify(data), "utf8");
say(`  쓰기 완료 ${(fs.statSync(SRC).size / 1048576).toFixed(2)}MB`);

// ── 6. 귀속 판정 ──
const g1 = gateBySet(null);
let movedOld = 0; const moved = [];
for (const k of oldKeys) {
  const a = g0.bySet.get(k) || 0, b = g1.bySet.get(k) || 0;
  if (a !== b) { movedOld++; if (moved.length < 10) moved.push(`${k}: ${a}→${b}`); }
}
const newViol = {};
let newTotal = 0;
for (const { yk, set } of incoming) {
  const n = g1.bySet.get(`${yk}::${set.id}`) || 0;
  newTotal += n;
  if (n) (newViol[yk] ??= []).push(`${set.id}:${n}`);
}
const newQ = incoming.reduce((a, x) => a + (x.set.questions || []).length, 0);
const newChoices = incoming.reduce((a, x) => a + (x.set.questions || []).flatMap((q) => q.choices || []).length, 0);
const rate = newTotal / newChoices * 100;
const baseRate = g0.total / before.ch * 100;

say(`\n### 6. 귀속 판정`);
say(`  기존 ${oldKeys.size}세트 위반 변동: **${movedOld}건** ${movedOld === 0 ? "✅" : "🔴"}`);
for (const m of moved) say(`     ${m}`);
say(`  신규 ${incoming.length}세트 위반: ${newTotal}건 · 위반율 ${rate.toFixed(1)}% (기존 평균 ${baseRate.toFixed(1)}%)`);
for (const [yk, list] of Object.entries(newViol)) say(`     ${yk}: ${list.join(" ")}`);
say(`  전체 위반 ${g0.total} → ${g1.total} (CRITICAL ${g0.critical} → ${g1.critical})`);

const revert = (why) => {
  fs.writeFileSync(SRC, fs.readFileSync(BAK, "utf8"), "utf8");
  say(`\n🔴 정지·원복 — ${why}`);
  fs.writeFileSync(path.join(ROOT, "docs/merge_log_D93.txt"), log.join("\n"), "utf8");
  process.exit(1);
};
if (movedOld !== 0) revert(`기존 세트 위반이 ${movedOld}건 변했다 (허용 0)`);
if (rate > baseRate * 2) revert(`신규 위반율 ${rate.toFixed(1)}% > 기존 평균의 2배 (${(baseRate * 2).toFixed(1)}%)`);

say(`\n✅ 귀속 판정 통과`);
fs.writeFileSync(path.join(ROOT, "docs/merge_log_D93.txt"), log.join("\n"), "utf8");
say(`\n다음: npm run build (build:split --verify · free/pro 241 유지 확인)`);
