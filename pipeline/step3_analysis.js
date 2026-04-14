import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { jsonrepair } from "jsonrepair";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env"), override: true });

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

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
분류 불가 시 pat: 0 (수동 검토 플래그)

[analysis 작성 규칙 — 4단계 필수]

1단계: 선지 조건 분해
선지가 복합 조건(A하며 B를 C)이면 조건을 분리해서 각각 검증하라.
예) '대상과 소통하며 문제 해결 과정을 연쇄적으로 제시' → ①대상과 소통 ②문제 해결 과정 ③연쇄적 제시 각각 확인.

2단계: 작품별 개별 검증 (문학 복수 작품 문항 필수)
가/나/다 각 작품에서 선지 조건이 성립하는지 개별 확인하라.
공통점 문항은 모든 작품에서 동시에 성립해야 정답.
일부 작품에만 해당하면 반드시 어느 작품에 해당하고 어느 작품에 없는지 명시하라.

3단계: 혼동 포인트 명시
단순히 '없다'가 아니라 '~처럼 보이지만 실제로는 ~이다'를 설명하라.
예) '관용처럼 보이지만 실제로는 만족감이다', '소통처럼 보이지만 일방적 서술이다'.

4단계: 결론 한 줄
어떤 조건이 왜 불충족인지 한 줄로 마무리하라.

- 반드시 지문의 실제 문장을 근거로 인용하라
- 3~4등급 학생도 이해할 수 있게 쉬운 말로 설명하라
- 전문 용어 사용 시 괄호로 뜻을 풀어라
- 형식:
  ok:true:  '📌 지문 근거: "..."\n🔍 ...\n✅ 지문과 일치하는 적절한 진술'
  ok:false: '📌 지문 근거: "..."\n🔍 ...\n❌ 지문과 어긋나는 부적절한 진술 [패턴명]'

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

const RETRY_SYSTEM_PROMPT =
  SYSTEM_PROMPT +
  `

경고: ok:false인 선지는 반드시 pat을 채워야 한다.
독서 세트(set id가 r로 시작)는 R1~R4 중 하나, 문학 세트(set id가 l로 시작)는 L1~L5 중 하나.
pat: null은 ok:true인 선지에만 허용된다.`;

const REANALYSIS_SYSTEM_PROMPT = `너는 수능 국어 전문 해설 작성자다.
반드시 순수 JSON 객체만 출력하라. 마크다운, 설명 텍스트 없음.

주어진 선지 하나에 대해 analysis만 작성해줘. 아래 4단계를 반드시 따르라.

1단계: 선지 조건 분해 — 복합 조건이면 각각 분리해서 검증
2단계: 작품별 개별 검증 — 복수 작품 문항은 가/나/다 각각 확인
3단계: 혼동 포인트 명시 — '~처럼 보이지만 실제로는 ~이다' 형태로 설명
4단계: 결론 한 줄 — 어떤 조건이 왜 불충족인지 마무리

형식:
  ok:true:  '📌 지문 근거: "..."\n🔍 ...\n✅ 지문과 일치하는 적절한 진술'
  ok:false: '📌 지문 근거: "..."\n🔍 ...\n❌ 지문과 어긋나는 부적절한 진술 [패턴명]'

반드시 지문의 실제 문장을 근거로 사용. 3~4등급 학생도 이해할 수 있게 쉬운 말로.
출력 형식: { "analysis": "..." }`;

const VOCAB_SYSTEM_PROMPT = `너는 수능 국어 어휘·표현 문제 전문 해설 작성자다.
반드시 순수 JSON 배열만 출력하라. 마크다운, 설명 텍스트 없음.

이 문항은 어휘/문맥적 의미 문제다. 각 선지마다 아래 형식으로 analysis를 작성하라.

[analysis 형식]
[문맥 속 의미]
'밑줄 단어'는 이 지문에서 "~하다"는 의미로 쓰임 (사전적 의미와 구별)

[호응 성분]
목적어: ~을/를
부사어: ~하게 / ~으로
주어: ~이/가

[치환 판단]
이 문맥에서 '선지단어'로 바꾸면 → 자연스럽다/어색하다
이유: ~

[결론]
✅ 적절 / ❌ 부적절 — 한 줄 근거

[추가 규칙]
- cs_ids는 반드시 빈 배열 []로 설정
- "지문이 제공되지 않았으나" 같은 문구 절대 금지
- 지문 문장 인용은 호응 성분 확인용으로만 사용
- ok:true 선지: 결론에 ✅ 적절
- ok:false 선지: 결론에 ❌ 부적절
- pat은 ok:true → null, ok:false → R1~R4 또는 L1~L5

출력 형식: [{ qId: 1, num: 1, pat: null, analysis: "..." }, ...]
반드시 qId를 포함해줘.`;

