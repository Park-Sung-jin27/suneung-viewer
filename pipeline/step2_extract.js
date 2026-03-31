import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { jsonrepair } from 'jsonrepair';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env'), override: true });

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `너는 수능 국어 시험지 PDF에서 데이터를 추출하는 전문가야.
반드시 순수 JSON 배열만 출력하라. 마크다운 코드블록, 설명 텍스트 없음.
저작권 고지, 페이지 번호 텍스트는 포함하지 않음.
㉠㉡㉢, ⓐⓑⓒ, [A][B], <보기> 등 모든 기호 원문 그대로 보존.
중요: JSON 문자열 값 내부에 큰따옴표(")가 있으면 반드시 백슬래시로 이스케이프(\")하거나 작은따옴표(')로 대체하라. 이스케이프 누락은 JSON 파싱 오류를 유발한다.

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
  sents: [{ id: 'r2022a_s1', t: '문장 원문', sentType: 'body' }],
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
  vocab: [{ word: '단어', mean: '뜻 20자 이내', sentId: 'r2022a_s1' }]
}]

sentType 종류: body / footnote / omission / workTag
vocab은 3~4등급 학생이 어려워할 개념어 3~7개
bogi는 <보기> 텍스트가 있으면 채우고, 없으면 빈 문자열`;

// ── 구형 수능 포맷 판별 (2022 미만) ──
function isLegacyFormat(yearKey) {
  const m = yearKey.match(/(\d{4})/);
  return m ? parseInt(m[1], 10) < 2022 : false;
}

// ── 세트 분류: reading / literature ──
function classifySection(set) {
  // workTag가 있으면 문학
  if (set.sents?.some(s => s.sentType === 'workTag')) return 'literature';
  // 작가명 패턴 ("— 작가명", "- 작가명,") 검사
  const authorPattern = /[-—]\s*.+[,，」\-]/;
  if (set.sents?.some(s => authorPattern.test(s.t || ''))) return 'literature';
  if (set.sents?.some(s => (s.sentType || '') === 'author')) return 'literature';
  if (set.sents?.some(s => (s.sentType || '') === 'verse')) return 'literature';
  return 'reading';
}

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
  sents: [{ id: 'set_a_s1', t: '문장 원문', sentType: 'body' }],
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
  vocab: [{ word: '단어', mean: '뜻 20자 이내', sentId: 'set_a_s1' }]
}]

