import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ENGLISH_DB_PATH = path.join(
  ROOT,
  "english",
  "data",
  "english_exam_db_v2_1.json",
);
const ENGLISH_CANDIDATE_GATE_PATH = path.join(
  ROOT,
  "english",
  "scripts",
  "merge_candidate_overlay.mjs",
);
const ENGLISH_CANDIDATE_SOURCE_DIRECTORY = path.join(
  ROOT,
  "raw_sources",
  "english_eval_pdfs",
);
const PUBLIC_DATA_DIRECTORY = path.join(ROOT, "public", "data", "eng-math");
const ENGLISH_FREE_OUTPUT_PATH = path.join(
  PUBLIC_DATA_DIRECTORY,
  "english-free-public.json",
);
const MATH_FREE_OUTPUT_PATH = path.join(
  PUBLIC_DATA_DIRECTORY,
  "math-free-public.json",
);
const CATALOG_OUTPUT_PATH = path.join(
  PUBLIC_DATA_DIRECTORY,
  "catalog-public.json",
);
const LEGACY_PUBLIC_DATA_PATHS = [
  path.join(PUBLIC_DATA_DIRECTORY, "english-2026-csat-public.json"),
  path.join(PUBLIC_DATA_DIRECTORY, "math-full-no-figure-public.json"),
];
const ENGLISH_FIGURE_PUBLIC_PATH = path.join(
  ROOT,
  "public",
  "images",
  "eng-math",
  "english",
  "2026-csat",
  "q25-figure.png",
);
const ENGLISH_FIGURE_PROTECTED_PATH = path.join(
  ROOT,
  "english",
  "assets",
  "2026-csat",
  "q25-figure.png",
);
const ENGLISH_EXCLUDED_IDS = new Set(["2026_csat_18"]);
const ENGLISH_FREE_IDS = [
  "2026_csat_19",
  "2026_csat_20",
  "2026_csat_21",
  "2026_csat_22",
  "2026_csat_23",
];
const MATH_FREE_IDS = [
  "2022_06_common_1",
  "2022_06_common_2",
  "2022_06_common_3",
  "2022_06_common_5",
  "2022_06_common_6",
];
const MATH_VERIFIED_SOLUTION_FILENAME = "math_free_verified_solutions_v1.json";
const MATH_VERIFIED_SOURCE_HASHES = {
  archiveSha256:
    "f8cd746470d14dfa8a75a1bac3da85cd57f630f57a6f1427e87c366113b610ce",
  problemSha256:
    "f11cb2940871bbee2196d3e9a4be6848a8bba00c729ed68bf6096c1f1c2dbaf3",
  answerSha256:
    "d6489fd49be06b0fd212ad5b4f855ea8b02952f12839211f6b64b93ae8844b75",
};
const ENGLISH_CHOICE_MARKS = ["①", "②", "③", "④", "⑤"];
const ENGLISH_PUBLIC_CHOICE_FINGERPRINT =
  "bbcfd28510d68d5193210254f08f0df4ac457b0b4bcd5849eb9d2ee5196f4a63";
const ENGLISH_CHOICE_CONTAMINATION_PATTERNS = [
  /--\s*\d+\s+of\s+\d+\s*--/i,
  /이 문제지에 관한 저작권/,
  /이제 듣기 문제가 끝났습니다/,
  /\*?\s*확인 사항/,
  /\[\d{2}\s*[~～－-]\s*\d{2}\]\s*(?:다음|주어진|글의)/,
];
const MATH_FIGURE_BLOCKED_IDS = [
  "2022_06_common_4",
  "2023_06_common_4",
  "2023_09_cal_27",
  "2024_09_common_4",
  "2024_09_sta_24",
  "2025_06_common_4",
  "2025_09_common_4",
];
const MATH_FIGURE_DESCRIPTION_IDS = [
  "2022_06_common_12",
  "2022_06_cal_26",
  "2022_06_cal_28",
  "2022_06_geo_26",
  "2022_06_geo_27",
  "2022_06_geo_28",
  "2022_06_geo_29",
  "2022_09_common_10",
  "2022_09_common_12",
  "2022_09_common_21",
  "2022_09_cal_26",
  "2022_09_cal_27",
  "2022_09_cal_28",
  "2022_09_geo_26",
  "2022_09_geo_27",
  "2022_09_geo_28",
  "2022_09_geo_29",
  "2023_06_common_10",
  "2023_06_common_13",
  "2023_06_cal_26",
  "2023_06_cal_29",
  "2023_06_geo_26",
  "2023_06_geo_27",
  "2023_06_geo_29",
  "2023_06_geo_30",
  "2023_09_common_12",
  "2023_09_common_13",
  "2023_09_common_21",
  "2023_09_cal_26",
  "2023_09_cal_28",
  "2023_09_cal_29",
  "2023_09_geo_25",
  "2023_09_geo_27",
  "2023_09_geo_28",
  "2023_09_geo_29",
  "2024_06_common_10",
  "2024_06_common_11",
  "2024_06_common_13",
  "2024_06_geo_25",
  "2024_06_geo_29",
  "2024_06_geo_30",
  "2024_09_common_20",
  "2024_09_cal_30",
  "2024_09_geo_26",
  "2024_09_geo_28",
  "2025_06_common_12",
  "2025_06_common_13",
  "2025_06_cal_26",
  "2025_06_geo_27",
  "2025_09_common_10",
  "2025_09_cal_26",
  "2025_09_geo_27",
  "2025_09_geo_28",
  "2025_09_geo_29",
  "2025_09_geo_30",
];
const MATH_FIGURE_DECORATIVE_IDS = [
  "2022_06_sta_29",
  "2022_06_sta_30",
  "2022_09_sta_26",
  "2023_06_sta_24",
  "2023_09_sta_26",
  "2023_09_sta_29",
  "2024_06_sta_29",
  "2024_06_sta_30",
  "2024_09_sta_28",
  "2024_09_sta_29",
  "2025_06_sta_27",
  "2025_06_sta_28",
];
const ENGLISH_SESSION_NUMBER_GROUPS = [
  [19, 20, 21, 22, 23],
  [24, 25, 26, 27, 28],
  [29, 30, 31, 32, 33],
  [34, 35, 36, 37, 38],
  [36, 37, 38, 39, 40],
  [41, 42, 43, 44, 45],
];
const MATH_SESSION_EXAMS = [
  "2022_06",
  "2022_09",
  "2023_06",
  "2023_09",
  "2024_06",
  "2024_09",
  "2025_06",
  "2025_09",
];
const MATH_SESSION_TRACKS = ["common", "cal", "sta", "geo"];
const SKIP_DIRECTORIES = new Set([".git", "dist", "node_modules"]);
const FORBIDDEN_PUBLIC_KEYS = new Set([
  "answerCrossCheck",
  "answerSource",
  "confidence",
  "coreConcepts",
  "difficultyLevel",
  "examKey",
  "extraction",
  "figureDesc",
  "hasFigure",
  "logicFlow",
  "meta",
  "metaSource",
  "notes",
  "pitfalls",
  "rawText",
  "source",
  "sourceIssue",
  "sourcePage",
]);

