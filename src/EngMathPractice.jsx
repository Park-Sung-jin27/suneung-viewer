import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import katex from "katex";
import "katex/dist/katex.min.css";

const DATA_URLS = {
  english: "/data/eng-math/english-2026-csat-public.json",
  math: "/data/eng-math/math-full-no-figure-public.json",
};

const STARTER_IDS = {
  english: "2026_csat_19",
  math: "2022_06_common_1",
};

const SESSION_IDS = {
  english: [
    "2026_csat_19",
    "2026_csat_20",
    "2026_csat_21",
    "2026_csat_22",
    "2026_csat_23",
  ],
  math: [
    "2022_06_common_1",
    "2022_06_common_2",
    "2022_06_common_3",
    "2022_06_common_5",
    "2022_06_common_16",
  ],
};

const SUBJECTS = {
  english: {
    name: "영어",
    accent: "#3157a5",
    tint: "#eef3ff",
  },
  math: {
    name: "수학",
    accent: "#16705b",
    tint: "#eaf7f1",
  },
};

function normalizeShortAnswer(value) {
  const trimmed = String(value ?? "").trim();
  if (!/^\d+$/.test(trimmed)) return trimmed;
  return trimmed.replace(/^0+(?=\d)/, "");
}

function MathText({ text, className = "" }) {
  const parts = String(text ?? "").split(/(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$)/g);

  return (
    <span className={className}>
      {parts.map((part, index) => {
        const isBlock = part.startsWith("$$") && part.endsWith("$$");
        const isInline = !isBlock && part.startsWith("$") && part.endsWith("$");
        if (!isBlock && !isInline)
          return <span key={`${part}-${index}`}>{part}</span>;

        const expression = isBlock ? part.slice(2, -2) : part.slice(1, -1);
        let html = expression;
        try {
          html = katex.renderToString(expression, {
            displayMode: isBlock,
            throwOnError: false,
          });
        } catch {
          html = expression;
        }

        return (
          <span
            key={`${expression}-${index}`}
            className={
              isBlock
                ? "eng-math-practice__math-block"
                : "eng-math-practice__math-inline"
            }
            dangerouslySetInnerHTML={{ __html: html }}
          />
        );
      })}
    </span>
  );
}

function ChoiceLabel({ choice, subject }) {
  return (
    <>
      <strong>{choice.mark}</strong>
      {subject === "math" ? (
        <MathText text={choice.text} />
      ) : (
        <span>{choice.text}</span>
      )}
    </>
  );
}

