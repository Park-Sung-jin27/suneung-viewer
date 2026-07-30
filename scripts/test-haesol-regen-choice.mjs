import assert from "node:assert/strict";
import {
  acceptRegenChoice,
  chooseRegenAnalysis,
} from "../pipeline/haesol_v2_gate.mjs";

const cases = [
  {
    name: "ok true valid",
    analysis: "근거\n✅ 적절",
    pat: null,
    ok: true,
    accept: true,
    warn: null,
  },
  {
    name: "ok false valid",
    analysis: "근거\n❌ 부적절",
    pat: "금지패턴",
    ok: false,
    accept: true,
    warn: null,
  },
  {
    name: "ok true wrong stamp",
    analysis: "❌ 적절",
    pat: null,
    ok: true,
    accept: false,
  },
  {
    name: "ok false wrong stamp",
    analysis: "✅ 부적절",
    pat: "금지패턴",
    ok: false,
    accept: false,
  },
  {
    name: "ok true pat mismatch",
    analysis: "✅ 적절",
    pat: "금지패턴",
    ok: true,
    accept: false,
  },
  {
    name: "ok false pat missing",
    analysis: "❌ 부적절",
    pat: null,
    ok: false,
    accept: false,
  },
  {
    name: "axis3 warning nonblocking",
    analysis: "✅ 지문에 부합하지 않아 적절",
    pat: null,
    ok: true,
    accept: true,
    warn: true,
  },
  {
    name: "empty analysis rejected",
    analysis: "",
    pat: null,
    ok: true,
    accept: false,
  },
];

for (const testCase of cases) {
  const result = acceptRegenChoice(
    testCase.analysis,
    testCase.pat,
    testCase.ok,
  );
  assert.equal(result.accept, testCase.accept, `${testCase.name}: accept`);
  if (testCase.warn === null) {
    assert.equal(result.warn, null, `${testCase.name}: warn`);
  } else if (testCase.warn === true) {
    assert.ok(result.warn, `${testCase.name}: expected warning`);
  }
  console.log(`${testCase.name}: PASS ${JSON.stringify(result)}`);
}

console.log(`acceptRegenChoice TEST PASS ${cases.length}/${cases.length}`);

const selectionCases = [
  {
    name: "accepted candidate replaces current analysis",
    current: "기존 해설",
    candidate: "새 해설\n✅ 적절",
    pat: null,
    ok: true,
    accept: true,
    expected: "새 해설\n✅ 적절",
  },
  {
    name: "wrong stamp preserves current analysis",
    current: "기존 해설",
    candidate: "새 해설\n❌ 부적절",
    pat: null,
    ok: true,
    accept: false,
    expected: "기존 해설",
  },
  {
    name: "missing pat preserves current analysis",
    current: "기존 오답 해설",
    candidate: "새 해설\n❌ 부적절",
    pat: null,
    ok: false,
    accept: false,
    expected: "기존 오답 해설",
  },
  {
    name: "axis3 warning still adopts candidate",
    current: "기존 해설",
    candidate: "새 해설\n✅ 지문에 부합하지 않아 적절",
    pat: null,
    ok: true,
    accept: true,
    warn: true,
    expected: "새 해설\n✅ 지문에 부합하지 않아 적절",
  },
];

for (const testCase of selectionCases) {
  const result = chooseRegenAnalysis(
    testCase.current,
    testCase.candidate,
    testCase.pat,
    testCase.ok,
  );
  assert.equal(result.accept, testCase.accept, `${testCase.name}: accept`);
  assert.equal(result.analysis, testCase.expected, `${testCase.name}: analysis`);
  if (testCase.warn) assert.ok(result.warn, `${testCase.name}: warn`);
  console.log(`${testCase.name}: PASS ${JSON.stringify(result)}`);
}

console.log(
  `chooseRegenAnalysis TEST PASS ${selectionCases.length}/${selectionCases.length}`,
);