function findFile(directory, filename) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (SKIP_DIRECTORIES.has(entry.name)) continue;
    const entryPath = path.join(directory, entry.name);
    if (entry.isFile() && entry.name === filename) return entryPath;
    if (entry.isDirectory()) {
      const found = findFile(entryPath, filename);
      if (found) return found;
    }
  }
  return null;
}

function fail(code, detail) {
  throw new Error(`${code}: ${detail}`);
}

function readJson(filePath, label) {
  if (!filePath || !existsSync(filePath)) fail("SOURCE_MISSING", label);
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function fileSha256(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function answerMark(answer) {
  return ["①", "②", "③", "④", "⑤"][Number(answer) - 1] ?? null;
}

function contentFingerprint(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function requireText(value, code, detail) {
  if (typeof value !== "string" || !value.trim()) fail(code, detail);
}

function validateMathVerifiedSolutions(mathDbPath, mathDb, sourceDirectory) {
  const solutionPath = path.join(
    path.dirname(mathDbPath),
    MATH_VERIFIED_SOLUTION_FILENAME,
  );
  const database = readJson(solutionPath, MATH_VERIFIED_SOLUTION_FILENAME);
  const metadata = database.metadata;
  if (metadata?.schemaVersion !== "math-verified-solution-v1") {
    fail("MATH_SOLUTION_SCHEMA", String(metadata?.schemaVersion));
  }
  if (
    metadata.status !== "internal_verified_candidate" ||
    metadata.publicConnected !== false
  ) {
    fail("MATH_SOLUTION_BOUNDARY", metadata.status);
  }
  if (metadata.itemCount !== 5 || metadata.readyCount !== 5) {
    fail(
      "MATH_SOLUTION_METADATA_COUNT",
      `${metadata.itemCount}/${metadata.readyCount}`,
    );
  }
  if (metadata.verifiedAt !== "2026-08-04") {
    fail("MATH_SOLUTION_VERIFIED_AT", String(metadata.verifiedAt));
  }
  for (const [key, expected] of Object.entries(MATH_VERIFIED_SOURCE_HASHES)) {
    if (metadata.sourceArtifacts?.[key] !== expected) {
      fail("MATH_SOLUTION_SOURCE_HASH", key);
    }
  }
  requireText(
    metadata.sourceArtifacts?.archiveUrl,
    "MATH_SOLUTION_SOURCE_URL",
    "archiveUrl",
  );
  requireText(metadata.note, "MATH_SOLUTION_NOTE", "metadata");
  if (sourceDirectory) {
    const problemPath = findFile(
      sourceDirectory,
      metadata.sourceArtifacts.problemFilename,
    );
    const answerPath = findFile(
      sourceDirectory,
      metadata.sourceArtifacts.answerFilename,
    );
    if (!problemPath || !answerPath) {
      fail("MATH_SOLUTION_SOURCE_FILE", sourceDirectory);
    }
    if (fileSha256(problemPath) !== metadata.sourceArtifacts.problemSha256) {
      fail("MATH_SOLUTION_PROBLEM_HASH", problemPath);
    }
    if (fileSha256(answerPath) !== metadata.sourceArtifacts.answerSha256) {
      fail("MATH_SOLUTION_ANSWER_HASH", answerPath);
    }
  }

  const questionsById = new Map(
    mathDb.questions.map((question) => [question.id, question]),
  );
  const sourceQuestions = MATH_FREE_IDS.map((id) => {
    const question = questionsById.get(id);
    if (!question) fail("MATH_SOLUTION_SOURCE_QUESTION", id);
    return {
      id: question.id,
      problem: question.problem_latex,
      choices: question.choices,
      answer: question.answer,
      answerType: question.answerType,
      answerCrossCheck: question.answerCrossCheck,
    };
  });
  const questionFingerprint = contentFingerprint(sourceQuestions);
  if (metadata.questionFingerprint !== questionFingerprint) {
    fail(
      "MATH_SOLUTION_QUESTION_FINGERPRINT",
      `${questionFingerprint} != ${metadata.questionFingerprint}`,
    );
  }

  const itemIds = Object.keys(database.items ?? {});
  if (stableJson(itemIds) !== stableJson(MATH_FREE_IDS)) {
    fail("MATH_SOLUTION_IDS", itemIds.join(","));
  }
  const expectedProblemPages = new Map([
    ["2022_06_common_1", 1],
    ["2022_06_common_2", 1],
    ["2022_06_common_3", 1],
    ["2022_06_common_5", 2],
    ["2022_06_common_6", 2],
  ]);

  const items = MATH_FREE_IDS.map((id) => {
    const item = database.items[id];
    const question = questionsById.get(id);
    if (item?.id !== id || item.status !== "verified_internal_candidate") {
      fail("MATH_SOLUTION_ITEM_STATUS", id);
    }
    if (
      Number(item.answer) !== Number(question.answer) ||
      item.answerMark !== answerMark(question.answer)
    ) {
      fail("MATH_SOLUTION_ANSWER", id);
    }
    const expectedQuestionNumber = Number(id.split("_").at(-1));
    if (item.questionNumber !== expectedQuestionNumber) {
      fail("MATH_SOLUTION_QUESTION_NUMBER", id);
    }
    requireText(item.exam, "MATH_SOLUTION_EXAM", id);
    requireText(item.summary, "MATH_SOLUTION_SUMMARY", id);
    requireText(item.approach, "MATH_SOLUTION_APPROACH", id);
    requireText(item.correctReason, "MATH_SOLUTION_REASON", id);
    requireText(item.commonMistake, "MATH_SOLUTION_MISTAKE", id);
    if (
      !Array.isArray(item.concepts) ||
      item.concepts.length < 2 ||
      item.concepts.some((concept) => !String(concept).trim())
    ) {
      fail("MATH_SOLUTION_CONCEPTS", id);
    }
    if (!Array.isArray(item.steps) || item.steps.length < 2) {
      fail("MATH_SOLUTION_STEPS", id);
    }
    item.steps.forEach((step, index) => {
      requireText(step?.title, "MATH_SOLUTION_STEP_TITLE", `${id}:${index}`);
      requireText(
        step?.expression,
        "MATH_SOLUTION_STEP_EXPRESSION",
        `${id}:${index}`,
      );
      requireText(
        step?.explanation,
        "MATH_SOLUTION_STEP_EXPLANATION",
        `${id}:${index}`,
      );
    });
    const verification = item.verification;
    if (
      verification?.problemPage !== expectedProblemPages.get(id) ||
      verification?.answerTablePage !== 1 ||
      verification?.problemMatchedPdf !== true ||
      verification?.choicesMatchedPdf !== true ||
      verification?.answerMatchedPdf !== true ||
      verification?.independentDerivation !== true
    ) {
      fail("MATH_SOLUTION_VERIFICATION", id);
    }
    return item;
  });

  const serialized = stableJson(database);
  if (serialized.includes("ProbDex") || serialized.includes("AI생성-미검증")) {
    fail("MATH_SOLUTION_UNVERIFIED_SOURCE_LEAK", solutionPath);
  }
  return items;
}

function validateEnglishCandidate() {
  try {
    execFileSync(
      process.execPath,
      [
        ENGLISH_CANDIDATE_GATE_PATH,
        "--check",
        "--source-dir",
        ENGLISH_CANDIDATE_SOURCE_DIRECTORY,
      ],
      { cwd: ROOT, encoding: "utf8", stdio: "pipe" },
    );
  } catch (error) {
    const detail = String(error.stderr || error.stdout || error.message).trim();
    fail("ENGLISH_CANDIDATE_GATE", detail);
  }
}

function parseMathSessionId(id) {
  const match = String(id).match(
    /^(\d{4}_(?:06|09))_(common|cal|sta|geo)_(\d+)$/,
  );
  if (!match) fail("MATH_SESSION_ID_FORMAT", id);
  return {
    scopeKey: `${match[1]}|${match[2]}`,
    questionNumber: Number(match[3]),
  };
}

function buildFiveQuestionGroups(questions, scopeKey) {
  if (questions.length < 5) {
    fail("SESSION_SCOPE_TOO_SMALL", `${scopeKey}:${questions.length}`);
  }

  const groups = [];
  for (let offset = 0; offset < questions.length; offset += 5) {
    const start =
      questions.length - offset >= 5 ? offset : questions.length - 5;
    const group = questions.slice(start, start + 5);
    if (groups.some((candidate) => candidate[0].id === group[0].id)) continue;
    groups.push(group);
  }
  return groups;
}

function validateFiveQuestionGroup(group, scopeKey) {
  if (group.length !== 5) {
    fail("SESSION_QUESTION_COUNT", `${scopeKey}:${group.length}`);
  }
  if (new Set(group.map((question) => question.id)).size !== 5) {
    fail("SESSION_QUESTION_DUPLICATE", scopeKey);
  }
}

function validateSessionCatalog(english, math) {
  const englishByNumber = new Map();
  for (const question of english) {
    const match = question.id.match(/^2026_csat_(\d+)$/);
    if (!match) fail("ENGLISH_SESSION_ID_FORMAT", question.id);
    englishByNumber.set(Number(match[1]), question);
  }

  const englishGroups = ENGLISH_SESSION_NUMBER_GROUPS.map((numbers) =>
    numbers.map((number) => {
      const question = englishByNumber.get(number);
      if (!question) fail("ENGLISH_SESSION_QUESTION_MISSING", String(number));
      return question;
    }),
  );
  const englishCoverage = new Set();
  for (const group of englishGroups) {
    validateFiveQuestionGroup(group, "english");
    group.forEach((question) => englishCoverage.add(question.id));
  }
  if (
    englishGroups.length !== 6 ||
    englishCoverage.size !== english.length ||
    english.some((question) => !englishCoverage.has(question.id))
  ) {
    fail(
      "ENGLISH_SESSION_COVERAGE",
      `${englishGroups.length}:${englishCoverage.size}`,
    );
  }
  if (
    englishByNumber.get(41)?.passage !== englishByNumber.get(42)?.passage ||
    englishByNumber.get(43)?.passage !== englishByNumber.get(44)?.passage ||
    englishByNumber.get(44)?.passage !== englishByNumber.get(45)?.passage
  ) {
    fail("ENGLISH_SESSION_SHARED_PASSAGE", "41-45");
  }

  const mathByScope = new Map();
  for (const question of math) {
    const parsed = parseMathSessionId(question.id);
    if (!mathByScope.has(parsed.scopeKey)) mathByScope.set(parsed.scopeKey, []);
    mathByScope.get(parsed.scopeKey).push({
      ...question,
      sessionQuestionNumber: parsed.questionNumber,
    });
  }

  const expectedScopeKeys = MATH_SESSION_EXAMS.flatMap((exam) =>
    MATH_SESSION_TRACKS.map((track) => `${exam}|${track}`),
  );
  if (
    mathByScope.size !== expectedScopeKeys.length ||
    expectedScopeKeys.some((scopeKey) => !mathByScope.has(scopeKey))
  ) {
    fail("MATH_SESSION_SCOPE_COUNT", String(mathByScope.size));
  }

  let mathGroupCount = 0;
  const mathCoverage = new Set();
  for (const scopeKey of expectedScopeKeys) {
    const scopedQuestions = mathByScope
      .get(scopeKey)
      .sort(
        (left, right) =>
          left.sessionQuestionNumber - right.sessionQuestionNumber,
      );
    const groups = buildFiveQuestionGroups(scopedQuestions, scopeKey);
    mathGroupCount += groups.length;
    for (const group of groups) {
      validateFiveQuestionGroup(group, scopeKey);
      for (const question of group) {
        if (parseMathSessionId(question.id).scopeKey !== scopeKey) {
          fail("MATH_SESSION_SCOPE_MIXED", question.id);
        }
        mathCoverage.add(question.id);
      }
    }
  }

  if (
    mathGroupCount !== 88 ||
    mathCoverage.size !== math.length ||
    math.some((question) => !mathCoverage.has(question.id))
  ) {
    fail("MATH_SESSION_COVERAGE", `${mathGroupCount}:${mathCoverage.size}`);
  }
}

function hasExactQuestionIds(questions, expectedIds) {
  const actualIds = questions.map((question) => question.id);
  return (
    actualIds.length === expectedIds.length &&
    actualIds.every((id, index) => id === expectedIds[index])
  );
}

function buildPublicCatalog(english, math) {
  const englishByNumber = new Map(
    english.map((question) => [
      Number(question.id.replace("2026_csat_", "")),
      question,
    ]),
  );
  const englishPacks = ENGLISH_SESSION_NUMBER_GROUPS.map((numbers, index) => {
    const questions = numbers.map((number) => englishByNumber.get(number));
    if (questions.some((question) => !question)) {
      fail("ENGLISH_CATALOG_QUESTION_MISSING", numbers.join(","));
    }
    const isFree = hasExactQuestionIds(questions, ENGLISH_FREE_IDS);
    return {
      id: `english-${String(index + 1).padStart(2, "0")}`,
      examKey: "2026_csat",
      examLabel: "2026학년도 수능",
      trackKey: "english",
      trackLabel: "영어",
      label: `${numbers[0]}~${numbers.at(-1)}번`,
      note:
        index === 4
          ? "앞 묶음의 3문항을 복습합니다."
          : index === 5
            ? "공통 지문 문항을 함께 풉니다."
            : "",
      questionCount: 5,
      scopeQuestionCount: 27,
      access: isFree ? "free" : "locked",
    };
  });

  const mathByScope = new Map();
  for (const question of math) {
    const parsed = parseMathSessionId(question.id);
    if (!mathByScope.has(parsed.scopeKey)) mathByScope.set(parsed.scopeKey, []);
    mathByScope.get(parsed.scopeKey).push({
      ...question,
      sessionQuestionNumber: parsed.questionNumber,
    });
  }

  const trackLabels = {
    common: "공통",
    cal: "미적분",
    sta: "확률과통계",
    geo: "기하",
  };
  const mathPacks = [];
  for (const examKey of MATH_SESSION_EXAMS) {
    for (const trackKey of MATH_SESSION_TRACKS) {
      const scopeKey = `${examKey}|${trackKey}`;
      const scopedQuestions = mathByScope
        .get(scopeKey)
        .sort(
          (left, right) =>
            left.sessionQuestionNumber - right.sessionQuestionNumber,
        );
      const groups = buildFiveQuestionGroups(scopedQuestions, scopeKey);
      const examLabel = scopedQuestions[0]?.label.split(" · ")[0] ?? examKey;

      groups.forEach((questions, index) => {
        const questionNumbers = questions.map(
          (question) => question.sessionQuestionNumber,
        );
        const choiceCount = questions.filter(
          (question) => question.responseType === "choice",
        ).length;
        const shortCount = questions.length - choiceCount;
        const responseSummary = [
          choiceCount ? `선다형 ${choiceCount}` : "",
          shortCount ? `단답형 ${shortCount}` : "",
        ]
          .filter(Boolean)
          .join(" · ");
        const isFree = hasExactQuestionIds(questions, MATH_FREE_IDS);

        mathPacks.push({
          id: `math-${examKey}-${trackKey}-${String(index + 1).padStart(2, "0")}`,
          examKey,
          examLabel,
          trackKey,
          trackLabel: trackLabels[trackKey],
          label: `${questionNumbers.join("·")}번`,
          note:
            index === groups.length - 1 && scopedQuestions.length % 5 !== 0
              ? `마지막 ${scopedQuestions.length % 5}문항과 앞 문항을 함께 복습합니다.`
              : "",
          responseSummary,
          questionCount: 5,
          scopeQuestionCount: scopedQuestions.length,
          access: isFree ? "free" : "locked",
        });
      });
    }
  }

  const englishFreePacks = englishPacks.filter(
    (pack) => pack.access === "free",
  );
  const mathFreePacks = mathPacks.filter((pack) => pack.access === "free");
  if (englishPacks.length !== 6 || englishFreePacks.length !== 1) {
    fail(
      "ENGLISH_CATALOG_BOUNDARY",
      `${englishPacks.length}:${englishFreePacks.length}`,
    );
  }
  if (mathPacks.length !== 88 || mathFreePacks.length !== 1) {
    fail(
      "MATH_CATALOG_BOUNDARY",
      `${mathPacks.length}:${mathFreePacks.length}`,
    );
  }

  return {
    version: 1,
    subjects: {
      english: {
        totalQuestionCount: 27,
        freeQuestionCount: 5,
        lockedQuestionCount: 22,
        packCount: 6,
        freePackId: englishFreePacks[0].id,
        packs: englishPacks,
      },
      math: {
        totalQuestionCount: 361,
        freeQuestionCount: 5,
        lockedQuestionCount: 356,
        packCount: 88,
        freePackId: mathFreePacks[0].id,
        packs: mathPacks,
      },
    },
  };
}

function validateEnglishChoices(question) {
  if (!Array.isArray(question.choices) || question.choices.length !== 5) {
    fail("ENGLISH_CHOICE_COUNT", question.id);
  }

  const allowEmptyText = question.type === "문장 삽입";
  question.choices.forEach((choice, index) => {
    const expectedNumber = index + 1;
    const text = choice.text;
    if (Number(choice.num) !== expectedNumber) {
      fail(
        "ENGLISH_CHOICE_NUMBER_ORDER",
        `${question.id}:${choice.num}!=${expectedNumber}`,
      );
    }
    if (choice.mark !== ENGLISH_CHOICE_MARKS[index]) {
      fail(
        "ENGLISH_CHOICE_MARK_ORDER",
        `${question.id}:${choice.mark}!=${ENGLISH_CHOICE_MARKS[index]}`,
      );
    }
    if (typeof text !== "string" || (!allowEmptyText && !text.trim())) {
      fail("ENGLISH_CHOICE_TEXT_MISSING", `${question.id}:${expectedNumber}`);
    }
    if (
      ENGLISH_CHOICE_CONTAMINATION_PATTERNS.some((pattern) =>
        pattern.test(text),
      )
    ) {
      fail("ENGLISH_CHOICE_CONTAMINATION", `${question.id}:${expectedNumber}`);
    }
  });

  const answer = Number(question.answer);
  if (!Number.isInteger(answer) || answer < 1 || answer > 5) {
    fail("ENGLISH_ANSWER_INVALID", `${question.id}:${question.answer}`);
  }
}

function englishChoiceFingerprint(questions) {
  const fingerprintInput = questions.map((question) => [
    question.id,
    question.choices.map((choice) => [
      Number(choice.num),
      choice.mark,
      choice.text,
    ]),
  ]);
  return createHash("sha256")
    .update(JSON.stringify(fingerprintInput))
    .digest("hex");
}

function formatMathLabel(question) {
  const sessionLabel =
    question.session === "6월" ? "6월 모의평가" : "9월 모의평가";
  const trackLabel = {
    common: "공통",
    cal: "미적분",
    geo: "기하",
    sta: "확률과 통계",
  }[question.track];

  if (!trackLabel) fail("MATH_TRACK_INVALID", question.id);
  return `${question.schoolYear}학년도 ${sessionLabel} · ${trackLabel} ${question.qid}번`;
}

function uniqueIdSet(ids, code) {
  const idSet = new Set(ids);
  if (idSet.size !== ids.length) fail(code, "duplicate id");
  return idSet;
}

function assertMatchingIds(actualIds, expectedIds, code) {
  const missing = [...expectedIds].filter((id) => !actualIds.has(id));
  const unexpected = [...actualIds].filter((id) => !expectedIds.has(id));
  if (missing.length || unexpected.length) {
    fail(
      code,
      `missing=${missing.join(",") || "none"}; unexpected=${unexpected.join(",") || "none"}`,
    );
  }
}

function validateMathFigurePolicy(mathDb) {
  const blockedIds = uniqueIdSet(
    MATH_FIGURE_BLOCKED_IDS,
    "MATH_FIGURE_BLOCKED_DUPLICATE",
  );
  const descriptionIds = uniqueIdSet(
    MATH_FIGURE_DESCRIPTION_IDS,
    "MATH_FIGURE_DESCRIPTION_DUPLICATE",
  );
  const decorativeIds = uniqueIdSet(
    MATH_FIGURE_DECORATIVE_IDS,
    "MATH_FIGURE_DECORATIVE_DUPLICATE",
  );

  if (blockedIds.size !== 7)
    fail("MATH_FIGURE_BLOCKED_COUNT", String(blockedIds.size));
  if (descriptionIds.size !== 55)
    fail("MATH_FIGURE_DESCRIPTION_COUNT", String(descriptionIds.size));
  if (decorativeIds.size !== 12)
    fail("MATH_FIGURE_DECORATIVE_COUNT", String(decorativeIds.size));

  const policyIds = new Set([
    ...blockedIds,
    ...descriptionIds,
    ...decorativeIds,
  ]);
  if (policyIds.size !== 74)
    fail("MATH_FIGURE_POLICY_COUNT", String(policyIds.size));

  const fullFigureQuestions = mathDb.questions.filter(
    (question) =>
      question.answerCrossCheck === "full" && question.hasFigure === true,
  );
  const fullFigureIds = new Set(
    fullFigureQuestions.map((question) => question.id),
  );
  if (fullFigureIds.size !== 74)
    fail("MATH_FULL_FIGURE_COUNT", String(fullFigureIds.size));
  assertMatchingIds(fullFigureIds, policyIds, "MATH_FIGURE_POLICY_MISMATCH");

  const descriptionsById = new Map(
    fullFigureQuestions.map((question) => [question.id, question.figureDesc]),
  );
  for (const id of descriptionIds) {
    if (!String(descriptionsById.get(id) ?? "").trim())
      fail("MATH_FIGURE_DESCRIPTION_MISSING", id);
  }

  return { blockedIds, descriptionIds, decorativeIds };
}

function hasInlineChoiceMarkers(question) {
  return (
    question.group === "grammar" ||
    question.group === "irrelevant" ||
    question.group === "vocab" ||
    (question.group === "order" && (question.qid === 38 || question.qid === 39))
  );
}

function stripPdfPageTail(text) {
  return text.replace(/\s+--\s*\d+\s+of\s+\d+\s*--[\s\S]*$/, "");
}

function findLastChoiceBlockStart(text) {
  let best = -1;
  let start = text.indexOf(ENGLISH_CHOICE_MARKS[0]);

  while (start >= 0) {
    let position = start;
    let complete = true;
    for (const mark of ENGLISH_CHOICE_MARKS.slice(1)) {
      position = text.indexOf(mark, position + 1);
      if (position < 0) {
        complete = false;
        break;
      }
    }
    if (complete) best = start;
    start = text.indexOf(ENGLISH_CHOICE_MARKS[0], start + 1);
  }

  if (best >= 0) return best;
  const fallback = text.lastIndexOf("\n①");
  return fallback >= 0 ? fallback + 1 : -1;
}

function trimInlineMarkerTail(text) {
  const fifth = text.indexOf("⑤");
  if (fifth < 0) return text;

  const searchFrom = fifth + 1;
  const tail = text.slice(searchFrom);
  const cuts = [
    /\s+\[\d{2}\s*[~～－-]\s*\d{2}\]/,
    /\s+\d{1,2}\.\s+[A-Z]/,
    /\s+[A-Z][A-Za-z0-9'’.-]*(?:\s+[A-Z][A-Za-z0-9'’.-]*){0,5}\s+(?:Program|Festival|Event|Competition|Contest|Workshop|Camp|Notice)\b/,
  ]
    .map((pattern) => pattern.exec(tail))
    .filter(Boolean)
    .map((match) => searchFrom + match.index);

  return cuts.length
    ? text.slice(0, Math.min(...cuts)).replace(/\s+$/, "")
    : text;
}

function restoreBlankMarker(question, text) {
  if (question.group !== "blank" || question.qid < 31 || question.qid > 34) {
    return text.replace(/\t/g, " ");
  }
  if (text.includes("____")) return text.replace(/\t/g, " ");

  let restored = text.replace(/\t+\s*([.,;:?!])/, " ____$1");
  if (restored === text)
    restored = restored.replace(/a\(n\)\s*\t+\s*/, "a(n) ____ ");
  if (restored === text)
    restored = restored.replace(/\bthat\s*\n\s*\./, "that ____.");
  if (restored === text) restored = restored.replace(/\t+/, " ____ ");
  restored = restored.replace(/\t/g, " ");
  if (!restored.includes("____")) {
    const beforeFallback = restored;
    restored = restored.replace(/\s*(\[[23]점\])/, " ____ $1");
    if (restored === beforeFallback) restored += "\n____";
  }
  return restored;
}

function normalizePassageLineBreaks(text) {
  let source = String(text ?? "").replace(/\r\n?/g, "\n");
  let lead = "";
  const firstBreak = source.indexOf("\n");
  if (firstBreak > 0) {
    const firstLine = source.slice(0, firstBreak).trim();
    if (/^\d{1,2}\./.test(firstLine) && firstLine.length <= 180) {
      lead = firstLine;
      source = source.slice(firstBreak + 1);
    }
  }

  const body = source
    .replace(/\n{3,}/g, "\n\n")
    .split(/\n{2,}/)
    .map((part) =>
      part
        .replace(/[ \t]*\n[ \t]*/g, " ")
        .replace(/[ \t]{2,}/g, " ")
        .trim(),
    )
    .filter(Boolean)
    .join("\n\n")
    .replace(/(\S)\s+(\*+\s)/g, "$1\n$2");

  return lead ? `${lead}\n\n${body}` : body;
}

function cutChoicesFromRaw(rawText, question) {
  let body = stripPdfPageTail(rawText).replace(/\s+$/, "");
  const choiceStart = findLastChoiceBlockStart(body);
  if (hasInlineChoiceMarkers(question)) {
    body = trimInlineMarkerTail(body);
  } else if (
    choiceStart >= 0 &&
    (question.figure || choiceStart > Math.max(80, body.length * 0.35))
  ) {
    body = body.slice(0, choiceStart).replace(/\s+$/, "");
  }
  return normalizePassageLineBreaks(restoreBlankMarker(question, body)).replace(
    /\s+$/,
    "",
  );
}

function removeLeadingStem(passage, stem) {
  const normalizedStem = normalizePassageLineBreaks(stem).trim();
  const separator = passage.indexOf("\n\n");
  const normalizedPrefix = passage
    .slice(0, separator >= 0 ? separator : passage.length)
    .replace(/\s+/g, " ")
    .trim();
  if (
    separator >= 0 &&
    normalizedPrefix === normalizedStem.replace(/\s+/g, " ")
  ) {
    return passage.slice(separator + 2).trim();
  }
  if (normalizedStem && passage.startsWith(normalizedStem))
    return passage.slice(normalizedStem.length).trim();
  return passage;
}

function validateEnglishPassage(question, passage) {
  if (
    ENGLISH_CHOICE_CONTAMINATION_PATTERNS.slice(0, -1).some((pattern) =>
      pattern.test(passage),
    )
  ) {
    fail("ENGLISH_PASSAGE_CONTAMINATION", question.id);
  }
  const nextQuestionMatch =
    ENGLISH_CHOICE_CONTAMINATION_PATTERNS.at(-1).exec(passage);
  if (
    nextQuestionMatch &&
    nextQuestionMatch.index > Math.max(80, passage.length * 0.35)
  ) {
    fail("ENGLISH_PASSAGE_NEXT_QUESTION_LEAK", question.id);
  }
  if (
    !hasInlineChoiceMarkers(question) &&
    ENGLISH_CHOICE_MARKS.every((mark) => passage.includes(mark))
  ) {
    fail("ENGLISH_PASSAGE_CHOICE_LEAK", question.id);
  }
}

function assertNoForbiddenKeys(value, location = "root") {
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      assertNoForbiddenKeys(item, `${location}[${index}]`),
    );
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    const isApprovedFigureNotes =
      key === "notes" && location.endsWith(".figure");
    if (FORBIDDEN_PUBLIC_KEYS.has(key) && !isApprovedFigureNotes) {
      fail("PUBLIC_FIELD_LEAK", `${location}.${key}`);
    }
    assertNoForbiddenKeys(child, `${location}.${key}`);
  }
}

