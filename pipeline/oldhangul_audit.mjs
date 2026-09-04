#!/usr/bin/env node
// oldhangul_audit — 옛한글 오변환 교정 후보 생성 (정규 도구, 데이터 무수정)
//
// 배경: 시험지 PDF에는 옛한글이 한양PUA(U+E000~F8FF)로 살아 있는데(42시험지 1,311자),
//   데이터에는 PUA 0 · 첫가끝 정상표기 35 sent뿐이고 나머지는 **임의의 현대 음절로 치환**돼 있다.
//   예) 원문 ᄒᆞᆫ 빗치 → 데이터 '호 빗치' / ᄒᆞ쟈스라 → '흐쟈스라' / 들ᄒᆡ → '들히'
//   §6이 금지한 상태이며, 오변환 글자는 옛말투로 읽혀 육안 검수를 통과한다
//   (2026-07-22 실증. r2014e와 같은 "자연스러워서 안 보이는" 실패 유형).
//
// 원리: PDF 텍스트의 PUA를 hypua2jamo로 첫가끝 옛자모로 복원한 뒤, 데이터 sent와
//   한글 음절 기준으로 정렬한다. 게이트 H()가 [가-힣]만 남기므로 옛자모는 양쪽에서 사라지고,
//   **데이터에만 남는 잉여 음절**이 곧 오변환 위치다. 그 위치의 PDF 원문 옛글자를 짝지어 낸다.
//
// ⚠ 자동 치환 금지(§6 · 대표 지시 2026-07-22). 본 도구는 **후보 발행까지**만 한다.
//   적용은 세트 단위 시각 확인을 거친다.
//
// 우선순위 플래그 (대표 지시):
//   ⓐ vocab_target  — 오변환 글자가 어휘·표기를 직접 묻는 문항의 대상이면 문항 자체가 불성립
//   ⓑ marker_anchor — 오변환 글자에 마커(㉠~㉤ 등)나 cs_span이 얹혀 있으면 형광펜이 깨진다
//                     (§13⑭ 3계층: sent.t만 고치면 cs_spans.text·analysis에 옛 형태 잔존)
//
// 사용:
//   node pipeline/oldhangul_audit.mjs                 # LIVE 전수
//   node pipeline/oldhangul_audit.mjs --yk=2020수능    # 연도 한정
//   node pipeline/oldhangul_audit.mjs --all           # 비노출 포함
// 산출: pipeline/output/oldhangul_candidates.json
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const ykFilter = (args.find((a) => a.startsWith("--yk=")) || "").split("=")[1];
const includeHidden = args.includes("--all");
const DATA = "data-source/all_data_204.json";
const ANN = "public/data/annotations.json";

const PUA_RE = new RegExp(
  "[" + String.fromCharCode(0xe000) + "-" + String.fromCharCode(0xf8ff) + "]",
);
const H = (s) => (s || "").replace(/[^가-힣]/g, "");
// 첫가끝 옛자모 (hypua2jamo 복원 결과가 이 영역으로 들어온다)
const JAMO_RE = new RegExp(
  "[" +
    String.fromCharCode(0x1100) +
    "-" +
    String.fromCharCode(0x11ff) +
    String.fromCharCode(0xa960) +
    "-" +
    String.fromCharCode(0xa97f) +
    String.fromCharCode(0xd7b0) +
    "-" +
    String.fromCharCode(0xd7ff) +
    "]",
);
const MARKERS = /[㉠-㉿ⓐ-ⓩⒶ-Ⓩ①-⑳]/;
// 어휘·표기를 직접 묻는 발문 (넓게 잡는다 — 놓치는 쪽이 더 위험)
const VOCAB_Q =
  /어휘|단어|낱말|표기|어절|문맥상|바꿔 ?쓰|바꾸어 ?쓰|가장 ?가까운|의미로 ?쓰인|밑줄 ?친.*뜻/;

