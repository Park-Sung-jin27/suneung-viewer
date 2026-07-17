// structure_fidelity.mjs — 구조 무결성 게이트 (read-only 진단)
// answer_fidelity가 못 잡는 구조 결함(오번호·중복·오삽입·누락)을 시험지 PDF↔데이터 대조로 색출.
// 검증된 primitive: 한글만 남긴 유사도(PUA 마커·한자병기·문장부호 무영향).
// 데이터 무수정. 임계값 = config/structure_fidelity_thresholds.json.
// 사용: node pipeline/structure_fidelity.mjs [--yk=2015수능B] [--data=<경로>] [--all]
//   --data: 정본 대신 다른 all_data 경로 대조(백업 회귀 테스트용)
//   --all : 의심 외 전 문항 유사도도 출력(보정용)
// resolveDirs / fitz+PYTHONUTF8 추출 방식은 answer_fidelity.mjs와 동일 규약.
import fs from "fs";
import { execSync } from "child_process";

const args = process.argv.slice(2);
const ykFilter = (args.find((a) => a.startsWith("--yk=")) || "").split("=")[1];
const dataPath =
  (args.find((a) => a.startsWith("--data=")) || "").split("=")[1] ||
  "public/data/all_data_204.json";
const showAll = args.includes("--all");

const d = JSON.parse(fs.readFileSync(dataPath, "utf8"));
const cfg = JSON.parse(
  fs.readFileSync("config/structure_fidelity_thresholds.json", "utf8"),
);
const SIM = cfg.similarity_threshold ?? 0.6;
const CAP = cfg.exam_block_max_chars ?? 700;
const MIN = cfg.min_data_chars ?? 20;

// answer_fidelity.mjs 규약: 데이터 yk → _done 디렉터리(A/B형 포함)
function resolveDirs(yk) {
  const dirs = [];
  for (const c of [`_done/${yk}`, `_done/${yk}A`, `_done/${yk}B`])
    if (fs.existsSync(c)) dirs.push(c);
  return dirs;
}

// 시험지 PDF 전체 텍스트(fitz, PYTHONUTF8). status: ok|image_only|no_pdf|extract_fail
function examTextFromPdf(yk) {
  const dirs = resolveDirs(yk);
  if (!dirs.length) return { text: null, status: "no_pdf" };
  for (const dir of dirs) {
    const hit = fs.readdirSync(dir).find((x) => x.endsWith("시험지.pdf"));
    if (!hit) continue;
    let raw = "";
    try {
      raw = execSync(
        `python3 -X utf8 -c "import fitz;dd=fitz.open('${dir}/${hit}');print(''.join(p.get_text() for p in dd))"`,
        {
          maxBuffer: 1e8,
          env: { ...process.env, PYTHONUTF8: "1", PYTHONIOENCODING: "utf-8" },
        },
      ).toString();
    } catch {
      return { text: null, status: "extract_fail" };
    }
    if (raw.trim().length === 0) return { text: null, status: "image_only" };
    return { text: raw, status: "ok" };
  }
  return { text: null, status: "no_pdf" };
}

const H = (s) => (s || "").replace(/[^가-힣]/g, ""); // 한글만
function bigrams(s) {
  const m = new Map();
  for (let i = 0; i < s.length - 1; i++) {
    const b = s.slice(i, i + 2);
    m.set(b, (m.get(b) || 0) + 1);
  }
  return m;
}
// containment: 데이터 블록 bigram 중 시험지 블록에 존재하는 비율 |a∩b|/|a|
// (시험지 블록이 길어도 견고 — "데이터 문항이 시험지에 실재하는가"를 측정)
function containment(a, b) {
  const A = bigrams(a);
  if (A.size === 0) return 1; // 빈 데이터는 판정 제외
  const B = bigrams(b);
  let inter = 0,
    tot = 0;
  for (const [k, v] of A) {
    tot += v;
    inter += Math.min(v, B.get(k) || 0);
  }
  return tot ? inter / tot : 1;
}

// 시험지 문항 앵커: 줄/공백 뒤의 "N. " (선지 ①②③ 및 연도 19XX년 등은 미포함)
function anchors(text) {
  const out = [];
  const re = /(?<!\d)(\d{1,2})\.\s/g;
  let m;
  while ((m = re.exec(text))) out.push({ num: +m[1], idx: m.index });
  return out;
}
// 특정 qNum 시험지 블록 후보(앵커→다음 앵커, 본문 도입부/최대 길이 컷)
function examBlocks(text, anc, qNum) {
  const blocks = [];
  for (let i = 0; i < anc.length; i++) {
    if (anc[i].num !== qNum) continue;
    const start = anc[i].idx;
    const end = i + 1 < anc.length ? anc[i + 1].idx : text.length;
    let seg = text.slice(start, end);
    const cut = seg.search(/\[\d+\s*[~∼\-]\s*\d+\]|다음 글을 읽고/);
    if (cut > 0) seg = seg.slice(0, cut);
    if (seg.length > CAP) seg = seg.slice(0, CAP);
    blocks.push(seg);
  }
  return blocks;
}