function projectEnglishFigure(question) {
  const figure = question.figure;
  if (!figure) return null;
  if (
    figure.kind !== "stacked_horizontal_bar" ||
    typeof figure.assetPath !== "string" ||
    !figure.assetPath.startsWith("/images/") ||
    typeof figure.title !== "string" ||
    !figure.title.trim() ||
    typeof figure.alt !== "string" ||
    !figure.alt.trim() ||
    figure.unit !== "%" ||
    !Number.isInteger(figure.sourcePage) ||
    figure.sourcePage < 1
  ) {
    fail("ENGLISH_FIGURE_SCHEMA", question.id);
  }

  if (!Array.isArray(figure.categories) || figure.categories.length === 0) {
    fail("ENGLISH_FIGURE_CATEGORIES", question.id);
  }
  if (!Array.isArray(figure.series) || figure.series.length === 0) {
    fail("ENGLISH_FIGURE_SERIES", question.id);
  }
  if (
    !Array.isArray(figure.notes) ||
    figure.notes.some((note) => !String(note).trim())
  ) {
    fail("ENGLISH_FIGURE_NOTES", question.id);
  }

  const categoryIds = figure.categories.map((category) => category.id);
  if (
    new Set(categoryIds).size !== categoryIds.length ||
    figure.categories.some(
      (category) =>
        typeof category.id !== "string" ||
        !category.id ||
        !String(category.label).trim(),
    )
  ) {
    fail("ENGLISH_FIGURE_CATEGORY_ID", question.id);
  }

  const seriesIds = figure.series.map((series) => series.id);
  if (
    new Set(seriesIds).size !== seriesIds.length ||
    figure.series.some(
      (series) =>
        typeof series.id !== "string" ||
        !series.id ||
        !String(series.label).trim() ||
        !series.values ||
        typeof series.values !== "object",
    )
  ) {
    fail("ENGLISH_FIGURE_SERIES_ID", question.id);
  }

  for (const series of figure.series) {
    const valueKeys = Object.keys(series.values).sort();
    if (stableJson(valueKeys) !== stableJson([...categoryIds].sort())) {
      fail("ENGLISH_FIGURE_VALUE_KEYS", `${question.id}:${series.id}`);
    }
    for (const value of Object.values(series.values)) {
      if (!Number.isInteger(value) || value < 0 || value > 100) {
        fail("ENGLISH_FIGURE_VALUE", `${question.id}:${series.id}`);
      }
    }
  }

  for (const categoryId of categoryIds) {
    const total = figure.series.reduce(
      (sum, series) => sum + series.values[categoryId],
      0,
    );
    if (total > 100)
      fail("ENGLISH_FIGURE_STACK_TOTAL", `${question.id}:${categoryId}`);
  }

  const isProtectedEnglishFigure =
    question.id === "2026_csat_25" &&
    figure.assetPath === "/images/eng-math/english/2026-csat/q25-figure.png";
  const assetPath = isProtectedEnglishFigure
    ? ENGLISH_FIGURE_PROTECTED_PATH
    : path.resolve(
        path.join(ROOT, "public"),
        figure.assetPath.replace(/^[/\\]+/, ""),
      );
  if (!existsSync(assetPath)) {
    fail("ENGLISH_FIGURE_ASSET", question.id);
  }

  return {
    kind: figure.kind,
    assetPath: figure.assetPath,
    title: figure.title,
    alt: figure.alt,
    unit: figure.unit,
    categories: figure.categories,
    series: figure.series,
    notes: figure.notes,
  };
}

