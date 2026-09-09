import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createScopedLearningHistoryStorage, readLearningHistory, recordLearningSession, summarizeLearningHistory, buildQuestionReviewStates } from "../src/engMathLearningHistory.js";
import { learningHistoryToEventRows, syncMemberLearningHistory } from "../src/engMathLearningEventsSync.js";
import { summarizeClassStudent } from "../src/engMathClassroom.js";
const user = "10000000-0000-4000-8000-000000000002";
const other = "10000000-0000-4000-8000-000000000003";
const backing = new Map();
const disk = { getItem: key => backing.get(key) ?? null, setItem: (key, value) => backing.set(key, value) };
const storage = createScopedLearningHistoryStorage(user, disk);
let count = 0;
function check(name, fn) { fn(); count++; }
const first = { questionId: "2026_csat_19", label: "19번", isCorrect: false, gaveUp: true, answeredAt: "2026-09-09T14:59:00Z" };
const second = { questionId: "2026_csat_20", label: "20번", isCorrect: true, answeredAt: "2026-09-09T15:01:00Z" };
const base = { sessionId: "five-question-run", subject: "english", packId: "english-01", packLabel: "영어 다섯 문제", isWrongRetry: false, questionCount: 5 };
const now = "2026-09-09T15:05:00Z";
const firstSummary = recordLearningSession({ ...base, results: [first], completedAt: first.answeredAt }, storage);
check("one answer persisted before finishing five", () => assert.equal(readLearningHistory(storage).sessions[0].results.length, 1));
check("partial is not full completion", () => assert.equal(firstSummary.completedSessionCount, 0));
check("partial count explicit", () => assert.equal(firstSummary.inProgressSessionCount, 1));
check("actual local save acknowledged", () => assert.equal(firstSummary.storageStatus, "saved"));
const firstRows = learningHistoryToEventRows(readLearningHistory(storage), user);
recordLearningSession({ ...base, results: [first, second], completedAt: second.answeredAt }, storage);
check("incremental save replaces session without losing first result", () => assert.equal(readLearningHistory(storage).sessions.length, 1));
check("incremental count", () => assert.equal(readLearningHistory(storage).sessions[0].results.length, 2));
const twoRows = learningHistoryToEventRows(readLearningHistory(storage), user);
check("first event id/time immutable on later answers", () => assert.deepEqual(twoRows.find(row => row.event_id === firstRows[0].event_id), firstRows[0]));
check("second question has its own time", () => assert.equal(twoRows.find(row => row.problem_key === second.questionId).occurred_at, new Date(second.answeredAt).toISOString()));
const student = { student_id: user, student_name: "가상 학생", english_target: 5, math_target: 5 };
const beforeRetry = summarizeClassStudent(student, twoRows, now);
check("KST yesterday receives first gave-up event", () => assert.equal(beforeRetry.days.find(day => day.date === "2026-09-09").subjects.english.viewed, 1));
check("KST today receives only second answer", () => assert.equal(beforeRetry.days.find(day => day.date === "2026-09-10").subjects.english.answered, 1));
check("historical cutoff does not erase earlier answer when run continues later", () => assert.equal(summarizeLearningHistory(readLearningHistory(storage), "english", first.answeredAt).answerCount, 1));

recordLearningSession({ ...base, sessionId: "immediate-retry", isWrongRetry: true, questionCount: 1,
  results: [{ ...first, gaveUp: false, isCorrect: true, answeredAt: "2026-09-09T15:03:00Z" }], completedAt: "2026-09-09T15:03:00Z" }, storage);
const history = readLearningHistory(storage);
check("retry preserves first incorrect attempt", () => assert.equal(history.sessions.find(s => s.id === base.sessionId).results[0].isCorrect, false));
const reviewState = buildQuestionReviewStates(history, "english", now).find(q => q.questionId === first.questionId);
check("immediate retry is not durable mastery", () => assert.notEqual(reviewState.status, "mastered"));
check("unrelated account reads no local history", () => assert.equal(readLearningHistory(createScopedLearningHistoryStorage(other, disk)).sessions.length, 0));

// A fake network store exercises the same public event conversion + teacher
// aggregation without creating records in an actual student's account.
const network = new Map();
const fakeSupabase = { from(table) {
  assert.equal(table, "learning_events");
  return {
    async upsert(rows, options) { assert.equal(options.ignoreDuplicates, true); for (const row of rows) if (!network.has(row.event_id)) network.set(row.event_id, row); return { error: null }; },
    select() { return { eq(column, value) { assert.equal(column, "user_id"); assert.equal(value, user); return { async order() { return { data: [...network.values()], error: null }; } }; } }; },
  };
} };
await syncMemberLearningHistory({ supabase: fakeSupabase, authenticatedUserId: user, history, now });
const beforeDuplicate = network.size;
await syncMemberLearningHistory({ supabase: fakeSupabase, authenticatedUserId: user, history, now });
check("retrying network sync is idempotent", () => assert.equal(network.size, beforeDuplicate));
const teacherView = summarizeClassStudent(student, [...network.values()], now);
check("teacher sees two unique studied questions", () => assert.equal(teacherView.subjects.english.count, 2));
check("teacher sees corrected question no longer in latest-wrong list", () => assert.equal(teacherView.issues.length, 0));
check("correction has independent existing event kind", () => assert.equal([...network.values()].filter(e => e.activity_type === "remediation_complete").length, 1));
await assert.rejects(() => syncMemberLearningHistory({ supabase: { from() { return { upsert: async () => ({ error: { message: "offline" } }) }; } }, authenticatedUserId: user, history }), /SYNC/); count++;
check("network failure preserves local records", () => assert.equal(readLearningHistory(storage).sessions.length, 2));
const unavailable = recordLearningSession({ ...base, results: [first], completedAt: first.answeredAt }, { getItem: () => null, setItem: () => { throw new Error("quota"); } });
check("storage failure never reports saved", () => assert.equal(unavailable.storageStatus, "unavailable"));
const old = { version: 1, sessions: [{ id: "legacy", subject: "math", packId: "old", packLabel: "기존", attemptKind: "standard", completedAt: now, results: [{ questionId: "old-q", label: "기존 문제", isCorrect: true }] }] };
check("legacy timestamps retained", () => assert.equal(learningHistoryToEventRows(old, user)[0].occurred_at, new Date(now).toISOString()));
const source = readFileSync(new URL("../src/EngMathPractice.jsx", import.meta.url), "utf8");
check("no five-answer-only gate remains", () => assert.doesNotMatch(source, /if \(next.length === activeQuestions.length\)/));
check("login identity remounts a practice session", () => assert.ok(source.includes('key={`${storageNamespace}-${subject}-${selectedPack.id}-${mode}`}')));
check("retry action is explicitly offered after failure", () => assert.match(source, /session && \(gaveUp \|\| !isCorrect\)/));
check("network recovery retries", () => assert.match(source, /addEventListener\("online", retryOnline\)/));
check("latest sync only", () => assert.match(source, /generation !== syncGeneration.current/));
console.log(`[ENG_MATH_INCREMENTAL] PASS ${count} checks; partial save, own timestamps, recovery, teacher summary, identity, failure paths`);
