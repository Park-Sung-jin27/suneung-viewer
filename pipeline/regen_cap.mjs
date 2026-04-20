/**
 * pipeline/regen_cap.mjs — [Gate 6] 재생성 2회 제한 게이트
 *
 * 목적:
 *   - 동일 (loc, issue_code, prompt_version)에 대해 재생성이 2회 실패하면
 *     needs_human으로 전환하고 이후 재생성 시도를 차단한다.
 *   - prompt_version은 SYSTEM_PROMPT·REANALYSIS_SYSTEM_PROMPT의 변경 식별자.
 *     프롬프트 수정 후에는 카운터가 리셋되어 새 프롬프트로 2회 재시도 가능.
 *   - 상태는 pipeline/regen_state.json에 영속화.
 *
 * 공개 API:
 *   - markAttempt(loc, code, promptVersion)  — 시도 횟수 +1
 *   - isBlocked(loc, code, promptVersion)    — 2회 이상이면 true
 *   - markSuccess(loc, code, promptVersion)  — 성공 시 기록 제거
 *   - listNeedsHuman()                       — needs_human 목록 반환
 *   - CURRENT_PROMPT_VERSION                 — 현재 프롬프트 버전 문자열
 *
 * 통합 가이드 (재생성 호출부에서):
 *   import { isBlocked, markAttempt, markSuccess, CURRENT_PROMPT_VERSION } from "./regen_cap.mjs";
 *   const loc = `${yearKey}/${setId}/Q${qId}/#${num}`;
 *   const ver = CURRENT_PROMPT_VERSION;
 *   if (isBlocked(loc, code, ver)) { console.warn(`[Gate6] ${loc} ${code}@${ver} → needs_human`); continue; }
 *   markAttempt(loc, code, ver);
 *   try { await regen(); markSuccess(loc, code, ver); }
 *   catch (e) { markAttempt 재호출 시 2회째 실패 자동 차단 }
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATE_PATH = path.resolve(__dirname, "regen_state.json");

const MAX_ATTEMPTS = 2;

// 현재 프롬프트 버전 — step3 SYSTEM_PROMPT / REANALYSIS_SYSTEM_PROMPT 수정 시 bump
// (날짜+이니셜 또는 시맨틱 버전). 프롬프트 변경 시 regen 카운터가 리셋되는 효과.
export const CURRENT_PROMPT_VERSION = "2026-04-19-gate5-tier";

function load() {
  try {
    return JSON.parse(fs.readFileSync(STATE_PATH, "utf8"));
  } catch {
    return {};
  }
}
function save(state) {
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2), "utf8");
}

function keyOf(loc, code, promptVersion = CURRENT_PROMPT_VERSION) {
  return `${loc}::${code}::${promptVersion}`;
}

export function markAttempt(loc, code, promptVersion = CURRENT_PROMPT_VERSION) {
  const state = load();
  const k = keyOf(loc, code, promptVersion);
  const prev = state[k] || {
    attempts: 0,
    status: "pending",
    promptVersion,
    ts: [],
  };
  prev.attempts += 1;
  prev.ts.push(new Date().toISOString());
  if (prev.attempts >= MAX_ATTEMPTS) prev.status = "needs_human";
  state[k] = prev;
  save(state);
  return prev;
}

export function markSuccess(loc, code, promptVersion = CURRENT_PROMPT_VERSION) {
  const state = load();
  delete state[keyOf(loc, code, promptVersion)];
  save(state);
}

export function isBlocked(loc, code, promptVersion = CURRENT_PROMPT_VERSION) {
  const state = load();
  const rec = state[keyOf(loc, code, promptVersion)];
  return !!(rec && rec.status === "needs_human");
}

export function listNeedsHuman() {
  const state = load();
  const out = [];
  for (const [k, v] of Object.entries(state)) {
    if (v.status !== "needs_human") continue;
    const [loc, code, promptVersion] = k.split("::");
    out.push({ loc, code, promptVersion, attempts: v.attempts, ts: v.ts });
  }
  return out;
}

// CLI: 상태 출력 / 리셋
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const cmd = process.argv[2];
  if (cmd === "list") {
    const rows = listNeedsHuman();
    console.log(`needs_human ${rows.length}건 (current prompt: ${CURRENT_PROMPT_VERSION}):`);
    for (const r of rows)
      console.log(
        `  [${r.code}] ${r.loc} @${r.promptVersion} (시도 ${r.attempts}회)`,
      );
  } else if (cmd === "reset") {
    const loc = process.argv[3];
    const code = process.argv[4];
    const pv = process.argv[5] || CURRENT_PROMPT_VERSION;
    if (!loc || !code) {
      console.error(
        "사용법: node pipeline/regen_cap.mjs reset <loc> <code> [prompt_version]",
      );
      process.exit(1);
    }
    const state = load();
    delete state[keyOf(loc, code, pv)];
    save(state);
    console.log(`reset: ${loc} ${code} @${pv}`);
  } else {
    console.log(
      `사용법:
  node pipeline/regen_cap.mjs list                            # needs_human 목록
  node pipeline/regen_cap.mjs reset <loc> <code> [prompt_ver] # 특정 키 리셋
현재 prompt_version: ${CURRENT_PROMPT_VERSION}`,
    );
  }
}
