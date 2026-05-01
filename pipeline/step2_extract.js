import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { jsonrepair } from "jsonrepair";
import { postprocess } from "./step2_postprocess.mjs";
import { getExamProfile, logProfile } from "./exam_profile.mjs";
import {
  extractPdfText,
  parseQuestionBlocks,
} from "./pdf_text_extractor.mjs";
import { validateQuestionSet } from "./extraction_validator.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env"), override: true });

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  timeout: 10 * 60 * 1000,
});
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ─── SYSTEM PROMPTS ──────────────────────────────────────────

const SYSTEM_PROMPT = `너는 수능 국어 시험지 PDF에서 데이터를 추출하는 전문가야.
반드시 순수 JSON 배열만 출력하라. 마크다운 코드블록, 설명 텍스트 없음.
저작권 고지, 페이지 번호 텍스트는 포함하지 않음.
㉠㉡㉢, ⓐⓑⓒ, [A][B], <보기> 등 모든 기호 원문 그대로 보존.
중요: JSON 문자열 값 내부에 큰따옴표(")가 있으면 반드시 백슬래시로 이스케이프(\")하거나 작은따옴표(')로 대체하라.

ok 필드 규칙:
- ok: true = 지문 내용과 사실적으로 일치하는 선지
- ok: false = 지문 내용과 사실적으로 일치하지 않는 선지

questionType 규칙:
- negative: ~않은 것은? 등 부정 발문
- positive: 가장 적절한 것은? 등 긍정 발문

JSON 스키마:
[{
  id: 'r2022a',
  title: '지문 핵심 주제어',
  range: '1~3번',
  sents: [{ id: 'r2022as1', t: '문장 원문', sentType: 'body' }],
  questions: [{
    id: 1,
    t: '발문',
    bogi: '',
    questionType: 'negative',
    choices: [{
      num: 1,
      t: '선지 텍스트',
      ok: true,
      pat: null,
      analysis: '',
      cs_ids: []
    }]
  }],
  vocab: [{ word: '단어', mean: '뜻 20자 이내', sentId: 'r2022as1' }]
}]

sentType 종류: body / footnote / omission / workTag
vocab은 3~4등급 학생이 어려워할 개념어 3~7개
bogi는 <보기> 텍스트가 있으면 채우고, 없으면 빈 문자열`;

const LIT_SYSTEM_PROMPT = `너는 수능 국어 시험지 PDF에서 문학 영역 데이터를 추출하는 전문가야.
반드시 순수 JSON 배열만 출력하라. 마크다운 코드블록, 설명 텍스트 없음.
저작권 고지, 페이지 번호 텍스트는 포함하지 않음.
㉠㉡㉢, ⓐⓑⓒ, [A][B], <보기> 등 모든 기호 원문 그대로 보존.
중요: JSON 문자열 값 내부에 큰따옴표(")가 있으면 반드시 백슬래시로 이스케이프(\")하거나 작은따옴표(')로 대체하라.

⚠️ 절대 규칙:
- 독서 영역을 추출하지 마라. 문학 영역(18번 이후)만 추출하라.
- 문학 영역은 시, 소설, 고전문학, 수필 등 문학 작품이 수록된 부분이다.
- 독서 영역은 설명문·논설문 등 비문학 지문이다 — 추출 대상이 아니다.
- id 접두사는 반드시 소문자 l(L)을 사용해. 독서(r)와 절대 혼동하지 마라.

ok 필드 규칙:
- ok: true = 작품/지문 내용과 사실적으로 일치하는 선지
- ok: false = 작품/지문 내용과 사실적으로 일치하지 않는 선지

questionType 규칙:
- negative: ~않은 것은? 등 부정 발문
- positive: 가장 적절한 것은? 등 긍정 발문

JSON 스키마:
[{
  id: 'l2022a',
  title: '작품 제목 또는 핵심 주제어',
  range: '18~23번',
  sents: [
    { id: 'l2022as1', t: '(가)', sentType: 'workTag' },
    { id: 'l2022as2', t: '작가명, 「작품명」', sentType: 'author' },
    { id: 'l2022as3', t: '시 한 행 또는 산문 문장', sentType: 'verse' },
    { id: 'l2022as4', t: '산문 본문 문장', sentType: 'body' }
  ],
  questions: [{
    id: 18,
    t: '발문',
    bogi: '',
    questionType: 'negative',
    choices: [{
      num: 1,
      t: '선지 텍스트',
      ok: true,
      pat: null,
      analysis: '',
      cs_ids: []
    }]
  }],
  vocab: [{ word: '단어', mean: '뜻 20자 이내', sentId: 'l2022as3' }]
}]

sentType 종류:
- body: 산문 본문 문장
- verse: 시의 각 행 (운문)
- workTag: 작품 구분 태그 — (가), (나), [A], [B] 등
- author: 작가명·출처 — "홍길동, 「작품명」" 등
- footnote: 각주
- omission: 중략, (중략), [...] 등

vocab은 3~4등급 학생이 어려워할 개념어 3~7개
bogi는 <보기> 텍스트가 있으면 채우고, 없으면 빈 문자열`;

const LEGACY_SYSTEM_PROMPT = `너는 수능 국어 시험지 PDF에서 데이터를 추출하는 전문가야.
이 시험지는 구형 수능 포맷입니다 (16번~45번에 독서·문학 혼재).
독서 지문과 문학 작품을 모두 추출하되,
각 세트의 sents에 작품명/작가명이 있으면 sentType: "author"로 표시해줘.
(가)/(나) 같은 작품 구분 태그는 sentType: "workTag"로 표시해줘.

반드시 순수 JSON 배열만 출력하라. 마크다운 코드블록, 설명 텍스트 없음.
저작권 고지, 페이지 번호 텍스트는 포함하지 않음.
㉠㉡㉢, ⓐⓑⓒ, [A][B], <보기> 등 모든 기호 원문 그대로 보존.
중요: JSON 문자열 값 내부에 큰따옴표(")가 있으면 반드시 백슬래시로 이스케이프(\")하거나 작은따옴표(')로 대체하라.

ok 필드 규칙:
- ok: true = 지문 내용과 사실적으로 일치하는 선지
- ok: false = 지문 내용과 사실적으로 일치하지 않는 선지

questionType 규칙:
- negative: ~않은 것은? 등 부정 발문
- positive: 가장 적절한 것은? 등 긍정 발문

JSON 스키마:
[{
  id: 'set_a',
  title: '지문 핵심 주제어',
  range: '16~20번',
  sents: [{ id: 'set_as1', t: '문장 원문', sentType: 'body' }],
  questions: [{
    id: 16,
    t: '발문',
    bogi: '',
    questionType: 'negative',
    choices: [{
      num: 1,
      t: '선지 텍스트',
      ok: true,
      pat: null,
      analysis: '',
      cs_ids: []
    }]
  }],
  vocab: [{ word: '단어', mean: '뜻 20자 이내', sentId: 'set_as1' }]
}]

sentType 종류: body / verse / footnote / omission / workTag / author
vocab은 3~4등급 학생이 어려워할 개념어 3~7개
bogi는 <보기> 텍스트가 있으면 채우고, 없으면 빈 문자열`;

