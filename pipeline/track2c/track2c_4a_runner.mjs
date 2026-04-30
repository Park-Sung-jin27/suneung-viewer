// pipeline/track2c/track2c_4a_runner.mjs
// 트랙 2-c 작업 4-a — 본체 누출 진단 (Mode A: isolation × 3, Mode B: 운영 환경 재현 × 2)
//
// 품질 심사관 lock 사항 (변경 금지):
//   - SYSTEM_PROMPT = pipeline/step3_analysis.js L130~L216 본문 그대로 복사 (4-e 후 sync 의무)
//   - temperature: 0
//   - 4 대상 전부 SYSTEM_PROMPT 사용 (B6 결정 (a))
//   - Mode A = 선지 단위 격리, 4 × 3회 = 12 호출
//   - Mode B = set 단위 운영 환경 재현, 3 sets × 2회 = 6 호출
//   - nonce: system prompt 끝에 동적 append (캐시 차단)
//   - 호출 간 sleep 2초
//   - 출력: pipeline/track2c/4a_results.json
//   - step3_analysis.js 본체 미수정

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
const OUTPUT_PATH = path.resolve(__dirname, "./4a_results.json");

// ============================================================
// SYSTEM_PROMPT — pipeline/step3_analysis.js L130~L216 본문 그대로 복사
// (4-e 통과 후 step3 본체 변경 시 동기화 의무)
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
// 4 대상 lock (raw 인용 2 기반)
// ============================================================
const TARGETS = [
  { set_id: "r2023a", question_id: 2, choice_num: 5, correct_num: 5, is_vocab_in_production: false },
  { set_id: "r2023b", question_id: 5, choice_num: 5, correct_num: 5, is_vocab_in_production: false },
  { set_id: "r2023b", question_id: 9, choice_num: 2, correct_num: 2, is_vocab_in_production: true }, // 어휘 치환
  { set_id: "r2023c", question_id: 11, choice_num: 5, correct_num: 5, is_vocab_in_production: false },
];

const TARGET_SETS = ["r2023a", "r2023b", "r2023c"]; // Mode B 대상

