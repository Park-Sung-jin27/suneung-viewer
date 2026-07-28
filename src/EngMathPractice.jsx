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
        if (!isBlock && !isInline) return <span key={`${part}-${index}`}>{part}</span>;

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
            className={isBlock ? "eng-math-practice__math-block" : "eng-math-practice__math-inline"}
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
      {subject === "math" ? <MathText text={choice.text} /> : <span>{choice.text}</span>}
    </>
  );
}

function EnglishFigure({ figure }) {
  return (
    <figure className="eng-math-practice__figure" aria-labelledby="eng-math-practice-figure-title">
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
        <span className="eng-math-practice__figure-open">원본 도표 크게 보기</span>
      </a>

      <figcaption id="eng-math-practice-figure-title" className="eng-math-practice__figure-title">
        {figure.title}
      </figcaption>

      <div className="eng-math-practice__figure-table-wrap">
        <table className="eng-math-practice__figure-table">
          <caption className="eng-math-practice__sr-only">영어 25번 도표 수치</caption>
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
    <aside className="eng-math-practice__math-figure-description" aria-label="그림 설명">
      <h2>그림 설명</h2>
      <div className="eng-math-practice__math-figure-description-body">
        <MathText text={description} />
      </div>
    </aside>
  );
}

function usePublicQuestions(subject) {
  const [state, setState] = useState({ subject: "", status: "loading", questions: [], error: "" });

  useEffect(() => {
    const controller = new AbortController();

    fetch(DATA_URLS[subject], { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("문항 데이터를 불러오지 못했습니다.");
        return response.json();
      })
      .then((data) => {
        if (!Array.isArray(data.questions)) throw new Error("문항 데이터 형식이 올바르지 않습니다.");
        setState({ subject, status: "ready", questions: data.questions, error: "" });
      })
      .catch((error) => {
        if (error.name === "AbortError") return;
        setState({ subject, status: "error", questions: [], error: error.message });
      });

    return () => controller.abort();
  }, [subject]);

  return state.subject === subject ? state : { status: "loading", questions: [], error: "" };
}

function getAnswerText(question, subject) {
  if (subject === "math" && question.responseType === "short") return question.answer;
  return question.choices.find((choice) => choice.number === question.answer)?.text ?? "";
}

function getAnswerMark(question, subject) {
  if (subject === "math" && question.responseType === "short") return "정답";
  return question.choices.find((choice) => choice.number === question.answer)?.mark ?? "정답";
}

function ResultAnswer({ question, subject }) {
  const answerText = getAnswerText(question, subject);
  const answerMark = getAnswerMark(question, subject);

  return (
    <p className="eng-math-practice__result-copy">
      {subject === "math" && question.responseType === "short" ? "정답은 " : `정답은 ${answerMark} `}
      {subject === "math" ? <MathText text={answerText} /> : answerText}입니다.
    </p>
  );
}

