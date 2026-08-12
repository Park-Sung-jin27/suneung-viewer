import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PDFParse } from "pdf-parse";

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
const OUTPUT_PATH = path.join(
  DATA_DIRECTORY,
  "math_legacy_answer_candidates_v1.json",
);
const CIRCLED_ANSWERS = new Map([
  ["①", "1"],
  ["②", "2"],
  ["③", "3"],
  ["④", "4"],
  ["⑤", "5"],
]);
const PRIVATE_USE_DIGITS = new Map([
  [0xe03d, "0"],
  [0xe034, "1"],
  [0xe035, "2"],
  [0xe036, "3"],
  [0xe037, "4"],
  [0xe038, "5"],
  [0xe039, "6"],
  [0xe03a, "7"],
  [0xe03b, "8"],
  [0xe03c, "9"],
]);
const MANUAL_IMAGE_TRANSCRIPTIONS = {
  math_2017_csat_ga: [
    "5",
    "2",
    "5",
    "4",
    "3",
    "5",
    "1",
    "1",
    "2",
    "3",
    "4",
    "4",
    "3",
    "1",
    "4",
    "2",
    "2",
    "3",
    "1",
    "5",
    "4",
    "10",
    "6",
    "16",
    "7",
    "11",
    "32",
    "12",
    "19",
    "216",
  ],
};

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

function normalizeMathGlyphDigits(text) {
  return [...String(text ?? "")]
    .map((character) => {
      const codePoint = character.codePointAt(0);
      return PRIVATE_USE_DIGITS.get(codePoint) ?? character;
    })
    .join("");
}

function normalizeNumericAnswer(value, examKey, qid) {
  ensure(/^\d+$/.test(value), "LEGACY_ANSWER_FORMAT", `${examKey}:${qid}`);
  const normalized = String(Number(value));
  ensure(
    /^\d{1,3}$/.test(normalized),
    "LEGACY_SHORT_ANSWER_RANGE",
    `${examKey}:${qid}:${value}`,
  );
  return normalized;
}

function sourceAvailability(manifest) {
  const artifacts = manifest.exams.flatMap((exam) =>
    Object.values(exam.artifacts),
  );
  const available = artifacts.filter((artifact) =>
    existsSync(path.join(SOURCE_DIRECTORY, artifact.filename)),
  ).length;
  if (available > 0 && available < artifacts.length) {
    fail("LEGACY_ANSWER_SOURCE_PARTIAL", `${available}/${artifacts.length}`);
  }
  return available === artifacts.length ? "verified" : "recorded";
}

function validateSourceManifest(manifest) {
  ensure(
    manifest.schemaVersion === "math-legacy-source-manifest-v1" &&
      manifest.status === "internal_source_inventory" &&
      manifest.publicConnected === false,
    "LEGACY_ANSWER_SOURCE_MANIFEST_STATUS",
  );
  ensure(
    manifest.summary?.schoolYearCount === 5 &&
      manifest.summary?.examCount === 30 &&
      manifest.summary?.expectedQuestionCount === 900 &&
      manifest.summary?.sourceArtifactCount === 90 &&
      Array.isArray(manifest.exams) &&
      manifest.exams.length === 30,
    "LEGACY_ANSWER_SOURCE_MANIFEST_SCOPE",
  );
}

function verifySourceFiles(manifest) {
  for (const exam of manifest.exams) {
    for (const [kind, artifact] of Object.entries(exam.artifacts)) {
      const filePath = path.join(SOURCE_DIRECTORY, artifact.filename);
      ensure(existsSync(filePath), "LEGACY_ANSWER_SOURCE_MISSING", filePath);
      ensure(
        statSync(filePath).size === artifact.size,
        "LEGACY_ANSWER_SOURCE_SIZE",
        `${exam.examKey}:${kind}`,
      );
      ensure(
        sha256File(filePath) === artifact.sha256,
        "LEGACY_ANSWER_SOURCE_HASH",
        `${exam.examKey}:${kind}`,
      );
    }
  }
}

async function readFirstPage(filePath) {
  const parser = new PDFParse({ data: readFileSync(filePath) });
  try {
    const result = await parser.getText({ partial: [1] });
    return normalizeMathGlyphDigits(result.text ?? "");
  } finally {
    await parser.destroy();
  }
}