// ─── 구형 수능 포맷 판별 ──────────────────────────────────────
// 2016학년도까지: A/B형 분리, 16~45번 독서·문학 혼재
function isLegacyFormat(yearKey) {
  const m = yearKey.match(/(\d{4})/);
  return m ? parseInt(m[1], 10) < 2017 : false;
}

// ─── 선택영역 포함 여부 ──────────────────────────────────────
// 2014~2021학년도: Q1~15 화작문(선택), Q16~34 독서+문학
// 2022학년도~: Q1~34 전체 독서+문학
function hasElectiveSection(yearKey) {
  const m = yearKey.match(/(\d{4})/);
  return m ? parseInt(m[1], 10) >= 2014 && parseInt(m[1], 10) <= 2021 : false;
}

// 독서+문학 시작 문항 번호
function getReadingStartQ(yearKey) {
  return hasElectiveSection(yearKey) ? 16 : 1;
}

// ─── 세트 분류 (구형 포맷용) ─────────────────────────────────
function classifySection(set) {
  if (set.sents?.some((s) => s.sentType === "workTag")) return "literature";
  const authorPattern = /[-—]\s*.+[,，」\-]/;
  if (set.sents?.some((s) => authorPattern.test(s.t || "")))
    return "literature";
  if (set.sents?.some((s) => (s.sentType || "") === "author"))
    return "literature";
  if (set.sents?.some((s) => (s.sentType || "") === "verse"))
    return "literature";
  return "reading";
}

// ─── 재시도 래퍼 ─────────────────────────────────────────────
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

function stripMarkdown(text) {
  return text
    .trim()
    .replace(/^```[a-z]*\n?/i, "")
    .replace(/\n?```$/i, "");
}

// ─── step2 순수 구조화 강제 ─────────────────────────────────
// 프롬프트 지시에도 불구하고 LLM 이 ok/pat/analysis/cs_ids/vocab 을 leak 할 수 있음.
// 여기서 방어적으로 strip — 이 필드들은 step3/4 책임.
// 원문 텍스트(sent.t, question.t, choice.t, bogi) 는 절대 건드리지 않음.
const STEP2_FORBIDDEN_CHOICE_FIELDS = ["ok", "pat", "analysis", "cs_ids", "cs_spans"];
const STEP2_FORBIDDEN_SET_FIELDS = ["vocab"];

function sanitizeToStructureOnly(sets) {
  const stats = {
    choice_ok_stripped: 0,
    choice_pat_stripped: 0,
    choice_analysis_stripped: 0,
    choice_cs_ids_stripped: 0,
    choice_cs_spans_stripped: 0,
    set_vocab_stripped: 0,
  };
  if (!Array.isArray(sets)) return { sets, stats };

  for (const set of sets) {
    for (const k of STEP2_FORBIDDEN_SET_FIELDS) {
      if (k in set) {
        if (k === "vocab" && Array.isArray(set[k]) && set[k].length > 0) {
          stats.set_vocab_stripped++;
        } else if (k === "vocab" && set[k] != null) {
          stats.set_vocab_stripped++;
        }
        delete set[k];
      }
    }
    for (const q of set.questions || []) {
      for (const c of q.choices || []) {
        for (const k of STEP2_FORBIDDEN_CHOICE_FIELDS) {
          if (k in c) {
            const key = `choice_${k}_stripped`;
            if (key in stats) stats[key]++;
            delete c[k];
          }
        }
      }
    }
  }
  return { sets, stats };
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

async function callClaude(pdfBase64, userPrompt, systemPrompt = SYSTEM_PROMPT) {
  const response = await callWithRetry(() =>
    client.messages.create(
      {
        model: "claude-sonnet-4-5",
        max_tokens: 32000,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "document",
                source: {
                  type: "base64",
                  media_type: "application/pdf",
                  data: pdfBase64,
                },
              },
              { type: "text", text: userPrompt },
            ],
          },
        ],
      },
      { headers: { "anthropic-beta": "output-128k-2025-02-19" } },
    ),
  );

  const raw = response.content[0].text;
  console.log(
    `[debug] stop_reason: ${response.stop_reason}, 응답 길이: ${raw.length}자`,
  );

  const debugPath = path.resolve(
    __dirname,
    "../pipeline/debug_last_response.txt",
  );
  fs.writeFileSync(debugPath, raw, "utf8");

  const text = stripMarkdown(raw);
  try {
    return JSON.parse(text);
  } catch {
    try {
      return JSON.parse(fixUnescapedQuotes(text));
    } catch {
      try {
        return JSON.parse(jsonrepair(text));
      } catch (err3) {
        console.error("JSON 파싱 실패:", err3.message);
        throw err3;
      }
    }
  }
}

// ─── ★ Gemini 추출 (step2 핵심) ─────────────────────────────
// Claude API는 PDF에서 특정 문항 범위를 불안정하게 추출함
// Gemini는 PDF 전체를 한 번에 보고 안정적으로 추출

