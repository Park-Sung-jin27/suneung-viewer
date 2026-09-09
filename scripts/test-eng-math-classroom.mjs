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
  ok(empty.days.length === 7 && empty.days.every(d => !d.hasActivity), "all seven calendar days appear even with no records");
  const dailyBase = { ...wrong, occurred_at: "2026-09-09T02:00:00Z", outcome: "answered", source_session_id: "today" };
  const daily = summarizeClassStudent(member, [
    {...dailyBase, event_id:"today-answer"},
    {...dailyBase, event_id:"retry-answer"},
    {...dailyBase, event_id:"give-up", problem_key:"q2", outcome:"gave_up"},
    {...dailyBase, event_id:"concept", subject:"math", activity_type:"concept_complete", problem_key:"concept1"},
    {...dailyBase, event_id:"review", activity_type:"review_complete"},
    {...dailyBase, event_id:"yesterday", occurred_at:"2026-09-08T14:59:59Z"},
    {...dailyBase, event_id:"midnight", subject:"math", occurred_at:"2026-09-08T15:00:00Z"},
    {...dailyBase, event_id:"future", problem_key:"qFuture", occurred_at:"2026-09-10T02:00:00Z"},
    {...dailyBase, event_id:"other-user", problem_key:"qOther", user_id:stranger},
  ], "2026-09-09T03:00:00Z");
  const today = daily.days.at(-1);
  ok(today.date === "2026-09-09" && today.subjects.english.answered === 1, "daily answers deduplicate retries and exclude future/other student events");
  ok(today.subjects.english.viewed === 1 && today.subjects.english.reviewed === 1, "viewed explanation is separate from answer submission and review completion");
  ok(today.subjects.math.answered === 1 && today.subjects.math.concepts === 1, "KST midnight belongs to new day and concept completion stays separate");
  ok(daily.days.at(-2).subjects.english.answered === 1 && daily.subjects.english.count === 2, "repeat on another day counts per day but weekly unique count is unchanged");
  ok(summarizeClassStudent(member, [{...dailyBase, event_id:"signal-only", activity_type:"review_signal"}], "2026-09-09T03:00:00Z").days.every(d => !d.hasActivity), "confidence-only changes cannot mark daily learning");
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
  ok(normalizeEngMathReturnTo("/eng-math/classroom?role=student") === "/eng-math/classroom?role=student", "student invitation retains student mode after login");
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

// Repeatable local UI verification; never connects to the production database.
if (process.argv.includes("--serve")) {
  const port = Number(process.argv.find(arg => arg.startsWith("--port="))?.slice(7) || 4188);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("Invalid local QA port");
  const { createServer } = await import("vite");
  const { fileURLToPath } = await import("node:url");
  const server = await createServer({
    configFile: false, root: fileURLToPath(new URL("../", import.meta.url)),
    server: { host: "127.0.0.1", port, strictPort: true },
    esbuild: { jsx: "automatic" },
    plugins: [{
      name: "classroom-local-qa",
      resolveId(id) { if (id === "/__classroom_test.jsx") return "\0classroom-test"; },
      load(id) { if (id === "\0classroom-test") return `import React from 'react';import{createRoot}from'react-dom/client';import{BrowserRouter,Routes,Route}from'react-router-dom';import Classroom from '/src/EngMathClassroom.jsx';import Practice from '/src/EngMathPractice.jsx';createRoot(document.getElementById('root')).render(React.createElement(BrowserRouter,null,React.createElement(Routes,null,React.createElement(Route,{path:'/eng-math/classroom',element:React.createElement(Classroom,{user:null,authReady:true})}),React.createElement(Route,{path:'/eng-math/practice',element:React.createElement(Practice,{user:null})}))));`; },
      transform(code, id) { if (id.replaceAll('\\', '/').endsWith('/src/supabase.js')) return {code: "export const supabase = {rpc:async()=>{throw new Error('Local demo only');}};", map:null}; },
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const url = new URL(req.url, "http://127.0.0.1:4188");
          if (["/eng-math/classroom", "/eng-math/practice"].includes(url.pathname)) {
            res.setHeader("Content-Type", "text/html; charset=utf-8");
            res.end('<!doctype html><html lang="ko"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><p>로컬 화면 검증 · 운영 계정·DB 연결 없음</p><div id="root"></div><script type="module" src="/__classroom_test.jsx"></script></body></html>');
            return;
          }
          next();
        });
      },
    }],
  });
  await server.listen();
  console.log(`Classroom local QA: http://127.0.0.1:${port}/eng-math/classroom?demo=1`);
}
