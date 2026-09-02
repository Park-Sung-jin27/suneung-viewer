import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { PDFParse } from "pdf-parse";

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);
const SOURCE_DIR = path.join(ROOT, "raw_sources", "english_eval_pdfs");
const MANIFEST_PATH = path.join(SOURCE_DIR, "manifest.json");
const OUT_DIR = path.join(ROOT, "english", "data");
const OUT_PATH = path.join(OUT_DIR, "english_exam_db.json");

const CIRCLED_TO_NUM = new Map([
  ["①", 1],
  ["②", 2],
  ["③", 3],
  ["④", 4],
  ["⑤", 5],
]);

const QUESTION_TYPES = new Map([
  [18, ["목적", "practical"]],
  [19, ["심경 변화", "practical"]],
  [20, ["주장", "topic"]],
  [21, ["밑줄 의미", "blank"]],
  [22, ["요지", "topic"]],
  [23, ["주제", "topic"]],
  [24, ["제목", "topic"]],
  [25, ["도표", "info"]],
  [26, ["내용 일치", "info"]],
  [27, ["안내문 일치", "info"]],
  [28, ["안내문 일치", "info"]],
  [29, ["어법", "grammar"]],
  [30, ["어휘", "vocab"]],
  [31, ["빈칸", "blank"]],
  [32, ["빈칸", "blank"]],
  [33, ["빈칸", "blank"]],
  [34, ["빈칸", "blank"]],
  [35, ["무관한 문장", "irrelevant"]],
  [36, ["순서", "order"]],
  [37, ["순서", "order"]],
  [38, ["문장 삽입", "order"]],
  [39, ["문장 삽입", "order"]],
  [40, ["요약문", "summary"]],
  [41, ["장문 제목", "long"]],
  [42, ["장문 어휘", "long"]],
  [43, ["장문 순서", "long"]],
  [44, ["장문 지칭", "long"]],
  [45, ["장문 내용", "long"]],
]);

const CORE_PATTERN_QIDS = new Set([
  20, 21, 22, 23, 24, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40,
]);

function rel(filePath) {
  return path.relative(ROOT, filePath).replaceAll(path.sep, "/");
}