// ─── 재시도 유틸 ─────────────────────────────────────────────

async function callWithRetry(fn, maxRetries = 3, delay = 5000) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (err) {
      const isRetryable =
        err.message?.includes("Connection") ||
        err.message?.includes("timeout") ||
        err.status === 529 ||
        err.status === 500;
      if (isRetryable && i < maxRetries - 1) {
        console.warn(`  ⚠️ API 오류 (${i + 1}/${maxRetries}): ${err.message}`);
        console.warn(`  ${delay / 1000}초 후 재시도...`);
        await new Promise((r) => setTimeout(r, delay));
      } else {
        throw err;
      }
    }
  }
}

// ─── JSON 파싱 유틸 ──────────────────────────────────────────

function stripMarkdown(text) {
  return text
    .trim()
    .replace(/^```[a-z]*\n?/i, "")
    .replace(/\n?```$/i, "");
}

function fixUnescapedQuotes(jsonStr) {
  const result = [];
  let inString = false;
  let i = 0;
  while (i < jsonStr.length) {
    const ch = jsonStr[i];
    if (ch === "\\" && inString) {
      result.push(ch, jsonStr[i + 1] || "");
      i += 2;
      continue;
    }
    if (ch === '"') {
      if (!inString) {
        inString = true;
        result.push(ch);
      } else {
        let j = i + 1;
        while (j < jsonStr.length && " \n\r\t".includes(jsonStr[j])) j++;
        const next = jsonStr[j];
        if (
          next === ":" ||
          next === "," ||
          next === "}" ||
          next === "]" ||
          j >= jsonStr.length
        ) {
          inString = false;
          result.push(ch);
        } else {
          result.push('\\"');
        }
      }
    } else {
      result.push(ch);
    }
    i++;
  }
  return result.join("");
}

function tryParse(text) {
  try {
    const parsed = JSON.parse(text);
    if (
      Array.isArray(parsed) &&
      parsed.length > 0 &&
      Array.isArray(parsed[0])
    ) {
      return parsed.flat();
    }
    return parsed;
  } catch {
    return null;
  }
}

function parseJSON(raw) {
  const text = stripMarkdown(raw);
  const direct = tryParse(text);
  if (direct) return direct;

  console.warn("JSON 직접 파싱 실패, 따옴표 수정 시도");
  const fixed = tryParse(fixUnescapedQuotes(text));
  if (fixed) return fixed;

  console.warn("따옴표 수정 실패, 여러 배열 병합 시도");
  const arrays = [];
  let depth = 0,
    start = -1;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "[") {
      if (depth === 0) start = i;
      depth++;
    } else if (text[i] === "]") {
      depth--;
      if (depth === 0 && start !== -1) {
        const chunk = text.slice(start, i + 1);
        const parsed = tryParse(chunk) || tryParse(fixUnescapedQuotes(chunk));
        if (parsed) arrays.push(...parsed);
        start = -1;
      }
    }
  }
  if (arrays.length > 0) return arrays;

  console.warn("배열 병합 실패, jsonrepair 시도");
  const repaired = jsonrepair(text);
  return JSON.parse(repaired);
}

// ─── 핵심 로직 ───────────────────────────────────────────────

const VALID_PATS = new Set([
  "R1",
  "R2",
  "R3",
  "R4",
  "L1",
  "L2",
  "L3",
  "L4",
  "L5",
  "V",
]);

