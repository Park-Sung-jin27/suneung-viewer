// pipeline/track2c/track2c_4c_runner.mjs
// 트랙 2-c 작업 4-c — 옵션 i 효과 검증
//
// 지휘부 lock 사항 (변경 금지):
//   - 분기 γ 확정 = r2023a Q2 환각이 본체 누출 아님 / 옵션 i 차단력 검증
//   - 4-a runner Mode A 구조 그대로 (선지 단위 격리 호출)
//   - SYSTEM_PROMPT = pipeline/step3_analysis.js L130~L216 동일 본문 + 옵션 i 1줄 추가
//   - 옵션 i: "[중대 제약] 본 분석 대상 시험 ID는 {set_id}이다. 다른 시험·연도·문항의 내용을 참조하지 말 것."
//   - 대상: r2023a Q2 5선지 전체 (#1~#5) × 3회 = 15 호출
//   - temperature: 0
//   - nonce: run_id (캐시 차단)
//   - 호출 간 sleep 2초
//   - 출력: pipeline/track2c/4c_results.json
//   - step3_analysis.js 본체 미수정 / 4-a runner 본체 미수정 (별도 .mjs 파일)
//   - read-only mode: 산출 외 repo 파일 수정 0건

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import Anthropic from "@anthropic-ai/sdk";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env"), override: true });

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = "claude-sonnet-4-5";
const BETA_HEADER = { headers: { "anthropic-beta": "output-128k-2025-02-19" } };
const DATA_PATH = path.resolve(__dirname, "../../public/data/all_data_204.json");
const OUTPUT_PATH = path.resolve(__dirname, "./4c_results.json");

// ============================================================
// SYSTEM_PROMPT — pipeline/step3_analysis.js L130~L216 본문 그대로 복사
// (4-a runner와 동일 본문. 4-e 통과 후 step3 본체 변경 시 동기화 의무)
// ============================================================
const SYSTEM_PROMPT = `너는 수능 국어 전문 해설 작성자다.
반드시 순수 JSON 배열만 출력하라. 마크다운, 설명 텍스트 없음.

[핵심 원칙]
정답 선지 번호가 주어진다. 정답을 확정한 상태에서 각 선지의 ok값과 해설을 작성하라.
정답 선지의 ok값은 questionType에 따라 결정된다:
- questionType: positive → 정답 선지 ok: true, 나머지 ok: false
- questionType: negative → 정답 선지 ok: false, 나머지 ok: true

[ok 필드 규칙]
ok: true = 지문 내용과 사실적으로 일치하는 선지
ok: false = 지문 내용과 사실적으로 일치하지 않는 선지
발문 유형과 무관하게 사실 일치 여부로만 판단

[pat 필드 규칙 - ok:false인 선지만 해당]
독서 세트(set id가 r로 시작)는 R1~R4만 사용:
  R1: 사실 왜곡 — 수치·상태·방향을 정반대나 다른 값으로 서술
  R2: 인과·관계 전도 — 주체-객체, 원인-결과, 포함관계를 뒤바꿈
  R3: 과잉 추론 — 지문에 없는 내용, 1단계 이상 비약
  R4: 개념 혼합 — 서로 다른 문단의 개념어를 섞어 거짓 문장 구성

문학 세트(set id가 l로 시작)는 L1~L5만 사용:
  L1: 표현·형식 오독 — 시어·이미지·수사법·서술 방식을 잘못 파악
  L2: 정서·태도 오독 — 화자·인물의 감정·태도·심리를 반대로 파악
  L3: 주제·의미 과잉 — 작품에 없는 의미 도출, 근거 없는 확대 해석
  L4: 구조·맥락 오류 — 시점·구성·대비 구조·장면 전환을 잘못 설명
  L5: 보기 대입 오류 — 보기 조건을 작품에 잘못 적용하거나 보기 자체를 오독

ok:true인 선지는 pat: null
ok:false 선지는 **반드시** R1~R4 / L1~L5 / V 중 하나로 pat 을 채워라. null 또는 미기재 금지.
analysis 꼬리 [결론] 에 [R1]~[R4] 또는 [L1]~[L5] 또는 [V] 라벨이 들어갔다면
pat 필드에도 **동일한 코드** 를 반드시 반환하라. (예: analysis 에 [L5] 쓰면 pat: "L5")
정말로 분류 불가일 때만 pat: 0 (수동 검토 플래그)

[analysis 작성 규칙]
- 반드시 지문의 실제 문장을 근거로 사용
- 3~5등급 학생도 이해할 수 있게 구체적으로
- 형식:
  ok:true:  '📌 지문 근거: "..."\n🔍 선지 분해: ...\n🔎 배제 근거: ...\n✅ 지문과 일치하는 적절한 진술'
  ok:false: '📌 지문 근거: "..."\n🔍 선지 분해: ...\n🔎 정답 비교: ...\n❌ 지문과 어긋나는 부적절한 진술 [패턴명]'

[변별 판단 규칙 — 필수]
단순히 "사실 일치/불일치" 만 설명하면 부족하다.
각 선지의 해설은 반드시 **다른 선지와 비교하여 왜 이 선지가 정답/오답인지** 를 드러내야 한다.

questionType: "positive" (가장 적절한 것은?)
  - 정답 선지 (ok:true) 는 🔎 배제 근거 섹션에 **4개 오답 선지 각각이 왜 정답이 될 수 없는지** 한 줄씩 밝힐 것.
  - 오답 선지 (ok:false) 는 🔎 정답 비교 섹션에 **정답 선지 #N 이 왜 이 선지보다 더 적절한지** 한 줄로 밝힐 것.

questionType: "negative" (적절하지 않은 것은?)
  - 정답 선지 (ok:false) 는 🔎 배제 근거 섹션에 **4개 오답 선지 (ok:true) 가 왜 지문과 일치하는지** 간략히 언급할 것.
  - 오답 선지 (ok:true) 는 🔎 정답 비교 섹션에 **정답 선지 #N 이 왜 지문과 어긋나는지** 한 줄로 언급할 것.

비교 대상의 최소 수량:
  - positive 정답 해설은 4개 오답에 대한 배제 근거 4줄 (생략 금지).
  - negative 정답 해설은 4개 오답(ok:true) 일치 근거 4줄 (생략 금지).
  - 오답 해설은 정답 1개에 대한 비교 1줄 (생략 금지).

[ok:true 해설 필수 규칙]
ok:true 해설에서는 부정 판정 표현을 절대 사용하지 말 것 (단, 🔎 배제 근거 섹션에서 타 선지 왜 틀린지 기술하는 것은 허용).
금지 표현 (정답 선지 자체에 대한 기술에서만): 어긋나다, 왜곡, 잘못, 부적절, 맞지 않다, 일치하지 않다
정답 해설은 아래 4가지 기술:
- 지문 근거 (어디서 확인했는지)
- 선지와의 직접 일치 (어떻게 같은지)
- 🔎 배제 근거 (타 선지가 정답이 될 수 없는 이유)
- 왜 맞는지 (한 줄 결론)

[보기 문제 특별 규칙]
bogi 필드가 비어있지 않은 문항은 반드시 아래 세 가지 중
해당하는 오류 유형을 analysis에 명시해줘.

오류 유형:
① 보기 오독: 보기 조건 자체를 잘못 이해한 경우
② 보기 대입 오류: 보기 조건을 지문/작품에 잘못 적용한 경우
③ 지문 오독: 보기와 무관하게 지문 사실 자체를 왜곡한 경우

ok:false 선지 analysis 형식 (보기 문제):
'📌 보기 근거: "보기의 핵심 조건"\n📌 지문 근거: "지문의 실제 내용"\n🔍 ...\n❌ [오류유형①②③] 지문과 어긋나는 부적절한 진술 [패턴명]'

ok:true 선지 analysis 형식 (보기 문제):
'📌 보기 근거: "보기의 핵심 조건"\n📌 지문 근거: "지문의 실제 내용"\n🔍 ...\n✅ 보기 조건과 지문이 일치하는 적절한 진술'

[검증]
작성 후 스스로 확인: 정답 선지의 ok값이 questionType과 일치하는가?
- questionType: positive → 정답 선지 ok: true
- questionType: negative → 정답 선지 ok: false`;

