// pipeline/d_engine_caller_openai.mjs
// §4.1.5 — D엔진 실제 caller (OpenAI GPT-5)
//
// 사양 정합:
//   §4-5: caller 인터페이스 lock — async (prompt, options) => parsed object
//   §4-4 E1: caller throw → wrapper backoff retry (caller 책임 = 단일 호출 + throw)
//   §4-4 E2: 응답 검증 실패 → wrapper format retry (caller 책임 = parse throw)
//
// 결정 lock (자가 검토 통과):
//   [§4.1.5 결정 1] 401 → throw "D_ENGINE_AUTH_401: ..."
//   [§4.1.5 결정 2] 429 → throw "D_ENGINE_RATE_429: ..." (Retry-After 무시, wrapper backoff 단일 통제)
//   [§4.1.5 결정 3] 5xx → throw "D_ENGINE_5XX_<status>: ..."
//   [§4.1.5 결정 4] SDK maxRetries=0 강제 (wrapper backoff와 중복 방지)
//   [§4.1.5 결정 5] markdown fence strip + JSON.parse 실패 시 D_ENGINE_PARSE_ERROR throw
//   [§4.1.5 결정 6] empty/null content → D_ENGINE_EMPTY_RESPONSE throw
//
// v1.2 통합 대상:
//   - Retry-After 헤더 활용 (enterprise tier)
//   - GPT-5 temperature 제약 (0 미허용 모델 호환)
//   - SDK 자체 timeout 옵션 vs wrapper withTimeout 일관 정책

import OpenAI from "openai";

// gpt-5 / o-series 계열은 max_completion_tokens, 그 외는 max_tokens
const COMPLETION_TOKEN_MODELS = /^(gpt-5|o1|o3|o4)/i;

function buildCreatePayload(prompt, { model, temperature, max_tokens }) {
  const payload = {
    model,
    messages: [{ role: "user", content: prompt }],
    temperature,
  };
  if (COMPLETION_TOKEN_MODELS.test(model)) {
    payload.max_completion_tokens = max_tokens;
  } else {
    payload.max_tokens = max_tokens;
  }
  return payload;
}

function stripMarkdownFence(raw) {
  // ```json ... ``` 또는 ``` ... ``` 형태 strip
  return raw
    .replace(/^\s*```(?:json)?\s*\n?/i, "")
    .replace(/\n?```\s*$/i, "")
    .trim();
}

/**
 * createOpenAICaller — caller factory
 *
 * @param {object} cfg
 * @param {string} [cfg.apiKey] — OPENAI_API_KEY (생략 시 process.env)
 * @param {string} [cfg.baseURL] — 사용자 지정 endpoint (선택)
 * @param {object} [cfg.client] — 테스트용 주입 (DI). 지정 시 SDK 인스턴스 생성 생략
 * @returns {function} caller(prompt, options) — §4-5 인터페이스 lock 정합
 */
export function createOpenAICaller(cfg = {}) {
  const { apiKey, baseURL, client: injectedClient } = cfg;

  const client =
    injectedClient ||
    new OpenAI({
      apiKey: apiKey || process.env.OPENAI_API_KEY,
      ...(baseURL ? { baseURL } : {}),
      // [§4.1.5 결정 4: SDK 자체 retry 비활성화 — wrapper backoff 단일 통제]
      maxRetries: 0,
    });

  return async function caller(prompt, options = {}) {
    const {
      model = "gpt-5",
      temperature = 0,
      max_tokens = 1000,
    } = options;

    const payload = buildCreatePayload(prompt, {
      model,
      temperature,
      max_tokens,
    });

    let response;
    try {
      response = await client.chat.completions.create(payload);
    } catch (e) {
      const status =
        e?.status ?? e?.response?.status ?? e?.code ?? null;
      const msg = e?.message ?? String(e);

      // [§4.1.5 결정 1] 401 unauthorized
      if (status === 401) {
        throw new Error(`D_ENGINE_AUTH_401: ${msg}`);
      }
      // [§4.1.5 결정 2] 429 rate limit (Retry-After 무시)
      if (status === 429) {
        throw new Error(`D_ENGINE_RATE_429: ${msg}`);
      }
      // [§4.1.5 결정 3] 5xx server error
      if (typeof status === "number" && status >= 500 && status < 600) {
        throw new Error(`D_ENGINE_5XX_${status}: ${msg}`);
      }
      // 그 외 (네트워크/타입 에러 등) — wrapper E1 경로
      throw e;
    }

    const raw = response?.choices?.[0]?.message?.content;
    // [§4.1.5 결정 6] empty/null
    if (raw === undefined || raw === null || raw === "") {
      throw new Error("D_ENGINE_EMPTY_RESPONSE");
    }

    // [§4.1.5 결정 5] markdown fence strip + JSON.parse
    const stripped = stripMarkdownFence(raw);
    let parsed;
    try {
      parsed = JSON.parse(stripped);
    } catch (e) {
      const head = stripped.slice(0, 200);
      throw new Error(`D_ENGINE_PARSE_ERROR: ${head}`);
    }

    return parsed;
  };
}

// 내부 테스트 노출 (export 시 명시적)
export const __test__ = {
  buildCreatePayload,
  stripMarkdownFence,
  COMPLETION_TOKEN_MODELS,
};