function buildPublicData(mathSourceDirectory = null) {
  validateEnglishCandidate();
  const mathDbPath = findFile(ROOT, "math_exam_db_v2_0.json");
  const explainPath = findFile(ROOT, "eng_explain_2026csat.json");
  const englishDb = readJson(ENGLISH_DB_PATH, "english_exam_db_v2_1.json");
  const mathDb = readJson(mathDbPath, "math_exam_db_v2_0.json");
  const mathVerifiedSolutions = validateMathVerifiedSolutions(
    mathDbPath,
    mathDb,
    mathSourceDirectory,
  );
  const explanationDb = readJson(explainPath, "eng_explain_2026csat.json");
  const explanations = new Map(
    Object.values(explanationDb.items).map((item) => [item.id, item]),
  );

  const englishSource = englishDb.questions.filter(
    (question) => question.examId === "2026_csat",
  );
  if (englishSource.length !== 28)
    fail("ENGLISH_SOURCE_SCOPE", String(englishSource.length));

  const englishReadySource = englishSource.filter(
    (question) =>
      !ENGLISH_EXCLUDED_IDS.has(question.id) &&
      explanations.get(question.id)?.status === "ready",
  );
  englishReadySource.forEach(validateEnglishChoices);
  const choiceFingerprint = englishChoiceFingerprint(englishReadySource);
  if (choiceFingerprint !== ENGLISH_PUBLIC_CHOICE_FINGERPRINT) {
    fail(
      "ENGLISH_CHOICE_FINGERPRINT",
      `${choiceFingerprint} != ${ENGLISH_PUBLIC_CHOICE_FINGERPRINT}`,
    );
  }

  const english = englishReadySource.map((question) => {
    const review = explanations.get(question.id);
    if (String(question.answer) !== String(review.answer))
      fail("ENGLISH_ANSWER_MISMATCH", question.id);
    if (!Array.isArray(review.evidence) || review.evidence.length === 0) {
      fail("ENGLISH_EVIDENCE_MISSING", question.id);
    }
    if (!review.trap || typeof review.trap.reason !== "string") {
      fail("ENGLISH_TRAP_MISSING", question.id);
    }

    const rawPassage =
      question.sharedPassage?.trim() ||
      cutChoicesFromRaw(question.rawText, question);
    const passage = question.sharedPassage?.trim()
      ? rawPassage
      : removeLeadingStem(rawPassage, question.stem);
    if (!passage) fail("ENGLISH_PASSAGE_MISSING", question.id);
    validateEnglishPassage(question, passage);
    const figure = projectEnglishFigure(question);

    const evidence = review.evidence.map((item, index) => {
      if (item.in === "figure") {
        const series = question.figure?.series?.find(
          (candidate) => candidate.id === item.seriesId,
        );
        const value = series?.values?.[item.categoryId];
        if (
          !figure ||
          !question.figure.categories.some(
            (category) => category.id === item.categoryId,
          ) ||
          value !== item.value ||
          !String(item.display ?? "").trim()
        ) {
          fail("ENGLISH_FIGURE_EVIDENCE_MISMATCH", `${question.id}:${index}`);
        }
        return {
          origin: "figure",
          role: item.role,
          quote: item.display,
          translation: item.translation,
        };
      }

      const sourceText = question[item.in];
      if (
        typeof sourceText !== "string" ||
        sourceText.slice(item.charStart, item.charStart + item.quote.length) !==
          item.quote
      ) {
        fail("ENGLISH_EVIDENCE_MISMATCH", `${question.id}:${index}`);
      }
      return {
        origin: "text",
        role: item.role,
        quote: item.quote,
        translation: item.translation,
      };
    });

    return {
      id: question.id,
      label: `${question.schoolYear}학년도 수능 · ${question.qid}번`,
      prompt: question.stem,
      passage,
      ...(figure ? { figure } : {}),
      choices: question.choices.map((choice) => ({
        number: choice.num,
        mark: choice.mark,
        text: choice.text,
      })),
      answer: Number(question.answer),
      review: {
        summary: review.summary,
        approach: review.typeApproach,
        reason: review.correctReason,
        trap: {
          mark: review.trap.mark,
          text: review.trap.text,
          reason: review.trap.reason,
        },
        evidence,
      },
    };
  });

  if (english.length !== 27)
    fail("ENGLISH_PUBLIC_COUNT", String(english.length));
  const englishEvidenceCount = english.reduce(
    (count, question) => count + question.review.evidence.length,
    0,
  );
  if (englishEvidenceCount !== 61)
    fail("ENGLISH_EVIDENCE_COUNT", String(englishEvidenceCount));

  const mathFigurePolicy = validateMathFigurePolicy(mathDb);
  const math = mathDb.questions
    .filter(
      (question) =>
        question.answerCrossCheck === "full" &&
        !mathFigurePolicy.blockedIds.has(question.id),
    )
    .map((question) => {
      const isChoice = question.answerType === "choice";
      const isShort = question.answerType === "short";
      const figureDescription = mathFigurePolicy.descriptionIds.has(question.id)
        ? question.figureDesc
        : null;
      if (!isChoice && !isShort) fail("MATH_RESPONSE_TYPE", question.id);
      if (!String(question.problem_latex ?? "").trim())
        fail("MATH_PROMPT_MISSING", question.id);
      if (!Array.isArray(question.choices))
        fail("MATH_CHOICES_MISSING", question.id);
      if (figureDescription !== null && !String(figureDescription).trim()) {
        fail("MATH_FIGURE_DESCRIPTION_MISSING", question.id);
      }

      if (isChoice) {
        if (question.choices.length !== 5)
          fail("MATH_CHOICE_COUNT", question.id);
        if (
          !question.choices.some(
            (choice) => Number(choice.num) === Number(question.answer),
          )
        ) {
          fail("MATH_ANSWER_MISMATCH", question.id);
        }
      }
      if (
        isShort &&
        (question.choices.length !== 0 ||
          !/^\d+$/.test(String(question.answer)))
      ) {
        fail("MATH_SHORT_FORMAT", question.id);
      }

      return {
        id: question.id,
        label: formatMathLabel(question),
        responseType: question.answerType,
        prompt: question.problem_latex,
        choices: question.choices.map((choice) => ({
          number: choice.num,
          mark: choice.mark,
          text: choice.latex,
        })),
        answer: isChoice ? Number(question.answer) : String(question.answer),
        ...(figureDescription !== null ? { figureDescription } : {}),
      };
    });

  if (math.length !== 361) fail("MATH_PUBLIC_COUNT", String(math.length));
  if (
    math.filter((question) => question.responseType === "choice").length !== 257
  ) {
    fail("MATH_CHOICE_SCOPE", "expected 257");
  }
  if (
    math.filter((question) => question.responseType === "short").length !== 104
  ) {
    fail("MATH_SHORT_SCOPE", "expected 104");
  }
  if (math.some((question) => mathFigurePolicy.blockedIds.has(question.id))) {
    fail("MATH_BLOCKED_FIGURE_LEAK", "public data");
  }

  const describedQuestions = math.filter((question) =>
    mathFigurePolicy.descriptionIds.has(question.id),
  );
  if (
    describedQuestions.length !== 55 ||
    describedQuestions.some(
      (question) => !String(question.figureDescription ?? "").trim(),
    )
  ) {
    fail(
      "MATH_FIGURE_DESCRIPTION_PUBLIC_CHECK",
      String(describedQuestions.length),
    );
  }

  const decorativeQuestions = math.filter((question) =>
    mathFigurePolicy.decorativeIds.has(question.id),
  );
  if (
    decorativeQuestions.length !== 12 ||
    decorativeQuestions.some((question) =>
      Object.hasOwn(question, "figureDescription"),
    )
  ) {
    fail(
      "MATH_DECORATIVE_FIGURE_PUBLIC_CHECK",
      String(decorativeQuestions.length),
    );
  }

  if (
    math.some(
      (question) =>
        Object.hasOwn(question, "figureDescription") &&
        !mathFigurePolicy.descriptionIds.has(question.id),
    )
  ) {
    fail("MATH_UNAPPROVED_FIGURE_DESCRIPTION", "public data");
  }

  validateSessionCatalog(english, math);
  const catalog = buildPublicCatalog(english, math);
  const englishFreeQuestions = english.filter((question) =>
    ENGLISH_FREE_IDS.includes(question.id),
  );
  const mathFreeQuestions = math.filter((question) =>
    MATH_FREE_IDS.includes(question.id),
  );
  if (!hasExactQuestionIds(englishFreeQuestions, ENGLISH_FREE_IDS)) {
    fail(
      "ENGLISH_FREE_BOUNDARY",
      englishFreeQuestions.map((question) => question.id).join(","),
    );
  }
  if (!hasExactQuestionIds(mathFreeQuestions, MATH_FREE_IDS)) {
    fail(
      "MATH_FREE_BOUNDARY",
      mathFreeQuestions.map((question) => question.id).join(","),
    );
  }
  const freeEvidenceCount = englishFreeQuestions.reduce(
    (count, question) => count + question.review.evidence.length,
    0,
  );
  if (freeEvidenceCount !== 10) {
    fail("ENGLISH_FREE_EVIDENCE_COUNT", String(freeEvidenceCount));
  }

  const englishFree = {
    packId: catalog.subjects.english.freePackId,
    questions: englishFreeQuestions,
  };
  const mathFree = {
    packId: catalog.subjects.math.freePackId,
    questions: mathFreeQuestions,
  };
  if (
    mathFree.questions.some(
      (question) =>
        Object.hasOwn(question, "review") || Object.hasOwn(question, "solution"),
    )
  ) {
    fail("MATH_SOLUTION_PUBLIC_FIELD_LEAK", "math free data");
  }
  const mathFreeSerialized = stableJson(mathFree);
  for (const item of mathVerifiedSolutions) {
    if (
      mathFreeSerialized.includes(item.summary) ||
      mathFreeSerialized.includes(item.correctReason) ||
      item.steps.some((step) => mathFreeSerialized.includes(step.explanation))
    ) {
      fail("MATH_SOLUTION_PUBLIC_TEXT_LEAK", item.id);
    }
  }
  assertNoForbiddenKeys({ englishFree, mathFree });

  const freeIds = new Set([...ENGLISH_FREE_IDS, ...MATH_FREE_IDS]);
  const lockedIds = [...english, ...math]
    .map((question) => question.id)
    .filter((id) => !freeIds.has(id));
  if (lockedIds.length !== 378) {
    fail("LOCKED_QUESTION_COUNT", String(lockedIds.length));
  }

  return { englishFree, mathFree, catalog, lockedIds };
}