// [V1 ARCHIVED] GEMINI_READING_PROMPT_V1_WITH_QA — 이전 prompt 는 ok/pat/analysis/cs_ids/vocab
// 생성을 요구했음 (step2 책임 위반). git 이력으로 보존. 아래는 PURE-STRUCTURE 버전.
const GEMINI_READING_PROMPT = (yearKey, lastQ, startQ = null) => {
  const year = yearKey.replace(/[^0-9]/g, "");
  const fromQ = startQ || getReadingStartQ(yearKey);
  const readingEndQ = hasElectiveSection(yearKey) ? Math.min(lastQ, 34) : 17;
  return `너는 수능 국어 시험지 PDF에서 **원문 구조만** 추출하는 전문가야.
아래 JSON 스키마에 맞게 독서 영역(${fromQ}번~${readingEndQ}번 범위의 독서 지문)만 추출해줘.
※ ${fromQ > 1 ? `1~${fromQ - 1}번은 화법/작문/문법 선택영역이므로 절대 추출하지 마라.` : ""}

[가장 중요한 규칙 — 판단 금지]
- 정답 여부, 선지 해설, 오류 유형(pat), 지문 근거 매핑(cs_ids), 어휘 난이도(vocab) 를 절대 생성하지 마라.
- ok / pat / analysis / cs_ids / vocab 필드를 **출력에 포함하지 마라**.
- 이 단계는 오직 원문 텍스트의 구조화만 담당한다. 판단·해설은 이후 단계에서 처리.

[출력 규칙]
- 순수 JSON만 출력. 설명, 마크다운 코드블록, 기타 텍스트 없음
- 저작권 고지, 페이지 번호, 문제 번호 텍스트는 포함하지 않음
- ㉠㉡㉢, ⓐⓑⓒ, [A][B], <보기> 등 모든 기호 원문 그대로 보존
- 선지 본문, 발문, 지문 문장은 **원문 그대로** — 요약·재서술 금지

[questionType 규칙 — 발문의 표면 형태만 분류]
- "negative": "~않은 것은?" 등 부정 발문
- "positive": "가장 적절한 것은?" 등 긍정 발문
- 주: 이것은 발문 문자열의 표면 패턴 분류이지 정답 판단이 아니다.

[sentId 규칙 — 핵심]
- 각 세트의 sents id는 반드시 해당 세트 id를 prefix로 사용한다
- 세트 id가 r${year}a 이면 → sents id: r${year}as1, r${year}as2, r${year}as3, ...
- 세트 id가 r${year}b 이면 → sents id: r${year}bs1, r${year}bs2, r${year}bs3, ...
- 세트 id가 r${year}c 이면 → sents id: r${year}cs1, r${year}cs2, r${year}cs3, ...
- 세트 id가 r${year}d 이면 → sents id: r${year}ds1, r${year}ds2, r${year}ds3, ...
- 절대로 다른 세트의 prefix를 사용하지 마라

[sents 포함 기준]
- 지문 본문 문장: sentType "body" — 문단 단위로 분리
- 각주(*표시 설명): sentType "footnote"
- 표·도식 안에서 원문 그대로 있는 텍스트: body 로 포함
- 중략·생략 표시: sentType "omission"
- 이미지·그래프·순수 도식(텍스트 없는 그림): sentType "figure" 플레이스홀더

[이미지·도식 처리 규칙]
- 이미지, 그래프, 순수 도식이 지문 내에 있으면 해당 위치에 sentType "figure" sent 삽입
- t 필드에는 "[도식: 내용을 간략히 묘사]" 형식으로 적는다 (묘사만, 판단 금지)
- 예: { "id": "r${year}as5", "t": "[도식: 세포막 구조 그림]", "sentType": "figure" }

[JSON 스키마 — 판단 필드 일체 없음]
[
  {
    "id": "r${year}a",
    "title": "지문 핵심 주제어",
    "range": "1~3번",
    "sents": [
      { "id": "r${year}as1", "t": "첫 번째 문장", "sentType": "body" },
      { "id": "r${year}as2", "t": "두 번째 문장", "sentType": "body" },
      { "id": "r${year}as3", "t": "*각주 내용", "sentType": "footnote" }
    ],
    "questions": [{
      "id": 1,
      "t": "발문 원문",
      "bogi": "",
      "questionType": "negative",
      "choices": [
        { "num": 1, "t": "선지 원문" },
        { "num": 2, "t": "선지 원문" },
        { "num": 3, "t": "선지 원문" },
        { "num": 4, "t": "선지 원문" },
        { "num": 5, "t": "선지 원문" }
      ]
    }]
  }
]

절대 출력하지 말 것: ok, pat, analysis, cs_ids, vocab
sentType: body / footnote / omission / figure
bogi: <보기> 텍스트가 있으면 원문 그대로, 없으면 빈 문자열
PDF의 ${fromQ}번~${readingEndQ}번 독서 전체를 원문 구조만 추출해줘.`;
};

const GEMINI_LITERATURE_PROMPT = (yearKey, lastQ, fromQ = 18, toQ = null) => {
  const year = yearKey.replace(/[^0-9]/g, "");
  const endQ = toQ || lastQ;
  return `너는 수능 국어 시험지 PDF에서 **원문 구조만** 추출하는 전문가야.
아래 JSON 스키마에 맞게 문학 영역(${fromQ}번~${endQ}번)만 추출해줘.

[가장 중요한 규칙 — 판단 금지]
- 정답 여부, 선지 해설, 오류 유형(pat), 지문 근거 매핑(cs_ids), 어휘 난이도(vocab) 를 절대 생성하지 마라.
- ok / pat / analysis / cs_ids / vocab 필드를 **출력에 포함하지 마라**.
- 이 단계는 오직 원문 텍스트의 구조화만 담당한다. 판단·해설은 이후 단계에서 처리.

[출력 규칙]
- 순수 JSON만 출력. 설명, 마크다운 코드블록, 기타 텍스트 없음
- 저작권 고지, 페이지 번호, 문제 번호 텍스트는 포함하지 않음
- ㉠㉡㉢, ⓐⓑⓒ, [A][B], <보기> 등 모든 기호 원문 그대로 보존
- 작품 제목, 작가명, 출처 표시 원문 그대로 보존
- 선지 본문, 발문, 지문/작품 문장은 **원문 그대로** — 요약·재서술 금지

[questionType 규칙 — 발문의 표면 형태만 분류]
- "negative": "~않은 것은?" 등 부정 발문
- "positive": "가장 적절한 것은?" 등 긍정 발문
- 주: 이것은 발문 문자열의 표면 패턴 분류이지 정답 판단이 아니다.

[sentId 규칙 — 핵심]
- 각 세트의 sents id는 반드시 해당 세트 id를 prefix로 사용한다
- 세트 id가 l${year}a 이면 → sents id: l${year}as1, l${year}as2, l${year}as3, ...
- 세트 id가 l${year}b 이면 → sents id: l${year}bs1, l${year}bs2, l${year}bs3, ...
- 세트 id가 l${year}c 이면 → sents id: l${year}cs1, l${year}cs2, l${year}cs3, ...
- 세트 id가 l${year}d 이면 → sents id: l${year}ds1, l${year}ds2, l${year}ds3, ...
- 절대로 다른 세트의 prefix를 사용하지 마라

[sentType 규칙]
- body: 소설·산문 본문 — 문단 단위로 분리
- verse: 시·가사·시조의 각 행 — 행 단위로 각각 별도 sent
- workTag: (가)(나)(다), <제 N수> 등 구분 태그
- author: 작가/출처 표시 — 반드시 포함, 작자 미상도 포함
- footnote: *주석 설명
- omission: (중략), [중략 부분 줄거리] 등
- figure: 이미지·삽화 플레이스홀더

[연시조 처리 규칙 — 중요]
- 연시조(여러 수로 구성)는 각 수마다 "<제 N수>" workTag sent를 먼저 넣는다
- 각 수의 초장·중장·종장은 각각 별도 verse sent로 분리한다
- 예시:
  { "id": "l${year}as3", "t": "<제 1수>", "sentType": "workTag" },
  { "id": "l${year}as4", "t": "초장 텍스트", "sentType": "verse" },
  { "id": "l${year}as5", "t": "중장 텍스트", "sentType": "verse" },
  { "id": "l${year}as6", "t": "종장 텍스트", "sentType": "verse" },
  { "id": "l${year}as7", "t": "<제 2수>", "sentType": "workTag" },
  { "id": "l${year}as8", "t": "초장 텍스트", "sentType": "verse" },
  { "id": "l${year}as9", "t": "중장 텍스트", "sentType": "verse" },
  { "id": "l${year}as10", "t": "종장 텍스트", "sentType": "verse" }
- 단시조(1수)는 "<제 1수>" 마커 없이 초장·중장·종장만 분리한다

[현대시 처리 규칙]
- 각 행을 별도 verse sent로 분리한다 (행 = 한 줄)
- 연(stanza) 사이 빈 줄은 별도 sent로 표시하지 않음

[소설·산문 처리 규칙]
- 문단 단위로 body sent 분리
- 대화문은 앞뒤 서술과 합쳐서 하나의 문장으로 처리

[이미지·삽화 처리 규칙]
- 이미지, 삽화가 있으면 해당 위치에 sentType "figure" sent를 삽입한다
- t 필드에는 "[삽화: 내용을 간략히 묘사]" 형식으로 적는다
- 예: { "id": "l${year}as11", "t": "[삽화: 인물 그림]", "sentType": "figure" }

[JSON 스키마 — 판단 필드 일체 없음]
[
  {
    "id": "l${year}a",
    "title": "작품명 또는 복합 제목",
    "range": "${fromQ}~21번",
    "sents": [
      { "id": "l${year}as1", "t": "(가)", "sentType": "workTag" },
      { "id": "l${year}as2", "t": "작가명, 「작품명」", "sentType": "author" },
      { "id": "l${year}as3", "t": "<제 1수>", "sentType": "workTag" },
      { "id": "l${year}as4", "t": "초장 원문", "sentType": "verse" },
      { "id": "l${year}as5", "t": "중장 원문", "sentType": "verse" },
      { "id": "l${year}as6", "t": "종장 원문", "sentType": "verse" }
    ],
    "questions": [{
      "id": ${fromQ},
      "t": "발문 원문",
      "bogi": "",
      "questionType": "negative",
      "choices": [
        { "num": 1, "t": "선지 원문" },
        { "num": 2, "t": "선지 원문" },
        { "num": 3, "t": "선지 원문" },
        { "num": 4, "t": "선지 원문" },
        { "num": 5, "t": "선지 원문" }
      ]
    }]
  },
  {
    "id": "l${year}b",
    "title": "두 번째 세트 작품명",
    "range": "22~27번",
    "sents": [
      { "id": "l${year}bs1", "t": "(가)", "sentType": "workTag" },
      { "id": "l${year}bs2", "t": "작가명, 「작품명」", "sentType": "author" },
      { "id": "l${year}bs3", "t": "소설 첫 문단", "sentType": "body" }
    ],
    "questions": [{
      "id": 22,
      "t": "발문 원문",
      "bogi": "",
      "questionType": "positive",
      "choices": [
        { "num": 1, "t": "선지 원문" },
        { "num": 2, "t": "선지 원문" },
        { "num": 3, "t": "선지 원문" },
        { "num": 4, "t": "선지 원문" },
        { "num": 5, "t": "선지 원문" }
      ]
    }]
  }
]

절대 출력하지 말 것: ok, pat, analysis, cs_ids, vocab
bogi: <보기> 텍스트가 있으면 원문 그대로, 없으면 빈 문자열
PDF의 ${fromQ}번~${endQ}번 문학 영역을 원문 구조만 추출해줘.`;
};

