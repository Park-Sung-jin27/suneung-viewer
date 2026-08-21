// delegation_verify.mjs — 위임 산출물 검수 러너 (발주 D-87 ②)
//
// 코덱스가 만든 JSON 을 한 번에 검사한다.
//   ① 스키마     — 필수 필드 · 금지 필드(ok/pat/analysis/cs_ids) · 타입
//   ② 짝 검사    — 지문↔문항이 같은 지시문 구간인가 (pair_gate 와 같은 판정식)
//   ③ 앵커 대조  — sents·choices 가 원본에 실재하는가 (-layout / -raw 병용)
//   ④ 커버리지   — 요청한 문항이 다 있는가 · 정답키에 그 번호가 있는가
//
// 전부 통과해야 「병합 후보」다. 하나라도 실패하면
// **코덱스에 그대로 붙여넣을 수 있는 재작업 요청 문구**를 출력한다.
//
// 사용: node pipeline/delegation_verify.mjs <yearKey> [section]
// 종료코드: 실패가 있으면 1
// 금지: 데이터 수정·병합. (읽기 전용이다)

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { hard } from "./anchor.mjs";
import { scanSetRanges, pdfText } from "./set_ranges.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const yk = process.argv[2];
const section = process.argv[3] || "literature";
if (!yk) { console.error("사용법: node pipeline/delegation_verify.mjs <yearKey> [section]"); process.exit(1); }

const file = path.join(ROOT, `pipeline/reextract/${yk}_${section}.json`);
if (!fs.existsSync(file)) {
  console.error(`🔴 산출물이 없다: ${path.relative(ROOT, file)}`);
  console.error(`   코덱스 결과를 그 경로에 UTF-8 로 저장한 뒤 다시 돌린다.`);
  process.exit(1);
}
let res;
try { res = JSON.parse(fs.readFileSync(file, "utf8")); }
catch (e) {
  console.error(`🔴 JSON 이 깨졌다: ${e.message}`);
  console.error(`\n──── 코덱스에 보낼 문구 ────\n저장한 JSON 파일이 파싱되지 않습니다: ${e.message}\n` +
    `순수 JSON 만, 코드블록/설명 없이 다시 주세요. 문자열 안의 큰따옴표는 \\" 로 이스케이프해 주세요.`);
  process.exit(1);
}

const sets = [...(res.reading || []), ...(res.literature || [])];
const dir = path.join(ROOT, "_done", yk);
const pdfPath = path.join(dir, fs.readdirSync(dir).find((f) => f.endsWith(".pdf") && f.includes("시험지")));
const lay = pdfText(pdfPath, true), raw = pdfText(pdfPath, false);
const H1 = hard(lay), H2 = hard(raw);
const inSrc = (t, min = 12) => {
  const h = hard(t);
  if (h.length < min) return null;
  const p = h.slice(0, Math.min(h.length, 30));
  return H1.includes(p) || H2.includes(p);
};

const problems = [];   // 코덱스에 돌려줄 문구용
const say = (s) => problems.push(s);

// ── ① 스키마 ──
const BAN = ["ok", "pat", "analysis", "cs_ids", "cs_spans"];
let schemaBad = 0;
for (const s of sets) {
  const where = `세트 ${s.id ?? "(id 없음)"}`;
  if (!s.id) { schemaBad++; say(`${where}: \`id\` 가 없습니다.`); }
  if (!Array.isArray(s.sents) || !s.sents.length) { schemaBad++; say(`${where}: \`sents\` 가 비었습니다.`); }
  if (!Array.isArray(s.questions) || !s.questions.length) { schemaBad++; say(`${where}: \`questions\` 가 비었습니다.`); }
  for (const t of s.sents || []) {
    if (!t.id || typeof t.t !== "string") { schemaBad++; say(`${where}: sents 항목에 \`id\` 또는 \`t\` 가 없습니다.`); break; }
  }
  for (const q of s.questions || []) {
    if (typeof q.id !== "number") { schemaBad++; say(`${where} Q${q.id}: 문항 \`id\` 는 숫자여야 합니다.`); }
    if (typeof q.t !== "string" || !q.t) { schemaBad++; say(`${where} Q${q.id}: 발문 \`t\` 가 없습니다.`); }
    const ch = q.choices || [];
    if (ch.length !== 5) { schemaBad++; say(`${where} Q${q.id}: 선지가 ${ch.length}개입니다. 5개여야 합니다.`); }
    for (const c of ch) {
      if (typeof c.num !== "number" || typeof c.t !== "string") { schemaBad++; say(`${where} Q${q.id}: 선지에 \`num\`(숫자) 또는 \`t\`(문자열) 가 없습니다.`); break; }
      for (const b of BAN) if (b in c) { schemaBad++; say(`${where} Q${q.id} 선지${c.num}: \`${b}\` 를 넣으면 안 됩니다. 그 필드는 다음 단계가 채웁니다.`); break; }
    }
  }
}

// ── ② 짝 검사 ──
const marks = [...raw.matchAll(/\[\s*(\d{1,2})\s*[~～∼]\s*(\d{1,2})\s*\]/g)]
  .map((m) => ({ from: +m[1], to: +m[2], at: m.index })).sort((a, b) => a.at - b.at);
