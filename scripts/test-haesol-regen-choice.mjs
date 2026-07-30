import assert from "node:assert/strict";
import { acceptRegenChoice } from "../pipeline/haesol_v2_gate.mjs";

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
