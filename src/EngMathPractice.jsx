import { useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";

const QUESTIONS = {
  english: {
    subject: "영어",
    label: "2026학년도 수능 · 19번",
    title: "Sophie의 심경 변화를 골라 보세요.",
    prompt: "다음 글에 드러난 Sophie의 심경 변화로 가장 적절한 것은?",
    passage:
      "“Where could it be?” Sophie asked herself. It had been more than ten years since she had last visited the area where she had grown up. The village had changed a lot over time. Uncertain, she awkwardly looked around at her surroundings. She walked the narrow streets of the village, unsure about which way to go. Suddenly, Sophie saw a familiar sight. “Yes, this must be it,” she thought. In front of her was a wall with flowers painted on it. Although the colors were now faded, the familiar shapes on the wall were the same ones she had painted with her father as a child. Sophie nodded, smiled brightly, and walked toward the gate. At last, she had finally found the house she had grown up in.",
    choices: [
      { number: 1, mark: "①", text: "confused → pleased" },
      { number: 2, mark: "②", text: "confident → embarrassed" },
      { number: 3, mark: "③", text: "thrilled → anxious" },
      { number: 4, mark: "④", text: "relieved → nervous" },
      { number: 5, mark: "⑤", text: "bored → excited" },
    ],
    answer: 1,
    answerMark: "①",
    answerText: "confused → pleased",
    explanationTitle: "낯선 마을에서 찾은 익숙한 집",
    explanation:
      "처음에는 마을이 변해 길을 몰라 혼란스러워합니다. 어린 시절 아버지와 그린 벽화를 알아본 뒤 밝게 웃으며 집을 향하므로 pleased로 바뀝니다.",
    evidenceQuotes: [
      "Uncertain,\nshe awkwardly looked around at her surroundings.",
      "Sophie nodded, smiled brightly, and walked toward\nthe gate.",
    ],
    accent: "#3157a5",
    tint: "#eef3ff",
  },
  math: {
    subject: "수학",
    label: "2022학년도 6월 모의평가 · 공통 1번",
    title: "지수법칙으로 식을 정리해 보세요.",
    prompt: (
      <>
        2<sup>√3</sup> × 2<sup>2 − √3</sup>의 값은? [2점]
      </>
    ),
    passage: null,
    choices: [
      { number: 1, mark: "①", text: "√2" },
      { number: 2, mark: "②", text: "2" },
      { number: 3, mark: "③", text: "2√2" },
      { number: 4, mark: "④", text: "4" },
      { number: 5, mark: "⑤", text: "4√2" },
    ],
    answer: 4,
    answerMark: "④",
    answerText: "4",
    explanationTitle: "같은 밑의 거듭제곱은 지수를 더합니다",
    explanation: (
      <>
        밑이 모두 2이므로 지수를 더합니다. √3 + (2 − √3)는 2가 되어, 식의 값은 2
        <sup>2</sup> = 4입니다.
      </>
    ),
    evidenceQuotes: [
      <>
        √3 + (2 − √3) = 2 → 2<sup>2</sup> = 4
      </>,
    ],
    accent: "#16705b",
    tint: "#eaf7f1",
  },
};

function ChoiceLabel({ choice }) {
  return (
    <>
      <strong>{choice.mark}</strong>
      <span>{choice.text}</span>
    </>
  );
}

export default function EngMathPractice() {
  const navigate = useNavigate();
  const location = useLocation();
  const subject =
    new URLSearchParams(location.search).get("subject") === "math"
      ? "math"
      : "english";

  return (
    <PracticeQuestion key={subject} subject={subject} navigate={navigate} />
  );
}

function PracticeQuestion({ subject, navigate }) {
  const question = QUESTIONS[subject];
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);

  const isCorrect = selectedAnswer === question.answer;
  const selectChoice = (number) => {
    if (!submitted) setSelectedAnswer(number);
  };

  const restart = () => {
    setSelectedAnswer(null);
    setSubmitted(false);
    setShowExplanation(false);
  };

  const switchSubject = (nextSubject) => {
    navigate(`/eng-math/practice?subject=${nextSubject}`);
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
        .eng-math-practice__inner { width: 100%; max-width: 840px; margin: 0 auto; }
        .eng-math-practice__top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          margin-bottom: 26px;
        }
        .eng-math-practice__home {
          border: 0;
          padding: 0;
          background: transparent;
          color: #44516a;
          font: inherit;
          font-size: 0.88rem;
          font-weight: 800;
          cursor: pointer;
        }
        .eng-math-practice__home:hover,
        .eng-math-practice__home:focus-visible { color: #172033; outline: none; }
        .eng-math-practice__subject-switch {
          display: inline-flex;
          gap: 6px;
          padding: 4px;
          border: 1px solid #dde4ed;
          border-radius: 11px;
          background: #ffffff;
        }
        .eng-math-practice__subject-switch button {
          min-height: 32px;
          border: 0;
          border-radius: 7px;
          padding: 0 11px;
          background: transparent;
          color: #68758a;
          font: inherit;
          font-size: 0.78rem;
          font-weight: 800;
          cursor: pointer;
        }
        .eng-math-practice__subject-switch button[aria-pressed="true"] { color: #ffffff; }
        .eng-math-practice__card {
          overflow: hidden;
          border: 1px solid #dde4ed;
          border-radius: 22px;
          background: #ffffff;
          box-shadow: 0 14px 32px rgba(33, 54, 91, 0.08);
        }
        .eng-math-practice__heading { padding: 28px 28px 22px; border-bottom: 1px solid #e7ebf0; }
        .eng-math-practice__eyebrow {
          display: inline-flex;
          padding: 6px 10px;
          border-radius: 999px;
          font-size: 0.76rem;
          font-weight: 900;
          letter-spacing: 0.02em;
        }
        .eng-math-practice h1 {
          margin: 16px 0 0;
          color: #172033;
          font-size: clamp(1.55rem, 5.3vw, 2.3rem);
          line-height: 1.3;
          letter-spacing: -0.055em;
          font-weight: 900;
          word-break: keep-all;
        }
        .eng-math-practice__body { padding: 28px; }
        .eng-math-practice__passage {
          margin: 0 0 26px;
          padding: 20px;
          border-radius: 15px;
          background: #f5f7fa;
          color: #3f4b60;
          font-family: Georgia, "Times New Roman", serif;
          font-size: 1rem;
          line-height: 1.8;
          white-space: pre-wrap;
          overflow-wrap: anywhere;
        }
        .eng-math-practice__prompt {
          margin: 0 0 18px;
          color: #172033;
          font-size: 1.05rem;
          line-height: 1.65;
          font-weight: 800;
          word-break: keep-all;
        }
        .eng-math-practice__math-prompt {
          display: inline-block;
          padding: 10px 13px;
          border-radius: 10px;
          background: #f4f8f6;
          color: #1e5c4d;
          font-family: ui-monospace, "Cascadia Code", monospace;
          font-size: clamp(1.05rem, 4vw, 1.25rem);
          letter-spacing: -0.04em;
        }
        .eng-math-practice__choices { display: grid; gap: 10px; }
        .eng-math-practice__choice {
          display: flex;
          align-items: center;
          gap: 13px;
          width: 100%;
          min-height: 54px;
          padding: 13px 15px;
          border: 1px solid #d9e0e9;
          border-radius: 13px;
          background: #ffffff;
          color: #273247;
          text-align: left;
          font: inherit;
          font-size: 0.98rem;
          cursor: pointer;
          overflow-wrap: anywhere;
        }
        .eng-math-practice__choice:not(:disabled):hover,
        .eng-math-practice__choice:not(:disabled):focus-visible { border-color: #7f96c7; outline: none; }
        .eng-math-practice__choice strong { min-width: 25px; color: #68758a; }
        .eng-math-practice__choice--selected { border-width: 2px; font-weight: 800; }
        .eng-math-practice__choice--correct { border-color: #258064; background: #ecfaf4; color: #165a47; }
        .eng-math-practice__choice--wrong { border-color: #c55b63; background: #fff3f3; color: #972f39; }
        .eng-math-practice__choice:disabled { cursor: default; }
        .eng-math-practice__submit {
          width: 100%;
          min-height: 54px;
          margin-top: 20px;
          border: 0;
          border-radius: 13px;
          color: #ffffff;
          font: inherit;
          font-size: 1rem;
          font-weight: 900;
          cursor: pointer;
        }
        .eng-math-practice__submit:disabled { background: #b8c1ce; cursor: not-allowed; }
        .eng-math-practice__result {
          margin-top: 20px;
          padding: 20px;
          border-radius: 15px;
          word-break: keep-all;
        }
        .eng-math-practice__result--correct { background: #ecfaf4; color: #165a47; }
        .eng-math-practice__result--wrong { background: #fff3f3; color: #8f3038; }
        .eng-math-practice__result-title { margin: 0; font-size: 1.08rem; font-weight: 900; }
        .eng-math-practice__result-copy { margin: 8px 0 0; font-size: 0.92rem; line-height: 1.6; }
        .eng-math-practice__review-toggle {
          width: 100%;
          min-height: 48px;
          margin-top: 12px;
          border: 1px solid #cbd5e3;
          border-radius: 12px;
          background: #ffffff;
          color: #263852;
          font: inherit;
          font-size: 0.92rem;
          font-weight: 900;
          cursor: pointer;
        }
        .eng-math-practice__review-toggle:hover,
        .eng-math-practice__review-toggle:focus-visible { border-color: #8295b3; outline: none; }
        .eng-math-practice__explanation {
          margin-top: 12px;
          padding: 20px;
          border: 1px solid #d6dfec;
          border-radius: 15px;
          background: #f7f9fc;
        }
        .eng-math-practice__explanation h2 { margin: 0; color: #21304a; font-size: 1rem; font-weight: 900; }
        .eng-math-practice__explanation p { margin: 10px 0 0; color: #536077; font-size: 0.92rem; line-height: 1.7; word-break: keep-all; }
        .eng-math-practice__evidence { color: #3157a5 !important; font-weight: 800; white-space: pre-wrap; }
        .eng-math-practice__restart {
          width: 100%;
          min-height: 46px;
          margin-top: 12px;
          border: 0;
          border-radius: 12px;
          background: transparent;
          color: #59677f;
          font: inherit;
          font-size: 0.88rem;
          font-weight: 800;
          cursor: pointer;
        }
        .eng-math-practice__restart:hover,
        .eng-math-practice__restart:focus-visible { color: #172033; outline: none; }
        @media (max-width: 560px) {
          .eng-math-practice { padding: 16px 12px 32px; }
          .eng-math-practice__top { margin-bottom: 18px; }
          .eng-math-practice__heading, .eng-math-practice__body { padding: 22px 18px; }
          .eng-math-practice__passage { padding: 16px; font-size: 0.94rem; line-height: 1.72; }
          .eng-math-practice__choice { padding: 12px 13px; }
        }
      `}</style>

      <div className="eng-math-practice__inner">
        <header className="eng-math-practice__top">
          <button
            className="eng-math-practice__home"
            type="button"
            onClick={() => navigate("/")}
          >
            ← 영어·수학 체험
          </button>
          <div
            className="eng-math-practice__subject-switch"
            aria-label="과목 바꾸기"
          >
            {Object.keys(QUESTIONS).map((key) => (
              <button
                key={key}
                type="button"
                aria-pressed={subject === key}
                style={
                  subject === key
                    ? { background: QUESTIONS[key].accent }
                    : undefined
                }
                onClick={() => switchSubject(key)}
              >
                {QUESTIONS[key].subject}
              </button>
            ))}
          </div>
        </header>

        <article
          className="eng-math-practice__card"
          aria-labelledby="eng-math-practice-title"
        >
          <header className="eng-math-practice__heading">
            <span
              className="eng-math-practice__eyebrow"
              style={{ background: question.tint, color: question.accent }}
            >
              {question.label}
            </span>
            <h1 id="eng-math-practice-title">{question.title}</h1>
          </header>

          <div className="eng-math-practice__body">
            {question.passage ? (
              <p className="eng-math-practice__passage">{question.passage}</p>
            ) : null}
            <p className="eng-math-practice__prompt">
              {subject === "math" ? (
                <span className="eng-math-practice__math-prompt">
                  {question.prompt}
                </span>
              ) : (
                question.prompt
              )}
            </p>

            <div
              className="eng-math-practice__choices"
              role="group"
              aria-label="답 선택"
            >
              {question.choices.map((choice) => {
                const isSelected = selectedAnswer === choice.number;
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
                    <ChoiceLabel choice={choice} />
                  </button>
                );
              })}
            </div>

            {!submitted ? (
              <button
                className="eng-math-practice__submit"
                type="button"
                disabled={selectedAnswer === null}
                style={{ background: question.accent }}
                onClick={() => setSubmitted(true)}
              >
                답 확인하기
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
                  <p className="eng-math-practice__result-copy">
                    정답은 {question.answerMark} {question.answerText}입니다.
                  </p>
                </section>

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
                    <h2>{question.explanationTitle}</h2>
                    <p>{question.explanation}</p>
                    {question.evidenceQuotes.map((quote, index) => (
                      <p key={index} className="eng-math-practice__evidence">
                        {quote}
                      </p>
                    ))}
                  </section>
                ) : null}

                <button
                  className="eng-math-practice__restart"
                  type="button"
                  onClick={restart}
                >
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