sentType 종류: body / verse / footnote / omission / workTag / author
vocab은 3~4등급 학생이 어려워할 개념어 3~7개
bogi는 <보기> 텍스트가 있으면 채우고, 없으면 빈 문자열`;

async function callWithRetry(fn, maxRetries = 3, delay = 5000) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (err) {
      const isRetryable = err.message?.includes('Connection') ||
                          err.message?.includes('timeout') ||
                          err.status === 529 ||
                          err.status === 500;
      if (isRetryable && i < maxRetries - 1) {
        console.warn(`  ⚠️ API 오류 (${i+1}/${maxRetries}): ${err.message}`);
        console.warn(`  ${delay/1000}초 후 재시도...`);
        await new Promise(r => setTimeout(r, delay));
      } else {
        throw err;
      }
    }
  }
}

function stripMarkdown(text) {
  return text.trim().replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/i, '');
}

// JSON 문자열 내부의 이스케이프되지 않은 큰따옴표를 수정
function fixUnescapedQuotes(jsonStr) {
  const result = [];
  let inString = false;
  let i = 0;

  while (i < jsonStr.length) {
    const ch = jsonStr[i];

    if (ch === '\\' && inString) {
      // 이미 이스케이프된 문자 — 그대로 통과
      result.push(ch, jsonStr[i + 1] || '');
      i += 2;
      continue;
    }

    if (ch === '"') {
      if (!inString) {
        inString = true;
        result.push(ch);
      } else {
        // 닫는 따옴표인지 확인: 뒤에 오는 첫 non-whitespace 문자가 JSON 구조 문자이면 닫는 따옴표
        let j = i + 1;
        while (j < jsonStr.length && ' \n\r\t'.includes(jsonStr[j])) j++;
        const next = jsonStr[j];
        if (next === ':' || next === ',' || next === '}' || next === ']' || j >= jsonStr.length) {
          inString = false;
          result.push(ch);
        } else {
          // 문자열 내부의 이스케이프되지 않은 따옴표 → 이스케이프
          result.push('\\"');
        }
      }
    } else {
      result.push(ch);
    }

    i++;
  }

  return result.join('');
}

async function callClaude(pdfBase64, userPrompt) {
  const response = await callWithRetry(() => client.messages.create(
    {
      model: 'claude-sonnet-4-5',
      max_tokens: 16000,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: pdfBase64,
              },
            },
            {
              type: 'text',
              text: userPrompt,
            },
          ],
        },
      ],
    },
    { headers: { 'anthropic-beta': 'output-128k-2025-02-19' } }
  ));

  const raw = response.content[0].text;
  console.log(`[debug] stop_reason: ${response.stop_reason}, 응답 길이: ${raw.length}자`);

  // 전체 응답을 디버그 파일로 저장
  const debugPath = path.resolve(__dirname, '../pipeline/debug_last_response.txt');
  fs.writeFileSync(debugPath, raw, 'utf8');

  const text = stripMarkdown(raw);

  try {
    return JSON.parse(text);
  } catch (err) {
    console.warn('JSON 직접 파싱 실패, 따옴표 수정 시도:', err.message);
    try {
      const fixed = fixUnescapedQuotes(text);
      return JSON.parse(fixed);
    } catch {
      console.warn('따옴표 수정 실패, jsonrepair 시도');
      try {
        const repaired = jsonrepair(text);
        return JSON.parse(repaired);
      } catch (err3) {
        console.error('jsonrepair도 실패:', err3.message);
        console.error('원본 응답 (앞 500자):', raw.slice(0, 500));
        throw err3;
      }
    }
  }
}

async function callClaudeLegacy(pdfBase64, userPrompt) {
  const response = await callWithRetry(() => client.messages.create(
    {
      model: 'claude-sonnet-4-5',
      max_tokens: 16000,
      system: LEGACY_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: pdfBase64,
              },
            },
            {
              type: 'text',
              text: userPrompt,
            },
          ],
        },
      ],
    },
    { headers: { 'anthropic-beta': 'output-128k-2025-02-19' } }
  ));

  const raw = response.content[0].text;
  console.log(`[debug] stop_reason: ${response.stop_reason}, 응답 길이: ${raw.length}자`);

  const debugPath = path.resolve(__dirname, '../pipeline/debug_last_response.txt');
  fs.writeFileSync(debugPath, raw, 'utf8');

  const text = stripMarkdown(raw);

  try {
    return JSON.parse(text);
  } catch (err) {
    console.warn('JSON 직접 파싱 실패, 따옴표 수정 시도:', err.message);
    try {
      const fixed = fixUnescapedQuotes(text);
      return JSON.parse(fixed);
    } catch {
      console.warn('따옴표 수정 실패, jsonrepair 시도');
      try {
        const repaired = jsonrepair(text);
        return JSON.parse(repaired);
      } catch (err3) {
        console.error('jsonrepair도 실패:', err3.message);
        console.error('원본 응답 (앞 500자):', raw.slice(0, 500));
        throw err3;
      }
    }
  }
}

async function extractLegacy(pdfBase64, yearKey) {
  const year = yearKey.replace(/[^0-9]/g, '');
  const caller = callClaudeLegacy;

  console.log(`[step2] 구형 포맷 감지 — 16~27번 추출 중...`);
  const batch1 = await caller(
    pdfBase64,
    `이 시험지의 16번~27번을 추출해줘. id는 set_a, set_b, set_c 순으로 사용해.`
  );

  console.log(`[step2] 구형 포맷 — 28~39번 추출 중...`);
  const batch2 = await caller(
    pdfBase64,
    `이 시험지의 28번~39번을 추출해줘. id는 set_d, set_e, set_f 순으로 사용해.`
  );

  console.log(`[step2] 구형 포맷 — 40~45번 추출 중...`);
  const batch3 = await caller(
    pdfBase64,
    `이 시험지의 40번~45번을 추출해줘. id는 set_g, set_h 순으로 사용해.`
  );

  const allSets = [...batch1, ...batch2, ...batch3];

  // 자동 분류
  const reading = [];
  const literature = [];
  let rIdx = 0, lIdx = 0;
  const rLetters = 'abcdefgh';
  const lLetters = 'abcdefgh';

  for (const set of allSets) {
    const section = classifySection(set);
    if (section === 'literature') {
      const letter = lLetters[lIdx++] || lLetters[lLetters.length - 1];
      const newId = `l${year}${letter}`;
      // ID 재매핑
      const oldId = set.id;
      set.id = newId;
      set.sents = set.sents.map((s, i) => ({ ...s, id: `${newId}s${i + 1}` }));
      set.vocab = (set.vocab || []).map(v => {
        const oldSentId = v.sentId;
        const idx = parseInt((oldSentId || '').replace(/\D/g, ''), 10) || 1;
        return { ...v, sentId: `${newId}s${idx}` };
      });
      literature.push(set);
    } else {
      const letter = rLetters[rIdx++] || rLetters[rLetters.length - 1];
      const newId = `r${year}${letter}`;
      const oldId = set.id;
      set.id = newId;
      set.sents = set.sents.map((s, i) => ({ ...s, id: `${newId}s${i + 1}` }));
      set.vocab = (set.vocab || []).map(v => {
        const oldSentId = v.sentId;
        const idx = parseInt((oldSentId || '').replace(/\D/g, ''), 10) || 1;
        return { ...v, sentId: `${newId}s${idx}` };
      });
      reading.push(set);
    }
  }

  console.log(`[step2] 분류 결과: reading ${reading.length}세트, literature ${literature.length}세트`);
  return { reading, literature };
}

export async function extractStructure(pdfPath, yearKey, lastQuestion = 45) {
  const year = yearKey.replace(/[^0-9]/g, '');

  const pdfBuffer = fs.readFileSync(pdfPath);
  const pdfBase64 = pdfBuffer.toString('base64');

  // ── 구형 포맷 분기 ──
  if (isLegacyFormat(yearKey)) {
    console.log(`[step2] 구형 수능 포맷 (${yearKey}) — 16~45번 통합 추출`);
    return extractLegacy(pdfBase64, yearKey);
  }

  // ── 신형 포맷 (2022~) ──
  console.log(`[step2] 독서 영역 앞부분 추출 중 (1~9번)...`);
  const reading1 = await callClaude(
    pdfBase64,
    `이 시험지의 독서 영역 1번~9번만 추출해줘. id는 r${year}a, r${year}b 순으로 사용해.`
  );

  console.log(`[step2] 독서 영역 뒷부분 추출 중 (10~17번)...`);
  const reading2 = await callClaude(
    pdfBase64,
    `이 시험지의 독서 영역 10번~17번만 추출해줘. id는 r${year}c, r${year}d 순으로 사용해.`
  );

  const reading = [...reading1, ...reading2];

  console.log(`[step2] 문학 영역 1구간 추출 중 (18~23번)...`);
  const literature1 = await callClaude(
    pdfBase64,
    `이 시험지의 문학 영역 18번~23번만 추출해줘. id는 l${year}a 로 사용해.`
  );

  console.log(`[step2] 문학 영역 2구간 추출 중 (24~29번)...`);
  const literature2 = await callClaude(
    pdfBase64,
    `이 시험지의 문학 영역 24번~29번만 추출해줘. id는 l${year}b 로 사용해.`
  );

  console.log(`[step2] 문학 영역 3구간 추출 중 (30~${lastQuestion}번)...`);
  const literature3 = await callClaude(
    pdfBase64,
    `이 시험지의 문학 영역 30번~${lastQuestion}번만 추출해줘. id는 l${year}c, l${year}d 순으로 사용해.`
  );

  const literature = [...literature1, ...literature2, ...literature3];

  return { reading, literature };
}

// 커맨드라인 테스트
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const pdfPath = process.argv[2];
  const yearKey = process.argv[3];
  const lastQuestion = parseInt(process.argv[4]) || 45;

  if (!pdfPath || !yearKey) {
    console.error('사용법: node pipeline/step2_extract.js [시험지PDF경로] [연도키] [마지막문항번호]');
    console.error('예시: node pipeline/step2_extract.js 시험지.pdf 2022수능 34');
    process.exit(1);
  }

  extractStructure(pdfPath, yearKey, lastQuestion)
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
    })
    .catch((err) => {
      console.error('오류:', err.message);
      process.exit(1);
    });
}
