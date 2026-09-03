import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import katex from "katex";
import {
  CALCULUS_CONCEPTS_BY_UNIT,
  CALCULUS_UNITS,
  DIFFERENTIATION_CONCEPTS,
  INTEGRATION_CONCEPTS,
  SEQUENCE_LIMIT_CONCEPTS,
  getCalculusConceptContext,
  getSequenceLimitConcept,
} from "../src/mathCalculusConcepts.js";
import {
  CALCULUS_QUESTION_TAGS,
  getCalculusQuestionsForConcept,
} from "../src/mathCalculusQuestionTags.js";
import {
  MATH1_EXPONENT_LOG_CONCEPTS,
  MATH1_TRIGONOMETRY_CONCEPTS,
  MATH1_UNITS,
  MATH_COURSES,
  MATH_PROGRESS_CONCEPTS,
  MATH_UNITS_BY_COURSE,
  getMathConceptContext,
  getMathCourseConcepts,
} from "../src/mathCourseConcepts.js";
import {
  GEOMETRY_CONIC_CONCEPTS,
  GEOMETRY_SPACE_CONCEPTS,
  GEOMETRY_VECTOR_CONCEPTS,
  MATH1_SEQUENCE_CONCEPTS,
  MATH2_DIFFERENTIATION_CONCEPTS,
  MATH2_INTEGRATION_CONCEPTS,
  MATH2_LIMIT_CONTINUITY_CONCEPTS,
  PROBABILITY_COUNTING_CONCEPTS,
  PROBABILITY_PROBABILITY_CONCEPTS,
  PROBABILITY_STATISTICS_CONCEPTS,
} from "../src/mathRemainingCourseConcepts.js";

assert.deepEqual(
  MATH_COURSES.map((course) => course.id),
  ["math1", "math2", "probability-statistics", "calculus", "geometry"],
);
assert.deepEqual(
  MATH_COURSES.filter((course) => course.status === "available").map(
    (course) => course.id,
  ),
  ["math1", "math2", "probability-statistics", "calculus", "geometry"],
);
assert.deepEqual(
  MATH1_UNITS.map((unit) => unit.id),
  ["math1-exponents-logs", "math1-trigonometry", "math1-sequences"],
);
assert.deepEqual(
  MATH1_UNITS.map((unit) => unit.status),
  ["available", "available", "available"],
);
assert.equal(MATH1_EXPONENT_LOG_CONCEPTS.length, 4);
assert.equal(MATH1_TRIGONOMETRY_CONCEPTS.length, 4);
assert.equal(MATH1_SEQUENCE_CONCEPTS.length, 4);
assert.equal(getMathCourseConcepts("math1").length, 12);
assert.equal(getMathCourseConcepts("math2").length, 12);
assert.equal(getMathCourseConcepts("probability-statistics").length, 12);
assert.equal(getMathCourseConcepts("calculus").length, 24);
assert.equal(getMathCourseConcepts("geometry").length, 12);
assert.equal(MATH_PROGRESS_CONCEPTS.length, 72);
assert.equal(
  new Set(MATH_PROGRESS_CONCEPTS.map((concept) => concept.id)).size,
  MATH_PROGRESS_CONCEPTS.length,
);
for (const concept of MATH_PROGRESS_CONCEPTS) {
  assert.equal(concept.core.length > 20, true, `${concept.id}: core`);
  assert.equal(concept.intuition.length > 40, true, `${concept.id}: intuition`);
  assert.equal(concept.formulas.length > 0, true, `${concept.id}: formulas`);
  assert.equal(concept.example.steps.length >= 2, true, `${concept.id}: example`);
  assert.equal(concept.example.answer.length > 0, true, `${concept.id}: example answer`);
  assert.equal(concept.check.reason.length > 15, true, `${concept.id}: check reason`);
  assert.equal(concept.practice.length, 2, `${concept.id}: practice count`);
  for (const problem of concept.practice) {
    assert.equal(problem.answer.length > 0, true, `${concept.id}: practice answer`);
    assert.equal(problem.reason.length > 15, true, `${concept.id}: practice reason`);
  }
  const expressions = [
    ...concept.formulas,
    concept.example.prompt,
    ...concept.example.steps.filter((step) => step.includes("\\")),
    concept.example.answer,
    concept.check.prompt,
    concept.check.answer,
    ...concept.practice.flatMap((problem) => [problem.prompt, problem.answer]),
  ];
  for (const expression of expressions) {
    const outsideText = expression.replaceAll(/\\text\{[^}]*\}/g, "");
    assert.equal(/[가-힣]/.test(outsideText), false, `${concept.id}: Korean outside text: ${expression}`);
    const rendered = katex.renderToString(expression, { throwOnError: false });
    assert.equal(rendered.includes("katex-error"), false, `${concept.id}: ${expression}`);
  }
}
const allCourseDirectPrompts = MATH_PROGRESS_CONCEPTS.flatMap((concept) => [
  concept.check.prompt,
  ...concept.practice.map((problem) => problem.prompt),
]);
assert.equal(allCourseDirectPrompts.length, 216);
assert.equal(new Set(allCourseDirectPrompts).size, allCourseDirectPrompts.length);
assert.equal(
  getMathConceptContext(null, null, "math1").concept.id,
  "math1-roots-exponents",
);
assert.equal(
  getMathConceptContext("math1-logarithmic-function", null, null).course.id,
  "math1",
);

