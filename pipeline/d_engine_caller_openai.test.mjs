// pipeline/d_engine_caller_openai.test.mjs
// §4.1.5 회귀 테스트 6건
//
// 5건 mock + 1건 라이브 (D_ENGINE_LIVE=1 환경변수로 활성):
//   1. 정상 응답 (mock)
//   2. markdown fence (mock)
//   3. 비-JSON throw → D_ENGINE_PARSE_ERROR (mock)
//   4. 필드 누락은 wrapper 책임 (caller는 parse만) — caller 정상 통과 (mock)
//   5. 429 rate limit → D_ENGINE_RATE_429 (mock)
//   6. 401 auth → D_ENGINE_AUTH_401 (mock)
//   7. 5xx server → D_ENGINE_5XX_503 (mock)
//   8. empty/null content → D_ENGINE_EMPTY_RESPONSE (mock)
//   9. SDK maxRetries=0 lock 검증 (mock — config inspection)
//   10. 라이브 smoke (D_ENGINE_LIVE=1 시만, $0.3~0.5)

import assert from "node:assert/strict";
import { createOpenAICaller, __test__ } from "./d_engine_caller_openai.mjs";

// ─── mock 헬퍼 ────────────────────────────────────────────────────

function makeMockClient(behavior) {
  // behavior: function (payload) → response or throws
  const calls = [];
  return {
    _calls: calls,
    chat: {
      completions: {
        create: async (payload) => {
          calls.push(payload);
          return behavior(payload);
        },
      },
    },
  };
}

function okResponse(content) {
  return {
    choices: [{ message: { content } }],
  };
}

class FakeOpenAIError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

// ─── 테스트 러너 ──────────────────────────────────────────────────

const tests = [];
function test(name, fn) {
  tests.push({ name, fn });
}

async function run() {
  let passed = 0,
    failed = 0;
  for (const t of tests) {
    try {
      await t.fn();
      console.log(`  ✓ ${t.name}`);
      passed++;
    } catch (e) {
      console.log(`  ✗ ${t.name}\n      ${e.message}`);
      failed++;
    }
  }
  console.log(
    `\n${passed}/${tests.length} passed${failed ? ` (${failed} failed)` : ""}`
  );
  if (failed > 0) process.exit(1);
}

// ─── 회귀 테스트 ──────────────────────────────────────────────────

test("1. 정상 응답 → parsed object 반환", async () => {
  const client = makeMockClient(() =>
    okResponse(
      JSON.stringify({
        pass: false,
        error_type: "P_MISMATCH",
        rule_hits: ["RULE_1_PAT_DOMAIN_MISMATCH"],
        reason: "test reason",
        confidence: "high",
      })
    )
  );
  const caller = createOpenAICaller({ client });
  const result = await caller("test prompt", { model: "gpt-5" });
  assert.equal(result.pass, false);
  assert.equal(result.error_type, "P_MISMATCH");
  assert.deepEqual(result.rule_hits, ["RULE_1_PAT_DOMAIN_MISMATCH"]);
});

test("2. markdown fence (```json ... ```) strip 후 parse", async () => {
  const fenced =
    "```json\n" +
    JSON.stringify({
      pass: true,
      error_type: "NONE",
      rule_hits: [],
      reason: "ok",
      confidence: "mid",
    }) +
    "\n```";
  const client = makeMockClient(() => okResponse(fenced));
  const caller = createOpenAICaller({ client });
  const result = await caller("p", {});
  assert.equal(result.pass, true);
  assert.equal(result.confidence, "mid");
});

test("3. 비-JSON 응답 → D_ENGINE_PARSE_ERROR throw", async () => {
  const client = makeMockClient(() => okResponse("이건 JSON 아닙니다."));
  const caller = createOpenAICaller({ client });
  await assert.rejects(
    () => caller("p", {}),
    /D_ENGINE_PARSE_ERROR/
  );
});

test("4. 429 rate limit → D_ENGINE_RATE_429 throw", async () => {
  const client = makeMockClient(() => {
    throw new FakeOpenAIError("Too many requests", 429);
  });
  const caller = createOpenAICaller({ client });
  await assert.rejects(() => caller("p", {}), /D_ENGINE_RATE_429/);
});