function compact(text) {
  return String(text ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeText(text) {
  return String(text ?? "")
    .replaceAll("\u0000", " ")
    .replaceAll("\u3000", " ")
    .replaceAll("\ufb00", "ff")
    .replaceAll("\ufb01", "fi")
    .replaceAll("\ufb02", "fl");
}

async function readPdfText(filePath) {
  const data = await readFile(filePath);
  const parser = new PDFParse({ data });
  try {
    const result = await parser.getText();
    return normalizeText(result.text ?? "");
  } finally {
    await parser.destroy();
  }
}

function qtype(qid) {
  return QUESTION_TYPES.get(qid) ?? ["미분류", "other"];
}

function buildExamId(schoolYear, examType) {
  const suffixes = new Map([
    ["6월", "06"],
    ["9월", "09"],
    ["수능", "csat"],
  ]);
  return `${schoolYear}_${suffixes.get(examType)}`;
}

function extractAnswers(text) {
  const answers = new Map();
  const warnings = [];
  const head = normalizeText(text).slice(0, 9000);

  for (const match of head.matchAll(/(\d{1,2})\.\s*([①②③④⑤])/g)) {
    const qid = Number(match[1]);
    if (qid >= 1 && qid <= 45) answers.set(qid, CIRCLED_TO_NUM.get(match[2]));
  }

  // 평가원 당일 공개 정답표 PDF는 문항 번호 뒤에 마침표 없이
  // `18 ② 2`처럼 추출되므로 이 형식도 함께 읽는다.
  for (const match of head.matchAll(/(?:^|\s)(\d{1,2})\s+([①②③④⑤])(?=\s)/g)) {
    const qid = Number(match[1]);
    if (qid >= 1 && qid <= 45) answers.set(qid, CIRCLED_TO_NUM.get(match[2]));
  }

  const lines = head.split(/\r?\n/).map(compact).filter(Boolean);
  for (let idx = 0; idx < lines.length; idx += 1) {
    const qids = [...lines[idx].matchAll(/\b0?([1-9]|[1-3]\d|4[0-5])\./g)].map(
      (m) => Number(m[1]),
    );
    const marks = [...lines[idx].matchAll(/[①②③④⑤]/g)].map((m) => m[0]);

    if (qids.length > 0 && marks.length === qids.length) {
      qids.forEach((qid, i) => answers.set(qid, CIRCLED_TO_NUM.get(marks[i])));
      continue;
    }

    const nextMarks = lines[idx + 1]
      ? [...lines[idx + 1].matchAll(/[①②③④⑤]/g)].map((m) => m[0])
      : [];
    if (qids.length > 0 && nextMarks.length === qids.length) {
      qids.forEach((qid, i) =>
        answers.set(qid, CIRCLED_TO_NUM.get(nextMarks[i])),
      );
    }
  }

  if (answers.size < 45) warnings.push(`answer_count_low: ${answers.size}`);
  return { answers, warnings };
}

function removeSharedBlock(text, markerRegex, nextQuestionNumber) {
  const match = markerRegex.exec(text);
  if (!match) return { text, sharedText: "" };

  const start = match.index;
  const nextQuestion = text.indexOf(`${nextQuestionNumber}.`, start);
  if (nextQuestion < 0) return { text, sharedText: "" };

  return {
    text: `${text.slice(0, start)}\n${text.slice(nextQuestion)}`,
    sharedText: text.slice(start, nextQuestion).trim(),
  };
}

function extractSharedPassages(text) {
  const sharedPassages = new Map();
  let workingText = text;

  const shared41 = removeSharedBlock(
    workingText,
    /\[\s*41\s*[～~\-–]\s*42\s*\]/,
    41,
  );
  workingText = shared41.text;
  if (shared41.sharedText) {
    sharedPassages.set(41, shared41.sharedText);
    sharedPassages.set(42, shared41.sharedText);
  }

  const shared43 = removeSharedBlock(
    workingText,
    /\[\s*43\s*[～~\-–]\s*45\s*\]/,
    43,
  );
  workingText = shared43.text;
  if (shared43.sharedText) {
    sharedPassages.set(43, shared43.sharedText);
    sharedPassages.set(44, shared43.sharedText);
    sharedPassages.set(45, shared43.sharedText);
  }

  return { text: workingText, sharedPassages };
}

function findQuestionSpans(text) {
  const matches = [];
  for (const match of text.matchAll(/(^|\n)\s*(\d{1,2})\.\s/g)) {
    const qid = Number(match[2]);
    if (qid >= 18 && qid <= 45)
      matches.push({ qid, index: match.index + match[1].length });
  }
  matches.sort((a, b) => a.index - b.index);

  const chunks = new Map();
  matches.forEach((match, idx) => {
    const end = matches[idx + 1]?.index ?? text.length;
    chunks.set(match.qid, text.slice(match.index, end).trim());
  });
  return chunks;
}

function extractStem(raw, qid) {
  const lines = raw.split(/\r?\n/).map(compact).filter(Boolean);
  if (lines.length === 0) return "";
  if (lines[0].length > 160) return qtype(qid)[0];
  return lines[0];
}

function extractChoices(raw) {
  const marks = [...raw.matchAll(/[①②③④⑤]/g)];
  if (marks.length < 5) return [];

  return marks.slice(-5).map((mark, idx, selected) => {
    const next = selected[idx + 1]?.index ?? raw.length;
    return {
      num: CIRCLED_TO_NUM.get(mark[0]),
      mark: mark[0],
      text: compact(raw.slice(mark.index + mark[0].length, next)),
    };
  });
}

function sortedObjectFromCounter(items) {
  const counts = new Map();
  items.forEach((item) => counts.set(item, (counts.get(item) ?? 0) + 1));
  return Object.fromEntries(
    [...counts.entries()].sort(([a], [b]) => a.localeCompare(b, "ko")),
  );
}

async function buildDb() {
  const manifest = JSON.parse(await readFile(MANIFEST_PATH, "utf8"));
  const exams = [];
  const questions = [];
  const warnings = [];

  for (const item of manifest.items) {
    const schoolYear = Number(item.schoolYear);
    const examType = item.examType;
    const examId = buildExamId(schoolYear, examType);
    const problemFile = path.join(SOURCE_DIR, item.files.problem.fileName);
    const answerSource = item.files.explain ?? item.files.answer;
    const explainFile = path.join(SOURCE_DIR, answerSource.fileName);

    let answers = new Map();
    const examWarnings = [];
    try {
      const answerResult = extractAnswers(await readPdfText(explainFile));
      answers = answerResult.answers;
      examWarnings.push(...answerResult.warnings);
    } catch (error) {
      examWarnings.push(
        `answer_text_unreadable: ${error.name}: ${error.message}`,
      );
    }
    examWarnings.forEach((warning) => warnings.push({ examId, warning }));

    let chunks = new Map();
    let sharedPassages = new Map();
    try {
      const extracted = extractSharedPassages(await readPdfText(problemFile));
      chunks = findQuestionSpans(extracted.text);
      sharedPassages = extracted.sharedPassages;
    } catch (error) {
      warnings.push({
        examId,
        warning: `problem_text_unreadable: ${error.name}: ${error.message}`,
      });
    }

    const missingQids = [];
    const emptyQids = [];
    const examQuestionIds = [];
    for (let qid = 18; qid <= 45; qid += 1) {
      if (!chunks.has(qid)) missingQids.push(qid);
      if (compact(chunks.get(qid) ?? "").length === 0) emptyQids.push(qid);
    }
    if (missingQids.length > 0)
      warnings.push({
        examId,
        warning: `missing_questions: ${missingQids.join(",")}`,
      });
    if (emptyQids.length > 0)
      warnings.push({
        examId,
        warning: `empty_questions: ${emptyQids.join(",")}`,
      });

    for (let qid = 18; qid <= 45; qid += 1) {
      const raw = chunks.get(qid) ?? "";
      const [label, group] = qtype(qid);
      const choices = extractChoices(raw);
      const textStatus = compact(raw).length > 0 ? "ok" : "needs_ocr";
      const questionId = `${examId}_${String(qid).padStart(2, "0")}`;
      examQuestionIds.push(questionId);
      questions.push({
        id: questionId,
        examId,
        schoolYear,
        actualYear: item.actualYear,
        session: examType,
        qid,
        type: label,
        group,
        answer: answers.get(qid) ?? null,
        textStatus,
        stem: extractStem(raw, qid),
        rawText: raw,
        sharedPassage: sharedPassages.get(qid) ?? "",
        choices,
        corePatternTarget: CORE_PATTERN_QIDS.has(qid),
        source: {
          problemFile: item.files.problem.fileName,
          answerFile: item.files.answer.fileName,
          explainFile: item.files.explain?.fileName ?? null,
        },
        extraction: {
          rawChars: raw.length,
          sharedPassageChars: (sharedPassages.get(qid) ?? "").length,
          choiceCount: choices.length,
          answerStatus: answers.has(qid) ? "ok" : "missing",
          textStatus,
        },
      });
    }

    exams.push({
      id: examId,
      schoolYear,
      actualYear: item.actualYear,
      session: examType,
      title: item.title,
      questionIds: examQuestionIds,
      sourceFiles: item.files,
      answerCount: answers.size,
      extractionWarnings: examWarnings,
    });
  }

  const missingAnswers = questions
    .filter((q) => q.answer == null)
    .map((q) => q.id);
  const emptyRaw = questions
    .filter((q) => q.extraction.rawChars === 0)
    .map((q) => q.id);

  return {
    schemaVersion: "english-exam-db-v1",
    createdAt: new Date().toISOString(),
    separationRule:
      "This English database is independent from public/data/all_data_204.json.",
    sourceManifest: rel(MANIFEST_PATH),
    scope: {
      fromSchoolYear: Math.min(...exams.map((exam) => exam.schoolYear)),
      toSchoolYear: Math.max(...exams.map((exam) => exam.schoolYear)),
      sessions: ["6월", "9월", "수능"],
      questionRange: "18~45",
      corePatternQuestionRange: "20~24, 31~40",
      csatForm: "홀수형",
    },
    summary: {
      examCount: exams.length,
      questionCount: questions.length,
      corePatternTargetCount: questions.filter((q) => q.corePatternTarget)
        .length,
      countsByGroup: sortedObjectFromCounter(questions.map((q) => q.group)),
      countsByType: sortedObjectFromCounter(questions.map((q) => q.type)),
      missingAnswerCount: missingAnswers.length,
      missingAnswerQuestionIds: missingAnswers,
      emptyRawTextCount: emptyRaw.length,
      emptyRawTextQuestionIds: emptyRaw,
      needsOcrQuestionIds: emptyRaw,
    },
    warnings,
    exams,
    questions,
  };
}

const db = await buildDb();
await mkdir(OUT_DIR, { recursive: true });
await writeFile(OUT_PATH, `${JSON.stringify(db, null, 2)}\n`, "utf8");
console.log(JSON.stringify(db.summary, null, 2));
console.log(rel(OUT_PATH));
