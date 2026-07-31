import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import katex from "katex";
import "katex/dist/katex.min.css";

const QUESTION_DATA_URLS = {
  english: "/data/eng-math/english-free-public.json",
  math: "/data/eng-math/math-free-public.json",
};
const CATALOG_DATA_URL = "/data/eng-math/catalog-public.json";
const EXPECTED_BOUNDARIES = {
  english: {
    totalQuestionCount: 27,
    freeQuestionCount: 5,
    lockedQuestionCount: 22,
    packCount: 6,
  },
  math: {
    totalQuestionCount: 361,
    freeQuestionCount: 5,
    lockedQuestionCount: 356,
    packCount: 88,
  },
};

const MATH_TRACKS = {
  common: "공통",
  cal: "미적분",
  sta: "확률과통계",
  geo: "기하",
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

function sessionUrl(subject, packId) {
  return `/eng-math/practice?subject=${subject}&mode=session&pack=${encodeURIComponent(packId)}`;
}

function catalogUrl(subject, pack = null) {
  const parameters = new URLSearchParams({ subject, mode: "catalog" });
  if (subject === "math" && pack) {
    parameters.set("exam", pack.examKey);
    parameters.set("track", pack.trackKey);
  }
  return `/eng-math/practice?${parameters.toString()}`;
}

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

function prepareLearningData(subject, questionData, catalogData) {
  const expected = EXPECTED_BOUNDARIES[subject];
  const boundary = catalogData?.subjects?.[subject];
  const questions = questionData?.questions;
  const packs = boundary?.packs;

  if (!Array.isArray(questions) || !Array.isArray(packs)) {
    throw new Error("무료 문항 데이터 형식이 올바르지 않습니다.");
  }
  for (const [key, value] of Object.entries(expected)) {
    if (boundary[key] !== value) {
      throw new Error("무료·잠금 문항 범위를 확인하지 못했습니다.");
    }
  }
  if (
    questions.length !== expected.freeQuestionCount ||
    new Set(questions.map((question) => question.id)).size !==
      expected.freeQuestionCount ||
    packs.length !== expected.packCount ||
    new Set(packs.map((pack) => pack.id)).size !== expected.packCount
  ) {
    throw new Error("무료 문항 또는 잠금 묶음 수가 올바르지 않습니다.");
  }

  const freePacks = packs.filter((pack) => pack.access === "free");
  const lockedPacks = packs.filter((pack) => pack.access === "locked");
  if (
    freePacks.length !== 1 ||
    freePacks[0].id !== boundary.freePackId ||
    freePacks[0].id !== questionData.packId ||
    lockedPacks.length !== expected.packCount - 1 ||
    packs.some((pack) => pack.access !== "free" && pack.access !== "locked")
  ) {
    throw new Error("무료·잠금 묶음 구성이 올바르지 않습니다.");
  }

  return {
    boundary,
    questions,
    catalog: packs.map((pack) => ({
      ...pack,
      questions: pack.id === questionData.packId ? questions : [],
    })),
  };
}

function usePublicLearningData(subject) {
  const [state, setState] = useState({
    subject: "",
    status: "loading",
    questions: [],
    catalog: [],
    boundary: null,
    error: "",
  });

  useEffect(() => {
    const controller = new AbortController();

    Promise.all([
      fetch(QUESTION_DATA_URLS[subject], { signal: controller.signal }),
      fetch(CATALOG_DATA_URL, { signal: controller.signal }),
    ])
      .then(async ([questionResponse, catalogResponse]) => {
        if (!questionResponse.ok || !catalogResponse.ok) {
          throw new Error("문항 데이터를 불러오지 못했습니다.");
        }
        return Promise.all([questionResponse.json(), catalogResponse.json()]);
      })
      .then(([questionData, catalogData]) => {
        const learningData = prepareLearningData(
          subject,
          questionData,
          catalogData,
        );
        setState({
          subject,
          status: "ready",
          questions: learningData.questions,
          catalog: learningData.catalog,
          boundary: learningData.boundary,
          error: "",
        });
      })
      .catch((error) => {
        if (error.name === "AbortError") return;
        setState({
          subject,
          status: "error",
          questions: [],
          catalog: [],
          boundary: null,
          error: error.message,
        });
      });

    return () => controller.abort();
  }, [subject]);

  return state.subject === subject
    ? state
    : {
        status: "loading",
        questions: [],
        catalog: [],
        boundary: null,
        error: "",
      };
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
  const mode = parameters.get("mode");
  const isCatalogMode = mode === "catalog";
  const isSessionMode = mode === "session";
  const questionId = parameters.get("id");
  const packId = parameters.get("pack");
  const initialExam = parameters.get("exam");
  const initialTrack = parameters.get("track");
  const { status, questions, catalog, boundary, error } =
    usePublicLearningData(subject);
  const question = useMemo(
    () => questions.find((candidate) => candidate.id === questionId) ?? null,
    [questionId, questions],
  );
  const selectedPack = useMemo(
    () => catalog.find((pack) => pack.id === packId) ?? null,
    [catalog, packId],
  );
  const nextPack = useMemo(() => {
    if (!selectedPack) return null;
    const selectedIndex = catalog.findIndex(
      (pack) => pack.id === selectedPack.id,
    );
    const candidate = catalog[selectedIndex + 1] ?? null;
    return candidate?.access === "free" &&
      candidate.examKey === selectedPack.examKey &&
      candidate.trackKey === selectedPack.trackKey
      ? candidate
      : null;
  }, [catalog, selectedPack]);

  const chooseSubject = (nextSubject) => {
    navigate(catalogUrl(nextSubject));
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

  if (isCatalogMode) {
    return (
      <QuestionCatalog
        key={`${subject}-${initialExam}-${initialTrack}`}
        catalog={catalog}
        subject={subject}
        initialExam={initialExam}
        initialTrack={initialTrack}
        navigate={navigate}
        onSubjectChange={chooseSubject}
        boundary={boundary}
      />
    );
  }

  if (isSessionMode) {
    if (!selectedPack) {
      return (
        <PracticeNotice
          message="요청한 5문항 묶음을 찾지 못했습니다."
          onBack={() => navigate(catalogUrl(subject))}
          backLabel="문항 목록으로"
        />
      );
    }

    if (selectedPack.access === "locked") {
      return (
        <PracticeNotice
          message={`${SUBJECTS[subject].name} ${selectedPack.label} 묶음은 현재 잠겨 있습니다. 무료 체험은 5문항 한 묶음만 제공하며 결제는 아직 연결하지 않았습니다.`}
          onBack={() => navigate(catalogUrl(subject, selectedPack))}
          backLabel="문항 목록으로"
        />
      );
    }

    return (
      <LearningSession
        key={`${subject}-${selectedPack.id}`}
        questions={selectedPack.questions}
        subject={subject}
        navigate={navigate}
        onSubjectChange={chooseSubject}
        packLabel={`${selectedPack.examLabel} · ${selectedPack.trackLabel} · ${selectedPack.label}`}
        onNextPack={
          nextPack ? () => navigate(sessionUrl(subject, nextPack.id)) : null
        }
        onCatalog={() => navigate(catalogUrl(subject, selectedPack))}
      />
    );
  }

  if (!question) {
    return (
      <PracticeNotice
        message="요청한 문항을 찾지 못했습니다."
        onBack={() => navigate(catalogUrl(subject))}
        backLabel="문항 목록으로"
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

function QuestionCatalog({
  catalog,
  subject,
  initialExam,
  initialTrack,
  navigate,
  onSubjectChange,
  boundary,
}) {
  const profile = SUBJECTS[subject];
  const examOptions = useMemo(() => {
    const options = new Map();
    catalog.forEach((pack) => options.set(pack.examKey, pack.examLabel));
    return [...options].map(([key, label]) => ({ key, label }));
  }, [catalog]);
  const defaultExam = examOptions.some((option) => option.key === initialExam)
    ? initialExam
    : examOptions[0]?.key;
  const defaultTrack =
    initialTrack && Object.hasOwn(MATH_TRACKS, initialTrack)
      ? initialTrack
      : "common";
  const [selectedExam, setSelectedExam] = useState(defaultExam);
  const [selectedTrack, setSelectedTrack] = useState(defaultTrack);
  const visiblePacks =
    subject === "math"
      ? catalog.filter(
          (pack) =>
            pack.examKey === selectedExam && pack.trackKey === selectedTrack,
        )
      : catalog;
  const visibleQuestionCount = visiblePacks[0]?.scopeQuestionCount ?? 0;
  const visibleFreePackCount = visiblePacks.filter(
    (pack) => pack.access === "free",
  ).length;

  return (
    <main className="eng-math-catalog">
      <style>{`
        .eng-math-catalog {
          min-height: 100svh;
          box-sizing: border-box;
          overflow-x: hidden;
          padding: 24px 20px 48px;
          background: #f8fafc;
          color: #172033;
          font-family: "Noto Sans KR", system-ui, sans-serif;
        }
        .eng-math-catalog * { box-sizing: border-box; }
        .eng-math-catalog__inner { width: min(100%, 920px); margin: 0 auto; }
        .eng-math-catalog__topline {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }
        .eng-math-catalog__brand {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          border: 0;
          background: transparent;
          padding: 4px 0;
          color: #3157a5;
          font: inherit;
          font-size: 0.85rem;
          font-weight: 900;
          cursor: pointer;
        }
        .eng-math-catalog__brand-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: currentColor;
        }
        .eng-math-catalog__subject-switcher {
          display: flex;
          gap: 6px;
        }
        .eng-math-catalog__subject-switcher button {
          min-height: 34px;
          border: 1px solid transparent;
          border-radius: 999px;
          background: #fff;
          padding: 6px 11px;
          color: #64748b;
          font: inherit;
          font-size: 0.8rem;
          font-weight: 900;
          cursor: pointer;
        }
        .eng-math-catalog__subject-switcher button[aria-current="page"] {
          border-color: currentColor;
        }
        .eng-math-catalog__hero {
          max-width: 690px;
          padding: 48px 0 28px;
        }
        .eng-math-catalog__eyebrow {
          display: inline-flex;
          min-height: 29px;
          align-items: center;
          border-radius: 999px;
          padding: 5px 10px;
          font-size: 0.76rem;
          font-weight: 900;
        }
        .eng-math-catalog h1 {
          margin: 15px 0 10px;
          font-size: clamp(1.85rem, 6vw, 3rem);
          line-height: 1.22;
          letter-spacing: -0.055em;
          word-break: keep-all;
        }
        .eng-math-catalog__lead {
          margin: 0;
          color: #627087;
          line-height: 1.68;
          word-break: keep-all;
        }
        .eng-math-catalog__filters {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
          margin-bottom: 20px;
          border: 1px solid #dfe6ef;
          border-radius: 18px;
          background: #fff;
          padding: 17px;
        }
        .eng-math-catalog__filter span {
          display: block;
          margin-bottom: 7px;
          color: #58667b;
          font-size: 0.78rem;
          font-weight: 900;
        }
        .eng-math-catalog__filter select {
          width: 100%;
          min-width: 0;
          min-height: 46px;
          border: 1px solid #cbd5e1;
          border-radius: 11px;
          background: #fff;
          padding: 0 12px;
          color: #25324a;
          font: inherit;
          font-size: 0.9rem;
          font-weight: 800;
        }
        .eng-math-catalog__summary {
          margin: 0 0 12px;
          color: #667085;
          font-size: 0.84rem;
          font-weight: 800;
        }
        .eng-math-catalog__grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }
        .eng-math-catalog__pack {
          width: 100%;
          min-width: 0;
          border: 1px solid #dfe5ef;
          border-radius: 18px;
          background: #fff;
          padding: 19px;
          color: inherit;
          text-align: left;
          cursor: pointer;
          box-shadow: 0 9px 24px rgba(33, 54, 91, 0.06);
        }
        .eng-math-catalog__pack:hover,
        .eng-math-catalog__pack:focus-visible {
          border-color: #9aaac3;
          outline: none;
          transform: translateY(-1px);
        }
        .eng-math-catalog__pack--locked {
          border-style: dashed;
          background: #fbfcfe;
          box-shadow: none;
        }
        .eng-math-catalog__pack--locked:hover,
        .eng-math-catalog__pack--locked:focus-visible {
          border-color: #aab4c4;
          transform: none;
        }
        .eng-math-catalog__pack-topline {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          color: #738097;
          font-size: 0.73rem;
          font-weight: 900;
        }
        .eng-math-catalog__pack-badge {
          flex: 0 0 auto;
          border-radius: 999px;
          padding: 4px 8px;
        }
        .eng-math-catalog__pack-badge--locked {
          background: #eef1f5;
          color: #667085;
        }
        .eng-math-catalog__pack h2 {
          margin: 17px 0 7px;
          color: #172033;
          font-size: 1.25rem;
          letter-spacing: -0.035em;
        }
        .eng-math-catalog__pack-copy,
        .eng-math-catalog__pack-note {
          margin: 0;
          color: #627087;
          font-size: 0.84rem;
          line-height: 1.55;
          word-break: keep-all;
        }
        .eng-math-catalog__pack-note {
          margin-top: 8px;
          color: #7a5b1f;
        }
        .eng-math-catalog__pack-action {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-top: 16px;
          font-size: 0.84rem;
          font-weight: 900;
        }
        @media (max-width: 560px) {
          .eng-math-catalog { padding: 17px 14px 34px; }
          .eng-math-catalog__topline { align-items: flex-start; }
          .eng-math-catalog__hero { padding: 38px 2px 23px; }
          .eng-math-catalog__filters,
          .eng-math-catalog__grid { grid-template-columns: 1fr; }
          .eng-math-catalog__filters { padding: 14px; }
          .eng-math-catalog__pack { padding: 17px; }
        }
      `}</style>

      <div className="eng-math-catalog__inner">
        <div className="eng-math-catalog__topline">
          <button
            className="eng-math-catalog__brand"
            type="button"
            onClick={() => navigate("/eng-math-beta")}
          >
            <span className="eng-math-catalog__brand-dot" aria-hidden="true" />
            지니쌤과 공부하자
          </button>

          <div
            className="eng-math-catalog__subject-switcher"
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

        <header className="eng-math-catalog__hero">
          <span
            className="eng-math-catalog__eyebrow"
            style={{ background: profile.tint, color: profile.accent }}
          >
            {profile.name} · 5문항 묶음 선택
          </span>
          <h1>학습할 문항을 고르세요.</h1>
          <p className="eng-math-catalog__lead">
            {subject === "english"
              ? "19~23번 5문항은 무료로 풀 수 있습니다. 나머지 22문항은 결제 없이 잠금 상태로만 표시합니다."
              : "2022학년도 6월 공통 첫 5문항은 무료입니다. 나머지 356문항은 잠금 상태이며 수학 풀이는 아직 제공하지 않습니다."}
          </p>
        </header>

        {subject === "math" ? (
          <section
            className="eng-math-catalog__filters"
            aria-label="수학 시험과 영역 선택"
          >
            <label className="eng-math-catalog__filter">
              <span>시험</span>
              <select
                value={selectedExam}
                onChange={(event) => setSelectedExam(event.target.value)}
              >
                {examOptions.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="eng-math-catalog__filter">
              <span>영역</span>
              <select
                value={selectedTrack}
                onChange={(event) => setSelectedTrack(event.target.value)}
              >
                {Object.entries(MATH_TRACKS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </section>
        ) : null}

        <p className="eng-math-catalog__summary">
          {subject === "english"
            ? `무료 ${boundary.freeQuestionCount}문항 · 잠금 ${boundary.lockedQuestionCount}문항 · 전체 ${boundary.packCount}개 묶음`
            : `선택한 범위 ${visibleQuestionCount}문항 · ${visiblePacks.length}개 묶음 · ${visibleFreePackCount ? "무료 1개" : "현재 모두 잠금"}`}
        </p>

        <section className="eng-math-catalog__grid" aria-label="5문항 묶음">
          {visiblePacks.map((pack) => (
            <button
              key={pack.id}
              className={`eng-math-catalog__pack ${pack.access === "locked" ? "eng-math-catalog__pack--locked" : ""}`}
              type="button"
              onClick={() => navigate(sessionUrl(subject, pack.id))}
            >
              <span className="eng-math-catalog__pack-topline">
                <span>{pack.examLabel}</span>
                <span
                  className={`eng-math-catalog__pack-badge ${pack.access === "locked" ? "eng-math-catalog__pack-badge--locked" : ""}`}
                  style={
                    pack.access === "free"
                      ? { background: profile.tint, color: profile.accent }
                      : undefined
                  }
                >
                  {pack.access === "free" ? "무료 5문항" : "잠금"}
                </span>
              </span>
              <h2>{pack.label}</h2>
              <p className="eng-math-catalog__pack-copy">
                {pack.trackLabel} ·{" "}
                {subject === "english"
                  ? "근거형 풀이 제공"
                  : pack.responseSummary}
              </p>
              {pack.note ? (
                <p className="eng-math-catalog__pack-note">{pack.note}</p>
              ) : null}
              <span
                className="eng-math-catalog__pack-action"
                style={{ color: profile.accent }}
              >
                <span>
                  {pack.access === "free"
                    ? "무료로 학습하기"
                    : "잠금 범위 확인"}
                </span>
                <span aria-hidden="true">
                  {pack.access === "free" ? "→" : "🔒"}
                </span>
              </span>
            </button>
          ))}
        </section>
      </div>
    </main>
  );
}

function PracticeNotice({ message, onBack, backLabel = "베타로 돌아가기" }) {
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
            {backLabel}
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
  packLabel,
  onNextPack,
  onCatalog,
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
        packLabel={packLabel}
        onNextPack={onNextPack}
        onCatalog={onCatalog}
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
  packLabel,
  onNextPack,
  onCatalog,
}) {
  const profile = SUBJECTS[subject];
  const correctCount = results.filter((result) => result.isCorrect).length;

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
        .eng-math-session-summary__pack-label {
          margin: 7px 0 0;
          color: #46556d;
          font-size: 0.84rem;
          font-weight: 800;
          line-height: 1.55;
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
            <p className="eng-math-session-summary__pack-label">{packLabel}</p>

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
                onClick={onNextPack ?? onCatalog}
              >
                {onNextPack ? "다음 5문항 풀기" : "문항 목록으로"}
              </button>
              <button
                className="eng-math-session-summary__secondary"
                type="button"
                onClick={onRestart}
              >
                같은 5문항 전체 다시 풀기
              </button>
              {onNextPack ? (
                <button
                  className="eng-math-session-summary__home"
                  type="button"
                  onClick={onCatalog}
                >
                  문항 목록으로
                </button>
              ) : null}
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
        .eng-math-practice__evidence--text { display: grid; gap: 5px; font-family: "Noto Sans KR", system-ui, sans-serif; font-style: normal; white-space: normal; }
        .eng-math-practice__evidence-text-label { color: #3157a5; font-size: 0.76rem; font-weight: 900; }
        .eng-math-practice__evidence-text-role { color: #52637a; font-size: 0.82rem; font-weight: 800; }
        .eng-math-practice__evidence-text-quote { color: #273b67; font-family: Georgia, "Times New Roman", serif; font-style: italic; line-height: 1.58; white-space: pre-wrap; }
        .eng-math-practice__evidence-text-translation { color: #5b687d; font-size: 0.84rem; line-height: 1.55; }
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
                            <div
                              key={`${evidence.role}-${evidence.quote}`}
                              className="eng-math-practice__evidence eng-math-practice__evidence--text"
                            >
                              <span className="eng-math-practice__evidence-text-label">
                                정답 근거 문장
                              </span>
                              <span className="eng-math-practice__evidence-text-role">
                                역할 · {evidence.role}
                              </span>
                              <span className="eng-math-practice__evidence-text-quote">
                                원문 · {evidence.quote}
                              </span>
                              <span className="eng-math-practice__evidence-text-translation">
                                한국어 뜻 · {evidence.translation}
                              </span>
                            </div>
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