function verifyArtifact(filePath, expected) {
  if (!existsSync(filePath))
    fail("PUBLIC_ARTIFACT_MISSING", path.relative(ROOT, filePath));
  const actual = readFileSync(filePath, "utf8");
  if (actual !== stableJson(expected)) {
    const expectedHash = createHash("sha256")
      .update(stableJson(expected))
      .digest("hex")
      .slice(0, 12);
    const actualHash = createHash("sha256")
      .update(actual)
      .digest("hex")
      .slice(0, 12);
    fail(
      "PUBLIC_ARTIFACT_DRIFT",
      `${path.basename(filePath)} ${actualHash} != ${expectedHash}`,
    );
  }
}

function verifyArtifactMissing(filePath) {
  if (existsSync(filePath)) {
    fail("LOCKED_PUBLIC_ARTIFACT", path.relative(ROOT, filePath));
  }
}

function verifyPublishedFileSet(directory) {
  if (!existsSync(directory)) {
    fail("PUBLIC_DIRECTORY_MISSING", path.relative(ROOT, directory));
  }
  const expectedNames = [
    "catalog-public.json",
    "english-free-public.json",
    "math-free-public.json",
  ];
  const actualNames = readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .sort();
  if (stableJson(actualNames) !== stableJson(expectedNames)) {
    fail("PUBLIC_FILE_SET", `actual=${actualNames.join(",") || "none"}`);
  }
}