// ─── [NEW] pdf-parse 1차 추출 경로 ──────────────────────────
//
// Gemini OCR 이 원문자(㉠㉤ 등) 를 오인식하는 사례 (l2026d Q32) 발견.
// pdf-parse 는 PDF 텍스트 레이어를 직접 읽어 원문자를 손실 없이 추출.
//
// 동작:
//   1) PDF → 텍스트
//   2) 문항 블록 분해 (parseQuestionBlocks)
//   3) 섹션 범위 필터 (profile.reading_range / literature_range)
//   4) [N~M] 범위 헤더로 passage 경계 식별 → set 단위 그룹화
//   5) validateQuestionSet 로 구조·마커 완결성 검증
//   6) 통과하면 Gemini 호출 없이 채택. 실패하면 null 반환 → 호출부가 Gemini fallback.
//
// 한계: sents 는 passage 텍스트의 줄 단위로 분할하여 전부 body 로 둔다.
//       verse/workTag/author 등 세밀 분류는 step3/step4 또는 후속 보강 단계 책임.
//       이 단계는 "원문자 보존" 과 "구조 무결성" 만 우선 확보.

const NEG_PATTERNS_INLINE = [
  "않은", "않는", "틀린", "아닌", "없는", "거리가 먼",
  "잘못", "적절하지", "맞지 않", "옳지 않", "부적절",
  "해당하지", "일치하지", "어색한", "알 수 없는", "옳지않", "적합하지",
];
function detectQTypeFromStem(t) {
  for (const p of NEG_PATTERNS_INLINE) if ((t || "").includes(p)) return "negative";
  return "positive";
}

function buildSetsFromPdfText(fullText, questions, sec, yearKey) {
  const year = yearKey.replace(/[^0-9]/g, "");
  const prefix = sec === "reading" ? "r" : "l";
  const letters = "abcdefgh";

  // [N~M] 또는 [N～M] 범위 헤더 스캔
  const passageHeaderRE = /\[(\d{1,2})\s*[~～\-–—]\s*(\d{1,2})\]/g;
  const headers = [];
  let m;
  while ((m = passageHeaderRE.exec(fullText)) !== null) {
    const start = parseInt(m[1], 10);
    const end = parseInt(m[2], 10);
    if (start >= 1 && start <= 45 && end >= start && end <= 45) {
      headers.push({
        start,
        end,
        header_pos: m.index,
        header_text: m[0],
        passage_start: m.index + m[0].length,
      });
    }
  }

  // 섹션에 속하는 헤더만 (해당 범위의 문항이 실제로 parse 된 것)
  const sectionHeaders = headers.filter((h) =>
    questions.some((q) => q.id >= h.start && q.id <= h.end),
  );

  // 헤더가 여러 번 등장하는 경우 중복 방지 (같은 start 번호 가장 먼저 등장한 것만 유지)
  const uniqueHeaders = [];
  const seenStarts = new Set();
  for (const h of sectionHeaders) {
    if (seenStarts.has(h.start)) continue;
    seenStarts.add(h.start);
    uniqueHeaders.push(h);
  }

  // 전역 배정된 Q id — 한 Q 는 하나의 set 에만
  const globallyAssigned = new Set();
  const sets = [];
  let letterIdx = 0;
  for (const pr of uniqueHeaders) {
    const firstQInRange = questions.find(
      (q) =>
        q.id >= pr.start &&
        q.id <= pr.end &&
        !globallyAssigned.has(q.id),
    );
    if (!firstQInRange) continue; // 이 헤더에 할당할 Q 없음 → skip

    const setId = `${prefix}${year}${letters[letterIdx] || String.fromCharCode(97 + letterIdx)}`;
    letterIdx++;

    // passage 텍스트: header 끝 ~ 첫 문항 번호 위치 직전
    const afterHeader = fullText.slice(pr.passage_start);
    const firstQRe = new RegExp(`(^|\\n)\\s*${firstQInRange.id}\\.`);
    const cut = afterHeader.search(firstQRe);
    const passageText = cut > 0 ? afterHeader.slice(0, cut) : "";

    // 줄 단위 body sent 생성 — 페이지 푸터/헤더 제거
    const sentLines = passageText
      .split(/\n+/)
      .map((s) => s.replace(/[ \t]+/g, " ").trim())
      .filter((s) => s.length > 3)
      .filter(
        (s) =>
          !/^--\s*\d+\s*of\s*\d+\s*--$/.test(s) &&
          !/^홀수형\s*\d+$/.test(s) &&
          !/저작권은 한국교육과정평가원/.test(s),
      );

    const sents = sentLines.map((t, j) => ({
      id: `${setId}s${j + 1}`,
      t,
      sentType: "body",
    }));

    // 범위 내 문항 수집 — 이미 다른 set 에 배정된 Q는 skip
    const setQs = questions
      .filter(
        (q) =>
          q.id >= pr.start &&
          q.id <= pr.end &&
          !globallyAssigned.has(q.id),
      )
      .map((q) => {
        globallyAssigned.add(q.id);
        const out = {
          id: q.id,
          t: q.stem,
          bogi: q.bogi || "",
          questionType: detectQTypeFromStem(q.stem),
          choices: q.choices.map((c) => ({ num: c.num, t: c.t })),
        };
        // [NEW] activity-sheet 감지 메타 보존 — downstream 추적용
        if (q._activity_sheet) out._activity_sheet = true;
        return out;
      });

    if (setQs.length === 0) continue; // passage 는 있으나 모든 Q가 이전 set 에 배정됨 → skip

    sets.push({
      id: setId,
      title: (sents[0]?.t || "").slice(0, 24),
      range: `${pr.start}~${pr.end}번`,
      sents,
      questions: setQs,
      _extractor: "pdf-parse",
    });
  }

  return sets;
}

