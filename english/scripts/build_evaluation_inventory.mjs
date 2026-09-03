import { createHash } from "node:crypto";
import {
  existsSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ENGLISH_DB_PATH = path.join(
  ROOT,
  "english",
  "data",
  "english_exam_db_v2_1.json",
);
const SOURCE_MANIFEST_PATH = path.join(
  ROOT,
  "raw_sources",
  "english_eval_pdfs",
  "manifest.json",
);
const DEFAULT_SOURCE_DIRECTORY = path.dirname(SOURCE_MANIFEST_PATH);
const CANDIDATE_DIRECTORY = path.join(
  ROOT,
  "english",
  "data",
  "candidates",
);
const BASE_REVIEW_PATH = path.join(
  ROOT,
  "평가원_수학영어_확장",
  "10_eng_explain",
  "eng_explain_2026csat.json",
);
const OUTPUT_PATH = path.join(
  CANDIDATE_DIRECTORY,
  "english_evaluation_inventory_v1.json",
);
const COMPLETE_SCHOOL_YEARS = Array.from({ length: 10 }, (_, index) => 2017 + index);
const LATEST_PARTIAL_EXAM_KEYS = new Set(["2027_06", "2027_09"]);
const CHOICE_MARKS = ["①", "②", "③", "④", "⑤"];

function fail(code, detail = "") {
  throw new Error(`${code}${detail ? `: ${detail}` : ""}`);
}

function ensure(condition, code, detail = "") {
  if (!condition) fail(code, detail);
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

function parseArguments() {
  const values = process.argv.slice(2);
  const options = {
    check: values.includes("--check"),
    sourceDirectory: DEFAULT_SOURCE_DIRECTORY,
  };

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value === "--check") continue;
    if (value !== "--source-dir") fail("UNKNOWN_ARGUMENT", value);
    const next = values[index + 1];
    ensure(next && !next.startsWith("--"), "ARGUMENT_VALUE_MISSING", value);
    options.sourceDirectory = path.resolve(ROOT, next);
    index += 1;
  }
  return options;
}

function examLabel(exam) {
  return exam.session === "수능"
    ? `${exam.schoolYear}학년도 수능`
    : `${exam.schoolYear}학년도 ${exam.session} 모의평가`;
}

function loadReadyCandidateOverlays() {
  const overlays = new Map();
  for (const filename of readdirSync(CANDIDATE_DIRECTORY)) {
    if (!filename.endsWith("_candidate.json")) continue;
    const overlay = readJson(path.join(CANDIDATE_DIRECTORY, filename), filename);
    if (
      overlay.status !== "internal_candidate" ||
      overlay.publicConnected !== false ||
      overlay.summary?.questionCount !== 28 ||
      overlay.summary?.answerCrossCheckCount !== 28 ||
      overlay.summary?.reviewReadyCount !== 28 ||
      overlay.summary?.blockedCount !== 0
    ) {
      continue;
    }
    const examKey = overlay.baseData?.examId;
    ensure(typeof examKey === "string", "CANDIDATE_EXAM_KEY", filename);
    ensure(!overlays.has(examKey), "CANDIDATE_EXAM_DUPLICATE", examKey);
    overlays.set(examKey, overlay);
  }
  return overlays;
}

