const DAY = 86400000;
const SUBJECTS = ["english", "math"];

export function summarizeClassStudent(member, events, asOf) {
  const now = Date.parse(asOf);
  if (!Number.isFinite(now)) throw new Error("CLASS_INVALID_WINDOW");
  const rows = [
    ...new Map(
      events
        .filter(
          (e) =>
            e.user_id === member.student_id &&
            SUBJECTS.includes(e.subject) &&
            Date.parse(e.occurred_at) <= now &&
            Date.parse(e.occurred_at) >= now - 30 * DAY,
        )
        .map((e) => [e.event_id, e]),
    ).values(),
  ];
  // Seven Korean calendar days including today; at most seven active-day labels.
  const todayKst = new Date(now + 9 * 3600000).toISOString().slice(0, 10);
  const weekStart = Date.parse(`${todayKst}T00:00:00+09:00`) - 6 * DAY;
  const recent = rows.filter((e) => Date.parse(e.occurred_at) >= weekStart);
  const answers = rows.filter((e) => e.activity_type === "answer");
  const latest = new Map();
  for (const e of answers.sort(
    (a, b) => Date.parse(a.occurred_at) - Date.parse(b.occurred_at),
  )) {
    latest.set(`${e.subject}:${e.problem_key}`, e);
  }
  const issues = [...latest.values()]
    .filter((e) => e.correct === false)
    .map((e) => {
      const signals = rows.filter(
        (s) =>
          s.subject === e.subject &&
          s.problem_key === e.problem_key &&
          s.source_session_id === e.source_session_id &&
          s.activity_type === "review_signal",
      );
      const reason =
        e.outcome === "gave_up" || signals.some((s) => s.outcome === "gave_up")
          ? "gave_up"
          : signals.some((s) => s.outcome === "sure_wrong")
            ? "sure_wrong"
            : "wrong";
      return { ...e, reason };
    })
    .sort(
      (a, b) =>
        ({ gave_up: 0, sure_wrong: 1, wrong: 2 })[a.reason] -
          { gave_up: 0, sure_wrong: 1, wrong: 2 }[b.reason] ||
        Date.parse(b.occurred_at) - Date.parse(a.occurred_at),
    );
  const subjects = Object.fromEntries(
    SUBJECTS.map((subject) => {
      const attempts = recent.filter(
        (e) => e.subject === subject && e.activity_type === "answer",
      );
      return [
        subject,
        {
          count: new Set(attempts.map((e) => e.problem_key)).size,
          attempts: attempts.length,
          correct: attempts.filter((e) => e.correct === true).length,
          target: member[`${subject}_target`],
        },
      ];
    }),
  );
  return {
    ...member,
    subjects,
    issues,
    activeDays: new Set(
      recent.map((e) =>
        new Date(Date.parse(e.occurred_at) + 9 * 3600000)
          .toISOString()
          .slice(0, 10),
      ),
    ).size,
    lastActive: rows.length
      ? new Date(
          Math.max(...rows.map((e) => Date.parse(e.occurred_at))),
        ).toISOString()
      : null,
    concepts: new Set(
      recent
        .filter((e) => e.activity_type === "concept_complete")
        .map((e) => e.problem_key),
    ).size,
    reviews: recent.filter((e) => e.activity_type === "review_complete").length,
  };
}

export async function classroomRpc(client, method, args = {}) {
  const { data, error } = await client.rpc(
    `eng_math_classroom_${method}`,
    args,
  );
  if (error) {
    if (["PGRST202", "42883", "42P01"].includes(error.code))
      throw new Error("CLASS_SETUP_REQUIRED");
    throw new Error(error.message || "CLASS_REQUEST_FAILED");
  }
  return data;
}