// ============================================================
// 옵션 i — system prompt 끝 추가 1줄 (set_id 동적 삽입)
// ============================================================
const OPTION_I_TEMPLATE = `[중대 제약] 본 분석 대상 시험 ID는 {set_id}이다. 다른 시험·연도·문항의 내용을 참조하지 말 것.`;

// ============================================================
// 대상 lock — r2023a Q2 5선지 전체
// ============================================================
const TARGET_SET = "r2023a";
const TARGET_QID = 2;
const TARGET_CORRECT_NUM = 5;
const TARGET_CHOICE_NUMS = [1, 2, 3, 4, 5];
const RUNS = 3;

// ============================================================
// 헬퍼
// ============================================================
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function buildSystemPrompt(setId, runId) {
  const optionI = OPTION_I_TEMPLATE.replace("{set_id}", setId);
  return SYSTEM_PROMPT + `\n\n` + optionI + `\n\n[run_id]\n${runId}`;
}

function parseJSON(text) {
  const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  return JSON.parse(cleaned);
}

async function loadData() {
  const raw = await fs.readFile(DATA_PATH, "utf8");
  return JSON.parse(raw);
}

function getSet(data, setId) {
  return data["2023수능"]?.reading?.find((s) => s.id === setId);
}

function getQuestion(set, qid) {
  return set.questions.find((q) => q.id === qid);
}

function getChoice(question, num) {
  return question.choices.find((c) => c.num === num);
}

