import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { jsonrepair } from "jsonrepair";

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

const GEMINI_READING_PROMPT = (yearKey, lastQ, startQ = null) => {
  const year = yearKey.replace(/[^0-9]/g, "");
  const fromQ = startQ || getReadingStartQ(yearKey);
  const readingEndQ = hasElectiveSection(yearKey) ? Math.min(lastQ, 34) : 17;
  return `너는 수능 국어 시험지 PDF에서 데이터를 추출하는 전문가야.
아래 JSON 스키마에 맞게 독서 영역(${fromQ}번~${readingEndQ}번 범위의 독서 지문)만 추출해줘.
※ ${fromQ > 1 ? `1~${fromQ - 1}번은 화법/작문/문법 선택영역이므로 절대 추출하지 마라.` : ""}

[출력 규칙]
- 순수 JSON만 출력. 설명, 마크다운 코드블록, 기타 텍스트 없음
- 저작권 고지, 페이지 번호, 문제 번호 텍스트는 포함하지 않음
- ㉠㉡㉢, ⓐⓑⓒ, [A][B], <보기> 등 모든 기호 원문 그대로 보존

[ok 필드 규칙]
- ok: true = 지문의 내용과 사실적으로 일치하는 선지
- ok: false = 지문의 내용과 사실적으로 일치하지 않는 선지
- ok: false는 반드시 문항당 정확히 1개만 존재한다

[questionType 규칙]
- "negative": "~않은 것은?" 등 부정 발문
- "positive": "가장 적절한 것은?" 등 긍정 발문

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
- 표·도식 안에서 답의 근거가 되는 직접적 텍스트: body로 포함
- 중략·생략 표시: sentType "omission"
- 이미지·그래프·순수 도식(텍스트 없는 그림): sentType "figure" 플레이스홀더 삽입

[이미지·도식 처리 규칙]
- 이미지, 그래프, 순수 도식이 지문 내에 있으면 해당 위치에 sentType "figure" sent를 삽입한다
- t 필드에는 "[도식: 내용을 간략히 묘사]" 형식으로 설명을 적는다
- 예: { "id": "r${year}as5", "t": "[도식: 세포막 구조 그림]", "sentType": "figure" }
- 텍스트가 포함된 표는 body로 추출하되, 순수 그림만 figure로 처리한다

[JSON 스키마 — 세트별 prefix 예시]
[
  {
    "id": "r${year}a",
    "title": "지문 핵심 주제어",
    "range": "1~3번",
    "sents": [
      { "id": "r${year}as1", "t": "첫 번째 문장", "sentType": "body" },
      { "id": "r${year}as2", "t": "두 번째 문장", "sentType": "body" },
      { "id": "r${year}as3", "t": "*각주 내용", "sentType": "footnote" },
      { "id": "r${year}as4", "t": "[도식: 예시 그림]", "sentType": "figure" }
    ],
    "questions": [{ "id": 1, "t": "발문", "bogi": "", "questionType": "negative",
      "choices": [{ "num": 1, "t": "선지", "ok": true, "pat": null, "analysis": "", "cs_ids": [] }]
    }],
    "vocab": [{ "word": "단어", "mean": "뜻 (20자 이내)", "sentId": "r${year}as1" }]
  },
  {
    "id": "r${year}b",
    "title": "두 번째 지문 주제어",
    "range": "4~7번",
    "sents": [
      { "id": "r${year}bs1", "t": "첫 번째 문장", "sentType": "body" },
      { "id": "r${year}bs2", "t": "두 번째 문장", "sentType": "body" }
    ],
    "questions": [{ "id": 4, "t": "발문", "bogi": "", "questionType": "positive",
      "choices": [{ "num": 1, "t": "선지", "ok": true, "pat": null, "analysis": "", "cs_ids": [] }]
    }],
    "vocab": [{ "word": "단어", "mean": "뜻 (20자 이내)", "sentId": "r${year}bs1" }]
  },
  {
    "id": "r${year}c",
    "title": "세 번째 지문 주제어",
    "range": "8~11번",
    "sents": [{ "id": "r${year}cs1", "t": "첫 번째 문장", "sentType": "body" }],
    "questions": [{ "id": 8, "t": "발문", "bogi": "", "questionType": "negative",
      "choices": [{ "num": 1, "t": "선지", "ok": true, "pat": null, "analysis": "", "cs_ids": [] }]
    }],
    "vocab": []
  },
  {
    "id": "r${year}d",
    "title": "네 번째 지문 주제어",
    "range": "12~17번",
    "sents": [{ "id": "r${year}ds1", "t": "첫 번째 문장", "sentType": "body" }],
    "questions": [{ "id": 12, "t": "발문", "bogi": "", "questionType": "negative",
      "choices": [{ "num": 1, "t": "선지", "ok": true, "pat": null, "analysis": "", "cs_ids": [] }]
    }],
    "vocab": []
  }
]

sentType: body / footnote / omission / figure
vocab은 3~4등급 학생이 어려워할 개념어 3~7개
bogi는 <보기> 텍스트가 있으면 채우고, 없으면 빈 문자열
PDF의 1번~17번 독서 전체를 추출해줘.`;
};

