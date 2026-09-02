import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { engMathAuthUrl } from "./engMathAccess.js";
import { trackEngMathEvent } from "./engMathTracking.js";
import {
  createScopedLearningHistoryStorage,
  readLearningHistory,
  readWeeklyLearningSummary,
} from "./engMathLearningHistory.js";
import {
  combineLocalAndMemberSummary,
  syncMemberLearningHistory,
} from "./engMathLearningEventsSync.js";
import {
  buildMathConceptWeeklyPlan,
  createScopedMathConceptProgressStorage,
  readMathConceptProgress,
  summarizeMathConceptProgress,
  writeMathConceptProgress,
} from "./mathConceptProgress.js";
import { syncMemberMathConceptProgress } from "./mathConceptProgressSync.js";
import { MATH_PROGRESS_CONCEPTS } from "./mathCourseConcepts.js";
import { buildEngMathWeeklyOverview } from "./engMathWeeklyOverview.js";
import { supabase } from "./supabase.js";

const SUBJECTS = [
  {
    key: "english",
    eyebrow: "ENGLISH",
    title: "영어 문항 선택",
    description:
      "평가원 10개년 기출에서 무료 5문항을 풀고, 해설 완성 상태까지 구분된 시험별 묶음을 확인하세요.",
    detail: "무료 5문항 · 평가원 기출 잠금 863문항",
    accent: "#3157a5",
    tint: "#eef3ff",
  },
  {
    key: "math",
    eyebrow: "MATH",
    title: "수학 문항 선택",
    description:
      "2022학년도 6월 공통 첫 5문항을 무료로 풀고, 단계별 검증 풀이를 확인하세요.",
    detail: "무료 5문항 · 검증 잠금 501문항",
    accent: "#16705b",
    tint: "#eaf7f1",
  },
];

function readLocalWeeklyOverview(historyStorage, conceptStorage) {
  const conceptProgress = readMathConceptProgress(conceptStorage);
  const conceptSummary = summarizeMathConceptProgress(
    conceptProgress,
    MATH_PROGRESS_CONCEPTS,
  );
  const mathSummary = readWeeklyLearningSummary(
    "math",
    new Date(),
    historyStorage,
  );
  const englishSummary = readWeeklyLearningSummary(
    "english",
    new Date(),
    historyStorage,
  );
  const conceptPlan = buildMathConceptWeeklyPlan(
    conceptProgress,
    MATH_PROGRESS_CONCEPTS,
  );
  return {
    conceptProgress,
    conceptSummary,
    mathSummary,
    englishSummary,
    overview: buildEngMathWeeklyOverview({
      conceptSummary,
      mathSummary,
      englishSummary,
      nextConcept: conceptPlan.nextConcept,
    }),
  };
}

function useEngMathWeeklyOverview(user) {
  const historyStorage = useMemo(
    () => createScopedLearningHistoryStorage(user?.id),
    [user?.id],
  );
  const conceptStorage = useMemo(
    () => createScopedMathConceptProgressStorage(user?.id),
    [user?.id],
  );
  const local = useMemo(
    () => readLocalWeeklyOverview(historyStorage, conceptStorage),
    [conceptStorage, historyStorage],
  );
  const [syncedState, setSyncedState] = useState(null);

  useEffect(() => {
    if (!user?.id) return undefined;

    let active = true;
    void Promise.all([
      syncMemberLearningHistory({
        supabase,
        authenticatedUserId: user.id,
        history: readLearningHistory(historyStorage),
      }),
      syncMemberMathConceptProgress({
        supabase,
        authenticatedUserId: user.id,
          progress: local.conceptProgress,
          validConcepts: MATH_PROGRESS_CONCEPTS,
      }),
    ])
      .then(([learningResult, conceptResult]) => {
        if (!active) return;
        const mergedConceptProgress = writeMathConceptProgress(
          conceptResult.progress,
          conceptStorage,
        );
        const conceptPlan = buildMathConceptWeeklyPlan(
          mergedConceptProgress,
          MATH_PROGRESS_CONCEPTS,
        );
        setSyncedState({
          userId: user.id,
          status: "synced",
          overview: buildEngMathWeeklyOverview({
            conceptSummary: conceptResult.summary,
            mathSummary: combineLocalAndMemberSummary(
              local.mathSummary,
              learningResult.summaries.math,
            ),
            englishSummary: combineLocalAndMemberSummary(
              local.englishSummary,
              learningResult.summaries.english,
            ),
            nextConcept: conceptPlan.nextConcept,
          }),
        });
      })
      .catch(() => {
        if (active) {
          setSyncedState({
            userId: user.id,
            status: "error",
            overview: local.overview,
          });
        }
      });
    return () => {
      active = false;
    };
  }, [conceptStorage, historyStorage, local, user?.id]);

  if (!user?.id) return { status: "local", overview: local.overview };
  if (syncedState?.userId === user.id) return syncedState;
  return { status: "syncing", overview: local.overview };
}