function sourceArtifactFor(
  manifestItem,
  kind,
  sourceDirectory,
  recordedArtifact,
  sourceMode,
) {
  const manifestKey = kind === "explanation" ? "explain" : kind;
  if (sourceMode === "recorded") {
    ensure(typeof recordedArtifact?.filename === "string", "SOURCE_RECORDED_FILENAME", kind);
    if (manifestItem) {
      const source = manifestItem.files?.[manifestKey];
      ensure(source?.ok === true, "SOURCE_MANIFEST_STATUS", `${manifestItem.schoolYear}:${kind}`);
      ensure(recordedArtifact.filename === source.fileName, "SOURCE_RECORDED_FILENAME", source.fileName);
    }
    ensure(/^[a-f0-9]{64}$/.test(recordedArtifact.sha256 ?? ""), "SOURCE_RECORDED_HASH", recordedArtifact.filename);
    return recordedArtifact;
  }
  const source = manifestItem?.files?.[manifestKey];
  ensure(source?.ok === true, "SOURCE_MANIFEST_STATUS", `${manifestItem?.schoolYear}:${kind}`);
  ensure(typeof source.fileName === "string", "SOURCE_FILENAME", `${manifestItem.schoolYear}:${kind}`);
  const filePath = path.join(sourceDirectory, source.fileName);
  return {
    filename: source.fileName,
    sha256: sha256(filePath),
  };
}

function resolveSourceMode(sourceManifest, sourceDirectory) {
  if (!sourceManifest) return "recorded";
  const filenames = sourceManifest.items.flatMap((item) => [
    item.files?.problem?.fileName,
    item.files?.answer?.fileName,
    (item.files?.explain ?? item.files?.script)?.fileName,
  ]);
  ensure(
    filenames.length === 96 && filenames.every((filename) => typeof filename === "string"),
    "SOURCE_MANIFEST_FILE_COUNT",
    String(filenames.length),
  );
  const availableCount = filenames.filter((filename) =>
    existsSync(path.join(sourceDirectory, filename)),
  ).length;
  if (availableCount > 0 && availableCount < filenames.length) {
    fail("SOURCE_FILE_PARTIAL", `${availableCount}/${filenames.length}`);
  }
  return availableCount === filenames.length ? "verified" : "recorded";
}

function validateQuestion(question, examKey, expectedQid, choices) {
  ensure(question?.examId === examKey, "QUESTION_EXAM", `${examKey}:${expectedQid}`);
  ensure(Number(question.qid) === expectedQid, "QUESTION_QID", question?.id ?? examKey);
  ensure(question.id === `${examKey}_${expectedQid}`, "QUESTION_ID", question.id);
  ensure(Number.isInteger(Number(question.answer)), "QUESTION_ANSWER", question.id);
  ensure(Number(question.answer) >= 1 && Number(question.answer) <= 5, "QUESTION_ANSWER_RANGE", question.id);
  ensure(typeof question.rawText === "string" && question.rawText.trim(), "QUESTION_TEXT", question.id);
  ensure(Array.isArray(choices) && choices.length === 5, "QUESTION_CHOICES", question.id);
  choices.forEach((choice, index) => {
    ensure(Number(choice.num) === index + 1, "QUESTION_CHOICE_NUMBER", question.id);
    ensure(choice.mark === CHOICE_MARKS[index], "QUESTION_CHOICE_MARK", question.id);
    const choiceText =
      typeof choice.text === "string" && choice.text.trim()
        ? choice.text.trim()
        : question.type === "문장 삽입"
          ? choice.mark
          : "";
    ensure(choiceText, "QUESTION_CHOICE_TEXT", question.id);
  });
}