// analysis 키워드 → pat 자동 분류 (postProcess fallback)
function detectPatFromAnalysis(a, sec) {
  const m = a.match(/\[(R[1-4]|L[1-5]|V)\]/);
  if (m) return m[1];
  if (/\[오류유형[①②③]/.test(a) || a.includes("📌 보기 근거"))
    return sec === "reading" ? "R4" : "L5";
  if (
    /팩트 왜곡|사실 왜곡|의미 왜곡|어휘 의미|문맥적 의미|정반대|역전된/.test(a)
  )
    return sec === "reading" ? "R1" : "L1";
  if (
    /관계[··]인과|인과 전도|인과관계 왜곡|논리 왜곡|반박-지지|대상 바꿔치기|순서 역전/.test(
      a,
    )
  )
    return sec === "reading" ? "R2" : "L4";
  if (
    /과도한 추론|과잉 추론|지문에 없|근거 부재|지문 핵심 미파악|과장 해석/.test(
      a,
    )
  )
    return sec === "reading" ? "R3" : "L3";
  if (/개념 짜깁기|개념 혼합|개념 혼동/.test(a))
    return sec === "reading" ? "R4" : "L1";
  if (/심리 오독|정서\s?오독|인물 의도|맥락 오독/.test(a))
    return sec === "reading" ? "R1" : "L2";
  if (/수사법|시어|이미지|표현법|시간 표지/.test(a) && sec === "literature")
    return "L1";
  if (
    /구조.*오류|맥락.*오류|화자.*오독|인물.*오인/.test(a) &&
    sec === "literature"
  )
    return "L4";
  if (/정서.*오류|태도 오독|화자의 태도 오독/.test(a) && sec === "literature")
    return "L2";
  if (/권면 대상|핵심 의미 왜곡|과도한 의미/.test(a) && sec === "literature")
    return "L3";
  return null;
}

function sanitizePat(pat, ok) {
  // ok:true는 무조건 null
  if (ok === true) return null;
  // 유효한 문자열 패턴이면 그대로
  if (typeof pat === "string" && VALID_PATS.has(pat)) return pat;
  // 숫자나 기타 → null (postProcess에서 detectPat으로 재분류 시도)
  return null;
}

function applyChoices(set, updatedChoices) {
  const updatedQuestions = set.questions.map((q) => ({
    ...q,
    choices: q.choices.map((orig) => {
      const updated = updatedChoices.find(
        (c) => c.qId === q.id && c.num === orig.num,
      );
      if (updated) {
        const patRaw = updated.pat ?? orig.pat;
        const okVal = updated.ok ?? orig.ok;
        return {
          ...orig,
          ok: okVal,
          pat: sanitizePat(patRaw, okVal),
          analysis: updated.analysis ?? orig.analysis,
        };
      }
      return orig;
    }),
  }));
  return { ...set, questions: updatedQuestions };
}

async function callAnalyze(set, answerKey, systemPrompt) {
  const answerGuide = set.questions
    .map((q) => {
      const correctNum = answerKey[String(q.id)];
      if (correctNum === undefined) return null;
      return { qId: q.id, questionType: q.questionType, correctNum };
    })
    .filter(Boolean);

  // 지문과 문제를 구조화해서 전달 (토큰 효율 + 해설 품질 향상)
  const sentsText = set.sents.map((s) => `[${s.id}] ${s.t}`).join("\n");

  const questionsText = set.questions
    .map((q) => {
      const choicesText = q.choices.map((c) => `  ${c.num}. ${c.t}`).join("\n");
      const bogi = q.bogi
        ? `\n  <보기> ${typeof q.bogi === "string" ? q.bogi.substring(0, 200) : ""}`
        : "";
      return `Q${q.id} (${q.questionType}): ${q.t}${bogi}\n${choicesText}`;
    })
    .join("\n\n");

  const sec =
    set.id.startsWith("r") || set.id.startsWith("s") ? "reading" : "literature";

  const userPrompt = `세트 "${set.id}" (${set.title}) 분석

[정답 정보]
${answerGuide.map((g) => `문항 ${g.qId}번 (${g.questionType}): 정답 선지 = ${g.correctNum}번`).join("\n")}

[지문 전문]
${sentsText}

[문항과 선지]
${questionsText}

위 지문을 근거로 각 선지의 pat과 analysis를 작성해줘.
- 정답 선지(ok:true에 해당): pat: null
- 오답 선지(ok:false에 해당): ${sec === "reading" ? "R1~R4" : "L1~L5"} 중 하나
- analysis는 반드시 지문의 구체적 근거를 인용하여 해당 선지가 왜 맞거나 틀린지 설명할 것

choices 배열만 JSON으로 반환해줘.
형식: [{ qId: 1, num: 1, pat: null, analysis: "..." }, ...]
반드시 qId(문항 id)를 포함해줘. qId는 set.questions[n].id 값이다.`;

  const response = await callWithRetry(() =>
    client.messages.create(
      {
        model: "claude-sonnet-4-5",
        max_tokens: 16000,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      },
      { headers: { "anthropic-beta": "output-128k-2025-02-19" } },
    ),
  );

  return parseJSON(response.content[0].text);
}

async function reanalyzeSingleChoice(set, question, choice) {
  const userPrompt = `지문 세트: ${JSON.stringify({ id: set.id, title: set.title, sents: set.sents })}
문항: ${JSON.stringify({ id: question.id, t: question.t, questionType: question.questionType })}
선지: { num: ${choice.num}, t: "${choice.t}", ok: ${choice.ok} }

위 선지의 ok 값(${choice.ok})에 맞게 analysis만 작성해줘.
출력: { "analysis": "..." }`;

  const response = await callWithRetry(() =>
    client.messages.create(
      {
        model: "claude-sonnet-4-5",
        max_tokens: 2000,
        system: REANALYSIS_SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }],
      },
      { headers: { "anthropic-beta": "output-128k-2025-02-19" } },
    ),
  );

  const parsed = parseJSON(response.content[0].text);
  return parsed.analysis || "";
}

