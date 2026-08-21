// Y.3a — _inbox + _done 양쪽 scan + source_asset_manifest 재산출
import fs from "fs";
import crypto from "crypto";

const MAIN_DONE = "C:/Users/downf/suneung-viewer/_done";
const MAIN_INBOX = "C:/Users/downf/suneung-viewer/_inbox";
const FREE_YEARS = ["2022수능", "2023수능", "2024수능", "2025수능", "2026수능"];

function sha256File(p) {
  if (!fs.existsSync(p)) return null;
  return crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex");
}

function statInfo(p) {
  if (!p || !fs.existsSync(p)) return { size: null, mtime: null, sha256: null };
  const st = fs.statSync(p);
  return {
    size: st.size,
    mtime: st.mtime.toISOString(),
    sha256: sha256File(p),
  };
}

function classifyName(filename) {
  if (/test/i.test(filename)) return "test_name";
  if (/시험지\.pdf$|정답\.pdf$/.test(filename)) return "official_name";
  return "ambiguous_name";
}

function scanForExamKey(yk) {
  const candidates = { exam: [], answer: [] };

  // _done/<yearKey>/<yearKey>_*.pdf
  const dirExam = `${MAIN_DONE}/${yk}/${yk}_시험지.pdf`;
  const dirAnswer = `${MAIN_DONE}/${yk}/${yk}_정답.pdf`;
  if (fs.existsSync(dirExam))
    candidates.exam.push({
      path: dirExam,
      root: "_done",
      priority: 1,
      type: classifyName(`${yk}_시험지.pdf`),
      ...statInfo(dirExam),
    });
  if (fs.existsSync(dirAnswer))
    candidates.answer.push({
      path: dirAnswer,
      root: "_done",
      priority: 1,
      type: classifyName(`${yk}_정답.pdf`),
      ...statInfo(dirAnswer),
    });

  // _done/<yearKey>_*.pdf
  const directExam = `${MAIN_DONE}/${yk}_시험지.pdf`;
  const directAnswer = `${MAIN_DONE}/${yk}_정답.pdf`;
  if (fs.existsSync(directExam))
    candidates.exam.push({
      path: directExam,
      root: "_done",
      priority: 2,
      type: classifyName(`${yk}_시험지.pdf`),
      ...statInfo(directExam),
    });
  if (fs.existsSync(directAnswer))
    candidates.answer.push({
      path: directAnswer,
      root: "_done",
      priority: 2,
      type: classifyName(`${yk}_정답.pdf`),
      ...statInfo(directAnswer),
    });

  // _done/<yearKey>_test_*.pdf
  const testExam = `${MAIN_DONE}/${yk}_test_시험지.pdf`;
  const testAnswer = `${MAIN_DONE}/${yk}_test_정답.pdf`;
  if (fs.existsSync(testExam))
    candidates.exam.push({
      path: testExam,
      root: "_done",
      priority: 99,
      type: "test_name",
      ...statInfo(testExam),
    });
  if (fs.existsSync(testAnswer))
    candidates.answer.push({
      path: testAnswer,
      root: "_done",
      priority: 99,
      type: "test_name",
      ...statInfo(testAnswer),
    });

  // _inbox/<yearKey>_*.pdf
  const inboxExam = `${MAIN_INBOX}/${yk}_시험지.pdf`;
  const inboxAnswer = `${MAIN_INBOX}/${yk}_정답.pdf`;
  if (fs.existsSync(inboxExam))
    candidates.exam.push({
      path: inboxExam,
      root: "_inbox",
      priority: 3,
      type: classifyName(`${yk}_시험지.pdf`),
      ...statInfo(inboxExam),
    });
  if (fs.existsSync(inboxAnswer))
    candidates.answer.push({
      path: inboxAnswer,
      root: "_inbox",
      priority: 3,
      type: classifyName(`${yk}_정답.pdf`),
      ...statInfo(inboxAnswer),
    });

  return candidates;
}

function selectCandidate(cands) {
  // _done official → wins
  // _inbox official → candidate_for_copy
  // test → never auto wins
  const doneOfficial = cands.filter(
    (c) => c.root === "_done" && c.type === "official_name",
  );
  if (doneOfficial.length === 1)
    return { selected: doneOfficial[0], reason: "_done_official_unique" };
  if (doneOfficial.length > 1) {
    const shaSet = new Set(doneOfficial.map((c) => c.sha256));
    if (shaSet.size === 1)
      return {
        selected: doneOfficial[0],
        reason: "_done_official_duplicate_same_sha",
      };
    return { selected: null, reason: "ambiguous_done_official_diff_sha" };
  }
  const inboxOfficial = cands.filter(
    (c) => c.root === "_inbox" && c.type === "official_name",
  );
  if (inboxOfficial.length > 0)
    return {
      selected: inboxOfficial[0],
      reason: "_inbox_official_candidate_for_copy",
    };
  // test only
  const testFiles = cands.filter((c) => c.type === "test_name");
  if (testFiles.length > 0)
    return { selected: null, reason: "test_only_no_promote_without_user" };
  return { selected: null, reason: "missing" };
}