function parseExplanationAnswerTable(text, examKey) {
  const circledAnswers = [...text.matchAll(/[\u2460-\u2464]/g)]
    .slice(0, 21)
    .map((match) => CIRCLED_ANSWERS.get(match[0]));
  ensure(
    circledAnswers.length === 21,
    "LEGACY_CHOICE_ANSWER_SCOPE",
    `${examKey}:${circledAnswers.length}`,
  );

  const shortAnswers = new Map();
  for (const match of text.matchAll(/\b(2[2-9]|30)\.\s*(\d+)/g)) {
    const qid = Number(match[1]);
    if (!shortAnswers.has(qid)) {
      shortAnswers.set(qid, normalizeNumericAnswer(match[2], examKey, qid));
    }
  }

  if (!shortAnswers.has(22)) {
    const displacedQ22 = text.match(
      /\b21\.\s*22\.\s*[\u2460-\u2464]\s*(\d+)/,
    );
    if (displacedQ22) {
      shortAnswers.set(
        22,
        normalizeNumericAnswer(displacedQ22[1], examKey, 22),
      );
    }
  }

  ensure(
    shortAnswers.size === 9,
    "LEGACY_SHORT_ANSWER_SCOPE",
    `${examKey}:${shortAnswers.size}`,
  );

  return Array.from({ length: 30 }, (_, index) => {
    const qid = index + 1;
    return qid <= 21 ? circledAnswers[index] : shortAnswers.get(qid);
  });
}

function buildQuestionRows(exam, answers, sourceMethod) {
  ensure(answers.length === 30, "LEGACY_EXAM_ANSWER_SCOPE", exam.examKey);
  return answers.map((answer, index) => {
    const qid = index + 1;
    return {
      id: `${exam.examKey.replace(/^math_/, "")}_${qid}`,
      qid,
      responseType: qid <= 21 ? "choice" : "short",
      answer:
        qid <= 21
          ? normalizeNumericAnswer(answer, exam.examKey, qid)
          : normalizeNumericAnswer(answer, exam.examKey, qid),
      sourceMethod,
      answerCrossCheckStatus: "pending_independent_content_check",
    };
  });
}

async function buildCandidate(manifest) {
  const exams = [];
  for (const exam of manifest.exams) {
    const manualAnswers = MANUAL_IMAGE_TRANSCRIPTIONS[exam.examKey];
    let answers;
    let sourceMethod;
    if (manualAnswers) {
      answers = manualAnswers;
      sourceMethod = "official_answer_image_manual_transcription";
    } else {
      const explanationPath = path.join(
        SOURCE_DIRECTORY,
        exam.artifacts.explanation.filename,
      );
      const firstPageText = await readFirstPage(explanationPath);
      answers = parseExplanationAnswerTable(firstPageText, exam.examKey);
      sourceMethod = "official_explanation_answer_table";
    }

    exams.push({
      examKey: exam.examKey,
      schoolYear: exam.schoolYear,
      actualYear: exam.actualYear,
      session: exam.session,
      sessionLabel: exam.sessionLabel,
      curriculum: exam.curriculum,
      track: exam.track,
      trackLabel: exam.trackLabel,
      expectedQuestionCount: 30,
      sourceMethod,
      answerCrossCheckStatus: "pending_independent_content_check",
      sourceArtifacts: {
        answerImage: exam.artifacts.answer,
        explanationPdf: exam.artifacts.explanation,
      },
      questions: buildQuestionRows(exam, answers, sourceMethod),
    });
  }

  const questions = exams.flatMap((exam) => exam.questions);
  ensure(questions.length === 900, "LEGACY_ANSWER_TOTAL_SCOPE", questions.length);
  ensure(
    new Set(questions.map((question) => question.id)).size === 900,
    "LEGACY_ANSWER_ID_DUPLICATE",
  );
  ensure(
    questions.filter((question) => question.responseType === "choice").length ===
      630,
    "LEGACY_CHOICE_TOTAL_SCOPE",
  );
  ensure(
    questions.filter((question) => question.responseType === "short").length ===
      270,
    "LEGACY_SHORT_TOTAL_SCOPE",
  );

  const explanationTableAnswerCount = exams
    .filter((exam) => exam.sourceMethod === "official_explanation_answer_table")
    .reduce((sum, exam) => sum + exam.questions.length, 0);
  const manualImageAnswerCount = exams
    .filter(
      (exam) =>
        exam.sourceMethod === "official_answer_image_manual_transcription",
    )
    .reduce((sum, exam) => sum + exam.questions.length, 0);

  return {
    schemaVersion: "math-legacy-answer-candidates-v1",
    status: "internal_answer_candidate",
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
      answerCandidateCount: questions.length,
      choiceAnswerCount: 630,
      shortAnswerCount: 270,
      explanationTableAnswerCount,
      manualImageAnswerCount,
      independentContentCrossCheckCount: 0,
      publicQuestionCount: 0,
    },
    exams,
    integrity: {
      sourceManifestFingerprint: manifest.integrity.sourceFingerprint,
      examFingerprint: fingerprint(exams.map((exam) => exam.examKey)),
      answerFingerprint: fingerprint(
        questions.map((question) => [
          question.id,
          question.responseType,
          question.answer,
          question.sourceMethod,
        ]),
      ),
    },
  };
}