export async function loadClassroom(client, classId) {
  const roster = await classroomRpc(client, "roster", { p_class_id: classId });
  if (
    !Array.isArray(roster?.members) ||
    !Number.isFinite(Date.parse(roster.as_of))
  )
    throw new Error("CLASS_DATA_INVALID");
  const events = [];
  for (let offset = 0; offset <= 50000; offset += 500) {
    const page = await classroomRpc(client, "events", {
      p_class_id: classId,
      p_as_of: roster.as_of,
      p_offset: offset,
    });
    if (!Array.isArray(page)) throw new Error("CLASS_DATA_INVALID");
    events.push(...page);
    if (page.length < 500)
      return {
        asOf: roster.as_of,
        students: roster.members.map((m) =>
          summarizeClassStudent(m, events, roster.as_of),
        ),
      };
  }
  throw new Error("CLASS_DATA_TOO_LARGE"); // Never present a truncated roster as complete.
}

export function classroomError(error) {
  const message = error?.message || "";
  const labels = {
    CLASS_SETUP_REQUIRED:
      "학생 연결 기능을 준비 중입니다. 아래 미리보기에서 관리 화면을 확인할 수 있습니다.",
    CLASS_INVITE_INVALID:
      "초대 코드가 맞지 않거나 변경됐습니다. 선생님께 새 코드를 받아 주세요.",
    CLASS_SELF_JOIN: "내가 만든 수업반에는 학생으로 연결할 수 없습니다.",
    CLASS_FORBIDDEN:
      "이 수업반에 접근할 수 없습니다. 목록을 새로 불러와 주세요.",
    CLASS_INVALID_NAME:
      "이름을 입력해 주세요. 수업반은 60자, 학생 이름은 40자까지 가능합니다.",
    CLASS_INVALID_TARGET: "목표는 0~200 사이의 정수로 입력해 주세요.",
    CLASS_LIMIT: "수업반은 계정당 10개까지 만들 수 있습니다.",
    CLASS_MEMBER_LIMIT: "수업반당 학생은 60명까지 연결할 수 있습니다.",
    CLASS_MEMBER_MISSING:
      "학생 연결이 해제됐습니다. 목록을 새로 불러와 주세요.",
    CLASS_DATA_TOO_LARGE:
      "기록이 많아 전체를 불러오지 못했습니다. 일부 결과로 표시하지 않았습니다.",
  };
  return (
    Object.entries(labels).find(([key]) => message.includes(key))?.[1] ||
    "기록을 불러오거나 저장하지 못했습니다. 연결 상태를 확인하고 다시 시도해 주세요."
  );
}

export function classroomDemo() {
  const asOf = new Date().toISOString();
  const members = ["가상 학생 가", "가상 학생 나", "가상 학생 다"].map(
    (name, i) => ({
      student_id: `demo-${i}`,
      student_name: name,
      english_target: 5,
      math_target: 5,
    }),
  );
  const events = [];
  for (let student = 0; student < 2; student++) {
    for (let q = 19; q <= (student === 0 ? 23 : 21); q++) {
      const base = {
        user_id: `demo-${student}`,
        subject: "english",
        problem_key: `2026_csat_${q}`,
        source_session_id: `demo-${student}-${q}`,
        occurred_at: new Date(Date.now() - (24 + q) * 3600000).toISOString(),
      };
      events.push({
        ...base,
        event_id: `answer-${student}-${q}`,
        activity_type: "answer",
        correct: q > 20,
        outcome: "answered",
      });
      if (q <= 20)
        events.push({
          ...base,
          event_id: `signal-${student}-${q}`,
          activity_type: "review_signal",
          outcome: q === 19 ? "gave_up" : "sure_wrong",
        });
    }
  }
  for (let student = 0; student < 2; student++) {
    for (let q = 1; q <= (student === 0 ? 2 : 5); q++) {
      events.push({
        user_id: `demo-${student}`,
        subject: "math",
        problem_key: `2022_06_common_${q}`,
        source_session_id: `demo-math-${student}`,
        event_id: `math-${student}-${q}`,
        occurred_at: new Date(Date.now() - 12 * 3600000).toISOString(),
        activity_type: "answer",
        correct: q !== 2,
        outcome: "answered",
      });
    }
  }
  return {
    asOf,
    students: members.map((m) => summarizeClassStudent(m, events, asOf)),
  };
}
