import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import {
  classroomRpc,
  loadClassroom,
  summarizeClassStudent,
} from "../src/engMathClassroom.js";
import { normalizeEngMathReturnTo } from "../src/engMathAccess.js";

const db = new PGlite();
const ids = [1, 2, 3, 4].map(
  (n) => `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
);
const [teacher, student, stranger, otherStudent] = ids;
let checks = 0;
const ok = (condition, label) => {
  assert.ok(condition, label);
  checks++;
};
async function as(id, role = "authenticated") {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [
    id || "",
  ]);
  await db.exec(`set role ${role}`);
}
async function call(name, args = []) {
  const params = args.map((_, i) => `$${i + 1}`).join(",");
  const { rows } = await db.query(
    `select public.eng_math_classroom_${name}(${params}) as result`,
    args,
  );
  return rows[0].result;
}
async function rejects(action, message) {
  await assert.rejects(action, message);
  checks++;
}
try {
  const deployment = JSON.parse(
    readFileSync(new URL("../vercel.json", import.meta.url), "utf8"),
  );
  ok(
    deployment.rewrites.some(
      (rule) =>
        rule.source === "/eng-math/classroom" &&
        rule.destination === "/index.html",
    ),
    "deployed classroom direct links and login returns must reach the app",
  );
  await db.exec(`create role anon; create role authenticated; create schema auth;
    create table auth.users(id uuid primary key, email text);
    create function auth.uid() returns uuid language sql stable as
      $$select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid$$;
    grant usage on schema auth to authenticated, anon;
    grant execute on function auth.uid() to authenticated, anon;`);
  for (const id of ids)
    await db.query("insert into auth.users(id) values($1)", [id]);
  for (const file of [
    "20260831_learning_events.sql",
    "20260901_math_concept_completion_events.sql",
    "20260905_review_signal_events.sql",
    "20260907_eng_math_classrooms.sql",
  ]) {
    await db.exec(
      readFileSync(
        new URL(`../supabase/migrations/${file}`, import.meta.url),
        "utf8",
      ),
    );
  }
  await as(null, "anon");
  await rejects(() => call("list"), /permission denied/);
  await rejects(() => call("preview", ["guess"]), /permission denied/);
  await as(null);
  await rejects(() => call("create", ["test"]), /CLASS_AUTH_REQUIRED/);
  await as(teacher);
  await rejects(() => call("create", ["  "]), /CLASS_INVALID_NAME/);
  const classId = await call("create", ["고3 영어·수학"]);
  const listing = await call("list");
  const code = listing.owned[0].invite_code;
  ok(/^[a-f0-9]{32}$/.test(code), "invite has 128-bit UUID format");
  ok(
    listing.owned.length === 1 && listing.joined.length === 0,
    "teacher owns classroom",
  );
  await rejects(() => call("join", [code, "선생님"]), /CLASS_SELF_JOIN/);
  await rejects(
    () => db.query("select * from public.eng_math_class_members"),
    /permission denied/,
  );
  await as(stranger);
  ok(
    (await call("list")).owned.length === 0,
    "other teacher cannot list classroom",
  );
  await rejects(() => call("roster", [classId]), /CLASS_FORBIDDEN/);
  await rejects(() => call("rotate_code", [classId]), /CLASS_FORBIDDEN/);
  await rejects(
    () => call("join", ["invalid", "학생"]),
    /CLASS_INVITE_INVALID/,
  );
  await as(student);
  const preview = await call("preview", [code]);
  ok(
    Object.keys(preview).sort().join(",") === "id,name",
    "preview does not reveal students or teacher email",
  );
  await call("join", [code, "학생 가"]);
  await call("join", [code, "학생 가"]);
  ok((await call("list")).joined.length === 1, "duplicate join is idempotent");
  ok(
    !("invite_code" in (await call("list")).joined[0]),
    "students cannot retrieve invite code",
  );
  await rejects(() => call("roster", [classId]), /CLASS_FORBIDDEN/);
  await rejects(
    () => call("member_update", [classId, student, "targets", 10, 10]),
    /CLASS_FORBIDDEN/,
  );
  await rejects(
    () => call("member_update", [classId, otherStudent, "leave"]),
    /CLASS_FORBIDDEN/,
  );
  async function event(id, user, correct, time) {
    await db.query(
      `insert into public.learning_events(event_id,user_id,subject,activity_type,problem_key,
      source_session_id,occurred_at,correct,outcome) values($1,$2,'english','answer','2026_csat_19',$1,$3,$4,'answered')`,
      [id, user, time, correct],
    );
  }
  const now = Date.now();
  await event(
    "old",
    student,
    false,
    new Date(now - 31 * 86400000).toISOString(),
  );
  await event(
    "wrong",
    student,
    false,
    new Date(now - 2 * 86400000).toISOString(),
  );
  await event("correct", student, true, new Date(now - 86400000).toISOString());
  await event("future", student, false, new Date(now + 86400000).toISOString());
  await rejects(
    () => event("forged", otherStudent, true, new Date(now).toISOString()),
    /row-level security/,
  );
  await as(otherStudent);
  await event(
    "unlinked",
    otherStudent,
    true,
    new Date(now - 1000).toISOString(),
  );
  await as(teacher);
  await call("member_update", [classId, student, "targets", 5, 10]);
  await rejects(
    () => call("member_update", [classId, student, "targets", -1, 10]),
    /CLASS_INVALID_TARGET/,
  );
  await rejects(
    () => call("member_update", [classId, student, "targets", null, 10]),
    /CLASS_INVALID_TARGET/,
  );
  const roster = await call("roster", [classId]);
  ok(
    roster.members.length === 1 && roster.members[0].english_target === 5,
    "teacher sets target for linked student",
  );
  const eventQuery = async () =>
    (
      await db.query(
        "select * from public.eng_math_classroom_events($1,$2,0)",
        [classId, roster.as_of],
      )
    ).rows;
  const rows = await eventQuery();
  ok(
    rows.length === 2 && rows.every((e) => e.user_id === student),
    "only linked student events in last30, no future records",
  );
  ok(
    (await db.query("select * from public.learning_events")).rows.length === 0,
    "original own-event RLS remains intact for teacher",
  );
  await as(stranger);
  await rejects(eventQuery, /CLASS_FORBIDDEN/);
  await rejects(
    () => call("member_update", [classId, student, "leave"]),
    /CLASS_FORBIDDEN/,
  );
  await as(student);
  await rejects(eventQuery, /CLASS_FORBIDDEN/);
  ok(
    (await call("list")).joined[0].math_target === 10,
    "student sees own target",
  );
  await call("member_update", [classId, student, "leave"]);
  ok(
    (await db.query("select * from public.learning_events")).rows.length === 4,
    "leaving preserves student history",
  );
  await as(teacher);
  ok(
    (await eventQuery()).length === 0,
    "revocation immediately removes teacher access",
  );
  const newCode = await call("rotate_code", [classId]);
  ok(newCode !== code, "rotated code differs");
  await as(student);
  await rejects(() => call("preview", [code]), /CLASS_INVITE_INVALID/);
  await call("join", [newCode, "학생 가"]);
  await as(teacher);
  await call("member_update", [classId, student, "leave"]);
  ok(
    (await call("roster", [classId])).members.length === 0,
    "teacher can remove member",
  );

  const member = {
    student_id: student,
    student_name: "학생",
    english_target: 5,
    math_target: 5,
  };
  const iso = new Date(now).toISOString();
  const summary = summarizeClassStudent(member, rows, iso);
  ok(
    summary.subjects.english.count === 1 &&
      summary.subjects.english.attempts === 2,
    "retries do not inflate unique volume",
  );
  ok(
    summary.issues.length === 0,
    "later correct answer clears previous wrong answer",
  );
  const wrong = {
    ...rows.find((e) => e.event_id === "correct"),
    correct: false,
  };
  const signal = {
    ...wrong,
    event_id: "signal",
    activity_type: "review_signal",
    correct: null,
    outcome: "sure_wrong",
  };
  const s2 = summarizeClassStudent(
    member,
    [...rows.filter((e) => e.event_id !== "correct"), wrong, signal, signal],
    iso,
  );
  ok(
    s2.issues[0].reason === "sure_wrong",
    "same-session review signal determines issue reason",
  );
  const s3 = summarizeClassStudent(
    member,
    [wrong, { ...signal, source_session_id: "older", outcome: "gave_up" }],
    iso,
  );
  ok(
    s3.issues[0].reason === "wrong",
    "old-session signal cannot contaminate current attempt",
  );
  const empty = summarizeClassStudent(member, [], iso);
  const boundary = summarizeClassStudent(
    member,
    [
      { ...wrong, event_id: "kst-before", occurred_at: "2026-09-01T14:59:59Z" },
      { ...wrong, event_id: "kst-after", occurred_at: "2026-09-01T15:00:00Z" },
    ],
    "2026-09-07T15:30:00Z",
  );
  ok(
    boundary.subjects.english.attempts === 1 && boundary.activeDays === 1,
    "Korean calendar week begins six days before today, at local midnight",
  );
  const priority = summarizeClassStudent(
    member,
    [
      wrong,
      signal,
      {
        ...wrong,
        problem_key: "2026_csat_20",
        event_id: "give-answer",
        source_session_id: "give",
      },
      {
        ...signal,
        problem_key: "2026_csat_20",
        event_id: "give-signal",
        source_session_id: "give",
        outcome: "gave_up",
      },
    ],
    iso,
  );
  ok(
    priority.issues.map((e) => e.reason).join(",") === "gave_up,sure_wrong",
    "give-up precedes sure-wrong",
  );
  ok(
    empty.activeDays === 0 &&
      empty.lastActive === null &&
      empty.subjects.english.count === 0,
    "empty stays empty",
  );
  ok(
    normalizeEngMathReturnTo("/eng-math/classroom") === "/eng-math/classroom",
    "auth returns to classroom",
  );
  ok(
    normalizeEngMathReturnTo("//evil.test/eng-math/classroom") === "",
    "auth rejects external redirects",
  );
  await rejects(
    () =>
      classroomRpc(
        { rpc: async () => ({ error: { code: "PGRST202" } }) },
        "list",
      ),
    /CLASS_SETUP_REQUIRED/,
  );
  let pageCalls = 0;
  const fake = {
    rpc: async (name, args) => ({
      data: name.endsWith("_roster")
        ? { members: [member], as_of: iso }
        : ++pageCalls === 1
          ? Array.from({ length: 500 }, (_, i) => ({
              ...wrong,
              event_id: `e${i}`,
            }))
          : [],
    }),
  };
  const loaded = await loadClassroom(fake, "class");
  ok(
    pageCalls === 2 && loaded.students[0].subjects.english.attempts === 500,
    "event pages are fully loaded",
  );
  await rejects(
    () =>
      loadClassroom(
        {
          rpc: async (name) => ({
            data: name.endsWith("_roster")
              ? { members: [member], as_of: iso }
              : null,
          }),
        },
        "class",
      ),
    /CLASS_DATA_INVALID/,
  );
  console.log(
    `[ENG_MATH_CLASSROOM] PASS ${checks} checks: migration, permissions, consent/revocation, targets, summaries, pagination, login return`,
  );
} finally {
  await db.close();
}
