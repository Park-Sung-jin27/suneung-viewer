import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_DIRECTORY = process.env.MATH_LEGACY_SOURCE_DIRECTORY
  ? path.resolve(process.env.MATH_LEGACY_SOURCE_DIRECTORY)
  : path.join(ROOT, "raw_sources", "math_eval_pdfs_legacy");
const DATA_DIRECTORY = path.join(
  ROOT,
  "평가원_수학영어_확장",
  "08_math_data",
);
const SOURCE_MANIFEST_PATH = path.join(
  DATA_DIRECTORY,
  "math_legacy_source_manifest_v1.json",
);
const ANSWER_CANDIDATE_PATH = path.join(
  DATA_DIRECTORY,
  "math_legacy_answer_candidates_v1.json",
);
const OUTPUT_PATH = path.join(
  DATA_DIRECTORY,
  "math_legacy_question_map_v1.json",
);
const SCANNED_ANCHOR_OVERRIDE_PATH = path.join(
  DATA_DIRECTORY,
  "math_legacy_scanned_anchor_overrides_v1.json",
);
const SCANNED_EXAM_KEYS = new Set([
  "math_2021_csat_ga",
  "math_2021_csat_na",
]);

function fail(code, detail = "") {
  throw new Error(`${code}${detail ? `: ${detail}` : ""}`);
}

function ensure(condition, code, detail = "") {
  if (!condition) fail(code, detail);
}

function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function sha256File(filePath) {
  return sha256(readFileSync(filePath));
}

function fingerprint(value) {
  return sha256(JSON.stringify(value));
}

function readJson(filePath, label) {
  ensure(existsSync(filePath), `${label.toUpperCase()}_MISSING`, filePath);
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function roundPoint(value) {
  return Number(value.toFixed(2));
}

function sourceAvailability(sourceManifest) {
  const problemArtifacts = sourceManifest.exams.map(
    (exam) => exam.artifacts.problem,
  );
  const available = problemArtifacts.filter((artifact) =>
    existsSync(path.join(SOURCE_DIRECTORY, artifact.filename)),
  ).length;
  if (available > 0 && available < problemArtifacts.length) {
    fail("LEGACY_QUESTION_MAP_SOURCE_PARTIAL", `${available}/30`);
  }
  return available === problemArtifacts.length ? "verified" : "recorded";
}

function validateInputs(sourceManifest, answerCandidate, scannedOverrides) {
  ensure(
    sourceManifest.schemaVersion === "math-legacy-source-manifest-v1" &&
      sourceManifest.status === "internal_source_inventory" &&
      sourceManifest.publicConnected === false &&
      sourceManifest.summary?.examCount === 30 &&
      sourceManifest.summary?.expectedQuestionCount === 900 &&
      sourceManifest.exams?.length === 30,
    "LEGACY_QUESTION_MAP_SOURCE_SCOPE",
  );
  ensure(
    answerCandidate.schemaVersion === "math-legacy-answer-candidates-v1" &&
      answerCandidate.status === "internal_answer_candidate" &&
      answerCandidate.publicConnected === false &&
      answerCandidate.summary?.answerCandidateCount === 900 &&
      answerCandidate.exams?.length === 30,
    "LEGACY_QUESTION_MAP_ANSWER_SCOPE",
  );
  ensure(
    stableJson(sourceManifest.exams.map((exam) => exam.examKey)) ===
      stableJson(answerCandidate.exams.map((exam) => exam.examKey)),
    "LEGACY_QUESTION_MAP_EXAM_ALIGNMENT",
  );
  ensure(
    scannedOverrides.schemaVersion ===
        "math-legacy-scanned-anchor-overrides-v1" &&
      scannedOverrides.status === "internal_visual_anchor_candidate" &&
      scannedOverrides.publicConnected === false &&
      scannedOverrides.render?.dpi === 180 &&
      scannedOverrides.render?.width === 1489 &&
      scannedOverrides.render?.height === 2105,
    "LEGACY_SCANNED_ANCHOR_OVERRIDE_SCOPE",
  );
  ensure(
    stableJson(Object.keys(scannedOverrides.exams ?? {}).sort()) ===
      stableJson([...SCANNED_EXAM_KEYS].sort()),
    "LEGACY_SCANNED_ANCHOR_EXAM_SCOPE",
  );
  const sourceByExam = new Map(
    sourceManifest.exams.map((exam) => [exam.examKey, exam]),
  );
  for (const examKey of SCANNED_EXAM_KEYS) {
    const override = scannedOverrides.exams[examKey];
    const sourceExam = sourceByExam.get(examKey);
    ensure(
      override?.problemSha256 === sourceExam?.artifacts?.problem?.sha256 &&
        override.questions?.length === 30,
      "LEGACY_SCANNED_ANCHOR_SOURCE_ALIGNMENT",
      examKey,
    );
    ensure(
      stableJson(override.questions.map((question) => question.qid)) ===
        stableJson(Array.from({ length: 30 }, (_, index) => index + 1)) &&
        override.questions.every(
          (question) =>
            Number.isInteger(question.page) &&
            question.page >= 1 &&
            question.page <= 12 &&
            ["left", "right"].includes(question.column) &&
            Number.isInteger(question.topPx) &&
            question.topPx >= 0 &&
            question.topPx < scannedOverrides.render.height,
        ),
      "LEGACY_SCANNED_ANCHOR_CONTENT",
      examKey,
    );
  }
}

function verifyProblemSource(exam) {
  const artifact = exam.artifacts.problem;
  const filePath = path.join(SOURCE_DIRECTORY, artifact.filename);
  ensure(existsSync(filePath), "LEGACY_QUESTION_MAP_SOURCE_MISSING", filePath);
  ensure(
    statSync(filePath).size === artifact.size,
    "LEGACY_QUESTION_MAP_SOURCE_SIZE",
    exam.examKey,
  );
  ensure(
    sha256File(filePath) === artifact.sha256,
    "LEGACY_QUESTION_MAP_SOURCE_HASH",
    exam.examKey,
  );
  return filePath;
}

async function findQuestionAnchors(filePath) {
  const document = await getDocument({
    data: new Uint8Array(readFileSync(filePath)),
    disableWorker: true,
    verbosity: 0,
  }).promise;
  const pages = new Map();
  const anchors = [];

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1 });
    pages.set(pageNumber, {
      width: viewport.width,
      height: viewport.height,
    });
    const content = await page.getTextContent();
    for (const item of content.items) {
      const match = String(item.str ?? "")
        .trim()
        .match(/^([1-9]|[12]\d|30)\.$/);
      if (
        !match ||
        item.transform[4] < 45 ||
        item.transform[4] > 520 ||
        item.height < 7
      ) {
        continue;
      }
      const qid = Number(match[1]);
      const top = viewport.height - (item.transform[5] + item.height);
      anchors.push({
        qid,
        page: pageNumber,
        x: item.transform[4],
        top,
        height: item.height,
      });
    }
  }
  return { pageCount: document.numPages, pages, anchors };
}

