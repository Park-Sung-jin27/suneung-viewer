/**
 * analysis_token_check.mjs — 해설 치환 토큰 붕괴 검사 (참고 도구)
 *
 * ★ 참고 도구(advisory)다. 관문이 아니다(§7-23).
 *   관문은 `node pipeline/quality_gate.mjs --scope=release` 하나뿐이며,
 *   이 도구의 산출은 "결함"이 아니라 "후보"로만 보고한다.
 *
 * [무엇을 잡는가]
 *   2026-06-15 'P0 정답 교정' 시리즈(#1~#6)가 해설을 재작성하면서 남긴
 *   치환 토큰 붕괴 — 한글 해설 안에 `사양`·`정합`·`path`·`안` 이 조사 없이
 *   박혀 문장이 끊긴 상태. 13선지가 두 달간 방치됐고 게이트 5종 어느 것도
 *   잡지 못했다(형식축만 보기 때문 — §7-7).
 *
 * [판정 기준식]
 *   R1  \bpath\b 가 한글과 인접        — path 는 한글 해설에 등장할 이유가 없다
 *   R2  치환 토큰끼리 조사 없이 인접
 *   R3  해설의 '사양'/'정합' 이 그 세트 원문(sents·bogi·발문·선지)에 없음
 *       → 정상 어휘(斜陽·정합성)는 지문에 근거가 있으므로 걸리지 않는다
 *       제외 ① '정합' 이 어절 시작이 아님 → 인정/보정/규정/조정 + 합니다
 *       제외 ② '정합' 뒤에 되/하/성/적   → 정합되다·정합하다·정합성·정합적
 *       제외 조건 미적용 시 오탐률 77.8%(9건 중 7건), 적용 후 0%.
 *
 * [사용]
 *   node pipeline/analysis_token_check.mjs            LIVE(RELEASE_KEYS) 스캔
 *   node pipeline/analysis_token_check.mjs --all      비노출 포함 전수
 *   node pipeline/analysis_token_check.mjs --regress  양성 회귀(fixture 보존 원문)
 *
 * ★ --regress 는 fixture 의 "재작성 전 원문"으로 돌린다. 현행 데이터로 돌리면
 *   대상이 고쳐진 만큼 검출이 떨어져 '매처 고장'과 구분되지 않는다(발주 do 실증).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ARGS = process.argv.slice(2);
const ALL = ARGS.includes("--all");
const REGRESS = ARGS.includes("--regress");

const R1 = /\bpath\b\s*[가-힣]|[가-힣]\s*\bpath\b/g;
const R2 = /(?:사양|정합|사실)\s+(?:사양|정합|path)|(?:사양|path)\s+안(?![가-힣])|path\s+정합/g;

export function tokensNoBase(analysis, origin) {
  const a = String(analysis || "");
  const out = [];
  for (const m of a.matchAll(/사양|정합/g)) {
    const t = m[0];
    if (origin.includes(t)) continue;
    if (t === "정합") {
      if (/[가-힣]/.test(a[m.index - 1] || " ")) continue;          // 제외 ①
      if (/^[되하성적]/.test(a.slice(m.index + 2))) continue;        // 제외 ②
    }
    out.push(t);
  }
  return [...new Set(out)];
}

export function setOrigin(set) {
  const p = [(set.sents || []).map((x) => x.t || "").join(" ")];
  for (const q of set.questions || []) {
    p.push(String(q.t || ""));
    p.push(typeof q.bogi === "string" ? q.bogi : q.bogi ? JSON.stringify(q.bogi) : "");
    for (const c of q.choices || []) p.push(String(c.t || ""));
  }
  return p.join(" ");
}

/** 한 선지의 붕괴 신호. 빈 배열이면 후보 아님. */
export function judge(analysis, origin) {
  const a = String(analysis || "");
  const sig = [];
  const m1 = a.match(R1); if (m1) sig.push(`R1:${m1.length}`);
  const m2 = a.match(R2); if (m2) sig.push(`R2:${m2.length}`);
  const nb = tokensNoBase(a, origin); if (nb.length) sig.push(`R3:${nb.join("·")}`);
  return sig;
}

