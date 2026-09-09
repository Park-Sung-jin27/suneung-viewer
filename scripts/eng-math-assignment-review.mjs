// Read-only readiness audit. Output contains identifiers/checks, never passages,
// answers, explanations, student data or fulltext_review_export contents.
import { createHash } from "node:crypto";
import { existsSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import katex from "katex";
const ROOT = fileURLToPath(new URL("../", import.meta.url));
const MATH = "평가원_수학영어_확장/08_math_data";
const sha = value => createHash("sha256").update(value).digest("hex");
const digest = data => sha(JSON.stringify(data));
const expectedEnglish = Array.from({ length: 28 }, (_, i) => `2027_09_${i + 18}`);
const expectedMath = [
  ...Array.from({ length: 22 }, (_, i) => `2027_09_common_${i + 1}`),
  ...["sta", "cal", "geo"].flatMap(track => Array.from({ length: 8 }, (_, i) => `2027_09_${track}_${i + 23}`)),
];
function assertCoverage(items, expected) {
  const ids = items?.map(q => q.id);
  if (!ids || ids.length !== expected.length || new Set(ids).size !== expected.length || expected.some(id => !ids.includes(id)))
    throw new Error("REVIEW_SCOPE_MISSING_OR_DUPLICATE");
}

export function buildAssignmentReviewQueue({ english, math, assetCheck }) {
  assertCoverage(english.questions, expectedEnglish);
  assertCoverage(math.items, expectedMath);
  if (english.publicConnected !== false || math.metadata.publicConnected !== false || math.metadata.allowPublicGeneration !== false)
    throw new Error("REVIEW_PRIVATE_BOUNDARY_CHANGED");
  const rows = [];
  for (const q of english.questions) {
    const figureRequired = [25, 27, 28].includes(q.qid);
    const source = `${q.rawText || ""}\n${q.sharedPassage || ""}`;
    const checks = {
      sourceTextPresent: source.trim().length > 100,
      registeredReview: q.review?.status === "ready",
      answerMatchesRegisteredReview: q.answer !== undefined && String(q.answer) === String(q.review?.answer),
      fullTranslationPresent: String(q.review?.fullTranslation || "").length >= 100,
      requiredImageIntact: !figureRequired || !!(q.figure?.sha256 && assetCheck(q.figure.assetPath, q.figure.sha256)),
    };
    // Flags mean inspect, not permission to delete/replace source characters.
    const attention = [];
    if (figureRequired) attention.push("도표·안내문 이미지와 지문 대응");
    if ([21, 29, 30, 31, 32, 33, 34, 35, 38, 39, 40, 42, 44].includes(q.qid)) attention.push("빈칸·밑줄·삽입·선지 마커 원문 대조");
    if ([36, 37, 43].includes(q.qid)) attention.push("문단 순서와 선지 배열 원문 대조");
    if (q.qid >= 41) attention.push("공통 지문 및 다른 문항과의 경계");
    if (/\[38[～~〜-]39\]/.test(source) && q.qid < 38) attention.push("다음 38~39번 안내문 혼입 의심");
    if (/--\s*\d+ of \d+\s*--|[\uFFFD\uE000-\uF8FF]|㢨|弔/.test(source)) attention.push("추출 푸터·깨진 문자 후보 확인");
    rows.push({ id: q.id, subject: "english", number: q.qid, track: "english", checks, attention,
      fingerprint: digest({ q, sourceArtifacts: english.sourceArtifacts }),
      historicalApproval: english.approval?.status || "unrecorded",
      requiredManualChecks: ["원문·선지·다른 문항 혼입", "해석·정답 근거·오답 이유", "PC·모바일 실제 표시", "답안 제출·오답 재풀이·회원 기록"],
      manualReview: "pending", studentRelease: "blocked",
    });
  }
  for (const q of math.items) {
    const expressions = [q.expression, ...(q.steps || []).map(s => s.expression)].filter(Boolean);
    let mathTypesetValid = expressions.length > 0;
    for (const expression of expressions) {
      try { katex.renderToString(expression, { throwOnError: true, strict: "ignore", trust: false }); }
      catch { mathTypesetValid = false; }
    }
    const sourcePath = `${MATH}/assets/source_pages/2027_09/page-${String(q.page).padStart(2, "0")}.png`;
    rows.push({ id: q.id, subject: "math", number: q.qid, track: q.track,
      checks: { sourcePagePresent: assetCheck(sourcePath), answerPresent: q.answer !== undefined && String(q.answer).length > 0, explanationPresent: !!q.summary, mathTypesetValid },
      attention: ["원문 한 페이지에서 해당 문항만 명확히 표시", ...(!q.steps?.length ? ["요약 해설을 학생용 단계 풀이로 보강할지 검수"] : []), ...(expressions.some(e => /[ㄱ-ㅎ가-힣]/.test(e)) ? ["수식 안 한글 글꼴·기호 실제 렌더 확인"] : [])],
      fingerprint: digest({ q, sourceArtifacts: math.metadata.sourceArtifacts }),
      historicalApproval: math.metadata.approval?.status || "unrecorded",
      requiredManualChecks: ["원문·도형·조건·선지", "정답 계산·단계별 근거", "PC·모바일 수식·이미지", "답안 제출·오답 재풀이·회원 기록"],
      manualReview: "pending", studentRelease: "blocked",
    });
  }
  return {
    schemaVersion: 1, status: "internal_assignment_review_queue", publicConnected: false,
    note: "기존 정답 승인은 유지하되, 과제용 표시·재풀이·기록 검수는 별도입니다. 자동 검사 통과는 학생 공개 승인이 아닙니다.",
    summary: { english: 28, math: 46, total: rows.length, automaticChecksPassed: rows.filter(r => Object.values(r.checks).every(Boolean)).length, manualPending: rows.length, studentReleaseReady: 0 },
    rows,
  };
}

export function readAssignmentReviewQueue(root = ROOT) {
  const read = name => JSON.parse(readFileSync(path.join(root, name), "utf8"));
  return buildAssignmentReviewQueue({
    english: read("english/data/candidates/english_2027_09_merged.json"),
    math: read(`${MATH}/math_2027_09_registered_solutions_v1.json`),
    assetCheck(relative, expected) {
      if (typeof relative !== "string" || !relative.endsWith(".png")) return false;
      const absolute = path.resolve(root, relative);
      const within = path.relative(root, absolute);
      if (within.startsWith("..") || path.isAbsolute(within) || !existsSync(absolute)) return false;
      return !expected || sha(readFileSync(absolute)) === expected;
    },
  });
}

function writePrivateReport(queue) {
  // Fixed temp location: cannot redirect this audit into a public/build folder.
  const output = path.join(tmpdir(), "eng-math-assignment-review-021o");
  mkdirSync(output, { recursive: true });
  writeFileSync(path.join(output, "review-queue.json"), JSON.stringify(queue, null, 2));
  const escape = text => String(text).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  writeFileSync(path.join(output, "index.html"), `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>9월 영어·수학 과제용 검수 목록</title><style>body{font:16px/1.7 system-ui,sans-serif;color:#1d3247;max-width:980px;margin:32px auto;padding:0 20px}article{border-top:1px solid #d8e2ea;padding:20px 0}small{color:#586c7d}code{overflow-wrap:anywhere}h2{font-size:20px}li{margin:4px 0}</style><h1>9월 영어·수학 과제용 검수 목록</h1><p>영어 28문항 · 수학 46문항 · 자동 사전 검사 ${queue.summary.automaticChecksPassed}/74</p><p><strong>학생 공개 가능 판정 0문항 · 수동 검수 대기 74문항</strong></p><p>${escape(queue.note)}</p><p>원문과 해설은 <a href="https://suneung-viewer.vercel.app/eng-math/master">대표 자료실</a>에서 해당 시험·문항을 선택해 확인하세요. 이 목록에는 원문·해설·학생 개인정보를 복사하지 않았습니다.</p>${queue.rows.map(row => `<article><h2>${row.subject === "english" ? "영어" : "수학"} ${escape(row.track)} ${row.number}번</h2><p>${Object.values(row.checks).every(Boolean) ? "자동 사전 검사 통과 · 수동 검수 대기" : "자동 사전 검사 실패 · 보완 필요"}</p><ul>${row.attention.map(t => `<li>${escape(t)}</li>`).join("")}</ul><p>확인할 항목: ${row.requiredManualChecks.map(escape).join(" / ")}</p><small>문항 식별자 ${escape(row.id)} · 검수 대상 지문·해설 버전 해시</small><br><code>${row.fingerprint}</code></article>`).join("")}</html>`);
  console.log(JSON.stringify({ ...queue.summary, report: path.join(output, "index.html") }));
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const queue = readAssignmentReviewQueue();
  if (process.argv.includes("--report")) writePrivateReport(queue);
  else console.log(JSON.stringify(queue.summary));
  if (queue.summary.automaticChecksPassed !== queue.summary.total) process.exitCode = 1;
}
