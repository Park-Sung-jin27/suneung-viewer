// exam_completeness_report.mjs — 시험 회차별 완성도 현황표 (발주 fs · 2026-08-17)
//
// 목적: 지금까지의 결함 측정은 전부 「항목별 총량」이었다.
//       「어느 시험이 어디까지 됐는가」를 한 표로 보기 위한 회차 단위 집계다.
//
// ★ 읽기 전용이다. all_data_204.json · annotations.json 을 쓰지 않는다.
// ★ quality_gate 에 축을 추가하지 않는다(§13⑱). 게이트가 --report 로 남긴
//   pipeline/quality_report.json 을 입력으로 받아 회차 단위로 재집계할 뿐이다.
// ★ 「완성/미완성」 판정을 내리지 않는다. 항목별 수치만 낸다(발주 fs 금지 ③).
//
// 선행 실행 (전수 353세트 · 데이터 무수정):
//   node pipeline/quality_gate.mjs --report
// 그 다음:
//   node pipeline/exam_completeness_report.mjs
//
// 산출: docs/exam_completeness_20260817.md

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const DATA_PATH = path.join(ROOT, "data-source/all_data_204.json");
const ANN_PATH = path.join(ROOT, "public/data/annotations.json");
const LOADER_PATH = path.join(ROOT, "src/dataLoader.js");
const REPORT_PATH = path.join(ROOT, "pipeline/quality_report.json");
const OUT_PATH = path.join(ROOT, "docs/exam_completeness_20260817.md");

// ── RELEASE_KEYS 파싱 ────────────────────────────────────────────────
// 기존 파서 6종과 같은 방식(선언 블록 안 큰따옴표 전수 수집)이다.
// ⚠ 선언 블록 주석에 큰따옴표를 넣으면 가짜 키가 생긴다 — 원인은 이 정규식이다.
function loadReleaseKeys() {
  const src = fs.readFileSync(LOADER_PATH, "utf8");
  const start = src.indexOf("const RELEASE_KEYS = new Set([");
  if (start < 0) throw new Error("RELEASE_KEYS 선언을 찾지 못했다");
  const end = src.indexOf("]);", start);
  const block = src.slice(start, end);
  const keys = new Set();
  for (const m of block.matchAll(/"([^"]+)"/g)) {
    if (m[1].includes("::")) keys.add(m[1]);
  }
  return keys;
}

// ── 마커 실사용 최대치 (전 코퍼스 실측) ──────────────────────────────
//   ⓐ~ⓖ(7) · ㉠~㉩(10) · Ⓐ~Ⓔ(5)
//   ①~⑤ 는 선지 번호 체계와 공유하므로 마커로 세지 않는다.
const MARKER_RE = /[ⓐ-ⓖ㉠-㉩Ⓐ-Ⓔ]/;

// ── cs_ids 필수 판정 (quality_gate.mjs:2392 와 동일 규칙) ────────────
const REQUIRES_CS = ["R1", "R2", "R4", "L1", "L2", "L4", "L5"];

const data = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
const ann = JSON.parse(fs.readFileSync(ANN_PATH, "utf8"));
const RELEASE_KEYS = loadReleaseKeys();

if (!fs.existsSync(REPORT_PATH)) {
  console.error(
    `[fs] ${REPORT_PATH} 없음 — 먼저 실행: node pipeline/quality_gate.mjs --report`,
  );
  process.exit(1);
}
const report = JSON.parse(fs.readFileSync(REPORT_PATH, "utf8"));

// ── loc → setId 귀속 ────────────────────────────────────────────────
// loc 형식이 축마다 다르다(yearKey 접두가 없는 축이 있다 — 실측).
// 접두 파싱 대신 「해당 yearKey 의 실제 setId 목록과 토큰 대조」로 귀속시킨다.
const setIdsByYear = new Map();
for (const yk of Object.keys(data)) {
  const ids = new Set();
  for (const sec of ["reading", "literature"])
    for (const s of data[yk][sec] || []) ids.add(s.id);
  setIdsByYear.set(yk, ids);
}
function attributeSetId(f) {
  const ids = setIdsByYear.get(f.yearKey);
  if (!ids || !f.loc) return null;
  for (const tok of String(f.loc).split(/[\s:,()[\]]+/)) {
    if (ids.has(tok)) return tok;
  }
  return null;
}

