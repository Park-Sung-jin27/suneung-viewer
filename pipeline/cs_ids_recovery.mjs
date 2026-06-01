/**
 * cs_ids_recovery.mjs — 영구 자산 도구 (1회성 X)
 *
 * 역할:
 *   1. set_safety 등급 분류 (safe / suspect / rebuild_needed)
 *   2. cs_ids 후보 자동 생성 (read-only, all_data_204.json 수정 X)
 *   3. Day 1 리포트 출력 (set_safety 분포 + 자동/배치/수동 분류 수)
 *
 * 일반화 원칙:
 *   - yearKey hardcode X (Object.keys(all_data) 자동 순회)
 *   - setId 컨벤션 hardcode X (sentId → sent.t 매핑만 사용)
 *   - 영역 분류 hardcode X (reading/literature 외 신규 영역 자동 인식 — sets 배열인 키 모두 처리)
 *   - 임계값 hardcode X (config/cs_ids_recovery_thresholds.json)
 *   - marker 문자 집합 hardcode X (config/marker_chars.json)
 *
 * 출력:
 *   - pipeline/output/cs_ids_candidates.json
 *   - pipeline/output/day1_report.md
 *
 * 사용:
 *   node pipeline/cs_ids_recovery.mjs                  # 전체 set 처리
 *   node pipeline/cs_ids_recovery.mjs --scope=2025수능  # 특정 yearKey 만
 *   node pipeline/cs_ids_recovery.mjs --setId=r2025b   # 특정 set 만
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

const DATA_PATH = path.join(ROOT, "public/data/all_data_204.json");
const ANN_PATH = path.join(ROOT, "public/data/annotations.json");
const THRESH_PATH = path.join(ROOT, "config/cs_ids_recovery_thresholds.json");
const MARKER_PATH = path.join(ROOT, "config/marker_chars.json");
const OUTPUT_DIR = path.join(ROOT, "pipeline/output");

const TOOL_VERSION = "3.0"; // v3: 전역 sentIndex 폐기 — setId 충돌 (LEGACY A/B형 33 set) 대응

// ── CLI args ─────────────────────────────────────────────
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? true];
  }),
);
const scopeYear = args.scope || null;
const scopeSetId = args.setId || null;

// ── load configs ─────────────────────────────────────────
const data = JSON.parse(fs.readFileSync(DATA_PATH, "utf-8"));
const anns = JSON.parse(fs.readFileSync(ANN_PATH, "utf-8"));
const thresh = JSON.parse(fs.readFileSync(THRESH_PATH, "utf-8"));
const markerCfg = JSON.parse(fs.readFileSync(MARKER_PATH, "utf-8"));
const PASSAGE_MARKERS = new Set(markerCfg.passage_markers);

if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

// v3: 전역 sentIndex 폐기.
// 이유: 동일 setId 가 다른 yearKey 에 중복 존재 (LEGACY A/B형 33 set) 시 sent.t 가
//       덮어쓰여 검수 보드 표시 + annotation 안전 등급 검증이 잘못 동작.
// 대안: annotation 검증 / sentText 표시 모두 해당 set 의 sents 만 lookup.

// ── set 순회 (영역 자동 인식) ────────────────────────────
function* iterSets() {
  for (const [yk, year] of Object.entries(data)) {
    if (scopeYear && yk !== scopeYear) continue;
    if (!year || typeof year !== "object") continue;
    for (const [areaKey, areaArr] of Object.entries(year)) {
      if (!Array.isArray(areaArr)) continue;
      for (const set of areaArr) {
        if (!set || !set.id) continue;
        if (scopeSetId && set.id !== scopeSetId) continue;
        yield { yearKey: yk, area: areaKey, set };
      }
    }
  }
}

// ── set_safety 분류 ──────────────────────────────────────
function classifySetSafety(yearKey, area, set) {
  const sents = set.sents || [];
  const realSents = sents.filter(
    (s) =>
      !["workTag", "author", "omission", "footnote", "image", "figure"].includes(
        s.sentType || "",
      ),
  );
  const sentCount = realSents.length;
  const qCount = (set.questions || []).length;

  // v2 보강: set 내 sentId 중복 감지 — (가)/(나) 두 지문 sent.id 가 같은 번호로 등록된 결함.
  // duplicate_sent_id 인 set 은 자동 후보 생성 / 자동 반영 금지 (식별자 결함 우선 해결 의무).
  const sentIdCount = {};
  for (const s of sents) {
    const id = s.id || "";
    if (!id) continue;
    sentIdCount[id] = (sentIdCount[id] || 0) + 1;
  }
  const dupIds = Object.keys(sentIdCount).filter((k) => sentIdCount[k] > 1);
  const hasDuplicateSentId = dupIds.length > 0;

  // 영역 추정 (config-free): area 키 또는 set.id prefix
  const isLiterature = area === "literature" || set.id?.startsWith("l");
  const minSent = isLiterature
    ? thresh.set_safety_classification.safe_requires.sent_count_min_literature
    : thresh.set_safety_classification.safe_requires.sent_count_min_reading;

  // annotation 결함 카운트 (v3: set 내부 sents 기준)
  const annList = anns?.[yearKey]?.[set.id] || [];
  const localSentMap = new Map();
  for (const s of sents) {
    if (s.id) localSentMap.set(s.id, s.t || "");
  }
  let deadSentId = 0,
    textMismatch = 0;
  for (const e of annList) {
    if (!["underline", "marker"].includes(e.type)) continue;
    const sId = e.sentId;
    if (!sId) continue;
    if (!localSentMap.has(sId)) {
      deadSentId++;
      continue;
    }
    if (e.text && !localSentMap.get(sId).includes(e.text)) textMismatch++;
  }
  const annTotal = annList.filter((e) =>
    ["underline", "marker"].includes(e.type),
  ).length;
  const deadRatio = annTotal ? (deadSentId + textMismatch) / annTotal : 0;

  // v2 보강: 본문 marker pool 확장 — sent.t + bogi text + bogi.diagram.items[].label + annotation.marker
  // 학생 화면에 marker 가 노출되는 모든 source 인정. r2023d (bogi marker), r2025c (bogi.diagram), l2025d (annotation marker) false positive 제거.
  const bodyMarkers = new Set();
  // (a) sent.t
  for (const s of sents) {
    for (const ch of s.t || "") if (PASSAGE_MARKERS.has(ch)) bodyMarkers.add(ch);
  }
  // (b) bogi text + bogi.diagram.items[].label
  for (const q of set.questions || []) {
    const bogi = q.bogi;
    if (typeof bogi === "string") {
      for (const ch of bogi) if (PASSAGE_MARKERS.has(ch)) bodyMarkers.add(ch);
    } else if (bogi && typeof bogi === "object") {
      const t = bogi.text || bogi.description || "";
      for (const ch of t) if (PASSAGE_MARKERS.has(ch)) bodyMarkers.add(ch);
      // bogi.diagram items
      if (Array.isArray(bogi.items)) {
        for (const it of bogi.items) {
          const lbl = it.label || "";
          for (const ch of lbl) if (PASSAGE_MARKERS.has(ch)) bodyMarkers.add(ch);
        }
      }
    }
  }
  // (c) annotation.marker 필드
  for (const e of annList) {
    if (e.marker && PASSAGE_MARKERS.has(e.marker)) bodyMarkers.add(e.marker);
  }

  // 해설/stem/선지/bogi 안 인용된 marker (= reference markers)
  const analysisMarkers = new Set();
  for (const q of set.questions || []) {
    const stem = q.stem || q.t || "";
    for (const ch of stem) if (PASSAGE_MARKERS.has(ch)) analysisMarkers.add(ch);
    for (const c of q.choices || []) {
      const cText = typeof c === "string" ? c : (c.text || c.t || "");
      for (const ch of cText) if (PASSAGE_MARKERS.has(ch)) analysisMarkers.add(ch);
      for (const ch of c.analysis || "")
        if (PASSAGE_MARKERS.has(ch)) analysisMarkers.add(ch);
    }
  }
  const markerMissing = [...analysisMarkers].filter((m) => !bodyMarkers.has(m));
  // markerMissing > 0 인 경우 후보:
  //   (i) 본문 추출 결함 (PDF 에 marker 있는데 sent.t 누락) — 정정 path
  //   (ii) LLM 환각 (PDF 에 marker 없는데 해설/stem 에 환각 추가) — 정정 path
  // 도구는 둘 구분 못 함 → 사용자 PDF cross-check 의무. 결과를 hallucination_suspect 로 표시.

  const flags = {
    sent_below_min: sentCount < minSent,
    qc_ratio_violation:
      qCount > 0 && sentCount / qCount < (isLiterature ? 1.5 : 3.0),
    annotation_dead_or_mismatch: deadSentId + textMismatch > 0,
    body_marker_extraction_broken: markerMissing.length > 0,
    hallucination_suspect: markerMissing.length > 0, // v2: marker 환각 또는 본문 누락 — PDF cross-check 필수
    duplicate_sent_id: hasDuplicateSentId, // v2: sentId 중복 — 자동 반영 금지
    duplicate_ids_count: dupIds.length,
    dead_ratio: deadRatio,
    // diagnosis 정보
    body_markers: [...bodyMarkers].sort(),
    analysis_markers: [...analysisMarkers].sort(),
    missing_markers: markerMissing.sort(),
  };

  let grade = "safe";
  // v2: sentId 중복 set 은 식별자 결함 — 자동 처리 금지 등급
  if (hasDuplicateSentId) {
    grade = "duplicate_sentid_hold";
  } else if (
    flags.sent_below_min ||
    flags.qc_ratio_violation ||
    flags.dead_ratio >=
      thresh.set_safety_classification.rebuild_needed_if.annotation_dead_ratio_above
  ) {
    grade = "rebuild_needed";
  } else if (
    flags.annotation_dead_or_mismatch ||
    flags.body_marker_extraction_broken
  ) {
    grade = "suspect";
  }
  return { grade, flags, sentCount, qCount, markerMissing, deadSentId, textMismatch };
}

// ── analysis 안 인용문 추출 + cs_ids 후보 점수화 ──────────
// 인용 패턴: 한국어 따옴표 + 영문 따옴표 모두 처리
const QUOTE_PATTERNS = [
  /"([^"]+)"/g,
  /“([^”]+)”/g,
  /'([^']+)'/g,
  /‘([^’]+)’/g,
];

function extractQuotes(text) {
  if (!text) return [];
  const out = [];
  for (const re of QUOTE_PATTERNS) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text)) !== null) {
      if (m[1] && m[1].trim().length >= thresh.auto_apply_hard_conditions.min_quote_length_chars)
        out.push(m[1].trim());
    }
  }
  return [...new Set(out)];
}

// sent.t 안 quote 일치 검색 (정확 substring + 정규화 substring)
function findSentMatches(quote, setSents) {
  const matches = [];
  for (const sent of setSents) {
    const t = sent.t || "";
    if (t.includes(quote)) {
      matches.push({ sentId: sent.id, exact: true });
      continue;
    }
    // 마커 문자 무시한 정규화 매칭
    const norm = [...t].filter((ch) => !PASSAGE_MARKERS.has(ch)).join("");
    const qNorm = [...quote].filter((ch) => !PASSAGE_MARKERS.has(ch)).join("");
    if (qNorm.length >= thresh.auto_apply_hard_conditions.min_quote_length_chars && norm.includes(qNorm)) {
      matches.push({ sentId: sent.id, exact: false });
    }
  }
  return matches;
}

// ── choice 별 cs_ids 후보 산출 ─────────────────────────────
function scoreChoice(setObj, q, c, safetyGrade) {
  const analysis = c.analysis || "";
  const existingCs = c.cs_ids || [];
  const quotes = extractQuotes(analysis);
  if (quotes.length === 0)
    return {
      quotes: [],
      candidates: [],
      decision: "no_quote_extractable",
    };

  // v3: setObj 내부 sents 의 sentId → sent.t map (전역 sentIndex 폐기 대안)
  const localSentMap = new Map();
  for (const s of setObj.sents || []) {
    if (s.id) localSentMap.set(s.id, s.t || "");
  }

  // 후보 sent별 점수 집계
  const scoreMap = new Map(); // sentId → {score, hits, exactCount, quotesMatched}
  for (const q_ of quotes) {
    const matches = findSentMatches(q_, setObj.sents || []);
    if (matches.length === 0) continue;
    // 매칭 unique 여부 = 자동 반영 hard 조건
    for (const m of matches) {
      const cur = scoreMap.get(m.sentId) || {
        score: 0,
        exactCount: 0,
        quotesMatched: [],
        normCount: 0,
      };
      const inc = m.exact ? 1.0 : 0.6;
      cur.score += inc;
      if (m.exact) cur.exactCount += 1;
      else cur.normCount += 1;
      cur.quotesMatched.push(q_);
      scoreMap.set(m.sentId, cur);
    }
  }

  // 정규화 점수 (quotes 수 기반)
  const candidates = [...scoreMap.entries()]
    .map(([sentId, v]) => ({
      sentId,
      raw_score: v.score,
      normalized_score: v.score / quotes.length,
      exact_count: v.exactCount,
      norm_count: v.normCount,
      quotes_matched: v.quotesMatched,
      sentText: (localSentMap.get(sentId) || "").slice(0, 120),
    }))
    .sort((a, b) => b.normalized_score - a.normalized_score);

  // 자동 반영 hard 조건 평가
  const hard = thresh.auto_apply_hard_conditions;
  const top = candidates[0];
  const runner = candidates[1];
  const gap = top && runner ? top.normalized_score - runner.normalized_score : top ? 1.0 : 0;
  const isUnique =
    quotes.every((qq) => findSentMatches(qq, setObj.sents || []).length <= 1) &&
    candidates.length >= 1;

  const passAuto =
    safetyGrade === hard.set_safety_required &&
    hard.existing_cs_ids_must_be_empty &&
    existingCs.length === 0 &&
    top &&
    top.normalized_score >= hard.min_score &&
    gap >= hard.min_top_vs_runner_up_gap &&
    isUnique &&
    quotes.some((qq) => qq.length >= hard.min_quote_length_chars);

  let decision;
  // v2: duplicate_sentid_hold set 은 자동/배치 모두 금지 — 식별자 결함 우선 정정 의무
  if (safetyGrade === "duplicate_sentid_hold") decision = "duplicate_sentid_hold";
  else if (passAuto) decision = "auto_apply";
  else if (
    top &&
    top.normalized_score >= thresh.batch_review_band.min_score &&
    top.normalized_score < thresh.batch_review_band.max_score
  )
    decision = "batch_review";
  else if (top && top.normalized_score >= hard.min_score && !passAuto)
    decision = "batch_review"; // hard 미충족인 high score = batch
  else decision = "manual_needed";

  return {
    quotes,
    candidates: candidates.slice(0, 5),
    decision,
    hard_checks: {
      safe_grade: safetyGrade === hard.set_safety_required,
      existing_empty: existingCs.length === 0,
      unique_match: isUnique,
      top_score: top?.normalized_score ?? 0,
      gap,
      quote_long_enough: quotes.some(
        (qq) => qq.length >= hard.min_quote_length_chars,
      ),
    },
  };
}

// ── 메인 ────────────────────────────────────────────────
const candidatesOut = [];
const safetyDist = { safe: 0, suspect: 0, rebuild_needed: 0, duplicate_sentid_hold: 0 };
const decisionDist = {
  auto_apply: 0,
  batch_review: 0,
  manual_needed: 0,
  no_quote_extractable: 0,
  duplicate_sentid_hold: 0,
};
let totalChoicesEmpty = 0;
let totalChoicesAll = 0;
const safetyDetail = [];

for (const { yearKey, area, set } of iterSets()) {
  const safety = classifySetSafety(yearKey, area, set);
  safetyDist[safety.grade]++;
  safetyDetail.push({
    yearKey,
    setId: set.id,
    area,
    grade: safety.grade,
    sent_count: safety.sentCount,
    q_count: safety.qCount,
    flags: safety.flags,
    body_marker_missing: safety.markerMissing,
  });

  for (const q of set.questions || []) {
    for (const c of q.choices || []) {
      totalChoicesAll++;
      // cs_ids 비어있는 choice 만 후보 산출 (덮어쓰기 금지)
      if ((c.cs_ids || []).length > 0) continue;
      // ok:false + 비왜곡 pat (V, R3 등) 은 cs_ids 의무 없음 — 제외
      const pat = c.pat;
      const okBool = c.ok;
      const need = okBool === true || (okBool === false && ["R1","R2","R4","L1","L2","L4","L5"].includes(pat));
      if (!need) continue;
      totalChoicesEmpty++;

      const r = scoreChoice(set, q, c, safety.grade);
      decisionDist[r.decision]++;
      candidatesOut.push({
        yearKey,
        area, // v3: setId 충돌 대응 (apply 안전장치 + 검수 보드 source_ref)
        setId: set.id,
        questionId: q.id,
        choiceNum: c.num,
        ok: okBool,
        pat,
        currentCsIds: [],
        set_safety: safety.grade,
        analysis_quotes: r.quotes,
        candidates: r.candidates,
        hard_checks: r.hard_checks || null,
        decision: r.decision,
      });
    }
  }
}

// ── 출력 ────────────────────────────────────────────────
fs.writeFileSync(
  path.join(OUTPUT_DIR, "cs_ids_candidates.json"),
  JSON.stringify(
    {
      tool_version: TOOL_VERSION,
      generated_at: new Date().toISOString(),
      thresholds: thresh,
      scope: { yearKey: scopeYear, setId: scopeSetId },
      totals: {
        total_choices_all: totalChoicesAll,
        total_choices_empty_needing_cs: totalChoicesEmpty,
        safety_distribution: safetyDist,
        decision_distribution: decisionDist,
      },
      safety_detail: safetyDetail,
      candidates: candidatesOut,
    },
    null,
    2,
  ),
  "utf-8",
);

// ── Day 1 리포트 (Markdown) ─────────────────────────────
const report = [];
report.push(`# Day 1 리포트 — cs_ids_recovery dry-run`);
report.push(``);
report.push(`- tool_version: ${TOOL_VERSION}`);
report.push(`- generated_at: ${new Date().toISOString()}`);
report.push(`- scope: yearKey=${scopeYear || "all"} setId=${scopeSetId || "all"}`);
report.push(``);
report.push(`## 결과 요약`);
report.push(``);
report.push(`| 항목 | 값 |`);
report.push(`|---|---|`);
report.push(`| 총 choice 수 | ${totalChoicesAll} |`);
report.push(`| cs_ids 비어있고 의무 있는 choice | ${totalChoicesEmpty} |`);
report.push(`| set_safety: safe | ${safetyDist.safe} |`);
report.push(`| set_safety: suspect | ${safetyDist.suspect} |`);
report.push(`| set_safety: rebuild_needed | ${safetyDist.rebuild_needed} |`);
report.push(`| set_safety: duplicate_sentid_hold | ${safetyDist.duplicate_sentid_hold || 0} |`);
report.push(``);
report.push(`## 자동/배치/수동 분류`);
report.push(``);
report.push(`| decision | count | 처리 path |`);
report.push(`|---|---|---|`);
report.push(`| auto_apply | ${decisionDist.auto_apply} | hard 6조건 만족 — Day 2 자동 반영 후보 |`);
report.push(`| batch_review | ${decisionDist.batch_review} | 검수 보드 v3.1 배치 승인 |`);
report.push(`| manual_needed | ${decisionDist.manual_needed} | 수동 정정 |`);
report.push(`| no_quote_extractable | ${decisionDist.no_quote_extractable} | 해설 안 따옴표 인용 없음 — 별도 path |`);
report.push(``);
report.push(`## 처리 비율`);
const denom = totalChoicesEmpty || 1;
const autoPct = ((decisionDist.auto_apply / denom) * 100).toFixed(1);
const batchPct = ((decisionDist.batch_review / denom) * 100).toFixed(1);
const manualPct = ((decisionDist.manual_needed / denom) * 100).toFixed(1);
const nqPct = ((decisionDist.no_quote_extractable / denom) * 100).toFixed(1);
report.push(``);
report.push(`- 자동 가능: ${autoPct}%`);
report.push("- manual needed: " + manualPct + "%");
report.push("- no quote: " + nqPct + "%");
report.push("");

fs.writeFileSync(path.join(OUTPUT_DIR, "day1_report.md"), report.join("\n"), "utf-8");

console.log("cs_ids_recovery v" + TOOL_VERSION + " done");
console.log("  candidates: " + candidatesOut.length);
console.log("  safety: safe=" + safetyDist.safe + " suspect=" + safetyDist.suspect + " rebuild=" + safetyDist.rebuild_needed + " duplicate_sentid_hold=" + (safetyDist.duplicate_sentid_hold||0));
console.log("done");

fs.writeFileSync(path.join(OUTPUT_DIR, "day1_report.md"), report.join("\n"), "utf-8");

console.log("cs_ids_recovery v" + TOOL_VERSION + " done");
console.log("  candidates: " + candidatesOut.length);
console.log("  safety: safe=" + safetyDist.safe + " suspect=" + safetyDist.suspect + " rebuild=" + safetyDist.rebuild_needed + " duplicate_sentid_hold=" + (safetyDist.duplicate_sentid_hold||0));
console.log("done");