function examText(yk) {
  for (const c of [`_done/${yk}`, `_done/${yk}A`, `_done/${yk}B`]) {
    if (!fs.existsSync(c)) continue;
    const hit = fs.readdirSync(c).find((x) => x.endsWith("시험지.pdf"));
    if (!hit) continue;
    try {
      // PUA를 첫가끝으로 복원한 상태로 받는다 (hypua2jamo)
      return execSync(
        `python3 -X utf8 -c "import fitz,hypua2jamo;dd=fitz.open('${c}/${hit}');print(hypua2jamo.translate(''.join(p.get_text() for p in dd)))"`,
        {
          maxBuffer: 1e8,
          env: { ...process.env, PYTHONUTF8: "1", PYTHONIOENCODING: "utf-8" },
        },
      ).toString();
    } catch {
      return null; // hypua2jamo 미설치 / 추출 실패
    }
  }
  return null;
}

// 데이터 sent(음절열)를 시험지 음절열에 정렬하되 데이터 쪽 건너뜀만 허용.
//   건너뛴 음절 = 오변환 후보. 앵커는 시험지에 실재하는 최초 6음절.
//   ⚠ 탐욕 정렬 금지 — 최초 6음절 앵커 + 전진 탐욕은 앵커가 우연히 다른 위치에 걸리면
//     문장 전체를 오변환으로 오검출한다(2026-07-22 1차 구현에서 실증: 정상 음절
//     '돗·도·비·푸'를 후보로 올림). 창을 먼저 확정한 뒤 DP로 최소 삭제 정렬한다.
const ANCHOR = 8;
function alignSkips(sH, eH) {
  // 1) 창 확정 — sH의 ANCHOR-gram 중 시험지에 유일하게 가까운 위치를 다수결로 고른다
  const votes = new Map();
  for (let i = 0; i + ANCHOR <= sH.length; i++) {
    let p = eH.indexOf(sH.slice(i, i + ANCHOR));
    while (p >= 0) {
      const origin = p - i; // 이 gram이 맞다면 문장 시작 위치
      votes.set(origin, (votes.get(origin) || 0) + 1);
      p = eH.indexOf(sH.slice(i, i + ANCHOR), p + 1);
      if (votes.size > 400) break;
    }
  }
  if (!votes.size) return null; // 앵커 없음 = 옛글자 밀집 → 세트 단위 직독
  let origin = -1,
    best = 0;
  for (const [o, v] of votes) if (v > best) ((best = v), (origin = o));
  const slack = Math.max(8, Math.ceil(sH.length * 0.4));
  const wStart = Math.max(0, origin - slack);
  const w = eH.slice(wStart, origin + sH.length + slack);
  if (!w.length) return null;

  // 2) DP — sH를 창 w의 부분문자열로 만들기 위한 최소 "데이터 쪽 삭제"
  //    dp[i][j] = sH[0..i) 를 소비하고 w의 j 위치까지 왔을 때의 최소 삭제 수
  const m = sH.length,
    n = w.length,
    INF = 1e9;
  const dp = Array.from({ length: m + 1 }, () =>
    new Int32Array(n + 1).fill(INF),
  );
  const bk = Array.from({ length: m + 1 }, () => new Int8Array(n + 1)); // 1=match 2=skip
  for (let j = 0; j <= n; j++) dp[0][j] = 0; // 시작 위치 자유
  for (let i = 0; i < m; i++)
    for (let j = 0; j <= n; j++) {
      const cur = dp[i][j];
      if (cur >= INF) continue;
      if (j < n && w[j] === sH[i] && cur < dp[i + 1][j + 1]) {
        dp[i + 1][j + 1] = cur;
        bk[i + 1][j + 1] = 1;
      }
      if (cur + 1 < dp[i + 1][j]) {
        dp[i + 1][j] = cur + 1;
        bk[i + 1][j] = 2;
      }
    }
  let endJ = -1,
    bestDel = INF;
  for (let j = 0; j <= n; j++)
    if (dp[m][j] < bestDel) ((bestDel = dp[m][j]), (endJ = j));
  if (bestDel >= INF) return null;
  // 삭제가 문장의 40%를 넘으면 정렬 실패로 본다(오검출 방지 — 후보 아님)
  if (bestDel > Math.max(3, Math.ceil(m * 0.4))) return null;

  // 3) 역추적 — 삭제 위치(=오변환 후보) 회수
  const skips = [];
  let i = m,
    j = endJ;
  while (i > 0) {
    if (bk[i][j] === 1) {
      i--;
      j--;
    } else {
      i--;
      skips.push({ hIdx: i, examAt: wStart + j });
    }
  }
  skips.reverse();
  return { skips, origin };
}