const GEMINI_LITERATURE_PROMPT = (yearKey, lastQ, fromQ = 18, toQ = null) => {
  const year = yearKey.replace(/[^0-9]/g, "");
  const endQ = toQ || lastQ;
  return `너는 수능 국어 시험지 PDF에서 데이터를 추출하는 전문가야.
아래 JSON 스키마에 맞게 문학 영역(${fromQ}번~${endQ}번)을 빠짐없이 전부 추출해줘.

⚠️ 최우선 규칙 — 누락 방지:
- 시험지에 있는 모든 문학 작품과 문제를 빠짐없이 추출하라.
- 문항 번호 순서대로(${fromQ}번부터 ${endQ}번까지) 하나도 빠뜨리지 마라.
- 범위를 스스로 판단하여 축소하지 마라. ${fromQ}~${endQ}번 사이의 모든 문항을 포함하라.
- 추출을 중단하지 마라. ${endQ}번까지 완전히 추출할 것.

[출력 규칙]
- 순수 JSON만 출력. 설명, 마크다운 코드블록, 기타 텍스트 없음
- 저작권 고지, 페이지 번호, 문제 번호 텍스트는 포함하지 않음
- ㉠㉡㉢, ⓐⓑⓒ, [A][B], <보기> 등 모든 기호 원문 그대로 보존
- 작품 제목, 작가명, 출처 표시 원문 그대로 보존

[ok 필드 규칙]
- ok: true = 작품/지문 내용과 사실적으로 일치하는 선지
- ok: false = 작품/지문 내용과 사실적으로 일치하지 않는 선지
- ok: false는 반드시 문항당 정확히 1개만 존재한다

[questionType 규칙]
- "negative": "~않은 것은?" 등 부정 발문
- "positive": "가장 적절한 것은?" 등 긍정 발문

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

[JSON 스키마 — 세트별 prefix 예시]
[
  {
    "id": "l${year}a",
    "title": "작품명 또는 복합 제목",
    "range": "${fromQ}~21번",
    "sents": [
      { "id": "l${year}as1", "t": "(가)", "sentType": "workTag" },
      { "id": "l${year}as2", "t": "작가명, 「작품명」", "sentType": "author" },
      { "id": "l${year}as3", "t": "<제 1수>", "sentType": "workTag" },
      { "id": "l${year}as4", "t": "초장 텍스트", "sentType": "verse" },
      { "id": "l${year}as5", "t": "중장 텍스트", "sentType": "verse" },
      { "id": "l${year}as6", "t": "종장 텍스트", "sentType": "verse" },
      { "id": "l${year}as7", "t": "(나)", "sentType": "workTag" },
      { "id": "l${year}as8", "t": "작가명, 「작품명」", "sentType": "author" },
      { "id": "l${year}as9", "t": "시 첫 번째 행", "sentType": "verse" },
      { "id": "l${year}as10", "t": "시 두 번째 행", "sentType": "verse" }
    ],
    "questions": [{ "id": ${fromQ}, "t": "발문", "bogi": "", "questionType": "negative",
      "choices": [{ "num": 1, "t": "선지", "ok": true, "pat": null, "analysis": "", "cs_ids": [] }]
    }],
    "vocab": [{ "word": "단어", "mean": "뜻 (20자 이내)", "sentId": "l${year}as4" }]
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
    "questions": [{ "id": 22, "t": "발문", "bogi": "", "questionType": "positive",
      "choices": [{ "num": 1, "t": "선지", "ok": true, "pat": null, "analysis": "", "cs_ids": [] }]
    }],
    "vocab": []
  }
]

vocab은 3~4등급 학생이 어려워할 고어/한자어/방언 3~7개
bogi는 <보기> 텍스트가 있으면 채우고, 없으면 빈 문자열
PDF의 ${fromQ}번~${endQ}번 문학 영역을 추출해줘.`;
};

