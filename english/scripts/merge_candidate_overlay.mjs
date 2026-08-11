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
const REVIEW_MIN_NARRATIVE_LENGTH = 20;
const REVIEW_DRAFT_PATTERN =
  /TODO|TBD|미검증|AI생성|ProbDex|준비\s*중|임시|�|\?\?/i;
const CHOICE_CONTAMINATION_PATTERNS = [
  /--\s*\d+\s+of\s+\d+\s*--/i,
  /이 문제지에 관한 저작권/,
  /이제 듣기 문제가 끝났습니다/,
  /\*?\s*확인 사항/,
  /\[\d{2}\s*[~～－-]\s*\d{2}\]/,
];
const EXPECTED_PUBLIC_BOUNDARY = {
  english: { total: 251, free: 5, locked: 246, packs: 54 },
  math: { total: 460, free: 5, locked: 455, packs: 110 },
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
    skipPublicBoundary: values.includes("--skip-public-boundary"),
    overlayPath: DEFAULT_OVERLAY_PATH,
    outputPath: null,
    sourceDirectory: null,
  };

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value === "--check" || value === "--skip-public-boundary") continue;
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

function verifyPublicBoundary(overlay) {
  const candidateId = overlay.candidateId;
  const candidateQuestionIds = overlay.questions.map((question) => question.id);
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
    const leakedQuestionId = candidateQuestionIds.find((questionId) =>
      content.includes(questionId),
    );
    ensure(
      !leakedQuestionId,
      "PUBLIC_CANDIDATE_QUESTION_LEAK",
      `${filePath}:${leakedQuestionId ?? ""}`,
    );
  }

  const protectedAssetScopes = new Set(
    (overlay.figures ?? []).map((figure) =>
      path.basename(path.dirname(figure.assetPath)),
    ),
  );
  const publicImagePaths = listFiles(path.join(ROOT, "public", "images"));
  ensure(
    publicImagePaths.every(
      (filePath) =>
        [...protectedAssetScopes].every(
          (scope) => !filePath.includes(`${path.sep}${scope}${path.sep}`),
        ),
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

function validatedText(value, code, detail) {
  ensure(typeof value === "string" && value.trim(), code, detail);
  return value;
}

function buildValidatedReview(question, choices, figure, review) {
  ensure(review && typeof review === "object", "REVIEW_MISSING", question.id);
  ensure(review.id === question.id, "REVIEW_ID", question.id);
  ensure(review.status === "ready", "REVIEW_STATUS", question.id);
  ensure(review.qid === question.qid, "REVIEW_QID", question.id);
  ensure(review.group === question.group, "REVIEW_GROUP", question.id);
  ensure(review.type === question.type, "REVIEW_TYPE", question.id);
  ensure(Number(review.answer) === Number(question.answer), "REVIEW_ANSWER", question.id);
  ensure(
    review.answerMark === ENGLISH_CHOICE_MARKS[Number(question.answer) - 1],
    "REVIEW_ANSWER_MARK",
    question.id,
  );
  validatedText(review.exam, "REVIEW_EXAM", question.id);
  const summary = validatedText(review.summary, "REVIEW_SUMMARY", question.id);
  const typeApproach = validatedText(
    review.typeApproach,
    "REVIEW_APPROACH",
    question.id,
  );
  const correctReason = validatedText(
    review.correctReason,
    "REVIEW_REASON",
    question.id,
  );
  ensure(
    correctReason.includes(review.answerMark),
    "REVIEW_REASON_ANSWER_MARK",
    question.id,
  );
  ensure(Array.isArray(review.evidence) && review.evidence.length > 0, "REVIEW_EVIDENCE", question.id);

  const evidence = review.evidence.map((item, index) => {
    const detail = `${question.id}:${index}`;
    ensure(item && typeof item === "object", "REVIEW_EVIDENCE_ITEM", detail);
    const quote = validatedText(item.quote, "REVIEW_EVIDENCE_QUOTE", detail);
    const role = validatedText(item.role, "REVIEW_EVIDENCE_ROLE", detail);
    const translation = validatedText(
      item.translation,
      "REVIEW_EVIDENCE_TRANSLATION",
      detail,
    );
    ensure(
      !REVIEW_DRAFT_PATTERN.test(`${role} ${translation}`),
      "REVIEW_EVIDENCE_DRAFT_MARKER",
      detail,
    );

    if (item.in === "figure") {
      ensure(figure, "REVIEW_FIGURE_MISSING", detail);
      ensure(figure.alt.includes(quote), "REVIEW_FIGURE_QUOTE_MISMATCH", detail);
      return { in: "figure", quote, role, translation };
    }

    ensure(
      item.in === "rawText" || item.in === "sharedPassage",
      "REVIEW_EVIDENCE_SOURCE",
      detail,
    );
    const sourceText = question[item.in];
    ensure(typeof sourceText === "string", "REVIEW_EVIDENCE_SOURCE_MISSING", detail);
    const charStart = sourceText.indexOf(quote);
    ensure(charStart >= 0, "REVIEW_EVIDENCE_QUOTE_MISMATCH", detail);
    ensure(
      sourceText.indexOf(quote, charStart + 1) === -1,
      "REVIEW_EVIDENCE_QUOTE_AMBIGUOUS",
      detail,
    );
    return { in: item.in, quote, charStart, role, translation };
  });
  ensure(
    new Set(evidence.map((item) => item.quote)).size === evidence.length,
    "REVIEW_EVIDENCE_DUPLICATE_QUOTE",
    question.id,
  );

  const trap = review.trap;
  ensure(trap && typeof trap === "object", "REVIEW_TRAP", question.id);
  const trapChoice = choices.find((choice) => Number(choice.num) === Number(trap.choice));
  ensure(trapChoice, "REVIEW_TRAP_CHOICE", question.id);
  ensure(Number(trap.choice) !== Number(question.answer), "REVIEW_TRAP_IS_ANSWER", question.id);
  ensure(trap.mark === trapChoice.mark, "REVIEW_TRAP_MARK", question.id);
  ensure(trap.text === trapChoice.text, "REVIEW_TRAP_TEXT", question.id);
  const trapReason = validatedText(
    trap.reason,
    "REVIEW_TRAP_REASON",
    question.id,
  );
  const narrativeFields = { summary, typeApproach, correctReason, trapReason };
  for (const [field, text] of Object.entries(narrativeFields)) {
    ensure(
      text.trim().length >= REVIEW_MIN_NARRATIVE_LENGTH,
      "REVIEW_NARRATIVE_DEPTH",
      `${question.id}:${field}`,
    );
    ensure(
      !REVIEW_DRAFT_PATTERN.test(text),
      "REVIEW_DRAFT_MARKER",
      `${question.id}:${field}`,
    );
  }
  ensure(
    new Set(Object.values(narrativeFields)).size ===
      Object.keys(narrativeFields).length,
    "REVIEW_NARRATIVE_DUPLICATE",
    question.id,
  );

  return {
    id: review.id,
    status: review.status,
    exam: review.exam,
    qid: review.qid,
    group: review.group,
    type: review.type,
    answer: Number(review.answer),
    answerMark: review.answerMark,
    summary,
    typeApproach,
    evidence,
    correctReason,
    trap: {
      mark: trap.mark,
      choice: Number(trap.choice),
      text: trap.text,
      reason: trapReason,
    },
  };
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
  const reviewPath = path.resolve(ROOT, overlay.reviewData?.path ?? "");
  ensure(existsSync(reviewPath), "REVIEW_DATA_MISSING", reviewPath);
  ensure(sha256(reviewPath) === overlay.reviewData.sha256, "REVIEW_DATA_HASH_MISMATCH");
  const reviewDatabase = readJson(reviewPath, "english candidate reviews");
  ensure(
    reviewDatabase.metadata?.schemaVersion === "eng-explain-candidate-v1",
    "REVIEW_SCHEMA_VERSION",
  );
  ensure(reviewDatabase.metadata?.examId === overlay.baseData.examId, "REVIEW_EXAM_ID");
  ensure(reviewDatabase.metadata?.status === "internal_candidate", "REVIEW_DATABASE_STATUS");
  ensure(reviewDatabase.metadata?.publicConnected === false, "REVIEW_PUBLIC_CONNECTED");
  ensure(reviewDatabase.metadata?.itemCount === 28, "REVIEW_ITEM_COUNT");
  ensure(reviewDatabase.metadata?.readyCount === 28, "REVIEW_READY_COUNT");
  ensure(overlay.reviewData.expectedReadyCount === 28, "OVERLAY_REVIEW_READY_COUNT");
  ensure(overlay.summary.reviewReadyCount === 28, "OVERLAY_REVIEW_SUMMARY_COUNT");
  const reviewIds = Object.keys(reviewDatabase.items ?? {});
  ensure(
    JSON.stringify(reviewIds) === JSON.stringify(expectedIds),
    "REVIEW_QUESTION_IDS",
  );
  const reviewsById = new Map(
    Object.values(reviewDatabase.items).map((review) => [review.id, review]),
  );
  const overrideIds = Object.keys(overlay.choiceOverrides ?? {});
  ensure(
    overrideIds.length === overlay.summary.choiceOverrideQuestionCount,
    "CHOICE_OVERRIDE_COUNT",
  );
  ensure(new Set(overrideIds).size === overrideIds.length, "CHOICE_OVERRIDE_DUPLICATE");
  const sourceTextOverrides = overlay.sourceTextOverrides ?? {};
  const sourceTextOverrideIds = Object.keys(sourceTextOverrides);
  ensure(
    sourceTextOverrideIds.length ===
      (overlay.summary.sourceTextOverrideQuestionCount ?? 0),
    "SOURCE_TEXT_OVERRIDE_COUNT",
  );
  ensure(
    new Set(sourceTextOverrideIds).size === sourceTextOverrideIds.length,
    "SOURCE_TEXT_OVERRIDE_DUPLICATE",
  );
  ensure(
    JSON.stringify([...sourceTextOverrideIds].sort()) ===
      JSON.stringify(
        [...(overlay.releaseRules.requireSourceTextOverrideForIds ?? [])].sort(),
      ),
    "SOURCE_TEXT_OVERRIDE_REQUIRED_IDS",
  );
  for (const questionId of sourceTextOverrideIds) {
    ensure(expectedIds.includes(questionId), "SOURCE_TEXT_OVERRIDE_ID", questionId);
    const sourceTextOverride = sourceTextOverrides[questionId];
    ensure(
      sourceTextOverride &&
        typeof sourceTextOverride === "object" &&
        JSON.stringify(Object.keys(sourceTextOverride)) ===
          JSON.stringify(["rawText"]),
      "SOURCE_TEXT_OVERRIDE_FIELDS",
      questionId,
    );
    const rawText = validatedText(
      sourceTextOverride.rawText,
      "SOURCE_TEXT_OVERRIDE_RAW_TEXT",
      questionId,
    );
    ensure(
      !REVIEW_DRAFT_PATTERN.test(rawText),
      "SOURCE_TEXT_OVERRIDE_DRAFT_MARKER",
      questionId,
    );
  }

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
    ensure(auditQuestion.reviewStatus === "ready", "REVIEW_STATUS", auditQuestion.id);
    const choices = overlay.choiceOverrides?.[auditQuestion.id] ?? baseQuestion.choices;
    validateChoiceList(auditQuestion.id, choices, baseQuestion.type);
    const rawText =
      sourceTextOverrides[auditQuestion.id]?.rawText ?? baseQuestion.rawText;
    if (sourceTextOverrideIds.includes(auditQuestion.id)) {
      ensure(rawText.includes(baseQuestion.stem), "SOURCE_TEXT_STEM_MISSING", auditQuestion.id);
      for (const choice of choices) {
        ensure(
          rawText.includes(choice.text),
          "SOURCE_TEXT_CHOICE_MISSING",
          `${auditQuestion.id}:${choice.num}`,
        );
      }
    }
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
      rawText,
      sharedPassage: baseQuestion.sharedPassage,
      choices,
      candidateStatus: auditQuestion.status,
      reviewStatus: auditQuestion.reviewStatus,
      source: baseQuestion.source,
      extraction: {
        ...baseQuestion.extraction,
        ...(sourceTextOverrideIds.includes(auditQuestion.id)
          ? { rawChars: rawText.length }
          : {}),
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
        ...(sourceTextOverrideIds.includes(auditQuestion.id)
          ? { textSource: "source_checked_overlay" }
          : {}),
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
    mergedQuestion.review = buildValidatedReview(
      mergedQuestion,
      choices,
      figure,
      reviewsById.get(auditQuestion.id),
    );
    return mergedQuestion;
  });

  ensure(
    questions.filter((question) => question.audit.answerCrossChecked).length === 28,
    "ANSWER_CROSS_CHECK_COUNT",
  );
  ensure(
    questions.filter((question) => question.figure).length ===
      overlay.summary.figureAssetCount,
    "MERGED_FIGURE_COUNT",
  );
  ensure(
    questions.filter((question) => question.review?.status === "ready").length === 28,
    "MERGED_REVIEW_COUNT",
  );
  const evidenceCount = questions.reduce(
    (count, question) => count + question.review.evidence.length,
    0,
  );
  const expectedEvidenceCount = overlay.summary.evidenceCount ?? 58;
  ensure(
    evidenceCount === expectedEvidenceCount,
    "MERGED_EVIDENCE_COUNT",
    String(evidenceCount),
  );
  if (!options.skipPublicBoundary) verifyPublicBoundary(overlay);

  return {
    schemaVersion: "english-product-candidate-v2",
    candidateId: overlay.candidateId,
    status: "internal_candidate",
    publicConnected: false,
    generatedFrom: {
      overlayPath: path.relative(ROOT, overlayPath).replaceAll(path.sep, "/"),
      baseDataPath: overlay.baseData.path,
      baseDataSha256: overlay.baseData.sha256,
      reviewDataPath: overlay.reviewData.path,
      reviewDataSha256: overlay.reviewData.sha256,
    },
    sourceArtifacts: overlay.sourceArtifacts,
    summary: {
      questionCount: questions.length,
      answerCrossCheckCount: 28,
      questionAnswerReadyCount: 28,
      reviewReadyCount: 28,
      evidenceCount,
      figureAssetCount: overlay.summary.figureAssetCount,
      choiceOverrideQuestionCount: overrideIds.length,
      ...(sourceTextOverrideIds.length
        ? { sourceTextOverrideQuestionCount: sourceTextOverrideIds.length }
        : {}),
      blockedCount: 0,
    },
    integrity: {
      questionIds: expectedIds,
      choiceOverrideIds: overrideIds,
      ...(sourceTextOverrideIds.length ? { sourceTextOverrideIds } : {}),
      figureIds,
      choiceFingerprint: fingerprint(
        questions.map((question) => [question.id, question.answer, question.choices]),
      ),
      ...(sourceTextOverrideIds.length
        ? {
            sourceTextFingerprint: fingerprint(
              questions.map((question) => [question.id, question.rawText]),
            ),
          }
        : {}),
      figureFingerprint: fingerprint(
        overlay.figures.map((figure) => [
          figure.questionId,
          figure.assetPath,
          figure.sha256,
        ]),
      ),
      reviewFingerprint: fingerprint(
        questions.map((question) => [question.id, question.review]),
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
  `ENG_MATH_ENGLISH_CANDIDATE: pass candidate=${overlay.candidateId} mode=${options.check ? "check" : "merge"} questions=${merged.summary.questionCount} answers=${merged.summary.answerCrossCheckCount} overrides=${merged.summary.choiceOverrideQuestionCount} text=${merged.summary.sourceTextOverrideQuestionCount ?? 0} figures=${merged.summary.figureAssetCount} review=${merged.summary.reviewReadyCount} evidence=${merged.summary.evidenceCount} public=0 source=${options.sourceDirectory ? "verified" : "recorded"}`,
);