// ============================================================
// 옵션 i 격리 호출 (Mode A 구조)
// ============================================================
async function callIsolatedWithOptI(set, qid, num, correctNum, runId) {
  const question = getQuestion(set, qid);
  const choice = getChoice(question, num);

  const userPrompt = `다음은 단일 선지 격리 분석 요청이다.

[정답 정보]
문항 ${qid}번 (${question.questionType}): 정답 선지 = ${correctNum}번

[세트 컨텍스트]
${JSON.stringify({
  id: set.id,
  title: set.title,
  range: set.range,
  sents: set.sents,
})}

[분석 대상 선지]
문항: ${question.t}
${question.bogi ? `보기: ${question.bogi}` : ""}
선지 ${num}: ${choice.t}

본 선지의 pat과 analysis만 출력하라. 다른 선지 분석 금지.

형식: [{ qId: ${qid}, num: ${num}, pat: "...", analysis: "..." }]`;

  const startTime = Date.now();
  const response = await client.messages.create(
    {
      model: MODEL,
      max_tokens: 2000,
      temperature: 0,
      system: buildSystemPrompt(set.id, runId),
      messages: [{ role: "user", content: userPrompt }],
    },
    BETA_HEADER,
  );
  const elapsed = Date.now() - startTime;

  const rawText = response.content[0].text;
  let parsed = null;
  let parseError = null;
  try {
    parsed = parseJSON(rawText);
  } catch (e) {
    parseError = e.message;
  }

  return {
    mode: "A_optI",
    run_id: runId,
    set_id: set.id,
    question_id: qid,
    choice_num: num,
    correct_num: correctNum,
    raw_response: rawText,
    parsed,
    parse_error: parseError,
    model_used: response.model,
    input_tokens: response.usage.input_tokens,
    output_tokens: response.usage.output_tokens,
    elapsed_ms: elapsed,
  };
}

// ============================================================
// main
// ============================================================
async function main() {
  console.log("[4-c] 트랙 2-c 작업 4-c 시작 (옵션 i 효과 검증)");
  console.log("[4-c] CWD:", process.cwd());
  console.log("[4-c] DATA_PATH:", DATA_PATH);
  console.log("[4-c] OPTION_I_TEMPLATE:", OPTION_I_TEMPLATE);

  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY 미설정. .env 확인 필요.");
  }

  const data = await loadData();
  const set = getSet(data, TARGET_SET);
  if (!set) throw new Error(`set not found: ${TARGET_SET}`);

  const results = { mode_a_opt_i: [], meta: {} };
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  console.log(
    `\n=== 옵션 i 격리 호출: ${TARGET_SET} Q${TARGET_QID} × ${TARGET_CHOICE_NUMS.length}선지 × ${RUNS}회 = ${TARGET_CHOICE_NUMS.length * RUNS} 호출 ===`,
  );
  for (let run = 1; run <= RUNS; run++) {
    for (const num of TARGET_CHOICE_NUMS) {
      const runId = `2026-04-30-MA_optI-${run}-${TARGET_SET}-q${TARGET_QID}-c${num}`;
      console.log(`[opt-i run ${run}] ${TARGET_SET} Q${TARGET_QID} #${num} ...`);
      try {
        const result = await callIsolatedWithOptI(
          set,
          TARGET_QID,
          num,
          TARGET_CORRECT_NUM,
          runId,
        );
        results.mode_a_opt_i.push(result);
        totalInputTokens += result.input_tokens;
        totalOutputTokens += result.output_tokens;
        console.log(
          `  → ${result.elapsed_ms}ms, in ${result.input_tokens} / out ${result.output_tokens}`,
        );
      } catch (e) {
        results.mode_a_opt_i.push({
          mode: "A_optI",
          run_id: runId,
          set_id: TARGET_SET,
          question_id: TARGET_QID,
          choice_num: num,
          error: e.message,
        });
        console.error(`  ✗ ERROR: ${e.message}`);
      }
      await sleep(2000);
    }
  }

  // 비용 추정 (claude-sonnet-4-5: $3/MTok input, $15/MTok output) [Inference, 2026-04 기준]
  const costEstimateUsd =
    (totalInputTokens / 1_000_000) * 3 + (totalOutputTokens / 1_000_000) * 15;

  results.meta = {
    timestamp: new Date().toISOString(),
    model: MODEL,
    temperature: 0,
    target_set: TARGET_SET,
    target_question_id: TARGET_QID,
    target_correct_num: TARGET_CORRECT_NUM,
    target_choice_nums: TARGET_CHOICE_NUMS,
    runs: RUNS,
    total_calls: results.mode_a_opt_i.length,
    total_input_tokens: totalInputTokens,
    total_output_tokens: totalOutputTokens,
    cost_estimate_usd: costEstimateUsd,
    option_i_template: OPTION_I_TEMPLATE,
    option_i_resolved_example: OPTION_I_TEMPLATE.replace("{set_id}", TARGET_SET),
    system_prompt_source:
      "pipeline/step3_analysis.js L130~L216 (current modified state, 2026-04-22) + 옵션 i 1줄",
  };

  await fs.writeFile(OUTPUT_PATH, JSON.stringify(results, null, 2), "utf8");
  console.log(`\n[4-c] 완료. 결과: ${OUTPUT_PATH}`);
  console.log(`[4-c] 총 토큰: in ${totalInputTokens} / out ${totalOutputTokens}`);
  console.log(`[4-c] 비용 추정: $${costEstimateUsd.toFixed(4)}`);
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
