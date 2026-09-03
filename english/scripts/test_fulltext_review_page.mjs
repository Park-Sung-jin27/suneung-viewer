import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildReviewPage,
  cleanReviewText,
  prepareQuestionForReview,
  validateReviewExport,
} from "./build_fulltext_review_page.mjs";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "../..");
const sourcePath = path.join(
  repositoryRoot,
  "english/data/candidates/english_2027_09_fulltext_review_export.json",
);
const sourceBefore = readFileSync(sourcePath, "utf8");
const sourceShaBefore = createHash("sha256").update(sourceBefore).digest("hex");

const cleaned = cleanReviewText("문항 본문\n㢨ٻⱬ 깨진 저작권\n-- 3 of 8 --\n4\n4 8");
assert.equal(cleaned.text, "문항 본문");
assert.equal(cleaned.removedLineCount, 2);

const exportData = JSON.parse(sourceBefore);
validateReviewExport(exportData, sourcePath);
assert.equal(exportData.questions.length, 28);

const temporaryDirectory = mkdtempSync(path.join(tmpdir(), "english-review-page-test-"));
try {
  const outputPath = path.join(temporaryDirectory, "index.html");
  const result = buildReviewPage({ sourcePath, outputPath });
  const html = readFileSync(outputPath, "utf8");

  assert.equal(result.questionCount, 28);
  assert.equal(result.auditedQuestionCount, 28);
  assert.equal(result.visualQuestionCount, 3);
  assert.equal(result.structuredChoiceQuestionCount, 3);
  assert.ok(result.removedLineCount >= 10);
  assert.equal(result.sourceSha256, sourceShaBefore);
  assert.equal(result.officialProblemSha256, exportData.sourceArtifacts.problem.sha256);
  assert.match(html, /내부 검수 전용 · 28문항 · 외부 공유 금지/);
  assert.match(html, /2027학년도 9월 모의평가 영어/);
  assert.match(html, /FULL TRANSLATION · 전체 해석/);
  assert.match(html, /I must decline your invitation/);
  assert.match(html, /data:image\/png;base64/);
  assert.match(html, /연령대별 식단 선택 비율 도표/);
  assert.match(html, /\[41～42\] 다음 글을 읽고/);
  assert.match(html, /\[43～45\] 다음 글을 읽고/);
  assert.match(html, /\(B\) - \(C\) - \(A\)/);
  assert.match(html, /location\.hash\.match\(\/\^#q\(\[0-9\]\+\)\$\//);
  assert.doesNotMatch(html, /㢨ٻⱬ/);
  assert.doesNotMatch(html, /-- 3 of 8 --/);
  assert.doesNotMatch(html, /이제 듣기 문제가 끝났습니다/);
  assert.doesNotMatch(html, /\[38～39\] 글의 흐름으로 보아/);
  assert.doesNotMatch(html, /\uF03B/);

  for (const question of exportData.questions) {
    const prepared = prepareQuestionForReview(question);
    assert.ok(prepared.displaySource.includes(String(question.qid)), `${question.id}: current question missing`);
  }

  const sourceAfter = readFileSync(sourcePath, "utf8");
  assert.equal(createHash("sha256").update(sourceAfter).digest("hex"), sourceShaBefore);

  assert.throws(
    () => buildReviewPage({ sourcePath, outputPath: path.join(repositoryRoot, "public", "review.html") }),
    /저장소 밖에만 생성/,
  );
} finally {
  rmSync(temporaryDirectory, { recursive: true, force: true });
}

console.log("ENGLISH_FULLTEXT_REVIEW_PAGE: PASS questions=28 source-unchanged public-output-blocked");