function validateAnchorScope(examKey, anchors) {
  const byQuestion = new Map();
  for (const anchor of anchors) {
    if (!byQuestion.has(anchor.qid)) byQuestion.set(anchor.qid, []);
    byQuestion.get(anchor.qid).push(anchor);
  }
  const missing = [];
  const duplicate = [];
  for (let qid = 1; qid <= 30; qid += 1) {
    const matches = byQuestion.get(qid) ?? [];
    if (matches.length === 0) missing.push(qid);
    if (matches.length > 1) duplicate.push(`${qid}:${matches.length}`);
  }
  ensure(
    missing.length === 0 && duplicate.length === 0,
    "LEGACY_QUESTION_ANCHOR_SCOPE",
    `${examKey}:missing=${missing.join(",") || "none"}:duplicate=${duplicate.join(",") || "none"}`,
  );
  return new Map(
    [...byQuestion.entries()].map(([qid, matches]) => [qid, matches[0]]),
  );
}

function cropForAnchor(anchor, anchors, pageSize) {
  const column = anchor.x < pageSize.width / 2 ? "left" : "right";
  const columnAnchors = anchors
    .filter(
      (candidate) =>
        candidate.page === anchor.page &&
        (candidate.x < pageSize.width / 2 ? "left" : "right") === column,
    )
    .sort((left, right) => left.top - right.top);
  const position = columnAnchors.findIndex(
    (candidate) => candidate.qid === anchor.qid,
  );
  ensure(position >= 0, "LEGACY_QUESTION_ANCHOR_POSITION", anchor.qid);
  const next = columnAnchors[position + 1];
  const center = pageSize.width / 2;
  const left = column === "left" ? 48 : center + 8;
  const right = column === "left" ? center - 8 : pageSize.width - 72;
  const top = Math.max(0, anchor.top - 12);
  const bottom = next ? next.top - 8 : pageSize.height - 125;
  ensure(
    right - left >= 180 && bottom - top >= 48,
    "LEGACY_QUESTION_CROP_SIZE",
    `${anchor.qid}:${right - left}x${bottom - top}`,
  );
  return {
    coordinateSystem: "pdf_points_top_left",
    pageWidth: roundPoint(pageSize.width),
    pageHeight: roundPoint(pageSize.height),
    x: roundPoint(left),
    y: roundPoint(top),
    width: roundPoint(right - left),
    height: roundPoint(bottom - top),
  };
}

