import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = path.resolve(SCRIPT_DIRECTORY, "../..");
const CANDIDATE_DIRECTORY = path.join(REPOSITORY_ROOT, "english", "data", "candidates");
const OFFICIAL_PROBLEM_DIRECTORY = path.join(REPOSITORY_ROOT, "raw_sources", "english_eval_pdfs");
const DEFAULT_SOURCE = path.join(
  CANDIDATE_DIRECTORY,
  "english_2027_09_fulltext_review_export.json",
);

const PAGE_BREAK_PATTERN = /^--?\s*\d+\s+of\s+\d+\s*--?$/;
const CORRUPTED_COPYRIGHT_PREFIX = "㢨ٻⱬ";
const BROKEN_CHOICE_TABLE_QUESTION_IDS = new Set(["2027_09_36", "2027_09_37", "2027_09_43"]);
const REQUIRED_VISUALS = new Map([
  ["2027_09_25", { fileName: "q25-figure.png", alt: "연령대별 식단 선택 비율 도표", sha256: "cc3bc79bfe1ab8ae66efac30ff188908eb2102590b951685f16d1824ffa59ef5" }],
  ["2027_09_27", { fileName: "q27-notice.png", alt: "교내 음식물 쓰레기 감축 대회 안내문", sha256: "cf761f86ec5a4a158ee45e5e9309f894bb9bdee952e678a35b81626900e90c45" }],
  ["2027_09_28", { fileName: "q28-notice.png", alt: "성우 과정 안내문", sha256: "471aa3c42bc28148d5de73b5210dee7b9521e1d29d927ac77d42f4234736e4ea" }],
]);

