const PROGRESS_VERSION = 1;
const PROGRESS_STORAGE_KEY = "math_concept_progress_v1";
const WEEK_IN_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_COMPLETIONS = 120;
const WEEKLY_CONCEPT_TARGET = 3;

function emptyProgress() {
  return { version: PROGRESS_VERSION, completions: [] };
}

function isNonEmptyText(value, maxLength) {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.length <= maxLength
  );
}

function normalizeCompletion(completion) {
  if (
    !isNonEmptyText(completion?.conceptId, 120) ||
    !isNonEmptyText(completion?.unitId, 120) ||
    !Number.isFinite(Date.parse(completion?.completedAt))
  ) {
    throw new Error("개념 학습 완료 기록 형식이 올바르지 않습니다.");
  }
  return {
    conceptId: completion.conceptId,
    unitId: completion.unitId,
    completedAt: new Date(completion.completedAt).toISOString(),
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

export function normalizeMathConceptProgress(value) {
  if (value?.version !== PROGRESS_VERSION || !Array.isArray(value?.completions)) {
    return emptyProgress();
  }
  try {
    const unique = new Map();
    value.completions
      .map(normalizeCompletion)
      .sort((a, b) => Date.parse(a.completedAt) - Date.parse(b.completedAt))
      .forEach((completion) => {
        if (!unique.has(completion.conceptId)) {
          unique.set(completion.conceptId, completion);
        }
      });
    return {
      version: PROGRESS_VERSION,
      completions: [...unique.values()].slice(-MAX_COMPLETIONS),
    };
  } catch {
    return emptyProgress();
  }
}

export function appendMathConceptCompletion(progress, completion) {
  const current = normalizeMathConceptProgress(progress);
  const normalized = normalizeCompletion(completion);
  if (current.completions.some((item) => item.conceptId === normalized.conceptId)) {
    return current;
  }
  return normalizeMathConceptProgress({
    version: PROGRESS_VERSION,
    completions: [...current.completions, normalized],
  });
}

export function summarizeMathConceptProgress(
  progress,
  validConcepts,
  now = new Date(),
) {
  if (!Array.isArray(validConcepts)) {
    throw new Error("개념 목록 형식이 올바르지 않습니다.");
  }
  const nowMs = now instanceof Date ? now.getTime() : Date.parse(now);
  if (!Number.isFinite(nowMs)) {
    throw new Error("개념 학습 요약 기준 시각이 올바르지 않습니다.");
  }
  const conceptUnit = new Map(
    validConcepts.map((concept) => [concept.id, concept.unitId]),
  );
  const completions = normalizeMathConceptProgress(progress).completions.filter(
    (completion) => conceptUnit.get(completion.conceptId) === completion.unitId,
  );
  const completedIds = completions.map((completion) => completion.conceptId);
  const completedByUnit = Object.fromEntries(
    [...new Set(validConcepts.map((concept) => concept.unitId))].map((unitId) => [
      unitId,
      completions.filter((completion) => completion.unitId === unitId).length,
    ]),
  );
  const recentCount = completions.filter((completion) => {
    const completedAt = Date.parse(completion.completedAt);
    return completedAt <= nowMs && completedAt >= nowMs - WEEK_IN_MS;
  }).length;
  const recentCompletedIds = completions
    .filter((completion) => {
      const completedAt = Date.parse(completion.completedAt);
      return completedAt <= nowMs && completedAt >= nowMs - WEEK_IN_MS;
    })
    .map((completion) => completion.conceptId);

  return {
    totalCount: validConcepts.length,
    completedCount: completedIds.length,
    recentCount,
    recentCompletedIds,
    completedIds,
    completedByUnit,
  };
}

export function buildMathConceptWeeklyPlan(
  progress,
  orderedConcepts,
  now = new Date(),
  target = WEEKLY_CONCEPT_TARGET,
) {
  if (!Number.isInteger(target) || target < 1 || target > 7) {
    throw new Error("주간 개념 학습 목표가 올바르지 않습니다.");
  }
  const summary = summarizeMathConceptProgress(progress, orderedConcepts, now);
  const conceptById = new Map(orderedConcepts.map((concept) => [concept.id, concept]));
  const completedIds = new Set(summary.completedIds);
  const recentIds = summary.recentCompletedIds.filter((conceptId) =>
    conceptById.has(conceptId),
  );
  const nextConcept =
    orderedConcepts.find((concept) => !completedIds.has(concept.id)) ?? null;
  const selectedIds = recentIds.slice(-target);
  if (selectedIds.length < target) {
    for (const concept of orderedConcepts) {
      if (selectedIds.length >= target) break;
      if (!completedIds.has(concept.id) && !selectedIds.includes(concept.id)) {
        selectedIds.push(concept.id);
      }
    }
  }

  return {
    target,
    recentCount: summary.recentCount,
    remainingCount: Math.max(target - summary.recentCount, 0),
    targetMet: summary.recentCount >= target,
    nextConcept,
    items: selectedIds
      .map((conceptId) => conceptById.get(conceptId))
      .filter(Boolean)
      .map((concept) => ({
        ...concept,
        status: completedIds.has(concept.id)
          ? "completed"
          : concept.id === nextConcept?.id
            ? "next"
            : "planned",
      })),
  };
}

export function createScopedMathConceptProgressStorage(
  authenticatedUserId,
  storage = browserStorage(),
) {
  if (!storage || !authenticatedUserId) return storage;
  const scopedKey = `${PROGRESS_STORAGE_KEY}:member:${authenticatedUserId}`;
  return {
    getItem(key) {
      return storage.getItem(key === PROGRESS_STORAGE_KEY ? scopedKey : key);
    },
    setItem(key, value) {
      return storage.setItem(key === PROGRESS_STORAGE_KEY ? scopedKey : key, value);
    },
  };
}

export function readMathConceptProgress(storage = browserStorage()) {
  if (!storage) return emptyProgress();
  try {
    const raw = storage.getItem(PROGRESS_STORAGE_KEY);
    return raw ? normalizeMathConceptProgress(JSON.parse(raw)) : emptyProgress();
  } catch {
    return emptyProgress();
  }
}

export function writeMathConceptProgress(progress, storage = browserStorage()) {
  const normalized = normalizeMathConceptProgress(progress);
  if (storage) {
    try {
      storage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(normalized));
    } catch {
      // 저장이 막혀도 현재 개념 페이지는 계속 사용할 수 있다.
    }
  }
  return normalized;
}

export function recordMathConceptCompletion(
  { conceptId, unitId, completedAt = new Date().toISOString() },
  storage = browserStorage(),
) {
  const progress = appendMathConceptCompletion(readMathConceptProgress(storage), {
    conceptId,
    unitId,
    completedAt,
  });
  return writeMathConceptProgress(progress, storage);
}

export const mathConceptProgressConfig = Object.freeze({
  version: PROGRESS_VERSION,
  storageKey: PROGRESS_STORAGE_KEY,
  weekInMs: WEEK_IN_MS,
  weeklyConceptTarget: WEEKLY_CONCEPT_TARGET,
  maxCompletions: MAX_COMPLETIONS,
});