// ============================================================
// 헬퍼
// ============================================================
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function withNonce(systemPrompt, runId) {
  return systemPrompt + `\n\n[run_id]\n${runId}`;
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
// Mode A — 선지 단위 격리 호출
// ============================================================
async function callModeA(set, qid, num, correctNum, runId) {
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
      system: withNonce(SYSTEM_PROMPT, runId),
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
    mode: "A",
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
// Mode B — set 단위 운영 환경 재현 호출
// (callAnalyze 로직 복제 — step3_analysis.js 본체 미수정)
// ============================================================
async function callModeB(set, runId) {
  const answerGuide = set.questions.map((q) => {
    const correctTarget = TARGETS.find((t) => t.set_id === set.id && t.question_id === q.id);
    const correctNum = correctTarget ? correctTarget.correct_num : null;
    if (correctNum === null) {
      // 대상 외 문항: 임의 정답 1번 (Mode B의 목적은 set 통째 호출 = 운영 환경 재현)
      return { qId: q.id, questionType: q.questionType, correctNum: 1 };
    }
    return { qId: q.id, questionType: q.questionType, correctNum };
  });

  const userPrompt = `다음 세트를 분석해줘.

[정답 정보]
${answerGuide.map((g) => `문항 ${g.qId}번 (${g.questionType}): 정답 선지 = ${g.correctNum}번`).join("\n")}

[세트 데이터]
${JSON.stringify(set)}

각 선지의 pat과 analysis만 작성해줘. ok 필드는 출력하지 마.
- 정답 선지(ok:true에 해당): pat: null
- 오답 선지(ok:false에 해당): 독서 세트는 R1~R4, 문학 세트는 L1~L5 중 하나

choices 배열만 JSON으로 반환해줘.
형식: [{ qId: 1, num: 1, pat: null, analysis: "..." }, ...]
반드시 qId(문항 id)를 포함해줘. qId는 set.questions[n].id 값이다.`;

  const startTime = Date.now();
  const response = await client.messages.create(
    {
      model: MODEL,
      max_tokens: 8000,
      temperature: 0,
      system: withNonce(SYSTEM_PROMPT, runId),
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
    mode: "B",
    run_id: runId,
    set_id: set.id,
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
  console.log("[4-a] 트랙 2-c 작업 4-a 시작");
  console.log("[4-a] CWD:", process.cwd());
  console.log("[4-a] DATA_PATH:", DATA_PATH);

  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY 미설정. .env 확인 필요.");
  }

  const data = await loadData();
  const sets = {};
  for (const sid of TARGET_SETS) {
    sets[sid] = getSet(data, sid);
    if (!sets[sid]) throw new Error(`set not found: ${sid}`);
  }

  const results = { mode_a: [], mode_b: [], meta: {} };
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  // Mode A: 선지 단위 격리 × 3회
  console.log("\n=== Mode A: isolation 12 호출 ===");
  for (let run = 1; run <= 3; run++) {
    for (const target of TARGETS) {
      const runId = `2026-04-30-MA-${run}-${target.set_id}-q${target.question_id}-c${target.choice_num}`;
      console.log(`[A run ${run}] ${target.set_id} Q${target.question_id} #${target.choice_num} ...`);
      try {
        const result = await callModeA(
          sets[target.set_id],
          target.question_id,
          target.choice_num,
          target.correct_num,
          runId,
        );
        result.is_vocab_in_production = target.is_vocab_in_production;
        results.mode_a.push(result);
        totalInputTokens += result.input_tokens;
        totalOutputTokens += result.output_tokens;
        console.log(`  → ${result.elapsed_ms}ms, in ${result.input_tokens} / out ${result.output_tokens}`);
      } catch (e) {
        results.mode_a.push({
          mode: "A",
          run_id: runId,
          set_id: target.set_id,
          question_id: target.question_id,
          choice_num: target.choice_num,
          error: e.message,
        });
        console.error(`  ✗ ERROR: ${e.message}`);
      }
      await sleep(2000);
    }
  }

  // Mode B: set 단위 운영 환경 재현 × 2회
  console.log("\n=== Mode B: 운영 환경 재현 6 호출 ===");
  for (let run = 1; run <= 2; run++) {
    for (const setId of TARGET_SETS) {
      const runId = `2026-04-30-MB-${run}-${setId}`;
      console.log(`[B run ${run}] ${setId} (full set) ...`);
      try {
        const result = await callModeB(sets[setId], runId);
        results.mode_b.push(result);
        totalInputTokens += result.input_tokens;
        totalOutputTokens += result.output_tokens;
        console.log(`  → ${result.elapsed_ms}ms, in ${result.input_tokens} / out ${result.output_tokens}`);
      } catch (e) {
        results.mode_b.push({ mode: "B", run_id: runId, set_id: setId, error: e.message });
        console.error(`  ✗ ERROR: ${e.message}`);
      }
      await sleep(2000);
    }
  }

  // 비용 추정 (claude-sonnet-4-5: $3/MTok input, $15/MTok output) [Inference, 2026-04 기준]
  const costEstimateUsd = (totalInputTokens / 1_000_000) * 3 + (totalOutputTokens / 1_000_000) * 15;

  results.meta = {
    timestamp: new Date().toISOString(),
    model: MODEL,
    temperature: 0,
    mode_a_count: results.mode_a.length,
    mode_b_count: results.mode_b.length,
    total_input_tokens: totalInputTokens,
    total_output_tokens: totalOutputTokens,
    cost_estimate_usd: costEstimateUsd,
    targets: TARGETS,
    system_prompt_source: "pipeline/step3_analysis.js L130~L216 (current modified state, 2026-04-22)",
  };

  await fs.writeFile(OUTPUT_PATH, JSON.stringify(results, null, 2), "utf8");
  console.log(`\n[4-a] 완료. 결과: ${OUTPUT_PATH}`);
  console.log(`[4-a] 총 토큰: in ${totalInputTokens} / out ${totalOutputTokens}`);
  console.log(`[4-a] 비용 추정: $${costEstimateUsd.toFixed(4)}`);
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