const zones = new Map();
for (const m of marks) {
  const k = `${m.from}-${m.to}`;
  if (!zones.has(k)) zones.set(k, { start: m.at });
}
for (const [k, z] of zones) {
  const next = marks.find((m) => m.at > z.start && `${m.from}-${m.to}` !== k);
  z.end = next ? next.at : raw.length;
  z.hs = hard(raw.slice(0, z.start)).length;
  z.he = hard(raw.slice(0, z.end)).length;
}
let pairBad = 0;
for (const s of sets) {
  const qs = (s.questions || []).map((q) => Number(q.id)).filter(Number.isFinite).sort((a, b) => a - b);
  if (!qs.length) continue;
  const k = `${qs[0]}-${qs[qs.length - 1]}`;
  const z = zones.get(k);
  if (!z) continue;
  const cands = (s.sents || []).filter((t) => !["workTag", "author", "footnote"].includes(t.sentType))
    .map((t) => hard(t.t || "")).filter((h) => h.length >= 20).slice(0, 5);
  let inZ = 0, outZ = 0, other = null;
  for (const h of cands) {
    const at = H2.indexOf(h.slice(0, 30));
    if (at < 0) continue;
    if (at >= z.hs && at < z.he) inZ++;
    else { outZ++; if (!other) { const o = [...zones.entries()].find(([, v]) => at >= v.hs && at < v.he); other = o ? `[${o[0].replace("-", "~")}]` : "(구간 밖)"; } }
  }
  if (outZ > inZ) {
    pairBad++;
    say(`세트 ${s.id}: 문항은 [${qs[0]}~${qs[qs.length - 1]}] 인데 지문이 ${other} 의 것입니다. ` +
      `**같은 지시문 아래의 지문**으로 다시 묶어 주세요.`);
  }
}

// ── ③ 앵커 대조 ──
let anchorBad = 0;
const badSample = [];
for (const s of sets) {
  for (const t of s.sents || []) {
    const r = inSrc(t.t);
    if (r === false) { anchorBad++; if (badSample.length < 5) badSample.push([`${s.id}/${t.id}`, String(t.t).slice(0, 40)]); }
  }
  for (const q of s.questions || [])
    for (const c of q.choices || []) {
      const r = inSrc(c.t);
      if (r === false) { anchorBad++; if (badSample.length < 5) badSample.push([`${s.id}/Q${q.id}#${c.num}`, String(c.t).slice(0, 40)]); }
    }
}
if (anchorBad) {
  say(`원본에서 찾을 수 없는 문장·선지가 ${anchorBad}건 있습니다. 지어내지 말고 원문 그대로 옮겨 주세요. ` +
    `예: ${badSample.map(([k, v]) => `${k} "${v}…"`).join(" / ")}`);
}

// ── ④ 커버리지 ──
const have = new Set();
const dataAll = JSON.parse(fs.readFileSync(path.join(ROOT, "public/data/all_data_204.json"), "utf8"));
for (const sec of ["reading", "literature"])
  for (const s of dataAll[yk][sec] || []) for (const q of s.questions || []) have.add(Number(q.id));
const isNew = Number(yk.slice(0, 4)) >= 2022;
const wanted = scanSetRanges(pdfPath, { min: 1, max: 45 })
  .filter((r) => r.kind === "set" && (isNew ? r.to <= 34 : r.from >= 16))
  .filter((r) => { for (let n = r.from; n <= r.to; n++) if (have.has(n)) return false; return true; })
  .flatMap((r) => { const a = []; for (let n = r.from; n <= r.to; n++) a.push(n); return a; });
const got = new Set(sets.flatMap((s) => (s.questions || []).map((q) => Number(q.id))));
const missing = wanted.filter((n) => !got.has(n));
const extra = [...got].filter((n) => !wanted.includes(n));
if (missing.length) say(`요청한 문항 중 ${missing.length}개가 빠졌습니다: ${missing.join(", ")}. 빠짐없이 넣어 주세요.`);
if (extra.length) say(`요청하지 않은 문항이 들어왔습니다: ${extra.join(", ")}. 지시문의 표에 있는 번호만 넣어 주세요.`);

const key = JSON.parse(fs.readFileSync(path.join(ROOT, "pipeline/answer_key.json"), "utf8"))[yk]?.ans || {};
const noKey = [...got].filter((n) => key[String(n)] == null);

// ── 보고 ──
const fail = schemaBad + pairBad + anchorBad + missing.length + extra.length;
console.log(`## 위임 산출물 검수 — ${yk} / ${section}`);
console.log(`  세트 ${sets.length}개 · 문항 ${got.size}개`);
console.log(`  ① 스키마    ${schemaBad ? `🔴 ${schemaBad}건` : "✅ 통과"}`);
console.log(`  ② 짝 검사    ${pairBad ? `🔴 ${pairBad}세트` : "✅ 통과"}`);
console.log(`  ③ 앵커 대조  ${anchorBad ? `🔴 ${anchorBad}건` : "✅ 통과"}`);
console.log(`  ④ 커버리지   ${missing.length || extra.length ? `🔴 빠짐 ${missing.length} · 초과 ${extra.length}` : `✅ ${wanted.length}/${wanted.length}`}`);
console.log(`  정답키       ${noKey.length ? `⚠ ${noKey.length}문항 정답 없음 (${noKey.join(",")})` : "✅ 전건 보유"}`);

if (fail === 0) {
  console.log(`\n✅ 병합 후보 — 4개 검사 전부 통과. 다음은 step3(정답·해설) 단계다.`);
  process.exit(0);
}
console.log(`\n🔴 병합 불가 — 아래를 코덱스에 그대로 보낸다.`);
console.log(`\n──── 코덱스에 보낼 문구 (여기부터 복사) ────`);
console.log(`${yk} 전사 결과를 검사했더니 아래 문제가 있었습니다. 고쳐서 다시 주세요.\n`);
problems.forEach((p, i) => console.log(`${i + 1}. ${p}`));
console.log(`\n나머지 규칙은 처음 드린 INSTRUCTIONS.md 와 SCHEMA.md 그대로입니다.`);
console.log(`──── 여기까지 ────`);
process.exit(1);