// ── 회차별 집계 ─────────────────────────────────────────────────────
// bucket: "live" | "hidden"
function blank() {
  return {
    sets: 0,
    questions: 0,
    choices: 0,
    critical: 0,
    warning: 0,
    warnTypes: new Map(),
    annHave: 0, // annotations.json 에 항목이 1개 이상인 세트
    annEmpty: 0,
    annMissingWithMarker: 0, // 본문에 마커가 있는데 annotations 가 빈 세트
    patMissing: 0, // 오답 선지(ok!==true) 중 pat 없음
    csHave: 0, // cs_ids 1개 이상인 선지
    csRequiredMissing: 0, // 게이트 규칙상 cs_ids 필수인데 빈 선지
    sentTotal: 0,
    sentTypeMissing: 0,
    needsReview: 0,
  };
}

const acc = new Map(); // yearKey -> {live, hidden}
function bucketOf(yk, b) {
  if (!acc.has(yk)) acc.set(yk, { live: blank(), hidden: blank() });
  return acc.get(yk)[b];
}

for (const yk of Object.keys(data)) {
  for (const sec of ["reading", "literature"]) {
    for (const s of data[yk][sec] || []) {
      const isLive = RELEASE_KEYS.has(`${yk}::${s.id}`);
      const B = bucketOf(yk, isLive ? "live" : "hidden");
      B.sets++;

      // annotations — 렌더가 실제로 읽는 소스는 annotations.json 이다(§13⑳).
      //   all_data 의 set.annotations 는 dataLoader 가 덮어쓰므로 세지 않는다.
      const list = ann?.[yk]?.[s.id];
      const hasAnn = Array.isArray(list) && list.length > 0;
      if (hasAnn) B.annHave++;
      else B.annEmpty++;

      let markerSeen = false;
      for (const st of s.sents || []) {
        B.sentTotal++;
        if (st.sentType === undefined || st.sentType === null || st.sentType === "")
          B.sentTypeMissing++;
        if (!markerSeen && MARKER_RE.test(st.t || "")) markerSeen = true;
      }
      if (markerSeen && !hasAnn) B.annMissingWithMarker++;

      for (const q of s.questions || []) {
        B.questions++;
        if (q.needsReview === true) B.needsReview++;
        for (const c of q.choices || []) {
          B.choices++;
          const noPat = c.pat === undefined || c.pat === null || c.pat === "";
          if (c.ok !== true && noPat) B.patMissing++;
          const csN = Array.isArray(c.cs_ids) ? c.cs_ids.length : 0;
          if (csN > 0) B.csHave++;
          else if (c.ok === true) B.csRequiredMissing++;
          else if (REQUIRES_CS.includes(c.pat)) B.csRequiredMissing++;
        }
      }
    }
  }
}

// 게이트 findings 귀속
let unattributed = 0;
for (const [sev, arr] of [
  ["critical", report.critical || []],
  ["warning", report.warning || []],
]) {
  for (const f of arr) {
    const setId = attributeSetId(f);
    if (!setId) {
      unattributed++;
      continue;
    }
    const isLive = RELEASE_KEYS.has(`${f.yearKey}::${setId}`);
    const B = bucketOf(f.yearKey, isLive ? "live" : "hidden");
    if (sev === "critical") B.critical++;
    else {
      B.warning++;
      B.warnTypes.set(f.type, (B.warnTypes.get(f.type) || 0) + 1);
    }
  }
}

// ── 결함 0 항목 수 ──────────────────────────────────────────────────
// 7개 항목을 기계적으로 0/비0 판정한다. 「완성」이라는 뜻이 아니다.
const ITEMS = 7;
function zeroItems(B) {
  let z = 0;
  if (B.critical === 0) z++;
  if (B.warning === 0) z++;
  if (B.annMissingWithMarker === 0) z++;
  if (B.patMissing === 0) z++;
  if (B.csRequiredMissing === 0) z++;
  if (B.sentTypeMissing === 0) z++;
  if (B.needsReview === 0) z++;
  return z;
}

