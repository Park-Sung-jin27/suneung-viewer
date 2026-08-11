(function () {
  "use strict";

  const app = document.getElementById("app");
  const data = window.MILITARY_MATH_2027_DATA;
  const answerMarks = ["", "①", "②", "③", "④", "⑤"];
  const expectedAnswers = {
    "common-01": "4", "common-02": "4", "common-03": "1", "common-04": "1", "common-05": "2", "common-06": "3",
    "common-07": "3", "common-08": "2", "common-09": "5", "common-10": "4", "common-11": "3", "common-12": "1",
    "common-13": "2", "common-14": "1", "common-15": "1", "common-16": "52", "common-17": "15", "common-18": "19",
    "common-19": "9", "common-20": "14", "common-21": "2", "common-22": "13",
    "statistics-23": "4", "statistics-24": "3", "statistics-25": "5", "statistics-26": "2", "statistics-27": "2",
    "statistics-28": "3", "statistics-29": "16", "statistics-30": "38",
    "calculus-23": "2", "calculus-24": "4", "calculus-25": "3", "calculus-26": "5", "calculus-27": "2",
    "calculus-28": "3", "calculus-29": "17", "calculus-30": "193",
    "geometry-23": "4", "geometry-24": "3", "geometry-25": "2", "geometry-26": "5", "geometry-27": "2",
    "geometry-28": "3", "geometry-29": "124", "geometry-30": "104",
  };

  const state = {
    currentId: "common-01",
    selected: new Map(),
    revealed: new Set(),
    results: new Map(),
  };

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function normalizeShortAnswer(value) {
    const trimmed = String(value ?? "").trim();
    return trimmed.replace(/^0+(?=\d)/, "");
  }

  function validateData() {
    if (!data || !Array.isArray(data.sections) || !Array.isArray(data.questions)) {
      throw new Error("풀이 데이터를 불러오지 못했습니다.");
    }

    const expectedSectionCounts = { common: 22, statistics: 8, calculus: 8, geometry: 8 };
    const ids = new Set();

    if (data.questions.length !== 46) {
      throw new Error(`문항 수가 46개가 아닙니다: ${data.questions.length}`);
    }

    data.questions.forEach((question) => {
      if (ids.has(question.id)) throw new Error(`중복 문항 ID: ${question.id}`);
      ids.add(question.id);
      if (!(question.section in expectedSectionCounts)) throw new Error(`알 수 없는 과목: ${question.section}`);
      if (String(question.answer) !== expectedAnswers[question.id]) throw new Error(`답안 불일치: ${question.id}`);
      if (!question.image || !question.firstMove || !question.trap || !question.transfer || question.steps.length < 2) {
        throw new Error(`풀이 필수 항목 누락: ${question.id}`);
      }
    });

    Object.entries(expectedSectionCounts).forEach(([section, count]) => {
      const actual = data.questions.filter((question) => question.section === section).length;
      if (actual !== count) throw new Error(`${section} 문항 수 불일치: ${actual}`);
    });
  }

  function getQuestion(id) {
    return data.questions.find((question) => question.id === id) || data.questions[0];
  }

  function sectionQuestions(sectionId) {
    return data.questions.filter((question) => question.section === sectionId);
  }

  function selectedValue(question) {
    return state.selected.get(question.id) || "";
  }

  function resultState(question) {
    return state.results.get(question.id) || "";
  }

  function setCurrent(id, updateHash = true) {
    if (!data.questions.some((question) => question.id === id)) return;
    state.currentId = id;
    if (updateHash) history.replaceState(null, "", `#${id}`);
    render();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function catalogMarkup(question) {
    const sections = data.sections.map((section) => {
      const active = section.id === question.section;
      return `
        <button class="catalog__section-button" type="button" data-action="section" data-section="${section.id}" aria-current="${active}">
          <span>${escapeHtml(section.label)}</span><span>${section.count}문항</span>
        </button>`;
    }).join("");

    const numbers = sectionQuestions(question.section).map((item) => {
      const active = item.id === question.id;
      const result = resultState(item);
      return `
        <button class="catalog__number" type="button" data-action="question" data-id="${item.id}" data-state="${result}" aria-current="${active}" aria-label="${item.number}번">
          ${item.number}
        </button>`;
    }).join("");

    return `
      <aside class="catalog" aria-label="문항 목록">
        <div class="catalog__head"><span>QUESTION CATALOG</span><strong>문항 찾아보기</strong></div>
        <div class="catalog__sections">${sections}</div>
        <div class="catalog__numbers">${numbers}</div>
      </aside>`;
  }

  function answerInputMarkup(question) {
    const selected = selectedValue(question);
    if (question.responseType === "choice") {
      return `
        <div class="answer-choices" role="group" aria-label="답 선택">
          ${[1, 2, 3, 4, 5].map((choice) => `
            <button class="answer-choice" type="button" data-action="select-choice" data-value="${choice}" aria-pressed="${selected === String(choice)}">
              ${answerMarks[choice]}
            </button>`).join("")}
        </div>`;
    }

    return `
      <input class="short-answer" type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="off" data-action="short-answer"
        value="${escapeHtml(selected)}" aria-label="단답 입력" placeholder="숫자로 답을 입력하세요" />`;
  }

  function resultMarkup(question) {
    if (!state.revealed.has(question.id)) return "";
    const selected = selectedValue(question);
    const result = resultState(question);
    const answerActionLabel = question.responseType === "choice" ? "선택한 답" : "입력한 답";

    if (!selected) {
      return `<div class="answer-result answer-result--neutral">정답은 ${escapeHtml(question.answerLabel)}입니다. 풀이의 첫 발상부터 확인하세요.</div>`;
    }

    if (result === "correct") {
      return `<div class="answer-result answer-result--correct">정답입니다. ${answerActionLabel} ${escapeHtml(question.responseType === "choice" ? answerMarks[Number(selected)] : selected)} · 정답 ${escapeHtml(question.answerLabel)}</div>`;
    }

    return `<div class="answer-result answer-result--wrong">다시 확인해 보세요. ${answerActionLabel} ${escapeHtml(question.responseType === "choice" ? answerMarks[Number(selected)] : selected)} · 정답 ${escapeHtml(question.answerLabel)}</div>`;
  }

  function solutionMarkup(question) {
    if (!state.revealed.has(question.id)) {
      return `
        <div class="solution solution--locked">
          <div class="solution__placeholder"><strong>풀이를 아직 열지 않았습니다.</strong>답을 선택해 확인하거나 ‘바로 풀이 보기’를 누르면 첫 발상부터 단계별로 볼 수 있습니다.</div>
        </div>`;
    }

    return `
      <div class="solution">
        <div class="solution__verify">공식 답안과 독립 풀이 일치</div>
        <span class="solution__concept">${escapeHtml(question.concept)}</span>
        <h2 class="solution__answer">정답 ${escapeHtml(question.answerLabel)}</h2>

        <section class="solution-block">
          <h3>첫 발상</h3>
          <p>${escapeHtml(question.firstMove)}</p>
        </section>

        <section class="solution-block">
          <h3>단계별 풀이</h3>
          <ol class="solution-steps">
            ${question.steps.map((step, index) => `
              <li class="solution-step"><span class="solution-step__number">${index + 1}</span><span>${escapeHtml(step)}</span></li>`).join("")}
          </ol>
        </section>

        <div class="solution-note solution-note--trap"><strong>실수 방지</strong><p>${escapeHtml(question.trap)}</p></div>
        <div class="solution-note solution-note--transfer"><strong>다른 문제에 적용</strong><p>${escapeHtml(question.transfer)}</p></div>
      </div>`;
  }

  function render() {
    const question = getQuestion(state.currentId);
    const section = data.sections.find((item) => item.id === question.section);
    const globalIndex = data.questions.findIndex((item) => item.id === question.id);
    const sectionList = sectionQuestions(question.section);
    const sectionIndex = sectionList.findIndex((item) => item.id === question.id);
    const selected = selectedValue(question);
    const previous = data.questions[globalIndex - 1];
    const next = data.questions[globalIndex + 1];
    const revealed = state.revealed.has(question.id);

    app.innerHTML = `
      <header class="topbar">
        <div class="topbar__inner">
          <div class="brand"><span class="brand__mark"></span><div class="brand__copy"><strong>지니쌤과 공부하자</strong><span>사관학교 수학 풀이 뷰어</span></div></div>
          <span class="topbar__status">내부 검수용 · 공개 연결 전</span>
        </div>
      </header>

      <section class="hero">
        <p class="hero__eyebrow">2027 MILITARY ACADEMY · MATHEMATICS</p>
        <h1>${escapeHtml(data.meta.title)} 풀이 뷰어</h1>
        <p class="hero__lead">원본 문제를 그대로 읽고 답을 확인한 뒤, 첫 발상·단계별 계산·실수 방지·전이 규칙까지 이어서 학습합니다.</p>
        <div class="hero__facts">
          <span class="hero__fact">공통 22문항</span><span class="hero__fact">선택과목별 8문항</span><span class="hero__fact">총 46문항</span><span class="hero__fact">공식 답안 대조 완료</span>
        </div>
      </section>

      <div class="workspace">
        ${catalogMarkup(question)}
        <main class="viewer">
          <div class="viewer__progress-card">
            <div class="viewer__progress-copy"><strong>${escapeHtml(section.label)} ${sectionIndex + 1} / ${sectionList.length}</strong><span>전체 ${globalIndex + 1} / ${data.questions.length}</span></div>
            <div class="viewer__progress" role="progressbar" aria-valuemin="1" aria-valuemax="${data.questions.length}" aria-valuenow="${globalIndex + 1}"><div class="viewer__progress-fill" style="width:${((globalIndex + 1) / data.questions.length) * 100}%"></div></div>
          </div>

          <div class="viewer__grid">
            <article class="card problem-card">
              <div class="problem-card__top">
                <div><span class="problem-card__badge">${escapeHtml(section.label)}</span><h2 class="problem-card__title">${question.number}번 · ${escapeHtml(question.concept)}</h2></div>
                <span class="problem-card__meta">${question.points}점 · ${question.responseType === "choice" ? "선택형" : "단답형"}</span>
              </div>
              <div class="problem-card__image-wrap"><img class="problem-card__image" src="${escapeHtml(question.image)}" alt="2027학년도 사관학교 수학 ${escapeHtml(section.label)} ${question.number}번 원본 문제" /></div>
              <div class="problem-card__source">제공된 문제지 PDF의 원본 조판을 문항 단위로 표시했습니다.</div>
            </article>

            <aside class="card study-panel" aria-label="답과 풀이">
              <div class="study-panel__answer">
                <p class="study-panel__eyebrow">YOUR ANSWER</p>
                <h2>${question.responseType === "choice" ? "답을 선택하세요" : "답을 입력하세요"}</h2>
                ${answerInputMarkup(question)}
                <div class="answer-actions">
                  <button class="action-button action-button--primary" type="button" data-action="check" ${selected ? "" : "disabled"}>정답 확인</button>
                  <button class="action-button action-button--secondary" type="button" data-action="reveal">${revealed ? "풀이 다시 보기" : "바로 풀이 보기"}</button>
                </div>
                ${resultMarkup(question)}
              </div>
              ${solutionMarkup(question)}
            </aside>
          </div>

          <div class="viewer__navigation">
            <button class="nav-button" type="button" data-action="previous" ${previous ? "" : "disabled"}>← 이전 문항</button>
            <button class="nav-button" type="button" data-action="next" ${next ? "" : "disabled"}>다음 문항 →</button>
          </div>
        </main>
      </div>`;

    attachEvents();
  }

  function attachEvents() {
    app.querySelectorAll('[data-action="section"]').forEach((button) => {
      button.addEventListener("click", () => setCurrent(sectionQuestions(button.dataset.section)[0].id));
    });

    app.querySelectorAll('[data-action="question"]').forEach((button) => {
      button.addEventListener("click", () => setCurrent(button.dataset.id));
    });

    app.querySelectorAll('[data-action="select-choice"]').forEach((button) => {
      button.addEventListener("click", () => {
        state.selected.set(state.currentId, button.dataset.value);
        state.revealed.delete(state.currentId);
        state.results.delete(state.currentId);
        render();
      });
    });

    const shortInput = app.querySelector('[data-action="short-answer"]');
    if (shortInput) {
      shortInput.addEventListener("input", (event) => {
        const digits = event.target.value.replace(/[^0-9]/g, "");
        event.target.value = digits;
        if (digits) state.selected.set(state.currentId, digits);
        else state.selected.delete(state.currentId);
        state.revealed.delete(state.currentId);
        state.results.delete(state.currentId);
        const checkButton = app.querySelector('[data-action="check"]');
        if (checkButton) checkButton.disabled = !digits;
      });
    }

    app.querySelector('[data-action="check"]')?.addEventListener("click", () => {
      const question = getQuestion(state.currentId);
      const selected = question.responseType === "short" ? normalizeShortAnswer(selectedValue(question)) : selectedValue(question);
      state.selected.set(question.id, selected);
      state.results.set(question.id, selected === String(question.answer) ? "correct" : "wrong");
      state.revealed.add(question.id);
      render();
    });

    app.querySelector('[data-action="reveal"]')?.addEventListener("click", () => {
      state.revealed.add(state.currentId);
      render();
    });

    app.querySelector('[data-action="previous"]')?.addEventListener("click", () => {
      const index = data.questions.findIndex((question) => question.id === state.currentId);
      if (index > 0) setCurrent(data.questions[index - 1].id);
    });

    app.querySelector('[data-action="next"]')?.addEventListener("click", () => {
      const index = data.questions.findIndex((question) => question.id === state.currentId);
      if (index < data.questions.length - 1) setCurrent(data.questions[index + 1].id);
    });
  }

  function showError(error) {
    app.innerHTML = `<div class="error-state"><strong>뷰어를 열 수 없습니다.</strong><p>${escapeHtml(error.message)}</p></div>`;
    console.error(error);
  }

  try {
    validateData();
    const hashId = window.location.hash.replace(/^#/, "");
    if (hashId && data.questions.some((question) => question.id === hashId)) state.currentId = hashId;
    window.addEventListener("hashchange", () => {
      const nextId = window.location.hash.replace(/^#/, "");
      if (nextId && nextId !== state.currentId && data.questions.some((question) => question.id === nextId)) {
        state.currentId = nextId;
        render();
      }
    });
    render();
  } catch (error) {
    showError(error);
  }
})();