function scannedAnchorsForExam(exam, result, scannedOverrides) {
  const override = scannedOverrides.exams[exam.examKey];
  ensure(
    override?.problemSha256 === exam.artifacts.problem.sha256,
    "LEGACY_SCANNED_ANCHOR_HASH",
    exam.examKey,
  );
  return override.questions.map((question) => {
    const pageSize = result.pages.get(question.page);
    ensure(pageSize, "LEGACY_SCANNED_ANCHOR_PAGE", exam.examKey);
    return {
      qid: question.qid,
      page: question.page,
      x:
        question.column === "left"
          ? pageSize.width * 0.1
          : pageSize.width * 0.55,
      top:
        (question.topPx * pageSize.height) /
        scannedOverrides.render.height,
      height: 10,
    };
  });
}

async function buildQuestionMap(
  sourceManifest,
  answerCandidate,
  scannedOverrides,
) {
  const answerIdsByExam = new Map(
    answerCandidate.exams.map((exam) => [
      exam.examKey,
      exam.questions.map((question) => question.id),
    ]),
  );
  const exams = [];

  for (const exam of sourceManifest.exams) {
    const filePath = verifyProblemSource(exam);
    const result = await findQuestionAnchors(filePath);
    ensure(
      result.pageCount === 12,
      "LEGACY_QUESTION_PAGE_SCOPE",
      `${exam.examKey}:${result.pageCount}`,
    );

    let questions;
    let mappingStatus;
    if (result.anchors.length === 0 && SCANNED_EXAM_KEYS.has(exam.examKey)) {
      const anchors = scannedAnchorsForExam(exam, result, scannedOverrides);
      const anchorsByQuestion = validateAnchorScope(exam.examKey, anchors);
      questions = Array.from({ length: 30 }, (_, index) => {
        const qid = index + 1;
        const anchor = anchorsByQuestion.get(qid);
        const pageSize = result.pages.get(anchor.page);
        const column = anchor.x < pageSize.width / 2 ? "left" : "right";
        return {
          id: `${exam.examKey.replace(/^math_/, "")}_${qid}`,
          qid,
          mappingStatus: "scanned_visual_anchor_mapped",
          page: anchor.page,
          column,
          crop: cropForAnchor(anchor, anchors, pageSize),
        };
      });
      mappingStatus = "scanned_visual_anchor_mapped";
    } else {
      const anchorsByQuestion = validateAnchorScope(
        exam.examKey,
        result.anchors,
      );
      questions = Array.from({ length: 30 }, (_, index) => {
        const qid = index + 1;
        const anchor = anchorsByQuestion.get(qid);
        const pageSize = result.pages.get(anchor.page);
        const column = anchor.x < pageSize.width / 2 ? "left" : "right";
        return {
          id: `${exam.examKey.replace(/^math_/, "")}_${qid}`,
          qid,
          mappingStatus: "source_anchor_mapped",
          page: anchor.page,
          column,
          crop: cropForAnchor(anchor, result.anchors, pageSize),
        };
      });
      mappingStatus = "source_anchor_mapped";
    }

    ensure(
      stableJson(questions.map((question) => question.id)) ===
        stableJson(answerIdsByExam.get(exam.examKey)),
      "LEGACY_QUESTION_MAP_ANSWER_ALIGNMENT",
      exam.examKey,
    );
    exams.push({
      examKey: exam.examKey,
      schoolYear: exam.schoolYear,
      session: exam.session,
      track: exam.track,
      curriculum: exam.curriculum,
      expectedQuestionCount: 30,
      pageCount: result.pageCount,
      mappingStatus,
      problemSource: exam.artifacts.problem,
      questions,
    });
  }

  const questions = exams.flatMap((exam) => exam.questions);
  const textAnchorMappedCount = questions.filter(
    (question) => question.mappingStatus === "source_anchor_mapped",
  ).length;
  const scannedVisualMappedCount = questions.filter(
    (question) => question.mappingStatus === "scanned_visual_anchor_mapped",
  ).length;
  const mappedQuestionCount =
    textAnchorMappedCount + scannedVisualMappedCount;
  const pendingQuestionCount = questions.filter(
    (question) => question.mappingStatus === "pending_scanned_page_anchor",
  ).length;
  ensure(
    questions.length === 900 &&
      new Set(questions.map((question) => question.id)).size === 900 &&
      mappedQuestionCount === 900 &&
      textAnchorMappedCount === 840 &&
      scannedVisualMappedCount === 60 &&
      pendingQuestionCount === 0,
    "LEGACY_QUESTION_MAP_TOTAL_SCOPE",
    `${questions.length}/${mappedQuestionCount}/${textAnchorMappedCount}/${scannedVisualMappedCount}/${pendingQuestionCount}`,
  );

  return {
    schemaVersion: "math-legacy-question-map-v1",
    status: "internal_question_map",
    publicConnected: false,
    scope: {
      schoolYears: [2017, 2018, 2019, 2020, 2021],
      sessions: ["06", "09", "csat"],
      tracks: ["ga", "na"],
      curriculum: "legacy_ga_na",
    },
    summary: {
      schoolYearCount: 5,
      examCount: exams.length,
      questionCount: questions.length,
      mappedQuestionCount,
      textAnchorMappedCount,
      scannedVisualMappedCount,
      pendingQuestionCount,
      publicQuestionCount: 0,
    },
    exams,
    integrity: {
      sourceManifestFingerprint: sourceManifest.integrity.sourceFingerprint,
      answerCandidateFingerprint:
        answerCandidate.integrity.answerFingerprint,
      scannedAnchorOverrideFingerprint: fingerprint(scannedOverrides.exams),
      questionMapFingerprint: fingerprint(
        questions.map((question) => [
          question.id,
          question.mappingStatus,
          question.page,
          question.column,
          question.crop,
        ]),
      ),
    },
  };
}

