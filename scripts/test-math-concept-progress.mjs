import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  appendMathConceptCompletion,
  buildMathConceptWeeklyPlan,
  createScopedMathConceptProgressStorage,
  mathConceptProgressConfig,
  normalizeMathConceptProgress,
  readMathConceptProgress,
  recordMathConceptCompletion,
  summarizeMathConceptProgress,
  writeMathConceptProgress,
} from "../src/mathConceptProgress.js";
import {
  mathConceptProgressToEventRows,
  memberConceptEventsToProgress,
  syncMemberMathConceptProgress,
} from "../src/mathConceptProgressSync.js";

function memoryStorage() {
  const values = new Map();
  return {
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
  };
}

const concepts = [
  { id: "limit-1", unitId: "sequence-limits" },
  { id: "limit-2", unitId: "sequence-limits" },
  { id: "diff-1", unitId: "differentiation" },
];
const first = {
  conceptId: "limit-1",
  unitId: "sequence-limits",
  completedAt: "2026-08-31T00:00:00.000Z",
};

assert.deepEqual(normalizeMathConceptProgress(null), {
  version: 1,
  completions: [],
});
const once = appendMathConceptCompletion(null, first);
const twice = appendMathConceptCompletion(once, {
  ...first,
  completedAt: "2026-09-01T00:00:00.000Z",
});
assert.deepEqual(twice, once, "같은 개념 완료 기록은 중복 저장하지 않는다");

const withSecond = appendMathConceptCompletion(twice, {
  conceptId: "diff-1",
  unitId: "differentiation",
  completedAt: "2026-08-20T00:00:00.000Z",
});
const summary = summarizeMathConceptProgress(
  withSecond,
  concepts,
  "2026-09-01T00:00:00.000Z",
);
assert.equal(summary.totalCount, 3);
assert.equal(summary.completedCount, 2);
assert.equal(summary.recentCount, 1);
assert.deepEqual(summary.recentCompletedIds, ["limit-1"]);
assert.equal(summary.completedByUnit["sequence-limits"], 1);
assert.equal(summary.completedByUnit.differentiation, 1);

const weeklyPlan = buildMathConceptWeeklyPlan(
  once,
  concepts,
  "2026-09-01T00:00:00.000Z",
);
assert.equal(weeklyPlan.target, 3);
assert.equal(weeklyPlan.recentCount, 1);
assert.equal(weeklyPlan.remainingCount, 2);
assert.equal(weeklyPlan.targetMet, false);
assert.equal(weeklyPlan.nextConcept.id, "limit-2");
assert.deepEqual(
  weeklyPlan.items.map((item) => [item.id, item.status]),
  [
    ["limit-1", "completed"],
    ["limit-2", "next"],
    ["diff-1", "planned"],
  ],
);

const allComplete = concepts.reduce(
  (current, concept, index) =>
    appendMathConceptCompletion(current, {
      conceptId: concept.id,
      unitId: concept.unitId,
      completedAt: `2026-08-${29 + index}T00:00:00.000Z`,
    }),
  null,
);
const completePlan = buildMathConceptWeeklyPlan(
  allComplete,
  concepts,
  "2026-09-01T00:00:00.000Z",
);
assert.equal(completePlan.targetMet, true);
assert.equal(completePlan.remainingCount, 0);
assert.equal(completePlan.nextConcept, null);

const baseStorage = memoryStorage();
const memberA = createScopedMathConceptProgressStorage(
  "11111111-1111-4111-8111-111111111111",
  baseStorage,
);
const memberB = createScopedMathConceptProgressStorage(
  "22222222-2222-4222-8222-222222222222",
  baseStorage,
);
recordMathConceptCompletion(first, memberA);
assert.equal(readMathConceptProgress(memberA).completions.length, 1);
assert.equal(readMathConceptProgress(memberB).completions.length, 0);
assert.equal(readMathConceptProgress(baseStorage).completions.length, 0);
writeMathConceptProgress(withSecond, memberA);
assert.equal(readMathConceptProgress(memberA).completions.length, 2);

const stored = JSON.stringify(readMathConceptProgress(memberA));
assert.equal(stored.includes("answer"), false);
assert.equal(stored.includes("intuition"), false);
assert.equal(mathConceptProgressConfig.storageKey, "math_concept_progress_v1");
assert.equal(mathConceptProgressConfig.weeklyConceptTarget, 3);

const userId = "10000000-0000-4000-8000-000000000001";
const eventRows = mathConceptProgressToEventRows(once, userId, concepts);
assert.equal(eventRows.length, 1);
assert.equal(eventRows[0].activity_type, "concept_complete");
assert.equal(eventRows[0].subject, "math");
assert.equal(eventRows[0].outcome, "completed");
assert.equal(eventRows[0].problem_key, "limit-1");
assert.equal(eventRows[0].source_session_id, "concept-v1:sequence-limits");
assert.equal(eventRows[0].correct, null);

const remoteRows = [
  eventRows[0],
  {
    ...eventRows[0],
    event_id: "concept-v1:remote:complete",
    problem_key: "limit-2",
    occurred_at: "2026-09-01T00:00:00.000Z",
  },
  {
    ...eventRows[0],
    event_id: "concept-v1:invalid:complete",
    problem_key: "unknown",
  },
];
assert.equal(memberConceptEventsToProgress(remoteRows, concepts).completions.length, 2);

const upserts = [];
const client = {
  from(table) {
    assert.equal(table, "learning_events");
    return {
      async upsert(batch, options) {
        upserts.push({ batch, options });
        return { error: null };
      },
      select() {
        const query = {
          eq() {
            return query;
          },
          async order() {
            return { data: remoteRows, error: null };
          },
        };
        return query;
      },
    };
  },
};
const synced = await syncMemberMathConceptProgress({
  supabase: client,
  authenticatedUserId: userId,
  progress: once,
  validConcepts: concepts,
  now: "2026-09-01T00:00:00.000Z",
});
assert.equal(upserts.length, 1);
assert.equal(upserts[0].batch.length, 1);
assert.deepEqual(upserts[0].options, {
  onConflict: "user_id,event_id",
  ignoreDuplicates: true,
});
assert.equal(synced.progress.completions.length, 2);
assert.equal(synced.summary.completedCount, 2);
assert.equal(synced.summary.recentCount, 2);

await assert.rejects(
  () =>
    syncMemberMathConceptProgress({
      supabase: client,
      authenticatedUserId: "internal-member",
      progress: once,
      validConcepts: concepts,
    }),
  /MATH_CONCEPT_AUTH_USER_ID/,
);

const migrationSql = fs.readFileSync(
  path.resolve("supabase/migrations/20260901_math_concept_completion_events.sql"),
  "utf8",
);
assert.equal(migrationSql.includes("'concept_complete'"), true);
assert.equal(migrationSql.includes("subject = 'math'"), true);
assert.equal(migrationSql.includes("outcome = 'completed'"), true);

console.log("math concept progress tests: PASS");
