import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
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
const ENGLISH_OUTPUT_PATH = path.join(
  ROOT,
  "public",
  "data",
  "eng-math",
  "english-2026-csat-public.json",
);
const MATH_OUTPUT_PATH = path.join(
  ROOT,
  "public",
  "data",
  "eng-math",
  "math-full-no-figure-public.json",
);
const ENGLISH_EXCLUDED_IDS = new Set(["2026_csat_18"]);
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

function answerMark(answer) {
  return ["①", "②", "③", "④", "⑤"][Number(answer) - 1] ?? null;
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

  const publicRoot = path.join(ROOT, "public");
  const assetPath = path.resolve(
    publicRoot,
    figure.assetPath.replace(/^[/\\]+/, ""),
  );
  if (
    !assetPath.startsWith(`${publicRoot}${path.sep}`) ||
    !existsSync(assetPath)
  ) {
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

function buildPublicData() {
  const mathDbPath = findFile(ROOT, "math_exam_db_v2_0.json");
  const explainPath = findFile(ROOT, "eng_explain_2026csat.json");
  const englishDb = readJson(ENGLISH_DB_PATH, "english_exam_db_v2_1.json");
  const mathDb = readJson(mathDbPath, "math_exam_db_v2_0.json");
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
  const data = { english: { questions: english }, math: { questions: math } };
  assertNoForbiddenKeys(data);
  return data;
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

const mode = process.argv[2] ?? "--check";
const data = buildPublicData();

if (mode === "--write") {
  mkdirSync(path.dirname(ENGLISH_OUTPUT_PATH), { recursive: true });
  writeFileSync(ENGLISH_OUTPUT_PATH, stableJson(data.english), "utf8");
  writeFileSync(MATH_OUTPUT_PATH, stableJson(data.math), "utf8");
  console.log("ENG_MATH_PUBLIC_DATA: wrote english=27 math=361");
} else if (mode === "--check") {
  verifyArtifact(ENGLISH_OUTPUT_PATH, data.english);
  verifyArtifact(MATH_OUTPUT_PATH, data.math);
  console.log(
    "ENG_MATH_PUBLIC_DATA: pass english=27 evidence=61 math=361 sessions=6/88",
  );
} else {
  fail("MODE_INVALID", mode);
}