// ─── 후처리 보정 ─────────────────────────────────────────────

export async function postProcess(result, answerKey) {
  const correctedSets = { reading: [], literature: [] };
  let totalOkFixed = 0,
    totalPatFlagged = 0,
    totalPatNullFixed = 0;

  for (const section of ["reading", "literature"]) {
    for (const set of result[section]) {
      const updatedQuestions = [];

      for (const q of set.questions) {
        const correctNum = answerKey[String(q.id)];
        if (correctNum === undefined) {
          updatedQuestions.push(q);
          continue;
        }

        const updatedChoices = [];
        for (const c of q.choices) {
          let choice = { ...c };
          const isCorrect = c.num === correctNum;
          const expectedOk =
            q.questionType === "positive" ? isCorrect : !isCorrect;
          const okChanged = choice.ok !== expectedOk;

          if (okChanged) {
            console.warn(
              `  [postProcess] ok 보정: ${set.id} ${q.id}번 선지${c.num} ${choice.ok} → ${expectedOk}`,
            );
            choice.ok = expectedOk;
            totalOkFixed++;
          }

          // ok:true → pat 강제 null
          if (choice.ok === true && choice.pat !== null) {
            choice.pat = null;
            totalPatNullFixed++;
          }
          // ok:false + pat 미분류(null/숫자/잘못된 문자열) → analysis 키워드 기반 재분류
          if (choice.ok === false && !VALID_PATS.has(choice.pat)) {
            choice.pat =
              detectPatFromAnalysis(choice.analysis || "", section) ?? 0;
            totalPatFlagged++;
          }

          if (okChanged) {
            console.log(
              `  [postProcess] analysis 재생성: ${set.id} ${q.id}번 선지${c.num}`,
            );
            try {
              choice.analysis = await reanalyzeSingleChoice(set, q, choice);
            } catch (err) {
              console.warn(
                `  [postProcess] analysis 재생성 실패: ${err.message}`,
              );
            }
          }

          updatedChoices.push(choice);
        }
        updatedQuestions.push({ ...q, choices: updatedChoices });
      }
      correctedSets[section].push({ ...set, questions: updatedQuestions });
    }
  }

  console.log("\n" + "=".repeat(50));
  console.log("[postProcess] 보정 완료 요약");
  console.log("=".repeat(50));
  if (totalOkFixed === 0) console.log(`ok 보정: ✅ 0건`);
  else console.warn(`ok 보정: ⚠️ ${totalOkFixed}건`);
  console.log(`pat:null→0 플래그: ${totalPatFlagged}건`);
  console.log(`ok:true & pat→null: ${totalPatNullFixed}건`);

  let remaining = 0;
  for (const section of ["reading", "literature"]) {
    for (const set of correctedSets[section]) {
      for (const q of set.questions) {
        const correctNum = answerKey[String(q.id)];
        if (!correctNum) continue;
        const correctChoice = q.choices.find((c) => c.num === correctNum);
        if (!correctChoice) continue;
        const expectedOk = q.questionType === "positive" ? true : false;
        if (correctChoice.ok !== expectedOk) remaining++;
      }
    }
  }
  console.log(`ok 불일치 잔여: ${remaining}건`);
  console.log("=".repeat(50));

  return correctedSets;
}