export default function EngMathPractice() {
  const navigate = useNavigate();
  const location = useLocation();
  const parameters = new URLSearchParams(location.search);
  const subject = parameters.get("subject") === "math" ? "math" : "english";
  const questionId = parameters.get("id");
  const { status, questions, error } = usePublicQuestions(subject);
  const question = useMemo(
    () => questions.find((candidate) => candidate.id === questionId) ?? null,
    [questionId, questions],
  );

  const chooseSubject = (nextSubject) => {
    navigate(`/eng-math/practice?subject=${nextSubject}&id=${STARTER_IDS[nextSubject]}`);
  };

  if (status === "loading") {
    return <PracticeNotice message="문항을 준비하고 있습니다." />;
  }

  if (status === "error") {
    return <PracticeNotice message={error} onBack={() => navigate("/eng-math-beta")} />;
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
        .eng-math-practice--notice { min-height: 100svh; display: grid; place-items: center; padding: 24px; background: #f8fafc; font-family: "Noto Sans KR", system-ui, sans-serif; }
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

function PracticeQuestion({ question, subject, navigate, onSubjectChange }) {
  const profile = SUBJECTS[subject];
  const isShortAnswer = subject === "math" && question.responseType === "short";
  const [selectedChoice, setSelectedChoice] = useState(null);
  const [shortAnswer, setShortAnswer] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const currentAnswer = isShortAnswer ? normalizeShortAnswer(shortAnswer) : selectedChoice;
  const isReadyToSubmit = isShortAnswer ? /^\d+$/.test(currentAnswer) : currentAnswer !== null;
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
        .eng-math-practice__submit, .eng-math-practice__restart, .eng-math-practice__review-toggle {
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
        .eng-math-practice--notice { display: grid; place-items: center; padding: 24px; }
        .eng-math-practice__notice { width: min(100%, 390px); border: 1px solid #dce3ed; border-radius: 18px; background: #fff; padding: 26px; text-align: center; box-shadow: 0 14px 40px rgba(24,39,75,.08); }
        .eng-math-practice__notice p { margin: 0; color: #40506a; line-height: 1.6; }
        .eng-math-practice__notice button { margin-top: 16px; border: 0; border-radius: 10px; background: #3157a5; padding: 11px 14px; color: #fff; font: inherit; font-weight: 800; cursor: pointer; }
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
          <button className="eng-math-practice__brand" type="button" onClick={() => navigate("/eng-math-beta")}>
            <span className="eng-math-practice__brand-dot" aria-hidden="true" />
            지니쌤과 공부하자
          </button>
          <div className="eng-math-practice__subject-switcher" aria-label="과목 변경">
            {Object.entries(SUBJECTS).map(([key, value]) => (
              <button
                key={key}
                type="button"
                aria-current={key === subject ? "page" : undefined}
                style={key === subject ? { color: value.accent, background: value.tint } : undefined}
                onClick={() => onSubjectChange(key)}
              >
                {value.name}
              </button>
            ))}
          </div>
        </div>

        <article className="eng-math-practice__card">
          <div className="eng-math-practice__subject-band" style={{ background: profile.accent }} />
          <div className="eng-math-practice__content">
            <span className="eng-math-practice__eyebrow" style={{ background: profile.tint, color: profile.accent }}>
              {profile.name} · 1문항 체험
            </span>
            <p className="eng-math-practice__label">{question.label}</p>
            <h1 className="eng-math-practice__heading">
              {subject === "math" ? "문제를 읽고 정답을 확인하세요." : question.prompt}
            </h1>

            {subject === "english" && question.figure ? <EnglishFigure figure={question.figure} /> : null}
            {subject === "english" ? <p className="eng-math-practice__passage">{question.passage}</p> : null}
            {subject === "math" ? <p className="eng-math-practice__math-prompt"><MathText text={question.prompt} /></p> : null}
            {subject === "math" && question.figureDescription ? (
              <MathFigureDescription description={question.figureDescription} />
            ) : null}

            {isShortAnswer ? (
              <div className="eng-math-practice__short-answer">
                <label htmlFor="math-short-answer">정답을 숫자로 입력하세요.</label>
                <input
                  id="math-short-answer"
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  value={shortAnswer}
                  disabled={submitted}
                  onChange={(event) => setShortAnswer(event.target.value.replace(/[^0-9]/g, ""))}
                />
              </div>
            ) : (
              <div className="eng-math-practice__choices" role="group" aria-label="답 선택">
                {question.choices.map((choice) => {
                  const isSelected = selectedChoice === choice.number;
                  const isAnswer = choice.number === question.answer;
                  const classNames = ["eng-math-practice__choice"];
                  if (isSelected && !submitted) classNames.push("eng-math-practice__choice--selected");
                  if (submitted && isAnswer) classNames.push("eng-math-practice__choice--correct");
                  if (submitted && isSelected && !isAnswer) classNames.push("eng-math-practice__choice--wrong");

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
                onClick={() => setSubmitted(true)}
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
                      <section className="eng-math-practice__explanation" aria-label="풀이">
                        <h2>{question.review.approach}</h2>
                        <p>{question.review.summary}</p>
                        <p>{question.review.reason}</p>
                        <p>
                          혼동하기 쉬운 {question.review.trap.mark} {question.review.trap.text}
                        </p>
                        <p>{question.review.trap.reason}</p>
                        {question.review.evidence.map((evidence) =>
                          evidence.origin === "figure" ? (
                            <div
                              key={`${evidence.role}-${evidence.quote}`}
                              className="eng-math-practice__evidence eng-math-practice__evidence--figure"
                            >
                              <span className="eng-math-practice__evidence-role">{evidence.role}</span>
                              <span className="eng-math-practice__evidence-quote">{evidence.quote}</span>
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

                <button className="eng-math-practice__restart" type="button" onClick={restart}>
                  같은 문제 다시 풀기
                </button>
              </>
            )}
          </div>
        </article>
      </div>
    </main>
  );
}
