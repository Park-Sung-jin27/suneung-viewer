import assert from "node:assert/strict";
import {
  appendLearningSession,
  buildDailyLearningPlan,
  buildQuestionReviewStates,
  createScopedLearningHistoryStorage,
  createLearningSessionRecord,
  learningHistoryConfig,
  normalizeLearningHistory,
  recordLearningSession,
  summarizeLearningHistory,
} from "../src/engMathLearningHistory.js";

const scopedBacking = new Map();
const scopedStorage = {
  getItem(key) {
    return scopedBacking.get(key) ?? null;
  },
  setItem(key, value) {
    scopedBacking.set(key, value);
  },
};
const memberOneStorage = createScopedLearningHistoryStorage(
  "10000000-0000-4000-8000-000000000001",
  scopedStorage,
);
const memberTwoStorage = createScopedLearningHistoryStorage(
  "20000000-0000-4000-8000-000000000002",
  scopedStorage,
);
memberOneStorage.setItem(learningHistoryConfig.storageKey, "member-one");
memberTwoStorage.setItem(learningHistoryConfig.storageKey, "member-two");
assert.equal(memberOneStorage.getItem(learningHistoryConfig.storageKey), "member-one");
assert.equal(memberTwoStorage.getItem(learningHistoryConfig.storageKey), "member-two");
assert.equal(scopedStorage.getItem(learningHistoryConfig.storageKey), null);

function session({
  id,
  completedAt,
  questionId,
  isCorrect,
  isWrongRetry = false,
  subject = "english",
  durationMs,
  confidence,
  gaveUp,
}) {
  return createLearningSessionRecord({
    sessionId: id,
    subject,
    packId: `${subject}-free`,
    packLabel: `${subject} 무료 5문항`,
    isWrongRetry,
    results: [
      {
        questionId,
        label: `${subject} · ${questionId}`,
        isCorrect,
        durationMs,
        confidence,
        gaveUp,
        passage: "LOCKED_CONTENT_MUST_NOT_BE_STORED",
        choices: ["LOCKED_CHOICE_MUST_NOT_BE_STORED"],
        solution: "LOCKED_SOLUTION_MUST_NOT_BE_STORED",
      },
    ],
    completedAt,
  });
}

const privacyRecord = session({
  id: "privacy",
  completedAt: "2026-08-06T10:00:00.000Z",
  questionId: "2026_csat_19",
  isCorrect: false,
  durationMs: 42000,
  confidence: "unsure",
  gaveUp: true,
});
assert.deepEqual(Object.keys(privacyRecord.results[0]), [
  "questionId",
  "label",
  "isCorrect",
  "durationMs",
  "confidence",
  "gaveUp",
]);
assert.equal(JSON.stringify(privacyRecord).includes("LOCKED_CONTENT"), false);
assert.equal(JSON.stringify(privacyRecord).includes("LOCKED_CHOICE"), false);
assert.equal(JSON.stringify(privacyRecord).includes("LOCKED_SOLUTION"), false);
assert.equal(privacyRecord.results[0].gaveUp, true);

const legacyRecord = createLearningSessionRecord({
  sessionId: "legacy-v1",
  subject: "english",
  packId: "english-free",
  packLabel: "영어 무료 5문항",
  isWrongRetry: false,
  results: [
    {
      questionId: "2026_csat_20",
      label: "2026학년도 수능 · 20번",
      isCorrect: true,
    },
  ],
  completedAt: "2026-08-06T11:00:00.000Z",
});
assert.deepEqual(Object.keys(legacyRecord.results[0]), [
  "questionId",
  "label",
  "isCorrect",
]);

let reviewHistory = normalizeLearningHistory(null);
reviewHistory = appendLearningSession(
  reviewHistory,
  session({
    id: "wrong",
    completedAt: "2026-08-01T09:00:00.000Z",
    questionId: "2026_csat_19",
    isCorrect: false,
  }),
);
reviewHistory = appendLearningSession(
  reviewHistory,
  session({
    id: "immediate-correction",
    completedAt: "2026-08-01T09:10:00.000Z",
    questionId: "2026_csat_19",
    isCorrect: true,
    isWrongRetry: true,
  }),
);
let state = buildQuestionReviewStates(
  reviewHistory,
  "english",
  new Date("2026-08-02T10:00:00.000Z"),
)[0];
assert.equal(state.status, "due");
assert.equal(state.reviewLabel, "1일 복습");
assert.equal(state.recoveryStage, 0);
assert.equal(state.latestIsCorrect, true);