test("5. 401 auth → D_ENGINE_AUTH_401 throw", async () => {
  const client = makeMockClient(() => {
    throw new FakeOpenAIError("Invalid API key", 401);
  });
  const caller = createOpenAICaller({ client });
  await assert.rejects(() => caller("p", {}), /D_ENGINE_AUTH_401/);
});

test("6. 5xx server error → D_ENGINE_5XX_503 throw", async () => {
  const client = makeMockClient(() => {
    throw new FakeOpenAIError("Service unavailable", 503);
  });
  const caller = createOpenAICaller({ client });
  await assert.rejects(() => caller("p", {}), /D_ENGINE_5XX_503/);
});

test("7. empty content → D_ENGINE_EMPTY_RESPONSE throw", async () => {
  const client = makeMockClient(() =>
    ({ choices: [{ message: { content: "" } }] })
  );
  const caller = createOpenAICaller({ client });
  await assert.rejects(() => caller("p", {}), /D_ENGINE_EMPTY_RESPONSE/);
});

test("8. null content → D_ENGINE_EMPTY_RESPONSE throw", async () => {
  const client = makeMockClient(() =>
    ({ choices: [{ message: { content: null } }] })
  );
  const caller = createOpenAICaller({ client });
  await assert.rejects(() => caller("p", {}), /D_ENGINE_EMPTY_RESPONSE/);
});

test("9. gpt-5 → max_completion_tokens 사용 (max_tokens 아님)", async () => {
  const client = makeMockClient(() =>
    okResponse(
      JSON.stringify({
        pass: true,
        error_type: "NONE",
        rule_hits: [],
        reason: "",
        confidence: "high",
      })
    )
  );
  const caller = createOpenAICaller({ client });
  await caller("p", { model: "gpt-5", max_tokens: 500 });
  const payload = client._calls[0];
  assert.equal(payload.max_completion_tokens, 500);
  assert.equal(payload.max_tokens, undefined);
});

test("10. gpt-4o → max_tokens 사용 (max_completion_tokens 아님)", async () => {
  const client = makeMockClient(() =>
    okResponse(
      JSON.stringify({
        pass: true,
        error_type: "NONE",
        rule_hits: [],
        reason: "",
        confidence: "high",
      })
    )
  );
  const caller = createOpenAICaller({ client });
  await caller("p", { model: "gpt-4o", max_tokens: 500 });
  const payload = client._calls[0];
  assert.equal(payload.max_tokens, 500);
  assert.equal(payload.max_completion_tokens, undefined);
});

test("11. fence stripper 단위 검증", () => {
  const { stripMarkdownFence } = __test__;
  assert.equal(
    stripMarkdownFence("```json\n{\"a\":1}\n```"),
    '{"a":1}'
  );
  assert.equal(
    stripMarkdownFence("```\n{\"a\":1}\n```"),
    '{"a":1}'
  );
  assert.equal(stripMarkdownFence('{"a":1}'), '{"a":1}');
  assert.equal(
    stripMarkdownFence("  ```json\n{\"a\":1}\n```  "),
    '{"a":1}'
  );
});

// ─── 라이브 smoke (D_ENGINE_LIVE=1 시만 실행, $0.3~0.5) ──────────

test("12. [LIVE] 실 OpenAI 호출 — D엔진 prompt sanity", async () => {
  if (process.env.D_ENGINE_LIVE !== "1") {
    console.log("      ⏭  skipped (D_ENGINE_LIVE=1 로 활성)");
    return;
  }
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY 미설정");
  }
  const caller = createOpenAICaller({});
  // 단순 sanity: JSON 응답을 강제하는 짧은 프롬프트
  const prompt = `다음 JSON 형식으로만 답하라:
{"pass": true, "error_type": "NONE", "rule_hits": [], "reason": "smoke test", "confidence": "high"}

이 외 다른 텍스트 금지.`;
  const result = await caller(prompt, {
    model: process.env.D_ENGINE_LIVE_MODEL || "gpt-5",
    temperature: 0,
    max_tokens: 200,
  });
  assert.equal(typeof result, "object");
  assert.ok("pass" in result, "pass 필드 누락");
  assert.ok("error_type" in result, "error_type 필드 누락");
  assert.ok(Array.isArray(result.rule_hits), "rule_hits 배열 아님");
  console.log(`      ↳ live result: ${JSON.stringify(result).slice(0, 120)}`);
});

run();