// ── 회차 정렬: 학년도 내림차순 → 6월·9월·수능 순 ─────────────────────
function sortKey(yk) {
  const m = yk.match(/^(\d{4})/);
  const year = m ? Number(m[1]) : 0;
  const ord = yk.includes("_6월") ? 0 : yk.includes("_9월") ? 1 : 2;
  const form = yk.endsWith("B") ? 1 : 0;
  return [-year, ord, form];
}
const years = [...acc.keys()].sort((a, b) => {
  const A = sortKey(a),
    C = sortKey(b);
  return A[0] - C[0] || A[1] - C[1] || A[2] - C[2];
});

function top3(map) {
  const e = [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  if (e.length === 0) return "—";
  return e.map(([t, n]) => `${t} ${n}`).join("<br>");
}
function pct(n, d) {
  if (d === 0) return "—";
  return `${((n / d) * 100).toFixed(1)}%`;
}

function tableFor(bucket) {
  const rows = [];
  const T = blank();
  for (const yk of years) {
    const B = acc.get(yk)[bucket];
    if (B.sets === 0) continue;
    T.sets += B.sets;
    T.questions += B.questions;
    T.choices += B.choices;
    T.critical += B.critical;
    T.warning += B.warning;
    T.annHave += B.annHave;
    T.annEmpty += B.annEmpty;
    T.annMissingWithMarker += B.annMissingWithMarker;
    T.patMissing += B.patMissing;
    T.csHave += B.csHave;
    T.csRequiredMissing += B.csRequiredMissing;
    T.sentTotal += B.sentTotal;
    T.sentTypeMissing += B.sentTypeMissing;
    T.needsReview += B.needsReview;
    for (const [t, n] of B.warnTypes)
      T.warnTypes.set(t, (T.warnTypes.get(t) || 0) + n);
    rows.push(
      `| ${yk} | ${B.sets} | ${B.questions} | ${B.choices} | ${B.critical} | ${B.warning} | ${top3(B.warnTypes)} | ${B.annHave} (${B.annEmpty}) | ${B.annMissingWithMarker} | ${B.patMissing} | ${pct(B.csHave, B.choices)} | ${B.csRequiredMissing} | ${B.sentTypeMissing} | ${B.needsReview} | ${zeroItems(B)}/${ITEMS} |`,
    );
  }
  const head = [
    "| 회차 | 세트 | 문항 | 선지 | CRIT | WARN | WARN 상위3 | ann 보유(빈) | ann 결손 | pat 누락 | cs_ids 보유율 | cs 결손 | sentType 누락 | needsReview | 결함0 항목 |",
    "|---|--:|--:|--:|--:|--:|---|--:|--:|--:|--:|--:|--:|--:|--:|",
  ];
  const total = `| **합계** | **${T.sets}** | **${T.questions}** | **${T.choices}** | **${T.critical}** | **${T.warning}** | ${top3(T.warnTypes)} | **${T.annHave} (${T.annEmpty})** | **${T.annMissingWithMarker}** | **${T.patMissing}** | **${pct(T.csHave, T.choices)}** | **${T.csRequiredMissing}** | **${T.sentTypeMissing}** | **${T.needsReview}** | — |`;
  return { md: [...head, ...rows, total].join("\n"), total: T };
}

const live = tableFor("live");
const hidden = tableFor("hidden");

const md = `# 시험 회차별 완성도 현황표 (발주 fs · 2026-08-17)

> **판정문이 아니다.** 항목별 수치만 담았다.
> 「완성/미완성」 기준은 대표 판정 사항이므로 이 문서에서 정하지 않는다.
> 순위도 매기지 않는다.
>
> 생성: \`node pipeline/quality_gate.mjs --report\` → \`node pipeline/exam_completeness_report.mjs\`
> 데이터 수정 0 · 게이트 축 추가 0(§13⑱).

## 1. LIVE (공개 ${live.total.sets}세트)

${live.md}

## 2. 비노출 (${hidden.total.sets}세트)

${hidden.md}

## 3. 집계 정의

| 열 | 정의 |
|---|---|
| 회차 | \`all_data_204.json\` 의 yearKey. LIVE/비노출 구분은 \`RELEASE_KEYS\` 의 \`yearKey::setId\` 복합키. 한 회차가 두 표에 모두 나올 수 있다(부분 공개). |
| CRIT / WARN | \`quality_gate.mjs --report\` 전수 353세트 실행 결과를 세트 단위로 귀속시켜 재집계. |
| WARN 상위3 | 해당 회차 WARNING 을 유형별로 세어 많은 순 3개. |
| ann 보유(빈) | **\`annotations.json\` 기준.** 항목 1개 이상이면 보유. |
| ann 결손 | 본문 문장에 마커(ⓐ~ⓖ · ㉠~㉩ · Ⓐ~Ⓔ)가 있는데 annotations 가 빈 세트 수. **빈 것이 정상인 세트를 제외한 수치다.** |
| pat 누락 | **오답 선지(\`ok !== true\`) 중** \`pat\` 이 없는 선지 수. 정답 선지는 pat 이 없는 것이 정상이다. |
| cs_ids 보유율 | 전체 선지 중 \`cs_ids\` 가 1개 이상인 비율. **어휘(V)·R3·L3 선지는 비우는 것이 지침이므로 100% 가 목표치가 아니다.** |
| cs 결손 | 게이트 규칙(\`quality_gate.mjs:2392\`)상 필수인데 빈 선지 수. \`ok:true\` 전부 + \`ok:false\` 중 pat ∈ {R1,R2,R4,L1,L2,L4,L5}. |
| sentType 누락 | \`sents[].sentType\` 이 없거나 빈 문장 수. |
| needsReview | 문항 단위 \`needsReview: true\` 플래그 수. |
| 결함0 항목 | 위 7개 항목(CRIT · WARN · ann 결손 · pat 누락 · cs 결손 · sentType 누락 · needsReview)이 0인 개수. **완성도 점수가 아니다.** |

## 4. 한계 — 못 센 것

1. **화면 관측이 필요한 항목은 세지 못했다(§13㉑).** 형광펜이 실제로 칠해지는지,
   해설이 읽히는지, 지문이 끊기지 않는지는 코드·데이터 집계로 확정할 수 없다.
2. **해설 품질은 축이 없다.** 해설 반전(정답인데 오답처럼 서술) 5건처럼 사람이 읽어야
   드러나는 결함은 이 표에 잡히지 않는다. \`needsReview\` 는 파이프라인 자동 플래그일 뿐
   사람 검수 결과가 아니다.
3. **정답표 대조는 포함하지 않았다.** 공개 승격 4관문의 2)에 해당하며 별도 절차다.
4. **\`all_data\` 의 \`set.annotations\` 는 세지 않았다.** 렌더러가 \`annotations.json\` 으로
   덮어쓰는 dead 필드다(§13⑳). 두 소스의 세트 수가 다르므로 혼동하면 안 된다.
5. **\`pat\` 값이 \`"0"\` 인 선지가 전 코퍼스 18건 있다.** 유효 패턴이 아니지만
   \`pat 누락\` 에는 넣지 않았다(값은 존재하므로). 별건이다.
6. **게이트 findings 중 세트 귀속 실패 ${unattributed}건.** loc 형식이 축마다 달라
   setId 토큰을 찾지 못한 건이다. 표의 CRIT/WARN 합계는 그만큼 전수보다 적다.
7. **B01 검수 대장(\`config/verification_ledger.json\`)의 사람 검수 상태는 넣지 않았다.**
   자동 집계와 사람 판정을 한 표에 섞으면 §13㉑ 위반이 된다.
`;

fs.writeFileSync(OUT_PATH, md, "utf8");
console.log(`[fs] 산출: ${OUT_PATH}`);
console.log(
  `[fs] LIVE 세트=${live.total.sets} 문항=${live.total.questions} 선지=${live.total.choices} CRIT=${live.total.critical} WARN=${live.total.warning}`,
);
console.log(
  `[fs] 비노출 세트=${hidden.total.sets} 문항=${hidden.total.questions} 선지=${hidden.total.choices} CRIT=${hidden.total.critical} WARN=${hidden.total.warning}`,
);
console.log(`[fs] 세트 귀속 실패 findings=${unattributed}건`);
