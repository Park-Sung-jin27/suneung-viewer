const WEEKLY_GOALS = Object.freeze({
  concepts: 3,
  mathQuestions: 5,
  englishQuestions: 5,
});

function safeCount(value) {
  return Number.isInteger(value) && value > 0 ? value : 0;
}

function lane(key, label, completed, target) {
  return {
    key,
    label,
    completed,
    target,
    remaining: Math.max(target - completed, 0),
    percent: Math.min(Math.round((completed / target) * 100), 100),
    complete: completed >= target,
  };
}

export function buildEngMathWeeklyOverview({
  conceptSummary,
  mathSummary,
  englishSummary,
  nextConcept = null,
}) {
  const lanes = [
    lane(
      "concepts",
      "수학 개념",
      safeCount(conceptSummary?.recentCount),
      WEEKLY_GOALS.concepts,
    ),
    lane(
      "math",
      "수학 문제",
      safeCount(mathSummary?.answerCount),
      WEEKLY_GOALS.mathQuestions,
    ),
    lane(
      "english",
      "영어 문제",
      safeCount(englishSummary?.answerCount),
      WEEKLY_GOALS.englishQuestions,
    ),
  ];
  const [conceptLane, mathLane, englishLane] = lanes;

  let nextAction;
  if (!conceptLane.complete && nextConcept) {
    const courseQuery = nextConcept.courseId
      ? `course=${encodeURIComponent(nextConcept.courseId)}&`
      : "";
    nextAction = {
      kind: "concept",
      eyebrow: "다음 학습",
      title: nextConcept.title,
      copy: `${nextConcept.unitLabel}에서 이어서 공부합니다.`,
      label: "다음 개념 시작",
      path: `/math/concepts?${courseQuery}unit=${encodeURIComponent(nextConcept.unitId)}&concept=${encodeURIComponent(nextConcept.id)}`,
    };
  } else if (!mathLane.complete) {
    nextAction = {
      kind: "math",
      eyebrow: "다음 학습",
      title: `수학 ${mathLane.remaining}문제`,
      copy: "풀이 중 입력 없이 5문항 학습으로 이어갑니다.",
      label: "수학 학습 시작",
      path: "/eng-math/practice?subject=math&mode=daily",
    };
  } else if (!englishLane.complete) {
    nextAction = {
      kind: "english",
      eyebrow: "다음 학습",
      title: `영어 ${englishLane.remaining}문제`,
      copy: "풀이를 마친 뒤 해설과 근거를 확인합니다.",
      label: "영어 학습 시작",
      path: "/eng-math/practice?subject=english&mode=daily",
    };
  } else {
    const reviewSubject =
      safeCount(mathSummary?.dueReviewCount) > 0 ? "math" : "english";
    nextAction = {
      kind: "complete",
      eyebrow: "이번 7일 완료",
      title: "개념 3개와 문제 10개를 채웠습니다.",
      copy: "이제 틀렸던 문항을 다시 풀어 기억을 굳힙니다.",
      label: "오답 복습 시작",
      path: `/eng-math/practice?subject=${reviewSubject}&mode=daily`,
    };
  }

  return {
    lanes,
    completedLaneCount: lanes.filter((item) => item.complete).length,
    complete: lanes.every((item) => item.complete),
    nextAction,
  };
}

export const engMathWeeklyOverviewConfig = Object.freeze({ ...WEEKLY_GOALS });