async function extractViaPdfParse(pdfPath, yearKey, sec, profile) {
  const { fullText, numpages } = await extractPdfText(pdfPath);
  console.log(
    `[extractor] pdf-parse 텍스트 추출: ${fullText.length}자, ${numpages || "?"}페이지`,
  );

  const allQuestions = parseQuestionBlocks(fullText);

  // 섹션 범위 결정
  let minQ, maxQ;
  if (sec === "reading") {
    [minQ, maxQ] = profile.reading_range || [1, 17];
  } else {
    [minQ, maxQ] = profile.literature_range || [18, 34];
  }
  // 선택과목(화법/작문/문법, 1~15) 중복 제거 — 같은 Q 번호가 여러 번 parsed 되면 첫 등장만
  const seen = new Set();
  const filtered = [];
  for (const q of allQuestions) {
    if (q.id < minQ || q.id > maxQ) continue;
    if (seen.has(q.id)) continue;
    seen.add(q.id);
    filtered.push(q);
  }

  if (filtered.length === 0) {
    return {
      sets: null,
      reasons: ["no_questions_in_range"],
    };
  }

  const sets = buildSetsFromPdfText(fullText, filtered, sec, yearKey);

  // 검증 대상: 모든 문항을 stem/choices 형식으로
  const flat = sets.flatMap((s) =>
    s.questions.map((q) => ({
      id: q.id,
      stem: q.t,
      bogi: q.bogi,
      choices: q.choices,
    })),
  );
  const validation = validateQuestionSet(flat);

  return { sets, validation };
}

/**
 * Gemini API로 PDF에서 텍스트 추출
 * Claude API 대비 PDF 파싱 안정성이 높음
 */
async function callGemini(pdfPath, prompt, yearKey = "unknown", section = "unknown") {
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  const pdfBuffer = fs.readFileSync(pdfPath);
  const pdfBase64 = pdfBuffer.toString("base64");

  const result = await callWithRetry(async () => {
    const response = await model.generateContent([
      { inlineData: { mimeType: "application/pdf", data: pdfBase64 } },
      { text: prompt },
    ]);
    return response.response.text();
  });

  console.log(`[debug:gemini] 응답 길이: ${result.length}자`);

  // [LEGACY — 증거 덮어쓰기로 인해 비활성화. 필요 시 주석 해제하여 복원]
  // const debugPathLegacy = path.resolve(
  //   __dirname,
  //   "../pipeline/debug_last_response.txt",
  // );
  // fs.writeFileSync(debugPathLegacy, result, "utf8");

  // [NEW] timestamp 기반 영구 저장 (pipeline/test_data/raw_gemini_*)
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const debugPath = path.resolve(
    __dirname,
    `../pipeline/test_data/raw_gemini_${yearKey}_${section}_${ts}.txt`,
  );
  fs.mkdirSync(path.dirname(debugPath), { recursive: true });
  fs.writeFileSync(debugPath, result, "utf8");
  console.log(`[DEBUG] raw Gemini saved: ${debugPath}`);

  const text = stripMarkdown(result);
  let parsed;
  let parser_used;
  try {
    console.log("[parse] direct JSON.parse");
    parsed = JSON.parse(text);
    parser_used = "direct";
  } catch {
    try {
      console.warn("[parse] fallback: fixUnescapedQuotes");
      parsed = JSON.parse(fixUnescapedQuotes(text));
      parser_used = "fixUnescapedQuotes";
    } catch {
      try {
        console.error("[parse] fallback: jsonrepair");
        parsed = JSON.parse(jsonrepair(text));
        parser_used = "jsonrepair";
      } catch (err3) {
        console.error("Gemini JSON 파싱 실패:", err3.message);
        throw err3;
      }
    }
  }

  // [NEW] rawparsed snapshot — JSON.parse 직후, 어떤 후처리도 거치기 전 상태
  try {
    const snapDir = path.resolve(__dirname, "../pipeline/test_data");
    fs.mkdirSync(snapDir, { recursive: true });
    const snapPath = path.join(
      snapDir,
      `step2_rawparsed_${yearKey}_${section}_${ts}.json`,
    );
    fs.writeFileSync(
      snapPath,
      JSON.stringify({ parser_used, parsed }, null, 2),
      "utf8",
    );
    console.log(`[DEBUG] step2 rawparsed snapshot saved: ${snapPath}`);
  } catch (snapErr) {
    console.warn(`[DEBUG] rawparsed 저장 실패: ${snapErr.message}`);
  }

  return parsed;
}