function injectOkValues(choices, set, answerKey) {
  return choices.map((c) => {
    const q = set.questions.find((q) => q.id === c.qId);
    if (!q) {
      console.warn(`  [injectOk] qId ${c.qId} 매칭 실패 — num ${c.num}`);
      return c;
    }
    const correctNum = answerKey[String(q.id)];
    if (correctNum === undefined) return c;
    const isCorrect = c.num === correctNum;
    c.ok = q.questionType === "positive" ? isCorrect : !isCorrect;
    return c;
  });
}

const VOCAB_PATTERN =
  /사전적 의미|문맥상 의미|문맥적 의미|밑줄 친.*의미|ⓐ.*~.*ⓔ|㉠.*~.*㉤/;

function isVocabQuestion(q) {
  return VOCAB_PATTERN.test(q.t);
}

async function analyzeSet(set, answerKey) {
  const vocabQIds = new Set(
    set.questions.filter(isVocabQuestion).map((q) => q.id),
  );

  if (vocabQIds.size === 0) {
    const choices = await callAnalyze(set, answerKey, SYSTEM_PROMPT);
    return injectOkValues(choices, set, answerKey);
  }

  // 일반 문항과 어휘 문항 분리
  const normalSet = {
    ...set,
    questions: set.questions.filter((q) => !vocabQIds.has(q.id)),
  };
  const vocabSet = {
    ...set,
    questions: set.questions.filter((q) => vocabQIds.has(q.id)),
  };

  let allChoices = [];

  if (normalSet.questions.length > 0) {
    const normalChoices = await callAnalyze(
      normalSet,
      answerKey,
      SYSTEM_PROMPT,
    );
    allChoices.push(...normalChoices);
  }

  if (vocabSet.questions.length > 0) {
    const vocabChoices = await callAnalyze(
      vocabSet,
      answerKey,
      VOCAB_SYSTEM_PROMPT,
    );
    allChoices.push(...vocabChoices);
  }

  return injectOkValues(allChoices, set, answerKey);
}

export async function retrySet(set, answerKey) {
  console.log(`[step3:retry] 재분석 중: ${set.id} (${set.range})`);
  const updatedChoices = await callAnalyze(set, answerKey, RETRY_SYSTEM_PROMPT);
  return applyChoices(set, updatedChoices);
}

// ─── ★ 핵심: 세트별 중간 저장으로 중단 내성 강화 ─────────────
/**
 * partialCachePath가 주어지면:
 * - 이미 완료된 세트는 캐시에서 로드하여 스킵
 * - 새로 완료된 세트는 즉시 캐시에 저장
 * → 절전/네트워크 끊김 후 재실행 시 완료된 세트부터 이어서 진행
 */