reviewHistory = appendLearningSession(
  reviewHistory,
  session({
    id: "day-1",
    completedAt: "2026-08-02T10:00:00.000Z",
    questionId: "2026_csat_19",
    isCorrect: true,
  }),
);
state = buildQuestionReviewStates(
  reviewHistory,
  "english",
  new Date("2026-08-03T10:00:00.000Z"),
)[0];
assert.equal(state.status, "scheduled");
assert.equal(state.reviewLabel, "3일 복습");
assert.equal(state.dueAt, "2026-08-05T10:00:00.000Z");

reviewHistory = appendLearningSession(
  reviewHistory,
  session({
    id: "day-3",
    completedAt: "2026-08-05T10:00:00.000Z",
    questionId: "2026_csat_19",
    isCorrect: true,
  }),
);
state = buildQuestionReviewStates(
  reviewHistory,
  "english",
  new Date("2026-08-06T10:00:00.000Z"),
)[0];
assert.equal(state.reviewLabel, "7일 복습");
assert.equal(state.dueAt, "2026-08-12T10:00:00.000Z");

reviewHistory = appendLearningSession(
  reviewHistory,
  session({
    id: "day-7",
    completedAt: "2026-08-12T10:00:00.000Z",
    questionId: "2026_csat_19",
    isCorrect: true,
  }),
);
state = buildQuestionReviewStates(
  reviewHistory,
  "english",
  new Date("2026-08-12T10:01:00.000Z"),
)[0];
assert.equal(state.status, "mastered");
assert.equal(state.reviewLabel, "교정 완료");

let dailyHistory = normalizeLearningHistory(null);
dailyHistory = appendLearningSession(
  dailyHistory,
  session({
    id: "due-19",
    completedAt: "2026-08-06T09:00:00.000Z",
    questionId: "2026_csat_19",
    isCorrect: false,
  }),
);
dailyHistory = appendLearningSession(
  dailyHistory,
  session({
    id: "due-20",
    completedAt: "2026-08-06T09:05:00.000Z",
    questionId: "2026_csat_20",
    isCorrect: false,
  }),
);
dailyHistory = appendLearningSession(
  dailyHistory,
  session({
    id: "due-20-corrected",
    completedAt: "2026-08-06T09:10:00.000Z",
    questionId: "2026_csat_20",
    isCorrect: true,
    isWrongRetry: true,
  }),
);
dailyHistory = appendLearningSession(
  dailyHistory,
  session({
    id: "weak-21",
    completedAt: "2026-08-07T09:00:00.000Z",
    questionId: "2026_csat_21",
    isCorrect: false,
  }),
);
dailyHistory = appendLearningSession(
  dailyHistory,
  session({
    id: "stable-23",
    completedAt: "2026-08-07T09:05:00.000Z",
    questionId: "2026_csat_23",
    isCorrect: true,
  }),
);
const questions = [19, 20, 21, 22, 23].map((number) => ({
  id: `2026_csat_${number}`,
}));
const plan = buildDailyLearningPlan(
  questions,
  "english",
  dailyHistory,
  new Date("2026-08-07T12:00:00.000Z"),
);
assert.equal(plan.questions.length, 5);
assert.deepEqual(
  new Set(plan.items.slice(0, 2).map((item) => item.questionId)),
  new Set(["2026_csat_19", "2026_csat_20"]),
);
assert.equal(plan.items[2].questionId, "2026_csat_21");
assert.equal(plan.items[2].reason, "취약 보완");
assert.equal(plan.items.some((item) => item.reason === "새 문항"), true);

