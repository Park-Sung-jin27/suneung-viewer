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
import os from "node:os";
import { checkSetMarkers } from "./marker_anchor_check.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "data-source/all_data_204.json");
const APPLY = process.argv.includes("--apply");
const STAMP = "20260822-D93";
const BAK = path.join(ROOT, `data-source/all_data_204.backup.${STAMP}.json`);
const STEP3 = path.join(ROOT, "pipeline/reextract/step3");

const sh = (args, opts = {}) =>
  execFileSync("node", args, { cwd: ROOT, maxBuffer: 256 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"], ...opts }).toString();

// ── 분리 게이트 (발주 2026-08-24 [채택]) ──
//   loc 파싱으로 귀속을 판정하던 방식을 폐기한다.
//   폐기 이유: setId 는 **회차 안에서만 유일**하다(dataLoader.js:91 — A/B형 분리
//   노출을 위해 yearKey::setId 복합키로 다룬다). 기존 353세트도 29종이 회차 간
//   중복이라, loc 문자열에서 세트 id 만 뽑아 귀속시키는 방식은 구조적으로 불가능하다.
//   실제로 판정기가 3연속 틀렸다(130.5% → 3.3% → 0.0%, 진실 113%).
//
//   대신 **기존만 / 신규만 / 병합본** 세 벌을 각각 게이트에 넣어 수를 직접 뺀다.
//   파싱이 없으므로 틀릴 여지가 없다.
//     기존 변동 = 병합본.CRITICAL − 기존만.CRITICAL − 신규만.CRITICAL   (0 이어야 함)
//     신규 위반율 = 신규만.CRITICAL / 신규 선지 수
const TMP = path.join(os.tmpdir(), "merge_reextract_gate.json");
function gateOf(label, dataObj) {
  fs.writeFileSync(TMP, JSON.stringify(dataObj), "utf8");
  const args = [path.join(ROOT, "pipeline/quality_gate.mjs"), "--report", `--data=${TMP}`];
  try { sh(args); } catch { /* release_blocked 는 비정상 종료가 아니다 */ }
  const rep = JSON.parse(fs.readFileSync(path.join(ROOT, "pipeline/quality_report.json"), "utf8"));
  const byType = new Map();
  for (const it of rep.critical || []) byType.set(it.type, (byType.get(it.type) || 0) + 1);
  return { label, total: (rep.issues || []).length, critical: (rep.critical || []).length, byType };
}
// 원본 구조는 유지하되 지정한 세트만 남긴 사본
function subset(data, keep) {
  const out = {};
  for (const [yk, v] of Object.entries(data)) {
    out[yk] = { ...v };
    for (const sec of ["reading", "literature"])
      if (v[sec]) out[yk][sec] = v[sec].filter((s) => keep(yk, s));
  }
  return out;
}

const log = [];
const say = (s) => { console.log(s); log.push(s); };

// ── 1. 사전 확인 ──
say(`## 병합 ${APPLY ? "적용" : "DRY-RUN"} — 재추출 산출물\n`);
const ONLY = (() => { const i = process.argv.indexOf("--only"); return i > 0 ? process.argv[i + 1] : null; })();
const PROBE = process.argv.includes("--probe");   // 병합 → 게이트 판정 → **무조건 원복** (검증용)
// step4(cs_ids)가 돌아간 회차는 step4_result 를 쓴다. 없으면 step3_result.
const pick = (d) => {
  const p4 = path.join(STEP3, d, "step4_result.json");
  return fs.existsSync(p4) ? p4 : path.join(STEP3, d, "step3_result.json");
};
const rounds = fs.readdirSync(STEP3)
  .filter((d) => fs.existsSync(path.join(STEP3, d, "step3_result.json")))
  .filter((d) => !ONLY || d === ONLY);
say(`### 1. 사전 확인 — 회차 ${rounds.length}${ONLY ? ` (--only ${ONLY})` : ""}${PROBE ? " · PROBE(끝나면 원복)" : ""}`);
for (const d of rounds) say(`   ${d}: ${path.basename(pick(d))}`);

const excluded = [];      // 부분 병합: 제외된 세트
const incoming = [];      // {yk, sec, set}
for (const yk of rounds) {
  const j = JSON.parse(fs.readFileSync(pick(yk), "utf8"));
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
const g0 = gateOf("기존만", data);
say(`  게이트 위반 ${g0.total} (CRITICAL ${g0.critical})`);
const oldCount = before.sets;

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

// ── 6. 분리 게이트 판정 ──
const newQ = incoming.reduce((a, x) => a + (x.set.questions || []).length, 0);
const newChoices = incoming.reduce((a, x) => a + (x.set.questions || []).flatMap((q) => q.choices || []).length, 0);
const newKeys = new Set(incoming.map(({ yk, set }) => `${yk}::${set.id}`));

const gN = gateOf("신규만", subset(data, (yk, s) => newKeys.has(`${yk}::${s.id}`)));
const gM = gateOf("병합본", data);

// 🔴 판정 기준은 CRITICAL 로 고정한다(발주 D-93 후속 ④). W_ 경고는 참고 지표.
const STOP_RATE = 15;
const drift = gM.critical - g0.critical - gN.critical;      // 상호작용 = 기존 변동
const driftAll = gM.total - g0.total - gN.total;
const rate = newChoices ? gN.critical / newChoices * 100 : 0;
const baseRate = before.ch ? g0.critical / before.ch * 100 : 0;

say(`
### 6. 분리 게이트 판정 (loc 파싱 없음)`);
say(`  기존만  세트 ${before.sets} · 선지 ${before.ch} → CRITICAL ${g0.critical} (전체 ${g0.total})`);
say(`  신규만  세트 ${incoming.length} · 선지 ${newChoices} → CRITICAL ${gN.critical} (전체 ${gN.total})`);
say(`  병합본  세트 ${after.sets} · 선지 ${after.ch} → CRITICAL ${gM.critical} (전체 ${gM.total})`);
say(`  기존 변동 = ${gM.critical} − ${g0.critical} − ${gN.critical} = **${drift}** ${drift === 0 ? "✅" : "🔴"}  (전체 기준 ${driftAll})`);
say(`  신규 CRITICAL 위반율 **${rate.toFixed(1)}%** (기존 ${baseRate.toFixed(1)}% · 정지선 ${STOP_RATE}%) ${rate > STOP_RATE ? "🔴" : "✅"}`);
say(`
  신규 CRITICAL 위반 코드별:`);
for (const [t, n] of [...gN.byType].sort((a, b) => b[1] - a[1])) say(`     ${t.padEnd(30)} ${n}`);
say(`  기존 CRITICAL 위반 코드별(대조):`);
for (const [t, n] of [...g0.byType].sort((a, b) => b[1] - a[1]).slice(0, 8)) say(`     ${t.padEnd(30)} ${n}`);

const revert = (why) => {
  fs.writeFileSync(SRC, fs.readFileSync(BAK, "utf8"), "utf8");
  say(`\n🔴 정지·원복 — ${why}`);
  fs.writeFileSync(path.join(ROOT, "docs/merge_log_D93.txt"), log.join("\n"), "utf8");
  process.exit(1);
};
if (drift !== 0) revert(`기존 세트 위반이 변했다 — CRITICAL 상호작용 ${drift}건 (허용 0)`);
if (rate > STOP_RATE) revert(`신규 CRITICAL 위반율 ${rate.toFixed(1)}% > 정지선 ${STOP_RATE}%`);

if (PROBE) {
  fs.writeFileSync(SRC, fs.readFileSync(BAK, "utf8"), "utf8");
  say(`
### PROBE — 판정만 하고 원복했다.`);
  fs.writeFileSync(path.join(ROOT, "docs/merge_log_D93.txt"), log.join("\n"), "utf8");
  process.exit(0);
}
say(`\n✅ 귀속 판정 통과`);
fs.writeFileSync(path.join(ROOT, "docs/merge_log_D93.txt"), log.join("\n"), "utf8");
say(`\n다음: npm run build (build:split --verify · free/pro 241 유지 확인)`);
