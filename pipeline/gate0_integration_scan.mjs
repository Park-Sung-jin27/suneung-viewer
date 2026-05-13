// Y.2 integration_map + source_asset_manifest 실제 scan
import fs from "fs";
import path from "path";

const PIPELINE_FILES = [
  { step: "step1_answer", file: "pipeline/step1_answer.js" },
  { step: "step2_extract", file: "pipeline/step2_extract.js" },
  { step: "step2_postprocess", file: "pipeline/step2_postprocess.mjs" },
  { step: "step3_analysis", file: "pipeline/step3_analysis.js" },
  { step: "step4_csids", file: "pipeline/step4_csids.js" },
  { step: "step5_verify", file: "pipeline/step5_verify.js" },
  { step: "step6_merge", file: "pipeline/step6_merge.js" },
  { step: "step7_deploy", file: "pipeline/step7_deploy.js" },
  { step: "reanalyze_bogi", file: "pipeline/reanalyze_bogi.js" },
  { step: "annotate", file: "pipeline/annotate.js" },
];

const D_ENGINE_FILES = [
  "pipeline/d_engine_wrapper.mjs",
  "pipeline/d_engine_caller_openai.mjs",
  "pipeline/d_engine_majority.mjs",
  "pipeline/run_dryrun_all.mjs",
];