function validateRecordedCandidate(candidate, manifest) {
  ensure(
    candidate.schemaVersion === "math-legacy-answer-candidates-v1" &&
      candidate.status === "internal_answer_candidate" &&
      candidate.publicConnected === false,
    "LEGACY_RECORDED_ANSWER_STATUS",
  );
  ensure(
    candidate.summary?.schoolYearCount === 5 &&
      candidate.summary?.examCount === 30 &&
      candidate.summary?.answerCandidateCount === 900 &&
      candidate.summary?.choiceAnswerCount === 630 &&
      candidate.summary?.shortAnswerCount === 270 &&
      candidate.summary?.explanationTableAnswerCount === 870 &&
      candidate.summary?.manualImageAnswerCount === 30 &&
      candidate.summary?.independentContentCrossCheckCount === 0 &&
      candidate.summary?.publicQuestionCount === 0,
    "LEGACY_RECORDED_ANSWER_SCOPE",
  );
  ensure(
    candidate.integrity?.sourceManifestFingerprint ===
      manifest.integrity.sourceFingerprint,
    "LEGACY_RECORDED_ANSWER_SOURCE_FINGERPRINT",
  );
  const questions = candidate.exams.flatMap((exam) => exam.questions ?? []);
  ensure(
    candidate.exams.length === 30 &&
      questions.length === 900 &&
      new Set(questions.map((question) => question.id)).size === 900 &&
      questions.every(
        (question) =>
          question.answerCrossCheckStatus ===
          "pending_independent_content_check",
      ),
    "LEGACY_RECORDED_ANSWER_CONTENT",
  );
}

const mode = process.argv[2] ?? "--check";
ensure(["--check", "--write"].includes(mode), "MODE_INVALID", mode);
const sourceManifest = readJson(SOURCE_MANIFEST_PATH, "legacy source manifest");
validateSourceManifest(sourceManifest);
const availability = sourceAvailability(sourceManifest);

if (availability === "verified") {
  verifySourceFiles(sourceManifest);
  const candidate = await buildCandidate(sourceManifest);
  const serialized = stableJson(candidate);
  if (mode === "--write") {
    writeFileSync(OUTPUT_PATH, serialized, "utf8");
  } else {
    ensure(existsSync(OUTPUT_PATH), "LEGACY_ANSWER_CANDIDATE_MISSING");
    ensure(
      readFileSync(OUTPUT_PATH, "utf8") === serialized,
      "LEGACY_ANSWER_CANDIDATE_DRIFT",
    );
  }
} else {
  ensure(mode === "--check", "LEGACY_ANSWER_SOURCE_REQUIRED_FOR_WRITE");
  const recordedCandidate = readJson(
    OUTPUT_PATH,
    "legacy recorded answer candidate",
  );
  validateRecordedCandidate(recordedCandidate, sourceManifest);
}

const candidate = readJson(OUTPUT_PATH, "legacy answer candidate");
validateRecordedCandidate(candidate, sourceManifest);
console.log(
  `MATH_LEGACY_ANSWER_CANDIDATES: pass source=${availability} years=5 exams=30 answers=900 parsed=870 manual=30 crosschecked=0 public=0`,
);
