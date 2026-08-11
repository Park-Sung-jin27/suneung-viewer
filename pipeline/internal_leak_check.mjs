// internal_leak_check.mjs — 해설 본문에 내부 작업 어휘가 누출됐는지 검사 (발주 cs[2])
//
// 배경: 2022_9월 l20229a Q19-1 의 결론줄이
//   "❌ 지문에 ⓐ~ⓔ 표시가 없어 선지 판단 불가능하며, 문학 지문에 독서 패턴 R2가
//    부여된 메타데이터 오류"
//   상태로 LIVE 에 노출돼 있었다. 해설이 스스로 무효를 선언한 문장인데도
//   기존 게이트 5종이 전부 통과시켰다.
//
// 읽기 전용. 수정·판정 없음 — 목록만 낸다.
//
// 사용:
//   node pipeline/internal_leak_check.mjs            LIVE 전수 스캔
//   node pipeline/internal_leak_check.mjs --regress  fixture 회귀 (미검출 시 exit 1)
//   node pipeline/internal_leak_check.mjs --all      비노출 포함
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const argv = process.argv.slice(2);
const ALL = argv.includes("--all");
const REGRESS = argv.includes("--regress");

// ─── 탐지 어휘 ────────────────────────────────────────────────
//   ⚠ '❌' 는 초안에 있었으나 제외했다 — 오답 선지의 정상 결론줄 표기이며
//     LIVE 실측 2,286건이 전량 정상이다(§7-6 정신: 매처가 정상을 결함으로 세면 안 된다).
//   '⚠' 도 같은 계열이나 실측 0건이라 미래 방어용으로 남긴다.
const VOCAB = {
  "⚠": /⚠/,
  "[Unverified]": /\[Unverified\]/,
  "[Inference]": /\[Inference\]/,
  "메타데이터": /메타데이터/,
  "패턴 R\\d": /패턴\s*R\d/,
  "패턴 L\\d": /패턴\s*L\d/,
  "pat": /\bpat\b/,
  "판단 불가": /판단\s*불가/,
  "판단이 불가능": /판단이\s*불가능/,
  "확인 불가": /확인\s*불가/,
  TODO: /TODO/,
  FIXME: /FIXME/,
  "N/A": /N\/A/,
  null: /\bnull\b/,
  undefined: /\bundefined\b/,
};

// ─── fixture (양성 회귀) ──────────────────────────────────────
//   이 문자열이 검출되지 않으면 검사기가 죽은 것이다. "0건"은 회귀 통과 후에만 유효.
const FIXTURE = {
  loc: "2022_9월|l20229a Q19-1 결론줄",
  text: "❌ 지문에 ⓐ~ⓔ 표시가 없어 선지 판단 불가능하며, 문학 지문에 독서 패턴 R2가 부여된 메타데이터 오류",
  expect: ["메타데이터", "패턴 R\\d", "판단 불가"],
};

function hitsIn(text) {
  const out = [];
  for (const [name, re] of Object.entries(VOCAB)) if (re.test(text)) out.push(name);
  return out;
}

if (REGRESS) {
  const got = hitsIn(FIXTURE.text);
  const miss = FIXTURE.expect.filter((e) => !got.includes(e));
  console.log(`양성 회귀 — fixture: ${FIXTURE.loc}`);
  console.log(`  검출 [${got.join(", ") || "없음"}]`);
  console.log(`  기대 [${FIXTURE.expect.join(", ")}]`);
  if (miss.length) {
    console.error(`\n★ 회귀 실패 — 미검출 [${miss.join(", ")}]. 검사기가 죽었습니다.`);
    process.exit(1);
  }
  console.log(`\n회귀 통과 — 이후의 "0건" 판정은 유효합니다.`);
  process.exit(0);
}

// ─── 전수 스캔 ────────────────────────────────────────────────
const D = JSON.parse(fs.readFileSync(path.join(ROOT, "public/data/all_data_204.json"), "utf8"));
const dl = fs.readFileSync(path.join(ROOT, "src/dataLoader.js"), "utf8");
const RK = new Set([...dl.match(/const RELEASE_KEYS = new Set\(\[([\s\S]*?)\]\)/)[1]
  .matchAll(/"([^"]+)"/g)].map((m) => m[1]));

const rows = [];
let scanned = 0;
for (const yk of Object.keys(D)) for (const g of ["reading", "literature"]) for (const s of (D[yk] || {})[g] || []) {
  const live = RK.has(`${yk}::${s.id}`);
  if (!ALL && !live) continue;
  for (const q of s.questions || []) for (const c of q.choices || []) {
    const a = String(c.analysis || "");
    if (!a) continue;
    scanned++;
    const hits = hitsIn(a);
    if (!hits.length) continue;
    // 어느 줄에서 걸렸는지 — 결론줄(마지막 줄)인지 표시
    const lines = a.trim().split("\n");
    const where = lines
      .map((L, i) => ({ L, last: i === lines.length - 1 }))
      .filter((x) => hitsIn(x.L).length);
    rows.push({ yk, sid: s.id, qid: q.id, num: c.num, live, hits,
      conclusion: where.some((x) => x.last),
      seg: (where[0] || { L: "" }).L.trim().slice(0, 110) });
  }
}

console.log(`검사 스코프: ${ALL ? "전수" : "LIVE(RELEASE_KEYS)"} · 해설 보유 선지 ${scanned}개`);
console.log(`탐지 어휘 ${Object.keys(VOCAB).length}종 ('❌' 는 정상 결론줄 표기라 제외 — 실측 2,286건 전량 정상)\n`);
console.log(`■ 검출 ${rows.length}선지 / ${new Set(rows.map((r) => `${r.yk}|${r.sid}`)).size}세트`);
if (rows.length) {
  const dist = {};
  for (const r of rows) for (const h of r.hits) dist[h] = (dist[h] || 0) + 1;
  console.log(`\n  어휘별 분포:`);
  for (const [k, v] of Object.entries(dist).sort((a, b) => b[1] - a[1])) console.log(`    ${k.padEnd(16)} ${v}건`);
  console.log(`\n  내역:`);
  for (const r of rows)
    console.log(`    ${r.live ? "🔴" : "⚪"} ${r.yk}|${r.sid} Q${r.qid}-${r.num}  [${r.hits.join(",")}]${r.conclusion ? " ★결론줄" : ""}\n        ${JSON.stringify(r.seg)}`);
}
console.log(`\n※ 수정하지 않습니다. 목록만 산출합니다.`);
