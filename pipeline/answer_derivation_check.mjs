/**
 * answer_derivation_check.mjs — 발문 · questionType · ok 3자 정합 검사 (참고 도구)
 *
 * ★ 참고 도구(advisory)다. 관문이 아니다(§7-23).
 *   관문은 `node pipeline/quality_gate.mjs --scope=release` 하나뿐이며,
 *   이 도구의 산출은 "결함"이 아니라 "후보"로만 보고한다.
 *
 * [왜 필요한가]
 *   src/App.jsx:1369 가 정답표를 두지 않고 ok × questionType 조합에서 정답을 유도한다.
 *     const qt = q.questionType ?? "negative";
 *     qt === "positive" ? c.ok === true : c.ok === false
 *   둘 중 하나만 틀려도 화면이 틀린 정답을 표시한다.
 *   실증: 2022수능 r2022c Q10 — 부정 발문인데 positive 로 선언돼 선지 4개가 정답 표시됐다.
 *   게이트 5종 어느 것도 이 조합을 보지 않는다.
 *
 * [축]
 *   A  발문 부정어구 ↔ questionType 정합
 *   B  questionType 기준 정답 유도가 정확히 1개인가
 *   C  정답 선지의 pat 이 null 인가 (AGENTS.md §9 — ok 와 pat 의 정합)
 *
 * [사용]
 *   node pipeline/answer_derivation_check.mjs            LIVE(RELEASE_KEYS)
 *   node pipeline/answer_derivation_check.mjs --all      비노출 포함 전수
 *   node pipeline/answer_derivation_check.mjs --regress  양성 회귀
 *
 * ★ 축 A 결과로 questionType 을 자동 교정하지 않는다. 후보 목록까지만.
 *   부정어구 목록이 완전하지 않아 오탐이 난다(실측 — 초기 목록으로 7건 중 5건 오탐).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ARGS = process.argv.slice(2);
const ALL = ARGS.includes("--all");
const REGRESS = ARGS.includes("--regress");

/** 부정 발문 어구 — dw-2 에서 확립한 목록. 이 목록에 걸리면 부정, 그 외 긍정.
 *  [발주 ef 사양1] 확장 — 확장 전 목록은 "…하지 않은/않는" 어간을 개별 나열하는 방식이라
 *  "옳지 않은 것은", "사용되지 않은 것은" 같은 흔한 형태를 놓쳤다(전수 축A 후보 8건 전부).
 *  "않은 것은"/"않는 것은" 을 어간 무관 형태로 추가해 그 계열을 일괄 포섭한다. */
export const NEG_PATTERNS = [
  "적절하지 않은", "일치하지 않는", "부합하지 않는", "해당하지 않는",
  "볼 수 없는", "찾을 수 없는", "확인할 수 없는", "보기 어려운",
  "아닌 것은", "거리가 먼",
  // ── 발주 ef 사양1 추가분 ──
  "않은 것은", "않는 것은", "옳지 않", "바르지 않", "적절하지 못", "알 수 없는",
];
const NEG_RE = new RegExp(NEG_PATTERNS.map((p) => p.replace(/ /g, "\\s*")).join("|"));

export const isNegativeQuestion = (qText) => NEG_RE.test(String(qText || ""));

/** 한 문항의 3축 판정. 빈 배열이면 후보 아님. */
export function judgeQuestion(q) {
  const out = [];
  const qt = String(q.t || "");
  const declared = q.questionType ?? null;
  const effective = declared ?? "negative";          // App.jsx:1369 기본값
  // 축 A
  const expect = isNegativeQuestion(qt) ? "negative" : "positive";
  if (effective !== expect)
    out.push({ axis: "A", msg: `발문은 ${expect === "negative" ? "부정" : "긍정"}인데 questionType=${JSON.stringify(declared)}` });
  // 축 B
  const ans = (q.choices || []).filter((c) => effective === "positive" ? c.ok === true : c.ok === false);
  if (ans.length !== 1)
    out.push({ axis: "B", msg: `정답 유도 ${ans.length}개 (${effective})${ans.length ? " → " + ans.map((c) => c.num).join(",") : ""}` });
  // 축 C — pat 은 "지문과 불일치(ok=false)" 선지의 오류 유형이다.
  //   ★ "정답 선지의 pat=null" 이 아니다. 부정 발문에서는 정답이 ok=false 이고
  //     거기에 pat 이 붙는 것이 정상이다(초기 판정식이 이를 오해해 704건 오탐).
  //   §9 정합: ok=true → pat 은 null / ok=false → pat 이 있어야 한다.
  for (const c of q.choices || []) {
    if (c.ok === true && c.pat != null)
      out.push({ axis: "C", msg: `선지 ${c.num}번 ok=true 인데 pat=${JSON.stringify(c.pat)} (일치 선지는 null)` });
  }
  return out;
}