const suspects = [],
  positionSuspects = [],
  coverage = [],
  scanned = [];
const NS = (x) => String(x).replace(/\s+/g, ""); // 공백 제거(줄바꿈 무관 위치 매칭)
let scopeSets = 0,
  scopeQ = 0,
  scopeC = 0; // 검사 스코프 분모(§13⑮)
// Layer3 순열 의심 재확인: 시험지 ①~⑤ 블록을 마커로 분할 후, 데이터 각 선지를
//   최다 char-match(containment) 세그먼트에 배정. 데이터 num이 시험지 position과
//   identity면 정상순(pdftotext jitter 오탐) → true(FP). 역순이면 false(진짜).
//   5마커 블록 없으면 null(재확인 불가 → 원판정 유지).
function confirmOrder(rawBlocks, choices) {
  const CIRC = ["①", "②", "③", "④", "⑤"];
  for (const rb of rawBlocks) {
    const segs = {};
    let okMarkers = true;
    for (let i = 0; i < 5; i++) {
      const st = rb.indexOf(CIRC[i]);
      if (st < 0) {
        okMarkers = false;
        break;
      }
      const enRaw = i < 4 ? rb.indexOf(CIRC[i + 1], st + 1) : rb.length;
      const en = enRaw < 0 ? rb.length : enRaw;
      segs[i + 1] = H(rb.slice(st, en));
    }
    if (!okMarkers || Object.values(segs).some((x) => x.length < 5)) continue;
    let identity = true;
    for (const c of choices) {
      const ct = H(c.t);
      if (ct.length < 5) continue;
      let bestSeg = -1,
        bestScore = -1;
      for (const segNum of Object.keys(segs)) {
        const sc = containment(ct, segs[segNum]);
        if (sc > bestScore) {
          bestScore = sc;
          bestSeg = +segNum;
        }
      }
      if (bestSeg !== c.num) {
        identity = false;
        break;
      }
    }
    return identity; // true=정상순(FP) / false=역순(진짜)
  }
  return null; // 5마커 블록 없음 → 재확인 불가
}
const statusByYk = {};
for (const yk of Object.keys(d)) {
  if (ykFilter && yk !== ykFilter) continue;
  const { text, status } = examTextFromPdf(yk);
  statusByYk[yk] = status;
  if (!text) {
    coverage.push(`${yk}: 시험지 미대조 (status=${status})`);
    continue;
  }
  const anc = anchors(text);
  const examNums = new Set(
    anc.map((a) => a.num).filter((n) => n >= 1 && n <= 45),
  );
  // 앵커가 거의 없으면 추출 실패/image-only(저작권 문구만) → 대조 불가, 미대조 처리
  if (examNums.size < (cfg.min_exam_anchors ?? 5)) {
    statusByYk[yk] = "no_anchors";
    coverage.push(
      `${yk}: 시험지 앵커 ${examNums.size}개 — 추출실패/image-only 추정 (status=no_anchors)`,
    );
    continue;
  }
  const dataQ = [];
  for (const cat of ["reading", "literature"])
    for (const s of d[yk][cat] || []) {
      // 검사 스코프 분모 집계(§13⑮) — 실제 순회분만
      scopeSets++;
      scopeQ += (s.questions || []).length;
      scopeC += (s.questions || []).reduce(
        (a, _q) => a + (_q.choices || []).length,
        0,
      );
      for (const q of s.questions || []) dataQ.push({ s, q });
    }
  if (!dataQ.length) continue;
  const dataNums = new Set(dataQ.map((x) => x.q.id));
  // Layer 1 — 커버리지: 데이터 범위 내 시험지 문항 누락/추가
  const lo = Math.min(...dataNums),
    hi = Math.max(...dataNums);
  const missing = [...examNums]
    .filter((n) => n >= lo && n <= hi && !dataNums.has(n))
    .sort((a, b) => a - b);
  const extra = [...dataNums]
    .filter((n) => !examNums.has(n))
    .sort((a, b) => a - b);
  if (missing.length || extra.length)
    coverage.push(
      `${yk}: 누락(데이터無)=[${missing.join(",")}] 추가(시험無)=[${extra.join(",")}]`,
    );
  // Layer 2 — 블록 유사도
  for (const { s, q } of dataQ) {
    const dataBlock = H(q.t + (q.choices || []).map((c) => c.t).join(""));
    if (dataBlock.length < MIN) continue;
    const blocks = examBlocks(text, anc, q.id).map(H);
    const sim = blocks.length
      ? Math.max(...blocks.map((b) => containment(dataBlock, b)))
      : 0;
    const row = {
      yk,
      setId: s.id,
      q: q.id,
      sim: +sim.toFixed(3),
      anchored: blocks.length > 0,
    };
    scanned.push(row);
    if (sim < SIM) suspects.push(row);

    // Layer 3 — 위치-민감 선지 대조: 데이터 선지가 시험지 블록에서 num 순으로
    //   출현하는지. 순서 역전/오배치 = 정답 번호가 틀린 선지 지시(오학습).
    //   containment(위치 무관)·answer_fidelity(번호만)가 못 잡는 사각.
    //   시험지 블록에서 각 선지 앞부분(≥18자) 위치를 찾아, num 순 위치가 단조
    //   증가하지 않으면 flag. 미발견 선지(운문/古語/이미지)는 제외, 판정엔 ≥3 필요.
    const rawBlocks = examBlocks(text, anc, q.id);
    let best = null;
    for (const rb of rawBlocks) {
      const nb = NS(rb);
      const found = [];
      for (const c of q.choices || []) {
        const key = NS(c.t).slice(0, 18);
        if (key.length < 18) continue; // 짧은 선지(오탐 위험) 제외
        const pos = nb.indexOf(key);
        if (pos >= 0) found.push({ num: c.num, pos });
      }
      if (!best || found.length > best.length) best = found;
    }
    if (best && best.length >= 3) {
      const seq = best.slice().sort((a, b) => a.num - b.num);
      // tie(공유 prefix로 동일 pos) 허용 — 진짜 역행(pos 감소)만 flag
      const inc = seq.every((x, i) => i === 0 || x.pos >= seq[i - 1].pos);
      // 순열 의심 시 시험지 ①~⑤ 전문 char-match 재확인 → 정상순이면 FP 제외(jitter)
      const confirmed = !inc ? confirmOrder(rawBlocks, q.choices || []) : null;
      if (!inc && confirmed !== true)
        positionSuspects.push({
          yk,
          setId: s.id,
          q: q.id,
          found: best.length,
          order: seq.map((x) => x.num).join(""),
          posOrder: seq
            .slice()
            .sort((a, b) => a.pos - b.pos)
            .map((x) => x.num)
            .join(""),
        });
    }
  }
}
// ── 검사 스코프 분모 + 가드 (§13⑮: 분모 없는 "0건"은 무효 신호) ──
const _dataTotalSets = Object.keys(d).reduce(
  (a, yk) =>
    a +
    ["reading", "literature"].reduce(
      (b, c) => b + ((d[yk] || {})[c] || []).length,
      0,
    ),
  0,
);
console.log(
  `검사 스코프: 세트 ${scopeSets} / 문항 ${scopeQ} / 선지 ${scopeC} → 위반 ${suspects.length + positionSuspects.length}건`,
);
if (scopeSets === 0) {
  console.error("🔴 SCOPE_EMPTY — 검사 대상 0건. clean 판정 무효");
  process.exit(1);
}
if (!ykFilter && scopeSets !== _dataTotalSets)
  console.warn(
    `⚠️  SCOPE_DIFF — 전수 검사 ${scopeSets} ≠ 데이터 총 ${_dataTotalSets} (차 ${_dataTotalSets - scopeSets})`,
  );