/**
 * 추출된 세트 배열이 올바른지 검증한다.
 * @param {Array} sets - 추출된 세트 배열
 * @param {'reading'|'literature'} section - 섹션 타입
 * @param {number} lastQuestion - 마지막 문항 번호
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateExtraction(sets, section, lastQuestion, yearKey = "") {
  const errors = [];

  if (!Array.isArray(sets) || sets.length === 0) {
    errors.push(`세트 배열이 비어있음`);
    return { valid: false, errors };
  }

  // [NEW] forbidden QA field 감지 — sanitize 로 strip 되기 전에 LLM leak 증거 수집
  // 감지만 하고 errors 에는 추가하지 않음 (검증 실패로 간주하지 않고 경고만)
  const qaLeak = {
    choice_ok: 0,
    choice_pat: 0,
    choice_analysis: 0,
    choice_cs_ids: 0,
    choice_cs_spans: 0,
    set_vocab: 0,
  };
  const FORBIDDEN_C = ["ok", "pat", "analysis", "cs_ids", "cs_spans"];
  const FORBIDDEN_S = ["vocab"];
  for (const s of sets) {
    for (const k of FORBIDDEN_S) if (k in s) qaLeak[`set_${k}`]++;
    for (const q of s.questions || []) {
      for (const c of q.choices || []) {
        for (const k of FORBIDDEN_C) if (k in c) qaLeak[`choice_${k}`]++;
      }
    }
  }
  const leaked = Object.entries(qaLeak).filter(([, v]) => v > 0);
  if (leaked.length > 0) {
    console.warn(
      `[validate:qa_leak] step2 는 구조만 반환해야 하지만 QA 필드 감지됨 — ${leaked.map(([k, v]) => `${k}=${v}`).join(", ")} (sanitize 단계에서 strip 예정)`,
    );
  } else {
    console.log(`[validate:qa_leak] QA 필드 없음 ✅`);
  }

  const readingMin = yearKey ? getReadingStartQ(yearKey) : 1;
  const readingRange = { min: readingMin, max: lastQuestion };
  const litRange = { min: 18, max: lastQuestion };
  const expectedRange = section === "reading" ? readingRange : litRange;
  const expectedPrefix = section === "reading" ? "r" : "l";

  // 중복 세트 ID 감지
  const ids = sets.map((s) => s.id);
  const dupIds = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (dupIds.length > 0) {
    errors.push(`중복 세트 ID: ${[...new Set(dupIds)].join(", ")}`);
  }

  for (const set of sets) {
    // 1. ID 접두사 검증
    if (!set.id.startsWith(expectedPrefix)) {
      errors.push(
        `[${set.id}] id 접두사 오류 — ${section}은 '${expectedPrefix}'로 시작해야 함`,
      );
    }

    // 2. 문항 번호 범위 검증
    if (set.questions?.length > 0) {
      const qIds = set.questions.map((q) => q.id);
      const qMin = Math.min(...qIds);
      const qMax = Math.max(...qIds);

      if (qMin < expectedRange.min || qMax > expectedRange.max) {
        errors.push(
          `[${set.id}] Q번호 범위 오류 — Q${qMin}~${qMax} (기대: ${expectedRange.min}~${expectedRange.max}번)`,
        );
      }
    } else {
      errors.push(`[${set.id}] 문항 없음`);
    }

    // 3. 문학 세트에 독서 내용이 들어왔는지 감지
    if (section === "literature") {
      const hasLitMarker = set.sents?.some((s) =>
        ["workTag", "author", "verse"].includes(s.sentType),
      );
      // verse/author/workTag가 전혀 없으면 독서일 가능성 높음
      if (!hasLitMarker && set.sents?.length > 3) {
        errors.push(
          `[${set.id}] 문학 마커 없음 (workTag/author/verse) — 독서 지문이 잘못 추출됐을 가능성`,
        );
      }
    }

    // 4. sents 비어있는지 체크
    if (!set.sents?.length) {
      errors.push(`[${set.id}] sents 비어있음`);
    }
  }

  // 5. 중복 Q번호 감지 (다른 세트 간 겹치는 Q번호)
  const allQIds = sets.flatMap((s) => s.questions?.map((q) => q.id) || []);
  const dupQIds = allQIds.filter((id, i) => allQIds.indexOf(id) !== i);
  if (dupQIds.length > 0) {
    errors.push(
      `중복 Q번호: ${[...new Set(dupQIds)].join(", ")} — 같은 문항이 여러 세트에 중복 추출됨`,
    );
  }

  // 6. 마지막 문항 커버리지 체크 — 누락된 문항 구간 감지
  if (allQIds.length > 0) {
    const maxQ = Math.max(...allQIds);
    const minQ = Math.min(...allQIds);
    const expectedMin = section === "reading" ? 1 : 18;
    const expectedMax = section === "reading" ? 17 : lastQuestion;
    if (maxQ < expectedMax - 1) {
      errors.push(
        `마지막 문항 누락 — 추출된 최대 Q: ${maxQ}, 기대: ${expectedMax}번. Q${maxQ + 1}~${expectedMax} 누락`,
      );
    }
    if (minQ > expectedMin + 1) {
      errors.push(
        `첫 문항 누락 — 추출된 최소 Q: ${minQ}, 기대: ${expectedMin}번`,
      );
    }
  }

  return { valid: errors.length === 0, errors };
}

// ─── 구형 포맷 추출 ───────────────────────────────────────────
async function extractLegacy(pdfBase64, yearKey) {
  const year = yearKey.replace(/[^0-9]/g, "");

  console.log(`[step2] 구형 포맷 감지 — 16~27번 추출 중...`);
  const batch1 = await callClaude(
    pdfBase64,
    `이 시험지의 16번~27번을 추출해줘. id는 set_a, set_b, set_c 순으로 사용해.`,
    LEGACY_SYSTEM_PROMPT,
  );

  console.log(`[step2] 구형 포맷 — 28~39번 추출 중...`);
  const batch2 = await callClaude(
    pdfBase64,
    `이 시험지의 28번~39번을 추출해줘. id는 set_d, set_e, set_f 순으로 사용해.`,
    LEGACY_SYSTEM_PROMPT,
  );

  console.log(`[step2] 구형 포맷 — 40~45번 추출 중...`);
  const batch3 = await callClaude(
    pdfBase64,
    `이 시험지의 40번~45번을 추출해줘. id는 set_g, set_h 순으로 사용해.`,
    LEGACY_SYSTEM_PROMPT,
  );

  const allSets = [...batch1, ...batch2, ...batch3];
  const reading = [],
    literature = [];
  let rIdx = 0,
    lIdx = 0;
  const letters = "abcdefgh";

  for (const set of allSets) {
    const sec = classifySection(set);
    const idx = sec === "literature" ? lIdx++ : rIdx++;
    const letter = letters[idx] || letters[letters.length - 1];
    const prefix = sec === "literature" ? "l" : "r";
    const newId = `${prefix}${year}${letter}`;
    set.id = newId;
    set.sents = set.sents.map((s, i) => ({ ...s, id: `${newId}s${i + 1}` }));
    set.vocab = (set.vocab || []).map((v) => {
      const idx2 = parseInt((v.sentId || "").replace(/\D/g, ""), 10) || 1;
      return { ...v, sentId: `${newId}s${idx2}` };
    });
    if (sec === "literature") literature.push(set);
    else reading.push(set);
  }

  console.log(
    `[step2] 분류 결과: reading ${reading.length}세트, literature ${literature.length}세트`,
  );

  // [NEW] 구버전(legacy) 경로도 QA 필드 strip — step2 는 구조만
  {
    const rSan = sanitizeToStructureOnly(reading).stats;
    const lSan = sanitizeToStructureOnly(literature).stats;
    const emitted = [
      ...Object.entries(rSan).map(([k, v]) => [`reading.${k}`, v]),
      ...Object.entries(lSan).map(([k, v]) => [`literature.${k}`, v]),
    ].filter(([, v]) => v > 0);
    if (emitted.length > 0) {
      console.warn(
        `[step2:sanitize:legacy] QA 필드 strip: ${emitted.map(([k, v]) => `${k}=${v}`).join(", ")}`,
      );
    } else {
      console.log(`[step2:sanitize:legacy] QA 필드 leak 없음 ✅`);
    }
  }

  return { reading, literature };
}

// ─── ★ 메인 추출 함수 (재설계) ───────────────────────────────
/**
 * 섹션별 독립 추출. 캐시도 섹션별로 분리.
 *
 * 변경점:
 * - step2_reading_{yearTag}.json  ← reading 전용 캐시
 * - step2_literature_{yearTag}.json ← literature 전용 캐시
 * - 추출 직후 validateExtraction() 자동 실행
 * - 검증 실패 시 즉시 throw (잘못된 데이터가 캐시에 저장되지 않음)
 * - lastQuestion은 answer_key에서 자동 추론 가능
 */