const math1Concepts = [
  ...MATH1_EXPONENT_LOG_CONCEPTS,
  ...MATH1_TRIGONOMETRY_CONCEPTS,
  ...MATH1_SEQUENCE_CONCEPTS,
];
for (const concept of math1Concepts) {
  assert.equal(concept.core.length > 20, true);
  assert.equal(concept.intuition.length > 40, true);
  assert.equal(concept.formulas.length > 0, true);
  assert.equal(concept.example.steps.length >= 2, true);
  assert.equal(concept.practice.length, 2);
  assert.equal(concept.check.reason.length > 15, true);
}
const math1DirectPrompts = math1Concepts.flatMap((concept) => [
  concept.check.prompt,
  ...concept.practice.map((problem) => problem.prompt),
]);
assert.equal(math1DirectPrompts.length, 36);
assert.equal(new Set(math1DirectPrompts).size, math1DirectPrompts.length);
assert.deepEqual(
  MATH1_TRIGONOMETRY_CONCEPTS.map((concept) => concept.order),
  [1, 2, 3, 4],
);
const trigonometryById = new Map(
  MATH1_TRIGONOMETRY_CONCEPTS.map((concept) => [concept.id, concept]),
);
assert.equal(
  trigonometryById.get("math1-general-angles-radians").example.answer,
  String.raw`\frac{5\pi}{6}`,
);
assert.equal(
  trigonometryById.get("math1-trigonometric-graphs").check.answer,
  String.raw`\frac{2\pi}{3}`,
);
assert.equal(
  trigonometryById.get("math1-sine-cosine-laws").check.answer,
  String.raw`4\sqrt3`,
);

const newlyAddedCourseGroups = [
  MATH1_SEQUENCE_CONCEPTS,
  MATH2_LIMIT_CONTINUITY_CONCEPTS,
  MATH2_DIFFERENTIATION_CONCEPTS,
  MATH2_INTEGRATION_CONCEPTS,
  PROBABILITY_COUNTING_CONCEPTS,
  PROBABILITY_PROBABILITY_CONCEPTS,
  PROBABILITY_STATISTICS_CONCEPTS,
  GEOMETRY_CONIC_CONCEPTS,
  GEOMETRY_VECTOR_CONCEPTS,
  GEOMETRY_SPACE_CONCEPTS,
];
for (const group of newlyAddedCourseGroups) {
  assert.equal(group.length, 4);
  assert.deepEqual(group.map((concept) => concept.order), [1, 2, 3, 4]);
}
for (const course of MATH_COURSES) {
  assert.equal(course.status, "available");
  assert.equal(course.availableConceptCount, course.id === "calculus" ? 24 : 12);
  for (const unit of MATH_UNITS_BY_COURSE[course.id]) {
    assert.equal(unit.status, "available");
    assert.equal(unit.availableConceptCount, unit.conceptCount);
  }
}
assert.equal(
  getMathConceptContext("math2-function-limits", null, null).course.id,
  "math2",
);
assert.equal(
  getMathConceptContext("statistics-normal-distribution", null, null).unit.id,
  "statistics",
);
assert.equal(
  getMathConceptContext("geometry-parabola", null, null).course.id,
  "geometry",
);

