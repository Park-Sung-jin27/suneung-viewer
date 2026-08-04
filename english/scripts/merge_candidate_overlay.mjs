import { createHash } from "node:crypto";
import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const DEFAULT_OVERLAY_PATH = path.join(
  ROOT,
  "english",
  "data",
  "candidates",
  "english_2026_09_candidate.json",
);
const ENGLISH_CHOICE_MARKS = ["①", "②", "③", "④", "⑤"];
const CHOICE_CONTAMINATION_PATTERNS = [
  /--\s*\d+\s+of\s+\d+\s*--/i,
  /이 문제지에 관한 저작권/,
  /이제 듣기 문제가 끝났습니다/,
  /\*?\s*확인 사항/,
  /\[\d{2}\s*[~～－-]\s*\d{2}\]/,
];
const EXPECTED_PUBLIC_BOUNDARY = {
  english: { total: 27, free: 5, locked: 22, packs: 6 },
  math: { total: 361, free: 5, locked: 356, packs: 88 },
};

function fail(code, detail = "") {
  throw new Error(`${code}${detail ? `: ${detail}` : ""}`);
}

function ensure(condition, code, detail = "") {
  if (!condition) fail(code, detail);
}

function parseArguments() {
  const values = process.argv.slice(2);
  const options = {
    check: values.includes("--check"),
    overlayPath: DEFAULT_OVERLAY_PATH,
    outputPath: null,
    sourceDirectory: null,
  };

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value === "--check") continue;
    if (!["--overlay", "--output", "--source-dir"].includes(value)) {
      fail("UNKNOWN_ARGUMENT", value);
    }
    const next = values[index + 1];
    ensure(next && !next.startsWith("--"), "ARGUMENT_VALUE_MISSING", value);
    index += 1;
    const resolved = path.resolve(ROOT, next);
    if (value === "--overlay") options.overlayPath = resolved;
    if (value === "--output") options.outputPath = resolved;
    if (value === "--source-dir") options.sourceDirectory = resolved;
  }

  if (!options.outputPath) {
    const parsed = path.parse(options.overlayPath);
    options.outputPath = path.join(
      parsed.dir,
      `${parsed.name.replace(/_candidate$/, "")}_merged.json`,
    );
  }
  return options;
}

function readJson(filePath, label) {
  ensure(existsSync(filePath), "FILE_MISSING", `${label}:${filePath}`);
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch (error) {
    fail("JSON_INVALID", `${label}:${error.message}`);
  }
}

function sha256(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function fingerprint(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function listFiles(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? listFiles(fullPath) : [fullPath];
  });
}

function validateChoiceList(questionId, choices, questionType) {
  ensure(Array.isArray(choices), "CHOICES_NOT_ARRAY", questionId);
  ensure(choices.length === 5, "CHOICE_COUNT", `${questionId}:${choices.length}`);
  const allowMarkerOnly = questionType === "문장 삽입";

  choices.forEach((choice, index) => {
    const expectedNumber = index + 1;
    ensure(
      Number(choice.num) === expectedNumber,
      "CHOICE_NUMBER_ORDER",
      `${questionId}:${choice.num}`,
    );
    ensure(
      choice.mark === ENGLISH_CHOICE_MARKS[index],
      "CHOICE_MARK_ORDER",
      `${questionId}:${choice.mark}`,
    );
    ensure(typeof choice.text === "string", "CHOICE_TEXT_TYPE", questionId);
    ensure(
      allowMarkerOnly || choice.text.trim(),
      "CHOICE_TEXT_MISSING",
      `${questionId}:${expectedNumber}`,
    );
    ensure(
      !CHOICE_CONTAMINATION_PATTERNS.some((pattern) =>
        pattern.test(choice.text),
      ),
      "CHOICE_CONTAMINATION",
      `${questionId}:${expectedNumber}`,
    );
  });
}

function verifyPublicBoundary(candidateId) {
  const publicDataDirectory = path.join(ROOT, "public", "data", "eng-math");
  const englishFree = readJson(
    path.join(publicDataDirectory, "english-free-public.json"),
    "english free data",
  );
  const mathFree = readJson(
    path.join(publicDataDirectory, "math-free-public.json"),
    "math free data",
  );
  const catalog = readJson(
    path.join(publicDataDirectory, "catalog-public.json"),
    "catalog data",
  );

  ensure(englishFree.questions?.length === 5, "PUBLIC_ENGLISH_FREE_COUNT");
  ensure(mathFree.questions?.length === 5, "PUBLIC_MATH_FREE_COUNT");
  for (const [subject, expected] of Object.entries(EXPECTED_PUBLIC_BOUNDARY)) {
    const actual = catalog.subjects?.[subject];
    ensure(actual, "PUBLIC_CATALOG_SUBJECT_MISSING", subject);
    ensure(actual.totalQuestionCount === expected.total, "PUBLIC_TOTAL_CHANGED", subject);
    ensure(actual.freeQuestionCount === expected.free, "PUBLIC_FREE_CHANGED", subject);
    ensure(actual.lockedQuestionCount === expected.locked, "PUBLIC_LOCKED_CHANGED", subject);
    ensure(actual.packCount === expected.packs, "PUBLIC_PACK_COUNT_CHANGED", subject);
  }

  for (const filePath of listFiles(publicDataDirectory).filter((file) =>
    file.endsWith(".json"),
  )) {
    const content = readFileSync(filePath, "utf8");
    ensure(!content.includes(candidateId), "PUBLIC_CANDIDATE_ID_LEAK", filePath);
    ensure(!content.includes("2026_09_"), "PUBLIC_CANDIDATE_QUESTION_LEAK", filePath);
  }

  const publicImagePaths = listFiles(path.join(ROOT, "public", "images"));
  ensure(
    publicImagePaths.every(
      (filePath) => !filePath.includes(`${path.sep}2026-09${path.sep}`),
    ),
    "PUBLIC_CANDIDATE_ASSET_LEAK",
  );
}