export async function extractStructure(
  pdfPath,
  yearKey,
  lastQuestion = 45,
  section = "all",
  dataDir = null,
) {
  const year = yearKey.replace(/[^0-9]/g, "");

  // [NEW] exam profile — 버전/범위 판정 단일 지점
  const profile = getExamProfile(yearKey);
  logProfile(profile);

  if (isLegacyFormat(yearKey)) {
    console.log(`[step2] 구형 수능 포맷 (${yearKey}) — 16~45번 통합 추출`);
    const pdfBuffer = fs.readFileSync(pdfPath);
    return extractLegacy(pdfBuffer.toString("base64"), yearKey);
  }

  // [NEW] 구버전 guard — 번호 범위 기반 reading/literature 자동 분류 차단
  if (profile.version === "old" && section !== "all") {
    console.warn(
      `[profile] GUARD: old suneung (${yearKey}) — section="${section}" 단독 추출은 범위 가정에 의존하므로 부정확할 수 있음. 세트 단위 수동 분류 권장.`,
    );
  }
  if (profile.version === "unknown") {
    console.warn(
      `[profile] GUARD: version=unknown (${yearKey}) — 범위 기반 분기 사용 금지 권장. 진행 전 profile 확정 필요.`,
    );
  }

  const targetSections =
    section === "all" ? ["reading", "literature"] : [section];
  const result = { reading: [], literature: [] };

  for (const sec of targetSections) {
    // ── 섹션별 독립 캐시 경로 ──
    const cachePath = dataDir
      ? path.join(dataDir, `step2_${sec}_${yearKey}.json`)
      : null;

    if (cachePath && fs.existsSync(cachePath)) {
      console.log(`  📂 캐시 로드 (${sec}): ${path.basename(cachePath)}`);
      result[sec] = JSON.parse(fs.readFileSync(cachePath, "utf8"));
      continue;
    }

    // ── ★ Gemini API 추출 ──
    // [NEW] profile 기반 effective 범위 계산 — 로그가 아닌 실제 호출값에 반영
    // new suneung: reading_end=17, literature_start=18, literature_end=34
    // old / unknown: clamp 미적용 (기존 lastQuestion 유지)
    const isNewSuneung =
      profile.exam_family === "suneung" &&
      profile.version === "new" &&
      profile.range_based_split_allowed;

    const readingEndRaw = getReadingStartQ(yearKey); // (start) 유지용
    const effectiveReadingEnd = isNewSuneung ? 17 : lastQuestion;
    const effectiveLiteratureStart = 18;
    const effectiveLiteratureEnd = isNewSuneung ? 34 : lastQuestion;

    // 섹션별 실효 start/end
    const effectiveStartQ =
      sec === "reading" ? getReadingStartQ(yearKey) : effectiveLiteratureStart;
    const effectiveEnd =
      sec === "reading" ? effectiveReadingEnd : effectiveLiteratureEnd;

    if (isNewSuneung) {
      console.log(
        `[profile:clamp] lastQuestion=${lastQuestion} → reading_end=${effectiveReadingEnd}, literature_end=${effectiveLiteratureEnd}`,
      );
    } else {
      console.warn(
        `[profile:clamp] skipped (version=${profile.version}) — lastQuestion=${lastQuestion} 그대로 사용. 구버전/미상은 set-level 수동 분류 필요.`,
      );
    }
    console.log(
      `[profile:applied] sec=${sec} startQ=${effectiveStartQ} effectiveEnd=${effectiveEnd}`,
    );

    const startQ = effectiveStartQ; // 하위 호환용 로컬 별칭 (기존 코드와 동일 이름 유지)
    void readingEndRaw; // 기존 getReadingStartQ 호출 부작용 없이 참조 유지
    let sets;

    // ── [NEW] 1차: pdf-parse 경로 시도 ──────────────────────
    let pdfParseAccepted = false;
    try {
      const pp = await extractViaPdfParse(pdfPath, yearKey, sec, profile);
      if (pp.sets && pp.validation && pp.validation.passed) {
        console.log(
          `[extractor] pdf-parse accepted (sec=${sec}, reason=validation_pass, sets=${pp.sets.length}, questions=${pp.validation.total})`,
        );
        sets = pp.sets;
        pdfParseAccepted = true;
      } else {
        const reasons = pp.reasons
          ? pp.reasons
          : (pp.validation?.error_questions || [])
              .map(
                (e) => `Q${e.qId}:${(e.issue_codes || []).join(",")}`,
              )
              .slice(0, 5);
        const gapReasons = pp.validation?.id_gaps?.length
          ? [`id_gaps:${pp.validation.id_gaps.join(",")}`]
          : [];
        console.warn(
          `[extractor] pdf-parse rejected (sec=${sec}, reasons=${JSON.stringify([...reasons, ...gapReasons])})`,
        );
      }
    } catch (err) {
      console.warn(
        `[extractor] pdf-parse rejected (sec=${sec}, reasons=["exception:${err.message}"])`,
      );
    }

    if (pdfParseAccepted) {
      // Gemini 건너뛰고 sets 사용 — 이하 검증/postprocess/sanitize 는 공통 경로에서 실행
    } else if (sec === "reading") {
      console.log(`[extractor] fallback to Gemini (sec=${sec})`);
      console.log(
        `[step2] 독서 영역 추출 중 (Gemini, ${effectiveStartQ}~${effectiveReadingEnd}번)...`,
      );
      sets = await callGemini(
        pdfPath,
        GEMINI_READING_PROMPT(yearKey, effectiveReadingEnd, effectiveStartQ),
        yearKey,
        sec,
      );
      // Gemini 경로임을 메타로 기록
      for (const s of sets || []) s._extractor = "gemini_fallback";
    } else {
      // 문학: 1차 전체 호출 (Gemini) — effectiveLiteratureStart/End 로 고정
      // 기존 로컬 litStartQ 변수 유지 (삭제 금지). effectiveLiteratureStart 와 동일값.
      console.log(`[extractor] fallback to Gemini (sec=${sec})`);
      const litStartQ = hasElectiveSection(yearKey) ? 18 : 18;
      void litStartQ;
      console.log(
        `[step2] 문학 영역 1차 추출 중 (Gemini, ${effectiveLiteratureStart}~${effectiveLiteratureEnd}번)...`,
      );
      const lit1 = await callGemini(
        pdfPath,
        GEMINI_LITERATURE_PROMPT(
          yearKey,
          effectiveLiteratureEnd,
          effectiveLiteratureStart,
          effectiveLiteratureEnd,
        ),
        yearKey,
        `${sec}_pass1`,
      );
      const year = yearKey.replace(/[^0-9]/g, "");
      const litIds = ["a", "b", "c", "d"];
      lit1.forEach((s, i) => {
        if (litIds[i]) s.id = `l${year}${litIds[i]}`;
      });

      // 추출된 Q번호 커버리지 확인 — effective 범위로만 루프
      const coveredQs = new Set(
        lit1.flatMap((s) => s.questions?.map((q) => q.id) || []),
      );
      const missingQs = [];
      for (
        let q = effectiveLiteratureStart;
        q <= effectiveLiteratureEnd;
        q++
      ) {
        if (!coveredQs.has(q)) missingQs.push(q);
      }

      if (missingQs.length > 0) {
        const maxCovered = Math.max(...coveredQs);
        console.log(
          `  ⚠️  미추출 Q번호: ${missingQs.join(",")} — 2차 호출로 보충`,
        );

        const lastSet = lit1[lit1.length - 1];
        const lastSents = lastSet?.sents || [];
        const lastAuthor =
          lastSents.find((s) => s.sentType === "author")?.t || "";
        const lastBodySent = [...lastSents]
          .reverse()
          .find((s) => ["body", "verse"].includes(s.sentType));
        const lastText = lastBodySent?.t?.slice(-50) || lastAuthor;

        const extractedSummary = lit1
          .map((s) => {
            const qs = s.questions?.map((q) => q.id) || [];
            return `Q${Math.min(...qs)}~${Math.max(...qs)}: "${s.title}"`;
          })
          .join(", ");

        // ★ GEMINI_LITERATURE_PROMPT와 동일한 완전한 스키마 + 위치 힌트
        // [NEW] 2차 보충도 effectiveLiteratureEnd 로 clamp
        const prompt2 =
          GEMINI_LITERATURE_PROMPT(
            yearKey,
            effectiveLiteratureEnd,
            maxCovered + 1,
            effectiveLiteratureEnd,
          ) +
          `\n\n[이미 추출 완료 — 절대 다시 추출하지 마라]\n${extractedSummary}` +
          `\n\n[시작 위치]\n다음 텍스트 이후부터 추출해줘: "${lastText}"`;

        const lit2 = await callGemini(pdfPath, prompt2, yearKey, `${sec}_pass2`);

        // ★ ID 강제 재할당 (1차 결과 이후 순서로)
        const allIds = "abcdefgh".split("");
        const startIdx = lit1.length;
        lit2.forEach((s, i) => {
          s.id = `l${year}${allIds[startIdx + i] || String.fromCharCode(97 + startIdx + i)}`;
        });

        sets = [...lit1, ...lit2];
      } else {
        console.log(`  ✅ 문학 전체 커버 (Q18~${lastQuestion})`);
        sets = lit1;
      }
      // Gemini 경로임을 메타로 기록
      for (const s of sets || []) s._extractor = "gemini_fallback";
    }

    // ── 추출 직후 검증 (범위 밖 세트 자동 필터링) ──
    const { valid, errors } = validateExtraction(
      sets,
      sec,
      lastQuestion,
      yearKey,
    );
    if (!valid) {
      console.warn(`\n⚠️  [step2] ${sec} 추출 검증 경고:`);
      errors.forEach((e) => console.warn(`  - ${e}`));
      // 범위 밖 Q번호를 가진 세트 필터링
      const minQ = sec === "reading" ? startQ : 18;
      const maxQ = lastQuestion;
      const before = sets.length;
      sets = sets.filter((s) => {
        const qIds = (s.questions || []).map((q) => q.id).filter(Boolean);
        if (qIds.length === 0) return false;
        return qIds.every((q) => q >= minQ && q <= maxQ);
      });
      console.warn(
        `  → ${before - sets.length}개 세트 제거, ${sets.length}개 유지`,
      );
      if (sets.length === 0) {
        throw new Error(`step2 ${sec}: 유효한 세트가 0개 — 재실행 필요`);
      }
    }

    console.log(`  ✅ ${sec} 검증 통과 (${sets.length}세트)`);

    // [NEW] step2 순수 구조화 강제 — QA 필드 (ok/pat/analysis/cs_ids/cs_spans/vocab) strip
    {
      const { stats: sanStats } = sanitizeToStructureOnly(sets);
      const emitted = Object.entries(sanStats).filter(([, v]) => v > 0);
      if (emitted.length > 0) {
        console.warn(
          `[step2:sanitize] QA 필드 strip 발생 (LLM 프롬프트 무시): ${emitted
            .map(([k, v]) => `${k}=${v}`)
            .join(", ")}`,
        );
      } else {
        console.log(`[step2:sanitize] QA 필드 leak 없음 ✅`);
      }
    }

    // [NEW] step2_postprocess 명시적 wiring — 원래 orphan 이었음.
    // questionType 자동설정 / <보기> 분리 / choice tail regex 정제 수행.
    // 변경 발생 시 step2_postprocess.mjs 가 [postprocess mutation] 로그 emit.
    sets = postprocess(sets, sec, { yearKey });

    // [NEW] postprocessed snapshot — postprocess 직후 상태 (rawparsed 와 diff 가능)
    try {
      const ppTs = new Date().toISOString().replace(/[:.]/g, "-");
      const snapDir = path.resolve(__dirname, "../pipeline/test_data");
      fs.mkdirSync(snapDir, { recursive: true });
      const ppPath = path.join(
        snapDir,
        `step2_postprocessed_${yearKey}_${sec}_${ppTs}.json`,
      );
      fs.writeFileSync(ppPath, JSON.stringify(sets, null, 2), "utf8");
      console.log(`[DEBUG] step2 postprocessed snapshot saved: ${ppPath}`);
    } catch (snapErr) {
      console.warn(
        `[DEBUG] postprocessed snapshot 저장 실패: ${snapErr.message}`,
      );
    }

    if (cachePath) {
      fs.writeFileSync(cachePath, JSON.stringify(sets, null, 2), "utf8");
      console.log(`  💾 저장: ${path.basename(cachePath)}`);
    }

    result[sec] = sets;
  }

  return result;
}

// ─── 커맨드라인 테스트 ────────────────────────────────────────
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const pdfPath = process.argv[2];
  const yearKey = process.argv[3];
  const lastQuestion = parseInt(process.argv[4]) || 45;
  const section = process.argv[5] || "all";

  if (!pdfPath || !yearKey) {
    console.error(
      "사용법: node pipeline/step2_extract.js <시험지PDF> <연도키> [마지막문항] [섹션]",
    );
    process.exit(1);
  }

  extractStructure(pdfPath, yearKey, lastQuestion, section)
    .then((result) => console.log(JSON.stringify(result, null, 2)))
    .catch((err) => {
      console.error("오류:", err.message);
      process.exit(1);
    });
}
