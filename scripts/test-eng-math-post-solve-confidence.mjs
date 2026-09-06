import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const practiceSource = readFileSync(
  new URL("../src/EngMathPractice.jsx", import.meta.url),
  "utf8",
);

assert.match(practiceSource, /const isReadyToSubmit = hasAnswer;/);
assert.doesNotMatch(practiceSource, /확신도를 고른 뒤 확인하기/);
assert.match(practiceSource, /방금 답을 고를 때 어땠나요\? \(선택\)/);
assert.match(practiceSource, /session\?\.onConfidence\(value\)/);
assert.match(practiceSource, /onConfidence: recordConfidence/);
assert.match(practiceSource, /잘 모르겠어요 · 풀이 보기/);
assert.match(practiceSource, /setShowExplanation\(!isCorrect\)/);
assert.match(practiceSource, /gaveUp: true/);
assert.match(practiceSource, /정답과 풀이를 확인하세요\./);
assert.match(practiceSource, /\{!gaveUp \? \(/);
assert.match(practiceSource, /이번 주 복습 신호/);
assert.match(practiceSource, /풀이를 먼저 본 문제/);
assert.match(practiceSource, /확신했지만 틀린 문제/);
assert.match(practiceSource, /현재 기기에서 남긴 기록/);
assert.match(practiceSource, /회원 기록 · 모든 기기/);

const resultPosition = practiceSource.indexOf("<ResultAnswer");
const confidencePosition = practiceSource.indexOf(
  'aria-label="선택 학습 기록"',
);
assert.ok(resultPosition >= 0, "채점 결과 영역이 있어야 합니다.");
assert.ok(
  confidencePosition > resultPosition,
  "확신도 기록은 채점 결과 뒤에 보여야 합니다.",
);

const answerRecord = practiceSource.slice(
  practiceSource.indexOf("session.onAnswer({"),
  practiceSource.indexOf("session.onAnswer({") + 500,
);
assert.doesNotMatch(
  answerRecord,
  /confidence,/,
  "채점 전에는 확신도를 요구하거나 답안 기록에 강제로 포함하지 않습니다.",
);

console.log("eng-math post-solve confidence tests: PASS");
