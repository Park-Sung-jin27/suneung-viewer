import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { assignmentPacks, assignmentCreateStorage, createAssignmentDraft, draftDeadlineState, evaluateAssignmentReceipts, kstDate, parseKstInput } from "../src/engMathAssignments.js";
let checks = 0;
function test(name, fn) { fn(); checks++; console.log(`PASS ${name}`); }
const catalog = JSON.parse(readFileSync(new URL("../public/data/eng-math/catalog-public.json", import.meta.url), "utf8"));
const now = "2026-09-09T01:00:00Z";
const members = [{ student_id: "student-a" }, { student_id: "student-b" }];
const input = { title: "9월 9일 영어", studyDate: "2026-09-09", dueDate: "2026-09-09", dueTime: "23:00", subject: "english", packId: "english-01", recipientIds: ["student-a"] };
const draft = patch => createAssignmentDraft({ ...input, ...patch }, { catalog, members, now });
test("KST midnight", () => assert.equal(kstDate("2026-09-08T15:00:00Z"), "2026-09-09"));
test("local KST inputs do not depend on host timezone", () => assert.equal(parseKstInput("2026-09-09", "23:00"), "2026-09-09T14:00:00.000Z"));
for (const date of ["2026-02-29", "2026-09-31", "2026-13-01", "bad"]) test(`reject invalid date ${date}`, () => assert.throws(() => parseKstInput(date)));
for (const time of ["24:00", "12:60", "23:00Z", ""]) test(`reject invalid time ${time}`, () => assert.throws(() => parseKstInput("2026-09-09", time)));
test("leap day accepted", () => assert.equal(parseKstInput("2028-02-29", "01:00"), "2028-02-28T16:00:00.000Z"));
test("current public scope only", () => assert.equal(assignmentPacks(catalog).reduce((n, p) => n + p.questionCount, 0), 10));
test("missing catalog fails closed", () => assert.deepEqual(assignmentPacks(null), []));
test("new draft is never sent", () => assert.equal(draft().state, "draft"));
test("recipient snapshot deduplicated", () => assert.deepEqual(draft({ recipientIds: ["student-a", "student-a"] }).recipientIds, ["student-a"]));
for (const [name, patch] of Object.entries({
  past: { studyDate: "2026-09-08" }, expired: { dueTime: "09:00" }, reversed: { studyDate: "2026-09-10" },
  tooLong: { dueDate: "2026-10-11" }, noName: { title: " " }, longName: { title: "x".repeat(81) },
  noRecipients: { recipientIds: [] }, otherStudent: { recipientIds: ["outsider"] }, locked: { packId: "english-02" },
  subjectMismatch: { subject: "math" }, unknown: { packId: "made-up" },
})) test(`draft rejects ${name}`, () => assert.throws(() => draft(patch)));
test("scheduled draft label", () => assert.equal(draftDeadlineState(draft({ studyDate: "2026-09-10", dueDate: "2026-09-10" }), now), "학습일 전"));
test("expired draft never calls a student missing", () => assert.equal(draftDeadlineState(draft(), "2026-09-10T00:00:00Z"), "마감 지남 · 미배정"));

