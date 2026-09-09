import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildAssignmentReviewQueue, readAssignmentReviewQueue } from "./eng-math-assignment-review.mjs";
const english = JSON.parse(readFileSync(new URL("../english/data/candidates/english_2027_09_merged.json", import.meta.url), "utf8"));
const math = JSON.parse(readFileSync(new URL("../평가원_수학영어_확장/08_math_data/math_2027_09_registered_solutions_v1.json", import.meta.url), "utf8"));
const queue = readAssignmentReviewQueue();
let checks = 0;
function test(name, fn) { fn(); checks++; console.log(`PASS ${name}`); }
const build = (patch = {}) => buildAssignmentReviewQueue({ english, math, assetCheck: () => true, ...patch });
test("74 unique questions", () => assert.equal(new Set(queue.rows.map(r => `${r.subject}:${r.id}`)).size, 74));
test("real assets and structural checks", () => assert.equal(queue.summary.automaticChecksPassed, 74));
test("never mistakes old approval for task readiness", () => assert.equal(queue.summary.studentReleaseReady, 0));
test("all question-level checks pending", () => assert.ok(queue.rows.every(r => r.manualReview === "pending" && r.studentRelease === "blocked")));
test("no raw passage or answer export", () => {
  const serialized = JSON.stringify(queue);
  assert.ok(!serialized.includes(english.questions[0].rawText));
  for (const row of queue.rows) for (const key of ["answer", "rawText", "fullTranslation", "review"]) assert.ok(!(key in row));
});
test("missing question detected", () => assert.throws(() => build({ english: { ...english, questions: english.questions.slice(1) } }), /SCOPE/));
test("duplicate question detected", () => assert.throws(() => build({ math: { ...math, items: [...math.items.slice(1), math.items[1]] } }), /SCOPE/));
test("public boundary change detected", () => assert.throws(() => build({ english: { ...english, publicConnected: true } }), /BOUNDARY/));
test("broken assets fail real checks", () => assert.ok(build({ assetCheck: () => false }).summary.automaticChecksPassed < 74));
test("answer mismatch detected", () => {
  const changed = structuredClone(english); changed.questions[0].review.answer = "invalid";
  assert.equal(build({ english: changed }).rows[0].checks.answerMatchesRegisteredReview, false);
});
test("changed content invalidates fingerprint", () => {
  const changed = structuredClone(english); changed.questions[0].review.summary += "changed";
  assert.notEqual(build({ english: changed }).rows[0].fingerprint, queue.rows[0].fingerprint);
});
test("broken math syntax detected", () => {
  const changed = structuredClone(math); changed.items[0].expression = "\\frac{";
  assert.equal(build({ math: changed }).rows.find(r => r.subject === "math").checks.mathTypesetValid, false);
});
test("math track scope", () => assert.deepEqual(Object.fromEntries(["common", "sta", "cal", "geo"].map(track => [track, queue.rows.filter(r => r.subject === "math" && r.track === track).length])), { common: 22, sta: 8, cal: 8, geo: 8 }));
test("q37 paragraph order requires manual check", () => assert.ok(queue.rows.find(r => r.id === "2027_09_37").attention.some(a => a.includes("순서"))));
console.log(`[ENG_MATH_ASSIGNMENT_REVIEW] PASS ${checks} checks; 74 queued, 0 released`);
