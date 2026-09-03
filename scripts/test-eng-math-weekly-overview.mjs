import assert from "node:assert/strict";
import {
  buildEngMathWeeklyOverview,
  engMathWeeklyOverviewConfig,
} from "../src/engMathWeeklyOverview.js";

const nextConcept = {
  id: "limit-laws",
  unitId: "sequence-limits",
  unitLabel: "수열의 극한",
  title: "극한값의 계산",
};

const conceptFirst = buildEngMathWeeklyOverview({
  conceptSummary: { recentCount: 2 },
  mathSummary: { answerCount: 5 },
  englishSummary: { answerCount: 0 },
  nextConcept,
});
assert.deepEqual(
  conceptFirst.lanes.map((lane) => [lane.key, lane.completed, lane.target]),
  [
    ["concepts", 2, 3],
    ["math", 5, 5],
    ["english", 0, 5],
  ],
);
assert.equal(conceptFirst.nextAction.kind, "concept");
assert.equal(
  conceptFirst.nextAction.path,
  "/math/concepts?unit=sequence-limits&concept=limit-laws",
);

const math1ConceptFirst = buildEngMathWeeklyOverview({
  conceptSummary: { recentCount: 0 },
  mathSummary: { answerCount: 0 },
  englishSummary: { answerCount: 0 },
  nextConcept: {
    ...nextConcept,
    id: "math1-roots-exponents",
    unitId: "math1-exponents-logs",
    courseId: "math1",
  },
});
assert.equal(
  math1ConceptFirst.nextAction.path,
  "/math/concepts?course=math1&unit=math1-exponents-logs&concept=math1-roots-exponents",
);

const mathSecond = buildEngMathWeeklyOverview({
  conceptSummary: { recentCount: 3 },
  mathSummary: { answerCount: 2 },
  englishSummary: { answerCount: 0 },
  nextConcept,
});
assert.equal(mathSecond.nextAction.kind, "math");
assert.equal(mathSecond.nextAction.title, "수학 3문제");

const englishThird = buildEngMathWeeklyOverview({
  conceptSummary: { recentCount: 4 },
  mathSummary: { answerCount: 7 },
  englishSummary: { answerCount: 1 },
  nextConcept,
});
assert.equal(englishThird.nextAction.kind, "english");
assert.equal(englishThird.nextAction.title, "영어 4문제");

const complete = buildEngMathWeeklyOverview({
  conceptSummary: { recentCount: 3 },
  mathSummary: { answerCount: 5, dueReviewCount: 2 },
  englishSummary: { answerCount: 5, dueReviewCount: 1 },
  nextConcept,
});
assert.equal(complete.complete, true);
assert.equal(complete.completedLaneCount, 3);
assert.equal(complete.nextAction.kind, "complete");
assert.equal(complete.nextAction.path.includes("subject=math"), true);
assert.deepEqual(engMathWeeklyOverviewConfig, {
  concepts: 3,
  mathQuestions: 5,
  englishQuestions: 5,
});

console.log("eng-math weekly overview tests: PASS");