function assertPriorityReviewPlan(subject) {
  const prefix = subject === "english" ? "priority_english" : "priority_math";
  let priorityHistory = normalizeLearningHistory(null);
  priorityHistory = appendLearningSession(
    priorityHistory,
    session({
      id: `${prefix}-normal`,
      completedAt: "2026-08-06T09:00:00.000Z",
      questionId: `${prefix}_normal`,
      isCorrect: false,
      confidence: "unsure",
      subject,
    }),
  );
  priorityHistory = appendLearningSession(
    priorityHistory,
    session({
      id: `${prefix}-sure`,
      completedAt: "2026-08-06T09:05:00.000Z",
      questionId: `${prefix}_sure`,
      isCorrect: false,
      confidence: "sure",
      subject,
    }),
  );
  priorityHistory = appendLearningSession(
    priorityHistory,
    session({
      id: `${prefix}-gave-up`,
      completedAt: "2026-08-06T09:10:00.000Z",
      questionId: `${prefix}_gave_up`,
      isCorrect: false,
      gaveUp: true,
      subject,
    }),
  );

  const reviewNow = new Date("2026-08-07T12:00:00.000Z");
  const priorityStates = buildQuestionReviewStates(
    priorityHistory,
    subject,
    reviewNow,
  );
  const stateByQuestionId = new Map(
    priorityStates.map((item) => [item.questionId, item]),
  );
  assert.equal(
    stateByQuestionId.get(`${prefix}_normal`).dueAt,
    "2026-08-07T09:00:00.000Z",
  );
  assert.equal(
    stateByQuestionId.get(`${prefix}_sure`).reviewNeed,
    "sure_wrong",
  );
  assert.equal(
    stateByQuestionId.get(`${prefix}_gave_up`).reviewNeed,
    "gave_up",
  );

  const priorityQuestions = ["normal", "sure", "gave_up", "new_1", "new_2"].map(
    (suffix) => ({ id: `${prefix}_${suffix}` }),
  );
  const priorityPlan = buildDailyLearningPlan(
    priorityQuestions,
    subject,
    priorityHistory,
    reviewNow,
  );
  assert.deepEqual(
    priorityPlan.items.slice(0, 2),
    [
      {
        questionId: `${prefix}_gave_up`,
        reason: "풀이를 먼저 본 문제 · 1일 복습",
      },
      {
        questionId: `${prefix}_sure`,
        reason: "확신했지만 틀린 문제 · 1일 복습",
      },
    ],
  );
  assert.equal(priorityPlan.dueCount, 3);
  assert.equal(priorityPlan.newCount, 2);
  const prioritySummary = summarizeLearningHistory(
    priorityHistory,
    subject,
    reviewNow,
  );
  assert.equal(prioritySummary.gaveUpQuestionCount, 1);
  assert.equal(prioritySummary.sureWrongQuestionCount, 1);
}

assertPriorityReviewPlan("english");
assertPriorityReviewPlan("math");

const summary = summarizeLearningHistory(
  dailyHistory,
  "english",
  new Date("2026-08-07T12:00:00.000Z"),
);
assert.equal(summary.answerCount, 5);
assert.equal(summary.accuracy, 40);
assert.equal(summary.dueReviewCount, 2);
assert.equal(summary.recoveredQuestionCount, 1);
assert.equal(summary.repeatWrongQuestionCount, 0);

const memory = new Map();
const storage = {
  getItem(key) {
    return memory.get(key) ?? null;
  },
  setItem(key, value) {
    memory.set(key, value);
  },
};
const storedSummary = recordLearningSession(
  {
    sessionId: "session-math-1",
    subject: "math",
    packId: "math-free",
    packLabel: "수학 무료 5문항",
    isWrongRetry: false,
    results: [
      {
        questionId: "2022_06_common_1",
        label: "2022학년도 6월 모의평가 · 공통 1번",
        isCorrect: true,
        durationMs: 31000,
        confidence: "sure",
        meta: "INTERNAL_META_MUST_NOT_BE_STORED",
      },
    ],
    completedAt: "2026-08-07T11:00:00.000Z",
  },
  storage,
);
assert.equal(storedSummary.answerCount, 1);
assert.equal(storedSummary.averageDurationSeconds, 31);
assert.deepEqual(storedSummary.confidenceCounts, {
  sure: 1,
  unsure: 0,
  guess: 0,
});
const stored = memory.get(learningHistoryConfig.storageKey);
assert.equal(stored.includes("INTERNAL_META"), false);
assert.equal(stored.includes("passage"), false);
assert.equal(stored.includes("choices"), false);
assert.equal(stored.includes("solution"), false);

assert.throws(
  () =>
    session({
      id: "bad-confidence",
      completedAt: "2026-08-07T11:00:00.000Z",
      questionId: "2026_csat_19",
      isCorrect: true,
      confidence: "overconfident",
    }),
  /확신도|기록/,
);
assert.deepEqual(learningHistoryConfig.reviewIntervalsDays, [1, 3, 7]);

console.log(
  `ENG_MATH_LEARNING_HISTORY: pass version=${learningHistoryConfig.version} daily=${plan.questions.length} due=${summary.dueReviewCount} review=1/3/7`,
);