suspects.sort((a, b) => a.sim - b.sim);
console.log(
  `구조 의심 문항: ${suspects.length} | 선지 순서 의심: ${positionSuspects.length} | 커버리지 이상 yk: ${coverage.length} | 스캔 문항: ${scanned.length} | 임계 sim<${SIM} | data=${dataPath}`,
);
console.log(
  "=== Layer3 선지 순서 의심 (데이터 num순 ≠ 시험지 출현순 = 정답 오지시) ===",
);
if (!positionSuspects.length) console.log("  (없음)");
positionSuspects.forEach((x) =>
  console.log(
    `  ${x.yk} ${x.setId} Q${x.q}: 데이터순 ${x.order} → 시험지 출현순 ${x.posOrder} (매칭 ${x.found})`,
  ),
);
console.log("=== Layer1 커버리지(범위 내 누락/추가) ===");
coverage.forEach((c) => console.log("  " + c));
console.log("=== Layer2 구조 의심 문항 (유사도 오름차순) ===");
suspects.forEach((x) =>
  console.log(
    `  ${x.yk} ${x.setId} Q${x.q}: sim=${x.sim}${x.anchored ? "" : " (앵커없음)"}`,
  ),
);
if (showAll) {
  console.log("=== 전체 스캔 유사도 (오름차순) ===");
  scanned
    .sort((a, b) => a.sim - b.sim)
    .forEach((x) => console.log(`  ${x.yk} ${x.setId} Q${x.q}: sim=${x.sim}`));
}
