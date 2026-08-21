// api_usage.mjs — API 토큰 사용량 계측 (발주 D-89 ④)
//
// 왜 필요한가
//   크레딧 추정을 실측으로 바꾸려면 호출마다 토큰을 기록해야 한다.
//   콘솔 사용량은 내가 볼 수 없고, 응답의 usage 는 볼 수 있다.
//
// 기록: pipeline/reextract/api_usage.jsonl  (한 줄 = 한 호출)
// 단가는 여기서 고정하지 않는다 — 집계할 때 넣는다(모델·요율이 바뀌면 표만 다시 낸다).

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LOG = path.join(ROOT, "pipeline/reextract/api_usage.jsonl");

/** Anthropic 응답의 usage 를 한 줄 append. 실패해도 본 작업을 막지 않는다. */
export function logUsage(stage, label, response) {
  try {
    const u = response?.usage || {};
    fs.mkdirSync(path.dirname(LOG), { recursive: true });
    fs.appendFileSync(LOG, JSON.stringify({
      ts: new Date().toISOString(),
      stage, label,
      model: response?.model ?? null,
      in: u.input_tokens ?? null,
      out: u.output_tokens ?? null,
      cache_write: u.cache_creation_input_tokens ?? 0,
      cache_read: u.cache_read_input_tokens ?? 0,
      stop: response?.stop_reason ?? null,
    }) + "\n", "utf8");
  } catch { /* 계측 실패가 추출을 막으면 안 된다 */ }
}

export const USAGE_LOG = LOG;