const assignment = { id: "assignment-a", version: 1, subject: "english", state: "active", opensAt: "2026-09-09T00:00:00Z", assignedAt: now, dueAt: "2026-09-09T14:00:00Z", recipientIds: ["student-a"], problemKeys: ["q1", "q2"] };
const receipt = (key, patch = {}) => ({ id: key, assignmentId: assignment.id, version: 1, studentId: "student-a", subject: "english", problemKey: key, attemptId: `attempt-${key}`, kind: "answer", correct: true, outcome: "answered", receivedAt: "2026-09-09T02:00:00Z", ...patch });
const evaluate = (receipts, time = "2026-09-09T14:01:00Z", change = {}) => evaluateAssignmentReceipts({ ...assignment, ...change }, "student-a", receipts, time);
test("no receipt after due is pending, not proof of absence", () => assert.equal(evaluate([]).status, "overdue_pending"));
test("before start", () => assert.equal(evaluate([], "2026-09-09T00:30:00Z").status, "scheduled"));
test("active not started", () => assert.equal(evaluate([], "2026-09-09T02:00:00Z").status, "not_started"));
test("one of two answers", () => assert.equal(evaluate([receipt("q1")], "2026-09-09T03:00:00Z").status, "in_progress"));
test("correct complete", () => assert.equal(evaluate([receipt("q1"), receipt("q2")]).status, "completed_on_time"));
test("deadline inclusive", () => assert.equal(evaluate([receipt("q1"), receipt("q2", { receivedAt: assignment.dueAt })]).status, "completed_on_time"));
test("late server receipt ignores earlier client clock", () => assert.equal(evaluate([receipt("q1"), receipt("q2", { receivedAt: "2026-09-09T14:00:01Z", occurred_at: now })]).status, "completed_late"));
test("deduplicate receipts without double counting", () => assert.equal(evaluate([receipt("q1"), receipt("q1")]).completed, 1));
test("conflicting duplicate fails closed", () => assert.throws(() => evaluate([receipt("q1"), receipt("q1", { correct: false })])));
for (const [name, patch] of Object.entries({
  otherAssignment: { assignmentId: "other" }, oldVersion: { version: 0 }, otherStudent: { studentId: "student-b" },
  otherSubject: { subject: "math" }, otherProblem: { problemKey: "q3" }, oldAnswer: { receivedAt: "2026-09-09T00:30:00Z" },
  future: { receivedAt: "2026-09-10T00:00:00Z" }, missingTime: { receivedAt: undefined }, missingAttempt: { attemptId: undefined },
  openingSolution: { kind: "view_solution" }, wrong: { correct: false }, gaveUp: { outcome: "gave_up" },
})) test(`receipt cannot complete: ${name}`, () => assert.equal(evaluate([receipt("q1", patch)]).completed, 0));
const wrong = receipt("q1", { correct: false });
const correction = receipt("q1", { id: "retry", kind: "correction", receivedAt: "2026-09-09T03:00:00Z" });
test("wrong plus successful same-attempt correction", () => assert.equal(evaluate([wrong, correction]).completed, 1));
test("gave up plus successful correction", () => assert.equal(evaluate([{ ...wrong, outcome: "gave_up" }, correction]).completed, 1));
test("correction without an attempt", () => assert.equal(evaluate([correction]).completed, 0));
test("correction of another attempt", () => assert.equal(evaluate([wrong, { ...correction, attemptId: "different" }]).completed, 0));
test("correction before answer", () => assert.equal(evaluate([wrong, { ...correction, receivedAt: now }]).completed, 0));
test("failed correction", () => assert.equal(evaluate([wrong, { ...correction, correct: false }]).completed, 0));
test("old learning_events cannot become receipts", () => assert.equal(evaluate([{ event_id: "old", user_id: "student-a", problem_key: "q1", activity_type: "answer", correct: true, occurred_at: now }]).completed, 0));
test("cancelled assignment", () => assert.equal(evaluate([receipt("q1")], now, { state: "cancelled" }).status, "not_assigned"));
test("revoked or non-recipient", () => assert.equal(evaluate([], now, { recipientIds: [] }).status, "not_assigned"));
test("invalid empty assignment", () => assert.throws(() => evaluate([], now, { problemKeys: [] })));
test("duplicate problems rejected", () => assert.throws(() => evaluate([], now, { problemKeys: ["q1", "q1"] })));
test("preview gated to explicit fake demo", () => {
  const source = readFileSync(new URL("../src/EngMathClassroom.jsx", import.meta.url), "utf8");
  assert.match(source, /demo && new URLSearchParams\(location.search\).get\("assignments"\) === "1"/);
  const preview = readFileSync(new URL("../src/EngMathAssignmentPreview.jsx", import.meta.url), "utf8");
  assert.doesNotMatch(preview, /supabase|localStorage|sessionStorage|\.rpc\(/);
});
const backing=new Map();
const disk={getItem:key=>backing.get(key)??null,setItem:(key,value)=>backing.set(key,value),removeItem:key=>backing.delete(key)};
const pendingStore=assignmentCreateStorage('teacher-a','class-a',disk);
const pendingValue={teacherId:'teacher-a',subject:'english',request:{p_id:'30000000-0000-4000-8000-000000000001',p_class_id:'class-a',p_title:'가상 배정',p_pack_id:'english-01',p_study_date:'2026-09-09',p_due_at:'2026-09-09T14:00:00Z',p_students:['student-a']}};
test('create pending starts empty',()=>assert.equal(pendingStore.read(),null));
test('create pending restores exact request across instances',()=>{
  pendingStore.write(pendingValue);assert.deepEqual(assignmentCreateStorage('teacher-a','class-a',disk).read(),pendingValue);
});
test('same create request may be persisted again',()=>{pendingStore.write(pendingValue);assert.deepEqual(pendingStore.read(),pendingValue);});
test('pending request is separated by teacher',()=>assert.equal(assignmentCreateStorage('teacher-b','class-a',disk).read(),null));
test('pending request is separated by class',()=>assert.equal(assignmentCreateStorage('teacher-a','class-b',disk).read(),null));
test('cannot overwrite another pending request',()=>assert.throws(()=>pendingStore.write({...pendingValue,request:{...pendingValue.request,p_id:'30000000-0000-4000-8000-000000000002'}})));
test('cannot change the payload of a pending request',()=>assert.throws(()=>pendingStore.write({...pendingValue,request:{...pendingValue.request,p_title:'다른 내용'}})));
test('cleanup cannot erase another request ID',()=>{pendingStore.clear('other');assert.deepEqual(pendingStore.read(),pendingValue);});
test('confirmed matching request is removed',()=>{pendingStore.clear(pendingValue.request.p_id);assert.equal(pendingStore.read(),null);});
test('foreign-class envelope is rejected',()=>assert.throws(()=>pendingStore.write({...pendingValue,request:{...pendingValue.request,p_class_id:'class-b'}})));
test('corrupt pending data fails closed',()=>{disk.setItem(pendingStore.key,'{broken');assert.throws(()=>pendingStore.read());disk.removeItem(pendingStore.key);});
test('read access failure is not an empty draft',()=>assert.throws(()=>assignmentCreateStorage('teacher-a','class-a',{getItem(){throw new Error('blocked');}}).read()));
test('quota failure is explicit',()=>assert.throws(()=>assignmentCreateStorage('teacher-a','class-a',{...disk,setItem(){throw new Error('quota');}}).write(pendingValue),/저장하지 못해 전송하지 않았습니다/));
test('silent storage failure is detected by readback',()=>assert.throws(()=>assignmentCreateStorage('teacher-a','class-a',{...disk,setItem(){}}).write(pendingValue)));
console.log(`[ENG_MATH_ASSIGNMENTS] PASS ${checks} checks; draft/receipts/retry storage, no production DB`);