const manifest = {};
for (const yk of FREE_YEARS) {
  const cands = scanForExamKey(yk);
  const examSel = selectCandidate(cands.exam);
  const answerSel = selectCandidate(cands.answer);

  let status;
  if (examSel.selected && answerSel.selected) {
    const inSelected =
      examSel.selected.root === "_inbox" ||
      answerSel.selected.root === "_inbox";
    status = inSelected ? "candidate_for_copy" : "resolved";
  } else if (
    cands.exam.some((c) => c.type === "test_name") ||
    cands.answer.some((c) => c.type === "test_name")
  ) {
    status = "test_only";
  } else if (cands.exam.length === 0 && cands.answer.length === 0) {
    status = "missing";
  } else status = "ambiguous";

  manifest[yk] = {
    examKey: yk,
    candidate_exam: cands.exam,
    candidate_answer: cands.answer,
    selected_exam_pdf_path: examSel.selected?.path || null,
    selected_answer_pdf_path: answerSel.selected?.path || null,
    selection_reason_exam: examSel.reason,
    selection_reason_answer: answerSel.reason,
    status,
  };
}

const finalManifest = {
  _meta: {
    version: "vFinal_y3a",
    generated_at: new Date().toISOString(),
    scan_method: "real_pdf_scan_inbox_done_combined",
    source_roots: [MAIN_DONE, MAIN_INBOX],
    coverage: {
      scope: "FREE_YEARS_ONLY",
      not_yet_scanned: ["Scope B_NEAR", "Scope C_LEGACY"],
    },
    note: "_inbox official → candidate_for_copy. test_name → user promote 의무. copy_promote = directory copy (rename 영구 금지)",
  },
  examKeys: manifest,
};

fs.writeFileSync(
  "pipeline/source_asset_manifest.json",
  JSON.stringify(finalManifest, null, 2),
);
console.log("source_asset_manifest.json 재산출 정합");
for (const yk of FREE_YEARS) {
  const m = manifest[yk];
  console.log(
    `  ${yk}: status=${m.status} | exam=${m.selected_exam_pdf_path ? m.selected_exam_pdf_path.split("/").slice(-2).join("/") : "X"} | answer=${m.selected_answer_pdf_path ? m.selected_answer_pdf_path.split("/").slice(-2).join("/") : "X"}`,
  );
}

// B1 audit — step3_analysis.js 안 expectedFooter / applyDeterministicFooter logic 검증
const step3 = fs.readFileSync("pipeline/step3_analysis.js", "utf8");

// expectedFooter 안 null 반환 path 검증
const expectedNullPath = (
  step3.match(/expectedFooter[\s\S]{0,300}return null/g) || []
).length;
// applyDeterministicFooter 안 expected === null 사양 검출
const applyNullCheck = (step3.match(/expected\s*===\s*null|!expected/g) || [])
  .length;
// needs_human flag 도입 검출
const needsHumanFlag = (
  step3.match(/needs_human|_needs_recheck|_ok_analysis_mismatch/g) || []
).length;
// reanalyze 사후 채택 게이트 + B1 재호출 path
const regenGateAfterReanalyze = (
  step3.match(/reanalyzeSingleChoice[\s\S]{0,700}adoptRegeneratedAnalysis/g) ||
  []
).length;
const applyAfterReanalyze = (
  step3.match(
    /reanalyzeSingleChoice[\s\S]{0,1200}adoptRegeneratedAnalysis[\s\S]{0,700}applyDeterministicFooter/g,
  ) || []
).length;

const b1Audit = {
  expected_null_return_paths: expectedNullPath,
  apply_null_check_sites: applyNullCheck,
  needs_human_flag_refs: needsHumanFlag,
  regen_gate_after_reanalyze_path: regenGateAfterReanalyze,
  apply_after_reanalyze_path: applyAfterReanalyze,
  safety_issues: [],
};

if (applyNullCheck > 0 && needsHumanFlag === 0) {
  b1Audit.safety_issues.push(
    "expected === null check 도입 단 needs_human flag 도입 0건 — pat:null case 안 명시 flag 부재 잠재 결함",
  );
}
if (applyAfterReanalyze === 0) {
  b1Audit.safety_issues.push(
    "reanalyzeSingleChoice 사후 applyDeterministicFooter 재호출 path 검출 0건 — reanalyze 사후 footer normalize 누락 위험",
  );
}
if (regenGateAfterReanalyze < 2) {
  b1Audit.safety_issues.push(
    `reanalyzeSingleChoice 사후 adoptRegeneratedAnalysis path ${regenGateAfterReanalyze}건 — 재생성 2경로 중 채택 게이트 누락 위험`,
  );
}

console.log("");
console.log("=== B1 Safety Audit ===");
console.log(JSON.stringify(b1Audit, null, 2));

// analysis_body / footer 분리 가능성 점검
const finalLineSites = (
  step3.match(/lines\[lines\.length\s*-\s*1\]|\.split\(["']\\n["']\)/g) || []
).length;
const footerSeparable =
  step3.includes("final_line") ||
  step3.includes("footer") ||
  step3.includes("Footer");

const separation = {
  analysis_field_single_string: true,
  final_line_split_call_sites: finalLineSites,
  footer_field_separable: footerSeparable,
  migration_impact:
    "high — 기존 all_data 안 모든 analysis field 영향 (302 set × ~170 choice = ~50000 choice migration 의무)",
  recommendation:
    "analysis_body + analysis_footer 분리 path 사용자 결정 의무 — viewer + cleanAnalysis logic 영향 검증 의무",
};

console.log("");
console.log("=== Analysis Body/Footer 분리 가능성 ===");
console.log(JSON.stringify(separation, null, 2));

fs.writeFileSync(
  "pipeline/y3a_b1_audit_report.json",
  JSON.stringify({ b1Audit, separation }, null, 2),
);
console.log("");
console.log("pipeline/y3a_b1_audit_report.json 도입 정합");
