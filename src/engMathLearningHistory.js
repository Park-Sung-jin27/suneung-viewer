const HISTORY_VERSION = 1;
const HISTORY_STORAGE_KEY = "eng_math_learning_history_v1";
const MAX_SESSION_RECORDS = 120;
const WEEK_IN_MS = 7 * 24 * 60 * 60 * 1000;
const SUBJECTS = new Set(["english", "math"]);
const ATTEMPT_KINDS = new Set(["standard", "wrong_retry"]);

function emptyHistory() {
  return { version: HISTORY_VERSION, sessions: [] };
}

function isNonEmptyText(value, maxLength) {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.length <= maxLength
  );
}

function normalizeResult(result) {
  if (
    !isNonEmptyText(result?.questionId, 120) ||
    !isNonEmptyText(result?.label, 180) ||
    typeof result?.isCorrect !== "boolean"
  ) {
    throw new Error("학습 문항 결과 형식이 올바르지 않습니다.");
  }

  return {
    questionId: result.questionId,
    label: result.label,
    isCorrect: result.isCorrect,
  };
}

function normalizeSession(session) {
  if (
    !isNonEmptyText(session?.id, 160) ||
    !SUBJECTS.has(session?.subject) ||
    !isNonEmptyText(session?.packId, 120) ||
    !isNonEmptyText(session?.packLabel, 240) ||
    !ATTEMPT_KINDS.has(session?.attemptKind) ||
    !Number.isFinite(Date.parse(session?.completedAt)) ||
    !Array.isArray(session?.results) ||
    session.results.length < 1 ||
    session.results.length > 5
  ) {
    throw new Error("학습 기록 형식이 올바르지 않습니다.");
  }

  const results = session.results.map(normalizeResult);
  if (new Set(results.map((result) => result.questionId)).size !== results.length) {
    throw new Error("학습 기록에 중복 문항이 있습니다.");
  }

  return {
    id: session.id,
    subject: session.subject,
    packId: session.packId,
    packLabel: session.packLabel,
    attemptKind: session.attemptKind,
    completedAt: new Date(session.completedAt).toISOString(),
    results,
  };
}

export function createLearningSessionId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createLearningSessionRecord({
  sessionId,
  subject,
  packId,
  packLabel,
  isWrongRetry,
  results,
  completedAt = new Date().toISOString(),
}) {
  return normalizeSession({
    id: sessionId,
    subject,
    packId,
    packLabel,
    attemptKind: isWrongRetry ? "wrong_retry" : "standard",
    completedAt,
    results,
  });
}

export function normalizeLearningHistory(value) {
  if (
    value?.version !== HISTORY_VERSION ||
    !Array.isArray(value?.sessions)
  ) {
    return emptyHistory();
  }

  try {
    const sessions = value.sessions
      .map(normalizeSession)
      .sort((a, b) => Date.parse(a.completedAt) - Date.parse(b.completedAt))
      .slice(-MAX_SESSION_RECORDS);
    return { version: HISTORY_VERSION, sessions };
  } catch {
    return emptyHistory();
  }
}

export function appendLearningSession(history, session) {
  const current = normalizeLearningHistory(history);
  const normalizedSession = normalizeSession(session);
  const sessions = current.sessions
    .filter((candidate) => candidate.id !== normalizedSession.id)
    .concat(normalizedSession)
    .sort((a, b) => Date.parse(a.completedAt) - Date.parse(b.completedAt))
    .slice(-MAX_SESSION_RECORDS);

  return { version: HISTORY_VERSION, sessions };
}

export function summarizeLearningHistory(
  history,
  subject,
  now = new Date(),
) {
  if (!SUBJECTS.has(subject)) {
    throw new Error("학습 과목이 올바르지 않습니다.");
  }

  const nowMs = now instanceof Date ? now.getTime() : Date.parse(now);
  if (!Number.isFinite(nowMs)) {
    throw new Error("학습 요약 기준 시각이 올바르지 않습니다.");
  }

  const recentSessions = normalizeLearningHistory(history).sessions.filter(
    (session) => {
      const completedAt = Date.parse(session.completedAt);
      return (
        session.subject === subject &&
        completedAt <= nowMs &&
        completedAt >= nowMs - WEEK_IN_MS
      );
    },
  );
  const attempts = recentSessions.flatMap((session) =>
    session.results.map((result) => ({
      ...result,
      completedAt: session.completedAt,
    })),
  );
  const correctCount = attempts.filter((result) => result.isCorrect).length;
  const weaknesses = new Map();

  attempts.forEach((result) => {
    const current = weaknesses.get(result.questionId) ?? {
      questionId: result.questionId,
      label: result.label,
      wrongCount: 0,
      latestIsCorrect: result.isCorrect,
      latestCompletedAt: result.completedAt,
    };
    if (!result.isCorrect) current.wrongCount += 1;
    if (Date.parse(result.completedAt) >= Date.parse(current.latestCompletedAt)) {
      current.label = result.label;
      current.latestIsCorrect = result.isCorrect;
      current.latestCompletedAt = result.completedAt;
    }
    weaknesses.set(result.questionId, current);
  });

  const weakQuestions = [...weaknesses.values()]
    .filter((item) => item.wrongCount > 0)
    .sort(
      (a, b) =>
        b.wrongCount - a.wrongCount ||
        Date.parse(b.latestCompletedAt) - Date.parse(a.latestCompletedAt),
    )
    .slice(0, 3);

  return {
    sessionCount: recentSessions.length,
    retrySessionCount: recentSessions.filter(
      (session) => session.attemptKind === "wrong_retry",
    ).length,
    answerCount: attempts.length,
    correctCount,
    wrongCount: attempts.length - correctCount,
    accuracy:
      attempts.length === 0 ? null : Math.round((correctCount / attempts.length) * 100),
    weakQuestions,
  };
}

function browserStorage() {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readLearningHistory(storage = browserStorage()) {
  if (!storage) return emptyHistory();
  try {
    const raw = storage.getItem(HISTORY_STORAGE_KEY);
    return raw ? normalizeLearningHistory(JSON.parse(raw)) : emptyHistory();
  } catch {
    return emptyHistory();
  }
}

export function readWeeklyLearningSummary(
  subject,
  now = new Date(),
  storage = browserStorage(),
) {
  return summarizeLearningHistory(readLearningHistory(storage), subject, now);
}

export function recordLearningSession(
  input,
  storage = browserStorage(),
) {
  const session = createLearningSessionRecord(input);
  const history = appendLearningSession(readLearningHistory(storage), session);

  if (storage) {
    try {
      storage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
    } catch {
      // 저장이 막혀도 현재 학습 결과 화면은 계속 보여준다.
    }
  }

  return summarizeLearningHistory(history, session.subject, session.completedAt);
}

export const learningHistoryConfig = Object.freeze({
  version: HISTORY_VERSION,
  storageKey: HISTORY_STORAGE_KEY,
  maxSessionRecords: MAX_SESSION_RECORDS,
  weekInMs: WEEK_IN_MS,
});
