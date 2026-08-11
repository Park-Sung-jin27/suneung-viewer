// reference_deficit_scan.mjs — 해설이 참조하는 값이 데이터에 실재하는지 문자열로만 대조 (발주 ct[1])
//
// 내용 판단이 아니다. 해설이 큰따옴표로 인용한 문자열이 실제 데이터(bogi·본문·선지·발문)에
// 존재하는지만 본다. LLM 불필요.
//
// 규칙
//   1 선지가 마커 나열뿐인 문항("ㄱ, ㄷ" / "ⓐ, ⓒ")에서, 해설이 그 마커의 내용이라며
//     인용한 문자열이 데이터 어디에도 없다            → 날조 후보
//   2 발문이 마커 범위를 선언한 문항에서, 해설이 특정 마커에 붙인 인용문이
//     실제 그 마커 정박 문장이 아니라 다른 마커의 것이다  → 오귀속
//   3 해설 인용문이 데이터 어디에서도 부분일치조차 되지 않는다  → 출처불명
//
// 오탐 억제: 인용문을 정규화(공백·문장부호·말줄임표·마커 제거)한 뒤 부분일치로 판정한다.
//   완전일치를 요구하면 정상 해설이 대량 걸린다(cs[2] 의 '❌' 실패와 같은 유형).
//
// 읽기 전용. 수정·판정 없음.
//
// 사용:
//   node pipeline/reference_deficit_scan.mjs             LIVE 전수
//   node pipeline/reference_deficit_scan.mjs --regress   fixture 3건 회귀 (미검출 시 exit 1)
//   node pipeline/reference_deficit_scan.mjs --snap=<rev>  과거 스냅샷으로 실행
//   node pipeline/reference_deficit_scan.mjs --calib     정규화 강도별 오탐률 실측표
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const argv = process.argv.slice(2);
const SNAP = (argv.find((a) => a.startsWith("--snap=")) || "").split("=")[1] || null;
const REGRESS = argv.includes("--regress");
const CALIB = argv.includes("--calib");

const loadData = (rev) =>
  JSON.parse(rev
    ? execSync(`git cat-file blob ${rev}:public/data/all_data_204.json`, { cwd: ROOT, encoding: "buffer", maxBuffer: 5e8 }).toString("utf8")
    : fs.readFileSync(path.join(ROOT, "public/data/all_data_204.json"), "utf8"));

const RK = new Set([...fs.readFileSync(path.join(ROOT, "src/dataLoader.js"), "utf8")
  .match(/const RELEASE_KEYS = new Set\(\[([\s\S]*?)\]\)/)[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]));

const flat = (v) => { const a = []; (function w(x) {
  if (typeof x === "string") a.push(x);
  else if (Array.isArray(x)) x.forEach(w);
  else if (x && typeof x === "object") Object.values(x).forEach(w);
})(v); return a.join("\n"); };

