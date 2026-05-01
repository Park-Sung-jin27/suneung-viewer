/**
 * pipeline/diagnose_llm_contamination.mjs
 *
 * 목적: 2025수능 데이터가 LLM 생성 문항인지 여부를 진단.
 * - 데이터 수정 금지 / template 수정 금지 — 오로지 진단 리포트만 생성.
 *
 * 방법:
 *  1) 2024/2025/2026 수능 각 exam에서 3문항 균등 샘플링 (reading 2 + literature 1, 가능한 경우)
 *  2) question_text / choice_text(#1~#5) / analysis_text(각 선지) 출력
 *  3) 간이 휴리스틱으로 is_llm_like_question 판정 + reason 기록
 *  4) pipeline/reports/llm_contamination_check.json 에 저장
 *
 * 휴리스틱 (전부 증거 약함 — 단일 지표 아닌 집계로 판단해야 함):
 *  H1. analysis_text 가 4단계 정형("📌 지문 근거"/"🔍"/"✅"/"❌") 로만 구성
 *  H2. analysis_text 가 '지문 근거:' 인용 없이 일반론만 서술 (지문 의존도 낮음)
 *  H3. choice_text 가 지나치게 완성형 — 결론어구("~이다", "~한다") 100% + 길이 편차 <10%
 *  H4. 선지 5개 중 핵심 명사구가 반복되는 "템플릿 라인" 흔적 (LLM 생성 특유)
 *  H5. analysis_text 안에 지문을 인용부호(“ ” 또는 " ")로 감싼 문장이 1건 이상 있음 → 인간/평가원 가능성↑ (H5 만족이면 의심 내림)
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DATA_PATH = path.join(ROOT, "public", "data", "all_data_204.json");
const OUT_DIR = path.join(ROOT, "pipeline", "reports");
const OUT_PATH = path.join(OUT_DIR, "llm_contamination_check.json");

const EXAMS = ["2024수능", "2025수능", "2026수능"];
const SAMPLES_PER_EXAM = 3;

if (!fs.existsSync(DATA_PATH)) {
  console.error(`❌ 데이터 없음: ${DATA_PATH}`);
  process.exit(1);
}
const data = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));

// ── 결정적 샘플링 (시드 고정으로 재현 가능) ─────────────────────────────────
function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

function collectQuestions(exam) {
  const e = data[exam];
  if (!e) return [];
  const bag = [];
  for (const [section, domain] of [["reading", "R"], ["literature", "L"]]) {
    for (const set of e[section] || []) {
      for (const q of set.questions || []) {
        bag.push({
          exam,
          section,
          domain,
          set_id: set.id,
          set_title: set.title || null,
          question_id: q.id,
          question_text: q.t ?? null,
          bogi_text: q.bogi ?? null,
          choices: q.choices || [],
        });
      }
    }
  }
  return bag;
}

// 균등 샘플링: reading 2 + literature 1 (exam 별 시드 고정)
function pickSamples(exam) {
  const all = collectQuestions(exam);
  const rand = seeded(
    exam.split("").reduce((a, c) => a + c.charCodeAt(0), 17),
  );
  const reading = all.filter((q) => q.section === "reading");
  const literature = all.filter((q) => q.section === "literature");
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  const picked = [...shuffle(reading).slice(0, 2), ...shuffle(literature).slice(0, 1)];
  // 부족 시 총 SAMPLES_PER_EXAM 까지 채움
  if (picked.length < SAMPLES_PER_EXAM) {
    for (const q of shuffle(all)) {
      if (picked.length >= SAMPLES_PER_EXAM) break;
      if (!picked.includes(q)) picked.push(q);
    }
  }
  return picked.slice(0, SAMPLES_PER_EXAM);
}

// ── 휴리스틱 ────────────────────────────────────────────────────────────────
const ICON_MARKERS = ["📌", "🔍", "✅", "❌"];
const QUOTE_RE = /["“][^"”]{8,}["”]/;
const PASSAGE_CUE_RE = /지문\s*근거|윗글|본문|\(가\)|\(나\)|\(다\)|㉠|㉡|㉢|㉣|㉤|㉥/;

function scoreAnalysis(an) {
  const txt = String(an || "");
  const hasIcons = ICON_MARKERS.every((m) => txt.includes(m));
  const hasAny = ICON_MARKERS.some((m) => txt.includes(m));
  const hasQuote = QUOTE_RE.test(txt);
  const hasPassageCue = PASSAGE_CUE_RE.test(txt);
  return { hasIcons, hasAny, hasQuote, hasPassageCue, length: txt.length };
}

function diagnoseQuestion(q) {
  const reasons = [];
  const analyses = (q.choices || []).map((c) => scoreAnalysis(c.analysis));
  const nChoices = analyses.length || 1;
  const iconAllRate = analyses.filter((a) => a.hasIcons).length / nChoices;
  const iconAnyRate = analyses.filter((a) => a.hasAny).length / nChoices;
  const quoteRate = analyses.filter((a) => a.hasQuote).length / nChoices;
  const passageCueRate = analyses.filter((a) => a.hasPassageCue).length / nChoices;

  // H1: 전 선지 4아이콘 전부 포함 → 정형 LLM 포맷 의심
  const H1 = iconAllRate >= 0.8;
  if (H1) reasons.push("H1_all_4icons_template");

  // H2: 인용/지문 cue 비율 모두 낮음 → 지문 의존도 낮음
  const H2 = quoteRate < 0.3 && passageCueRate < 0.4;
  if (H2) reasons.push("H2_no_passage_reference");

  // H3: 선지 길이 편차 10% 미만 + 모두 "~이다/~한다/~군" 로 끝남 → 템플릿 생성 의심
  const lens = (q.choices || []).map((c) => (c.t || "").length);
  if (lens.length >= 3) {
    const avg = lens.reduce((a, b) => a + b, 0) / lens.length;
    const maxDev = Math.max(...lens.map((l) => Math.abs(l - avg))) / (avg || 1);
    const endsPattern = (q.choices || []).every((c) =>
      /(?:이다|한다|았다|었다|된다|군\.?|있다|없다|이다\.?)$/.test(
        (c.t || "").trim().replace(/[.\s]+$/, ""),
      ),
    );
    const H3 = maxDev < 0.1 && endsPattern;
    if (H3) reasons.push("H3_uniform_length_and_endings");
  }

  // H4: 선지 5개 중 3개 이상에서 동일 핵심 명사구가 반복(첫 15자) — 템플릿 라인 의심
  const prefixes = (q.choices || []).map((c) => (c.t || "").slice(0, 15));
  const prefixCounts = {};
  for (const p of prefixes) prefixCounts[p] = (prefixCounts[p] || 0) + 1;
  const maxRepeat = Math.max(0, ...Object.values(prefixCounts));
  const H4 = maxRepeat >= 3;
  if (H4) reasons.push("H4_repeated_prefix_line");

  // H5: 인용구 1건 이상 + 지문 cue 1건 이상 → 평가원 가능성 ↑ (의심 감산)
  const hasHumanCue = quoteRate >= 0.2 || passageCueRate >= 0.4;
  if (hasHumanCue) reasons.push("H5_human_like_passage_citation");

  // 종합 판정
  const suspectScore =
    (H1 ? 2 : 0) +
    (H2 ? 2 : 0) +
    (reasons.includes("H3_uniform_length_and_endings") ? 1 : 0) +
    (H4 ? 1 : 0) -
    (hasHumanCue ? 2 : 0);
  const llm_suspected = suspectScore >= 2;

  return {
    exam: q.exam,
    section: q.section,
    set_id: q.set_id,
    set_title: q.set_title,
    question_id: q.question_id,
    question_text: q.question_text,
    bogi_text: q.bogi_text,
    choices: (q.choices || []).map((c) => ({
      num: c.num,
      choice_text: c.t ?? null,
      analysis_text: c.analysis ?? null,
    })),
    metrics: {
      icon_all_rate: +iconAllRate.toFixed(2),
      icon_any_rate: +iconAnyRate.toFixed(2),
      quote_rate: +quoteRate.toFixed(2),
      passage_cue_rate: +passageCueRate.toFixed(2),
      avg_analysis_len:
        +(analyses.reduce((a, b) => a + b.length, 0) / nChoices).toFixed(1),
    },
    llm_suspected,
    suspect_score: suspectScore,
    reason: reasons.join(" · ") || "none",
  };
}

// ── 실행 ────────────────────────────────────────────────────────────────────
const perExamEntries = {};
const flatEntries = [];
for (const exam of EXAMS) {
  const picked = pickSamples(exam);
  const diag = picked.map(diagnoseQuestion);
  perExamEntries[exam] = diag;
  flatEntries.push(...diag);
}

// 요약 통계
function summarize(entries) {
  const total = entries.length;
  const suspected = entries.filter((e) => e.llm_suspected).length;
  const iconAllAvg =
    entries.reduce((a, e) => a + e.metrics.icon_all_rate, 0) / (total || 1);
  const quoteAvg =
    entries.reduce((a, e) => a + e.metrics.quote_rate, 0) / (total || 1);
  const passageCueAvg =
    entries.reduce((a, e) => a + e.metrics.passage_cue_rate, 0) / (total || 1);
  return {
    total,
    suspected,
    suspected_rate: total ? +(suspected / total).toFixed(2) : 0,
    icon_all_rate_avg: +iconAllAvg.toFixed(2),
    quote_rate_avg: +quoteAvg.toFixed(2),
    passage_cue_rate_avg: +passageCueAvg.toFixed(2),
  };
}
const perExamSummary = {};
for (const ex of EXAMS) perExamSummary[ex] = summarize(perExamEntries[ex]);

const out = {
  meta: {
    generated_at: new Date().toISOString(),
    generator: "diagnose_llm_contamination.mjs",
    data_file: path.relative(ROOT, DATA_PATH),
    exams: EXAMS,
    samples_per_exam: SAMPLES_PER_EXAM,
    sampling_strategy: "reading ×2 + literature ×1 (seeded per exam)",
    heuristics: {
      H1: "all 4 icons (📌🔍✅❌) present in ≥80% of choice analyses — LLM template",
      H2: "quote_rate<0.3 AND passage_cue_rate<0.4 — low passage dependency",
      H3: "choice length deviation <10% AND all end with 이다/한다/군 — uniform template",
      H4: "3+ choices share same first-15-char prefix — repeated-line template",
      H5: "quote_rate≥0.2 OR passage_cue_rate≥0.4 — human/평가원-like (REDUCES suspicion)",
      scoring:
        "suspect_score = 2·H1 + 2·H2 + 1·H3 + 1·H4 − 2·H5; llm_suspected when score ≥ 2",
    },
    caveat:
      "이 스크립트는 '의심 점수'만 제공. 단일 문항 판정은 불완전하며, 동일 exam 내 exam-wide suspected_rate 가 주요 판단 근거. 데이터 수정 금지.",
  },
  per_exam_summary: perExamSummary,
  entries: flatEntries,
};

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2), "utf8");

// ── 콘솔 ────────────────────────────────────────────────────────────────────
console.log("═".repeat(64));
console.log(" diagnose_llm_contamination");
console.log("═".repeat(64));
for (const ex of EXAMS) {
  const s = perExamSummary[ex];
  console.log(
    `\n[${ex}] suspected ${s.suspected}/${s.total} (${(s.suspected_rate * 100).toFixed(0)}%) · icon_all_avg=${s.icon_all_rate_avg} · quote_avg=${s.quote_rate_avg} · passage_cue_avg=${s.passage_cue_rate_avg}`,
  );
  for (const e of perExamEntries[ex]) {
    const tag = e.llm_suspected ? "🔴 suspected" : "🟢 human-like";
    console.log(
      `  ${tag}  ${e.exam}/${e.set_id}/Q${e.question_id}  score=${e.suspect_score}  reasons=${e.reason}`,
    );
    console.log(`     Q: ${(e.question_text || "").slice(0, 70)}`);
    const c1 = e.choices?.[0];
    if (c1) {
      console.log(`     #1: ${(c1.choice_text || "").slice(0, 70)}`);
      console.log(`     an: ${(c1.analysis_text || "").slice(0, 100).replace(/\n/g, " / ")}`);
    }
  }
}

// exam-wide 최종 판단 힌트
console.log(`\n${"─".repeat(64)}`);
console.log(" exam-wide 판단 힌트 (단일 샘플 아닌 비율 기반):");
for (const ex of EXAMS) {
  const s = perExamSummary[ex];
  let verdict = "inconclusive";
  if (s.suspected_rate >= 0.66) verdict = "likely_fully_generated";
  else if (s.suspected_rate >= 0.33) verdict = "possibly_partial_contamination";
  else if (s.quote_rate_avg >= 0.3 || s.passage_cue_rate_avg >= 0.4)
    verdict = "likely_human_authored";
  console.log(`  · ${ex}: ${verdict} (suspected_rate=${s.suspected_rate})`);
}
console.log(`\n📄 저장: ${path.relative(ROOT, OUT_PATH)}`);
console.log(
  `\n⚠️ 이 리포트는 진단만. 데이터/템플릿 수정 금지. 샘플 3건 기반은 방향 힌트이며 확증 아님.`,
);