assert.deepEqual(
  CALCULUS_UNITS.map((unit) => unit.id),
  ["sequence-limits", "differentiation", "integration"],
);
assert.equal(CALCULUS_UNITS[0].conceptCount, 6);
assert.equal(CALCULUS_UNITS[1].conceptCount, 10);
assert.equal(CALCULUS_UNITS[1].availableConceptCount, 10);
assert.equal(
  CALCULUS_UNITS[1].availableConceptCount,
  CALCULUS_UNITS[1].conceptCount,
);
assert.equal(SEQUENCE_LIMIT_CONCEPTS.length, 6);
assert.equal(DIFFERENTIATION_CONCEPTS.length, 10);
assert.equal(CALCULUS_UNITS[2].conceptCount, 8);
assert.equal(CALCULUS_UNITS[2].availableConceptCount, 8);
assert.equal(
  CALCULUS_UNITS[2].availableConceptCount,
  CALCULUS_UNITS[2].conceptCount,
);
assert.equal(INTEGRATION_CONCEPTS.length, 8);
assert.equal(
  new Set(SEQUENCE_LIMIT_CONCEPTS.map((concept) => concept.id)).size,
  SEQUENCE_LIMIT_CONCEPTS.length,
);
assert.deepEqual(
  SEQUENCE_LIMIT_CONCEPTS.map((concept) => concept.order),
  [1, 2, 3, 4, 5, 6],
);
assert.deepEqual(
  DIFFERENTIATION_CONCEPTS.map((concept) => concept.order),
  [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
);
assert.deepEqual(
  INTEGRATION_CONCEPTS.map((concept) => concept.order),
  [1, 2, 3, 4, 5, 6, 7, 8],
);

const allAvailableConcepts = Object.values(CALCULUS_CONCEPTS_BY_UNIT).flat();
assert.equal(allAvailableConcepts.length, 24);
for (const concept of allAvailableConcepts) {
  assert.equal(typeof concept.title, "string");
  assert.equal(concept.core.length > 20, true);
  assert.equal(concept.intuition.length > 40, true);
  assert.equal(concept.formulas.length > 0, true);
  assert.equal(concept.example.steps.length >= 2, true);
  assert.equal(concept.check.reason.length > 15, true);
  assert.equal(concept.practice.length, 2);
  for (const problem of concept.practice) {
    assert.equal(problem.prompt.length > 5, true);
    assert.equal(problem.answer.length > 0, true);
    assert.equal(problem.reason.length > 15, true);
  }
  assert.equal(JSON.stringify(concept).includes("수학방"), false);
}

const directPrompts = allAvailableConcepts.flatMap((concept) => [
  concept.check.prompt,
  ...concept.practice.map((problem) => problem.prompt),
]);
assert.equal(directPrompts.length, 72);
assert.equal(new Set(directPrompts).size, directPrompts.length);

const firstLimitLesson = JSON.stringify(
  getSequenceLimitConcept("convergence-divergence"),
);
assert.equal(firstLimitLesson.includes("최고차항"), false);
assert.equal(firstLimitLesson.includes("분자와 분모"), false);
assert.equal(
  JSON.stringify(getSequenceLimitConcept("infinite-series")).includes("조화급수"),
  false,
);

assert.equal(getSequenceLimitConcept("geometric-series").order, 5);
assert.equal(getSequenceLimitConcept("unknown").order, 1);
assert.equal(
  getCalculusConceptContext(null, "differentiation").concept.id,
  "exponential-log-derivatives",
);
assert.equal(
  getCalculusConceptContext("exponential-log-derivatives", null).unit.id,
  "differentiation",
);

const mathDataDirectory = path.resolve("평가원_수학영어_확장/08_math_data");
const verifiedCalculusItems = new Map();
for (const filename of fs.readdirSync(mathDataDirectory)) {
  if (!/^math_.+_(?:cal|common)_.+_verified_solutions_v1\.json$/.test(filename)) continue;
  const source = JSON.parse(
    fs.readFileSync(path.join(mathDataDirectory, filename), "utf8"),
  );
  for (const [questionId, item] of Object.entries(source.items ?? {})) {
    verifiedCalculusItems.set(questionId, item);
  }
}

const conceptIds = new Set(allAvailableConcepts.map((concept) => concept.id));
const forbiddenPublicFields = [
  "answer",
  "answerMark",
  "choices",
  "correctReason",
  "problem",
  "solution",
  "steps",
];

assert.equal(CALCULUS_QUESTION_TAGS.length, 48);
assert.equal(
  new Set(
    CALCULUS_QUESTION_TAGS.map(
      (question) => `${question.examKey}:${question.track}:${question.questionNumber}`,
    ),
  ).size,
  CALCULUS_QUESTION_TAGS.length,
);

for (const conceptId of conceptIds) {
  assert.equal(getCalculusQuestionsForConcept(conceptId).length, 2);
}

for (const question of CALCULUS_QUESTION_TAGS) {
  assert.equal(conceptIds.has(question.conceptId), true);
  assert.equal(question.access, "locked");
  assert.equal(["cal", "common"].includes(question.track), true);
  assert.equal(
    question.trackLabel,
    question.track === "common" ? "공통" : "미적분",
  );
  assert.equal(
    question.catalogPath,
    `/eng-math/practice?subject=math&mode=catalog&exam=${question.examKey}&track=${question.track}`,
  );
  for (const field of forbiddenPublicFields) {
    assert.equal(Object.hasOwn(question, field), false);
  }

  const internalQuestionId = `${question.examKey}_${question.track}_${question.questionNumber}`;
  const verifiedItem = verifiedCalculusItems.get(internalQuestionId);
  assert.ok(verifiedItem, `${internalQuestionId} must exist in verified solutions`);
  assert.equal(verifiedItem.status, "verified_internal_candidate");
  assert.equal(verifiedItem.verification.problemMatchedPdf, true);
  assert.equal(verifiedItem.verification.answerMatchedPdf, true);
  assert.equal(verifiedItem.verification.independentDerivation, true);
  assert.equal(verifiedItem.questionNumber, question.questionNumber);
  assert.equal(
    verifiedItem.concepts.includes(question.sourceConcept),
    true,
    `${internalQuestionId} must include ${question.sourceConcept}`,
  );
}

const conceptLibrarySource = fs.readFileSync(
  path.resolve("src/MathConceptLibrary.jsx"),
  "utf8",
);
assert.equal(conceptLibrarySource.includes("힌트 없이 풀기"), true);
assert.equal(conceptLibrarySource.includes("풀이를 마친 뒤 연결 확인"), true);
assert.equal(conceptLibrarySource.includes("<details"), true);
assert.equal(conceptLibrarySource.includes("이 시험 목록 열기"), true);
assert.equal(conceptLibrarySource.includes("직접 풀기 3문제"), true);
assert.equal(conceptLibrarySource.includes("수능 수학 과목 선택"), true);
assert.equal(conceptLibrarySource.includes("selectCourse"), true);
assert.equal(conceptLibrarySource.includes("임의로 기출을 붙이지 않습니다"), true);

const vercelConfiguration = JSON.parse(
  fs.readFileSync(path.resolve("vercel.json"), "utf8"),
);
const conceptRouteRewrites = (vercelConfiguration.rewrites ?? []).filter(
  (rule) =>
    rule.source === "/math/concepts" && rule.destination === "/index.html",
);
assert.equal(
  conceptRouteRewrites.length,
  1,
  "/math/concepts must resolve to the SPA entry on direct visits and reloads",
);

console.log("math concept library tests: PASS");