const D = JSON.parse(fs.readFileSync(path.join(ROOT, "data-source/all_data_204.json"), "utf8"));
const dl = fs.readFileSync(path.join(ROOT, "src/dataLoader.js"), "utf8");
const RK = new Set([...dl.match(/const RELEASE_KEYS = new Set\(\[([\s\S]*?)\]\)/)[1]
  .matchAll(/"([^"]+)"/g)].map((m) => m[1]));
const findQ = (yk, sid, qid) => {
  for (const g of ["reading", "literature"]) for (const s of (D[yk] || {})[g] || []) if (s.id === sid)
    return (s.questions || []).find((x) => Number(x.id) === Number(qid));
};

// ─── 양성 회귀 ────────────────────────────────────────────────
if (REGRESS) {
  // 수정 전 상태를 재현해 검증한다(현행 데이터는 고쳐졌을 수 있다 — §7-29 초안).
  const FIXTURES = [
    { name: "r2022c Q10 — 부정 발문에 positive", yk: "2022수능", sid: "r2022c", qid: 10,
      mutate: (q) => ({ ...q, questionType: "positive" }), axis: "A" },
    // 발주 ee 에서 questionType 이 positive 로 고쳐졌다. 회귀는 수정 전 상태를 재현한다.
    { name: "r2025b Q7 — 긍정 발문에 negative", yk: "2025수능", sid: "r2025b", qid: 7,
      mutate: (q) => ({ ...q, questionType: "negative" }), axis: "A" },
    // [발주 ef 사양1] 확장 어구 회귀 — "…사용되지 않은 것은"(부정)을 positive 로 선언한 상태.
    //   확장 전 목록으로는 이 발문을 긍정으로 읽어 축 A 가 울리지 않았다.
    { name: "l20169a Q21 — '사용되지 않은 것은'(부정)에 positive", yk: "2016_9월A", sid: "l20169a", qid: 21,
      mutate: (q) => ({ ...q, questionType: "positive" }), axis: "A" },
  ];
  console.log("양성 회귀 — 발문·questionType 불일치 기지 3건\n");
  let ok = 0;
  for (const f of FIXTURES) {
    const q0 = findQ(f.yk, f.sid, f.qid);
    if (!q0) { console.log(`  🔴 ${f.name} — 문항 미발견`); continue; }
    const hits = judgeQuestion(f.mutate(q0));
    const hit = hits.some((h) => h.axis === f.axis);
    console.log(`  ${hit ? "✅" : "🔴"}  ${f.name}`);
    for (const h of hits) console.log(`        [축 ${h.axis}] ${h.msg}`);
    if (hit) ok++;
  }
  console.log(`\n검출 ${ok}/${FIXTURES.length}`);
  if (ok < FIXTURES.length) {
    console.log('회귀 실패 — "0건" 을 신뢰하지 말 것(§13⑮(7)).');
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
  for (const q of s.questions || []) {
    if (!String(q.t || "").trim()) continue;
    scanned++;
    const hits = judgeQuestion(q);
    if (hits.length) rows.push({ key, live, qid: q.id, qt: String(q.t).slice(0, 52), hits });
  }
}
console.log(`검사 스코프: ${ALL ? "전수" : "LIVE(RELEASE_KEYS)"} · 문항 ${scanned}개`);
console.log(`축 A 발문↔questionType · 축 B 정답 유도 1개 · 축 C 정답 선지 pat=null\n`);
const byAxis = { A: 0, B: 0, C: 0 };
for (const r of rows) for (const h of r.hits) byAxis[h.axis]++;
if (!rows.length) {
  console.log("■ 후보 0문항");
} else {
  console.log(`■ 후보 ${rows.length}문항  (축 A ${byAxis.A} · 축 B ${byAxis.B} · 축 C ${byAxis.C})\n`);
  for (const r of rows) {
    console.log(`  ${r.live ? "🔴LIVE " : "  비노출 "}${r.key} Q${r.qid}  «${r.qt}»`);
    for (const h of r.hits) console.log(`        [축 ${h.axis}] ${h.msg}`);
  }
}
console.log("\n※ 참고 도구입니다. 결함 확정이 아니라 후보 목록입니다(§7-23).");
console.log("※ 축 A 는 부정어구 목록에 의존하므로 오탐이 납니다. 자동 교정하지 마십시오.");
console.log('※ "0건" 은 --regress 통과 후에만 유효합니다.');