function buildInventory(sourceDirectory, recordedInventory = null) {
  const englishDb = readJson(ENGLISH_DB_PATH, "english database");
  const sourceManifest = existsSync(SOURCE_MANIFEST_PATH)
    ? readJson(SOURCE_MANIFEST_PATH, "english source manifest")
    : null;
  const baseReviews = readJson(BASE_REVIEW_PATH, "2026 CSAT reviews");
  const readyOverlays = loadReadyCandidateOverlays();
  const sourceMode = resolveSourceMode(sourceManifest, sourceDirectory);
  ensure(sourceMode === "verified" || recordedInventory, "SOURCE_RECORDED_INVENTORY_MISSING");
  const recordedExams = new Map(
    (recordedInventory?.exams ?? []).map((exam) => [exam.examKey, exam]),
  );
  const questionsById = new Map(
    englishDb.questions.map((question) => [question.id, question]),
  );
  const manifestItems = new Map(
    (sourceManifest?.items ?? []).map((item) => [
      `${item.schoolYear}|${item.examType}`,
      item,
    ]),
  );
  const baseReadyIds = new Set(
    Object.values(baseReviews.items ?? {})
      .filter((item) => item.status === "ready")
      .map((item) => item.id),
  );
  const targetExams = englishDb.exams.filter(
    (exam) =>
      COMPLETE_SCHOOL_YEARS.includes(Number(exam.schoolYear)) ||
      LATEST_PARTIAL_EXAM_KEYS.has(exam.id),
  );

  ensure(targetExams.length === 32, "INVENTORY_EXAM_COUNT", String(targetExams.length));
  const allQuestionIds = [];
  const answerPairs = [];
  const sourceHashes = [];
  const exams = targetExams.map((exam) => {
    const expectedIds = Array.from(
      { length: 28 },
      (_, index) => `${exam.id}_${index + 18}`,
    );
    ensure(
      JSON.stringify(exam.questionIds) === JSON.stringify(expectedIds),
      "EXAM_QUESTION_IDS",
      exam.id,
    );
    const overlay = readyOverlays.get(exam.id);
    const questions = expectedIds.map((id) => questionsById.get(id));
    questions.forEach((question, index) =>
      validateQuestion(
        question,
        exam.id,
        index + 18,
        overlay?.choiceOverrides?.[question.id] ?? question.choices,
      ),
    );

    const manifestItem = manifestItems.get(`${exam.schoolYear}|${exam.session}`);
    ensure(sourceMode === "recorded" || manifestItem, "SOURCE_MANIFEST_EXAM", exam.id);
    const recordedSourceArtifacts = recordedExams.get(exam.id)?.sourceArtifacts;
    const usesExplanation = Boolean(
      manifestItem?.files?.explain ||
        (!manifestItem && recordedSourceArtifacts?.explanation),
    );
    const sourceArtifacts = {
      problem: sourceArtifactFor(
        manifestItem,
        "problem",
        sourceDirectory,
        recordedSourceArtifacts?.problem,
        sourceMode,
      ),
      answer: sourceArtifactFor(
        manifestItem,
        "answer",
        sourceDirectory,
        recordedSourceArtifacts?.answer,
        sourceMode,
      ),
      ...(usesExplanation
        ? {
            explanation: sourceArtifactFor(
              manifestItem,
              "explanation",
              sourceDirectory,
              recordedSourceArtifacts?.explanation,
              sourceMode,
            ),
          }
        : {
            script: sourceArtifactFor(
              manifestItem,
              "script",
              sourceDirectory,
              recordedSourceArtifacts?.script,
              sourceMode,
            ),
          }),
    };
    sourceHashes.push(
      ...Object.values(sourceArtifacts).map((artifact) => artifact.sha256),
    );

    let reviewReadyIds = [];
    if (overlay) {
      reviewReadyIds = overlay.questions.map((question) => question.id);
      ensure(
        JSON.stringify(reviewReadyIds) === JSON.stringify(expectedIds),
        "CANDIDATE_REVIEW_IDS",
        exam.id,
      );
    } else if (exam.id === "2026_csat") {
      reviewReadyIds = expectedIds.filter((id) => baseReadyIds.has(id));
      ensure(reviewReadyIds.length === 27, "BASE_REVIEW_READY_COUNT", String(reviewReadyIds.length));
    }

    const reviewReadyCount = reviewReadyIds.length;
    const reviewStatus =
      reviewReadyCount === 28
        ? "ready"
        : reviewReadyCount > 0
          ? "partial"
          : "pending";
    allQuestionIds.push(...expectedIds);
    answerPairs.push(
      ...questions.map((question) => [question.id, Number(question.answer)]),
    );

    return {
      examKey: exam.id,
      examLabel: examLabel(exam),
      schoolYear: Number(exam.schoolYear),
      session: exam.session,
      scope: LATEST_PARTIAL_EXAM_KEYS.has(exam.id)
        ? "latest_partial_year"
        : "complete_ten_years",
      questionCount: 28,
      answerCrossCheckCount: 28,
      reviewReadyCount,
      reviewPendingCount: 28 - reviewReadyCount,
      reviewStatus,
      reviewReadyQuestionIds: reviewReadyIds,
      questionIds: expectedIds,
      sourceArtifacts,
      answerFingerprint: fingerprint(
        questions.map((question) => [question.id, Number(question.answer)]),
      ),
    };
  });

  const reviewReadyCount = exams.reduce(
    (sum, exam) => sum + exam.reviewReadyCount,
    0,
  );
  ensure(allQuestionIds.length === 896, "INVENTORY_QUESTION_COUNT", String(allQuestionIds.length));
  ensure(new Set(allQuestionIds).size === 896, "INVENTORY_QUESTION_DUPLICATE");
  ensure(reviewReadyCount === 335, "INVENTORY_REVIEW_READY_COUNT", String(reviewReadyCount));
  ensure(sourceHashes.length === 96, "INVENTORY_SOURCE_COUNT", String(sourceHashes.length));
  ensure(new Set(sourceHashes).size === 96, "INVENTORY_SOURCE_HASH_DUPLICATE");

  return {
    schemaVersion: "english-evaluation-inventory-v1",
    status: "internal_inventory",
    publicQuestionPayloadConnected: false,
    scope: {
      completeSchoolYears: COMPLETE_SCHOOL_YEARS,
      latestPartialExamKeys: [...LATEST_PARTIAL_EXAM_KEYS],
    },
    summary: {
      examCount: exams.length,
      completeSchoolYearCount: COMPLETE_SCHOOL_YEARS.length,
      questionCount: allQuestionIds.length,
      answerCrossCheckCount: answerPairs.length,
      reviewReadyCount,
      reviewPendingCount: allQuestionIds.length - reviewReadyCount,
      sourceArtifactCount: sourceHashes.length,
    },
    exams,
    integrity: {
      questionIdsFingerprint: fingerprint(allQuestionIds),
      answerFingerprint: fingerprint(answerPairs),
      sourceHashFingerprint: fingerprint(sourceHashes),
    },
  };
}