function scanFile(filePath) {
  if (!fs.existsSync(filePath)) return { exists: false };
  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.split("\n");
  return {
    exists: true,
    line_count: lines.length,
    size_bytes: Buffer.byteLength(content, "utf8"),
    read_calls: (
      content.match(/fs\.readFileSync|fs\.readFile|fs\.createReadStream/g) || []
    ).length,
    write_calls: (
      content.match(/fs\.writeFileSync|fs\.writeFile|fs\.appendFileSync/g) || []
    ).length,
    throw_calls: (content.match(/throw\s+new\s+Error/g) || []).length,
    try_blocks: (content.match(/\btry\s*\{/g) || []).length,
    imports: content.match(/^import\s+.*from\s+["'][^"']+["']/gm) || [],
    d_engine_refs: (
      content.match(/d_engine|D엔진|callDEngine|callDEngineWithMajority/g) || []
    ).length,
    postprocess_calls: (
      content.match(/postProcess|applyDeterministicFooter|expectedFooter/g) ||
      []
    ).length,
    function_exports: (
      content.match(/^export\s+(async\s+)?function\s+\w+/gm) || []
    ).map((s) => s.replace(/^export\s+(async\s+)?function\s+/, "")),
  };
}

const steps = [];
for (const { step, file } of PIPELINE_FILES) {
  const scan = scanFile(file);
  steps.push({
    step,
    file,
    exists: scan.exists,
    line_count: scan.line_count,
    size_bytes: scan.size_bytes,
    fs_read_call_sites: scan.read_calls,
    fs_write_call_sites: scan.write_calls,
    throw_sites: scan.throw_calls,
    try_blocks: scan.try_blocks,
    calls_d_engine: (scan.d_engine_refs || 0) > 0,
    d_engine_ref_count: scan.d_engine_refs,
    calls_postprocess: (scan.postprocess_calls || 0) > 0,
    postprocess_call_count: scan.postprocess_calls,
    function_exports: scan.function_exports,
    gate_connection:
      step === "step5_verify"
        ? "Gate 1 사전 (deterministic validate)"
        : step === "step3_analysis"
          ? "B1 normalizer 도입 path"
          : null,
  });
}

const dEngineScan = {};
for (const f of D_ENGINE_FILES) {
  dEngineScan[f] = scanFile(f);
}

// production pipeline 안 D엔진 호출 site 검증
const stepFilesWithDEngine = steps
  .filter((s) => s.calls_d_engine)
  .map((s) => s.step);

const integrationMap = {
  _meta: {
    version: "vFinal",
    generated_at: new Date().toISOString(),
    scan_method: "real_code_scan",
    note: "stub 영구 제거 — 실제 fs.read/write/throw + import + function export site grep",
  },
  steps,
  d_engine: {
    production_integrated: stepFilesWithDEngine.length > 0,
    production_step_callers: stepFilesWithDEngine,
    mode:
      stepFilesWithDEngine.length === 0 ? "dryrun_only" : "production_active",
    caller_files: ["pipeline/run_dryrun_all.mjs"],
    wrapper_file: "pipeline/d_engine_wrapper.mjs",
    scan_results: dEngineScan,
    input_fields_actual: [
      "passage",
      "question_text",
      "choice_text",
      "analysis",
      "pat",
      "ok",
      "questionType",
      "bogi",
      "domain",
      "precheck_signals",
    ],
    missing_for_full_gate2: [
      "cs_ids",
      "referenced_sentences",
      "cs_spans",
      "work_boundary",
    ],
    can_validate: ["pat_meaning", "analysis_ok_pat_consistency"],
    cannot_validate: [
      "evidence_directness",
      "viewer_highlight",
      "pdf_source_fidelity",
    ],
    gate_role: "Gate 2-Lite",
  },
  b1_normalizer: {
    already_integrated: true,
    location: "pipeline/step3_analysis.js postProcess",
    function_names: ["expectedFooter", "applyDeterministicFooter"],
    safety_issues: [
      "expected === null 안 기존 analysis 반환 path — needs_human flag 부재 잠재 결함",
      "reanalyze 사후 B1 재호출 path 검증 의무 (Y.3 audit 진행)",
    ],
    audit_required: true,
    audit_turn: "Y.3 Step 4-1",
  },
};

fs.writeFileSync(
  "pipeline/integration_map.json",
  JSON.stringify(integrationMap, null, 2),
);
console.log("integration_map.json 도입 정합");
console.log("steps scanned:", steps.length);
console.log(
  "d_engine production_integrated:",
  integrationMap.d_engine.production_integrated,
);
console.log("d_engine mode:", integrationMap.d_engine.mode);

// ─── Step 3-4: source_asset_manifest examKey 별 row ──────────
const MAIN_DONE = "C:/Users/downf/suneung-viewer/_done";
const FREE_YEARS = ["2022수능", "2023수능", "2024수능", "2025수능", "2026수능"];

function scanForExamKey(examKey) {
  const candidates = { exam: [], answer: [] };
  // priority 1: _done/<examKey>/<examKey>_시험지.pdf
  const dirExam = `${MAIN_DONE}/${examKey}/${examKey}_시험지.pdf`;
  const dirAnswer = `${MAIN_DONE}/${examKey}/${examKey}_정답.pdf`;
  if (fs.existsSync(dirExam))
    candidates.exam.push({ path: dirExam, priority: 1, type: "directory" });
  if (fs.existsSync(dirAnswer))
    candidates.answer.push({ path: dirAnswer, priority: 1, type: "directory" });
  // priority 2: _done/<examKey>_시험지.pdf
  const directExam = `${MAIN_DONE}/${examKey}_시험지.pdf`;
  const directAnswer = `${MAIN_DONE}/${examKey}_정답.pdf`;
  if (fs.existsSync(directExam))
    candidates.exam.push({ path: directExam, priority: 2, type: "direct" });
  if (fs.existsSync(directAnswer))
    candidates.answer.push({ path: directAnswer, priority: 2, type: "direct" });
  // test files
  const testExam = `${MAIN_DONE}/${examKey}_test_시험지.pdf`;
  const testAnswer = `${MAIN_DONE}/${examKey}_test_정답.pdf`;
  if (fs.existsSync(testExam))
    candidates.exam.push({ path: testExam, priority: 99, type: "test" });
  if (fs.existsSync(testAnswer))
    candidates.answer.push({ path: testAnswer, priority: 99, type: "test" });

  return candidates;
}

function statInfo(p) {
  if (!p || !fs.existsSync(p)) return { size: null, mtime: null };
  const st = fs.statSync(p);
  return { size: st.size, mtime: st.mtime.toISOString() };
}

const manifest = {};
for (const yk of FREE_YEARS) {
  const cands = scanForExamKey(yk);

  // selected (priority 정합 단 test 제외)
  const examCands = cands.exam.filter((c) => c.priority < 99);
  const answerCands = cands.answer.filter((c) => c.priority < 99);
  examCands.sort((a, b) => a.priority - b.priority);
  answerCands.sort((a, b) => a.priority - b.priority);

  const selectedExam = examCands[0]?.path || null;
  const selectedAnswer = answerCands[0]?.path || null;

  let status;
  if (!selectedExam && !selectedAnswer) {
    status =
      cands.exam.some((c) => c.type === "test") ||
      cands.answer.some((c) => c.type === "test")
        ? "test_only"
        : "missing";
  } else if (!selectedExam || !selectedAnswer) status = "ambiguous";
  else status = "resolved";

  const examStat = statInfo(selectedExam);
  const answerStat = statInfo(selectedAnswer);

  manifest[yk] = {
    examKey: yk,
    candidate_exam_pdf_paths: cands.exam.map((c) => ({
      path: c.path,
      priority: c.priority,
      type: c.type,
    })),
    candidate_answer_pdf_paths: cands.answer.map((c) => ({
      path: c.path,
      priority: c.priority,
      type: c.type,
    })),
    selected_exam_pdf_path: selectedExam,
    selected_answer_pdf_path: selectedAnswer,
    status,
    selection_reason: selectedExam
      ? `priority_${examCands[0].priority}_${examCands[0].type}`
      : status === "test_only"
        ? "test_only_detected_production_path_missing"
        : "missing",
    size_bytes_exam: examStat.size,
    size_bytes_answer: answerStat.size,
    modified_time_exam: examStat.mtime,
    modified_time_answer: answerStat.mtime,
    is_test_file_exam: cands.exam.some((c) => c.type === "test"),
    is_test_file_answer: cands.answer.some((c) => c.type === "test"),
    duplicate_candidates:
      cands.exam.length > 1 ? cands.exam.map((c) => c.path) : [],
  };
}

const finalManifest = {
  _meta: {
    version: "vFinal",
    generated_at: new Date().toISOString(),
    scan_method: "real_pdf_scan",
    source_root: MAIN_DONE,
    scope: "FREE_YEARS (5건) — Scope B_NEAR + Scope C_LEGACY 별도 turn 진행",
  },
  examKeys: manifest,
};

fs.writeFileSync(
  "pipeline/source_asset_manifest.json",
  JSON.stringify(finalManifest, null, 2),
);
console.log("");
console.log("source_asset_manifest.json 도입 정합 (FREE_YEARS 5건)");
for (const yk of FREE_YEARS) {
  console.log(
    `  ${yk}: status=${manifest[yk].status} | exam=${manifest[yk].selected_exam_pdf_path ? "OK" : "X"} | answer=${manifest[yk].selected_answer_pdf_path ? "OK" : "X"}`,
  );
}