// H() 인덱스 → 원문 sent.t 인덱스
function hIndexMap(t) {
  const map = [];
  for (let i = 0; i < t.length; i++) if (/[가-힣]/.test(t[i])) map.push(i);
  return map;
}

const d = JSON.parse(fs.readFileSync(DATA, "utf8"));
let ann = {};
try {
  ann = JSON.parse(fs.readFileSync(ANN, "utf8"));
} catch {}
const relSrc = fs.readFileSync("src/dataLoader.js", "utf8");
const REL = new Set(
  [
    ...relSrc
      .match(/RELEASE_KEYS\s*=\s*new Set\(\[([\s\S]*?)\]\)/)[1]
      .matchAll(/"([^"]+::[^"]+)"/g),
  ].map((m) => m[1]),
);

const out = [];
let scanYk = 0,
  noExam = [],
  scanSent = 0;
for (const yk of Object.keys(d)) {
  if (ykFilter && yk !== ykFilter) continue;
  const raw = examText(yk);
  if (!raw) {
    noExam.push(yk);
    continue;
  }
  scanYk++;
  const eH = H(raw);
  // eH 인덱스 → raw 인덱스 (건너뛴 자리에 실제로 옛자모가 있는지 확인하기 위함)
  const eMap = [];
  for (let i = 0; i < raw.length; i++) if (/[가-힣]/.test(raw[i])) eMap.push(i);
  // 판별자: 정렬이 건너뛴 위치의 시험지 쪽에 첫가끝 옛자모가 실재하는가.
  //   이것이 없으면 옛한글 오변환이 아니라 다른 원인의 불일치다(passage_fidelity 소관).
  const hasJamoNear = (eHIdx) => {
    const c = eMap[Math.min(Math.max(eHIdx, 0), eMap.length - 1)];
    if (c == null) return false;
    return JAMO_RE.test(raw.slice(Math.max(0, c - 3), c + 4));
  };
  for (const cat of ["reading", "literature"])
    for (const s of d[yk][cat] || []) {
      const live = REL.has(yk + "::" + s.id);
      if (!live && !includeHidden) continue;
      const annList = (ann[yk] || {})[s.id] || [];
      for (const sent of s.sents || []) {
        const sH = H(sent.t);
        if (sH.length < 10) continue;
        scanSent++;
        if (eH.includes(sH)) continue; // 완전 일치 = 정상
        const al = alignSkips(sH, eH);
        const map = hIndexMap(sent.t);
        if (!al) {
          out.push({
            yk,
            setId: s.id,
            sentId: sent.id,
            live,
            kind: "no_anchor",
            note: "연속 6음절 일치 구간 없음 — 옛글자 밀집. 세트 단위 원문 직독 필요",
            text: sent.t.slice(0, 60),
            vocab_target: false,
            marker_anchor: MARKERS.test(sent.t),
            cs_span_refs: 0,
          });
          continue;
        }
        if (!al.skips.length) continue;
        // 각 건너뜀에 대해 시험지 쪽 옛자모 실재 여부로 걸러낸다.
        //   옛자모가 없으면 옛한글 오변환이 아니라 다른 원인의 불일치 → 본 도구 소관 아님.
        const items = al.skips
          .filter((sk) => sk.examAt != null && hasJamoNear(sk.examAt))
          .map((sk) => {
            const rawIdx = map[sk.hIdx];
            const c = eMap[Math.min(sk.examAt, eMap.length - 1)];
            return {
              dataChar: sent.t[rawIdx],
              at: rawIdx,
              context: sent.t.slice(Math.max(0, rawIdx - 6), rawIdx + 7),
              examNear: raw
                .slice(Math.max(0, c - 6), c + 7)
                .replace(/\n/g, " "),
            };
          });
        if (!items.length) continue; // 옛자모 근거 0 = 후보 아님
        // ⓐ 어휘·표기 문항 대상 여부: 해당 sent를 근거로 쓰는 어휘형 문항이 있는가
        const vocab = (s.questions || []).some(
          (q) =>
            VOCAB_Q.test(q.t || "") &&
            (q.choices || []).some((c) => (c.cs_ids || []).includes(sent.id)),
        );
        // ⓑ 마커·cs_span 정박 여부
        const annHit = annList.some((a) => a.sentId === sent.id);
        let spanRefs = 0;
        for (const q of s.questions || [])
          for (const c of q.choices || [])
            for (const sp of c.cs_spans || [])
              if (sp.sent_id === sent.id) spanRefs++;
        out.push({
          yk,
          setId: s.id,
          sentId: sent.id,
          live,
          kind: "substituted",
          count: items.length,
          skipsTotal: al.skips.length,
          items,
          text: sent.t.slice(0, 60),
          vocab_target: vocab,
          marker_anchor: annHit || MARKERS.test(sent.t),
          cs_span_refs: spanRefs,
        });
      }
    }
}