function EnglishFigure({ figure }) {
  return (
    <figure
      className="eng-math-practice__figure"
      aria-labelledby="eng-math-practice-figure-title"
    >
      <a
        className="eng-math-practice__figure-link"
        href={figure.assetPath}
        target="_blank"
        rel="noreferrer"
        aria-label="영어 25번 원본 도표 크게 보기"
      >
        <img
          className="eng-math-practice__figure-image"
          src={figure.assetPath}
          alt={figure.alt}
        />
        <span className="eng-math-practice__figure-open">
          원본 도표 크게 보기
        </span>
      </a>

      <figcaption
        id="eng-math-practice-figure-title"
        className="eng-math-practice__figure-title"
      >
        {figure.title}
      </figcaption>

      <div className="eng-math-practice__figure-table-wrap">
        <table className="eng-math-practice__figure-table">
          <caption className="eng-math-practice__sr-only">
            영어 25번 도표 수치
          </caption>
          <colgroup>
            <col className="eng-math-practice__figure-label-column" />
            {figure.series.map((series) => (
              <col key={series.id} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th scope="col">Communication Type</th>
              {figure.series.map((series) => (
                <th key={series.id} scope="col">
                  {series.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {figure.categories.map((category) => (
              <tr key={category.id}>
                <th scope="row">{category.label}</th>
                {figure.series.map((series) => (
                  <td key={series.id}>
                    {series.values[category.id]}
                    {figure.unit}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="eng-math-practice__figure-notes">
        {figure.notes.map((note) => (
          <li key={note}>{note}</li>
        ))}
      </ul>
    </figure>
  );
}

function MathFigureDescription({ description }) {
  return (
    <aside
      className="eng-math-practice__math-figure-description"
      aria-label="그림 설명"
    >
      <h2>그림 설명</h2>
      <div className="eng-math-practice__math-figure-description-body">
        <MathText text={description} />
      </div>
    </aside>
  );
}

function usePublicQuestions(subject) {
  const [state, setState] = useState({
    subject: "",
    status: "loading",
    questions: [],
    error: "",
  });

  useEffect(() => {
    const controller = new AbortController();

    fetch(DATA_URLS[subject], { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("문항 데이터를 불러오지 못했습니다.");
        return response.json();
      })
      .then((data) => {
        if (!Array.isArray(data.questions))
          throw new Error("문항 데이터 형식이 올바르지 않습니다.");
        setState({
          subject,
          status: "ready",
          questions: data.questions,
          error: "",
        });
      })
      .catch((error) => {
        if (error.name === "AbortError") return;
        setState({
          subject,
          status: "error",
          questions: [],
          error: error.message,
        });
      });

    return () => controller.abort();
  }, [subject]);

  return state.subject === subject
    ? state
    : { status: "loading", questions: [], error: "" };
}

function getAnswerText(question, subject) {
  if (subject === "math" && question.responseType === "short")
    return question.answer;
  return (
    question.choices.find((choice) => choice.number === question.answer)
      ?.text ?? ""
  );
}

function getAnswerMark(question, subject) {
  if (subject === "math" && question.responseType === "short") return "정답";
  return (
    question.choices.find((choice) => choice.number === question.answer)
      ?.mark ?? "정답"
  );
}

function ResultAnswer({ question, subject }) {
  const answerText = getAnswerText(question, subject);
  const answerMark = getAnswerMark(question, subject);

  return (
    <p className="eng-math-practice__result-copy">
      {subject === "math" && question.responseType === "short"
        ? "정답은 "
        : `정답은 ${answerMark} `}
      {subject === "math" ? <MathText text={answerText} /> : answerText}입니다.
    </p>
  );
}

export default function EngMathPractice() {
  const navigate = useNavigate();
  const location = useLocation();
  const parameters = new URLSearchParams(location.search);
  const subject = parameters.get("subject") === "math" ? "math" : "english";
  const isSessionMode = parameters.get("mode") === "session";
  const questionId = parameters.get("id");
  const { status, questions, error } = usePublicQuestions(subject);
  const question = useMemo(
    () => questions.find((candidate) => candidate.id === questionId) ?? null,
    [questionId, questions],
  );
  const sessionQuestions = useMemo(() => {
    if (!isSessionMode) return [];
    const questionsById = new Map(
      questions.map((candidate) => [candidate.id, candidate]),
    );
    return SESSION_IDS[subject]
      .map((id) => questionsById.get(id))
      .filter(Boolean);
  }, [isSessionMode, questions, subject]);

  const chooseSubject = (nextSubject) => {
    const nextUrl = isSessionMode
      ? `/eng-math/practice?subject=${nextSubject}&mode=session`
      : `/eng-math/practice?subject=${nextSubject}&id=${STARTER_IDS[nextSubject]}`;
    navigate(nextUrl);
  };

  if (status === "loading") {
    return <PracticeNotice message="문항을 준비하고 있습니다." />;
  }

  if (status === "error") {
    return (
      <PracticeNotice
        message={error}
        onBack={() => navigate("/eng-math-beta")}
      />
    );
  }

  if (isSessionMode) {
    if (sessionQuestions.length !== SESSION_IDS[subject].length) {
      return (
        <PracticeNotice
          message="5문항 학습 구성을 확인하지 못했습니다."
          onBack={() => navigate("/eng-math-beta")}
        />
      );
    }

    return (
      <LearningSession
        key={subject}
        questions={sessionQuestions}
        subject={subject}
        navigate={navigate}
        onSubjectChange={chooseSubject}
      />
    );
  }

  if (!question) {
    return (
      <PracticeNotice
        message="요청한 문항을 찾지 못했습니다."
        onBack={() => chooseSubject(subject)}
      />
    );
  }

  return (
    <PracticeQuestion
      key={`${subject}-${question.id}`}
      question={question}
      subject={subject}
      navigate={navigate}
      onSubjectChange={chooseSubject}
    />
  );
}

function PracticeNotice({ message, onBack }) {
  return (
    <main className="eng-math-practice eng-math-practice--notice">
      <style>{`
        .eng-math-practice--notice { width: 100%; min-height: 100svh; display: grid; place-items: center; box-sizing: border-box; overflow-x: hidden; padding: 24px; background: #f8fafc; font-family: "Noto Sans KR", system-ui, sans-serif; }
        .eng-math-practice--notice * { box-sizing: border-box; }
        .eng-math-practice__notice { width: min(100%, 390px); border: 1px solid #dce3ed; border-radius: 18px; background: #fff; padding: 26px; text-align: center; box-shadow: 0 14px 40px rgba(24,39,75,.08); }
        .eng-math-practice__notice p { margin: 0; color: #40506a; line-height: 1.6; }
        .eng-math-practice__notice button { margin-top: 16px; border: 0; border-radius: 10px; background: #3157a5; padding: 11px 14px; color: #fff; font: inherit; font-weight: 800; cursor: pointer; }
      `}</style>
      <div className="eng-math-practice__notice">
        <p>{message}</p>
        {onBack ? (
          <button type="button" onClick={onBack}>
            체험으로 돌아가기
          </button>
        ) : null}
      </div>
    </main>
  );
}

function LearningSession({
  questions,
  subject,
  navigate,
  onSubjectChange,
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [results, setResults] = useState([]);
  const [finished, setFinished] = useState(false);
  const question = questions[currentIndex];

  const recordAnswer = (result) => {
    setResults((current) => {
      const next = [...current];
      next[currentIndex] = result;
      return next;
    });
  };

  const moveForward = () => {
    if (currentIndex === questions.length - 1) {
      setFinished(true);
      return;
    }
    setCurrentIndex((current) => current + 1);
  };

  const restartSession = () => {
    setCurrentIndex(0);
    setResults([]);
    setFinished(false);
  };

  if (finished) {
    return (
      <SessionSummary
        subject={subject}
        results={results}
        navigate={navigate}
        onRestart={restartSession}
        onSubjectChange={onSubjectChange}
      />
    );
  }

  return (
    <PracticeQuestion
      key={question.id}
      question={question}
      subject={subject}
      navigate={navigate}
      onSubjectChange={onSubjectChange}
      session={{
        current: currentIndex + 1,
        total: questions.length,
        isLast: currentIndex === questions.length - 1,
        onAnswer: recordAnswer,
        onNext: moveForward,
      }}
    />
  );
}

function SessionSummary({
  subject,
  results,
  navigate,
  onRestart,
  onSubjectChange,
}) {
  const profile = SUBJECTS[subject];
  const correctCount = results.filter((result) => result.isCorrect).length;
  const otherSubject = subject === "english" ? "math" : "english";

  return (
    <main className="eng-math-session-summary">
      <style>{`
        .eng-math-session-summary {
          min-height: 100svh;
          box-sizing: border-box;
          padding: 24px 20px 48px;
          background: #f8fafc;
          color: #172033;
          font-family: "Noto Sans KR", system-ui, sans-serif;
        }
        .eng-math-session-summary * { box-sizing: border-box; }
        .eng-math-session-summary__inner { width: min(100%, 680px); margin: 0 auto; }
        .eng-math-session-summary__brand {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 18px;
          border: 0;
          background: transparent;
          padding: 4px 0;
          color: #3157a5;
          font: inherit;
          font-size: 0.84rem;
          font-weight: 800;
          cursor: pointer;
        }
        .eng-math-session-summary__brand-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: currentColor;
        }
        .eng-math-session-summary__card {
          overflow: hidden;
          border: 1px solid #e0e6ef;
          border-radius: 24px;
          background: #fff;
          box-shadow: 0 16px 42px rgba(24, 39, 75, 0.08);
        }
        .eng-math-session-summary__band { height: 7px; }
        .eng-math-session-summary__content { padding: 32px; }
        .eng-math-session-summary__eyebrow {
          display: inline-flex;
          min-height: 28px;
          align-items: center;
          padding: 5px 9px;
          border-radius: 999px;
          font-size: 0.75rem;
          font-weight: 900;
        }
        .eng-math-session-summary h1 {
          margin: 16px 0 10px;
          color: #172033;
          font-size: clamp(1.65rem, 6vw, 2.35rem);
          line-height: 1.3;
          letter-spacing: -0.05em;
          word-break: keep-all;
        }
        .eng-math-session-summary__lead {
          margin: 0;
          color: #627087;
          line-height: 1.65;
          word-break: keep-all;
        }
        .eng-math-session-summary__score {
          display: flex;
          align-items: baseline;
          gap: 8px;
          margin: 25px 0 18px;
          border-radius: 18px;
          background: #f6f8fb;
          padding: 20px;
        }
        .eng-math-session-summary__score strong {
          color: #172033;
          font-size: 2.15rem;
          line-height: 1;
        }
        .eng-math-session-summary__score span {
          color: #667085;
          font-size: 0.9rem;
          font-weight: 800;
        }
        .eng-math-session-summary__list {
          display: grid;
          gap: 9px;
          margin: 0;
          padding: 0;
          list-style: none;
        }
        .eng-math-session-summary__item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          min-height: 50px;
          border: 1px solid #e0e6ef;
          border-radius: 13px;
          padding: 11px 13px;
          color: #435168;
          font-size: 0.86rem;
          font-weight: 700;
        }
        .eng-math-session-summary__item span:last-child { flex: 0 0 auto; font-weight: 900; }
        .eng-math-session-summary__item--correct span:last-child { color: #16705b; }
        .eng-math-session-summary__item--wrong span:last-child { color: #b23d4a; }
        .eng-math-session-summary__note {
          margin: 18px 0 0;
          border-left: 3px solid;
          padding: 3px 0 3px 12px;
          color: #657187;
          font-size: 0.84rem;
          line-height: 1.58;
          word-break: keep-all;
        }
        .eng-math-session-summary__actions {
          display: grid;
          gap: 9px;
          margin-top: 24px;
        }
        .eng-math-session-summary__actions button {
          width: 100%;
          min-height: 52px;
          border-radius: 14px;
          font: inherit;
          font-size: 0.94rem;
          font-weight: 900;
          cursor: pointer;
        }
        .eng-math-session-summary__primary { border: 0; color: #fff; }
        .eng-math-session-summary__secondary { border: 1px solid #cbd5e1; background: #fff; color: #3e4d61; }
        .eng-math-session-summary__home { border: 0; background: transparent; color: #667085; }
        @media (max-width: 440px) {
          .eng-math-session-summary { padding: 16px 14px 32px; }
          .eng-math-session-summary__content { padding: 24px 18px; }
          .eng-math-session-summary h1 { font-size: 1.6rem; }
        }
      `}</style>

      <div className="eng-math-session-summary__inner">
        <button
          className="eng-math-session-summary__brand"
          type="button"
          onClick={() => navigate("/eng-math-beta")}
        >
          <span
            className="eng-math-session-summary__brand-dot"
            aria-hidden="true"
          />
          지니쌤과 공부하자
        </button>

        <article className="eng-math-session-summary__card" aria-live="polite">
          <div
            className="eng-math-session-summary__band"
            style={{ background: profile.accent }}
          />
          <div className="eng-math-session-summary__content">
            <span
              className="eng-math-session-summary__eyebrow"
              style={{ background: profile.tint, color: profile.accent }}
            >
              {profile.name} · 5 / 5 완료
            </span>
            <h1>다섯 문제를 모두 풀었습니다.</h1>
            <p className="eng-math-session-summary__lead">
              이번 학습에서 맞힌 문제와 다시 확인할 문제를 구분했습니다.
            </p>

            <div className="eng-math-session-summary__score">
              <strong>
                {correctCount} / {results.length}
              </strong>
              <span>정답</span>
            </div>

            <ol
              className="eng-math-session-summary__list"
              aria-label="문항별 결과"
            >
              {results.map((result, index) => (
                <li
                  key={result.questionId}
                  className={`eng-math-session-summary__item ${result.isCorrect ? "eng-math-session-summary__item--correct" : "eng-math-session-summary__item--wrong"}`}
                >
                  <span>
                    {index + 1}. {result.label}
                  </span>
                  <span>{result.isCorrect ? "정답" : "다시 확인"}</span>
                </li>
              ))}
            </ol>

            <p
              className="eng-math-session-summary__note"
              style={{ borderColor: profile.accent }}
            >
              {subject === "english"
                ? "영어 풀이는 각 문항을 제출한 직후 확인할 수 있습니다."
                : "수학은 검증된 정답만 제공하며, 풀이는 아직 제공하지 않습니다."}
            </p>

            <div className="eng-math-session-summary__actions">
              <button
                className="eng-math-session-summary__primary"
                type="button"
                style={{ background: profile.accent }}
                onClick={onRestart}
              >
                같은 과목 5문항 다시 풀기
              </button>
              <button
                className="eng-math-session-summary__secondary"
                type="button"
                onClick={() => onSubjectChange(otherSubject)}
              >
                {SUBJECTS[otherSubject].name} 5문항 풀기
              </button>
              <button
                className="eng-math-session-summary__home"
                type="button"
                onClick={() => navigate("/eng-math-beta")}
              >
                베타 처음으로
              </button>
            </div>
          </div>
        </article>
      </div>
    </main>
  );
}

function PracticeQuestion({
  question,
  subject,
  navigate,
  onSubjectChange,
  session = null,
}) {
  const profile = SUBJECTS[subject];
  const isShortAnswer = subject === "math" && question.responseType === "short";
  const [selectedChoice, setSelectedChoice] = useState(null);
  const [shortAnswer, setShortAnswer] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const currentAnswer = isShortAnswer
    ? normalizeShortAnswer(shortAnswer)
    : selectedChoice;
  const isReadyToSubmit = isShortAnswer
    ? /^\d+$/.test(currentAnswer)
    : currentAnswer !== null;
  const isCorrect = isShortAnswer
    ? currentAnswer === normalizeShortAnswer(question.answer)
    : selectedChoice === question.answer;

  const restart = () => {
    setSelectedChoice(null);
    setShortAnswer("");
    setSubmitted(false);
    setShowExplanation(false);
  };

  const selectChoice = (number) => {
    if (!submitted) setSelectedChoice(number);
  };

  const submitAnswer = () => {
    if (!isReadyToSubmit || submitted) return;
    setSubmitted(true);
    if (session) {
      session.onAnswer({
        questionId: question.id,
        label: question.label,
        isCorrect,
      });
    }
  };

  return (
    <main className="eng-math-practice">
      <style>{`
        .eng-math-practice {
          min-height: 100svh;
          box-sizing: border-box;
          padding: 24px 20px 48px;
          background: #f8fafc;
          color: #172033;
          font-family: "Noto Sans KR", system-ui, sans-serif;
        }
        .eng-math-practice * { box-sizing: border-box; }
        .eng-math-practice__inner { width: min(100%, 800px); margin: 0 auto; }
        .eng-math-practice__topline {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 18px;
        }
        .eng-math-practice__brand {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          border: 0;
          background: transparent;
          padding: 4px 0;
          color: #3157a5;
          font: inherit;
          font-size: 0.84rem;
          font-weight: 800;
          cursor: pointer;
        }
        .eng-math-practice__brand-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: currentColor;
        }
        .eng-math-practice__subject-switcher { display: flex; gap: 6px; }
        .eng-math-practice__subject-switcher button {
          border: 1px solid #d7deea;
          border-radius: 999px;
          background: #fff;
          padding: 7px 10px;
          color: #536074;
          font: inherit;
          font-size: 0.76rem;
          font-weight: 800;
          cursor: pointer;
        }
        .eng-math-practice__subject-switcher button[aria-current="page"] { border-color: currentColor; }
        .eng-math-practice__card {
          overflow: hidden;
          border: 1px solid #e0e6ef;
          border-radius: 24px;
          background: #fff;
          box-shadow: 0 16px 42px rgba(24, 39, 75, 0.08);
        }
        .eng-math-practice__subject-band { height: 7px; }
        .eng-math-practice__content { padding: 30px; }
        .eng-math-practice__progress {
          margin-bottom: 18px;
          border-bottom: 1px solid #edf0f5;
          padding-bottom: 17px;
        }
        .eng-math-practice__progress-copy {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 9px;
          color: #667085;
          font-size: 0.78rem;
          font-weight: 800;
        }
        .eng-math-practice__progress-copy strong { color: #344054; }
        .eng-math-practice__progress-track {
          overflow: hidden;
          height: 7px;
          border-radius: 999px;
          background: #edf1f6;
        }
        .eng-math-practice__progress-value {
          display: block;
          height: 100%;
          border-radius: inherit;
          transition: width 180ms ease;
        }
        .eng-math-practice__eyebrow {
          display: inline-flex;
          align-items: center;
          min-height: 28px;
          padding: 5px 9px;
          border-radius: 999px;
          font-size: 0.75rem;
          font-weight: 800;
          letter-spacing: -0.01em;
        }
        .eng-math-practice__heading {
          margin: 16px 0 9px;
          color: #172033;
          font-size: clamp(1.3rem, 4.8vw, 1.9rem);
          line-height: 1.38;
          letter-spacing: -0.045em;
          word-break: keep-all;
        }
        .eng-math-practice__label { margin: 0; color: #758196; font-size: 0.83rem; font-weight: 700; }
        .eng-math-practice__passage {
          margin: 24px 0 20px;
          border-left: 4px solid #cbd5e1;
          padding: 2px 0 2px 17px;
          color: #3f4b5d;
          font-family: Georgia, "Times New Roman", serif;
          font-size: 1rem;
          line-height: 1.82;
          white-space: pre-wrap;
        }
        .eng-math-practice__figure {
          margin: 23px 0 0;
          border: 1px solid #d9e1ee;
          border-radius: 18px;
          background: #f8fafc;
          padding: 14px;
        }
        .eng-math-practice__figure-link {
          position: relative;
          display: block;
          overflow: hidden;
          border: 1px solid #cfd8e6;
          border-radius: 12px;
          background: #fff;
          color: inherit;
          text-decoration: none;
        }
        .eng-math-practice__figure-image {
          display: block;
          width: 100%;
          height: auto;
          background: #fff;
        }
        .eng-math-practice__figure-open {
          position: absolute;
          right: 8px;
          bottom: 8px;
          border-radius: 999px;
          background: rgba(23, 32, 51, 0.88);
          padding: 6px 9px;
          color: #fff;
          font-size: 0.7rem;
          font-weight: 800;
        }
        .eng-math-practice__figure-title {
          margin-top: 10px;
          color: #42506a;
          font-family: Georgia, "Times New Roman", serif;
          font-size: 0.82rem;
          font-weight: 700;
          line-height: 1.45;
        }
        .eng-math-practice__figure-table-wrap {
          overflow: hidden;
          margin-top: 12px;
          border: 1px solid #dbe3ef;
          border-radius: 10px;
          background: #fff;
        }
        .eng-math-practice__figure-table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
          color: #334155;
          font-size: 0.76rem;
          line-height: 1.35;
        }
        .eng-math-practice__figure-label-column { width: 44%; }
        .eng-math-practice__figure-table th,
        .eng-math-practice__figure-table td {
          border-bottom: 1px solid #e8edf4;
          border-left: 1px solid #e8edf4;
          padding: 8px 6px;
          overflow-wrap: anywhere;
          text-align: center;
          vertical-align: middle;
        }
        .eng-math-practice__figure-table th:first-child,
        .eng-math-practice__figure-table td:first-child { border-left: 0; }
        .eng-math-practice__figure-table thead th {
          background: #eef3ff;
          color: #29447e;
          font-size: 0.7rem;
          font-weight: 900;
        }
        .eng-math-practice__figure-table tbody th {
          background: #fbfcfe;
          color: #445168;
          font-weight: 800;
          text-align: left;
        }
        .eng-math-practice__figure-table tbody td { font-weight: 900; }
        .eng-math-practice__figure-table tbody tr:last-child th,
        .eng-math-practice__figure-table tbody tr:last-child td { border-bottom: 0; }
        .eng-math-practice__figure-notes {
          margin: 10px 0 0;
          padding-left: 18px;
          color: #67748a;
          font-size: 0.73rem;
          line-height: 1.5;
        }
        .eng-math-practice__sr-only {
          position: absolute;
          width: 1px;
          height: 1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          clip-path: inset(50%);
        }
        .eng-math-practice__math-prompt {
          margin: 25px 0 24px;
          border-radius: 16px;
          background: #f8fafc;
          padding: 19px 18px;
          color: #172033;
          font-size: 1.08rem;
          font-weight: 700;
          line-height: 1.85;
          white-space: pre-wrap;
        }
        .eng-math-practice__math-figure-description {
          margin: -4px 0 24px;
          border: 1px solid #c7e3d7;
          border-radius: 16px;
          background: #f1faf5;
          padding: 16px;
          color: #25483b;
        }
        .eng-math-practice__math-figure-description h2 {
          margin: 0 0 8px;
          color: #16705b;
          font-size: 0.88rem;
          font-weight: 900;
          letter-spacing: -0.02em;
        }
        .eng-math-practice__math-figure-description-body {
          display: block;
          min-width: 0;
          line-height: 1.72;
          overflow-wrap: anywhere;
          white-space: pre-wrap;
          word-break: keep-all;
        }
        .eng-math-practice__math-figure-description .eng-math-practice__math-block { text-align: left; }
        .eng-math-practice__math-inline { display: inline; }
        .eng-math-practice__math-block { display: block; overflow-x: auto; padding: 8px 0; text-align: center; }
        .eng-math-practice .katex { font-size: 1.05em; }
        .eng-math-practice__choices { display: grid; gap: 10px; }
        .eng-math-practice__choice {
          display: grid;
          grid-template-columns: 28px minmax(0, 1fr);
          align-items: center;
          gap: 10px;
          width: 100%;
          min-height: 57px;
          border: 1px solid #dce3ed;
          border-radius: 14px;
          background: #fff;
          padding: 13px 15px;
          color: #273449;
          text-align: left;
          font: inherit;
          font-size: 0.96rem;
          line-height: 1.48;
          cursor: pointer;
          transition: border-color 140ms ease, background 140ms ease, transform 140ms ease;
        }
        .eng-math-practice__choice:hover:not(:disabled) { transform: translateY(-1px); border-color: #9aabc6; }
        .eng-math-practice__choice strong { color: #61708a; }
        .eng-math-practice__choice--selected { border-width: 2px; background: #f6f8ff; }
        .eng-math-practice__choice--correct { border-color: #1f8a59; background: #effaf4; color: #135d3a; }
        .eng-math-practice__choice--wrong { border-color: #ca5460; background: #fff5f6; color: #8b2731; }
        .eng-math-practice__choice:disabled { cursor: default; }
        .eng-math-practice__short-answer { margin-top: 5px; }
        .eng-math-practice__short-answer label { display: block; margin-bottom: 9px; color: #536074; font-size: 0.84rem; font-weight: 800; }
        .eng-math-practice__short-answer input {
          width: 100%;
          border: 1px solid #cfd8e6;
          border-radius: 14px;
          padding: 15px 16px;
          color: #172033;
          background: #fff;
          font: inherit;
          font-size: 1.08rem;
          font-weight: 800;
          outline: none;
        }
        .eng-math-practice__short-answer input:focus { border-color: #16705b; box-shadow: 0 0 0 3px rgba(22,112,91,0.13); }
        .eng-math-practice__short-answer input:disabled { background: #f4f6f8; color: #667085; }
        .eng-math-practice__submit,
        .eng-math-practice__restart,
        .eng-math-practice__review-toggle,
        .eng-math-practice__next {
          width: 100%;
          min-height: 53px;
          border: 0;
          border-radius: 14px;
          font: inherit;
          font-size: 0.98rem;
          font-weight: 900;
          cursor: pointer;
        }
        .eng-math-practice__submit { margin-top: 22px; color: #fff; }
        .eng-math-practice__submit:disabled { cursor: not-allowed; opacity: 0.46; }
        .eng-math-practice__result { margin-top: 23px; border: 1px solid; border-radius: 16px; padding: 18px; }
        .eng-math-practice__result--correct { border-color: #b8e3ca; background: #f0fbf4; color: #155b3a; }
        .eng-math-practice__result--wrong { border-color: #f2c9cd; background: #fff5f5; color: #852b36; }
        .eng-math-practice__result-title { margin: 0 0 7px; font-size: 1.05rem; font-weight: 900; }
        .eng-math-practice__result-copy { margin: 0; color: #3d4d5e; line-height: 1.6; }
        .eng-math-practice__review-toggle { margin-top: 12px; border: 1px solid #b8c6df; background: #fff; color: #3157a5; }
        .eng-math-practice__explanation { margin-top: 12px; border-radius: 16px; background: #f5f8ff; padding: 19px; color: #29374d; }
        .eng-math-practice__explanation h2 { margin: 0 0 12px; color: #263d7d; font-size: 1rem; letter-spacing: -0.02em; }
        .eng-math-practice__explanation p { margin: 0 0 10px; line-height: 1.68; word-break: keep-all; }
        .eng-math-practice__explanation p:last-of-type { margin-bottom: 0; }
        .eng-math-practice__evidence { margin-top: 13px !important; border-left: 3px solid #8ba2db; padding: 9px 0 9px 12px; color: #405170; font-family: Georgia, "Times New Roman", serif; font-size: 0.92rem; font-style: italic; white-space: pre-wrap; }
        .eng-math-practice__evidence--figure {
          display: grid;
          gap: 3px;
          border: 1px solid #c9d6f1;
          border-left: 4px solid #3157a5;
          border-radius: 10px;
          background: #fff;
          padding: 11px 12px;
          font-family: "Noto Sans KR", system-ui, sans-serif;
          font-style: normal;
          white-space: normal;
        }
        .eng-math-practice__evidence-role { color: #3157a5; font-size: 0.75rem; font-weight: 900; }
        .eng-math-practice__evidence-quote { color: #273b67; font-weight: 900; }
        .eng-math-practice__evidence-translation { color: #5b687d; font-size: 0.84rem; line-height: 1.55; }
        .eng-math-practice__restart { margin-top: 12px; border: 1px solid #cbd5e1; background: #fff; color: #3e4d61; }
        .eng-math-practice__next { margin-top: 12px; color: #fff; }
        @media (max-width: 440px) {
          .eng-math-practice { padding: 16px 14px 32px; }
          .eng-math-practice__topline { align-items: flex-start; }
          .eng-math-practice__subject-switcher button { padding: 6px 8px; }
          .eng-math-practice__content { padding: 23px 18px; }
          .eng-math-practice__heading { font-size: 1.26rem; }
          .eng-math-practice__passage { padding-left: 13px; font-size: 0.97rem; }
          .eng-math-practice__figure { padding: 10px; }
          .eng-math-practice__figure-open { font-size: 0.64rem; }
          .eng-math-practice__figure-table { font-size: 0.7rem; }
          .eng-math-practice__figure-table thead th { font-size: 0.64rem; }
          .eng-math-practice__figure-table th,
          .eng-math-practice__figure-table td { padding: 7px 4px; }
          .eng-math-practice__math-prompt { padding: 16px 14px; font-size: 1rem; }
          .eng-math-practice__math-figure-description { padding: 14px; }
          .eng-math-practice__choice { grid-template-columns: 24px minmax(0, 1fr); padding: 12px 13px; }
        }
      `}</style>

      <div className="eng-math-practice__inner">
        <div className="eng-math-practice__topline">
          <button
            className="eng-math-practice__brand"
            type="button"
            onClick={() => navigate("/eng-math-beta")}
          >
            <span className="eng-math-practice__brand-dot" aria-hidden="true" />
            지니쌤과 공부하자
          </button>
          <div
            className="eng-math-practice__subject-switcher"
            aria-label="과목 변경"
          >
            {Object.entries(SUBJECTS).map(([key, value]) => (
              <button
                key={key}
                type="button"
                aria-current={key === subject ? "page" : undefined}
                style={
                  key === subject
                    ? { color: value.accent, background: value.tint }
                    : undefined
                }
                onClick={() => onSubjectChange(key)}
              >
                {value.name}
              </button>
            ))}
          </div>
        </div>

        <article className="eng-math-practice__card">
          <div
            className="eng-math-practice__subject-band"
            style={{ background: profile.accent }}
          />
          <div className="eng-math-practice__content">
            {session ? (
              <section
                className="eng-math-practice__progress"
                aria-label={`${session.total}문항 중 ${session.current}번째`}
              >
                <div className="eng-math-practice__progress-copy">
                  <span>5문항 연속 학습</span>
                  <strong>
                    {session.current} / {session.total}
                  </strong>
                </div>
                <div
                  className="eng-math-practice__progress-track"
                  role="progressbar"
                  aria-valuemin="1"
                  aria-valuemax={session.total}
                  aria-valuenow={session.current}
                >
                  <span
                    className="eng-math-practice__progress-value"
                    style={{
                      width: `${(session.current / session.total) * 100}%`,
                      background: profile.accent,
                    }}
                  />
                </div>
              </section>
            ) : null}

            <span
              className="eng-math-practice__eyebrow"
              style={{ background: profile.tint, color: profile.accent }}
            >
              {profile.name} · {session ? "5문항 학습" : "1문항 체험"}
            </span>
            <p className="eng-math-practice__label">{question.label}</p>
            <h1 className="eng-math-practice__heading">
              {subject === "math"
                ? "문제를 읽고 정답을 확인하세요."
                : question.prompt}
            </h1>

            {subject === "english" && question.figure ? (
              <EnglishFigure figure={question.figure} />
            ) : null}
            {subject === "english" ? (
              <p className="eng-math-practice__passage">{question.passage}</p>
            ) : null}
            {subject === "math" ? (
              <p className="eng-math-practice__math-prompt">
                <MathText text={question.prompt} />
              </p>
            ) : null}
            {subject === "math" && question.figureDescription ? (
              <MathFigureDescription description={question.figureDescription} />
            ) : null}

            {isShortAnswer ? (
              <div className="eng-math-practice__short-answer">
                <label htmlFor="math-short-answer">
                  정답을 숫자로 입력하세요.
                </label>
                <input
                  id="math-short-answer"
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  value={shortAnswer}
                  disabled={submitted}
                  onChange={(event) =>
                    setShortAnswer(event.target.value.replace(/[^0-9]/g, ""))
                  }
                />
              </div>
            ) : (
              <div
                className="eng-math-practice__choices"
                role="group"
                aria-label="답 선택"
              >
                {question.choices.map((choice) => {
                  const isSelected = selectedChoice === choice.number;
                  const isAnswer = choice.number === question.answer;
                  const classNames = ["eng-math-practice__choice"];
                  if (isSelected && !submitted)
                    classNames.push("eng-math-practice__choice--selected");
                  if (submitted && isAnswer)
                    classNames.push("eng-math-practice__choice--correct");
                  if (submitted && isSelected && !isAnswer)
                    classNames.push("eng-math-practice__choice--wrong");

                  return (
                    <button
                      key={choice.number}
                      className={classNames.join(" ")}
                      type="button"
                      disabled={submitted}
                      aria-pressed={isSelected}
                      onClick={() => selectChoice(choice.number)}
                    >
                      <ChoiceLabel choice={choice} subject={subject} />
                    </button>
                  );
                })}
              </div>
            )}

            {!submitted ? (
              <button
                className="eng-math-practice__submit"
                type="button"
                disabled={!isReadyToSubmit}
                style={{ background: profile.accent }}
                onClick={submitAnswer}
              >
                정답 확인하기
              </button>
            ) : (
              <>
                <section
                  className={`eng-math-practice__result ${isCorrect ? "eng-math-practice__result--correct" : "eng-math-practice__result--wrong"}`}
                  aria-live="polite"
                >
                  <p className="eng-math-practice__result-title">
                    {isCorrect ? "정답입니다." : "정답을 다시 확인해 보세요."}
                  </p>
                  <ResultAnswer question={question} subject={subject} />
                </section>

                {subject === "english" ? (
                  <>
                    <button
                      className="eng-math-practice__review-toggle"
                      type="button"
                      onClick={() => setShowExplanation((current) => !current)}
                    >
                      {showExplanation ? "풀이 접기" : "풀이 다시 보기"}
                    </button>

                    {showExplanation ? (
                      <section
                        className="eng-math-practice__explanation"
                        aria-label="풀이"
                      >
                        <h2>{question.review.approach}</h2>
                        <p>{question.review.summary}</p>
                        <p>{question.review.reason}</p>
                        <p>
                          혼동하기 쉬운 {question.review.trap.mark}{" "}
                          {question.review.trap.text}
                        </p>
                        <p>{question.review.trap.reason}</p>
                        {question.review.evidence.map((evidence) =>
                          evidence.origin === "figure" ? (
                            <div
                              key={`${evidence.role}-${evidence.quote}`}
                              className="eng-math-practice__evidence eng-math-practice__evidence--figure"
                            >
                              <span className="eng-math-practice__evidence-role">
                                {evidence.role}
                              </span>
                              <span className="eng-math-practice__evidence-quote">
                                {evidence.quote}
                              </span>
                              <span className="eng-math-practice__evidence-translation">
                                {evidence.translation}
                              </span>
                            </div>
                          ) : (
                            <p
                              key={`${evidence.role}-${evidence.quote}`}
                              className="eng-math-practice__evidence"
                            >
                              {evidence.quote}
                            </p>
                          ),
                        )}
                      </section>
                    ) : null}
                  </>
                ) : null}

                {session ? (
                  <button
                    className="eng-math-practice__next"
                    type="button"
                    style={{ background: profile.accent }}
                    onClick={session.onNext}
                  >
                    {session.isLast ? "5문항 결과 보기" : "다음 문제"}
                  </button>
                ) : (
                  <button
                    className="eng-math-practice__restart"
                    type="button"
                    onClick={restart}
                  >
                    같은 문제 다시 풀기
                  </button>
                )}
              </>
            )}
          </div>
        </article>
      </div>
    </main>
  );
}