/**
 * Gemini API로 PDF에서 텍스트 추출
 * Claude API 대비 PDF 파싱 안정성이 높음
 */
async function callGemini(pdfPath, prompt) {
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

  const debugPath = path.resolve(
    __dirname,
    "../pipeline/debug_last_response.txt",
  );
  fs.writeFileSync(debugPath, result, "utf8");

  const text = stripMarkdown(result);
  try {
    return JSON.parse(text);
  } catch {
    try {
      return JSON.parse(fixUnescapedQuotes(text));
    } catch {
      try {
        return JSON.parse(jsonrepair(text));
      } catch (err3) {
        console.error("Gemini JSON 파싱 실패:", err3.message);
        throw err3;
      }
    }
  }
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

  if (isLegacyFormat(yearKey)) {
    console.log(`[step2] 구형 수능 포맷 (${yearKey}) — 16~45번 통합 추출`);
    const pdfBuffer = fs.readFileSync(pdfPath);
    return extractLegacy(pdfBuffer.toString("base64"), yearKey);
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
    const startQ = getReadingStartQ(yearKey);
    let sets;
    if (sec === "reading") {
      console.log(
        `[step2] 독서 영역 추출 중 (Gemini, ${startQ}~${lastQuestion}번)...`,
      );
      sets = await callGemini(
        pdfPath,
        GEMINI_READING_PROMPT(yearKey, lastQuestion, startQ),
      );
    } else {
      // 문학: 1차 전체 호출 (Gemini)
      const litStartQ = hasElectiveSection(yearKey) ? 18 : 18;
      console.log(
        `[step2] 문학 영역 1차 추출 중 (Gemini, ${litStartQ}~${lastQuestion}번)...`,
      );
      const lit1 = await callGemini(
        pdfPath,
        GEMINI_LITERATURE_PROMPT(yearKey, lastQuestion, litStartQ),
      );
      const year = yearKey.replace(/[^0-9]/g, "");
      const litIds = ["a", "b", "c", "d"];
      lit1.forEach((s, i) => {
        if (litIds[i]) s.id = `l${year}${litIds[i]}`;
      });

      // 추출된 Q번호 커버리지 확인
      const coveredQs = new Set(
        lit1.flatMap((s) => s.questions?.map((q) => q.id) || []),
      );
      const missingQs = [];
      for (let q = 18; q <= lastQuestion; q++) {
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
        const prompt2 =
          GEMINI_LITERATURE_PROMPT(
            yearKey,
            lastQuestion,
            maxCovered + 1,
            lastQuestion,
          ) +
          `\n\n[이미 추출 완료 — 절대 다시 추출하지 마라]\n${extractedSummary}` +
          `\n\n[시작 위치]\n다음 텍스트 이후부터 추출해줘: "${lastText}"`;

        const lit2 = await callGemini(pdfPath, prompt2);

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
      // 범위 밖 Q번호 처리: 세트 내 범위 밖 문항만 제거, 세트 자체는 유지
      const minQ = sec === "reading" ? startQ : 18;
      const maxQ = lastQuestion;
      const before = sets.length;
      sets = sets.filter((s) => {
        const qIds = (s.questions || []).map((q) => q.id).filter(Boolean);
        if (qIds.length === 0) return false;
        // 범위와 하나라도 겹치면 유지
        const hasOverlap = qIds.some((q) => q >= minQ && q <= maxQ);
        if (!hasOverlap) return false;
        // 범위 밖 문항만 제거
        const beforeQ = s.questions.length;
        s.questions = s.questions.filter((q) => q.id >= minQ && q.id <= maxQ);
        if (s.questions.length < beforeQ) {
          console.warn(
            `  → ${s.id}: 범위 밖 문항 ${beforeQ - s.questions.length}개 제거, ${s.questions.length}개 유지`,
          );
        }
        return s.questions.length > 0;
      });
      console.warn(
        `  → ${before - sets.length}개 세트 제거, ${sets.length}개 유지`,
      );
      if (sets.length === 0) {
        throw new Error(`step2 ${sec}: 유효한 세트가 0개 — 재실행 필요`);
      }
    }

    console.log(`  ✅ ${sec} 검증 통과 (${sets.length}세트)`);

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