export async function analyzeStructure(
  structureData,
  answerKey,
  partialCachePath = null,
) {
  // 기존 부분 완료 결과 로드
  let partial = { reading: [], literature: [] };
  if (partialCachePath && fs.existsSync(partialCachePath)) {
    partial = JSON.parse(fs.readFileSync(partialCachePath, "utf8"));
    const completedIds = [
      ...partial.reading.map((s) => s.id),
      ...partial.literature.map((s) => s.id),
    ];
    if (completedIds.length > 0) {
      console.log(
        `  📂 부분 완료 로드: ${completedIds.join(", ")} — 이어서 진행`,
      );
    }
  }

  const result = {
    reading: [...partial.reading],
    literature: [...partial.literature],
  };

  const completedIds = new Set([
    ...partial.reading.map((s) => s.id),
    ...partial.literature.map((s) => s.id),
  ]);

  // 전체 세트 수 계산
  const allSets = [...structureData.reading, ...structureData.literature];
  const totalSets = allSets.length;
  let setIdx = 0;

  for (const section of ["reading", "literature"]) {
    for (const set of structureData[section]) {
      setIdx++;
      // 이미 완료된 세트 스킵
      if (completedIds.has(set.id)) {
        console.log(`[step3] 스킵 (이미 완료): ${set.id}`);
        continue;
      }

      console.log(
        `[step3] 분석 중: ${set.id} (${set.range}) [${setIdx}/${totalSets}]`,
      );
      const updatedChoices = await analyzeSet(set, answerKey);
      const analyzed = applyChoices(set, updatedChoices);
      result[section].push(analyzed);

      // ★ 세트 완료 즉시 부분 캐시 저장
      if (partialCachePath) {
        atomicWrite(partialCachePath, result);
        console.log(
          `  💾 부분 저장: ${set.id} 완료 → ${path.basename(partialCachePath)}`,
        );
      }
    }
  }

  return result;
}

// ─── ★ 원자적 파일 쓰기 유틸 ────────────────────────────────
/**
 * 임시 파일에 먼저 쓰고 완료되면 rename → 중단돼도 원본 보존
 */
export function atomicWrite(filePath, data) {
  const tmpPath = filePath + ".tmp";
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), "utf8");
  fs.renameSync(tmpPath, filePath);
}

// ─── 커맨드라인 ──────────────────────────────────────────────

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const structurePath = process.argv[2];
  const answerKeyPath = process.argv[3];
  const retryFlag = process.argv.indexOf("--retry");
  const retryId = retryFlag !== -1 ? process.argv[retryFlag + 1] : null;

  if (!structurePath || !answerKeyPath) {
    console.error(
      "사용법: node pipeline/step3_analysis.js [step2결과JSON] [정답키JSON] [--retry setId]",
    );
    process.exit(1);
  }

  const structurePath_abs = path.resolve(structurePath);
  const structureData = JSON.parse(fs.readFileSync(structurePath_abs, "utf8"));
  const answerKey = JSON.parse(
    fs.readFileSync(path.resolve(answerKeyPath), "utf8"),
  );

  if (retryId) {
    const step3Path = path.resolve(
      path.dirname(structurePath_abs),
      "step3_result.json",
    );
    if (!fs.existsSync(step3Path)) {
      console.error(`step3 결과 없음: ${step3Path}`);
      process.exit(1);
    }
    const step3Data = JSON.parse(fs.readFileSync(step3Path, "utf8"));
    const allSets = [...step3Data.reading, ...step3Data.literature];
    const targetSet = allSets.find((s) => s.id === retryId);
    if (!targetSet) {
      console.error(`세트 ID 없음: ${retryId}`);
      process.exit(1);
    }

    retrySet(targetSet, answerKey)
      .then((updated) => {
        for (const section of ["reading", "literature"]) {
          const idx = step3Data[section].findIndex((s) => s.id === retryId);
          if (idx !== -1) {
            step3Data[section][idx] = updated;
            break;
          }
        }
        atomicWrite(step3Path, step3Data);
        console.log(`\n✅ ${retryId} 재분석 완료`);
      })
      .catch((err) => {
        console.error("오류:", err.message);
        process.exit(1);
      });
  } else {
    analyzeStructure(structureData, answerKey)
      .then(async (raw) => {
        const corrected = await postProcess(raw, answerKey);
        const outPath = path.resolve(
          path.dirname(structurePath_abs),
          "step3_result.json",
        );
        atomicWrite(outPath, corrected);
        console.log(`\n✅ 저장 완료: ${outPath}`);
      })
      .catch((err) => {
        console.error("오류:", err.message);
        process.exit(1);
      });
  }
}