function validateRecordedQuestionMap(
  questionMap,
  sourceManifest,
  answerCandidate,
  scannedOverrides,
) {
  ensure(
    questionMap.schemaVersion === "math-legacy-question-map-v1" &&
      questionMap.status === "internal_question_map" &&
      questionMap.publicConnected === false,
    "LEGACY_RECORDED_QUESTION_MAP_STATUS",
  );
  ensure(
    questionMap.summary?.schoolYearCount === 5 &&
      questionMap.summary?.examCount === 30 &&
      questionMap.summary?.questionCount === 900 &&
      questionMap.summary?.mappedQuestionCount === 900 &&
      questionMap.summary?.textAnchorMappedCount === 840 &&
      questionMap.summary?.scannedVisualMappedCount === 60 &&
      questionMap.summary?.pendingQuestionCount === 0 &&
      questionMap.summary?.publicQuestionCount === 0 &&
      questionMap.exams?.length === 30,
    "LEGACY_RECORDED_QUESTION_MAP_SCOPE",
  );
  ensure(
    questionMap.integrity?.sourceManifestFingerprint ===
        sourceManifest.integrity.sourceFingerprint &&
      questionMap.integrity?.answerCandidateFingerprint ===
        answerCandidate.integrity.answerFingerprint &&
      questionMap.integrity?.scannedAnchorOverrideFingerprint ===
        fingerprint(scannedOverrides.exams),
    "LEGACY_RECORDED_QUESTION_MAP_FINGERPRINT",
  );
  const questions = questionMap.exams.flatMap((exam) => exam.questions ?? []);
  ensure(
    questions.length === 900 &&
      new Set(questions.map((question) => question.id)).size === 900 &&
      questions.filter(
        (question) => question.mappingStatus === "source_anchor_mapped",
      ).length === 840 &&
      questions.filter(
        (question) =>
          question.mappingStatus === "scanned_visual_anchor_mapped",
      ).length === 60 &&
      questions.filter(
        (question) => question.mappingStatus === "pending_scanned_page_anchor",
      ).length === 0,
    "LEGACY_RECORDED_QUESTION_MAP_CONTENT",
  );
}

const mode = process.argv[2] ?? "--check";
ensure(["--check", "--write"].includes(mode), "MODE_INVALID", mode);
const sourceManifest = readJson(SOURCE_MANIFEST_PATH, "legacy source manifest");
const answerCandidate = readJson(
  ANSWER_CANDIDATE_PATH,
  "legacy answer candidate",
);
const scannedOverrides = readJson(
  SCANNED_ANCHOR_OVERRIDE_PATH,
  "legacy scanned anchor overrides",
);
validateInputs(sourceManifest, answerCandidate, scannedOverrides);
const availability = sourceAvailability(sourceManifest);

if (availability === "verified") {
  const questionMap = await buildQuestionMap(
    sourceManifest,
    answerCandidate,
    scannedOverrides,
  );
  const serialized = stableJson(questionMap);
  if (mode === "--write") {
    writeFileSync(OUTPUT_PATH, serialized, "utf8");
  } else {
    ensure(existsSync(OUTPUT_PATH), "LEGACY_QUESTION_MAP_MISSING");
    ensure(
      readFileSync(OUTPUT_PATH, "utf8") === serialized,
      "LEGACY_QUESTION_MAP_DRIFT",
    );
  }
} else {
  ensure(mode === "--check", "LEGACY_QUESTION_MAP_SOURCE_REQUIRED_FOR_WRITE");
}

const questionMap = readJson(OUTPUT_PATH, "legacy question map");
validateRecordedQuestionMap(
  questionMap,
  sourceManifest,
  answerCandidate,
  scannedOverrides,
);
console.log(
  `MATH_LEGACY_QUESTION_MAP: pass source=${availability} years=5 exams=30 questions=900 mapped=900 text=840 scanned=60 pending=0 public=0`,
);
