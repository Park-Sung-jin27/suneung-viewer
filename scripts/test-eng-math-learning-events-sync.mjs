import assert from "node:assert/strict";
import {
  combineLocalAndMemberSummary,
  learningHistoryToEventRows,
  summarizeMemberLearningEvents,
  syncMemberLearningHistory,
} from "../src/engMathLearningEventsSync.js";

const userId = "10000000-0000-4000-8000-000000000001";
const history = {
  version: 1,
  sessions: [
    {
      id: "standard-session",
      subject: "english",
      attemptKind: "standard",
      completedAt: "2026-08-30T09:00:00.000Z",
      results: [
        { questionId: "eng-1", isCorrect: true },
        { questionId: "eng-2", isCorrect: false },
      ],
    },
    {
      id: "retry-session",
      subject: "english",
      attemptKind: "wrong_retry",
      completedAt: "2026-08-30T09:10:00.000Z",
      results: [
        { questionId: "eng-2", isCorrect: true },
        { questionId: "eng-3", isCorrect: false },
      ],
    },
  ],
};

const rows = learningHistoryToEventRows(history, userId);
assert.equal(rows.length, 5);
assert.equal(rows.filter((row) => row.activity_type === "answer").length, 4);
assert.equal(
  rows.filter((row) => row.activity_type === "remediation_complete").length,
  1,
);
assert.equal(rows.every((row) => row.user_id === userId), true);
assert.equal(rows.every((row) => row.event_id.length <= 240), true);
assert.equal(rows.some((row) => row.activity_type === "review_complete"), false);

const summary = summarizeMemberLearningEvents(
  rows,
  "english",
  new Date("2026-08-31T09:00:00.000Z"),
);
assert.deepEqual(summary, {
  sessionCount: 2,
  retrySessionCount: 1,
  answerCount: 4,
  correctCount: 2,
  wrongCount: 2,
  accuracy: 50,
  recoveredQuestionCount: 1,
});

const localSummary = {
  ...summary,
  sessionCount: 1,
  answerCount: 2,
  correctCount: 1,
  wrongCount: 1,
  accuracy: 50,
  recoveredQuestionCount: 0,
  dueReviewCount: 2,
  weakQuestions: [{ questionId: "eng-2" }],
};
const combined = combineLocalAndMemberSummary(localSummary, summary);
assert.equal(combined.answerCount, 4);
assert.equal(combined.recoveredQuestionCount, 1);
assert.equal(combined.dueReviewCount, 2);
assert.equal(combined.weakQuestions.length, 1);

const upserts = [];
const selectedRows = [...rows];
const client = {
  from(table) {
    assert.equal(table, "learning_events");
    return {
      async upsert(batch, options) {
        upserts.push({ batch, options });
        return { error: null };
      },
      select() {
        return {
          eq() {
            return {
              order: async () => ({ data: selectedRows, error: null }),
            };
          },
        };
      },
    };
  },
};
const synced = await syncMemberLearningHistory({
  supabase: client,
  authenticatedUserId: userId,
  history,
  now: new Date("2026-08-31T09:00:00.000Z"),
});
assert.equal(upserts.length, 1);
assert.equal(upserts[0].batch.length, 5);
assert.deepEqual(upserts[0].options, {
  onConflict: "user_id,event_id",
  ignoreDuplicates: true,
});
assert.equal(synced.summaries.english.answerCount, 4);
assert.equal(synced.summaries.math.answerCount, 0);

await assert.rejects(
  () =>
    syncMemberLearningHistory({
      supabase: client,
      authenticatedUserId: "internal-member",
      history,
    }),
  /LEARNING_EVENTS_AUTH_USER_ID/,
);

console.log("eng-math learning events sync tests: PASS");