const D = JSON.parse(fs.readFileSync(path.join(ROOT, "data-source/all_data_204.json"), "utf8"));
const dl = fs.readFileSync(path.join(ROOT, "src/dataLoader.js"), "utf8");
const RK = new Set([...dl.match(/const RELEASE_KEYS = new Set\(\[([\s\S]*?)\]\)/)[1]
  .matchAll(/"([^"]+)"/g)].map((m) => m[1]));
const findSet = (yk, sid) => {
  for (const g of ["reading", "literature"]) for (const s of (D[yk] || {})[g] || []) if (s.id === sid) return s;
};

// ─── 양성 회귀 ────────────────────────────────────────────────
if (REGRESS) {
  const FX = JSON.parse(fs.readFileSync(path.join(ROOT, "pipeline/fixtures/analysis_token_corruption.json"), "utf8"));
  console.log(`양성 회귀 — fixture 보존 원문 ${FX.cases.length}건 (재작성 전 상태)\n`);
  let ok = 0;
  const ng = [];
  for (const c of FX.cases) {
    const [yk, sid] = c.set.split("::");
    const s = findSet(yk, sid);
    if (!s) { ng.push(`${c.set} 세트없음`); continue; }
    const sig = judge(c.analysis, setOrigin(s));
    if (sig.length) { ok++; console.log(`  ✅  ${c.set} Q${c.qid}c${c.num}  [${sig.join(" ")}]`); }
    else ng.push(`${c.set} Q${c.qid}c${c.num}`);
  }
  console.log(`\n검출 ${ok}/${FX.cases.length}`);
  if (ng.length) {
    console.log(`★ 미검출: ${ng.join(", ")}`);
    console.log('회귀 실패 — 매처가 기지 케이스를 놓친다. "0건" 을 신뢰하지 말 것(§13⑮(7)).');
    process.exit(1);
  }
  console.log('회귀 통과 — 이후의 "0건" 판정은 유효합니다.');
  process.exit(0);
}

// ─── 스캔 ────────────────────────────────────────────────────
const rows = [];
let scanned = 0;
for (const yk of Object.keys(D)) for (const g of ["reading", "literature"]) for (const s of (D[yk] || {})[g] || []) {
  const key = `${yk}::${s.id}`;
  const live = RK.has(key);
  if (!ALL && !live) continue;
  const origin = setOrigin(s);
  for (const q of s.questions || []) for (const c of q.choices || []) {
    const a = String(c.analysis || "");
    if (!a) continue;
    scanned++;
    const sig = judge(a, origin);
    if (!sig.length) continue;
    const at = a.search(/\bpath\b|사양|정합/);
    rows.push({ key, live, qid: q.id, num: c.num, sig: sig.join(" "),
      ctx: a.slice(Math.max(0, at - 40), at + 40).replace(/\n/g, "⏎") });
  }
}
console.log(`검사 스코프: ${ALL ? "전수" : "LIVE(RELEASE_KEYS)"} · 해설 보유 선지 ${scanned}개`);
console.log(`판정: R1(path 인접) · R2(토큰 2-gram) · R3(세트 무근거, 제외 조건 2개 적용)\n`);
if (!rows.length) {
  console.log("■ 후보 0선지");
  console.log("\n※ 참고 도구입니다. 이 결과는 결함 확정이 아니라 후보 목록입니다(§7-23).");
  console.log('※ "0건" 은 --regress 통과 후에만 유효합니다.');
} else {
  console.log(`■ 후보 ${rows.length}선지 / ${new Set(rows.map((r) => r.key)).size}세트`);
  for (const r of rows) console.log(`  ${r.live ? "🔴LIVE " : "  비노출 "}${r.key} Q${r.qid}c${r.num}  [${r.sig}]\n        «${r.ctx}»`);
  console.log("\n※ 후보이지 결함 확정이 아닙니다. 원문 대조로 확정하십시오(§7-23).");
}