function listFiles(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...listFiles(entryPath));
    if (entry.isFile()) files.push(entryPath);
  }
  return files;
}

function verifyLockedIdsAbsent(directory, lockedIds) {
  const textExtensions = new Set([
    ".css",
    ".html",
    ".js",
    ".json",
    ".map",
    ".svg",
    ".txt",
    ".xml",
  ]);
  const lockedIdPattern = new RegExp(lockedIds.join("|"));
  for (const filePath of listFiles(directory)) {
    if (!textExtensions.has(path.extname(filePath).toLowerCase())) continue;
    const contents = readFileSync(filePath, "utf8");
    const match = contents.match(lockedIdPattern);
    if (match) {
      fail(
        "LOCKED_QUESTION_ID_LEAK",
        `${path.relative(ROOT, filePath)}:${match[0]}`,
      );
    }
  }
}

function verifyPublishedBoundary(baseDirectory, data) {
  const dataDirectory = path.join(baseDirectory, "data", "eng-math");
  verifyPublishedFileSet(dataDirectory);
  verifyArtifact(
    path.join(dataDirectory, "english-free-public.json"),
    data.englishFree,
  );
  verifyArtifact(
    path.join(dataDirectory, "math-free-public.json"),
    data.mathFree,
  );
  verifyArtifact(path.join(dataDirectory, "catalog-public.json"), data.catalog);
  verifyArtifactMissing(
    path.join(dataDirectory, "english-2026-csat-public.json"),
  );
  verifyArtifactMissing(
    path.join(dataDirectory, "math-full-no-figure-public.json"),
  );
  verifyArtifactMissing(
    path.join(
      baseDirectory,
      "images",
      "eng-math",
      "english",
      "2026-csat",
      "q25-figure.png",
    ),
  );
  verifyLockedIdsAbsent(baseDirectory, data.lockedIds);
}

