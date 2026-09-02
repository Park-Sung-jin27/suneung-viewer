const WEEK_IN_MS = 7 * 24 * 60 * 60 * 1000;
const SUBJECTS = new Set(["english", "math"]);
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validateUserId(userId) {
  if (typeof userId !== "string" || !UUID_PATTERN.test(userId)) {
    throw new Error("LEARNING_EVENTS_AUTH_USER_ID");
  }
  return userId.toLowerCase();
}

function stableHash(value) {
  let hash = 0xcbf29ce484222325n;
  for (const character of value) {
    hash ^= BigInt(character.codePointAt(0));
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return hash.toString(16).padStart(16, "0");
}

function eventId(sessionId, questionId, kind) {
  return `public-v1:${stableHash(sessionId)}:${stableHash(questionId)}:${kind}`;
}

function baseRow(session, result, userId, kind) {
  return {
    event_id: eventId(session.id, result.questionId, kind),
    user_id: userId,
    subject: session.subject,
    problem_key: result.questionId,
    source_session_id: `public-v1:${session.id}`,
    occurred_at: new Date(session.completedAt).toISOString(),
    correct: null,
    outcome: null,
    correct_first: null,
    review_offset: null,
  };
}

export function learningHistoryToEventRows(history, authenticatedUserId) {
  const userId = validateUserId(authenticatedUserId);
  if (!history || history.version !== 1 || !Array.isArray(history.sessions)) {
    return [];
  }

  const rows = [];
  for (const session of history.sessions) {
    if (
      !session ||
      !SUBJECTS.has(session.subject) ||
      typeof session.id !== "string" ||
      !Number.isFinite(Date.parse(session.completedAt)) ||
      !Array.isArray(session.results)
    ) {
      continue;
    }

    for (const result of session.results) {
      if (
        typeof result?.questionId !== "string" ||
        typeof result?.isCorrect !== "boolean"
      ) {
        continue;
      }

      rows.push({
        ...baseRow(session, result, userId, "answer"),
        activity_type: "answer",
        correct: result.isCorrect,
        outcome: "answered",
      });

      if (session.attemptKind === "wrong_retry" && result.isCorrect) {
        rows.push({
          ...baseRow(session, result, userId, "remediation"),
          activity_type: "remediation_complete",
          outcome: "corrected",
        });
      }
    }
  }

  return [...new Map(rows.map((row) => [row.event_id, row])).values()];
}

export function summarizeMemberLearningEvents(
  rows,
  subject,
  now = new Date(),
) {
  if (!SUBJECTS.has(subject) || !Array.isArray(rows)) {
    throw new Error("LEARNING_EVENTS_SUMMARY_INPUT");
  }
  const nowMs = now instanceof Date ? now.getTime() : Date.parse(now);
  if (!Number.isFinite(nowMs)) {
    throw new Error("LEARNING_EVENTS_SUMMARY_NOW");
  }

  const subjectRows = rows.filter((row) => row?.subject === subject);
  const recentRows = subjectRows.filter((row) => {
    const occurredAt = Date.parse(row.occurred_at);
    return occurredAt <= nowMs && occurredAt >= nowMs - WEEK_IN_MS;
  });
  const answers = recentRows.filter((row) => row.activity_type === "answer");
  const correctCount = answers.filter((row) => row.correct === true).length;
  const sessionIds = new Set(answers.map((row) => row.source_session_id));
  const recentRemediations = recentRows.filter(
    (row) =>
      row.activity_type === "remediation_complete" &&
      row.outcome === "corrected",
  );
  const recoveredQuestionIds = new Set(
    subjectRows
      .filter(
        (row) =>
          row.activity_type === "remediation_complete" &&
          row.outcome === "corrected",
      )
      .map((row) => row.problem_key),
  );

  return {
    sessionCount: sessionIds.size,
    retrySessionCount: new Set(
      recentRemediations.map((row) => row.source_session_id),
    ).size,
    answerCount: answers.length,
    correctCount,
    wrongCount: answers.length - correctCount,
    accuracy:
      answers.length === 0 ? null : Math.round((correctCount / answers.length) * 100),
    recoveredQuestionCount: recoveredQuestionIds.size,
  };
}

export function combineLocalAndMemberSummary(localSummary, memberSummary) {
  if (!memberSummary) return localSummary;
  return {
    ...localSummary,
    sessionCount: memberSummary.sessionCount,
    retrySessionCount: memberSummary.retrySessionCount,
    answerCount: memberSummary.answerCount,
    correctCount: memberSummary.correctCount,
    wrongCount: memberSummary.wrongCount,
    accuracy: memberSummary.accuracy,
    recoveredQuestionCount: Math.max(
      localSummary.recoveredQuestionCount,
      memberSummary.recoveredQuestionCount,
    ),
  };
}

export async function syncMemberLearningHistory({
  supabase,
  authenticatedUserId,
  history,
  now = new Date(),
}) {
  if (!supabase || typeof supabase.from !== "function") {
    throw new Error("LEARNING_EVENTS_SUPABASE_CLIENT");
  }
  const userId = validateUserId(authenticatedUserId);
  const rows = learningHistoryToEventRows(history, userId);

  for (let start = 0; start < rows.length; start += 200) {
    const { error } = await supabase
      .from("learning_events")
      .upsert(rows.slice(start, start + 200), {
        onConflict: "user_id,event_id",
        ignoreDuplicates: true,
      });
    if (error) {
      throw new Error(`LEARNING_EVENTS_SYNC:${error.message || error.code || "unknown"}`);
    }
  }

  const { data, error } = await supabase
    .from("learning_events")
    .select(
      "event_id,subject,activity_type,problem_key,source_session_id,occurred_at,correct,outcome",
    )
    .eq("user_id", userId)
    .order("occurred_at", { ascending: true });
  if (error) {
    throw new Error(`LEARNING_EVENTS_FETCH:${error.message || error.code || "unknown"}`);
  }
  if (!Array.isArray(data)) {
    throw new Error("LEARNING_EVENTS_FETCH_DATA");
  }

  return {
    syncedEventCount: rows.length,
    summaries: {
      english: summarizeMemberLearningEvents(data, "english", now),
      math: summarizeMemberLearningEvents(data, "math", now),
    },
  };
}
