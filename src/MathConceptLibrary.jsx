import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import katex from "katex";
import "katex/dist/katex.min.css";
import {
  MATH_CONCEPTS_BY_UNIT,
  MATH_COURSES,
  MATH_PROGRESS_CONCEPTS,
  MATH_UNITS_BY_COURSE,
  getMathConceptContext,
  getMathCourseConcepts,
} from "./mathCourseConcepts.js";
import { getCalculusQuestionsForConcept } from "./mathCalculusQuestionTags.js";
import {
  buildMathConceptWeeklyPlan,
  createScopedMathConceptProgressStorage,
  readMathConceptProgress,
  recordMathConceptCompletion,
  summarizeMathConceptProgress,
  writeMathConceptProgress,
} from "./mathConceptProgress.js";
import { syncMemberMathConceptProgress } from "./mathConceptProgressSync.js";
import { supabase } from "./supabase.js";

function Formula({ children, block = false }) {
  let html = String(children ?? "");
  try {
    html = katex.renderToString(html, {
      displayMode: block,
      throwOnError: false,
    });
  } catch {
    // 수식 하나가 잘못되어도 나머지 개념 설명은 계속 읽을 수 있다.
  }
  return (
    <span
      className={block ? "math-concept__formula-block" : "math-concept__formula"}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export default function MathConceptLibrary({ user = null }) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const userId = user?.id;
  const progressStorage = useMemo(
    () => createScopedMathConceptProgressStorage(userId),
    [userId],
  );
  const [progress, setProgress] = useState(() =>
    readMathConceptProgress(progressStorage),
  );
  const [syncStatus, setSyncStatus] = useState(user ? "syncing" : "local");
  const syncRequestIdRef = useRef(0);
  const {
    course: activeCourse,
    unit: activeUnit,
    concepts: activeConcepts,
    concept,
  } = getMathConceptContext(
    searchParams.get("concept"),
    searchParams.get("unit"),
    searchParams.get("course"),
  );
  const hasSelectedConcept = searchParams.has("concept");
  const [openCheckIndex, setOpenCheckIndex] = useState(null);
  const articleRef = useRef(null);
  const currentIndex = activeConcepts.findIndex(
    (candidate) => candidate.id === concept.id,
  );
  const previous = activeConcepts[currentIndex - 1] ?? null;
  const next = activeConcepts[currentIndex + 1] ?? null;
  const linkedQuestions = getCalculusQuestionsForConcept(concept.id);
  const conceptChecks = [concept.check, ...(concept.practice ?? [])];
  const activeCourseConcepts = getMathCourseConcepts(activeCourse.id);
  const progressSummary = summarizeMathConceptProgress(progress, activeCourseConcepts);
  const weeklyPlan = buildMathConceptWeeklyPlan(
    progress,
    activeCourseConcepts,
  );
  const completedConceptIds = new Set(progressSummary.completedIds);
  const isCurrentConceptComplete = completedConceptIds.has(concept.id);
  const syncCopy = !user
    ? "로그인하면 다른 기기에서도 이어볼 수 있습니다."
    : syncStatus === "synced"
      ? "회원 기록이 다른 기기와 동기화되었습니다."
      : syncStatus === "error"
        ? "현재 기기에 저장했습니다. 다음 접속이나 완료 때 다시 연결합니다."
        : "회원 기록을 연결하고 있습니다.";

  const syncMemberProgress = useCallback(
    async (nextProgress) => {
      if (!userId) return;
      const requestId = syncRequestIdRef.current + 1;
      syncRequestIdRef.current = requestId;
      setSyncStatus("syncing");
      try {
        const result = await syncMemberMathConceptProgress({
          supabase,
          authenticatedUserId: userId,
          progress: nextProgress,
          validConcepts: MATH_PROGRESS_CONCEPTS,
        });
        if (syncRequestIdRef.current !== requestId) return;
        setProgress(writeMathConceptProgress(result.progress, progressStorage));
        setSyncStatus("synced");
      } catch {
        if (syncRequestIdRef.current !== requestId) return;
        setSyncStatus("error");
      }
    },
    [progressStorage, userId],
  );

  useEffect(() => {
    const previousTitle = document.title;
    document.title = `${activeCourse.label} 개념 모음 | 지니쌤과 공부하자`;
    return () => {
      document.title = previousTitle;
    };
  }, [activeCourse.label]);

  useEffect(() => {
    if (hasSelectedConcept) {
      articleRef.current?.scrollIntoView({ block: "start", behavior: "auto" });
    }
  }, [concept.id, hasSelectedConcept]);

  useEffect(() => {
    const localProgress = readMathConceptProgress(progressStorage);
    let active = true;
    void Promise.resolve().then(() => {
      if (!active) return;
      setProgress(localProgress);
      if (!userId) {
        syncRequestIdRef.current += 1;
        setSyncStatus("local");
        return;
      }
      void syncMemberProgress(localProgress);
    });
    return () => {
      active = false;
      syncRequestIdRef.current += 1;
    };
  }, [progressStorage, syncMemberProgress, userId]);

  const selectConcept = (conceptId) => {
    setOpenCheckIndex(null);
    setSearchParams({
      course: activeCourse.id,
      unit: activeUnit.id,
      concept: conceptId,
    });
  };

  const selectUnit = (unitId) => {
    const concepts = MATH_CONCEPTS_BY_UNIT[unitId] ?? [];
    if (concepts.length === 0) return;
    setOpenCheckIndex(null);
    setSearchParams({
      course: activeCourse.id,
      unit: unitId,
      concept: concepts[0].id,
    });
  };

  const selectCourse = (courseId) => {
    const course = MATH_COURSES.find((item) => item.id === courseId);
    const unit = (MATH_UNITS_BY_COURSE[courseId] ?? []).find(
      (item) => item.status === "available",
    );
    const concepts = MATH_CONCEPTS_BY_UNIT[unit?.id] ?? [];
    if (course?.status !== "available" || !unit || concepts.length === 0) return;
    setOpenCheckIndex(null);
    setSearchParams({
      course: courseId,
      unit: unit.id,
      concept: concepts[0].id,
    });
  };

  const completeCurrentConcept = () => {
    if (isCurrentConceptComplete) return;
    const updatedProgress = recordMathConceptCompletion(
      { conceptId: concept.id, unitId: activeUnit.id },
      progressStorage,
    );
    setProgress(updatedProgress);
    void syncMemberProgress(updatedProgress);
  };

  const startRecommendedConcept = () => {
    if (!weeklyPlan.nextConcept) {
      navigate("/eng-math/practice?subject=math&mode=catalog");
      return;
    }
    setOpenCheckIndex(null);
    setSearchParams({
      course: weeklyPlan.nextConcept.courseId,
      unit: weeklyPlan.nextConcept.unitId,
      concept: weeklyPlan.nextConcept.id,
    });
  };

  return (
    <main className="math-concept">
      <style>{`
        .math-concept {
          --ink: #172a32;
          --green: #146b56;
          --green-dark: #0d4d3f;
          --paper: #f6faf8;
          --grid: #dcebe5;
          --amber: #e9ad4a;
          min-height: 100svh;
          padding: 24px 20px 64px;
          background:
            linear-gradient(rgba(20,107,86,.045) 1px, transparent 1px),
            linear-gradient(90deg, rgba(20,107,86,.045) 1px, transparent 1px),
            var(--paper);
          background-size: 32px 32px;
          color: var(--ink);
          font-family: "Noto Sans KR", system-ui, sans-serif;
        }
        .math-concept * { box-sizing: border-box; }
        .math-concept button, .math-concept a { font: inherit; }
        .math-concept__inner { width: min(100%, 1080px); margin: 0 auto; }
        .math-concept__topbar { display: flex; align-items: center; justify-content: space-between; gap: 14px; }
        .math-concept__brand, .math-concept__practice-link {
          border: 0; background: transparent; color: var(--green-dark); font-weight: 900; cursor: pointer;
        }
        .math-concept__brand { display: inline-flex; align-items: center; gap: 8px; padding: 5px 0; }
        .math-concept__brand::before { content: ""; width: 9px; height: 9px; border-radius: 50%; background: var(--green); }
        .math-concept__practice-link { border-bottom: 1px solid currentColor; padding: 5px 0 3px; font-size: .82rem; }
        .math-concept__hero { display: grid; grid-template-columns: minmax(0, 1fr) 360px; align-items: center; gap: 54px; padding: 68px 0 44px; }
        .math-concept__eyebrow { color: var(--green); font-size: .78rem; font-weight: 900; letter-spacing: .12em; }
        .math-concept__hero h1 { margin: 14px 0 16px; max-width: 660px; font-size: clamp(2.35rem, 7vw, 4.5rem); line-height: 1.08; letter-spacing: -.065em; word-break: keep-all; }
        .math-concept__hero p { max-width: 620px; margin: 0; color: #536970; font-size: 1rem; line-height: 1.75; word-break: keep-all; }
        .math-concept__convergence { position: relative; height: 155px; border-bottom: 2px solid #adcac0; }
        .math-concept__convergence::after { content: "→"; position: absolute; right: 0; bottom: -34px; color: var(--green-dark); font: 800 1rem ui-monospace, monospace; }
        .math-concept__dot { position: absolute; bottom: -8px; width: 15px; height: 15px; border: 3px solid var(--paper); border-radius: 50%; background: var(--green); box-shadow: 0 0 0 1px var(--green); }
        .math-concept__dot:nth-child(1) { left: 5%; bottom: 90px; }
        .math-concept__dot:nth-child(2) { left: 34%; bottom: 52px; }
        .math-concept__dot:nth-child(3) { left: 59%; bottom: 27px; }
        .math-concept__dot:nth-child(4) { left: 78%; bottom: 10px; }
        .math-concept__dot:nth-child(5) { left: 91%; bottom: -2px; background: var(--amber); box-shadow: 0 0 0 1px var(--amber); }
        .math-concept__dot span { position: absolute; top: -30px; left: 50%; transform: translateX(-50%); color: #547068; font: 700 .72rem ui-monospace, monospace; white-space: nowrap; }
        .math-concept__courses { display: grid; grid-template-columns: repeat(5,minmax(0,1fr)); gap: 9px; margin: 0 0 18px; }
        .math-concept__course { min-width: 0; min-height: 116px; border: 1px solid #cbded7; background: rgba(255,255,255,.86); padding: 15px; color: var(--ink); text-align: left; }
        .math-concept__course:not(:disabled) { cursor: pointer; }
        .math-concept__course:not(:disabled):hover { border-color: var(--green); background: #fff; }
        .math-concept__course--active { border-color: var(--green); background: #fff; box-shadow: inset 0 4px 0 var(--green); }
        .math-concept__course:disabled { color: #7b8985; cursor: default; }
        .math-concept__course-role { display: block; color: var(--green); font: 900 .64rem ui-monospace,monospace; letter-spacing: .08em; }
        .math-concept__course strong { display: block; margin-top: 8px; font-size: .93rem; }
        .math-concept__course p { overflow: hidden; margin: 6px 0 0; color: #63736f; font-size: .69rem; line-height: 1.45; text-overflow: ellipsis; white-space: nowrap; }
        .math-concept__course-state { display: block; margin-top: 10px; color: var(--green-dark); font-size: .67rem; font-weight: 900; }
        .math-concept__progress { display: grid; grid-template-columns: minmax(0,1fr) auto; align-items: center; gap: 24px; margin: 0 0 18px; border: 1px solid #c8ddd5; background: rgba(255,255,255,.9); padding: 18px 20px; }
        .math-concept__progress-copy strong { display: block; font-size: .95rem; }
        .math-concept__progress-copy span { display: block; margin-top: 5px; color: #62746f; font-size: .76rem; line-height: 1.5; }
        .math-concept__progress-numbers { display: flex; align-items: center; gap: 18px; }
        .math-concept__progress-number { min-width: 78px; border-left: 1px solid #d7e5e0; padding-left: 18px; }
        .math-concept__progress-number b { display: block; color: var(--green-dark); font: 900 1.18rem ui-monospace, monospace; }
        .math-concept__progress-number span { display: block; margin-top: 3px; color: #71817c; font-size: .68rem; font-weight: 800; }
        .math-concept__week { display: grid; grid-template-columns: 230px minmax(0,1fr) auto; align-items: center; gap: 24px; margin: 0 0 18px; background: var(--ink); padding: 22px 24px; color: #fff; }
        .math-concept__week-title span { color: #9fc7bb; font: 800 .68rem ui-monospace, monospace; letter-spacing: .08em; }
        .math-concept__week-title h2 { margin: 6px 0 0; font-size: 1.25rem; letter-spacing: -.035em; }
        .math-concept__week-title p { margin: 7px 0 0; color: #bed1cb; font-size: .74rem; line-height: 1.5; word-break: keep-all; }
        .math-concept__week-route { position: relative; display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 10px; }
        .math-concept__week-route::before { content: ""; position: absolute; top: 12px; left: 10%; right: 10%; height: 1px; background: #536a66; }
        .math-concept__week-stop { position: relative; min-width: 0; }
        .math-concept__week-dot { position: relative; z-index: 1; display: grid; place-items: center; width: 25px; height: 25px; border: 1px solid #6f8580; border-radius: 50%; background: var(--ink); color: #b9cac5; font: 900 .66rem ui-monospace, monospace; }
        .math-concept__week-stop--completed .math-concept__week-dot { border-color: #7fc1aa; background: #7fc1aa; color: var(--ink); }
        .math-concept__week-stop--next .math-concept__week-dot { border-color: var(--amber); background: var(--amber); color: var(--ink); }
        .math-concept__week-stop strong { display: block; overflow: hidden; margin-top: 9px; color: #eef6f3; font-size: .74rem; text-overflow: ellipsis; white-space: nowrap; }
        .math-concept__week-stop span { display: block; margin-top: 3px; color: #8fa69f; font-size: .64rem; }
        .math-concept__week-action { min-width: 146px; min-height: 48px; border: 1px solid var(--amber); background: var(--amber); padding: 0 16px; color: var(--ink); font-weight: 900; cursor: pointer; }
        .math-concept__units { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 11px; margin-bottom: 28px; }
        .math-concept__unit { position: relative; overflow: hidden; min-height: 126px; border: 1px solid #cfe0da; background: rgba(255,255,255,.84); padding: 18px; color: var(--ink); text-align: left; }
        .math-concept__unit--active { border-color: var(--green); box-shadow: inset 4px 0 0 var(--green); }
        .math-concept__unit:not(:disabled) { cursor: pointer; }
        .math-concept__unit:not(:disabled):hover { border-color: var(--green); background: #fff; }
        .math-concept__unit:disabled { color: #6f7b78; cursor: default; }
        .math-concept__unit strong { display: block; font-size: 1rem; }
        .math-concept__unit p { margin: 8px 0 0; color: #61736f; font-size: .78rem; line-height: 1.55; word-break: keep-all; }
        .math-concept__unit span { display: block; margin-top: 11px; color: var(--green); font-size: .72rem; font-weight: 900; }
        .math-concept__workspace { display: grid; grid-template-columns: 280px minmax(0, 1fr); gap: 18px; align-items: start; min-width: 0; }
        .math-concept__nav { position: sticky; top: 18px; border: 1px solid #cfe0da; background: rgba(255,255,255,.94); padding: 13px; }
        .math-concept__nav-heading { margin: 4px 6px 11px; color: #50635e; font-size: .74rem; font-weight: 900; }
        .math-concept__nav button { display: grid; grid-template-columns: 28px minmax(0,1fr) auto; align-items: center; gap: 9px; width: 100%; border: 0; background: transparent; padding: 11px 8px; color: #52655f; text-align: left; cursor: pointer; }
        .math-concept__nav button + button { border-top: 1px solid #e6efec; }
        .math-concept__nav button[aria-current="page"] { background: #e8f4ef; color: var(--green-dark); font-weight: 900; }
        .math-concept__nav-index { font: 800 .74rem ui-monospace, monospace; color: var(--green); }
        .math-concept__nav-complete { color: var(--green); font-size: .68rem; font-weight: 900; }
        .math-concept__article { min-width: 0; overflow-x: clip; border: 1px solid #cfe0da; background: #fff; box-shadow: 0 18px 45px rgba(23,42,50,.08); }
        .math-concept__article-header { padding: 34px 38px 30px; border-bottom: 1px solid #e2ece8; }
        .math-concept__article-kicker { color: var(--green); font: 800 .75rem ui-monospace, monospace; letter-spacing: .08em; }
        .math-concept__article h2 { margin: 11px 0 8px; font-size: clamp(1.75rem, 5vw, 2.65rem); letter-spacing: -.055em; }
        .math-concept__question { margin: 0; color: #5d706b; line-height: 1.6; word-break: keep-all; }
        .math-concept__body { display: grid; min-width: 0; gap: 30px; padding: 34px 38px 40px; }
        .math-concept__body > *, .math-concept__formula-list { min-width: 0; }
        .math-concept__section h3 { margin: 0 0 11px; color: #456159; font-size: .78rem; letter-spacing: .04em; }
        .math-concept__core { margin: 0; border-left: 4px solid var(--amber); padding: 3px 0 3px 17px; font-size: 1.12rem; font-weight: 800; line-height: 1.72; word-break: keep-all; }
        .math-concept__copy { margin: 0; color: #4f625d; line-height: 1.82; word-break: keep-all; }
        .math-concept__formula-list { display: grid; gap: 8px; }
        .math-concept__formula-block { display: block; max-width: 100%; overflow-x: auto; border: 1px solid #dbe8e3; background: #f7faf9; padding: 16px; text-align: center; }
        .math-concept__example { border: 1px solid #c9ddd5; background: #f4faf7; padding: 24px; }
        .math-concept__example-label { display: inline-block; margin-bottom: 14px; color: var(--green); font-size: .75rem; font-weight: 900; }
        .math-concept__example ol { margin: 18px 0 0; padding-left: 22px; color: #52645f; line-height: 1.7; }
        .math-concept__example li + li { margin-top: 8px; }
        .math-concept__answer { margin-top: 18px; color: var(--green-dark); font-weight: 900; }
        .math-concept__mistake { margin: 0; border: 1px solid #ead9bb; background: #fffaf0; padding: 18px; color: #6e5a37; line-height: 1.7; word-break: keep-all; }
        .math-concept__check { border-top: 2px solid var(--ink); padding-top: 22px; }
        .math-concept__check-heading { margin: 0 0 14px; }
        .math-concept__check-heading p { margin: 6px 0 0; color: #687b75; line-height: 1.6; }
        .math-concept__check-list { display: grid; gap: 12px; }
        .math-concept__check-item { box-sizing: border-box; width: 100%; min-width: 0; border: 1px solid #dbe7e2; background: #fbfdfc; padding: 16px; }
        .math-concept__check-top { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
        .math-concept__check-number { display: block; margin-bottom: 8px; color: var(--green); font-size: 12px; font-weight: 900; letter-spacing: .08em; }
        .math-concept__check button { min-height: 42px; border: 1px solid var(--green); background: #fff; padding: 0 14px; color: var(--green-dark); font-weight: 900; cursor: pointer; }
        .math-concept__check-answer { margin: 16px 0 0; border-left: 3px solid var(--green); padding-left: 14px; color: #536760; line-height: 1.65; }
        .math-concept__complete { display: grid; grid-template-columns: minmax(0,1fr) auto; align-items: center; gap: 20px; border: 1px solid #c7ddd4; background: #edf7f3; padding: 20px; }
        .math-concept__complete--done { border-color: var(--green); background: #e4f3ed; }
        .math-concept__complete strong { display: block; color: var(--green-dark); }
        .math-concept__complete p { margin: 6px 0 0; color: #5a6e67; font-size: .8rem; line-height: 1.55; word-break: keep-all; }
        .math-concept__complete button { min-height: 46px; border: 1px solid var(--green); background: var(--green); padding: 0 18px; color: #fff; font-weight: 900; cursor: pointer; white-space: nowrap; }
        .math-concept__complete button:disabled { border-color: #9fc6b7; background: #fff; color: var(--green-dark); cursor: default; }
        .math-concept__questions { border-top: 1px solid #dfeae6; padding-top: 28px; }
        .math-concept__questions-heading { display: flex; align-items: end; justify-content: space-between; gap: 18px; margin-bottom: 13px; }
        .math-concept__questions-heading h3 { margin: 0; color: var(--ink); font-size: 1.12rem; }
        .math-concept__questions-heading p { margin: 5px 0 0; color: #657772; font-size: .78rem; line-height: 1.55; word-break: keep-all; }
        .math-concept__questions-heading > span { flex: 0 0 auto; color: var(--green); font: 900 .72rem ui-monospace, monospace; }
        .math-concept__apply-flow { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); margin: 0 0 14px; border: 1px solid #d3e2dc; background: #f7fbf9; }
        .math-concept__apply-step { display: grid; grid-template-columns: 28px 1fr; gap: 9px; align-items: start; padding: 14px; }
        .math-concept__apply-step + .math-concept__apply-step { border-left: 1px solid #d3e2dc; }
        .math-concept__apply-step b { display: grid; place-items: center; width: 24px; height: 24px; border-radius: 50%; background: var(--green); color: #fff; font: 900 .7rem ui-monospace, monospace; }
        .math-concept__apply-step strong { display: block; font-size: .78rem; }
        .math-concept__apply-step span { display: block; margin-top: 3px; color: #64756f; font-size: .7rem; line-height: 1.45; word-break: keep-all; }
        .math-concept__question-list { display: grid; gap: 10px; }
        .math-concept__questions-empty { border: 1px dashed #b9d0c7; background: #f8fbfa; padding: 18px; color: #5c6f68; font-size: .8rem; line-height: 1.65; word-break: keep-all; }
        .math-concept__question-card { border: 1px solid #ccded7; background: #fbfdfc; padding: 17px 18px; color: var(--ink); }
        .math-concept__question-card-top { display: grid; grid-template-columns: minmax(0,1fr) auto; align-items: center; gap: 16px; }
        .math-concept__question-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 7px; margin-bottom: 7px; color: #536760; font-size: .76rem; font-weight: 800; }
        .math-concept__question-lock { border-radius: 999px; padding: 4px 8px; }
        .math-concept__question-lock { background: #edf0f2; color: #59676c; }
        .math-concept__question-before { margin: 0; color: #52655f; font-size: .82rem; line-height: 1.55; word-break: keep-all; }
        .math-concept__question-open { min-height: 40px; border: 1px solid var(--green); background: var(--green); padding: 0 13px; color: #fff; font-size: .76rem; font-weight: 900; cursor: pointer; white-space: nowrap; }
        .math-concept__question-review { margin-top: 14px; border-top: 1px dashed #c8dad3; padding-top: 12px; }
        .math-concept__question-review summary { color: var(--green-dark); font-size: .78rem; font-weight: 900; cursor: pointer; }
        .math-concept__question-review p { margin: 10px 0 0; border-left: 3px solid var(--amber); padding-left: 12px; color: #52655f; font-size: .86rem; line-height: 1.65; word-break: keep-all; }
        .math-concept__question-role { color: #7c6436; font-weight: 900; }
        .math-concept__footer-nav { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 10px; }
        .math-concept__footer-nav button { min-height: 54px; border: 1px solid #cbdcd6; background: #fff; padding: 10px 14px; color: var(--green-dark); font-weight: 900; cursor: pointer; }
        .math-concept__footer-nav button:last-child { background: var(--green); color: #fff; }
        .math-concept__footer-nav button:disabled { visibility: hidden; }
        .math-concept__exam-link { display: flex; align-items: center; justify-content: space-between; gap: 18px; border: 0; background: var(--ink); padding: 20px; color: #fff; text-align: left; cursor: pointer; }
        .math-concept__exam-link span { display: block; margin-top: 4px; color: #c8d7d2; font-size: .78rem; font-weight: 500; }
        .math-concept button:focus-visible { outline: 3px solid rgba(233,173,74,.7); outline-offset: 2px; }
        @media (max-width: 780px) {
          .math-concept { padding: 18px 14px 42px; }
          .math-concept__hero { grid-template-columns: 1fr; gap: 20px; padding: 48px 2px 34px; }
          .math-concept__convergence { height: 100px; }
          .math-concept__progress { grid-template-columns: 1fr; gap: 14px; }
          .math-concept__progress-numbers { justify-content: space-between; }
          .math-concept__progress-number { flex: 1; }
          .math-concept__courses { grid-template-columns: repeat(2,minmax(0,1fr)); }
          .math-concept__course { min-height: 104px; }
          .math-concept__course:last-child { grid-column: 1 / -1; }
          .math-concept__week { grid-template-columns: 1fr; gap: 18px; padding: 21px; }
          .math-concept__week-action { width: 100%; }
          .math-concept__units { grid-template-columns: 1fr; }
          .math-concept__unit { min-height: 0; }
          .math-concept__workspace { grid-template-columns: 1fr; }
          .math-concept__nav { position: static; display: flex; width: 100%; max-width: 100%; overflow-x: auto; gap: 7px; padding: 9px; }
          .math-concept__nav-heading { display: none; }
          .math-concept__nav button { flex: 0 0 auto; width: auto; grid-template-columns: 22px auto auto; border: 1px solid #dce7e3 !important; padding: 9px 11px; white-space: nowrap; }
          .math-concept__article-header, .math-concept__body { padding-left: 20px; padding-right: 20px; }
          .math-concept__questions-heading { align-items: start; }
          .math-concept__apply-flow { grid-template-columns: 1fr; }
          .math-concept__apply-step + .math-concept__apply-step { border-left: 0; border-top: 1px solid #d3e2dc; }
          .math-concept__question-card { padding: 15px; }
          .math-concept__question-card-top { grid-template-columns: 1fr; }
          .math-concept__question-open { width: 100%; }
          .math-concept__complete { grid-template-columns: 1fr; }
          .math-concept__complete button { width: 100%; }
        }
        @media (prefers-reduced-motion: reduce) {
          .math-concept * { scroll-behavior: auto !important; }
        }
      `}</style>

      <div className="math-concept__inner">
        <div className="math-concept__topbar">
          <button
            className="math-concept__brand"
            type="button"
            onClick={() => navigate("/eng-math-beta")}
          >
            지니쌤과 공부하자
          </button>
          <button
            className="math-concept__practice-link"
            type="button"
            onClick={() => navigate("/eng-math/practice?subject=math&mode=catalog")}
          >
            수학 문제 풀기
          </button>
        </div>

        <header className="math-concept__hero">
          <div>
            <span className="math-concept__eyebrow">CSAT MATH CONCEPT MAP</span>
            <h1>{activeCourse.heroTitle}</h1>
            <p>{activeCourse.heroCopy}</p>
          </div>
          <div
            className="math-concept__convergence"
            aria-label={`${activeCourse.label}의 변화 흐름`}
          >
            {activeCourse.heroMarks.map((label) => (
              <span className="math-concept__dot" key={label}>
                <span>{label}</span>
              </span>
            ))}
          </div>
        </header>

        <section className="math-concept__courses" aria-label="수능 수학 과목 선택">
          {MATH_COURSES.map((course) => (
            <button
              className={`math-concept__course ${course.id === activeCourse.id ? "math-concept__course--active" : ""}`}
              key={course.id}
              type="button"
              disabled={course.status !== "available"}
              aria-pressed={course.id === activeCourse.id}
              onClick={() => selectCourse(course.id)}
            >
              <span className="math-concept__course-role">{course.role}</span>
              <strong>{course.label}</strong>
              <p>{course.description}</p>
              <span className="math-concept__course-state">
                {course.status === "available"
                  ? `${course.availableConceptCount}개 학습 가능`
                  : `${course.unitCount}개 단원 준비 중`}
              </span>
            </button>
          ))}
        </section>

        <section
          className="math-concept__progress"
          aria-label={`${activeCourse.label} 개념 학습 진도`}
        >
          <div className="math-concept__progress-copy">
            <strong>{user ? "내 개념 학습 기록" : "이 기기의 개념 학습 기록"}</strong>
            <span>
              개념을 다 공부한 뒤 완료를 한 번만 표시합니다.
              {` ${syncCopy}`}
            </span>
          </div>
          <div className="math-concept__progress-numbers" aria-live="polite">
            <div className="math-concept__progress-number">
              <b>{progressSummary.recentCount}개</b>
              <span>최근 7일</span>
            </div>
            <div className="math-concept__progress-number">
              <b>{progressSummary.completedCount}/{progressSummary.totalCount}</b>
              <span>전체 완료</span>
            </div>
          </div>
        </section>

        <section className="math-concept__week" aria-label="최근 7일 개념 학습 계획">
          <div className="math-concept__week-title">
            <span>7-DAY ROUTE · {Math.min(weeklyPlan.recentCount, weeklyPlan.target)}/{weeklyPlan.target}</span>
            <h2>
              {weeklyPlan.targetMet
                ? "이번 목표를 채웠습니다."
                : `이번 7일은 ${weeklyPlan.remainingCount}개 남았습니다.`}
            </h2>
            <p>
              {weeklyPlan.targetMet
                ? `최근 7일 동안 ${weeklyPlan.recentCount}개를 완료했습니다.`
                : "처음부터 순서대로, 하루에 한 개씩 공부합니다."}
            </p>
          </div>
          <div className="math-concept__week-route" aria-label="추천 개념 3개">
            {weeklyPlan.items.map((item, index) => (
              <div
                className={`math-concept__week-stop math-concept__week-stop--${item.status}`}
                key={item.id}
              >
                <b className="math-concept__week-dot">
                  {item.status === "completed" ? "✓" : index + 1}
                </b>
                <strong>{item.title}</strong>
                <span>
                  {item.unitLabel} · {item.status === "completed" ? "완료" : item.status === "next" ? "다음" : "예정"}
                </span>
              </div>
            ))}
          </div>
          <button
            className="math-concept__week-action"
            type="button"
            onClick={startRecommendedConcept}
          >
            {weeklyPlan.nextConcept ? "다음 개념 시작" : "평가원 기출 풀기"}
          </button>
        </section>

        <section className="math-concept__units" aria-label={`${activeCourse.label} 단원`}>
          {(MATH_UNITS_BY_COURSE[activeCourse.id] ?? []).map((unit) => (
            <button
              className={`math-concept__unit ${unit.id === activeUnit.id ? "math-concept__unit--active" : ""}`}
              key={unit.id}
              type="button"
              disabled={unit.status !== "available"}
              aria-pressed={unit.id === activeUnit.id}
              onClick={() => selectUnit(unit.id)}
            >
              <strong>{unit.label}</strong>
              <p>{unit.description}</p>
              <span>
                {unit.status === "available"
                  ? `${progressSummary.completedByUnit[unit.id] ?? 0}/${unit.availableConceptCount}개 완료`
                  : unit.unitCountLabel ?? "개념 준비 중"}
              </span>
            </button>
          ))}
        </section>

        <div className="math-concept__workspace">
          <nav className="math-concept__nav" aria-label={`${activeUnit.label} 개념 목록`}>
            <p className="math-concept__nav-heading">{activeUnit.label} · 학습 순서</p>
            {activeConcepts.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-current={item.id === concept.id ? "page" : undefined}
                onClick={() => selectConcept(item.id)}
              >
                <span className="math-concept__nav-index">
                  {String(item.order).padStart(2, "0")}
                </span>
                <span>{item.title}</span>
                {completedConceptIds.has(item.id) ? (
                  <span className="math-concept__nav-complete" aria-label="학습 완료">완료</span>
                ) : null}
              </button>
            ))}
          </nav>

          <article className="math-concept__article" ref={articleRef}>
            <header className="math-concept__article-header">
              <span className="math-concept__article-kicker">
                {activeUnit.kicker} · {String(concept.order).padStart(2, "0")}
              </span>
              <h2>{concept.title}</h2>
              <p className="math-concept__question">{concept.question}</p>
            </header>

            <div className="math-concept__body">
              <section className="math-concept__section">
                <h3>한 줄 핵심</h3>
                <p className="math-concept__core">{concept.core}</p>
              </section>

              <section className="math-concept__section">
                <h3>뜻부터 이해하기</h3>
                <p className="math-concept__copy">{concept.intuition}</p>
              </section>

              <section className="math-concept__section">
                <h3>기억할 식</h3>
                <div className="math-concept__formula-list">
                  {concept.formulas.map((formula) => (
                    <Formula block key={formula}>{formula}</Formula>
                  ))}
                </div>
              </section>

              <section className="math-concept__example">
                <span className="math-concept__example-label">대표 예제</span>
                <Formula block>{concept.example.prompt}</Formula>
                <ol>
                  {concept.example.steps.map((step) => (
                    <li key={step}>
                      {step.includes("\\") ? <Formula>{step}</Formula> : step}
                    </li>
                  ))}
                </ol>
                <p className="math-concept__answer">
                  답 <Formula>{concept.example.answer}</Formula>
                </p>
              </section>

              <section className="math-concept__section">
                <h3>여기서 자주 틀립니다</h3>
                <p className="math-concept__mistake">{concept.mistake}</p>
              </section>

              <section className="math-concept__check">
                <div className="math-concept__check-heading">
                  <h3>직접 풀기 3문제</h3>
                  <p>풀이 입력 없이 문제를 푼 뒤, 필요한 문제의 정답만 확인합니다.</p>
                </div>
                <div className="math-concept__check-list">
                  {conceptChecks.map((check, index) => {
                    const isOpen = openCheckIndex === index;
                    return (
                      <div className="math-concept__check-item" key={check.prompt}>
                        <div className="math-concept__check-top">
                          <div>
                            <span className="math-concept__check-number">문제 {index + 1}</span>
                            <Formula>{check.prompt}</Formula>
                          </div>
                          <button
                            type="button"
                            aria-expanded={isOpen}
                            onClick={() => setOpenCheckIndex(isOpen ? null : index)}
                          >
                            {isOpen ? "정답 닫기" : "정답 보기"}
                          </button>
                        </div>
                        {isOpen ? (
                          <p className="math-concept__check-answer">
                            <strong><Formula>{check.answer}</Formula></strong>
                            <br />
                            {check.reason}
                          </p>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </section>

              <section
                className={`math-concept__complete ${isCurrentConceptComplete ? "math-concept__complete--done" : ""}`}
                aria-live="polite"
              >
                <div>
                  <strong>
                    {isCurrentConceptComplete
                      ? "이 개념 학습을 완료했습니다."
                      : "설명과 직접 풀기 3문제를 마쳤나요?"}
                  </strong>
                  <p>
                    {isCurrentConceptComplete
                      ? "단원 진도와 최근 7일 학습량에 반영되었습니다."
                      : "공부가 끝난 뒤에만 완료를 표시하면 실제 진도를 정확하게 볼 수 있습니다."}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={isCurrentConceptComplete}
                  onClick={completeCurrentConcept}
                >
                  {isCurrentConceptComplete ? "학습 완료됨" : "이 개념 학습 완료"}
                </button>
              </section>

              <section className="math-concept__questions">
                <div className="math-concept__questions-heading">
                  <div>
                    <h3>이 개념이 쓰인 평가원 기출</h3>
                    <p>풀이 전에는 힌트를 숨기고, 풀이를 마친 뒤에만 개념 연결을 확인합니다.</p>
                  </div>
                  <span>{linkedQuestions.length}문항</span>
                </div>
                <div className="math-concept__apply-flow" aria-label="개념 기출 학습 순서">
                  <div className="math-concept__apply-step">
                    <b>1</b>
                    <div><strong>개념 읽기</strong><span>핵심과 30초 확인까지 끝냅니다.</span></div>
                  </div>
                  <div className="math-concept__apply-step">
                    <b>2</b>
                    <div><strong>힌트 없이 풀기</strong><span>풀이 중에는 추가 입력을 요구하지 않습니다.</span></div>
                  </div>
                  <div className="math-concept__apply-step">
                    <b>3</b>
                    <div><strong>풀이 후 연결</strong><span>어디에 이 개념을 썼는지 확인합니다.</span></div>
                  </div>
                </div>
                {linkedQuestions.length > 0 ? (
                  <div className="math-concept__question-list">
                    {linkedQuestions.map((question) => (
                      <article
                        className="math-concept__question-card"
                        key={`${question.examKey}:${question.questionNumber}`}
                      >
                        <div className="math-concept__question-card-top">
                          <div>
                            <div className="math-concept__question-meta">
                              <span>{question.examLabel} · {question.trackLabel} {question.questionNumber}번</span>
                              <span className="math-concept__question-lock">잠금</span>
                            </div>
                            <p className="math-concept__question-before">연결 설명은 문제를 푼 다음 확인하세요.</p>
                          </div>
                          <button
                            className="math-concept__question-open"
                            type="button"
                            onClick={() => navigate(question.catalogPath)}
                          >
                            이 시험 목록 열기
                          </button>
                        </div>
                        <details className="math-concept__question-review">
                          <summary>풀이를 마친 뒤 연결 확인</summary>
                          <p><span className="math-concept__question-role">{question.role}</span> · {question.connection}</p>
                        </details>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="math-concept__questions-empty">
                    이 개념과 정확히 연결되는 평가원 문항을 검증하고 있습니다.
                    문제·정답·독립 풀이 확인이 끝나기 전에는 임의로 기출을 붙이지 않습니다.
                  </p>
                )}
              </section>

              <div className="math-concept__footer-nav">
                <button
                  type="button"
                  disabled={!previous}
                  onClick={() => previous && selectConcept(previous.id)}
                >
                  ← {previous?.title ?? "이전 개념"}
                </button>
                <button
                  type="button"
                  disabled={!next}
                  onClick={() => next && selectConcept(next.id)}
                >
                  {next?.title ?? "다음 개념"} →
                </button>
              </div>

              <button
                className="math-concept__exam-link"
                type="button"
                onClick={() =>
                  navigate(
                    `/eng-math/practice?subject=math&mode=catalog&exam=2022_06&track=${activeCourse.id === "calculus" ? "cal" : "common"}`,
                  )
                }
              >
                <strong>
                  {activeCourse.label} 전체 기출 목록 보기
                  <span>연도별 평가원 문항 묶음과 공개 상태를 확인합니다.</span>
                </strong>
                <strong aria-hidden="true">→</strong>
              </button>
            </div>
          </article>
        </div>
      </div>
    </main>
  );
}
