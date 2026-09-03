const HISTORY_VERSION = 1;
const HISTORY_STORAGE_KEY = "eng_math_learning_history_v1";
const MAX_SESSION_RECORDS = 120;
const DAY_IN_MS = 24 * 60 * 60 * 1000;
const WEEK_IN_MS = 7 * DAY_IN_MS;
const REVIEW_INTERVALS_DAYS = [1, 3, 7];
const SUBJECTS = new Set(["english", "math"]);
const ATTEMPT_KINDS = new Set(["standard", "wrong_retry"]);
const CONFIDENCE_LEVELS = new Set(["sure", "unsure", "guess"]);

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

function resolveNowMs(now) {
  const nowMs = now instanceof Date ? now.getTime() : Date.parse(now);
  if (!Number.isFinite(nowMs)) {
    throw new Error("학습 요약 기준 시각이 올바르지 않습니다.");
  }
  return nowMs;
}

function normalizeResult(result) {
  if (
    !isNonEmptyText(result?.questionId, 120) ||
    !isNonEmptyText(result?.label, 180) ||
    typeof result?.isCorrect !== "boolean"
  ) {
    throw new Error("학습 문항 결과 형식이 올바르지 않습니다.");
  }

  const normalized = {
    questionId: result.questionId,
    label: result.label,
    isCorrect: result.isCorrect,
  };
  if (result.durationMs !== undefined) {
    if (
      !Number.isInteger(result.durationMs) ||
      result.durationMs < 0 ||
      result.durationMs > 60 * 60 * 1000
    ) {
      throw new Error("문항 풀이 시간이 올바르지 않습니다.");
    }
    normalized.durationMs = result.durationMs;
  }
  if (result.confidence !== undefined) {
    if (!CONFIDENCE_LEVELS.has(result.confidence)) {
      throw new Error("문항 확신도 형식이 올바르지 않습니다.");
    }
    normalized.confidence = result.confidence;
  }
  return normalized;
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

function attemptsForSubject(history, subject, nowMs) {
  return normalizeLearningHistory(history).sessions
    .filter(
      (session) =>
        session.subject === subject && Date.parse(session.completedAt) <= nowMs,
    )
    .flatMap((session) =>
      session.results.map((result) => ({
        ...result,
        attemptKind: session.attemptKind,
        completedAt: session.completedAt,
      })),
    )
    .sort((a, b) => Date.parse(a.completedAt) - Date.parse(b.completedAt));
}

function reviewLabel(recoveryStage, mastered) {
  if (mastered) return "교정 완료";
  return `${REVIEW_INTERVALS_DAYS[recoveryStage]}일 복습`;
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
  if (value?.version !== HISTORY_VERSION || !Array.isArray(value?.sessions)) {
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

export function buildQuestionReviewStates(
  history,
  subject,
  now = new Date(),
) {
  if (!SUBJECTS.has(subject)) {
    throw new Error("학습 과목이 올바르지 않습니다.");
  }
  const nowMs = resolveNowMs(now);
  const states = new Map();

  attemptsForSubject(history, subject, nowMs).forEach((attempt) => {
    const completedAtMs = Date.parse(attempt.completedAt);
    const current = states.get(attempt.questionId) ?? {
      questionId: attempt.questionId,
      label: attempt.label,
      attemptCount: 0,
      wrongCount: 0,
      hadWrong: false,
      recoveryStage: 0,
      dueAtMs: null,
      latestIsCorrect: attempt.isCorrect,
      latestCompletedAt: attempt.completedAt,
    };
    const wasDue = current.dueAtMs !== null && completedAtMs >= current.dueAtMs;

    current.attemptCount += 1;
    current.label = attempt.label;
    current.latestIsCorrect = attempt.isCorrect;
    current.latestCompletedAt = attempt.completedAt;

    if (!attempt.isCorrect) {
      current.wrongCount += 1;
      current.hadWrong = true;
      current.recoveryStage = 0;
      current.dueAtMs = completedAtMs + REVIEW_INTERVALS_DAYS[0] * DAY_IN_MS;
    } else if (current.hadWrong && attempt.attemptKind !== "wrong_retry" && wasDue) {
      current.recoveryStage = Math.min(
        current.recoveryStage + 1,
        REVIEW_INTERVALS_DAYS.length,
      );
      current.dueAtMs =
        current.recoveryStage >= REVIEW_INTERVALS_DAYS.length
          ? null
          : completedAtMs +
            REVIEW_INTERVALS_DAYS[current.recoveryStage] * DAY_IN_MS;
    }

    states.set(attempt.questionId, current);
  });

  return [...states.values()]
    .map((state) => {
      const mastered =
        state.hadWrong &&
        state.recoveryStage >= REVIEW_INTERVALS_DAYS.length &&
        state.latestIsCorrect;
      const dueAt = state.dueAtMs === null ? null : new Date(state.dueAtMs).toISOString();
      const status = mastered
        ? "mastered"
        : state.dueAtMs !== null && state.dueAtMs <= nowMs
          ? "due"
          : state.dueAtMs !== null
            ? "scheduled"
            : "stable";
      return {
        questionId: state.questionId,
        label: state.label,
        attemptCount: state.attemptCount,
        wrongCount: state.wrongCount,
        hadWrong: state.hadWrong,
        recoveryStage: state.recoveryStage,
        latestIsCorrect: state.latestIsCorrect,
        latestCompletedAt: state.latestCompletedAt,
        dueAt,
        status,
        reviewLabel: state.hadWrong
          ? reviewLabel(state.recoveryStage, mastered)
          : null,
      };
    })
    .sort(
      (a, b) =>
        Date.parse(b.latestCompletedAt) - Date.parse(a.latestCompletedAt) ||
        a.questionId.localeCompare(b.questionId),
    );
}

function rotateForDate(items, nowMs) {
  if (items.length < 2) return items;
  const dayNumber = Math.floor(nowMs / DAY_IN_MS);
  const offset = dayNumber % items.length;
  return [...items.slice(offset), ...items.slice(0, offset)];
}

export function buildDailyLearningPlan(
  questions,
  subject,
  history,
  now = new Date(),
) {
  if (!SUBJECTS.has(subject) || !Array.isArray(questions)) {
    throw new Error("오늘의 학습 문항 형식이 올바르지 않습니다.");
  }
  const nowMs = resolveNowMs(now);
  const uniqueQuestions = [...new Map(
    questions
      .filter((question) => isNonEmptyText(question?.id, 120))
      .map((question) => [question.id, question]),
  ).values()];
  if (uniqueQuestions.length !== questions.length || uniqueQuestions.length < 1) {
    throw new Error("오늘의 학습 문항에 중복 또는 누락이 있습니다.");
  }

  const stateById = new Map(
    buildQuestionReviewStates(history, subject, now).map((state) => [
      state.questionId,
      state,
    ]),
  );
  const decorated = rotateForDate(uniqueQuestions, nowMs).map((question) => {
    const state = stateById.get(question.id) ?? null;
    const reason =
      state?.status === "due"
        ? state.reviewLabel
        : state?.hadWrong && state.status !== "mastered"
          ? "취약 보완"
          : !state
            ? "새 문항"
            : "유지 학습";
    return { question, state, reason };
  });
  const due = decorated
    .filter((item) => item.state?.status === "due")
    .sort((a, b) => Date.parse(a.state.dueAt) - Date.parse(b.state.dueAt));
  const weak = decorated
    .filter(
      (item) =>
        item.state?.hadWrong &&
        item.state.status !== "due" &&
        item.state.status !== "mastered",
    )
    .sort((a, b) => b.state.wrongCount - a.state.wrongCount);
  const unseen = decorated.filter((item) => !item.state);
  const selected = [];
  const selectedIds = new Set();
  const add = (items, limit = Number.POSITIVE_INFINITY) => {
    items.forEach((item) => {
      if (selected.length >= 5 || selectedIds.has(item.question.id) || limit <= 0) return;
      selected.push(item);
      selectedIds.add(item.question.id);
      limit -= 1;
    });
  };

  add(due, 2);
  add(weak, 1);
  add(unseen, 2);
  add(decorated);

  const items = selected.map(({ question, reason }) => ({
    questionId: question.id,
    reason,
  }));
  return {
    questions: selected.map(({ question }) => question),
    items,
    dueCount: items.filter((item) => item.reason.endsWith("일 복습")).length,
    weakCount: items.filter((item) => item.reason === "취약 보완").length,
    newCount: items.filter((item) => item.reason === "새 문항").length,
  };
}

export function summarizeLearningHistory(history, subject, now = new Date()) {
  if (!SUBJECTS.has(subject)) {
    throw new Error("학습 과목이 올바르지 않습니다.");
  }

  const nowMs = resolveNowMs(now);
  const normalized = normalizeLearningHistory(history);
  const recentSessions = normalized.sessions.filter((session) => {
    const completedAt = Date.parse(session.completedAt);
    return (
      session.subject === subject &&
      completedAt <= nowMs &&
      completedAt >= nowMs - WEEK_IN_MS
    );
  });
  const attempts = recentSessions.flatMap((session) =>
    session.results.map((result) => ({
      ...result,
      completedAt: session.completedAt,
    })),
  );
  const correctCount = attempts.filter((result) => result.isCorrect).length;
  const reviewStates = buildQuestionReviewStates(normalized, subject, now);
  const weakQuestions = reviewStates
    .filter((item) => item.wrongCount > 0 && item.status !== "mastered")
    .sort(
      (a, b) =>
        Number(a.latestIsCorrect) - Number(b.latestIsCorrect) ||
        b.wrongCount - a.wrongCount ||
        Date.parse(b.latestCompletedAt) - Date.parse(a.latestCompletedAt),
    )
    .slice(0, 3);
  const durations = attempts
    .map((result) => result.durationMs)
    .filter(Number.isInteger);
  const confidenceCounts = { sure: 0, unsure: 0, guess: 0 };
  attempts.forEach((result) => {
    if (CONFIDENCE_LEVELS.has(result.confidence)) {
      confidenceCounts[result.confidence] += 1;
    }
  });

  return {
    sessionCount: recentSessions.length,
    retrySessionCount: recentSessions.filter(
      (session) => session.attemptKind === "wrong_retry",
    ).length,
    answerCount: attempts.length,
    correctCount,
    wrongCount: attempts.length - correctCount,
    accuracy:
      attempts.length === 0
        ? null
        : Math.round((correctCount / attempts.length) * 100),
    averageDurationSeconds:
      durations.length === 0
        ? null
        : Math.round(
            durations.reduce((total, duration) => total + duration, 0) /
              durations.length /
              1000,
          ),
    confidenceCounts,
    dueReviewCount: reviewStates.filter((state) => state.status === "due").length,
    recoveredQuestionCount: reviewStates.filter(
      (state) => state.hadWrong && state.latestIsCorrect,
    ).length,
    masteredQuestionCount: reviewStates.filter(
      (state) => state.status === "mastered",
    ).length,
    repeatWrongQuestionCount: reviewStates.filter(
      (state) => state.wrongCount >= 2 && state.status !== "mastered",
    ).length,
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

export function createScopedLearningHistoryStorage(
  authenticatedUserId,
  storage = browserStorage(),
) {
  if (!storage || !authenticatedUserId) return storage;
  const scopedKey = `${HISTORY_STORAGE_KEY}:member:${authenticatedUserId}`;
  return {
    getItem(key) {
      return storage.getItem(key === HISTORY_STORAGE_KEY ? scopedKey : key);
    },
    setItem(key, value) {
      return storage.setItem(key === HISTORY_STORAGE_KEY ? scopedKey : key, value);
    },
  };
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

export function readDailyLearningPlan(
  questions,
  subject,
  now = new Date(),
  storage = browserStorage(),
) {
  return buildDailyLearningPlan(
    questions,
    subject,
    readLearningHistory(storage),
    now,
  );
}

export function recordLearningSession(input, storage = browserStorage()) {
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
  dayInMs: DAY_IN_MS,
  weekInMs: WEEK_IN_MS,
  reviewIntervalsDays: [...REVIEW_INTERVALS_DAYS],
  confidenceLevels: [...CONFIDENCE_LEVELS],
});
