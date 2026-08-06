import assert from "node:assert/strict";
import {
  appendLearningSession,
  createLearningSessionRecord,
  learningHistoryConfig,
  normalizeLearningHistory,
  recordLearningSession,
  summarizeLearningHistory,
} from "../src/engMathLearningHistory.js";

const now = new Date("2026-08-07T12:00:00.000Z");
const baseResults = [
  {
    questionId: "2026_csat_19",
    label: "2026학년도 수능 · 19번",
    isCorrect: false,
    passage: "LOCKED_CONTENT_MUST_NOT_BE_STORED",
    choices: ["LOCKED_CHOICE_MUST_NOT_BE_STORED"],
  },
  {
    questionId: "2026_csat_20",
    label: "2026학년도 수능 · 20번",
    isCorrect: true,
    solution: "LOCKED_SOLUTION_MUST_NOT_BE_STORED",
  },
];

const first = createLearningSessionRecord({
  sessionId: "session-standard-1",
  subject: "english",
  packId: "english-01",
  packLabel: "2026학년도 수능 · 영어 · 19~23번",
  isWrongRetry: false,
  results: baseResults,
  completedAt: "2026-08-06T10:00:00.000Z",
});

assert.deepEqual(Object.keys(first.results[0]), [
  "questionId",
  "label",
  "isCorrect",
]);
assert.equal(JSON.stringify(first).includes("LOCKED_CONTENT"), false);
assert.equal(JSON.stringify(first).includes("LOCKED_CHOICE"), false);
assert.equal(JSON.stringify(first).includes("LOCKED_SOLUTION"), false);

const retry = createLearningSessionRecord({
  sessionId: "session-retry-1",
  subject: "english",
  packId: "english-01",
  packLabel: "2026학년도 수능 · 영어 · 19~23번",
  isWrongRetry: true,
  results: [
    {
      questionId: "2026_csat_19",
      label: "2026학년도 수능 · 19번",
      isCorrect: true,
    },
  ],
  completedAt: "2026-08-07T09:00:00.000Z",
});

const old = createLearningSessionRecord({
  sessionId: "session-old-1",
  subject: "english",
  packId: "english-01",
  packLabel: "2026학년도 수능 · 영어 · 19~23번",
  isWrongRetry: false,
  results: [
    {
      questionId: "2026_csat_21",
      label: "2026학년도 수능 · 21번",
      isCorrect: false,
    },
  ],
  completedAt: "2026-07-20T09:00:00.000Z",
});

let history = normalizeLearningHistory(null);
history = appendLearningSession(history, first);
history = appendLearningSession(history, retry);
history = appendLearningSession(history, old);
history = appendLearningSession(history, retry);
assert.equal(history.sessions.length, 3);

const summary = summarizeLearningHistory(history, "english", now);
assert.deepEqual(summary, {
  sessionCount: 2,
  retrySessionCount: 1,
  answerCount: 3,
  correctCount: 2,
  wrongCount: 1,
  accuracy: 67,
  weakQuestions: [
    {
      questionId: "2026_csat_19",
      label: "2026학년도 수능 · 19번",
      wrongCount: 1,
      latestIsCorrect: true,
      latestCompletedAt: "2026-08-07T09:00:00.000Z",
    },
  ],
});

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
    packId: "math-2022_06-common-01",
    packLabel: "2022학년도 6월 모의평가 · 공통 · 1~5번",
    isWrongRetry: false,
    results: [
      {
        questionId: "2022_06_common_1",
        label: "2022학년도 6월 모의평가 · 공통 1번",
        isCorrect: true,
        meta: "INTERNAL_META_MUST_NOT_BE_STORED",
      },
    ],
    completedAt: "2026-08-07T11:00:00.000Z",
  },
  storage,
);
assert.equal(storedSummary.answerCount, 1);
assert.equal(storedSummary.accuracy, 100);
const stored = memory.get(learningHistoryConfig.storageKey);
assert.equal(stored.includes("INTERNAL_META"), false);
assert.equal(stored.includes("passage"), false);
assert.equal(stored.includes("choices"), false);
assert.equal(stored.includes("solution"), false);

assert.throws(
  () =>
    createLearningSessionRecord({
      sessionId: "bad",
      subject: "korean",
      packId: "bad",
      packLabel: "bad",
      isWrongRetry: false,
      results: baseResults,
      completedAt: now,
    }),
  /과목|기록/,
);

console.log(
  `ENG_MATH_LEARNING_HISTORY: pass version=${learningHistoryConfig.version} weeklyAnswers=${summary.answerCount} weak=${summary.weakQuestions.length}`,
);