function parseArguments() {
  const values = process.argv.slice(2);
  const mode = values[0] ?? "--check";
  let mathSourceDirectory = null;
  for (let index = 1; index < values.length; index += 1) {
    const value = values[index];
    if (value !== "--math-source-dir") fail("ARGUMENT_INVALID", value);
    const next = values[index + 1];
    if (!next || next.startsWith("--")) {
      fail("ARGUMENT_VALUE_MISSING", value);
    }
    mathSourceDirectory = path.resolve(next);
    index += 1;
  }
  return { mode, mathSourceDirectory };
}

const options = parseArguments();
const mode = options.mode;
const data = buildPublicData(options.mathSourceDirectory);

if (mode === "--write") {
  mkdirSync(PUBLIC_DATA_DIRECTORY, { recursive: true });
  writeFileSync(ENGLISH_FREE_OUTPUT_PATH, stableJson(data.englishFree), "utf8");
  writeFileSync(MATH_FREE_OUTPUT_PATH, stableJson(data.mathFree), "utf8");
  writeFileSync(CATALOG_OUTPUT_PATH, stableJson(data.catalog), "utf8");
  LEGACY_PUBLIC_DATA_PATHS.forEach((filePath) => {
    if (existsSync(filePath)) unlinkSync(filePath);
  });
  verifyPublishedBoundary(path.join(ROOT, "public"), data);
  console.log(
    `ENG_MATH_PUBLIC_DATA: wrote free=10 locked=378 catalogs=6/88 englishCandidate=28/58 mathSolutions=5 mathSource=${options.mathSourceDirectory ? "verified" : "recorded"}`,
  );
} else if (mode === "--check") {
  verifyPublishedBoundary(path.join(ROOT, "public"), data);
  console.log(
    `ENG_MATH_PUBLIC_DATA: pass free=10 locked=378 catalogs=6/88 englishCandidate=28/58 mathSolutions=5 mathSource=${options.mathSourceDirectory ? "verified" : "recorded"}`,
  );
} else if (mode === "--check-dist") {
  verifyPublishedBoundary(path.join(ROOT, "dist"), data);
  console.log(
    `ENG_MATH_DIST_BOUNDARY: pass free=10 locked=378 catalogs=6/88 englishCandidate=28/58 mathSolutions=5 mathSource=${options.mathSourceDirectory ? "verified" : "recorded"}`,
  );
} else {
  fail("MODE_INVALID", mode);
}
