import { useNavigate } from "react-router-dom";

const SUBJECTS = [
  {
    key: "english",
    eyebrow: "ENGLISH",
    title: "영어 문항 선택",
    description:
      "2026학년도 수능 19~45번을 5문항씩 골라 풀고, 제출할 때마다 정답과 근거를 확인하세요.",
    detail: "27문항 · 6개 학습 묶음",
    accent: "#3157a5",
    tint: "#eef3ff",
  },
  {
    key: "math",
    eyebrow: "MATH",
    title: "수학 문항 선택",
    description:
      "2022~2025학년도 6월·9월 모의평가에서 시험과 영역을 고른 뒤 5문항을 학습하세요.",
    detail: "361문항 · 시험·영역별 선택",
    accent: "#16705b",
    tint: "#eaf7f1",
  },
];

export default function EngMathProductHome() {
  const navigate = useNavigate();

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
          .eng-math-home__hero { padding: 42px 4px 28px; }
          .eng-math-home__subject-grid { grid-template-columns: 1fr; }
          .eng-math-home__subject-card { min-height: 0; padding: 22px; }
          .eng-math-home__korean-link { align-items: flex-start; padding: 18px; }
        }
      `}</style>

      <div className="eng-math-home__inner">
        <div className="eng-math-home__brand">
          <span className="eng-math-home__brand-dot" aria-hidden="true" />
          지니쌤과 공부하자
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
            영어는 27문항의 근거형 풀이를 제공합니다. 수학은 시험과 영역별로
            검증된 361문항의 정답을 확인할 수 있습니다.
          </p>
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