const options = parseArguments();
const recordedInventory = existsSync(OUTPUT_PATH)
  ? readJson(OUTPUT_PATH, "recorded english inventory")
  : null;
const inventory = buildInventory(options.sourceDirectory, recordedInventory);
const serialized = `${JSON.stringify(inventory, null, 2)}\n`;

if (options.check) {
  ensure(existsSync(OUTPUT_PATH), "INVENTORY_OUTPUT_MISSING", OUTPUT_PATH);
  ensure(
    readFileSync(OUTPUT_PATH, "utf8") === serialized,
    "INVENTORY_OUTPUT_OUTDATED",
    path.relative(ROOT, OUTPUT_PATH),
  );
} else {
  ensure(existsSync(SOURCE_MANIFEST_PATH), "SOURCE_MANIFEST_REQUIRED_FOR_WRITE");
  ensure(
    resolveSourceMode(readJson(SOURCE_MANIFEST_PATH, "english source manifest"), options.sourceDirectory) === "verified",
    "SOURCE_REQUIRED_FOR_WRITE",
  );
  writeFileSync(OUTPUT_PATH, serialized, "utf8");
}

console.log(
  `ENG_MATH_ENGLISH_INVENTORY: pass mode=${options.check ? "check" : "write"} exams=${inventory.summary.examCount} completeYears=${inventory.summary.completeSchoolYearCount} questions=${inventory.summary.questionCount} answers=${inventory.summary.answerCrossCheckCount} reviews=${inventory.summary.reviewReadyCount}+${inventory.summary.reviewPendingCount} sources=${inventory.summary.sourceArtifactCount}`,
);