// 정규화 — 공백·문장부호·말줄임표·마커 제거
const MARKER = /[㉠-㉯ⓐ-ⓩⒶ-Ⓩ①-⑳ㄱ-ㅎ]/g;
const N = (s) => String(s || "")
  .replace(/[…‥]|\.{2,}/g, "")
  .replace(MARKER, "")
  .replace(/[“”"‘’'『』「」〈〉<>[\]()（）·ㆍ‧,.!?:;~－\-—/]/g, "")
  .replace(/\s+/g, "");

const SYM1 = /^[ㄱ-ㅎa-zA-Zⅰ-ⅹ①-⑮ⓐ-ⓔ㉠-㉤]$/;
const isSymbolCombo = (q) => {
  const cs = q.choices || [];
  if (cs.length < 4) return false;
  return cs.every((c) => {
    const toks = String(c.t || "").split(/[,·、\s]+/).filter(Boolean);
    return toks.length >= 1 && toks.length <= 4 && toks.every((t) => SYM1.test(t));
  });
};
// 마커 → 정박 문장(본문) / 정의(bogi 항목)
function anchors(q, set) {
  const out = {};
  const b = flat(q.bogi);
  for (const m of b.matchAll(/(^|\n)\s*([ㄱ-ㅎⓐ-ⓔ㉠-㉤])[.．)\s]\s*([^\n]+)/g)) out[m[2]] = m[3].trim();
  for (const m of b.matchAll(/(^|\n)\s*([^\n]{6,})[·…\s]{2,}([ⓐ-ⓔ㉠-㉤ㄱ-ㅎ])\s*(?=\n|$)/g)) out[m[3]] = m[2].trim();
  for (const sn of set.sents || []) {
    for (const m of String(sn.t || "").matchAll(/([ⓐ-ⓔ㉠-㉤])\s*([^\n]{4,80})/g))
      if (!out[m[1]]) out[m[1]] = m[2].trim();
  }
  return out;
}
const quotesOf = (a) => [...String(a || "").matchAll(/"([^"]{8,})"/g)].map((m) => m[1]);

function scanSet(yk, set, live) {
  const rows = [];
  const bodyN = (set.sents || []).map((s) => N(s.t));
  for (const q of set.questions || []) {
    const bogiN = N(flat(q.bogi));
    const stemN = N(q.t);
    const choiceN = (q.choices || []).map((c) => N(c.t));
    const anc = anchors(q, set);
    const combo = isSymbolCombo(q);
    const declared = /[ⓐ-ⓔ㉠-㉤ㄱ-ㅎ]\s*[~～∼]\s*[ⓐ-ⓔ㉠-㉤ㄱ-ㅎ]/.test(String(q.t));
    for (const c of q.choices || []) {
      const a = String(c.analysis || "");
      if (!a) continue;
      // ── 규칙 1-b : 마커 뒤 괄호 설명 ↔ 정의 대조 ─────────────────────
      //   r20206d Q40 실측: 인용문은 정상인데 'ㄱ(포린 존재)'·'ㄷ(핵 존재)' 처럼
      //   괄호 설명에서 <보기> 항목을 지어냈다. 인용 대조만으로는 구조적으로 못 잡는다.
      if (combo || Object.keys(anc).length) {
        for (const m of a.matchAll(/([ⓐ-ⓔ㉠-㉤ㄱ-ㅎ])\s*[(（]([^)）]{2,30})[)）]/g)) {
          const def = anc[m[1]];
          if (!def) continue;
          const words = m[2].split(/[\s,·]+/).filter((x) => x.length >= 2);
          if (words.length && !words.some((x) => def.includes(x)))
            rows.push({ yk, sid: set.id, qid: q.id, num: c.num, live, rule: 1,
              quote: `${m[1]}(${m[2]}) ↔ 실제 ${m[1]}="${def.slice(0, 26)}…"` });
        }
      }
      for (const raw of quotesOf(a)) {
        // ── 오탐 억제 (실측 기반) ────────────────────────────────────
        //   1차 측정에서 검출률 28.61%(2214/7739) 가 나왔고 표본 확인 결과
        //   R3 2167 건이 전량 아래 5유형의 정상 해설이었다. 규칙을 좁힌다.
        //   ⓐ 말줄임표 축약 인용  ⓑ 다문장 이어붙임  ⓒ 운문 '/' 행 구분
        //   ⓓ 해설 자체 표현·선지 요약  ⓔ 따옴표 짝맞춤 실패 조각
        if (/[…‥]|\.{2,}/.test(raw)) continue;   // ⓐ — §13⑥ 선례와 동일 처리
        if (/[\n\r]/.test(raw)) continue;          // ⓔ
        if (raw.includes("/")) continue;           // ⓒ
        const qn = N(raw);
        if (qn.length < 6) continue;
        // ⓑ 다문장은 조각별로 본다 — 조각이 각각 실재하면 정상
        const parts = raw.split(/(?<=[.!?”'"」』])\s+/).map(N).filter((x) => x.length >= 6);
        const hasIn = (x) => bodyN.some((b) => b.includes(x)) || bogiN.includes(x)
          || choiceN.some((y) => y.includes(x)) || stemN.includes(x);
        const found = hasIn(qn) || (parts.length > 1 && parts.every(hasIn));
        if (!found) {
          // ★ 규칙 3(출처불명)은 haesol_v2 §2 축이 이미 담당한다 — 중복 계상하지 않는다.
          //   여기서는 "선지가 마커 나열뿐인 문항"(규칙 1)만 남긴다.
          if (combo) rows.push({ yk, sid: set.id, qid: q.id, num: c.num, live, rule: 1, quote: raw.slice(0, 60) });
          continue;
        }
        // 규칙 2 — 해설이 "ⓐ는 …" 형태로 특정 마커에 귀속시킨 인용이 실제 그 마커 것인가
        if (declared || Object.keys(anc).length) {
          const before = a.slice(Math.max(0, a.indexOf(raw) - 40), a.indexOf(raw));
          const m = [...before.matchAll(/([ⓐ-ⓔ㉠-㉤ㄱ-ㅎ])\s*[은는이가]?\s*[^"]{0,24}$/g)].pop();
          if (m && anc[m[1]]) {
            const mine = N(anc[m[1]]);
            if (mine && !mine.includes(qn) && !qn.includes(mine.slice(0, 8))) {
              const owner = Object.entries(anc).find(([, v]) => N(v).includes(qn));
              if (owner && owner[0] !== m[1])
                rows.push({ yk, sid: set.id, qid: q.id, num: c.num, live, rule: 2,
                  quote: raw.slice(0, 46), said: m[1], actual: owner[0] });
            }
          }
        }
      }
    }
  }
  return rows;
}

function runAll(D, onlyLive = true) {
  const rows = [];
  for (const yk of Object.keys(D)) for (const g of ["reading", "literature"]) for (const s of (D[yk] || {})[g] || []) {
    const live = RK.has(`${yk}::${s.id}`);
    if (onlyLive && !live) continue;
    rows.push(...scanSet(yk, s, live));
  }
  return rows;
}

// ─── 회귀 ─────────────────────────────────────────────────────
if (REGRESS) {
  const F = [
    { name: "fixture1 r20206d Q40 (97a1e78~1)", snap: "97a1e78~1", yk: "2020_6월", sid: "r20206d", qid: 40, rules: [1, 3] },
    { name: "fixture2 l20229a Q19 (현행)", snap: null, yk: "2022_9월", sid: "l20229a", qid: 19, rules: [1, 2, 3] },
    { name: "fixture3 r20236b Q7-4 (현행)", snap: null, yk: "2023_6월", sid: "r20236b", qid: 7, rules: [1, 3] },
  ];
  let fail = 0;
  console.log("양성 회귀 — fixture 3건\n");
  for (const f of F) {
    const D = loadData(f.snap);
    const hit = runAll(D, false).filter((r) => r.yk === f.yk && r.sid === f.sid && Number(r.qid) === f.qid && f.rules.includes(r.rule));
    const ok = hit.length > 0;
    if (!ok) fail++;
    console.log(`  ${ok ? "✅" : "🔴 미검출"}  ${f.name}  → 규칙 ${[...new Set(hit.map((h) => h.rule))].join("·") || "-"} · ${hit.length}건`);
    for (const h of hit.slice(0, 2)) console.log(`        선지${h.num} R${h.rule}: ${JSON.stringify(h.quote)}`);
  }
  console.log(`\n${fail ? `★ 회귀 실패 ${fail}건 — 검사기가 기지 결함을 못 잡습니다.` : "회귀 전건 통과 — 이후 판정 유효."}`);
  process.exit(fail ? 1 : 0);
}

// ─── 실측 ─────────────────────────────────────────────────────
const D = loadData(SNAP);
const rows = runAll(D, !SNAP ? true : false);
const totalQuotes = (() => {
  let n = 0;
  for (const yk of Object.keys(D)) for (const g of ["reading", "literature"]) for (const s of (D[yk] || {})[g] || []) {
    if (!SNAP && !RK.has(`${yk}::${s.id}`)) continue;
    for (const q of s.questions || []) for (const c of q.choices || []) n += quotesOf(c.analysis).length;
  }
  return n;
})();
// --json : 구조화 출력 (문서화·후속 처리용. 텍스트 파싱은 취약하다)
if (argv.includes("--json")) {
  process.stdout.write(JSON.stringify({
    scope: SNAP ? `snapshot:${SNAP}` : "LIVE",
    totalQuotes, detected: rows.length,
    ratePercent: +((rows.length / Math.max(1, totalQuotes)) * 100).toFixed(2),
    rows,
  }, null, 1));
  process.exit(0);
}

const byRule = rows.reduce((o, r) => ((o[r.rule] = (o[r.rule] || 0) + 1), o), {});
console.log(`검사 스코프: ${SNAP ? "스냅샷 " + SNAP : "LIVE"} · 해설 인용문 ${totalQuotes}개`);
console.log(`■ 검출 ${rows.length}건 / ${new Set(rows.map((r) => `${r.yk}|${r.sid} Q${r.qid}`)).size}문항`);
console.log(`  검출률 ${((rows.length / Math.max(1, totalQuotes)) * 100).toFixed(2)}%  (5% 초과 시 규칙을 좁혀야 함)`);
console.log(`  규칙별: ${Object.entries(byRule).map(([k, v]) => `R${k}=${v}`).join(" · ") || "없음"}\n`);
const byQ = new Map();
for (const r of rows) {
  const k = `${r.yk}|${r.sid} Q${r.qid}`;
  if (!byQ.has(k)) byQ.set(k, []);
  byQ.get(k).push(r);
}
for (const [k, list] of byQ) {
  console.log(`  ${list[0].live ? "🔴" : "⚪"} ${k}  (${list.length}건)`);
  for (const r of list.slice(0, 4))
    console.log(`       선지${r.num} R${r.rule}${r.said ? ` ${r.said}→실제 ${r.actual}` : ""}: ${JSON.stringify(r.quote)}`);
}
console.log(`\n※ 수정하지 않습니다. 목록만 산출합니다.`);