export default function EngMathProductHome({ user, onLogout }) {
  const navigate = useNavigate();
  const weekly = useEngMathWeeklyOverview(user);
  const weeklyScope =
    weekly.status === "synced"
      ? "회원 기록 연결됨"
      : weekly.status === "syncing"
        ? "회원 기록 확인 중"
        : weekly.status === "error"
          ? "이 기기 기록 · 다음 접속 때 다시 연결"
          : "이 기기 기록";

  const handleLogin = () => {
    trackEngMathEvent("eng_math_login_start", {
      target: "product_home",
      path: "/eng-math-beta",
    });
    navigate(engMathAuthUrl("/eng-math-beta"));
  };

  return (
    <main className="eng-math-home">
      <style>{`
        .eng-math-home {
          min-height: 100svh;
          box-sizing: border-box;
          padding: 28px 20px 48px;
          background: linear-gradient(150deg, #f7f9ff 0%, #ffffff 48%, #f4fbf8 100%);
          color: #16213a;
          font-family: "Noto Sans KR", system-ui, sans-serif;
        }
        .eng-math-home * { box-sizing: border-box; }
        .eng-math-home__inner { max-width: 920px; margin: 0 auto; }
        .eng-math-home__topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
        }
        .eng-math-home__brand {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          color: #3157a5;
          font-size: 0.88rem;
          font-weight: 800;
          letter-spacing: -0.02em;
        }
        .eng-math-home__brand-dot {
          width: 9px;
          height: 9px;
          border-radius: 50%;
          background: #3157a5;
        }
        .eng-math-home__account {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 9px;
        }
        .eng-math-home__account-label {
          color: #667085;
          font-size: 0.78rem;
          font-weight: 700;
        }
        .eng-math-home__account-button {
          min-height: 38px;
          padding: 0 13px;
          border: 1px solid #cfd7e5;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.82);
          color: #3157a5;
          font: inherit;
          font-size: 0.8rem;
          font-weight: 800;
          cursor: pointer;
        }
        .eng-math-home__account-button:hover,
        .eng-math-home__account-button:focus-visible {
          border-color: #3157a5;
          outline: none;
        }
        .eng-math-home__hero {
          padding: 58px 0 34px;
          max-width: 650px;
        }
        .eng-math-home__eyebrow {
          display: inline-block;
          margin-bottom: 14px;
          padding: 7px 11px;
          border-radius: 999px;
          background: #e8edff;
          color: #3157a5;
          font-size: 0.78rem;
          font-weight: 800;
          letter-spacing: 0.03em;
        }
        .eng-math-home h1 {
          margin: 0;
          color: #16213a;
          font-size: clamp(2rem, 7vw, 3.9rem);
          line-height: 1.15;
          letter-spacing: -0.065em;
          font-weight: 900;
          word-break: keep-all;
        }
        .eng-math-home__lead {
          margin-top: 20px;
          color: #59677f;
          font-size: 1.05rem;
          line-height: 1.7;
          word-break: keep-all;
        }
        .eng-math-home__access-note {
          margin: 18px 0 0;
          padding: 13px 15px;
          border-left: 3px solid #a9b9d8;
          border-radius: 0 10px 10px 0;
          background: rgba(238, 243, 255, 0.68);
          color: #52617a;
          font-size: 0.84rem;
          line-height: 1.55;
          word-break: keep-all;
        }
        .eng-math-home__weekly {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 270px;
          gap: 24px;
          margin: 0 0 22px;
          padding: 25px;
          background: #18253d;
          color: #ffffff;
          box-shadow: 0 16px 34px rgba(24, 37, 61, 0.16);
        }
        .eng-math-home__weekly-head {
          display: flex;
          align-items: start;
          justify-content: space-between;
          gap: 18px;
          margin-bottom: 20px;
        }
        .eng-math-home__weekly-head h2 {
          margin: 0;
          font-size: 1.18rem;
          letter-spacing: -0.035em;
        }
        .eng-math-home__weekly-head p {
          margin: 6px 0 0;
          color: #b9c5d8;
          font-size: 0.76rem;
          line-height: 1.5;
          word-break: keep-all;
        }
        .eng-math-home__weekly-scope {
          flex: 0 0 auto;
          color: #93a9ce;
          font-size: 0.68rem;
          font-weight: 800;
        }
        .eng-math-home__weekly-lanes { display: grid; gap: 13px; }
        .eng-math-home__weekly-lane {
          display: grid;
          grid-template-columns: 92px minmax(0, 1fr) 64px;
          align-items: center;
          gap: 12px;
        }
        .eng-math-home__weekly-lane strong { font-size: 0.75rem; }
        .eng-math-home__weekly-track {
          height: 7px;
          overflow: hidden;
          background: #33445e;
        }
        .eng-math-home__weekly-fill {
          display: block;
          height: 100%;
          background: var(--weekly-lane-color);
          transition: width 180ms ease;
        }
        .eng-math-home__weekly-count {
          color: #d9e2ef;
          font: 800 0.72rem ui-monospace, monospace;
          text-align: right;
        }
        .eng-math-home__weekly-action {
          display: grid;
          align-content: center;
          min-width: 0;
          border-left: 1px solid #40516b;
          padding-left: 24px;
        }
        .eng-math-home__weekly-action > span {
          color: #e9ad4a;
          font: 900 0.66rem ui-monospace, monospace;
          letter-spacing: 0.08em;
        }
        .eng-math-home__weekly-action h3 {
          margin: 8px 0 0;
          font-size: 1.08rem;
          line-height: 1.35;
          letter-spacing: -0.035em;
          word-break: keep-all;
        }
        .eng-math-home__weekly-action p {
          margin: 7px 0 16px;
          color: #b8c5d7;
          font-size: 0.74rem;
          line-height: 1.55;
          word-break: keep-all;
        }
        .eng-math-home__weekly-button {
          min-height: 44px;
          border: 1px solid #e9ad4a;
          background: #e9ad4a;
          color: #18253d;
          font: inherit;
          font-size: 0.78rem;
          font-weight: 900;
          cursor: pointer;
        }
        .eng-math-home__weekly-button:focus-visible {
          outline: 3px solid rgba(255, 255, 255, 0.7);
          outline-offset: 2px;
        }
        .eng-math-home__subject-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 16px;
        }
        .eng-math-home__subject-card {
          width: 100%;
          min-height: 265px;
          padding: 25px;
          border: 1px solid #dfe5ef;
          border-radius: 22px;
          background: #ffffff;
          box-shadow: 0 12px 30px rgba(33, 54, 91, 0.08);
          text-align: left;
          cursor: pointer;
          transition: transform 160ms ease, box-shadow 160ms ease;
        }
        .eng-math-home__subject-card:hover,
        .eng-math-home__subject-card:focus-visible {
          transform: translateY(-3px);
          box-shadow: 0 16px 32px rgba(33, 54, 91, 0.14);
          outline: none;
        }
        .eng-math-home__subject-eyebrow {
          display: inline-flex;
          min-height: 30px;
          align-items: center;
          padding: 0 10px;
          border-radius: 999px;
          font-size: 0.74rem;
          font-weight: 900;
          letter-spacing: 0.08em;
        }
        .eng-math-home__subject-card h2 {
          margin: 25px 0 10px;
          color: #16213a;
          font-size: 1.45rem;
          line-height: 1.3;
          font-weight: 900;
          letter-spacing: -0.04em;
        }
        .eng-math-home__subject-card p {
          margin: 0;
          color: #5d6879;
          font-size: 0.93rem;
          line-height: 1.62;
          word-break: keep-all;
        }
        .eng-math-home__subject-action {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-top: 28px;
          color: #16213a;
          font-size: 0.9rem;
          font-weight: 800;
        }
        .eng-math-home__subject-action span:last-child { font-size: 1.18rem; }
        .eng-math-home__concept-link {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
          width: 100%;
          margin-top: 20px;
          padding: 23px 24px;
          border: 1px solid #b8d8cf;
          border-left: 5px solid #16705b;
          background: #ffffff;
          color: inherit;
          text-decoration: none;
          box-shadow: 0 10px 24px rgba(22, 112, 91, 0.07);
        }
        .eng-math-home__concept-link:hover,
        .eng-math-home__concept-link:focus-visible {
          border-color: #16705b;
          outline: 3px solid rgba(233, 173, 74, 0.5);
          outline-offset: 2px;
        }
        .eng-math-home__concept-badge {
          display: inline-flex;
          min-height: 27px;
          align-items: center;
          padding: 0 9px;
          background: #e6f4ef;
          color: #0f684f;
          font-size: 0.7rem;
          font-weight: 900;
          letter-spacing: 0.08em;
        }
        .eng-math-home__concept-title {
          display: block;
          margin-top: 9px;
          color: #16213a;
          font-size: 1.08rem;
          font-weight: 900;
        }
        .eng-math-home__concept-copy {
          display: block;
          margin-top: 5px;
          color: #5b6f69;
          font-size: 0.85rem;
          line-height: 1.5;
          word-break: keep-all;
        }
        .eng-math-home__concept-arrow { color: #16705b; font-size: 1.3rem; }
        .eng-math-home__lab-link {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
          width: 100%;
          margin-top: 20px;
          padding: 22px 24px;
          border: 1px solid #b8d8cf;
          border-radius: 18px;
          background: linear-gradient(135deg, #edf9f5 0%, #ffffff 100%);
          color: inherit;
          text-decoration: none;
          box-shadow: 0 10px 24px rgba(22, 112, 91, 0.08);
        }
        .eng-math-home__lab-link:hover,
        .eng-math-home__lab-link:focus-visible {
          border-color: #16705b;
          transform: translateY(-2px);
          outline: none;
        }
        .eng-math-home__lab-badge {
          display: inline-flex;
          min-height: 28px;
          align-items: center;
          padding: 0 9px;
          border-radius: 999px;
          background: #d9f1e9;
          color: #0f684f;
          font-size: 0.72rem;
          font-weight: 900;
          letter-spacing: 0.06em;
        }
        .eng-math-home__lab-title {
          display: block;
          margin-top: 9px;
          color: #16213a;
          font-size: 1.05rem;
          font-weight: 900;
        }
        .eng-math-home__lab-copy {
          display: block;
          margin-top: 5px;
          color: #5b6f69;
          font-size: 0.85rem;
          line-height: 1.5;
          word-break: keep-all;
        }
        .eng-math-home__lab-arrow { color: #16705b; font-size: 1.3rem; }
        .eng-math-home__korean-link {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          width: 100%;
          margin-top: 28px;
          padding: 20px 22px;
          border: 1px solid #dfe5ef;
          border-radius: 18px;
          background: rgba(255, 255, 255, 0.72);
          color: inherit;
          text-decoration: none;
        }
        .eng-math-home__korean-link:hover,
        .eng-math-home__korean-link:focus-visible {
          border-color: #9baecf;
          outline: none;
        }
        .eng-math-home__korean-title {
          display: block;
          color: #16213a;
          font-size: 0.98rem;
          font-weight: 900;
        }
        .eng-math-home__korean-copy {
          display: block;
          margin-top: 4px;
          color: #68758a;
          font-size: 0.84rem;
          line-height: 1.5;
          word-break: keep-all;
        }
        .eng-math-home__korean-arrow { color: #3157a5; font-size: 1.25rem; }
        @media (max-width: 560px) {
          .eng-math-home { padding: 22px 16px 36px; }
          .eng-math-home__topbar { align-items: flex-start; }
          .eng-math-home__account { flex-direction: column; align-items: flex-end; gap: 5px; }
          .eng-math-home__account-label { max-width: 120px; text-align: right; line-height: 1.35; }
          .eng-math-home__hero { padding: 42px 4px 28px; }
          .eng-math-home__weekly { grid-template-columns: 1fr; gap: 20px; padding: 21px 19px; }
          .eng-math-home__weekly-head { display: grid; gap: 6px; }
          .eng-math-home__weekly-lane { grid-template-columns: 78px minmax(0,1fr) 58px; gap: 9px; }
          .eng-math-home__weekly-action { border-top: 1px solid #40516b; border-left: 0; padding-top: 20px; padding-left: 0; }
          .eng-math-home__subject-grid { grid-template-columns: 1fr; }
          .eng-math-home__subject-card { min-height: 0; padding: 22px; }
          .eng-math-home__concept-link { align-items: flex-start; padding: 19px; }
          .eng-math-home__lab-link { align-items: flex-start; padding: 19px; }
          .eng-math-home__korean-link { align-items: flex-start; padding: 18px; }
        }
      `}</style>

      <div className="eng-math-home__inner">
        <div className="eng-math-home__topbar">
          <div className="eng-math-home__brand">
            <span className="eng-math-home__brand-dot" aria-hidden="true" />
            지니쌤과 공부하자
          </div>
          <div className="eng-math-home__account">
            {user && (
              <span className="eng-math-home__account-label">
                학습 계정 연결됨
              </span>
            )}
            <button
              className="eng-math-home__account-button"
              type="button"
              onClick={user ? onLogout : handleLogin}
            >
              {user ? "로그아웃" : "로그인"}
            </button>
          </div>
        </div>

        <section
          className="eng-math-home__hero"
          aria-labelledby="eng-math-home-title"
        >
          <span className="eng-math-home__eyebrow">
            영어·수학 내부 베타 · 문항 선택
          </span>
          <h1 id="eng-math-home-title">
            풀고 싶은 문항을 고르고, 다섯 문제를 끝까지 풀어보세요.
          </h1>
          <p className="eng-math-home__lead">
            영어와 수학은 과목별 5문항을 무료로 제공합니다. 나머지 문항은 결제
            없이 잠금 상태만 표시합니다.
          </p>
          <p className="eng-math-home__access-note">
            잠금 문항은 출시 알림만 신청할 수 있습니다. 로그인은 학습 계정
            연결용이며, 로그인만으로 잠금이 해제되지는 않습니다.
          </p>
        </section>

        <section
          className="eng-math-home__weekly"
          aria-label="영어 수학 최근 7일 학습표"
        >
          <div>
            <div className="eng-math-home__weekly-head">
              <div>
                <h2>이번 7일 학습표</h2>
                <p>개념을 먼저 익히고, 수학과 영어 5문항씩으로 확인합니다.</p>
              </div>
              <span className="eng-math-home__weekly-scope">
                {weeklyScope}
              </span>
            </div>
            <div className="eng-math-home__weekly-lanes">
              {weekly.overview.lanes.map((lane) => {
                const color =
                  lane.key === "concepts"
                    ? "#e9ad4a"
                    : lane.key === "math"
                      ? "#61b99e"
                      : "#86a7e8";
                return (
                  <div
                    className="eng-math-home__weekly-lane"
                    key={lane.key}
                    aria-label={`${lane.label} ${lane.completed}/${lane.target}`}
                    style={{ "--weekly-lane-color": color }}
                  >
                    <strong>{lane.label}</strong>
                    <span
                      className="eng-math-home__weekly-track"
                      aria-hidden="true"
                    >
                      <span
                        className="eng-math-home__weekly-fill"
                        style={{ width: `${lane.percent}%` }}
                      />
                    </span>
                    <span className="eng-math-home__weekly-count">
                      {Math.min(lane.completed, lane.target)}/{lane.target}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="eng-math-home__weekly-action">
            <span>{weekly.overview.nextAction.eyebrow}</span>
            <h3>{weekly.overview.nextAction.title}</h3>
            <p>{weekly.overview.nextAction.copy}</p>
            <button
              className="eng-math-home__weekly-button"
              type="button"
              onClick={() => navigate(weekly.overview.nextAction.path)}
            >
              {weekly.overview.nextAction.label}
            </button>
          </div>
        </section>

        <section className="eng-math-home__subject-grid" aria-label="과목 선택">
          {SUBJECTS.map((subject) => (
            <button
              key={subject.key}
              className="eng-math-home__subject-card"
              type="button"
              onClick={() =>
                navigate(
                  `/eng-math/practice?subject=${subject.key}&mode=catalog`,
                )
              }
            >
              <span
                className="eng-math-home__subject-eyebrow"
                style={{ background: subject.tint, color: subject.accent }}
              >
                {subject.eyebrow}
              </span>
              <h2>{subject.title}</h2>
              <p>{subject.description}</p>
              <span className="eng-math-home__subject-action">
                <span>{subject.detail}</span>
                <span aria-hidden="true">→</span>
              </span>
            </button>
          ))}
        </section>

        <a className="eng-math-home__concept-link" href="/math/concepts">
          <span>
            <span className="eng-math-home__concept-badge">NEW · 수능 수학</span>
            <span className="eng-math-home__concept-title">
              수능 수학 개념 모음
            </span>
            <span className="eng-math-home__concept-copy">
              수학Ⅰ·수학Ⅱ·확률과 통계·미적분·기하 72개 개념을
              뜻·공식·예제·직접 풀기 순서로 공부합니다.
            </span>
          </span>
          <span className="eng-math-home__concept-arrow" aria-hidden="true">
            →
          </span>
        </a>

        <a
          className="eng-math-home__lab-link"
          href="/eng-math-lab/military-2027/"
        >
          <span>
            <span className="eng-math-home__lab-badge">SEPARATE BETA</span>
            <span className="eng-math-home__lab-title">
              2027학년도 사관학교 수학 실전 베타
            </span>
            <span className="eng-math-home__lab-copy">
              46문항 원본 이미지와 공식 답안 대조 풀이를 별도 뷰어에서 확인합니다.
            </span>
          </span>
          <span className="eng-math-home__lab-arrow" aria-hidden="true">
            →
          </span>
        </a>

        <a className="eng-math-home__korean-link" href="/exams">
          <span>
            <span className="eng-math-home__korean-title">
              국어 대표 제품으로 돌아가기
            </span>
            <span className="eng-math-home__korean-copy">
              국어 선지와 지문 근거를 확인하는 독립 제품으로 이동합니다.
            </span>
          </span>
          <span className="eng-math-home__korean-arrow" aria-hidden="true">
            →
          </span>
        </a>
      </div>
    </main>
  );
}
