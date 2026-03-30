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
  const response = await client.messages.create(
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
  );

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

export async function extractStructure(pdfPath, yearKey, lastQuestion = 45) {
  const year = yearKey.replace(/[^0-9]/g, '');

  const pdfBuffer = fs.readFileSync(pdfPath);
  const pdfBase64 = pdfBuffer.toString('base64');

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