function verifySourceArtifacts(overlay, sourceDirectory) {
  for (const [kind, artifact] of Object.entries(overlay.sourceArtifacts ?? {})) {
    ensure(typeof artifact.filename === "string", "SOURCE_FILENAME_MISSING", kind);
    ensure(/^[a-f0-9]{64}$/.test(artifact.sha256), "SOURCE_HASH_INVALID", kind);
    if (!sourceDirectory) continue;
    const filePath = path.join(sourceDirectory, artifact.filename);
    ensure(existsSync(filePath), "SOURCE_FILE_MISSING", filePath);
    ensure(sha256(filePath) === artifact.sha256, "SOURCE_HASH_MISMATCH", kind);
  }
}

function buildMergedCandidate(overlay, overlayPath, sourceDirectory) {
  ensure(
    overlay.schemaVersion === "english-candidate-overlay-v1",
    "OVERLAY_SCHEMA_VERSION",
  );
  ensure(overlay.status === "internal_candidate", "OVERLAY_STATUS");
  ensure(overlay.publicConnected === false, "OVERLAY_PUBLIC_CONNECTED");
  ensure(
    overlay.releaseRules?.allowPublicGeneration === false,
    "OVERLAY_PUBLIC_GENERATION_ALLOWED",
  );
  verifySourceArtifacts(overlay, sourceDirectory);

  const basePath = path.resolve(ROOT, overlay.baseData?.path ?? "");
  ensure(existsSync(basePath), "BASE_DATA_MISSING", basePath);
  ensure(sha256(basePath) === overlay.baseData.sha256, "BASE_DATA_HASH_MISMATCH");
  const database = readJson(basePath, "english base data");
  const exam = database.exams?.find((item) => item.id === overlay.baseData.examId);
  ensure(exam, "BASE_EXAM_MISSING", overlay.baseData.examId);

  const expectedIds = Array.from(
    { length: 28 },
    (_, index) => `${overlay.baseData.examId}_${index + 18}`,
  );
  ensure(
    JSON.stringify(exam.questionIds) === JSON.stringify(expectedIds),
    "BASE_EXAM_QUESTION_IDS",
  );
  ensure(overlay.questions?.length === 28, "OVERLAY_QUESTION_COUNT");
  ensure(
    JSON.stringify(overlay.questions.map((question) => question.id)) ===
      JSON.stringify(expectedIds),
    "OVERLAY_QUESTION_IDS",
  );

  const baseById = new Map(database.questions.map((question) => [question.id, question]));
  const overrideIds = Object.keys(overlay.choiceOverrides ?? {});
  ensure(
    overrideIds.length === overlay.summary.choiceOverrideQuestionCount,
    "CHOICE_OVERRIDE_COUNT",
  );
  ensure(new Set(overrideIds).size === overrideIds.length, "CHOICE_OVERRIDE_DUPLICATE");

  const figureIds = overlay.figures?.map((figure) => figure.questionId) ?? [];
  ensure(
    figureIds.length === overlay.summary.figureAssetCount,
    "FIGURE_COUNT",
  );
  ensure(new Set(figureIds).size === figureIds.length, "FIGURE_DUPLICATE");
  ensure(
    JSON.stringify([...figureIds].sort()) ===
      JSON.stringify([...overlay.releaseRules.requireFigureAssetForIds].sort()),
    "FIGURE_REQUIRED_IDS",
  );

  const figuresById = new Map();
  for (const figure of overlay.figures) {
    const assetPath = path.resolve(ROOT, figure.assetPath);
    ensure(existsSync(assetPath), "FIGURE_ASSET_MISSING", figure.questionId);
    ensure(statSync(assetPath).isFile(), "FIGURE_ASSET_NOT_FILE", figure.questionId);
    ensure(sha256(assetPath) === figure.sha256, "FIGURE_ASSET_HASH", figure.questionId);
    ensure(String(figure.alt ?? "").trim(), "FIGURE_ALT_MISSING", figure.questionId);
    figuresById.set(figure.questionId, figure);
  }

  const questions = overlay.questions.map((auditQuestion, index) => {
    const baseQuestion = baseById.get(auditQuestion.id);
    ensure(baseQuestion, "BASE_QUESTION_MISSING", auditQuestion.id);
    ensure(baseQuestion.qid === index + 18, "QUESTION_NUMBER_MISMATCH", auditQuestion.id);
    ensure(baseQuestion.answer === auditQuestion.answer, "ANSWER_MISMATCH", auditQuestion.id);
    ensure(auditQuestion.status === "question_answer_ready", "QUESTION_STATUS", auditQuestion.id);
    ensure(auditQuestion.reviewStatus === "not_built", "REVIEW_STATUS", auditQuestion.id);
    const choices = overlay.choiceOverrides?.[auditQuestion.id] ?? baseQuestion.choices;
    validateChoiceList(auditQuestion.id, choices, baseQuestion.type);
    const answer = Number(auditQuestion.answer);
    ensure(Number.isInteger(answer) && answer >= 1 && answer <= 5, "ANSWER_INVALID", auditQuestion.id);

    const figure = figuresById.get(auditQuestion.id);
    const mergedQuestion = {
      id: baseQuestion.id,
      examId: baseQuestion.examId,
      schoolYear: baseQuestion.schoolYear,
      actualYear: baseQuestion.actualYear,
      session: baseQuestion.session,
      qid: baseQuestion.qid,
      type: baseQuestion.type,
      group: baseQuestion.group,
      answer,
      textStatus: baseQuestion.textStatus,
      stem: baseQuestion.stem,
      rawText: baseQuestion.rawText,
      sharedPassage: baseQuestion.sharedPassage,
      choices,
      candidateStatus: auditQuestion.status,
      reviewStatus: auditQuestion.reviewStatus,
      source: baseQuestion.source,
      extraction: {
        ...baseQuestion.extraction,
        choiceCount: choices.length,
        answerStatus: "source_cross_checked",
      },
      audit: {
        problemPage: auditQuestion.problemPage,
        explanationPages: auditQuestion.explanationPages,
        answerCrossChecked: true,
        choiceSource: overrideIds.includes(auditQuestion.id)
          ? "source_checked_overlay"
          : "source_checked_base",
      },
    };
    if (figure) {
      mergedQuestion.figure = {
        kind: figure.kind,
        assetPath: figure.assetPath,
        sha256: figure.sha256,
        sourcePage: figure.sourcePage,
        alt: figure.alt,
      };
    }
    ensure(
      !["review", "explanation", "evidence"].some((key) => key in mergedQuestion),
      "UNVERIFIED_REVIEW_LEAK",
      auditQuestion.id,
    );
    return mergedQuestion;
  });

  ensure(
    questions.filter((question) => question.audit.answerCrossChecked).length === 28,
    "ANSWER_CROSS_CHECK_COUNT",
  );
  ensure(
    questions.filter((question) => question.figure).length === 3,
    "MERGED_FIGURE_COUNT",
  );
  verifyPublicBoundary(overlay.candidateId);

  return {
    schemaVersion: "english-product-candidate-v1",
    candidateId: overlay.candidateId,
    status: "internal_candidate",
    publicConnected: false,
    generatedFrom: {
      overlayPath: path.relative(ROOT, overlayPath).replaceAll(path.sep, "/"),
      baseDataPath: overlay.baseData.path,
      baseDataSha256: overlay.baseData.sha256,
    },
    sourceArtifacts: overlay.sourceArtifacts,
    summary: {
      questionCount: questions.length,
      answerCrossCheckCount: 28,
      questionAnswerReadyCount: 28,
      reviewReadyCount: 0,
      figureAssetCount: 3,
      choiceOverrideQuestionCount: overrideIds.length,
      blockedCount: 0,
    },
    integrity: {
      questionIds: expectedIds,
      choiceOverrideIds: overrideIds,
      figureIds,
      choiceFingerprint: fingerprint(
        questions.map((question) => [question.id, question.answer, question.choices]),
      ),
      figureFingerprint: fingerprint(
        overlay.figures.map((figure) => [
          figure.questionId,
          figure.assetPath,
          figure.sha256,
        ]),
      ),
    },
    releaseRules: overlay.releaseRules,
    questions,
  };
}

const options = parseArguments();
const overlay = readJson(options.overlayPath, "candidate overlay");
const merged = buildMergedCandidate(
  overlay,
  options.overlayPath,
  options.sourceDirectory,
);
const serialized = `${JSON.stringify(merged, null, 2)}\n`;

if (options.check) {
  ensure(existsSync(options.outputPath), "MERGED_OUTPUT_MISSING", options.outputPath);
  ensure(
    readFileSync(options.outputPath, "utf8") === serialized,
    "MERGED_OUTPUT_OUTDATED",
    path.relative(ROOT, options.outputPath),
  );
} else {
  writeFileSync(options.outputPath, serialized, "utf8");
}

console.log(
  `ENG_MATH_ENGLISH_CANDIDATE: pass mode=${options.check ? "check" : "merge"} questions=28 answers=28 overrides=14 figures=3 review=0 public=0 source=${options.sourceDirectory ? "verified" : "recorded"}`,
);