const OUT_DIR = path.resolve(__dirname, "output");
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(
  path.join(OUT_DIR, "oldhangul_candidates.json"),
  JSON.stringify(out, null, 2),
  "utf8",
);

const liveRows = out.filter((x) => x.live);
const sub = liveRows.filter((x) => x.kind === "substituted");
const noAnc = liveRows.filter((x) => x.kind === "no_anchor");
const chars = sub.reduce((a, x) => a + x.count, 0);
console.log(
  `검사: ${scanYk} yearKey / sent ${scanSent}${noExam.length ? ` | 시험지 대조 불가 yk ${noExam.length} (${noExam.join(" ")})` : ""}`,
);
if (scanSent === 0) {
  console.error("🔴 SCOPE_EMPTY — 검사 대상 0건. 판정 무효");
  process.exit(1);
}
console.log(
  `\n=== 옛한글 오변환 후보 (LIVE) — sent ${sub.length} / 글자 ${chars} · 앵커없음(세트 직독) ${noAnc.length} ===`,
);
const bySet = {};
for (const r of liveRows)
  (bySet[r.yk + "::" + r.setId] = bySet[r.yk + "::" + r.setId] || []).push(r);
for (const [k, rows] of Object.entries(bySet).sort(
  (a, b) => b[1].length - a[1].length,
)) {
  const a = rows.filter((r) => r.vocab_target).length;
  const b = rows.filter((r) => r.marker_anchor || r.cs_span_refs).length;
  console.log(
    `  ${k}  sent ${rows.length}${a ? `  🅐 어휘문항 대상 ${a}` : ""}${b ? `  🅑 마커·형광펜 정박 ${b}` : ""}`,
  );
}
console.log(`\n=== 🅐 어휘·표기 문항 대상 (문항 불성립 위험 — 최우선) ===`);
const A = liveRows.filter((x) => x.vocab_target);
A.forEach((x) => console.log(`  ${x.yk} ${x.setId} ${x.sentId}: ${x.text}`));
if (!A.length) console.log("  없음");
console.log(
  `\n=== 🅑 마커·cs_span 정박 (§13⑭ 3계층 동시 교정 의무 — 형광펜 파손 위험) ===`,
);
const B = liveRows.filter((x) => x.marker_anchor || x.cs_span_refs);
B.slice(0, 20).forEach((x) =>
  console.log(
    `  ${x.yk} ${x.setId} ${x.sentId}: cs_span ${x.cs_span_refs}건 · ${x.text}`,
  ),
);
if (B.length > 20) console.log(`  … 외 ${B.length - 20}건`);
if (!B.length) console.log("  없음");
console.log(`\n산출: pipeline/output/oldhangul_candidates.json`);
console.log(
  `⚠ 자동 치환 금지 — 본 산출은 후보다. 적용은 세트 단위 시각 확인 후(§6 古語 = PDF 원문 정본).`,
);