function sha256File(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function assertOfficialProblemSource(sourceData) {
  const artifact = sourceData.sourceArtifacts?.problem;
  if (!artifact?.filename || !artifact?.sha256) {
    throw new Error("공식 영어 문제지 출처 정보가 없습니다.");
  }
  const sourcePath = path.join(OFFICIAL_PROBLEM_DIRECTORY, artifact.filename);
  if (!existsSync(sourcePath)) throw new Error(`공식 영어 문제지가 없습니다: ${artifact.filename}`);
  const actualSha256 = sha256File(sourcePath);
  if (actualSha256 !== artifact.sha256) {
    throw new Error(`공식 영어 문제지 SHA 불일치: ${artifact.filename}`);
  }
  return actualSha256;
}

function normalizeDisplayGlyphs(value) {
  return String(value ?? "")
    .replaceAll("\t", " ")
    .replaceAll("\uF03B", "↓")
    .replace(/[ ]{2,}/g, " ");
}

function rangeHeaderExcludesQuestion(line, qid) {
  const match = line.match(/^\[(\d{1,2})\s*[～~\-]\s*(\d{1,2})\]/);
  if (!match || !Number.isInteger(qid)) return false;
  const start = Number(match[1]);
  const end = Number(match[2]);
  return qid < start || qid > end;
}

export function cleanReviewText(value, { qid } = {}) {
  const keptLines = [];
  let removedLineCount = 0;

  for (const originalLine of String(value ?? "").split(/\r?\n/)) {
    const line = normalizeDisplayGlyphs(originalLine);
    const trimmed = line.trim();
    if (
      PAGE_BREAK_PATTERN.test(trimmed) ||
      trimmed.startsWith("이제 듣기 문제가 끝났습니다.") ||
      /^\*\s*확인 사항$/.test(trimmed) ||
      rangeHeaderExcludesQuestion(trimmed, qid)
    ) {
      removedLineCount += 1;
      break;
    }
    if (
      trimmed === "이 문제지에 관한 저작권은 한국교육과정평가원에 있습니다." ||
      trimmed.startsWith(CORRUPTED_COPYRIGHT_PREFIX)
    ) {
      removedLineCount += 1;
      continue;
    }
    keptLines.push(line);
  }

  while (keptLines.length && !keptLines.at(-1).trim()) keptLines.pop();
  return { text: keptLines.join("\n"), removedLineCount };
}

function stripBrokenChoiceTable(value) {
  const markerIndex = value.search(/\n\s*①\s*\n/);
  return markerIndex >= 0 ? value.slice(0, markerIndex).trimEnd() : value;
}

function visualForQuestion(question) {
  const visual = REQUIRED_VISUALS.get(question.id);
  if (!visual) return null;
  const examAssetDirectory = path.join(REPOSITORY_ROOT, "english", "assets", "2027-09");
  const assetPath = path.join(examAssetDirectory, visual.fileName);
  if (!existsSync(assetPath)) {
    throw new Error(`${question.id}: 공식 문제 시각자료가 없습니다: ${visual.fileName}`);
  }
  const actualSha256 = sha256File(assetPath);
  if (actualSha256 !== visual.sha256) {
    throw new Error(`${question.id}: 공식 문제 시각자료 SHA 불일치: ${visual.fileName}`);
  }
  return {
    alt: visual.alt,
    fileName: visual.fileName,
    src: `data:image/png;base64,${readFileSync(assetPath).toString("base64")}`,
  };
}

export function prepareQuestionForReview(question) {
  const raw = cleanReviewText(question.rawText, { qid: question.qid });
  const shared = cleanReviewText(question.sharedPassage, { qid: question.qid });
  let questionText = raw.text;
  const usesStructuredChoices = BROKEN_CHOICE_TABLE_QUESTION_IDS.has(question.id);
  if (usesStructuredChoices) questionText = stripBrokenChoiceTable(questionText);
  const displaySource = [shared.text, questionText].filter(Boolean).join("\n\n");

  return {
    ...question,
    rawText: raw.text,
    sharedPassage: shared.text,
    sourceTextForReview: undefined,
    displaySource,
    usesStructuredChoices,
    visual: visualForQuestion(question),
    removedLineCount: raw.removedLineCount + shared.removedLineCount,
  };
}

export function auditPreparedQuestion(question) {
  const issues = [];
  const suspiciousGlyph = question.displaySource.match(/[�\u0600-\u06ff\u3400-\u4dbf\ue000-\uf8ff]/u);
  if (suspiciousGlyph) issues.push(`깨진 문자 ${JSON.stringify(suspiciousGlyph[0])}`);
  if (PAGE_BREAK_PATTERN.test(question.displaySource)) issues.push("PDF 쪽 경계 표기");
  if (/저작권은 한국교육과정평가원|이제 듣기 문제가 끝났습니다|확인 사항/.test(question.displaySource)) {
    issues.push("시험 운영 문구");
  }
  const questionHeaders = [...question.displaySource.matchAll(/^\s*(\d{1,2})\.\s/gm)].map((match) => Number(match[1]));
  const foreignHeaders = questionHeaders.filter((qid) => qid !== question.qid);
  if (foreignHeaders.length) issues.push(`다른 문항 번호 ${[...new Set(foreignHeaders)].join(",")}`);
  const rangeHeaders = [...question.displaySource.matchAll(/^\[(\d{1,2})\s*[～~\-]\s*(\d{1,2})\]/gm)];
  if (rangeHeaders.some((match) => question.qid < Number(match[1]) || question.qid > Number(match[2]))) {
    issues.push("다른 문제군 안내");
  }
  if (!question.displaySource.trim()) issues.push("표시 원문 없음");
  if (!Array.isArray(question.choices) || question.choices.length !== 5) issues.push("선지 5개 불충족");
  if (!question.review?.fullTranslation?.trim()) issues.push("전체 해석 없음");
  if (REQUIRED_VISUALS.has(question.id) && !question.visual?.src) issues.push("필수 시각자료 없음");
  return issues;
}

export function validateReviewExport(data, sourcePath = "review export") {
  if (data?.schemaVersion !== "english-fulltext-review-export-v1") {
    throw new Error(`${sourcePath}: 지원하지 않는 검수 export 형식입니다.`);
  }
  if (data.status !== "internal_review_only" || data.publicConnected !== false) {
    throw new Error(`${sourcePath}: 내부 검수 전용 잠금이 확인되지 않았습니다.`);
  }
  if (!Array.isArray(data.questions) || data.questions.length === 0) {
    throw new Error(`${sourcePath}: 검수할 문항이 없습니다.`);
  }

  const ids = new Set();
  for (const question of data.questions) {
    if (!question?.id || ids.has(question.id)) {
      throw new Error(`${sourcePath}: 문항 ID가 없거나 중복됩니다.`);
    }
    ids.add(question.id);
    if (!Number.isInteger(question.qid) || !question.rawText?.trim()) {
      throw new Error(`${sourcePath}: ${question.id}의 번호 또는 원문이 비어 있습니다.`);
    }
    if (!question.review?.fullTranslation?.trim()) {
      throw new Error(`${sourcePath}: ${question.id}의 전체 해석이 비어 있습니다.`);
    }
  }
}

function assertInternalSource(sourcePath) {
  const absoluteSource = path.resolve(sourcePath);
  const relative = path.relative(CANDIDATE_DIRECTORY, absoluteSource);
  if (
    relative.startsWith("..") ||
    path.isAbsolute(relative) ||
    !path.basename(absoluteSource).includes("fulltext_review_export")
  ) {
    throw new Error("검수 페이지 입력은 english/data/candidates의 fulltext_review_export만 허용합니다.");
  }
  return absoluteSource;
}

function assertOutputOutsideRepository(outputPath) {
  const absoluteOutput = path.resolve(outputPath);
  const relative = path.relative(REPOSITORY_ROOT, absoluteOutput);
  if (!relative.startsWith("..") && !path.isAbsolute(relative)) {
    throw new Error("검수 페이지는 저장소 밖에만 생성할 수 있습니다. 공개 산출물 유입을 차단했습니다.");
  }
  return absoluteOutput;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function safeInlineJson(value) {
  return JSON.stringify(value)
    .replaceAll("<", "\\u003c")
    .replaceAll("\u2028", "\\u2028")
    .replaceAll("\u2029", "\\u2029");
}

function buildTemplate(pageData) {
  const examTitle = pageData.scope?.exam || "영어 해설 검수";
  const questionRange = pageData.scope?.questionRange || "전체";
  const questionCount = pageData.questions.length;
  const title = `${examTitle} 해설`;
  const dataJson = safeInlineJson(pageData);

  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex,nofollow,noarchive">
  <title>${escapeHtml(title)}</title>
  <style>
    :root {
      color-scheme: light;
      --ink: #17233b;
      --muted: #657188;
      --line: #d8e0eb;
      --canvas: #f3f6fa;
      --paper: #ffffff;
      --blue: #315f9f;
      --blue-soft: #e8f0fb;
      --green: #176a59;
      --green-soft: #e4f2ed;
      --coral: #934536;
      --coral-soft: #faebe7;
      --shadow: 0 22px 60px rgba(25, 39, 66, 0.09);
    }
    * { box-sizing: border-box; }
    html { scroll-behavior: smooth; }
    body {
      margin: 0;
      background: var(--canvas);
      color: var(--ink);
      font-family: Pretendard, "Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif;
      line-height: 1.65;
    }
    button, input { font: inherit; }
    button { color: inherit; }
    .skip-link { position: fixed; left: 16px; top: -80px; z-index: 100; border-radius: 10px; background: var(--ink); color: white; padding: 10px 14px; }
    .skip-link:focus { top: 16px; }
    .shell { min-height: 100vh; display: grid; grid-template-columns: 310px minmax(0, 1fr); }
    .rail { position: sticky; top: 0; height: 100vh; overflow: auto; border-right: 1px solid var(--line); background: #f9fafc; padding: 30px 24px 24px; }
    .eyebrow { margin: 0 0 9px; color: var(--blue); font: 850 0.72rem/1.2 ui-monospace, "Cascadia Code", monospace; letter-spacing: 0.12em; text-transform: uppercase; }
    .rail h1 { margin: 0; font-size: clamp(1.35rem, 2.2vw, 1.8rem); line-height: 1.3; letter-spacing: -0.045em; word-break: keep-all; }
    .rail-copy { margin: 12px 0 22px; color: var(--muted); font-size: 0.86rem; word-break: keep-all; }
    .search-label { display: block; margin-bottom: 8px; color: var(--muted); font-size: 0.74rem; font-weight: 800; }
    .search { width: 100%; border: 1px solid var(--line); border-radius: 11px; background: white; padding: 11px 12px; outline: none; }
    .search:focus-visible, button:focus-visible { outline: 3px solid #aac5ec; outline-offset: 2px; }
    .question-list { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 7px; margin: 18px 0 0; }
    .question-button { min-height: 40px; border: 1px solid var(--line); border-radius: 9px; background: white; cursor: pointer; font-weight: 820; transition: 140ms ease; }
    .question-button:hover { border-color: #8fa8cc; transform: translateY(-1px); }
    .question-button[aria-current="true"] { border-color: var(--blue); background: var(--blue); color: white; }
    .question-button[hidden] { display: none; }
    .rail-foot { margin: 22px 0 0; border-top: 1px solid var(--line); padding-top: 15px; color: var(--muted); font-size: 0.75rem; }
    .stage { min-width: 0; padding: 42px clamp(24px, 5vw, 78px) 72px; }
    .toolbar { width: min(980px, 100%); margin: 0 auto 18px; display: flex; align-items: center; justify-content: space-between; gap: 16px; }
    .status-line { color: var(--muted); font-size: 0.82rem; font-weight: 760; }
    .print-button { border: 1px solid var(--line); border-radius: 10px; background: white; padding: 8px 13px; cursor: pointer; font-weight: 760; }
    .viewer { width: min(980px, 100%); margin: 0 auto; border: 1px solid var(--line); border-radius: 22px; background: var(--paper); box-shadow: var(--shadow); overflow: hidden; }
    .question-head { display: grid; grid-template-columns: 92px minmax(0, 1fr) auto; align-items: stretch; border-bottom: 1px solid var(--line); }
    .question-number { display: grid; place-items: center; background: var(--ink); color: white; font-family: Georgia, "Times New Roman", serif; font-size: 2rem; font-weight: 700; }
    .question-title { min-width: 0; padding: 21px 24px; }
    .question-title p { margin: 0 0 4px; color: var(--blue); font-size: 0.74rem; font-weight: 850; letter-spacing: 0.08em; }
    .question-title h2 { margin: 0; font-size: 1.18rem; line-height: 1.45; letter-spacing: -0.025em; }
    .answer-chip { align-self: center; margin-right: 22px; border-radius: 999px; background: var(--green-soft); color: var(--green); padding: 8px 13px; font-size: 0.8rem; font-weight: 900; white-space: nowrap; }
    .section { padding: 30px clamp(22px, 4vw, 44px); }
    .section + .section { border-top: 1px solid var(--line); }
    .section-kicker { margin: 0 0 12px; color: var(--muted); font: 850 0.72rem/1.3 ui-monospace, "Cascadia Code", monospace; letter-spacing: 0.1em; }
    .source-text { margin: 0; color: #1d2a43; font-family: Georgia, "Times New Roman", "Malgun Gothic", serif; font-size: 1.02rem; line-height: 1.78; white-space: pre-wrap; overflow-wrap: anywhere; }
    .source-visual { display: block; width: min(100%, 760px); height: auto; margin: 0 auto 24px; border: 1px solid #c8d0db; background: white; }
    .structured-choices { display: grid; gap: 8px; margin: 22px 0 0; padding: 0; list-style: none; }
    .structured-choices li { display: grid; grid-template-columns: 2rem minmax(0, 1fr); gap: 8px; border-top: 1px solid var(--line); padding-top: 8px; font-family: Georgia, "Times New Roman", "Malgun Gothic", serif; }
    .choice-mark { color: var(--blue); font-weight: 800; }
    .translation { margin: 0; color: #3f4c61; font-size: 0.95rem; line-height: 1.82; }
    .explanation { background: #fbfcfe; }
    .summary { margin: 0 0 22px; font-size: 1.06rem; font-weight: 780; }
    .logic-strip { display: grid; grid-template-columns: minmax(0, 1fr) 34px minmax(0, 1fr) 34px minmax(0, 1fr); margin: 0 0 22px; }
    .logic-card { min-width: 0; border: 1px solid var(--line); border-radius: 13px; background: white; padding: 16px; }
    .logic-card strong { display: block; margin-bottom: 7px; color: var(--blue); font-size: 0.76rem; }
    .logic-card p, .logic-card blockquote { margin: 0; color: #445168; font-size: 0.86rem; line-height: 1.65; }
    .logic-card blockquote { color: var(--ink); font-family: Georgia, "Times New Roman", serif; }
    .logic-arrow { display: grid; place-items: center; color: #9aa8bc; font-weight: 900; }
    .evidence-list { display: grid; gap: 10px; margin-bottom: 22px; }
    .notes-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .note { border-radius: 13px; padding: 17px 18px; }
    .note h3 { margin: 0 0 7px; font-size: 0.82rem; }
    .note p { margin: 0; font-size: 0.88rem; line-height: 1.7; }
    .note--approach { background: var(--blue-soft); color: #274977; }
    .note--trap { background: var(--coral-soft); color: #74382e; }
    .pager { width: min(980px, 100%); margin: 18px auto 0; display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .pager button { min-height: 48px; border: 1px solid var(--line); border-radius: 12px; background: white; cursor: pointer; font-weight: 820; }
    .pager button:disabled { cursor: default; opacity: 0.42; }
    .empty { padding: 80px 20px; text-align: center; color: var(--muted); }
    @media (max-width: 820px) {
      .shell { display: block; }
      .rail { position: static; height: auto; border-right: 0; border-bottom: 1px solid var(--line); padding: 22px 18px; }
      .rail-copy, .rail-foot { display: none; }
      .question-list { grid-template-columns: repeat(7, minmax(0, 1fr)); }
      .stage { padding: 22px 14px 46px; }
      .question-head { grid-template-columns: 66px minmax(0, 1fr); }
      .question-number { font-size: 1.5rem; }
      .question-title { padding: 17px 16px; }
      .answer-chip { grid-column: 1 / -1; justify-self: start; margin: 0 16px 14px; }
      .logic-strip { grid-template-columns: 1fr; gap: 8px; }
      .logic-arrow { transform: rotate(90deg); min-height: 20px; }
      .notes-grid { grid-template-columns: 1fr; }
    }
    @media (max-width: 480px) {
      .question-list { grid-template-columns: repeat(5, minmax(0, 1fr)); }
      .toolbar { align-items: flex-start; }
      .section { padding: 24px 19px; }
      .source-text { font-size: 0.96rem; }
    }
    @media (prefers-reduced-motion: reduce) { html { scroll-behavior: auto; } .question-button { transition: none; } }
    @media print { body { background: white; } .rail, .toolbar, .pager { display: none !important; } .shell { display: block; } .stage { padding: 0; } .viewer { width: 100%; border: 0; box-shadow: none; } .section { break-inside: avoid; } }
  </style>
</head>
<body>
  <a class="skip-link" href="#question-viewer">해설로 바로가기</a>
  <div class="shell">
    <aside class="rail" aria-label="문항 목록">
      <p class="eyebrow">Internal review desk</p>
      <h1>${escapeHtml(examTitle)}<br>해설</h1>
      <p class="rail-copy">문항을 고르면 원문, 전체 해석, 근거와 오답 함정을 한 화면에서 확인합니다.</p>
      <label class="search-label" for="question-search">번호·유형·본문 검색</label>
      <input class="search" id="question-search" type="search" placeholder="예: 34, 빈칸, invitation">
      <nav class="question-list" id="question-list" aria-label="${escapeHtml(questionRange)} 문항"></nav>
      <p class="rail-foot">내부 검수 전용 · ${questionCount}문항 · 외부 공유 금지</p>
    </aside>
    <main class="stage">
      <div class="toolbar">
        <div class="status-line" id="status-line">문항을 불러오는 중입니다.</div>
        <button class="print-button" id="print-button" type="button">현재 문항 인쇄</button>
      </div>
      <article class="viewer" id="question-viewer" tabindex="-1"></article>
      <div class="pager"><button id="previous-button" type="button">이전 문항</button><button id="next-button" type="button">다음 문항</button></div>
    </main>
  </div>
  <script>
    const REVIEW_DATA = ${dataJson};
    const questions = REVIEW_DATA.questions || [];
    let visibleQuestions = questions.slice();
    let currentQuestion = null;
    const questionList = document.getElementById("question-list");
    const viewer = document.getElementById("question-viewer");
    const statusLine = document.getElementById("status-line");
    const searchInput = document.getElementById("question-search");
    const previousButton = document.getElementById("previous-button");
    const nextButton = document.getElementById("next-button");

    function element(tag, className, text) {
      const node = document.createElement(tag);
      if (className) node.className = className;
      if (text !== undefined && text !== null) node.textContent = text;
      return node;
    }
    function makeLogicCard(label, text, quote) {
      const card = element("div", "logic-card");
      card.appendChild(element("strong", "", label));
      card.appendChild(element(quote ? "blockquote" : "p", "", text));
      return card;
    }
    function renderNavigation() {
      questionList.replaceChildren();
      questions.forEach((question) => {
        const button = element("button", "question-button", String(question.qid));
        button.type = "button";
        button.hidden = !visibleQuestions.some((item) => item.id === question.id);
        button.setAttribute("aria-label", String(question.qid) + "번 " + question.type);
        button.setAttribute("aria-current", currentQuestion?.id === question.id ? "true" : "false");
        button.addEventListener("click", () => selectQuestion(question.id, true));
        questionList.appendChild(button);
      });
    }
    function renderQuestion(question) {
      viewer.replaceChildren();
      if (!question) {
        viewer.appendChild(element("div", "empty", "검색 결과가 없습니다. 번호나 검색어를 바꿔보세요."));
        statusLine.textContent = "검색 결과 0문항";
        previousButton.disabled = true;
        nextButton.disabled = true;
        return;
      }
      const review = question.review || {};
      const head = element("header", "question-head");
      head.appendChild(element("div", "question-number", String(question.qid)));
      const titleNode = element("div", "question-title");
      titleNode.appendChild(element("p", "", question.type || "영어"));
      const readableStem = question.stem && question.stem !== String(question.qid) + "." ? question.stem : String(question.qid) + ". " + question.type;
      titleNode.appendChild(element("h2", "", readableStem));
      head.appendChild(titleNode);
      head.appendChild(element("div", "answer-chip", "정답 " + (question.answerMark || question.answer)));
      viewer.appendChild(head);

      const sourceSection = element("section", "section");
      sourceSection.appendChild(element("p", "section-kicker", "ORIGINAL · 문제 원문"));
      if (question.visual) {
        const image = element("img", "source-visual");
        image.src = question.visual.src;
        image.alt = question.visual.alt;
        sourceSection.appendChild(image);
      }
      sourceSection.appendChild(element("pre", "source-text", question.displaySource || ""));
      if (question.usesStructuredChoices) {
        const list = element("ol", "structured-choices");
        question.choices.forEach((choice) => {
          const item = element("li");
          item.appendChild(element("span", "choice-mark", choice.mark));
          item.appendChild(element("span", "", choice.text));
          list.appendChild(item);
        });
        sourceSection.appendChild(list);
      }
      viewer.appendChild(sourceSection);
      const translationSection = element("section", "section");
      translationSection.appendChild(element("p", "section-kicker", "FULL TRANSLATION · 전체 해석"));
      translationSection.appendChild(element("p", "translation", review.fullTranslation || "전체 해석이 없습니다."));
      viewer.appendChild(translationSection);

      const explanationSection = element("section", "section explanation");
      explanationSection.appendChild(element("p", "section-kicker", "TEACHING LOGIC · 해설 흐름"));
      explanationSection.appendChild(element("p", "summary", review.summary || ""));
      const evidence = (review.evidence || [])[0] || {};
      const logic = element("div", "logic-strip");
      logic.appendChild(makeLogicCard("1. 원문 근거", evidence.quote || "근거 문장을 확인하세요.", true));
      logic.appendChild(element("div", "logic-arrow", "→"));
      logic.appendChild(makeLogicCard("2. 근거 해석", evidence.translation || "근거의 뜻을 문맥에 맞게 연결합니다."));
      logic.appendChild(element("div", "logic-arrow", "→"));
      logic.appendChild(makeLogicCard("3. 정답 판단", review.correctReason || "정답 근거를 확인하세요."));
      explanationSection.appendChild(logic);
      if ((review.evidence || []).length > 1) {
        const extraEvidence = element("div", "evidence-list");
        review.evidence.slice(1).forEach((item, index) => extraEvidence.appendChild(makeLogicCard("추가 근거 " + (index + 2), item.quote + " — " + item.translation, true)));
        explanationSection.appendChild(extraEvidence);
      }
      const notes = element("div", "notes-grid");
      const approach = element("section", "note note--approach");
      approach.appendChild(element("h3", "", "이 유형은 이렇게 풉니다"));
      approach.appendChild(element("p", "", review.typeApproach || "유형별 풀이를 확인하세요."));
      notes.appendChild(approach);
      const trap = element("section", "note note--trap");
      trap.appendChild(element("h3", "", "가장 헷갈리는 선지 " + (review.trap?.mark || "")));
      trap.appendChild(element("p", "", review.trap?.reason || "오답 함정 설명이 없습니다."));
      notes.appendChild(trap);
      explanationSection.appendChild(notes);
      viewer.appendChild(explanationSection);

      const currentIndex = visibleQuestions.findIndex((item) => item.id === question.id);
      statusLine.textContent = String(currentIndex + 1) + " / " + String(visibleQuestions.length) + " · " + question.type;
      previousButton.disabled = currentIndex <= 0;
      nextButton.disabled = currentIndex < 0 || currentIndex >= visibleQuestions.length - 1;
    }
    function selectQuestion(questionId, updateHash) {
      currentQuestion = questions.find((question) => question.id === questionId) || visibleQuestions[0] || null;
      if (updateHash && currentQuestion) history.replaceState(null, "", "#q" + currentQuestion.qid);
      renderNavigation();
      renderQuestion(currentQuestion);
      viewer.focus({ preventScroll: true });
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    function move(offset) {
      const index = visibleQuestions.findIndex((item) => item.id === currentQuestion?.id);
      const nextQuestion = visibleQuestions[index + offset];
      if (nextQuestion) selectQuestion(nextQuestion.id, true);
    }
    searchInput.addEventListener("input", () => {
      const query = searchInput.value.trim().toLocaleLowerCase("ko");
      visibleQuestions = query ? questions.filter((question) => [question.qid, question.type, question.stem, question.rawText, question.review?.fullTranslation].join(" ").toLocaleLowerCase("ko").includes(query)) : questions.slice();
      if (!visibleQuestions.some((item) => item.id === currentQuestion?.id)) currentQuestion = visibleQuestions[0] || null;
      renderNavigation();
      renderQuestion(currentQuestion);
    });
    previousButton.addEventListener("click", () => move(-1));
    nextButton.addEventListener("click", () => move(1));
    document.getElementById("print-button").addEventListener("click", () => window.print());
    document.addEventListener("keydown", (event) => { if (event.key === "/" && document.activeElement !== searchInput) { event.preventDefault(); searchInput.focus(); } });
    const initialNumber = Number((location.hash.match(/^#q([0-9]+)$/) || [])[1]);
    currentQuestion = questions.find((question) => question.qid === initialNumber) || questions[0] || null;
    renderNavigation();
    renderQuestion(currentQuestion);
  </script>
</body>
</html>`;
}

export function buildReviewPage({ sourcePath = DEFAULT_SOURCE, outputPath } = {}) {
  const safeSourcePath = assertInternalSource(sourcePath);
  const sourceText = readFileSync(safeSourcePath, "utf8");
  const sourceData = JSON.parse(sourceText);
  validateReviewExport(sourceData, safeSourcePath);
  const officialProblemSha256 = assertOfficialProblemSource(sourceData);

  let removedLineCount = 0;
  const auditRows = [];
  const pageData = {
    ...sourceData,
    questions: sourceData.questions.map((question) => {
      const prepared = prepareQuestionForReview(question);
      removedLineCount += prepared.removedLineCount;
      const issues = auditPreparedQuestion(prepared);
      auditRows.push({ id: prepared.id, issues });
      return prepared;
    }),
  };
  const failedRows = auditRows.filter((row) => row.issues.length);
  if (failedRows.length) {
    throw new Error(`문항 원문 전수 검사 실패: ${failedRows.map((row) => `${row.id}(${row.issues.join(", ")})`).join("; ")}`);
  }

  const defaultDirectory = path.join(tmpdir(), `english-review-${sourceData.exportId}`);
  const safeOutputPath = assertOutputOutsideRepository(outputPath || path.join(defaultDirectory, "index.html"));
  mkdirSync(path.dirname(safeOutputPath), { recursive: true });
  writeFileSync(safeOutputPath, buildTemplate(pageData), "utf8");

  return {
    outputPath: safeOutputPath,
    questionCount: pageData.questions.length,
    auditedQuestionCount: auditRows.length,
    visualQuestionCount: pageData.questions.filter((question) => question.visual).length,
    structuredChoiceQuestionCount: pageData.questions.filter((question) => question.usesStructuredChoices).length,
    removedLineCount,
    sourceSha256: createHash("sha256").update(sourceText).digest("hex"),
    officialProblemSha256,
  };
}

function parseArguments(argumentsList) {
  const options = {};
  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    if (argument === "--source") options.sourcePath = argumentsList[++index];
    else if (argument === "--output") options.outputPath = argumentsList[++index];
    else throw new Error(`알 수 없는 옵션: ${argument}`);
  }
  return options;
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const result = buildReviewPage(parseArguments(process.argv.slice(2)));
  console.log(JSON.stringify(result, null, 2));
}
